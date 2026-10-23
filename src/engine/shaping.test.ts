import { describe, expect, it } from 'vitest';
import { blockOf, draftBodice } from './bodice';
import type { BodiceStyle } from './bodice';
import { randomBody, rng } from './randomBodies';
import { checkPattern } from './qc';
import { dartsOf } from './marks';
import { len, sub, taggedLength } from './geometry';
import { bodiceGuide } from './instructions';
import { toCouture } from './couture';
import { bodiceFlat } from './flat';
import { draftDress } from './dress';
import { DraftError } from './skirt';
import { layout } from './export';
import { toTiledPdf } from './pdf';

const garment = (pcs: ReturnType<typeof draftBodice>['pieces']) => pcs.filter((pc) => !pc.kind || pc.kind === 'collar');
const fails = (style: Partial<BodiceStyle>, seeds: number, lengths: BodiceStyle['length'][] = ['waist', 'hip']) => {
  const out: string[] = [];
  for (let s = 1; s <= seeds; s++)
    for (const length of lengths) {
      let d;
      try {
        d = draftBodice(randomBody(rng(s)), { fit: 'regular', length, ...style });
      } catch (e) {
        if (e instanceof DraftError) continue;
        throw e;
      }
      for (const c of checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })) if (!c.ok) out.push(`${s} ${length} ${c.label}: ${c.detail}`);
    }
  return out.slice(0, 5);
};

describe('moving the bust dart', () => {
  for (const to of ['french', 'shoulder', 'neck', 'armhole', 'waist'] as const)
    it(`moves it to the ${to} and every seam still walks, for 40 random bodies`, () => {
      expect(fails({ bustDart: to }, 40, to === 'waist' ? ['waist'] : ['waist', 'hip'])).toEqual([]);
    });

  it('keeps the dart the same size and the side seam the back side seam length', () => {
    const b = randomBody(rng(4));
    const block = draftBodice(b, { fit: 'regular' });
    const d = draftBodice(b, { fit: 'regular', bustDart: 'shoulder' });
    const [front] = d.pieces;
    expect(d.block).toBeDefined();
    expect(blockOf(d)[0]).toBe(block.pieces[0].name === 'Bodice front' ? d.block![0] : undefined);
    const dart = dartsOf(front).find((x) => Math.abs(x.far.y - x.near.y) < Math.abs(x.far.x - x.near.x) + 5 && x.near.y < 10)!;
    expect(dart).toBeDefined();
    // The opening sits on the shoulder, and the side seam lost its dart.
    expect(taggedLength(front.outline, 'side')).toBeCloseTo(taggedLength(d.pieces[1].outline, 'side'), 1);
    expect(taggedLength(front.outline, 'shoulder')).toBeCloseTo(taggedLength(block.pieces[0].outline, 'shoulder'), 1);
    expect(taggedLength(front.outline, 'armhole')).toBeCloseTo(taggedLength(block.pieces[0].outline, 'armhole'), 1);
    expect(front.draft!.points.some((pt) => pt.n === 'M' && /shoulder/.test(pt.note))).toBe(true);
  });

  it('merges into the waist dart, leaving one dart', () => {
    const d = draftBodice(randomBody(rng(9)), { fit: 'regular', bustDart: 'waist' });
    expect(dartsOf(d.pieces[0])).toHaveLength(1);
  });
});

describe('princess seams', () => {
  for (const line of ['shoulder', 'armhole'] as const)
    it(`from the ${line}: four panels whose seams walk, for 40 random bodies`, () => {
      expect(fails({ princess: line }, 40)).toEqual([]);
      const d = draftBodice(randomBody(rng(3)), { fit: 'fitted', princess: line });
      expect(d.pieces.map((pc) => pc.name)).toEqual(['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back']);
      const checks = checkPattern(d.pieces, { finishedWaist: d.finishedWaist });
      expect(checks.filter((c) => /princess seams/.test(c.label))).toHaveLength(2);
      expect(d.pieces.every((pc) => dartsOf(pc).length === 0)).toBe(true);
    });

  for (const line of ['shoulder', 'armhole'] as const)
    it(`from the ${line}, drawn anywhere along it: the seams still walk`, () => {
      for (const lineAt of [0.1, 0.25, 0.4, 0.75, 0.95]) expect(fails({ princess: line, lineAt }, 8, ['waist'])).toEqual([]);
    });

  it('carries on into the dress, the skirt darts under the seams', () => {
    for (let s = 1; s <= 20; s++) {
      const d = draftDress(randomBody(rng(s)), { fit: 'regular', princess: 'shoulder', collar: 'mandarin' }, { silhouette: 'a_line', length: 'knee' });
      const bad = checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
      expect(bad.map((c) => `${s} ${c.label} ${c.detail}`)).toEqual([]);
    }
  });
});

