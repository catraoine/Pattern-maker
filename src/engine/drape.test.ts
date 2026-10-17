import { describe, expect, it } from 'vitest';
import { BodiceDraft, BodiceStyle, draftBodice } from './bodice';
import { draftDress } from './dress';
import { COWL_FACING, GATHER, drapeFacings, drapeLined } from './drape';
import { P, taggedLength } from './geometry';
import { bodiceGuide, dressGuide } from './instructions';
import { toCouture } from './couture';
import { bodiceFlat, dressFlat } from './flat';
import { layPlan, layPlans } from './layplan';
import type { Piece } from './piece';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { DraftError } from './skirt';
import { bodiceSpec } from './spec';
import { DARTS_FOR_FIT, DEFAULT_BODICE, describeBodice, bodiceDetails, validDetails } from '../garments';
import { bodiceFabrics, checkFabric } from './fabrics';

const garment = (pcs: Piece[]) => pcs.filter((pc) => !pc.kind || pc.kind === 'collar');

function inside(q: P, pts: P[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Everything that should hold for a draped bodice: the seams walk, the darts point inside the piece,
 * the cowl hangs a medium drape, the peplum fits the waist seam, and it lays out on the fabric. */
function problems(d: BodiceDraft, tag: string): string[] {
  const out: string[] = [];
  for (const c of checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })) if (!c.ok) out.push(`${tag} ${c.label}: ${c.detail}`);
  for (const pc of d.pieces) {
    const ring = pc.outline.points(12);
    for (const ln of pc.lines) {
      const q = ln.points();
      if (q.length === 3 && !inside(q[1], ring)) out.push(`${tag} ${pc.name}: a dart point lies outside the piece`);
    }
  }
  if (d.drape?.kind === 'cowl' && !(d.drape.depthCm! >= 8 && d.drape.depthCm! <= 12)) out.push(`${tag} cowl depth ${d.drape.depthCm}`);
  if (d.peplum?.kind === 'gathered') {
    const half = (pc: Piece) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1);
    const bodice = d.pieces.filter((pc) => /^Bodice/.test(pc.name)).reduce((t, pc) => t + half(pc), 0);
    const peplum = d.pieces.filter((pc) => /^Peplum/.test(pc.name)).reduce((t, pc) => t + half(pc), 0);
    if (Math.abs(peplum - GATHER * bodice) > 0.05) out.push(`${tag} gathered peplum ${peplum} for ${bodice}`);
  }
  // A gathered peplum is half as wide again as the waist: on a large body it can be too wide for
  // 115 cm fabric, and the fabric is then estimated instead.
  const widths = d.peplum?.kind === 'gathered' ? ([140, 150] as const) : ([115, 140, 150] as const);
  for (const w of widths) if (!layPlan(d.pieces, w)) out.push(`${tag} does not lay out on ${w} cm fabric`);
  return out;
}

const NECKS = ['one_shoulder', 'cowl'] as const;

