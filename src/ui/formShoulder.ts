// The drawn form's shoulder end, rounded over. Under a garment with nothing on the shoulder but a strap the form is
// drawn out to the wearer's shoulder width (makeSpace's widen), and only along the shoulder's top: its very end came to
// a point, which showed past a slip's strap as a thin fin flicking out at each shoulder (Cat, 2026-11-11: "the strap
// tips"). Squared off, it read as a block with a sharp top corner standing in the armhole (Cat, 2026-11-11:
// "smooth"). A dress form's shoulder ends in a rounded cap, so the corner is turned over a quarter circle. Only the
// drawing: the body the cloth settles on is unchanged, and no cloth lies this far out on a form drawn out this way
// (its strap ends well inside).

/** The cm of the drawn-out shoulder's end taken off, the radius its top corner is turned over, how far above the
 *  shoulder point's level the turn starts, and the cm the limit comes in over. Below the turn the cap falls back in
 *  toward the body, by `DROP` cm over `FALL` cm of height: left to the drawn-out form the width stepped in over 3 cm,
 *  which with the turn above it read as a lump on a lump. */
const BLUNT = 0.5;
const ROUND = 3.5;
const RISE = 1;
const SOFT = 0.8;
const DROP = 5;
const FALL = 10;

/** `drawn` (the form's surface drawn out, cm from the centre line) held in from the shoulder's point `tip`: over a
 *  quarter circle at the top and a long ease below it, so the shoulder's end is one cap, and never in past `own`, the
 *  form's width there before it was drawn out. `down` is how far below the shoulder point's level the surface is, in
 *  cm (negative above it). */
export function roundedShoulder(drawn: number, own: number, tip: number, down: number): number {
  const a = Math.abs(drawn);
  const t = Math.min(ROUND, Math.max(0, down + RISE));
  const f = Math.min(1, Math.max(0, (down + RISE - ROUND) / FALL));
  const lim = tip - BLUNT - ROUND + Math.sqrt(ROUND * ROUND - (ROUND - t) * (ROUND - t)) - (DROP * (1 - Math.cos(Math.PI * f))) / 2;
  if (a <= lim - SOFT || a <= Math.abs(own)) return drawn;
  const held = a >= lim + SOFT ? lim : a - (a - (lim - SOFT)) ** 2 / (4 * SOFT);
  return Math.sign(drawn) * Math.max(Math.abs(own), held);
}

/** The same turn on a form that is not drawn out: under a top cut below the shoulders (strapless, sweetheart, cami,
 *  halter) the form's arm stumps are held to the chest's `width`, and where that cut the shoulder's slope it left a
 *  sharp square corner in plain view. Only the corner is turned; below it the form is as it was. */
export function roundedCorner(drawn: number, width: number, down: number): number {
  return down >= ROUND - RISE ? drawn : roundedShoulder(drawn, 0, width + BLUNT, down);
}
