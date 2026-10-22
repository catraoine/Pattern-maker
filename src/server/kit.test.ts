import { describe, expect, it } from 'vitest';
import { KIT_API, addToKit } from './kit';

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
