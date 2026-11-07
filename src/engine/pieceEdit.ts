// Cutting the flat pattern with a drawn line, the way a pattern cutter slashes and spreads on paper (Cat's pick P2
// Draw a line, 2026-11-07). One line drawn across a piece does one of three things:
//   spread    the piece is cut along the line and opened like a fan from the end the line was started at (flare),
//   fullness  it is cut and opened evenly, so both ends gain the same width (gathers or pleats where it opens on a seam),
//   piece     it is cut in two along the line as drawn, and the smaller part becomes a new piece (a yoke, a panel).
// Edits are saved with the moves of Move points (engine/pointEdit.ts), in the order they were made, so a point moved
// after a cut is moved on the cut piece. Anything a cut opens is trued: the gap on the edge it opens is a curve that
// leaves each side in its own direction, so a hem stays smooth. A piece that has been cut says so on the print
// ("EDITED BY YOU · IN TESTING"), and a new piece is marked so All round shows the garment's drawing for now.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import type { Label, Piece } from './piece';
import { PointEdit, applyPointEdits } from './pointEdit';

export type CutKind = 'spread' | 'fullness' | 'piece';

/** One cut, as saved: the line drawn, in cm on its own piece, and what it does. */
export interface CutEdit {
  cut: CutKind;
  piece: string;
  /** The line as drawn, from where the finger went down. A spread turns about the end it was started at. */
  line: P[];
  /** How far it opens, in cm: at the far end for a spread, all along for fullness. Unused for a new piece. */
  by: number;
  /** What the extra width on a seam becomes (fullness and spread): gathered in, or folded as a pleat. */
  finish?: 'gathers' | 'pleats';
  /** A new piece's name, when the maker gave it one. */
  name?: string;
}

export type PatternEdit = PointEdit | CutEdit;

export const isCut = (e: unknown): e is CutEdit => !!e && typeof e === 'object' && 'cut' in e;

/** How far a new spread or fullness opens before the maker drags it, in cm. */
export const START_BY: Record<Exclude<CutKind, 'piece'>, number> = { spread: 6, fullness: 8 };

/** The words added to a piece that has been cut, for the printed pattern. */
export const EDITED = 'EDITED BY YOU · IN TESTING';

/** Edges that are left free (nothing is sewn to them), so extra width there needs no gathers. */
const FREE = ['hem'];

interface Seg {
  kind: 'L' | 'C';
  a: P;
  c1?: P;
  c2?: P;
  b: P;
  tag: string;
}

const cross = (u: P, v: P) => u.x * v.y - u.y * v.x;
const dot = (u: P, v: P) => u.x * v.x + u.y * v.y;
const perp = (u: P) => p(-u.y, u.x);
const rotAbout = (q: P, o: P, a: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = q.x - o.x;
  const y = q.y - o.y;
  return p(o.x + x * c - y * s, o.y + x * s + y * c);
};

function segsOf(path: Path): Seg[] {
  const out: Seg[] = [];
  let at = path.start;
  path.segs.forEach((s, i) => {
    out.push(s.kind === 'C' ? { kind: 'C', a: at, c1: s.c1, c2: s.c2, b: s.to, tag: path.tags[i] } : { kind: 'L', a: at, b: s.to, tag: path.tags[i] });
    at = s.to;
  });
  // An outline that stops short of its start is closed by a straight edge, read as part of its last edge.
  if (out.length && len(sub(at, path.start)) > 1e-6) out.push({ kind: 'L', a: at, b: path.start, tag: path.tags[path.tags.length - 1] ?? '' });
  return out;
}

function pathOf(segs: Seg[]): Path {
  const path = new Path(segs[0].a);
  for (const s of segs) {
    if (s.kind === 'C') path.curve(s.c1!, s.c2!, s.b, s.tag);
    else path.line(s.b, s.tag);
  }
  path.closed = true;
  return path;
}

const bez = (s: Seg, t: number): P => {
  if (s.kind === 'L') return lerp(s.a, s.b, t);
  const m = 1 - t;
  return p(
    m ** 3 * s.a.x + 3 * m * m * t * s.c1!.x + 3 * m * t * t * s.c2!.x + t ** 3 * s.b.x,
    m ** 3 * s.a.y + 3 * m * m * t * s.c1!.y + 3 * m * t * t * s.c2!.y + t ** 3 * s.b.y,
  );
};

function splitSeg(s: Seg, t: number): [Seg, Seg] {
  const mid = bez(s, t);
  if (s.kind === 'L') return [{ ...s, b: mid }, { ...s, a: mid }];
  const p01 = lerp(s.a, s.c1!, t);
  const p12 = lerp(s.c1!, s.c2!, t);
  const p23 = lerp(s.c2!, s.b, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  return [
    { kind: 'C', a: s.a, c1: p01, c2: p012, b: mid, tag: s.tag },
    { kind: 'C', a: mid, c1: p123, c2: p23, b: s.b, tag: s.tag },
  ];
}

const flat = (s: Seg, n = 24): P[] => (s.kind === 'L' ? [s.a, s.b] : Array.from({ length: n + 1 }, (_, k) => bez(s, k / n)));
const polyOf = (segs: Seg[]): P[] => segs.flatMap((s, i) => flat(s, 16).slice(i ? 1 : 0));
const reverse = (s: Seg): Seg => (s.kind === 'C' ? { kind: 'C', a: s.b, c1: s.c2, c2: s.c1, b: s.a, tag: s.tag } : { kind: 'L', a: s.b, b: s.a, tag: s.tag });
const mapSeg = (s: Seg, f: (q: P) => P): Seg => (s.kind === 'C' ? { ...s, a: f(s.a), c1: f(s.c1!), c2: f(s.c2!), b: f(s.b) } : { ...s, a: f(s.a), b: f(s.b) });
const endDir = (s: Seg) => unit(s.kind === 'C' ? (len(sub(s.b, s.c2!)) > 1e-6 ? sub(s.b, s.c2!) : sub(s.b, s.c1!)) : sub(s.b, s.a));
const startDir = (s: Seg) => unit(s.kind === 'C' ? (len(sub(s.c1!, s.a)) > 1e-6 ? sub(s.c1!, s.a) : sub(s.c2!, s.a)) : sub(s.b, s.a));

function area(poly: P[]): number {
  let t = 0;
  for (let i = 0; i < poly.length; i++) t += cross(poly[i], poly[(i + 1) % poly.length]);
  return t / 2;
}

function centroid(poly: P[]): P {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const q = poly[i];
    const r = poly[(i + 1) % poly.length];
    const c = cross(q, r);
    a += c;
    x += (q.x + r.x) * c;
    y += (q.y + r.y) * c;
  }
  if (Math.abs(a) < 1e-9) return poly[0];
  return p(x / (3 * a), y / (3 * a));
}

