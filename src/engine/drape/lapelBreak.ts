// A vest's lapel meeting its front edge at the break. Below the break the front's edge is drawn on the centre line,
// while the lapel just above it, turned back over the roll line, settled up to 2 cm past the centre: from the front its
// edge ended in a step beside the top button, a short sideways jog from the lapel down to the front edge (the Black
// Vest, Cat Nov 12: "What's going on here", then "Fix"). Here the lapel's turned cloth near the break is eased back to
// the centre line, fully at the break and not at all from REACH cm away, so its edge runs on into the front's.
import type { P } from '../geometry';
import type { Draped } from './garment';

/** How far from the break, in cm of the front as cut, the lapel is eased back to the centre line. */
const REACH = 5;

export function meetAtBreak(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, breakPt: P): void {
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])])
    for (const p of d.panels) {
      if (p.hidden || p.role !== 'front') continue;
      p.mesh.pts.forEach((q, i) => {
        if (!p.turned[i]) return;
        const I = (p.base + i) * 3;
        if (pos[I] >= 0) return;
        const f = Math.max(0, 1 - Math.hypot(q.x - breakPt.x, q.y - breakPt.y) / REACH);
        pos[I] *= 1 - f * f * (3 - 2 * f);
      });
    }
}
