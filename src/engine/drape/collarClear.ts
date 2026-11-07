// A collar's fall laid over the shoulders sinks a little into them in the sim where its points come down past the
// shirt's own shoulder seam: the open polo's fall went up to 2 cm into the form there (All round, 2026-11-07: the app
// showed every open polo as its flat drawing, "the collar sinks into the form", in cotton and in silk alike). Seen
// from outside the collar lies on the shirt, so where it sank it is eased back out to two layers' thickness off the
// body: the shift each sunk point needs, spread smoothly to the collar round it (fading over 5 cm or so of the cut
// piece), so the collar moves as a piece and isn't stretched point by point.
import type { Draped } from './garment';
import type { Space } from './space';

/** How far round a sunk point the collar is eased out with it, cm of the cut piece. */
const SPREAD = 5;

export function clearCollars(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, sp: Space): void {
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])])
    for (const p of d.panels) {
      if (p.hidden || p.role !== 'collar') continue;
      const pts = p.mesh.pts;
      // Each sunk point (at or below the shoulder tip's level, where the form's round is the body's own) and how far
      // out it needs to come.
      const sunk: { k: number; need: number }[] = [];
      for (let k = 0; k < pts.length; k++) {
        const I = (p.base + k) * 3;
        const [x, c, z] = [pos[I], pos[I + 1], pos[I + 2]];
        if (c < sp.tip.c) continue;
        // (Its own layer and the shirt's under it: the shirt keeps its thickness off the body.)
        const need = sp.bodyR(Math.atan2(x, z), c) + p.thick[k] * 2 - Math.hypot(x, z);
        if (need > 0) sunk.push({ k, need });
      }
      if (!sunk.length) continue;
      const moves: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        let wSum = 0;
        let nSum = 0;
        let near = 0;
        for (const s of sunk) {
          const w = Math.exp(-((pts[k].x - pts[s.k].x) ** 2 + (pts[k].y - pts[s.k].y) ** 2) / (2 * SPREAD * SPREAD));
          wSum += w;
          nSum += w * s.need;
          near = Math.max(near, w);
        }
        moves.push(wSum > 0 ? (nSum / wSum) * near : 0);
      }
      for (let k = 0; k < pts.length; k++) {
        const I = (p.base + k) * 3;
        const r = Math.hypot(pos[I], pos[I + 2]);
        if (moves[k] < 1e-4 || r < 1e-6) continue;
        const s = (r + moves[k]) / r;
        pos[I] *= s;
        pos[I + 2] *= s;
      }
    }
}
