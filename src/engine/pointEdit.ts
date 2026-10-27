// Moving points on the flat pattern, the way a pattern cutter edits in pattern software: drag a corner
// or a point on a curve, add a point to a line and pull it into a curve, or slide a dart point. The
// seam it sews to on the other piece walks with it, so side and shoulder seams stay matched (the back
// shoulder keeps its ease), dart legs stay trued, and corners keep their angles where a curve can bend
// to keep them. Points on a fold only slide along the fold.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { Piece } from './piece';
import { pairs } from './qc';

/** One move, as saved: a point on a piece, found again by name after the pattern is redrafted. */
export interface PointEdit {
  piece: string;
  /** The point: the two edges meeting there and which of them it is ("armhole|side#0"), a point
   * added to an edge ("+side0@0.500"), or a dart point ("dart0"). */
  at: string;
  /** How far it moved, in cm on its own piece. */
  by: P;
}

/** Seams that sew front to back and walk together. */
const LINKED_SEAMS = ['side', 'shoulder', 'inseam'];

type Seg = Path['segs'][number];

/** A piece's outline as points with the edges between them: edge i runs from point i to point i + 1. */
interface Model {
  pts: P[];
  segs: { kind: 'L' | 'C'; c1?: P; c2?: P; tag: string }[];
  ids: string[];
  lines: P[][];
}

