// The fit map: how much room the garment leaves the body, point by point, read off the garment as sewn on the form
// (Cat, 2026-11-07: "close to professional tools", a fit map like CLO's). Not the cloth's stretch: the drape holds each
// piece to its cut lengths only roughly (a well-fitting bodice reads up to a fifth stretched or squashed edge by edge),
// so a map of stretch would show pulls that aren't there. The room round the body is what the pattern's ease is, and
// it is read reliably: the cloth's girth round each level, against the body's, matches the pattern's own finished
// measurements to a centimetre or two (bust, waist and hip, 2026-11-07).
//
// Each point's room is its level's ease (the whole ring's, in cm round) shared out by where the cloth stands off the
// body there: where it lies on the body it has little, where it stands away, more. Sleeves the same round the arm.
import type { Draped } from './garment';
import type { Space } from './space';

/** The form's bust line (body.ts / space.ts): above it the armhole and the shoulders cut the ring. */
export const BUST_Y = -0.575;

/** Cloth this close to the body (cm, past its own thickness) counts as lying on it. */
const ON = 0.3;
/** Rings this far apart (cm) are read, and the ease between them blended. */
const STEP = 1;

/** The girth of the cloth round level c, on one half of the body (x >= 0), the sleeves left out, and how much of the
 *  half round (in radians, pi all the way from front to back) the cloth covers there: above the underarm the armhole
 *  cuts the ring, and at a hem the level only grazes the cloth, so the girth there is no garment's girth. */
function halfGirth(d: Draped, c: number, sleeve: boolean): { L: number; cover: number } {
  let L = 0;
  let cover = 0;
  const P = d.pos;
  for (const p of d.panels) {
    if (p.hidden || (p.role === 'sleeve') !== sleeve || p.role === 'collar') continue;
    for (const t of p.mesh.tris) {
      const cut: [number, number][] = [];
      for (let e = 0; e < 3; e++) {
        const a = (p.base + t[e]) * 3;
        const b = (p.base + t[(e + 1) % 3]) * 3;
        const [ca, cb] = [P[a + 1], P[b + 1]];
        if ((ca - c) * (cb - c) >= 0) continue;
        const u = (c - ca) / (cb - ca);
        cut.push([P[a] + u * (P[b] - P[a]), P[a + 2] + u * (P[b + 2] - P[a + 2])]);
      }
      if (cut.length !== 2) continue;
      L += Math.hypot(cut[0][0] - cut[1][0], cut[0][1] - cut[1][1]);
      let da = Math.abs(Math.atan2(Math.abs(cut[0][0]), cut[0][1]) - Math.atan2(Math.abs(cut[1][0]), cut[1][1]));
      if (da > Math.PI) da = 2 * Math.PI - da;
      cover += da;
    }
  }
  return { L, cover };
}

/** The body's girth at level c. */
function bodyGirth(sp: Space, c: number): number {
  const N = 180;
  let L = 0;
  let prev: [number, number] | undefined;
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * 2 * Math.PI;
    const r = sp.bodyR(a, c);
    const q: [number, number] = [r * Math.sin(a), r * Math.cos(a)];
    if (prev) L += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return L;
}

/** How far a point stands off the arm (cm): from the arm's axis, less the arm's radius there. */
function offArm(sp: Space, x: number, c: number, z: number): { gap: number; t: number } {
  const { a, b, r0, r1 } = sp.arm;
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (c - a[1]) * ab[1] + (z - a[2]) * ab[2]) / L2));
  const q = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]];
  return { gap: Math.hypot(x - q[0], c - q[1], z - q[2]) - (r0 + (r1 - r0) * t), t };
}

/** The pattern's own ease at a level (cm below the waist): what its measurement table says. */
export interface FitPin {
  c: number;
  ease: number;
}

/** Each point's room, in cm round (as ease is given): below 0 the cloth would have to stretch to go round. NaN where
 *  it can't be read (a collar, cloth off the body's levels). */
