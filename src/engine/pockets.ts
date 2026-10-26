// Pockets: the pieces and marks a pocket adds to a garment, drafted from the seam it sits in so the
// two always match. In-seam pockets hang from a side seam on a bag of their own; slant pockets are cut
// into a trouser front, with a lining that turns behind the opening and a facing that fills it in.
// The helpers here only know about pieces and tagged edges, not about skirts or trousers, so other
// pockets (welt, patch) can be built on them.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';

export type PocketStyle = 'none' | 'inseam' | 'slant';

/**
 * An in-seam pocket, in cm down the side seam from the waist seam line: the opening starts 4 cm down
 * (clear of the waistband) and is 15 cm long, room for a hand. The bag reaches 2 cm above the opening
 * and is sewn to the seam to 3 cm below it, then hangs 9 cm lower, 16 cm across.
 */
export const INSEAM = { top: 4, opening: 15, above: 2, below: 3, depth: 9, width: 16 };

/**
 * A slant pocket on a trouser front: the opening runs from 4 cm in from the side at the waist to 17 cm
 * down the side seam. Its bag carries on 10 cm below the opening and 15 cm across, and its top runs
 * 5 cm further along the waist so the waistband holds it.
 */
export const SLANT = { in: 4, down: 17, depth: 10, width: 15, along: 5 };

/** Where a seam line sits on the outline: the edge it falls on and the point. */
interface At {
  i: number;
  q: P;
}

/** A closed outline as a polyline: tags[i] names the edge from pts[i] to pts[i + 1] (wrapping round). */
interface Ring {
  pts: P[];
  tags: string[];
}

function ringOf(pc: Piece, steps = 64): Ring {
  let { pts, tags } = pc.outline.taggedPoints(steps);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  return { pts, tags: tags.slice(0, pts.length) };
}

/** The first edge of the first run tagged `tag`. */
const runStart = (r: Ring, tag: string) => r.tags.findIndex((t, i) => t === tag && r.tags[(i - 1 + r.tags.length) % r.tags.length] !== tag);

/** Walk `d` cm along the outline from the start of edge `from`, forward (1) or back (-1), staying on
 * edges tagged `tag`. Undefined when the run ends first. */
function walk(r: Ring, from: number, d: number, tag: string, dir: 1 | -1 = 1): At | undefined {
  const n = r.pts.length;
  let acc = 0;
  for (let k = 0, i = from; k < n; k++, i = (i + dir + n) % n) {
    if (r.tags[i] !== tag) return undefined;
    const a = r.pts[dir === 1 ? i : (i + 1) % n];
    const b = r.pts[dir === 1 ? (i + 1) % n : i];
    const l = len(sub(b, a));
    if (acc + l >= d) return { i, q: lerp(a, b, l ? (d - acc) / l : 0) };
    acc += l;
  }
  return undefined;
}

/** The points of the outline from one position to a later one, both ends included. */
function between(r: Ring, a: At, b: At): P[] {
  const n = r.pts.length;
  const out = [a.q];
  for (let i = a.i; i !== b.i; i = (i + 1) % n) out.push(r.pts[(i + 1) % n]);
  out.push(b.q);
  return out.filter((q, k) => k === 0 || len(sub(q, out[k - 1])) > 1e-6);
}

/** The stretch of a seam from `from` to `to` cm along it, from where the seam starts. */
function seamSlice(pc: Piece, tag: string, from: number, to: number): P[] | undefined {
  const r = ringOf(pc);
  const s = runStart(r, tag);
  if (s < 0) return undefined;
  const a = walk(r, s, from, tag);
  const b = walk(r, s, to, tag);
  return a && b ? between(r, a, b) : undefined;
}

/**
 * Fewer points along a run, none of the dropped ones more than `tol` cm off it (Douglas-Peucker). The
 * pocket pieces copy the garment's seams finely sampled, which would leave the cutting line's corners
 * too many tiny edges to clean up.
 */
