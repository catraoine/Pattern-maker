import { describe, expect, it } from 'vitest';
import { lookFabric, lookFlat, lookPatch, lookValues } from './collection';
import { ARCHIVE } from './archive';
import { COLLECTION } from './collection';
import { ERAS } from './engine/eras';
import { ERA_PIECES, eraLine } from './eraLines';
import { isBodice, isDress, validDetails } from './garments';
import { randomBody, rng } from './engine/randomBodies';
import { EXAMPLE_VALUES } from './measurements';

describe('the era lines', () => {
  it('gives every era its skirts plus a top, a dress and a trouser, jacket or coat', () => {
    for (const era of ERAS) {
      const line = eraLine(era.id);
      expect(line.filter((p) => p.garment === 'skirt').length, era.id).toBe(era.looks.length);
      expect(line.filter((p) => p.garment === 'bodice').length, era.id).toBe(1);
      expect(line.filter((p) => p.garment === 'dress').length, era.id).toBe(1);
      expect(line.filter((p) => ['trousers', 'jacket', 'coat'].includes(p.garment)).length, era.id).toBe(1);
      expect(line.map((p) => p.number)).toEqual(line.map((_, i) => i + 1));
    }
    expect(ERA_PIECES.every((p) => ERAS.some((e) => e.id === p.era))).toBe(true);
  });

  it('has ids of its own, apart from the house looks and the Archive', () => {
    const ids = [...ERAS.flatMap((e) => eraLine(e.id)), ...COLLECTION, ...ARCHIVE].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a colour for each piece, so it is drawn in it', () => {
    for (const p of ERA_PIECES) expect(lookFabric(p.fabric).colour ?? lookFabric(p.fabric).special, p.id).toBeDefined();
  });

  it('keeps every detail it asks for: none is a choice the garment would drop', () => {
    for (const p of ERA_PIECES) {
      const c = p.choices;
      if (isDress(c)) expect(validDetails(c.bodice, 'dress'), p.id).toMatchObject(c.bodice);
      if (isBodice(c)) expect(validDetails(c), p.id).toMatchObject(c);
    }
  });

  it('draws every piece, front and back, to the sample measurements and to most bodies', () => {
    for (const era of ERAS)
      for (const p of eraLine(era.id)) {
        const flat = lookFlat(p, lookValues(p, {}).values);
        expect(flat, p.id).toBeDefined();
        expect(flat!.views.map((v) => v.label)).toEqual(['FRONT', 'BACK']);
      }
    let drawn = 0;
    let tried = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const body = { ...EXAMPLE_VALUES, ...randomBody(rng(seed)) };
      for (const p of ERA_PIECES) {
        tried++;
        if (lookFlat(p, body)) drawn++;
      }
    }
    expect(drawn / tried).toBeGreaterThan(0.95);
  });

  it('saves each piece under its garment', () => {
    for (const p of ERA_PIECES) expect(lookPatch(p).garment).toBe(p.garment);
  });
});