function inside(q: P, poly: P[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Where the line a -> b crosses the outline: each crossing's edge, place along it, point, and place along the line. */
interface Crossing {
  seg: number;
  t: number;
  at: P;
  u: number;
}

function crossings(segs: Seg[], a: P, b: P, uMin: number, uMax: number): Crossing[] {
  const d = sub(b, a);
  const side = (q: P) => cross(d, sub(q, a));
  const out: Crossing[] = [];
  segs.forEach((s, i) => {
    const n = s.kind === 'L' ? 1 : 48;
    const pts = s.kind === 'L' ? [s.a, s.b] : Array.from({ length: n + 1 }, (_, k) => bez(s, k / n));
    for (let k = 0; k < n; k++) {
      const f0 = side(pts[k]);
      const f1 = side(pts[k + 1]);
      if (f0 === 0 && k > 0) continue;
      if ((f0 > 0 && f1 > 0) || (f0 < 0 && f1 < 0) || f0 === f1) continue;
      // Narrow the place along a curved edge down by halving; a straight edge is exact.
      let lo = k / n;
      let hi = (k + 1) / n;
      let flo = f0;
      for (let it = 0; it < (s.kind === 'L' ? 0 : 30); it++) {
        const mid = (lo + hi) / 2;
        const fm = side(bez(s, mid));
        if ((fm <= 0 && flo <= 0) || (fm >= 0 && flo >= 0)) {
          lo = mid;
          flo = fm;
        } else hi = mid;
      }
      const t = s.kind === 'L' ? f0 / (f0 - f1) : (lo + hi) / 2;
      if (t >= 1 - 1e-9) continue; // counted as the next edge's start (the outline is closed)
      const at = bez(s, t);
      const u = dot(sub(at, a), d) / (dot(d, d) || 1);
      if (u >= uMin && u <= uMax) out.push({ seg: i, t, at, u });
    }
  });
  return out;
}

/** The outline cut through at two crossings: the run from x to y, the run from y back to x. */
function splitAt(segs: Seg[], x: Crossing, y: Crossing): [Seg[], Seg[]] {
  const list = segs.map((s) => ({ ...s }));
  // Split the later crossing first, so the earlier one's place is unchanged.
  const [first, second] = x.seg < y.seg || (x.seg === y.seg && x.t < y.t) ? [x, y] : [y, x];
  let s2 = second.seg;
  let t2 = second.t;
  const ix = first.seg + 1;
  if (first.seg === second.seg) {
    const [l, r] = splitSeg(list[first.seg], first.t);
    list.splice(first.seg, 1, l, r);
    s2 = first.seg + 1;
    t2 = (second.t - first.t) / (1 - first.t || 1);
  } else {
    const [l, r] = splitSeg(list[first.seg], first.t);
    list.splice(first.seg, 1, l, r);
    s2 += 1;
  }
  const [l2, r2] = splitSeg(list[s2], t2);
  list.splice(s2, 1, l2, r2);
  const iy = s2 + 1;
  const n = list.length;
  const run = (from: number, to: number) => {
    const out: Seg[] = [];
    for (let k = from; k !== to; k = (k + 1) % n) out.push(list[k]);
    return out;
  };
  const [fromFirst, fromSecond] = [run(ix, iy), run(iy, ix)];
  // fromFirst runs first -> second; give them back as x -> y and y -> x.
  return first === x ? [fromFirst, fromSecond] : [fromSecond, fromFirst];
}

/** A smooth line through points: a curve for each step, as a cutter draws a yoke line with a French curve. */
function smoothSegs(pts: P[], tag: string): Seg[] {
  if (pts.length < 3) return [{ kind: 'L', a: pts[0], b: pts[pts.length - 1], tag }];
  const out: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    out.push({ kind: 'C', a: p1, c1: add(p1, mul(sub(p2, p0), 1 / 6)), c2: sub(p2, mul(sub(p3, p1), 1 / 6)), b: p2, tag });
  }
  return out;
}

/** A drawn line with the wobble taken out: points closer than `tol` to the straight run between their neighbours go. */
function simplify(pts: P[], tol = 0.5): P[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const d = sub(b, a);
  const L = len(d) || 1;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const off = Math.abs(cross(d, sub(pts[i], a))) / L;
    if (off > worst) {
      worst = off;
      at = i;
    }
  }
  if (worst < tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** Where a cut line meets a piece: the run of outline on each side and the cut between them, or undefined when the
 *  line doesn't cross the piece from edge to edge. A straight cut follows the line from its first to last point,
 *  carried on to the edges; a new piece's cut follows the line as drawn. */
interface Cut {
  /** Outline from x to y, and from y back to x. */
  runs: [Seg[], Seg[]];
  x: Crossing;
  y: Crossing;
  /** The cut from x to y. */
  cut: Seg[];
  /** Where the finger went down: x or y, whichever is nearer it. */
  startAtX: boolean;
}

function cutOf(segs: Seg[], line: P[], straight: boolean): Cut | undefined {
  if (line.length < 2) return undefined;
  const pts = straight ? [line[0], line[line.length - 1]] : simplify(line);
  if (len(sub(pts[pts.length - 1], pts[0])) < 0.5) return undefined;
  const poly = polyOf(segs);
  // Crossings along the line, as a place along the whole line (step index + fraction), its ends carried on.
  const all: (Crossing & { g: number })[] = [];
  for (let j = 0; j < pts.length - 1; j++) {
    const uMin = j === 0 ? -Infinity : 0;
    const uMax = j === pts.length - 2 ? Infinity : 1;
    for (const c of crossings(segs, pts[j], pts[j + 1], uMin, uMax)) all.push({ ...c, g: j + c.u });
  }
  all.sort((m, n) => m.g - n.g);
  const span = pts.length - 1;
  let best: [number, number] | undefined;
  let bestScore = -Infinity;
  for (let k = 0; k + 1 < all.length; k++) {
    const g0 = all[k].g;
    const g1 = all[k + 1].g;
    if (g1 - g0 < 1e-6) continue;
    const gm = (g0 + g1) / 2;
    const j = Math.min(span - 1, Math.max(0, Math.floor(gm)));
    const mid = lerp(pts[j], pts[j + 1], gm - j);
    if (!inside(mid, poly)) continue;
    const score = Math.min(g1, span) - Math.max(g0, 0);
    if (score > bestScore) {
      bestScore = score;
      best = [k, k + 1];
    }
  }
  if (!best) return undefined;
  const x = all[best[0]];
  const y = all[best[1]];
  // Points of the drawn line between where it meets the edges, less any right by an edge (they'd leave a tiny step).
  const between = pts.filter((q, j) => j > x.g && j < y.g && len(sub(q, x.at)) > 1.5 && len(sub(q, y.at)) > 1.5);
  const path = [x.at, ...between, y.at];
  const cut = straight || path.length < 3 ? [{ kind: 'L' as const, a: x.at, b: y.at, tag: 'join' }] : smoothSegs(path, 'join');
  const runs = splitAt(segs, x, y);
  return { runs, x, y, cut, startAtX: len(sub(x.at, line[0])) <= len(sub(y.at, line[0])) };
}

/** The polygon a run of outline closes with the cut. */
const closeWith = (run: Seg[], cutBack: Seg[]) => polyOf([...run, ...cutBack]);

/** A point's place on a set of points taken as a closed line: the nearest distance to it. */
function distTo(q: P, poly: P[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const d = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(q, a), d) / (dot(d, d) || 1)));
    best = Math.min(best, len(sub(q, add(a, mul(d, t)))));
  }
  return best;
}

