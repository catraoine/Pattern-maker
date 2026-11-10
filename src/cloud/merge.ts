// Joining the work on this device with the work kept in someone's account, when they sign in or open the app on
// another device, and again before every save while they're signed in.
//
// With nothing to compare against (the first sign-in on a device), nothing is dropped: people and patterns from both
// sides are kept, and where the same one is on both, the one that holds more (or was saved later) wins.
//
// Once this device has saved to the account, it remembers what it saved (the "base", see useCloud.ts). From then on
// the join is a three-way one against that base: a pattern or person removed on one side since then stays removed,
// unless the other side changed it meanwhile, and a change made on only one side is simply taken. That's what lets
// a phone and a computer both stay signed in without wiping each other's work.
import { ME, newId, withPeople, type Account, type Backup, type Person, type SavedPattern } from '../account';
import type { MeasurementId } from '../measurements';

const taken = (p: Person) => Object.keys(p.values).filter((k) => !p.example?.includes(k as MeasurementId)).length;

// The account service stores JSON with its keys in its own order, so copies are compared with keys sorted.
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/**
 * The same person on both sides, joined field by field (engineering review, Nov 10: taking one whole copy dropped the
 * other's fitting corrections, notes and history). Each measurement, setting and toile correction is taken from the
 * side that changed it since the base; a measurement taken beats one filled in from the example body; where both sides
 * changed the same thing (or there is no base yet), the later save wins. Notes, photos, unanswered measure-me links and
 * the dated history are joined item by item, as patterns are, so none is lost.
 */
function mergePerson(l: Person, r: Person, b: Person | undefined, remoteNewer: boolean): Person {
  /** Which side a value comes from: the one that changed it since the base, else the one that has it, else the later. */
  const side = <T>(lv: T, rv: T, bv: T | undefined): 'l' | 'r' => {
    if (b && same(lv, bv)) return 'r';
    if (b && same(rv, bv)) return 'l';
    if (lv === undefined) return 'r';
    if (rv === undefined) return 'l';
    return remoteNewer ? 'r' : 'l';
  };
  const one = <T>(lv: T, rv: T, bv: T | undefined) => (side(lv, rv, bv) === 'l' ? lv : rv);
  const real = (p: Person, k: MeasurementId) => p.values[k] !== undefined && !p.example?.includes(k);
  const values: Person['values'] = {};
  const example: MeasurementId[] = [];
  const helped: MeasurementId[] = [];
  for (const k of new Set([...Object.keys(l.values), ...Object.keys(r.values)]) as Set<MeasurementId>) {
    // Changed on one side since the base: that side, even when the change was to clear it. Otherwise a measurement
    // taken on one side only beats a missing one or one from the example body; otherwise as any other field.
    const changedOnOne = b && (same(l.values[k], b.values[k]) !== same(r.values[k], b.values[k]));
    const from = !changedOnOne && real(l, k) !== real(r, k) ? (real(l, k) ? l : r) : side(l.values[k], r.values[k], b?.values[k]) === 'l' ? l : r;
    if (from.values[k] === undefined) continue;
    values[k] = from.values[k];
    if (from.example?.includes(k)) example.push(k);
    if (from.helped?.includes(k)) helped.push(k);
  }
  const fittings: NonNullable<Person['fittings']> = {};
  const lf = l.fittings ?? {};
  const rf = r.fittings ?? {};
  for (const g of new Set([...Object.keys(lf), ...Object.keys(rf)]) as Set<keyof typeof lf>) {
    const v = one(lf[g], rf[g], b?.fittings?.[g]);
    if (v !== undefined) fittings[g] = v;
  }
  // Each day's measurements: one entry per date, the side that changed it (or the later save).
  const byDate = (h: Person['history']) => (h ?? []).map((e) => ({ ...e, id: e.date }));
  const history = union(byDate(l.history), byDate(r.history), b ? byDate(b.history) : undefined, (x, y) => (remoteNewer ? y : x))
    .sort((x, y) => x.date.localeCompare(y.date))
    .map(({ date, values: v }) => ({ date, values: v }));
  const items = <T extends { id: string }>(lv: T[] | undefined, rv: T[] | undefined, bv: T[] | undefined) => union(lv ?? [], rv ?? [], b ? (bv ?? []) : undefined, (x, y) => (remoteNewer ? y : x));
  const notes = items(l.notes, r.notes, b?.notes);
  const photos = items(l.photos, r.photos, b?.photos);
  const asks = items(l.asks, r.asks, b?.asks);
  const out: Person = {
    ...(remoteNewer ? { ...l, ...r } : { ...r, ...l }),
    name: one(l.name, r.name, b?.name) ?? '',
    named: l.named || r.named,
    values,
  };
  for (const k of ['form', 'weight'] as const) {
    const v = one(l[k], r[k], b?.[k]);
    if (v === undefined) delete out[k];
    else (out as unknown as Record<string, unknown>)[k] = v;
  }
  const lists = { example, helped, history, notes, photos, asks } as const;
  for (const [k, v] of Object.entries(lists)) {
    if (v.length) (out as unknown as Record<string, unknown>)[k] = v;
    else delete (out as unknown as Record<string, unknown>)[k];
  }
  if (Object.keys(fittings).length) out.fittings = fittings;
  else delete out.fittings;
  return out;
}

