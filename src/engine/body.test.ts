import { afterEach, describe, expect, it } from 'vitest';
import { bodyHalf, bodyLandmarks, pickBody, pickedBody, reach, shapeAt } from './body';
import { BODY_ANGLES, BODY_YS } from './bodyShape';
import { BODY_ANGLES_MENSWEAR, BODY_YS_MENSWEAR } from './bodyShapeMenswear';

// The menswear form's body (Nov 22): a man's, read at the same heights and angles as
// the womenswear body, so everything drawn in the form's units stands the same on both.
describe('the menswear body', () => {
  afterEach(() => pickBody());

  it('is read at the same heights and angles as the womenswear body', () => {
    expect(BODY_YS_MENSWEAR).toEqual(BODY_YS);
    expect(BODY_ANGLES_MENSWEAR).toBe(BODY_ANGLES);
  });

  it('is the womenswear body until a menswear form picks it, and back again after', () => {
    expect(pickedBody()).toBe('womenswear');
    const her = bodyHalf(-0.58);
    pickBody('menswear');
    expect(pickedBody()).toBe('menswear');
    expect(bodyHalf(-0.58)).not.toBeCloseTo(her, 2);
    pickBody();
    expect(bodyHalf(-0.58)).toBe(her);
  });

  it('has a man\'s shape: a chest standing less far forward than a bust, broad shoulders, a flatter seat', () => {
    // How far the front stands out at the chest, as a share of the half-width there: the bust stands well forward of a
    // man's chest.
    const front = () => shapeAt(0, bodyLandmarks().full_bust);
    const her = { front: front(), shoulders: bodyHalf(-1.2) / bodyHalf(-0.58), seat: reach(bodyHalf(0.82), Math.PI, 0.82) / bodyHalf(0.82) };
    pickBody('menswear');
    const his = { front: front(), shoulders: bodyHalf(-1.2) / bodyHalf(-0.58), seat: reach(bodyHalf(0.82), Math.PI, 0.82) / bodyHalf(0.82) };
    expect(his.front).toBeLessThan(her.front - 0.05);
    expect(his.shoulders).toBeGreaterThan(1.1);
    expect(his.seat).toBeLessThan(her.seat);
  });
});
