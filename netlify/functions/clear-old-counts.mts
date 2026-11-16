// Every day: deletes the daily counters from before yesterday in every cap's store (src/server/oldCounts.ts), so the
// scrambled codes made from visitors' IP addresses are kept for a day, as the privacy policy says, and no longer.
import { getStore } from '@netlify/blobs';
import { COUNT_STORES, oldCountKeys } from '../../src/server/oldCounts';

export default async () => {
  let cleared = 0;
  for (const name of COUNT_STORES) {
    try {
      const store = getStore({ name, consistency: 'strong' });
      const old = oldCountKeys((await store.list()).blobs.map((b) => b.key));
      // A few at a time, so a long backlog doesn't go out as one burst of requests.
      for (let i = 0; i < old.length; i += 20) await Promise.all(old.slice(i, i + 20).map((k) => store.delete(k)));
      cleared += old.length;
    } catch (e) {
      // One store that can't be reached doesn't stop the rest; tomorrow's run tries it again.
      console.error(`old counters not cleared in ${name}`, e);
    }
  }
  if (cleared) console.log(`cleared ${cleared} old counters`);
};

// Just after midnight UTC, when a new day's counters start.
export const config = { schedule: '10 0 * * *' };
