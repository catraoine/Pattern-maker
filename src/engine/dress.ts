// The dress: the waist-length bodice and a skirt, joined at the waist. The skirt is drafted to the
// bodice rather than to a waistband: its front and back waist seams are walked to the bodice's, front
// to front and back to back, and its darts sit under the bodice's so they run on as one line through
// the seam. One long zip opens the centre back from the neck to below the waist.
import { taggedLength } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceMeasurements, BodiceStyle, draftBodice } from './bodice';
import { SkirtDraft, SkirtMeasurements, SkirtStyle, draftSkirt } from './skirt';
import type { SleeveMeasurements } from './sleeve';

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

export function draftDress(m: DressMeasurements, bodiceStyle: Partial<BodiceStyle> = {}, skirtStyle: Partial<SkirtStyle> = {}): DressDraft {
  const bodice = draftBodice(m, { ...bodiceStyle, length: 'waist', closure: 'back_zip' });
  // Front and back may each be one piece or two panels (princess seams): their waists add up, and the
  // skirt dart goes under the bodice dart or under the princess seam.
  const side = (which: 'front' | 'back') => bodice.pieces.filter((pc) => new RegExp(which, 'i').test(pc.name));
  const waistOf = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist'), 0);
  const dartOf = (pcs: Piece[]) => {
    const at = pcs.map((pc) => waistDartAt(pc) ?? (pc.meta.waistSeamAt as number | undefined)).filter((x): x is number => x !== undefined);
    return at.length ? Math.min(...at) : undefined;
  };
  const waist = { front: waistOf(side('front')), back: waistOf(side('back')) };
  const dartAt = { front: dartOf(side('front')), back: dartOf(side('back')) };
  const cb = bodice.backLength;
  const zipCm = DRESS_ZIPS.find((z) => z - cb >= ZIP_BELOW_WAIST) ?? DRESS_ZIPS[DRESS_ZIPS.length - 1];
  const below = Math.round((zipCm - cb) * 10) / 10;

  // The skirt's waist curve is a little longer than its width, so walk it to the bodice's.
  const join = { front: waist.front, back: waist.back, dartAt, zipCm: below };
  let skirt = draftSkirt(m, { ...skirtStyle, joinTo: join });
  // A pleated skirt split to fit the fabric has two pieces a side: their waists add up.
  const skirtWaist = (d: SkirtDraft, which: 'front' | 'back') => waistOf(d.pieces.filter((pc) => /^Skirt/.test(pc.name) && new RegExp(which, 'i').test(pc.name)));
  for (let i = 0; i < 4; i++) {
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
    pieces: [...bodice.pieces.map(unzip), ...skirt.pieces],
    zipCm,
    zipBelowWaist: below,
    lengthCm: Math.round((cb + skirt.lengthCm) * 10) / 10,
    finishedBust: bodice.finishedBust,
    finishedWaist: bodice.finishedWaist,
    finishedHip: skirt.finishedHip,
    warnings: bodice.warnings,
  };
}
