// Back pockets on trousers (In testing, Cat's styling options round 1, Nov 7 2026, T3): a welt pocket on each back,
// 7 cm below the waist and running with it, between the darts. The darts are cut shorter so they end just past the welt,
// where the pocket's bag behind holds the seat's shaping, as a tailor's trousers are made.
import { P, Path, add, len, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import { weltPieces } from './pocketPieces';

export type BackPockets = 'none' | 'welt';

/** A back welt pocket, finished: 13 cm wide, its welt 1.2 cm deep, its top 7 cm below the waist, the bag 17 cm deep.
 *  The back darts are cut 9.5 and 8.5 cm long in place of 13 and 11. */
export const BACK_WELT = { w: 13, depth: 1.2, below: 7, bag: 17, darts: [9.5, 8.5] };

/** Where the welt sits on the back: its top edge's two ends, in the back piece's places. */
export interface BackWeltPlace {
  a: P;
  b: P;
  depth: number;
}

/** The back's waist as a polyline, from the centre back to the side. */
function waistLine(back: Piece): P[] {
  const { pts, tags } = back.outline.taggedPoints(8);
  return pts.filter((_, i) => tags[i] === 'waist' || tags[i] === 'dart' || tags[i - 1] === 'waist');
}

/**
 * A welt pocket on the back: its opening marked on the back (a box the welt is sewn to), centred between the darts (or
 * halfway across the waist with none) and parallel to the waist there, with the welt, facing and bags to cut.
 */
export function backWelts(back: Piece, sa: number): { back: Piece; pieces: Piece[]; place: BackWeltPlace } | undefined {
  const waist = waistLine(back);
  if (waist.length < 2) return undefined;
  const xs = waist.map((q) => q.x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  // Darts' tips mark where the seat is shaped: the welt sits across their middle.
  const tips = back.lines.map((l) => l.points(2)).filter((pts) => pts.length >= 3).map((pts) => pts[1]);
  const cx = tips.length ? tips.reduce((t, q) => t + q.x, 0) / tips.length : (lo + hi) / 2;
  const w = Math.min(BACK_WELT.w, hi - lo - 4);
  if (w < 9) return undefined;
  // The waist's slope where the welt goes, so the welt runs with it.
  const at = (x: number) => {
    for (let i = 1; i < waist.length; i++) {
      const [u, v] = [waist[i - 1], waist[i]];
      if ((u.x - x) * (v.x - x) <= 0 && Math.abs(v.x - u.x) > 1e-9) return u.y + ((v.y - u.y) * (x - u.x)) / (v.x - u.x);
    }
    return waist[0].y;
  };
  const along = unit(sub(p(cx + w / 2, at(cx + w / 2)), p(cx - w / 2, at(cx - w / 2))));
  const down = p(-along.y, along.x).y > 0 ? p(-along.y, along.x) : p(along.y, -along.x);
  const mid = add(p(cx, at(cx)), mul(down, BACK_WELT.below));
  const a = add(mid, mul(along, -w / 2));
  const b = add(mid, mul(along, w / 2));
  const d = BACK_WELT.depth;
  const box = new Path(a).line(b).line(add(b, mul(down, d))).line(add(a, mul(down, d))).line(a);
  const pieces = weltPieces(Math.round(w * 10) / 10, d, BACK_WELT.bag, sa).map((pc) => ({ ...pc, name: `Back ${pc.name.toLowerCase()}`, labels: pc.labels.map((l) => (l.text === pc.name.toUpperCase() ? { ...l, text: `BACK ${l.text}` } : l)) }));
  return {
    back: {
      ...back,
      lines: [...back.lines, box],
      labels: [...back.labels, { at: add(add(mid, mul(down, -1.2)), mul(along, w / 4)), text: 'BACK POCKET', size: 0.5, rotate: (Math.atan2(along.y, along.x) * 180) / Math.PI }],
    },
    pieces,
    place: { a, b, depth: d },
  };
}

/** How wide the welt is, as placed. */
export const weltWidth = (pl: BackWeltPlace) => Math.round(len(sub(pl.b, pl.a)) * 10) / 10;