function simplify(pts: P[], tol = 0.001): P[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const ab = sub(b, a);
  const l = len(ab) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(ab.x * (pts[i].y - a.y) - ab.y * (pts[i].x - a.x)) / l;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

function inside(q: P, poly: P[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Square to `dir`, pointing into the piece at `q`. */
function inward(pc: Piece, q: P, dir: P): P {
  const n = p(-dir.y, dir.x);
  return inside(add(q, mul(n, 0.5)), ringOf(pc, 16).pts) ? n : mul(n, -1);
}

/** Square to the chord of a run of seam points, pointing into the piece (judged on the seam itself,
 * at its middle, since a curved seam's chord can lie well inside the piece). */
function inwardOf(pc: Piece, run: P[]): P {
  const k = Math.max(1, Math.floor(run.length / 2));
  const local = inward(pc, run[k - 1], unit(sub(run[k], run[k - 1])));
  const chord = unit(sub(run[run.length - 1], run[0]));
  const n = p(-chord.y, chord.x);
  return n.x * local.x + n.y * local.y >= 0 ? n : mul(n, -1);
}

/** A point `d` cm along a seam, and which way is out across it (into the seam allowance). */
export function seamPoint(pc: Piece, tag: string, d: number): { q: P; out: P } | undefined {
  const r = ringOf(pc);
  const s = runStart(r, tag);
  const at = s < 0 ? undefined : walk(r, s, d, tag);
  if (!at) return undefined;
  const dir = unit(sub(r.pts[(at.i + 1) % r.pts.length], r.pts[at.i]));
  return { q: at.q, out: mul(inward(pc, at.q, dir), -1) };
}

/** The piece with notches across a seam at each distance along it, and a word beside them. */
export function markSeam(pc: Piece, tag: string, at: number[], text: string): Piece {
  const marks = at.map((d) => seamPoint(pc, tag, d)).filter((m): m is { q: P; out: P } => !!m);
  if (!marks.length) return pc;
  const mid = mul(add(marks[0].q, marks[marks.length - 1].q), 0.5);
  const into = mul(marks[0].out, -1);
  return {
    ...pc,
    notches: [...pc.notches, ...marks.map((m): [P, P] => [m.q, m.out])],
    labels: [...pc.labels, { at: add(mid, mul(into, 1.6)), text, size: 0.6, rotate: rotationAlong(sub(marks[marks.length - 1].q, marks[0].q)) }],
  };
}

/** Degrees for a label that runs along `v`, kept the right way up. */
function rotationAlong(v: P): number {
  let r = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  if (r > 90) r -= 180;
  if (r <= -90) r += 180;
  return r;
}

/** The garment piece's grain direction, so a pocket piece is cut on the same grain. */
const grainOf = (pc: Piece) => (pc.grain ? unit(sub(pc.grain[1], pc.grain[0])) : p(0, 1));

/** A pocket piece's markings: grain arrow, name and cutting, placed round a point inside it. */
function marked(name: string, cut: string, centre: P, grain: P, extra: Partial<Piece> & Pick<Piece, 'outline' | 'meta'>, sa: number): Piece {
  const gl = 6;
  return {
    name,
    kind: 'pocket',
    lines: [],
    grain: [add(centre, mul(grain, 2.2)), add(centre, mul(grain, 2.2 + gl))],
    notches: [],
    labels: [
      { at: add(centre, mul(grain, -2)), text: name.toUpperCase(), size: 1.0 },
      { at: add(centre, mul(grain, -0.6)), text: cut, size: 0.6 },
    ],
    cut,
    seamAllowance: sa,
    // The bag's own edges are sewn 1 cm in; where it joins the garment it keeps the garment's allowance.
    allowances: { bag: 1 },
    ...extra,
  };
}

interface InseamOpts {
  /** The seam the pocket hangs in. */
  tag?: string;
  /** Kept clear above the end of the seam (the hem allowance and a little more). */
  hemRoom?: number;
  cut?: string;
  name?: string;
}

/**
 * An in-seam pocket bag, drafted on a garment piece's side seam so its straight edge follows the seam
 * exactly. Returns the bag and the opening (cm down the seam) to notch on the garment, or nothing when
 * the seam is too short for a hand-sized opening.
 */
export function inseamPocket(garment: Piece, opts: InseamOpts = {}): { bag: Piece; opening: [number, number] } | undefined {
  const tag = opts.tag ?? 'side';
  const S = taggedLength(garment.outline, tag);
  const top = INSEAM.top;
  const from = top - INSEAM.above;
  let o1 = top + INSEAM.opening;
  let depth = INSEAM.depth;
  // A short skirt shortens the bag first, then the opening.
  const avail = S - (opts.hemRoom ?? 8) - from;
  const need = () => o1 + INSEAM.below + depth - from;
  if (need() > avail) depth = Math.max(5, depth - (need() - avail));
  if (need() > avail) o1 -= need() - avail;
  if (o1 - top < 10) return undefined;
  const to = o1 + INSEAM.below;
  const seam = seamSlice(garment, tag, from, to);
  if (!seam || seam.length < 2) return undefined;

  // Drawn square off the seam's chord, into the garment: a mitten with its thumb on the seam.
  const T = seam[0];
  const S1 = seam[seam.length - 1];
  const down = unit(sub(S1, T));
  const across = inwardOf(garment, seam);
  const L = len(sub(S1, T));
  const D = L + depth;
  const w = INSEAM.width;
  const at = (a: number, b: number) => add(T, add(mul(across, a), mul(down, b)));
  const outline = new Path(T);
  seam.slice(1).forEach((q) => outline.line(q, 'pocket-side'));
  outline
    .curve(at(0, L + depth * 0.65), at(w * 0.15, D), at(w * 0.5, D), 'bag')
    .curve(at(w * 0.85, D), at(w, D - 2), at(w, D - Math.min(7, depth)), 'bag')
    .line(at(w, 3), 'bag')
    .curve(at(w, 1), at(w - 1, 0), at(w - 3, 0), 'bag')
    .line(T, 'bag');
  outline.closed = true;

  const cut = opts.cut ?? 'Cut 4 (2 pairs)';
  const name = opts.name ?? 'Pocket bag';
  const bag = marked(name, cut, at(w * 0.5, L * 0.55), grainOf(garment), { outline, meta: { seamOf: garment.name, seam: tag, from, to } }, garment.seamAllowance);
  return { bag: markSeam(bag, 'pocket-side', [top - from, o1 - from], 'POCKET'), opening: [top, o1] };
}

interface SlantPocket {
  /** The garment front with the opening cut away. */
  front: Piece;
  /** Sewn to the opening and turned behind it. */
  lining: Piece;
  /** Fills in the cut-away corner and forms the back of the bag; it is part of the front's waist and side seam. */
  facing: Piece;
}

/**
 * A slant pocket cut into a front whose outline runs along its waist and then down its side seam
 * (the side waist is where the two meet). Undefined when the waist has a dart too close to the side.
 */
export function slantPocket(front: Piece, opts: Partial<typeof SLANT> = {}): SlantPocket | undefined {
  const o = { ...SLANT, ...opts };
  // Sampled as finely as the seam checks read it, so the facing meets the waist at the front's own angle.
  const r = ringOf(front, 256);
  const n = r.pts.length;
  const side = runStart(r, 'side');
  if (side < 0 || r.tags[(side - 1 + n) % n] !== 'waist') return undefined;
  const sw = r.pts[side];
  // Along the waist back from the side, along the side seam down from the waist.
  const A = walk(r, (side - 1 + n) % n, o.in, 'waist', -1);
  let run = 0;
  for (let i = (side - 1 + n) % n; r.tags[i] === 'waist'; i = (i - 1 + n) % n) run += len(sub(r.pts[(i + 1) % n], r.pts[i]));
  const inner = walk(r, (side - 1 + n) % n, Math.min(o.in + o.along, run - 0.5), 'waist', -1);
  const B = walk(r, side, o.down, 'side');
  const Dside = walk(r, side, o.down + o.depth, 'side');
  if (!A || !inner || !B || !Dside || run - 0.5 < o.in + 1.5) return undefined;

  // The front: waist to the opening, the slant, then on down the side seam from its foot.
  const fr = new Path(r.pts[0]);
  for (let i = 0; i < A.i; i++) fr.line(r.pts[i + 1], r.tags[i]);
  fr.line(A.q, 'waist').line(B.q, 'pocket-edge');
  for (let i = B.i; i < n; i++) fr.line(r.pts[(i + 1) % n], r.tags[i]);
  fr.closed = true;

  // The bag below the opening, square off the side seam's chord.
  const down = unit(sub(Dside.q, sw));
  const across = inwardOf(front, between(r, { i: side, q: sw }, Dside));
  const D = len(sub(Dside.q, sw));
  const local = (q: P) => (q.x - sw.x) * across.x + (q.y - sw.y) * across.y;
  const W = Math.max(o.width, local(inner.q) + 2);
  const at = (a: number, b: number) => add(sw, add(mul(across, a), mul(down, b)));
  const bag = (path: Path) =>
    path
      .curve(at(0, D + 1), at(W * 0.25, D + 2.5), at(W * 0.55, D + 2.2), 'bag')
      .curve(at(W * 0.85, D + 2), at(W, D), at(W, D - 5), 'bag')
      .line(inner.q, 'bag');

  const sideBelow = simplify(between(r, B, Dside));
  // The lining's top runs along the waist under the front, so the waistband holds it.
  const topRun = simplify(between(r, inner, A));
  const lining = new Path(inner.q);
  topRun.slice(1).forEach((q) => lining.line(q, 'pocket-waist'));
  lining.line(B.q, 'pocket-edge');
  sideBelow.slice(1).forEach((q) => lining.line(q, 'pocket-side'));
  bag(lining).closed = true;

  const facing = new Path(inner.q);
  topRun.slice(1).forEach((q) => facing.line(q, 'pocket-waist'));
  simplify(between(r, A, { i: side, q: sw })).slice(1).forEach((q) => facing.line(q, 'waist'));
  simplify(between(r, { i: side, q: sw }, B)).slice(1).forEach((q) => facing.line(q, 'side'));
  sideBelow.slice(1).forEach((q) => facing.line(q, 'pocket-side'));
  bag(facing).closed = true;

  const g = grainOf(front);
  const centre = at(W * 0.55, D * 0.62);
  const meta = { seamOf: front.name, seam: 'side', from: 0, to: taggedSpan(sideBelow) };
  const sa = front.seamAllowance;
  const liningPc = marked('Pocket lining', 'Cut 2 (1 pair)', centre, g, { outline: lining, meta: { ...meta, opening: front.name } }, sa);
  const facingPc = marked('Pocket facing', 'Cut 2 (1 pair)', centre, g, { outline: facing, meta: { ...meta, partOf: front.name } }, sa);
  // The facing's notch where the opening ends, matched to the foot of the slant on the front.
  facingPc.notches.push([B.q, mul(across, -1)]);
  facingPc.labels.push({ at: at(2.4, o.down * 0.5), text: 'PLACE UNDER THE FRONT', size: 0.5, rotate: rotationAlong(down) });
  return {
    front: { ...front, outline: fr, notches: front.notches.filter(([q]) => q.y > B.q.y + 0.5 || local(q) > o.in + 0.5) },
    lining: liningPc,
    facing: facingPc,
  };
}

/** Length of a polyline. */
function taggedSpan(pts: P[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += len(sub(pts[i], pts[i - 1]));
  return t;
}

/** A seam's length on a piece, with the pieces cut away from it and sewn back on (a slant pocket's facing). */
export function withParts(pieces: Piece[], pc: Piece, tag: string): number {
  return taggedLength(pc.outline, tag) + pieces.filter((x) => x.meta.partOf === pc.name).reduce((t, x) => t + taggedLength(x.outline, tag), 0);
}

const cm = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} cm`;

/**
 * Pocket pieces walked against the garment: each bag's seam edge lies on the garment's seam between
 * its ends (so its notches meet the garment's), and a slant lining's opening edge is the front's.
 */
export function pocketChecks(pieces: Piece[]): { label: string; detail: string; ok: boolean }[] {
  const out: { label: string; detail: string; ok: boolean }[] = [];
  for (const pc of pieces.filter((x) => x.kind === 'pocket')) {
    const garment = pieces.find((x) => x.name === pc.meta.seamOf);
    if (!garment) continue;
    const want = seamSlice(garment, pc.meta.seam as string, pc.meta.from as number, pc.meta.to as number);
    const mine = seamSlice(pc, 'pocket-side', 0, taggedLength(pc.outline, 'pocket-side') - 1e-6);
    if (want && mine) {
      const a = taggedSpan(mine);
      const b = taggedSpan(want);
      const gap = Math.max(len(sub(mine[0], want[0])), len(sub(mine[mine.length - 1], want[want.length - 1])));
      out.push({
        label: `${pc.name} to the side seam`,
        detail: `${pc.name.toLowerCase()} ${cm(a)}, side seam ${cm(b)}, ends ${cm(gap)} apart`,
        ok: Math.abs(a - b) <= 0.1 && gap <= 0.1,
      });
    }
    if (pc.meta.opening) {
      const a = taggedLength(pc.outline, 'pocket-edge');
      const b = taggedLength(garment.outline, 'pocket-edge');
      out.push({ label: `${pc.name} to the pocket opening`, detail: `lining ${cm(a)}, opening ${cm(b)}`, ok: Math.abs(a - b) <= 0.1 });
    }
  }
  return out;
}
