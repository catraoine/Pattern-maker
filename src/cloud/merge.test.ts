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
