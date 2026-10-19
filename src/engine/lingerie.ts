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
  /** From the top of one shoulder down over the bust, through the legs and up the back to the same shoulder. */
  torso_loop?: number;
}

/** Which way the knit stretches: both ways (Lycra, most power mesh and jersey with elastane) or across only (much lace). */
export type StretchWay = 'four' | 'two';

/** What the maker saw when they tried one on: each answer moves the next draft. Absent means it was right. */
export interface LingerieFit {
  size?: 'snug' | 'loose';
  leg?: 'gapes' | 'digs';
  back?: 'rides';
  straps?: 'slip' | 'dig';
  cup?: 'full' | 'empty';
  torso?: 'short' | 'long';
}

export interface LingerieStyle {
  piece: LingeriePiece;
  stretch: LingerieStretch;
  way: StretchWay;
  leg: LegCut;
  rise: Rise;
  cup: CupStyle;
  /** The bodysuit's crotch: sewn closed, or snapped. */
  closure: 'none' | 'snaps';
  tried?: LingerieFit;
}

export const DEFAULT_LINGERIE: LingerieStyle = { piece: 'brief', stretch: 'medium', way: 'four', leg: 'classic', rise: 'high', cup: 'triangle', closure: 'none' };

/** Swimwear is cut in four-way stretch, lined, and shortened down the body. */
export const isSwim = (piece: LingeriePiece) => piece === 'swimsuit' || piece === 'bikini';

/** Ease round the body as a share of it: always negative. Swim Lycra holds closer than jersey. */
export const LINGERIE_EASE: Record<LingerieStretch, number> = { medium: -0.08, high: -0.12 };
/** How much shorter than the body down its length: a little for jersey, more for four-way swim Lycra.
 * A knit that stretches across only isn't shortened at all. */
export const LENGTH_REDUCTION = { knit: 0.03, swim: 0.08, two: 0 };
/** The bralette's band, cut this much under the underbust so it grips. */
export const BAND_EASE: Record<LingerieStretch, number> = { medium: -0.1, high: -0.14 };
/** Elastic as a share of the edge it's sewn to. */
export const ELASTIC_RATIO = { waist: 0.94, leg: 0.85, neck: 0.9, armhole: 0.9, cup: 0.92, band: 0.88, shelf: 0.9 };
/** How the crotch length is shared out along the centre: front piece, gusset, back piece. */
export const CROTCH_SHARE = { front: 0.3, gusset: 0.22, back: 0.48 };
/** Gusset widths in cm, edge to edge: where it meets the front, its narrowest, where it meets the back. */
export const GUSSET = { front: 8, narrow: 6.5, back: 12 };
/** Seams are overlocked at 1 cm. */
export const LINGERIE_SEAM = 1;
/** Elastic widths in cm: each elastic edge's allowance is the same, so the edge turns once over it. */
export const ELASTIC_WIDTH = { waistHigh: 2, waistMid: 1.5, swim: 1, edge: 1, band: 1.5, cup: 0.8, strap: 1 };
/** Joined loops overlap this much where the ends are zigzagged together. */
export const LOOP_OVERLAP = 1;
/** Hook-and-eye tape, closed on its middle row: the band is cut this much short so it closes at size. */
export const HOOK_TAPE = 3;
/** Above this gap between bust and underbust the soft cup is cut in two pieces with a seam, not a dart. */
export const SEAMED_CUP_GAP = 15;
/** Above this gap a soft cup gives only light support. */
export const SOFT_CUP_LIMIT = 25;
/** The snapped bodysuit's gusset overlap, front over back, in cm. */
export const SNAP_OVERLAP = 3;
/** How much one fit answer moves the draft. */
const FIT_STEP = { ease: 0.03, leg: 0.05, back: 1.5, strap: 2, strapIn: 1, cup: 3, torso: 1.5 };
/** How far a mid rise sits below the waist, in cm. */
const MID_DROP = 6;

