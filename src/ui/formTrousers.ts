// Draw on your form, for trousers and shorts, on the legs form. Each line is read the way a cutter
// reads chalk on a toile:
// - the side: drawn down the outside of the leg. Where it passes the hip sets the fit; how far out it is
//   at the knee and at the hem sets the leg's width there, to the cm, and names the shape nearest it
//   (tapered, straight, bootcut, flare or wide). Shorts keep the width the thigh needs;
// - the hem: drawn across the leg, the length to the cm, shorts to the floor;
// - the waist: drawn across the body, where the waistband sits: a high rise above your waist, a low
//   rise below it;
// - a pocket: a slant from the waist out to the side is slant pockets, a short line down the side seam
//   is in-seam pockets.
// The same coordinates as the trousers' worn view: cm, the centre front at x = 0, your waist at y = 0,
// y running down.
import type { P } from '../engine/geometry';
import { trousersView } from '../engine/flat';
import { INSEAM, SLANT } from '../engine/pockets';
import { LEG_WIDTHS, Leg, RISE_RANGE, riseFor, TROUSER_EASE, TROUSER_LENGTHS, TrousersDraft, TrousersMeasurements, lengthCmRange, trouserLength } from '../engine/trousers';
import type { Fit } from '../engine/skirt';
import { TROUSER_GROUPS, TrousersChoices, trouserAllowed, validTrousers } from '../garments';
import type { FormLine, Reading } from './formLines';
import { median } from './formLines';

