// Rib bands for knits built on the T-shirt (Garment range, Cat 2026-11-07): a band round the hem and cuffs at the
// wrists, as on a sweatshirt, a hoodie and a jumper dress. Each is a strip folded in half lengthwise, cut on the fold,
// shorter than the edge it is sewn to so the rib pulls it in, but never so short it can't pass over the hips, the
// shoulders or the hand.
import { p } from './geometry';
import { Path } from './geometry';
import type { Piece } from './piece';
import { KNIT_SEAM } from './tee';

/** How far rib is cut shorter than the edge it is sewn to. */
const RIB_RATIO = { hem: 0.85, cuff: 0.75 };
/** How far a rib band stretches on and off without strain: a quarter past its length is comfortable. */
export const RIB_STRETCH = 1.3;
/** The least a cuff can be round and still pass the hand (a hand is about 21 cm round the knuckles). */
export const HAND_CM = 21;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A band's cut length: the edge's length pulled in by rib, but no less than what must pass through it, stretched. */
function ribLength(edge: number, ratio: number, passage: number): number {
  return Math.max(edge * ratio, passage / RIB_STRETCH);
}

/** One rib band: half its length wide (cut on the fold), twice its finished depth high (folded in half). */
function ribPiece(name: string, length: number, depth: number, cut = 'Cut 1 on fold from rib'): Piece {
  const L = length / 2;
  const Hh = 2 * depth;
  const outline = new Path(p(0, 0)).line(p(L, 0), 'band').line(p(L, Hh), 'end').line(p(0, Hh), 'band').line(p(0, 0), 'fold');
  outline.closed = true;
  return {
    name,
    kind: 'band',
    outline,
    lines: [],
    grain: [p(L * 0.8, 0.4), p(L * 0.8, Hh - 0.4)],
    fold: [p(0, 0.5), p(0, Hh - 0.5)],
    notches: [
      [p(L / 2, 0), p(0, -1)],
      [p(L / 2, Hh), p(0, 1)],
    ],
    balance: [{ pts: [p(0, Hh / 2), p(L, Hh / 2)], label: 'FOLD LINE' }],
    labels: [
      { at: p(L * 0.3, Hh * 0.3), text: name.toUpperCase(), size: Math.min(0.9, depth * 0.25) },
      { at: p(L * 0.3, Hh * 0.8), text: `${cut}, stretch along it`, size: Math.min(0.5, depth * 0.15) },
    ],
    cut,
    fabric: 'rib knit',
    seamAllowance: KNIT_SEAM,
    allowances: { fold: 0 },
    meta: { lengthCm: r1(length), depthCm: depth, rib: true, foldAt: 'centre back' },
  };
}

export interface Bands {
  /** Finished depths, in cm. */
  hem: number;
  cuff: number;
}

/** The hem band and two cuffs for a body with this hem round it and sleeves this round at the hem. The band must
 *  pass the bust (or the hip, when it sits below it); a cuff the hand. */
export function ribBands(b: Bands, hemCm: number, sleeveHemCm: number | undefined, passage: number, hemRatio = RIB_RATIO.hem): { pieces: Piece[]; hemBand?: number; cuff?: number } {
  const pieces: Piece[] = [];
  let hemBand: number | undefined;
  let cuff: number | undefined;
  if (b.hem > 0) {
    hemBand = ribLength(hemCm, hemRatio, passage);
    pieces.push(ribPiece('Hem band', hemBand, b.hem));
  }
  if (b.cuff > 0 && sleeveHemCm) {
    cuff = ribLength(sleeveHemCm, RIB_RATIO.cuff, HAND_CM);
    pieces.push(ribPiece('Cuff', cuff, b.cuff, 'Cut 2 on fold from rib'));
  }
  return { pieces, hemBand: hemBand && r1(hemBand), cuff: cuff && r1(cuff) };
}
