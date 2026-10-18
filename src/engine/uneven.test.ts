import { describe, expect, it } from 'vitest';
import { BodiceDraft, BodiceStyle, UnevenNeck, draftBodice } from './bodice';
import { draftDress } from './dress';
import { drapeFacings, drapeLined } from './drape';
import { bodiceFlat, dressFlat } from './flat';
import { HEM_SAMPLES } from './hem';
import { bodiceGuide, dressGuide } from './instructions';
import { layPlan, layPlans } from './layplan';
import type { Piece } from './piece';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { DraftError } from './skirt';
import { unevenEdge } from './uneven';
import { DARTS_FOR_FIT, DEFAULT_BODICE, describeBodice, validDetails } from '../garments';

const garment = (pcs: Piece[]) => pcs.filter((pc) => !pc.kind || pc.kind === 'collar');
/** Lower on the wearer's right, an asymmetric V, and lower on the left with one side straighter. */
const NECKS: Record<string, UnevenNeck> = {
  lowRight: { depth: 12, x: -4, left: 0.6, right: 0.6 },
  asymV: { depth: 14, x: 3, left: 0, right: 0 },
  centreV: { depth: 12, x: 0, left: 0, right: 0 },
  mixed: { depth: 9, x: 2, left: 0.8, right: 0.1 },
};

function problems(d: BodiceDraft, tag: string): string[] {
  const out = checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })
    .filter((c) => !c.ok)
    .map((c) => `${tag} ${c.label}: ${c.detail}`);
  if (!layPlan(d.pieces, 140)) out.push(`${tag} does not lay out on 140 cm fabric`);
  return out;
}

