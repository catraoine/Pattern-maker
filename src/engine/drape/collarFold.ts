import type { Piece } from '../piece';

/**
 * A notched collar's outer edge meets its centre back fold at a square corner (cut on the fold since Nov 13). Sewn
 * against its mirror, that last short stretch of the edge is held at the centre back like the fold itself: run on as
 * free edge, it was pulled out as the edge was laid and smoothed, and a sleeveless jacket's collar drew stretched and
 * fell back to the flat drawing (bug hunt, Nov 14). Only the drawing's copy is retagged; the pattern keeps its own.
 */
export function foldCorner(pc: Piece): Piece {
  const tags = pc.outline.tags;
  const n = tags.length;
  if (n < 3 || tags[n - 1] !== 'fold' || tags[n - 2] !== 'collar' || pc.meta.hood) return pc;
  const outline = Object.assign(Object.create(Object.getPrototypeOf(pc.outline)), pc.outline, { tags: [...tags.slice(0, n - 2), 'fold', 'fold'] });
  return { ...pc, outline };
}