describe('collars and a button front', () => {
  const combos: Partial<BodiceStyle>[] = [
    { collar: 'peter_pan' },
    { collar: 'mandarin' },
    { collar: 'peter_pan', closure: 'front_buttons' },
    { collar: 'mandarin', closure: 'front_buttons' },
    { collar: 'mock' },
    { collar: 'funnel' },
    { collar: 'mock', closure: 'front_buttons' },
    { collar: 'shirt', closure: 'front_buttons' },
    { collar: 'shirt', closure: 'front_buttons', princess: 'armhole' },
    { closure: 'front_buttons', bustDart: 'neck' },
  ];
  for (const st of combos)
    it(`${JSON.stringify(st)}: the collar fits the neckline, for 30 random bodies`, () => {
      expect(fails(st, 30)).toEqual([]);
      const d = draftBodice(randomBody(rng(2)), { fit: 'regular', ...st });
      const labels = checkPattern(garment(d.pieces)).map((c) => c.label);
      if (st.collar) expect(labels.some((l) => /to neckline/.test(l))).toBe(true);
      if (st.collar === 'shirt') expect(labels).toContain('Collar to stand');
    });

  it('a button front: an extension and buttonholes, facings, the back on the fold, no zip', () => {
    const d = draftBodice(randomBody(rng(6)), { fit: 'regular', closure: 'front_buttons' });
    const [front, back] = d.pieces;
    expect(front.fold).toBeUndefined();
    expect(front.cut).toBe('Cut 2 (1 pair)');
    expect(taggedLength(front.outline, 'opening')).toBeGreaterThan(10);
    expect(back.fold).toBeDefined();
    expect(back.labels.some((l) => l.text === 'ZIP ENDS')).toBe(false);
    expect(d.pieces.map((pc) => pc.name)).toEqual(expect.arrayContaining(['Front facing', 'Back neck facing']));
    expect(d.buttons!.count).toBeGreaterThanOrEqual(3);
    expect(front.lines.filter((l) => l.points().length === 2 && Math.abs(l.points()[0].x + 0.3) < 1e-6)).toHaveLength(d.buttons!.count);
  });

  it('no collar on a V-neck', () => {
    const d = draftBodice(randomBody(rng(6)), { fit: 'regular', neckline: 'v', collar: 'mandarin' });
    expect(d.collar).toBe('none');
  });
});

describe('steps, flat and print for the styled bodice', () => {
  it('writes plain steps for every finish, with no zip on a button front', () => {
    const b = randomBody(rng(5));
    for (const edges of ['binding', 'facings', 'lined'] as const)
      for (const st of [{ princess: 'shoulder' }, { bustDart: 'neck' }, { collar: 'peter_pan' }, { collar: 'mandarin' }, { collar: 'mock' }, { collar: 'funnel' }, { collar: 'shirt', closure: 'front_buttons' }, { closure: 'front_buttons' }] as Partial<BodiceStyle>[]) {
        const d = draftBodice(b, { fit: 'regular', ...st });
        const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges });
        const t = g.steps.map((s) => s.title);
        expect(new Set(t).size).toBe(t.length);
        expect(g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text))).toEqual([]);
        if (st.closure) {
          expect(g.steps.filter((s) => /zip/i.test(s.title + s.text)).map((s) => s.title)).toEqual([]);
          expect(t).toContain('Make the buttonholes');
          expect(g.notions.some((n) => /buttons/.test(n))).toBe(true);
        }
        if (st.princess) expect(t).toContain('Sew the princess seams');
        if (st.collar) expect(t).toContain('Make the collar');
        const c = toCouture(g, { garment: 'bodice', cloth: 'wool', lined: edges === 'lined', traced: true, zipCm: d.zipCm });
        expect(c.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text))).toEqual([]);
      }
  });

  it('draws the princess lines, the collar and the buttons on the flat', () => {
    const d = draftBodice(randomBody(rng(8)), { fit: 'regular', princess: 'shoulder', closure: 'front_buttons', collar: 'shirt' });
    const f = bodiceFlat(d, 'binding');
    const [front, back] = f.views;
    expect(front.shapes.length).toBeGreaterThan(1);
    expect(front.lines.filter((l) => l.kind === 'seam' && l.pts.length > 3).length).toBeGreaterThanOrEqual(2);
    expect(back.lines.some((l) => l.kind === 'zip')).toBe(false);
    expect(f.views.flatMap((v) => v.shapes.flat()).every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
    // The moved shaping never changes the garment: the flat is drawn from the block.
    const plain = bodiceFlat(draftBodice(randomBody(rng(8)), { fit: 'regular' })).views[0].shapes[0];
    const size = (pts: { x: number; y: number }[]) => [Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y))];
    expect(len(sub({ x: size(front.shapes[0])[0], y: size(front.shapes[0])[1] }, { x: size(plain)[0], y: size(plain)[1] }))).toBeLessThan(1e-6);
  });

  it('adds the draft-it-by-hand pages to the PDF', async () => {
    const d = draftBodice(randomBody(rng(7)), { fit: 'regular', bustDart: 'shoulder' });
    const sheet = layout(d.pieces, 'Bodice', []);
    const plain = await toTiledPdf(sheet, 'a4', { title: 'bodice', summary: { rows: [], checks: [] } });
    const byHand = d.pieces.map((pc) => ({ piece: pc.name, frame: pc.draft!.frame, outline: pc.outline.points(8), lines: pc.lines.map((l) => l.points(4)), points: pc.draft!.points }));
    const hand = await toTiledPdf(sheet, 'a4', { title: 'bodice', summary: { rows: [], checks: [], byHand } });
    expect(hand.length).toBeGreaterThan(plain.length);
  });
});
