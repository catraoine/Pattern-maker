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
import { patternDesigns, printedPattern, walkDesign } from './patternSweep';
import { formWords } from './menswearWords';
import { GARMENT_DRAFTING } from './garmentDrafts';
import { INITIAL } from './savedWork';
import { DEFAULT_JACKET_CHOICES, MENSWEAR_JACKET_CHOICES, MENSWEAR_TROUSERS_CHOICES } from './garments';

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

describe('the menswear fit audit (Nov 22)', () => {
  const front = (v: MeasurementValues) => withEstimates(v, 'menswear').front_hps_to_waist! - v.nape_to_waist!;

  it('gives a fuller man more front length, so the front hem hangs level over the stomach', () => {
    // The toiles rode up at the front on a 116 cm chest with the same front length on every size.
    expect(front(MAN)).toBeCloseTo(2.7, 5);
    expect(front({ ...MAN, full_bust: 96, waist: 78 })).toBeCloseTo(1.9, 5);
    expect(front({ ...MAN, full_bust: 116, waist: 104 })).toBeCloseTo(6.3, 5);
    // A big chest on a small waist stands forward too.
    expect(front({ ...MAN, full_bust: 110, waist: 82 })).toBeGreaterThan(front({ ...MAN, full_bust: 96, waist: 82 }));
    // Never more than 8 cm on top of the 1.5, however full.
    expect(front({ ...MAN, full_bust: 150, waist: 160 })).toBeCloseTo(9.5, 5);
    // A front length the maker measured is kept as it is, and the womenswear form's estimate is as it was.
    expect(withEstimates({ ...MAN, waist: 110, front_hps_to_waist: 47 }, 'menswear').front_hps_to_waist).toBe(47);
    expect(withEstimates({ ...MAN, waist: 110 }).front_hps_to_waist).toBe(withEstimates({ ...MAN, waist: 90 }).front_hps_to_waist);
  });

  it('leaves the extra front length at the centre front hem, the side seams still matching', () => {
    const draft = (waist: number) => draftBodice(withEstimates({ ...MAN, full_bust: waist + 12, waist }, 'menswear') as BodiceMeasurements, { fit: 'regular', neckline: 'crew', length: 'hip', darts: 'none', fitting: { flatFront: true } });
    for (const waist of [74, 104, 130]) expect(failing(draft(waist).pieces)).toEqual([]);
  });

  it('cuts a shirt sleeve wide and flat, with no more than 1 cm of crown ease, where the womenswear form keeps its own', () => {
    // The blouse's tall head, eased 2.5 cm, stood up in peaks at the shoulder tips on the toiles.
    const values = withEstimates({ ...MAN, ...ARMS }, 'menswear');
    const saved = { ...INITIAL, bodice: { ...INITIAL.bodice, sleeve: 'long' as const } };
    const sleeve = (form: 'menswear' | 'womenswear') => GARMENT_DRAFTING.bodice.draft(values, { saved, form }, undefined).sleeve!;
    const crown = (form: 'menswear' | 'womenswear') => sleeve(form).crownEase.front + sleeve(form).crownEase.back;
    expect(sleeve('menswear').bicep).toBeCloseTo(sleeve('womenswear').bicep + 4.5, 1);
    expect(sleeve('menswear').capHeight).toBeLessThan(sleeve('womenswear').capHeight - 2);
    expect(crown('menswear')).toBeGreaterThan(0.5);
    expect(crown('menswear')).toBeLessThanOrEqual(1.1);
    expect(crown('womenswear')).toBeGreaterThan(2);
  });

  it('says chest, never bust, on the printed shirt and jacket, and leaves the womenswear pattern as it was', () => {
    const values = withEstimates({ ...MAN, ...ARMS }, 'menswear');
    const words = (p: ReturnType<typeof printedPattern>['made']) =>
      [...p.notes, ...p.guide.notions, ...p.guide.steps.flatMap((st) => [st.title, st.text]), ...p.spec.map((r) => r.label), ...p.pieces.flatMap((pc) => [...(pc.finished ?? []).flatMap((f) => [f.title, f.note]), ...(pc.draft?.points ?? []).map((pt) => pt.note)])].join(' ');
    for (const design of [{ garment: 'bodice' as const, saved: { bodice: { ...INITIAL.bodice, sleeve: 'long' as const } } }, { garment: 'jacket' as const, saved: {} }]) {
      const { made } = printedPattern(design, values, 'menswear');
      expect(words(made)).toMatch(/bust/i);
      const his = formWords(made, 'menswear');
      expect(words(his)).not.toMatch(/bust/i);
      expect(words(his)).toMatch(/FINISHED CHEST \d+ CM/);
      expect(his.spec.map((r) => r.label)).toContain('Chest');
      expect(formWords(made, 'womenswear')).toBe(made);
    }
  });
});

