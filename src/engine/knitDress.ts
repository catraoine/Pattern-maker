// The knit dress (Garment range, Cat 2026-11-07: "I want to do all, break freeze"): the T-shirt block carried on past
// the hip to a dress length, sewn in knit with no darts or zip, as the T-shirt is. Five starting Looks on the option
// sheet: K1 T-shirt dress, K2 rib midi, K3 skater, K4 column maxi, K5 jumper dress.
//
// - Straight, hugging and A-line skirts are the T-shirt's own front and back carried on (TeeCarry): the side seam runs
//   through the hip at its full width, then straight on, in or out to the hem.
// - The skater is the T-shirt cut at the waist, fitted in to it, with a flared knit skirt sewn on: front and back
//   each a sector of a ring cut on the fold, between a half and a full circle, so it falls in soft flutes.
// - A jumper dress has rib cuffs and a hem band (knitBands.ts) in place of hems.
// In testing until testers sew it.
import { DraftError } from './skirt';
import { P, Path, p, taggedLength } from './geometry';
import type { Piece } from './piece';
import { KNIT_HEM, KNIT_SEAM, Stretch, TeeDraft, TeeFit, TeeMeasurements, TeeNeck, TeeSleeve, draftTee } from './tee';
import { Bands, ribBands } from './knitBands';

export type KnitDressSkirt = 'straight' | 'hugging' | 'aline' | 'skater';
export type KnitDressLength = 'mini' | 'above_knee' | 'knee' | 'midi' | 'maxi';
export const KNIT_DRESS_SKIRTS: KnitDressSkirt[] = ['straight', 'hugging', 'aline', 'skater'];
export const KNIT_DRESS_LENGTHS: KnitDressLength[] = ['mini', 'above_knee', 'knee', 'midi', 'maxi'];

export interface KnitDressMeasurements extends TeeMeasurements {
  waist_to_knee: number;
  waist_to_floor: number;
}

export interface KnitDressStyle {
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  sleeve: TeeSleeve;
  skirt: KnitDressSkirt;
  length: KnitDressLength;
  /** Rib cuffs and a hem band, a jumper dress's finish. Older saves have plain hems. */
  ribbed?: boolean;
  flatFront?: boolean;
}

export const DEFAULT_KNIT_DRESS: KnitDressStyle = { fit: 'regular', stretch: 'medium', neckline: 'crew', sleeve: 'short', skirt: 'straight', length: 'knee' };

/** Each length as cm below the waist at the side, from the knee and the floor. */
export function lengthBelowWaist(m: Pick<KnitDressMeasurements, 'waist_to_knee' | 'waist_to_floor'>, l: KnitDressLength): number {
  const K = m.waist_to_knee;
  const F = m.waist_to_floor;
  return { mini: K - 16, above_knee: K - 6, knee: K + 2, midi: K + (F - K) * 0.5, maxi: F - 7 }[l];
}

/** How far a hugging skirt narrows below the hip, each quarter, by the knit's stretch: none in a firm knit, which
 *  could not be walked in otherwise. */
const HUG: Record<Stretch, number> = { low: 0, medium: -1.5, high: -3 };
/** An A-line's spread at the hem for each 10 cm below the hip, each quarter. */
const A_LINE_PER_10 = 1.8;
/** The skater skirt's fullness: the share of a full circle the whole skirt makes at its waist. */
export const SKATER_CIRCLE = 0.7;
/** The rib finish's depths. */
export const DRESS_BANDS: Bands = { hem: 6, cuff: 7 };

