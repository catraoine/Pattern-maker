// The dress: the waist-length bodice and a skirt, joined at the waist. Or, for a dropped waist, a
// bodice that runs on past the waist to the high hip and a shorter skirt joined there, drafted as if
// the high hip were its waist. The skirt is drafted to the bodice rather than to a waistband: its front and back waist seams are walked to the bodice's, front
// to front and back to back, and its darts sit under the bodice's so they run on as one line through
// the seam. One long zip opens the centre back from the neck to below the waist.
import { P, add, len, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceMeasurements, BodiceStyle, DROP_MIN, draftBodice } from './bodice';
import { maxRaise, raiseBodice } from './waistline';
import { DraftError, SkirtDraft, SkirtMeasurements, SkirtStyle, draftSkirt } from './skirt';
import type { SleeveMeasurements } from './sleeve';
import { SIDE_ZIPS } from './drape';

export type DressMeasurements = BodiceMeasurements & SkirtMeasurements & SleeveMeasurements;

/** Standard dress zips, in cm. */
export const DRESS_ZIPS = [45, 50, 55, 60, 65];
/** How far the zip runs on below the waist, at least, so the dress steps on over the hips. */
export const ZIP_BELOW_WAIST = 12;

/** Where the bodice and skirt meet, named: from just under the bust (empire) down to the hip (low). */
export type WaistSeam = 'empire' | 'raised' | 'natural' | 'dropped' | 'low';
export const WAIST_SEAMS: WaistSeam[] = ['empire', 'raised', 'natural', 'dropped', 'low'];
/** A waist seam: a named place, or a dragged height in cm below the natural waist (negative above it). */
export interface SeamChoice {
  at?: WaistSeam;
  cm?: number;
}
/** How close to the hip line a low seam can go: the skirt needs a little depth to shape over the hip. */
const LOW_ABOVE_HIP = 6;

/** How far the seam can move: up to under the bust (negative, cm above the waist), down to near the hip. */
export const seamRange = (m: { waist_to_hip?: number }, raise: number) => ({ min: -raise, max: Math.max(0, (m.waist_to_hip ?? 0) - LOW_ABOVE_HIP) });

/** The seam's height in cm below the natural waist (negative above), within what the body allows. */
export function seamDrop(m: { waist_to_hip?: number }, seam: SeamChoice, raise: number): number {
  const range = seamRange(m, raise);
  const WH = m.waist_to_hip ?? 0;
  const named = { empire: -raise || 0, raised: -raise / 2, natural: 0, dropped: WH / 2, low: range.max }[seam.at ?? 'natural'];
  const v = Math.max(range.min, Math.min(range.max, seam.cm ?? named));
  // Just below the waist a bodice can't shape over the hip yet, and a hair above it is the waist.
  if (v > 0 && v < DROP_MIN) return v < DROP_MIN / 2 ? 0 : DROP_MIN;
  if (v < 0 && v > -1.5) return 0;
  return Math.round(v * 10) / 10 || 0;
}

/**
 * The skirt's measurements taken from a seam `drop` cm below the natural waist (negative above it): its
 * lengths start there, and its "waist" is the body's girth there. So a midi still ends at the mid-calf,
 * and every skirt tool reads its lengths from the seam.
 */
export function fromSeam<T extends SkirtMeasurements & { high_hip?: number; full_bust?: number; underbust?: number }>(m: T, drop: number): T {
  if (!drop) return m;
  const less = (v: number | undefined) => (v === undefined ? undefined : v - drop);
  const HH = m.high_hip ?? m.waist + 0.65 * (m.full_hip - m.waist);
  const under = m.underbust ?? (m.full_bust ? m.waist + 0.5 * (m.full_bust - m.waist) : m.waist);
  const girth = drop > 0 ? Math.min(m.waist + ((HH - m.waist) * drop) / (m.waist_to_hip / 2), m.full_hip) : m.waist + (under - m.waist) * Math.min(1, -drop / 10);
  return {
    ...m,
    waist: girth,
    waist_to_hip: m.waist_to_hip - drop,
    ...(m.front_waist_to_hip !== undefined ? { front_waist_to_hip: less(m.front_waist_to_hip) } : {}),
    ...(m.back_waist_to_hip !== undefined ? { back_waist_to_hip: less(m.back_waist_to_hip) } : {}),
    waist_to_knee: m.waist_to_knee - drop,
    waist_to_floor: m.waist_to_floor - drop,
  };
}

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
  /** How far the waist seam is below the natural waist in cm: 0 at the waist, negative above it. */
  seamDrop: number;
  /** How far it can move on this body, the same way. */
  seamRange: { min: number; max: number };
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

/** A bodice piece's hem made the waist seam, sewn with a seam allowance rather than turned up. */
function hemToSeam(pc: Piece): Piece {
  if (!pc.outline.tags.includes('hem')) return pc;
  const outline = Object.assign(Object.create(Object.getPrototypeOf(pc.outline)), pc.outline, { tags: pc.outline.tags.map((t) => (t === 'hem' ? 'waist' : t)) });
  const { hem: _hem, ...allowances } = pc.allowances ?? {};
  return { ...pc, outline, allowances };
}

