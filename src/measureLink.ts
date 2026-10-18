// Measure-me links (Cat's pick L1 Reply Link + L5 Redo Request + L4 studio branding, 2026-10-18).
// A dressmaker sends a client a link; the client measures with the how-to guides; the app writes a reply link
// with the numbers in it, which the client sends back. Everything travels after the # of the link, which
// browsers never send to a server, so nothing is stored anywhere but the two phones.
import { ME, Account, Person, newId, recordMeasurements, withPeople } from './account';
import { FIELDS, checkMeasurements, type Garment, type MeasurementId, type MeasurementValues } from './measurements';
import { BASE, GARMENTS, extrasFor, fieldOf, forHelper } from './measureFlow';

/** The dressmaker's ask, in the link they send. No measurements in it. */
export interface MeasureAsk {
  /** Matches the reply to the client it was sent to. */
  id: string;
  /** The dressmaker's name, for "Send to Anya". */
  from: string;
  /** Shown big on the client's first page, with Maison Tracé small. */
  studio?: string;
  note?: string;
  client: string;
  garment: Garment;
  /** Only these, again: a redo request. */
  redo?: MeasurementId[];
}

/** The client's numbers, in the link they send back. Values in cm. */
export interface MeasureReply {
  id: string;
  client: string;
  garment: Garment;
  date: string;
  values: MeasurementValues;
  redo?: boolean;
}

export type Incoming = { kind: 'ask'; ask: MeasureAsk } | { kind: 'reply'; reply: MeasureReply } | { kind: 'broken' };

const ASK = 'measure=';
const REPLY = 'measured=';

const KNOWN = new Set<MeasurementId>(Object.values(FIELDS).flatMap((list) => list.map((f) => f.id)));

const toB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isGarment = (g: unknown): g is Garment => GARMENTS.includes(g as Garment);

/** The measurements an ask wants: the redo list, or the base set plus what the garment needs. */
export const askIds = (ask: Pick<MeasureAsk, 'garment' | 'redo'>): MeasurementId[] => ask.redo ?? [...BASE, ...extrasFor(ask.garment).map((f) => f.id)];

/** About a minute a measurement, plus getting the tape out. */
export const minutesFor = (count: number) => Math.max(3, Math.round(count * 1.1 + 2));

export function askLink(origin: string, ask: MeasureAsk) {
  const { id, from, studio, note, client, garment, redo } = ask;
  return `${origin}/#${ASK}${toB64(JSON.stringify({ v: 1, id, from, studio: studio || undefined, note: note || undefined, client, garment, redo }))}`;
}

export function replyLink(origin: string, reply: MeasureReply) {
  // One decimal place is all a tape gives.
  const values = Object.fromEntries(Object.entries(reply.values).map(([k, v]) => [k, Math.round((v as number) * 10) / 10]));
  return `${origin}/#${REPLY}${toB64(JSON.stringify({ v: 1, ...reply, values, redo: reply.redo || undefined }))}`;
}