describe('menswear tailoring (Nov 22, In testing)', () => {
  it('cuts the trouser front flat and darts the back, every seam still matching, and leaves the womenswear cut alone', () => {
    const r = rng(11);
    let backDarts = 0;
    for (let i = 0; i < 30; i++) {
      const m = randomMan(r) as TrousersMeasurements;
      for (const style of [{ fit: 'regular' as const, leg: 'straight' as const }, { fit: 'regular' as const, leg: 'straight' as const, pockets: 'slant' as const, backPockets: 'welt' as const, loops: 'loops' as const }]) {
        const men = draftTrousers(m, { ...style, cut: 'menswear' });
        expect(men.dartsPerSide.front).toBe(0);
        expect(failing(men.pieces).filter((c) => c.label !== 'Crotch seam to your crotch length')).toEqual([]);
        backDarts += men.dartsPerSide.back;
        // The waist is the same size: what the front dart took is in the back's now.
        expect(men.finishedWaist).toBeCloseTo(draftTrousers(m, style).finishedWaist, 5);
      }
      // A pleated front keeps its dart, which goes into the pleat.
      expect(failing(draftTrousers(m, { fit: 'regular', leg: 'straight', pleats: 'single', cut: 'menswear' }).pieces).filter((c) => c.label !== 'Crotch seam to your crotch length')).toEqual([]);
    }
    expect(backDarts).toBeGreaterThan(20);
    expect(draftTrousers(EXAMPLE_BODY as TrousersMeasurements, { fit: 'regular', leg: 'straight' }).dartsPerSide.front).toBe(1);
    expect(MENSWEAR_TROUSERS_CHOICES).toMatchObject({ pockets: 'slant', backPockets: 'welt', loops: 'loops' });
  });

  it('gives a single-breasted jacket two buttons with the lapel breaking near the waist, on the menswear form only', () => {
    const m = withEstimates({ ...MAN, ...ARMS }, 'menswear') as OuterMeasurements;
    const his = draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket', fitting: { flatFront: true } });
    const hers = draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket' });
    expect(his.buttons.at).toHaveLength(2);
    expect(his.buttons.at[1] - his.buttons.at[0]).toBeCloseTo(11, 1);
    expect(hers.buttons.at.length).toBeGreaterThan(3);
    // The lapel rolls to the top button, well below where it broke at the chest.
    expect(his.lapel!.breakPt.y).toBeCloseTo(his.buttons.at[0], 1);
    expect(his.lapel!.breakPt.y).toBeGreaterThan(hers.lapel!.breakPt.y + 10);
    expect(failing(his.pieces).filter((c) => !/shoulder seams/.test(c.label))).toEqual([]);
    // A lapel that long needs the whole front fused and its roll line taped (it creased and fell open in CLO without).
    const steps = (d: typeof his) => outerGuide(d, 2);
    expect(steps(his).steps.find((st) => st.title === 'Interface')!.text).toMatch(/whole of each front.*stay tape along each roll line/);
    expect(steps(his).notions.join(' ')).toMatch(/stay tape, for the roll lines/);
    expect(steps(hers).steps.find((st) => st.title === 'Interface')!.text).not.toMatch(/roll line/);
    // A double-breasted front, a coat and a look with its own buttons keep theirs.
    expect(draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket', buttons: 4, fitting: { flatFront: true } }).buttons.at).toHaveLength(4);
    expect(draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket', front: 'double', fitting: { flatFront: true } }).buttons).toEqual(draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket', front: 'double' }).buttons);
  });
});