const rot = (v: P, a: number): P => p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
const angleOf = (v: P) => Math.atan2(v.y, v.x);
const turn = (from: P, to: P) => {
  let a = angleOf(to) - angleOf(from);
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
const same = (a: P, b: P) => len(sub(a, b)) < 1e-6;

function toModel(path: Path, lines: Path[]): Model {
  const pts = [path.start, ...path.segs.map((s) => s.to)];
  const segs = path.segs.map((s: Seg, i) => (s.kind === 'C' ? { kind: 'C' as const, c1: s.c1, c2: s.c2, tag: path.tags[i] } : { kind: 'L' as const, tag: path.tags[i] }));
  // An outline that stops short of its start is closed by a straight edge, read as part of its last edge.
  if (pts.length > 2 && len(sub(pts[0], pts[pts.length - 1])) < 1e-3) pts.pop();
  else segs.push({ kind: 'L', tag: segs[segs.length - 1]?.tag ?? '' });
  const m: Model = { pts, segs, ids: [], lines: lines.map((ln) => ln.points().map((q) => ({ ...q }))) };
  m.ids = cornerIds(m);
  return m;
}

function toPath(m: Model): Path {
  const path = new Path(m.pts[0]);
  m.segs.forEach((s, i) => {
    const to = m.pts[(i + 1) % m.pts.length];
    if (s.kind === 'C') path.curve(s.c1!, s.c2!, to, s.tag);
    else path.line(to, s.tag);
  });
  path.closed = true;
  return path;
}

const n = (m: Model) => m.pts.length;
const before = (m: Model, i: number) => (i - 1 + n(m)) % n(m);
const after = (m: Model, i: number) => (i + 1) % n(m);

/** Each point named by the edges meeting there, so the same point is found on a redrafted pattern and
 * on the other piece of a seam (whichever way round its outline runs). */
function cornerIds(m: Model): string[] {
  const seen: Record<string, number> = {};
  return m.pts.map((_, i) => {
    const pair = [m.segs[before(m, i)].tag, m.segs[i].tag].sort().join('|');
    const k = seen[pair] ?? 0;
    seen[pair] = k + 1;
    return `${pair}#${k}`;
  });
}

const tagsAt = (m: Model, i: number) => [m.segs[before(m, i)].tag, m.segs[i].tag];

/** Points that can be dragged: not on a dart's edge (the dart point is moved instead). */
const movable = (tags: string[]) => !tags.includes('dart');

/** Edges shorter than this, in a run of the same seam, are the steps of a curve drawn as a polyline
 * (a shaped waist): they are pulled along with a moved point rather than swung round. */
const STEP = 1.2;
/** How far along such a run the pull reaches, in cm. */
const PULL = 5;

const segLen = (m: Model, s: number) => len(sub(m.pts[after(m, s)], m.pts[s]));
const isStep = (m: Model, s: number) => m.segs[s].kind === 'L' && segLen(m, s) < STEP;
const isCorner = (m: Model, i: number) => m.segs[before(m, i)].tag !== m.segs[i].tag;

/** The polyline points beside point i, one way along the outline, with how much of a move each takes. */
function pullRun(m: Model, i: number, dir: 1 | -1): { at: number; w: number }[] {
  const out: { at: number; w: number }[] = [];
  const first = dir > 0 ? i : before(m, i);
  const tag = m.segs[first].tag;
  let j = i;
  let s = 0;
  for (let guard = 0; guard < m.pts.length; guard++) {
    const seg = dir > 0 ? j : before(m, j);
    if (!isStep(m, seg) || m.segs[seg].tag !== tag) break;
    s += segLen(m, seg);
    const next = dir > 0 ? after(m, j) : before(m, j);
    if (s >= PULL || next === i || isCorner(m, next)) break;
    out.push({ at: next, w: 0.5 * (1 + Math.cos((Math.PI * s) / PULL)) });
    j = next;
  }
  return out;
}

/** Move point i by d, the way a cutter re-trues around it. Curves keep their direction into the point.
 * A polyline curve (a shaped waist) is pulled along smoothly. A straight seam swings round, and the
 * curve at its other end turns with it so that corner keeps its angle (an armhole still blends into
 * the side seam). Where no curve can take up the turn (a side seam meeting a straight or polyline
 * waist), the seam bends gently near that corner instead, so the corner stays as drafted. */
function movePoint(m: Model, i: number, d: P) {
  const k = n(m);
  const iP = before(m, i);
  const iN = i;
  const v0 = m.pts[i];
  const v1 = add(v0, d);
  const kind = (s: number) => (m.segs[s].kind === 'C' ? 'curve' : isStep(m, s) ? 'step' : 'line');
  const kP = kind(iP);
  const kN = kind(iN);
  const pulls = k > 3 ? [...pullRun(m, i, -1), ...pullRun(m, i, 1)] : [];
  const was = m.pts.map((q) => q);
  if (kP === 'curve') m.segs[iP].c2 = add(m.segs[iP].c2!, d);
  if (kN === 'curve') m.segs[iN].c1 = add(m.segs[iN].c1!, d);
  m.pts[i] = v1;
  for (const { at, w } of pulls) {
    const dd = mul(d, w);
    m.pts[at] = add(m.pts[at], dd);
    // The run's last point may meet a curve: it keeps its direction there.
    if (m.segs[at].kind === 'C') m.segs[at].c1 = add(m.segs[at].c1!, dd);
    if (m.segs[before(m, at)].kind === 'C') m.segs[before(m, at)].c2 = add(m.segs[before(m, at)].c2!, dd);
  }
  if (k < 4) return;
  // Each straight seam at the point, and the corner at its far end.
  for (const side of [-1, 1] as const) {
    const e = side < 0 ? iP : iN;
    if (kind(e) !== 'line') continue;
    const wi = side < 0 ? iP : after(m, i);
    const w = m.pts[wi];
    if (pulls.some((p2) => p2.at === wi)) continue;
    const L = len(sub(v1, w));
    const r = turn(sub(v0, w), sub(v1, w));
    const otherAtV = side < 0 ? kN : kP;
    const farSeg = side < 0 ? before(m, iP) : after(m, iN);
    const far = m.segs[farSeg];
    const keepV = otherAtV !== 'curve';
    const keepW = far.kind === 'L' && far.tag !== m.segs[e].tag && !isStep(m, farSeg);
    const keepWStep = far.kind === 'L' && far.tag !== m.segs[e].tag && isStep(m, farSeg);
    if (far.kind === 'C') {
      if (side < 0) far.c2 = add(w, rot(sub(far.c2!, w), r));
      else far.c1 = add(w, rot(sub(far.c1!, w), r));
    }
    if (otherAtV === 'curve') {
      const o = m.segs[side < 0 ? iN : iP];
      if (side < 0) o.c1 = add(v1, rot(sub(o.c1!, v1), r));
      else o.c2 = add(v1, rot(sub(o.c2!, v1), r));
    }
    if (keepV || keepW || keepWStep) {
      const atV = keepV ? add(v1, mul(unit(sub(w, was[i])), L / 3)) : lerp(v1, w, 1 / 3);
      const atW = keepW || keepWStep ? add(w, mul(unit(sub(was[i], w)), L / 3)) : lerp(w, v1, 1 / 3);
      Object.assign(m.segs[e], side < 0 ? { kind: 'C', c1: atW, c2: atV } : { kind: 'C', c1: atV, c2: atW });
    }
  }
}

function segPoints(m: Model, i: number, steps = 24): P[] {
  const s = m.segs[i];
  const a = m.pts[i];
  const b = m.pts[after(m, i)];
  if (s.kind === 'L') return [a, b];
  const out: P[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const u = 1 - t;
    out.push(p(u ** 3 * a.x + 3 * u * u * t * s.c1!.x + 3 * u * t * t * s.c2!.x + t ** 3 * b.x, u ** 3 * a.y + 3 * u * u * t * s.c1!.y + 3 * u * t * t * s.c2!.y + t ** 3 * b.y));
  }
  return out;
}
const segLength = (m: Model, i: number) => {
  const q = segPoints(m, i, 32);
  let t = 0;
  for (let k = 1; k < q.length; k++) t += len(sub(q[k], q[k - 1]));
  return t;
};
const tagLength = (m: Model, tag: string) => m.segs.reduce((t, s, i) => (s.tag === tag ? t + segLength(m, i) : t), 0);

/** Runs of consecutive edges carrying a tag, in outline order. */
function runs(m: Model, tag: string): number[][] {
  const out: number[][] = [];
  const k = m.segs.length;
  const start = m.segs.findIndex((s, i) => s.tag !== tag && m.segs[(i + 1) % k].tag === tag);
  if (start < 0) return m.segs.every((s) => s.tag === tag) ? [m.segs.map((_, i) => i)] : [];
  for (let j = 1; j <= k; j++) {
    const i = (start + j) % k;
    if (m.segs[i].tag !== tag) continue;
    if (m.segs[before(m, i)].tag === tag && out.length) out[out.length - 1].push(i);
    else out.push([i]);
  }
  return out;
}

/** Add a point on the edge run `run` of `tag`, a fraction f of the way along it from its upper end.
 * A straight edge becomes two curves that leave its ends in the same direction, so pulling the new
 * point bends the edge smoothly without turning its corners. Returns the new point's index. */
function insertAt(m: Model, tag: string, run: number, f: number, id: string): number | undefined {
  const r = runs(m, tag)[run];
  if (!r) return undefined;
  const first = m.pts[r[0]];
  const last = m.pts[after(m, r[r.length - 1])];
  const order = first.y <= last.y ? r : [...r].reverse();
  const total = r.reduce((t, i) => t + segLength(m, i), 0);
  let left = f * total;
  for (const i of order) {
    const L = segLength(m, i);
    if (left > L + 1e-9) {
      left -= L;
      continue;
    }
    // Along this edge in its own direction.
    let t = Math.min(0.98, Math.max(0.02, (first.y <= last.y ? left : L - left) / (L || 1)));
    const s = m.segs[i];
    const a = m.pts[i];
    const b = m.pts[after(m, i)];
    let A: Model['segs'][number];
    let B: Model['segs'][number];
    let mid: P;
    if (s.kind === 'L') {
      mid = lerp(a, b, t);
      const u = unit(sub(b, a));
      A = { kind: 'C', c1: lerp(a, mid, 1 / 3), c2: sub(mid, mul(u, len(sub(mid, a)) / 3)), tag: s.tag };
      B = { kind: 'C', c1: add(mid, mul(u, len(sub(b, mid)) / 3)), c2: lerp(b, mid, 1 / 3), tag: s.tag };
    } else {
      // Arc length to curve parameter, then split the curve there (de Casteljau).
      const q = segPoints(m, i, 64);
      let acc = 0;
      const want = t * L;
      for (let k = 1; k < q.length; k++) {
        const step = len(sub(q[k], q[k - 1]));
        if (acc + step >= want) {
          t = (k - 1 + (want - acc) / (step || 1)) / 64;
          break;
        }
        acc += step;
      }
      const p01 = lerp(a, s.c1!, t);
      const p12 = lerp(s.c1!, s.c2!, t);
      const p23 = lerp(s.c2!, b, t);
      const p012 = lerp(p01, p12, t);
      const p123 = lerp(p12, p23, t);
      mid = lerp(p012, p123, t);
      A = { kind: 'C', c1: p01, c2: p012, tag: s.tag };
      B = { kind: 'C', c1: p123, c2: p23, tag: s.tag };
    }
    m.segs.splice(i, 1, A, B);
    m.pts.splice(i + 1, 0, mid);
    m.ids.splice(i + 1, 0, id);
    return i + 1;
  }
  return undefined;
}

/** Where an interior point of an edge run sits: which run of its tag, and how far along from the top. */
function alongRun(m: Model, i: number): { run: number; f: number } | undefined {
  const tag = m.segs[i].tag;
  const all = runs(m, tag);
  const run = all.findIndex((r) => r.includes(i) && r.includes(before(m, i)));
  if (run < 0) return undefined;
  const r = all[run];
  const top = m.pts[r[0]].y <= m.pts[after(m, r[r.length - 1])].y;
  const total = r.reduce((t, s) => t + segLength(m, s), 0);
  const upto = r.slice(0, r.indexOf(i)).reduce((t, s) => t + segLength(m, s), 0);
  return { run, f: (top ? upto : total - upto) / (total || 1) };
}

/** Which side of its piece's centre a point sits on, so a move can be mirrored onto the other piece. */
function outward(pc: Piece, q: P): number {
  if (pc.fold) return Math.sign(q.x - pc.fold[0].x) || 1;
  const xs = pc.outline.points(8).map((v) => v.x);
  return Math.sign(q.x - (Math.min(...xs) + Math.max(...xs)) / 2) || 1;
}

/** A move along the fold only, for a point that sits on it. */
function onFold(pc: Piece, q: P, d: P): P {
  if (!pc.fold) return d;
  const [a, b] = pc.fold;
  const u = unit(sub(b, a));
  const off = (q.x - a.x) * -u.y + (q.y - a.y) * u.x;
  if (Math.abs(off) > 0.02) return d;
  const t = d.x * u.x + d.y * u.y;
  return mul(u, t);
}

/** Dart point i moved by d: it slides along the dart's centre line, so both legs stay the same length. */
function moveDart(m: Model, i: number, d: P) {
  const darts = m.lines.filter((l) => l.length === 3);
  const dart = darts[i];
  if (!dart) return;
  const [near, tip, far] = dart;
  const mid = lerp(near, far, 0.5);
  const u = unit(sub(tip, mid));
  const length = Math.max(2, len(sub(tip, mid)) + d.x * u.x + d.y * u.y);
  dart[1] = add(mid, mul(u, length));
}

/** Apply saved moves to a set of pieces. Pieces without moves come back unchanged. */
export function applyPointEdits(pieces: Piece[], edits: PointEdit[] | undefined): Piece[] {
  if (!edits?.length) return pieces;
  const named = edits.filter((e) => pieces.some((pc) => pc.name === e.piece));
  if (!named.length) return pieces;
  const models = new Map<Piece, Model>();
  const model = (pc: Piece) => {
    let m = models.get(pc);
    if (!m) {
      m = toModel(pc.outline, pc.lines);
      models.set(pc, m);
    }
    return m;
  };
  const partnerOf = (pc: Piece) => {
    const g = pairs(pieces).find((x) => x.front === pc || x.back === pc);
    return g ? (g.front === pc ? g.back : g.front) : undefined;
  };

  for (const e of named) {
    const pc = pieces.find((x) => x.name === e.piece)!;
    const m = model(pc);
    if (e.at.startsWith('dart')) {
      moveDart(m, Number(e.at.slice(4)), e.by);
      continue;
    }
    const other = partnerOf(pc);
    const add = e.at.match(/^\+([a-z-]+?)(\d+)@([\d.]+)$/);
    if (add && !m.ids.includes(e.at)) {
      const [, tag, run, f] = add;
      insertAt(m, tag, Number(run), Number(f), e.at);
      if (other && LINKED_SEAMS.includes(tag) && !model(other).ids.includes(e.at)) insertAt(model(other), tag, Number(run), Number(f), e.at);
    }
    const i = m.ids.indexOf(e.at);
    if (i < 0 || !movable(tagsAt(m, i))) continue;
    const d = onFold(pc, m.pts[i], e.by);
    const linked = tagsAt(m, i).filter((t) => LINKED_SEAMS.includes(t));
    const om = other && linked.length ? model(other) : undefined;
    let j = om ? om.ids.indexOf(e.at) : -1;
    // A point partway along a seam that the other piece has no point for (where a curve joins a line
    // on one piece only): the other piece gets one at the same place along its seam.
    if (om && j < 0 && linked.length === 2 && linked[0] === linked[1]) {
      const at = alongRun(m, i);
      if (at) j = insertAt(om, linked[0], at.run, at.f, e.at) ?? -1;
    }
    const was = om ? linked.map((t) => [tagLength(m, t), tagLength(om, t)]) : [];
    movePoint(m, i, d);
    if (!om || j < 0 || !other) continue;
    // The other piece's point walks the same way (mirrored when that piece faces the other way)...
    const flip = outward(pc, m.pts[i]) * outward(other, om.pts[j]);
    const dd = onFold(other, om.pts[j], p(d.x * flip, d.y));
    movePoint(om, j, dd);
    // ...then is nudged until each seam it is on changes length by the same amount on both pieces.
    // Nudged along the drag or along the seam, whichever changes its length more.
    const rateAlong = (t: string, u: P, at = j) => {
      const probe = clone(om);
      movePoint(probe, at, mul(u, 0.1));
      return (tagLength(probe, t) - tagLength(om, t)) / 0.1;
    };
    linked.forEach((t, k) => {
      const across = om.segs[before(om, j)].tag === t ? om.pts[before(om, j)] : om.pts[after(om, j)];
      const along = unit(sub(om.pts[j], across));
      const ways = [len(dd) > 1e-6 ? unit(dd) : p(0, 1), along, p(-along.y, along.x), p(along.y, -along.x)];
      for (let step = 0; step < 8; step++) {
        const want = was[k][1] + (tagLength(m, t) - was[k][0]);
        const err = want - tagLength(om, t);
        if (Math.abs(err) < 0.002) break;
        const [u, rate] = ways.map((w) => [w, rateAlong(t, w)] as const).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
        if (Math.abs(rate) < 0.02) break;
        movePoint(om, j, onFold(other, om.pts[j], mul(u, Math.max(-2, Math.min(2, err / rate)))));
      }
      // A point partway along a seam can't always make up the difference (it can only lengthen a
      // straight seam): the seam's lower end is walked along it instead, as a cutter trues a hem.
      const run = runs(om, t).find((x) => x.includes(j) || x.includes(before(om, j)));
      if (!run) return;
      const ends = [run[0], after(om, run[run.length - 1])];
      const [low, high] = om.pts[ends[0]].y >= om.pts[ends[1]].y ? ends : [ends[1], ends[0]];
      if (low === j) return;
      for (let step = 0; step < 6; step++) {
        const err = was[k][1] + (tagLength(m, t) - was[k][0]) - tagLength(om, t);
        if (Math.abs(err) < 0.002) break;
        const u = unit(sub(om.pts[low], om.pts[high]));
        const rate = rateAlong(t, u, low);
        if (Math.abs(rate) < 0.2) break;
        movePoint(om, low, onFold(other, om.pts[low], mul(u, Math.max(-1, Math.min(1, err / rate)))));
      }
    });
  }

  return pieces.map((pc) => {
    const m = models.get(pc);
    if (!m) return pc;
    const old = toModel(pc.outline, pc.lines);
    const outline = toPath(m);
    // Dart legs end on the outline: they follow it, then the point is trued between them.
    const where = (q: P) => {
      const i = old.pts.findIndex((v) => same(v, q));
      return i >= 0 ? m.pts[m.ids.indexOf(old.ids[i])] ?? q : q;
    };
    const lines = pc.lines.map((_, k) => {
      const q = m.lines[k];
      if (q.length !== 3) {
        const path = new Path(q[0]);
        q.slice(1).forEach((v) => path.line(v));
        return path;
      }
      const near = where(q[0]);
      const far = where(q[2]);
      const mid = lerp(near, far, 0.5);
      const u = unit(sub(q[1], lerp(q[0], q[2], 0.5)));
      const tip = add(mid, mul(u, len(sub(q[1], lerp(q[0], q[2], 0.5)))));
      return new Path(near).line(tip).line(far);
    });
    // Notches stay on the line they mark.
    const dense = outline.points(32);
    const notches = pc.notches.map(([at, dir]): [P, P] => {
      const moved = where(at);
      if (moved !== at) return [moved, dir];
      const nearest = dense.reduce((best, q) => (len(sub(q, at)) < len(sub(best, at)) ? q : best), dense[0]);
      return [len(sub(nearest, at)) < 3 ? nearest : at, dir];
    });
    return { ...pc, outline, lines, notches, meta: { ...pc.meta, pointIds: m.ids } };
  });
}

const clone = (m: Model): Model => ({
  pts: m.pts.map((q) => ({ ...q })),
  segs: m.segs.map((s) => ({ ...s, c1: s.c1 && { ...s.c1 }, c2: s.c2 && { ...s.c2 } })),
  ids: [...m.ids],
  lines: m.lines.map((l) => l.map((q) => ({ ...q }))),
});

/** A point that can be grabbed on the editor. */
export interface Handle {
  piece: string;
  at: string;
  pos: P;
  kind: 'corner' | 'added' | 'dart';
  /** The seams it is on, for its name and for walking its partner. */
  tags: string[];
}

/** Every point that can be dragged on a set of (already edited) pieces. */
export function handlesOf(pieces: Piece[]): Handle[] {
  return pieces.flatMap((pc) => {
    const m = toModel(pc.outline, pc.lines);
    // Added points keep their names, carried on an edited piece.
    const ids = (pc.meta.pointIds as string[] | undefined) ?? m.ids;
    const corners: Handle[] = m.pts
      .map((pos, i) => ({ piece: pc.name, at: ids[i] ?? m.ids[i], pos, kind: (ids[i] ?? '').startsWith('+') ? ('added' as const) : ('corner' as const), tags: tagsAt(m, i) }))
      .filter((h, i) => movable(h.tags) && (h.kind === 'added' || h.tags[0] !== h.tags[1] || m.segs[i].kind === 'C' || m.segs[before(m, i)].kind === 'C'));
    const darts: Handle[] = m.lines.filter((l) => l.length === 3).map((l, i) => ({ piece: pc.name, at: `dart${i}`, pos: l[1], kind: 'dart' as const, tags: ['dart'] }));
    return [...corners, ...darts];
  });
}

/** A new point on the edge nearest q: its id, or undefined when q is not near an edge. */
export function pointOnEdge(pc: Piece, q: P, within: number): string | undefined {
  const m = toModel(pc.outline, pc.lines);
  let best: { d: number; tag: string; i: number; at: P } | undefined;
  m.segs.forEach((s, i) => {
    if (s.tag === 'dart') return;
    const pts = segPoints(m, i, 24);
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1];
      const ab = sub(pts[k], a);
      const l2 = ab.x * ab.x + ab.y * ab.y || 1;
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2));
      const at = add(a, mul(ab, t));
      const d = len(sub(at, q));
      if (!best || d < best.d) best = { d, tag: s.tag, i, at };
    }
  });
  if (!best || best.d > within) return undefined;
  const found = best;
  const allRuns = runs(m, found.tag);
  const run = allRuns.findIndex((r) => r.includes(found.i));
  const r = allRuns[run];
  const first = m.pts[r[0]];
  const last = m.pts[after(m, r[r.length - 1])];
  const order = first.y <= last.y ? r : [...r].reverse();
  // How far along the run the tapped spot is, from its upper end.
  let acc = 0;
  let total = 0;
  for (const i of order) total += segLength(m, i);
  for (const i of order) {
    if (i !== found.i) {
      acc += segLength(m, i);
      continue;
    }
    const pts = segPoints(m, i, 24);
    const ordered = first.y <= last.y ? pts : [...pts].reverse();
    for (let k = 1; k < ordered.length; k++) {
      const a = ordered[k - 1];
      const b = ordered[k];
      const seg = len(sub(b, a));
      const ab = sub(b, a);
      const t = Math.max(0, Math.min(1, ((found.at.x - a.x) * ab.x + (found.at.y - a.y) * ab.y) / (seg * seg || 1)));
      if (len(sub(add(a, mul(ab, t)), found.at)) < 1e-6 || t < 1) {
        acc += seg * t;
        break;
      }
      acc += seg;
    }
    break;
  }
  const f = Math.min(0.97, Math.max(0.03, acc / (total || 1)));
  return `+${found.tag}${run}@${f.toFixed(3)}`;
}

