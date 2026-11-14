import { describe, expect, it } from 'vitest';
import type { CountStore } from '../photo/limit';
import { BODYGRAM_ORG, SCAN_CAPS, newScanToken, scanUrl, takeScanPass } from './bodyScan';

const memoryStore = (): CountStore & { data: Map<string, number> } => {
  const data = new Map<string, number>();
  return {
    data,
    get: async (k) => data.get(k) ?? 0,
    take: async (k, cap) => {
      const n = data.get(k) ?? 0;
      if (n >= cap) return false;
      data.set(k, n + 1);
      return true;
    },
  };
};

const day = new Date('2026-11-16T18:00:00Z');

describe('body scan passes', () => {
  it('gives a tester a few passes a day, then stops them until tomorrow', async () => {
    const store = memoryStore();
    for (let i = 0; i < SCAN_CAPS.visitor; i++) expect(await takeScanPass(store, 'a', day)).toBe('ok');
    expect(await takeScanPass(store, 'a', day)).toBe('limit_reached');
    expect(await takeScanPass(store, 'b', day)).toBe('ok');
    expect(await takeScanPass(store, 'a', new Date('2026-11-17T18:00:00Z'))).toBe('ok');
  });

  it('stops everyone once the month is used up, without counting the refused tester', async () => {
    const store = memoryStore();
    store.data.set('2026-11/all', SCAN_CAPS.month);
    expect(await takeScanPass(store, 'new', day)).toBe('busy');
    expect(store.data.get('2026-11-16/visitor/new')).toBeUndefined();
    expect(await takeScanPass(store, 'new', new Date('2026-12-01T18:00:00Z'))).toBe('ok');
  });

  it('opens the scanner in the tester\'s own units', () => {
    expect(scanUrl('abc', 'cm')).toBe(`https://platform.bodygram.com/en/${BODYGRAM_ORG}/scan?token=abc&system=metric`);
    expect(scanUrl('abc', 'in')).toContain('system=imperial');
  });

  it('asks Bodygram for a one-scan pass with the key in a header, never the address', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const token = await newScanToken('test-key', async (url, init) => {
      seen = { url, init };
      return Response.json({ token: 'pass-1', expiresAt: 1 });
    });
    expect(token).toBe('pass-1');
    expect(seen?.url).toBe(`https://platform.bodygram.com/api/orgs/${BODYGRAM_ORG}/scan-tokens`);
    expect(seen?.url).not.toContain('test-key');
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe('test-key');
    expect(JSON.parse(String(seen?.init.body)).scope).toEqual(['api.platform.bodygram.com/scans:create', 'api.platform.bodygram.com/scans:read']);
  });

  it('gives no pass when Bodygram says no or answers oddly', async () => {
    expect(await newScanToken('k', async () => new Response('nope', { status: 401 }))).toBeNull();
    expect(await newScanToken('k', async () => Response.json({ token: 42 }))).toBeNull();
    expect(await newScanToken('k', async () => new Response('not json'))).toBeNull();
  });
});
