import { afterEach, describe, expect, it } from 'vitest';
import { sewDesign } from '../../drapeSweep';
import { DEFAULT_BODICE } from '../../garments';
import { INITIAL } from '../../savedWork';
import { setKnob } from './knob';

const checks = (d: Parameters<typeof sewDesign>[0]) => (sewDesign(d).quality?.problems ?? []).map((p) => p.check);
const dress = (bodice: object, skirt: object, rest: object = {}) => ({ garment: 'dress' as const, saved: { dress: { garment: 'dress', bodice: { garment: 'bodice', ...bodice }, skirt, ...rest } } as never, fibre: 'cotton' as const });

// Random mixes of options that All round showed as their flat drawing (sweep of Nov 7, 2026), now drawn clean.
describe('All round: random mixes that fell back to the flat drawing', () => {
  afterEach(() => {
    for (const k of ['__selfFlare', '__noSelfGather', '__silkR', '__selfWideAt']) setKnob(k, undefined);
  });

  // A trumpet skirt's flare (its hem under half as long again as its waist) wasn't held apart, and folded through itself.
  it.each([
    ['boat neck, diagonal hem', dress({ fit: 'fitted', neckline: 'boat', length: 'waist', darts: 'bust', sleeve: 'none', closure: 'back_zip', collar: 'none', back: 'keyhole' }, { fit: 'relaxed', silhouette: 'trumpet', length: 'knee', asymHem: 'diagonal' }, { fit: 'fitted', waistSeam: 'natural' })],
    ['one shoulder, low seam', dress({ fit: 'relaxed', neckline: 'one_shoulder', length: 'waist', darts: 'bust', sleeve: 'none', closure: 'back_zip', collar: 'none' }, { fit: 'regular', silhouette: 'trumpet', length: 'knee', asymHem: 'none', rise: 'natural' }, { fit: 'fitted', waistSeam: 'low' })],
  ])('a trumpet dress (%s) is drawn without its skirt crossing itself', (_, d) => {
    expect(checks(d)).toEqual([]);
    setKnob('__selfFlare', 1.5);
    expect(checks(d)).toContain('crossed');
  }, 240_000);

  // A gathered skirt's fullness is in its waist, so by its hem it didn't count as flared and wasn't held apart either.
  it('a gathered midi dress is drawn without its skirt crossing itself', () => {
    const d = dress({ fit: 'regular', neckline: 'cami', length: 'waist', darts: 'bust_waist', sleeve: 'none', closure: 'back_zip', collar: 'none', peplum: 'none' }, { fit: 'regular', silhouette: 'gathered', length: 'midi', asymHem: 'none', rise: 'low' }, { fit: 'relaxed', waistSeam: 'raised' });
    expect(checks(d)).not.toContain('crossed');
    setKnob('__noSelfGather', 1);
    expect(checks(d)).toContain('crossed');
  }, 240_000);

  // A long full circle skirt's folds come round on each other from every side, and kept only 2 cm apart they slipped through.
  it.each([
    ['level hem, cotton', { fit: 'fitted', asymHem: 'none' }, 'cotton'],
    ['high-low hem, silk', { fit: 'regular', asymHem: 'high_low' }, 'silk'],
  ] as const)('a circle maxi skirt (%s) is drawn without crossing itself', (_, c, fibre) => {
    const d = { garment: 'skirt' as const, saved: { choices: { ...INITIAL.choices, silhouette: 'circle', length: 'maxi', ...c } } as never, fibre };
    expect(checks(d)).toEqual([]);
    setKnob('__selfWideAt', 99);
    expect(checks(d)).toContain('crossed');
  }, 240_000);

  // A silk sleeve drawn in to 0.72 of its round: an elbow cap sleeve went jagged and a three-quarter one folded into fins.
  it.each([
    ['an elbow cap sleeve', { fit: 'oversized', neckline: 'boat', length: 'long', sleeve: 'elbow', sleeveShape: 'cap', closure: 'front_buttons' }],
    ['a three-quarter sleeve', { fit: 'oversized', length: 'hip', sleeve: 'three_quarter', sleeveShape: 'straight', closure: 'front_buttons', collar: 'cape' }],
  ])('%s in silk draws clean', (_, b) => {
    const d = { garment: 'bodice' as const, saved: { bodice: { ...DEFAULT_BODICE, ...b } } as never, fibre: 'silk' as const };
    expect(checks(d)).toEqual([]);
    setKnob('__silkR', 0.72);
    expect(checks(d).length).toBeGreaterThan(0);
  }, 240_000);
});
