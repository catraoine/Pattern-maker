import { describe, expect, it } from 'vitest';
import { Path, p } from './geometry';
import type { Piece } from './piece';
import { stepPicture } from './stepPictures';

// A front and back with tagged edges, a dart on the front, and a waistband, as the drafts make them.
const piece = (name: string, tags: string[], extra: Partial<Piece> = {}): Piece => {
  const o = new Path(p(0, 0)).line(p(20, 0), tags[0]).line(p(24, 60), tags[1]).line(p(0, 60), tags[2]).line(p(0, 0), tags[3]);
  return { name, outline: o, lines: [], notches: [], labels: [], cut: 'Cut 2', seamAllowance: 1.5, allowances: {}, meta: {}, ...extra };
};
const front = piece('Skirt front', ['waist', 'side', 'hem', 'fold'], { lines: [new Path(p(6, 0)).line(p(7, 10)).line(p(8, 0))] });
const back = piece('Skirt back', ['waist', 'side', 'hem', 'centre']);
const band = piece('Waistband', ['band', 'end', 'band', 'end'], { kind: 'waistband' });
const pocket = piece('Patch pocket', ['top', 'side', 'base', 'side'], { kind: 'pocket' });
const all = [front, back, band, pocket];
const step = (title: string, text = '') => stepPicture({ title, text }, all);

describe('the picture for each sewing step', () => {
  it('prepares and prints with pictures of their own', () => {
    expect(step('Prepare your fabric').kind).toBe('prep');
    expect(step('Print and check the size').kind).toBe('print');
  });
  it('cuts the garment, or just the piece named', () => {
    expect(step('Cut out')).toEqual({ kind: 'cut', names: ['Skirt front', 'Skirt back', 'Patch pocket'] });
    expect(step('Cut the waistband')).toEqual({ kind: 'cut', names: ['Waistband'] });
  });
  it('sews the darts on the pieces that have them', () => {
    expect(step('Sew the 4 darts')).toEqual({ kind: 'sew', pieces: [0], edges: [], darts: true });
  });
  it('stitches the edges a step names, on the pieces that carry them', () => {
    expect(step('Sew the side seams')).toMatchObject({ kind: 'sew', pieces: [0, 1, 3], edges: ['side'] });
    expect(step('Put in the zip')).toMatchObject({ pieces: [1], edges: ['centre'] });
    expect(step('Attach the waistband')).toMatchObject({ pieces: [2, 0, 1], edges: ['waist'] });
  });
  it('reads a plain "sew" step\'s words for its seam, but not a pressing step', () => {
    expect(step('Neaten the edges', 'Zigzag the side and centre back edges.')).toMatchObject({ edges: ['side', 'centre'] });
    expect(step('Press the creases', 'Fold along the crease, then press the side.').kind).toBe('flat');
  });
  it('sews a small piece all the way round', () => {
    expect(step('Make and sew on the patch pockets')).toMatchObject({ pieces: [3], around: [3] });
  });
  it('finishes with the garment itself', () => {
    expect(step('Finish').kind).toBe('flat');
    expect(step('Try it on').kind).toBe('flat');
  });
  it('shows the neckband beside the neck it is sewn to', () => {
    const tf = piece('Tee front', ['neck', 'side', 'hem', 'fold']);
    const nb = piece('Neckband', ['band', 'end', 'band', 'end'], { kind: 'band' });
    expect(stepPicture({ title: 'Sew on the neckband', text: '' }, [tf, nb])).toEqual({ kind: 'sew', pieces: [1, 0], edges: ['neck'], darts: false });
  });
  it('interfaces or presses a piece without stitching anything', () => {
    expect(step('Interface the waistband')).toEqual({ kind: 'sew', pieces: [2], edges: [], darts: false });
  });
  it('sews darts only, not a roll line or fold line', () => {
    const lapel = piece('Jacket front', ['neck', 'side', 'hem', 'centre'], { lines: [new Path(p(2, 2)).line(p(10, 30))] });
    expect(stepPicture({ title: 'Sew the darts', text: '' }, [front, lapel])).toEqual({ kind: 'sew', pieces: [0], edges: [], darts: true });
  });
  it("keeps a pocket's own pieces out of the facings and lining, and draws the welt with its pocket", () => {
    const yoke = piece('Vest front yoke', ['neck', 'shoulder', 'armhole', 'yoke']);
    const collar = piece('Collar', ['neck', 'collar', 'fold', 'gorge'], { kind: 'collar' });
    const facing = piece('Front facing', ['neck', 'opening', 'hem', 'shoulder'], { kind: 'facing' });
    const welt = piece('Welt', ['welt', 'welt-end', 'welt', 'welt-end'], { kind: 'facing' });
    const pf = piece('Pocket facing', ['pocket', 'pocket-end', 'pocket', 'pocket-end'], { kind: 'facing' });
    const bag = piece('Pocket bag', ['bag', 'bag', 'bag', 'bag-top'], { kind: 'lining' });
    const lining = piece('Front lining', ['armhole', 'side', 'hem', 'lining'], { kind: 'lining' });
    const vest = [yoke, collar, facing, welt, pf, bag, lining];
    const at = (title: string) => stepPicture({ title, text: '' }, vest);
    expect(at('Sew the upper collar to the facings')).toEqual({ kind: 'sew', pieces: [1, 2], edges: ['neck'], darts: false });
    expect(at('Make the welt pockets')).toMatchObject({ pieces: [3, 4, 5], around: [3, 4, 5] });
    expect(at('Bag the lining')).toMatchObject({ pieces: [6] });
    expect(stepPicture({ title: 'Cut the lining', text: '' }, vest)).toEqual({ kind: 'cut', names: ['Pocket bag', 'Front lining'] });
  });
  it('joins side panels along their panel seams, front and back too', () => {
    const fr = piece('Skirt front', ['waist', 'panel', 'hem', 'fold']);
    const sf = piece('Skirt side front', ['waist', 'side', 'hem', 'panel']);
    expect(stepPicture({ title: 'Join the side panels', text: '' }, [fr, sf])).toEqual({ kind: 'sew', pieces: [0, 1], edges: ['panel'], darts: false });
  });
  it('folds pleats on the pieces whose pleat lines are drawn, not on the finished skirt (EA walk, Nov 21)', () => {
    const pleated = piece('Skirt front', ['waist', 'side', 'hem', 'fold'], { lines: [new Path(p(10, 0)).line(p(10, 60))] });
    expect(stepPicture({ title: 'Fold and baste the pleats', text: '' }, [pleated, back])).toEqual({ kind: 'sew', pieces: [0], edges: [], darts: false });
  });
});