/** Read a link's #part. Anything that doesn't check out is "broken" rather than half-used. */
export function readLink(hash: string): Incoming | null {
  const h = hash.replace(/^#/, '');
  const kind = h.startsWith(ASK) ? 'ask' : h.startsWith(REPLY) ? 'reply' : null;
  if (!kind) return null;
  try {
    const d = JSON.parse(fromB64(h.slice(kind === 'ask' ? ASK.length : REPLY.length)));
    const id = text(d?.id, 60);
    const client = text(d?.client, 60);
    if (d?.v !== 1 || !id || !isGarment(d.garment)) return { kind: 'broken' };
    if (kind === 'ask') {
      const redo = Array.isArray(d.redo) ? (d.redo as unknown[]).filter((x): x is MeasurementId => KNOWN.has(x as MeasurementId)) : undefined;
      if (redo && !redo.length) return { kind: 'broken' };
      return { kind: 'ask', ask: { id, from: text(d.from, 60), studio: text(d.studio, 60) || undefined, note: text(d.note, 400) || undefined, client, garment: d.garment, redo } };
    }
    const values: MeasurementValues = {};
    for (const [k, v] of Object.entries(d.values ?? {})) {
      if (!KNOWN.has(k as MeasurementId) || typeof v !== 'number') continue;
      const f = fieldOf(k as MeasurementId);
      if (v >= f.hard[0] && v <= f.hard[1]) values[k as MeasurementId] = v;
    }
    if (!Object.keys(values).length) return { kind: 'broken' };
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : new Date().toISOString().slice(0, 10);
    return { kind: 'reply', reply: { id, client, garment: d.garment, date, values, redo: d.redo === true || undefined } };
  } catch {
    return { kind: 'broken' };
  }
}

/** Pull a link out of whatever was pasted (a whole message, say). */
export function readPasted(s: string): Incoming | null {
  const m = s.match(/#(?:measure|measured)=[A-Za-z0-9_-]+/);
  return m ? readLink(m[0]) : null;
}

/**
 * The measurements worth a second look, worded for the dressmaker: the app's own range and cross checks, plus the
 * slip home measuring makes most (the hip taken at the waist, so it comes out well under the bust).
 */
export function redoFlags(values: MeasurementValues, garment: Garment): { id: MeasurementId; message: string }[] {
  const have = new Set(Object.keys(values));
  const out: { id: MeasurementId; message: string }[] = [];
  const add = (id: MeasurementId, message: string) => {
    if (have.has(id) && !out.some((o) => o.id === id)) out.push({ id, message });
  };
  const { full_bust, full_hip, waist } = values;
  if (full_bust && full_hip && full_hip < full_bust - 8 && (!waist || full_hip < waist + 12))
    add('full_hip', `Hip is ${Math.round(full_bust - full_hip)} cm under bust. A hip taken at the waist often looks like this.`);
  for (const c of checkMeasurements(values, 'cm', garment)) add(c.id, forHelper(c.message));
  return out;
}

/** What changed when a reply was added, for "99 (was 81)". */
export interface Arrived {
  account: Account;
  personId: string;
  changed: { id: MeasurementId; was?: number; now: number }[];
}

/** Which client a reply is from: the one the ask went to, else the same name, else nobody yet. */
export function replyPerson(account: Account, reply: MeasureReply): Person | undefined {
  const people = withPeople(account).people.filter((p) => p.id !== ME);
  const name = reply.client.trim().toLowerCase();
  return people.find((p) => p.asks?.some((a) => a.id === reply.id)) ?? (name ? people.find((p) => p.name.trim().toLowerCase() === name) : undefined);
}

/** Put a reply's numbers in the client's book: a new client if there's no match, dated in their history. */
export function addReply(account: Account, reply: MeasureReply): Arrived {
  const full = withPeople(account);
  let who = replyPerson(full, reply);
  let people = full.people;
  if (!who) {
    who = { id: newId(), name: reply.client || 'New client', values: {}, named: true };
    people = [...people, who];
  }
  const changed = (Object.entries(reply.values) as [MeasurementId, number][])
    .map(([id, now]) => ({ id, was: who!.values[id], now }))
    .filter((c) => c.was !== c.now);
  const values = { ...who.values, ...reply.values };
  const next = recordMeasurements({ ...who, values, asks: (who.asks ?? []).filter((a) => a.id !== reply.id) }, reply.date);
  return { account: { ...full, people: people.map((p) => (p.id === who!.id ? next : p)) }, personId: who.id, changed };
}

/** Note an ask on the client, so the reply finds them even if they're renamed. */
export function rememberAsk(person: Person, ask: MeasureAsk, date: string): Person {
  const asks = [...(person.asks ?? []).filter((a) => a.id !== ask.id), { id: ask.id, garment: ask.garment, date, redo: ask.redo }];
  return { ...person, asks: asks.slice(-10) };
}

export const newAskId = () => newId().replace(/-/g, '').slice(0, 12);
