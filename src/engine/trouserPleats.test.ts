import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../measurements';
import { draftTrousers, trousersWaistband } from './trousers';
import { BELT_LOOPS, PLEAT_OPEN, pleatShares } from './trouserPleats';
import { roundTrousers } from './allRound';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { trousersGuide } from './trousersGuide';
import { describeTrousers, validTrousers } from '../garments';

const m = EXAMPLE_BODY as never;
const base = { fit: 'relaxed' as const, leg: 'wide' as const, length: 'knee' as const, lengthCm: 68, closure: 'fly' as const, pockets: 'slant' as const, legCm: { knee: 66, hem: 66 } };

describe('front pleats', () => {
  const plain = draftTrousers(m, base);
  for (const pleats of ['single', 'double'] as const) {
    const d = draftTrousers(m, { ...base, pleats });
    const front = d.pieces[0];
    const open = PLEAT_OPEN[pleats].reduce((t, v) => t + v, 0);
    it(`${pleats}: the dart goes into the first pleat and the front keeps its waist, the hem gaining the pleats' cloth`, () => {
      expect(d.pleats?.count).toBe(pleats === 'single' ? 1 : 2);
      expect(d.dartsPerSide.front).toBe(0);
      expect(d.finishedWaist).toBe(plain.finishedWaist);
      // The waist seam, pleats folded, is the plain front's with its dart closed.
      expect(taggedLength(front.outline, 'waist')).toBeCloseTo(taggedLength(plain.pieces[0].outline, 'waist'), 1);
      // The pleats' cloth is in the waist edge, tagged as theirs, and runs down to the hem.
      expect(taggedLength(front.outline, 'pleat')).toBeCloseTo(open + d.pleats!.dartCm, 1);
      expect(d.hemCm).toBeCloseTo(plain.hemCm + open, 1); // one leg's hem: front and back
      expect(d.finishedHip).toBeCloseTo(plain.finishedHip + 2 * open, 1);
      for (const pl of d.pleats!.lines) expect(pl.place - pl.fold).toBeGreaterThan(2);
    });
    it(`${pleats}: the seams still match, the waistband is the plain one, and the pockets are kept`, () => {
      expect(trousersWaistband(d, 1.5).meta.lengthCm).toBe(trousersWaistband(plain, 1.5).meta.lengthCm);
      // The crotch, the side and the inside leg keep their lengths: only the waist and hem grow.
      for (const tag of ['crotch', 'side', 'inseam']) expect(taggedLength(d.block[1].outline, tag)).toBeCloseTo(taggedLength(plain.pieces[1].outline, tag), 1);
      expect(d.pockets).toBe('slant');
      const faults = checkPattern([...d.pieces, trousersWaistband(d, 1.5)], { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
      expect(faults.map((c) => `${c.label}: ${c.detail}`)).toEqual([]);
    });
    it(`${pleats}: the All round drawing has each pleat's edge down the body and the leg, and the guide folds them`, () => {
      const shares = pleatShares(front, d.pleats!.lines);
      for (const sh of shares) {
        expect(sh.waist).toBeGreaterThan(0.25);
        expect(sh.waist).toBeLessThan(0.75);
        expect(sh.hem).toBeGreaterThan(0.3);
        expect(sh.hem).toBeLessThan(0.6);
      }
      expect(roundTrousers(d, m).pleats).toHaveLength(4 * shares.length);
      expect(trousersGuide(d, 2).steps.map((s) => s.title)).toContain(pleats === 'single' ? 'Fold the front pleat' : 'Fold the front pleats');
    });
  }
  it('is not cut on a pull-on waist, which is gathered', () => {
    const d = draftTrousers(m, { ...base, waist: 'elastic', pleats: 'double', loops: 'loops' });
    expect(d.pleats).toBeUndefined();
    expect(d.loops).toBeUndefined();
    expect(validTrousers({ garment: 'trousers', ...base, waist: 'elastic', pleats: 'double', loops: 'loops' })).toMatchObject({ pleats: 'none', loops: 'none' });
  });
});

describe('belt loops', () => {
  it('adds one strip that makes five loops, and says so', () => {
    const d = draftTrousers(m, { ...base, loops: 'loops' });
    expect(d.loops).toBe(BELT_LOOPS);
    const strip = d.pieces.find((pc) => pc.name === 'Belt loops')!;
    expect(strip.kind).toBe('facing');
    expect(strip.notches).toHaveLength(BELT_LOOPS - 1);
    expect(trousersGuide(d, 2).steps.map((s) => s.title)).toContain('Make the belt loops');
    expect(describeTrousers({ garment: 'trousers', ...base, pleats: 'double', loops: 'loops' })).toBe('68 cm wide-leg trousers with a fly front, two front pleats, belt loops and slant pockets');
  });
});
