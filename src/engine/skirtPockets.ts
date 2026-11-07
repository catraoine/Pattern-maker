// Pockets on a skirt's front besides the in-seam ones (In testing, Cat's styling options round 1, Nov 7 2026):
// square patch pockets sewn on the hip, and slant pockets cut into the front at the waist as on chinos. The
// same skirt pieces serve a dress's skirt, so both come to a dress too.
import { Path, p } from './geometry';
import type { Piece } from './piece';
import { slantPocket } from './pockets';
import { patchPocket, spanAt } from './patchPocket';

/** A skirt's patch pocket, finished: 14 cm across and 15 deep, a little smaller than a jacket's, its top
 * 9 cm below the waist seam (clear of the band and level with the end of the front dart). */
export const SKIRT_PATCH = { w: 14, h: 15, top: 9, belowDart: 2, hemRoom: 6, minWidth: 10 };

/** Where a patch pocket sits on the front, in the front piece's own places (x out from the centre front). */
export interface PatchPlace {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The lowest point of the front's darts, so the pocket starts below them. */
function dartFoot(front: Piece): number {
  const ys = front.lines.flatMap((l) => l.points(4).map((q) => q.y));
  return ys.length ? Math.max(...ys) : 0;
}

/**
 * A patch pocket on each front: placed below the dart, centred between the centre front and the side seam at
 * its middle, and kept 2 cm clear of the side seam. Undefined when the skirt is too short or narrow for one
 * (a mini whose hem comes up under the pocket).
 */
export function patchOnFront(front: Piece, lengthCm: number, hemAllowance: number, sa: number): { front: Piece; pocket: Piece; place: PatchPlace } | undefined {
  const y = Math.max(SKIRT_PATCH.top, dartFoot(front) + SKIRT_PATCH.belowDart);
  let h = SKIRT_PATCH.h;
  const room = lengthCm - hemAllowance - SKIRT_PATCH.hemRoom - y;
  if (room < 11) return undefined;
  h = Math.min(h, room);
  const [lo, hi] = spanAt(front, y + h / 2);
  // A front on the fold starts at the centre front (x = 0); a whole front cut single layer spans both sides.
  const from = Math.max(lo, 0) + 2;
  const w = Math.min(SKIRT_PATCH.w, hi - 2 - from);
  if (w < SKIRT_PATCH.minWidth) return undefined;
  const x = Math.round((from + (hi - 2 - from - w) / 2) * 10) / 10;
  const place = { x, y, w, h };
  const box = new Path(p(x, y)).line(p(x, y + h)).line(p(x + w, y + h)).line(p(x + w, y)).line(p(x, y));
  return {
    front: { ...front, lines: [...front.lines, box], labels: [...front.labels, { at: p(x + w / 2, y + 1.2), text: 'POCKET', size: 0.5 }] },
    pocket: { ...patchPocket(w, h, sa), kind: 'pocket' },
    place,
  };
}

/** The skirt's pieces as made up, for All round: a front cut away for a slant pocket is whole again once its facing is
 * tacked in, so the front as it was before the cut is sewn in its place. */
export function madeUpSkirt(pieces: Piece[], skirt?: { frontPocket?: { kind: string }; closed?: [Piece, Piece] }): Piece[] {
  const whole = skirt?.frontPocket?.kind === 'slant' ? skirt.closed?.[0] : undefined;
  return whole ? pieces.map((pc) => (pc.name === whole.name && !pc.kind ? { ...pc, outline: whole.outline, notches: whole.notches } : pc)) : pieces;
}

/** Slant pockets cut into the front at the waist: the front, its lining and facing (see pockets.ts). */
export function slantOnFront(front: Piece): { front: Piece; pieces: Piece[] } | undefined {
  const s = slantPocket(front);
  return s && { front: s.front, pieces: [s.lining, s.facing] };
}
