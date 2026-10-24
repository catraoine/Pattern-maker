// Joining the work on this device with the work kept in someone's account, when they sign in or open the app on
// another device. Nothing is dropped: people and patterns from both sides are kept, and where the same one is on
// both, the one that holds more (or was saved later) wins.
import { withPeople, type Account, type Backup, type Person, type SavedPattern } from '../account';
import type { MeasurementId } from '../measurements';

const taken = (p: Person) => Object.keys(p.values).filter((k) => !p.example?.includes(k as MeasurementId)).length;

/** The same person on both sides: whoever has more real measurements, else the side saved later. */
function pickPerson(local: Person, remote: Person, remoteNewer: boolean): Person {
  const l = taken(local);
  const r = taken(remote);
  if (l !== r) return l > r ? local : remote;
  return remoteNewer ? remote : local;
}

/** The same pattern on both sides: the one saved later. */
const pickPattern = (local: SavedPattern, remote: SavedPattern) => (remote.savedAt > local.savedAt ? remote : local);

function union<T extends { id: string }>(local: T[], remote: T[], pick: (l: T, r: T) => T): T[] {
  const out = local.map((l) => {
    const r = remote.find((x) => x.id === l.id);
    return r ? pick(l, r) : l;
  });
  return [...out, ...remote.filter((r) => !local.some((l) => l.id === r.id))];
}

/** A fresh device holds nothing worth keeping: no real measurements and no saved patterns. */
export const isEmpty = (a: Account) => !a.patterns.length && !withPeople(a).people.some((p) => taken(p) > 0);

export function mergeBackups<S>(local: Backup<S>, remote: Backup<S> | null): Backup<S> {
  if (!remote) return local;
  const remoteNewer = remote.savedAt > local.savedAt;
  // The work in progress (the open garment, moved points) comes from the newer side, unless that side is a fresh device.
  const workFromRemote = isEmpty(local.account) || (remoteNewer && !isEmpty(remote.account));
  const la = withPeople(local.account);
  const ra = withPeople(remote.account);
  const newer = workFromRemote ? ra : la;
  const older = workFromRemote ? la : ra;
  const people = union(la.people, ra.people, (l, r) => pickPerson(l, r, remoteNewer));
  const account: Account = {
    ...older,
    ...newer,
    name: newer.name || older.name,
    onboarded: la.onboarded || ra.onboarded,
    people,
    active: people.some((p) => p.id === newer.active) ? newer.active : la.active,
    patterns: union(la.patterns, ra.patterns, pickPattern),
    packs: [...new Set([...(la.packs ?? []), ...(ra.packs ?? [])])],
    testerCode: newer.testerCode ?? older.testerCode,
  };
  if (!account.packs?.length) delete account.packs;
  if (!account.testerCode) delete account.testerCode;
  const pointEdits = { ...(workFromRemote ? local.pointEdits : remote.pointEdits), ...(workFromRemote ? remote.pointEdits : local.pointEdits) };
  return {
    app: 'pattern-maker',
    version: 1,
    savedAt: new Date(Math.max(Date.parse(local.savedAt), Date.parse(remote.savedAt)) || Date.now()).toISOString(),
    skirt: workFromRemote ? remote.skirt : local.skirt,
    account,
    ...(Object.keys(pointEdits).length ? { pointEdits } : {}),
  };
}