export interface Elastic {
  edge: string;
  /** Cut length in cm, with the overlap for joining where it goes all round. */
  length: number;
  width: number;
  /** How many to cut. */
  count: number;
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
  /** The bralette's cup is cut in two pieces with a seam. */
  seamedCup?: boolean;
  warnings: string[];
  /** What the fit answers changed, in words. */
  fitNotes: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The measurements each piece needs, beyond the waist and hip. */
export const LINGERIE_NEEDS: Record<LingeriePiece, (keyof LingerieMeasurements)[]> = {
  brief: ['crotch_length'],
  bralette: ['full_bust', 'underbust', 'apex_separation', 'nape_to_waist'],
  bikini: ['full_bust', 'underbust', 'apex_separation', 'nape_to_waist', 'crotch_length'],
  bodysuit: ['full_bust', 'underbust', 'nape_to_waist', 'neck', 'shoulder_width', 'crotch_length', 'torso_loop'],
  swimsuit: ['full_bust', 'underbust', 'nape_to_waist', 'neck', 'shoulder_width', 'crotch_length', 'torso_loop'],
};

/** The measurements this piece still needs. */
export const lingerieMissing = (m: Partial<LingerieMeasurements>, piece: LingeriePiece) =>
  (['waist', 'full_hip', 'waist_to_hip', ...LINGERIE_NEEDS[piece]] as (keyof LingerieMeasurements)[]).filter((k) => !((m[k] ?? 0) > 0));

const FIT_WORDS: Record<string, string> = {
  'size:snug': 'cut 3% roomier all round',
  'size:loose': 'cut 3% closer all round',
  'leg:gapes': 'leg elastic cut shorter',
  'leg:digs': 'leg elastic cut longer',
  'back:rides': 'more seat coverage at the back',
  'straps:slip': 'straps set closer to the neck and cut shorter',
  'straps:dig': 'straps cut longer',
  'cup:full': 'cups cut fuller',
  'cup:empty': 'cups cut flatter',
  'torso:short': 'body cut longer',
  'torso:long': 'body cut shorter',
};

export function draftLingerie(m: LingerieMeasurements, style: Partial<LingerieStyle> = {}): LingerieDraft {
  const s: LingerieStyle = { ...DEFAULT_LINGERIE, ...style };
  if (lingerieMissing(m, s.piece).length) throw new DraftError('A few measurements are missing for this piece.');
  const swim = isSwim(s.piece);
  const fit = s.tried ?? {};
  // Swimwear is always cut for a four-way high-stretch Lycra.
  const stretch: LingerieStretch = swim ? 'high' : s.stretch;
  const way: StretchWay = swim ? 'four' : s.way;
  const e = LINGERIE_EASE[stretch] + (fit.size === 'snug' ? FIT_STEP.ease : fit.size === 'loose' ? -FIT_STEP.ease : 0);
  const lr = swim ? LENGTH_REDUCTION.swim : way === 'two' ? LENGTH_REDUCTION.two : LENGTH_REDUCTION.knit;
  const warnings: string[] = [];
  const fitNotes = Object.entries(fit)
    .filter(([, v]) => v)
    .map(([k, v]) => FIT_WORDS[`${k}:${v}`])
    .filter(Boolean);
  const out: LingerieDraft = { pieces: [], style: { ...s, stretch, way }, easePct: r1(e * 100) / 100, lengthReduction: lr, finishedHip: r1(m.full_hip * (1 + e)), elastic: [], warnings, fitNotes };
  const ctx: Ctx = { m, s, e, lr, swim, fit };

  if (s.piece === 'brief' || s.piece === 'bikini') {
    const b = brief(ctx);
    out.pieces.push(...b.pieces);
    out.elastic.push(...b.elastic);
    out.finishedWaist = b.top;
  }
  if (s.piece === 'bralette' || s.piece === 'bikini') {
    const t = bralette(ctx, stretch);
    out.pieces.unshift(...t.pieces);
    out.elastic.push(...t.elastic);
    out.finishedBust = t.bust;
    out.finishedBand = t.band;
    out.strap = t.strap;
    out.seamedCup = t.seamed;
    if (t.gap > SOFT_CUP_LIMIT) warnings.push('soft cup');
  }
  if (s.piece === 'bodysuit' || s.piece === 'swimsuit') {
    const o = onePiece(ctx);
    out.pieces.push(...o.pieces);
    out.elastic.push(...o.elastic);
    out.finishedBust = o.bust;
    out.finishedWaist = o.waist;
    if (o.torsoOff) warnings.push('torso loop');
  }
  return out;
}

interface Ctx {
  m: LingerieMeasurements;
  s: LingerieStyle;
  e: number;
  lr: number;
  swim: boolean;
  fit: LingerieFit;
}

/** Elastic for a loop: the edge times its ratio, with the overlap to join it. */
const loop = (edge: string, lengthCm: number, ratio: number, width: number, count = 1): Elastic => ({ edge, length: r1(lengthCm * ratio + LOOP_OVERLAP), width, count });

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
  /** The back leg swings this much wider over the seat, for coverage. */
  seat: number;
}