/**
 * Whether the owner's measurements on the two sides can't be the same body: a name given on both and different, or a
 * measurement taken on both sides that differs by more than a retake would (3 cm, or 4% of a long one). Only asked
 * at a first join, where nothing says whose work is on this device (a shared computer used without signing in).
 */
function notSameOwner(l: Person, la: Account, r: Person, ra: Account): boolean {
  const ln = la.name.trim().toLowerCase();
  const rn = ra.name.trim().toLowerCase();
  if (ln && rn && ln !== rn) return true;
  return (Object.keys(l.values) as MeasurementId[]).some((k) => {
    const a = l.values[k];
    const c = r.values[k];
    if (a === undefined || c === undefined || l.example?.includes(k) || r.example?.includes(k)) return false;
    return Math.abs(a - c) > Math.max(3, 0.04 * Math.max(a, c));
  });
}

/**
 * The owner's measurements on this device moved to a person of their own, with the patterns saved for them, so they are
 * kept beside the account owner's rather than joined into them.
 */
function ownerApart(a: Account & { people: Person[]; active: string }): Account & { people: Person[]; active: string } {
  const id = newId();
  const people = a.people.map((p) => (p.id === ME ? { ...p, id, name: a.name.trim() || 'From this device', named: true } : p));
  const patterns = a.patterns.map((p) => (p.personId === ME ? { ...p, personId: id } : p));
  return { ...a, people, patterns, active: a.active === ME ? id : a.active };
}

/** The same pattern on both sides: the one saved later. */
const pickPattern = (local: SavedPattern, remote: SavedPattern) => (remote.savedAt > local.savedAt ? remote : local);

/**
 * Items by id from both sides. Without a base, everything is kept. With one, an item that one side removed since
 * the base stays removed unless the other side changed it since; an item changed on one side only is taken as is.
 */
function union<T extends { id: string }>(local: T[], remote: T[], base: T[] | undefined, pick: (l: T, r: T) => T): T[] {
  const at = (list: T[], id: string) => list.find((x) => x.id === id);
  const out: T[] = [];
  for (const l of local) {
    const r = at(remote, l.id);
    const b = base && at(base, l.id);
    if (r) out.push(b ? (same(l, b) ? r : same(r, b) ? l : pick(l, r)) : pick(l, r));
    // Gone from the account since the base: removed on another device. Kept only if changed here since.
    else if (!b || !same(l, b)) out.push(l);
  }
  for (const r of remote) {
    if (at(local, r.id)) continue;
    const b = base && at(base, r.id);
    // Gone from this device since the base: removed here. Kept only if changed in the account since.
    if (!b || !same(r, b)) out.push(r);
  }
  return out;
}

/** A fresh device holds nothing worth keeping: no real measurements and no saved patterns. */
export const isEmpty = (a: Account) => !a.patterns.length && !withPeople(a).people.some((p) => taken(p) > 0);

/** Three-way pick of one value: the side that changed it since the base, else the given fallback when both did. */
function pick3<T>(local: T, remote: T, base: T | undefined, hasBase: boolean, fallback: T): T {
  if (!hasBase) return fallback;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  return fallback;
}

export interface JoinOptions {
  /** This device was last signed in to another account, and the person signing in chose to add its work to theirs:
   *  the owner's measurements here are kept as a person of their own, and the account's own settings stay as they are. */
  fromAnotherAccount?: boolean;
}

