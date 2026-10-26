// How the sleeve meets the body, beyond the set-in sleeve: a dropped shoulder, the shoulder carried
// out past the shoulder point and the armhole lowered, with a flatter sleeve to match; a raglan, a
// line from the neck to the armhole notch cutting the shoulder off the bodice and onto the sleeve,
// which is cut in two along the top of the arm; or a kimono sleeve, cut in one with the bodice, the
// shoulder running on down the arm and the underarm lowered into the side seam.
// Plain ASCII punctuation (see instructions.ts).
import { P, add, len, lerp, mul, p, sub, unit } from './geometry';
import { Ring, pathOf, ringOf } from './manipulate';
import type { Piece } from './piece';
import type { SleeveLength, SleeveShape } from './sleeve';

export type SleeveCut = 'set_in' | 'drop' | 'raglan' | 'kimono';
export const SLEEVE_CUTS: [SleeveCut, string][] = [
  ['set_in', 'Set-in'],
  ['drop', 'Dropped shoulder'],
  ['raglan', 'Raglan'],
  ['kimono', 'Kimono'],
];

/** A dropped shoulder runs 5 cm past the shoulder point, the underarm 3 cm lower, the sleeve's crown
 * nearly flat with 0.6 cm of ease. A raglan line leaves the neck 3 cm from the neck point (2.5 at the
 * back) and bows up to 1.5 cm off straight. A kimono sleeve slopes 30 degrees below level, the underarm
 * 6 cm lower, 12 cm of ease round the upper arm, a 2.5 cm hem. */
export const DROP = { out: 5, down: 3, crownEase: 0.6 };
const RAGLAN = { neck: 3, backNeck: 2.5, bow: 1.5 };
export const KIMONO = { angle: 30, under: 6, ease: 12, hem: 2.5, past: 8 };

export type KimonoLength = 'short' | 'elbow' | 'three_quarter';

/** Which shapes each length allows: puff, cap and flutter sleeves are short, bishop sleeves long. Kept
 * here, and re-exported by sleeve.ts, so the bodice can read it without importing the sleeve. */
export const SHAPES_FOR_LENGTH: Record<SleeveLength, SleeveShape[]> = {
  none: [],
  short: ['straight', 'puff', 'cap', 'flutter'],
  elbow: ['fitted', 'straight', 'puff'],
  three_quarter: ['fitted', 'straight', 'bishop'],
  long: ['fitted', 'straight', 'bishop'],
};

/** The sleeve shape as drafted: the one chosen, or straight when its length doesn't allow it. */
function shapeFor(length: string | undefined, shape: string | undefined): SleeveShape {
  const shapes = SHAPES_FOR_LENGTH[(length ?? 'none') as SleeveLength] ?? [];
  return shape && shapes.includes(shape as SleeveShape) ? (shape as SleeveShape) : shapes.includes('straight') ? 'straight' : (shapes[0] ?? 'straight');
}

interface CutStyle {
  sleeveCut?: SleeveCut;
  sleeve?: string;
  sleeveShape?: string;
  neckline: string;
  neck?: unknown;
  unevenNeck?: unknown;
  princess?: string;
  bustDart?: string;
  closure?: string;
  yoke?: { front?: number; back?: number };
  empire?: number;
  panel?: unknown;
  structure?: string;
}

/**
 * Why a sleeve cut can't go with the rest, or undefined when it can. Each needs sleeves, and shoulders
 * to carry them (no strapless, cami, halter, one-shoulder or cowl top); princess seams, side panels, a
 * yoke or a bust dart from the shoulder, neck or armhole would be cut across; a raglan or kimono can't
 * wrap. A dropped shoulder or raglan takes a straight or bishop sleeve; a kimono is short to
 * three-quarter, as wider would not fit across the cloth.
 */
