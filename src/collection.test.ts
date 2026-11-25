import { describe, expect, it } from 'vitest';
import { COLLECTION, TESTER_LOOK, lookChoices, lookDropsLength, lookPatchKeeping, lookFabric, lookFlat, lookNameOf, lookPatch, lookResized, lookValues } from './collection';
import { randomBody, rng } from './engine/randomBodies';
import { EXAMPLE_BODY, EXAMPLE_VALUES, isComplete } from './measurements';
import { DEFAULT_BODICE, DEFAULT_JACKET_CHOICES, DEFAULT_TROUSERS_CHOICES, type PatternChoices } from './garments';

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

  // Fit tester walk, Nov 14: a petite tester measured the basics, picked the Blush Shift, then took the rest. The look
  // was made on the sample body, so her mini wasn't let down and Style lost the look's name.
  it('a look made before the measurements were all in is sized again once they are', () => {
    const shift = COLLECTION.find((l) => l.name === 'Blush Shift')!;
    const basics = { waist: 64, full_bust: 82, full_hip: 88, waist_to_floor: 94, height: 152 };
    expect(lookValues(shift, basics).own).toBe(false);
    const made = lookPatch(shift, lookValues(shift, basics).values) as unknown as { dress: PatternChoices };
    const all = { ...basics, high_bust: 78, shoulder_width: 35, nape_to_waist: 37, front_hps_to_waist: 40, bust_depth: 23, waist_to_hip: 20.5, waist_to_knee: 52 };
    expect(lookValues(shift, all).own).toBe(true);
    // Its name holds either way: only the length differs (testers, Nov 17).
    expect(lookNameOf('dress', made.dress, all)).toBe('Blush Shift');
    const again = lookResized('dress', made.dress, all) as unknown as { dress: PatternChoices & { skirt: { lengthCm?: number } } };
    expect(again.dress.skirt.lengthCm).toBeDefined();
    expect(lookNameOf('dress', again.dress, all)).toBe('Blush Shift');
    // Sized once, or changed by the maker, it is left alone.
    expect(lookResized('dress', again.dress, all)).toBeUndefined();
    expect(lookResized('dress', { ...made.dress, fit: 'relaxed' } as PatternChoices, all)).toBeUndefined();
  });

  // Testers, Nov 17: dragging the Blush Shift's hem on the drawing lost its name (and, on a named length, its cut).
  // A tester's own length keeps the look's name on Style and on the print; any other change still drops it.
  it("keeps a look's name when only its length is changed", () => {
    const lengths: Record<string, (c: Record<string, unknown>) => Record<string, unknown>> = {
      dress: (c) => ({ ...c, skirt: { ...(c.skirt as object), length: 'maxi', lengthCm: 90 } }),
      skirt: (c) => ({ ...c, length: 'midi', kneeShare: undefined, lengthCm: 70 }),
      trousers: (c) => ({ ...c, length: 'cropped', lengthCm: 80 }),
      bodice: (c) => ({ ...c, dropCm: 12 }),
      jacket: (c) => ({ ...c, length: 'hip', dropCm: undefined }),
    };
    for (const look of COLLECTION.filter((l) => lengths[l.garment])) {
      const c = lookChoices(look, EXAMPLE_VALUES) as unknown as Record<string, unknown>;
      expect(lookNameOf(look.garment, lengths[look.garment](c) as unknown as PatternChoices, EXAMPLE_VALUES), look.name).toBe(look.name);
      expect(lookNameOf(look.garment, { ...c, fit: c.fit === 'relaxed' ? 'fitted' : 'relaxed' } as unknown as PatternChoices, EXAMPLE_VALUES), look.name).toBeUndefined();
    }
    // No two looks are the same garment but for their length, so a length never turns one look into another.
    const same = COLLECTION.filter((a) => lengths[a.garment] && COLLECTION.some((b) => b !== a && b.garment === a.garment && lookNameOf(b.garment, lengths[b.garment](lookChoices(a, EXAMPLE_VALUES) as never) as never, EXAMPLE_VALUES) === b.name));
    expect(same.map((l) => l.name)).toEqual([]);
  });
});

