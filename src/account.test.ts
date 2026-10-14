import { describe, expect, it } from 'vitest';
import {
  FREE_SAVED_LIMIT,
  ME,
  NEW_ACCOUNT,
  activePerson,
  addPerson,
  claimMeasurements,
  isSavedFor,
  makeBackup,
  profileName,
  readBackup,
  removePattern,
  removePerson,
  renamePattern,
  sameChoices,
  savePattern,
  updatePerson,
  withPeople,
} from './account';

const skirt = (length: 'mini' | 'knee' | 'midi' | 'maxi' | 'above_knee') => ({ fit: 'regular' as const, silhouette: 'a_line' as const, length });

describe('account', () => {
  it('saves, renames and removes patterns', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'Knee a-line skirt');
    expect(a.patterns).toHaveLength(1);
    a = renamePattern(a, a.patterns[0].id, 'Wedding skirt');
    expect(a.patterns[0].name).toBe('Wedding skirt');
    expect(removePattern(a, a.patterns[0].id).patterns).toHaveLength(0);
  });

  it('ignores duplicates and stops at the free limit', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'x');
    expect(savePattern(a, skirt('knee'), 'x')).toBe(a);
    for (const l of ['mini', 'midi', 'maxi', 'above_knee'] as const) a = savePattern(a, skirt(l), l);
    expect(a.patterns).toHaveLength(FREE_SAVED_LIMIT);
  });

  it('falls back to "Me" when no name is given', () => {
    expect(profileName({ ...NEW_ACCOUNT, name: '  ' })).toBe('Me');
    expect(profileName({ ...NEW_ACCOUNT, name: 'Cat' })).toBe('Cat');
  });

  it('round-trips a backup and rejects other files', () => {
    const acc = savePattern({ ...NEW_ACCOUNT, name: 'Cat', onboarded: true }, skirt('midi'), 'Midi');
    const text = JSON.stringify(makeBackup({ unit: 'in', values: { waist: 70 } }, acc));
    expect(readBackup(text)?.account.patterns[0].name).toBe('Midi');
    expect(readBackup('{"hello":1}')).toBeNull();
    expect(readBackup('not json')).toBeNull();
  });
});

describe('bodice patterns', () => {
  const bodice = { garment: 'bodice' as const, fit: 'regular' as const, neckline: 'scoop' as const, length: 'waist' as const, darts: 'bust_waist' as const };
  it('saves a bodice alongside skirts and tells them apart', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'Skirt');
    a = savePattern(a, bodice, 'Top');
    expect(a.patterns).toHaveLength(2);
    expect(sameChoices(a.patterns[0].choices, bodice)).toBe(true);
    expect(sameChoices(a.patterns[1].choices, bodice)).toBe(false);
    expect(sameChoices(bodice, { ...bodice, neckline: 'v' })).toBe(false);
  });
});

describe('people', () => {
  it("moves an older save's measurements to the owner", () => {
    const a = withPeople({ ...NEW_ACCOUNT, name: 'Cat' }, { waist: 70 });
    expect(a.people).toEqual([{ id: ME, name: '', values: { waist: 70 }, named: true }]);
    expect(profileName(a)).toBe('Cat');
    expect(withPeople(NEW_ACCOUNT).people[0].named).toBe(false);
  });

  it('keeps the measurements as mine, with a name', () => {
    const a = claimMeasurements(withPeople(NEW_ACCOUNT, { waist: 70 }), 'mine', 'Cat');
    expect(a.name).toBe('Cat');
    expect(activePerson(a)).toMatchObject({ id: ME, values: { waist: 70 }, named: true });
  });

  it("moves someone else's measurements to a new person and switches to them", () => {
    const a = claimMeasurements(withPeople(NEW_ACCOUNT, { waist: 70 }), 'other', 'Maya');
    expect(profileName(a)).toBe('Maya');
    expect(activePerson(a).values).toEqual({ waist: 70 });
    expect(withPeople(a).people.find((p) => p.id === ME)).toMatchObject({ values: {}, named: true });
  });

  it('adds, switches and removes people, never the owner', () => {
    let a = addPerson(withPeople(NEW_ACCOUNT), 'Mum');
    expect(profileName(a)).toBe('Mum');
    a = updatePerson(a, activePerson(a).id, { values: { full_hip: 100 } });
    expect(activePerson(a).values).toEqual({ full_hip: 100 });
    const mum = activePerson(a).id;
    expect(removePerson(a, ME)).toBe(a);
    a = removePerson(a, mum);
    expect(activePerson(a).id).toBe(ME);
  });

  it('saves the same pattern once per person', () => {
    let a = savePattern(NEW_ACCOUNT, skirt('knee'), 'Mine');
    a = savePattern(a, skirt('knee'), 'For Maya', 'maya');
    expect(a.patterns).toHaveLength(2);
    expect(isSavedFor(a, skirt('knee'), 'maya')).toBe(true);
    expect(isSavedFor(a, skirt('midi'), 'maya')).toBe(false);
  });
});
