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
