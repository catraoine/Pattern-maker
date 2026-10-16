// Fitted bodice block (front and back, to the waist), drafted flat from measurements (Aldrich-style).
// Ported from the Python prototype in the drafting thread (pattern/bodice.py).
//
// Driven by the person's own lengths rather than a size table:
// - back: nape, back length, shoulder width and slope, across back, armhole depth;
// - front: shoulder to waist over the bust, bust depth and apex separation place the bust point,
//   and the extra front length over the bust becomes a side bust dart;
// - waist suppression is shared between the side seams and one waist dart per piece.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
import { Piece, withAlternate } from './piece';
import { DraftError, Side, cm } from './skirt';
import type { DartPlace, PrincessLine } from './manipulate';
import { moveFrontDart, princessPieces } from './shaping';
import { Buttons, Closure, Collar, EXTENSION_CM, backNeckFacing, backOnFold, buttonPlaces, collarPieces, frontFacing, openFront } from './collar';

export interface BodiceMeasurements {
  full_bust: number;
  high_bust?: number;
  waist: number;
  neck: number;
  shoulder_width: number;
  shoulder_length: number;
  across_back: number;
  across_front: number;
  nape_to_waist: number;
  front_hps_to_waist: number;
  bust_depth: number;
  apex_separation: number;
  armscye?: number;
  /** Shoulder slope, Armstrong's way: from the centre front (or back) waist diagonally up to the
   * shoulder point. Sets the shoulder angle for square or sloping shoulders; standard angles without. */
  front_shoulder_slope?: number;
  back_shoulder_slope?: number;
  /** Only needed for tops that go below the waist. */
  full_hip?: number;
  waist_to_hip?: number;
  high_hip?: number;
}

export type BodiceFit = 'fitted' | 'regular' | 'relaxed';
export type Neckline = 'crew' | 'scoop' | 'v' | 'square' | 'boat';
export type BodiceLength = 'waist' | 'high_hip' | 'hip';
/** Shaping: bust and waist darts, bust darts only, or none (the bust dart left as ease at the hem). */
export type BodiceDarts = 'bust_waist' | 'bust' | 'none';

export interface BodiceStyle {
  fit: BodiceFit;
  neckline: Neckline;
  length: BodiceLength;
  darts: BodiceDarts;
  seamAllowance: number;
  neckArmholeAllowance: number;
  hemAllowance: number;
  /** Corrections from fitting a toile, on top of the measurements. */
  fitting?: BodiceFitting;
  /** Where the bust dart opens (the block's is in the side seam), or princess seams instead of darts. */
  bustDart?: DartPlace;
  princess?: PrincessLine;
  /** A centre back zip (the default) or buttons down the centre front; and a collar. */
  closure?: Closure;
  collar?: Collar;
}

/**
 * Corrections made after trying on a toile. Lengths in cm, shoulder angles in degrees (more is more
 * sloping). Ease is added to the fit's own; the armhole is lowered (negative raises it); a neck gape
 * pinned out at the neckline is pivoted into the bust dart.
 */
export interface BodiceFitting {
  bustEase?: number;
  waistEase?: number;
  /** Below the waist: more room at the hem, for a heavy fabric. */
  hipEase?: number;
  armhole?: number;
  frontSlope?: number;
  backSlope?: number;
  neckGape?: number;
  backLength?: number;
  bustPoint?: number;
  acrossBack?: number;
  /** One shoulder lower than the other: a second shoulder and armhole line for that side. */
  lowShoulder?: { side: Side; cm: number };
}

/** Defaults from styling/styling-options.json (top: neckline params, in cm): how far the front
 * neck drops below the block's and how far the neck widens along the shoulder. The back neck drops
 * a little for the open necklines so it sits flat. */
export const NECKLINES: Record<Neckline, { frontDepth: number; width: number; backDepth: number }> = {
  crew: { frontDepth: 1, width: 0, backDepth: 0 },
  scoop: { frontDepth: 10, width: 3, backDepth: 1.5 },
  v: { frontDepth: 14, width: 2, backDepth: 1 },
  square: { frontDepth: 10, width: 4, backDepth: 1.5 },
  boat: { frontDepth: 2, width: 7, backDepth: 1.5 },
};

/** Hip ease (cm) for tops that reach below the waist, from the same fit options. */
export const BODICE_HIP_EASE: Record<BodiceFit, number> = { fitted: 4, regular: 7, relaxed: 11 };

/** Lengths that need the hip measurements. */
export const needsHip = (l: BodiceLength) => l !== 'waist';

// Ease in cm from styling/styling-options.json (top/blouse fit options). Oversized has no darts,
// so it needs its own block rather than this one.
export const BODICE_FIT_EASE: Record<BodiceFit, { bust: number; waist: number }> = {
  fitted: { bust: 5, waist: 3 },
  regular: { bust: 9, waist: 6 },
  relaxed: { bust: 14, waist: 12 },
};

export const DEFAULT_BODICE_STYLE: BodiceStyle = {
  fit: 'fitted',
  neckline: 'crew',
  length: 'waist',
  darts: 'bust_waist',
  seamAllowance: 1.5,
  neckArmholeAllowance: 1,
  hemAllowance: 2.5,
};

