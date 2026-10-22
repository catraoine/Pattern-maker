// Server side only: checks what the app's report beacon sends (crash reports and anonymous daily counts) and
// sign-ups, before they're stored in Netlify Blobs. Imported by the report and signup functions.
import { z } from 'zod';
import { NIGHT_CITIES, OFFER_IDS } from '../offers';

export const MAX_BEACON_BYTES = 16_000;
export const MAX_SIGNUP_BYTES = 4_000;

/** Daily caps, so a stuck page or a script can't fill the store. Past them, the day's extra reports are dropped. */
export const DAY_CAPS = { beacons: 20_000, crashes: 200 };

/**
 * What can be counted: a visit, a step of the way (optionally with the garment it was for), and the four numbers the
 * business plan watches weekly: signup (with the source the visitor came from), printed, fit_reported, paid.
 */
export const EVENTS = ['visit', 'measured', 'styled', 'printed', 'photo', 'signup', 'fit_reported', 'paid'] as const;
const EVENT_KEY = new RegExp(`^(${EVENTS.join('|')})(:[a-z-]{2,20})?$`);

const CrashSchema = z
  .object({
    message: z.string().max(1_000),
    stack: z.string().max(8_000).optional(),
    where: z.enum(['error', 'promise', 'render']),
    view: z.string().max(30),
    version: z.string().max(40),
    browser: z.string().max(40),
    at: z.string().max(30),
  })
  .strict();

export const BeaconSchema = z
  .object({
    counts: z.record(z.string().regex(EVENT_KEY), z.number().int().min(1).max(20)).optional(),
    crashes: z.array(CrashSchema).max(5).optional(),
  })
  .strict();

export type Crash = z.infer<typeof CrashSchema>;
export type Beacon = z.infer<typeof BeaconSchema>;
export interface StoredCrash extends Crash {
  receivedAt: string;
}

/** One day's totals: the counts, plus how many beacons and crash reports came in (for the caps). */
export interface DayTotals {
  counts: Record<string, number>;
  beacons: number;
  crashes: number;
}
export const EMPTY_DAY: DayTotals = { counts: {}, beacons: 0, crashes: 0 };

