import { describe, expect, it } from 'vitest';
import { FEEL_STEPS, cardOf, clothCard } from './clothCard';

describe('clothCard', () => {
  it('draws a plain cotton exactly as before the fabric card', () => {
    const c = clothCard({ fibre: 'cotton' });
    expect(c).toMatchObject({ bendK: 0.06, thick: 0.35, fall: 1, skirtBend: 1, stretch: 0 });
    expect(c.crisp).toBeUndefined();
    // With nothing picked, cotton.
    expect(clothCard()).toEqual(c);
  });

  it('keeps the old crisp peplum: 40 times a crisp cotton', () => {
    expect(cardOf('cotton', true).crisp).toBeCloseTo(40);
  });

  it('lets a fluid silk pour in its skirt and fall harder, its bodice as soft as before', () => {
    const c = clothCard({ fibre: 'silk' });
    expect(c.bendK).toBe(0.02);
    expect(c.skirtBend).toBeLessThan(1);
    expect(c.fall).toBeGreaterThan(1);
  });

  it('stands a denim skirt out and keeps a crisp cloth from being pulled down', () => {
    const c = clothCard({ special: 'denim' });
    expect(c.bendK * c.skirtBend).toBeGreaterThan(0.3);
    expect(c.fall).toBe(1);
  });

  it('gives a knit along its length and a woven only on the bias', () => {
    expect(clothCard({ knit: 'rib' })).toMatchObject({ stretch: 0.38, bias: 0 });
    expect(clothCard({ fibre: 'linen' }).stretch).toBe(0);
    expect(clothCard({ fibre: 'linen' }).bias).toBeGreaterThan(0);
  });

  it('holds the Feel to its steps, each way', () => {
    const far = clothCard({ fibre: 'cotton', feel: { stiff: 9, weight: 9 } });
    const most = clothCard({ fibre: 'cotton', feel: { stiff: FEEL_STEPS, weight: FEEL_STEPS } });
    expect(far).toEqual(most);
    expect(most.bendK * most.skirtBend).toBeGreaterThan(0.06);
    expect(clothCard({ fibre: 'cotton', feel: { weight: -2 } }).fall).toBe(1);
  });
});