export interface BodiceDraft {
  pieces: Piece[];
  bustDart: number;
  waistDarts: { front: number; back: number };
  sideSuppression: number;
  armholeDepth: number;
  armhole: number;
  armholeTarget?: number;
  shoulder: { front: number; back: number };
  /** Shoulder angles in degrees below level, measured or standard. */
  shoulderSlope: { front: number; back: number };
  sideSeam: { frontLessDart: number; back: number };
  finishedBust: number;
  finishedWaist: number;
  /** Finished hip (or high hip) for tops below the waist. */
  finishedHem?: number;
  /** Centre back length from the neck edge to the hem. */
  backLength: number;
  zipCm: number;
  /** Front landmarks for drawing the bodice as worn: waist and hem, at the side and centre front. */
  front: { apex: P; waistSide: P; waistCentre: P; hemSide: P; hemCentre: P };
  neck: number;
  warnings: string[];
  /** The lower shoulder's side and its pieces as drafted, for the seam check. */
  lowShoulder?: { side: Side; cm: number; pieces: Piece[] };
  /** The front and back as drafted, with the side bust dart, when the printed pieces are styled
   * (a moved dart, princess seams). The garment sews up to this shape, so sleeves, facings and the
   * flat drawing are worked from it. */
  block?: Piece[];
  /** Lines to draw on the sewn garment in place of the block's bust dart (a moved dart), or of all
   * its darts (princess seams), in the block's coordinates. */
  styleLines?: { skip: 'side' | 'all'; front: { pts: P[]; kind: 'dart' | 'seam' }[]; back: { pts: P[]; kind: 'dart' | 'seam' }[] };
  closure: Closure;
  collar: Collar;
  /** Where the buttons go on a button front. */
  buttons?: Buttons;
}

/** The front and back as drafted: the shape the bodice sews up to, whatever its seams. */
export const blockOf = (d: BodiceDraft): [Piece, Piece] => {
  const b = d.block ?? d.pieces;
  return [b[0], b[1]];
};

/** Princess seams or a moved bust dart, made on the drafted block. */
function shape(d: BodiceDraft, s: BodiceStyle): BodiceDraft {
  const princess = s.princess && s.princess !== 'none' ? s.princess : undefined;
  // A top longer than the waist has no waist seam to take the bust dart.
  const to = s.bustDart && s.bustDart !== 'side' && !(s.bustDart === 'waist' && needsHip(s.length)) ? s.bustDart : undefined;
  if ((!princess && !to) || s.darts === 'none' || d.bustDart <= 0.3) return d;
  const [front, back] = d.pieces;
  const upper = princess || to === 'shoulder' || to === 'neck' || to === 'armhole';
  if (d.lowShoulder && upper) {
    return { ...d, warnings: [...d.warnings, `with one shoulder lower, the ${princess ? 'princess seams are' : 'bust dart is'} left as drafted, from the side seam`] };
  }
  if (princess) {
    if (s.darts !== 'bust_waist') return d;
    const pp = princessPieces(front, back, d.front.apex, princess);
    if (!pp) return d;
    return {
      ...d,
      block: [front, back],
      pieces: pp.pieces,
      styleLines: { skip: 'all', front: [{ pts: pp.lines.front, kind: 'seam' }], back: [{ pts: pp.lines.back, kind: 'seam' }] },
    };
  }
  const moved = moveFrontDart(front, d.front.apex, to!, d.front.waistSide);
  const sewn = moved.meta.sewnDart as P[] | undefined;
  return { ...d, block: [front, back], pieces: [moved, back], styleLines: { skip: 'side', front: sewn ? [{ pts: sewn, kind: 'dart' }] : [], back: [] } };
}

const BACK_SLOPE = (18 * Math.PI) / 180;
const MIN_SLOPE = (6 * Math.PI) / 180;
const MAX_SLOPE = (36 * Math.PI) / 180;
const FRONT_SLOPE = (22 * Math.PI) / 180;
const deg = (a: number) => Math.round(((a * 180) / Math.PI) * 10) / 10;

/**
 * The shoulder angle that puts the shoulder point `reach` cm from the centre waist, for a shoulder of
 * `length` from the neck point `from`. Kept between 8 and 32 degrees (very square to very sloping);
 * undefined when the measurement can't be met inside that, so the standard angle is used.
 */
function slopeFor(from: P, length: number, waist: P, reach: number): number | undefined {
  const dist = (a: number) => len(sub(add(from, p(length * Math.cos(a), length * Math.sin(a))), waist));
  let lo = (8 * Math.PI) / 180;
  let hi = (32 * Math.PI) / 180;
  // The shoulder point swings down toward the waist as the angle grows, so the distance falls.
  if (reach > dist(lo) + 0.5 || reach < dist(hi) - 0.5) return undefined;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (dist(mid) > reach) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const FRONT_DART_MAX = 6.5;
const BACK_DART_MAX = 4.5;

const r = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Unit vector at right angles to u, turned toward the body (down and toward centre). */
const perp = (u: P): P => p(-u.y, u.x);

/** Unit vector square to a seam running down `d`, heading away from the centre. */
const squareTo = (d: P): P => unit(p(d.y, -d.x));

/**
 * A waist line through (0, y0) and (xs, ys), squared off at both ends: square to the centre line,
 * and square to the side seam (running down `side`) so it carries on smoothly across the seam once
 * sewn. The corrections fade out within a few cm of each end, so darts in between are not moved.
 */
function squaredWaist(y0: number, xs: number, ys: number, side: P) {
  const k = (ys - y0) / xs;
  const sideSlope = -side.x / side.y;
  const L = Math.min(4, xs * 0.25);
  return (x: number) => {
    const v = x / L;
    const u = (x - (xs - L)) / L;
    const atCentre = v < 1 ? -k * L * (v - 2 * v ** 2 + v ** 3) : 0;
    const atSide = u > 0 ? (sideSlope - k) * L * (u ** 3 - u ** 2) : 0;
    return y0 + k * x + atCentre + atSide;
  };
}

/** Add a waist run to `path` from its end to x = toX, four points a centimetre. */
function waistRun(path: Path, y: (x: number) => number, toX: number) {
  const fromX = path.end.x;
  const n = Math.max(1, Math.ceil(Math.abs(toX - fromX) * 4));
  // Points close to each end keep the direction the curve leaves and arrives in.
  const ts = [0.0005, 0.004, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n), 0.996, 0.9995, 1].filter((t) => n > 1 || t < 0.99 || t === 1);
  for (const t of ts) {
    const x = fromX + (toX - fromX) * t;
    path.line(p(x, y(x)), 'waist');
  }
}