/** The crotch ends and the side seam's foot, shared by the brief and the one-piece. `waistY` is where
 * the waist falls on the piece; `bust` is extra front length that goes over the bust. */
function lowerOf(c: Ctx, waistY: number, top: number, bust = 0): Lower {
  const { m, s, e, lr, fit } = c;
  const CL = m.crotch_length!;
  const k = 1 - lr;
  const { sideEnd, scoop } = legLine(m, top, s.leg);
  const rides = fit.back === 'rides';
  return {
    frontEnd: waistY + CL * CROTCH_SHARE.front * k + bust,
    backEnd: waistY + CL * CROTCH_SHARE.back * k + (rides ? FIT_STEP.back : 0),
    sideEnd: waistY + sideEnd * k,
    sideQ: (girthAt(m, sideEnd) * (1 + e)) / 4,
    scoop,
    seat: rides ? 0.15 : 0,
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
    const out = (L.scoop > 0.6 ? 0.55 : 0.9) + L.seat;
    path.curve(p(foot.x * out, foot.y + drop * 0.55), p(half + (foot.x - half) * (0.35 + L.seat), end - drop * 0.08), C, 'leg');
  } else {
    path.curve(p(foot.x - (foot.x - half) * L.scoop, foot.y + drop * 0.1), p(half + 1.2, end - drop * (0.75 - L.scoop * 0.4)), C, 'leg');
  }
  return path.line(p(0, end), 'gusset').line(top, 'fold');
}

/** The gusset, cut whole (narrow end to the front), once in the fabric and once in cotton or lining.
 * Snapped, it's two pieces that overlap where the snap tape goes. */
