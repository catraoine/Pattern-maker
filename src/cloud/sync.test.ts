import { describe, expect, it } from 'vitest';
import { ME, makeBackup, NEW_ACCOUNT, type Account, type Backup } from '../account';
import { syncOnce, type SyncIo } from './sync';

const me = (values: Record<string, number>) => ({ id: ME, name: '', values, named: true });
const pattern = (id: string, savedAt: string) => ({ id, name: id, savedAt, choices: {} as never });
const acc = (patterns: ReturnType<typeof pattern>[]): Account => ({ ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns });
const ids = (b: Backup<unknown> | null) => b?.account.patterns.map((p) => p.id);

/** The account service, with one row and a stamp that moves on every save. */
function server(initial: Backup<unknown> | null = null) {
  const state = { backup: initial, stamp: initial ? 1 : 0, saves: 0 };
  const io: SyncIo = {
    async load() {
      return state.backup ? { backup: state.backup, stamp: String(state.stamp) } : null;
    },
    async save(backup, seen) {
      const now = state.backup ? String(state.stamp) : null;
      if (now !== seen) return null;
      state.backup = backup;
      state.stamp++;
      state.saves++;
      return String(state.stamp);
    },
  };
  return { state, io };
}

/** One device: its work, what it last agreed with the account, and what the join put on it. */
function device(backup: Backup<unknown>) {
  const d = { backup, base: null as Backup<unknown> | null, applied: 0 };
  return {
    d,
    async sync(io: SyncIo) {
      const r = await syncOnce(d.backup, d.base, io, (b) => {
        d.backup = b;
        d.applied++;
      });
      d.base = r.base;
      return r;
    },
  };
}

describe('syncOnce', () => {
  it('first sign-in with nothing in the account: writes this device’s work and changes nothing here', async () => {
    const { state, io } = server();
    const phone = device(makeBackup({}, acc([pattern('a', '2026-11-01')])));
    const r = await phone.sync(io);
    expect(r.applied).toBe(false);
    expect(ids(state.backup)).toEqual(['a']);
    expect(ids(phone.d.base)).toEqual(['a']);
  });

  it('nothing changed since the last round: reads once and writes nothing', async () => {
    const { state, io } = server();
    const phone = device(makeBackup({}, acc([pattern('a', '2026-11-01')])));
    await phone.sync(io);
    const r = await phone.sync(io);
    expect(r.applied).toBe(false);
    expect(state.saves).toBe(1);
  });

  it('a phone and a computer both signed in: each save keeps the other’s new pattern, and a deletion sticks', async () => {
    const { state, io } = server();
    const phone = device(makeBackup({}, acc([pattern('a', '2026-11-01')])));
    const laptop = device(makeBackup({}, NEW_ACCOUNT));
    await phone.sync(io);
    await laptop.sync(io);
    expect(ids(laptop.d.backup)).toEqual(['a']);

    // The phone saves a new pattern; the laptop, unaware, changes its open garment and saves.
    phone.d.backup = makeBackup({}, acc([pattern('a', '2026-11-01'), pattern('phone', '2026-11-02')]));
    await phone.sync(io);
    laptop.d.backup = makeBackup({ garment: 'dress' }, laptop.d.backup.account);
    const r = await laptop.sync(io);
    expect(r.applied).toBe(true);
    expect(ids(laptop.d.backup)).toEqual(['a', 'phone']);
    expect(ids(state.backup)).toEqual(['a', 'phone']);
    expect(state.backup?.skirt).toEqual({ garment: 'dress' });

    // The laptop deletes 'a'; the phone comes back to the front and reads: 'a' is gone there too, 'phone' stays.
    laptop.d.backup = makeBackup(laptop.d.backup.skirt, acc([pattern('phone', '2026-11-02')]));
    await laptop.sync(io);
    await phone.sync(io);
    expect(ids(phone.d.backup)).toEqual(['phone']);
    expect(ids(state.backup)).toEqual(['phone']);
  });

  it('when another device saves between the read and the write, the round starts again and loses nothing', async () => {
    const { state, io } = server();
    const phone = device(makeBackup({}, acc([pattern('a', '2026-11-01')])));
    await phone.sync(io);
    const laptop = device(makeBackup({}, NEW_ACCOUNT));
    await laptop.sync(io);
    // The laptop's next save lands while the phone's round is between its read and its write.
    let slipped = false;
    const racy: SyncIo = {
      load: io.load,
      async save(b, seen) {
        if (!slipped) {
          slipped = true;
          laptop.d.backup = makeBackup({}, acc([pattern('a', '2026-11-01'), pattern('laptop', '2026-11-03')]));
          await laptop.sync(io);
        }
        return io.save(b, seen);
      },
    };
    phone.d.backup = makeBackup({}, acc([pattern('a', '2026-11-01'), pattern('phone', '2026-11-02')]));
    await phone.sync(racy);
    expect(ids(state.backup)).toEqual(['a', 'phone', 'laptop']);
    expect(ids(phone.d.backup)).toEqual(['a', 'phone', 'laptop']);
  });

  it('gives up after a few rounds if the account keeps being saved from elsewhere', async () => {
    const { io } = server(makeBackup({}, acc([])));
    const busy: SyncIo = { load: io.load, save: async () => null };
    await expect(syncOnce(makeBackup({}, acc([pattern('x', '2026-11-01')])), null, busy, () => undefined)).rejects.toThrow(/another device/);
  });
});