/** Draft the block, choosing the armhole depth that makes the armhole the person's armhole
 * measurement plus ease (falls back to a size-table depth without it). */
export function draftBodice(m: BodiceMeasurements, style: Partial<BodiceStyle> = {}): BodiceDraft {
  const s = { ...DEFAULT_BODICE_STYLE, ...style };
  return finish(shape(draftBlock(m, s), s), s);
}

/** A button front (the back then on the fold) and a collar, both made on the bodice as sewn. */
function finish(d: BodiceDraft, s: BodiceStyle): BodiceDraft {
  const closure = s.closure ?? 'back_zip';
  const collar = s.collar === 'shirt' && closure !== 'front_buttons' ? 'none' : s.collar && s.collar !== 'none' && s.neckline === 'crew' ? s.collar : s.collar === 'peter_pan' && s.neckline === 'scoop' ? 'peter_pan' : 'none';
  const [bf, bb] = blockOf(d);
  let pieces = d.pieces;
  let buttons: Buttons | undefined;
  let block = d.block;
  if (closure === 'front_buttons') {
    const cfNeck = bf.outline.start;
    const foot = Math.max(...bf.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
    buttons = buttonPlaces(cfNeck.y, foot, collar === 'mandarin' || collar === 'shirt', !needsHip(s.length), d.front.apex.y);
    pieces = pieces.map((pc) => (pc.fold && /front/i.test(pc.name) ? openFront(pc, buttons) : /back/i.test(pc.name) ? backOnFold(pc) : pc));
    const openBlock = openFront(bf);
    const foldBlock = backOnFold(bb);
    // The bodice as sewn is buttoned shut: the block itself, centre front to centre front.
    block = [bf, bb];
    pieces = [...pieces, frontFacing(openBlock), ...[backNeckFacing(foldBlock)].filter((pc): pc is Piece => !!pc)];
  }
  if (collar !== 'none') {
    const ext = closure === 'front_buttons' && collar !== 'peter_pan' ? EXTENSION_CM : 0;
    pieces = [...pieces, ...collarPieces(collar, bf, bb, { back: taggedLength(bb.outline, 'neck'), front: taggedLength(bf.outline, 'neck'), ext, closure, sa: s.seamAllowance })];
  }
  return { ...d, pieces, block, closure, collar, buttons };
}

function draftBlock(m: BodiceMeasurements, style: BodiceStyle): BodiceDraft {
  const s = { ...DEFAULT_BODICE_STYLE, ...style };
  if (needsHip(s.length) && !(m.full_hip && m.waist_to_hip)) {
    throw new DraftError('Add your full hip and waist to hip measurements to make a top that goes below the waist.');
  }
  const ease = BODICE_FIT_EASE[s.fit];
  const hb = m.high_bust ?? m.full_bust - 4;
  const table = 21 + (hb - 82) * 0.1 + ease.bust / 10;
  const fit = s.fitting ?? {};
  // The armhole is found for the measurements as drafted, then lowered or raised as the toile asked.
  const lower = fit.armhole ?? 0;
  const withSides = (scye: number): BodiceDraft => {
    const { inner, ...result } = draft(m, s, scye + lower);
    const low = fit.lowShoulder;
    if (!low || !(low.cm > 0)) return result;
    // The lower shoulder: the same draft with both shoulder points dropped and the armhole lowered as
    // much, so the armhole keeps its shape and size. Below the bust nothing changes (the same bust
    // dart, the same side seam), and the back underarm sits where the side seams come out equal.
    const keep = { bustDart: inner.bustDart, lower: inner.lower };
    const first = draft(m, s, scye + lower + low.cm, { drop: low.cm, keep });
    const alt = draft(m, s, scye + lower + low.cm, { drop: low.cm, keep, backSide: keep.lower - keep.bustDart + first.inner.upper });
    const label = `${low.side.toUpperCase()} SHOULDER`;
    result.pieces = result.pieces.map((pc, i) => withAlternate(pc, alt.pieces[i].outline, label));
    result.lowShoulder = { ...low, pieces: alt.pieces };
    return result;
  };
  if (!m.armscye) return withSides(table);

  const target = m.armscye + 4 + 0.5 * ease.bust;
  let lo = table - 5;
  let hi = table + 3;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (draft(m, s, mid).armhole < target) lo = mid;
    else hi = mid;
  }
  const result = withSides((lo + hi) / 2);
  // A slightly roomy armhole is harmless (it happens on big frames with a lot of ease); a tight one is not.
  if (!lower && (result.armhole < target - 1 || result.armhole > target + 3)) {
    result.warnings.push(`armhole ${result.armhole} cm could not reach ${target.toFixed(1)} cm within a sensible depth`);
  }
  result.armholeTarget = r(target, 1);
  return result;
}

const ZIPS = [20, 22, 25, 30, 35, 40, 45, 50, 55, 60];
/** The longest standard invisible zip that fits the centre back opening. */
const zipFor = (opening: number) => [...ZIPS].reverse().find((z) => z <= opening) ?? ZIPS[0];

