// The cloth settling on the body: pieces as springs of their own cut lengths, seams drawn together, the body and arms
// holding the cloth out, gravity hanging what is left free (position-based dynamics: each step moves the points, then
// nudges them till every length, seam and contact holds).
import { Space } from './space';

export interface SimInput {
  pos: Float64Array; // x, c, z for each point
  /** Pairs of points and the cloth's length between them: its edges, then (softer) across each pair of triangles. */
  edges: Int32Array;
  rest: Float64Array;
  bends: Int32Array;
  bendRest: Float64Array;
  /** Point i sewn to the point t of the way from j to k. */
  seams: { i: number; j: number; k: number; t: number }[];
  /** Points held on the centre plane (x = 0): a fold, a centre seam, the buttoned front. */
  centre: Int32Array;
  /** How far off the body each point lies: the cloth's thickness, more for a layer lying over another. */
  thick: Float64Array;
  /** Points stopped from coming in past the body's centre line (x below 0). */
  side: Uint8Array;
  /** Points of a sleeve: held by the arm, not the body. */
  onArm: Uint8Array;
  /** How stiff each bend is, as a share of bendK (a lapel or collar is interfaced: stiffer). */
  bendW?: Float64Array;
  /** Points of cloth turned back over itself (a lapel, a collar's fall): pressed flat onto the cloth under them. */
  pressed?: Uint8Array;
  /** A shoulder pad's height, in cm: the shoulder stands up this much more under the body's cloth. */
  pad?: number;
  /** Points of the shoulder seams: they rest on the top of the shoulder, as a dressmaker pins a garment to the form. */
  shoulder?: Int32Array;
  /** Trouser legs: below the crotch the cloth lies on two legs, not the body. */
  legs?: { x: number; c0: number; c1: number; r0: number; r1: number };
  /** Points held from dropping below these levels (a skirt's waist, a strapless top edge). */
  hang?: { ids: Int32Array; c: Float64Array };
  /** Sleeve points kept round the arm at their own sleeve's radius (cloth with body holds a tube's shape, it does not
   *  fold flat at its seams). */
  round?: { ids: Int32Array; R: Float64Array; k: number };
  bendK: number;
}