export function fitRoom(d: Draped, sp: Space, thick: (i: number) => number, pins: FitPin[] = []): Float32Array {
  const n = d.pos.length / 3;
  const out = new Float32Array(n).fill(NaN);
  const P = d.pos;
  // The body's cloth: ring by ring.
  let lo = Infinity;
  let hi = -Infinity;
  const body: number[] = [];
  const arm: number[] = [];
  for (const p of d.panels) {
    if (p.hidden || p.role === 'collar') continue;
    for (let i = 0; i < p.mesh.pts.length; i++) {
      const k = p.base + i;
      (p.role === 'sleeve' ? arm : body).push(k);
      if (p.role !== 'sleeve') [lo, hi] = [Math.min(lo, P[k * 3 + 1]), Math.max(hi, P[k * 3 + 1])];
    }
  }
  const gapOf = (k: number) => {
    const [x, c, z] = [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]];
    return Math.max(0, Math.hypot(x, z) - sp.bodyR(Math.atan2(x, z), c) - thick(k));
  };
  if (body.length && hi > lo) {
    const rings: { c: number; ease: number; meanGap: number; ok: boolean }[] = [];
    for (let c = lo + 0.5; c < hi; c += STEP) {
      const g = halfGirth(d, c, false);
      // (Not above the bust, where the armhole and the shoulders cut the ring, nor in the last 2 cm at an edge, where
      // the level only grazes a turned hem or a neckline.)
      const whole = g.cover > 0.92 * Math.PI && g.cover < 1.25 * Math.PI && c >= sp.cOf(BUST_Y) && c > lo + 2 && c < hi - 2;
      rings.push({ c, ease: 2 * g.L - bodyGirth(sp, c), meanGap: 0, ok: whole });
    }
    // Eased over a few cm up and down: one ring's reading wanders a little with the mesh.
    const raw = rings.map((g) => g.ease);
    rings.forEach((g, r) => {
      if (!g.ok) return;
      let [t, w] = [0, 0];
      for (let k = -2; k <= 2; k++) if (rings[r + k]?.ok) [t, w] = [t + raw[r + k], w + 1];
      g.ease = t / w;
    });
    // Pinned to the pattern's own ease where it gives one (bust, waist, hip): the drape reads a ring's girth to a
    // centimetre or two, but where cloth bunches (a fitted dress's waist seam read 6 cm roomy) the pattern is the truth,
    // and the map must never disagree with the measurement table. The correction is blended between the pins and held
    // past the last one.
    const fix = pins
      .map((pin) => {
        // (The whole ring nearest the level, within 2 cm: the bust line itself can sit a hair above the first ring read.)
        let best: (typeof rings)[number] | undefined;
        for (const g of rings) if (g.ok && Math.abs(g.c - pin.c) <= 2 && (!best || Math.abs(g.c - pin.c) < Math.abs(best.c - pin.c))) best = g;
        return best ? { c: best.c, by: pin.ease - best.ease, ease: pin.ease } : undefined;
      })
      .filter((x): x is { c: number; by: number; ease: number } => !!x)
      .sort((u, v) => u.c - v.c);
    if (fix.length)
      rings.forEach((g) => {
        if (!g.ok) return;
        let by = fix[0].by;
        if (g.c >= fix[fix.length - 1].c) by = fix[fix.length - 1].by;
        else
          for (let k = 0; k + 1 < fix.length; k++)
            if (g.c >= fix[k].c && g.c <= fix[k + 1].c) by = fix[k].by + ((fix[k + 1].by - fix[k].by) * (g.c - fix[k].c)) / (fix[k + 1].c - fix[k].c || 1);
        g.ease += by;
        // (Between two pins the garment is never read tighter than the tighter of them, less a centimetre: a waist seam,
        // where two pieces' edges meet, read 3 cm under the waist's own ease once corrected.)
        for (let k = 0; k + 1 < fix.length; k++) if (g.c > fix[k].c && g.c < fix[k + 1].c) g.ease = Math.max(g.ease, Math.min(fix[k].ease, fix[k + 1].ease) - 1);
      });
    // A ring the cloth doesn't go all the way round (or laps over itself) takes the nearest whole ring's ease.
    rings.forEach((g, r) => {
      if (g.ok) return;
      for (let k = 1; k < rings.length; k++) {
        const near = [rings[r - k], rings[r + k]].find((q) => q?.ok);
        if (near) {
          g.ease = near.ease;
          return;
        }
      }
      g.ease = NaN;
    });
    // The mean stand-off round each ring, from the points near it.
    const sum = rings.map(() => [0, 0]);
    for (const k of body) {
      const r = Math.round((P[k * 3 + 1] - (lo + 0.5)) / STEP);
      if (r < 0 || r >= rings.length) continue;
      sum[r][0] += gapOf(k);
      sum[r][1]++;
    }
    rings.forEach((g, r) => (g.meanGap = sum[r][1] ? sum[r][0] / sum[r][1] : 0));
    for (const k of body) {
      const c = P[k * 3 + 1];
      const r = Math.max(0, Math.min(rings.length - 1, Math.round((c - (lo + 0.5)) / STEP)));
      const g = rings[r];
      if (!g) continue;
      const gap = gapOf(k);
      // The ring's ease, nudged by where the cloth stands off: lying on the body a little snugger, standing away a
      // little easier, but never far from the ring's own reading (a fitted bodice reads snug, not tight, where it lies).
      const share = g.meanGap > 0.05 ? Math.min(2.5, gap / g.meanGap) : 1;
      out[k] = g.ease < 0 ? g.ease : g.ease * (gap <= ON ? 0.8 : 0.8 + 0.2 * share);
    }
  }
  // Sleeves: the room round the arm, ring by ring down it (2 pi times the sleeve's mean stand-off off the arm), each
  // point nudged as on the body. Over the shoulder (the cap, above where the arm starts) the cloth lies on the shoulder,
  // not round the arm: it takes the first ring below.
  if (arm.length) {
    const BINS = 24;
    const at = arm.map((k) => offArm(sp, P[k * 3], P[k * 3 + 1], P[k * 3 + 2]));
    const gapOfArm = (j: number) => Math.max(0, at[j].gap - thick(arm[j]));
    const sum = Array.from({ length: BINS }, () => [0, 0]);
    const bin = (t: number) => Math.min(BINS - 1, Math.floor(t * BINS));
    at.forEach((q, j) => {
      if (q.t < 0.04) return;
      sum[bin(q.t)][0] += gapOfArm(j);
      sum[bin(q.t)][1]++;
    });
    const mean = sum.map(([g, n]) => (n >= 3 ? g / n : NaN));
    const firstOk = mean.findIndex((v) => Number.isFinite(v));
    arm.forEach((k, j) => {
      let b = at[j].t < 0.04 ? firstOk : bin(at[j].t);
      while (b > 0 && !Number.isFinite(mean[b])) b--;
      const m = mean[b];
      if (!Number.isFinite(m)) return;
      const ease = 2 * Math.PI * m;
      const share = m > 0.05 ? Math.min(2.5, gapOfArm(j) / m) : 1;
      out[k] = at[j].t < 0.04 ? ease : ease * (gapOfArm(j) <= ON ? 0.8 : 0.8 + 0.2 * share);
    });
  }
  return out;
}

/** The room, in words and colours: the bands the map is drawn in. Woven cloth needs a little room to move in (a few cm
 *  round); a knit may be cut smaller than the body and stretch to it. */
export const FIT_BANDS = [
  { upTo: 0, name: 'Tight' },
  { upTo: 3, name: 'Snug' },
  { upTo: 10, name: 'Easy' },
  { upTo: 24, name: 'Relaxed' },
  { upTo: Infinity, name: 'Loose' },
] as const;
