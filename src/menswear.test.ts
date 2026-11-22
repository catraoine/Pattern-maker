import { describe, expect, it } from 'vitest';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY, checkMeasurements, isComplete, type MeasurementValues } from './measurements';
import { extrasFor, fullSetMissing, labelOf, missingFor, stepsOf, tipOf, titleOf } from './measureFlow';
import { draftBodice, type BodiceMeasurements } from './engine/bodice';
import { draftOuter, type OuterMeasurements } from './engine/outerwear';
import { draftTrousers, type TrousersMeasurements } from './engine/trousers';
import { bodiceGuide } from './engine/instructions';
import { bodiceFlat, outerFlat } from './engine/flat';
import { outerGuide } from './engine/outerGuide';
import { checkPattern } from './engine/qc';
import { randomMan, rng } from './engine/randomBodies';
import { patternDesigns, walkDesign } from './patternSweep';
import { DEFAULT_JACKET_CHOICES, MENSWEAR_JACKET_CHOICES } from './garments';

// The menswear form (Cat's B2 Two Forms, 2026-10-18): the chest instead of the bust, none of the bust
// measurements asked, and tops drafted with no bust dart.

/** A man measured with the base set and the bodice's essentials (cm). */
const MAN: MeasurementValues = { full_bust: 100, waist: 86, full_hip: 100, waist_to_floor: 108, shoulder_width: 46, nape_to_waist: 45, waist_to_hip: 21 };
const ARMS: MeasurementValues = { arm_length: 64, upper_arm: 32 };

describe('measuring on the menswear form', () => {
  it('never asks the high bust, bust depth or bust point to bust point', () => {
    const skipped = ['high_bust', 'bust_depth', 'apex_separation'];
    for (const g of ['bodice', 'dress', 'jacket', 'coat', 'tee'] as const) {
      expect(extrasFor(g, 'menswear').map((f) => f.id).filter((id) => skipped.includes(id))).toEqual([]);
    }
    expect(extrasFor('bodice').map((f) => f.id)).toContain('high_bust');
    expect(fullSetMissing({}, 'menswear').map((f) => f.id).filter((id) => skipped.includes(id))).toEqual([]);
  });

  it('is ready for a bodice without them, where the womenswear form still asks the high bust', () => {
    expect(missingFor('bodice', MAN, 'menswear')).toEqual([]);
    expect(isComplete(MAN, 'bodice', 'menswear')).toBe(true);
    expect(checkMeasurements(MAN, 'cm', 'bodice', 'menswear').filter((c) => c.level === 'error')).toEqual([]);
    expect(isComplete(MAN, 'bodice')).toBe(false);
  });

  it('says chest wherever the womenswear form says bust', () => {
    expect(titleOf('full_bust', false, 'menswear')).toBe('Your chest');
    expect(titleOf('full_bust', true, 'menswear')).toBe('Their chest');
    expect(labelOf('full_bust', 'menswear')).toBe('Chest');
    expect(labelOf('full_bust')).toBe('Full bust');
    for (const line of [tipOf('full_bust', false, 'menswear'), tipOf('full_bust', true, 'menswear'), ...stepsOf('full_bust', false, 'menswear')]) {
      expect(line).not.toMatch(/bust/i);
    }
    expect(stepsOf('full_bust', false, 'menswear').join(' ')).toMatch(/chest/);
  });
});