describe('draped bodices on random bodies', () => {
  for (const neckline of NECKS)
    it(`drafts the ${neckline.replace('_', '-')} in every fit, length, dart choice and peplum, and it all walks`, () => {
      const bad: string[] = [];
      let n = 0;
      for (let s = 1; s <= 8; s++) {
        const body = randomBody(rng(s));
        for (const fit of ['fitted', 'regular', 'relaxed'] as const)
          for (const darts of DARTS_FOR_FIT[fit])
            for (const length of ['waist', 'high_hip', 'hip'] as const)
              for (const peplum of length === 'waist' ? (['none', 'flared', 'gathered'] as const) : (['none'] as const)) {
                let d: BodiceDraft;
                try {
                  d = draftBodice(body, { neckline, fit, darts, length, peplum });
                } catch (e) {
                  if (e instanceof DraftError) continue;
                  throw e;
                }
                n++;
                bad.push(...problems(d, `${s} ${fit} ${darts} ${length} ${peplum}`));
              }
      }
      expect(n).toBeGreaterThanOrEqual(240);
      expect(bad.slice(0, 8)).toEqual([]);
    });

  it('keeps the one-shoulder front and back as whole pieces, cut once, with the shoulder on the left', () => {
    const d = draftBodice(randomBody(rng(3)), { neckline: 'one_shoulder', fit: 'regular' });
    const [front, back] = d.pieces;
    expect(front.cut).toBe('Cut 1, right side up');
    expect(back.cut).toBe('Cut 1, right side up');
    expect(front.meta.whole).toBe(true);
    // Right side up, the wearer's left is x > 0 on the front and x < 0 on the back.
    const top = (pc: Piece, sign: number) => Math.min(...pc.outline.points().filter((q) => q.x * sign > 2).map((q) => q.y));
    expect(top(front, 1)).toBeLessThan(top(front, -1) - 8);
    expect(top(back, -1)).toBeLessThan(top(back, 1) - 8);
    expect(front.labels.some((l) => l.text === 'LEFT SHOULDER')).toBe(true);
    // One shoulder and one armhole, and a zip in the right side seam.
    expect(front.outline.tags.filter((t) => t === 'shoulder').length).toBeGreaterThan(0);
    expect(d.drape?.zip?.zipCm).toBeGreaterThanOrEqual(d.drape!.zip!.openingCm - 0.5);
    // Drafted close to 1 cm tighter over the bust.
    expect(d.drape!.tightenCm!).toBeGreaterThan(0.5);
    expect(d.drape!.tightenCm!).toBeLessThanOrEqual(1.05);
  });

  it('cuts the cowl front whole on the true bias with its facing grown on', () => {
    const d = draftBodice(randomBody(rng(5)), { neckline: 'cowl', fit: 'regular' });
    const front = d.pieces[0];
    expect(front.cut).toMatch(/bias/);
    const [a, b] = front.grain!;
    expect(Math.abs(Math.abs(Math.atan2(b.y - a.y, b.x - a.x)) - Math.PI / 4)).toBeLessThan(1e-6);
    expect(front.outline.tags).toContain('facing');
    expect(d.drape?.facingCm).toBe(COWL_FACING);
    // Laid out by its grain: the grain runs along the fabric.
    const lay = layPlans(d.pieces, 150)[0];
    expect(lay).toBeDefined();
    expect(front.balance?.some((bl) => bl.label === 'FOLD LINE')).toBe(true);
  });

  it('drafts for a lower shoulder on either side', () => {
    const bad: string[] = [];
    for (const neckline of NECKS)
      for (const side of ['left', 'right'] as const)
        for (let s = 1; s <= 4; s++) {
          const d = draftBodice(randomBody(rng(s)), { neckline, fit: 'regular', fitting: { lowShoulder: { side, cm: 1.2 } } } as Partial<BodiceStyle>);
          bad.push(...problems(d, `${neckline} ${side} ${s}`));
        }
    expect(bad.slice(0, 6)).toEqual([]);
  });

  it('gives each neckline its facings and lining', () => {
    for (const neckline of NECKS) {
      const d = draftBodice(randomBody(rng(2)), { neckline, fit: 'regular' });
      const f = drapeFacings(d, true, true);
      expect(f.length).toBe(neckline === 'cowl' ? 3 : 4);
      for (const pc of f) expect(pc.kind).toBe('facing');
      const lined = drapeLined(d.pieces, d);
      if (neckline === 'cowl') {
        expect(lined.find((pc) => pc.name === 'Bodice front')?.fabric).toBeUndefined();
        expect(lined.some((pc) => pc.name === 'Bodice front lining' && pc.fabric === 'Lining')).toBe(true);
      } else {
        expect(f.every((pc) => pc.cut === 'Cut 1, right side down')).toBe(true);
        expect(lined.filter((pc) => pc.kind === 'lining').every((pc) => pc.cut === 'Cut 1, right side down')).toBe(true);
      }
      expect(layPlans([...lined, ...f], 140).length).toBe(2);
    }
  });
});

describe('the draped dress', () => {
  it('joins each neckline to every skirt, the seams walking and the zip where it goes', () => {
    const bad: string[] = [];
    for (const neckline of NECKS)
      for (const silhouette of ['pencil', 'a_line', 'half_circle'] as const)
        for (let s = 1; s <= 4; s++) {
          const d = draftDress(randomBody(rng(s)), { neckline, fit: 'regular', peplum: 'flared' }, { silhouette, length: 'knee' });
          expect(d.bodice.peplum).toBeUndefined();
          for (const c of checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })) if (!c.ok) bad.push(`${neckline} ${silhouette} ${s} ${c.label}: ${c.detail}`);
          if (neckline === 'one_shoulder') {
            expect(d.zipSide).toBe(true);
            expect(d.zipBelowWaist).toBeGreaterThanOrEqual(12);
            // No zip mark at the centre back of the skirt; one on each side seam.
            const back = d.pieces.find((pc) => pc.name === 'Skirt back')!;
            expect(back.notches.some(([q, dir]) => Math.abs(q.x) < 1e-6 && dir.x < 0)).toBe(false);
          } else expect(d.zipSide).toBeUndefined();
          expect(dressFlat(d).views.length).toBe(2);
          const g = dressGuide(d, { silhouette, length: 'knee' }, 2, 1);
          expect(g.steps.some((st) => st.title === 'Put in the zip')).toBe(true);
          if (neckline === 'one_shoulder') {
            expect(g.steps.some((st) => st.title === 'Close the centre back')).toBe(false);
            expect(g.steps.some((st) => st.title === 'Stay-tape the one-shoulder edge')).toBe(true);
          } else expect(g.steps.some((st) => st.title === 'Fold the cowl facing')).toBe(true);
        }
    expect(bad.slice(0, 6)).toEqual([]);
  });
});

