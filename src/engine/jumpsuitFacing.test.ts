import { describe, expect, it } from 'vitest';
import { draftJumpsuit, type JumpsuitMeasurements, type JumpsuitStyle } from './jumpsuit';
import { jumpsuitGuide } from './rangeGuide';
import { EXAMPLE_VALUES } from '../measurements';

const EX = EXAMPLE_VALUES as unknown as JumpsuitMeasurements;
const titles = (st: JumpsuitStyle) => jumpsuitGuide(draftJumpsuit(EX, st), 3).steps;

describe('a buttoned jumpsuit with a shirt collar', () => {
  const st: JumpsuitStyle = { top: { fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons' }, sleeve: { length: 'long', shape: 'straight' }, legs: { leg: 'straight', length: 'full' } };

  it('has no back neck facing, so no step joins one', () => {
    const d = draftJumpsuit(EX, st);
    expect(d.pieces.some((pc) => /back neck facing/i.test(pc.name))).toBe(false);
    const all = titles(st).map((s) => s.text).join(' ');
    expect(all).not.toMatch(/back neck facing/);
  });

  it('faces the fronts before the collar stand goes on, ending the facings at the shoulders', () => {
    const steps = titles(st);
    const face = steps.findIndex((s) => s.title === 'Face the front');
    const collar = steps.findIndex((s) => s.title === 'Make the collar');
    expect(face).toBeGreaterThan(-1);
    expect(face).toBeLessThan(collar);
    expect(steps[face].text).toMatch(/slip-stitch each facing's folded shoulder edge/);
  });
});
