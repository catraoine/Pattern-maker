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
  // How many folds round the body: about one every 6 cm round the top of the first tier.
  const ring = ids.filter((g) => res[g * 3 + 1] < top + 1);
  const r0 = ring.length ? ring.reduce((t, g) => t + Math.hypot(res[g * 3], res[g * 3 + 2]), 0) / ring.length : 20;
  const n = Math.max(8, Math.round((2 * Math.PI * r0) / (knob('__gatherLam') ?? 6)));
  const A = knob('__gatherA') ?? 1.3;
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

/**
 * How deep folds of this width must be for a length of cloth `spare` times the arc it is sewn along to lie in them:
 * the wave's own length matched to the cloth's, so the tier starts with all its fullness in folds rather than squeezed
 * flat, which crumpled it into sharp creases under its seam once its mesh was fine enough to hold tight gathers.
 */
export function foldDepth(spare: number, lam: number, cap: number): number {
  if (spare <= 1) return 0;
  const k = (2 * Math.PI) / lam;
  // The length of one wave r = A sin(k s), over its width, by a few steps of the integral.
  const ratio = (A: number) => {
    let t = 0;
    const n = 24;
    for (let i = 0; i < n; i++) t += Math.sqrt(1 + (A * k * Math.cos(((i + 0.5) / n) * 2 * Math.PI)) ** 2);
    return t / n;
  };
  let lo = 0;
  let hi = cap;
  if (ratio(hi) <= spare) return cap;
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2;
    if (ratio(mid) < spare) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