describe('the choices', () => {
  it('falls back to what a draped neckline allows', () => {
    const v = validDetails({ ...DEFAULT_BODICE, neckline: 'one_shoulder', sleeve: 'short', collar: 'peter_pan', princess: 'shoulder', bustDart: 'shoulder', closure: 'front_buttons' });
    expect(v).toMatchObject({ sleeve: 'none', collar: 'none', princess: 'none', bustDart: 'side', closure: 'back_zip' });
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'cowl', sleeve: 'short' }).sleeve).toBe('short');
    expect(validDetails({ ...DEFAULT_BODICE, peplum: 'flared', length: 'hip' }).peplum).toBe('none');
    expect(validDetails({ ...DEFAULT_BODICE, peplum: 'flared' }, 'dress').peplum).toBe('none');
    expect(validDetails({ ...DEFAULT_BODICE, peplum: 'gathered' }).peplum).toBe('gathered');
  });

  it('names them plainly', () => {
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'one_shoulder' })).toBe('waist-length one-shoulder bodice');
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'cowl' })).toBe('waist-length cowl-neck bodice');
    expect(describeBodice({ ...DEFAULT_BODICE, peplum: 'flared' })).toBe('waist-length crew neck bodice with a flared peplum');
    expect(bodiceDetails({ ...DEFAULT_BODICE, neckline: 'one_shoulder', sleeve: 'short' })).toBe('a one-shoulder neckline');
  });

  it('suggests fluid fabrics for a cowl, and warns off crisp ones', () => {
    const a = bodiceFabrics({ fit: 'fitted', neckline: 'cowl' });
    expect(a.picks.every((p) => p.drape === 'fluid')).toBe(true);
    expect(checkFabric({ garment: 'bodice', fit: 'regular', neckline: 'cowl' }, { drape: 'crisp' })[0].level).toBe('warn');
    expect(checkFabric({ garment: 'bodice', fit: 'fitted', neckline: 'cowl' }, { drape: 'fluid', weight: 'light' })[0].level).toBe('ok');
    expect(bodiceFabrics({ fit: 'regular', neckline: 'one_shoulder' }).note).toMatch(/stay-taped/);
  });
});

describe('sewing a draped bodice', () => {
  const body = randomBody(rng(6));
  for (const edges of ['binding', 'facings', 'lined'] as const)
    it(`writes the steps with ${edges}`, () => {
      const os = draftBodice(body, { neckline: 'one_shoulder', fit: 'regular', peplum: 'flared' });
      const g = bodiceGuide(os, { length: 'waist' }, 1.5, 1, { edges });
      const titles = g.steps.map((s) => s.title);
      expect(titles).toContain('Stay-tape the one-shoulder edge');
      expect(titles).toContain('Make the peplum');
      expect(titles).toContain('Attach the peplum');
      expect(titles).not.toContain('Close the centre back');
      expect(titles).not.toContain('Hem');
      expect(titles.filter((t) => t === 'Sew the shoulders').length).toBe(1);
      expect(g.steps.find((s) => s.title === 'Put in the zip')!.text).toMatch(/right side seam/);
      expect(g.notions.some((n) => /stay tape/.test(n))).toBe(true);
      const cw = draftBodice(body, { neckline: 'cowl', fit: 'regular', peplum: 'gathered' });
      const h = bodiceGuide(cw, { length: 'waist' }, 1.5, 1, { edges });
      const ct = h.steps.map((s) => s.title);
      expect(ct).toContain('Stay-stitch the cowl front');
      expect(h.steps.find((s) => s.title === 'Cut out')!.text).toMatch(/true bias/);
      if (edges !== 'lined') expect(ct).toContain('Fold the cowl facing');
      expect(h.steps.find((s) => s.title === 'Attach the peplum')!.text).toMatch(/gathering threads/);
      // No em-dashes or curly quotes, as elsewhere in the steps.
      for (const s of [...g.steps, ...h.steps]) expect(s.text).not.toMatch(/[—‘’“”]/);
      // The couture route still finds its steps.
      const c = toCouture(g, { garment: 'bodice', cloth: 'silk', lined: edges === 'lined', traced: true, zipCm: os.zipCm });
      expect(c.steps.find((s) => s.title === 'Hand-pick the zip')?.text).toMatch(/right side seam allowances/);
    });

  it('draws the one-shoulder flat with one shoulder, and the spec with its zip at the side', () => {
    const d = draftBodice(body, { neckline: 'one_shoulder', fit: 'regular' });
    const [front, back] = bodiceFlat(d).views.map((v) => v.shapes[0]);
    // Each view is placed on the page; split it down its middle.
    const top = (pts: P[], right: boolean) => {
      const mid = (Math.min(...pts.map((q) => q.x)) + Math.max(...pts.map((q) => q.x))) / 2;
      return Math.min(...pts.filter((q) => (q.x > mid) === right).map((q) => q.y));
    };
    // The front view shows the left shoulder on the right; the back view on the left.
    expect(top(front, true)).toBeLessThan(top(front, false) - 8);
    expect(top(back, false)).toBeLessThan(top(back, true) - 8);
    const spec = bodiceSpec(body as never, d, 'waist');
    expect(spec.some((r) => r.label === 'Invisible zip, right side')).toBe(true);
    expect(spec.some((r) => r.label === 'Top edge, front and back')).toBe(true);
  });
});

