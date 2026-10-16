// Trouser block, drafted flat from the waist, hip, crotch depth and crotch length (after Aldrich's
// trouser block). Each leg is a front and a back, side seam on the left and crotch on the right. The
// crease line runs down the middle of each, the front and back crotch curves are drafted so the whole
// crotch seam is the person's own crotch length with ease, and the seams are trued so front and back
// sew together end to end.
import { P, Path, add, len, mul, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
import type { Piece } from './piece';
import { DraftError, Fit, SkirtFitting, Waistband, WAISTBAND_CM, cm } from './skirt';

export interface TrousersMeasurements {
  waist: number;
  full_hip: number;
  waist_to_hip: number;
  /** Seated, from the waist down the side to the chair: how far the crotch sits below the waist. */
  crotch_depth: number;
  /** From the centre front waist, between the legs, to the centre back waist. */
  crotch_length: number;
  waist_to_knee: number;
  waist_to_floor: number;
  front_waist_to_hip?: number;
  back_waist_to_hip?: number;
}

export type Leg = 'straight' | 'wide' | 'tapered' | 'culotte';
export type TrouserLength = 'full' | 'ankle';
export type TrouserClosure = 'fly' | 'side_zip';

export interface TrousersStyle {
  fit: Fit;
  leg: Leg;
  /** Culottes are always cut to mid-calf. */
  length: TrouserLength;
  closure: TrouserClosure;
  seamAllowance: number;
  hemAllowance: number;
  /** Corrections from a skirt or trouser toile: the waist, the hip and the centre waists. */
  fitting?: SkirtFitting;
}

export const DEFAULT_TROUSERS: TrousersStyle = { fit: 'regular', leg: 'straight', length: 'full', closure: 'fly', seamAllowance: 1.5, hemAllowance: 4 };

/** Ease in cm: round the waist and hip, below the crotch (depth) and along the crotch seam. */
export const TROUSER_EASE: Record<Fit, { waist: number; hip: number; depth: number; crotch: number }> = {
  fitted: { waist: 1, hip: 4, depth: 1, crotch: 2 },
  regular: { waist: 2, hip: 6, depth: 1.5, crotch: 3 },
  relaxed: { waist: 3, hip: 10, depth: 2.5, crotch: 5 },
};

/** Knee and hem round the leg, as a share of the finished hip. */
export const LEG_WIDTHS: Record<Leg, { knee: number; hem: number }> = {
  straight: { knee: 0.46, hem: 0.43 },
  tapered: { knee: 0.41, hem: 0.3 },
  wide: { knee: 0.6, hem: 0.66 },
  culotte: { knee: 0.68, hem: 0.76 },
};

export const LEG_WORDS: Record<Leg, string> = { straight: 'straight-leg trousers', wide: 'wide-leg trousers', tapered: 'tapered trousers', culotte: 'culottes' };

/** The narrowest hem a foot goes through. */
const MIN_HEM = 31;
/** A fly zip, and how far the fly's cut-on underlap reaches past the centre front on the waistband. */
const FLY_ZIP = 18;
const UNDERLAP = 3.5;

export interface TrousersDraft {
  pieces: Piece[];
  fit: Fit;
  leg: Leg;
  closure: TrouserClosure;
  lengthCm: number;
  finishedWaist: number;
  finishedHip: number;
  kneeCm: number;
  hemCm: number;
  /** The crotch seam, one side: front and back curves and what they were drafted to. */
  crotch: { front: number; back: number; target: number };
  /** True when the crotch length couldn't be reached within a sensible fork, so the nearest was drafted. */
  crotchCapped: boolean;
  zipCm: number;
  waistband: Waistband & { underlap: number };
  dartsPerSide: { front: number; back: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Rotate a quarter turn: (x, y) to (-y, x). */
const perp = (v: P): P => p(-v.y, v.x);

interface Frame {
  m: TrousersMeasurements;
  s: TrousersStyle;
  H: number;
  W: number;
  hd: number;
  cd: number;
  L: number;
  kn: number;
  kneeW: number;
  hemW: number;
}

interface HalfArgs {
  isFront: boolean;
  /** Quarter hip, centre line at the hip to the side seam. */
  hipQ: number;
  waistQ: number;
  /** The centre waist: in from the hip line, and up (negative down) from the waist line. */
  centreIn: number;
  centreUp: number;
  fork: number;
  /** The back leg moved down, and the back fork dropped, to true the side seam and the inside leg. */
  legShift: number;
  forkDrop: number;
  /** The back crease moved toward the fork (from 1 cm short of halfway), so the inside leg runs as the front's does. */
  creaseShift?: number;
  dartMax: number;
  dartLens: number[];
  zipCm: number;
}

interface Half {
  piece: Piece;
  crotch: number;
  side: number;
  inseam: number;
}

/** Darts for the waist suppression: the side takes up to 2 cm, the darts the rest, the side again past their most. */
function suppression(supp: number, n: number, dartMax: number) {
  if (supp <= 0.6) return { side: supp, darts: [] as number[] };
  let side = Math.min(2, supp * 0.4);
  let each = (supp - side) / n;
  if (each > dartMax) {
    each = dartMax;
    side = supp - n * dartMax;
  }
  if (each < 0.8) return { side: supp, darts: [] as number[] };
  return { side, darts: new Array(n).fill(each) as number[] };
}

function half(f: Frame, a: HalfArgs): Half {
  const { hd, cd, L, kn } = f;
  const shift = a.legShift;
  const hipC = p(a.hipQ, hd); // centre at the hip
  const cw = p(a.hipQ - a.centreIn, -a.centreUp); // centre waist
  const down = unit(sub(hipC, cw)); // down the centre seam
  const w = perp(down); // along the waist toward the side seam, square to the centre seam
  // The waist from the centre to the side line at x = 0 is the room there is; the rest is suppression.
  const room = cw.x / -w.x;
  const sup = suppression(room - a.waistQ, a.dartLens.length, a.dartMax);
  const dartTotal = sup.darts.reduce((t, d) => t + d, 0);
  const sw = add(cw, mul(w, a.waistQ + dartTotal)); // side waist
  const fork = p(a.hipQ + a.fork, cd + a.forkDrop);
  const crease = a.isFront ? fork.x / 2 : fork.x / 2 - 1 + (a.creaseShift ?? 0);
  const share = a.isFront ? -1.5 : 1.5;
  const kneeHalf = (f.kneeW / 2 + share) / 2;
  const hemHalf = (f.hemW / 2 + share) / 2;
  const ko = p(crease - kneeHalf, kn + shift);
  const ki = p(crease + kneeHalf, kn + shift);
  const ho = p(crease - hemHalf, L + shift);
  const hi = p(crease + hemHalf, L + shift);
  const sideHip = p(0, hd);

  // Darts square to the waist, pressed toward the centre. Front: one on the crease; back: two, spread.
  const nDown = perp(mul(w, -1)); // square to the waist, into the piece
  const along = sup.darts.map((d, i) => {
    const span = a.waistQ + dartTotal;
    if (a.isFront) return clamp((crease - cw.x) / w.x, d / 2 + 3, span - d / 2 - 3);
    return span * (i === 0 ? 0.36 : 0.66);
  });
  const darts = sup.darts.map((d, i) => {
    const c = along[i];
    const near = add(cw, mul(w, c - d / 2));
    const far = add(cw, mul(w, c + d / 2));
    const tip = add(add(cw, mul(w, c)), mul(nDown, Math.min(a.dartLens[i], hd - 3)));
    return finishDart(tip, near, far, mul(w, -1));
  });

  const out = new Path(cw);
  for (const d of darts) out.line(d.near, 'waist').line(d.peak, 'dart').line(d.far, 'dart');
  out.line(sw, 'waist');
  // Side seam: square off the waist, down to the hip, the knee and the hem.
  const kDir = unit(sub(ho, ko));
  out.curve(add(sw, mul(nDown, (hd - sw.y) * 0.35)), p(0, hd - (hd - sw.y) * 0.35), sideHip, 'side');
  out.curve(p(0, hd + (ko.y - hd) * 0.35), sub(ko, mul(kDir, (ko.y - hd) * 0.3)), ko, 'side');
  out.line(ho, 'side');
  // Hem: square to the side seam and to the inside leg, so it runs on across both once sewn.
  const iDir = unit(sub(hi, ki));
  const across = len(sub(hi, ho)) / 3;
  out.curve(add(ho, mul(p(kDir.y, -kDir.x), across)), sub(hi, mul(p(iDir.y, -iDir.x), across)), hi, 'hem');
  // Inside leg: up to the knee, then curving to leave the fork straight down.
  out.line(ki, 'inseam');
  const upper = ki.y - fork.y;
  out.curve(sub(ki, mul(iDir, upper * 0.3)), add(fork, p(0, upper * 0.35)), fork, 'inseam');
  // Crotch curve: leaves the fork square to the inside leg and runs into the centre seam at the hip.
  out.curve(sub(fork, p(a.fork * 0.75, 0)), add(hipC, mul(down, (fork.y - hd) * 0.6)), hipC, 'crotch');
  out.line(cw, 'crotch');
  out.closed = true;

  const name = a.isFront ? 'Trousers front' : 'Trousers back';
  const cut = 'Cut 2 (1 pair)';
  const notches: [P, P][] = a.isFront ? [[sideHip, p(-1, 0)], [ko, mul(perp(kDir), -1)]] : [[add(sideHip, p(0, -0.5)), p(-1, 0)], [add(sideHip, p(0, 0.5)), p(-1, 0)], [ko, mul(perp(kDir), -1)]];
  // Knee notches on the inside leg too, and where the zip ends.
  notches.push([ki, perp(iDir)]);
  const zipEnd = a.zipCm > 0 ? (a.isFront ? add(cw, mul(down, a.zipCm)) : undefined) : undefined;
  if (zipEnd) notches.push([zipEnd, perp(down)]);
  const labelAt = p(crease, hd + (kn - hd) * 0.35);
  const piece: Piece = {
    name,
    outline: out,
    lines: darts.map((d) => new Path(d.near).line(d.tip).line(d.far)),
    grain: [p(crease, hd + 2), p(crease, L + shift - 6)],
    notches,
    balance: [
      { pts: [sideHip, p(hipC.x, hd)], label: 'HIP LINE' },
      { pts: [p(Math.min(0, ko.x), cd + (a.isFront ? 0 : a.forkDrop)), p(fork.x, fork.y)], label: 'CROTCH LINE' },
      { pts: [ko, ki], label: 'KNEE LINE' },
    ],
    labels: [
      { at: labelAt, text: name.toUpperCase(), size: 1.6 },
      { at: add(labelAt, p(0, 2.2)), text: cut, size: 1.0 },
      { at: add(labelAt, p(0, 4)), text: 'CREASE LINE ON GRAIN', size: 0.7 },
      ...(zipEnd ? [{ at: add(zipEnd, p(-6, 0.3)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
    cut,
    draft: {
      frame: [
        [p(0, -a.centreUp), p(0, L + shift)],
        [p(0, 0), p(a.hipQ, 0)],
        [sideHip, hipC],
        [p(0, cd), p(fork.x, cd)],
        [p(crease, 0), p(crease, L + shift)],
      ],
      points: [
        { n: '0', at: p(0, 0), note: 'Waist line at the side. Square down for the side line and across for the waist line.' },
        { n: '1', at: sideHip, note: `0 to 1, waist to hip: ${cm(hd)}. Square across for the hip line.` },
        { n: '2', at: p(0, cd), note: `0 to 2, crotch depth with ${cm(f.cd - f.m.crotch_depth)} ease: ${cm(cd)}. Square across for the crotch line.` },
        { n: '3', at: hipC, note: `1 to 3, a quarter of the hip with ease ${a.isFront ? 'less' : 'plus'} 1 cm: ${cm(a.hipQ)}. Square up and down.` },
        {
          n: '4',
          at: cw,
          note: a.isFront
            ? `Centre front waist: ${cm(a.centreIn)} in from 3's line${a.centreUp ? `, ${cm(Math.abs(a.centreUp))} ${a.centreUp > 0 ? 'up' : 'down'}` : ''}. Join to 3 for the centre front.`
            : `Centre back waist: ${cm(a.centreIn)} in and ${cm(a.centreUp)} up, for the seat. Join to 3 for the centre back seam.`,
        },
        {
          n: '5',
          at: fork,
          note: `3 to 5 on the crotch line, the ${a.isFront ? 'front' : 'back'} fork: ${cm(a.fork)}${a.forkDrop ? `, dropped ${cm(a.forkDrop)} to true the inside leg` : ''}. Curve 3 to 5 for the crotch.`,
        },
        { n: '6', at: sw, note: `Side waist: a quarter of the waist with ease, ${a.isFront ? 'less' : 'plus'} 0.5 cm, is ${cm(a.waistQ)}, square off the ${a.isFront ? 'centre front' : 'centre back seam'}, plus ${cm(dartTotal)} of darts.` },
        { n: '7', at: p(crease, kn + shift), note: `Crease line halfway across the crotch line${a.isFront ? '' : (a.creaseShift ?? 0) - 1 > 0.05 ? `, plus ${cm((a.creaseShift ?? 0) - 1)} toward the fork` : (a.creaseShift ?? 0) - 1 < -0.05 ? `, less ${cm(1 - (a.creaseShift ?? 0))}` : ''}. Knee ${cm(2 * kneeHalf)} across, centred on it.` },
        { n: '8', at: p(crease, L + shift), note: `Hem ${cm(2 * hemHalf)} across, centred on the crease. Join the knee and the hem.` },
        ...darts.map((d, i) => ({ n: `D${i + 1}`, at: d.tip, note: `Dart ${i + 1}: ${cm(sup.darts[i])} wide, ${cm(len(sub(d.tip, p((d.near.x + d.far.x) / 2, (d.near.y + d.far.y) / 2))))} long, square to the waist.` })),
      ],
    },
    seamAllowance: f.s.seamAllowance,
    allowances: { hem: f.s.hemAllowance, crotch: 1 },
    meta: { dartsCm: sup.darts.map((d) => Math.round(d * 100) / 100), creaseX: crease, fork: fork, crotchCurve: true },
  };
  return { piece, crotch: taggedLength(out, 'crotch'), side: taggedLength(out, 'side'), inseam: taggedLength(out, 'inseam') };
}

/** Bisection for an increasing function: the x in [lo, hi] where g(x) is zero (to 0.1 mm), or the nearer end. */
function solve(g: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  if (g(a) >= 0) return a;
  if (g(b) <= 0) return b;
  while (b - a > 2e-4) {
    const mid = (a + b) / 2;
    if (g(mid) < 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/** The x where an increasing, nearly straight g is zero, by the secant method, kept within [lo, hi]. */
function secant(g: (x: number) => number, lo: number, hi: number): number {
  let x0 = 1;
  let x1 = 1.15;
  let g0 = g(x0);
  let g1 = g(x1);
  for (let i = 0; i < 6 && Math.abs(g1) > 0.02; i++) {
    const x2 = Math.abs(g1 - g0) < 1e-9 ? x1 : Math.min(hi, Math.max(lo, x1 - (g1 * (x1 - x0)) / (g1 - g0)));
    if (x2 === x1) break;
    x0 = x1;
    g0 = g1;
    x1 = x2;
    g1 = g(x1);
  }
  return x1;
}

/** Trouser lengths: full to 3 cm off the floor, ankle 9 cm, culottes mid-calf. */
export function trouserLength(m: TrousersMeasurements, s: Pick<TrousersStyle, 'leg' | 'length'>): number {
  if (s.leg === 'culotte') return m.waist_to_knee + (m.waist_to_floor - m.waist_to_knee) * 0.42;
  return m.waist_to_floor - (s.length === 'ankle' ? 9 : 3);
}

export function draftTrousers(m: TrousersMeasurements, style: Partial<TrousersStyle> = {}): TrousersDraft {
  const s = { ...DEFAULT_TROUSERS, ...style };
  const ease = TROUSER_EASE[s.fit];
  const fit = s.fitting ?? {};
  const H = m.full_hip + ease.hip + (fit.hipEase ?? 0);
  const W = m.waist + ease.waist + (fit.waistEase ?? 0);
  if (W > H + 4) throw new DraftError('Your waist is larger than your hip, so trousers can’t be drafted from this block yet.');
  const cd = m.crotch_depth + ease.depth;
  const hd = Math.min(m.waist_to_hip, cd - 5);
  if (cd > m.waist_to_knee - 12) throw new DraftError('Your crotch depth looks long next to your waist to knee. Measure it seated, from the waist down the side to the chair.');
  const L = trouserLength(m, s);
  const kn = Math.min(m.waist_to_knee - 2, (cd + L) / 2 + (s.leg === 'culotte' ? 0 : 10));
  const widths = LEG_WIDTHS[s.leg];
  const hemW = Math.max(MIN_HEM, widths.hem * H);
  const kneeW = Math.max(widths.knee * H, s.leg === 'tapered' ? hemW + 3 : 0);
  const f: Frame = { m, s, H, W, hd, cd, L, kn, kneeW, hemW };
  const target = m.crotch_length + ease.crotch;
  const fly = s.closure === 'fly';
  const zipCm = fly ? Math.min(FLY_ZIP, cd - 6) : Math.min(20, Math.max(18, hd));

  // Centre waists: the front 1 cm in from the hip line, the back raised and in for the seat. A tummy or
  // a sway back measured (or found on a toile) raises or lowers them.
  const frontUp = clamp((m.front_waist_to_hip ?? m.waist_to_hip) - m.waist_to_hip, -3, 3) - (fit.frontDrop ?? 0);
  const backUp = clamp(2.5 + (m.back_waist_to_hip !== undefined ? m.back_waist_to_hip - m.waist_to_hip : 0) - (fit.backDrop ?? 0), 0, 6);
  const backIn = clamp(0.035 * H, 3, 5);
  const fork0 = { front: 0.05 * H, back: 0.12 * H };

  const build = (k: number) => {
    const front = half(f, { isFront: true, hipQ: H / 4 - 1, waistQ: W / 4 - 0.5, centreIn: 1, centreUp: frontUp, fork: fork0.front * k, legShift: 0, forkDrop: 0, dartMax: 2.5, dartLens: [9], zipCm: fly ? zipCm : 0 });
    const base = { isFront: false, hipQ: H / 4 + 1, waistQ: W / 4 + 0.5, centreIn: backIn, centreUp: backUp, fork: fork0.back * k, legShift: 0, forkDrop: 0.75, dartMax: 3, dartLens: [13, 11], zipCm: 0 };
    // A wide back fork pulls the inside leg long: set the back crease so it runs as the front's does,
    // then true the side seams by moving the back leg up or down, then the inside legs by dropping the
    // back fork the last few millimetres.
    // Moving the leg changes the inside leg and moving the crease changes the side seam, so settle them in turn.
    let creaseShift = 0;
    let legShift = 0;
    for (let i = 0; i < 3; i++) {
      creaseShift = solve((c) => front.inseam - half(f, { ...base, legShift, creaseShift: c }).inseam, -6, 6);
      legShift = solve((e) => half(f, { ...base, creaseShift, legShift: e }).side - front.side, -8, 8);
    }
    const backArgs = { ...base, creaseShift };
    const forkDrop = solve((d) => front.inseam - half(f, { ...backArgs, legShift, forkDrop: d }).inseam, -4, 6);
    const back = half(f, { ...backArgs, legShift, forkDrop });
    return { front, back };
  };
  // The fork's reach sets the crotch seam's length: find the one that makes it the person's own.
  const lo = 0.55;
  const hi = 1.7;
  const k = secant((x) => {
    const b = build(x);
    return b.front.crotch + b.back.crotch - target;
  }, lo, hi);
  const { front, back } = build(k);
  const crotch = front.crotch + back.crotch;

  front.piece.meta.crotchTarget = target;
  const pieces: Piece[] = [front.piece, back.piece];
  if (fly) pieces.push(...flyPieces(front.piece, zipCm, s.seamAllowance));
  else markSideZip(front.piece, back.piece, zipCm);

  const r = (v: number) => Math.round(v * 10) / 10;
  const finishedWaist = 2 * (taggedLength(front.piece.outline, 'waist') + taggedLength(back.piece.outline, 'waist'));
  return {
    pieces,
    fit: s.fit,
    leg: s.leg,
    closure: s.closure,
    lengthCm: r(L),
    finishedWaist: r(W),
    finishedHip: r(H),
    kneeCm: r(2 * (len(sub(front.piece.balance![2].pts[1], front.piece.balance![2].pts[0])) + len(sub(back.piece.balance![2].pts[1], back.piece.balance![2].pts[0]))) / 2),
    hemCm: r(taggedLength(front.piece.outline, 'hem') + taggedLength(back.piece.outline, 'hem')),
    crotch: { front: r(front.crotch), back: r(back.crotch), target: r(target) },
    crotchCapped: Math.abs(crotch - target) > 0.3,
    zipCm,
    waistband: {
      cutLength: r(finishedWaist + 2 * s.seamAllowance + (fly ? UNDERLAP : 0)),
      cutWidth: r(2 * WAISTBAND_CM + 2 * s.seamAllowance),
      sideMark: r(s.seamAllowance + (fly ? UNDERLAP : 0) + finishedWaist / 4),
      underlap: fly ? UNDERLAP : 0,
    },
    dartsPerSide: { front: (front.piece.meta.dartsCm as number[]).length, back: (back.piece.meta.dartsCm as number[]).length },
  };
}

/** Where along a tagged edge, by length from its start, a point falls. */
function pointAlong(path: Path, tag: string, at: number): { q: P; dir: P } | undefined {
  const { pts, tags } = path.taggedPoints(48);
  let run = 0;
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] !== tag) continue;
    const d = len(sub(pts[i + 1], pts[i]));
    if (run + d >= at) {
      const t = (at - run) / d;
      return { q: add(pts[i], mul(sub(pts[i + 1], pts[i]), t)), dir: unit(sub(pts[i + 1], pts[i])) };
    }
    run += d;
  }
  return undefined;
}

/** A side zip, in the left side seam: notches where it ends on the front and the back. */
function markSideZip(front: Piece, back: Piece, zipCm: number) {
  for (const pc of [front, back]) {
    const at = pointAlong(pc.outline, 'side', zipCm);
    if (!at) continue;
    pc.notches.push([at.q, perp(at.dir)]);
    pc.labels.push({ at: add(at.q, p(1.2, 0.3)), text: 'LEFT ZIP ENDS', size: 0.7 });
    pc.meta.sideZip = zipCm;
  }
}

/**
 * The fly: a facing cut to the centre front's line on the left front, the zip stitched through it, and
 * a shield folded in half behind the zip on the right. The facing's edge is curved at the foot, as the
 * topstitching is.
 */
function flyPieces(front: Piece, zipCm: number, sa: number): Piece[] {
  const start = front.outline.start;
  const at = pointAlong(front.outline, 'crotch', taggedLength(front.outline, 'crotch') - zipCm - 2);
  const foot = at?.q ?? add(start, p(0, zipCm + 2));
  const down = unit(sub(foot, start));
  const toSide = perp(mul(down, -1)); // across toward the side seam
  const wide = 4;
  const facing = new Path(start)
    .line(add(start, mul(toSide, wide)), 'waist')
    .line(add(foot, add(mul(toSide, wide), mul(down, -wide))), 'fly-edge')
    .curve(add(foot, add(mul(toSide, wide), mul(down, -wide * 0.45))), add(foot, mul(toSide, wide * 0.45)), foot, 'fly-edge')
    .line(start, 'fly');
  facing.closed = true;
  const len0 = zipCm + 3;
  const shield = new Path(p(0, 0)).line(p(4, 0), 'waist').line(p(4, len0 - 2), 'fly-edge').curve(p(4, len0 - 0.9), p(2.9, len0), p(1.8, len0), 'fly-edge').line(p(0, len0), 'fly-edge').line(p(0, 0), 'fold');
  shield.closed = true;
  const mid = (a: P, b: P) => p((a.x + b.x) / 2, (a.y + b.y) / 2);
  const fc = mid(start, foot);
  return [
    {
      name: 'Fly facing',
      outline: facing,
      lines: [],
      grain: [add(fc, mul(toSide, wide * 0.5)), add(add(fc, mul(toSide, wide * 0.5)), mul(down, 6))],
      notches: [],
      labels: [
        { at: add(add(start, mul(toSide, wide * 0.5)), mul(down, 4)), text: 'FLY FACING', size: 0.8, rotate: 90 },
        { at: add(add(start, mul(toSide, wide * 0.5)), mul(down, 12)), text: 'Cut 1, interfaced', size: 0.6, rotate: 90 },
      ],
      cut: 'Cut 1, interfaced',
      kind: 'facing',
      seamAllowance: sa,
      allowances: { fly: 1 },
      meta: {},
    },
    {
      name: 'Fly shield',
      outline: shield,
      lines: [],
      grain: [p(2, 3), p(2, len0 - 4)],
      fold: [p(0, 1), p(0, len0 - 1)],
      notches: [],
      labels: [
        { at: p(2, 4), text: 'FLY SHIELD', size: 0.8, rotate: 90 },
        { at: p(2, 12), text: 'Cut 1 on fold', size: 0.6, rotate: 90 },
      ],
      cut: 'Cut 1 on fold',
      kind: 'facing',
      seamAllowance: sa,
      allowances: { fold: 0 },
      meta: {},
    },
  ];
}

/**
 * The waistband as a pattern piece, folded along its length. With a fly it runs from the left front's
 * fly edge round to the right front, where the underlap extends past the centre front; with a side zip
 * it runs from the left side round the front and back to the left side, the underlap on the back.
 */
export function trousersWaistband(d: TrousersDraft, sa: number): Piece {
  const W = 2 * WAISTBAND_CM;
  const front = taggedLength(d.pieces[0].outline, 'waist');
  const back = taggedLength(d.pieces[1].outline, 'waist');
  const total = 2 * (front + back);
  const L = total + d.waistband.underlap;
  const outline = new Path(p(0, 0)).line(p(W, 0), 'end').line(p(W, L), 'waist').line(p(0, L), 'end').line(p(0, 0), 'band');
  outline.closed = true;
  // Marks from the start of the band.
  const marks: [number, string][] =
    d.closure === 'fly'
      ? [[0, ''], [front, 'SIDE SEAM'], [front + back, 'CENTRE BACK'], [front + 2 * back, 'SIDE SEAM'], [total, 'CENTRE FRONT']]
      : [[back, 'CENTRE BACK'], [2 * back, 'SIDE SEAM'], [2 * back + front, 'CENTRE FRONT']];
  const notches: [P, P][] = marks.filter(([y]) => y > 0).flatMap(([y]): [P, P][] => [[p(W, y), p(1, 0)], [p(0, y), p(-1, 0)]]);
  const tag = (at: P, text: string) => ({ at, text, size: 0.55, rotate: 90 });
  return {
    name: 'Waistband',
    kind: 'waistband',
    outline,
    lines: [],
    grain: [p(W * 0.25, 5.5), p(W * 0.25, Math.max(10, front - 4))],
    notches,
    balance: [{ pts: [p(W / 2, 0), p(W / 2, L)], label: 'FOLD LINE' }],
    labels: [
      { at: p(W * 0.62, L * 0.4), text: 'WAISTBAND', size: 1.0, rotate: 90 },
      { at: p(W * 0.5, L * 0.4), text: 'Cut 1', size: 0.6, rotate: 90 },
      ...marks.filter(([, t]) => t).map(([y, t]) => tag(p(W * 0.2, y + 2.6), t)),
      ...(d.waistband.underlap ? [tag(p(W * 0.2, L - d.waistband.underlap + 0.3), 'UNDERLAP')] : []),
    ],
    cut: 'Cut 1',
    fabric: 'Self + interfacing',
    seamAllowance: sa,
    allowances: {},
    meta: { finishedWidth: WAISTBAND_CM, lengthCm: Math.round(L * 10) / 10 },
  };
}
