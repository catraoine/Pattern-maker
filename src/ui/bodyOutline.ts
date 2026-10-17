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


export function bodyOutline(m: SkirtMeasurements, cx: number): string {
  const hs = m.full_hip / 4;
  const crotch = m.waist_to_hip + 7;
  const knee = m.waist_to_knee;
  const floor = m.waist_to_floor;
  // Each leg: its half-width and how far its centre sits from the middle.
  const leg = spline([[crotch, 0.5 * hs], [crotch + (knee - crotch) * 0.5, 0.4 * hs], [knee, 0.27 * hs], [knee + (floor - knee) * 0.35, 0.3 * hs], [floor - 7, 0.15 * hs], [floor, 0.17 * hs]]);
  const legAt = spline([[crotch, 0.47 * hs], [knee, 0.36 * hs], [floor, 0.3 * hs]]);
  const ys = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const pts = (list: [number, number][]) => list.map(([x, y], i) => `${i ? 'L' : 'M'}${(cx + x).toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const outer = (s: number) => ys(crotch, floor, 40).map((y) => [s * (legAt(y) + leg(y)), y] as [number, number]);
  const inner = (s: number) => ys(crotch, floor, 40).map((y) => [s * Math.max(0.4, legAt(y) - leg(y)), y] as [number, number]);
  // Only the legs: the skirt always covers the hips, and a full skirt is drawn narrower there than you are.
  return [
    pts(outer(1)),
    pts(outer(-1)),
    pts(inner(1)),
    pts(inner(-1)),
  ].join(' ');
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