export interface KnitDressDraft {
  pieces: Piece[];
  /** The T-shirt it is built on (front, back, sleeve, neckband). */
  tee: TeeDraft;
  style: KnitDressStyle;
  /** Hem below the waist at the side, and round the hem, finished. */
  belowWaist: number;
  hemCm: number;
  /** The skater skirt's waist and hem radius, when it has one. */
  skater?: { waistCm: number; radius: number; length: number };
  bands?: { hemBand?: number; cuff?: number };
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function draftKnitDress(m: KnitDressMeasurements, style: Partial<KnitDressStyle> = {}): KnitDressDraft {
  const s: KnitDressStyle = { ...DEFAULT_KNIT_DRESS, ...style };
  if (!(m.waist_to_knee > 0) || !(m.waist_to_floor > 0)) throw new DraftError('Add your waist to knee and waist to floor for the dress length.');
  const total = lengthBelowWaist(m, s.length);
  const bands = s.ribbed ? DRESS_BANDS : undefined;
  const belowWaist = total - (bands?.hem ?? 0);
  const below = Math.max(0, belowWaist - m.waist_to_hip);
  const hemFlare = s.skirt === 'hugging' ? HUG[s.stretch] : s.skirt === 'aline' ? (below / 10) * A_LINE_PER_10 : s.fit === 'relaxed' ? 1 : 0.5;
  const sleeveCm = bands ? sleeveMinusCuff(m, s, bands.cuff) : undefined;
  const tee = draftTee(m, {
    fit: s.fit,
    stretch: s.stretch,
    neckline: s.neckline,
    sleeve: s.sleeve,
    length: 'tunic',
    flatFront: s.flatFront,
    carry: { belowWaist: s.skirt === 'skater' ? 0 : belowWaist, hemFlare },
    ...(sleeveCm !== undefined ? { sleeveCm } : {}),
  });
  const warnings = [...tee.warnings];
  const [front, back, ...rest] = tee.pieces;
  const named = (pc: Piece, name: string, label: string): Piece => ({
    ...pc,
    name,
    labels: pc.labels.map((l) => (l.text === 'TEE FRONT' || l.text === 'TEE BACK' ? { ...l, text: label } : l)),
  });
  const body = [named(front, 'Dress front', s.skirt === 'skater' ? 'BODICE FRONT' : 'DRESS FRONT'), named(back, 'Dress back', s.skirt === 'skater' ? 'BODICE BACK' : 'DRESS BACK')];
  const pieces: Piece[] = [...body, ...rest];
  let skater: KnitDressDraft['skater'];
  let hemCm = tee.finishedHem;
  if (s.skirt === 'skater') {
    // The skirt's waist matches the bodice's waist edge, front and back alike.
    const waistCm = 2 * (taggedLength(front.outline, 'hem') + taggedLength(back.outline, 'hem'));
    const length = belowWaist;
    const r = waistCm / (2 * Math.PI * SKATER_CIRCLE);
    skater = { waistCm: r1(waistCm), radius: r1(r), length: r1(length) };
    hemCm = 2 * Math.PI * SKATER_CIRCLE * (r + length);
    pieces.splice(2, 0, skirtPiece('Skirt front', r, length, SKATER_CIRCLE), skirtPiece('Skirt back', r, length, SKATER_CIRCLE, true));
  }
  let bandInfo: KnitDressDraft['bands'];
  if (bands) {
    const passage = Math.max(m.full_bust, belowWaist > m.waist_to_hip ? m.full_hip : 0) * 1.02;
    const rb = ribBands(bands, hemCm, tee.sleeve.hemCm, passage);
    pieces.push(...rb.pieces);
    bandInfo = { hemBand: rb.hemBand, cuff: rb.cuff };
    // The band and cuffs are sewn on in place of the hems.
    for (const pc of pieces.slice(0, 2)) pc.allowances = { ...pc.allowances, hem: KNIT_SEAM };
  }
  return { pieces, tee, style: s, belowWaist: r1(total), hemCm: r1(hemCm), skater, bands: bandInfo, warnings };
}

/** The sleeve's length less the cuff it is sewn to. */
function sleeveMinusCuff(m: TeeMeasurements, s: KnitDressStyle, cuff: number): number | undefined {
  const full = draftTee(m, { fit: s.fit, stretch: s.stretch, neckline: s.neckline, sleeve: s.sleeve }).sleeve;
  return Math.max(full.length.min, full.length.cm - cuff);
}

/**
 * One half of the skater skirt, cut on the fold at the centre: a sector of a ring whose inner arc is a quarter of the
 * waist. The waist and the hem are arcs round one centre, so the side seam runs square off both and the hem hangs level.
 */
function skirtPiece(name: string, r: number, length: number, circle: number, back = false): Piece {
  const a = (2 * Math.PI * circle) / 4;
  const at = (rad: number, t: number) => p(rad * Math.sin(t), rad * Math.cos(t) - r);
  /** An arc round the centre from angle t0 to t1 as true curves (four of them), so its ends meet the side and the
   *  fold square: a cubic per quarter of the sweep, its handles a/3 * 4 tan(sweep / 4) long. */
  const arcTo = (path: Path, rad: number, t0: number, t1: number, tag: string) => {
    const n = 4;
    const d = (t1 - t0) / n;
    const k = (4 / 3) * Math.tan(d / 4) * rad;
    for (let i = 0; i < n; i++) {
      const u0 = t0 + d * i;
      const u1 = u0 + d;
      const tan = (u: number) => p(Math.cos(u), -Math.sin(u));
      const q0 = at(rad, u0);
      const q1 = at(rad, u1);
      path.curve(p(q0.x + tan(u0).x * k, q0.y + tan(u0).y * k), p(q1.x - tan(u1).x * k, q1.y - tan(u1).y * k), q1, tag);
    }
  };
  const outline = new Path(at(r, 0));
  arcTo(outline, r, 0, a, 'waist');
  outline.line(at(r + length, a), 'side');
  arcTo(outline, r + length, a, 0, 'hem');
  outline.line(at(r, 0), 'fold');
  outline.closed = true;
  const arc = (rad: number, m = 24) => Array.from({ length: m + 1 }, (_, i) => at(rad, (a * i) / m));
  const waist = arc(r);
  const mid = (q: P[]) => q[Math.round(q.length * 0.45)];
  const cut = 'Cut 1 on fold';
  const label = back ? 'SKIRT BACK' : 'SKIRT FRONT';
  const labelAt = mid(arc(r + length * 0.35));
  return {
    name,
    outline,
    lines: [],
    grain: [p(0.5, length * 0.25), p(0.5, length * 0.75)],
    fold: [p(0, 2), p(0, length - 2)],
    notches: back ? [[mid(waist), p(0, -1)], [p(mid(waist).x + 0.6, mid(waist).y), p(0, -1)]] : [[mid(waist), p(0, -1)]],
    labels: [
      { at: labelAt, text: label, size: 1.4 },
      { at: p(labelAt.x, labelAt.y + 2), text: cut, size: 0.9 },
    ],
    cut,
    seamAllowance: KNIT_SEAM,
    allowances: { waist: KNIT_SEAM, side: KNIT_SEAM, hem: KNIT_HEM, fold: 0 },
    meta: { knit: true, skater: true, ...(back ? { foldAt: 'centre back' } : {}) },
  };
}
