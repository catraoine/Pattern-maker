import { describe, expect, it } from 'vitest';
import { ARCHIVE, accession, archiveCut, canMake } from './archive';
import { COLLECTION, lookFlat, lookPatch, lookValues } from './collection';

describe('the Archive', () => {
  it('numbers its records in order, with ids apart from the house looks', () => {
    expect(ARCHIVE.map((c) => c.number)).toEqual(ARCHIVE.map((_, i) => i + 1));
    const ids = [...ARCHIVE, ...COLLECTION].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(accession(ARCHIVE[0])).toBe('ARC · 1954 · 001');
  });

  it('draws every cut to the sample measurements and saves it under its garment', () => {
    for (const cut of ARCHIVE) {
      expect(lookFlat(cut, lookValues(cut, {}).values), cut.id).toBeDefined();
      expect(lookPatch(cut).garment).toBe(cut.garment);
    }
  });

  it('opens a cut only once its source is licensed and credited', () => {
    const cut = ARCHIVE[0];
    expect(canMake(cut)).toBe(false);
    expect(canMake({ ...cut, source: 'A museum' })).toBe(false);
    expect(canMake({ ...cut, source: 'A museum', credit: 'From the collection of a museum.' })).toBe(true);
    expect(archiveCut(cut.id)).toBe(cut);
    expect(archiveCut('klein')).toBeUndefined();
  });

  it("keeps last season's house looks, credited to the house and open to make", () => {
    const last = ARCHIVE.filter((c) => c.source === 'Maison Tracé');
    expect(last.map((c) => c.name)).toContain('Tailleur');
    expect(last).toHaveLength(10);
    for (const cut of last) expect(canMake(cut)).toBe(true);
  });
});
