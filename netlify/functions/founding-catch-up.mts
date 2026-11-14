// Every hour: gives the next Founding Atelier numbers to waitlist sign-ups not yet on the list, earliest first, until the
// 250 places are gone (src/server/founding.ts). The only thing that hands out numbers, so no two people get the same
// one. Waits until the testers are on the list (they are added by hand, once Cat has approved them), so they get 1 to 46.
import { getStore } from '@netlify/blobs';
import { MEMBERS_KEY, addJoiners, isFull, readList, type Joiner } from '../../src/server/founding';

export default async () => {
  const founding = getStore({ name: 'founding', consistency: 'strong' });
  const kept = await founding.getWithMetadata(MEMBERS_KEY, { type: 'json' });
  const list = kept ? readList(kept.data) : null;
  if (!list || !kept || isFull(list)) return;

  const signups = getStore({ name: 'signups', consistency: 'strong' });
  const have = new Set(list.members.map((m) => m.id));
  const keys = (await signups.list({ prefix: 'news/' })).blobs.map((b) => b.key).filter((k) => !have.has(k.slice('news/'.length)));
  const joiners: Joiner[] = [];
  for (const k of keys) {
    const s = (await signups.get(k, { type: 'json' })) as { receivedAt?: unknown } | null;
    if (typeof s?.receivedAt === 'string') joiners.push({ id: k.slice('news/'.length), receivedAt: s.receivedAt });
  }
  const next = addJoiners(list, joiners);
  if (next === list) return;
  // Only if nobody changed the list since it was read (a tester added by hand); otherwise next hour tries again.
  const { modified } = await founding.setJSON(MEMBERS_KEY, next, { onlyIfMatch: kept.etag });
  console.log(modified ? `founding catch-up numbered ${next.members.length - list.members.length}` : 'founding list changed meanwhile, next hour tries again');
};

export const config = { schedule: '@hourly' };
