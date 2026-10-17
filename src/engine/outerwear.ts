// Jackets and coats, drafted on the bodice block. The block is drafted with outerwear ease (it goes on
// over a blouse or a jumper), a slightly wider, lower neck, and to the hip; longer lengths carry the
// side and panel seams on down, flaring a little so a coat walks. The front then gets its opening: an
// extension for single or double-breasted buttons, and a notched lapel with its collar, a stand
// collar or a plain collarless edge. Facings, a full lining and patch pockets are cut from the
// pieces as drafted, and the sleeve is drafted to the armhole with jacket or coat ease.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceFitting, BodiceMeasurements, BodiceStyle, blockOf, draftBodice } from './bodice';
import { Ring, pathOf, ringOf } from './manipulate';
import { backOnFold, collarPieces } from './collar';
import { SleeveDraft, SleeveMeasurements, draftSleeve } from './sleeve';
import { DraftError } from './skirt';

export type OuterKind = 'jacket' | 'coat';
export type OuterFit = 'fitted' | 'regular' | 'relaxed';
export type OuterLength = 'cropped' | 'hip' | 'long' | 'thigh' | 'knee' | 'midi';
export type OuterShaping = 'darts' | 'princess' | 'boxy';
export type OuterFront = 'single' | 'double';
export type OuterCollar = 'notched' | 'stand' | 'collarless';
export type OuterPockets = 'none' | 'patch';
export type OuterSleeve = 'fitted' | 'straight';
export type OuterFlare = 'straight' | 'a_line';

export type OuterMeasurements = BodiceMeasurements & SleeveMeasurements & { waist_to_knee?: number; waist_to_floor?: number };

export interface OuterStyle {
  kind: OuterKind;
  fit: OuterFit;
  length: OuterLength;
  shaping: OuterShaping;
  front: OuterFront;
  collar: OuterCollar;
  pockets: OuterPockets;
  sleeve: OuterSleeve;
  /** Below the hip: straight, or flaring out to the hem. */
  flare: OuterFlare;
  seamAllowance: number;
  hemAllowance: number;
  fitting?: BodiceFitting;
}

/** The lengths each garment offers. */
export const OUTER_LENGTHS: Record<OuterKind, OuterLength[]> = { jacket: ['cropped', 'hip', 'long'], coat: ['thigh', 'knee', 'midi'] };

/** Ease at the bust, in cm. A jacket goes on over a blouse, a coat over a jacket or a jumper. */
export const OUTER_EASE: Record<OuterKind, Record<OuterFit, number>> = {
  jacket: { fitted: 10, regular: 13, relaxed: 17 },
  coat: { fitted: 13, regular: 17, relaxed: 21 },
};

/** The neckline sits a little wider and lower than a blouse's, over the clothes beneath. */
const OUTER_NECK = { frontDepth: 2, width: 1, backDepth: 0.5, fullness: 0.45 };

/** The extension beyond the centre front, and the button size, in cm. */
export const OUTER_EXTENSION: Record<OuterKind, Record<OuterFront, number>> = { jacket: { single: 2, double: 6.5 }, coat: { single: 2.5, double: 8 } };
export const OUTER_BUTTON: Record<OuterKind, number> = { jacket: 2, coat: 2.5 };

/** Flare added to each seam at the hem, per 40 cm below the hip. */
const FLARE_PER_40: Record<OuterFlare, number> = { straight: 1.2, a_line: 4 };

export const DEFAULT_OUTER: Record<OuterKind, OuterStyle> = {
  jacket: { kind: 'jacket', fit: 'regular', length: 'hip', shaping: 'darts', front: 'single', collar: 'notched', pockets: 'patch', sleeve: 'fitted', flare: 'straight', seamAllowance: 1.5, hemAllowance: 4 },
  coat: { kind: 'coat', fit: 'regular', length: 'knee', shaping: 'princess', front: 'single', collar: 'notched', pockets: 'patch', sleeve: 'fitted', flare: 'straight', seamAllowance: 1.5, hemAllowance: 5 },
};

/** The lapel as worn, for the flat: the break point, the roll line and the lapel and collar outlines. */
export interface Lapel {
  breakPt: P;
  roll: [P, P];
  /** The lapel folded back over the front, from the break point round to the gorge. */
  worn: P[];
  /** The collar's points on the front, as worn: the notch end of the gorge and the collar point. */
  notch: P;
  collarPoint: P;
  neckPoint: P;
  gorge: P;
}

