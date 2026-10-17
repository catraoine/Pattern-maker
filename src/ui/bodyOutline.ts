// A faint outline of the wearer's legs, drawn behind the sketch so you can see
// where the skirt sits and where its hem falls on you. Widths follow the sketch's own convention
// (a quarter of the round measurement), so the body and the skirt read at the same scale.
import { spline } from './TurnFigure';
import type { SkirtMeasurements } from '../engine/skirt';

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
