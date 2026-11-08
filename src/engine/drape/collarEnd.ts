// A high lapel's long collar end (Cat's SS27 vest, 2026-11-07): its collar is the big piece, its end reaching down past
// the gorge to a point over the lapel and on past it onto the chest. Laid as an ordinary collar is, each point of its
// fall going straight in from the neck seam, that end bowed in towards the neck and narrowed to a spike. A pattern
// cutter draws such a collar on the front, beside the lapel as cut, and turns it back over the roll line with the lapel
// to see it worn; this does the same, so the drawing lays it where it falls.
type P = { x: number; y: number };

/** How the collar's front end is carried onto the front's pattern: the collar's neck edge (centre back to the gorge)
 *  and the front's neck seam (gorge to neck point), its gorge, the line from the neck point to the gorge, the side the
 *  collar was drawn on, and the lapel's roll line. */
export interface CollarOnFront {
  neckC: P[];
  neckF: P[];
  Q: P;
  d1: P;
  nF: P;
  roll: [P, P];
}

const rot = (v: P): P => ({ x: v.y, y: -v.x });
const unit = (v: P): P => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** Where a point of the collar's fall lies when worn, on the front's pattern (a point there, past the lapel or under
 *  it), and how much that counts against the collar's ordinary placement: fully at the gorge and past it, fading out
 *  towards the neck point, where the collar turns round the neck as any collar does. */
