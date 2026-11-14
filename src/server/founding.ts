// The Founding Atelier list (Cat's "Build founding", Nov 13 2026): the first 250 members, each with a number that
// never changes. The fit testers come first (numbers 1 to 46, added by hand once Cat has approved the list), then
// everyone on the waitlist in the order they joined, which puts the 70 applicants who joined through their Nov 12
// email (?src=testers) ahead of anyone who joins after them. Numbers are given out by one hourly job
// (founding-catch-up.mts), so two sign-ups arriving together can never get the same number.
// Kept in the "founding" Netlify Blobs store under one key, by the same short email hash as the sign-ups store, so this
// list holds no email addresses of its own.
import { createHash } from 'node:crypto';

const FOUNDING_PLACES = 250;

/** The single key the whole list is kept under. */
export const MEMBERS_KEY = 'members';

type FoundingKind = 'tester' | 'founding';

export interface FoundingMember {
  /** hash(email), the same 16 characters the sign-ups store files a waitlist sign-up under. */
  id: string;
  n: number;
  kind: FoundingKind;
  /** When they joined the waitlist (or, for a tester, when they were added). */
  joinedAt: string;
}

export interface FoundingList {
  members: FoundingMember[];
  /** Set once every approved tester is on the list, so they get the first numbers; until then nobody else is numbered. */
  open?: boolean;
}

/** The email's short hash, as signup.mts files it: lower-cased and trimmed first, as the sign-up check does. */
export const emailId = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);

/** A waitlist sign-up, as far as numbering needs it. */
export interface Joiner {
  id: string;
  receivedAt: string;
}

/**
 * The list with the newest waitlist sign-ups numbered after everyone already on it, earliest first, until the 250
 * places are gone. Someone already on the list keeps their number, even if they sign up again later.
 */
export function addJoiners(list: FoundingList, joiners: Joiner[], places = FOUNDING_PLACES): FoundingList {
  const have = new Set(list.members.map((m) => m.id));
  let next = list.members.reduce((top, m) => Math.max(top, m.n), 0) + 1;
  const added: FoundingMember[] = [];
  const fresh = joiners.filter((j) => !have.has(j.id)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
  for (const j of fresh) {
    if (next > places || have.has(j.id)) continue;
    have.add(j.id);
    added.push({ id: j.id, n: next++, kind: 'founding', joinedAt: j.receivedAt });
  }
  return added.length ? { ...list, members: [...list.members, ...added] } : list;
}

/** Whether every place is taken, so the hourly job can stop reading the sign-ups. */
export const isFull = (list: FoundingList, places = FOUNDING_PLACES) => list.members.length >= places;

/** The founding place for a signed-in email, or null when they aren't on the list. */
export function placeFor(list: FoundingList, email: string): { n: number; kind: FoundingKind } | null {
  const id = emailId(email);
  const m = list.members.find((x) => x.id === id);
  return m ? { n: m.n, kind: m.kind } : null;
}

/** A stored list, checked, so a damaged entry reads as "nobody" rather than letting anyone in. */
export function readList(raw: unknown): FoundingList | null {
  const members = (raw as { members?: unknown } | null)?.members;
  if (!Array.isArray(members)) return null;
  const ok = members.every((m) => {
    const x = m as Partial<FoundingMember> | null;
    return !!x && typeof x.id === 'string' && /^[0-9a-f]{16}$/.test(x.id) && Number.isInteger(x.n) && (x.kind === 'tester' || x.kind === 'founding') && typeof x.joinedAt === 'string';
  });
  return ok ? { members: members as FoundingMember[], open: (raw as { open?: unknown }).open === true } : null;
}
