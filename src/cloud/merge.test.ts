import { describe, expect, it } from 'vitest';
import { ME, makeBackup, NEW_ACCOUNT, type Account } from '../account';
import { isEmpty, mergeBackups } from './merge';

const at = (iso: string, skirt: object, account: Account) => ({ ...makeBackup(skirt, account), savedAt: iso });
const me = (values: Record<string, number>) => ({ id: ME, name: '', values, named: true });
const pattern = (id: string, savedAt: string, name = id) => ({ id, name, savedAt, choices: {} as never });

describe('mergeBackups', () => {
  it('keeps everything from a fresh account when this device has nothing yet', () => {
    const local = at('2026-11-10T10:00:00Z', { here: true }, NEW_ACCOUNT);
    const remote = at('2026-11-01T10:00:00Z', { there: true }, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70 })], patterns: [pattern('a', '2026-11-01')] });
    const m = mergeBackups(local, remote);
    expect(m.account.name).toBe('Cat');
    expect(m.account.people?.[0].values).toEqual({ waist: 70 });
    expect(m.account.patterns.map((p) => p.id)).toEqual(['a']);
    expect(m.skirt).toEqual({ there: true });
  });

  it('never loses a guest pattern or a remote one, and keeps the later save of the same pattern', () => {
    const local = at('2026-11-10T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [pattern('a', '2026-11-09', 'new name'), pattern('b', '2026-11-10')] });
    const remote = at('2026-11-05T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [pattern('a', '2026-11-01', 'old name'), pattern('c', '2026-11-02')] });
    const m = mergeBackups(local, remote);
    expect(m.account.patterns.map((p) => [p.id, p.name])).toEqual([
      ['a', 'new name'],
      ['b', 'b'],
      ['c', 'c'],
    ]);
  });

  it('keeps the measured version of a person over an empty one, even when the empty one is newer', () => {
    const local = at('2026-11-10T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({})], patterns: [pattern('b', '2026-11-10')] });
    const remote = at('2026-11-01T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70, full_hip: 98 })], patterns: [] });
    expect(mergeBackups(local, remote).account.people?.[0].values).toEqual({ waist: 70, full_hip: 98 });
  });

  it('adds people from both sides and joins bought garments', () => {
    const friend = { id: 'p2', name: 'Ana', values: { waist: 64 }, named: true };
    const local = at('2026-11-10T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [], packs: ['dress'] });
    const remote = at('2026-11-01T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 }), friend], patterns: [], packs: ['trousers'] });
    const m = mergeBackups(local, remote);
    expect(m.account.people?.map((p) => p.id)).toEqual([ME, 'p2']);
    expect(m.account.packs).toEqual(['dress', 'trousers']);
  });

  it('with nothing in the account yet, keeps this device as it is', () => {
    const local = at('2026-11-10T10:00:00Z', { x: 1 }, { ...NEW_ACCOUNT, people: [me({ waist: 70 })] });
    expect(mergeBackups(local, null)).toBe(local);
  });

  it('a fresh device counts as empty; example measurements alone do not count', () => {
    expect(isEmpty(NEW_ACCOUNT)).toBe(true);
    expect(isEmpty({ ...NEW_ACCOUNT, people: [{ ...me({ waist: 70 }), example: ['waist'] }] })).toBe(true);
    expect(isEmpty({ ...NEW_ACCOUNT, people: [me({ waist: 70 })] })).toBe(false);
  });
});

describe('mergeBackups with a base (both sides already in step once)', () => {
  const t = '2026-11-10T10:00:00Z';
  const acc = (patterns: ReturnType<typeof pattern>[], extra: Partial<Account> = {}): Account => ({ ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns, ...extra });

  it('a pattern removed on this device stays removed, even though the account still has it', () => {
    const base = at(t, {}, acc([pattern('a', '2026-11-01'), pattern('b', '2026-11-02')]));
    const local = at('2026-11-11T10:00:00Z', {}, acc([pattern('b', '2026-11-02')]));
    const m = mergeBackups(local, base, base);
    expect(m.account.patterns.map((p) => p.id)).toEqual(['b']);
  });

  it('a pattern removed on another device stays removed here, unless this device changed it since', () => {
    const base = at(t, {}, acc([pattern('a', '2026-11-01'), pattern('b', '2026-11-02')]));
    const remote = at('2026-11-12T10:00:00Z', {}, acc([pattern('b', '2026-11-02')]));
    expect(mergeBackups(base, remote, base).account.patterns.map((p) => p.id)).toEqual(['b']);
    const renamed = at('2026-11-12T11:00:00Z', {}, acc([pattern('a', '2026-11-12', 'kept after all'), pattern('b', '2026-11-02')]));
    expect(mergeBackups(renamed, remote, base).account.patterns.map((p) => p.name)).toEqual(['kept after all', 'b']);
  });

  it('new patterns from both sides are kept, and a pattern changed on one side only is taken as it is', () => {
    const base = at(t, {}, acc([pattern('a', '2026-11-01')]));
    const local = at('2026-11-11T10:00:00Z', {}, acc([pattern('a', '2026-11-01'), pattern('mine', '2026-11-11')]));
    const remote = at('2026-11-12T10:00:00Z', {}, acc([pattern('a', '2026-11-01', 'renamed there'), pattern('theirs', '2026-11-12')]));
    const m = mergeBackups(local, remote, base);
    expect(m.account.patterns.map((p) => [p.id, p.name])).toEqual([
      ['a', 'renamed there'],
      ['mine', 'mine'],
      ['theirs', 'theirs'],
    ]);
  });

  it('a person removed here stays removed; a name changed there is taken; the open garment follows the side that changed it', () => {
    const friend = { id: 'p2', name: 'Ana', values: { waist: 64 }, named: true };
    const base = at(t, { garment: 'skirt' }, acc([], { people: [me({ waist: 70 }), friend], name: 'Cat' }));
    const local = at('2026-11-11T10:00:00Z', { garment: 'dress' }, acc([], { people: [me({ waist: 70 })], name: 'Cat' }));
    const remote = at('2026-11-12T10:00:00Z', { garment: 'skirt' }, acc([], { people: [me({ waist: 70 }), friend], name: 'Catherine' }));
    const m = mergeBackups(local, remote, base);
    expect(m.account.people?.map((p) => p.id)).toEqual([ME]);
    expect(m.account.name).toBe('Catherine');
    expect(m.skirt).toEqual({ garment: 'dress' });
  });

  it('with the account unchanged since the base, this device simply wins, whatever the time stamps say', () => {
    const base = at(t, { garment: 'skirt' }, acc([pattern('a', '2026-11-01')], { name: 'Cat' }));
    const local = at('2026-01-01T00:00:00Z', { garment: 'tee' }, acc([pattern('a', '2026-11-01')], { name: '' }));
    const m = mergeBackups(local, { ...base, savedAt: '2026-12-01T00:00:00Z' }, base);
    expect(m.skirt).toEqual({ garment: 'tee' });
    expect(m.account.name).toBe('');
  });
});

describe('comparing copies', () => {
  it('a copy with its keys in another order (as the account service returns them) counts as unchanged', () => {
    const t = '2026-11-10T10:00:00Z';
    const p = { id: 'a', name: 'a', savedAt: '2026-11-01', choices: { fit: 'close', length: 'midi' } as never };
    const base = at(t, { garment: 'skirt', unit: 'cm' }, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [p] });
    const reordered = at('2026-11-12T10:00:00Z', { unit: 'cm', garment: 'skirt' }, { patterns: [{ choices: { length: 'midi', fit: 'close' } as never, savedAt: '2026-11-01', name: 'a', id: 'a' }], people: [{ named: true, values: { waist: 70 }, name: '', id: ME }], name: '', onboarded: false });
    const local = at('2026-11-11T10:00:00Z', { garment: 'skirt', unit: 'cm' }, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [] });
    // Removed here, untouched there (only reordered): stays removed.
    expect(mergeBackups(local, reordered, base).account.patterns).toEqual([]);
  });
});

// The engineering review's sign-in findings (Nov 10), each reproduced with the joining code before it was fixed.
describe('the review’s sign-in findings', () => {
  const t = '2026-11-10T10:00:00Z';
  const friend = { id: 'p2', name: 'Ana', values: { waist: 64 }, named: true };

  it('an emptied device ("Delete everything") never empties the account, even with an old base still on it', () => {
    const kept = at(t, { garment: 'dress' }, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70 }), friend], patterns: [pattern('a', '2026-11-01'), pattern('b', '2026-11-02')] });
    const emptied = at('2026-11-11T10:00:00Z', {}, NEW_ACCOUNT);
    const m = mergeBackups(emptied, kept, kept);
    expect(m.account.patterns.map((p) => p.id)).toEqual(['a', 'b']);
    expect(m.account.people?.map((p) => [p.id, p.values])).toEqual([[ME, { waist: 70 }], ['p2', { waist: 64 }]]);
    expect(m.account.name).toBe('Cat');
  });

  it('two different people’s own measurements are never joined: this device’s are kept as a person of their own', () => {
    // Ann used a shared computer without signing in to it; Bea then signs in there for the first time.
    const ann = at('2026-11-11T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Ann', people: [me({ waist: 66, full_hip: 94 })], patterns: [{ ...pattern('anns-dress', '2026-11-11'), personId: ME }] });
    const bea = at(t, {}, { ...NEW_ACCOUNT, name: 'Bea', people: [me({ waist: 80, full_hip: 108 })], patterns: [{ ...pattern('beas-skirt', '2026-11-01'), personId: ME }] });
    const m = mergeBackups(ann, bea);
    expect(m.account.name).toBe('Bea');
    const owner = m.account.people!.find((p) => p.id === ME)!;
    expect(owner.values).toEqual({ waist: 80, full_hip: 108 });
    const apart = m.account.people!.find((p) => p.id !== ME)!;
    expect(apart).toMatchObject({ name: 'Ann', values: { waist: 66, full_hip: 94 } });
    expect(m.account.patterns.find((p) => p.id === 'anns-dress')?.personId).toBe(apart.id);
    expect(m.account.patterns.find((p) => p.id === 'beas-skirt')?.personId).toBe(ME);
  });

  it('“Add it to my account” on a device last signed in to another account: its people and patterns come, nothing else', () => {
    // Even with measurements close enough to look like one body, the other account's owner stays apart.
    const ann = at('2026-11-11T10:00:00Z', { garment: 'tee' }, { ...NEW_ACCOUNT, name: 'Ann', testerCode: 'EXAMPLE-ANN', people: [me({ waist: 70 }), friend], patterns: [pattern('anns', '2026-11-11')] });
    const bea = at(t, { garment: 'skirt' }, { ...NEW_ACCOUNT, name: 'Bea', people: [me({ waist: 71 })], patterns: [pattern('beas', '2026-11-01')] });
    const m = mergeBackups(ann, bea, null, { fromAnotherAccount: true });
    expect(m.account.name).toBe('Bea');
    expect(m.account.testerCode).toBeUndefined();
    expect(m.account.people!.find((p) => p.id === ME)!.values).toEqual({ waist: 71 });
    expect(m.account.people!.map((p) => p.name).sort()).toEqual(['', 'Ana', 'Ann']);
    expect(m.account.patterns.map((p) => p.id).sort()).toEqual(['anns', 'beas']);
    expect(m.skirt).toEqual({ garment: 'skirt' });
  });

  it('the same person on two devices at first sign-in: fittings, notes and history from one, an extra measurement from the other', () => {
    const phone = at(t, {}, {
      ...NEW_ACCOUNT,
      name: 'Cat',
      people: [{ ...me({ waist: 70, full_hip: 98 }), fittings: { skirt: { issues: { waist: 1 }, round: 1 } }, notes: [{ id: 'n1', date: '2026-11-09', text: 'sway back' }], history: [{ date: '2026-11-01', values: { waist: 71 } }] }],
      patterns: [],
    });
    const laptop = at('2026-11-11T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70, full_hip: 98, waist_to_hip: 20 })], patterns: [] });
    const m = mergeBackups(laptop, phone);
    const p = m.account.people!.find((x) => x.id === ME)!;
    expect(p.values).toEqual({ waist: 70, full_hip: 98, waist_to_hip: 20 });
    expect(p.fittings).toEqual({ skirt: { issues: { waist: 1 }, round: 1 } });
    expect(p.notes?.map((n) => n.text)).toEqual(['sway back']);
    expect(p.history).toEqual([{ date: '2026-11-01', values: { waist: 71 } }]);
    expect(m.account.people).toHaveLength(1);
  });

  it('the same person changed on both devices since they last agreed: a waist changed on one and a note added on the other are both kept', () => {
    const base = at(t, {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70, full_hip: 98 })], patterns: [] });
    const phone = at('2026-11-11T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 68, full_hip: 98 })], patterns: [] });
    const laptop = at('2026-11-12T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [{ ...me({ waist: 70, full_hip: 98 }), notes: [{ id: 'n1', date: '2026-11-12', text: 'toile 2' }] }], patterns: [] });
    const p = mergeBackups(phone, laptop, base).account.people![0];
    expect(p.values).toEqual({ waist: 68, full_hip: 98 });
    expect(p.notes?.map((n) => n.text)).toEqual(['toile 2']);
    // A note removed on one device stays removed.
    const noted = at('2026-11-12T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [{ ...me({ waist: 70, full_hip: 98 }), notes: [{ id: 'n1', date: '2026-11-12', text: 'toile 2' }] }], patterns: [] });
    const cleared = at('2026-11-13T10:00:00Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70, full_hip: 98 })], patterns: [] });
    expect(mergeBackups(cleared, noted, noted).account.people![0].notes).toBeUndefined();
  });

  it('a measurement taken beats one filled in from the example body, whichever side is newer', () => {
    const real = at(t, {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [] });
    const example = at('2026-11-12T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [{ ...me({ waist: 76, full_hip: 102 }), example: ['waist', 'full_hip'] }], patterns: [] });
    const p = mergeBackups(example, real).account.people![0];
    expect(p.values).toEqual({ waist: 70, full_hip: 102 });
    expect(p.example).toEqual(['full_hip']);
  });

  it('every moved point removed on one device stays removed', () => {
    const base = { ...at(t, {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [] }), pointEdits: { skirt: [{ at: 1 }] } };
    const cleared = at('2026-11-12T10:00:00Z', {}, { ...NEW_ACCOUNT, people: [me({ waist: 70 })], patterns: [] });
    expect(mergeBackups(base, cleared, base).pointEdits).toBeUndefined();
  });

  it('work typed while the account was being read is joined in again, not replaced', () => {
    // What this device held when the sync started, what the join gave, and what the device holds now.
    const started = at(t, {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70 })], patterns: [pattern('a', '2026-11-01')] });
    const joined = at(t, {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 70 })], patterns: [pattern('a', '2026-11-01'), pattern('from-phone', '2026-11-10')] });
    const typed = at('2026-11-10T10:00:02Z', {}, { ...NEW_ACCOUNT, name: 'Cat', people: [me({ waist: 69.5 })], patterns: [pattern('a', '2026-11-01')] });
    const m = mergeBackups(typed, joined, started);
    expect(m.account.people![0].values).toEqual({ waist: 69.5 });
    expect(m.account.patterns.map((p) => p.id)).toEqual(['a', 'from-phone']);
  });
});
