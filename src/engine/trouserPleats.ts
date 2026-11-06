// Front pleats and belt loops on trousers (SS27 Bermuda, Cat 2026-11-05: "lux but loose", pleated like the runway
// Bermudas). A pleat is cut as a pattern cutter cuts one: the front is slashed down its crease line from the waist
// to the hem and spread, keeping the two halves parallel, so the extra cloth runs the leg's whole length and the
// pleat releases into fullness below the waist. The front dart's take-up goes into the first pleat, which folds on
// the crease line and is pressed toward the centre front; a second pleat sits a hand's width toward the side.
import { P, Path, p } from './geometry';
import type { Label, Piece } from './piece';
import { WAISTBAND_CM, cm } from './skirt';

export type TrouserPleats = 'none' | 'single' | 'double';
export type TrouserLoops = 'none' | 'loops';

/** How far each pleat opens the front at the waist, in cm (its fold to its placement line, less the dart it absorbs). */
export const PLEAT_OPEN: Record<Exclude<TrouserPleats, 'none'>, number[]> = { single: [4], double: [3, 3] };
/** The plain cloth between the first pleat's fold and the second's placement line, less on a narrow front, so the
 *  second pleat stays clear of a slant pocket's facing at the waist (SLANT.in + SLANT.along from the side, plus 1 cm). */
const PLEAT_GAP = { most: 3.5, least: 1 };
const POCKET_CLEAR = 10;
/** Each pleat is stitched down from the waist this far, then pressed. */
export const PLEAT_STITCH_CM = 4;

/** One pleat as cut: its fold line and its placement line across the waist, in the front piece's own coordinates. */
export interface PleatLine {
  fold: number;
  place: number;
}

export interface PleatedFront {
  /** The front as printed: spread, with the pleat fold and placement lines, the dart gone into the first pleat. */
  piece: Piece;
  pleats: { count: number; openCm: number[]; lines: PleatLine[]; dartCm: number };
}

/** Where the slash for pleat k lies on the unspread front, and how far it opens. */
function slashes(crease: number, dart: number, open: number[]): { at: number; open: number }[] {
  const out = [{ at: crease, open: open[0] }];
  const gap = Math.min(PLEAT_GAP.most, Math.max(PLEAT_GAP.least, crease - dart / 2 - POCKET_CLEAR - open[1]));
  if (open.length > 1) out.push({ at: crease - dart / 2 - gap, open: open[1] });
  return out;
}

/**
 * The front spread for its pleats. Points toward the centre of each slash move over by its opening, so the side seam
 * stays put and the crotch, the inside leg and the hem move with the centre: every seam keeps its length and the
 * hem gains the pleats' cloth. The waist across each pleat is tagged `pleat` rather than `waist`, so the waist seam
 * still measures what it sews to once the pleats are folded.
 */
