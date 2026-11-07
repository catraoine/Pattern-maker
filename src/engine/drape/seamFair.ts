// A dress's waist seam dropped onto the hip, faired after the drape. The pattern's side seams run on smoothly through
// a dropped or low seam (the bodice flares out its last few cm as the hip does, the skirt carries on from there), but
// the sim left the skirt's top standing out half a cm or more past the bodice just above it, a ledge round the hip
// at the seam that read as a bodice tucked into a skirt (the SS27 drop-waist renders, 2026-11-04; still there on the
// live app 2026-11-07). Here the cloth's stand-off from the body is read just above and just below the seam, all the
// way round, and through the seam it is drawn in to run straight from one to the other. Cloth is only drawn in,
// never pushed out, so pleats and gathers below the seam that stand off further keep their own shape.
import type { Draped } from './garment';
import type { Space } from './space';

/** How far above and below the seam the stand-off is read and run straight, cm (at 4 a corner was left at the band's edge). */
const BAND = 6;
/** Turns round the body read separately. */
const BINS = 60;

export function fairDroppedSeam(d: Pick<Draped, 'panels' | 'pos' | 'lines' | 'posMirror'>, sp: Space): void {
  const seam = d.lines.filter((l) => l.kind === 'waist').flatMap((l) => l.ids);
  if (seam.length < 4) return;
  // (Not under gathers or pleats: their folds stand out from the seam by design, and drawn in they'd be pressed flat.)
  const folded = d.panels.some((p) => !p.hidden && (((p.pc.meta.gathered as number | undefined) ?? 1) > 1.05 || ((p.pc.meta.gatherShown as number | undefined) ?? 1) > 1.05 || p.pc.meta.pleatFolds || p.pc.meta.tier));
  if (folded) return;
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])]) fairOne(d, pos, seam, sp);
}

function fairOne(d: Pick<Draped, 'panels'>, pos: Float64Array, seam: number[], sp: Space): void {
  const binOf = (x: number, z: number) => {
    const a = Math.atan2(x, z);
    return Math.min(BINS - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS));
  };
  // The seam's level in each turn round the body (it may run lower at the front or back).
  const sum = new Float64Array(BINS);
  const n = new Float64Array(BINS);
  for (const i of seam) {
    const b = binOf(pos[i * 3], pos[i * 3 + 2]);
    sum[b] += pos[i * 3 + 1];
    n[b]++;
  }
  const seamC = new Float64Array(BINS).fill(NaN);
  for (let b = 0; b < BINS; b++) if (n[b]) seamC[b] = sum[b] / n[b];
  // (A turn with no seam point of its own takes its nearest neighbour's.)
  for (let b = 0; b < BINS; b++) {
    if (!Number.isNaN(seamC[b])) continue;
    for (let k = 1; k < BINS / 2; k++) {
      const u = seamC[(b + k) % BINS];
      const v = seamC[(b - k + BINS) % BINS];
      if (!Number.isNaN(u) || !Number.isNaN(v)) {
        seamC[b] = Number.isNaN(u) ? v : u;
        break;
      }
    }
  }
  const ids: number[] = [];
  for (const p of d.panels) if (!p.hidden && p.role !== 'sleeve' && p.role !== 'collar') for (let k = 0; k < p.mesh.pts.length; k++) ids.push(p.base + k);
  const off = (i: number) => {
    const x = pos[i * 3];
    const z = pos[i * 3 + 2];
    return Math.hypot(x, z) - sp.bodyR(Math.atan2(x, z), pos[i * 3 + 1]);
  };
  // The stand-off just outside the band, above and below, in each turn: the median, so a stray point doesn't set it.
  const above: number[][] = Array.from({ length: BINS }, () => []);
  const below: number[][] = Array.from({ length: BINS }, () => []);
  for (const i of ids) {
    const b = binOf(pos[i * 3], pos[i * 3 + 2]);
    const dc = pos[i * 3 + 1] - seamC[b];
    if (dc < -BAND && dc >= -BAND - 2) above[b].push(off(i));
    else if (dc > BAND && dc <= BAND + 2) below[b].push(off(i));
  }
  const med = (xs: number[]) => {
    if (!xs.length) return NaN;
    const s = [...xs].sort((u, v) => u - v);
    return s[s.length >> 1];
  };
  const offA = above.map(med);
  const offB = below.map(med);
  for (const i of ids) {
    const x = pos[i * 3];
    const c = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const b = binOf(x, z);
    const dc = c - seamC[b];
    if (Math.abs(dc) > BAND || Number.isNaN(offA[b]) || Number.isNaN(offB[b])) continue;
    const t = (dc + BAND) / (2 * BAND);
    const want = offA[b] + (offB[b] - offA[b]) * t;
    const r = Math.hypot(x, z);
    const R = sp.bodyR(Math.atan2(x, z), c);
    const now = r - R;
    if (now <= want || r < 1e-6) continue;
    const s = (R + Math.max(0, want)) / r;
    pos[i * 3] = x * s;
    pos[i * 3 + 2] = z * s;
  }
}