/** Which part a mark belongs with: inside it, or nearest its outline. */
const belongsTo = (q: P, a: P[], b: P[]) => (inside(q, a) ? 0 : inside(q, b) ? 1 : distTo(q, a) <= distTo(q, b) ? 0 : 1);

/** An internal line kept to the part of it inside a polygon (a dart cut through by a yoke keeps its upper legs). */
function clipLine(line: Path, poly: P[]): Path[] {
  const pts = line.points(8);
  const out: P[][] = [];
  let cur: P[] = [];
  const edge = (a: P, b: P) => {
    // Halve the step between an inside point and an outside one until the boundary is found.
    let lo = a;
    let hi = b;
    const inA = inside(a, poly);
    for (let k = 0; k < 24; k++) {
      const m = lerp(lo, hi, 0.5);
      if (inside(m, poly) === inA) lo = m;
      else hi = m;
    }
    return lerp(lo, hi, 0.5);
  };
  pts.forEach((q, i) => {
    const isIn = inside(q, poly);
    if (i > 0 && isIn !== inside(pts[i - 1], poly)) {
      const e = edge(pts[i - 1], q);
      if (isIn) cur = [e];
      else {
        cur.push(e);
        out.push(cur);
        cur = [];
      }
    }
    if (isIn) cur.push(q);
  });
  if (cur.length) out.push(cur);
  return out
    .filter((run) => run.length > 1 && run.slice(1).reduce((t, q, i) => t + len(sub(q, run[i])), 0) > 0.3)
    .map((run) => {
      // A dart drawn as two legs keeps its three points, so its point can still be moved.
      const keep = run.length === pts.length && pts.length === 3 ? run : simplify(run, 0.05);
      const path = new Path(keep[0]);
      keep.slice(1).forEach((q) => path.line(q));
      return path;
    });
}

function mapPath(path: Path, f: (q: P) => P): Path {
  const out = new Path(f(path.start));
  path.segs.forEach((s, i) => {
    if (s.kind === 'C') out.curve(f(s.c1), f(s.c2), f(s.to), path.tags[i]);
    else out.line(f(s.to), path.tags[i]);
  });
  out.closed = path.closed;
  return out;
}

/** The outward direction off the outline at a point on it, for a notch: away from the polygon's inside. */
function outwardAt(q: P, dir: P, poly: P[]): P {
  const n = unit(perp(dir));
  return inside(add(q, mul(n, 0.2)), poly) ? mul(n, -1) : n;
}

/** The fold of a piece cut from one: the two ends of its fold edge, if it kept one. */
function foldOf(segs: Seg[]): [P, P] | undefined {
  const i = segs.findIndex((s, k) => s.tag === 'fold' && segs[(k - 1 + segs.length) % segs.length].tag !== 'fold');
  if (i < 0) return undefined;
  let j = i;
  while (segs[(j + 1) % segs.length].tag === 'fold' && (j + 1) % segs.length !== i) j = (j + 1) % segs.length;
  const a = segs[i].a;
  const b = segs[j].b;
  return a.y <= b.y ? [a, b] : [b, a];
}

/** What an edited piece no longer carries: marks worked out for the pattern as drafted, which a cut makes wrong. */
function stripDrafted(pc: Piece): Piece {
  const out = { ...pc };
  delete out.balance;
  delete out.finished;
  delete out.draft;
  delete out.alternate;
  delete out.cutOutline;
  return out;
}

