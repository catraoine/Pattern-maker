import { describe, expect, it } from 'vitest';
import { LEG, LEG_CROTCH, LEG_X, legsFor } from '../engine/form';
import { armAt, armFor } from './DrawOnForm';

const m = { full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27 };

describe('legs and arms to your measurements', () => {
  it('parts the legs at the form’s crotch', () => {
    expect(LEG(LEG_CROTCH)).toBeCloseTo(LEG_X, 2);
  });

  it('sets the legs to your lengths, as wide as your hip at the top', () => {
    const legs = legsFor(m);
    expect(legs.crotch).toBe(27);
    expect(legs.knee).toBe(58);
    expect(legs.floor).toBe(104);
    // The inside edges meet at the centre where the legs part, the outsides run on from the hip.
    expect(legs.apart - legs.half(27)).toBeCloseTo(0, 1);
    expect(legs.apart + legs.half(27)).toBeCloseTo((102 / 4) * 0.97, 1);
    // Narrower at the knee than the thigh, and at the ankle than the knee.
    expect(legs.half(58)).toBeLessThan(legs.half(35));
    expect(legs.half(100)).toBeLessThan(legs.half(58));
  });

  it('follows a longer leg and a bigger hip', () => {
    const tall = legsFor({ ...m, waist_to_knee: 64, waist_to_floor: 115 });
    expect(tall.floor).toBe(115);
    expect(tall.half(64)).toBeCloseTo(legsFor(m).half(58), 5);
    expect(legsFor({ ...m, full_hip: 120 }).half(58)).toBeGreaterThan(legsFor(m).half(58));
    // Without a crotch depth, a little below the hip.
    expect(legsFor({ ...m, crotch_depth: undefined }).crotch).toBe(27.5);
  });

  it('hangs the arm to your arm length, as round as your upper arm and wrist', () => {
    const tip = { x: 19, y: 0 };
    const under = { x: 23, y: 20 };
    const arm = armFor(tip, under, { arm_length: 59, upper_arm: 29, wrist: 16 });
    expect(arm.wristY).toBe(59);
    const across = (y: number) => armAt(arm, y).outer - armAt(arm, y).inner;
    expect(across(20)).toBeCloseTo(29 / Math.PI, 5);
    expect(across(59)).toBeCloseTo(16 / Math.PI, 5);
    expect(across(arm.elbowY)).toBeLessThan(across(20));
    expect(across(arm.elbowY)).toBeGreaterThan(across(59));
    // The top of the arm starts at the shoulder tip.
    expect(armAt(arm, 0).outer).toBeCloseTo(19, 5);
    expect(armFor(tip, under, { arm_length: 64, upper_arm: 34 }).wristY).toBe(64);
  });
});
