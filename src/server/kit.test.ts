import { describe, expect, it } from 'vitest';
import { KIT_API, MAX_TRIES, addToKit, retryKit, type KitRetry, type RetryStore } from './kit';

const recorder = (status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status < 300, status };
  };
  return { calls, fetcher };
};

describe('Kit newsletter list', () => {
  it('does nothing until the key and form are set', async () => {
    const { calls, fetcher } = recorder();
    expect(await addToKit('a@b.co', 'ig', {}, 'https://maisontrace.co', fetcher)).toBe('off');
    expect(await addToKit('a@b.co', 'ig', { apiKey: 'kit_x' }, 'https://maisontrace.co', fetcher)).toBe('off');
    expect(calls).toHaveLength(0);
  });

  it('creates the subscriber, then adds them to the form with where they came from', async () => {
    const { calls, fetcher } = recorder();
    expect(await addToKit('a@b.co', 'ig', { apiKey: 'kit_x', formId: '123' }, 'https://maisontrace.co', fetcher)).toBe('sent');
    expect(calls.map((c) => c.url)).toEqual([`${KIT_API}/subscribers`, `${KIT_API}/forms/123/subscribers`]);
    expect((calls[0].init.headers as Record<string, string>)['X-Kit-Api-Key']).toBe('kit_x');
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ email_address: 'a@b.co', referrer: 'https://maisontrace.co/?utm_source=ig' });
  });

  it('reports a failure without throwing', async () => {
    const { fetcher } = recorder(401);
    expect(await addToKit('a@b.co', undefined, { apiKey: 'kit_x', formId: '123' }, 'https://maisontrace.co', fetcher)).toBe('failed');
    const broken = async () => {
      throw new Error('offline');
    };
    expect(await addToKit('a@b.co', undefined, { apiKey: 'kit_x', formId: '123' }, 'https://maisontrace.co', broken)).toBe('failed');
  });
});

describe('Kit catch-up', () => {
  const memory = (entries: Record<string, KitRetry>) => {
    const m = new Map(Object.entries(entries));
    const store: RetryStore = {
      list: async () => [...m.keys()],
      get: async (k) => m.get(k),
      set: async (k, v) => void m.set(k, v),
      delete: async (k) => void m.delete(k),
    };
    return { m, store };
  };
  const kit = { apiKey: 'kit_x', formId: '123' };

  it('sends what Kit missed and clears it', async () => {
    const { m, store } = memory({ a: { email: 'a@b.co', src: 'ig', tries: 0 }, b: { email: 'c@d.co', tries: 2 } });
    const { calls, fetcher } = recorder();
    expect(await retryKit(store, kit, 'https://maisontrace.co', fetcher)).toBe(2);
    expect(m.size).toBe(0);
    expect(calls).toHaveLength(4);
  });

  it('keeps a failed one for the next run, and gives up after a day', async () => {
    const { m, store } = memory({ a: { email: 'a@b.co', tries: 0 }, b: { email: 'c@d.co', tries: MAX_TRIES - 1 } });
    const { fetcher } = recorder(429);
    expect(await retryKit(store, kit, 'https://maisontrace.co', fetcher)).toBe(0);
    expect(m.get('a')?.tries).toBe(1);
    expect(m.has('b')).toBe(false);
  });

  it('sends no more than a batch a run, so the catch-up itself stays under the rate limit', async () => {
    const { m, store } = memory(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, { email: `p${i}@b.co`, tries: 0 }])));
    const { fetcher } = recorder();
    expect(await retryKit(store, kit, 'https://maisontrace.co', fetcher, 3)).toBe(3);
    expect(m.size).toBe(2);
  });

  it('does nothing until Kit is set up', async () => {
    const { m, store } = memory({ a: { email: 'a@b.co', tries: 0 } });
    expect(await retryKit(store, {}, 'https://maisontrace.co')).toBe(0);
    expect(m.size).toBe(1);
  });
});
