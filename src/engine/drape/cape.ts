// A cape collar sewn on for All round. Its pattern piece calls its neck edge 'cape-neck' (a full circle's inner edge,
// see collar.ts), which the drape didn't know as a neck edge: the cape wasn't sewn to the neckline at all and fell
// off the body to the floor, every cape in every cloth, while the drawing's score still passed it (All round,
// 2026-11-07). Here it is laid as the flat collar it is, soft cloth lying on the shoulders and falling from the neck.
import { Path } from '../geometry';
import type { Piece } from '../piece';
import { knob } from './knob';

export function capeForDrape(pc: Piece): Piece {
  if (!pc.meta.cape) return pc;
  const outline = Object.assign(Object.create(Path.prototype) as Path, pc.outline, { tags: pc.outline.tags.map((t) => (t === 'cape-neck' ? 'neck' : t)) });
  return { ...pc, outline, meta: { ...pc.meta, flat: true } };
}

/** A cape's front piece: its neck edge is measured from the centre front, where it is cut on the fold (or opens), not
 *  from the centre back as a flat collar's is. (Laid from the centre back as a peter pan is, the front piece lay over
 *  the back, and its neck, sewn to the top's front neckline, pulled that round the body to the back 7x stretched.) */
export const capeFromFront = (pc: Piece): boolean => !!pc.meta.cape && /^Cape front/.test(pc.name);

/** How far a point of a cape piece lies from its neck circle's centre: the cape's front and back pieces are seamed at
 *  the shoulder along a line straight out from it, so this orders that seam from the neck to the hem. (The neck edge
 *  is an arc of the circle round (0, -r) through the piece's corner at (0, 0), so any point of it gives r.) */
export function capeRadius(pc: Piece): (q: { x: number; y: number }) => number {
  const r = neckR(pc);
  return (q) => Math.hypot(q.x, q.y + r);
}

function neckR(pc: Piece): number {
  const tp = pc.outline.taggedPoints(4);
  const on = tp.pts.filter((q, i) => (tp.tags[i] === 'neck' || tp.tags[i] === 'cape-neck') && Math.abs(q.y) > 0.1);
  return on.length ? -(on[0].x ** 2 + on[0].y ** 2) / (2 * on[0].y) : 0;
}

/** Folds round a cape as it hangs. A full circle cut is far longer round its hem than the shoulders it hangs from
 *  (about 2.3x for a cape to the elbow), and laid straight down from the neck all that length was crushed into the
 *  shoulders' round, and the sim crumpled it into jagged tears at the hem. Here each point is set out from where it
 *  hangs by a wave round the body, as deep as the cloth there is longer than the round it hangs on, so the length lies
 *  in soft folds from the start. (Set out by just the extra length, 1x, the sim drew the folds back in and the hem
 *  still tore; 3 to 4x hung in clean folds in stills, Nov 15.) `k` folds over each half (front and back), symmetric at the centre front and back so
 *  the two halves meet. Returns how far out (cm) to set the point at `q` (cut) hanging at radius `R`, `w` cm from the
 *  neck seam. */
export function capeFold(pc: Piece): (q: { x: number; y: number }, R: number, w: number) => number {
  const r = neckR(pc);
  const front = capeFromFront(pc);
  const k = knob('__capeK') ?? 6;
  const amp = knob('__capeAmp') ?? 3.5;
  return (q, R, w) => {
    const phi = Math.atan2(q.x, q.y + r);
    const u = front ? phi : Math.PI - phi;
    const e = Math.hypot(q.x, q.y + r) / Math.max(R, 1);
    if (e <= 1) return 0;
    const lambda = (Math.PI * R) / k;
    const A = (lambda / (2 * Math.PI)) * Math.sqrt(e * e - 1);
    return amp * A * (1 - Math.cos(2 * k * u)) * Math.min(1, w / 15);
  };
}

/** How far into a cape from its neck seam, cm as cut, the seam's last shift is eased. */
const SEAT_REACH = 4;

/**
 * A cape's neck carried back onto its seam at the end. The cape's weight hangs from the neck seam, and at the centre
 * back the sim leaves its neck edge 1.7 to 1.9 cm behind and below the dress's (Nov 15): the seam reads open there.
 * Each neck point is moved onto the point it is sewn to, and the cloth within a few cm of the seam moves with it,
 * less the further it is from the seam, so the cape doesn't crease at the seam.
 */
export function seatCapeNeck(panels: { pc: Piece; base: number; mesh: { pts: { x: number; y: number }[]; runs: Record<string, number[][]> } }[], seams: { i: number; j: number; k: number; t: number }[], res: Float64Array): void {
  for (const p of panels) {
    if (!p.pc.meta.cape) continue;
    const n = p.mesh.pts.length;
    const mine = (g: number) => g >= p.base && g < p.base + n;
    const neck = new Set((p.mesh.runs.neck ?? []).flat().map((i) => p.base + i));
    const shift = new Map<number, [number, number, number]>();
    for (const { i, j, k, t } of seams) {
      if (!neck.has(i) || mine(j) || mine(k)) continue;
      shift.set(i, [0, 1, 2].map((d) => res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t - res[i * 3 + d]) as [number, number, number]);
    }
    if (!shift.size) continue;
    const at = [...shift.entries()].map(([g, s]) => ({ q: p.mesh.pts[g - p.base], s }));
    for (let i = 0; i < n; i++) {
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
      const w = Math.max(0, 1 - bd / SEAT_REACH);
      if (w <= 0) continue;
      for (let d = 0; d < 3; d++) res[(p.base + i) * 3 + d] += best.s[d] * w;
    }
  }
}

/** Where a cape hangs as cloth in All round, not as its drawing: on a dress with a round or scoop neck. (On a top the
 *  cape's weight pulls the neckline out over the shoulders 6x stretched, with nothing below the waist to hold it, and
 *  round a boat or square neck its neck edge still crumples: Nov 15.) */
export const capeHangs = (kind: string, neckline: string | undefined): boolean => kind === 'dress' && (neckline === 'crew' || neckline === 'scoop');
