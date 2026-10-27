// Shaped bodice hems, drawn on the form: curved, dipped at the centre front, or longer at the back.
// The shape is the skirt's (hem.ts): offsets in cm from the level hem, evenly spaced from the centre to
// the side seam, front and back, positive lower. Only a bodice that ends below the waist takes one: a
// waist-length bodice (and a dress's bodice) stops at the waist or is sewn to a skirt or a peplum
// there, so its waist stays level.
//
// Round the body the hem is one smooth line: the front and back meet at the side seam at the same
// height and the same slope, and the line is square to the centre front and centre back, so each half
// mirrors without a point or a dip. The ends move along the seams, so each side seam grows by exactly
// its offset and the front and back still sew together.
import { P, add, len, lerp, mul, sub, taggedLength, unit } from './geometry';
import { HEM_SAMPLES, HemShape, isShaped, matchSides, shapeHemBy } from './hem';
import type { Piece } from './piece';

/** How high and how low a shaped hem can go, in cm below the waist: clear of the fish-eye darts' ends
 * at the top, and a long tunic's dip below the hip at the bottom. The side seam moves less: it can rise
 * as far, but drop only a little, since below the hip the bodice is no wider than where it was cut. */
export const HEM_ABOVE = 5;
const bodiceHemRange = (m: { waist_to_hip?: number }, drop: number) => ({
  min: HEM_ABOVE,
  max: (m.waist_to_hip ?? drop) + 12,
  sideMax: Math.max(drop, Math.min(drop + 2, (m.waist_to_hip ?? drop) + 4)),
});

/**
 * The hem shape as it will be drafted on a bodice whose level hem is `drop` cm below the waist: its
 * sides brought to the same height (front and back sew together there) and every offset kept inside
 * the range. Undefined for a waist-length bodice, or a hem that comes out level.
 */
export function bodiceHemShape(h: HemShape | undefined, m: { waist_to_hip?: number }, drop: number): HemShape | undefined {
  if (!h || drop <= 0 || !isShaped(h)) return undefined;
  const range = bodiceHemRange(m, drop);
  const clamp = (lo: number, hi: number) => (v: number) => Math.round(Math.min(hi - drop, Math.max(lo - drop, v)) * 10) / 10;
  const atSide = clamp(range.min, range.sideMax);
  const side = (offs: number[]) => offs.map((v, i) => (i === HEM_SAMPLES - 1 ? atSide(v) : v));
  const out = matchSides({ front: side(h.front), back: side(h.back) }, clamp(range.min, range.max));
  return isShaped(out) ? out : undefined;
}

/**
 * The hem's offset round the body, `sigma` cm from the centre front along the front hem and on along
 * the back to the centre back: a smooth curve through the offsets, level where it crosses the centre
 * front and the centre back, and where it meets the side seam, squared off it the way a pattern
 * cutter squares a hem off its seams.
 */
export function hemRound(h: HemShape, lf: number, lb: number): (sigma: number) => number {
  const n = HEM_SAMPLES - 1;
  const xs = [...h.front.map((_, i) => (lf * i) / n), ...h.back.slice(0, n).reverse().map((_, i) => lf + (lb * (i + 1)) / n)];
  const ys = [...h.front, ...h.back.slice(0, n).reverse()];
  // Each knot's slope from its neighbours (Catmull-Rom), and none at the two centres and the side seam.
  const ms = ys.map((_, i) => (i === 0 || i === n || i === ys.length - 1 ? 0 : (ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1])));
  return (sigma: number) => {
    const s = Math.min(xs[xs.length - 1], Math.max(0, sigma));
    let i = 0;
    while (i < xs.length - 2 && s > xs[i + 1]) i++;
    const w = xs[i + 1] - xs[i] || 1;
    const t = (s - xs[i]) / w;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * w * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * w * ms[i + 1];
  };
}

/**
 * The hem's offset on the front or back as drafted, `u` from 0 at the centre to 1 at the side seam,
 * for drawing it as worn. `lf` and `lb` are the front and back hems' lengths, or their widths.
 */
export function hemOffsetAt(h: HemShape, side: 'front' | 'back', u: number, lf = 1, lb = 1): number {
  const at = hemRound(h, lf, lb);
  return side === 'front' ? at(lf * u) : at(lf + lb * (1 - u));
}

