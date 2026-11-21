// Server side only: the daily counters behind every cap (photo readings, ideas, sign-ups, fit notes, tester checks,
// founding checks), kept in a Netlify Blobs store. Each count goes up with a compare-and-swap on the entry's etag, so a
// burst of requests arriving together can't all read the same old number and slip past a cap.
import { getStore } from '@netlify/blobs';
import type { CountStore } from '../photo/limit';

/** How many times to retry a count that someone else changed first, before giving up. */
const TRIES = 8;

/** The few calls a counter needs from the store, so the retrying can be tested without Netlify. */
export interface EtagStore {
  getWithMetadata(key: string): Promise<{ data: unknown; etag?: string } | null>;
  set(key: string, value: string, opts: { onlyIfMatch: string } | { onlyIfNew: true }): Promise<{ modified: boolean }>;
}

/**
 * A rush, not a full day: the count kept changing under us on every try. Thrown rather than answered as "at the cap",
 * so a crowd arriving in the same minute (founding members on Feb 9) hears "try again in a moment", not "come back
 * tomorrow". Every caller already refuses on a thrown error, so the cap still fails closed.
 */
export class CountRush extends Error {
  constructor() {
    super('Count too busy to take safely');
  }
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * Adds one unless the count is at `cap`. True when added, false when at the cap; throws CountRush when it could not
 * get a turn. Each retry waits a little longer, by a random amount, so a crowd spreads out instead of colliding again.
 */
export async function takeCount(store: EtagStore, key: string, cap: number, pause: (ms: number) => Promise<void> = wait): Promise<boolean> {
  for (let i = 0; i < TRIES; i++) {
    if (i) await pause(Math.random() * 25 * 2 ** Math.min(i, 5));
    const cur = await store.getWithMetadata(key);
    const n = Number(cur?.data ?? 0);
    if (n >= cap) return false;
    const { modified } = await store.set(key, String(n + 1), cur?.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (modified) return true;
  }
  throw new CountRush();
}

export const blobCounts = (name: string): CountStore => {
  const store = getStore({ name, consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    take: (key, cap) => takeCount(store as unknown as EtagStore, key, cap),
  };
};