export function draftDress(m: DressMeasurements, bodiceStyle: Partial<BodiceStyle> = {}, skirtStyle: Partial<SkirtStyle> = {}, seam: SeamChoice | WaistSeam = {}): DressDraft {
  const at = typeof seam === 'string' ? { at: seam } : seam;
  const base = { ...bodiceStyle, length: 'waist' as const, dropCm: undefined, hem: undefined, closure: 'back_zip' as const, peplum: 'none' as const };
  const natural = draftBodice(m, base);
  // Only a plain front and back are cut across: panels, a drape or boning keep the seam at the waist or below.
  const plain = natural.pieces.filter((pc) => !pc.kind && /^Bodice/.test(pc.name)).length === 2 && !natural.drape && !natural.top?.boned;
  const raise = plain ? maxRaise(natural) : 0;
  const drop = seamDrop(m, at, raise);
  if (skirtStyle.silhouette === 'slip' && drop > m.waist_to_hip / 2 + 0.05) {
    throw new DraftError('A bias slip skirt needs room to mould over the hip: bring the waist seam up to the high hip or above.');
  }
  // Dropped: the bodice runs on to the seam and its hem becomes the waist seam. Raised: the waist-length
  // bodice is cut across above the waist. Either way the skirt is drafted from the seam. The draft keeps
  // the bodice as drawn, hem and all, for the drawings; its printed pieces sew to the skirt.
  const bodice = drop > 0 ? draftBodice(m, { ...base, length: 'high_hip', dropCm: drop }) : drop < 0 ? raiseBodice(natural, -drop) : natural;
  const bodicePieces = drop > 0 ? bodice.pieces.map(hemToSeam) : bodice.pieces;
  const sm = fromSeam(m, drop);
  // Front and back may each be one piece or two panels (princess seams): their waists add up, and the
  // skirt dart goes under the bodice dart or under the princess seam.
  const side = (which: 'front' | 'back') => bodicePieces.filter((pc) => new RegExp(which, 'i').test(pc.name));
  // A whole piece (one-shoulder, cowl) holds both halves; the skirt is drafted to one.
  const waistOf = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1), 0);
  const dartOf = (pcs: Piece[]) => {
    // Below the waist the bodice's darts are fish-eyes that close above the seam: nothing to line up.
    if (drop > 0) return undefined;
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
    : (DRESS_ZIPS.find((z) => z - cb >= ZIP_BELOW_WAIST + Math.max(0, -drop)) ?? DRESS_ZIPS[DRESS_ZIPS.length - 1]);
  const below = Math.round((zipCm - (sideOpen ? sideOpen.openingCm : cb)) * 10) / 10;

  // The skirt's waist curve is a little longer than its width, so walk it to the bodice's.
  const join = { front: waist.front, back: waist.back, dartAt, zipCm: below };
  let skirt = draftSkirt(sm, { ...skirtStyle, joinTo: join });
  // A pleated skirt split to fit the fabric has two pieces a side: their waists add up. A skirt front
  // cut whole (a bias slip) has both halves of the waist.
  const halfWaist = (pc: Piece) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1);
  const skirtWaist = (d: SkirtDraft, which: 'front' | 'back') =>
    d.pieces.filter((pc) => /^Skirt/.test(pc.name) && new RegExp(which, 'i').test(pc.name)).reduce((t, pc) => t + halfWaist(pc), 0);
  for (let i = 0; i < 4; i++) {
    const df = waist.front - skirtWaist(skirt, 'front');
    const db = waist.back - skirtWaist(skirt, 'back');
    if (Math.abs(df) < 0.005 && Math.abs(db) < 0.005) break;
    join.front += df;
    join.back += db;
    skirt = draftSkirt(sm, { ...skirtStyle, joinTo: join });
  }

  // The zip runs on through the waist, so the bodice back loses its zip mark.
  const unzip = (pc: Piece): Piece =>
    /back/i.test(pc.name)
      ? { ...pc, notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)), labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS') }
      : pc;
  return {
    bodice,
    skirt,
    pieces: [...bodicePieces.map(unzip), ...(sideOpen ? skirt.pieces.map((pc) => sideZip(pc, below)) : skirt.pieces)],
    zipCm,
    zipBelowWaist: below,
    ...(sideOpen ? { zipSide: true } : {}),
    seamDrop: drop,
    seamRange: seamRange(m, raise),
    lengthCm: Math.round((cb + skirt.lengthCm) * 10) / 10,
    finishedBust: bodice.finishedBust,
    // Raised, the bodice ends above the waist: the waist's room is the block's, under the loose skirt.
    finishedWaist: natural.finishedWaist,
    finishedHip: skirt.finishedHip,
    warnings: bodice.warnings,
  };
}
