import { describe, expect, it, vi } from 'vitest';
// A test file can't sit beside the function: Netlify would deploy it as a function of its own.

// The counter can be made unreachable, to check the cap fails closed.
const counter = vi.hoisted(() => ({ down: false, n: 0 }));
vi.mock('./blobCounts', () => ({
  blobCounts: () => ({
    get: async () => {
      if (counter.down) throw new Error('store unreachable');
      return 0;
    },
    take: async () => {
      if (counter.down) throw new Error('store unreachable');
      counter.n++;
      return true;
    },
  }),
}));
// Never reaches the API in a test: the reader is checked on its own in describeFit.test.ts.
const read = vi.hoisted(() => vi.fn(async () => ({ ok: true, reading: { matches: [], notCovered: [] } })));
vi.mock('../photo/describeFit', () => ({ describeFit: read }));

const env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: 'test-key' };
(globalThis as unknown as { Netlify: unknown }).Netlify = { env: { get: (n: string) => env[n] } };

const call = async (body: object) => {
  const { default: handler } = await import('../../netlify/functions/describe-fit.mjs');
  const req = new Request('https://example.test/.netlify/functions/describe-fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const res = await handler(req, { ip: '203.0.113.9' });
  return { status: res.status, body: (await res.json()) as { ok: boolean; error?: string } };
};

describe('describe-fit function, end to end', () => {
  it('turns away a garment that has no fitting list, without counting or reading', async () => {
    expect(await call({ text: 'gapes at the neck', garment: 'hat' })).toEqual({ status: 400, body: { ok: false, error: 'bad_image' } });
    // A knit has no fitting list, so it never uses up a reading.
    expect(await call({ text: 'tight at the bust', garment: 'tee' })).toEqual({ status: 400, body: { ok: false, error: 'bad_image' } });
    expect(counter.n).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it('counts each reading, then reads', async () => {
    expect((await call({ text: 'gapes at the neck', garment: 'bodice', bustDart: true })).status).toBe(200);
    expect(counter.n).toBeGreaterThan(0);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('says no when the counter cannot be reached', async () => {
    counter.down = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await call({ text: 'gapes at the neck', garment: 'bodice' })).toEqual({ status: 429, body: { ok: false, error: 'busy' } });
    expect(read).toHaveBeenCalledTimes(1);
    counter.down = false;
  });
});
