// Stiff, structured cloth (a bonded or felted wool, a leather): it stands away from the body as a shape of its own
// instead of following it in. The sim's cloth bends too easily to do that by itself, so after it settles, below the
// underarm the cloth is held out where it fell in, keeping to the widest it reached above at each place round the body,
// and its ripples are smoothed into one plane, as a stiff cloth lies (Cat's SS27 vest picture, 2026-11-07).
import type { Panel } from './garment';
import { knob } from './knob';
import { CollarOnFront, collarOnFront, straightenCollarEdge } from './collarEnd';

const NA = 48;

/** Holds a jacket's body cloth out stiff below its underarm. Moves `res`. */
export function standStiff(panels: Panel[], res: Float64Array | number[], k = knob('__stiffK') ?? 0.85): void {
  const body = panels.filter((p) => !p.hidden && (p.role === 'front' || p.role === 'back'));
  if (!body.length) return;
  // (Where the cloth starts to stand free: the lowest underarm point.)
  let top = -Infinity;
  for (const p of body) for (const i of (p.mesh.runs.armhole ?? []).flat()) top = Math.max(top, res[(p.base + i) * 3 + 1]);
  if (!Number.isFinite(top)) return;
  let bottom = top;
  for (const p of body) for (let i = 0; i < p.mesh.pts.length; i++) bottom = Math.max(bottom, res[(p.base + i) * 3 + 1]);
  const DY = 1.5;
  const NY = Math.max(2, Math.ceil((bottom - top) / DY) + 1);
  const angOf = (I: number) => Math.atan2(res[I], res[I + 2]);
  const binA = (a: number) => Math.min(NA - 1, Math.max(0, Math.floor(((a + Math.PI) / (2 * Math.PI)) * NA)));
  const binY = (y: number) => Math.min(NY - 1, Math.max(0, Math.round((y - top) / DY)));
  // The cloth's distance from the body's axis, averaged by place round the body and height.
  const sum = new Float64Array(NA * NY);
  const cnt = new Float64Array(NA * NY);
  const pts: { I: number; a: number; y: number; r: number; turned: boolean }[] = [];
  for (const p of body)
    for (let i = 0; i < p.mesh.pts.length; i++) {
      const I = (p.base + i) * 3;
      const y = res[I + 1];
      if (y < top) continue;
      const r = Math.hypot(res[I], res[I + 2]);
      const a = angOf(I);
      pts.push({ I, a, y, r, turned: p.turned[i] });
      if (p.turned[i]) continue;
      const b = binY(y) * NA + binA(a);
      sum[b] += r;
      cnt[b]++;
    }
  // (Smoothed round the body and down it, empty places filled from their neighbours.)
  const field = new Float64Array(NA * NY);
  const have = new Uint8Array(NA * NY);
  for (let yb = 0; yb < NY; yb++)
    for (let ab = 0; ab < NA; ab++) {
      let s = 0;
      let c = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let da = -2; da <= 2; da++) {
          const y2 = yb + dy;
          if (y2 < 0 || y2 >= NY) continue;
          const b = y2 * NA + ((ab + da + NA) % NA);
          s += sum[b];
          c += cnt[b];
        }
      if (c) {
        field[yb * NA + ab] = s / c;
        have[yb * NA + ab] = 1;
      }
    }
  // Held out straight: at each place round the body the cloth keeps the width it has a hand below the underarm all
  // the way down, so the sides run plumb to the hem as a box (Cat: "longer and more straight square edge", 2026-11-07),
  // going further out only where the body itself pushes it out.
  const held = Float64Array.from(field);
  const REF0 = Math.round((knob('__stiffRef0') ?? 6) / DY);
  const REF1 = Math.round((knob('__stiffRef1') ?? 12) / DY);
  for (let ab = 0; ab < NA; ab++) {
    let s = 0;
    let c = 0;
    for (let yb = REF0; yb <= Math.min(NY - 1, REF1); yb++)
      if (have[yb * NA + ab]) {
        s += field[yb * NA + ab];
        c++;
      }
    const ref = c ? s / c : 0;
    for (let yb = 0; yb < NY; yb++) {
      const b = yb * NA + ab;
      if (have[b]) held[b] = Math.max(ref, field[b]);
    }
  }
  const at = (f: Float64Array, a: number, y: number) => {
    const fy = Math.min(NY - 1.001, Math.max(0, (y - top) / DY));
    const y0 = Math.floor(fy);
    const u = fy - y0;
    const b0 = y0 * NA + binA(a);
    const b1 = (y0 + 1) * NA + binA(a);
    const v0 = have[b0] ? f[b0] : NaN;
    const v1 = have[b1] ? f[b1] : v0;
    return Number.isFinite(v0) ? v0 * (1 - u) + v1 * u : NaN;
  };
  for (const q of pts) {
    const H = at(held, q.a, q.y);
    const S = at(field, q.a, q.y);
    if (!Number.isFinite(H) || !Number.isFinite(S) || q.r < 1e-6) continue;
    // (Fading in down from the underarm, so the cloth stands out from the chest in one smooth line.)
    const s = Math.min(1, (q.y - top) / (knob('__stiffFade') ?? 10));
    const w = s * s * (3 - 2 * s);
    // Out to the held line, its own ripple off the smoothed cloth kept only in part.
    const r = q.r + w * (H - S - k * (q.r - S));
    const f = r / q.r;
    res[q.I] *= f;
    res[q.I + 2] *= f;
  }
  // (Then eased: each point's distance out moved toward its neighbours' a few times, so seams and edges lie as smooth
  // as the cloth between them.)
  for (const p of body) {
    const nb = p.mesh.pts.map(() => new Set<number>());
    for (const [u, v, w] of p.mesh.tris) {
      nb[u].add(v).add(w);
      nb[v].add(u).add(w);
      nb[w].add(u).add(v);
    }
    // (Points on the outline keep their place round the body, so the seams they're sewn to stay closed.)
    const edge = new Set(Object.values(p.mesh.runs).flat(2));
    for (let it = 0; it < (knob('__stiffEase') ?? 6); it++) {
      const next: [number, number, number][] = [];
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        if (res[I + 1] < top + 4 || p.turned[i] || !nb[i].size) return;
        // (Both how far out it lies and where it sits round the body, so a fold the sim left tucked over itself opens
        // out flat instead of being pressed into a fin.)
        let m = 0;
        let ax = 0;
        let az = 0;
        for (const j of nb[i]) {
          const J = (p.base + j) * 3;
          m += Math.hypot(res[J], res[J + 2]);
          ax += res[J];
          az += res[J + 2];
        }
        m /= nb[i].size;
        const r = Math.hypot(res[I], res[I + 2]) || 1;
        const r2 = r + (m - r) * 0.5;
        const t = edge.has(i) ? 0 : 0.5;
        const x = res[I] + (ax / nb[i].size - res[I]) * t;
        const z = res[I + 2] + (az / nb[i].size - res[I + 2]) * t;
        const h = Math.hypot(x, z) || 1;
        next.push([I, (x / h) * r2, (z / h) * r2]);
      });
      for (const [I, x, z] of next) {
        res[I] = x;
        res[I + 2] = z;
      }
    }
  }
  // A level hem: a stiff cloth hangs to one straight line, so each hem point drops (or rises) to the body's lowest hem,
  // the cloth above following it less the further up it is, so the corners stay square instead of curling up.
  let hemY = -Infinity;
  for (const p of body) for (const i of (p.mesh.runs.hem ?? []).flat()) hemY = Math.max(hemY, res[(p.base + i) * 3 + 1]);
  if (!Number.isFinite(hemY)) return;
  const reach = knob('__stiffHemReach') ?? 18;
  for (const p of body) {
    const hem = [...new Set((p.mesh.runs.hem ?? []).flat())].filter((i) => !p.turned[i]);
    if (!hem.length) continue;
    const hx = hem.map((i) => p.mesh.pts[i].x);
    const hd = hem.map((i) => hemY - res[(p.base + i) * 3 + 1]);
    const hp = hem.map((i) => p.mesh.pts[i].y);
    p.mesh.pts.forEach((q, i) => {
      const I = (p.base + i) * 3;
      if (res[I + 1] < top + 4 || p.turned[i]) return;
      // (The nearest hem point across the piece, by its place along the hem.)
      let j = 0;
      for (let n = 1; n < hx.length; n++) if (Math.abs(hx[n] - q.x) < Math.abs(hx[j] - q.x)) j = n;
      const s = Math.max(0, 1 - Math.abs(hp[j] - q.y) / reach);
      res[I + 1] += hd[j] * s * s * (3 - 2 * s);
    });
  }
  if (!knob('__noLay')) layFrontEdges(body, res);
}

