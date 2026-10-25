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
import { withPeople, type Account, type Backup, type Person, type SavedPattern } from '../account';
import type { MeasurementId } from '../measurements';

const taken = (p: Person) => Object.keys(p.values).filter((k) => !p.example?.includes(k as MeasurementId)).length;

// The account service stores JSON with its keys in its own order, so copies are compared with keys sorted.
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** The same person on both sides: whoever has more real measurements, else the side saved later. */
function pickPerson(local: Person, remote: Person, remoteNewer: boolean): Person {
  const l = taken(local);
  const r = taken(remote);
  if (l !== r) return l > r ? local : remote;
  return remoteNewer ? remote : local;
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

export function mergeBackups<S>(local: Backup<S>, remote: Backup<S> | null, base?: Backup<S> | null): Backup<S> {
  if (!remote) return local;
  const hasBase = !!base;
  const remoteNewer = remote.savedAt > local.savedAt;
  // The work in progress (the open garment, moved points) comes from the newer side, unless that side is a fresh device.
  const workFromRemote = isEmpty(local.account) || (remoteNewer && !isEmpty(remote.account));
  const la = withPeople(local.account);
  const ra = withPeople(remote.account);
  const ba = base ? withPeople(base.account) : undefined;
  const newer = workFromRemote ? ra : la;
  const older = workFromRemote ? la : ra;
  const people = union(la.people, ra.people, ba?.people, (l, r) => pickPerson(l, r, remoteNewer));
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
