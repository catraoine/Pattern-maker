import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { EXAMPLE_BODY } from '../measurements';
import { SLEEVE_EASE, draftSleeve } from './sleeve';
import { SHEER_CROWN_EASE, crownEaseFor, easeSheerHead } from './sleeveHeadEase';

describe('sleeve head ease by cloth', () => {
  it('holds a sheer to less crown ease, and leaves every other cloth its own', () => {
    expect(crownEaseFor({ special: 'sheer', fibre: 'silk' })).toBe(SHEER_CROWN_EASE);
    expect(crownEaseFor({ fibre: 'wool' })).toBeUndefined();
    expect(crownEaseFor({ special: 'satin' })).toBeUndefined();
    expect(crownEaseFor(undefined)).toBeUndefined();
    // "Adjust the ease for this fabric" turned off turns this off too.
    expect(crownEaseFor({ special: 'sheer', matchEase: false })).toBeUndefined();
  });

  it('cuts the crown that much longer than the armhole and no more, without changing the armhole or the arm room', () => {
    const b = draftBodice(EXAMPLE_BODY as never, { fit: 'fitted', neckline: 'crew', length: 'waist', darts: 'bust_waist' } as never);
    const style = { length: 'long' as const, shape: 'bishop' as const, fit: 'fitted' as const, seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 };
    const plain = draftSleeve(b, EXAMPLE_BODY as never, style);
    const sheer = draftSleeve(b, EXAMPLE_BODY as never, { ...style, crownEase: SHEER_CROWN_EASE });
    expect(plain.crownEase.front + plain.crownEase.back).toBeCloseTo(SLEEVE_EASE.fitted.crown, 0);
    expect(sheer.crownEase.front + sheer.crownEase.back).toBeCloseTo(SHEER_CROWN_EASE, 0);
    // A little more of it at the back, as before.
    expect(sheer.crownEase.back).toBeGreaterThan(sheer.crownEase.front);
    expect(sheer.armhole).toEqual(plain.armhole);
    expect(sheer.bicep).toBe(plain.bicep);
    // The crown is a little lower, since it has less length to find.
    expect(sheer.capHeight).toBeLessThan(plain.capHeight);
    expect(plain.capHeight - sheer.capHeight).toBeLessThan(1.5);
  });

  it('never adds ease: a relaxed sleeve already under the limit keeps its own', () => {
    const b = draftBodice(EXAMPLE_BODY as never, { fit: 'oversized', neckline: 'crew', length: 'hip', darts: 'none' } as never);
    const style = { length: 'long' as const, shape: 'straight' as const, fit: 'oversized' as const, seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 };
    const plain = draftSleeve(b, EXAMPLE_BODY as never, style);
    const sheer = draftSleeve(b, EXAMPLE_BODY as never, { ...style, crownEase: SHEER_CROWN_EASE });
    expect(sheer.crownEase).toEqual(plain.crownEase);
  });

  it('only rewords the easing step of a sleeve that was cut with the smaller ease', () => {
    const step = (f: number, b: number) => ({ title: 'Ease the sleeve heads', text: `The crown is longer than the armhole by its ease, ${f} cm at the front and ${b} cm at the back. Steam it over a ham and let it cool.` });
    expect(easeSheerHead(step(0.6, 0.8)).text).toContain('A sheer does not shrink in under steam');
    expect(easeSheerHead(step(1.3, 1.7)).text).toBe(step(1.3, 1.7).text);
  });
});