export interface OuterDraft {
  kind: OuterKind;
  /** The bodice block it was drafted on: the sleeve is drafted to its armhole. */
  base: BodiceDraft;
  sleeve: SleeveDraft;
  /** Every piece, in print order: the shell, the collar, the facings and pockets, then the lining. */
  pieces: Piece[];
  /** The front and back as sewn, closed at the centre front and down to the hem: for the flat and the ease map. */
  block: [Piece, Piece];
  ext: number;
  buttons: { at: number[]; sizeCm: number; columns: number[] };
  lapel?: Lapel;
  pocket?: { x: number; y: number; w: number; h: number };
  finishedBust: number;
  finishedWaist: number;
  finishedHem: number;
  /** How far the hem sits below the waist, and the centre back from the neck to the hem. */
  drop: number;
  lengthCm: number;
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** Where a piece's outline crosses the level y: its leftmost and rightmost x. */
function spanAt(pc: Piece, y: number): [number, number] {
  const pts = pc.outline.points(8);
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a.y - y) * (b.y - y) <= 0 && Math.abs(b.y - a.y) > 1e-9) xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 0];
}

/** How far below the waist the hem sits for each length. */
export function outerDrop(m: OuterMeasurements, length: OuterLength): number {
  const WH = m.waist_to_hip ?? 20;
  const knee = m.waist_to_knee ?? WH + 38;
  const floor = m.waist_to_floor ?? knee + 45;
  switch (length) {
    case 'cropped':
      return WH / 2;
    case 'hip':
      return WH;
    case 'long':
      return WH + 10;
    case 'thigh':
      return WH + 0.5 * (knee - WH);
    case 'knee':
      return knee + 3;
    default:
      return knee + 0.45 * (floor - knee);
  }
}

/** Indices of the first run of edges tagged `tag`: [first edge, last edge]. */
function runOf(r: Ring, tag: string): [number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    return [i, j];
  }
  return undefined;
}

/**
 * The piece carried on below its hem by `extra` cm: the centre line and fold straight down, the side
 * and panel seams out by `flare` at the new hem, so the seams either side flare alike.
 */
export function extendPiece(pc: Piece, extra: number, flare: number): Piece {
  if (extra <= 0.05) return pc;
  const r = ringOf(pc.outline, 12);
  const hem = runOf(r, 'hem');
  if (!hem) return pc;
  const n = r.pts.length;
  const [i, j] = hem;
  const a = r.pts[i];
  const b = r.pts[(j + 1) % n];
  const before = r.tags[(i - 1 + n) % n];
  const after = r.tags[(j + 1) % n];
  const straight = (t: string) => t === 'fold' || t === 'centre' || t === 'opening';
  const out = (q: P, other: P, t: string) => add(q, p(straight(t) ? 0 : Math.sign(q.x - other.x) * flare, extra));
  let a2 = out(a, b, before);
  let b2 = out(b, a, after);
  // A flared seam meets the hem square, the hem curving up a little toward it over its last few centimetres.
  const square = (c2: P, c: P, other: P): { end: P; run: P[] } => {
    if (Math.abs(c2.x - c.x) < 1e-6) return { end: c2, run: [] };
    const sd = unit(sub(c2, c));
    const h = unit(sub(other, c2));
    const reach = 3.5; // the same on every piece, however narrow, so the seams either side match
    // Taken up the seam by the same amount on every piece, so the seams either side stay the same length.
    const end = sub(c2, mul(sd, (reach / 2) * Math.abs(sd.x)));
    let perp = p(-sd.y, sd.x);
    if (perp.x * h.x + perp.y * h.y < 0) perp = mul(perp, -1);
    const k = add(end, mul(perp, reach / 2));
    const to = add(c2, mul(h, reach));
    return { end, run: Array.from({ length: 8 }, (_, t) => quad(end, k, to, (t + 1) / 8)) };
  };
  const sa = square(a2, a, b2);
  const sb = square(b2, b, a2);
  a2 = sa.end;
  b2 = sb.end;
  const hemRun = [...sa.run, ...[...sb.run].reverse()];
  // A straight centre edge carries on down in one line: its old corner goes.
  const dropA = straight(before);
  const dropB = straight(after);
  const bi = (j + 1) % n;
  const pts: P[] = [];
  const tags: string[] = [];
  for (let k = 0; k < n; k++) {
    if (k > i && k <= j) continue;
    if (k === bi) continue;
    if (k === i) {
      if (!dropA) {
        pts.push(a);
        tags.push(before);
      }
      pts.push(a2, ...hemRun, b2);
      tags.push(...hemRun.map(() => 'hem'), 'hem', after);
      if (!dropB) {
        pts.push(b);
        tags.push(after);
      }
    } else {
      pts.push(r.pts[k]);
      tags.push(r.tags[k]);
    }
  }
  const moved = (q: P) => (q.y >= Math.min(a.y, b.y) - 0.5 ? add(q, p(0, extra)) : q);
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    fold: pc.fold ? [pc.fold[0], add(pc.fold[1], p(0, extra))] : undefined,
    grain: pc.grain ? [pc.grain[0], add(pc.grain[1], p(0, extra))] : undefined,
    labels: pc.labels.map((l) => ({ ...l, at: moved(l.at) })),
  };
}