export function sleeveCutBlocked(c: CutStyle, cut: SleeveCut): string | undefined {
  if (cut === 'set_in') return undefined;
  const name = cut === 'drop' ? 'A dropped shoulder' : cut === 'raglan' ? 'A raglan' : 'A kimono sleeve';
  if (!c.sleeve || c.sleeve === 'none') return `${name} needs sleeves: choose a sleeve length first.`;
  if (['strapless', 'sweetheart', 'cami', 'halter', 'one_shoulder', 'cowl'].includes(c.neckline) && !c.neck) return `${name} needs a bodice with shoulders.`;
  if (c.unevenNeck) return `${name} needs the front cut in two halves, not whole for an uneven neckline.`;
  if ((c.princess && c.princess !== 'none') || c.panel !== undefined || c.yoke?.front !== undefined || c.yoke?.back !== undefined || c.empire !== undefined)
    return `${name} would cut across princess seams, side panels, a yoke or an empire seam.`;
  if (c.bustDart && !['side', 'french', 'waist'].includes(c.bustDart)) return `${name} needs the bust dart in the side seam or the waist.`;
  if (cut !== 'drop' && c.closure === 'wrap') return `${name} can't go on a wrap front.`;
  if (cut === 'kimono') return c.sleeve === 'long' ? 'A kimono sleeve goes to three-quarter length at most: longer, the bodice would be wider than the cloth.' : undefined;
  if (!['straight', 'bishop'].includes(shapeFor(c.sleeve, c.sleeveShape))) return `${name} takes a straight or bishop sleeve.`;
  return undefined;
}

/** The sleeve cut as drafted: set-in where it can't be had. */
export const sleeveCutOf = (c: CutStyle): SleeveCut => (c.sleeveCut && !sleeveCutBlocked(c, c.sleeveCut) ? c.sleeveCut : 'set_in');

// ---- shared ---------------------------------------------------------------------------------

/** The first run of edges with `tag`: the index of its first and last edge. */
function runOf(r: Ring, tag: string): [number, number] | undefined {
  const i = r.tags.indexOf(tag);
  if (i < 0) return undefined;
  let j = i;
  while (r.tags[j + 1] === tag) j++;
  return [i, j];
}

/** A front or back's neck point, shoulder point and underarm, as indices into its ring. */
function landmarksOf(pc: Piece): { r: Ring; hps: number; sp: number; u: number } | undefined {
  const r = ringOf(pc.outline);
  const sh = runOf(r, 'shoulder');
  const ar = runOf(r, 'armhole');
  if (!sh || !ar || ar[0] !== sh[1] + 1 || r.tags[ar[1] + 1] !== 'side') return undefined;
  return { r, hps: sh[0], sp: sh[1] + 1, u: ar[1] + 1 };
}

/** Walk down the side seam from the underarm: the point `d` cm down, and the edge it falls on. */
function downSide(r: Ring, u: number, d: number): { at: P; edge: number } {
  let left = d;
  let j = u;
  while (r.tags[j] === 'side' && j < r.pts.length - 1) {
    const a = r.pts[j];
    const b = r.pts[j + 1];
    const l = len(sub(b, a));
    if (l >= left) return { at: lerp(a, b, l ? left / l : 0), edge: j };
    left -= l;
    j++;
  }
  return { at: r.pts[j], edge: Math.max(u, j - 1) };
}

/** How far the side seam runs down from the underarm before any dart or the hem. */
export function sideRoom(pc: Piece): number {
  const k = landmarksOf(pc);
  if (!k) return 0;
  let total = 0;
  for (let j = k.u; k.r.tags[j] === 'side' && j < k.r.pts.length - 1; j++) total += len(sub(k.r.pts[j + 1], k.r.pts[j]));
  return total;
}

// Extra points close to each end, as ringOf has them, so the directions a curve leaves and arrives in
// (which the corner checks read) survive.
const cubic = (a: P, c1: P, c2: P, b: P, n = 24): P[] =>
  [0, 0.0008, 0.006, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n), 0.994, 0.9992, 1].map((t) => {
    const m = 1 - t;
    return p(m ** 3 * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t ** 3 * b.x, m ** 3 * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t ** 3 * b.y);
  });
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);
/** The point `d` cm along a polyline. */
function along(pts: P[], d: number): P {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    if (left <= l) return lerp(pts[i - 1], pts[i], l ? left / l : 0);
    left -= l;
  }
  return pts[pts.length - 1];
}
/** A notch on a run at `q`, pointing away from `inside`. */
function notchOn(pts: P[], q: P, inside: P): [P, P] {
  let best = 1;
  pts.forEach((x, i) => {
    if (i && len(sub(x, q)) < len(sub(pts[best], q))) best = i;
  });
  const t = unit(sub(pts[Math.min(best + 1, pts.length - 1)], pts[Math.max(best - 1, 0)]));
  let nrm = p(t.y, -t.x);
  if ((q.x - inside.x) * nrm.x + (q.y - inside.y) * nrm.y < 0) nrm = mul(nrm, -1);
  return [q, nrm];
}
/** The armhole notch marks as a back has them (two, 0.5 cm either side of `q`) or a front (one). */
function armNotches(pts: P[], q: P, inside: P, back: boolean): [P, P][] {
  const [at, dir] = notchOn(pts, q, inside);
  if (!back) return [[at, dir]];
  const t = p(-dir.y, dir.x);
  return [
    [add(at, mul(t, 0.5)), dir],
    [add(at, mul(t, -0.5)), dir],
  ];
}
/** The notches left once the old armhole is gone: any within reach of its inner points are taken off. */
function offArmhole(pc: Piece, arm: P[]) {
  const near = (q: P) =>
    arm.slice(1).some((b, i) => {
      const a = arm[i];
      const ab = sub(b, a);
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
      return len(sub(lerp(a, b, t), q)) < 1.2;
    });
  // Not the ends: a notch there marks the shoulder or the side seam, which stay.
  return pc.notches.filter(([q]) => !near(q) || len(sub(q, arm[0])) < 0.5 || len(sub(q, arm[arm.length - 1])) < 0.5);
}
const isBackPiece = (pc: Piece) => /back/i.test(pc.name);