/** Side seam below the waist: out from the waist and straight down at the hem, like a skirt's hip curve. */
function hipCurve(path: Path, from: P, to: P, tag: string): Path {
  const dy = to.y - from.y;
  return path.curve(p(from.x + (to.x - from.x) * 0.5, from.y + dy * 0.3), p(to.x, to.y - dy * 0.4), to, tag);
}
const hipCurveLength = (from: P, to: P) => hipCurve(new Path(from), from, to, '').length();

/** A waist dart carried on below the waist (a fish-eye dart), for tops longer than the waist. */
const fishEye = (top: P, left: P, right: P, bottom: P) => new Path(top).line(left).line(bottom).line(right).line(top);

/** The front neckline from centre front up to the high point of the shoulder. */
function frontNeck(path: Path, hps: P, uShoulder: P, shape: Neckline): Path {
  const cf = path.start;
  const drop = cf.y - hps.y;
  const toward = (k: number) => add(hps, mul(perp(uShoulder), drop * k));
  // Every neckline arrives square to the shoulder, so it runs on smoothly into the back neck once the
  // shoulders are sewn. The V and the square stay straight until close to the shoulder.
  switch (shape) {
    case 'v':
      // Straight from the point (one edge, so the cutting line mitres onto the fold), curving at the top.
      return path.line(lerp(cf, hps, 0.5), 'neck').curve(lerp(cf, hps, 0.75), toward(0.15), hps, 'neck');
    case 'square': {
      const corner = p(hps.x, cf.y);
      return path.line(corner, 'neck').curve(lerp(corner, hps, 0.45), toward(0.25), hps, 'neck');
    }
    case 'scoop':
      return path.curve(p(hps.x * 0.7, cf.y), toward(0.6), hps, 'neck');
    case 'boat':
      return path.curve(p(hps.x * 0.6, cf.y), toward(0.5), hps, 'neck');
    default:
      return path.curve(p(hps.x * 0.55, cf.y), toward(0.45), hps, 'neck');
  }
}

/** For the second line on a lower shoulder: how far both shoulder points drop (cm), the bust dart and
 * the side seam below the bust to keep from the first line, and the back side seam length to match. */
interface SideLine {
  drop?: number;
  keep?: { bustDart: number; lower: number };
  backSide?: number;
}

