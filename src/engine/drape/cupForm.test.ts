import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from '../../collection';
import { drapeDesign } from '../../drapeSweep';
import type { MeasurementValues } from '../../measurements';
import { bodyHalf, shapeAt } from '../body';
import { cupForm } from './cupForm';
import { setKnob } from './knob';

// The live walk's fuller-bust body: on the even form the Black Vest's front pulled tight and the Ice Peplum's back sank
// into the form over the shoulder blades, so All round showed the drawing for both (bug hunt, Nov 25 and 26).
const FULLER: MeasurementValues = { waist: 86, full_bust: 112, full_hip: 110, waist_to_floor: 104, height: 165, waist_to_hip: 20.5, waist_to_knee: 58, high_bust: 94, shoulder_width: 38, nape_to_waist: 41, front_hps_to_waist: 49, bust_depth: 30, neck: 41, shoulder_length: 11.7, across_back: 34.6, across_front: 32.6, apex_separation: 18.6, armscye: 45.8, arm_length: 59, upper_arm: 29, wrist: 16 };
const sew = (id: string) => {
  const look = COLLECTION.find((l) => l.id === id)!;
  const { garment, ...saved } = lookPatch(look, FULLER) as never as { garment: never };
  const f = lookFabric(look.fabric);
  return drapeDesign({ garment, saved, fibre: f.fibre ?? 'cotton', crisp: f.drape === 'crisp', fabric: { special: f.special, ...(f.drape === 'crisp' ? { drape: 'crisp' as const } : {}) } }, FULLER);
};
// Half a ring's length at the form's line y, its points out by k(a) more than the even form's.
const halfRound = (y: number, k: (a: number) => number) => {
  let len = 0;
  for (let i = 1; i <= 180; i++) {
    const [a0, a1] = [(Math.PI * (i - 1)) / 180, (Math.PI * i) / 180];
    const r = (a: number) => bodyHalf(y) * shapeAt(a, y) * k(a);
    len += Math.hypot(Math.sin(a1) * r(a1) - Math.sin(a0) * r(a0), Math.cos(a1) * r(a1) - Math.cos(a0) * r(a0));
  }
  return len;
};

describe('a full cup on the form', () => {
  it('leaves the form as it is with no high bust, or a cup no fuller than its own', () => {
    expect(cupForm(112, undefined)).toBeUndefined();
    expect(cupForm(92, 88)).toBeUndefined();
  });

  it('stands the bust forward and takes it from the back, the bust keeping its girth', () => {
    const k = cupForm(112, 94)!;
    const bust = -0.575;
    expect(k(0, bust)).toBeGreaterThan(1.1);
    expect(k(Math.PI, bust)).toBeLessThan(1);
    expect(halfRound(bust, (a) => k(a, bust)) / halfRound(bust, () => 1)).toBeCloseTo(1, 3);
    // Above the bust the whole ring is drawn in toward the high bust.
    expect(k(Math.PI, -0.95)).toBeLessThan(0.95);
  });

  it('lets the Black Vest and the Ice Peplum show All round on a fuller bust', () => {
    for (const id of ['black-vest', 'ice-peplum']) {
      expect(sew(id).quality?.problems ?? [], id).toEqual([]);
      setKnob('__noCup', 1);
      try {
        expect(sew(id).quality?.ok, `${id} on the even form`).toBe(false);
      } finally {
        setKnob('__noCup', undefined);
      }
    }
  }, 600_000);
});
