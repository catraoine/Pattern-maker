import type { Space } from './space';

/** The length of a quarter of the ring at a level, from the centre front (or back) to the side, this far out from the body. */
export function quarterArc(sp: Space, c: number, back: boolean, off: number): number {
  const n = 80;
  let t = 0;
  let prev: [number, number] | undefined;
  for (let k = 0; k <= n; k++) {
    const a = back ? Math.PI - (Math.PI / 2) * (k / n) : (Math.PI / 2) * (k / n);
    const r = sp.bodyR(a, c) + off;
    const cur: [number, number] = [Math.sin(a) * r, Math.cos(a) * r];
    if (prev) t += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    prev = cur;
  }
  return t;
}
