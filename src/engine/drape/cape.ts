// A cape collar sewn on for All round. Its pattern piece calls its neck edge 'cape-neck' (a full circle's inner edge,
// see collar.ts), which the drape didn't know as a neck edge: the cape wasn't sewn to the neckline at all and fell
// off the body to the floor, every cape in every cloth, while the drawing's score still passed it (All round,
// 2026-11-07). Here it is laid as the flat collar it is, soft cloth lying on the shoulders and falling from the neck.
import { Path } from '../geometry';
import type { Piece } from '../piece';

export function capeForDrape(pc: Piece): Piece {
  if (!pc.meta.cape) return pc;
  const outline = Object.assign(Object.create(Path.prototype) as Path, pc.outline, { tags: pc.outline.tags.map((t) => (t === 'cape-neck' ? 'neck' : t)) });
  return { ...pc, outline, meta: { ...pc.meta, flat: true } };
}
