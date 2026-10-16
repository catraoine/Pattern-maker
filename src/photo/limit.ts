// Server side only: daily caps on photo readings, so nobody can run up the Claude bill, and on sent fit feedback.
// Counts are kept per day in a small key-value store (Netlify Blobs in production).

export const PER_VISITOR_PER_DAY = 5;
export const ALL_VISITORS_PER_DAY = 100;

export interface CountStore {
  get(key: string): Promise<number>;
  set(key: string, count: number): Promise<void>;
}

export type Allowance = 'ok' | 'limit_reached' | 'busy';

/** Use up one reading for this visitor today, unless they or the whole site are already at the cap. */
export async function takeAllowance(
  store: CountStore,
  visitor: string,
  now = new Date(),
  caps = { visitor: PER_VISITOR_PER_DAY, all: ALL_VISITORS_PER_DAY },
): Promise<Allowance> {
  const day = now.toISOString().slice(0, 10);
  const allKey = `${day}/all`;
  const visitorKey = `${day}/visitor/${visitor}`;
  const [all, mine] = await Promise.all([store.get(allKey), store.get(visitorKey)]);
  if (all >= caps.all) return 'busy';
  if (mine >= caps.visitor) return 'limit_reached';
  await Promise.all([store.set(allKey, all + 1), store.set(visitorKey, mine + 1)]);
  return 'ok';
}
