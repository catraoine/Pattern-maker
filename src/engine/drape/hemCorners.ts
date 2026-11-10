import type { Panel } from './garment';

/** A skirt's side seams meet at the hem: where a shaped hem (a high-low, a diagonal) leaves the front's hem corner
 *  hanging a centimetre or two from the back's, the two are brought together, each half way, and the cloth above
 *  each eased with it over the last few centimetres, so the seam runs closed to its foot (All round quality,
 *  2026-11-07: the high-low circle skirt's side seams stood 2 cm open at the hem). */
export function closeHemCorners(panels: Panel[], seams: { i: number; j: number; k: number; t: number }[], pos: Float64Array, reach = 8, ease = 6): void {
  const owner = (g: number) => panels.find((p) => g >= p.base && g < p.base + p.mesh.pts.length);
  // Each side seam's points within `reach` cm of its hem corner, and how near the corner each is.
  const near = new Map<number, number>();
  for (const p of panels) {
    // (Not a skirt sewn whole, a diagonal's (wholeSkirt.ts): its side seams are each sewn to their own side, and drawn
    // together here they pulled a trumpet's seams 3 cm open further up, Nov 10.)
    if (!/peplum/.test(p.role) || p.hidden || p.pc.meta.sewWhole) continue;
    const hem = new Set((p.mesh.runs.hem ?? []).flat());
    const side = (p.mesh.runs.side ?? []).flat();
    for (const c of side.filter((i) => hem.has(i))) {
      const cq = p.mesh.pts[c];
      for (const i of side) {
        const d = Math.hypot(p.mesh.pts[i].x - cq.x, p.mesh.pts[i].y - cq.y);
        if (d < reach) near.set(p.base + i, Math.min(near.get(p.base + i) ?? Infinity, d));
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const moves = new Map<number, [number, number, number]>();
    for (const { i, j, k, t } of seams) {
      if (!near.has(i) || owner(j) === owner(i)) continue;
      const to = [0, 1, 2].map((d) => pos[j * 3 + d] * (1 - t) + pos[k * 3 + d] * t);
      moves.set(i, [0, 1, 2].map((d) => (to[d] - pos[i * 3 + d]) / 2) as [number, number, number]);
    }
    for (const [g, mv] of moves) {
      const p = owner(g)!;
      const c = p.mesh.pts[g - p.base];
      // (The cloth beside the seam eased with it, less further in; each point takes the nearest seam point's move.)
      p.mesh.pts.forEach((q, n) => {
        const d = Math.hypot(q.x - c.x, q.y - c.y);
        if (d >= ease) return;
        const w = (1 - d / ease) ** 2 * (n + p.base === g ? 1 : 0.5);
        for (let a = 0; a < 3; a++) pos[(p.base + n) * 3 + a] += mv[a] * w;
      });
    }
  }
}