function gussetPieces(c: Ctx, snaps: boolean): Piece[] {
  const len = c.m.crotch_length! * CROTCH_SHARE.gusset * (1 - c.lr);
  const f = GUSSET.front / 2;
  const n = GUSSET.narrow / 2;
  const b = GUSSET.back / 2;
  const lining = c.swim ? 'lining' : 'cotton jersey';
  /** Half-width down the gusset, from front (0) to back (len). */
  const halfAt = (y: number) => {
    const t = y / len;
    return t < 0.5 ? f + (n - f) * (t / 0.5) : n + (b - n) * ((t - 0.5) / 0.5) ** 1.6;
  };
  const make = (name: string, y0: number, y1: number, ends: [string, string]): Piece => {
    const steps = 8;
    const right = Array.from({ length: steps + 1 }, (_, i) => y0 + ((y1 - y0) * i) / steps).map((y) => p(halfAt(y), y - y0));
    const h = y1 - y0;
    const path = new Path(p(-halfAt(y0), 0)).line(right[0], ends[0]);
    for (let i = 1; i <= steps; i++) path.line(right[i], 'leg');
    path.line(p(-halfAt(y1), h), ends[1]);
    for (let i = steps - 1; i >= 0; i--) path.line(p(-right[i].x, right[i].y), 'leg');
    path.closed = true;
    const cut = `Cut 2: 1 ${c.swim ? 'Lycra' : 'fabric'}, 1 ${lining}`;
    return {
      name,
      outline: path,
      lines: [],
      grain: [p(n * 0.5, h * 0.25), p(n * 0.5, h * 0.75)],
      notches: [],
      labels: [
        { at: p(-n * 0.2, h * 0.5), text: name.toUpperCase(), size: 0.55, rotate: 90 },
        { at: p(-n * 0.6, h * 0.5), text: cut, size: 0.3, rotate: 90 },
      ],
      cut,
      seamAllowance: LINGERIE_SEAM,
      allowances: { leg: ELASTIC_WIDTH.edge, snap: 0 },
      meta: { knit: true, lingerie: 'gusset' },
    };
  };
  if (!snaps) return [make('Gusset', 0, len, ['gusset', 'gusset'])];
  // The front half laps over the back half; snap tape is sewn along the overlap.
  return [make('Gusset, front half', 0, len / 2 + SNAP_OVERLAP / 2, ['gusset', 'snap']), make('Gusset, back half', len / 2 - SNAP_OVERLAP / 2, len, ['snap', 'gusset'])];
}

/** One leg's edge: front, back, and one side of the gusset (or each half, less the overlap). */
function legEdge(front: Piece, back: Piece, gussets: Piece[]) {
  const g = gussets.reduce((a, pc) => a + taggedLength(pc.outline, 'leg') / 2, 0) - (gussets.length > 1 ? SNAP_OVERLAP : 0);
  return taggedLength(front.outline, 'leg') + taggedLength(back.outline, 'leg') + g;
}

/** Name, how many and which way the stretch runs, inside the piece and clear of the fold. */
function labelsFor(name: string, cut: string, at: P, size: number, swim: boolean) {
  return [
    { at, text: name.toUpperCase(), size },
    { at: add(at, p(0, size * 1.5)), text: `${cut}, most stretch across`, size: size * 0.45 },
    ...(swim ? [{ at: add(at, p(0, size * 2.2)), text: 'Cut the lining from this piece too', size: size * 0.45 }] : []),
  ];
}

function brief(c: Ctx) {
  const { m, s, e, lr, swim, fit } = c;
  const top = s.rise === 'mid' ? MID_DROP : 0;
  const k = 1 - lr;
  const topY = top * k;
  const topQ = (girthAt(m, top) * (1 + e)) / 4;
  const L = lowerOf(c, 0, top);
  const cut = 'Cut 1 on fold';
  const waistW = swim ? ELASTIC_WIDTH.swim : s.rise === 'high' ? ELASTIC_WIDTH.waistHigh : ELASTIC_WIDTH.waistMid;
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
      grain: [p(topQ * 0.8, topY + 2), p(topQ * 0.8, L.sideEnd)],
      fold: [p(0, cy + 0.5), p(0, (back ? L.backEnd : L.frontEnd) - 0.5)],
      notches: back ? [[p(L.sideQ, L.sideEnd - 1.5), p(1, 0)], [p(L.sideQ, L.sideEnd - 2.5), p(1, 0)]] : [[p(L.sideQ, L.sideEnd - 2), p(1, 0)]],
      labels: labelsFor(name, cut, p(topQ * 0.45, topY + 4), 0.9, swim),
      cut,
      seamAllowance: LINGERIE_SEAM,
      allowances: { fold: 0, waist: waistW, leg: ELASTIC_WIDTH.edge },
      meta: { knit: true, lingerie: back ? 'back' : 'front' },
    };
  };
  const front = piece(false);
  const back = piece(true);
  const gussets = gussetPieces(c, false);
  const waistEdge = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
  const legR = ELASTIC_RATIO.leg + (fit.leg === 'gapes' ? -FIT_STEP.leg : fit.leg === 'digs' ? FIT_STEP.leg : 0);
  return {
    pieces: [front, back, ...gussets],
    top: r1(4 * topQ),
    elastic: [loop('Waist', waistEdge, ELASTIC_RATIO.waist, waistW), loop('Each leg', legEdge(front, back, gussets), legR, ELASTIC_WIDTH.edge, 2)],
  };
}

