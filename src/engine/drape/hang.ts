// How the settled cloth is drawn back on the form. The cloth settles in true cm on the wearer's body (space.ts), and
// is drawn on the form by dividing by the form's scale at each level (cm per form unit, set ring by ring from the
// wearer's bust, waist and hip). Cloth lying on the body belongs at that level's scale: it is drawn on the form's
// surface. But cloth hanging clear of the body does not: a shift that falls straight from the bust in cm, drawn at
// the waist's smaller scale, bows out over the belly wherever the wearer's waist is smaller than the form's (the
// blush shift, 2026-11-04). So each point carries down the scale of the last place its column of cloth touched the
// body, and hangs plumb from there; where it touches again it is drawn on the form again.
import type { Draped } from './garment';
import type { Space } from './space';

/** Cloth this close to the body (cm) is lying on it. */
const TOUCH = 1;
/** This far off it (cm) it hangs free; between, it eases from the one to the other. */
const FREE = 2.5;
/** Flat-pattern columns this wide (cm) are walked top to bottom as one. */
const COL = 1;

/** How far a difference between neighbours spreads (a screened smoothing's weight): the front, hanging plumb, meets
 *  the back, lying on the body, at the side seam, and the drawn seam must not tear. */
const SPREAD = 12;
const ROUNDS = 60;

/** The scale to draw each point at (cm per form unit), or 0 for the level's own. */
export function hangScales(d: Draped, sp: Space): Float32Array | undefined {
  const n = d.pos.length / 3;
  const out = new Float32Array(n);
  const level = new Float32Array(n);
  const pinned = new Uint8Array(n);
  let any = false;
  for (const p of d.panels) {
    if (p.hidden || p.role === 'sleeve' || p.role === 'collar') continue;
    const cols = new Map<number, number[]>();
    p.mesh.pts.forEach((q, i) => {
      const k = Math.round(q.x / COL);
      (cols.get(k) ?? cols.set(k, []).get(k)!).push(i);
    });
    for (const ids of cols.values()) {
      ids.sort((a, b) => p.mesh.pts[a].y - p.mesh.pts[b].y);
      let carry: number | undefined;
      for (const i of ids) {
        const I = (p.base + i) * 3;
        const x = d.pos[I];
        const c = d.pos[I + 1];
        const z = d.pos[I + 2];
        const s = sp.scale(sp.yOf(c));
        level[p.base + i] = s;
        out[p.base + i] = s;
        const rho = Math.hypot(x, z);
        const body = sp.bodyR(Math.atan2(x, z), c);
        const gap = rho - body;
        if (gap <= TOUCH) {
          carry = s;
          pinned[p.base + i] = 1;
          continue;
        }
        if (carry === undefined) continue;
        const w = Math.min(1, (gap - TOUCH) / (FREE - TOUCH));
        out[p.base + i] = s + w * (carry - s);
        if (Math.abs(carry - s) > 1e-6) any = true;
      }
    }
  }
  if (!any) return undefined;
  // Smoothed over the cloth: each free point eases toward its neighbours (over its panel's edges and across the seams)
  // while holding to its own carried scale, so a step between neighbours is spread over several cm of cloth.
  const nb: number[][] = Array.from({ length: n }, () => []);
  const link = (a: number, b: number) => {
    nb[a].push(b);
    nb[b].push(a);
  };
  for (const p of d.panels) {
    if (p.hidden || p.role === 'sleeve' || p.role === 'collar') continue;
    for (const [a, b, c] of p.mesh.tris) {
      link(p.base + a, p.base + b);
      link(p.base + b, p.base + c);
      link(p.base + c, p.base + a);
    }
  }
  for (const { i, j, k } of d.seams ?? []) {
    if (level[i] && level[j]) link(i, j);
    if (level[i] && level[k]) link(i, k);
  }
  const target = Float32Array.from(out);
  const next = new Float32Array(n);
  for (let r = 0; r < ROUNDS; r++) {
    for (let i = 0; i < n; i++) {
      if (!level[i] || !nb[i].length) {
        next[i] = out[i];
        continue;
      }
      let sum = 0;
      for (const j of nb[i]) sum += out[j];
      next[i] = (target[i] + (SPREAD * sum) / nb[i].length) / (1 + SPREAD);
    }
    out.set(next);
  }
  for (let i = 0; i < n; i++) {
    if (!level[i]) {
      out[i] = 0;
      continue;
    }
    const x = d.pos[i * 3];
    const c = d.pos[i * 3 + 1];
    const z = d.pos[i * 3 + 2];
    const rho = Math.hypot(x, z);
    const body = sp.bodyR(Math.atan2(x, z), c);
    // Never drawn inside the form: at most the scale that keeps it a touch off the form's surface.
    const h = Math.min(out[i], (rho * level[i]) / (body + 0.3));
    out[i] = Math.abs(h - level[i]) < 1e-6 ? 0 : h;
  }
  return out;
}
