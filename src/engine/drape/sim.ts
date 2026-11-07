// The cloth settling on the body: pieces as springs of their own cut lengths, seams drawn together, the body and arms
// holding the cloth out, gravity hanging what is left free (position-based dynamics: each step moves the points, then
// nudges them till every length, seam and contact holds).
import { Space } from './space';
import { knob } from './knob';

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
  /** Where across each centre point is held (x), when not on the centre plane itself: a front left parted below its button. */
  centreX?: Float64Array;
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
  /** The body's own cloth never meets the arm (a sleeveless garment: nothing rests on the arm). */
  armFree?: boolean;
  /** How far out from the centre each shoulder point is cut to sit (sleeveless: a strap is held there, not left to
   *  slide off down the slope of the shoulder). */
  shoulderX?: Float64Array;
  /** Where the shoulder seam lies front to back (cm ahead of the body's side plane), held there. */
  shoulderZ?: number;
  /** The shoulder seam held front to back only, left to rise off the shoulder's top onto the neck's base as it will. */
  shoulderZFree?: boolean;
  /** How far in from the shoulder's tip the seam is drawn to shoulderZ (all the way out unless given). */
  shoulderZIn?: number;
  /** Edges running down a bodice, top first (upper point, lower point, cut length): held to near their cut length. */
  /** Edges down a bodice held to near their cut length, top first; `k` how hard (1 under a long skirt's weight). */
  chain?: { up: Int32Array; lo: Int32Array; rest: Float64Array; k?: number };
  /** Edges down a hung cloth that falls harder than the light pull, held to near their cut length as `chain` is. */
  hold?: { up: Int32Array; lo: Int32Array; rest: Float64Array };
  /** Trouser legs: below the crotch the cloth lies on two legs, not the body. */
  legs?: { x: number; c0: number; c1: number; r0: number; r1: number };
  /** Points beside a fold and their flat distance from their own mirror across it: the cloth's bend carries on round
   *  the fold, so they are kept from folding back flat against the other half. */
  mirror?: { ids: Int32Array; rest: Float64Array; k: number };
  /** Points held from dropping below these levels (a skirt's waist, a strapless top edge). */
  hang?: { ids: Int32Array; c: Float64Array };
  /** Sleeve points kept round the arm at their own sleeve's radius (cloth with body holds a tube's shape, it does not
   *  fold flat at its seams). */
  round?: { ids: Int32Array; R: Float64Array; k: number };
  /** Turned points resting on the cloth they cover (i on j, gap cm out from the body's axis). */
  lieOn?: { i: Int32Array; j: Int32Array; gap: Float64Array };
  /** Points of cloth kept from passing through each other (a full skirt's flutes): each kept `d` cm from any other
   *  that is further than that from it in the cut (u, v: its pattern place; piece: which piece; sewn: on a seam, where
   *  the other piece's seam points meet it). */
  self?: { ids: Int32Array; u: Float64Array; v: Float64Array; piece: Int32Array; sewn: Uint8Array; d: number };
  bendK: number;
  /** How hard each edge holds its cut length, 1 = fully (a woven cloth); a knit gives (clothCard.ts). */
  edgeK?: number;
  /** Each edge's own hold, as a share of edgeK (a woven skirt gives on the bias). */
  edgeW?: Float64Array;
  /** Each point's pull down, as a share of the light pull (the cloth's own fall, clothCard.ts). */
  gScale?: Float32Array;
  /** How much more than the light pull down the cloth hangs by (a short top, with nothing hung below it). */
  gK?: number;
  /** Only from this level down (cm, as placed), over 6 cm, or out past this far from the centre over 4 cm: above it and
   *  in from it, round the neck, the light pull. */
  gFromY?: number;
  gFromX?: number;
}