// ---- dropped shoulder ---------------------------------------------------------------------------

/** A front or back with its shoulder carried out and its armhole lowered and redrawn. */
export function dropPiece(pc: Piece, lower = DROP.down): Piece {
  const k = landmarksOf(pc);
  if (!k) return pc;
  const { r, hps, sp, u } = k;
  const HPS = r.pts[hps];
  const SP = r.pts[sp];
  const us = unit(sub(SP, HPS));
  const SP2 = add(SP, mul(us, DROP.out));
  const { at: U2, edge: j } = downSide(r, u, lower);
  // Down from the shoulder, square to it, and into the underarm square to the side seam, scooping in a little.
  const down = p(-us.y, us.x);
  const H = U2.y - SP2.y;
  const c1 = add(SP2, mul(down, H * 0.45));
  // Square to the side seam, so the underarm runs on smoothly into the other piece's.
  const sd = unit(sub(r.pts[j + 1], U2));
  let inward = p(-sd.y, sd.x);
  if (inward.x > 0) inward = mul(inward, -1);
  const c2 = add(U2, mul(inward, Math.max(2.5, Math.min(6, SP2.x - U2.x + 3))));
  const curve = cubic(SP2, c1, c2, U2);
  const pts = [...r.pts.slice(0, sp), ...curve, ...r.pts.slice(j + 1)];
  const tags = [...r.tags.slice(0, sp), ...curve.slice(1).map(() => 'armhole'), 'side', ...r.tags.slice(j + 1)];
  const inside = p(SP2.x * 0.4, U2.y);
  const notch = along([...curve].reverse(), polyLen(curve) * 0.4);
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    notches: [...offArmhole(pc, r.pts.slice(sp, u + 1)), ...armNotches(curve, notch, inside, isBackPiece(pc))],
    balance: pc.balance?.map((b) => (/UNDERARM/.test(b.label) ? { ...b, pts: b.pts.map((q) => p(q.x, U2.y)) } : b)),
    meta: { ...pc.meta, sleeveCut: 'drop' },
  };
}

// ---- kimono ----------------------------------------------------------------------------------

export interface KimonoSize {
  /** Shoulder point to the sleeve hem along the top of the arm, and round the hem, in cm. */
  lengthCm: number;
  hemCm: number;
  /** Round the sleeve at the underarm, as cut. */
  bicepCm: number;
}

/** The kimono sleeve's length and width for the arm. */
export function kimonoSize(length: KimonoLength, arm: { arm_length: number; upper_arm: number; wrist?: number }): KimonoSize {
  const hand = Math.max(19, (arm.wrist ?? arm.upper_arm * 0.55) * 1.3);
  const bicep = arm.upper_arm + KIMONO.ease;
  const r = (v: number) => Math.round(v * 10) / 10;
  const lengthCm = length === 'short' ? 18 : length === 'elbow' ? arm.arm_length * 0.58 + 2 : arm.arm_length * 0.8;
  const hemCm = length === 'short' ? bicep : length === 'elbow' ? bicep * 0.88 : Math.max(bicep * 0.75, hand + 6);
  return { lengthCm: r(lengthCm), hemCm: r(hemCm), bicepCm: r(bicep) };
}

/** How far along the top of the arm, from the shoulder point, the lowered underarm sits: a kimono sleeve
 * runs at least 8 cm past it, so its underarm curves out along the arm rather than rising to the hem. */
