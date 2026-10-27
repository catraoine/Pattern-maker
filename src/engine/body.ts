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

/** A smooth curve through evenly spaced samples, read between sample i and i + 1 at fraction u: a cubic that keeps the
 *  samples' own rise and fall (Fritsch and Carlson's), so it never overshoots them. Read in straight runs from sample
 *  to sample, the body's rings kinked at every sample, which showed as scallops along a neckline laid on them. */
function smoothAt(v: number[], i: number, u: number): number {
  if (!u) return v[i];
  const n = v.length;
  const d0 = v[i + 1] - v[i];
  const slope = (k: number) => {
    const a = k > 0 ? v[k] - v[k - 1] : d0;
    const b = k < n - 1 ? v[k + 1] - v[k] : d0;
    // Where the samples turn, the curve is flat; otherwise their two steps' harmonic mean, so a short step wins.
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  };
  const m0 = slope(i);
  const m1 = slope(i + 1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * m1;
}

function halfExact(y: number): number {
  const [i, u] = rowAt(y);
  return smoothAt(BODY_HALF, i, u);
}

// The smooth curves are read into fine tables once (FINE steps to each sample) and read between their entries after,
// since All round reads the body tens of thousands of times a frame: a cubic at every read made it turn slowly.
const FINE = 4;
const ROWS = BODY_YS.length;
const FINE_ROWS = (ROWS - 1) * FINE + 1;
const FINE_ANGLES = (BODY_ANGLES - 1) * FINE + 1;
let fineHalf: Float32Array | undefined;
let fineShape: Float32Array | undefined;
function fineRow(y: number): [number, number] {
  if (y <= BODY_YS[0]) return [0, 0];
  if (y >= BODY_YS[ROWS - 1]) return [FINE_ROWS - 1, 0];
  const f = ((y - BODY_YS[0]) / (BODY_YS[ROWS - 1] - BODY_YS[0])) * (FINE_ROWS - 1);
  const i = Math.min(FINE_ROWS - 2, Math.floor(f));
  return [i, f - i];
}

/** Half-width of the body from the neck (top) to below the hip (bottom), in the form's own units (waist at 0.1):
 *  the neck rising out of the trapezius, shoulders sloping to the tip, the chest, the waist and the hip. */
export function bodyHalf(y: number): number {
  if (!fineHalf) {
    fineHalf = new Float32Array(FINE_ROWS);
    for (let r = 0; r < FINE_ROWS; r++) fineHalf[r] = halfExact(BODY_YS[0] + ((BODY_YS[ROWS - 1] - BODY_YS[0]) * r) / (FINE_ROWS - 1));
  }
  const [i, u] = fineRow(y);
  return u ? fineHalf[i] + (fineHalf[i + 1] - fineHalf[i]) * u : fineHalf[i];
}

/** The shoulder tip on the body (the form's units); the side of the neck meets the shoulder at -1.47. */
export const SHOULDER_TIP_Y = -1.34;
/** Where the body's rings start (just under the chin) and end (below the hip). */
export const BODY_TOP = BODY_YS[0];
export const BODY_BOTTOM = BODY_YS[BODY_YS.length - 1];

/** The body's cross-section at height y: how far its surface lies from the centre line at angle a round it (0 = straight
 *  ahead, a half turn = straight behind), as a share of its half-width there (1 at the sides). The real body's own
 *  shape: the bust standing forward in two soft mounds, the flat upper back, the seat behind the hip. */
function shapeExact(a: number, y: number): number {
  const [i, u] = rowAt(y);
  const t = (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / Math.PI) * (BODY_ANGLES - 1);
  const k = Math.min(BODY_ANGLES - 2, Math.floor(t));
  const v = t - k;
  // Round the body, each ring is read a touch softened over its neighbouring samples (about 4 degrees each way): the
  // rings are convex hulls of the mesh, whose corners showed as scallops along a neckline laid over them.
  const ring = (row: number[]) => {
    const here = smoothAt(row, k, v);
    const before = k > 0 ? smoothAt(row, k - 1, v) : here;
    const after = k < BODY_ANGLES - 2 ? smoothAt(row, k + 1, v) : here;
    return 0.5 * here + 0.25 * (before + after);
  };
  const s0 = ring(BODY_SHAPE[i]);
  if (!u) return s0;
  const s1 = ring(BODY_SHAPE[i + 1]);
  // Between rows, the same smooth curve down the body: the rows above and below lend their rise and fall.
  const col = (r: number) => (r < 0 || r >= BODY_SHAPE.length ? NaN : ring(BODY_SHAPE[r]));
  const vals = [col(i - 1), s0, s1, col(i + 2)];
  if (Number.isNaN(vals[0])) vals[0] = 2 * s0 - s1;
  if (Number.isNaN(vals[3])) vals[3] = 2 * s1 - s0;
  return smoothAt(vals, 1, u);
}

export function shapeAt(a: number, y: number): number {
  if (!fineShape) {
    fineShape = new Float32Array(FINE_ROWS * FINE_ANGLES);
    for (let r = 0; r < FINE_ROWS; r++) {
      const y0 = BODY_YS[0] + ((BODY_YS[ROWS - 1] - BODY_YS[0]) * r) / (FINE_ROWS - 1);
      for (let k = 0; k < FINE_ANGLES; k++) fineShape[r * FINE_ANGLES + k] = shapeExact((Math.PI * k) / (FINE_ANGLES - 1), y0);
    }
  }
  const [i, u] = fineRow(y);
  const t = (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / Math.PI) * (FINE_ANGLES - 1);
  const k = Math.min(FINE_ANGLES - 2, Math.floor(t));
  const v = t - k;
  const row = (r: number) => fineShape![r * FINE_ANGLES + k] * (1 - v) + fineShape![r * FINE_ANGLES + k + 1] * v;
  const s0 = row(i);
  return u ? s0 + (row(i + 1) - s0) * u : s0;
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
