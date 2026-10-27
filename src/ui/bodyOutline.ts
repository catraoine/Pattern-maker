// A faint outline of the wearer's legs, drawn behind the sketch so you can see
// where the skirt sits and where its hem falls on you. Widths follow the sketch's own convention
// (a quarter of the round measurement), so the body and the skirt read at the same scale.
import type { SkirtMeasurements } from '../engine/skirt';

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