function bralette(c: Ctx, stretch: LingerieStretch) {
  const { m, s, swim, fit } = c;
  const UB = m.underbust!;
  const FB = m.full_bust!;
  const gap = FB - UB;
  const diff = Math.max(4, gap + (fit.cup === 'full' ? FIT_STEP.cup : fit.cup === 'empty' ? -FIT_STEP.cup : 0));
  const seamed = diff > SEAMED_CUP_GAP;
  const apexX = m.apex_separation! / 2 - 0.5;
  // The cup's base, centre to side, the dart (or seam) under the apex taking the bust's depth. A seam
  // can take more shaping than a dart before it points.
  const dart = Math.min(seamed ? 9 : 5, diff * 0.22);
  const base = apexX + 0.3 * diff + 0.07 * UB + dart;
  const height = 0.7 * diff + 7;
  // The tip is cut square, 1.5 cm across, so the strap has a tab to sew to.
  const tipM = p(apexX - 1, 0);
  const tipL = p(tipM.x - 0.75, 0);
  const tipR = p(tipM.x + 0.75, 0);
  const sideTop = s.cup === 'longline' ? p(base, height * 0.7) : p(base, height);
  const apex = p(apexX + dart / 2, height - (0.45 * diff + 3));
  const dl = p(apexX, height);
  const dr = p(apexX + dart, height);
  const inner = (path: Path) => path.curve(p(tipL.x * 0.15, height * 0.6), p(tipL.x * 0.7, height * 0.15), tipL, 'inner');
  const outer = (path: Path) => {
    path.curve(lerp(tipR, sideTop, 0.35), p(base - 1.5, sideTop.y * 0.55), sideTop, 'outer');
    if (sideTop.y < height) path.line(p(base, height), 'side');
    return path;
  };
  const kind = swim ? 'Bikini' : 'Bralette';
  const cupCut = swim ? 'Cut 2 Lycra + 2 lining (a pair each)' : 'Cut 2 (a pair)';
  const cupPiece = (name: string, outline: Path, at: P, grainX: number, notches: Piece['notches']): Piece => ({
    name,
    outline,
    lines: [],
    grain: [p(grainX, height * 0.2), p(grainX, height * 0.6)],
    notches,
    labels: [
      { at, text: name.toUpperCase(), size: 0.55 },
      { at: add(at, p(0, 0.9)), text: cupCut, size: 0.32 },
    ],
    cut: cupCut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { dart: 0, inner: ELASTIC_WIDTH.cup, outer: ELASTIC_WIDTH.cup, tab: ELASTIC_WIDTH.strap },
    meta: { knit: true, lingerie: 'cup' },
  });
  let cups: Piece[];
  if (seamed) {
    const centre = inner(new Path(p(0, height))).line(tipM, 'tab').line(apex, 'cupseam').line(dl, 'cupseam').line(p(0, height), 'base');
    centre.closed = true;
    const side = new Path(tipM).line(tipR, 'tab');
    outer(side).line(dr, 'base').line(apex, 'cupseam').line(tipM, 'cupseam');
    side.closed = true;
    const notch: Piece['notches'] = [[apex, p(0, -1)]];
    cups = [
      cupPiece(`${kind} cup, centre`, centre, p(dl.x * 0.5, height - 2.5), (tipL.x + apex.x) * 0.35, notch),
      cupPiece(`${kind} cup, side`, side, p((dr.x + base) / 2, height - 2.5), apex.x * 0.65 + base * 0.35, notch),
    ];
  } else {
    const path = inner(new Path(p(0, height))).line(tipR, 'tab');
    outer(path).line(dr, 'base').line(apex, 'dart').line(dl, 'dart').line(p(0, height), 'base');
    path.closed = true;
    cups = [cupPiece(`${kind} cup`, path, p((dr.x + base) / 2, height - 2.5), apexX * 0.6, [[apex, p(0, -1)]])];
  }

  // The band runs from the centre front (on the fold) to the centre back, where it's sewn to hook-and-eye
  // tape: cut short by the tape so it closes at size on the middle row.
  const bandH = s.cup === 'longline' ? 10 : 4;
  const finished = UB * (1 + BAND_EASE[stretch]);
  const bandHalf = (finished - HOOK_TAPE) / 2;
  const bandPath = new Path(p(0, 0)).line(p(bandHalf, 0), 'top').line(p(bandHalf, bandH), 'cb').line(p(0, bandH), 'band').line(p(0, 0), 'fold');
  bandPath.closed = true;
  const bandCut = `Cut ${swim ? '2 on fold: 1 Lycra, 1 lining' : '1 on fold'}`;
  // Where the cup ends on the band, with its dart or seam closed, and where the back strap goes.
  const cupEnd = base - dart;
  const strapX = Math.max(cupEnd + 3, bandHalf - (UB * 0.1 - HOOK_TAPE / 2));
  const band: Piece = {
    name: `${kind} band`,
    kind: 'band',
    outline: bandPath,
    lines: [],
    grain: [p(bandHalf * 0.85, 0.5), p(bandHalf * 0.85, bandH - 0.5)],
    fold: [p(0, 0.5), p(0, bandH - 0.5)],
    notches: [
      [p(apexX * 0.9 + 0.5, 0), p(0, -1)],
      [p(cupEnd, 0), p(0, -1)],
      [p(strapX, 0), p(0, -1)],
    ],
    labels: [
      { at: p(bandHalf * 0.45, bandH * 0.45), text: `${kind.toUpperCase()} BAND`, size: 0.5 },
      { at: p(bandHalf * 0.45, bandH * 0.45 + 0.8), text: `${bandCut}, most stretch along it`, size: 0.3 },
      { at: p(cupEnd, 1.1), text: 'CUP ENDS', size: 0.28 },
      { at: p(strapX, 1.1), text: 'STRAP', size: 0.28 },
      { at: p(bandHalf - 1.4, bandH * 0.5), text: 'HOOK TAPE', size: 0.28, rotate: 90 },
    ],
    cut: bandCut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { fold: 0, band: ELASTIC_WIDTH.band },
    meta: { knit: true, lingerie: 'band', lengthCm: r1(bandHalf * 2), foldLabel: 'CENTRE FRONT' },
  };
  const along = (tag: string) => cups.reduce((a, pc) => a + taggedLength(pc.outline, tag), 0);
  const strap = r1(m.nape_to_waist! * 0.8 + 5 + (fit.straps === 'dig' ? FIT_STEP.strap : fit.straps === 'slip' ? -FIT_STEP.strap : 0));
  return {
    pieces: [...cups, band],
    bust: r1(FB * (1 + LINGERIE_EASE[stretch])),
    band: r1(finished),
    strap,
    seamed,
    gap,
    elastic: [
      { edge: 'Under the band', length: r1(UB * ELASTIC_RATIO.band - HOOK_TAPE), width: ELASTIC_WIDTH.band, count: 1 },
      { edge: 'Each cup, neck edge', length: r1(along('inner') * ELASTIC_RATIO.cup), width: ELASTIC_WIDTH.cup, count: 2 },
      { edge: 'Each cup, underarm edge', length: r1(along('outer') * ELASTIC_RATIO.cup), width: ELASTIC_WIDTH.cup, count: 2 },
      { edge: 'Each strap', length: strap, width: ELASTIC_WIDTH.strap, count: 2 },
    ],
  };
}

