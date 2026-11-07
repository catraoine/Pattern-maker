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
  // Held out: going down, never in from the widest the cloth reached above it at that place round the body.
  const held = Float64Array.from(field);
  for (let ab = 0; ab < NA; ab++) {
    let m = 0;
    for (let yb = 0; yb < NY; yb++) {
      const b = yb * NA + ab;
      if (!have[b]) continue;
      m = Math.max(m, field[b]);
      held[b] = m;
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
    for (let it = 0; it < (knob('__stiffEase') ?? 6); it++) {
      const next: [number, number][] = [];
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        if (res[I + 1] < top + 4 || p.turned[i] || !nb[i].size) return;
        let m = 0;
        for (const j of nb[i]) m += Math.hypot(res[(p.base + j) * 3], res[(p.base + j) * 3 + 2]);
        m /= nb[i].size;
        const r = Math.hypot(res[I], res[I + 2]) || 1;
        next.push([I, (r + (m - r) * 0.5) / r]);
      });
      for (const [I, f] of next) {
        res[I] *= f;
        res[I + 2] *= f;
      }
    }
  }
}