export function simulate(s: Space, inp: SimInput, steps = knob("__steps") ?? 260, iters = knob("__iters") ?? 14): Float64Array {
  const n = inp.pos.length / 3;
  const x = Float64Array.from(inp.pos);
  const prev = Float64Array.from(inp.pos);
  const dt = 1 / 90;
  // A light pull down: enough to hang what is free (a peplum, a sleeve) while the cloth holds its cut lengths.
  const g = 300 * dt * dt * (knob("__g") ?? inp.gK ?? 1);
  const g1 = 300 * dt * dt;
  const gY = knob('__gFromY') ?? inp.gFromY;
  const gOf = gY === undefined ? undefined : Float64Array.from({ length: n }, (_, i) => g1 + (g - g1) * Math.min(1, Math.max(0, (inp.pos[i * 3 + 1] - gY) / 6, (Math.abs(inp.pos[i * 3]) - (knob('__gFromX') ?? inp.gFromX ?? Infinity)) / 4)));
  const padT = knob("__padT") ?? 0.3;
  const lieK = knob("__lk") ?? 0.5;
  const fric = knob("__fr") ?? 0.3;
  const { edges, rest, bends, bendRest, seams, centre, thick } = inp;
  const ne = rest.length;
  const nb = bendRest.length;
  // (Nothing on the arms, a sleeveless bodice: the arm's top sits up at the shoulder tip, where a strap rests on it.)
  const arm = inp.onArm.some((v) => v) ? s.arm : { ...s.arm, a: [s.arm.a[0], s.tip.c + s.arm.r0 * (knob('__armUpBare') ?? 0.5), s.arm.a[2]] as [number, number, number] };
  const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
  // (A sleeveless garment's cloth never meets the arm either: resting on the arm's top, which the drawn form has not
  // got, the top of its armhole rode up over the arm as a shelf standing in the air past the shoulder, All round
  // quality 2026-11-04.)
  const armLow = inp.armFree || arm.a[1] - arm.r0 > s.tip.c + 1;
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
    const rho = Math.sqrt(px * px + pz * pz) || 1e-9;
    const a = Math.atan2(px, pz);
    const R = s.bodyR(a, pc) + t;
    let hit = false;
    const L = inp.legs;
    if (L && pc > L.c0) {
      const u = Math.max(0, Math.min(1, (pc - L.c0) / (L.c1 - L.c0)));
      const rr = L.r0 + (L.r1 - L.r0) * u + t;
      const e = px >= 0 ? 1 : -1;
      const dx = px - e * L.x;
      const d = Math.sqrt(dx * dx + pz * pz) || 1e-9;
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
    // The arms, one each side. (When the arm hangs from the armpit, below the shoulder, the body's own cloth never
    // meets it: the shoulder it rests on is the body's.)
    for (let e = 1; e >= -1 && (inp.onArm[i] || !armLow); e -= 2) {
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
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      // A shoulder pad squares the top of the arm for the sleeve head as well as the shoulder.
      const rr = arm.r0 + (arm.r1 - arm.r0) * u + t + (inp.pad ?? 0) * (inp.onArm[i] ? Math.max(0, 1 - u / 0.12) : padT);
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

  // Cloth barely stretches along its length: a heavy skirt pulls a bodice down only so far. The few iterations above
  // can't carry its whole weight up to the shoulders, so after them each step every edge that runs down the cloth is
  // held to near its cut length, top first, the lower end drawn up to the upper (a hanging chain, settled from the top).
  const LIM = knob('__strain') ?? 1.06;
  const EK = knob('__edgeK') ?? inp.edgeK ?? 1;
  const CHK = knob('__chainK') ?? 1;
  const HZIN = knob('__holdZin') ?? inp.shoulderZIn ?? -99;
  const HZK = knob('__holdZk') ?? 0.5;
  const HZY = (knob('__holdZy') ?? 1) > 0;
  // Cloth can't pass through itself: a full skirt's flutes, swung round at the side seams, met and went through each
  // other, and the drawing showed slits and the cloth's inside there (All round quality 2026-11-07, Cat's circle-skirt
  // dress). Each pair of points nearer than d is pushed apart to d, unless they lie that near in the cut too.
  const repel = (() => {
    const S = inp.self;
    if (!S) return undefined;
    const D = S.d;
    const D2 = D * D;
    const cell = new Map<number, number[]>();
    const hash = (a: number, b: number, c: number) => ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) | 0;
    return () => {
      cell.clear();
      for (let q = 0; q < S.ids.length; q++) {
        const I = S.ids[q] * 3;
        const h = hash(Math.floor(x[I] / D), Math.floor(x[I + 1] / D), Math.floor(x[I + 2] / D));
        const c = cell.get(h);
        if (c) c.push(q);
        else cell.set(h, [q]);
      }
      for (let q = 0; q < S.ids.length; q++) {
        const I = S.ids[q] * 3;
        const cx = Math.floor(x[I] / D);
        const cy = Math.floor(x[I + 1] / D);
        const cz = Math.floor(x[I + 2] / D);
        for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++)
            for (let c = -1; c <= 1; c++) {
              const list = cell.get(hash(cx + a, cy + b, cz + c));
              if (!list) continue;
              for (const r of list) {
                if (r <= q) continue;
                if (S.piece[q] === S.piece[r] ? Math.hypot(S.u[q] - S.u[r], S.v[q] - S.v[r]) < D * 1.5 : S.sewn[q] && S.sewn[r]) continue;
                const J = S.ids[r] * 3;
                const dx = x[J] - x[I];
                const dy = x[J + 1] - x[I + 1];
                const dz = x[J + 2] - x[I + 2];
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 >= D2 || d2 < 1e-12) continue;
                const d = Math.sqrt(d2);
                const f = (D - d) / d / 2;
                x[I] -= dx * f;
                x[I + 1] -= dy * f;
                x[I + 2] -= dz * f;
                x[J] += dx * f;
                x[J + 1] += dy * f;
                x[J + 2] += dz * f;
              }
            }
      }
    };
  })();
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
      x[I + 1] += vy + (gOf ? gOf[i] : g) * (inp.gScale ? inp.gScale[i] : 1) * ramp;
      x[I + 2] += vz;
      if (inp.pressed?.[i]) {
        // Pressed in toward the body (the cloth under it holds it off by its thickness).
        x[I] *= 0.985;
        x[I + 2] *= 0.985;
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < ne; e++) dist(inp.edgeW ? EK * inp.edgeW[e] : EK, edges[2 * e], edges[2 * e + 1], rest[e]);
      for (let e = 0; e < nb; e++) dist(inp.bendK * (inp.bendW ? inp.bendW[e] : 1), bends[2 * e], bends[2 * e + 1], bendRest[e]);
      if (inp.mirror) {
        const { ids, rest: mr, k } = inp.mirror;
        for (let q = 0; q < ids.length; q++) {
          const I = ids[q] * 3;
          const ax = Math.abs(x[I]);
          if (2 * ax < mr[q]) x[I] = (x[I] < 0 ? -1 : 1) * (ax + (mr[q] / 2 - ax) * k);
        }
      }
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
      for (let c = 0; c < centre.length; c++) x[centre[c] * 3] = inp.centreX ? inp.centreX[c] : 0;
      if (inp.hang) for (let k = 0; k < inp.hang.ids.length; k++) {
        const I = inp.hang.ids[k] * 3 + 1;
        if (x[I] > inp.hang.c[k]) x[I] = inp.hang.c[k];
      }
      if (inp.shoulder) {
        for (let k = 0; k < inp.shoulder.length; k++) {
          const I = inp.shoulder[k] * 3;
          const top = s.ridge(Math.abs(x[I])) - thick[inp.shoulder[k]] - (inp.pad ?? 0);
          if (x[I + 1] > top) x[I + 1] = top;
          const cap = inp.shoulderX?.[k];
          if (cap !== undefined && Math.abs(x[I]) > cap) x[I] = Math.sign(x[I]) * cap;
          // (Sewn along the top of the shoulder: neither front nor back can drag the seam round to its own side.)
          if (inp.shoulderZ !== undefined && Math.abs(x[I]) < s.tip.x - HZIN) {
            x[I + 2] += (inp.shoulderZ - x[I + 2]) * HZK;
            if (HZY && !inp.shoulderZFree) x[I + 1] = top;
          }
        }
      }
      if (inp.lieOn) {
        const { i: LI, j: LJ, gap } = inp.lieOn;
        const k = lieK * ramp;
        for (let q = 0; q < LI.length; q++) {
          const I = LI[q] * 3;
          const J = LJ[q] * 3;
          const rho = Math.sqrt(x[J] * x[J] + x[J + 2] * x[J + 2]) || 1e-9;
          const tx = x[J] + (x[J] / rho) * gap[q];
          const tz = x[J + 2] + (x[J + 2] / rho) * gap[q];
          const ty = x[J + 1];
          x[I] += (tx - x[I]) * k;
          x[I + 1] += (ty - x[I + 1]) * k;
          x[I + 2] += (tz - x[I + 2]) * k;
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
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
          const f = ((R[q] - d) / d) * k * ramp * (d < R[q] ? 1 : 0.4);
          x[I] += dx * f;
          x[I + 1] += dy * f;
          x[I + 2] += dz * f;
        }
      }
      if (repel && it % 2 === 1) repel();
      for (let i = 0; i < n; i++) {
        if (inp.side[i] && x[i * 3] < 0) x[i * 3] = 0;
        collide(i, it === iters - 1 ? fric : 0);
      }
    }
    if (inp.chain && LIM > 0)
      for (let q = 0; q < inp.chain.up.length; q++) {
        const u = inp.chain.up[q] * 3;
        const v = inp.chain.lo[q] * 3;
        const dx = x[v] - x[u];
        const dy = x[v + 1] - x[u + 1];
        const dz = x[v + 2] - x[u + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const L = inp.chain.rest[q] * LIM;
        if (d <= L) continue;
        const f = 1 - (1 - L / d) * CHK * (inp.chain.k ?? 1);
        x[v] = x[u] + dx * f;
        x[v + 1] = x[u + 1] + dy * f;
        x[v + 2] = x[u + 2] + dz * f;
      }
    if (inp.hold) {
      const HL = knob('__holdLim') ?? LIM;
      const HK = knob('__holdK') ?? 0.3;
      for (let q = 0; q < inp.hold.up.length; q++) {
        const u = inp.hold.up[q] * 3;
        const v = inp.hold.lo[q] * 3;
        const dx = x[v] - x[u];
        const dy = x[v + 1] - x[u + 1];
        const dz = x[v + 2] - x[u + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const L = inp.hold.rest[q] * HL;
        if (d <= L) continue;
        const f = 1 - (1 - L / d) * HK;
        x[v] = x[u] + dx * f;
        x[v + 1] = x[u + 1] + dy * f;
        x[v + 2] = x[u + 2] + dz * f;
      }
    }
  }
  return x;
}