describe('drafting on the menswear form', () => {
  it('estimates with no bust shaping and never changes what was measured', () => {
    const v = withEstimates(MAN, 'menswear');
    expect(v.high_bust).toBe(100);
    for (const [id, x] of Object.entries(MAN)) expect(v[id as keyof MeasurementValues]).toBe(x);
    expect(v.neck).toBeGreaterThan(36);
  });

  it('drafts every bodice style with no bust dart, keeping the waist darts', () => {
    const m = withEstimates(MAN, 'menswear') as BodiceMeasurements;
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      for (const darts of ['bust_waist', 'bust', 'none'] as const) {
        const d = draftBodice(m, { fit, neckline: 'crew', length: 'waist', darts, fitting: { flatFront: true } });
        expect(d.bustDart).toBe(0);
        expect(d.pieces.length).toBeGreaterThan(0);
      }
    }
    expect(draftBodice(m, { fit: 'fitted', neckline: 'crew', length: 'waist', darts: 'bust_waist', fitting: { flatFront: true } }).pieces[0].lines.length).toBeGreaterThan(0);
  });

  it('drafts a jacket and a coat on it', () => {
    const m = withEstimates({ ...MAN, ...ARMS, waist_to_knee: 60 }, 'menswear') as OuterMeasurements;
    for (const kind of ['jacket', 'coat'] as const) {
      const d = draftOuter(m, { kind, fitting: { flatFront: true } });
      expect(d.pieces.length).toBeGreaterThan(3);
    }
  });

  it('starts its jacket Long, over the seat, longer than the shirt-length Hip', () => {
    const m = withEstimates({ ...MAN, ...ARMS, waist_to_knee: 60 }, 'menswear') as OuterMeasurements;
    const back = (c: typeof DEFAULT_JACKET_CHOICES) => {
      const p = draftOuter(m, { ...c, kind: 'jacket', fitting: { flatFront: true } }).pieces.find((pc) => /back/i.test(pc.name) && !pc.kind)!;
      const ys = p.outline.points().map((q) => q.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(MENSWEAR_JACKET_CHOICES.length).toBe('long');
    expect(back(MENSWEAR_JACKET_CHOICES)).toBeGreaterThan(back(DEFAULT_JACKET_CHOICES) + 5);
  });
});

const failing = (pieces: Parameters<typeof checkPattern>[0]) => checkPattern(pieces).filter((c) => !c.ok);

describe('the menswear follow-ups', () => {
  it('cuts princess seams on the menswear form, with every seam matching', () => {
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const m = withEstimates(randomMan(r), 'menswear') as BodiceMeasurements;
      for (const princess of ['shoulder', 'armhole'] as const) {
        const d = draftBodice(m, { fit: 'fitted', neckline: 'crew', length: 'waist', darts: 'bust_waist', princess, fitting: { flatFront: true } });
        expect(d.pieces.map((pc) => pc.name)).toEqual(['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back']);
        expect(failing(d.pieces)).toEqual([]);
      }
    }
  });

  it('keeps the armhole notch on its panel when princess seams start at the armhole, in the printed pattern', () => {
    // The nightly menswear pass (Nov 21) found it 0.6 cm off the side front on a 116 cm chest: the line now starts 2 cm
    // below the notch, as the back's does.
    const r = rng(7);
    const designs = patternDesigns().filter((d) => /princess=armhole/.test(d.key));
    for (let i = 0; i < 60; i++) {
      const values = { ...EXAMPLE_BODY, ...withEstimates(randomMan(r), 'menswear') };
      for (const d of designs) expect(walkDesign(d, values, 'menswear').problems, `${d.key}, body ${i + 1}`).toEqual([]);
    }
  });

  it('drafts menswear trousers with more of the crotch at the front, every seam matching', () => {
    const r = rng(5);
    // A very long crotch on slim hips can't be reached within a sensible fork on either block (it is drafted
    // as near as it goes and flagged); the menswear block reaches it at least as often.
    let short = { men: 0, women: 0 };
    for (let i = 0; i < 30; i++) {
      const m = randomMan(r) as TrousersMeasurements;
      const men = draftTrousers(m, { fit: 'regular', leg: 'straight', cut: 'menswear' });
      const women = draftTrousers(m, { fit: 'regular', leg: 'straight' });
      expect(failing(men.pieces).filter((c) => c.label !== 'Crotch seam to your crotch length')).toEqual([]);
      short = { men: short.men + Number(men.crotchCapped), women: short.women + Number(women.crotchCapped) };
      expect(men.crotch.front / (men.crotch.front + men.crotch.back)).toBeGreaterThan(women.crotch.front / (women.crotch.front + women.crotch.back));
    }
    expect(short.men).toBeLessThanOrEqual(short.women);
  });

  it('buttons menswear left over right, in the steps and the drawing', () => {
    const m = withEstimates({ ...MAN, ...ARMS }, 'menswear') as BodiceMeasurements & OuterMeasurements;
    const shirt = { fit: 'regular' as const, neckline: 'crew' as const, length: 'hip' as const, darts: 'bust_waist' as const, closure: 'front_buttons' as const, collar: 'shirt' as const };
    const his = draftBodice(m, { ...shirt, fitting: { flatFront: true } });
    const hers = draftBodice(m, shirt);
    expect(his.lapsLeft).toBe(true);
    expect(hers.lapsLeft).toBeUndefined();
    const text = (d: typeof his) => bodiceGuide(d, { length: 'hip' }, 2, 1).steps.map((st) => st.text).join(' ');
    expect(text(his)).toMatch(/buttonholes on the left front/);
    expect(text(his)).toMatch(/Lap the left front over the right/);
    expect(text(hers)).toMatch(/buttonholes on the right front/);
    // The lapped edge drawn on the flat moves to the other side.
    const edge = (d: typeof his) => {
      const v = bodiceFlat(d).views[0];
      const l = v.lines.find((x) => x.kind === 'seam' && x.pts.length === 2 && Math.abs(x.pts[0].x - x.pts[1].x) < 1e-6 && Math.abs(Math.abs(x.pts[0].x - v.at.x) - 1.5) < 0.01);
      return l && Math.sign(l.pts[0].x - v.at.x);
    };
    expect(edge(his)).toBe(1);
    expect(edge(hers)).toBe(-1);

    const jacket = draftOuter(m, { kind: 'jacket', fitting: { flatFront: true } });
    expect(outerGuide(jacket, 2).steps.map((st) => st.text).join(' ')).toMatch(/buttonholes on the left front/);
    const plain = draftOuter(m, { kind: 'jacket' });
    // The front on top (drawn last) sits on the other side of the centre.
    const topSide = (d: typeof jacket) => {
      const v = outerFlat(d).views[0];
      const top = v.shapes[v.shapes.length - 1];
      return Math.sign(top.reduce((a, q) => a + q.x, 0) / top.length - v.at.x);
    };
    expect(topSide(jacket)).toBe(-topSide(plain));
  });
});