describe('uneven necklines', () => {
  it('drafts each in every fit, length and dart choice, and it all walks', () => {
    const bad: string[] = [];
    let n = 0;
    for (let s = 1; s <= 3; s++) {
      const body = randomBody(rng(s));
      for (const [name, unevenNeck] of Object.entries(NECKS))
        for (const fit of ['fitted', 'relaxed'] as const)
          for (const darts of DARTS_FOR_FIT[fit])
            for (const extra of [{ length: 'waist' }, { length: 'hip' }, { length: 'waist', peplum: 'flared' }, { length: 'waist', sleeve: 'short' }] as Partial<BodiceStyle>[]) {
              let d: BodiceDraft;
              try {
                d = draftBodice(body, { fit, darts, unevenNeck, ...extra });
              } catch (e) {
                if (e instanceof DraftError) continue;
                throw e;
              }
              n++;
              expect(d.drape?.kind).toBe('uneven');
              bad.push(...problems(d, `${s} ${name} ${fit} ${darts} ${JSON.stringify(extra)}`));
            }
    }
    expect(n).toBeGreaterThan(80);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('cuts the front whole, once, right side up, and the back as a pair', () => {
    const d = draftBodice(randomBody(rng(2)), { fit: 'regular', unevenNeck: NECKS.lowRight });
    const [front, back] = d.pieces;
    expect(front.cut).toBe('Cut 1, right side up');
    expect(front.meta).toMatchObject({ whole: true, singleLayer: true, rightSideUp: true });
    expect(front.fold).toBeUndefined();
    expect(back.cut).toBe('Cut 2 (1 pair)');
    expect(front.labels.some((l) => l.text === 'LEFT SIDE')).toBe(true);
    // Lower on the wearer's right: x < 0 as the front lies right side up.
    const edge = unevenEdge(d);
    const lowest = edge.reduce((a, b) => (b.y > a.y ? b : a));
    expect(lowest.x).toBeCloseTo(-4, 0);
    expect(lowest.y).toBeCloseTo(d.neckBlock.front.neckY + 12, 0);
    // The neck points, and so the shoulders and the back neck, stay where they were.
    expect(Math.abs(edge[0].x + edge[edge.length - 1].x)).toBeLessThan(1e-6);
    const lay = layPlans(d.pieces, 140)[0];
    expect(lay.rightSideUp).toBe(true);
  });

  it('keeps deep necklines clear of the bust and on the front', () => {
    const d = draftBodice(randomBody(rng(4)), { unevenNeck: { depth: 60, x: 40, left: 0.5, right: 0.5 } });
    const edge = unevenEdge(d);
    const lowest = edge.reduce((a, b) => (b.y > a.y ? b : a));
    expect(lowest.y).toBeLessThanOrEqual(d.front.apex.y - 5 + 1e-6);
    expect(lowest.x).toBeLessThan(edge[edge.length - 1].x);
  });

  it('works with a lower shoulder on either side', () => {
    const bad: string[] = [];
    for (const side of ['left', 'right'] as const)
      for (let s = 1; s <= 2; s++) bad.push(...problems(draftBodice(randomBody(rng(s)), { fit: 'regular', unevenNeck: NECKS.lowRight, fitting: { lowShoulder: { side, cm: 1.2 } } }), `${side} ${s}`));
    expect(bad).toEqual([]);
  });

  it('works with a shaped hem below the waist', () => {
    const ramp = (c: number) => Array.from({ length: HEM_SAMPLES }, (_, i) => c * (1 - i / (HEM_SAMPLES - 1)));
    const d = draftBodice(randomBody(rng(5)), { length: 'hip', unevenNeck: NECKS.asymV, hem: { front: ramp(5), back: ramp(0) } });
    expect(d.hem).toBeDefined();
    expect(problems(d, 'hem')).toEqual([]);
  });

  it('allows no princess seams, moved dart, collar or button front', () => {
    const c = validDetails({ ...DEFAULT_BODICE, unevenNeck: NECKS.mixed, princess: 'shoulder', collar: 'mandarin', closure: 'front_buttons', bustDart: 'shoulder' });
    expect(c).toMatchObject({ princess: 'none', collar: 'none', closure: 'back_zip', bustDart: 'side' });
    const d = draftBodice(randomBody(rng(1)), { ...c, princess: 'shoulder', closure: 'front_buttons' });
    expect(d.pieces.some((pc) => /centre front/i.test(pc.name))).toBe(false);
    expect(d.closure).toBe('back_zip');
    expect(describeBodice(c)).toMatch(/uneven-neckline/);
    // A top below the shoulders has no neckline to draw.
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'strapless', unevenNeck: NECKS.mixed }).unevenNeck).toBeUndefined();
  });

  it('gives it a facing cut once, a lining, steps and a flat', () => {
    const d = draftBodice(randomBody(rng(3)), { fit: 'regular', unevenNeck: NECKS.asymV });
    const f = drapeFacings(d);
    const front = f.find((pc) => pc.name === 'Front neck facing')!;
    expect(front.cut).toBe('Cut 1, right side down');
    expect(f.find((pc) => pc.name === 'Back neck facing')!.cut).toBe('Cut 2 (1 pair)');
    expect(f.some((pc) => pc.name === 'Front armhole facing')).toBe(true);
    const lined = drapeLined(d.pieces, d);
    expect(lined.find((pc) => pc.name === 'Bodice front lining')?.cut).toBe('Cut 1, right side down');
    for (const edges of ['binding', 'facings', 'lined'] as const) {
      const g = bodiceGuide(d, { length: 'waist' } as never, 1.5, 1, { edges });
      const cut = g.steps.find((s) => s.title === 'Cut out')!.text;
      expect(cut).toMatch(/single layer/);
      expect(cut).toMatch(/Place the bodice back on both layers/);
      expect(cut).not.toMatch(/front on the fold/);
    }
    // The flat front shows the neckline lower on the side it was drawn.
    const view = bodiceFlat(d).views[0];
    const outline = view.shapes[0];
    const cx = (Math.min(...outline.map((q) => q.x)) + Math.max(...outline.map((q) => q.x))) / 2;
    const lowNeck = outline.filter((q) => q.y < d.front.apex.y).reduce((a, b) => (b.y > a.y ? b : a));
    expect(lowNeck.x).toBeGreaterThan(cx + 1);
  });

  it('goes on a dress', () => {
    const body = { ...randomBody(rng(2)), waist_to_knee: 58, waist_to_floor: 104 };
    const d = draftDress(body, { unevenNeck: NECKS.lowRight }, {});
    expect(d.bodice.drape?.kind).toBe('uneven');
    expect(checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
    const g = dressGuide(d, { silhouette: 'a_line', length: 'knee' }, 2, 1);
    expect(g.steps.find((s) => s.title === 'Cut out')!.text).toMatch(/single layer/);
    expect(dressFlat(d).views.length).toBe(2);
  });
});