/** A point on a cubic curve. */
const cubicAt = (a: P, b: P, c: P, d: P, t: number) => {
  const u = 1 - t;
  return add(add(mul(a, u * u * u), mul(b, 3 * u * u * t)), add(mul(c, 3 * u * t * t), mul(d, t * t * t)));
};

function onePiece(c: Ctx) {
  const { m, s, e, lr, swim, fit } = c;
  const k = 1 - lr;
  const FB = m.full_bust!;
  const UB = m.underbust!;
  const CL = m.crotch_length!;
  // Extra front length at the centre for the bust, so the front doesn't flatten it and pull up between
  // the legs: from a B cup up, to 4 cm.
  const bustLen = Math.min(4, Math.max(0, (FB - UB - 12) * 0.35));
  // The torso loop sets the body's length: the draft's own loop (shoulder over the bust, through the legs
  // and back up) is matched to it, shortened like every other length.
  const nape = m.nape_to_waist! * k;
  const own = 2 * (nape - 1) + CL * k + bustLen;
  const want = m.torso_loop! * k;
  const raw = (want - own) / 2;
  const torsoAdj = Math.max(-6, Math.min(6, raw)) + (fit.torso === 'short' ? FIT_STEP.torso : fit.torso === 'long' ? -FIT_STEP.torso : 0);
  const NW = nape + torsoAdj;
  const bustQ = (FB * (1 + e)) / 4;
  const waistQ = (m.waist * (1 + e)) / 4;
  const L = lowerOf(c, NW, 0);
  const hipY = NW + m.waist_to_hip * k;
  const hipQ = (m.full_hip * (1 + e)) / 4;
  const scye = (18.5 + (FB - 88) * 0.1) * k;
  const nw = m.neck! / 5 + 1.5 - (fit.straps === 'slip' ? FIT_STEP.strapIn : 0);
  // A 3 cm strap at the shoulder, ending well inside the shoulder point.
  const strapIn = p(nw, 1);
  const strapOut = p(Math.min(nw + 3, m.shoulder_width! / 2 - 2), 2);
  const U = p(bustQ, scye);
  // Neckline and armhole leave the strap square, so they blend across the shoulder seam.
  const sh = unit(sub(strapOut, strapIn));
  const down = p(-sh.y, sh.x);
  const d1 = NW - scye;
  const sideCtl: [P, P, P, P] = [U, p(U.x, scye + d1 * 0.4), p(waistQ, NW - d1 * 0.35), p(waistQ, NW)];
  const armhole = (path: Path) => path.line(strapOut, 'shoulder').curve(add(strapOut, mul(down, scye * 0.3)), p(U.x - 2.5, scye), U, 'armhole');
  const side = (path: Path) => {
    armhole(path);
    path.curve(sideCtl[1], sideCtl[2], sideCtl[3], 'side');
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
  const neckCurve = (path: Path, cy: number) => path.curve(p(nw * 0.6, cy), add(strapIn, mul(down, cy * 0.45)), strapIn, 'neck');
  const cut = 'Cut 1 on fold';
  const make = (back: boolean): Piece => {
    const cy = back ? backDepth : frontDepth;
    const start = p(0, cy);
    const path = neckCurve(new Path(start), cy);
    side(path);
    legAndCrotch(path, back ? L : { ...L, frontEnd: L.frontEnd + bustLen }, back, start);
    path.closed = true;
    const name = `${swim ? 'Swimsuit' : 'Bodysuit'} ${back ? 'back' : 'front'}`;
    return {
      name,
      outline: path,
      lines: [],
      grain: [p(bustQ * 0.55, scye + 9), p(bustQ * 0.55, hipY)],
      fold: [p(0, cy + 0.5), p(0, (back ? L.backEnd : L.frontEnd + bustLen) - 0.5)],
      balance: [{ pts: [p(0, NW), p(waistQ, NW)], label: 'WAIST LINE' }],
      notches: back ? [[p(waistQ, NW - 0.5), p(1, 0)], [p(waistQ, NW + 0.5), p(1, 0)]] : [[p(waistQ, NW), p(1, 0)]],
      labels: labelsFor(name, cut, p(bustQ * 0.4, scye + 4), 1.1, swim),
      cut,
      seamAllowance: LINGERIE_SEAM,
      allowances: { fold: 0, neck: ELASTIC_WIDTH.edge, armhole: ELASTIC_WIDTH.edge, leg: ELASTIC_WIDTH.edge },
      meta: { knit: true, lingerie: back ? 'back' : 'front', shoulderEase: 0 },
    };
  };
  const front = make(false);
  const back = make(true);
  const gussets = gussetPieces(c, !swim && s.closure === 'snaps');

  // A shelf lining inside the front, from the neckline to just under the bust, with elastic along its
  // lower edge: it holds the bust so the front doesn't have to.
  const ubY = Math.min(NW - 3, Math.max(scye + 3, ((m.bust_depth ?? 25) + 4 + Math.max(0, FB - UB - 10) * 0.3) * k));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (cubicAt(...sideCtl, mid).y < ubY) lo = mid;
    else hi = mid;
  }
  const sideAt = cubicAt(...sideCtl, lo);
  const shelfStart = p(0, frontDepth);
  const shelfPath = neckCurve(new Path(shelfStart), frontDepth);
  armhole(shelfPath).line(p(sideAt.x, ubY), 'shelfside').line(p(0, ubY), 'shelf').line(shelfStart, 'fold');
  shelfPath.closed = true;
  const shelfCut = `Cut 1 on fold in ${swim ? 'swim lining' : 'power mesh'}`;
  const shelf: Piece = {
    name: swim ? 'Swimsuit shelf' : 'Bodysuit shelf',
    kind: 'lining',
    outline: shelfPath,
    lines: [],
    grain: [p(bustQ * 0.85, scye + 1), p(sideAt.x * 0.85, ubY - 1)],
    fold: [p(0, frontDepth + 0.5), p(0, ubY - 0.5)],
    notches: [],
    labels: [
      { at: p(bustQ * 0.45, scye + 2), text: (swim ? 'Swimsuit shelf' : 'Bodysuit shelf').toUpperCase(), size: 0.8 },
      { at: p(bustQ * 0.45, scye + 3.2), text: shelfCut, size: 0.35 },
      { at: p(bustQ * 0.45, scye + 3.9), text: 'Most stretch across', size: 0.35 },
    ],
    cut: shelfCut,
    seamAllowance: LINGERIE_SEAM,
    allowances: { fold: 0, shelf: ELASTIC_WIDTH.edge },
    meta: { knit: true, lingerie: 'shelf', foldLabel: 'CENTRE FRONT' },
  };

  const neckEdge = 2 * (taggedLength(front.outline, 'neck') + taggedLength(back.outline, 'neck'));
  const armEdge = taggedLength(front.outline, 'armhole') + taggedLength(back.outline, 'armhole');
  const legR = ELASTIC_RATIO.leg + (fit.leg === 'gapes' ? -FIT_STEP.leg : fit.leg === 'digs' ? FIT_STEP.leg : 0);
  return {
    pieces: [front, back, shelf, ...gussets],
    bust: r1(4 * bustQ),
    waist: r1(4 * waistQ),
    torsoOff: Math.abs(raw) > 6,
    elastic: [
      loop('Neckline, front and back', neckEdge, ELASTIC_RATIO.neck, ELASTIC_WIDTH.edge),
      loop('Each armhole', armEdge, ELASTIC_RATIO.armhole, ELASTIC_WIDTH.edge, 2),
      loop('Each leg', legEdge(front, back, gussets), legR, ELASTIC_WIDTH.edge, 2),
      { edge: 'Under the shelf', length: r1(2 * sideAt.x * ELASTIC_RATIO.shelf), width: ELASTIC_WIDTH.edge, count: 1 },
    ],
  };
}

/** The pieces a lingerie choice makes, in words. */
export const LINGERIE_NAMES: Record<LingeriePiece, string> = { brief: 'brief', bralette: 'bralette', bodysuit: 'bodysuit', swimsuit: 'swimsuit', bikini: 'bikini' };