/** The "edited by you" words under a piece's cut line, once. */
function markEdited(labels: Label[]): Label[] {
  if (labels.some((l) => l.text === EDITED)) return labels;
  const under = labels.find((l) => l.size <= 1.05 && l.size >= 0.9) ?? labels[0];
  if (!under) return labels;
  return [...labels, { at: add(under.at, p(0, under.size * 1.6)), text: EDITED, size: 0.7 }];
}

/** Spread or fullness: the part away from the fold (or the smaller part) turns or slides, and the gaps it leaves are
 *  closed with curves that carry on each side's direction. Extra width on a seam is marked to gather or pleat. */
function openingOf(e: CutEdit, c: Cut) {
  const back = (cut: Seg[]) => [...cut].reverse().map(reverse);
  const polyA = closeWith(c.runs[0], back(c.cut));
  const polyB = closeWith(c.runs[1], c.cut);
  const hasFold = (run: Seg[]) => run.some((s) => s.tag === 'fold');
  const fixedFirst = hasFold(c.runs[0]) !== hasFold(c.runs[1]) ? hasFold(c.runs[0]) : Math.abs(area(polyA)) >= Math.abs(area(polyB));
  const hinge = c.startAtX ? c.x.at : c.y.at;
  const far = c.startAtX ? c.y.at : c.x.at;
  const u = unit(sub(far, hinge));
  const movingPoly = fixedFirst ? polyB : polyA;
  const away = Math.sign(dot(sub(centroid(movingPoly), hinge), perp(u))) || 1;
  const by = Math.max(0, e.by);
  let move: (q: P) => P;
  if (e.cut === 'spread') {
    const r = len(sub(far, hinge));
    const turn = away * 2 * Math.asin(Math.min(1, by / (2 * (r || 1))));
    move = (q) => rotAbout(q, hinge, turn);
  } else {
    const v = mul(perp(u), away * by);
    move = (q) => add(q, v);
  }
  return {
    fixed: fixedFirst ? c.runs[0] : c.runs[1],
    moving: fixedFirst ? c.runs[1] : c.runs[0],
    fixedPoly: fixedFirst ? polyA : polyB,
    movingPoly,
    hinge,
    far,
    move,
    /** The way the far end goes as the cut opens more. */
    opens: mul(perp(u), away),
  };
}

function openOut(pc: Piece, e: CutEdit, c: Cut): Piece {
  const { fixed, moving, fixedPoly, movingPoly, hinge, far, move } = openingOf(e, c);
  const moved = moving.map((s) => mapSeg(s, move));
  const pleat = e.finish === 'pleats';
  const marks: { q0: P; q1: P; tag: string }[] = [];
  const gap = (prev: Seg, next: Seg): Seg | undefined => {
    const q0 = prev.b;
    const q1 = next.a;
    const L = len(sub(q1, q0));
    if (L < 1e-4) return undefined;
    const tag = prev.tag;
    if (!FREE.includes(tag)) marks.push({ q0, q1, tag });
    if (pleat && !FREE.includes(tag)) return { kind: 'L', a: q0, b: q1, tag };
    return { kind: 'C', a: q0, c1: add(q0, mul(endDir(prev), L / 3)), c2: sub(q1, mul(startDir(next), L / 3)), b: q1, tag };
  };
  const ring: Seg[] = [...fixed];
  const g1 = gap(fixed[fixed.length - 1], moved[0]);
  if (g1) ring.push(g1);
  ring.push(...moved);
  const g2 = gap(moved[moved.length - 1], fixed[0]);
  if (g2) ring.push(g2);
  const outline = pathOf(ring);
  const ringPoly = polyOf(ring);
  // Marks on the moving part go with it.
  const onMoving = (q: P) => belongsTo(q, fixedPoly, movingPoly) === 1;
  const lines = pc.lines.map((ln) => (ln.points(8).filter(onMoving).length * 2 > ln.points(8).length ? mapPath(ln, move) : ln));
  const notches = pc.notches.map(([at, dir]): [P, P] => (onMoving(at) ? [move(at), unit(sub(move(add(at, dir)), move(at)))] : [at, dir]));
  const labels = pc.labels.map((l) => (onMoving(l.at) ? { ...l, at: move(l.at) } : l));
  const extra: Path[] = [];
  const words: Label[] = [];
  for (const m of marks) {
    const mid = lerp(m.q0, m.q1, 0.5);
    const inward = mul(outwardAt(mid, sub(m.q1, m.q0), ringPoly), -1);
    if (pleat) {
      // A pleat: a line in from each end of the opening; the two lines are brought together and pressed.
      const deep = Math.min(6, len(sub(far, hinge)) * 0.25);
      for (const q of [m.q0, m.q1]) extra.push(new Path(q).line(add(q, mul(inward, deep))));
      words.push({ at: add(mid, mul(inward, deep + 1.2)), text: 'PLEAT: BRING THE LINES TOGETHER', size: 0.6 });
    } else {
      // Gathers: a notch each side of the opening, a little beyond it, and the word between them.
      const reach = 2;
      for (const [q, d] of [
        [m.q0, mul(unit(sub(m.q0, m.q1)), reach)],
        [m.q1, mul(unit(sub(m.q1, m.q0)), reach)],
      ] as const) {
        const at = add(q, d);
        notches.push([at, outwardAt(at, sub(m.q1, m.q0), ringPoly)]);
      }
      words.push({ at: add(mid, mul(inward, 1.4)), text: 'GATHER', size: 0.7 });
    }
  }
  const gathers = [...((pc.meta.gathers as unknown[]) ?? []), ...marks.map((m) => ({ tag: m.tag, cm: len(sub(m.q1, m.q0)), pleat }))];
  return {
    ...stripDrafted(pc),
    outline,
    lines: [...lines, ...extra],
    notches,
    // The grain stays as drafted: a cutter keeps it parallel to the fold (or the centre) and spreads the rest round it.
    grain: pc.grain,
    fold: foldOf(ring) ?? pc.fold,
    labels: markEdited([...labels, ...words]),
    meta: { ...pc.meta, edited: true, gathers, pointIds: undefined },
  };
}

