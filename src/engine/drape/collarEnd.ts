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
  const f = Math.min(1, Math.max(0, (len - best.s) / (len * 0.35)));
  return { at, w: f * f * (3 - 2 * f) };
}
