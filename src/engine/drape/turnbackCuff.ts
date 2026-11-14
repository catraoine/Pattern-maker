// A turned-back cuff on the sleeve's hem, for the drape (garment.ts): kept in its own file, as new garment logic is.
import type { P } from '../geometry';

const TAU = Math.PI * 2;
type V3 = [number, number, number];

/** One sleeve as it hung: where its points start in the result, its flat points, and which of them are its hem. */
interface HungSleeve {
  base: number;
  pts: P[];
  hem: number[];
}

/** A turned-back cuff, laid round the sleeve after it has hung. The strip is folded in half along its length, sewn
 *  by its raw edges inside the sleeve's hem and turned out and up over the sleeve, so from outside it is a band from
 *  the hem up to the fold, a little proud of the sleeve. Left out of the drawing, the sleeve read as a plain one and
 *  the option's detail was lost (bug hunt, Nov 14). The strip is cut with x across its folded depth and y round. */
export function layTurnbackCuff(arm: { a: V3; b: V3 }, res: Float64Array, sleeves: HungSleeve[], strip: { base: number; pts: P[] }): void {
  const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
  const Lab = Math.hypot(ab[0], ab[1], ab[2]);
  const dn = ab.map((v) => v / Lab);
  const ov0 = [1 - dn[0] * dn[0], -dn[0] * dn[1], -dn[0] * dn[2]];
  const ol = Math.hypot(ov0[0], ov0[1], ov0[2]);
  const ov = ov0.map((v) => v / ol);
  const fv = [dn[1] * ov[2] - dn[2] * ov[1], dn[2] * ov[0] - dn[0] * ov[2], dn[0] * ov[1] - dn[1] * ov[0]];
  if (fv[2] < 0) fv.forEach((_, k) => (fv[k] = -fv[k]));
  // Each point about the arm: how far down it, round it (from the inside, toward the body) and out from it. Only the
  // sleeve on the drawn side (the other is its mirror).
  const at3 = (I: number): V3 => [res[I], res[I + 1], res[I + 2]];
  const about = (v: V3) => {
    const r = [v[0] - arm.a[0], v[1] - arm.a[1], v[2] - arm.a[2]];
    const u = r[0] * dn[0] + r[1] * dn[1] + r[2] * dn[2];
    const x = r[0] * ov[0] + r[1] * ov[1] + r[2] * ov[2];
    const z = r[0] * fv[0] + r[1] * fv[1] + r[2] * fv[2];
    let a = Math.atan2(z, x) - Math.PI;
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return { a, r: Math.hypot(x, z), u };
  };
  const hem = sleeves.flatMap((s) => s.hem.map((i) => at3((s.base + i) * 3))).filter((v) => v[0] >= 0).map(about);
  if (hem.length < 6) return;
  const xs = strip.pts.map((q) => q.x);
  const ys = strip.pts.map((q) => q.y);
  const [x0, y0, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...ys)];
  const W = Math.max(...xs) - x0;
  const depth = W / 2;
  // How far the sleeve stands out from the arm, all round, over the stretch the cuff covers: the cuff lies just
  // outside the widest of it, so none of the sleeve shows through.
  const NB = 36;
  const hemU = hem.reduce((s, h) => s + h.u, 0) / hem.length;
  const binR = new Array<number>(NB).fill(0);
  const binU = new Array<number>(NB).fill(0);
  const binN = new Array<number>(NB).fill(0);
  for (const h of hem) {
    const k = Math.floor((h.a / TAU) * NB) % NB;
    binU[k] += h.u;
    binN[k]++;
  }
  for (const s of sleeves)
    s.pts.forEach((_, i) => {
      const v = at3((s.base + i) * 3);
      if (v[0] < 0) return;
      const h = about(v);
      if (h.u < hemU - depth - 1.5 || h.u > hemU + 1.5) return;
      const k = Math.floor((h.a / TAU) * NB) % NB;
      binR[k] = Math.max(binR[k], h.r);
    });
  // (A bin no hem point fell in takes its neighbours'.)
  for (let it = 0; it < NB && binN.some((n) => !n); it++) {
    const c = binN.slice();
    for (let k = 0; k < NB; k++)
      if (!c[k]) {
        const [l, r] = [(k + NB - 1) % NB, (k + 1) % NB];
        const n = (c[l] ? 1 : 0) + (c[r] ? 1 : 0);
        if (!n) continue;
        binU[k] = ((c[l] ? binU[l] / c[l] : 0) + (c[r] ? binU[r] / c[r] : 0)) / n;
        binN[k] = 1;
      }
  }
  const hemAt = binU.map((u, k) => u / (binN[k] || 1));
  for (let it = 0; it < 4; it++) {
    const c = binR.slice();
    for (let k = 0; k < NB; k++) binR[k] = Math.max(c[k], (c[(k + NB - 1) % NB] + 2 * c[k] + c[(k + 1) % NB]) / 4);
  }
  const lerp = (arr: number[], a: number) => {
    const f = (a / TAU) * NB - 0.5;
    const k = Math.floor(f);
    const t = f - k;
    return arr[((k % NB) + NB) % NB] * (1 - t) + arr[(((k + 1) % NB) + NB) % NB] * t;
  };
  strip.pts.forEach((q, i) => {
    const x = q.x - x0;
    const outer = x > depth;
    const v = Math.min(x, W - x);
    const t = (q.y - y0) / (y1 - y0 || 1);
    const a = (1 - t) * TAU;
    // The outer layer stands just proud of the sleeve. The inner one, which can't be seen, lies just under the sleeve's
    // cloth and comes out to meet the outer at the fold: drawn a cloth's width outside the sleeve, its far face (which
    // the drawing thickens toward the body) stood through the outer layer and the band read in shadow.
    const toFold = Math.min(1, (depth - v) / 1.2);
    const R = lerp(binR, a) + (outer ? 0.4 : 0.4 - 0.9 * toFold);
    // (Its lower edge turned in a little at the sleeve's hem, so it reads as a rolled edge rather than a rim.)
    const roll = outer ? Math.max(0, 1 - v / 0.8) : 0;
    const u = lerp(hemAt, a) - v + roll * 0.3;
    const I = (strip.base + i) * 3;
    for (let k = 0; k < 3; k++) res[I + k] = arm.a[k] + dn[k] * u + (R - roll * 0.3) * (Math.cos(a + Math.PI) * ov[k] + Math.sin(a + Math.PI) * fv[k]);
  });
}