/** A dart as drawn on the piece: the two ends of its legs at the edge it opens on, and its point. */
interface Dart {
  a: P;
  apex: P;
  b: P;
}

const dartsIn = (pc: Piece): Dart[] =>
  pc.lines.filter((ln) => ln.segs.length === 2 && ln.segs.every((sg) => sg.kind === 'L')).map((ln) => ({ a: ln.start, apex: ln.segs[0].to, b: ln.segs[1].to }));

/** The outline split where it crosses the ray from o along u (beyond a hair from o), so no edge runs across it. */
function splitAtRay(segs: Seg[], o: P, u: P): Seg[] {
  const out = segs.map((sg) => ({ ...sg }));
  const hits = crossings(out, o, add(o, u), 1e-3, Infinity).sort((m, n) => n.seg - m.seg || n.t - m.t);
  let last: { seg: number; t: number } | undefined;
  for (const h of hits) {
    let t = h.t;
    // A second crossing on an edge already split further along: its place on the part that is left.
    if (last && last.seg === h.seg) t = t / (last.t || 1);
    if (t < 1e-6 || t > 1 - 1e-6) continue;
    const [l, r] = splitSeg(out[h.seg], t);
    out.splice(h.seg, 1, l, r);
    last = { seg: h.seg, t: h.t };
  }
  return out;
}

const signedAngle = (u: P, v: P) => Math.atan2(cross(u, v), dot(u, v));

/** Distance from a point to the straight line a-b, as a segment. */
const toSeg = (q: P, a: P, b: P) => {
  const d = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(q, a), d) / (dot(d, d) || 1)));
  return len(sub(q, add(a, mul(d, t))));
};

/** A yoke's darts closed into it, as a pattern cutter folds them shut and trues the piece round them (round 3, Cat
 *  2026-11-07). Each dart whose wide end is on this part closes by turning the part on one side of it about its point,
 *  the side away from the fold (or the centre), so the fold and the grain stay as drafted:
 *    the cut crosses the dart above its point: it turns about the dart's own point (below the yoke), so the yoke's seam
 *      loses what the dart took there, and the rest of the dart stays on the lower piece, sewn as before;
 *    the cut runs below the dart's point: the dart is carried on down its centre line to the seam and turns about where
 *      it meets it, as a cutter lengthens a dart to the yoke line, so the seam keeps its length and the lower piece has
 *      no dart.
 *  A dart the cut runs down the length of (one leg crossed, not both) is left as it is. */
function closeDartsIn(ring: Seg[], darts: Dart[], lines: Path[], notches: [P, P][], labels: Label[]) {
  let segs = ring;
  let closed = 0;
  let todo = [...darts];
  /** Where a closed dart left a corner in an edge, to be trued once every dart is closed. */
  const corners: P[] = [];
  while (todo.length) {
    const d = todo.shift()!;
    const mouth = lerp(d.a, d.b, 0.5);
    const poly = polyOf(segs);
    let o = d.apex;
    if (inside(d.apex, poly) && distTo(d.apex, poly) > 0.05) {
      // The dart's point is on the yoke: carried on down its centre line to the seam.
      const hit = crossings(segs, mouth, d.apex, 1 + 1e-6, Infinity)
        .filter((c) => segs[c.seg].tag === 'join')
        .sort((m, n) => m.u - n.u)[0];
      // Only as far as a cutter would carry a dart on to a yoke line: a cut far below (a hem band) leaves it as it is.
      if (!hit || len(sub(hit.at, d.apex)) > Math.max(15, 1.5 * len(sub(d.apex, mouth)))) continue;
      o = hit.at;
      if (hit.t > 1e-6 && hit.t < 1 - 1e-6) {
        const [l, r] = splitSeg(segs[hit.seg], hit.t);
        segs = [...segs.slice(0, hit.seg), l, r, ...segs.slice(hit.seg + 1)];
      }
    } else {
      // The cut crosses the dart: both legs must meet the new seam.
      const meets = (end: P) => crossings(segs, d.apex, end, 1e-3, 1 - 1e-3).some((c) => segs[c.seg].tag === 'join');
      if (!meets(d.a) || !meets(d.b)) continue;
    }
    const uA = unit(sub(d.a, o));
    const uB = unit(sub(d.b, o));
    const theta = signedAngle(uA, uB);
    if (Math.abs(theta) < 1e-4 || Math.abs(theta) > Math.PI / 2) continue;
    segs = splitAtRay(splitAtRay(segs, o, uA), o, uB);
    // Which side of the dart a point is on: 'a', 'b', or in the dart itself.
    const half = Math.abs(theta) / 2;
    const sideOf = (q: P): 'a' | 'b' | 'in' => {
      if (len(sub(q, o)) < 1e-6) return 'a';
      let psi = signedAngle(uA, sub(q, o)) - theta / 2;
      while (psi > Math.PI) psi -= 2 * Math.PI;
      while (psi < -Math.PI) psi += 2 * Math.PI;
      psi *= Math.sign(theta);
      if (psi <= -half + 1e-6) return 'a';
      if (psi >= half - 1e-6) return 'b';
      return 'in';
    };
    const sides = segs.map((sg) => sideOf(bez(sg, 0.5)));
    const weight = (side: 'a' | 'b') =>
      segs.reduce((t, sg, i) => (sides[i] !== side ? t : t + (sg.tag === 'fold' ? 1000 : sg.tag === 'centre' ? 100 : 0) + len(sub(sg.b, sg.a))), 0);
    const turnA = weight('a') < weight('b');
    const turning: 'a' | 'b' = turnA ? 'a' : 'b';
    const move = (q: P) => rotAbout(q, o, turnA ? theta : -theta);
    const kept: Seg[] = [];
    const keptSide: string[] = [];
    segs.forEach((sg, i) => {
      if (sides[i] === 'in') return;
      kept.push(sides[i] === turning ? mapSeg(sg, move) : sg);
      keptSide.push(sides[i]);
    });
    // Earlier closings' corners on the side that turns go with it.
    for (let k = 0; k < corners.length; k++) if (sideOf(corners[k]) === turning) corners[k] = move(corners[k]);
    // Close the gaps the dart left: a hair is closed up, a step is bridged straight.
    const joined: Seg[] = [];
    kept.forEach((sg, i) => {
      const prev = joined[joined.length - 1] ?? kept[kept.length - 1];
      const gap = len(sub(sg.a, prev.b));
      if (i > 0 && keptSide[i] !== keptSide[i - 1]) corners.push(prev.b);
      if (i > 0 && gap > 0.2) joined.push({ kind: 'L', a: prev.b, b: sg.a, tag: prev.tag });
      joined.push(i > 0 && gap <= 0.2 ? { ...sg, a: prev.b } : sg);
    });
    if (keptSide[0] !== keptSide[keptSide.length - 1]) corners.push(kept[kept.length - 1].b);
    const first = joined[0];
    const lastSeg = joined[joined.length - 1];
    if (len(sub(first.a, lastSeg.b)) > 0.2) joined.push({ kind: 'L', a: lastSeg.b, b: first.a, tag: lastSeg.tag });
    else joined[0] = { ...first, a: lastSeg.b };
    segs = joined;
    closed++;
    // The dart's own legs go; the rest of the marks on the turned side go with it.
    const onLegs = (q: P) => toSeg(q, d.a, d.apex) < 0.05 || toSeg(q, d.b, d.apex) < 0.05;
    for (let k = lines.length - 1; k >= 0; k--) {
      const pts = lines[k].points(8);
      if (pts.every(onLegs)) lines.splice(k, 1);
      else if (sideOf(pts[Math.floor(pts.length / 2)]) === turning) lines[k] = mapPath(lines[k], move);
    }
    for (let k = notches.length - 1; k >= 0; k--) {
      const [at, dir] = notches[k];
      const side = sideOf(at);
      if (side === 'in') notches.splice(k, 1);
      else if (side === turning) notches[k] = [move(at), unit(sub(move(add(at, dir)), move(at)))];
    }
    for (let k = 0; k < labels.length; k++) if (sideOf(labels[k].at) === turning) labels[k] = { ...labels[k], at: move(labels[k].at) };
    todo = todo.map((x) => (sideOf(lerp(x.a, x.b, 0.5)) === turning ? { a: move(x.a), apex: move(x.apex), b: move(x.b) } : x));
  }
  for (const q of corners) segs = trueAt(segs, q, corners);
  return { ring: segs, closed };
}

