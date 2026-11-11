import { describe, expect, it } from 'vitest';
import { COLLECTION, lookChoices, lookFabric, lookFlat, lookPatch, lookValues } from './collection';
import { randomBody, rng } from './engine/randomBodies';
import { EXAMPLE_BODY, EXAMPLE_VALUES, isComplete } from './measurements';

describe('the Maison collection', () => {
  it('numbers its looks in order, with unique names', () => {
    // A set's pieces share their look's number, side by side.
    const numbers = [...new Set(COLLECTION.map((l) => l.number))];
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    for (const n of numbers) {
      const pieces = COLLECTION.filter((l) => l.number === n);
      if (pieces.length > 1) expect(new Set(pieces.map((l) => l.set)).size, `look ${n}`).toBe(1);
      if (pieces.length > 1) expect(pieces[0].set, `look ${n}`).toBeDefined();
    }
    expect(new Set(COLLECTION.map((l) => l.id)).size).toBe(COLLECTION.length);
  });

  it("names each look's colour, so it is drawn in the season's colours", () => {
    for (const look of COLLECTION) expect(lookFabric(look.fabric).colour, look.id).toBeDefined();
  });

  it('draws every look to the sample measurements', () => {
    for (const look of COLLECTION) {
      expect(isComplete(EXAMPLE_VALUES, look.garment)).toBe(true);
      const flat = lookFlat(look, lookValues(look, {}).values);
      expect(flat, look.id).toBeDefined();
      expect(flat!.views.map((v) => v.label)).toEqual(['FRONT', 'BACK']);
    }
  });

  it('draws every look to most bodies', () => {
    let drawn = 0;
    let tried = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const body = { ...EXAMPLE_VALUES, ...randomBody(rng(seed)) };
      for (const look of COLLECTION) {
        tried++;
        if (lookFlat(look, body)) drawn++;
      }
    }
    expect(drawn / tried).toBeGreaterThan(0.95);
  });

  it('saves each look under its garment', () => {
    for (const look of COLLECTION) {
      const patch = lookPatch(look);
      expect(patch.garment).toBe(look.garment);
      const key = look.garment === 'skirt' ? 'choices' : look.garment;
      expect(patch[key]).toBe(look.choices);
    }
  });

  it('draws a long-sleeved look with its sleeves before the arms are measured', () => {
    const shirt = COLLECTION.find((l) => l.id === 'ice-peplum')!;
    const { arm_length: _a, upper_arm: _u, ...noArms } = EXAMPLE_VALUES;
    const withArms = lookFlat(shirt, EXAMPLE_VALUES)!;
    const without = lookFlat(shirt, noArms)!;
    // Sleeves out at each side make it about as wide as when drawn with the arms; without them it is far narrower.
    expect(without.width).toBeGreaterThan(withArms.width * 0.9);
  });
  it("fits a trouser look's drawn length and leg to the wearer, and leaves the sample body's as drawn", () => {
    const bermuda = COLLECTION.find((l) => l.id === 'gold-shorts')!;
    expect(lookChoices(bermuda, EXAMPLE_BODY)).toEqual(bermuda.choices);
    const tall = lookChoices(bermuda, { ...EXAMPLE_BODY, waist_to_knee: EXAMPLE_BODY.waist_to_knee! * 1.1, full_hip: EXAMPLE_BODY.full_hip! * 1.2 }) as { lengthCm: number; legCm: { knee: number; hem: number } };
    const drawn = bermuda.choices as { lengthCm: number; legCm: { knee: number; hem: number } };
    expect(tall.lengthCm).toBeCloseTo(drawn.lengthCm * 1.1, 0);
    expect(tall.legCm.hem).toBeCloseTo(drawn.legCm.hem * 1.2, 0);
  });
});
