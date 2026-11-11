// A sleeveless shoulder's strap, kept from fanning out past its own seam. Nothing in the settling holds cloth from
// sliding sideways on the shoulder's slope, so whichever of the front and back lies on the shoulder's top swung
// outward about the shoulder seam: 2 to 3 cm further out than it is cut, within a few cm of the seam, and seen from
// the front as a tip flicking out past the strap at each shoulder (Cat, 2026-11-11: "the strap tips"). A strap sewn
// and worn lies straight over the shoulder, as wide as it is cut.
import type { Draped } from './garment';
import { knob } from './knob';

/** How far below the shoulder seam, in cm down the pattern, the strap is laid straight: in full at the seam, easing to
 *  nothing here. */
const REACH = 10;
/** How far in from the seam's outer end, in cm across the pattern, cloth is still brought in (easing to nothing), and
 *  the most any point is moved. */
const IN = 5;
const MOST = 4;

/** Each front and back of a sleeveless garment: its cloth near the shoulder seam brought in to as far out from the
 *  seam's outer end as the pattern cuts it, where it settled further out, and raised by the shoulder's own slope so it
 *  stays on the shoulder. Cloth that settled no further out than it is cut is left alone. Moves `out.pos`. */
export function fairStraps(out: Draped): void {
  // (Nor under a collar: it is sewn to the neck right beside the shoulder seam, and moving the cloth under it opened
  // that seam 2 to 3 cm on a sleeveless open polo.)
  if (knob('__noStrapFair') || out.panels.some((p) => (p.role === 'sleeve' || p.role === 'collar') && !p.hidden)) return;
  for (const p of out.panels) {
    if (p.hidden || (p.role !== 'front' && p.role !== 'back') || p.turned.some(Boolean)) continue;
    const pts = p.mesh.pts;
    const seam = [...new Set((p.mesh.runs.shoulder ?? []).flat())];
    if (seam.length < 2 || !(p.mesh.runs.armhole ?? []).length) continue;
    for (const pos of [out.pos, ...(out.posMirror ? [out.posMirror] : [])]) {
      const X = (i: number) => pos[(p.base + i) * 3];
      const Y = (i: number) => pos[(p.base + i) * 3 + 1];
      // The seam's ends: the outer one at the armhole, the inner at the neck.
      const outer = seam.reduce((a, b) => (pts[b].x > pts[a].x ? b : a));
      const inner = seam.reduce((a, b) => (pts[b].x < pts[a].x ? b : a));
      const run = X(outer) - X(inner);
      // (Only a seam lying outward along the shoulder, as it is cut: a one-shoulder's or a halter's is left alone.)
      if (run < 1 || Math.abs(run - (pts[outer].x - pts[inner].x)) > 2) continue;
      // The shoulder's slope along the seam: how far it rises for each cm in toward the neck.
      const slope = Math.max(0, Math.min(0.6, (Y(outer) - Y(inner)) / run));
      pts.forEach((q, i) => {
        const down = q.y - pts[outer].y;
        if (down <= 0 || down >= REACH || seam.includes(i)) return;
        const over = X(i) - (X(outer) + (q.x - pts[outer].x));
        // (Only the strap's own outer edge, the cloth cut within a few cm of the seam's end: further in toward the
        // neck the cloth turns round the body, nearer the middle than it is cut for that reason alone, and drawing
        // it in tore a boat neck's keyhole back 14 times its cut length.)
        const inFrom = (pts[outer].x - q.x) / IN;
        if (over <= 0 || inFrom >= 1) return;
        const t = (1 - down / REACH) * (1 - Math.max(0, inFrom));
        const move = Math.min(over, MOST) * t * t * (3 - 2 * t);
        pos[(p.base + i) * 3] -= move;
        pos[(p.base + i) * 3 + 1] -= move * slope;
      });
    }
  }
}