const polyLen = (pts: P[]) => pts.slice(1).reduce((t, q, i) => t + len(sub(q, pts[i])), 0);

/** An edge trued through a corner a closed dart left in it, as a cutter blends the waist and the yoke seam with a curve:
 *  a few cm each side of the corner become one curve that leaves and meets the edge in its own directions. Corners of
 *  the outline itself (where one edge meets another) are left. */
function trueAt(ring: Seg[], q: P, others: P[] = [], reach = 3): Seg[] {
  const n = ring.length;
  const at = ring.findIndex((sg) => len(sub(sg.a, q)) < 0.25);
  if (at < 0 || n < 6) return ring;
  // Turned so the corner is in the middle, away from where the list wraps.
  const segs = [...ring.slice(at), ...ring.slice(0, at)];
  const mid = Math.floor(n / 2);
  const list = [...segs.slice(mid), ...segs.slice(0, mid)];
  const c = n - mid;
  const tag = list[c].tag;
  if (list[c - 1].tag !== tag) return ring;
  // Another closed dart's corner close by is taken into the same curve, so no corner is left at its end.
  const isCorner = (pt: P) => others.some((o) => o !== q && len(sub(o, pt)) < 0.25);
  let i0 = c;
  let acc = 0;
  while (i0 > 1 && list[i0 - 1].tag === tag && acc < reach) {
    acc += len(sub(list[--i0].b, list[i0].a));
    if (isCorner(list[i0].a)) acc = 0;
  }
  let i1 = c;
  acc = 0;
  while (i1 < n - 2 && list[i1].tag === tag && acc < reach) {
    acc += len(sub(list[i1].b, list[i1++].a));
    if (isCorner(list[i1 - 1].b)) acc = 0;
  }
  if (i0 >= c || i1 <= c) return ring;
  const a = list[i0].a;
  const b = list[i1 - 1].b;
  const L = len(sub(b, a));
  const inDir = i0 > 0 && list[i0 - 1].tag === tag ? endDir(list[i0 - 1]) : startDir(list[i0]);
  const outDir = list[i1] && list[i1].tag === tag ? startDir(list[i1]) : endDir(list[i1 - 1]);
  // The curve keeps the edge's length (a seam still meets its partner notch to notch): its pull is set to match.
  const want = list.slice(i0, i1).reduce((t, sg) => t + polyLen(flat(sg, 16)), 0);
  const make = (k: number): Seg => ({ kind: 'C', a, c1: add(a, mul(inDir, L * k)), c2: sub(b, mul(outDir, L * k)), b, tag });
  let lo = 0.05;
  let hi = 1.2;
  for (let it = 0; it < 30; it++) {
    const m = (lo + hi) / 2;
    if (polyLen(flat(make(m), 32)) < want) lo = m;
    else hi = m;
  }
  const curve = make((lo + hi) / 2);
  return [...list.slice(0, i0), curve, ...list.slice(i1)];
}

/** A name for a new piece, from where it sits on the piece it came off. */
function newName(pc: Piece, kept: P[], cutOff: P[], taken: string[]): string {
  const a = centroid(kept);
  const b = centroid(cutOff);
  const word = Math.abs(b.y - a.y) >= Math.abs(b.x - a.x) ? (b.y < a.y ? 'yoke' : 'lower') : 'panel';
  let name = `${pc.name} ${word}`;
  for (let k = 2; taken.includes(name); k++) name = `${pc.name} ${word} ${k}`;
  return name;
}

