// The app's dress form: one profile shared by every place that shows a body, so the form looks the same
// on the welcome screen, the measuring pages, the 3D body export and the 3D shape preview.

/** Smooth curve through keypoints (Catmull-Rom). */
function spline(keys: [number, number][]) {
  return (y: number) => {
    const n = keys.length;
    if (y <= keys[0][0]) return keys[0][1];
    if (y >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (keys[i + 1][0] < y) i++;
    const p0 = keys[Math.max(i - 1, 0)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, n - 1)];
    const d = p2[0] - p1[0], u = (y - p1[0]) / d;
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * d;
    const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * d;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
}

/** The form's legs, as on the measuring pages: each leg's half-width down from the top of the thigh (the
 *  form's own units), the legs standing LEG_X either side of the centre. */
export const LEG = spline([[1.2, 0.3], [1.6, 0.28], [2.1, 0.215], [2.65, 0.15], [2.9, 0.16], [3.8, 0.12], [4.55, 0.08], [4.7, 0.1]]);
export const LEG_X = 0.27;
/** The knee and the floor on the form, in its own units. The knee is about 58 cm below the waist on the form's
 *  166 cm (0.35 of the height), as on a real body. */
export const LEG_KNEE = 2.7;
export const LEG_FLOOR = 4.72;
/** Where the legs part: the height at which each leg's inner edge reaches the centre. */
export const LEG_CROTCH = (() => {
  let y = 1.2;
  while (y < LEG_KNEE && LEG(y) > LEG_X) y += 0.001;
  return y;
})();

interface LegMeasurements {
  full_hip: number;
  waist_to_hip: number;
  waist_to_knee: number;
  waist_to_floor: number;
  crotch_depth?: number;
}

/** A pair of legs drawn to your measurements, in cm down from the waist (y = 0), widths in the way the
 *  form draws the body (half of each width a quarter of its round). */
interface Legs {
  /** Where the legs part, the knee and the floor. */
  crotch: number;
  knee: number;
  floor: number;
  /** How far each leg's middle stands from the centre. */
  apart: number;
  /** Each leg's half-width at y. */
  half: (y: number) => number;
}

/** The form's legs, the same shape as on the measuring pages, set to your lengths: they part at your
 *  crotch depth (or a little below your hip, when it isn't measured), bend at your knee and stand on the
 *  floor at your waist to floor; at the top they are as wide as your hip. */
export function legsFor(m: LegMeasurements): Legs {
  const knee = m.waist_to_knee;
  const floor = m.waist_to_floor;
  const crotch = Math.min(m.crotch_depth ?? m.waist_to_hip + 7, knee - 12);
  // Down the leg, the form's own heights to cm: the crotch, the knee and the floor land on yours.
  const marks: [number, number][] = [[LEG_CROTCH, crotch], [LEG_KNEE, knee], [LEG_FLOOR, floor]];
  const toForm = (y: number) => {
    const i = y < knee ? 0 : 1;
    const [[a, ya], [b, yb]] = [marks[i], marks[i + 1]];
    return a + ((y - ya) * (b - a)) / (yb - ya);
  };
  // At the top, the outside of each leg runs on from the hip.
  const s = ((m.full_hip / 4) * 0.97) / (LEG_X + LEG(LEG_CROTCH));
  return { crotch, knee, floor, apart: LEG_X * s, half: (y: number) => LEG(toForm(y)) * s };
}
