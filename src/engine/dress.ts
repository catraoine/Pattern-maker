// The dress: the waist-length bodice and a skirt, joined at the waist. The skirt is drafted to the
// bodice rather than to a waistband: its front and back waist seams are walked to the bodice's, front
// to front and back to back, and its darts sit under the bodice's so they run on as one line through
// the seam. One long zip opens the centre back from the neck to below the waist.
import { P, add, len, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceMeasurements, BodiceStyle, draftBodice } from './bodice';
import { SkirtDraft, SkirtMeasurements, SkirtStyle, draftSkirt } from './skirt';
import type { SleeveMeasurements } from './sleeve';
import { SIDE_ZIPS } from './drape';

export type DressMeasurements = BodiceMeasurements & SkirtMeasurements & SleeveMeasurements;

/** Standard dress zips, in cm. */
export const DRESS_ZIPS = [45, 50, 55, 60, 65];
/** How far the zip runs on below the waist, at least, so the dress steps on over the hips. */
export const ZIP_BELOW_WAIST = 12;

export interface DressDraft {
  bodice: BodiceDraft;
  skirt: SkirtDraft;
  /** The bodice and skirt pieces, ready to print: the bodice's zip mark moved down into the skirt. */
  pieces: Piece[];
  /** The zip, from the neck edge, and how much of it is below the waist. */
  zipCm: number;
  zipBelowWaist: number;
  /** One-shoulder: the zip is in the right side seam, from under the arm, not at the centre back. */
  zipSide?: boolean;
  /** Nape to hem at the centre back. */
  lengthCm: number;
  finishedBust: number;
  finishedWaist: number;
  finishedHip: number;
  warnings: string[];
}

/** The centre of the waist dart on a piece's waist edge, in cm from the centre, if it has one. */
export function waistDartAt(pc: Piece): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(2);
  for (let i = 1; i < tags.length; i++) {
    if (tags[i] !== 'dart' || tags[i - 1] !== 'waist') continue;
    let k = i;
    while (tags[k] === 'dart') k++;
    return (pts[i].x + pts[k].x) / 2;
  }
  return undefined;
}

/** A skirt piece with its zip moved from the centre back to the right side seam: the back's centre
 * mark taken off, and a ZIP ENDS notch `below` cm down the side seam of the front and back. */
function sideZip(pc: Piece, below: number): Piece {
  const isBack = /back/i.test(pc.name);
  const { pts, tags } = pc.outline.taggedPoints(4);
  let k = tags.indexOf('side');
  if (k < 0) return pc;
  let acc = 0;
  while (tags[k + 1] === 'side' && acc + len(sub(pts[k + 1], pts[k])) < below) {
    acc += len(sub(pts[k + 1], pts[k]));
    k++;
  }
  const l = len(sub(pts[k + 1], pts[k]));
  const dir = unit(sub(pts[k + 1], pts[k]));
  const at: P = add(pts[k], mul(dir, Math.min(l, below - acc)));
  const out = p(dir.y, -dir.x);
  const outward = out.x >= 0 ? out : mul(out, -1);
  return {
    ...pc,
    notches: [...pc.notches.filter(([q, d]) => !(isBack && Math.abs(q.x) < 1e-6 && d.x < 0)), [at, outward]],
    labels: [
      ...pc.labels.filter((lb) => lb.text !== 'ZIP ENDS'),
      ...(isBack ? [{ at: add(at, p(-4.5, 0.3)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
  };
}

export function draftDress(m: DressMeasurements, bodiceStyle: Partial<BodiceStyle> = {}, skirtStyle: Partial<SkirtStyle> = {}): DressDraft {
  const bodice = draftBodice(m, { ...bodiceStyle, length: 'waist', closure: 'back_zip', peplum: 'none' });
  // Front and back may each be one piece or two panels (princess seams): their waists add up, and the
  // skirt dart goes under the bodice dart or under the princess seam.
  const side = (which: 'front' | 'back') => bodice.pieces.filter((pc) => new RegExp(which, 'i').test(pc.name));
  // A whole piece (one-shoulder, cowl) holds both halves; the skirt is drafted to one.
  const waistOf = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1), 0);
  const dartOf = (pcs: Piece[]) => {
    const at = pcs
      .map((pc) => waistDartAt(pc) ?? (pc.meta.waistSeamAt as number | undefined))
      .filter((x): x is number => x !== undefined)
      .map(Math.abs);
    return at.length ? Math.min(...at) : undefined;
  };
  const waist = { front: waistOf(side('front')), back: waistOf(side('back')) };
  const dartAt = { front: dartOf(side('front')), back: dartOf(side('back')) };
  const cb = bodice.backLength;
  // One-shoulder: the zip goes in the right side seam from under the arm instead.
  const sideOpen = bodice.drape?.zip;
  const zipCm = sideOpen
    ? (SIDE_ZIPS.find((z) => z - sideOpen.openingCm >= ZIP_BELOW_WAIST) ?? SIDE_ZIPS[SIDE_ZIPS.length - 1])
    : (DRESS_ZIPS.find((z) => z - cb >= ZIP_BELOW_WAIST) ?? DRESS_ZIPS[DRESS_ZIPS.length - 1]);
  const below = Math.round((zipCm - (sideOpen ? sideOpen.openingCm : cb)) * 10) / 10;

  // The skirt's waist curve is a little longer than its width, so walk it to the bodice's.
  const join = { front: waist.front, back: waist.back, dartAt, zipCm: below };
  let skirt = draftSkirt(m, { ...skirtStyle, joinTo: join });
  // A pleated skirt split to fit the fabric has two pieces a side: their waists add up. A skirt front
  // cut whole (a bias slip) has both halves of the waist.
  const halfWaist = (pc: Piece) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1);
  const skirtWaist = (d: SkirtDraft, which: 'front' | 'back') =>
    d.pieces.filter((pc) => /^Skirt/.test(pc.name) && new RegExp(which, 'i').test(pc.name)).reduce((t, pc) => t + halfWaist(pc), 0);
  // A gathered skirt is gathered into the seam, so its waist is longer by design.
  for (let i = 0; i < 4 && !skirt.gathers; i++) {
    const df = waist.front - skirtWaist(skirt, 'front');
    const db = waist.back - skirtWaist(skirt, 'back');
    if (Math.abs(df) < 0.005 && Math.abs(db) < 0.005) break;
    join.front += df;
    join.back += db;
    skirt = draftSkirt(m, { ...skirtStyle, joinTo: join });
  }

  // The zip runs on through the waist, so the bodice back loses its zip mark.
  const unzip = (pc: Piece): Piece =>
    /back/i.test(pc.name)
      ? { ...pc, notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)), labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS') }
      : pc;
  return {
    bodice,
    skirt,
    pieces: [...bodice.pieces.map(unzip), ...(sideOpen ? skirt.pieces.map((pc) => sideZip(pc, below)) : skirt.pieces)],
    zipCm,
    zipBelowWaist: below,
    ...(sideOpen ? { zipSide: true } : {}),
    lengthCm: Math.round((cb + skirt.lengthCm) * 10) / 10,
    finishedBust: bodice.finishedBust,
    finishedWaist: bodice.finishedWaist,
    finishedHip: skirt.finishedHip,
    warnings: bodice.warnings,
  };
}
