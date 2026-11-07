// A skirt cut with a level hem is drawn with a level hem (All round quality, 2026-11-07). A circle, half-circle or long
// full skirt drops where its cloth hangs on the bias, and the settled drawing hung 5 to 8 cm lower there than at the
// straight grain: the hem check turned those designs back to the Front drawing. A dressmaker lets such a skirt hang,
// then marks the hem level from the floor and trims it; the drawing does the same: each point of the lowest hem is
// brought to the hem's middle level, and the cloth above eased with it over a hand's span or two.
import type { Draped } from './garment';

const EASE = 25;

export function levelSkirtHem(out: Draped): void {
  const panels = out.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && p.mesh.runs.hem?.length);
  const hemOf = (p: (typeof panels)[number]) => (p.mesh.runs.hem ?? []).flat();
  const means = panels.map((p) => {
    const h = hemOf(p).map((i) => out.pos[(p.base + i) * 3 + 1]);
    return h.reduce((a, b) => a + b, 0) / h.length;
  });
  if (!means.length) return;
  // (Only the lowest hem: a tiered skirt's upper tiers have hems of their own, as the hem check takes it.)
  const low = Math.max(...means);
  const lowest = panels.filter((_, k) => means[k] > low - 8);
  const ys = lowest.flatMap((p) => hemOf(p).map((i) => out.pos[(p.base + i) * 3 + 1])).sort((a, b) => a - b);
  const level = ys[Math.floor(ys.length / 2)];
  const dy = new Float64Array(out.pos.length / 3);
  let any = false;
  for (const p of lowest) {
    const pts = p.mesh.pts;
    const hem = hemOf(p);
    const off = hem.map((i) => out.pos[(p.base + i) * 3 + 1] - level);
    if (!off.some((v) => Math.abs(v) > 0.5)) continue;
    any = true;
    pts.forEach((q, i) => {
      let best = -1;
      let bd = Infinity;
      hem.forEach((h, k) => {
        const d = Math.hypot(q.x - pts[h].x, q.y - pts[h].y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      const w = Math.max(0, 1 - bd / EASE);
      dy[p.base + i] = off[best] * w * w;
    });
  }
  if (!any) return;
  // Two pieces sewn together move alike at their seam, or the seam opens where one moved more than the other.
  for (let pass = 0; pass < 2; pass++)
    for (const s of out.seams ?? []) {
      const other = dy[s.j] * (1 - s.t) + dy[s.k] * s.t;
      const m = (dy[s.i] + other) / 2;
      dy[s.i] = m;
      dy[s.j] += m - other;
      dy[s.k] += m - other;
    }
  for (const a of [out.pos, ...(out.posMirror ? [out.posMirror] : [])]) dy.forEach((v, i) => (a[i * 3 + 1] -= v));
}
