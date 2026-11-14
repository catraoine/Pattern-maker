// Every hour: gives the next Founding Atelier numbers to waitlist sign-ups (and founding-place sign-ups from Your
// account) not yet on the list, earliest first, until the 250 places are gone (src/server/founding.ts). The only thing
// that hands out numbers, so no two people get the same one. Waits until the list is marked open, which is done by hand
// once every tester Cat approved is on it, so the testers get the first numbers.
import { getStore } from '@netlify/blobs';
import { MEMBERS_KEY, addJoiners, isFull, readList, type Joiner } from '../../src/server/founding';

// Sign-ups read at once, so a long waitlist reads quickly without a burst of hundreds of requests.
const BATCH = 20;

export default async () => {
  const founding = getStore({ name: 'founding', consistency: 'strong' });
  const kept = await founding.getWithMetadata(MEMBERS_KEY, { type: 'json' });
  const list = kept ? readList(kept.data) : null;
  if (!list?.open || !kept || isFull(list)) return;

  const signups = getStore({ name: 'signups', consistency: 'strong' });
  const have = new Set(list.members.map((m) => m.id));
  // The email hash is the last part of the key: news/<id> or interest/founding/<id>.
  const keys = [...(await signups.list({ prefix: 'news/' })).blobs, ...(await signups.list({ prefix: 'interest/founding/' })).blobs].map((b) => b.key);
  const fresh = keys.filter((k) => !have.has(k.slice(k.lastIndexOf('/') + 1)));
  const joiners: Joiner[] = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    const got = await Promise.all(fresh.slice(i, i + BATCH).map(async (k) => [k, (await signups.get(k, { type: 'json' })) as { receivedAt?: unknown; firstAt?: unknown } | null] as const));
    for (const [k, s] of got) {
      // firstAt: when they first joined, kept by signup.mts when someone signs up again.
      const at = typeof s?.firstAt === 'string' ? s.firstAt : s?.receivedAt;
      if (typeof at === 'string') joiners.push({ id: k.slice(k.lastIndexOf('/') + 1), receivedAt: at });
    }
  }
  // Someone on both lists is numbered once, by their earlier sign-up.
  const next = addJoiners(list, joiners);
  if (next === list) return;
  // Only if nobody changed the list since it was read (a tester added by hand); otherwise next hour tries again.
  const { modified } = await founding.setJSON(MEMBERS_KEY, next, { onlyIfMatch: kept.etag });
  console.log(modified ? `founding catch-up numbered ${next.members.length - list.members.length}` : 'founding list changed meanwhile, next hour tries again');
};

export const config = { schedule: '@hourly' };