export function collarOnFront(q: P, o: CollarOnFront): { at: P; w: number } {
  // The collar's neck edge measured back from the gorge end: the nearest place on it, how far back, and how far off.
  const C = o.neckC;
  let best = { d: Infinity, s: 0, foot: C[C.length - 1], t: unit({ x: C[C.length - 1].x - C[C.length - 2].x, y: C[C.length - 1].y - C[C.length - 2].y }) };
  let arc = 0;
  for (let k = C.length - 1; k > 0; k--) {
    const a = C[k];
    const b = C[k - 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
    // (Running towards the gorge end, as the collar's own frame does.)
    const t = { x: (a.x - b.x) / L, y: (a.y - b.y) / L };
    let u = ((q.x - a.x) * -t.x + (q.y - a.y) * -t.y) / L;
    // (Past the gorge end, carried straight on.)
    if (k < C.length - 1 || u > 0) u = Math.min(1, Math.max(0, u));
    const foot = { x: a.x - t.x * u * L, y: a.y - t.y * u * L };
    const d = Math.hypot(q.x - foot.x, q.y - foot.y);
    if (d < best.d) best = { d, s: arc + u * L, foot, t };
    arc += L;
  }
  const h = (q.x - best.foot.x) * rot(best.t).x + (q.y - best.foot.y) * rot(best.t).y;
  // The same place on the front's neck seam, the collar drawn off it on the side it was cut.
  const F = o.neckF;
  const sign = Math.sign(o.nF.x * rot(o.d1).x + o.nF.y * rot(o.d1).y) || 1;
  let at = { x: o.Q.x + o.d1.x * -best.s, y: o.Q.y + o.d1.y * -best.s };
  let tf = o.d1;
  let left = best.s;
  for (let k = 0; k < F.length - 1 && left > 0; k++) {
    const L = Math.hypot(F[k + 1].x - F[k].x, F[k + 1].y - F[k].y) || 1e-9;
    const u = Math.min(1, left / L);
    tf = { x: (F[k].x - F[k + 1].x) / L, y: (F[k].y - F[k + 1].y) / L };
    at = { x: F[k].x + (F[k + 1].x - F[k].x) * u, y: F[k].y + (F[k + 1].y - F[k].y) * u };
    left -= L;
  }
  const n = rot(tf);
  at = { x: at.x + sign * n.x * h, y: at.y + sign * n.y * h };
  // Turned back over the roll line with the lapel.
  const [r0, r1] = o.roll;
  const ru = unit({ x: r1.x - r0.x, y: r1.y - r0.y });
  const v = { x: at.x - r0.x, y: at.y - r0.y };
  const al = v.x * ru.x + v.y * ru.y;
  at = { x: r0.x + 2 * al * ru.x - v.x, y: r0.y + 2 * al * ru.y - v.y };
  let len = 0;
  for (let k = 0; k < F.length - 1; k++) len += Math.hypot(F[k + 1].x - F[k].x, F[k + 1].y - F[k].y);
  const f = Math.min(1, Math.max(0, (len * 1.1 - best.s) / (len * 0.25)));
  return { at, w: f * f * (3 - 2 * f) };
}

type Cloth = { base: number; mesh: { pts: P[]; tris: [number, number, number][]; runs: Record<string, number[][]> }; turned: boolean[] };

/** The collar's outer edge, laid as above, follows the chest's own curve and wanders; pressed, a stiff collar's edge
 *  runs dead straight from where it leaves the shoulder to its point (Cat: "this should be straight", 2026-11-07). Each
 *  point of that edge goes onto the straight line between the two, seen from the front, the fall inside it following
 *  in part. Moves `res`; returns the edge points it placed. */
export function straightenCollarEdge(collar: Cloth, o: CollarOnFront, res: Float64Array | number[], lower = false): number[] {
  const pts = collar.mesh.pts;
  const run = (collar.mesh.runs.collar ?? []).flat();
  if (run.length < 4) return [];
  // The point: the edge's farthest out along the collar. The outer edge runs from it back towards centre back.
  let c = 0;
  for (let k = 1; k < run.length; k++) if (pts[run[k]].x > pts[run[c]].x) c = k;
  const dir = c + 1 < run.length && pts[run[c + 1]].y < pts[run[c]].y ? 1 : -1;
  const edge: number[] = [];
  for (let k = c; k >= 0 && k < run.length; k += dir) edge.push(run[k]);
  const w = edge.map((i) => collarOnFront(pts[i], o).w);
  let a = 0;
  while (a + 1 < edge.length && w[a + 1] > 0.99) a++;
  if (a < 2) return [];
  const X = (i: number) => (collar.base + i) * 3;
  const A = [res[X(edge[a])], res[X(edge[a]) + 1]];
  const C = [res[X(edge[0])], res[X(edge[0]) + 1]];
  const L = Math.hypot(A[0] - C[0], A[1] - C[1]) || 1;
  const u = [(A[0] - C[0]) / L, (A[1] - C[1]) / L];
  // Each edge point's move onto the line (fading out past the shoulder end).
  const moves: { q: P; d: [number, number] }[] = [];
  // (Spaced along the line as they were along the edge, so no stretch of it is pulled longer than it was cut.)
  const arc = [0];
  for (let k = 1; k <= a; k++) arc.push(arc[k - 1] + Math.hypot(res[X(edge[k])] - res[X(edge[k - 1])], res[X(edge[k]) + 1] - res[X(edge[k - 1]) + 1]));
  const scale = arc[a] > 0 ? L / arc[a] : 1;
  edge.forEach((i, k) => {
    const I = X(i);
    const v = [res[I] - C[0], res[I + 1] - C[1]];
    const t = k <= a ? arc[k] * scale : Math.min(L, Math.max(0, v[0] * u[0] + v[1] * u[1]));
    const f = k <= a ? 1 : Math.max(0, 1 - (k - a) / 4);
    if (f <= 0) return;
    moves.push({ q: pts[i], d: [(C[0] + u[0] * t - res[I]) * f, (C[1] + u[1] * t - res[I + 1]) * f] });
  });
  // The end's lower edge, from the point back to the notch, put on a straight line too (Cat's red line, 2026-11-07):
  // its notch end stays where it is sewn. Only in a crisp cloth: a soft one's short end edge stretched pulled straight.
  const low: number[] = [];
  const lowMoves: { I: number; d: [number, number] }[] = [];
  for (let k = c; k >= 0 && k < run.length; k -= dir) low.push(run[k]);
  if (lower && low.length > 2) {
    const N = [res[X(low[low.length - 1])], res[X(low[low.length - 1]) + 1]];
    const arcL = [0];
    for (let k = 1; k < low.length; k++) arcL.push(arcL[k - 1] + Math.hypot(res[X(low[k])] - res[X(low[k - 1])], res[X(low[k]) + 1] - res[X(low[k - 1]) + 1]));
    const LN = Math.hypot(N[0] - C[0], N[1] - C[1]) || 1;
    const sc = arcL[arcL.length - 1] > 0 ? LN / arcL[arcL.length - 1] : 1;
    const v = [(N[0] - C[0]) / LN, (N[1] - C[1]) / LN];
    low.forEach((i, k) => {
      if (k === 0 || k === low.length - 1) return;
      const I = X(i);
      const t = arcL[k] * sc;
      lowMoves.push({ I, d: [C[0] + v[0] * t - res[I], C[1] + v[1] * t - res[I + 1]] });
    });
  }
  const neck = [...(collar.mesh.runs.neck ?? []), ...(collar.mesh.runs.gorge ?? [])].flat();
  // The fall inside follows its nearest stretch of edge, less the further in it is, so it doesn't fold at the edge.
  const R = 2.5;
  pts.forEach((q, i) => {
    if (!collar.turned[i]) return;
    let s = 0;
    let dx = 0;
    let dy = 0;
    let best = Infinity;
    for (const m of moves) {
      const d = Math.hypot(m.q.x - q.x, m.q.y - q.y);
      best = Math.min(best, d);
      const g = Math.exp(-(d * d) / 0.5);
      s += g;
      dx += m.d[0] * g;
      dy += m.d[1] * g;
    }
    if (!s || best > 2 * R) return;
    // (Nor near its seams to the neck and the gorge: moved there, the cloth sewn to them stretched.)
    let dn = Infinity;
    for (const j of neck) dn = Math.min(dn, Math.hypot(pts[j].x - q.x, pts[j].y - q.y));
    const f = Math.max(0, 1 - best / (2 * R)) * Math.min(1, Math.max(0, (dn - 3) / 3));
    const I = X(i);
    // (Moved only across the view, a centimetre or so: how far out it lies stays as laid. Fitting it to the front's
    // depth at its new place stretched it where that depth jumps from the lapel to the chest.)
    res[I] += (dx / s) * f;
    res[I + 1] += (dy / s) * f;
  });
  // (The lower edge lies all close to the gorge seam, where the fall's easing fades out, so its points are put on
  // their line outright.)
  for (const m of lowMoves) {
    res[m.I] += m.d[0];
    res[m.I + 1] += m.d[1];
  }
  // (The edge points it put on the line, for the caller to hold while the cloth inside eases back to its cut. The lower
  // edge is left to ease with it: held too, a thick leather collar's short end was stretched there, 2026-11-07.)
  return edge.slice(0, a + 1);
}
