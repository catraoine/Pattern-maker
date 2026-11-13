import { knob } from './knob';

/** The few things the gathers need of a sewn panel. */
interface TierPanel {
  base: number;
  hidden?: boolean;
  mesh: { pts: { x: number; y: number }[] };
  pc: { meta: Record<string, unknown> };
}

/**
 * Gathered tiers: the fullness laid on as even folds, after the smoothing passes that run each fold's crest straight
 * (those pressed a tiered skirt nearly flat, so its tiers read as plain bands, Cat Nov 12: "Deeper gather").
 *
 * Each point is pushed out by a wave round the body, by how far round it lies (0 at the centre front, pi at the centre
 * back), the same for every tier. So two points sewn together, wherever they are, move alike and the seams stay closed,
 * and the folds meet at every seam as gathers do. The wave is even about the centre front and back (a cosine), so the
 * mirrored half carries on smoothly across the centre line, and front and back meet at the side. It fades in just
 * below the yoke, which isn't gathered.
 */
export function layTierGathers(panels: TierPanel[], res: Float64Array, bodyR: (a: number, c: number) => number): void {
  const tiers = panels.filter((p) => !p.hidden && p.pc.meta.tier);
  if (!tiers.length) return;
  const ids = tiers.flatMap((p) => p.mesh.pts.map((_, i) => p.base + i));
  const top = Math.min(...ids.map((g) => res[g * 3 + 1]));
  // How many folds round the body: about one every 10 cm round the top of the first tier.
  const ring = ids.filter((g) => res[g * 3 + 1] < top + 1);
  const r0 = ring.length ? ring.reduce((t, g) => t + Math.hypot(res[g * 3], res[g * 3 + 2]), 0) / ring.length : 20;
  const n = Math.max(8, Math.round((2 * Math.PI * r0) / (knob('__gatherLam') ?? 10)));
  const A = knob('__gatherA') ?? 1.5;
  const fadeIn = knob('__gatherFade') ?? 4;
  for (const g of ids) {
    const I = g * 3;
    const c = res[I + 1];
    const x = res[I];
    const z = res[I + 2];
    const rho = Math.hypot(x, z);
    if (rho < 1e-6) continue;
    const a = Math.atan2(Math.abs(x), z);
    const amp = A * Math.min(1, (c - top) / fadeIn);
    // (Never in through the body: a fold's trough stops on it.)
    const want = Math.max(rho + amp * Math.cos(n * a), bodyR(Math.atan2(x, z), c) + 0.3);
    const k = want / rho;
    res[I] *= k;
    res[I + 2] *= k;
  }
}
