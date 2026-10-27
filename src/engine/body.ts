// The real body under the garment (Cat, 2026-10-27: "a real body"): MakeHuman's base body (CC0), the young female
// average, trimmed to a dress form's torso, read as rings at every height of the app's form (bodyShape.ts) and scaled
// so each ring measures the example body's girths. All round draws its cloth on it, the 3D body export is built from
// it and the Form/Draw figure follows it. The welcome screen and the measuring pages keep the form in form.ts.
import { BODY_ANGLES, BODY_HALF, BODY_SHAPE, BODY_YS } from './bodyShape';

/** Where on the table a height falls: the row below it and how far toward the next. */
function rowAt(y: number): [number, number] {
  const n = BODY_YS.length;
  if (y <= BODY_YS[0]) return [0, 0];
  if (y >= BODY_YS[n - 1]) return [n - 1, 0];
  const f = ((y - BODY_YS[0]) / (BODY_YS[n - 1] - BODY_YS[0])) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  return [i, f - i];
}

/** Half-width of the body from the neck (top) to below the hip (bottom), in the form's own units (waist at 0.1):
 *  the neck rising out of the trapezius, shoulders sloping to the tip, the chest, the waist and the hip. */
export function bodyHalf(y: number): number {
  const [i, u] = rowAt(y);
  return u ? BODY_HALF[i] + (BODY_HALF[i + 1] - BODY_HALF[i]) * u : BODY_HALF[i];
}

/** The shoulder tip on the body (the form's units); the side of the neck meets the shoulder at -1.47. */
export const SHOULDER_TIP_Y = -1.34;
/** Where the body's rings start (just under the chin) and end (below the hip). */
export const BODY_TOP = BODY_YS[0];
export const BODY_BOTTOM = BODY_YS[BODY_YS.length - 1];

/** The body's cross-section at height y: how far its surface lies from the centre line at angle a round it (0 = straight
 *  ahead, a half turn = straight behind), as a share of its half-width there (1 at the sides). The real body's own
 *  shape: the bust standing forward in two soft mounds, the flat upper back, the seat behind the hip. */
export function shapeAt(a: number, y: number): number {
  const [i, u] = rowAt(y);
  const t = (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / Math.PI) * (BODY_ANGLES - 1);
  const k = Math.min(BODY_ANGLES - 2, Math.floor(t));
  const v = t - k;
  const row = (r: number[]) => r[k] + (r[k + 1] - r[k]) * v;
  const s0 = row(BODY_SHAPE[i]);
  return u ? s0 + (row(BODY_SHAPE[i + 1]) - s0) * u : s0;
}

/** How far from the centre line the body's surface lies at height y and angle a round it, for a body `half` wide there. */
export function reach(half: number, a: number, y: number): number {
  return half * shapeAt(a, y);
}

/** The body's depth at height y, forward (`front`) or back, as a share of its half-width there. */
export function depthShare(y: number, front: boolean): number {
  return shapeAt(front ? 0 : Math.PI, y);
}

/** Where each girth belongs on the body: bust where it stands furthest forward above the waist (the apex), waist the
 *  narrowest, hip the widest below. */
export function bodyLandmarks(): Record<'full_bust' | 'waist' | 'full_hip', number> {
  const find = (a: number, b: number, of: (y: number) => number, better: (r: number, best: number) => boolean) => {
    let at = a;
    for (let y = a; y <= b; y += 0.001) if (better(of(y), of(at))) at = y;
    return at;
  };
  return {
    full_bust: find(-1.1, -0.2, (y) => reach(bodyHalf(y), 0, y), (r, b) => r > b),
    waist: find(-0.3, 0.5, bodyHalf, (r, b) => r < b),
    full_hip: find(0.4, 1.3, bodyHalf, (r, b) => r > b),
  };
}
