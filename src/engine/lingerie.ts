// Soft lingerie and swimwear (Cat's Swim and Intimates drop, 2026-10-18): briefs, a wire-free
// bralette, a bodysuit, a one-piece swimsuit and a bikini. All are cut for stretch fabric at negative
// ease, so they're smaller than the body and the knit and the elastic do the shaping.
//
// - Round the body: every width is the body's measurement less a share, set by the stretch, the way
//   the T-shirt's fitted ease works (tee.ts), only closer.
// - Down the body: a knit that stretches lengthwise too (swim Lycra, four-way stretch) is also cut
//   shorter, so a swimsuit doesn't sag when it's wet.
// - The crotch: front, gusset and back share the crotch length (waist to waist between the legs),
//   the gusset cut twice, once in cotton or swim lining.
// - The bralette's cup is a triangle sized from the full bust over the underbust and placed by the
//   apex separation, with a dart under the apex for the bust's depth. Wired bras are a later draft.
// - Elastic for every edge is worked out here, shorter than the edge it's sewn to.
import { P, Path, add, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { DraftError } from './skirt';

export type LingeriePiece = 'brief' | 'bralette' | 'bodysuit' | 'swimsuit' | 'bikini';
/** How far the knit stretches across: medium for most jersey and lace, high for power mesh and Lycra. */
export type LingerieStretch = 'medium' | 'high';
export type LegCut = 'classic' | 'high';
export type Rise = 'high' | 'mid';
export type CupStyle = 'triangle' | 'longline';

export interface LingerieMeasurements {
  full_bust?: number;
  /** Snug round the ribcage, just under the breasts. */
  underbust?: number;
  apex_separation?: number;
  bust_depth?: number;
  waist: number;
  full_hip: number;
  waist_to_hip: number;
  /** Front waist through the legs to back waist. */
  crotch_length?: number;
  nape_to_waist?: number;
  neck?: number;
  shoulder_width?: number;
}

export interface LingerieStyle {
  piece: LingeriePiece;
  stretch: LingerieStretch;
  leg: LegCut;
  rise: Rise;
  cup: CupStyle;
}

export const DEFAULT_LINGERIE: LingerieStyle = { piece: 'brief', stretch: 'medium', leg: 'classic', rise: 'high', cup: 'triangle' };

/** Swimwear is cut in four-way stretch, lined, and shortened down the body. */
export const isSwim = (piece: LingeriePiece) => piece === 'swimsuit' || piece === 'bikini';

/** Ease round the body as a share of it: always negative. Swim Lycra holds closer than jersey. */
export const LINGERIE_EASE: Record<LingerieStretch, number> = { medium: -0.08, high: -0.12 };
/** How much shorter than the body down its length: a little for jersey, more for four-way swim Lycra. */
export const LENGTH_REDUCTION = { knit: 0.03, swim: 0.08 };
/** The bralette's band, cut this much under the underbust so it grips. */
export const BAND_EASE: Record<LingerieStretch, number> = { medium: -0.1, high: -0.14 };
/** Elastic as a share of the edge it's sewn to. */
export const ELASTIC_RATIO = { waist: 0.94, leg: 0.85, neck: 0.9, armhole: 0.9, cup: 0.92, band: 0.88 };
/** How the crotch length is shared out along the centre: front piece, gusset, back piece. */
export const CROTCH_SHARE = { front: 0.3, gusset: 0.22, back: 0.48 };
/** Gusset widths in cm, edge to edge: where it meets the front, its narrowest, where it meets the back. */
export const GUSSET = { front: 8, narrow: 6.5, back: 12 };
/** Elastic edges are turned once over 1 cm elastic; seams are overlocked at 1 cm. */
export const LINGERIE_SEAM = 1;
/** How far a mid rise sits below the waist, in cm. */
const MID_DROP = 6;

export interface Elastic {
  edge: string;
  /** Cut length in cm, joined into a loop where it goes all round. */
  length: number;
  width: number;
}

export interface LingerieDraft {
  pieces: Piece[];
  style: LingerieStyle;
  easePct: number;
  lengthReduction: number;
  finishedHip: number;
  finishedWaist?: number;
  finishedBust?: number;
  finishedBand?: number;
  elastic: Elastic[];
  /** Strap elastic, each, with room to adjust on a slider. */
  strap?: number;
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The measurements each piece needs, beyond the waist and hip. */
export const LINGERIE_NEEDS: Record<LingeriePiece, (keyof LingerieMeasurements)[]> = {
  brief: ['crotch_length'],
  bralette: ['full_bust', 'underbust', 'apex_separation', 'nape_to_waist'],
  bikini: ['full_bust', 'underbust', 'apex_separation', 'nape_to_waist', 'crotch_length'],
  bodysuit: ['full_bust', 'nape_to_waist', 'neck', 'shoulder_width', 'crotch_length'],
  swimsuit: ['full_bust', 'nape_to_waist', 'neck', 'shoulder_width', 'crotch_length'],
};

export function draftLingerie(m: LingerieMeasurements, style: Partial<LingerieStyle> = {}): LingerieDraft {
  const s: LingerieStyle = { ...DEFAULT_LINGERIE, ...style };
  for (const k of ['waist', 'full_hip', 'waist_to_hip', ...LINGERIE_NEEDS[s.piece]] as const) {
    if (!((m[k] ?? 0) > 0)) throw new DraftError('A few measurements are missing for this piece.');
  }
  // Swimwear is always cut for a high-stretch Lycra.
  const stretch: LingerieStretch = isSwim(s.piece) ? 'high' : s.stretch;
  const e = LINGERIE_EASE[stretch];
  const lr = isSwim(s.piece) ? LENGTH_REDUCTION.swim : LENGTH_REDUCTION.knit;
  const warnings: string[] = [];
  const out: LingerieDraft = { pieces: [], style: { ...s, stretch }, easePct: e, lengthReduction: lr, finishedHip: r1(m.full_hip * (1 + e)), elastic: [], warnings };
  const swimNote = isSwim(s.piece) ? ' Cut the lining from the same piece.' : '';

  if (s.piece === 'brief' || s.piece === 'bikini') {
    const b = brief(m, s, e, lr, swimNote);
    out.pieces.push(...b.pieces);
    out.elastic.push(...b.elastic);
    out.finishedWaist = b.top;
  }
  if (s.piece === 'bralette' || s.piece === 'bikini') {
    const t = bralette(m, s, stretch, swimNote);
    out.pieces.unshift(...t.pieces);
    out.elastic.push(...t.elastic);
    out.finishedBust = t.bust;
    out.finishedBand = t.band;
    out.strap = t.strap;
  }
  if (s.piece === 'bodysuit' || s.piece === 'swimsuit') {
    const o = onePiece(m, s, e, lr, swimNote);
    out.pieces.push(...o.pieces);
    out.elastic.push(...o.elastic);
    out.finishedBust = o.bust;
    out.finishedWaist = o.waist;
  }
  return out;
}

/** Width round the body at `y` cm below the waist, between the waist and the hip. */
const girthAt = (m: LingerieMeasurements, y: number) => m.waist + (m.full_hip - m.waist) * Math.min(1, Math.max(0, y / m.waist_to_hip));

/** Where the leg opening starts at the side, in cm below the waist, and how deep it scoops. */
function legLine(m: LingerieMeasurements, top: number, leg: LegCut) {
  const WH = m.waist_to_hip;
  const sideEnd = leg === 'high' ? top + Math.max(5, (WH - top) * 0.4) : Math.max(top + 7, WH - 3);
  return { sideEnd, scoop: leg === 'high' ? 0.75 : 0.45 };
}

interface Lower {
  /** Front and back from their top edge down: the top edge (path start to the side) is the caller's. */
  frontEnd: number;
  backEnd: number;
  sideEnd: number;
  sideQ: number;
  scoop: number;
}

/** The crotch ends and the side seam's foot, shared by the brief and the one-piece. `waistY` is where
 * the waist falls on the piece. */
function lowerOf(m: LingerieMeasurements, s: LingerieStyle, e: number, lr: number, waistY: number, top: number): Lower {
  const CL = m.crotch_length!;
  const k = 1 - lr;
  const { sideEnd, scoop } = legLine(m, top, s.leg);
  return {
    frontEnd: waistY + CL * CROTCH_SHARE.front * k,
    backEnd: waistY + CL * CROTCH_SHARE.back * k,
    sideEnd: waistY + sideEnd * k,
    sideQ: (girthAt(m, sideEnd) * (1 + e)) / 4,
    scoop,
  };
}

/** From the side seam's foot round the leg to the crotch, then up the centre to the fold. */
function legAndCrotch(path: Path, L: Lower, back: boolean, top: P) {
  const end = back ? L.backEnd : L.frontEnd;
  const half = (back ? GUSSET.back : GUSSET.front) / 2;
  const foot = p(L.sideQ, L.sideEnd);
  const C = p(half, end);
  const drop = end - foot.y;
  if (back) {
    // The back leg swings out over the seat before it turns in to the gusset; a high cut covers less.
    const out = L.scoop > 0.6 ? 0.55 : 0.9;
    path.curve(p(foot.x * out, foot.y + drop * 0.55), p(half + (foot.x - half) * 0.35, end - drop * 0.08), C, 'leg');
  } else {
    path.curve(p(foot.x - (foot.x - half) * L.scoop, foot.y + drop * 0.1), p(half + 1.2, end - drop * (0.75 - L.scoop * 0.4)), C, 'leg');
  }
  return path.line(p(0, end), 'gusset').line(top, 'fold');
}

function gussetPiece(L: Lower, lr: number, m: LingerieMeasurements, swim: boolean): Piece {
  const len = m.crotch_length! * CROTCH_SHARE.gusset * (1 - lr);
  const f = GUSSET.front / 2;
  const n = GUSSET.narrow / 2;
  const b = GUSSET.back / 2;
  const outline = new Path(p(0, 0))
    .line(p(f, 0), 'gusset')
    .curve(p(n, len * 0.25), p(n, len * 0.5), p((n + b) / 2, len * 0.75), 'leg')
    .curve(p(b - 0.3, len * 0.88), p(b, len * 0.95), p(b, len), 'leg')
    .line(p(0, len), 'gusset')
    .line(p(0, 0), 'fold');
  outline.closed = true;
  const cut = swim ? 'Cut 2 on fold: 1 Lycra, 1 lining' : 'Cut 2 on fold: 1 fabric, 1 cotton jersey';
  void L;
  return {
    name: 'Gusset',
    outline,
    lines: [],
    grain: [p(1, len * 0.2), p(1, len * 0.8)],
    fold: [p(0, 0.5), p(0, len - 0.5)],
    notches: [],
    labels: [
      { at: p(1, len * 0.4), text: 'GUSSET', size: 0.8 },
      { at: p(1, len * 0.55), text: cut, size: 0.4 },
    ],
    cut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { fold: 0 },
    meta: { knit: true, lingerie: 'gusset' },
  };
}

function brief(m: LingerieMeasurements, s: LingerieStyle, e: number, lr: number, swimNote: string) {
  const top = s.rise === 'mid' ? MID_DROP : 0;
  const k = 1 - lr;
  const topY = top * k;
  const topQ = (girthAt(m, top) * (1 + e)) / 4;
  const L = lowerOf(m, s, e, lr, 0, top);
  const swim = isSwim(s.piece);
  const cut = 'Cut 1 on fold';
  const piece = (back: boolean): Piece => {
    // The back rises a little higher at the centre to cover the seat when sitting.
    const cy = back ? topY - 1.5 : topY;
    const start = p(0, cy);
    // The waist meets the side seam square, so it runs on smoothly round the body.
    const sd = unit(sub(p(L.sideQ, L.sideEnd), p(topQ, topY)));
    const path = new Path(start).curve(p(topQ * 0.4, cy), add(p(topQ, topY), mul(p(-sd.y, sd.x), topQ * 0.3)), p(topQ, topY), 'waist').line(p(L.sideQ, L.sideEnd), 'side');
    legAndCrotch(path, L, back, start);
    path.closed = true;
    const name = `${swim ? 'Bikini' : 'Brief'} ${back ? 'back' : 'front'}`;
    return {
      name,
      outline: path,
      lines: [],
      grain: [p(topQ * 0.35, topY + 2), p(topQ * 0.35, L.sideEnd)],
      fold: [p(0, cy + 0.5), p(0, (back ? L.backEnd : L.frontEnd) - 0.5)],
      notches: back ? [[p(L.sideQ, L.sideEnd - 1.5), p(1, 0)], [p(L.sideQ, L.sideEnd - 2.5), p(1, 0)]] : [[p(L.sideQ, L.sideEnd - 2), p(1, 0)]],
      labels: [
        { at: p(1, topY + 3), text: name.toUpperCase(), size: 0.9 },
        { at: p(1, topY + 4.5), text: `${cut}, stretch across.${swimNote}`, size: 0.45 },
      ],
      cut,
      seamAllowance: LINGERIE_SEAM,
      allowances: { fold: 0 },
      meta: { knit: true, lingerie: back ? 'back' : 'front' },
    };
  };
  const front = piece(false);
  const back = piece(true);
  const gusset = gussetPiece(L, lr, m, swim);
  const waistEdge = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
  const legEdge = taggedLength(front.outline, 'leg') + taggedLength(back.outline, 'leg') + taggedLength(gusset.outline, 'leg');
  return {
    pieces: [front, back, gusset],
    top: r1(4 * topQ),
    elastic: [
      { edge: 'Waist', length: r1(waistEdge * ELASTIC_RATIO.waist), width: 1 },
      { edge: 'Each leg', length: r1(legEdge * ELASTIC_RATIO.leg), width: 1 },
    ],
  };
}

function bralette(m: LingerieMeasurements, s: LingerieStyle, stretch: LingerieStretch, swimNote: string) {
  const UB = m.underbust!;
  const FB = m.full_bust!;
  const diff = Math.max(4, FB - UB);
  const apexX = m.apex_separation! / 2 - 0.5;
  // The cup's base, centre to side, the dart under the apex taking the bust's depth.
  const dart = Math.min(5, diff * 0.22);
  const base = apexX + 0.3 * diff + 0.07 * UB + dart;
  const height = 0.7 * diff + 7;
  const tip = p(apexX - 1, 0);
  const sideTop = s.cup === 'longline' ? p(base, height * 0.7) : p(base, height);
  const apex = p(apexX + dart / 2, height - (0.45 * diff + 3));
  const dl = p(apexX, height);
  const dr = p(apexX + dart, height);
  const cupPath = new Path(p(0, height))
    .curve(p(tip.x * 0.15, height * 0.6), p(tip.x * 0.7, height * 0.15), tip, 'inner')
    .curve(lerp(tip, sideTop, 0.35), p(base - 1.5, sideTop.y * 0.55), sideTop, 'outer');
  if (sideTop.y < height) cupPath.line(p(base, height), 'side');
  cupPath.line(dr, 'base').line(apex, 'dart').line(dl, 'dart').line(p(0, height), 'base');
  cupPath.closed = true;
  const swim = isSwim(s.piece);
  const name = swim ? 'Bikini cup' : 'Bralette cup';
  const cupCut = swim ? 'Cut 2 Lycra + 2 lining (a pair each)' : 'Cut 2 (a pair)';
  const cup: Piece = {
    name,
    outline: cupPath,
    lines: [],
    grain: [p(apexX * 0.6, height * 0.4), p(apexX * 0.6, height - 1.5)],
    notches: [[apex, p(0, -1)]],
    labels: [
      { at: p(apexX + dart + 1, height - 3), text: name.toUpperCase(), size: 0.8 },
      { at: p(apexX + dart + 1, height - 2), text: `${cupCut}, stretch across.`, size: 0.4 },
    ],
    cut: cupCut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { dart: 0 },
    meta: { knit: true, lingerie: 'cup' },
  };

  const bandH = s.cup === 'longline' ? 10 : 4;
  const bandHalf = (UB * (1 + BAND_EASE[stretch])) / 2;
  const bandPath = new Path(p(0, 0)).line(p(bandHalf, 0), 'top').line(p(bandHalf, bandH), 'cb').line(p(0, bandH), 'hem').line(p(0, 0), 'fold');
  bandPath.closed = true;
  const bandCut = `Cut ${swim ? '2 on fold: 1 Lycra, 1 lining' : '1 on fold'}`;
  const band: Piece = {
    name: swim ? 'Bikini band' : 'Bralette band',
    kind: 'band',
    outline: bandPath,
    lines: [],
    grain: [p(bandHalf * 0.8, 0.5), p(bandHalf * 0.8, bandH - 0.5)],
    fold: [p(0, 0.5), p(0, bandH - 0.5)],
    notches: [[p(apexX * 0.9 + 0.5, 0), p(0, -1)]],
    labels: [{ at: p(2, bandH * 0.6), text: `BAND · ${bandCut}, stretch along it.${swimNote}`, size: 0.4 }],
    cut: bandCut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { fold: 0 },
    meta: { knit: true, lingerie: 'band', lengthCm: r1(bandHalf * 2) },
  };
  const cupEdge = taggedLength(cupPath, 'inner') + taggedLength(cupPath, 'outer');
  const strap = r1(m.nape_to_waist! * 0.8 + 5);
  return {
    pieces: [cup, band],
    bust: r1(FB * (1 + LINGERIE_EASE[stretch])),
    band: r1(bandHalf * 2),
    strap,
    elastic: [
      { edge: 'Under the band', length: r1(UB * ELASTIC_RATIO.band), width: 1.5 },
      { edge: 'Each cup edge', length: r1(cupEdge * ELASTIC_RATIO.cup), width: 0.8 },
      { edge: 'Each strap', length: strap, width: 1 },
    ],
  };
}

function onePiece(m: LingerieMeasurements, s: LingerieStyle, e: number, lr: number, swimNote: string) {
  const k = 1 - lr;
  const FB = m.full_bust!;
  const NW = m.nape_to_waist! * k;
  const swim = isSwim(s.piece);
  const bustQ = (FB * (1 + e)) / 4;
  const waistQ = (m.waist * (1 + e)) / 4;
  const L = lowerOf(m, s, e, lr, NW, 0);
  const hipY = NW + m.waist_to_hip * k;
  const hipQ = (m.full_hip * (1 + e)) / 4;
  const scye = (18.5 + (FB - 88) * 0.1) * k;
  const nw = m.neck! / 5 + 1.5;
  // A 3 cm strap at the shoulder, ending well inside the shoulder point.
  const strapIn = p(nw, 1);
  const strapOut = p(Math.min(nw + 3, m.shoulder_width! / 2 - 2), 2);
  const U = p(bustQ, scye);
  // Neckline and armhole leave the strap square, so they blend across the shoulder seam.
  const sh = unit(sub(strapOut, strapIn));
  const down = p(-sh.y, sh.x);
  const side = (path: Path) => {
    path.line(strapOut, 'shoulder').curve(add(strapOut, mul(down, scye * 0.3)), p(U.x - 2.5, scye), U, 'armhole');
    const d1 = NW - scye;
    path.curve(p(U.x, scye + d1 * 0.4), p(waistQ, NW - d1 * 0.35), p(waistQ, NW), 'side');
    if (L.sideEnd > hipY - 0.5) {
      const d2 = hipY - NW;
      path.curve(p(waistQ, NW + d2 * 0.4), p(hipQ, hipY - d2 * 0.4), p(hipQ, hipY), 'side');
      if (L.sideEnd > hipY) path.line(p(L.sideQ, L.sideEnd), 'side');
    } else {
      const d2 = L.sideEnd - NW;
      path.curve(p(waistQ, NW + d2 * 0.4), p(L.sideQ, L.sideEnd - d2 * 0.4), p(L.sideQ, L.sideEnd), 'side');
    }
    return path;
  };
  const frontDepth = Math.min(scye - 2, (m.bust_depth ?? 25) * 0.55 * k);
  const backDepth = swim ? Math.min(NW - 6, NW * 0.6) : 8;
  const cut = 'Cut 1 on fold';
  const make = (back: boolean): Piece => {
    const cy = back ? backDepth : frontDepth;
    const start = p(0, cy);
    const path = new Path(start).curve(p(nw * 0.6, cy), add(strapIn, mul(down, cy * 0.45)), strapIn, 'neck');
    side(path);
    legAndCrotch(path, L, back, start);
    path.closed = true;
    const name = `${swim ? 'Swimsuit' : 'Bodysuit'} ${back ? 'back' : 'front'}`;
    return {
      name,
      outline: path,
      lines: [],
      grain: [p(bustQ * 0.45, scye + 2), p(bustQ * 0.45, hipY)],
      fold: [p(0, cy + 0.5), p(0, (back ? L.backEnd : L.frontEnd) - 0.5)],
      balance: [{ pts: [p(0, NW), p(waistQ, NW)], label: 'WAIST LINE' }],
      notches: back ? [[p(waistQ, NW - 0.5), p(1, 0)], [p(waistQ, NW + 0.5), p(1, 0)]] : [[p(waistQ, NW), p(1, 0)]],
      labels: [
        { at: p(1.5, scye + 4), text: name.toUpperCase(), size: 1.1 },
        { at: p(1.5, scye + 6), text: `${cut}, stretch across.${swimNote}`, size: 0.5 },
      ],
      cut,
      seamAllowance: LINGERIE_SEAM,
      allowances: { fold: 0 },
      meta: { knit: true, lingerie: back ? 'back' : 'front', shoulderEase: 0 },
    };
  };
  const front = make(false);
  const back = make(true);
  const gusset = gussetPiece(L, lr, m, swim);
  const neckEdge = 2 * (taggedLength(front.outline, 'neck') + taggedLength(back.outline, 'neck'));
  const armEdge = taggedLength(front.outline, 'armhole') + taggedLength(back.outline, 'armhole');
  const legEdge = taggedLength(front.outline, 'leg') + taggedLength(back.outline, 'leg') + taggedLength(gusset.outline, 'leg');
  return {
    pieces: [front, back, gusset],
    bust: r1(4 * bustQ),
    waist: r1(4 * waistQ),
    elastic: [
      { edge: 'Neckline, front and back', length: r1(neckEdge * ELASTIC_RATIO.neck), width: 1 },
      { edge: 'Each armhole', length: r1(armEdge * ELASTIC_RATIO.armhole), width: 1 },
      { edge: 'Each leg', length: r1(legEdge * ELASTIC_RATIO.leg), width: 1 },
    ],
  };
}

/** The pieces a lingerie choice makes, in words. */
export const LINGERIE_NAMES: Record<LingeriePiece, string> = { brief: 'brief', bralette: 'bralette', bodysuit: 'bodysuit', swimsuit: 'swimsuit', bikini: 'bikini' };