/** The part of a ring on one side of the line x = g(y), the cut edge tagged `tag` and following the line. */
export function clipRing(r: Ring, g: (y: number) => number, keepLeft: boolean, tag: string, boundary: P[]): Ring {
  const inside = (q: P) => (keepLeft ? q.x <= g(q.y) + 1e-9 : q.x >= g(q.y) - 1e-9);
  const n = r.pts.length;
  const first = r.pts.findIndex(inside);
  if (first < 0) return { pts: [], tags: [] };
  const cross = (a: P, b: P) => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (inside(lerp(a, b, m)) === inside(a)) lo = m;
      else hi = m;
    }
    return lerp(a, b, (lo + hi) / 2);
  };
  const pts: P[] = [];
  const tags: string[] = [];
  let exit: P | undefined;
  for (let s = 0; s < n; s++) {
    const k = (first + s) % n;
    const a = r.pts[k];
    const b = r.pts[(k + 1) % n];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) {
      pts.push(a);
      tags.push(r.tags[k]);
    }
    if (ia && !ib) {
      exit = cross(a, b);
      pts.push(exit);
      tags.push(tag);
    } else if (!ia && ib) {
      const entry = cross(a, b);
      if (exit) {
        const [y0, y1] = [exit.y, entry.y];
        const between = boundary.filter((q) => (q.y - y0) * (q.y - y1) < 0 && Math.abs(q.y - y0) > 0.05 && Math.abs(q.y - y1) > 0.05);
        between.sort((u, v) => (y1 > y0 ? u.y - v.y : v.y - u.y));
        for (const q of between) {
          pts.push(q);
          tags.push(tag);
        }
      }
      pts.push(entry);
      tags.push(r.tags[k]);
    }
  }
  return { pts, tags };
}

const quad = (a: P, c: P, b: P, k: number) => add(add(mul(a, (1 - k) ** 2), mul(c, 2 * k * (1 - k))), mul(b, k * k));
const cubic = (a: P, c1: P, c2: P, b: P, k: number) =>
  add(add(mul(a, (1 - k) ** 3), mul(c1, 3 * k * (1 - k) ** 2)), add(mul(c2, 3 * k * k * (1 - k)), mul(b, k ** 3)));

/** The line the facing and the lining meet along: from the shoulder, curving down to `x` from the centre front, then straight to the hem. */
function facingLine(s4: P, x: number, join: number, bottom: number): { g: (y: number) => number; pts: P[] } {
  const c = p(x, s4.y + (join - s4.y) * 0.25);
  const curve = Array.from({ length: 25 }, (_, i) => quad(s4, c, p(x, join), i / 24));
  const pts = [...curve];
  for (let y = Math.ceil(join); y < bottom + 5; y += 1) pts.push(p(x, y));
  const g = (y: number) => {
    if (y <= s4.y) return s4.x + (s4.y - y) * 5;
    if (y >= join) return x;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      if ((y - a.y) * (y - b.y) <= 0 && Math.abs(b.y - a.y) > 1e-9) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    }
    return x;
  };
  return { g, pts };
}