/** Draft at armhole depth `scye`. */
function draft(m: BodiceMeasurements, s: BodiceStyle, scye: number, side: SideLine = {}): BodiceDraft & { inner: { bustDart: number; lower: number; upper: number } } {
  const dropShoulder = side.drop ?? 0;
  const fit = s.fitting ?? {};
  const { full_bust: B, waist: W, neck: N, shoulder_length: SL, shoulder_width: SW } = m;
  const { across_front: AF, apex_separation: AS } = m;
  // Lengths the toile corrected.
  const AB = m.across_back + (fit.acrossBack ?? 0);
  const NW = m.nape_to_waist + (fit.backLength ?? 0);
  const BD = m.bust_depth + (fit.bustPoint ?? 0);
  let FL = m.front_hps_to_waist;
  const HB = m.high_bust ?? B - 4;
  const be = BODICE_FIT_EASE[s.fit].bust + (fit.bustEase ?? 0);
  const we = BODICE_FIT_EASE[s.fit].waist + (fit.waistEase ?? 0);
  const warnings: string[] = [];
  // Shoulder angles the toile corrected, and a shoulder point dropped `by` cm along a shoulder `length` long.
  const corrected = (a: number, by: number | undefined) => Math.min(MAX_SLOPE, Math.max(MIN_SLOPE, a + ((by ?? 0) * Math.PI) / 180));
  const dropped = (a: number, length: number) => (dropShoulder ? Math.asin(Math.min(0.95, Math.sin(a) + dropShoulder / length)) : a);
  const nl = NECKLINES[s.neckline];
  const waistDarts = s.darts === 'bust_waist';
  const bustDarts = s.darts !== 'none';
  const below = needsHip(s.length);

  // Bust projection (full minus high bust) goes to the front piece.
  const shift = Math.min(4, Math.max(0.5, (B - HB) / 4));
  const backW = (B + be) / 4 - shift;
  const frontW = (B + be) / 4 + shift;
  const backWq = (W + we) / 4 - 0.5; // same front/back waist split as the skirt, so a dress waist matches
  const frontWq = (W + we) / 4 + 0.5;

  // Below the waist the hem is cut to the hip (or high hip) plus ease, split front and back the same way.
  let drop = 0;
  let hemFull = 0;
  if (below) {
    const H = m.full_hip!;
    const WH = m.waist_to_hip!;
    const he = BODICE_HIP_EASE[s.fit] + (fit.hipEase ?? 0);
    if (s.length === 'hip') {
      drop = WH;
      hemFull = H + he;
    } else {
      drop = WH / 2;
      hemFull = (m.high_hip ?? W + 0.65 * (H - W)) + he;
    }
  }

  // ---- back ---------------------------------------------------------------
  const nw = N / 5 - 0.2; // back neck width
  const hpsB0 = p(nw, -2);
  // Shoulders are drawn at standard slopes from the shoulder length. Working the slope out from
  // shoulder width instead is badly conditioned: a 1 cm measuring error swings the slope by 10
  // degrees. Shoulder width is used as a cross-check.
  const blen = SL + 1; // 1 cm eased into the front shoulder
  let backSlope = BACK_SLOPE;
  if (m.back_shoulder_slope) {
    const a = slopeFor(hpsB0, blen, p(0, NW), m.back_shoulder_slope);
    if (a === undefined) warnings.push(`back shoulder slope ${m.back_shoulder_slope} cm doesn't fit the back length and shoulder; drafted at the standard ${deg(BACK_SLOPE)} degrees, please re-measure`);
    else backSlope = a;
  }
  backSlope = corrected(backSlope, fit.backSlope);
  // A wider neckline moves the neck point out along both shoulders, leaving at least 5 cm of shoulder.
  // It moves along the shoulder as fitted, and a lower shoulder drops from there, so its line keeps
  // the same neck and the same shoulder length.
  const widen = Math.max(0, Math.min(nl.width, SL - 5));
  const hpsB = add(hpsB0, mul(p(Math.cos(backSlope), Math.sin(backSlope)), widen));
  backSlope = dropped(backSlope, blen - widen);
  const spB = add(hpsB, mul(p(Math.cos(backSlope), Math.sin(backSlope)), blen - widen));
  if (Math.abs(spB.x - SW / 2) > 2.5) {
    warnings.push(
      `shoulder width ${SW} cm and shoulder length ${SL} cm don't agree (the pattern's shoulders are ${r(2 * spB.x, 1)} cm wide); please re-measure both`,
    );
  }
  const uB = unit(sub(spB, hpsB));
  const bd = nl.backDepth;

  const abPt = p(AB / 2, scye / 2 + 1);
  const wb = NW;

  const suppB = backW - backWq;
  const suppF = frontW - frontWq;
  // Up to 2.5 cm comes off each side seam and one dart per piece takes the rest. Where that would
  // make a dart too wide to sew flat, the side seams take more (front and back alike, so they match).
  // Without waist darts the side seams take their share and the rest is left as ease.
  const low = Math.min(suppB, suppF);
  const easySide = low > 0 ? Math.min(2.5, 0.4 * low) : low;
  const sideSupp = waistDarts ? Math.max(easySide, suppF - FRONT_DART_MAX, suppB - BACK_DART_MAX) : easySide;
  const dartB = waistDarts ? Math.max(0, suppB - sideSupp) : 0;
  const dartF = waistDarts ? Math.max(0, suppF - sideSupp) : 0;
  const swB = p(backW - sideSupp, wb);
  // A lower shoulder's back underarm moves along the first line's side seam, to where the side seams come out equal.
  const sideB0 = p(backW, scye - dropShoulder);
  const sideB = side.backSide ? add(swB, mul(unit(sub(sideB0, swB)), side.backSide)) : sideB0;

  const back = new Path(p(0, bd))
    .curve(p(hpsB.x * 0.6, bd), add(hpsB, mul(perp(uB), 1 + bd * 0.4)), hpsB, 'neck')
    .line(spB, 'shoulder')
    .curve(add(spB, mul(perp(uB), 2.5)), sub(abPt, p(0, 3)), abPt, 'armhole')
    // The armhole meets the side seam square, so the underarm curve runs on smoothly into the front's.
    .curve(add(abPt, p(0, (sideB.y - abPt.y) * 0.55)), sub(sideB, mul(squareTo(unit(sub(swB, sideB))), (sideB.x - abPt.x) * 0.6)), sideB, 'armhole')
    .line(swB, 'side');
  const backLines: Path[] = [];
  const dartXB = swB.x * 0.48;
  const dartTipB = p(dartXB, scye - dropShoulder + 2.5);
  let hipB = swB;
  if (!below) {
    // Waist darts are pressed toward the centre, trued, and the waist seam is peaked over them.
    const waistB = squaredWaist(wb, swB.x, wb, unit(sub(swB, sideB)));
    if (dartB > 0.3) {
      const d = finishDart(p(dartXB, scye - dropShoulder + 2.5), p(dartXB - dartB / 2, waistB(dartXB - dartB / 2)), p(dartXB + dartB / 2, waistB(dartXB + dartB / 2)), p(-1, 0));
      waistRun(back, waistB, d.far.x);
      back.line(d.peak, 'dart').line(d.near, 'dart');
      backLines.push(new Path(d.near).line(d.tip).line(d.far));
    }
    waistRun(back, waistB, 0);
  } else {
    hipB = p(hemFull / 4 - 0.5, wb + drop);
    hipCurve(back, swB, hipB, 'side');
    if (dartB > 0.3) {
      const depth = Math.max(2, Math.min(12, drop - 3));
      backLines.push(fishEye(p(dartXB, scye - dropShoulder + 2.5), p(dartXB - dartB / 2, wb), p(dartXB + dartB / 2, wb), p(dartXB, wb + depth)));
    }
    back.line(p(0, hipB.y), 'hem');
  }
  back.line(p(0, bd), 'centre');
  back.closed = true;
  const backHem = hipB.y;

  // The zip runs down the centre back from the neck edge, ending at the waist (just above a
  // waist-length hem) so the top goes on over the head and shoulders.
  const zipCm = zipFor(wb - bd - (below ? 0 : 2));
  const zipEnd = p(0, bd + zipCm);
  const backCut = 'Cut 2 (1 pair)';
  const backDraft = {
    frame: [
      [p(0, 0), p(backW, 0)],
      [p(backW, 0), p(backW, backHem)],
      [p(0, backHem), p(backW, backHem)],
    ],
    points: [
      { n: '0', at: p(0, 0), note: 'Nape. Square down for the centre back and across for the top of the frame.' },
      { n: '1', at: p(0, scye), note: `0 to 1, armhole depth: ${cm(scye)}${m.armscye ? `, found so the armhole measures your armhole plus ease` : ''}. Square across for the underarm line.` },
      { n: '2', at: p(0, wb), note: `0 to 2, nape to waist: ${cm(NW)}. Square across for the waist line.${below ? ` The hem is ${cm(drop)} below.` : ''}` },
      { n: '3', at: hpsB0, note: `Back neck width: a fifth of the neck less 0.2 cm, ${cm(nw)} across and 2 cm up. ${widen ? `The neckline then widens ${cm(widen)} along the shoulder.` : ''}`.trim() },
      { n: '4', at: spB, note: `Shoulder: your shoulder length plus 1 cm to ease into the front, ${cm(blen)}, at ${deg(backSlope)} degrees${m.back_shoulder_slope && backSlope !== BACK_SLOPE && !fit.backSlope && !dropShoulder ? `, so the shoulder point is your back shoulder slope, ${cm(m.back_shoulder_slope)}, from the centre back waist` : ''}.` },
      { n: '5', at: abPt, note: `Half the across back: ${cm(AB / 2)}, 1 cm below halfway down the armhole.` },
      { n: '6', at: sideB, note: `A quarter of the bust with ease, less ${cm(shift)} moved to the front for the bust: ${cm(backW)}.` },
      {
        n: '7',
        at: swB,
        note: `Side waist: a quarter of the waist with ease less 0.5 cm is ${cm(backWq)}; the side seam comes in ${cm(sideSupp)}${dartB > 0.3 ? ` and the dart takes ${cm(dartB)}` : ''}.`,
      },
      ...(dartB > 0.3 ? [{ n: 'D', at: dartTipB, note: `Waist dart: ${cm(dartB)} wide, ending 2.5 cm below the underarm line.` }] : []),
    ],
  };
  const backPiece: Piece = {
    name: 'Bodice back',
    draft: backDraft,
    outline: back,
    lines: backLines,
    grain: [p(backW * 0.2, scye - 4), p(backW * 0.2, backHem - 3)],
    balance: [{ pts: [p(0, sideB.y), sideB], label: 'UNDERARM LINE' }],
    notches: [
      [add(abPt, p(0, -0.5)), p(1, 0)], // double notch = back
      [add(abPt, p(0, 0.5)), p(1, 0)],
      [zipEnd, p(-1, 0)],
    ],
    labels: [
      { at: p(backW * 0.42, scye - 7), text: 'BODICE BACK', size: 1.4 },
      { at: p(backW * 0.42, scye - 5), text: backCut, size: 0.9 },
      { at: add(zipEnd, p(3.2, 0.3)), text: 'ZIP ENDS', size: 0.7 },
    ],
    cut: backCut,
    seamAllowance: s.seamAllowance,
    allowances: { neck: s.neckArmholeAllowance, armhole: s.neckArmholeAllowance, hem: s.hemAllowance },
    meta: {},
  };

  // ---- front --------------------------------------------------------------
  const nwF = nw - 0.2;
  const hpsF0 = p(nwF, -2);
  const cfNeck0 = p(0, hpsF0.y + nw + 1);

  if (FL < NW + 1) {
    warnings.push(
      `front length ${FL} cm is not longer than back length ${NW} cm; drafted with ${NW + 1} cm, please re-measure`,
    );
    FL = NW + 1;
  }
  const dx = AS / 2 - nwF;
  const apex = p(AS / 2, hpsF0.y + Math.sqrt(Math.max(BD ** 2 - dx ** 2, 1)));
  const wf = apex.y + Math.max(FL - BD, 0);

  let frontSlope = FRONT_SLOPE;
  if (m.front_shoulder_slope) {
    const a = slopeFor(hpsF0, SL, p(0, wf), m.front_shoulder_slope);
    if (a === undefined) warnings.push(`front shoulder slope ${m.front_shoulder_slope} cm doesn't fit the front length and shoulder; drafted at the standard ${deg(FRONT_SLOPE)} degrees, please re-measure`);
    else frontSlope = a;
  }
  frontSlope = corrected(frontSlope, fit.frontSlope);
  // The neck gape pivots about the shoulder as fitted; a lower shoulder then drops from there.
  const fittedSlope = frontSlope;
  frontSlope = dropped(frontSlope, SL - widen);
  // Deep necklines stop 5 cm above the bust point.
  const cfNeck = p(0, Math.max(cfNeck0.y, Math.min(cfNeck0.y + nl.frontDepth, apex.y - 5)));

  // A neck gape pinned out at the toile is closed the way a pattern cutter does it: slash from the
  // middle of the neckline to the bust point, and pivot the shoulder, armhole and upper side seam
  // about the bust point until the gape closes. The bust dart opens by as much. Without a bust dart
  // there is nowhere for it to go, so it is left.
  const neckMid = lerp(cfNeck, add(hpsF0, mul(p(Math.cos(fittedSlope), Math.sin(fittedSlope)), widen)), 0.5);
  const gape = fit.neckGape && bustDarts ? fit.neckGape : 0;
  const turnF = gape ? -gape / len(sub(neckMid, apex)) : 0;
  const turnV = (v: P) => p(v.x * Math.cos(turnF) - v.y * Math.sin(turnF), v.x * Math.sin(turnF) + v.y * Math.cos(turnF));
  const pivot = (q: P) => add(apex, turnV(sub(q, apex)));

  const hpsF0t = pivot(hpsF0);
  const hpsFit = add(hpsF0, mul(p(Math.cos(fittedSlope), Math.sin(fittedSlope)), widen));
  const spF = pivot(add(hpsFit, mul(p(Math.cos(frontSlope), Math.sin(frontSlope)), SL - widen)));
  const hpsF = pivot(hpsFit);
  const uF = unit(sub(spF, hpsF));

  const afPt = pivot(p(AF / 2, (hpsFit.y + (SL - widen) * Math.sin(frontSlope) + scye) / 2 + 1.5));
  // The armhole is sized from the high bust (the body's frame). Bust volume beyond that is added
  // below the armhole, with the side seam widening out to full width at bust level, the way a
  // full bust adjustment does it. Otherwise a full bust makes the armhole far too wide.
  const sideF = pivot(p(Math.min(frontW, Math.max((HB + be) / 4 + 0.5, AF / 2 + 3)), scye));
  // A lower shoulder's armhole is lowered with it, but the bust level stays where the body has it.
  const sideBust0 = p(frontW, Math.max(apex.y, scye - dropShoulder + 3));
  const sideBust = pivot(sideBust0);
  const down = turnV(p(0, 1));
  // Below the underarm the side seam starts straight down, square to the armhole like the back's,
  // then swings out to full bust width, so the underarm curve blends across the side seam.
  const chord = len(sub(sideBust, sideF));
  const bustward = unit(sub(p(frontW - sideSupp, wf), sideBust));
  const upperCurve = new Path(sideF).curve(add(sideF, mul(down, chord * 0.45)), sub(sideBust, mul(bustward, chord * 0.35)), sideBust, 'side');
  const upper = chord > 0.05 ? upperCurve.length() : 0;

  // Side bust dart: the extra front length over the bust, but at least what the cup size
  // (full minus high bust) calls for. A bigger dart lowers the side waist, which is what a
  // side-dart block looks like with the dart open. Without darts it is left as length at the
  // centre front, which hangs as ease over the bust.
  const backSide = len(sub(swB, sideB));
  const straightDown = upper + len(sub(p(frontW - sideSupp, wf), sideBust));
  // A pivoted neck gape raises the side at bust level; all of that goes into the dart.
  const bustDart = side.keep ? side.keep.bustDart : !bustDarts ? 0 : Math.max(straightDown - backSide, (B - HB) / 2 + Math.max(0, sideBust0.y - sideBust.y), 0);
  const lower = side.keep ? side.keep.lower : backSide + bustDart - upper; // side seam left below bust level, dart included
  if (bustDarts && lower < bustDart + 4) warnings.push('side seam too short below the bust for the bust dart');
  const across = frontW - sideSupp - sideBust.x;
  let swF = p(frontW - sideSupp, sideBust.y + Math.sqrt(Math.max(lower ** 2 - across ** 2, 0)));

  const front = frontNeck(new Path(cfNeck), hpsF, uF, s.neckline)
    .line(spF, 'shoulder')
    .curve(add(spF, mul(perp(uF), 2.5)), sub(afPt, p(0, 3)), afPt, 'armhole')
    .curve(add(afPt, p(0, (scye - afPt.y) * 0.5)), sub(sideF, mul(squareTo(upper ? down : unit(sub(swF, sideF))), (sideF.x - afPt.x) * 0.75)), sideF, 'armhole');

  const frontLines: Path[] = [];
  const towardApex = (from: P, shortBy: number) => add(from, mul(unit(sub(apex, from)), len(sub(apex, from)) - shortBy));
  // Side bust dart, pressed down, with the side seam peaked over it.
  if (upper) {
    front.segs.push(...upperCurve.segs);
    front.tags.push(...upperCurve.tags);
  }
  let bustTip = apex;
  if (bustDart > 0.3) {
    const uSide = unit(sub(swF, sideBust));
    const s1 = add(sideBust, mul(uSide, Math.min(2, Math.max(0.5, lower - bustDart - 5))));
    const s2 = add(s1, mul(uSide, bustDart));
    const d = finishDart(towardApex(lerp(s1, s2, 0.5), 2.5), s2, s1, unit(sub(swF, s2)));
    front.line(d.far, 'side').line(d.peak, 'dart').line(d.near, 'dart');
    frontLines.push(new Path(d.far).line(d.tip).line(d.near));
    bustTip = d.tip;
    // Truing lengthens the legs slightly; finish the side seam at the back's length so they still match.
    swF = add(d.near, mul(unit(sub(swF, d.near)), backSide - upper - len(sub(d.far, sideBust))));
  }
  const sideIn = unit(sub(swF, front.end));
  front.line(swF, 'side');
  // The waist slopes down to the side while the bust dart is open; the waist dart sits on it.
  const waistY = below ? (x: number) => wf + ((swF.y - wf) * x) / swF.x : squaredWaist(wf, swF.x, swF.y, sideIn);
  const nearX = apex.x - dartF / 2;
  const farX = apex.x + dartF / 2;
  let cfHem = wf;
  let hipF = swF;
  if (!below) {
    if (dartF > 0.3) {
      const near = p(nearX, waistY(nearX));
      const d = finishDart(p(apex.x, apex.y + 2.5), near, p(farX, waistY(farX)), unit(sub(p(nearX - 0.5, waistY(nearX - 0.5)), near)));
      waistRun(front, waistY, d.far.x);
      front.line(d.peak, 'dart').line(d.near, 'dart');
      frontLines.push(new Path(d.near).line(d.tip).line(d.far));
    }
    waistRun(front, waistY, 0);
  } else {
    // Drop the front side seam below the waist by whatever makes it the back's length.
    const target = hipCurveLength(swB, hipB);
    const hx = hemFull / 4 + 0.5;
    let lo = 0;
    let hi = target;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (hipCurveLength(swF, p(hx, swF.y + mid)) < target) lo = mid;
      else hi = mid;
    }
    const dy = (lo + hi) / 2;
    hipF = p(hx, swF.y + dy);
    hipCurve(front, swF, hipF, 'side');
    if (dartF > 0.3) {
      const depth = Math.max(2, Math.min(12, drop - 3));
      frontLines.push(
        fishEye(p(apex.x, apex.y + 2.5), p(nearX, waistY(nearX)), p(farX, waistY(farX)), p(apex.x, waistY(apex.x) + depth)),
      );
    }
    // The hem runs parallel to the waist, so the front keeps the length the bust needs.
    cfHem = wf + dy;
    // Square to the side seam and to the centre front, even where the front hangs longer at the centre.
    const k = hipF.x * 0.35;
    front.curve(sub(hipF, p(k, 0)), p(k, cfHem), p(0, cfHem), 'hem');
  }
  front.line(cfNeck, 'fold');
  front.closed = true;
  // Bust point marker
  frontLines.push(new Path(sub(apex, p(0.5, 0))).line(add(apex, p(0.5, 0))));
  frontLines.push(new Path(sub(apex, p(0, 0.5))).line(add(apex, p(0, 0.5))));

  const frontCut = 'Cut 1 on fold';
  const frontDraft = {
    frame: [
      [p(0, hpsF0.y), p(frontW, hpsF0.y)],
      [p(frontW, hpsF0.y), p(frontW, cfHem)],
      [p(0, wf), p(frontW, wf)],
    ],
    points: [
      { n: '0', at: hpsF0t, note: `Front neck width: the back's less 0.2 cm, ${cm(nwF)}. Square down for the centre front.` },
      {
        n: '1',
        at: cfNeck,
        note: `Centre front neck: ${cm(cfNeck0.y - hpsF0.y)} below the neck point${cfNeck.y > cfNeck0.y + 0.05 ? `, lowered ${cm(cfNeck.y - cfNeck0.y)} for the neckline` : ''}.`,
      },
      { n: '2', at: spF, note: `Shoulder: your shoulder length, ${cm(SL)}, at ${deg(frontSlope + turnF)} degrees${m.front_shoulder_slope && frontSlope !== FRONT_SLOPE && !fit.frontSlope && !turnF && !dropShoulder ? `, so the shoulder point is your front shoulder slope, ${cm(m.front_shoulder_slope)}, from the centre front waist` : ''}.` },
      { n: '3', at: apex, note: `Bust point: half the apex separation, ${cm(AS / 2)}, across, and the bust depth, ${cm(BD)}, from the neck point.` },
      { n: '4', at: afPt, note: `Half the across front: ${cm(AF / 2)}.` },
      { n: '5', at: sideF, note: `Underarm: sized from the high bust, so the armhole fits the frame of the body.` },
      { n: '6', at: sideBust, note: `A quarter of the bust with ease, plus ${cm(shift)} for the bust: ${cm(frontW)}. The side seam swings out to here.` },
      { n: '7', at: p(0, wf), note: `Centre front waist: your front shoulder to waist, ${cm(FL)}, measured down over the bust point.` },
      {
        n: '8',
        at: swF,
        note: `Side waist: a quarter of the waist with ease plus 0.5 cm is ${cm(frontWq)}; the side seam comes in ${cm(sideSupp)} and is made the back's length.`,
      },
      ...(bustDart > 0.3 ? [{ n: 'B', at: bustTip, note: `Bust dart: ${cm(bustDart)}, the extra length the front needs over the bust, pointing at the bust point and ending 2.5 cm short of it.` }] : []),
      ...(dartF > 0.3 ? [{ n: 'D', at: p(apex.x, apex.y + 2.5), note: `Waist dart: ${cm(dartF)} wide, under the bust point and ending 2.5 cm below it.` }] : []),
    ],
  };
  const frontPiece: Piece = {
    name: 'Bodice front',
    draft: frontDraft,
    outline: front,
    lines: frontLines,
    grain: [p(frontW * 0.62, scye + 1), p(frontW * 0.62, Math.min(cfHem, hipF.y) - 4)],
    fold: [p(0, cfNeck.y + 2), p(0, cfHem - 2)],
    balance: [{ pts: [p(0, scye), sideF], label: 'UNDERARM LINE' }],
    notches: [[afPt, p(1, 0)]],
    labels: [
      { at: p(frontW * 0.32, scye - 4.5), text: 'BODICE FRONT', size: 1.4 },
      { at: p(frontW * 0.32, scye - 2.5), text: frontCut, size: 0.9 },
    ],
    cut: frontCut,
    seamAllowance: s.seamAllowance,
    allowances: { neck: s.neckArmholeAllowance, armhole: s.neckArmholeAllowance, fold: 0, hem: s.hemAllowance },
    // A V neck comes to a point at the centre front on purpose.
    meta: s.neckline === 'v' ? { pointedAtCentre: ['neck'] } : {},
  };

  // ---- checks -------------------------------------------------------------
  return {
    pieces: [frontPiece, backPiece],
    bustDart: r(bustDart),
    waistDarts: { front: r(dartF), back: r(dartB) },
    sideSuppression: r(sideSupp),
    armholeDepth: r(scye, 1),
    armhole: r(taggedLength(back, 'armhole') + taggedLength(front, 'armhole'), 1),
    shoulder: { front: r(len(sub(spF, hpsF))), back: r(len(sub(spB, hpsB))) },
    shoulderSlope: { front: deg(frontSlope + turnF), back: deg(backSlope) },
    sideSeam: { frontLessDart: r(taggedLength(front, 'side')), back: r(taggedLength(back, 'side')) },
    finishedBust: r(2 * (backW + frontW), 1),
    // Round the body: the waist seam with darts closed (it slopes, so it is longer than the pieces are wide).
    finishedWaist: r(below ? 2 * (swB.x - dartB + swF.x - dartF) : 2 * (taggedLength(front, 'waist') + taggedLength(back, 'waist')), 1),
    finishedHem: below ? r(2 * (hipB.x + hipF.x), 1) : undefined,
    backLength: r(backHem - bd, 1),
    zipCm,
    front: { apex, waistSide: swF, waistCentre: p(0, wf), hemSide: hipF, hemCentre: p(0, cfHem) },
    neck: r(2 * (taggedLength(back, 'neck') + taggedLength(front, 'neck')), 1),
    closure: 'back_zip',
    collar: 'none',
    warnings,
    inner: { bustDart, lower, upper },
  };
}