export function kimonoReach(pc: Piece, under = KIMONO.under): number {
  const k = landmarksOf(pc);
  if (!k) return 0;
  const a = (KIMONO.angle * Math.PI) / 180;
  const d = sub(downSide(k.r, k.u, under).at, k.r.pts[k.sp]);
  return d.x * Math.cos(a) + d.y * Math.sin(a) + KIMONO.past;
}

/** The underarm curve from the sleeve hem's lower corner into the lowered side seam, `pull` setting how
 * far it runs along the sleeve before turning down. */
const underCurve = (H2: P, U2: P, v: P, side: P, pull: number) => {
  const dist = len(sub(U2, H2));
  return cubic(H2, sub(H2, mul(v, dist * pull)), sub(U2, mul(side, Math.min(8, dist * 0.35))), U2);
};

/** A front or back with the sleeve cut on, sloping down from the shoulder point. `pull` shapes the
 * underarm curve (the back's is set to match the front's length). */
function kimonoPiece(pc: Piece, size: KimonoSize, pull = 0.45, under = KIMONO.under): Piece {
  const k = landmarksOf(pc);
  if (!k) return pc;
  const { r, sp, u } = k;
  const SP = r.pts[sp];
  const a = (KIMONO.angle * Math.PI) / 180;
  const v = p(Math.cos(a), Math.sin(a));
  const nrm = p(-Math.sin(a), Math.cos(a));
  const E = add(SP, mul(v, size.lengthCm));
  const H2 = add(E, mul(nrm, size.hemCm / 2));
  const { at: U2, edge: j } = downSide(r, u, under);
  const side = unit(sub(r.pts[j + 1], U2));
  const curve = underCurve(H2, U2, v, side, pull);
  const pts = [...r.pts.slice(0, sp + 1), E, ...curve, ...r.pts.slice(j + 1)];
  const tags = [...r.tags.slice(0, sp), 'overarm', 'sleeve-hem', ...curve.slice(1).map(() => 'underarm'), 'side', ...r.tags.slice(j + 1)];
  // A notch where the shoulder meets the overarm, so the two seams line up.
  const notches: [P, P][] = [...offArmhole(pc, r.pts.slice(sp, u + 1)), [SP, mul(nrm, -1)]];
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    notches,
    balance: pc.balance?.filter((b) => !/UNDERARM/.test(b.label)),
    allowances: { ...pc.allowances, 'sleeve-hem': KIMONO.hem },
    meta: { ...pc.meta, sleeveCut: 'kimono' },
  };
}

/** The front and back with kimono sleeves, the shorter underarm curve drawn out to match the other's length. */
export function kimonoPair(front: Piece, back: Piece, size: KimonoSize, under = KIMONO.under): [Piece, Piece] {
  const f = kimonoPiece(front, size, 0.45, under);
  const b = kimonoPiece(back, size, 0.45, under);
  const longer = underLength(f) >= underLength(b) ? 'front' : 'back';
  const target = Math.max(underLength(f), underLength(b));
  const other = longer === 'front' ? back : front;
  let lo = 0.45;
  let hi = 4;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    // A longer pull draws the curve out along the sleeve, so it runs longer.
    if (underLength(kimonoPiece(other, size, mid, under)) < target) lo = mid;
    else hi = mid;
  }
  const matched = kimonoPiece(other, size, (lo + hi) / 2, under);
  return longer === 'front' ? [f, matched] : [matched, b];
}
const underLength = (pc: Piece) => {
  const r = ringOf(pc.outline);
  return r.tags.reduce((s, t, i) => (t === 'underarm' ? s + len(sub(r.pts[(i + 1) % r.pts.length], r.pts[i])) : s), 0);
};

// ---- raglan ------------------------------------------------------------------------------------

/** One side's shoulder piece as cut off the bodice, in the bodice's coordinates: the ring runs from the
 * raglan line's neck end round the neck, the shoulder and the armhole to the notch, and back up the
 * raglan line. */
export interface RaglanYoke {
  ring: Ring;
  /** The raglan line from the armhole notch up to the neck, as on the bodice. */
  line: P[];
  hps: P;
  sp: P;
  notch: P;
  neck: P;
  /** The armhole left on the bodice, from the notch down to the underarm, in cm. */
  under: number;
}

