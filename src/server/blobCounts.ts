// Server side only: the daily counters behind every cap (photo readings, ideas, sign-ups, fit notes, tester checks),
// kept in a Netlify Blobs store. Each count goes up with a compare-and-swap on the entry's etag, so a burst of requests
// arriving together can't all read the same old number and slip past a cap.
import { getStore } from '@netlify/blobs';
import type { CountStore } from '../photo/limit';

/** How many times to retry a count that someone else changed first, before giving up and refusing. */
const TRIES = 8;

export const blobCounts = (name: string): CountStore => {
  const store = getStore({ name, consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    take: async (key, cap) => {
      for (let i = 0; i < TRIES; i++) {
        const cur = await store.getWithMetadata(key);
        const n = Number(cur?.data ?? 0);
        if (n >= cap) return false;
        const { modified } = await store.set(key, String(n + 1), cur?.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
        if (modified) return true;
      }
      // Too busy to count safely: refuse rather than let a reading through uncounted.
      return false;
    },
  };
};
