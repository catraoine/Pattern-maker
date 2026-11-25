// A princess top with a peplum sewn a little below the waist: its waist darts are left part open at the peplum seam.
//
// Closing the darts in the few centimetres between the waist and the seam (as a fish-eye that ends 3 cm below the
// waist) made the princess seams kick out under the waist, and the side seams had to turn in to bring the seam back to
// its length: 2.3 cm over the last 8 cm on a 117 cm bust with a 99 cm waist, which a tester sewed as a hook at each
// side (round 1 fit report, Nov 23). The body widens from the waist down, so the side seams should run straight down;
// the princess seams end apart at the peplum seam instead, as they do at any waist seam, and the peplum is sewn to what
// is left.

/** The most of a waist dart left open at the seam: the rest closes, so the princess seam still turns at the waist. */
const OPEN_DART_MAX = 0.95;

interface OpenDarts {
  /** How much of the back's and the front's waist dart is left open at the seam, in cm. */
  back: number;
  front: number;
  /** How far each side seam moves out (or, past what the darts can take, in) from the waist to the seam, in cm. */
  out: number;
}

/**
 * Shares out what the side seams would otherwise have to take in. `straightOut` is how far each side seam would leave
 * the waist with the darts closed by the seam (bodice.ts): when it is negative, the seam is shorter than the pieces are
 * wide there, and the darts keep that much open between them instead, each in proportion to its size.
 */
export function openDarts(straightOut: number, dartB: number, dartF: number): OpenDarts {
  const b = dartB > 0.3 ? dartB : 0;
  const f = dartF > 0.3 ? dartF : 0;
  if (straightOut >= 0 || b + f === 0) return { back: 0, front: 0, out: straightOut };
  const need = -2 * straightOut;
  const open = Math.min(need, OPEN_DART_MAX * (b + f));
  return { back: (open * b) / (b + f), front: (open * f) / (b + f), out: -(need - open) / 2 };
}

/**
 * How far below the waist a dart's legs would meet, for a dart `width` wide at the waist to be `open` wide at a seam
 * `drop` below it: the fish-eye is drawn to there, past the seam, and the princess seams end where its legs cross it.
 */
export const eyeDepth = (drop: number, width: number, open: number) => (drop * width) / (width - Math.min(open, OPEN_DART_MAX * width));
