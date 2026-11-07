// A balloon peplum's hem, its fuller outer gathered onto the underskirt's hem: seated on it point by point (seatOn),
// it was still left 1.4 to 1.6 cm off it round the side seams, where the hem's corner points belong to the side seams
// as well and are held where those are sewn (All round, 2026-11-07: the balloon peplum in wool showed as its flat
// drawing, "the peplum's seams open up as it turns"). Each point the outer and the underskirt are sewn together at, on
// either piece, is drawn a share of the way to where it is sewn on the other, a few times over, so they meet as one seam.
import type { Panel } from './garment';

type Seam = { i: number; j: number; k: number; t: number };

export function closeBalloonHem(res: Float64Array, seams: readonly Seam[], outer: Panel[], under: Panel[]): void {
  const ids = (ps: Panel[]) => new Set(ps.flatMap((p) => p.mesh.pts.map((_, i) => p.base + i)));
  const o = ids(outer);
  const u = ids(under);
  const joined = seams.filter((s) => (o.has(s.i) && u.has(s.j) && u.has(s.k)) || (u.has(s.i) && o.has(s.j) && o.has(s.k)));
  for (let it = 0; it < 6; it++)
    for (const { i, j, k, t } of joined)
      for (let d = 0; d < 3; d++) res[i * 3 + d] += (res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t - res[i * 3 + d]) * 0.5;
}