/** A front or back with its shoulder cut away along the raglan line, and the piece cut off. */
export function raglanSplit(pc: Piece): { body: Piece; yoke: RaglanYoke } | undefined {
  const k = landmarksOf(pc);
  if (!k) return undefined;
  const { r, hps, sp, u } = k;
  const back = isBackPiece(pc);
  const n = r.pts.length;
  // The neck end: back along the neck from the neck point.
  let left = back ? RAGLAN.backNeck : RAGLAN.neck;
  let iN = hps - 1;
  let N = r.pts[0];
  for (; iN >= 0; iN--) {
    const a = r.pts[iN + 1];
    const b = r.pts[iN];
    const l = len(sub(b, a));
    if (l >= left) {
      N = lerp(a, b, left / l);
      break;
    }
    left -= l;
  }
  if (iN < 0) return undefined;
  // The armhole end: at the armhole notch (the middle of a back's two), or 40% up from the underarm.
  const arm = r.pts.slice(sp, u + 1);
  const near = pc.notches.map(([q]) => q).filter((q) => arm.some((x) => len(sub(x, q)) < 1.2));
  const R0 = near.length ? mul(near.reduce((s, q) => add(s, q), p(0, 0)), 1 / near.length) : along([...arm].reverse(), polyLen(arm) * 0.4);
  let iR = sp;
  let best = Infinity;
  for (let i = sp; i < u; i++) {
    const a = r.pts[i];
    const b = r.pts[i + 1];
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, ((R0.x - a.x) * ab.x + (R0.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
    const d = len(sub(lerp(a, b, t), R0));
    if (d < best) {
      best = d;
      iR = i;
    }
  }
  const ab = sub(r.pts[iR + 1], r.pts[iR]);
  const tR = Math.max(0.02, Math.min(0.98, ((R0.x - r.pts[iR].x) * ab.x + (R0.y - r.pts[iR].y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
  const R = lerp(r.pts[iR], r.pts[iR + 1], tR);
  // The raglan line, from the neck to the notch, arriving along the armhole so the seam runs on
  // smoothly round under the arm, and bowing toward the shoulder no more than RAGLAN.bow.
  const mid = lerp(N, R, 0.5);
  const d = unit(sub(R, N));
  let bowDir = p(-d.y, d.x);
  if ((r.pts[sp].x - mid.x) * bowDir.x + (r.pts[sp].y - mid.y) * bowDir.y < 0) bowDir = mul(bowDir, -1);
  const up = unit(sub(r.pts[iR], r.pts[iR + 1]));
  // Back along the armhole from the notch, as far as keeps the line's bow (half the control point's
  // offset from the chord) within RAGLAN.bow.
  const off = (k: number) => {
    const q = add(R, mul(up, k));
    return (q.x - mid.x) * bowDir.x + (q.y - mid.y) * bowDir.y;
  };
  let reach = len(sub(N, R)) * 0.45;
  while (reach > 0.5 && Math.abs(off(reach)) > RAGLAN.bow * 2) reach *= 0.9;
  const ctl = add(R, mul(up, reach));
  const line = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return p((1 - t) ** 2 * N.x + 2 * (1 - t) * t * ctl.x + t * t * R.x, (1 - t) ** 2 * N.y + 2 * (1 - t) * t * ctl.y + t * t * R.y);
  });
  const m = line.length - 1;
  const bodyPts = [...r.pts.slice(0, iN + 1), ...line, ...r.pts.slice(iR + 1)];
  const bodyTags = [...r.tags.slice(0, iN), 'neck', ...line.slice(1).map(() => 'raglan'), 'armhole', ...r.tags.slice(iR + 1)];
  const yokePts = [N, ...r.pts.slice(iN + 1, iR + 1), R, ...line.slice(1, m).reverse()];
  const yokeTags = ['neck', ...r.tags.slice(iN + 1, iR), 'armhole', ...line.slice(1).map(() => 'raglan')];
  // A raglan notch halfway along the line, single at the front and double at the back.
  const half = along(line, polyLen(line) / 2);
  const inside = p(r.pts[sp].x * 0.3, R.y + 5);
  const body: Piece = {
    ...pc,
    outline: pathOf({ pts: bodyPts, tags: bodyTags }),
    notches: [...pc.notches.filter(([q]) => !near.includes(q) && !r.pts.slice(hps, sp + 1).some((x) => len(sub(x, q)) < 0.5)), ...armNotches(line, half, inside, back)],
    meta: { ...pc.meta, sleeveCut: 'raglan' },
  };
  if (n !== r.tags.length) return undefined;
  const under = polyLen([R, ...r.pts.slice(iR + 1, u + 1)]);
  return { body, yoke: { ring: { pts: yokePts, tags: yokeTags }, line, hps: r.pts[hps], sp: r.pts[sp], notch: R, neck: N, under } };
}