export function pleatedFront(front: Piece, kind: Exclude<TrouserPleats, 'none'>, hipY: number): PleatedFront {
  const crease = front.meta.creaseX as number;
  const dartCm = ((front.meta.dartsCm as number[] | undefined) ?? [])[0] ?? 0;
  const open = PLEAT_OPEN[kind];
  const cuts = slashes(crease, dartCm, open);
  const shift = (x: number) => cuts.reduce((t, c) => t + (x > c.at + 1e-6 ? c.open : 0), 0);
  const mv = (q: P): P => p(q.x + shift(q.x), q.y);
  // The pleats on the spread front: the first folds on the dart's outer leg and takes the dart in with it, its
  // placement line on the dart's inner leg moved over; the second lies to its side.
  // (A front with no dart to take in folds on the crease itself: the fold lies on the slash's side half and the
  // placement line on its centre half, so the pleat is still as wide as the slash opens.)
  const legs = front.lines.map((ln) => ln.points()).find((pts) => pts.length === 3);
  const legX = legs ? [Math.min(legs[0].x, legs[2].x), Math.max(legs[0].x, legs[2].x)] : [crease, crease];
  const lines: PleatLine[] = [{ fold: legX[0] + shift(legX[0] - 1e-3), place: legX[1] + shift(legX[1] + 1e-3) }];
  if (cuts.length > 1) lines.push({ fold: cuts[1].at, place: cuts[1].at + cuts[1].open });

  // The waist as a run of points, the dart's peak left out (its cloth is the first pleat's underlay now), then moved.
  const o = front.outline;
  const wpts: P[] = [o.start];
  let i = 0;
  while (i < o.segs.length && (o.tags[i] === 'waist' || o.tags[i] === 'dart')) {
    if (o.tags[i] === 'dart' && o.tags[i + 1] === 'dart') {
      wpts.push(o.segs[i + 1].to);
      i += 2;
      continue;
    }
    wpts.push(o.segs[i].to);
    i++;
  }
  const moved = wpts.map(mv);
  // A point on each fold and placement line, so the waist's tags change exactly there.
  const run: P[] = [...moved];
  for (const x of lines.flatMap((l) => [l.fold, l.place])) {
    const k = run.findIndex((q, j) => j > 0 && Math.min(run[j - 1].x, q.x) < x && x < Math.max(run[j - 1].x, q.x));
    if (k < 0) continue;
    const a = run[k - 1];
    const b = run[k];
    const t = (x - a.x) / (b.x - a.x);
    run.splice(k, 0, p(x, a.y + (b.y - a.y) * t));
  }
  const inPleat = (x: number) => lines.some((l) => x > l.fold + 1e-6 && x < l.place - 1e-6);
  const out = new Path(run[0]);
  for (let j = 1; j < run.length; j++) out.line(run[j], inPleat((run[j - 1].x + run[j].x) / 2) ? 'pleat' : 'waist');
  for (; i < o.segs.length; i++) {
    const s = o.segs[i];
    if (s.kind === 'L') out.line(mv(s.to), o.tags[i]);
    else out.curve(mv(s.c1), mv(s.c2), mv(s.to), o.tags[i]);
  }
  out.closed = true;

  const waistAt = (x: number) => {
    const k = run.findIndex((q) => Math.abs(q.x - x) < 1e-6);
    return k >= 0 ? run[k].y : 0;
  };
  // Each fold line runs down to the hem where it crosses it (a short's hem rises toward the inside leg).
  const tp = out.taggedPoints();
  const hemAt = (x: number) => {
    for (let k = 0; k < tp.tags.length; k++) {
      const [a, b] = [tp.pts[k], tp.pts[k + 1]];
      if (tp.tags[k] === 'hem' && Math.min(a.x, b.x) <= x && x <= Math.max(a.x, b.x)) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
    }
    return Math.max(...o.segs.map((s) => s.to.y));
  };
  const foldLines = lines.map((l) => new Path(p(l.fold, waistAt(l.fold))).line(p(l.fold, hemAt(l.fold))));
  const notches: [P, P][] = [...front.notches.map(([q, d]): [P, P] => [mv(q), d]), ...lines.flatMap((l): [P, P][] => [[p(l.fold, waistAt(l.fold)), p(0, -1)], [p(l.place, waistAt(l.place)), p(0, -1)]])];
  const labels: Label[] = [
    ...front.labels.map((l) => ({ ...l, at: mv(l.at) })),
    ...lines.map((l, k) => ({ at: p((l.fold + l.place) / 2, waistAt(l.fold) + 2.4), text: k === 0 ? 'PLEAT' : 'PLEAT 2', size: 0.6, rotate: 90 })),
  ];
  const points = [
    ...(front.draft?.points ?? []).filter((q) => !/^D\d/.test(q.n)).map((q) => ({ ...q, at: mv(q.at) })),
    ...lines.map((l, k) => ({
      n: `P${k + 1}`,
      at: p(l.fold, hipY),
      note:
        k === 0
          ? `Pleat 1: slash the front down the crease line from the waist to the hem and open it ${cm(open[0])} at the waist and the hem, keeping the halves parallel. Fold on the crease line and bring the fold ${cm(l.place - l.fold)} toward the centre front to the placement line${dartCm ? `: the dart's ${cm(dartCm)} is folded in with it` : ''}. Stitch down ${cm(PLEAT_STITCH_CM)} from the waist and press toward the centre front.`
          : `Pleat 2: slash ${cm(crease - cuts[1].at)} to the side of the crease, open ${cm(open[1])} the same way, and fold it toward the centre front to its placement line.`,
    })),
  ];
  const piece: Piece = {
    ...front,
    outline: out,
    lines: foldLines,
    grain: front.grain ? [mv(front.grain[0]), mv(front.grain[1])] : front.grain,
    notches,
    balance: [...(front.balance ?? []).map((b) => ({ ...b, pts: b.pts.map(mv) })), ...lines.map((l) => ({ pts: [p(l.place, waistAt(l.place)), p(l.place, hipY + 6)], label: 'PLACEMENT' }))],
    labels,
    draft: front.draft ? { frame: front.draft.frame.map((f) => f.map(mv)), points } : front.draft,
    meta: { ...front.meta, dartsCm: [], creaseX: crease + shift(crease - 1e-3), fork: mv(front.meta.fork as P), pleats: lines },
  };
  return { piece, pleats: { count: lines.length, openCm: open, lines, dartCm } };
}

