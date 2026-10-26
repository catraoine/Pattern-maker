// Dart finishing: true the legs to equal length and shape the seam line over the dart.
import { P, add, len, mul, p, sub, unit } from './geometry';

interface Dart {
  tip: P;
  /** Leg end on the side the dart is pressed toward (centre for waist darts, down for bust darts). */
  near: P;
  /** The other leg end. */
  far: P;
  /** Seam-line point on the dart's centre line. Folding the dart lays this onto the seam line. */
  peak: P;
}

function intersect(a: P, u: P, b: P, v: P): P | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.x - a.x) * v.y - (b.y - a.y) * v.x) / den;
  return add(a, mul(u, t));
}

/** Reflect vector v across the line through the origin with direction u. */
function reflect(v: P, u: P): P {
  const k = 2 * (v.x * u.x + v.y * u.y);
  return sub(mul(u, k), v);
}

/**
 * True a dart and find its peak.
 *
 * Legs are made equal length by extending the shorter one, so they sew together end to end.
 * The peak is found the way a pattern cutter does it by hand: with the dart folded and pressed
 * toward `near`, the seam line carries straight on across it. `away` is the direction the seam
 * line leaves `near` on the pressed side; reflecting it across the near leg gives the edge of the
 * folded intake, which meets the dart's centre line at the peak.
 */
export function finishDart(tip: P, near: P, far: P, away: P): Dart {
  const legLen = Math.max(len(sub(near, tip)), len(sub(far, tip)));
  const n = add(tip, mul(unit(sub(near, tip)), legLen));
  const f = add(tip, mul(unit(sub(far, tip)), legLen));
  const mid = p((n.x + f.x) / 2, (n.y + f.y) / 2);
  const edge = reflect(unit(away), unit(sub(n, tip)));
  const peak = intersect(n, edge, tip, unit(sub(mid, tip))) ?? mid;
  // A peak behind the tip or wildly far out means a degenerate dart; fall back to a straight seam.
  const ok = len(sub(peak, mid)) < legLen * 0.5;
  return { tip, near: n, far: f, peak: ok ? peak : mid };
}
