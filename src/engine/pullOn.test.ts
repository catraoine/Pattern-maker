import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { bodiceGuide } from './instructions';
import { bodiceFlat } from './flat';
import { checkPattern } from './qc';
import { yokesJoined } from './seams';
import { taggedLength } from './geometry';
import { lookFlat, COLLECTION } from '../collection';
import { EXAMPLE_BODY } from '../measurements';
import { DEFAULT_BODICE } from '../garments';
import type { BodiceChoices } from '../garments';

// A top that pulls on over the head, with straight sides (the Lilac Lace Blouse; Cat, 2026-11-11, on taking it "to a
// 10": no darts, no zip, no waist curve in a sheer lace that shows all three).
const SA = { seamAllowance: 1.5, neckArmholeAllowance: 1, hemAllowance: 3 };
const blouse = (more: Partial<BodiceChoices> = {}) => ({ ...DEFAULT_BODICE, fit: 'relaxed', bustEase: 20, darts: 'none', sides: 'straight', pullOn: true, neckline: 'plunge', plungeDepth: 'waist', sleeve: 'none', length: 'hip', ...more, ...SA }) as never;
const back = (d: ReturnType<typeof draftBodice>) => d.pieces.find((pc) => /^Bodice back/.test(pc.name))!;

describe('a top that pulls on', () => {
  it('has no zip, and its back is cut on the fold', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse());
    expect(d.pullOn).toBe(true);
    expect(d.zipCm).toBe(0);
    expect(back(d).cut).toBe('Cut 1 on fold');
    expect(back(d).fold).toBeDefined();
    expect(back(d).labels.some((l) => l.text === 'ZIP ENDS')).toBe(false);
  });

  it('keeps its zip where it could not go on: a high neck, or a waist the bust would not pass', () => {
    const crew = draftBodice(EXAMPLE_BODY as never, blouse({ neckline: 'crew' }));
    expect(crew.pullOn).toBeUndefined();
    expect(crew.zipCm).toBeGreaterThan(0);
    expect(back(crew).cut).toBe('Cut 2 (1 pair)');
    const fitted = draftBodice(EXAMPLE_BODY as never, blouse({ fit: 'fitted', bustEase: undefined, sides: undefined, darts: 'bust_waist' }));
    expect(fitted.pullOn).toBeUndefined();
    expect(fitted.zipCm).toBeGreaterThan(0);
  });

  it('leaves the opening to buttons or a wrap where there is one', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ closure: 'wrap', neckline: 'v', length: 'waist' }));
    expect(d.pullOn).toBeUndefined();
    expect(d.wrap).toBeDefined();
  });

  it('is sewn with no zip steps, and asks for no zip', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse());
    const g = bodiceGuide(d, { length: 'hip' }, 1.5, 2);
    expect(g.steps.map((s) => s.title)).not.toContain('Put in the zip');
    expect(g.steps.map((s) => s.title)).not.toContain('Close the centre back');
    const all = [...g.notions, ...g.steps.map((s) => s.text)].join(' ');
    expect(all).not.toMatch(/zip|hook and eye|centre back edges/i);
    expect(all).toMatch(/bodice back on the fold/);
  });
});

describe('straight sides', () => {
  it('fall from the bust to the waist with no shaping', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse());
    expect(d.finishedWaist).toBeGreaterThanOrEqual(d.finishedBust - 0.5);
    const shaped = draftBodice(EXAMPLE_BODY as never, blouse({ sides: undefined, pullOn: false }));
    expect(shaped.finishedWaist).toBeLessThan(shaped.finishedBust - 5);
  });
});

describe('the Lilac Lace Blouse', () => {
  it('draws with no zip or seam down its back', () => {
    const f = lookFlat(COLLECTION.find((l) => l.id === 'lilac-lace')!, EXAMPLE_BODY as never)!;
    const backView = f.views.find((v) => /back/i.test(v.label))!;
    expect(backView.lines.some((l) => l.kind === 'zip')).toBe(false);
    expect(backView.lines.some((l) => l.kind === 'seam' && l.pts.every((q) => Math.abs(q.x - backView.at.x) < 0.01))).toBe(false);
  });
});

