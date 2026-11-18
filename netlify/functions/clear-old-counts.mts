// Every hour: deletes the daily counters of days gone by in every cap's store (src/server/oldCounts.ts), so the
// scrambled codes made from visitors' IP addresses are kept for a day, as the privacy policy says, and no longer.
import { getStore } from '@netlify/blobs';
import { COUNT_STORES, oldCountKeys } from '../../src/server/oldCounts';

// A scheduled function is stopped after 30 seconds. A long backlog (or the day after launch) can take longer than
// that, so each run stops itself in good time and the next hour's run carries on where it left off.
const BUDGET_MS = 20_000;

export default async () => {
  const started = Date.now();
  const outOfTime = () => Date.now() - started > BUDGET_MS;
  let cleared = 0;
  for (const name of COUNT_STORES) {
    if (outOfTime()) break;
    try {
      const store = getStore({ name, consistency: 'strong' });
      const old = oldCountKeys((await store.list()).blobs.map((b) => b.key));
      // A few at a time, so a long backlog doesn't go out as one burst of requests.
      for (let i = 0; i < old.length && !outOfTime(); i += 20) {
        const batch = old.slice(i, i + 20);
        await Promise.all(batch.map((k) => store.delete(k)));
        cleared += batch.length;
      }
    } catch (e) {
      // One store that can't be reached doesn't stop the rest; the next run tries it again.
      console.error(`old counters not cleared in ${name}`, e);
    }
  }
  if (cleared) console.log(`cleared ${cleared} old counters${outOfTime() ? ', more left for the next run' : ''}`);
};

// Ten past every hour: the first run after midnight UTC clears the day just ended, and the rest finish a backlog.
export const config = { schedule: '10 * * * *' };