/** A piece cut from another: the same markings that fall inside it. */
function cutFrom(pc: Piece, r: Ring, name: string, over: Partial<Piece>): Piece {
  const xs = r.pts.map((q) => q.x);
  const ys = r.pts.map((q) => q.y);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const within = (q: P) => q.x >= box[0] - 0.01 && q.x <= box[2] + 0.01 && q.y >= box[1] - 0.01 && q.y <= box[3] + 0.01;
  const mid = p((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
  const cut = over.cut ?? pc.cut;
  return {
    ...pc,
    name,
    outline: pathOf(r),
    lines: [],
    notches: pc.notches.filter(([q]) => within(q)),
    balance: undefined,
    draft: undefined,
    fold: undefined,
    alternate: undefined,
    grain: [p(mid.x, mid.y - 8), p(mid.x, mid.y + 8)],
    labels: [
      { at: add(mid, p(0, -2)), text: name.toUpperCase(), size: 0.9, rotate: box[2] - box[0] < 12 ? 90 : 0 },
      { at: add(mid, p(box[2] - box[0] < 12 ? -1.2 : 0, box[2] - box[0] < 12 ? -2 : -0.6)), text: cut, size: 0.55, rotate: box[2] - box[0] < 12 ? 90 : 0 },
    ],
    cut,
    meta: {},
    ...over,
  };
}

interface FrontOpening {
  piece: Piece;
  lapel?: Lapel;
  /** The front facing's inner edge. */
  facing: { g: (y: number) => number; pts: P[] };
  /** The front neck seam's length, centre front (or the gorge) to the neck point. */
  frontNeck: number;
}

/** The front opened at the centre front: the extension, the buttonholes, and the lapel or the collar's neck. */
function openFront(pc: Piece, s: OuterStyle, ext: number, buttons: OuterDraft['buttons'], breakY: number): FrontOpening {
  const r = ringOf(pc.outline, 24);
  const n = r.pts.length;
  const fi = r.tags.indexOf('fold');
  const foot = r.pts[fi];
  const neckCF = r.pts[(fi + 1) % n];
  const sh = runOf(r, 'shoulder')!;
  const hps = r.pts[sh[0]];
  const sp = r.pts[sh[1] + 1];
  const uSh = unit(sub(sp, hps));
  const bottomTag = r.tags[(fi - 1 + n) % n];
  const lines: Path[] = [new Path(p(0, neckCF.y + 0.5)).line(p(0, foot.y - 0.5))];
  const labels = pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: 'Cut 2 (1 pair)' } : l));
  labels.push({ at: p(0.7, (neckCF.y + foot.y) / 2 + 8), text: 'CENTRE FRONT', size: 0.6, rotate: 90 });
  // Buttonholes on the right front, keyhole end toward the edge, at the outer column.
  const hx = buttons.columns[0];
  for (const y of buttons.at) lines.push(new Path(p(hx - 0.3, y)).line(p(hx - 0.3 + buttons.sizeCm + 0.3, y)));
  if (buttons.columns.length > 1)
    for (const y of buttons.at) {
      const bx = buttons.columns[1];
      lines.push(new Path(p(bx - 0.5, y)).line(p(bx + 0.5, y)), new Path(p(bx, y - 0.5)).line(p(bx, y + 0.5)));
    }
  labels.push({ at: p(hx + buttons.sizeCm / 2, buttons.at[0] - 0.6), text: 'BUTTONHOLE', size: 0.5 });
  const facingX = s.front === 'double' ? (buttons.columns[1] ?? 0) + 4.5 : 7.5;
  const s4 = add(hps, mul(uSh, Math.min(4, len(sub(sp, hps)) * 0.4)));
  let pts: P[];
  let tags: string[];
  let lapel: Lapel | undefined;
  let frontNeck: number;
  let join: number;
  if (s.collar === 'notched') {
    // The roll line runs from the break point to 2 cm beyond the neck point along the shoulder line.
    const B = p(-ext, breakY);
    const R = sub(hps, mul(uSh, 2));
    const u = unit(sub(R, B));
    const Lr = len(sub(R, B));
    const nrm = p(-u.y, u.x); // toward the body
    const at = (sAlong: number, t: number) => add(B, add(mul(u, sAlong), mul(nrm, t)));
    const W = s.front === 'double' ? (s.kind === 'coat' ? 10 : 9) : s.kind === 'coat' ? 8.5 : 7.5;
    // The gorge meets the roll line well below the neck point, rising a little to the notch.
    const Q = at(Lr - 10, 0);
    const K = at(Lr - 9.4, -4.3);
    const Lp = at(Lr - (s.front === 'double' ? 6.5 : 10.4), -W);
    const lapelEdge = Array.from({ length: 21 }, (_, i) => cubic(Lp, at(Lr * 0.5, -W - 0.7), at(Lr * 0.18, -W * 0.7), B, i / 20)).reverse();
    // The neck seam curves up from the gorge to arrive square to the shoulder, so it runs on smoothly
    // into the back neck once the shoulders are sewn.
    let up = p(uSh.y, -uSh.x);
    if (up.y > 0) up = mul(up, -1);
    const neckSeam = Array.from({ length: 13 }, (_, i) => quad(Q, sub(hps, mul(up, len(sub(hps, Q)) * 0.45)), hps, i / 12)).slice(0, -1);
    pts = [...r.pts.slice(sh[0], fi + 1), p(-ext, foot.y), ...lapelEdge, K, ...neckSeam];
    tags = [...r.tags.slice(sh[0], fi), 'opening-hem', 'opening', ...lapelEdge.slice(1).map(() => 'lapel'), 'lapel', 'gorge', ...neckSeam.map(() => 'neck')];
    lines.push(new Path(B).line(lerp(B, R, 0.93)));
    labels.push({ at: add(at(Lr * 0.55, 0.9), p(0, 0)), text: 'ROLL LINE', size: 0.5, rotate: (Math.atan2(u.y, u.x) * 180) / Math.PI });
    const reflect = (q: P) => {
      const v = sub(q, B);
      const along = v.x * u.x + v.y * u.y;
      const across = v.x * nrm.x + v.y * nrm.y;
      return at(along, -across);
    };
    // The collar point, turned up from the lapel's top edge to leave a notch of about 50 degrees.
    const dl = unit(sub(Lp, K));
    const ang = (50 * Math.PI) / 180;
    const Cp = add(K, mul(add(mul(dl, Math.cos(ang)), mul(u, Math.sin(ang))), s.kind === 'coat' ? 4.6 : 4));
    lapel = { breakPt: B, roll: [B, R], worn: [...lapelEdge, K, Q].map(reflect), notch: reflect(K), collarPoint: reflect(Cp), neckPoint: hps, gorge: Q };
    frontNeck = polyLen([...neckSeam, hps]);
    join = breakY + 4;
    // For the collar: where the gorge runs and where the collar point sits, on the flat front.
    pc = { ...pc, meta: { ...pc.meta, gorge: [Q, K], collarPoint: Cp, neckPoint: hps } };
  } else {
    frontNeck = taggedLength(pc.outline, 'neck');
    pts = [...r.pts.slice(0, fi + 1), p(-ext, foot.y), p(-ext, neckCF.y)];
    tags = [...r.tags.slice(0, fi), 'opening-hem', 'opening', 'neck'];
    join = neckCF.y + 7;
  }
  const facing = facingLine(s4, facingX, Math.max(join, s4.y + 10), foot.y);
  const faceLine = new Path(facing.pts[0]);
  for (const q of facing.pts.slice(1)) if (q.y < foot.y - 0.5) faceLine.line(q);
  lines.push(faceLine);
  labels.push({ at: p(facingX + 0.8, foot.y - 14), text: 'FACING LINE', size: 0.5, rotate: 90 });
  return {
    piece: {
      ...pc,
      outline: pathOf({ pts, tags }),
      lines: [...pc.lines, ...lines],
      labels,
      fold: undefined,
      cut: 'Cut 2 (1 pair)',
      allowances: { ...pc.allowances, opening: 1, lapel: 1, gorge: 1, 'opening-neck': 1, 'opening-hem': pc.allowances[bottomTag] ?? s.hemAllowance },
      meta: { ...pc.meta, buttons: buttons.at },
    },
    lapel,
    facing,
    frontNeck,
  };
}