export function simulate(s: Space, inp: SimInput, steps = (globalThis as any).__steps ?? 260, iters = 14): Float64Array {
  const n = inp.pos.length / 3;
  const x = Float64Array.from(inp.pos);
  const prev = Float64Array.from(inp.pos);
  const dt = 1 / 90;
  // A light pull down: enough to hang what is free (a peplum, a sleeve) while the cloth holds its cut lengths.
  const g = 300 * dt * dt * ((globalThis as any).__g ?? 1);
  const { edges, rest, bends, bendRest, seams, centre, thick } = inp;
  const ne = rest.length;
  const nb = bendRest.length;
  const arm = s.arm;
  const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
  const abL2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;

  const dist = (k: number, a: number, b: number, L: number) => {
    const ia = a * 3;
    const ib = b * 3;
    const dx = x[ib] - x[ia];
    const dy = x[ib + 1] - x[ia + 1];
    const dz = x[ib + 2] - x[ia + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    const f = (k * (d - L)) / d / 2;
    x[ia] += dx * f;
    x[ia + 1] += dy * f;
    x[ia + 2] += dz * f;
    x[ib] -= dx * f;
    x[ib + 1] -= dy * f;
    x[ib + 2] -= dz * f;
  };

  const collide = (i: number, fr: number) => {
    const I = i * 3;
    const px = x[I];
    const pc = x[I + 1];
    const pz = x[I + 2];
    const t = thick[i];
    // The body.
    const rho = Math.hypot(px, pz) || 1e-9;
    const a = Math.atan2(px, pz);
    const R = s.bodyR(a, pc) + t;
    let hit = false;
    const L = inp.legs;
    if (L && pc > L.c0) {
      const u = Math.max(0, Math.min(1, (pc - L.c0) / (L.c1 - L.c0)));
      const rr = L.r0 + (L.r1 - L.r0) * u + t;
      const e = px >= 0 ? 1 : -1;
      const dx = px - e * L.x;
      const d = Math.hypot(dx, pz) || 1e-9;
      if (d < rr) {
        x[I] = e * L.x + (dx / d) * rr;
        x[I + 2] = (pz / d) * rr;
        hit = true;
      }
    } else if (!inp.onArm[i] && rho < R) {
      // Out along the surface's own normal: on a sloping shoulder that is up as much as out, so the cloth rests on it.
      const gc = (s.bodyR(a, pc + 0.5) - s.bodyR(a, pc - 0.5)) / 1;
      const pen = (R - rho) / (1 + gc * gc);
      x[I] = px + (px / rho) * pen;
      x[I + 2] = pz + (pz / rho) * pen;
      x[I + 1] = pc - gc * pen;
      hit = true;
    }
    // The arms, one each side.
    for (const e of [1, -1]) {
      const qx = x[I] * e;
      const rx = qx - arm.a[0];
      const ry = x[I + 1] - arm.a[1];
      const rz = x[I + 2] - arm.a[2];
      let u = (rx * ab[0] + ry * ab[1] + rz * ab[2]) / abL2;
      // The body's own cloth meets only the top of the arm (the shoulder, where a jacket's shoulders rest).
      u = Math.max(0, Math.min(inp.onArm[i] ? 1 : 0, u));
      const cx = arm.a[0] + ab[0] * u;
      const cy = arm.a[1] + ab[1] * u;
      const cz = arm.a[2] + ab[2] * u;
      const dx = qx - cx;
      const dy = x[I + 1] - cy;
      const dz = x[I + 2] - cz;
      const d = Math.hypot(dx, dy, dz) || 1e-9;
      // A shoulder pad squares the top of the arm for the sleeve head as well as the shoulder.
      const rr = arm.r0 + (arm.r1 - arm.r0) * u + t + (inp.pad ?? 0) * (inp.onArm[i] ? Math.max(0, 1 - u / 0.12) : 1);
      if (d < rr) {
        const k = rr / d;
        x[I] = (cx + dx * k) * e;
        x[I + 1] = cy + dy * k;
        x[I + 2] = cz + dz * k;
        hit = true;
      }
    }
    // Friction: a point on the body keeps most of where it was along the surface.
    if (hit && fr > 0) {
      x[I] += (prev[I] - x[I]) * fr;
      x[I + 1] += (prev[I + 1] - x[I + 1]) * fr * 0.6;
      x[I + 2] += (prev[I + 2] - x[I + 2]) * fr;
    }
  };

  for (let step = 0; step < steps; step++) {
    const ramp = Math.min(1, 0.05 + step / (steps * 0.35));
    for (let i = 0; i < n; i++) {
      const I = i * 3;
      const damp = 0.9;
      const vx = (x[I] - prev[I]) * damp;
      const vy = (x[I + 1] - prev[I + 1]) * damp;
      const vz = (x[I + 2] - prev[I + 2]) * damp;
      prev[I] = x[I];
      prev[I + 1] = x[I + 1];
      prev[I + 2] = x[I + 2];
      x[I] += vx;
      x[I + 1] += vy + g * ramp;
      x[I + 2] += vz;
      if (inp.pressed?.[i]) {
        // Pressed in toward the body (the cloth under it holds it off by its thickness).
        x[I] *= 0.985;
        x[I + 2] *= 0.985;
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < ne; e++) dist(1, edges[2 * e], edges[2 * e + 1], rest[e]);
      for (let e = 0; e < nb; e++) dist(inp.bendK * (inp.bendW ? inp.bendW[e] : 1), bends[2 * e], bends[2 * e + 1], bendRest[e]);
      for (const { i, j, k, t } of seams) {
        const I = i * 3;
        const J = j * 3;
        const K = k * 3;
        for (let d = 0; d < 3; d++) {
          const target = x[J + d] * (1 - t) + x[K + d] * t;
          const diff = (target - x[I + d]) * ramp;
          // Point i takes half the move; the two it is sewn between share the other half by how near each is.
          x[I + d] += diff * 0.5;
          x[J + d] -= diff * 0.5 * (1 - t);
          x[K + d] -= diff * 0.5 * t;
        }
      }
      for (let c = 0; c < centre.length; c++) x[centre[c] * 3] = 0;
      if (inp.hang) for (let k = 0; k < inp.hang.ids.length; k++) {
        const I = inp.hang.ids[k] * 3 + 1;
        if (x[I] > inp.hang.c[k]) x[I] = inp.hang.c[k];
      }
      if (inp.shoulder) {
        for (let k = 0; k < inp.shoulder.length; k++) {
          const I = inp.shoulder[k] * 3;
          const top = s.ridge(Math.abs(x[I])) - thick[inp.shoulder[k]] - (inp.pad ?? 0);
          if (x[I + 1] > top) x[I + 1] = top;
        }
      }
      if (inp.round && it % 2 === 0) {
        const { ids, R, k } = inp.round;
        for (let q = 0; q < ids.length; q++) {
          const I = ids[q] * 3;
          const rx = x[I] - arm.a[0];
          const ry = x[I + 1] - arm.a[1];
          const rz = x[I + 2] - arm.a[2];
          const u = Math.max(0, (rx * ab[0] + ry * ab[1] + rz * ab[2]) / abL2);
          const dx = rx - ab[0] * u;
          const dy = ry - ab[1] * u;
          const dz = rz - ab[2] * u;
          const d = Math.hypot(dx, dy, dz) || 1e-9;
          const f = ((R[q] - d) / d) * k * ramp * (d < R[q] ? 1 : 0.4);
          x[I] += dx * f;
          x[I + 1] += dy * f;
          x[I + 2] += dz * f;
        }
      }
      for (let i = 0; i < n; i++) {
        if (inp.side[i] && x[i * 3] < 0) x[i * 3] = 0;
        collide(i, it === iters - 1 ? (globalThis as any).__fr ?? 0.3 : 0);
      }
    }
  }
  return x;
}
