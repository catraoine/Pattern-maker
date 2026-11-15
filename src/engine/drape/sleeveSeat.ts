import { knob } from './knob';

/**
 * A sleeve's cap carried out onto the armhole it is sewn to, at the end. On a very large body (a 145 cm bust) the back
 * armhole of a T-shirt, jacket or coat lies round the back of the body, further out than the arm the sleeve hangs on,
 * and the two pulled apart: the cap stood 2 to 3 cm inside the armhole, the seam drawn open (14 of the 22 designs that
 * passed on the example body and failed on the large one, Nov 15). (The bodice's own pass in garment.ts lays a cap on
 * the nearest point of the armhole, not on the point it is sewn to, and widened to these pieces it left the seam 1.8 cm
 * open.) Each armhole point of the sleeve is moved onto the point it is sewn to, and the sleeve within a few cm of the
 * cap moves with it, less the further from the seam. Only moves out, away from the body's middle: a cap standing
 * outside its armhole is left, so nothing is pushed into the arm. Only a sleeve whose seam has opened is moved.
 */
/** How far down the sleeve from the cap, cm as cut, the move eases out. */
const REACH = 8;
/** A sleeve is carried onto its armhole only once its seam stands open this far somewhere, cm. */
const OPEN = 1.2;

type Panel = { role: string; base: number; hidden?: boolean; mesh: { pts: { x: number; y: number }[]; runs: Record<string, number[][]> } };

export function seatSleeves(panels: Panel[], seams: { i: number; j: number; k: number; t: number }[], pos: Float64Array): void {
  if (knob('__noSleeveSeat')) return;
  const reach = knob('__sleeveSeatReach') ?? REACH;
  const isSleeve = (p: Panel) => p.role === 'sleeve';
  const onSleeve = (g: number) => panels.some((s) => isSleeve(s) && g >= s.base && g < s.base + s.mesh.pts.length);
  for (const p of panels) {
    if (!isSleeve(p) || p.hidden || !p.mesh.runs.armhole?.length) continue;
    const n = p.mesh.pts.length;
    const mine = (g: number) => g >= p.base && g < p.base + n;
    const cap = new Set(p.mesh.runs.armhole.flat().map((i) => p.base + i));
    // (Points sewn anywhere but the armhole, a cuff on a short sleeve's hem, stay where they are sewn.)
    const heldElsewhere = new Set<number>();
    for (const { i, j } of seams) if (mine(i) && !cap.has(i) && !mine(j)) heldElsewhere.add(i);
    const at: { q: { x: number; y: number }; s: number[] }[] = [];
    let worst = 0;
    for (const { i, j, k, t } of seams) {
      if (!cap.has(i) || onSleeve(j) || onSleeve(k)) continue;
      const I = i * 3;
      const s = [0, 1, 2].map((d) => pos[j * 3 + d] * (1 - t) + pos[k * 3 + d] * t - pos[I + d]);
      // Out only: the move's share along the way out from the body's middle (x, z) must be positive.
      const r = Math.hypot(pos[I], pos[I + 2]) || 1;
      const out = (s[0] * pos[I] + s[2] * pos[I + 2]) / r;
      const gap = Math.hypot(s[0], s[1], s[2]);
      const keep = out > 0 && gap > 0.15;
      if (keep) worst = Math.max(worst, gap);
      at.push({ q: p.mesh.pts[i - p.base], s: keep ? s : [0, 0, 0] });
    }
    if (worst < OPEN) continue;
    for (let i = 0; i < n; i++) {
      if (heldElsewhere.has(p.base + i)) continue;
      const q = p.mesh.pts[i];
      let best = at[0];
      let bd = Infinity;
      for (const a of at) {
        const d = Math.hypot(a.q.x - q.x, a.q.y - q.y);
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      const e = Math.min(1, bd / reach);
      const w = 1 - e * e * (3 - 2 * e);
      if (w <= 0) continue;
      for (let d = 0; d < 3; d++) pos[(p.base + i) * 3 + d] += best.s[d] * w;
    }
  }
}