/** The upper and under collar for a notched lapel, drafted to the neck seam and the gorge. */
function notchedCollar(front: Piece, backNeck: number, frontNeck: number, s: OuterStyle): Piece {
  const [Q, K] = front.meta.gorge as [P, P];
  const N = front.meta.neckPoint as P;
  const Cp = front.meta.collarPoint as P;
  const stand = s.kind === 'coat' ? 3.5 : 3;
  const fall = s.kind === 'coat' ? 5 : 4.2;
  const spring = 2.5;
  const L = backNeck + frontNeck;
  // The neck edge: straight across the back neck, springing down along the front neck.
  const neck = Array.from({ length: 41 }, (_, i) => {
    const x = (L * i) / 40;
    const k = Math.max(0, (x - backNeck * 0.6) / (L - backNeck * 0.6));
    return p(x, spring * k * k);
  });
  // Stretch to the exact length.
  const got = polyLen(neck);
  const neckPts = neck.map((q) => p((q.x * L) / got, q.y));
  const E = neckPts[neckPts.length - 1];
  const tE = unit(sub(E, neckPts[neckPts.length - 2]));
  const up = p(tE.y, -tE.x);
  // The gorge and collar point carried over from the front: square to the neck seam as it is there.
  const d1 = unit(sub(Q, N));
  let nF = p(-d1.y, d1.x);
  const bodyward = sub(p(N.x + 5, N.y + 10), N);
  if (nF.x * bodyward.x + nF.y * bodyward.y > 0) nF = mul(nF, -1);
  const map = (q: P) => {
    const v = sub(q, Q);
    return add(E, add(mul(tE, v.x * d1.x + v.y * d1.y), mul(up, v.x * nF.x + v.y * nF.y)));
  };
  const Kc = map(K);
  const Cc = map(Cp);
  const top = p(0, -(stand + fall));
  const outer = Array.from({ length: 21 }, (_, i) => cubic(Cc, lerp(Cc, top, 0.35), p(L * 0.45, top.y), top, i / 20));
  const pts = [...neckPts, Kc, ...outer];
  const tags = [...neckPts.slice(1).map(() => 'neck'), 'gorge', 'collar', ...outer.slice(1, -1).map(() => 'collar'), 'fold'];
  const cut = 'Cut 2 on fold';
  const mid = p(L * 0.45, -(stand + fall) / 2 + 0.4);
  return {
    name: 'Collar',
    kind: 'collar',
    outline: pathOf({ pts, tags }),
    lines: [new Path(p(0, -stand)).line(p(L * 0.8, -stand + spring * 0.3))],
    grain: [p(1.5, -stand - fall + 1), p(1.5, -1)],
    fold: [p(0, -(stand + fall) + 0.6), p(0, -0.6)],
    notches: [[neckPts[Math.round((40 * backNeck) / L)], p(0, 1)]],
    balance: [],
    labels: [
      { at: add(mid, p(0, -0.3)), text: 'COLLAR', size: 0.8 },
      { at: add(mid, p(0, 0.7)), text: cut, size: 0.5 },
      { at: p(L * 0.35, -stand - 0.4), text: 'ROLL LINE', size: 0.45 },
    ],
    cut,
    fabric: 'Upper collar in self, under collar in self on the bias + interfacing',
    seamAllowance: s.seamAllowance,
    allowances: { neck: 1, gorge: 1, collar: 1, fold: 0 },
    meta: { foldAt: 'centre back' },
    draft: {
      frame: [],
      points: [
        { n: '1', at: p(0, 0), note: `Square a line the back neck plus the front neck seam long, ${r1(L)} cm, and drop its front end ${spring} cm for the spring, so the fall has room to roll over.` },
        { n: '2', at: top, note: `Square up ${stand} cm for the stand and ${fall} cm for the fall at the centre back.` },
        { n: '3', at: Kc, note: 'Carry the gorge line on from the front neck, the same length as the lapel\'s, to the notch.' },
        { n: '4', at: Cc, note: 'Mark the collar point to leave the notch open, and curve the outer edge back to the centre back, square to it.' },
      ],
    },
  };
}

