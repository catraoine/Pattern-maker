// A faint outline of the wearer's legs, drawn behind the sketch so you can see
// where the skirt sits and where its hem falls on you. Widths follow the sketch's own convention
// (a quarter of the round measurement), so the body and the skirt read at the same scale.
import type { SkirtMeasurements } from '../engine/skirt';

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


// The legs are drawn like a fashion sketch: slim, with a knee and a calf, standing on pointed heels
// whose tips touch the floor line. Each point is [where down the leg, distance from the middle]:
// above the knee the first number runs 0 (crotch) to 1 (knee), below it 1 (knee) to 2 (floor);
// widths are fractions of a quarter of the hip.
const OUTER: [number, number][] = [[0, 0.72], [0.5, 0.64], [1, 0.52], [1.24, 0.56], [1.54, 0.47], [1.79, 0.32], [1.84, 0.3]];
const INNER: [number, number][] = [[0, 0.08], [0.5, 0.12], [1, 0.17], [1.2, 0.15], [1.54, 0.18], [1.79, 0.22], [1.84, 0.23]];
const HEEL: [number, number][] = [[1.93, 0.3], [2, 0.27], [1.93, 0.23]];

/** Smooth path through points (Catmull-Rom as cubic Béziers), without the leading M. */
function through(p: [number, number][]): string {
  let d = '';
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], e = p[Math.min(i + 2, p.length - 1)];
    const n = (v: number) => v.toFixed(2);
    d += ` C${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)} ${n(c[0] - (e[0] - b[0]) / 6)} ${n(c[1] - (e[1] - b[1]) / 6)} ${n(c[0])} ${n(c[1])}`;
  }
  return d;
}

export function bodyOutline(m: SkirtMeasurements, cx: number): string {
  const hs = m.full_hip / 4;
  const crotch = m.waist_to_hip + 7;
  const knee = m.waist_to_knee;
  const floor = m.waist_to_floor;
  const y = (t: number) => (t <= 1 ? crotch + t * (knee - crotch) : knee + (t - 1) * (floor - knee));
  // Only the legs: the skirt is drawn over them, so they show below its hem.
  return [1, -1]
    .map((s) => {
      const at = ([t, w]: [number, number]): [number, number] => [cx + s * w * hs, y(t)];
      const outer = OUTER.map(at);
      const inner = INNER.map(at).reverse();
      const heel = HEEL.map(at);
      const pt = (q: [number, number]) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
      return `M${pt(outer[0])}${through(outer)} ${heel.map((q) => `L${pt(q)}`).join(' ')} L${pt(inner[0])}${through(inner)} Z`;
    })
    .join(' ');
}

/**
 * A faint outline of the wearer round a bodice sketch: the neck above it, the arms hanging at its
 * sides, and the body below its hem. The bodice is drawn over it, so only what shows past the bodice
 * is seen. `top` is the bodice's own outline, centre neck round to the underarm.
 */
export function bodiceBodyOutline(
  m: { waist: number; full_bust: number; armscye?: number; full_hip?: number; waist_to_hip?: number },
  top: { pts: { x: number; y: number }[]; tags: (string | undefined)[] },
  waistY: number,
  bottom: number,
  cx: number,
): string {
  const at = (tag: string) => top.pts[Math.max(0, top.tags.indexOf(tag))];
  const hps = at('shoulder');
  const tip = at('armhole');
  const under = at('side');
  const arm = 0.24 * (m.armscye ?? 0.43 * m.full_bust);
  const ys = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const line = (list: [number, number][]) => [1, -1].map((s) => list.map(([x, y], i) => `${i ? 'L' : 'M'}${(cx + s * x).toFixed(2)} ${y.toFixed(2)}`).join(' ')).join(' ');
  const neck = line([[hps.x * 0.8, hps.y + 1], [hps.x * 0.75, -12]]);
  // The arm falls from the shoulder, rounding over the top, and hangs a little away from the body.
  const outer = ys(tip.y, bottom, 30).map((y) => {
    const t = Math.min(1, (y - tip.y) / Math.max(1, under.y - tip.y));
    return [under.x + arm * Math.sin((t * Math.PI) / 2) * 0.95 + (tip.x - under.x) * (1 - t) ** 2 + 0.04 * (y - under.y > 0 ? y - under.y : 0), y] as [number, number];
  });
  const inner = ys(under.y, bottom, 10).map((y) => [under.x + 0.6 + 0.04 * (y - under.y), y] as [number, number]);
  const hip = m.full_hip && m.waist_to_hip ? spline([[waistY - 8, m.full_bust / 4 * 0.95], [waistY, m.waist / 4], [waistY + m.waist_to_hip * 0.5, (m.waist + m.full_hip) / 8 + 0.4], [waistY + m.waist_to_hip, m.full_hip / 4], [waistY + m.waist_to_hip + 20, m.full_hip / 4]]) : () => m.waist / 4;
  const torso = ys(waistY - 8, bottom, 20).map((y) => [hip(y), y] as [number, number]);
  return [neck, line(outer), line(inner), line(torso)].join(' ');
}