describe('with the corsetry and the slip skirt', () => {
  it('puts a flared or gathered peplum on a boned or cami top, and it all walks and lays out', () => {
    const bad: string[] = [];
    let n = 0;
    const tops = [
      ['strapless', 'boned'],
      ['sweetheart', 'boned'],
      ['cami', 'boned'],
      ['cami', 'none'],
    ] as const;
    for (const [neckline, structure] of tops)
      for (const peplum of ['flared', 'gathered'] as const)
        for (let s = 1; s <= 6; s++) {
          const fit = structure === 'boned' ? 'fitted' : 'regular';
          const d = draftBodice(randomBody(rng(s)), { neckline, structure, fit, darts: 'bust_waist', length: 'waist', peplum });
          n++;
          expect(d.peplum?.kind).toBe(peplum);
          expect(!!d.top?.boned).toBe(structure === 'boned');
          bad.push(...problems(d, `${neckline} ${structure} ${peplum} ${s}`));
          // The coutil panels keep their coutil when the bodice is lined; the peplum is never lined.
          const lined = drapeLined(d.pieces, d);
          if (structure === 'boned') expect(lined.filter((pc) => /coutil/.test(pc.fabric ?? '')).length).toBe(4);
          expect(lined.some((pc) => /^Peplum.*lining/.test(pc.name))).toBe(false);
        }
    expect(n).toBe(48);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('writes the peplum steps for a boned top', () => {
    const d = draftBodice(randomBody(rng(4)), { neckline: 'strapless', fit: 'fitted', peplum: 'flared' });
    const titles = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges: 'lined' }).steps.map((s) => s.title);
    expect(titles).toContain('Make the peplum');
    expect(titles).toContain('Attach the peplum');
  });

  it('joins a one-shoulder or cowl bodice to the bias slip skirt', () => {
    const bad: string[] = [];
    for (const neckline of NECKS)
      for (let s = 1; s <= 4; s++) {
        const d = draftDress(randomBody(rng(s)), { neckline, fit: 'regular' }, { silhouette: 'slip', length: 'midi' });
        for (const c of checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })) if (!c.ok) bad.push(`${neckline} slip ${s} ${c.label}: ${c.detail}`);
        if (neckline === 'one_shoulder') expect(d.zipSide).toBe(true);
        // Both bias pieces, the cowl front and the slip skirt, lay out on their grain, single layer.
        if (!layPlan(d.pieces, 150)) bad.push(`${neckline} slip ${s} does not lay out on 150 cm`);
        expect(d.pieces.filter((pc) => pc.meta.bias).length).toBeGreaterThanOrEqual(neckline === 'cowl' ? 2 : 1);
        expect(dressGuide(d, { silhouette: 'slip', length: 'midi' }, 2, 1).steps.some((st) => st.title === 'Put in the zip')).toBe(true);
      }
    expect(bad.slice(0, 6)).toEqual([]);
  });

  it('marks the cowl front for the bias on one flag, cut single layer', () => {
    const d = draftBodice(randomBody(rng(5)), { neckline: 'cowl', fit: 'regular' });
    expect(d.pieces[0].meta).toMatchObject({ whole: true, bias: true, singleLayer: true });
    expect(layPlan(d.pieces, 150)?.folded).toBe(false);
  });

  it('falls back consistently between the draped and the top necklines', () => {
    // Boning needs a top below the shoulders: a one-shoulder or cowl falls back to unboned.
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'one_shoulder', structure: 'boned' }).structure).toBe('none');
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'cowl', structure: 'boned' }).structure).toBe('none');
    // A strapless top is always boned, and takes a peplum on a bodice but not on a dress.
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'strapless', peplum: 'flared' })).toMatchObject({ structure: 'boned', peplum: 'flared' });
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'strapless', peplum: 'flared' }, 'dress').peplum).toBe('none');
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'cami', peplum: 'gathered' }).peplum).toBe('gathered');
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'strapless', peplum: 'flared' })).toBe('boned strapless bodice with a flared peplum');
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'cami', peplum: 'gathered' })).toBe('waist-length cami bodice with spaghetti straps and a gathered peplum');
  });
});
