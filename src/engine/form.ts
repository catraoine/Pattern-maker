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
