// The app's dress form: one profile shared by every place that shows a body, so the form looks the same
// on the welcome screen, the measuring pages, the 3D body export and the 3D shape preview.

/** Smooth curve through keypoints (Catmull-Rom). */
export function spline(keys: [number, number][]) {
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

// Half-width of the form from neck (top) to hip (bottom); the waist sits at y = 0.1. A dressmaker's form
// (Cat's pick N1): a short, full neck and broad, nearly level shoulders that round off at the arm.
export const R = spline([
  [-1.75, 0.15], [-1.55, 0.155], [-1.47, 0.17], [-1.43, 0.25], [-1.38, 0.42], [-1.32, 0.52], [-1.22, 0.57],
  [-1.05, 0.58], [-0.8, 0.59], [-0.55, 0.61],
  [-0.3, 0.53], [-0.05, 0.45], [0.1, 0.43], [0.3, 0.49], [0.55, 0.61], [0.8, 0.65], [1.05, 0.63], [1.3, 0.58],
]);

/** Where the form starts (top of the neck) and ends (below the hip), in the profile's own units. */
export const FORM_TOP = -1.66;
export const FORM_BOTTOM = 1.3;

/** Where each girth belongs on the form, read off its outline: bust is the widest point above the waist,
 *  waist the narrowest, hip the widest below. The tapes are tested against these so a drawing can't drift. */
export function formLandmarks(): Record<'full_bust' | 'waist' | 'full_hip', number> {
  const find = (a: number, b: number, better: (r: number, best: number) => boolean) => {
    let at = a;
    for (let y = a; y <= b; y += 0.001) if (better(R(y), R(at))) at = y;
    return at;
  };
  return {
    full_bust: find(-1.1, -0.2, (r, b) => r > b),
    waist: find(-0.3, 0.5, (r, b) => r < b),
    full_hip: find(0.4, 1.3, (r, b) => r > b),
  };
}

/** The form's legs, as on the measuring pages: each leg's half-width down from the top of the thigh (the
 *  form's own units), the legs standing LEG_X either side of the centre. */
export const LEG = spline([[1.2, 0.3], [1.6, 0.28], [2.3, 0.21], [3.15, 0.15], [3.4, 0.16], [4.1, 0.12], [4.55, 0.08], [4.7, 0.1]]);
export const LEG_X = 0.27;
/** The knee and the floor on the form, in its own units. */
export const LEG_KNEE = 3.2;
export const LEG_FLOOR = 4.72;
/** Where the legs part: the height at which each leg's inner edge reaches the centre. */
export const LEG_CROTCH = (() => {
  let y = 1.2;
  while (y < LEG_KNEE && LEG(y) > LEG_X) y += 0.001;
  return y;
})();

export interface LegMeasurements {
  full_hip: number;
  waist_to_hip: number;
  waist_to_knee: number;
  waist_to_floor: number;
  crotch_depth?: number;
}

/** A pair of legs drawn to your measurements, in cm down from the waist (y = 0), widths in the way the
 *  form draws the body (half of each width a quarter of its round). */
export interface Legs {
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
