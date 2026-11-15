import { afterEach, describe, expect, it, vi } from 'vitest';
// A test file can't sit beside the function: Netlify would deploy it as a function of its own.

// The counters run in memory here; in production they are Netlify Blobs.
vi.mock('./blobCounts', () => {
  const data = new Map<string, number>();
  return {
    // Each named store counts on its own, as Netlify Blobs stores do.
    blobCounts: (name: string) => ({
      get: async (k: string) => data.get(`${name}:${k}`) ?? 0,
      take: async (k: string, cap: number) => {
        const n = data.get(`${name}:${k}`) ?? 0;
        if (n >= cap) return false;
        data.set(`${name}:${k}`, n + 1);
        return true;
      },
    }),
  };
});

const env: Record<string, string | undefined> = { TESTER_CODES: 'example-code,other-code', BODYGRAM_API_KEY: ' test-key\n' };
(globalThis as unknown as { Netlify: unknown }).Netlify = { env: { get: (n: string) => env[n] } };

const call = async (code: string | undefined, inBody = false) => {
  const { default: handler } = await import('../../netlify/functions/body-scan.mjs');
  const req = new Request('https://example.test/.netlify/functions/body-scan', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(code && !inBody ? { 'x-tester-code': code } : {}) }, body: JSON.stringify(inBody ? { unit: 'cm', code } : { unit: 'cm' }) });
  const res = await handler(req, { ip: '203.0.113.9' });
  return { status: res.status, body: (await res.json()) as { ok: boolean; url?: string; error?: string } };
};

describe('body-scan function, end to end', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns away a request without a tester code', async () => {
    expect(await call(undefined)).toEqual({ status: 403, body: { ok: false, error: 'not_tester' } });
  });

  it('gives a tester the scanner address, sending Bodygram the trimmed key', async () => {
    let auth: string | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).Authorization;
      return Response.json({ token: 'pass-1', expiresAt: 1 });
    });
    const { status, body } = await call('Example-Code');
    expect(status).toBe(200);
    expect(body.url).toContain('token=pass-1');
    expect(auth).toBe('test-key');
  });

  it('takes the code from the body too, as the app now sends it', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ token: 'pass-2' }));
    expect((await call(' other-code ', true)).status).toBe(200);
    expect((await call('not-a-code', true)).status).toBe(403);
  });

  it('says failed, and logs why, when Bodygram turns the key down', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"message":"Unauthorized"}', { status: 401 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await call('example-code')).toEqual({ status: 502, body: { ok: false, error: 'failed' } });
    expect(log.mock.calls.flat().join(' ')).toContain('401');
    log.mockRestore();
  });

  // Last, since it uses up this address's checks for the day.
  it('stops answering after 10 code checks a day from one address, even for a right code', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ token: 'pass-3' }));
    for (let i = 0; i < 10; i++) await call(`guess-${i}`);
    expect(await call('example-code')).toEqual({ status: 429, body: { ok: false, error: 'limit_reached' } });
  });
});
