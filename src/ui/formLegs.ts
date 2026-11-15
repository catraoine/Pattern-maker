// The All round form's legs, shaped as a leg is rather than as a round tube. A tube tapering evenly from thigh to
// ankle read as a dress form's stand, not a body (Cat asked whether the legs look real, 2026-11-11, and asked for
// real legs, 2026-11-15). Here the leg keeps the form's own girth at every height (LEG, which the trousers are cut
// round too), and on it the shapes the eye knows a leg by: the thigh full at the front, the knee cap and the inner
// knee, the hollow behind the knee, the calf standing out behind and inside, the shin flat at the front, the
// ankle's bones and the narrow back above the heel. The knees also come in toward each other, as they do on a body
// standing with its feet a little apart. All in the form's own units, each shape a few mm at the size drawn: a
// shape and no more, so the cloth hanging over the legs still clears them.
import { LEG, LEG_KNEE, LEG_X } from '../engine/form';

type V3 = [number, number, number];

/** A gentle hump at y0, w wide. */
const hump = (y: number, y0: number, w: number) => Math.exp(-(((y - y0) / w) ** 2));
const smooth = (y: number, y0: number, y1: number) => {
  const u = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  return u * u * (3 - 2 * u);
};

/** How far in toward the other leg the knees come. */
const KNEES_IN = 0.035;

/** Where a leg's middle stands across the body at height y (`leg` -1 or 1). */
function legAxis(leg: number, y: number, kneesIn: boolean): number {
  return leg * (LEG_X - (kneesIn ? KNEES_IN * smooth(y, 1.5, LEG_KNEE - 0.1) : 0));
}

/** A point on the form's leg at angle a round it (0 is the front, `leg` -1 or 1 its side) and height y. Under trousers
 *  the knees stay where the trouser legs are cut round them (`kneesIn` false): come in, the leg stood out of a slim
 *  trouser leg's inside just above its hem. */
export function legPoint(leg: number, a: number, y: number, kneesIn = true): V3 {
  const front = Math.cos(a);
  const out = Math.sin(a) * leg;
  const fr = Math.max(0, front);
  const bk = Math.max(0, -front);
  const inner = Math.max(0, -out);
  const outer = Math.max(0, out);
  const k = LEG_KNEE;
  let r = LEG(y);
  // Above the knee: the thigh's front muscle full, the inner knee's rounded just above the joint.
  r += 0.02 * hump(y, k - 0.75, 0.4) * fr;
  r += 0.022 * hump(y, k - 0.12, 0.12) * inner;
  // The knee: its cap at the front, the hollow behind.
  r += 0.028 * hump(y, k, 0.09) * fr * fr;
  r -= 0.014 * hump(y, k + 0.02, 0.1) * bk;
  // The calf: out behind, lower and fuller on the inside than the outside.
  r += 0.055 * hump(y, k + 0.5, 0.3) * bk ** 1.5;
  r += 0.022 * hump(y, k + 0.55, 0.25) * inner;
  r += 0.014 * hump(y, k + 0.4, 0.2) * outer;
  // The shin flat at the front.
  r -= 0.012 * hump(y, k + 0.75, 0.45) * fr;
  // The ankle: its bones either side, and the narrow back above the heel.
  r += 0.014 * hump(y, 4.5, 0.06) * Math.abs(out);
  r -= 0.016 * hump(y, 4.3, 0.18) * bk;
  return [legAxis(leg, y, kneesIn) + Math.sin(a) * r, y, front * r];
}