/** A buttoned stiff front lies closed to its edge. The front is sewn as a half mirrored at the centre front, so there
 *  the front's centre line goes onto the mirror, its button stand with it, the cloth beside easing over to it: between
 *  the buttons its edge can't bow open as a soft cloth's does. Moves `res`. */
function layFrontEdges(body: Panel[], res: Float64Array | number[]): void {
  const W = knob('__layW') ?? 6;
  for (const p of body) {
    if (p.role !== 'front') continue;
    const pts = p.mesh.pts;
    const centre = pts.map((_, i) => i).filter((i) => !p.turned[i] && Math.abs(pts[i].x) < 0.9);
    if (!centre.length) continue;
    // (The centre line's depth at a height on the pattern: its points within a little of it, averaged, so the stand
    // follows a smooth line rather than whichever mesh point happens to lie nearest.)
    const zAt = (y: number) => {
      let s = 0;
      let sw = 0;
      for (const i of centre) {
        const w = Math.max(0, 1 - Math.abs(pts[i].y - y) / 2.5);
        s += w * res[(p.base + i) * 3 + 2];
        sw += w;
      }
      return sw > 1e-6 ? s / sw : undefined;
    };
    // (Only below the lapel's break, as above it the fronts turn back open; coming in within a couple of cm of it, as
    // over a longer way the two front edges, mirrored, crossed and parted again round the top button in an eye shape:
    // Cat, 2026-11-07.)
    // (The break: where the lapel's edge ends. The cloth marked turned can run on below it along the extension.)
    const lapelEdge = (p.mesh.runs.lapel ?? []).flat();
    const breakY = Math.max(-Infinity, ...(lapelEdge.length ? lapelEdge : pts.map((_, i) => i).filter((i) => p.turned[i])).map((i) => pts[i].y));
    const moves: [number, number, number][] = [];
    // (The lapel's own foot, just above the break, is drawn in to the centre with it, so the two lapels, mirrored, meet in
    // one V at the top button instead of crossing in a little diamond round it.)
    const foot = knob('__layFoot') ?? 6;
    pts.forEach((q, i) => {
      if (p.turned[i] && q.y <= breakY && foot > 0) {
        const f = Math.max(0, 1 - (breakY - q.y) / foot);
        if (f > 0) moves.push([(p.base + i) * 3, res[(p.base + i) * 3] * (1 - f * f * (3 - 2 * f)), res[(p.base + i) * 3 + 2]]);
        return;
      }
      if ((p.turned[i] && q.y <= breakY) || q.x >= W) return;
      const I = (p.base + i) * 3;
      const b = Math.min(1, Math.max(0, (q.y - breakY) / (knob('__layIn') ?? 0.8)));
      const fb = b * b * (3 - 2 * b);
      if (!fb) return;
      const t = Math.max(0, (q.x - 0.9) / (W - 0.9));
      const fx = 1 - t * t * (3 - 2 * t);
      const z = q.x < 0.9 ? zAt(q.y) : undefined;
      moves.push([I, res[I] * (1 - fb * fx), z === undefined ? res[I + 2] : res[I + 2] + (z - res[I + 2]) * fb]);
    });
    for (const [I, x, z] of moves) {
      res[I] = x;
      res[I + 2] = z;
    }
  }
}

