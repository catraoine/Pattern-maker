// Where each tape lies on the 3D measuring form (measure3d.ts): cut from the form's own surface, as a tape held snug
// lies. A girth goes round the outside of the body's cross-section (its convex hull: a tape bridges every hollow). A
// length between two points lies in the plane through them that faces out, along the outside of the body's profile
// there (again bridging hollows). Each is cut over the tape's whole width, so no part of the body pokes through it.

export type V3 = [number, number, number];
/** A point the tape passes through, with the way its face looks (out from the body). */
export type TapePt = { p: V3; n: V3 };

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => scale(a, 1 / (Math.hypot(...a) || 1));

/** The fitted body: its points, triangles, and which triangles a cut may use. */
export interface Surface {
  pos: ArrayLike<number>;
  idx: ArrayLike<number>;
  /** How much each point moves with an arm (0 to 1). */
  arm: ArrayLike<number>;
}
/** Which triangles a cut uses: the body without its arms, one arm, or everything. */
export type Part = 'body' | 'armL' | 'armR' | 'all';

const P = (s: Surface, i: number): V3 => [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]];

function uses(s: Surface, part: Part, i0: number, i1: number, i2: number) {
  if (part === 'all') return true;
  const w = Math.max(s.arm[i0], s.arm[i1], s.arm[i2]);
  if (part === 'body') return w <= 0.3;
  const x = s.pos[i0 * 3] + s.pos[i1 * 3] + s.pos[i2 * 3];
  return Math.min(s.arm[i0], s.arm[i1], s.arm[i2]) >= 0.5 && (part === 'armL' ? x > 0 : x < 0);
}

/** Every point where the surface crosses the plane through o facing nrm. */
export function cut(s: Surface, o: V3, nrm: V3, part: Part): V3[] {
  const out: V3[] = [];
  const d = (i: number) => dot(sub(P(s, i), o), nrm);
  for (let t = 0; t < s.idx.length; t += 3) {
    const tri = [s.idx[t], s.idx[t + 1], s.idx[t + 2]];
    const ds = tri.map(d);
    if ((ds[0] > 0 && ds[1] > 0 && ds[2] > 0) || (ds[0] < 0 && ds[1] < 0 && ds[2] < 0)) continue;
    if (!uses(s, part, tri[0], tri[1], tri[2])) continue;
    for (let e = 0; e < 3; e++) {
      const [a, b] = [e, (e + 1) % 3];
      if ((ds[a] > 0) === (ds[b] > 0) || ds[a] === ds[b]) continue;
      const u = ds[a] / (ds[a] - ds[b]);
      const A = P(s, tri[a]), B = P(s, tri[b]);
      out.push(add(A, scale(sub(B, A), u)));
    }
  }
  return out;
}

/** The cut taken across the tape's whole width (a few planes either side of the middle one), each point brought
 *  back onto the middle plane. */
function band(s: Surface, o: V3, nrm: V3, part: Part, width: number) {
  const pts: V3[] = [];
  for (let k = -4; k <= 4; k++) {
    const off = (k / 4) * (width / 2 + 0.01);
    for (const q of cut(s, add(o, scale(nrm, off)), nrm, part)) pts.push(sub(q, scale(nrm, off)));
  }
  return pts;
}