describe('a shoulder panel on a plunge', () => {
  it('is cut from the edge of the V to the armhole, a pair, with the front below it still on the fold', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { front: 12, back: 10 } }));
    const names = d.pieces.map((pc) => `${pc.name}: ${pc.cut}`);
    expect(names).toContain('Bodice front yoke: Cut 2 (1 pair)');
    expect(names).toContain('Bodice front: Cut 1 on fold');
    expect(names).toContain('Bodice back yoke: Cut 1 on fold');
    expect(d.warnings).toEqual([]);
    const seam = d.styleSeams!.find((s) => s.side === 'front')!.pts;
    // The seam starts on the V's edge, clear of the centre front, and is level.
    expect(seam[0].x).toBeGreaterThan(2);
    expect(seam[seam.length - 1].y).toBeCloseTo(seam[0].y, 5);
  });

  it('slants from just under the shoulder tip down to the edge of the V, no lower than the bust point', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { front: 0, back: 10, frontSlant: 13 } }));
    const seam = d.styleSeams!.find((s) => s.side === 'front')!.pts;
    const [a, b] = [seam[0], seam[seam.length - 1]];
    expect(a.y - b.y).toBeGreaterThan(13);
    expect(a.x).toBeLessThan(b.x - 8);
    // However steep it is asked for, its point stays on the V's edge and the panel is still cut.
    const steep = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { front: 0, back: 10, frontSlant: 80 } }));
    expect(steep.pieces.map((pc) => pc.name)).toContain('Bodice front yoke');
    expect(steep.warnings).toEqual([]);
    // A darted front keeps a level seam: the slant would cross the dart.
    const darted = draftBodice(EXAMPLE_BODY as never, blouse({ fit: 'fitted', bustEase: undefined, sides: undefined, pullOn: false, darts: 'bust', neckline: 'crew', yoke: { front: 8, frontSlant: 13 } }));
    const ds = darted.styleSeams?.find((s) => s.side === 'front')?.pts;
    if (ds) expect(ds[ds.length - 1].y).toBeCloseTo(ds[0].y, 5);
  });

  it('takes a trim over its seams and along the V: enough to buy, a step after the neckline, a band on the flat', () => {
    const plain = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { front: 0, back: 10, frontSlant: 13 } }));
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { front: 0, back: 10, frontSlant: 13, trim: true } }));
    expect(plain.panelTrim).toBeUndefined();
    const seam = d.styleSeams!.find((s) => s.side === 'front')!.pts;
    const seamLen = Math.hypot(seam[seam.length - 1].x - seam[0].x, seam[seam.length - 1].y - seam[0].y);
    expect(d.panelTrim!.cm).toBeGreaterThan(2 * seamLen + 60);
    expect(d.panelTrim!.cm).toBeLessThan(200);
    const g = bodiceGuide(d, { length: 'hip' }, 1.5, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles.indexOf('Sew on the trim')).toBe(titles.indexOf('Bind the neckline') + 1);
    expect(g.notions.join(' ')).toMatch(/narrow trim or beaded braid/);
    const lines = (x: typeof d) => bodiceFlat(x).views[0].lines.filter((l) => l.kind === 'seam').length;
    expect(lines(d)).toBe(lines(plain) + 4);
    // A yoke right across a high neck has no V to trim.
    const crew = draftBodice(EXAMPLE_BODY as never, blouse({ neckline: 'crew', pullOn: false, yoke: { front: 8, trim: true } }));
    expect(crew.panelTrim).toBeUndefined();
  });

  it('gathers the front into its panels: a wider front, the same armhole, side and neck, and the seams still match', () => {
    const yoke = { front: 0, back: 10, frontSlant: 13 };
    const plain = draftBodice(EXAMPLE_BODY as never, blouse({ yoke, hemTie: 'drawstring' }));
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { ...yoke, frontGather: 4 }, hemTie: 'drawstring' }));
    const [f0, f1] = [plain.pieces[0], d.pieces[0]];
    for (const tag of ['armhole', 'side', 'neck']) expect(taggedLength(f1.outline, tag)).toBeCloseTo(taggedLength(f0.outline, tag), 5);
    // (The hem is not quite level, so it grows by a hair under 4 cm.)
    expect(taggedLength(f1.outline, 'hem')).toBeCloseTo(taggedLength(f0.outline, 'hem') + 4, 2);
    expect(taggedLength(f1.outline, 'yoke')).toBeGreaterThan(taggedLength(f0.outline, 'yoke') + 2);
    expect(d.finishedBust).toBe(plain.finishedBust + 8);
    expect(d.finishedHem).toBe(plain.finishedHem! + 8);
    expect(d.hemTie!.cordCm).toBeGreaterThanOrEqual(d.finishedHem! + 55);
    // The pattern's own checks pass, the point of the V and the gathered seam included.
    expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
    expect(checkPattern(plain.pieces).filter((c) => !c.ok)).toEqual([]);
    // On the form the gathers are drawn up: the front joined to its panels is the shape it was without them.
    const [j0, j1] = [yokesJoined(plain.pieces)[0].outline.points(1), yokesJoined(d.pieces)[0].outline.points(1)];
    expect(j1.length).toBe(j0.length);
    j1.forEach((q, i) => expect(Math.hypot(q.x - j0[i].x, q.y - j0[i].y)).toBeLessThan(1e-6));
    const g = bodiceGuide(d, { length: 'hip' }, 1.5, 2);
    expect(g.steps.find((st) => st.title === 'Join the yokes')!.text).toMatch(/gathering stitches.*shoulder panels.*Draw up the gathering threads/);
    expect(bodiceFlat(d).views[0].lines.length).toBeGreaterThan(bodiceFlat(plain).views[0].lines.length + 8);
  });

  it('carries on down the V as a narrowing strip that meets its pair under the point', () => {
    const yoke = { front: 0, back: 10, frontSlant: 13, trim: true, frontGather: 4 };
    const open = draftBodice(EXAMPLE_BODY as never, blouse({ yoke }));
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ yoke: { ...yoke, frontBand: 3.5 } }));
    const panel = d.pieces.find((pc) => pc.name === 'Bodice front yoke')!;
    const front = d.pieces[0];
    expect(panel.cut).toBe('Cut 2 (1 pair)');
    // The panel has the whole edge of the V and a short seam to its pair; the front below has none of the V.
    expect(taggedLength(front.outline, 'neck')).toBe(0);
    expect(taggedLength(panel.outline, 'centre')).toBeCloseTo(3, 1);
    const whole = (x: typeof d) => x.pieces.filter((pc) => /^Bodice front/.test(pc.name)).reduce((sum, pc) => sum + taggedLength(pc.outline, 'neck'), 0);
    expect(whole(d)).toBeCloseTo(whole(open), 5);
    const seam = d.styleSeams!.find((s) => s.side === 'front')!.pts;
    expect(seam[0].x).toBeCloseTo(0, 5);
    // The strip is never out past the turn, and the gathers are only on the slanted stretch.
    for (const q of seam.slice(0, -2)) expect(q.x).toBeLessThan(seam[seam.length - 2].x);
    expect(taggedLength(front.outline, 'yoke') - taggedLength(panel.outline, 'yoke')).toBeCloseTo(front.meta.gatherTake as number, 5);
    expect(front.meta.gatherTake as number).toBeGreaterThan(2);
    expect(d.warnings).toEqual([]);
    expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
    expect(yokesJoined(d.pieces).map((pc) => pc.name)).toEqual(['Bodice front', 'Bodice back']);
    const g = bodiceGuide(d, { length: 'hip' }, 1.5, 2);
    expect(g.steps.find((st) => st.title === 'Join the yokes')!.text).toMatch(/together along their short centre front edges.*clip into the corners/);
    // The stay tape is still cut to the whole edge of the V, though that edge is now on the panels.
    const tape = (x: typeof d) => bodiceGuide(x, { length: 'hip' }, 1.5, 2).steps.find((st) => st.title === 'Tape the plunge')!.text.match(/tape ([\d.]+) cm long/)![1];
    expect(Number(tape(d))).toBeGreaterThan(35);
    expect(tape(d)).toBe(tape(draftBodice(EXAMPLE_BODY as never, blouse())));
  });

  it('is the Lilac Lace Blouse: panels, no zip, and it passes the All round check in lace', async () => {
    const { sewDesign } = await import('../drapeSweep');
    const look = COLLECTION.find((l) => l.id === 'lilac-lace')!;
    const r = sewDesign({ garment: 'bodice', saved: { bodice: look.choices } as never, fibre: 'silk', fabric: { special: 'lace' } as never });
    expect(r.error).toBeUndefined();
    expect(r.quality!.problems).toEqual([]);
  }, 60000);
});