function parse<T>(schema: z.ZodType<T>, text: string, maxBytes: number): T | null {
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    const r = schema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** The beacon to record, or null when the body isn't one (or is too big to be one). */
export function checkBeacon(text: string): Beacon | null {
  const b = parse(BeaconSchema, text, MAX_BEACON_BYTES);
  if (!b || Object.keys(b.counts ?? {}).length > 40) return null;
  return b;
}

/** Strips the things that could identify someone from error text: emails, file and photo data, query strings. */
export function scrubText(s: string): string {
  return s
    .replace(/\b(data|blob):[^\s)'"]+/g, '[$1]')
    .replace(/[^\s@'"<>()]+@[^\s@'"<>()]+\.[a-z]{2,}/gi, '[email]')
    // Page and file addresses keep their path, and a stack frame's line and column, but not the site or query.
    .replace(/https?:\/\/[^\s/)'"]+(\/[^\s?#)'"]*)?([?#][^\s)'"]*)?/g, (_, path?: string, query?: string) => (path || '/') + (query?.match(/(:\d+){1,2}$/)?.[0] ?? ''));
}

/**
 * A crash report as stored: trimmed, scrubbed, and with numbers in the message blanked, since a message could
 * carry a measurement. Quoted text with spaces in it (which could be a name) is blanked too; property names stay.
 */
export function scrubCrash(c: Crash, receivedAt: string): StoredCrash {
  const message = scrubText(c.message)
    .replace(/(["'“‘])([^"'”’]*\s[^"'”’]*)(["'”’])/g, '$1…$3')
    .replace(/\d+(\.\d+)?/g, '#')
    .slice(0, 300);
  const stack = c.stack
    ? scrubText(c.stack)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12)
        .join('\n')
        .slice(0, 1_500)
    : undefined;
  return { ...c, message, stack, view: c.view.replace(/[^a-z-]/gi, '').slice(0, 20), receivedAt };
}

/** Adds a beacon to the day's totals. Returns the new totals and the crash reports to store, within the caps. */
export function addBeacon(day: DayTotals, beacon: Beacon, receivedAt: string, caps = DAY_CAPS): { day: DayTotals; crashes: StoredCrash[] } {
  if (day.beacons >= caps.beacons) return { day, crashes: [] };
  const counts = { ...day.counts };
  for (const [k, n] of Object.entries(beacon.counts ?? {})) counts[k] = (counts[k] ?? 0) + n;
  const room = Math.max(0, caps.crashes - day.crashes);
  const crashes = (beacon.crashes ?? []).slice(0, room).map((c) => scrubCrash(c, receivedAt));
  return { day: { counts, beacons: day.beacons + 1, crashes: day.crashes + crashes.length }, crashes };
}

/** A small key-value store with conditional writes (Netlify Blobs in production). */
export interface DayStore {
  read(key: string): Promise<{ value: DayTotals; etag?: string } | null>;
  /** Writes only if the entry is unchanged since it was read (or still missing); false if someone got there first. */
  write(key: string, value: DayTotals, etag?: string): Promise<boolean>;
}

/** Read, change and write a day's totals, trying again if another request wrote in between. */
export async function updateDay<T>(store: DayStore, key: string, change: (d: DayTotals) => { day: DayTotals; extra: T }, tries = 4): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const cur = await store.read(key);
    const { day, extra } = change(cur?.value ?? EMPTY_DAY);
    if (day === cur?.value) return extra;
    if (await store.write(key, day, cur?.etag)) return extra;
  }
  return null;
}

/** The read-out key check. With no key set on the server, nobody gets in. Compares in constant time. */
export function keyMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < Math.max(given.length, expected.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  return diff === 0;
}

/** The four numbers to look at weekly, added up over the days given, with sign-ups and visits by source. */
export interface Funnel {
  visits: number;
  signups: number;
  printed: number;
  fitReported: number;
  paid: number;
  /** Sign-ups by where the visitor first came from (`?src=` on the link); "direct" when there was none. */
  signupsBySource: Record<string, number>;
  visitsBySource: Record<string, number>;
}

export function funnel(days: { counts: Record<string, number> }[]): Funnel {
  const f: Funnel = { visits: 0, signups: 0, printed: 0, fitReported: 0, paid: 0, signupsBySource: {}, visitsBySource: {} };
  const add = (into: Record<string, number>, k: string, n: number) => (into[k] = (into[k] ?? 0) + n);
  for (const d of days) {
    for (const [key, n] of Object.entries(d.counts)) {
      const [event, suffix] = key.split(':');
      if (event === 'visit') {
        if (!suffix) f.visits += n;
        add(f.visitsBySource, suffix ?? 'direct', n);
      } else if (event === 'signup') {
        f.signups += n;
        add(f.signupsBySource, suffix ?? 'direct', n);
      } else if (event === 'printed') f.printed += n;
      else if (event === 'fit_reported') f.fitReported += n;
      else if (event === 'paid') f.paid += n;
    }
  }
  return f;
}

/** The last `n` days, newest first, as YYYY-MM-DD. */
export function lastDays(now: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10));
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .pipe(z.email());
const text = (max: number) => z.string().trim().min(1).max(max);
// The hidden "website" box is left empty by people and filled in by bots.
const honeypot = z.literal('').optional();

export const SignupSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('tester'),
      name: text(80),
      email,
      sews: text(500),
      size: z.string().trim().max(80).optional(),
      consent: z.literal(true),
      website: honeypot,
    })
    .strict(),
  // A waitlist sign-up also says where the visitor first came from (?src=ig), so the newsletter list can show it.
  z.object({ kind: z.literal('news'), email, src: z.string().regex(/^[a-z-]{2,20}$/).optional(), website: honeypot }).strict(),
  // "Tell me when it opens" for a paid extra that isn't built yet (src/offers.ts).
  // Atelier Nights sign-ups also name the city, so the first night goes where the most people asked.
  z.object({
    kind: z.literal('interest'),
    offer: z.enum(OFFER_IDS),
    email,
    pattern: z.string().trim().max(120).optional(),
    // Deadstock: they'd like the length cut into their pattern pieces too.
    cut: z.boolean().optional(),
    city: z.enum(NIGHT_CITIES).optional(),
    website: honeypot,
  }).strict(),
]);

export type Signup = z.infer<typeof SignupSchema>;

/** The sign-up to store (without the honeypot), or null when the body isn't a valid one. */
export function checkSignup(text: string): Signup | null {
  const s = parse(SignupSchema, text, MAX_SIGNUP_BYTES);
  if (!s) return null;
  const { website: _, ...rest } = s;
  return rest as Signup;
}