export function mergeBackups<S>(local: Backup<S>, remote: Backup<S> | null, base?: Backup<S> | null, opts: JoinOptions = {}): Backup<S> {
  if (!remote) return local;
  // A cleared device never removes anything from the account (engineering review, Nov 10: "Delete everything", then
  // signing in again, emptied the account). The device forgets its base when cleared (useCloud's forget); this is the
  // backstop for one that couldn't. Only a device as it is after clearing (never past the welcome, nothing measured or
  // saved) counts, so deleting the last pattern on a device in use still reaches the account.
  if (base && !local.account.onboarded && isEmpty(local.account)) base = null;
  const hasBase = !!base;
  const remoteNewer = remote.savedAt > local.savedAt;
  // The work in progress (the open garment, moved points) comes from the newer side, unless that side is a fresh device.
  const workFromRemote = isEmpty(local.account) || (!isEmpty(remote.account) && (remoteNewer || !!opts.fromAnotherAccount));
  let la = withPeople(local.account);
  const ra = withPeople(remote.account);
  const ba = base ? withPeople(base.account) : undefined;
  // Two different people's own measurements are never joined into one (see notSameOwner): this device's are kept apart.
  const lMe = la.people.find((p) => p.id === ME);
  const rMe = ra.people.find((p) => p.id === ME);
  if (opts.fromAnotherAccount) {
    // Only the people and patterns come over; the name, tester code, studio and other settings are the account's own.
    const apart = lMe && taken(lMe) > 0 ? ownerApart(la) : la;
    la = { ...ra, people: apart.people.filter((p) => p.id !== ME), patterns: apart.patterns, active: ra.active };
  } else if (lMe && rMe && taken(lMe) > 0 && taken(rMe) > 0 && !hasBase && notSameOwner(lMe, la, rMe, ra)) {
    // The account's owner keeps their own name; this device's owner is now one of their people, under theirs.
    la = { ...ownerApart(la), name: ra.name };
  }
  const newer = workFromRemote ? ra : la;
  const older = workFromRemote ? la : ra;
  const people = union(la.people, ra.people, ba?.people, (l, r) => mergePerson(l, r, ba?.people.find((p) => p.id === l.id), remoteNewer));
  // Each plain setting (name, units, tools, tester code...) on its own: a change made on one side is taken.
  const fields: Record<string, unknown> = { ...older, ...newer };
  if (hasBase) {
    const l = la as unknown as Record<string, unknown>;
    const r = ra as unknown as Record<string, unknown>;
    const b = ba as unknown as Record<string, unknown>;
    for (const k of new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b)])) {
      const v = pick3(l[k], r[k], b[k], true, fields[k]);
      if (v === undefined) delete fields[k];
      else fields[k] = v;
    }
  }
  const account: Account = {
    ...(fields as unknown as Account),
    name: hasBase ? pick3(la.name, ra.name, ba?.name, true, newer.name || older.name) : newer.name || older.name,
    onboarded: la.onboarded || ra.onboarded,
    people,
    active: people.some((p) => p.id === newer.active) ? newer.active : people.some((p) => p.id === la.active) ? la.active : people[0].id,
    patterns: union(la.patterns, ra.patterns, ba?.patterns, pickPattern),
    packs: [...new Set([...(la.packs ?? []), ...(ra.packs ?? [])])],
    testerCode: hasBase ? pick3(la.testerCode, ra.testerCode, ba?.testerCode, true, newer.testerCode ?? older.testerCode) : newer.testerCode ?? older.testerCode,
  };
  if (!account.packs?.length) delete account.packs;
  if (!account.testerCode) delete account.testerCode;
  // Points moved on the flat pattern, per garment: a garment's edits changed on one side only are taken as they are.
  const lp = local.pointEdits ?? {};
  const rp = remote.pointEdits ?? {};
  const bp = base?.pointEdits ?? {};
  const pointEdits: Record<string, unknown[]> = {};
  for (const k of new Set([...Object.keys(lp), ...Object.keys(rp), ...Object.keys(bp)])) {
    const v = pick3(lp[k], rp[k], bp[k], hasBase, (workFromRemote ? rp[k] : lp[k]) ?? (workFromRemote ? lp[k] : rp[k]));
    if (v?.length) pointEdits[k] = v;
  }
  return {
    app: 'pattern-maker',
    version: 1,
    savedAt: new Date(Math.max(Date.parse(local.savedAt), Date.parse(remote.savedAt)) || Date.now()).toISOString(),
    skirt: pick3(local.skirt, remote.skirt, base?.skirt, hasBase, workFromRemote ? remote.skirt : local.skirt),
    account,
    ...(Object.keys(pointEdits).length ? { pointEdits } : {}),
  };
}

/** JSON with keys in a fixed order, so two copies that hold the same things read the same whatever built them. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** What a backup holds, without the time stamp put on every copy: equal when nothing worth saving differs. */
export const contentKey = <S>(b: Backup<S>) => {
  const a = withPeople(b.account);
  return stable([b.skirt, { ...a, packs: a.packs?.length ? a.packs : undefined }, Object.keys(b.pointEdits ?? {}).length ? b.pointEdits : null]);
};
