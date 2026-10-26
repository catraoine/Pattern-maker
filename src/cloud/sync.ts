// One round of keeping this device and the account in step: read the account's copy, join it with this device's
// work (merge.ts) against what the two last agreed on, put the joined work on this device if that changed anything,
// and write it to the account unless the account already holds it. The write goes through only if nobody saved
// meanwhile; otherwise the round starts again from the newer copy, so no save ever overwrites another device's.
import type { Backup } from '../account';
import type { Kept } from './api';
import { contentKey, mergeBackups } from './merge';

export interface SyncIo {
  load(): Promise<Kept | null>;
  save(backup: Backup<unknown>, seen: string | null): Promise<string | null>;
}

interface SyncResult<S> {
  /** What both sides hold now: the base for the next round. */
  base: Backup<S>;
  /** Whether this device's work was changed by the join. */
  applied: boolean;
}

const TRIES = 3;

export async function syncOnce<S>(local: Backup<S>, base: Backup<S> | null, io: SyncIo, apply: (b: Backup<S>) => void): Promise<SyncResult<S>> {
  let applied = false;
  let mine = local;
  for (let i = 0; i < TRIES; i++) {
    const kept = await io.load();
    const remote = (kept?.backup as Backup<S> | undefined) ?? null;
    const merged = mergeBackups(mine, remote, base);
    if (contentKey(merged) !== contentKey(mine)) {
      apply(merged);
      applied = true;
    }
    if (remote && contentKey(merged) === contentKey(remote)) return { base: merged, applied };
    const stamp = await io.save({ ...merged, savedAt: new Date().toISOString() }, kept?.stamp ?? null);
    if (stamp !== null) return { base: merged, applied };
    // Another device saved first: what we have now is the joined work; join it with theirs too.
    mine = merged;
    base = remote;
  }
  throw new Error('The account is being saved from another device; try again in a moment.');
}