const FITS: Fit[] = ['fitted', 'regular', 'relaxed'];
/** The shapes a drawn leg is named by; culottes are cut to their own length, so a drawn leg is never one. */
const LEGS: Leg[] = ['tapered', 'straight', 'bootcut', 'flare', 'wide'];
const round = (v: number, step = 0.5) => Math.round(v / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lengthName = (id: string) => TROUSER_GROUPS.find((g) => g.id === 'length')!.options.find((o) => o[0] === id)![1];

/** Where the trousers' lines fall on the form: the waistband, the hip, the knee and the hem, and the leg's centre. */
export function trouserMarks(d: TrousersDraft, m: TrousersMeasurements) {
  const rise = d.riseCm ?? 0;
  const W = d.finishedWaist / 4;
  const hw = d.finishedHip / 4 + 0.5;
  const cd = m.crotch_depth + 1;
  const L = d.lengthCm;
  // As the worn view draws them (see trousersView).
  const kn = Math.min(cd + (L - cd) * 0.45, L - 4);
  return { rise, W, hw, hd: m.waist_to_hip, cd, L, kn, crease: hw / 2, knee: Math.max(d.kneeCm / 4, 4), hem: Math.max(d.hemCm / 4, 4) };
}

/** The full-length leg's hem round, from the hem round at a shorter length: the leg widens (or narrows)
 * evenly from the knee down, so it is carried on to the floor. */
function fullHem(m: TrousersMeasurements, c: TrousersChoices, knee: number, hemAt: number, L: number, kn: number) {
  const full = trouserLength(m, { leg: c.leg, length: 'full' });
  if (L <= kn + 4 || full <= kn) return hemAt;
  return knee + ((hemAt - knee) * (full - kn)) / (L - kn);
}

/** The side line: the fit at the hip, the leg's widths at the knee and the hem. */
export function readTrouserSide(stroke: P[], d: TrousersDraft, m: TrousersMeasurements, c: TrousersChoices): Reading<TrousersChoices> {
  const k = trouserMarks(d, m);
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const atHip = pts.filter((q) => Math.abs(q.y - k.hd) < 5);
  const atKnee = pts.filter((q) => Math.abs(q.y - k.kn) < 6);
  const atHem = pts.filter((q) => q.y > k.L - 10 && q.y < k.L + 4);
  if (!atHip.length && !atKnee.length && !atHem.length) return { said: 'Draw down the outside of the leg, past the hip and the knee to the hem.' };
  let next: TrousersChoices = { ...c };
  const words: string[] = [];
  if (atHip.length) {
    const ease = 4 * median(atHip.map((q) => q.x)) - m.full_hip;
    const fit = FITS.reduce((a, b) => (Math.abs(TROUSER_EASE[b].hip - ease) < Math.abs(TROUSER_EASE[a].hip - ease) ? b : a));
    next.fit = fit;
    words.push(`a ${fit} fit at the hip`);
  }
  if (d.shorts) {
    if (atKnee.length || atHem.length) words.push('the legs as wide as your thigh needs (shorts take their width from it)');
  } else if (atKnee.length || atHem.length) {
    if (c.leg === 'culotte') return { said: 'Culottes keep their own wide leg. Pick another leg shape to draw it.' };
    // Round the leg is four times the half-width out from the crease, front and back.
    const H = d.finishedHip;
    const knee = atKnee.length ? round(4 * (median(atKnee.map((q) => q.x)) - k.crease)) : d.kneeCm;
    const hemAt = atHem.length ? 4 * (median(atHem.map((q) => q.x)) - k.crease) : undefined;
    const hem = round(hemAt !== undefined ? fullHem(m, c, knee, hemAt, k.L, k.kn) : c.legCm?.hem ?? Math.max(31, LEG_WIDTHS[c.leg].hem * H));
    const leg = LEGS.reduce((a, b) => {
      const dist = (l: Leg) => Math.hypot(LEG_WIDTHS[l].knee - knee / H, LEG_WIDTHS[l].hem - hem / H);
      return dist(b) < dist(a) ? b : a;
    });
    next = { ...next, leg, legCm: { knee: Math.max(1, knee), hem: Math.max(1, hem) } };
    words.push(`${leg === 'flare' ? 'a flared' : leg === 'bootcut' ? 'a bootcut' : `a ${leg}`} leg, ${Math.round(knee)} cm round the knee and ${Math.round(hem)} cm at a full-length hem`);
  }
  if (!words.length) return { said: 'Draw down the outside of the leg, past the hip and the knee to the hem.' };
  const said = words.join(', and ');
  return { choices: next, said: said[0].toUpperCase() + said.slice(1) + '.' };
}

/** The hem line: the length, to the cm, named after the length it is nearest when it is close to one. */
export function readTrouserHem(stroke: P[], m: TrousersMeasurements, c: TrousersChoices): Reading<TrousersChoices> {
  if (c.leg === 'culotte') return { said: 'Culottes are cut to mid-calf. Pick another leg shape to set the length.' };
  const xs = stroke.map((q) => q.x);
  if (Math.max(...xs) - Math.min(...xs) < 3) return { said: 'Draw across the leg where you want the hem.' };
  const r = lengthCmRange(m);
  const y = median(stroke.map((q) => q.y));
  if (y < r.min - 6) return { said: 'That is above where the legs part. Draw across the leg lower down.' };
  const L = round(clamp(y, r.min, r.max));
  const named = TROUSER_LENGTHS.map((id) => ({ id, y: trouserLength(m, { leg: c.leg, length: id }) }));
  const near = named.reduce((a, b) => (Math.abs(b.y - L) < Math.abs(a.y - L) ? b : a));
  const shorts = L < m.waist_to_knee - 6;
  const length = shorts ? 'shorts' : near.id === 'shorts' ? 'knee' : near.id;
  if (Math.abs(near.y - L) <= 1.5) return { choices: validTrousers({ ...c, length: near.id, lengthCm: undefined }), said: `${lengthName(near.id)}: ${Math.round(near.y)} cm down the outside leg.` };
  const inside = Math.round(L - m.crotch_depth);
  return {
    choices: validTrousers({ ...c, length, lengthCm: L }),
    said: shorts ? `Shorts, ${Math.round(L)} cm down the outside leg (${inside} cm down the inside leg).` : `${Math.round(L)} cm down the outside leg, nearest ${lengthName(near.id).toLowerCase()}.`,
  };
}

/** The waist line: where the waistband sits, above your waist for a high rise or below it for a low one. */
export function readTrouserRise(stroke: P[], m: TrousersMeasurements, c: TrousersChoices): Reading<TrousersChoices> {
  const xs = stroke.map((q) => q.x);
  if (Math.max(...xs) - Math.min(...xs) < 6) return { said: 'Draw across the body where the waistband should sit.' };
  const y = median(stroke.map((q) => q.y));
  if (y < RISE_RANGE.min - 6 || y > -RISE_RANGE.min + 6) return { said: 'Draw the waistband near your waist: up to 5 cm above it, or down to 8 cm below.' };
  const rise = round(riseFor(m, -y));
  if (Math.abs(rise) < 1) return { choices: { ...c, riseCm: undefined }, said: 'At your waist: a mid rise.' };
  const lowest = rise > -y + 0.5 ? ` (as low as it goes on you: lower, the body is nearly as wide as your hip)` : '';
  return {
    choices: { ...c, riseCm: rise },
    said: rise > 0 ? `High rise: the waistband sits ${rise} cm above your waist.` : `Low rise: the waistband sits ${-rise} cm below your waist${lowest}.`,
  };
}

/** A pocket line: a slant from the waist out to the side, or a short line down the side seam. */
export function readTrouserPocket(stroke: P[], d: TrousersDraft, m: TrousersMeasurements, c: TrousersChoices): Reading<TrousersChoices> {
  const k = trouserMarks(d, m);
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const top = pts.reduce((a, b) => (b.y < a.y ? b : a));
  const bottom = pts.reduce((a, b) => (b.y > a.y ? b : a));
  const sideAt = (y: number) => (y >= k.hd ? k.hw : k.W + (k.hw - k.W) * Math.sin((Math.max(0, Math.min(y, k.hd)) / k.hd) * (Math.PI / 2)));
  const out = bottom.x - top.x;
  const down = bottom.y - top.y;
  if (down < 4) return { said: 'Draw the pocket from the waist out to the side for slant pockets, or down the side seam for in-seam ones.' };
  if (top.y < 5 - k.rise && out > 2 && bottom.x > sideAt(bottom.y) - 3) {
    if (!trouserAllowed(c, 'pockets', 'slant')) return { said: 'Slant pockets need the fly front or an elastic waist: the side zip runs where the left one would sit.' };
    return { choices: validTrousers({ ...c, pockets: 'slant' }), said: `Slant pockets, opening about ${SLANT.down + 1} cm down the side.` };
  }
  if (Math.abs(out) < down / 2 && pts.every((q) => q.x > sideAt(q.y) - 3)) {
    return { choices: validTrousers({ ...c, pockets: 'inseam' }), said: `In-seam pockets, ${INSEAM.opening} cm openings in the side seams.` };
  }
  return { said: 'Draw the pocket from the waist out to the side for slant pockets, or down the side seam for in-seam ones.' };
}

/** The trousers' lines as they stand, on the form: the side and the hem (the cloth's own edges), the waistband line and the pockets. */
export function trouserLines(d: TrousersDraft, m: TrousersMeasurements): Partial<Record<FormLine, P[][]>> {
  const k = trouserMarks(d, m);
  const both = (pts: P[]) => [pts, pts.map((q) => ({ x: -q.x, y: q.y }))];
  const top = -k.rise;
  const view = trousersView(d, { waist_to_hip: m.waist_to_hip, crotch_depth: m.crotch_depth });
  const pockets = view.lines.filter((l) => l.kind === 'seam' && l.pts.every((q) => q.y < k.hd + 15) && l.pts.some((q) => Math.abs(q.x) > 1));
  return {
    fit: both([{ x: k.W, y: top }, { x: k.hw, y: k.hd }, { x: k.crease + k.knee, y: k.kn }, { x: k.crease + k.hem, y: k.L }]),
    hem: both([{ x: k.crease - k.hem, y: k.L }, { x: k.crease + k.hem, y: k.L }]),
    waist: [[{ x: -k.W, y: top }, { x: k.W, y: top }]],
    pocket: pockets.map((l) => l.pts),
  };
}

/** What to draw for each of the trousers' lines. */
export const TROUSER_HELP: Partial<Record<FormLine, string>> = {
  fit: 'Draw down the outside of the leg: closer at the hip for a closer fit, then out to the knee and the hem. Narrow at the knee and wide at the hem makes a flare.',
  hem: 'Draw across the leg where you want the hem, from shorts to the floor.',
  waist: 'Draw across the body where the waistband should sit: above your waist for a high rise, below it for a low rise.',
  pocket: 'Draw a slant from the waist out to the side for slant pockets, or a short line down the side seam for in-seam pockets.',
};