describe('a drawstring hem', () => {
  it('marks its channel on the front and back, and asks for the binding and a cord long enough to tie', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ hemTie: 'drawstring' }));
    expect(d.hemTie!.cordCm).toBeGreaterThanOrEqual(d.finishedHem! + 55);
    for (const name of ['Bodice front', 'Bodice back']) expect(d.pieces.find((pc) => pc.name === name)!.balance!.map((b) => b.label)).toContain('DRAWSTRING CHANNEL');
    const g = bodiceGuide(d, { length: 'hip' }, 1.5, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles.indexOf('Sew the drawstring channel')).toBe(titles.indexOf('Hem') + 1);
    expect(g.notions.join(' ')).toMatch(/silk bias binding, for the drawstring channel.*fine silk cord/);
  });

  it('is left off a top that ends at the waist', () => {
    const d = draftBodice(EXAMPLE_BODY as never, blouse({ hemTie: 'drawstring', length: 'waist' }));
    expect(d.hemTie).toBeUndefined();
  });

  it('is drawn on the flat: a second row of stitching and the cord ends at the left side seam', () => {
    const look = COLLECTION.find((l) => l.id === 'lilac-lace')!;
    const f = lookFlat(look, EXAMPLE_BODY as never)!;
    const front = f.views.find((v) => /front/i.test(v.label))!;
    const body = front.shapes[0];
    const right = Math.max(...body.map((q) => q.x));
    const foot = Math.max(...body.map((q) => q.y));
    const cords = front.shapes.filter((sh) => sh !== body && sh.every((q) => q.x > right - 3 && q.y > foot - 6) && sh.some((q) => q.y > foot + 3));
    expect(cords).toHaveLength(2);
  });
});
