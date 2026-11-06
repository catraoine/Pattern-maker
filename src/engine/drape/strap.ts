// A cami's rouleau straps drawn on the settled cloth. The draft gives each strap as a measurement, not a piece
// (corset.ts: the strap point on the front and back top edges, and the shoulder's middle it passes over), so the
// drape sews a strapless top and All round showed a cami with no straps (the SS27 renders, 2026-11-04). Each strap is
// laid from the settled front top edge at its strap point, up the chest to the shoulder, over the top of the
// shoulder and down the back to the back strap point: a narrow ribbon a rouleau's width, a little off the body.
// Built in the drape's cm (x to the wearer's left, c down from the waist, z forward) as more points on the same
// arrays, the wearer's left one only: the view mirrors it to the right, as it does every panel.
import type { P } from '../geometry';
import type { Draped } from './garment';
import type { Space } from './space';

export interface StrapMesh {
  pos: number[];
  tris: number[][];
  uv: number[];
  /** For each point, the settled cloth point it hangs by (for its drawn scale). */
  ref: number[];
}

/** A turned rouleau's finished width, cm (cut 2.5 cm on the bias, about 6 mm turned). */
export const ROULEAU_WIDTH = 0.65;

/** The settled point of a role's panels cut nearest a point on the pattern, if there is one within 3 cm. */
function settledAt(d: Pick<Draped, 'panels' | 'pos'>, role: 'front' | 'back', q: P): { i: number; x: number; c: number; z: number } | undefined {
  let best: { i: number; e: number } | undefined;
  for (const p of d.panels) {
    if (p.role !== role || p.hidden) continue;
    p.mesh.pts.forEach((m, k) => {
      const e = Math.hypot(m.x - q.x, m.y - q.y);
      if (!best || e < best.e) best = { i: p.base + k, e };
    });
  }
  if (!best || best.e > 3) return undefined;
  const i = best.i;
  return { i, x: d.pos[i * 3], c: d.pos[i * 3 + 1], z: d.pos[i * 3 + 2] };
}

/** How far forward (front) or back the body's surface lies at x cm out, at level c. */
function surfaceZ(sp: Space, x: number, c: number, sign: 1 | -1): number {
  // In from well outside the body until inside it, then halved down to the surface (a fixed-point solve swings over the
  // bust and puts a kink in the strap).
  const inside = (z: number) => Math.hypot(x, z) < sp.bodyR(Math.atan2(x, sign * z), c);
  let lo = 0.3;
  let hi = 40;
  for (let z = hi; z > lo; z -= 0.5) {
    if (inside(z)) {
      lo = z;
      hi = z + 0.5;
      break;
    }
  }
  if (!inside(lo)) return sign * lo;
  for (let k = 0; k < 20; k++) {
    const m = (lo + hi) / 2;
    if (inside(m)) lo = m;
    else hi = m;
  }
  return sign * (lo + hi) / 2;
}

export function camiStraps(d: Pick<Draped, 'panels' | 'pos'>, sp: Space, at: { front: [P, P]; back: [P, P] }, width = ROULEAU_WIDTH): StrapMesh | undefined {
  const F = settledAt(d, 'front', at.front[0]);
  const B = settledAt(d, 'back', at.back[0]);
  if (!F || !B || F.x <= 0 || B.x <= 0) return undefined;
  // Over the shoulder where the draft takes it: as far out from the strap points as its shoulder middle is.
  const xTop = (F.x + (at.front[1].x - at.front[0].x) + B.x + (at.back[1].x - at.back[0].x)) / 2;
  const ridge = sp.ridge(xTop);
  // The front and back runs end a little below the top of the shoulder, where the body is still deep enough to lie on;
  // the strap is carried over the top between them.
  const cEnd = ridge + 2;
  const OFF = 0.25;
  const path: [number, number, number, number][] = []; // x c z, and which end's cloth it hangs by (0 front, 1 back)
  const run = (S: { x: number; c: number; z: number }, sign: 1 | -1, n: number, reverse: boolean) => {
    const pts: [number, number, number, number][] = [];
    const s0 = surfaceZ(sp, S.x, S.c, sign) + sign * OFF;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = S.x + (xTop - S.x) * t;
      const c = S.c + (cEnd - S.c) * t;
      // From the cloth's own top edge at the strap point, eased onto the body as it rises.
      const z = surfaceZ(sp, x, c, sign) + sign * OFF + (S.z - s0) * (1 - t) * (1 - t);
      pts.push([x, c, z, sign > 0 ? 0 : 1]);
    }
    return reverse ? pts.reverse() : pts;
  };
  const n = Math.max(6, Math.round(Math.abs(F.c - cEnd) / 1.5));
  const front = run(F, 1, n, false);
  const back = run(B, -1, Math.max(6, Math.round(Math.abs(B.c - cEnd) / 1.5)), true);
  const zf = front[front.length - 1][2];
  const zb = back[0][2];
  // Over the top: an arch from the front run's end to the back run's, its crown resting just over the shoulder's top.
  const crown = ridge - OFF - 0.2;
  const top: [number, number, number, number][] = [];
  const NT = 8;
  for (let k = 1; k < NT; k++) {
    const ph = (Math.PI * k) / NT;
    top.push([xTop, cEnd - (cEnd - crown) * Math.sin(ph), (zf + zb) / 2 + ((zf - zb) / 2) * Math.cos(ph), k < NT / 2 ? 0 : 1]);
  }
  path.push(...front, ...top, ...back);
  if (path.some((q) => !q.every(Number.isFinite))) return undefined;

  const pos: number[] = [];
  const tris: number[][] = [];
  const uv: number[] = [];
  const ref: number[] = [];
  // A turned rouleau is round: a tube, so it reads from the side as well as from the front and back.
  const NS = 6;
  const r = width / 2;
  let s = 0;
  for (let k = 0; k < path.length; k++) {
    const a = path[Math.max(0, k - 1)];
    const b = path[Math.min(path.length - 1, k + 1)];
    if (k) s += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1], path[k][2] - path[k - 1][2]);
    let tx = b[0] - a[0];
    let tc = b[1] - a[1];
    let tz = b[2] - a[2];
    const tl = Math.hypot(tx, tc, tz) || 1;
    tx /= tl;
    tc /= tl;
    tz /= tl;
    // u across the strap (the x axis squared to its direction), v = t x u: the tube's cross-section.
    let ux = 1 - tx * tx;
    let uc = -tx * tc;
    let uz = -tx * tz;
    const ul = Math.hypot(ux, uc, uz) || 1;
    ux /= ul;
    uc /= ul;
    uz /= ul;
    const vx = tc * uz - tz * uc;
    const vc = tz * ux - tx * uz;
    const vz = tx * uc - tc * ux;
    const [x, c, z, end] = path[k];
    const rf = end ? B.i : F.i;
    for (let j = 0; j < NS; j++) {
      const th = (2 * Math.PI * j) / NS;
      const cu = Math.cos(th) * r;
      const sv = Math.sin(th) * r;
      pos.push(x + ux * cu + vx * sv, c + uc * cu + vc * sv, z + uz * cu + vz * sv);
      uv.push(s, (j * width * Math.PI) / NS);
      ref.push(rf);
    }
    if (k) {
      const p0 = (k - 1) * NS;
      const p1 = k * NS;
      for (let j = 0; j < NS; j++) {
        const j1 = (j + 1) % NS;
        tris.push([p0 + j, p1 + j, p0 + j1], [p0 + j1, p1 + j, p1 + j1]);
      }
    }
  }
  return { pos, tris, uv, ref };
}