/** Where each pleat's pressed edge lies on the sewn-up front, as a share of the front's width from the side seam:
 *  at the waist (0 the side, 1 the centre front), the pleats folded closed, and at the hem (1 the inside leg),
 *  where they hang open. The All round drawing draws each fold from these (see allRound.ts). */
export function pleatShares(front: Piece, lines: PleatLine[]): { waist: number; hem: number }[] {
  const o = front.outline;
  const xs = (tags: string[]) => {
    const out: number[] = [];
    o.segs.forEach((sg, i) => {
      if (!tags.includes(o.tags[i])) return;
      out.push((i ? o.segs[i - 1].to : o.start).x, sg.to.x);
    });
    return out;
  };
  const w = xs(['waist', 'pleat']);
  const h = xs(['hem']);
  const [wSide, wCF] = [Math.min(...w), Math.max(...w)];
  const [hSide, hIn] = [Math.min(...h), Math.max(...h)];
  const waistW = wCF - wSide - lines.reduce((t, l) => t + l.place - l.fold, 0);
  return lines.map((l) => ({
    waist: (l.fold - wSide - lines.filter((m) => m.fold < l.fold).reduce((t, m) => t + m.place - m.fold, 0)) / (waistW || 1),
    hem: (l.fold - hSide) / (hIn - hSide || 1),
  }));
}

/** Where the loops sit round the waist, as a share of the quarter waist from the centre front or the centre back:
 *  halfway across each front, at each side seam (named from both halves, so each flat view draws it) and at the
 *  centre back. */
export const LOOP_PLACES: { front: number[]; back: number[] } = { front: [0.5, 1], back: [0, 1] };
/** Every loop's angle round the body (0 the centre front, pi the centre back), each named once. */
export function loopAngles(): number[] {
  const out: number[] = [];
  const add = (a: number) => {
    if (!out.some((b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 1e-6)) out.push(a);
  };
  for (const f of LOOP_PLACES.front) for (const s of [1, -1]) add((s * f * Math.PI) / 2);
  for (const b of LOOP_PLACES.back) for (const s of [1, -1]) add(s * (Math.PI - (b * Math.PI) / 2));
  return out;
}
/** How many belt loops: the centre back, each side seam, and halfway across each front. */
export const BELT_LOOPS = loopAngles().length;
/** A loop's finished width and the strip it is cut from, folded in three and topstitched. */
const LOOP_WIDTH = 1.2;
const LOOP_CUT_WIDTH = 3.6;

/** One strip for every belt loop: each is the waistband's depth plus room to turn under and sew at both ends. */
export function beltLoopsPiece(sa: number): Piece {
  const each = WAISTBAND_CM + 2.5;
  const L = BELT_LOOPS * each + 2;
  const W = LOOP_CUT_WIDTH;
  const outline = new Path(p(0, 0)).line(p(W, 0), 'end').line(p(W, L), 'edge').line(p(0, L), 'end').line(p(0, 0), 'edge');
  outline.closed = true;
  return {
    name: 'Belt loops',
    kind: 'facing',
    outline,
    lines: [new Path(p(W / 3, 0)).line(p(W / 3, L)), new Path(p((2 * W) / 3, 0)).line(p((2 * W) / 3, L))],
    grain: [p(W / 2, 3), p(W / 2, L - 3)],
    notches: Array.from({ length: BELT_LOOPS - 1 }, (_, k): [P, P] => [p(W, (k + 1) * each + 1), p(1, 0)]),
    labels: [
      { at: p(W * 0.5, L * 0.35), text: 'BELT LOOPS', size: 0.7, rotate: 90 },
      { at: p(W * 0.5, L * 0.7), text: `Cut 1, makes ${BELT_LOOPS}`, size: 0.55, rotate: 90 },
    ],
    cut: 'Cut 1',
    seamAllowance: sa,
    allowances: { end: 0, edge: 0 },
    meta: { loops: BELT_LOOPS, loopWidth: LOOP_WIDTH, eachCm: each },
  };
}

/** A loop as drawn on the flat waistband: a strip the band's depth, standing a little past it top and bottom. */
export function loopShape(x: number, top: number): P[] {
  const w = LOOP_WIDTH / 2;
  return [p(x - w, top - WAISTBAND_CM - 0.4), p(x + w, top - WAISTBAND_CM - 0.4), p(x + w, 0.4), p(x - w, 0.4)];
}