/** A new piece: the piece cut in two along the line, the larger part keeping its name. Each side of the new seam
 *  gets a notch at its middle, so the two are sewn together where they were cut. */
function cutInTwo(pc: Piece, c: Cut, e: CutEdit, taken: string[]): [Piece, Piece] {
  const back = [...c.cut].reverse().map(reverse);
  const ringA = [...c.runs[0], ...back];
  const ringB = [...c.runs[1], ...c.cut];
  const polyA = polyOf(ringA);
  const polyB = polyOf(ringB);
  const aBig = Math.abs(area(polyA)) >= Math.abs(area(polyB));
  const [keep, off] = aBig ? [ringA, ringB] : [ringB, ringA];
  const [keepPoly, offPoly] = aBig ? [polyA, polyB] : [polyB, polyA];
  const name = (e.name?.trim() || newName(pc, keepPoly, offPoly, taken)).slice(0, 40);
  // The middle of the new seam, by length along it.
  const cutPts = c.cut.flatMap((s, i) => flat(s, 16).slice(i ? 1 : 0));
  const total = cutPts.slice(1).reduce((t, q, i) => t + len(sub(q, cutPts[i])), 0);
  let acc = 0;
  let mid = cutPts[0];
  let dir = sub(cutPts[1], cutPts[0]);
  for (let i = 1; i < cutPts.length; i++) {
    const step = len(sub(cutPts[i], cutPts[i - 1]));
    if (acc + step >= total / 2) {
      mid = lerp(cutPts[i - 1], cutPts[i], (total / 2 - acc) / (step || 1));
      dir = sub(cutPts[i], cutPts[i - 1]);
      break;
    }
    acc += step;
  }
  const side = (poly: P[], q: P) => belongsTo(q, keepPoly, offPoly) === (poly === keepPoly ? 0 : 1);
  const darts = dartsIn(pc);
  // For All round (round 3): the piece kept whole, as the two parts sewn back together along the new seam, with the
  // seam drawn on it. Sewn, a yoke with its darts closed is the piece with its darts sewn, so the cloth hangs the same.
  const whole = sewnWhole(pc, cutPts);
  const part = (cutRing: Seg[], cutPoly: P[], own: string): Piece => {
    const lines = pc.lines.flatMap((ln) => clipLine(ln, cutPoly));
    const notches: [P, P][] = [...pc.notches.filter(([at]) => side(cutPoly, at)), [mid, outwardAt(mid, dir, cutPoly)]];
    // Darts that open on this part are closed into it (a yoke cut across darts, round 3).
    const mine = darts.filter((d) => inside(lerp(lerp(d.a, d.b, 0.5), d.apex, 0.05), cutPoly));
    const words = [...pc.labels];
    const { ring, closed } = mine.length ? closeDartsIn(cutRing, mine, lines, notches, words) : { ring: cutRing, closed: 0 };
    const poly = closed ? polyOf(ring) : cutPoly;
    const box = poly.reduce((b, q) => ({ y0: Math.min(b.y0, q.y), y1: Math.max(b.y1, q.y) }), { y0: Infinity, y1: -Infinity });
    let grain = pc.grain;
    if (grain && !(inside(grain[0], poly) && inside(grain[1], poly))) {
      // The grain line is drawn again through the middle of the part, in the same direction.
      const g = unit(sub(grain[1], grain[0]));
      const half = Math.min(len(sub(grain[1], grain[0])) / 2, (box.y1 - box.y0) * 0.3);
      const at = centroid(poly);
      grain = [sub(at, mul(g, half)), add(at, mul(g, half))];
    }
    const isNew = own !== pc.name;
    // The name goes where it is clearest of the darts and lines (and the edges): the roomiest of a grid of places
    // over the part, the middle when nothing is in the way.
    const middle = centroid(poly);
    const marks = lines.flatMap((ln) => ln.points(8));
    // Room for the name as a line of text: its nearest dart or line point to any place along the words.
    const nameSize = Math.min(1.6, Math.max(0.8, (box.y1 - box.y0) / 8));
    const half = (own.length * nameSize * 0.55) / 2;
    const room = (q: P) =>
      Math.min(
        distTo(q, poly),
        ...marks.map((m) => {
          const dx = Math.max(0, Math.abs(m.x - q.x) - half);
          return Math.hypot(dx, m.y - q.y);
        }),
      );
    const xs = poly.map((q) => q.x);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const grid = Array.from({ length: 63 }, (_, k) => p(x0 + (((k % 7) + 1) / 8) * (x1 - x0), box.y0 + ((Math.floor(k / 7) + 1) / 10) * (box.y1 - box.y0)));
    const at = !marks.length ? middle : grid.filter((q) => inside(q, poly)).reduce((best, q) => (room(q) > room(best) + 0.5 ? q : best), middle);
    const labels = isNew
      ? [
          { at: sub(at, p(0, 1.2)), text: own.toUpperCase(), size: nameSize },
          { at: add(at, p(0, 0.6)), text: pc.cut, size: 1.0 },
        ]
      : (() => {
          // The name and its lines stay together, moved to the middle of what is left when the cut ran through or
          // close by them.
          const first = words[0]?.at;
          if (!first || (inside(first, poly) && distTo(first, poly) > 3)) return words;
          const shift = sub(at, first);
          return words.map((l) => ({ ...l, at: add(l.at, shift) }));
        })();
    return {
      ...stripDrafted(pc),
      name: own,
      outline: pathOf(ring),
      lines,
      notches,
      grain,
      fold: foldOf(ring),
      labels: markEdited(labels),
      meta: { ...pc.meta, edited: true, pointIds: undefined, ...(isNew ? { newPiece: true, cutFrom: pc.name } : { sewnWhole: whole }), ...(closed ? { dartsClosed: closed } : {}) },
    };
  };
  return [part(keep, keepPoly, pc.name), part(off, offPoly, name)];
}