type V2 = [number, number];
const cross2 = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** The convex hull, anticlockwise. */
function hull(pts: V2[]): V2[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo: V2[] = [], hi: V2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross2(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (hi.length >= 2 && cross2(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** A polyline evened out to a point every `step`. */
function even(line: V2[], step: number): V2[] {
  const out: V2[] = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = step - carry;
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
      t += step;
    }
    carry = L - (t - step);
  }
  const last = line[line.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.2) out.push(last);
  return out;
}

/** The plane's own axes: e1 and e2 across it. */
function axes(nrm: V3, hint: V3): [V3, V3] {
  const e1 = norm(sub(hint, scale(nrm, dot(hint, nrm))));
  return [e1, cross(nrm, e1)];
}

/** The tape lifted just off the body, with its face looking out from the hull at each point. */
function toTape(line: V2[], o: V3, e1: V3, e2: V3, outward: (q: V2, i: number) => V2, lift: number): TapePt[] {
  return line.map((q, i) => {
    const [nu, nv] = outward(q, i);
    const n = norm(add(scale(e1, nu), scale(e2, nv)));
    const p = add(add(o, add(scale(e1, q[0]), scale(e2, q[1]))), scale(n, lift));
    return { p, n };
  });
}

/** A girth: round the outside of the body's cross-section in the plane through o facing nrm, starting at the point
 *  furthest toward `zero` (where the tape's end is held) and going round toward `toward`, with `overlap` past the
 *  start. Only the cut points within `near` of o are used (one arm, not the body beside it). */
export function girthOn(s: Surface, o: V3, nrm: V3, part: Part, opts: { zero: V3; toward: V3; width: number; overlap: number; lift: number; near?: number; keep?: (q: V3) => boolean; step?: number }): TapePt[] {
  const [e1, e2] = axes(nrm, opts.zero);
  let pts = band(s, o, nrm, part, opts.width);
  if (opts.near) pts = pts.filter((q) => Math.hypot(...sub(q, o)) < opts.near!);
  if (opts.keep) pts = pts.filter(opts.keep);
  const flat: V2[] = pts.map((q) => [dot(sub(q, o), e1), dot(sub(q, o), e2)]);
  let h = hull(flat);
  // Anticlockwise in (e1, e2) runs from e1 toward e2; turn it the other way round if `toward` says so.
  if (dot(opts.toward, e2) < 0) h = h.reverse();
  // Start at the point furthest toward the zero (e1).
  let s0 = 0;
  for (let i = 1; i < h.length; i++) if (h[i][0] > h[s0][0]) s0 = i;
  const ring = h.slice(s0).concat(h.slice(0, s0 + 1));
  const line = even(ring, opts.step ?? 0.006);
  // On past the start, over the zero end, by the overlap.
  const ring0 = line.length;
  let run = 0;
  for (let i = 1; i < ring0 && run < opts.overlap; i++) {
    run += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    line.push(line[i]);
  }
  const c: V2 = [flat.reduce((a, q) => a + q[0], 0) / flat.length, flat.reduce((a, q) => a + q[1], 0) / flat.length];
  const n = line.length;
  return toTape(line, o, e1, e2, (q, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
    let t: V2 = [b[0] - a[0], b[1] - a[1]];
    if (!t[0] && !t[1]) t = [1, 0];
    let nn: V2 = [t[1], -t[0]];
    if (nn[0] * (q[0] - c[0]) + nn[1] * (q[1] - c[1]) < 0) nn = [-nn[0], -nn[1]];
    return nn;
  }, opts.lift).map((pt, i) => (i >= ring0 ? { ...pt, p: add(pt.p, scale(pt.n, 0.003)) } : pt));
}

/** A length from a to b, lying along the outside of the body in the plane through them that faces `out`: the outer
 *  hull of the body's profile between them, as a tape held snug at both ends. `reach` widens how far beyond a and b
 *  (along the line between them) the profile is read, for a tape that wraps round under a curve (the crotch). */
export function lengthOn(s: Surface, a: V3, b: V3, out: V3, part: Part, opts: { width: number; lift: number; reach?: number; step?: number }): TapePt[] {
  const ab = sub(b, a);
  const L = Math.hypot(...ab);
  const e1 = scale(ab, 1 / L);
  const nrm = norm(cross(e1, out));
  const e2 = cross(nrm, e1);
  const r = opts.reach ?? 0;
  const pts: V2[] = band(s, a, nrm, part, opts.width)
    .map((q): V2 => [dot(sub(q, a), e1), dot(sub(q, a), e2)])
    .filter((q) => q[0] >= -r && q[0] <= L + r && q[1] >= -0.02);
  pts.push([0, 0], [L, 0]);
  const h = hull(pts);
  // From a to b the long way round: the side of the hull away from the straight line between them. Where the body
  // stands out past a or b (a tummy past the front waist), the hull's nearest corner stands in for it.
  const nearest = (u: number) => h.reduce((bi, q, i) => (Math.hypot(q[0] - u, q[1]) < Math.hypot(h[bi][0] - u, h[bi][1]) ? i : bi), 0);
  const ia = nearest(0);
  const ib = nearest(L);
  const fwd: V2[] = [];
  for (let i = ia; ; i = (i + 1) % h.length) {
    fwd.push(h[i]);
    if (i === ib) break;
  }
  const back: V2[] = [];
  for (let i = ia; ; i = (i - 1 + h.length) % h.length) {
    back.push(h[i]);
    if (i === ib) break;
  }
  const bulge = (c: V2[]) => c.reduce((m, q) => Math.max(m, q[1]), 0);
  // Nothing stands out between them (a hollow, as between the bust points): straight across.
  const chain = Math.max(bulge(fwd), bulge(back)) < 0.004 ? [[0, 0] as V2, [L, 0] as V2] : bulge(fwd) >= bulge(back) ? fwd : back;
  if (chain[0][0] !== 0 || chain[0][1] !== 0) chain.unshift([0, 0]);
  if (chain[chain.length - 1][0] !== L || chain[chain.length - 1][1] !== 0) chain.push([L, 0]);
  const line = even(chain, opts.step ?? 0.006);
  const n = line.length;
  return toTape(line, a, e1, e2, (q, i) => {
    const p0 = line[Math.max(0, i - 1)], p1 = line[Math.min(n - 1, i + 1)];
    const t: V2 = [p1[0] - p0[0], p1[1] - p0[1]];
    let nn: V2 = [-t[1], t[0]];
    if (nn[1] < 0 || (nn[1] === 0 && q[1] < 0)) nn = [-nn[0], -nn[1]];
    return nn;
  }, opts.lift);
}

/** The first point of the surface hit going from `from` along `dir`. */
export function hit(s: Surface, from: V3, dir: V3, part: Part = 'all'): V3 | undefined {
  let best = Infinity;
  const d = norm(dir);
  for (let t = 0; t < s.idx.length; t += 3) {
    const [i0, i1, i2] = [s.idx[t], s.idx[t + 1], s.idx[t + 2]];
    if (!uses(s, part, i0, i1, i2)) continue;
    const A = P(s, i0), B = P(s, i1), C = P(s, i2);
    const e1 = sub(B, A), e2 = sub(C, A);
    const h = cross(d, e2);
    const det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, sv = sub(from, A);
    const u = f * dot(sv, h);
    if (u < 0 || u > 1) continue;
    const q = cross(sv, e1);
    const v = f * dot(d, q);
    if (v < 0 || u + v > 1) continue;
    const k = f * dot(e2, q);
    if (k > 1e-6 && k < best) best = k;
  }
  return best < Infinity ? add(from, scale(d, best)) : undefined;
}

/** One tape after another, joined end to end. */
export function join(...parts: TapePt[][]): TapePt[] {
  return parts.reduce((all, p) => all.concat(all.length ? p.slice(1) : p), [] as TapePt[]);
}