describe('the menswear small points (Nov 22, In testing)', () => {
  const values = withEstimates({ ...MAN, ...ARMS }, 'menswear');
  const saved = { ...INITIAL, bodice: { ...INITIAL.bodice, sleeve: 'long' as const, sleeveShape: 'straight' as const, sleeveCuff: 'shirt' as const, closure: 'front_buttons' as const, collar: 'shirt' as const } };
  const shirt = (form: 'menswear' | 'womenswear') => GARMENT_DRAFTING.bodice.draft(values, { saved, form }, undefined);

  it('gives a shirt 3 cm more room than a blouse of the same fit and a neck 0.9 cm closer, every seam matching', () => {
    const his = shirt('menswear').bodice!;
    const hers = shirt('womenswear').bodice!;
    expect(his.finishedBust).toBeCloseTo(hers.finishedBust + 3, 1);
    expect(his.neck).toBeCloseTo(hers.neck - 0.9, 1);
    expect(failing(his.pieces)).toEqual([]);
    // With no collar to button, the neck is the block's own.
    const open = (form: 'menswear' | 'womenswear') => GARMENT_DRAFTING.bodice.draft(values, { saved: { ...saved, bodice: { ...saved.bodice, closure: INITIAL.bodice.closure, collar: 'none' as const } }, form }, undefined).bodice!.neck;
    expect(open('menswear')).toBeCloseTo(open('womenswear'), 1);
  });

  it('pleats the sleeve into its cuff, the hem tapered to the cuff and 6 cm, where a blouse is gathered', () => {
    const his = shirt('menswear').sleeve!;
    const hers = shirt('womenswear').sleeve!;
    expect(his.pleated).toBe(true);
    expect(his.gathers!.hem).toBeCloseTo(6, 0);
    expect(hers.pleated).toBeUndefined();
    const label = (sl: typeof his) => sl.pieces[0].labels.map((l) => l.text).join(' ');
    expect(label(his)).toMatch(/PLEAT TO FIT THE CUFF/);
    expect(label(hers)).toMatch(/GATHER TO FIT THE CUFF/);
    // A bishop sleeve keeps its fullness, gathered.
    const bishop = GARMENT_DRAFTING.bodice.draft(values, { saved: { ...saved, bodice: { ...saved.bodice, sleeveShape: 'bishop' as const } }, form: 'menswear' }, undefined).sleeve!;
    expect(bishop.pleated).toBeUndefined();
    expect(bishop.gathers!.hem).toBeGreaterThan(10);
  });

  it('stops a jacket sleeve 1.5 cm sooner, so the shirt cuff shows, on the menswear form only', () => {
    const m = values as OuterMeasurements;
    const his = draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket', fitting: { flatFront: true } });
    const hers = draftOuter(m, { ...MENSWEAR_JACKET_CHOICES, kind: 'jacket' });
    expect(his.sleeve!.lengthCm).toBeCloseTo(hers.sleeve!.lengthCm - 1.5, 1);
    // A coat is worn over the jacket, so its sleeve stays long.
    const coat = (fitting?: { flatFront: boolean }) => draftOuter({ ...m, waist_to_knee: 58 }, { ...MENSWEAR_JACKET_CHOICES, kind: 'coat', ...(fitting ? { fitting } : {}) }).sleeve!.lengthCm;
    expect(coat({ flatFront: true })).toBe(coat());
  });
});
