import type { Piece } from '../piece';
import { mirrorPiece } from './garment';
import { knob } from './knob';

/**
 * A skirt with a diagonal hem, sewn whole. The drape sews one half of a skirt and draws its mirror for the other, which
 * is right for a skirt whose two sides match; but a diagonal hem runs from short on one side to long on the other, and
 * mirrored it came out as a V point at the centre front (Nov 8). Its pieces are cut whole (both sides in the one
 * piece), so they are sewn whole: each side seam to its own side, and drawn as they hang, nothing mirrored. A whole
 * back lies right side up with the wearer's left at x < 0, seen from behind; the drape places every piece with the
 * wearer's left at x > 0, so it is turned over first, as a whole bodice back is.
 */
export function wholeSkirt(pieces: Piece[], asym: { kind?: string } | undefined): Piece[] {
  if (asym?.kind !== 'diagonal' || knob('__halfDiagonal')) return pieces;
  return pieces.map((pc) => {
    if (!pc.outline.taggedPoints(4).pts.some((q) => q.x < -1)) return pc;
    const m = /back/i.test(pc.name) ? mirrorPiece(pc) : pc;
    return { ...m, meta: { ...m.meta, whole: true, sewWhole: true } };
  });
}
