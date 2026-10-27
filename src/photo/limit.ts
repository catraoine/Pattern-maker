// Server side only: daily caps on photo readings, so nobody can run up the Claude bill, and on sent fit feedback.
// Counts are kept per day in a small key-value store (Netlify Blobs in production).

export const PER_VISITOR_PER_DAY = 5;
export const ALL_VISITORS_PER_DAY = 100;

/**
 * Fit testers (Cat, 2026-10-19): a tester code gives 20 readings a day, counted in their own pool so 40 testers
 * trying photos in one week don't use up the site's 100. The pool has its own cap, so the bill stays bounded.
 */
export const TESTER_CAPS = { visitor: 20, all: 600 };
export const TESTER_POOL = 'testers';

/**
 * Whether a code someone typed is one of the tester codes (TESTER_CODES in Netlify, comma separated).
 * Case and spaces don't matter, so a code read out or typed on a phone still works.
 */
export function isTesterCode(given: string | null | undefined, codes: string | undefined): boolean {
  const norm = (c: string) => c.trim().toLowerCase().replace(/\s+/g, '');
  const want = (codes ?? '').split(',').map(norm).filter((c) => c.length >= 4);
  return !!given && want.includes(norm(given));
}

export interface CountStore {
  get(key: string): Promise<number>;
  /** Adds one to the count unless it is already at `cap`, in one step nothing else can slip between. Whether it added. */
  take(key: string, cap: number): Promise<boolean>;
}

export type Allowance = 'ok' | 'limit_reached' | 'busy';

/** Use up one reading for this visitor today, unless they or the whole site are already at the cap. */
export async function takeAllowance(
  store: CountStore,
  visitor: string,
  now = new Date(),
  caps = { visitor: PER_VISITOR_PER_DAY, all: ALL_VISITORS_PER_DAY },
  /** A separate count, such as the testers', that neither uses up nor is stopped by everyone else's. */
  pool?: string,
): Promise<Allowance> {
  const day = now.toISOString().slice(0, 10);
  const base = pool ? `${day}/${pool}` : day;
  const allKey = `${base}/all`;
  const visitorKey = `${base}/visitor/${visitor}`;
  // A quick look first, so nobody's own count goes up on a day the site is already full.
  if ((await store.get(allKey)) >= caps.all) return 'busy';
  // The visitor's own count before the site's, so someone already at their cap can't use up everyone else's.
  if (!(await store.take(visitorKey, caps.visitor))) return 'limit_reached';
  return (await store.take(allKey, caps.all)) ? 'ok' : 'busy';
}