/** A stiff collar pressed: its fall laid flat on whatever it covers (its own stand, then the shoulders and lapels), a
 *  cloth's thickness out, and smoothed so it lies as one crisp plane with a clean edge, the way a bonded or interfaced
 *  collar is pressed (Cat: "very flat and crisp", SS27 vest, 2026-11-07). The stand and the seam stay where they are.
 *  `relax` eases cloth back to its cut lengths, holding the points given. Moves `res`. */
export function pressCollar(panels: Panel[], res: Float64Array | number[], relax: (p: Panel, held: number[]) => void, stiff = false): void {
  const NA = 120;
  const DY = 0.5;
  const TAU = Math.PI * 2;
  const gap = knob('__pressGap') ?? 0.3;
  const collars = panels.filter((p) => p.role === 'collar' && !p.hidden && p.turned.some(Boolean));
  if (!collars.length) return;
  const key = (a: number, y: number) => (((Math.round(((a + Math.PI) / TAU) * NA) % NA) + NA) % NA) * 100000 + Math.round(y / DY);
  for (let round = 0; round < (knob('__pressRounds') ?? 6); round++) {
    // What lies under the fall: the body's cloth and the collar's own stand, as far out as it is at each place.
    const under = new Map<number, number>();
    const put = (I: number) => {
      const k = key(Math.atan2(res[I], res[I + 2]), res[I + 1]);
      under.set(k, Math.max(under.get(k) ?? 0, Math.hypot(res[I], res[I + 2])));
    };
    for (const p of panels) {
      if (p.hidden || p.role === 'sleeve') continue;
      if (p.role === 'collar') p.mesh.pts.forEach((_, i) => !p.turned[i] && put((p.base + i) * 3));
      else if (p.role === 'front' || p.role === 'back') p.mesh.pts.forEach((_, i) => put((p.base + i) * 3));
    }
    const underAt = (I: number) => {
      const a = Math.atan2(res[I], res[I + 2]);
      // (The highest within a little way round, then averaged over a wider patch, so the laid edge runs smooth rather
      // than stepping from one sample to the next.)
      let s = 0;
      let c = 0;
      for (let da = -2; da <= 2; da++)
        for (let dy = -2; dy <= 2; dy++) {
          let R = 0;
          for (const ea of [-1, 0, 1]) for (const ey of [-1, 0, 1]) R = Math.max(R, under.get(key(a + ((da + ea) * TAU) / NA, res[I + 1] + (dy + ey) * DY)) ?? 0);
          if (R) {
            s += R;
            c++;
          }
        }
      return c ? s / c : 0;
    };
    for (const p of collars) {
      const nb = p.mesh.pts.map(() => new Set<number>());
      for (const [u, v, w] of p.mesh.tris) {
        nb[u].add(v).add(w);
        nb[v].add(u).add(w);
        nb[w].add(u).add(v);
      }
      // (Its seams to the neck and the gorge stay sewn where they are, even where the roll line turns them over.)
      const sewn = new Set([...(p.mesh.runs.neck ?? []), ...(p.mesh.runs.gorge ?? [])].flat());
      // (A high lapel's long collar end is already laid where it falls when worn, on the lapel and chest, a cloth's
      // thickness out (collarEnd.ts): left there, as pressing it again pulled it in to a spike.)
      const onFront = p.pc.meta.onFront as CollarOnFront | undefined;
      const laid = new Set(onFront ? p.mesh.pts.map((q, i) => (p.turned[i] && collarOnFront(q, onFront).w > 0.5 ? i : -1)).filter((i) => i >= 0) : []);
      const fall = p.mesh.pts.map((_, i) => i).filter((i) => p.turned[i] && !sewn.has(i) && !laid.has(i));
      // Smoothed: each fall point toward its neighbours, so ripples and lumps press out into one plane.
      const next = fall.map((i) => {
        const m = [0, 0, 0];
        for (const j of nb[i]) for (let d = 0; d < 3; d++) m[d] += res[(p.base + j) * 3 + d] / nb[i].size;
        const I = (p.base + i) * 3;
        return [I, ...[0, 1, 2].map((d) => res[I + d] + (m[d] - res[I + d]) * 0.5)] as [number, number, number, number];
      });
      for (const [I, x, y, z] of next) {
        res[I] = x;
        res[I + 1] = y;
        res[I + 2] = z;
      }
      // Laid on: just out from what it covers, neither standing off it nor sunk in.
      for (const i of fall) {
        const I = (p.base + i) * 3;
        const R = underAt(I);
        if (!R) continue;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const k = (R + gap) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      }
      // And back to its cut: pressing never stretches it.
      relax(p, p.mesh.pts.map((_, i) => i).filter((i) => !p.turned[i] || sewn.has(i) || laid.has(i)));
    }
  }
  // (And a high lapel's long collar end pressed to a straight edge, collarEnd.ts.)
  for (const p of collars) {
    if (!p.pc.meta.onFront || knob('__noStraightCollar')) continue;
    const edge = straightenCollarEdge(p, p.pc.meta.onFront as CollarOnFront, res, stiff);
    // (Then the cloth inside eased back to its cut, the straight edge and the seams held, so it isn't stretched there.)
    const sewn = new Set([...(p.mesh.runs.neck ?? []), ...(p.mesh.runs.gorge ?? [])].flat());
    if (edge.length && !knob('__noStraightRelax')) relax(p, [...p.mesh.pts.map((_, i) => i).filter((i) => !p.turned[i] || sewn.has(i)), ...edge]);
  }
}