/** A patch pocket, its top turned back for a facing. */
function patchPocket(w: number, h: number, sa: number): Piece {
  const top = 3.5;
  const R = 2.5;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const pts = [p(0, 0), ...arc(p(R, top + h - R), Math.PI), ...arc(p(w - R, top + h - R), Math.PI / 2), p(w, 0)];
  const tags = [...pts.slice(1).map(() => 'pocket'), 'pocket-top'];
  const cut = 'Cut 2';
  return {
    name: 'Patch pocket',
    kind: 'facing',
    outline: pathOf({ pts, tags }),
    lines: [],
    grain: [p(w * 0.25, top + 2), p(w * 0.25, top + h - 3)],
    notches: [
      [p(0, top), p(-1, 0)],
      [p(w, top), p(1, 0)],
    ],
    balance: [{ pts: [p(0, top), p(w, top)], label: 'FOLD' }],
    labels: [
      { at: p(w / 2, top + h * 0.45), text: 'PATCH POCKET', size: 0.8 },
      { at: p(w / 2, top + h * 0.45 + 1.1), text: cut, size: 0.55 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { pocket: 1, 'pocket-top': 1 },
    meta: {},
  };
}

/** The back lining: the back on the fold, with a pleat at the centre back for ease across the shoulders. */
function backLining(pc: Piece, pleat: number): Piece {
  const r = ringOf(pc.outline, 24);
  const fi = r.tags.indexOf('fold');
  if (fi < 0) return { ...pc, name: 'Back lining', kind: 'lining', fabric: 'Lining' };
  const n = r.pts.length;
  const moved = r.pts.map((q) => add(q, p(pleat, 0)));
  const a = moved[fi];
  const b = moved[(fi + 1) % n];
  const pts = [...moved.slice(0, fi + 1), p(0, a.y), p(0, b.y), ...moved.slice(fi + 1)];
  const tags = [...r.tags.slice(0, fi), r.tags[(fi - 1 + n) % n], 'fold', r.tags[(fi + 1) % n] === 'neck' ? 'neck' : r.tags[(fi + 1) % n], ...r.tags.slice(fi + 1)];
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const cut = 'Cut 1 on fold';
  return cutFrom(pc, { pts, tags }, 'Back lining', {
    kind: 'lining',
    fabric: 'Lining',
    cut,
    fold: [p(0, top + 2), p(0, bottom - 2)],
    lines: [new Path(p(pleat, top + 0.5)).line(p(pleat, top + 8))],
    labels: [
      { at: p(pleat + 8, top + 18), text: 'BACK LINING', size: 1.1 },
      { at: p(pleat + 8, top + 19.6), text: cut, size: 0.7 },
      { at: p(pleat + 0.9, top + 12), text: 'PLEAT: TACK 8 CM AT THE NECK', size: 0.45, rotate: 90 },
    ],
    allowances: { ...pc.allowances, fold: 0, hem: 1.5 },
  });
}

/** Buttons down the front: from the break point (or just below the neck) to above the hem, about 10 cm apart. */
function buttonsFor(s: OuterStyle, ext: number, first: number, last: number): OuterDraft['buttons'] {
  const size = OUTER_BUTTON[s.kind];
  const gap = s.kind === 'coat' ? 11 : 10;
  const count = Math.max(s.front === 'double' ? 2 : 1, Math.round((last - first) / gap)) + 1;
  const at = Array.from({ length: count }, (_, i) => r1(first + (count > 1 ? ((last - first) * i) / (count - 1) : 0)));
  const inset = size / 2 + 1.5;
  const columns = s.front === 'double' ? [-(ext - inset), ext - inset] : [0];
  return { at, sizeCm: size, columns };
}

/** Draft a jacket or a coat. */
export function draftOuter(m: OuterMeasurements, style: Partial<OuterStyle> & { kind: OuterKind }): OuterDraft {
  const s: OuterStyle = { ...DEFAULT_OUTER[style.kind], ...style };
  if (!(m.full_hip && m.waist_to_hip)) throw new DraftError(`Add your full hip and waist to hip measurements to make a ${s.kind}.`);
  if (s.kind === 'coat' && !m.waist_to_knee) throw new DraftError('Add your waist to knee measurement to make a coat.');
  if (!(m.arm_length && m.upper_arm)) throw new DraftError(`Add your arm length and upper arm measurements for the ${s.kind}'s sleeves.`);
  const length = OUTER_LENGTHS[s.kind].includes(s.length) ? s.length : DEFAULT_OUTER[s.kind].length;
  // A fitted jacket needs its waist darts; only a roomier one can go boxy.
  const shaping = s.shaping === 'boxy' && s.fit === 'fitted' ? 'darts' : s.shaping;
  const bodiceStyle: Partial<BodiceStyle> = {
    fit: s.fit,
    neckline: 'crew',
    neck: OUTER_NECK,
    length: length === 'cropped' ? 'high_hip' : 'hip',
    darts: shaping === 'boxy' ? 'bust' : 'bust_waist',
    princess: shaping === 'princess' ? 'armhole' : 'none',
    bustEase: OUTER_EASE[s.kind][s.fit],
    seamAllowance: s.seamAllowance,
    neckArmholeAllowance: 1,
    hemAllowance: s.hemAllowance,
    fitting: s.fitting,
    closure: 'back_zip',
    collar: 'none',
  };
  const base = draftBodice(m, bodiceStyle);
  const drop = Math.max(base.drop, outerDrop(m, length));
  const extra = drop - base.drop;
  const flare = (FLARE_PER_40[s.flare] * extra) / 40;
  const KIND = s.kind === 'coat' ? 'Coat' : 'Jacket';
  const rename = (pc: Piece): Piece => ({
    ...pc,
    name: pc.name.replace(/^Bodice/, KIND),
    labels: pc.labels.map((l) => ({ ...l, text: l.text.replace(/^BODICE/, KIND.toUpperCase()) })),
  });
  const prep = (pc: Piece) => rename(extendPiece(/back/i.test(pc.name) ? backOnFold(pc) : pc, extra, flare));
  const shell = base.pieces.map(prep);
  const [bf0, bb0] = blockOf(base);
  const block: [Piece, Piece] = [prep(bf0), prep(bb0)];

  const ext = OUTER_EXTENSION[s.kind][s.front];
  const foot = Math.max(...block[0].outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
  const neckY = block[0].outline.start.y;
  const apexY = base.front.apex.y;
  const waistY = base.front.waistCentre.y;
  const breakY = s.collar === 'notched' ? (s.front === 'double' ? apexY - 2 : apexY + 2) : neckY + (s.collar === 'stand' ? 2 : 1.8);
  const lastY = s.kind === 'coat' ? Math.min(foot - 15, waistY + (m.waist_to_hip ?? 20) + 12) : foot - (length === 'cropped' ? 3.5 : 9);
  const buttons = buttonsFor(s, ext, breakY, Math.max(breakY + 12, lastY));

  const fronts: Piece[] = [];
  const facings: Piece[] = [];
  const linings: Piece[] = [];
  let opening: FrontOpening | undefined;
  for (const pc of shell) {
    if (!/front/i.test(pc.name)) continue;
    if (pc.fold) {
      opening = openFront(pc, s, ext, buttons, breakY);
      fronts.push(opening.piece);
    } else fronts.push(pc);
  }
  if (!opening) throw new DraftError('The front could not be opened for buttons.');
  const backs = shell.filter((pc) => /back/i.test(pc.name));

  // The front facing, and the front lining: the opened front either side of the facing line.
  const fr = ringOf(opening.piece.outline, 12);
  const facingRing = clipRing(fr, opening.facing.g, true, 'lining', opening.facing.pts);
  const facingPiece = cutFrom(opening.piece, facingRing, 'Front facing', {
    kind: 'facing',
    fabric: 'Self + interfacing',
    cut: 'Cut 2 (1 pair)',
    allowances: { ...opening.piece.allowances, lining: s.seamAllowance },
  });
  facings.push(facingPiece);
  const backNeck = taggedLength(backs.find((pc) => pc.fold)?.outline ?? backs[0].outline, 'neck');
  const sa = s.seamAllowance;
  const collar =
    s.collar === 'notched'
      ? [notchedCollar(opening.piece, backNeck, opening.frontNeck, s)]
      : s.collar === 'stand'
        ? collarPieces('mandarin', block[0], block[1], { back: backNeck, front: opening.frontNeck, ext, closure: 'front_buttons', sa })
        : [];
  // A collarless back neck is finished with a facing; under a collar the lining runs up to the neck.
  for (const pc of fronts) {
    if (pc === opening.piece) {
      const lr = clipRing(fr, opening.facing.g, false, 'lining', opening.facing.pts);
      linings.push(cutFrom(pc, lr, 'Front lining', { kind: 'lining', fabric: 'Lining', cut: 'Cut 2 (1 pair)', allowances: { ...pc.allowances, lining: sa, hem: 1.5 } }));
    } else linings.push(cutFrom(pc, ringOf(pc.outline, 12), `${pc.name.replace(KIND, '').trim()} lining`.replace(/^./, (c) => c.toUpperCase()), { kind: 'lining', fabric: 'Lining', allowances: { ...pc.allowances, hem: 1.5 } }));
  }
  for (const pc of backs) {
    if (pc.fold) linings.push(backLining(pc, 1.5));
    else linings.push(cutFrom(pc, ringOf(pc.outline, 12), `${pc.name.replace(KIND, '').trim()} lining`.replace(/^./, (c) => c.toUpperCase()), { kind: 'lining', fabric: 'Lining', allowances: { ...pc.allowances, hem: 1.5 } }));
  }

  const sleeve = draftSleeve(base, m, {
    length: 'long',
    shape: s.sleeve,
    fit: s.fit,
    outer: s.kind,
    seamAllowance: sa,
    armholeAllowance: 1,
    hemAllowance: 4,
  });
  const sleevePieces = sleeve.pieces.map((pc) => ({ ...pc, labels: pc.labels }));
  const sleeveLining = sleeve.pieces.map((pc) => ({
    ...pc,
    name: 'Sleeve lining',
    kind: 'lining' as const,
    fabric: 'Lining',
    labels: pc.labels.map((l) => (l.text === 'SLEEVE' ? { ...l, text: 'SLEEVE LINING' } : l)),
    allowances: { ...pc.allowances, hem: 1.5 },
    meta: { ...pc.meta },
  }));

  // Patch pockets just below the waist, centred on the front.
  let pocketPieces: Piece[] = [];
  let pocket: OuterDraft['pocket'];
  if (s.pockets === 'patch') {
    const w = s.kind === 'coat' ? 18 : 15;
    const h = s.kind === 'coat' ? 19 : length === 'cropped' ? 12 : 16;
    const y = Math.min(waistY + (m.waist_to_hip ?? 20) * 0.35, foot - h - 4);
    // On the widest front piece at that level (the side front, with princess seams), clear of the
    // buttons and the seams.
    const carrier = fronts.reduce((best, pc) => {
      const [lo, hi] = spanAt(pc, y + h / 2);
      const [blo, bhi] = spanAt(best, y + h / 2);
      return hi - Math.max(lo, ext + 2) > bhi - Math.max(blo, ext + 2) ? pc : best;
    });
    const [lo, hi] = spanAt(carrier, y + h / 2);
    const from = Math.max(lo + 1.5, ext + 2);
    const x = Math.max(from, Math.min(hi - w - 2, (from + hi) / 2 - w / 2));
    pocket = { x, y, w, h };
    pocketPieces = [patchPocket(w, h, sa)];
    if (carrier) {
      const i = fronts.indexOf(carrier);
      fronts[i] = {
        ...carrier,
        lines: [...carrier.lines, new Path(p(x, y)).line(p(x, y + h)).line(p(x + w, y + h)).line(p(x + w, y))],
        labels: [...carrier.labels, { at: p(x + w / 2, y + 1.2), text: 'POCKET', size: 0.5 }],
      };
    }
  }

  const backPiece = backs.find((pc) => pc.fold) ?? backs[0];
  const pieces = [...fronts, ...backs, ...sleevePieces, ...collar, ...facings, ...pocketPieces, ...linings, ...sleeveLining];
  const finishedHem = r1(
    2 * shell.reduce((t, pc) => t + taggedLength(pc.outline, 'hem'), 0) + 0,
  );
  const cbTop = backPiece.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).reduce((mn, q) => Math.min(mn, q.y), Infinity);
  const cbFoot = backPiece.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).reduce((mx, q) => Math.max(mx, q.y), -Infinity);
  return {
    kind: s.kind,
    base,
    sleeve,
    pieces,
    block,
    ext,
    buttons,
    lapel: opening.lapel,
    pocket,
    finishedBust: base.finishedBust,
    finishedWaist: base.finishedWaist,
    finishedHem,
    drop: r1(drop),
    lengthCm: r1(cbFoot - cbTop),
    warnings: [...base.warnings, ...sleeve.warnings],
  };
}
