// A shift on a body whose hip is much bigger than its bust: the side seam runs as one straight line from the underarm
// through the hip to the hem, an A-line, in place of the shift's own seam.
// (CLO, Nov 22: with the hip 32 cm over the bust the Blush Shift's seam fell straight from the bust to the waist,
// swelled out to the hip and dropped straight again, and on the body it stood out over the hip like a bell, in three
// cloths alike. At 18 cm over, the shift as it was hung free, and a first version that also ran the line straight on
// below the hip cut the hem 8 cm narrower there and pegged in under the seat: so below the hip the hem keeps at least
// the shift's own flare, and the change starts above 18 cm.)
import { P, lerp } from './geometry';

/** How far each side seam has to travel out from the bust's width to the hip's, in cm, before the seam starts to
 *  straighten, and where it is one straight line: 18 and 30 cm of hip over bust round the body. In between it is part
 *  way, so two bodies a centimetre apart are never cut two different dresses. */
const A_LINE = { from: 4.5, full: 7.5 };

/** The share of the way to a straight seam, 0 (the shift as it was) to 1 (one line), for a seam that travels `out` cm. */
export const aLineShare = (out: number) => Math.max(0, Math.min(1, (out - A_LINE.from) / (A_LINE.full - A_LINE.from)));

/** A curve's two handles moved `share` of the way to where a straight line's would be. */
export const straighter = (from: P, c1: P, c2: P, to: P, share: number): [P, P] => (share <= 0 ? [c1, c2] : [lerp(c1, lerp(from, to, 1 / 3), share), lerp(c2, lerp(from, to, 2 / 3), share)]);

/** The flare at the hem: the dress's own, or where the line from the waist through the hip carried straight on to the
 *  hem is wider, `share` of the way to that. Never less than the dress's own (see the top of this file). */
export const aLineFlare = (flare: number, waist: P, hip: P, hemY: number, share: number) => flare + share * Math.max(0, ((hip.x - waist.x) / Math.max(hip.y - waist.y, 1)) * (hemY - hip.y) - flare);