const SEAM_NAMES: Record<string, string> = {
  side: 'Side seam',
  shoulder: 'Shoulder',
  inseam: 'Inside leg',
  hem: 'Hem',
  waist: 'Waist',
  neck: 'Neckline',
  armhole: 'Armhole',
  crotch: 'Crotch seam',
  centre: 'Centre seam',
  fold: 'Fold',
  yoke: 'Yoke seam',
};

/** The measurement a point stands for, for the tape: a dart's length, or the length of the seam it
 * ends, and which way to move the point to change it. */
export function measureAt(pieces: Piece[], h: Handle): { label: string; value: number; dir: P } | undefined {
  const pc = pieces.find((x) => x.name === h.piece);
  if (!pc) return undefined;
  const m = toModel(pc.outline, pc.lines);
  if (h.kind === 'dart') {
    const dart = m.lines.filter((l) => l.length === 3)[Number(h.at.slice(4))];
    if (!dart) return undefined;
    const mid = lerp(dart[0], dart[2], 0.5);
    return { label: 'Dart length', value: len(sub(dart[1], mid)), dir: unit(sub(dart[1], mid)) };
  }
  const i = m.pts.findIndex((q) => same(q, h.pos));
  if (i < 0) return undefined;
  const [tIn, tOut] = tagsAt(m, i);
  if (h.kind === 'added') {
    // How far the added point stands off the line between its edge's ends.
    const r = runs(m, tIn).find((x) => x.includes(i) || x.includes(before(m, i)));
    if (!r) return undefined;
    const a = m.pts[r[0]];
    const b = m.pts[after(m, r[r.length - 1])];
    const u = unit(sub(b, a));
    const nrm = p(-u.y, u.x);
    const off = (h.pos.x - a.x) * nrm.x + (h.pos.y - a.y) * nrm.y;
    return { label: `${SEAM_NAMES[tIn] ?? 'Edge'} curve`, value: Math.abs(off), dir: off < 0 ? mul(nrm, -1) : nrm };
  }
  // The seam it ends: a seam that sews to another piece first, then the longer edge.
  const pick = [
    { tag: tIn, seg: before(m, i), from: m.pts[before(m, i)] },
    { tag: tOut, seg: i, from: m.pts[after(m, i)] },
  ]
    .filter((x) => x.tag !== 'fold')
    .sort((x, y) => Number(LINKED_SEAMS.includes(y.tag)) - Number(LINKED_SEAMS.includes(x.tag)) || segLength(m, y.seg) - segLength(m, x.seg))[0];
  if (!pick) return undefined;
  return { label: `${SEAM_NAMES[pick.tag] ?? 'Edge'} length`, value: tagLength(m, pick.tag), dir: unit(sub(h.pos, pick.from)) };
}
