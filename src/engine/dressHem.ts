// The foot of a one-piece dress: the side seam on from the hip to the hem, and the hem across to the centre.
// (Fit audit, Nov 22: the hems of the Blush Shift and the Ivory Bias Slip dipped between the centre and the side seam.)
import { P, Path, add, mul, p, sub, unit } from './geometry';

/** A dress's side seam on from the hip to the hem. The hip curve arrives straight down, so a seam running straight out
 *  to a flared hem turned a corner at the hip, a kick that shows on the body (SS27 Blush Shift, Nov 12: "to a 10"): it
 *  leaves the hip straight down and bends into the hem's line instead, ending on that same line, so the hem still meets
 *  it square and the hem is as wide as before. */
export function hipToHem(path: Path, hip: P, hem: P, tag: string): Path {
  if (Math.abs(hem.x - hip.x) <= 0.3) return path.line(hem, tag);
  return path.curve(p(hip.x, hip.y + (hem.y - hip.y) * 0.3), add(hip, mul(sub(hem, hip), 0.55)), hem, tag);
}

/** How long the seam from the hip to the hem is, straight or bent as hipToHem bends it. */
function seamLength(hip: P, hem: P, straight: boolean): number {
  const path = new Path(hip);
  if (straight) path.line(hem, 'side');
  else hipToHem(path, hip, hem, 'side');
  return path.length();
}

/**
 * Where a flared side seam ends, for a hem that hangs level. `hem` is the seam's foot at the hem's own level, straight
 * across from the centre. A seam that slopes out to that level is longer than the drop at the centre, so on the body,
 * where it hangs down, its foot sat below the centre's. It is raised until the seam is as long as the drop from the
 * hip to the hem, the way a flared seam is trued by hand; the hem stays as wide. A straight or tapered seam is left
 * where it is.
 */
export function levelSideHem(hip: P, hem: P, straight: boolean): P {
  const drop = hem.y - hip.y;
  if (hem.x - hip.x <= 0.3 || drop <= 0) return hem;
  // The seam only gets shorter as its foot rises, so halve the range until it measures the drop. It can't rise past
  // a quarter of the drop, which keeps a very wide flare on a short dress sensible.
  let lo = 0;
  let hi = drop * 0.25;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (seamLength(hip, p(hem.x, hem.y - mid), straight) > drop) lo = mid;
    else hi = mid;
  }
  return p(hem.x, hem.y - (lo + hi) / 2);
}

/** The shortest run a hem leaves a flared side seam square for, in cm. */
const SQUARE_MIN = 1.5;

/**
 * The hem's first control point, leaving the foot of a sloping side seam square to it, toward the centre. Off a
 * flared seam, square points a little downward, so the handle is kept short enough that it stays on or above `level`,
 * the hem's own level (but for its first 1.5 cm, a dip of a millimetre or two): a long one carried the hem below the centre between the centre and the side seam, a dip of
 * 1 to 3 cm on the body.
 */
export function squareHem(hip: P, hem: P, level = Infinity): P {
  const d = unit(sub(hem, hip));
  // (Never shorter than SQUARE_MIN: where a front's centre is cut higher than its side, the hem still has to leave the
  // seam square before it climbs, or front and back meet in a point at the side seam.)
  const most = d.x > 1e-6 ? Math.max(SQUARE_MIN, Math.max(0, level - hem.y) / d.x) : Infinity;
  return add(hem, mul(p(-d.y, d.x), Math.min(hem.x * 0.35, most)));
}