/**
 * Shape a bodice front and back's hems, each a half piece (the front on the fold, the back a pair)
 * whose hem runs from the side seam to the centre. Each point is moved by the hem's offset for how far
 * round the body it is; the ends move along the side seam and the centre line.
 */
export function shapeBodiceHems(front: Piece, back: Piece, h: HemShape): void {
  // A straight hem is drawn as a curve first, so it is followed point by point as it is reshaped.
  for (const pc of [front, back]) {
    const path = pc.outline;
    path.segs = path.segs.map((sg, i) => {
      if (sg.kind !== 'L' || path.tags[i] !== 'hem') return sg;
      const from = i ? path.segs[i - 1].to : path.start;
      return { kind: 'C', c1: lerp(from, sg.to, 1 / 3), c2: lerp(from, sg.to, 2 / 3), to: sg.to };
    });
  }
  const lf = taggedLength(front.outline, 'hem');
  const lb = taggedLength(back.outline, 'hem');
  const at = hemRound(h, lf, lb);
  const ends = [front, back].map(hemEnds);
  shapeHemBy(front, (t) => at(lf * (1 - t)), { alongSeams: true });
  shapeHemBy(back, (t) => at(lf + lb * t), { alongSeams: true });
  // On a curved side seam, moving its end along the seam's direction changes its length only roughly,
  // and differently front and back: carry the back's end on along its seam until the two match.
  for (let n = 0; n < 4; n++) {
    const gap = taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side');
    if (Math.abs(gap) < 0.01) break;
    const path = back.outline;
    const i = path.tags.indexOf('hem');
    const sideEnd = path.segs[i - 1];
    const prev = i >= 2 ? path.segs[i - 2].to : path.start;
    const shift = mul(unit(sub(sideEnd.to, sideEnd.kind === 'C' ? sideEnd.c2 : prev)), gap);
    sideEnd.to = add(sideEnd.to, shift);
    if (sideEnd.kind === 'C') sideEnd.c2 = add(sideEnd.c2, shift);
    const s0 = path.segs[i];
    if (s0.kind === 'C') s0.c1 = add(s0.c1, shift);
  }
  // The shape is level at both ends, so the hem leaves the side seam and meets the centre in the
  // directions it was drafted in: set them exactly, so the corners stay square.
  [front, back].forEach((pc, k) => {
    const path = pc.outline;
    const i = path.tags.indexOf('hem');
    const j = path.tags.lastIndexOf('hem');
    const s0 = path.segs[i];
    const sN = path.segs[j];
    const from = path.segs[i - 1].to;
    if (s0.kind === 'C') s0.c1 = add(from, mul(ends[k].start, len(sub(s0.c1, from))));
    if (sN.kind === 'C') sN.c2 = add(sN.to, mul(ends[k].end, len(sub(sN.c2, sN.to))));
  });
  // A curved hem turns up narrowly, so it lies flat.
  for (const pc of [front, back]) pc.allowances.hem = Math.min(pc.allowances.hem ?? 1.5, 1.5);
}

/** The directions a piece's hem leaves the seam before it and arrives at the edge after it, inward. */
function hemEnds(pc: Piece): { start: P; end: P } {
  const path = pc.outline;
  const i = path.tags.indexOf('hem');
  const j = path.tags.lastIndexOf('hem');
  const s0 = path.segs[i];
  const sN = path.segs[j];
  const from = path.segs[i - 1].to;
  const before = j > 0 ? path.segs[j - 1].to : path.start;
  return { start: unit(sub(s0.kind === 'C' ? s0.c1 : s0.to, from)), end: unit(sub(sN.kind === 'C' ? sN.c2 : before, sN.to)) };
}

/** Words for a hem shape: dipped at the front, longer at the back, or curving up to the centre. */
export function hemWords(h: HemShape): string {
  const n = HEM_SAMPLES - 1;
  const front = h.front[0] - h.front[n];
  const back = h.back[0] - h.back[n];
  if (back - front > 3 && back > 2) return `longer at the back by about ${Math.round(h.back[0] - h.front[0])} cm`;
  if (front > 2 && front >= back) return `dipping ${Math.round(front)} cm lower at the centre front`;
  if (back > 2) return `dipping ${Math.round(back)} cm lower at the centre back`;
  if (front < -2 && back < -2) return 'curving up from the side seams to the centre front and back';
  if (front < -2) return `curving up ${Math.round(-front)} cm to the centre front`;
  if (back < -2) return `curving up ${Math.round(-back)} cm to the centre back`;
  return 'gently curved';
}