// Style offers a tester on a plain garment the look they sew (testers, Nov 18): each one has to be a look in the
// collection, made from that garment, or the offer quietly stops showing.
describe('the fit testers\' looks', () => {
  it('are the five tester pieces, each a look made from its own garment', () => {
    expect(Object.values(TESTER_LOOK).sort()).toEqual(['black-pleated-skirt', 'black-vest', 'blush-shift', 'chocolate-barrel', 'ice-peplum']);
    for (const [garment, id] of Object.entries(TESTER_LOOK)) expect(COLLECTION.find((l) => l.id === id)?.garment, id).toBe(garment);
  });
});

// Pretend tester, Nov 18: opening the tester's look from the plain garment dropped the length she had set on it.
describe('a look opened from the plain garment', () => {
  const look = (id: string) => COLLECTION.find((l) => l.id === id)!;
  it('keeps a length the maker set, and the look\'s own when none was set', () => {
    const trousers = lookPatchKeeping(look('chocolate-barrel'), EXAMPLE_VALUES, { ...DEFAULT_TROUSERS_CHOICES, lengthCm: 94 }, DEFAULT_TROUSERS_CHOICES).trousers as { lengthCm?: number; leg: string };
    expect(trousers.lengthCm).toBe(94);
    expect(trousers.leg).toBe((lookChoices(look('chocolate-barrel'), EXAMPLE_VALUES) as { leg?: string }).leg);
    expect(lookPatchKeeping(look('chocolate-barrel'), EXAMPLE_VALUES, DEFAULT_TROUSERS_CHOICES, DEFAULT_TROUSERS_CHOICES)).toEqual(lookPatch(look('chocolate-barrel'), EXAMPLE_VALUES));
    const vest = lookPatchKeeping(look('black-vest'), EXAMPLE_VALUES, { ...DEFAULT_JACKET_CHOICES, length: 'cropped' }, DEFAULT_JACKET_CHOICES).jacket as { length: string; dropCm?: number };
    expect(vest).toMatchObject({ length: 'cropped' });
    expect(vest.dropCm).toBeUndefined();
    // Still the look, by its name.
    expect(lookNameOf('trousers', trousers as never, EXAMPLE_VALUES)).toBe('Chocolate Barrel Trouser');
  });
  it('leaves a top\'s length to the look, so its peplum can hang', () => {
    expect(lookPatchKeeping(look('ice-peplum'), EXAMPLE_VALUES, { ...DEFAULT_BODICE, length: 'long' }, DEFAULT_BODICE)).toEqual(lookPatch(look('ice-peplum'), EXAMPLE_VALUES));
  });

  it('says when a top\'s length is left behind, and only then', () => {
    expect(lookDropsLength(look('ice-peplum'), { ...DEFAULT_BODICE, length: 'high_hip', dropCm: 9 }, DEFAULT_BODICE)).toBe(true);
    expect(lookDropsLength(look('ice-peplum'), DEFAULT_BODICE, DEFAULT_BODICE)).toBe(false);
    expect(lookDropsLength(look('ice-peplum'), { ...DEFAULT_BODICE, length: 'waist', dropCm: 6 }, DEFAULT_BODICE)).toBe(false);
    // Every other tester look carries the length across, so has nothing to say.
    expect(lookDropsLength(look('chocolate-barrel'), { ...DEFAULT_TROUSERS_CHOICES, lengthCm: 94 }, DEFAULT_TROUSERS_CHOICES)).toBe(false);
  });
});

// A peplum tester with a top's measurements but no waist to hip saw "This look can't be drafted to these measurements"
// on the Ice Peplum's card, and read it as being told she was too big for it (tester, Nov 18). Every look draws.
describe('a look card always has a drawing', () => {
  const IN = 2.54;
  const look = (id: string) => COLLECTION.find((l) => l.id === id)!;
  const topOnly = { height: 66 * IN, full_bust: 44 * IN, high_bust: 41 * IN, waist: 42 * IN, shoulder_width: 17 * IN, nape_to_waist: 18 * IN, front_hps_to_waist: 22.5 * IN, bust_depth: 14.5 * IN, full_hip: 43 * IN };
  it('draws every look to these measurements, or to the sample while one is still to take', () => {
    for (const l of COLLECTION) expect(lookFlat(l, lookValues(l, topOnly).values), l.id).toBeDefined();
    expect(lookValues(look('ice-peplum'), topOnly).own).toBe(false);
    expect(lookValues(look('ice-peplum'), { ...topOnly, waist_to_hip: 21 }).own).toBe(true);
    expect(lookFlat(look('ice-peplum'), { ...topOnly, waist_to_hip: 21 })).toBeDefined();
  });
});
