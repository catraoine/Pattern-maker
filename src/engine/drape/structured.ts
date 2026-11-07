// Stiff, structured cloth (a bonded or felted wool, a leather): it stands away from the body as a shape of its own
// instead of following it in. The sim's cloth bends too easily to do that by itself, so after it settles, below the
// underarm the cloth is held out where it fell in, keeping to the widest it reached above at each place round the body,
// and its ripples are smoothed into one plane, as a stiff cloth lies (Cat's SS27 vest picture, 2026-11-07).
import type { Panel } from './garment';
import { knob } from './knob';

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
}