/** The tag of a new seam drawn across a piece kept whole for All round. */
const NEW_SEAM = 'newseam';

/** A piece with a new seam drawn on it, as All round sews it: whatever it was before it was cut (a piece cut more than
 *  once keeps every seam). The seam is drawn in short steps, so it is never read as a dart. */
function sewnWhole(pc: Piece, seam: P[]): Piece {
  const before = (pc.meta.sewnWhole as Piece | undefined) ?? pc;
  const total = seam.slice(1).reduce((t, q, i) => t + len(sub(q, seam[i])), 0);
  const steps = Math.max(12, Math.ceil(total / 1.5));
  const at = (d: number) => {
    let acc = 0;
    for (let i = 1; i < seam.length; i++) {
      const step = len(sub(seam[i], seam[i - 1]));
      if (acc + step >= d) return lerp(seam[i - 1], seam[i], (d - acc) / (step || 1));
      acc += step;
    }
    return seam[seam.length - 1];
  };
  const path = new Path(at(0));
  for (let k = 1; k <= steps; k++) path.line(at((k / steps) * total), NEW_SEAM);
  const meta = { ...before.meta };
  delete meta.sewnWhole;
  return { ...before, lines: [...before.lines, path], meta };
}

/** The pieces as All round sews them (round 3): each piece that had a new piece cut off it is sewn whole again, its new
 *  seams drawn on it, and the new pieces themselves go (they are in it). */
export function sewnForAllRound(pieces: Piece[]): Piece[] {
  if (!hasNewPieces(pieces)) return pieces;
  return pieces.filter((pc) => !pc.meta.newPiece).map((pc) => (pc.meta.sewnWhole as Piece | undefined) ?? pc);
}

/** One cut on a set of pieces. A line that doesn't cross its piece from edge to edge changes nothing. */
export function applyCut(pieces: Piece[], e: CutEdit): Piece[] {
  const i = pieces.findIndex((pc) => pc.name === e.piece);
  if (i < 0) return pieces;
  const pc = pieces[i];
  const segs = segsOf(pc.outline);
  const c = cutOf(segs, e.line, e.cut !== 'piece');
  if (!c) return pieces;
  if (e.cut === 'piece') {
    const [kept, made] = cutInTwo(pc, c, e, pieces.map((x) => x.name));
    return [...pieces.slice(0, i), kept, made, ...pieces.slice(i + 1)];
  }
  return pieces.map((x, k) => (k === i ? openOut(pc, e, c) : x));
}

/** Whether a drawn line would cut a piece, and the two ends where it meets the edges: for the editor, to offer the
 *  choice only for a line that crosses a piece, and to put the handle that opens a spread at its far end. */
export function cutEnds(pc: Piece, line: P[], straight = true): { hinge: P; far: P } | undefined {
  const c = cutOf(segsOf(pc.outline), line, straight);
  if (!c) return undefined;
  return c.startAtX ? { hinge: c.x.at, far: c.y.at } : { hinge: c.y.at, far: c.x.at };
}

/** Where the handle that opens a spread or fullness sits (the far end of its cut, opened), and the way it opens:
 *  given the pieces as they were before that cut. */
export function openHandle(pieces: Piece[], e: CutEdit): { at: P; opens: P } | undefined {
  const pc = pieces.find((x) => x.name === e.piece);
  if (!pc || e.cut === 'piece') return undefined;
  const c = cutOf(segsOf(pc.outline), e.line, true);
  if (!c) return undefined;
  const o = openingOf(e, c);
  return { at: o.move(o.far), opens: o.opens };
}

/** Where a kept cut lies, to show it and tap it (round 3): its line from edge to edge, the two ends where it meets the
 *  edges (the one it was started at first), and a place half way along it for its mark. Given the pieces as they were
 *  just before that cut. */
export function cutMark(pieces: Piece[], e: CutEdit): { at: P; ends: [P, P]; line: P[] } | undefined {
  const pc = pieces.find((x) => x.name === e.piece);
  if (!pc) return undefined;
  const c = cutOf(segsOf(pc.outline), e.line, e.cut !== 'piece');
  if (!c) return undefined;
  const line = c.cut.flatMap((s, i) => flat(s, 16).slice(i ? 1 : 0));
  const total = line.slice(1).reduce((t, q, i) => t + len(sub(q, line[i])), 0);
  let acc = 0;
  let at = line[0];
  for (let i = 1; i < line.length; i++) {
    const step = len(sub(line[i], line[i - 1]));
    if (acc + step >= total / 2) {
      at = lerp(line[i - 1], line[i], (total / 2 - acc) / (step || 1));
      break;
    }
    acc += step;
  }
  const ends: [P, P] = c.startAtX ? [c.x.at, c.y.at] : [c.y.at, c.x.at];
  return { at, ends, line: c.startAtX ? line : [...line].reverse() };
}

/** How many of a drawn line's points lie on a piece. */
export const pointsOn = (pc: Piece, line: P[]) => {
  const poly = pc.outline.points(12);
  return line.filter((q) => inside(q, poly)).length;
};

/** Every edit, moves and cuts, in the order made. Pieces nobody edited come back as drafted, the same objects. */
export function applyPatternEdits(pieces: Piece[], edits: PatternEdit[] | undefined): Piece[] {
  if (!edits?.length) return pieces;
  let out = pieces;
  let run: PointEdit[] = [];
  for (const e of edits) {
    if (isCut(e)) {
      if (run.length) out = applyPointEdits(out, run);
      run = [];
      out = applyCut(out, e);
    } else if (e && typeof (e as PointEdit).at === 'string') run.push(e as PointEdit);
  }
  if (run.length) out = applyPointEdits(out, run);
  return out;
}

/** Whether any edit cut a piece in two, so All round shows the garment's drawing until new pieces are sewn there. */
export const hasNewPieces = (pieces: Piece[]) => pieces.some((pc) => !!pc.meta.newPiece);
