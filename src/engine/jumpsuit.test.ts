import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, randomCrotch, rng, sweep } from './randomBodies';
import { BODY_RISE, JumpsuitMeasurements, JumpsuitStyle, ZIP_BELOW_WAIST, draftJumpsuit } from './jumpsuit';
import { draftTrousers } from './trousers';
import { EXAMPLE_VALUES } from '../measurements';
import type { Piece } from './piece';

const EX = EXAMPLE_VALUES as unknown as JumpsuitMeasurements;
/** The five starting Looks on the option sheet (Cat kept all, 2026-11-07). */
const SHEET: Record<string, JumpsuitStyle> = {
  J1: { top: { fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons' }, sleeve: { length: 'long', shape: 'straight' }, legs: { leg: 'straight', length: 'full' } },
  J2: { top: { fit: 'fitted', neckline: 'cami' }, legs: { leg: 'wide', length: 'full' } },
  J3: { top: { fit: 'fitted', neckline: 'halter' }, legs: { leg: 'flare', length: 'full' } },
  J4: { top: { fit: 'fitted', neckline: 'v' }, legs: { leg: 'tapered', length: 'ankle' } },
  J5: { top: { fit: 'regular', neckline: 'square' }, sleeve: { length: 'short', shape: 'puff' }, legs: { leg: 'straight', length: 'shorts' } },
};
const body = (pcs: Piece[], re: RegExp) => pcs.filter((pc) => !pc.kind && re.test(pc.name));

describe('jumpsuit', () => {
  it('drafts the five sheet looks with a pattern that checks out', () => {
    for (const [name, st] of Object.entries(SHEET)) expect(checkPattern(draftJumpsuit(EX, st).pieces).filter((c) => !c.ok), name).toEqual([]);
  });

  it('meets the bodice at the waist edge for edge, front and back', () => {
    for (const [name, st] of Object.entries(SHEET)) {
      const d = draftJumpsuit(EX, st);
      const bf = taggedLength(body(d.pieces, /^Bodice front/)[0].outline, 'waist');
      const bb = taggedLength(body(d.pieces, /^Bodice back/)[0].outline, 'waist');
      const legs = d.pieces.filter((pc) => !pc.kind && /^(Leg|Shorts) /.test(pc.name));
      expect(Math.abs(bf - taggedLength(legs[0].outline, 'waist')), name).toBeLessThan(0.1);
      expect(Math.abs(bb - taggedLength(legs[1].outline, 'waist')), name).toBeLessThan(0.1);
      expect(d.pieces.some((pc) => pc.kind === 'waistband'), name).toBe(false);
    }
  });

  it('cuts the crotch lower and its seam longer than trousers alone, to sit in', () => {
    const d = draftJumpsuit(EX, SHEET.J4);
    const t = draftTrousers(EX, { leg: 'tapered', length: 'ankle' });
    expect(d.trousers.crotch.target - t.crotch.target).toBeCloseTo(BODY_RISE.crotch, 1);
  });

  it('zips down the back past the waist, or opens with a fly under a buttoned front', () => {
    const z = draftJumpsuit(EX, SHEET.J2);
    expect(z.closure).toBe('back_zip');
    expect(z.zipCm).toBeCloseTo(z.bodice.backLength + ZIP_BELOW_WAIST, 0);
    expect(z.pieces.filter((pc) => /^Bodice back/.test(pc.name)).flatMap((pc) => pc.labels).some((l) => l.text === 'ZIP ENDS')).toBe(false);
    expect(z.pieces.find((pc) => pc.name === 'Leg back')!.labels.some((l) => l.text === 'ZIP ENDS')).toBe(true);
    const b = draftJumpsuit(EX, SHEET.J1);
    expect(b.closure).toBe('front_buttons');
    expect(b.pieces.map((pc) => pc.name)).toEqual(expect.arrayContaining(['Fly facing', 'Fly shield', 'Front facing']));
  });

  it('drafts on random bodies, the pattern checking out', () => {
    const looks = Object.values(SHEET);
    for (let seed = 1; seed <= sweep(40); seed++) {
      const r = rng(seed);
      const b = randomBody(r);
      const m = { ...EX, ...b, ...randomArms(b, r), ...randomCrotch(b, r) } as JumpsuitMeasurements;
      let d;
      try {
        d = draftJumpsuit(m, looks[seed % looks.length]);
      } catch (e) {
        // The trouser block's own limit (a waist over the hip): the jumpsuit says the same, nothing more.
        expect(String(e)).toMatch(/waist is larger than your hip|crotch depth/);
        continue;
      }
      expect(checkPattern(d.pieces).filter((c) => !c.ok), `seed ${seed}`).toEqual([]);
    }
  });
});
