import { describe, expect, it } from 'vitest';
import { CountRush, takeCount, type EtagStore } from './blobCounts';

/** A store where someone else changes the count first, `clashes` times in a row. */
function clashing(start: number, clashes: number): EtagStore & { n: number } {
  const s = {
    n: start,
    etag: 0,
    async getWithMetadata() {
      return { data: String(s.n), etag: String(s.etag) };
    },
    async set(_key: string, value: string, opts: { onlyIfMatch: string } | { onlyIfNew: true }) {
      if (clashes > 0) {
        clashes--;
        s.etag++;
        return { modified: false };
      }
      if ('onlyIfMatch' in opts && opts.onlyIfMatch !== String(s.etag)) return { modified: false };
      s.n = Number(value);
      s.etag++;
      return { modified: true };
    },
  };
  return s;
}

const noPause = async () => {};

describe('daily counters', () => {
  it('counts one up, and says no at the cap', async () => {
    const s = clashing(4, 0);
    expect(await takeCount(s, 'k', 5, noPause)).toBe(true);
    expect(s.n).toBe(5);
    expect(await takeCount(s, 'k', 5, noPause)).toBe(false);
  });

  it('gets its turn after a few clashes', async () => {
    const s = clashing(0, 5);
    expect(await takeCount(s, 'k', 10, noPause)).toBe(true);
    expect(s.n).toBe(1);
  });

  it('tells a rush from a full day: it throws, so callers refuse with "try again", not "come back tomorrow"', async () => {
    await expect(takeCount(clashing(0, 100), 'k', 10, noPause)).rejects.toBeInstanceOf(CountRush);
  });

  it('waits longer between each try', async () => {
    const waits: number[] = [];
    await expect(takeCount(clashing(0, 100), 'k', 10, async (ms) => void waits.push(ms))).rejects.toBeInstanceOf(CountRush);
    expect(waits).toHaveLength(7);
    expect(waits.every((ms) => ms >= 0 && ms <= 800)).toBe(true);
  });
});
