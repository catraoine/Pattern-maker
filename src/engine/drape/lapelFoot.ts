// The foot of a lapel: its lowest few cm, just above the break.
import type { Panel } from './garment';

type P = { x: number; y: number };

/** A lapel's foot, folded right back onto the front. Toward the break the lapel narrows to nothing, and its last
 *  points, a few mm of cloth past the roll line, were left lying nearly as cut: past the fold instead of back over it.
 *  They stuck out beyond the front's edge just above the break as a pale sliver (Cat, Nov 10: keep working on the
 *  non-perfect bits). Each turned point within `reach` cm of the break, measured up the roll line, goes to the spot
 *  of the front it folds onto (its place as cut, turned over the roll line), a layer out: wholly so at the break,
 *  easing off to where it settled by `reach`. `roll` is the roll line as cut, from the break up. Moves `pos`. */
export function layLapelFoot(panels: Panel[], pos: Float64Array | number[], roll: [P, P], reach = 8, out = 0.6): void {
  const [a, b] = roll;
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dir = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  for (const p of panels) {
    if (p.hidden || p.role !== 'front' || !p.turned.some((t) => t)) continue;
    const pts = p.mesh.pts;
    const I = (i: number) => (p.base + i) * 3;
    const body = p.mesh.tris.filter((t) => t.every((j) => !p.turned[j]));
    const spot = (x: number, y: number): [number, number, number] | undefined => {
      let best: { w: number[]; t: number[]; out: number } | undefined;
      for (const t of body) {
        const [u, v, w] = t.map((j) => pts[j]);
        const den = (v.y - w.y) * (u.x - w.x) + (w.x - v.x) * (u.y - w.y);
        if (Math.abs(den) < 1e-9) continue;
        const wu = ((v.y - w.y) * (x - w.x) + (w.x - v.x) * (y - w.y)) / den;
        const wv = ((w.y - u.y) * (x - w.x) + (u.x - w.x) * (y - w.y)) / den;
        const o = Math.max(0, -wu, -wv, wu + wv - 1);
        if (!best || o < best.out) best = { w: [wu, wv, 1 - wu - wv], t, out: o };
        if (o === 0) break;
      }
      // (Only a spot on the front's own cloth: none found within its triangles, the point is left where it settled.)
      if (!best || best.out > 0.5) return undefined;
      const w = best.w.map((v) => Math.max(0, v));
      const sum = w[0] + w[1] + w[2];
      return [0, 1, 2].map((d) => best.t.reduce((acc, j, k) => acc + (pos[I(j) + d] * w[k]) / sum, 0)) as [number, number, number];
    };
    pts.forEach((q, i) => {
      if (!p.turned[i]) return;
      const along = (q.x - a.x) * dir.x + (q.y - a.y) * dir.y;
      if (along > reach) return;
      const t = Math.max(0, along) / reach;
      const share = 1 - t * t * (3 - 2 * t);
      // (Its place turned over the roll line.)
      const off = (q.x - a.x) * -dir.y + (q.y - a.y) * dir.x;
      const m = spot(q.x + 2 * off * dir.y, q.y - 2 * off * dir.x);
      if (!m) return;
      const rho = Math.hypot(m[0], m[2]) || 1;
      const k = (rho + out) / rho;
      const to = [m[0] * k, m[1], m[2] * k];
      for (let d = 0; d < 3; d++) pos[I(i) + d] += (to[d] - pos[I(i) + d]) * share;
    });
  }
}
