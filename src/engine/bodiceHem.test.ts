import { describe, expect, it } from 'vitest';
import { BodiceDraft, BodiceStyle, draftBodice } from './bodice';
import { HEM_ABOVE, bodiceHemShape, hemRound, hemWords } from './bodiceHem';
import { draftDress } from './dress';
import { bodiceFlat } from './flat';
import { taggedLength } from './geometry';
import { HEM_SAMPLES, HemShape } from './hem';
import { bodiceGuide } from './instructions';
import { layPlan } from './layplan';
import type { Piece } from './piece';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { DraftError } from './skirt';
import { DARTS_FOR_FIT } from '../garments';

const garment = (pcs: Piece[]) => pcs.filter((pc) => !pc.kind || pc.kind === 'collar');
const ramp = (centre: number, side: number) => Array.from({ length: HEM_SAMPLES }, (_, i) => centre + ((side - centre) * i) / (HEM_SAMPLES - 1));
/** A dip at the centre front, a back hanging longer, and a hem curving up to the centre. */
const HEMS: Record<string, HemShape> = {
  dipped: { front: ramp(6, 0), back: ramp(0, 0) },
  backLonger: { front: ramp(-2, 0), back: ramp(9, 0) },
  curved: { front: ramp(-3, 0), back: ramp(-3, 0) },
};

function problems(d: BodiceDraft, tag: string): string[] {
  const out = checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })
    .filter((c) => !c.ok)
    .map((c) => `${tag} ${c.label}: ${c.detail}`);
  if (!layPlan(d.pieces, 140)) out.push(`${tag} does not lay out on 140 cm fabric`);
  return out;
}

const centreFoot = (pc: Piece) => Math.max(...pc.outline.points(8).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));

describe('shaped bodice hems', () => {
  it('reshapes the hem in every fit, length, dart choice and seam, and it all walks', () => {
    const bad: string[] = [];
    let n = 0;
    for (let s = 1; s <= 2; s++) {
      const body = randomBody(rng(s));
      for (const [name, hem] of Object.entries(HEMS))
        for (const fit of ['fitted', 'relaxed'] as const)
          for (const darts of DARTS_FOR_FIT[fit])
            for (const extra of [{ length: 'hip' }, { length: 'high_hip' }, { length: 'hip', dropCm: 14 }, { length: 'hip', princess: 'shoulder' }, { length: 'hip', closure: 'front_buttons' }, { length: 'hip', bustDart: 'shoulder' }] as Partial<BodiceStyle>[]) {
              let d: BodiceDraft;
              try {
                d = draftBodice(body, { fit, darts, hem, ...extra });
              } catch (e) {
                if (e instanceof DraftError) continue;
                throw e;
              }
              n++;
              expect(d.hem).toBeDefined();
              bad.push(...problems(d, `${s} ${name} ${fit} ${darts} ${JSON.stringify(extra)}`));
            }
    }
    expect(n).toBeGreaterThan(60);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('lowers the centre front for a dip, and the centre back for a back hanging longer', () => {
    const body = randomBody(rng(2));
    const level = draftBodice(body, { length: 'hip' });
    const dipped = draftBodice(body, { length: 'hip', hem: HEMS.dipped });
    const back = draftBodice(body, { length: 'hip', hem: HEMS.backLonger });
    expect(centreFoot(dipped.pieces[0]) - centreFoot(level.pieces[0])).toBeCloseTo(6, 0);
    expect(centreFoot(back.pieces[1]) - centreFoot(level.pieces[1])).toBeCloseTo(9, 0);
    expect(back.backLength - level.backLength).toBeCloseTo(9, 0);
    // The landmarks follow the hem, for the sketch and the form.
    expect(dipped.front.hemCentre.y - level.front.hemCentre.y).toBeCloseTo(6, 0);
    // Front and back side seams still sew together.
    for (const d of [dipped, back]) expect(Math.abs(taggedLength(d.pieces[0].outline, 'side') - taggedLength(d.pieces[1].outline, 'side'))).toBeLessThan(0.1);
    // A curved hem turns up narrowly.
    expect(dipped.pieces[0].allowances.hem).toBeLessThanOrEqual(1.5);
    expect(dipped.pieces[0].draft?.points.some((pt) => pt.n === 'H')).toBe(true);
  });

  it('works with a lower shoulder too', () => {
    const d = draftBodice(randomBody(rng(3)), { length: 'hip', hem: HEMS.backLonger, fitting: { lowShoulder: { side: 'left', cm: 1.2 } } });
    expect(problems(d, 'low shoulder')).toEqual([]);
  });

  it('keeps a waist-length bodice, and a dress bodice, level at the waist', () => {
    const body = { ...randomBody(rng(1)), waist_to_knee: 58, waist_to_floor: 104 };
    expect(draftBodice(body, { length: 'waist', hem: HEMS.dipped }).hem).toBeUndefined();
    const dress = draftDress(body, { hem: HEMS.dipped }, {});
    expect(dress.bodice.hem).toBeUndefined();
  });

  it('meets at the side seams, and stays clear of the waist and above the knee', () => {
    const m = { waist_to_hip: 20 };
    const h = bodiceHemShape({ front: ramp(-40, -30), back: ramp(60, 10) }, m, 20)!;
    expect(h.front[HEM_SAMPLES - 1]).toBeCloseTo(h.back[HEM_SAMPLES - 1]);
    for (const v of [...h.front, ...h.back]) {
      expect(20 + v).toBeGreaterThanOrEqual(HEM_ABOVE - 1e-9);
      expect(20 + v).toBeLessThanOrEqual(32 + 1e-9);
    }
    expect(bodiceHemShape({ front: ramp(0, 0), back: ramp(0.2, 0) }, m, 20)).toBeUndefined();
    expect(bodiceHemShape(HEMS.dipped, m, 0)).toBeUndefined();
  });

  it('runs level across the centres and smoothly through the side seam', () => {
    const at = hemRound(HEMS.backLonger, 25, 22);
    const slope = (s: number) => (at(s + 0.01) - at(s - 0.01)) / 0.02;
    expect(Math.abs((at(0.01) - at(0)) / 0.01)).toBeLessThan(0.05);
    expect(Math.abs((at(47) - at(46.99)) / 0.01)).toBeLessThan(0.05);
    expect(Math.abs(slope(25 - 0.02) - slope(25 + 0.02))).toBeLessThan(0.05);
    expect(at(25)).toBeCloseTo(0);
  });

  it('says what shape it is, draws it in the flat, and hems it narrowly in the steps', () => {
    expect(hemWords(HEMS.dipped)).toMatch(/centre front/);
    expect(hemWords(HEMS.backLonger)).toMatch(/longer at the back/);
    const d = draftBodice(randomBody(rng(4)), { length: 'hip', hem: HEMS.backLonger });
    const flat = bodiceFlat(d);
    const back = flat.views.find((v) => v.label === 'BACK')!;
    const front = flat.views.find((v) => v.label === 'FRONT')!;
    const low = (pts: { y: number }[][]) => Math.max(...pts.flat().map((q) => q.y));
    expect(low(back.shapes) - low(front.shapes)).toBeGreaterThan(5);
    // A dip at the centre front shows below the side seams.
    const dipped = bodiceFlat(draftBodice(randomBody(rng(4)), { length: 'hip', hem: HEMS.dipped })).views;
    expect(low(dipped[0].shapes) - low(dipped[1].shapes)).toBeGreaterThan(4);
    const hem = bodiceGuide(d, { length: 'hip' } as never, 1.5, 1).steps.find((s) => s.title === 'Hem')!;
    expect(hem.text).toMatch(/shaped/);
  });
});
