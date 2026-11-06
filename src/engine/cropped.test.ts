import { describe, expect, it } from 'vitest';
import { draftBodice, needsHip } from './bodice';
import { peplumLengthOk } from './drape';
import { EXAMPLE_BODY } from '../measurements';
import { DEFAULT_BODICE, detailAllowed, validDetails } from '../garments';
import type { BodiceChoices } from '../garments';

// The Cropped length (In testing, Cat's SS27 balloon top picture, 2026-11-06): the waist-length bodice cut off under
// the bust, as a dress's empire seam cuts it, with a peplum hanging from the cut edge.
const SA = { seamAllowance: 1.5, neckArmholeAllowance: 1, hemAllowance: 3 };
const cropped = (more: Partial<BodiceChoices> = {}) => ({ ...DEFAULT_BODICE, fit: 'fitted', neckline: 'v', darts: 'bust', sleeve: 'none', length: 'cropped', ...more, ...SA }) as never;

describe('a cropped top', () => {
  it('needs no hip measurements and takes a peplum', () => {
    expect(needsHip('cropped')).toBe(false);
    expect(peplumLengthOk({ length: 'cropped' })).toBe(true);
  });

  it('is cut off above the waist, its peplum hanging from the cut', () => {
    const waist = draftBodice(EXAMPLE_BODY as never, cropped({ length: 'waist', peplum: 'balloon', peplumSize: 'big' }));
    const d = draftBodice(EXAMPLE_BODY as never, cropped({ peplum: 'balloon', peplumSize: 'big' }));
    expect(d.raiseCm).toBeGreaterThan(5);
    const foot = (b: typeof d) => Math.max(...b.pieces.filter((pc) => !pc.kind && /^Bodice front/.test(pc.name)).flatMap((pc) => pc.outline.taggedPoints(12).pts.map((q) => q.y)));
    expect(foot(waist) - foot(d)).toBeCloseTo(d.raiseCm!, 0);
    expect(d.pieces.map((pc) => pc.name)).toContain('Peplum front');
  });

  it('stops its button front above the cut', () => {
    const d = draftBodice(EXAMPLE_BODY as never, cropped({ closure: 'front_buttons', neckline: 'crew' }));
    const hem = d.front.waistCentre.y - d.raiseCm!;
    expect(d.buttons!.at.length).toBeGreaterThan(0);
    for (const y of d.buttons!.at) expect(y).toBeLessThanOrEqual(hem - 2);
  });

  it('is cut from a plain front and back: the chips keep panels and drapes off it', () => {
    const c = { ...DEFAULT_BODICE, length: 'cropped', darts: 'bust_waist' } as BodiceChoices;
    expect(detailAllowed(c, 'princess', 'shoulder')).toBe(false);
    expect(detailAllowed(c, 'bustDart', 'waist')).toBe(true);
    expect(validDetails({ ...c, princess: 'shoulder' }).princess).toBe('none');
    expect(validDetails({ ...c, neckline: 'cowl' }).length).toBe('waist');
    expect(validDetails({ ...c, dropCm: 6 }).dropCm).toBeUndefined();
    expect(() => draftBodice(EXAMPLE_BODY as never, cropped({ darts: 'bust_waist', princess: 'shoulder' }))).toThrow(/plain front and back/);
  });
});
