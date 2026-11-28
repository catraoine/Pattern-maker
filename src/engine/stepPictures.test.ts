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

  // The Ice Peplum's Sewing mode pictures didn't match their steps (pretend tester EJ walk, Nov 27).
  describe('a princess top with a peplum', () => {
    const top = [
      piece('Bodice centre front', ['neck', 'princess', 'hem', 'fold']),
      piece('Bodice side front', ['shoulder', 'side', 'hem', 'princess']),
      piece('Bodice centre back', ['neck', 'princess', 'hem', 'centre']),
      piece('Bodice side back', ['shoulder', 'side', 'hem', 'princess']),
      piece('Neck ruffle', ['neck', 'end', 'ruffle', 'fold'], { kind: 'collar' }),
      piece('Peplum front', ['waist', 'side', 'hem', 'fold']),
      piece('Peplum back', ['waist', 'side', 'hem', 'centre']),
    ];
    const pic = (title: string, text = '') => stepPicture({ title, text }, top);
    it('sews the princess seams on the four panels, not the centre back its words name', () => {
      expect(pic('Sew the princess seams', 'Pin each side front to the centre front, and each side back to the centre back.')).toMatchObject({ pieces: [0, 1, 2, 3], edges: ['princess'] });
    });
    it("leaves the peplum's side seams and the ruffle to their own steps", () => {
      expect(pic('Sew the side seams', 'Pin the front to the back at the sides.')).toMatchObject({ pieces: [1, 3], edges: ['side'] });
      expect(pic('Bind the neckline', 'Pin a strip to the neckline.')).toMatchObject({ pieces: [0, 2], edges: ['neck'] });
    });
    it("attaches the peplum's waist to the bodice's lower edge, the front half", () => {
      expect(pic('Attach the peplum', "Pin the peplum to the bodice's lower edge.")).toEqual({ kind: 'sew', pieces: [0, 1, 5], edges: [], darts: false, edgesOn: { 0: ['hem'], 1: ['hem'], 5: ['waist'] } });
    });
    it('still shows a peplum or ruffle the step names', () => {
      expect(pic('Make the peplum', 'Sew the peplum side seams.')).toMatchObject({ pieces: [5, 6] });
    });
  });
  // More Sewing mode pictures that didn't show their step (pretend tester EK walk, Nov 27).
  describe('a ruffled top with bands, and trousers with a front pleat', () => {
    const top = [
      piece('Bodice centre front', ['neck', 'princess', 'hem', 'fold']),
      piece('Bodice centre back', ['neck', 'princess', 'hem', 'centre']),
      piece('Neck ruffle', ['neck', 'end', 'ruffle', 'fold'], { kind: 'collar' }),
      piece('Peplum front', ['waist', 'side', 'hem', 'fold']),
      piece('Sleeve', ['armhole', 'sleeve-front', 'hem', 'sleeve-back']),
      piece('Sleeve band', ['band', 'end', 'band', 'end'], { kind: 'band' }),
    ];
    const pic = (title: string, text = '') => stepPicture({ title, text }, top);
    it('attaches the ruffle to the neckline, unlike making it', () => {
      expect(pic('Attach the ruffle', 'Pin the ruffle to the right side of the neckline.')).toMatchObject({ pieces: [0, 1, 2], edges: ['neck'] });
      expect(pic('Make the ruffle', 'Fold the ruffle strip in half.')).toMatchObject({ pieces: [2], edges: [] });
    });
    it('puts the bands on the sleeve hems, and eases the crown on the sleeve alone', () => {
      expect(pic('Attach the sleeve bands', 'Gather each sleeve hem.')).toEqual({ kind: 'sew', pieces: [4, 5], edges: [], darts: false, around: [5], edgesOn: { 4: ['hem'] } });
      expect(pic('Ease the sleeve heads', 'Two rows round each crown.')).toEqual({ kind: 'sew', pieces: [4], edges: ['armhole'], darts: false });
    });
    it("sews the peplum's own side seams when making it", () => {
      expect(pic('Make the peplum', 'Sew the peplum front to the backs at the side seams.')).toMatchObject({ pieces: [3], edges: ['side'] });
    });
    const legs = [
      piece('Trousers front', ['waist', 'pleat', 'side', 'inseam'], { lines: [new Path(p(12, 0)).line(p(12, 60))] }),
      piece('Trousers back', ['waist', 'side', 'hem', 'inseam']),
      piece('Waistband', ['band', 'end', 'band', 'end'], { kind: 'waistband' }),
    ];
    it("folds the front pleat at its pleat edge, and presses the creases on both legs", () => {
      expect(stepPicture({ title: 'Fold the front pleat', text: '' }, legs)).toEqual({ kind: 'sew', pieces: [0], edges: ['pleat'], darts: false });
      expect(stepPicture({ title: 'Press the creases', text: '' }, legs)).toEqual({ kind: 'sew', pieces: [0, 1], edges: [], darts: false });
    });
  });
});
