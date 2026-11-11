// The drawn form's shoulder end, squared off. Under a garment with nothing on the shoulder but a strap the form is
// drawn out to the wearer's shoulder width (makeSpace's widen), and only along the shoulder's top: its very end came to
// a point, which showed past a slip's strap as a thin fin flicking out at each shoulder (Cat, 2026-11-11: "the strap
// tips"). A dress form's shoulder ends in a plate. Only the drawing: the body the cloth settles on is unchanged, and
// no cloth lies this far out on a form drawn out this way (its strap ends well inside).

/** The last cm of the drawn-out shoulder taken off, and the cm its corner is rounded over. */
const BLUNT = 1.5;
const SOFT = 0.8;

/** `drawn` (the form's surface drawn out, cm from the centre line) held in from the shoulder's point `tip`, and never
 *  in past `own`, the form's own width there. */
export function squaredShoulder(drawn: number, own: number, tip: number): number {
  const a = Math.abs(drawn);
  const lim = tip - BLUNT;
  if (a <= lim - SOFT || a <= Math.abs(own)) return drawn;
  const held = a >= lim + SOFT ? lim : a - (a - (lim - SOFT)) ** 2 / (4 * SOFT);
  return Math.sign(drawn) * Math.max(Math.abs(own), held);
}
