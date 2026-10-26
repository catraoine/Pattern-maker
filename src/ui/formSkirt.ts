// Draw on your form: the skirt's openings, fullness, waist and pockets, on a skirt or a dress's skirt.
// Each line picks a detail the skirt already drafts, placed and sized where it was drawn:
// - a slit: a line drawn up from the hem at the centre front, the side, or (turned to the back) the
//   centre back, opening as high as the line goes;
// - fullness: a short mark down from the waist is pleats (inverted at the centre, knife pleats off it,
//   box pleats where the mark doubles back up); a wavy line along the waist is gathers; a point drawn up
//   from the hem is godets, more and narrower the narrower it is drawn; a wavy line across low down is
//   a hem flounce, and across the middle, gathered tiers;
// - the waist (skirt only): a line across the hip is a yoke, one above the waist a high waist, one at
//   the waist the waistband;
// - a pocket: a short line down the side seam below the waist is in-seam pockets.
// The skirt's own coordinates: cm, the centre at x = 0, the skirt's waist at y = waistY, y running down.
import type { P } from '../engine/geometry';
import type { Choices } from '../savedWork';
import { SlitPlace, slitAllowed, slitOf, slitRange } from '../engine/slit';
import { GodetCount, VolumeKind, setVolume, volumeAllowed } from '../engine/skirtVolume';
import { highAllowed } from '../engine/skirtWaist';
import { yokeBlocked } from '../engine/skirtFront';
import { FIT_EASE, SkirtDraft, SkirtMeasurements } from '../engine/skirt';
import { FormLine, FormSide, Reading, median } from './formLines';

const span = (vs: number[]) => Math.max(...vs) - Math.min(...vs);
/** How many times a line turns back on itself up and down: a wavy line turns often. */
function turns(stroke: P[], axis: 'x' | 'y') {
  let n = 0;
  let dir = 0;
  for (let i = 1; i < stroke.length; i++) {
    const d = stroke[i][axis] - stroke[i - 1][axis];
    if (Math.abs(d) < 0.25) continue;
    const s = Math.sign(d);
    if (dir && s !== dir) n++;
    dir = s;
  }
  return n;
}

const SLIT_WORDS: Record<Exclude<SlitPlace, 'none'>, string> = { back: 'Centre back slit', side: 'Side slit', front: 'Centre front slit' };

/**
 * A line up from the hem: a slit there, as high as the line reaches. `allow` says which places this
 * skirt can take (a shirt dress, buttoned down the front, has only the side). `halfAt` is the skirt's
 * half width at a height, to tell the side from the centre.
 */
export function readSlit(stroke: P[], waistY: number, lengthCm: number, m: Pick<SkirtMeasurements, 'waist_to_hip'>, c: Choices, side: FormSide, halfAt: (y: number) => number, allow: (at: SlitPlace) => boolean = () => true): Reading<Choices> {
  const hemY = waistY + lengthCm;
  const ys = stroke.map((q) => q.y);
  const low = Math.max(...ys);
  const top = Math.min(...ys);
  if (low < hemY - 8 || span(ys) < 4 || span(stroke.map((q) => q.x)) > span(ys)) return { said: 'Draw a line straight up from the hem where the slit should open.' };
  const x = Math.abs(median(stroke.map((q) => q.x)));
  const at: Exclude<SlitPlace, 'none'> = x > halfAt((top + low) / 2) * 0.6 ? 'side' : side === 'back' ? 'back' : 'front';
  if (!slitAllowed(c)) return { said: 'A slit goes in a pencil, straight or A-line skirt with a level hem. Fuller skirts and pleats give room to walk already.' };
  if (!allow(at)) return { said: 'This dress opens down the front, so only the side seam can take a slit.' };
  const r = slitRange(lengthCm, m.waist_to_hip);
  const cm = Math.round(Math.min(r.max, Math.max(r.min, hemY - top)));
  const capped = hemY - top > r.max + 1 ? ` That is as high as it goes: above it the seam holds the skirt over your hip.` : '';
  return { choices: { ...c, slit: at, slitCm: cm }, said: `${SLIT_WORDS[at]}, ${cm} cm up from the hem.${capped}` };
}

const FULLNESS_HELP = 'Draw a short mark down from the waist for pleats, a wavy line along the waist for gathers, a point up from the hem for godets, or a wavy line across low down for a flounce.';
const VOLUME_WORDS: Record<Exclude<VolumeKind, 'none'>, string> = {
  knife: 'Knife pleats, all pressed one way round the skirt.',
  box: 'Box pleats: each fold pressed out both ways from the centre of the pleat.',
  inverted: 'Inverted pleats at the centre front and back.',
  godets: 'godets',
  hem_flounce: 'A gathered flounce round the hem.',
  tiers: 'Gathered tiers, each fuller than the one above.',
};

/** A fullness line: pleats, gathers, godets, a flounce or tiers. */
export function readFullness(stroke: P[], waistY: number, lengthCm: number, c: Choices): Reading<Choices> {
  const hemY = waistY + lengthCm;
  const xs = stroke.map((q) => q.x);
  const ys = stroke.map((q) => q.y);
  const top = Math.min(...ys);
  const low = Math.max(...ys);
  const wide = span(xs) > span(ys) * 1.5;
  const wavy = turns(stroke, 'y') >= 3;
  const pick = (kind: Exclude<VolumeKind, 'none'>, godets?: GodetCount): Reading<Choices> => {
    if (!volumeAllowed(c, kind)) {
      const why = kind === 'godets' || kind === 'tiers' ? ' on a straight, pencil or A-line skirt to the knee or longer' : ' on a straight, pencil or A-line skirt with a level hem';
      return { said: `${kind === 'godets' ? 'Godets go' : kind === 'tiers' ? 'Tiers go' : kind === 'hem_flounce' ? 'A flounce goes' : 'Pleats go'}${why}.` };
    }
    const next = setVolume({ ...c, ...(c.silhouette === 'gathered' ? { silhouette: 'straight' as const } : {}) }, kind, godets);
    return { choices: next, said: kind === 'godets' ? `${godets} godets let into the skirt, flaring it from below the hip.` : VOLUME_WORDS[kind] };
  };
  // Along the waist, wavy: gathered onto the waistband.
  if (wide && wavy && Math.abs(median(ys) - waistY) < 5) {
    const next = setVolume({ ...c, silhouette: 'gathered' as const }, 'none');
    return { choices: next, said: 'Gathered onto the waistband all the way round.' };
  }
  // Across, wavy, lower down: a flounce at the hem, or tiers across the middle.
  if (wide && wavy) {
    const at = (median(ys) - waistY) / lengthCm;
    if (at > 0.55) return pick('hem_flounce');
    if (at > 0.25) return pick('tiers');
    return { said: FULLNESS_HELP };
  }
  // A point up from the hem: godets, more of them the narrower it is.
  const ends = [stroke[0], stroke[stroke.length - 1]];
  if (ends.every((q) => q.y > hemY - 6) && top < hemY - 8 && turns(stroke, 'y') >= 1) {
    const base = Math.abs(ends[1].x - ends[0].x);
    return pick('godets', base < 7 ? 8 : base < 12 ? 6 : 4);
  }
  // A short mark down from the waist: pleats.
  if (!wide && top < waistY + 5 && low - top > 3 && low < waistY + lengthCm * 0.6) {
    const back = turns(stroke, 'y') >= 1 && Math.abs(stroke[stroke.length - 1].y - stroke[0].y) < (low - top) * 0.5;
    const centre = Math.abs(median(xs)) < 2.5;
    return pick(back ? 'box' : centre ? 'inverted' : 'knife');
  }
  return { said: FULLNESS_HELP };
}

/** A waist line on a skirt: a yoke across the hip, a high waist above the waist, or the waistband. */
export function readSkirtWaist(stroke: P[], waistY: number, m: Pick<SkirtMeasurements, 'waist_to_hip'>, c: Choices): Reading<Choices> {
  const ys = stroke.map((q) => q.y);
  if (span(stroke.map((q) => q.x)) < 6) return { said: 'Draw across the body: above your waist for a high waist, across the hip for a yoke.' };
  const y = median(ys) - waistY;
  if (y < -2.5) {
    if (!highAllowed(c)) return { said: 'A high waist goes on a straight, pencil, A-line or trumpet skirt with a level hem.' };
    const { wrap: _w, ...rest } = c;
    return { choices: { ...rest, waist: 'high', yoke: undefined }, said: 'A high waist, rising above your natural waist and faced inside.' };
  }
  if (y < 2.5) {
    const { waist: _w, yoke: _y, ...rest } = c;
    return { choices: rest, said: 'A waistband with a zip, at your waist.' };
  }
  if (y > m.waist_to_hip + 3) return { said: 'A yoke sits across the hip. Draw a little higher, between your waist and hip.' };
  const blocked = yokeBlocked({ ...c, yoke: true });
  if (blocked) return { said: blocked };
  return { choices: { ...c, yoke: true, buttons: undefined }, said: 'A shaped yoke across the hip, the darts closed into it.' };
}

/** A pocket line on a skirt: down the side seam, in-seam pockets. */
export function readSkirtPocket(stroke: P[], waistY: number, m: Pick<SkirtMeasurements, 'waist_to_hip'>, c: Choices, halfAt: (y: number) => number, allowed: boolean): Reading<Choices> {
  const ys = stroke.map((q) => q.y);
  const nearSide = stroke.every((q) => Math.abs(q.x) > halfAt(q.y) - 3);
  if (!nearSide || span(ys) < 4 || Math.min(...ys) > waistY + m.waist_to_hip + 12) return { said: 'Draw a short line down the side seam, below the waist, for in-seam pockets.' };
  if (!allowed) return { said: 'In-seam pockets go in a plain side seam: not with pleats, godets, a flounce, a yoke or a wrap, nor on a bias slip.' };
  return { choices: { ...c, pockets: 'inseam' }, said: 'In-seam pockets, hidden in the side seams.' };
}

/** The skirt's half width as worn at a height: the waist, out to the hip, then to the hem with its flare. */
export function skirtHalf(draft: Pick<SkirtDraft, 'lengthCm' | 'flareCm'>, c: Choices, m: SkirtMeasurements, waistY: number) {
  const hipQ = (m.full_hip + FIT_EASE[c.fit].hip) / 4;
  const flare = draft.flareCm ?? (c.silhouette === 'pencil' ? -1.5 : c.silhouette === 'straight' ? 0 : 8);
  return (y: number) => {
    const d = y - waistY;
    if (d <= m.waist_to_hip) return m.waist / 4 + (hipQ - m.waist / 4) * Math.sin((Math.max(0, d) / m.waist_to_hip) * (Math.PI / 2));
    return hipQ + flare * Math.min(1, (d - m.waist_to_hip) / Math.max(1, draft.lengthCm - m.waist_to_hip));
  };
}

/** The slit as it stands, as a line up from the hem, on the side it is on. */
export function slitLines(draft: Pick<SkirtDraft, 'lengthCm' | 'flareCm'>, c: Choices, m: SkirtMeasurements, waistY: number, side: FormSide): Partial<Record<FormLine, P[][]>> {
  const slit = slitOf(c);
  if (!slit) return {};
  const hemY = waistY + draft.lengthCm;
  if (slit.at === 'side') {
    const half = skirtHalf(draft, c, m, waistY);
    const up = (s: number) => [{ x: s * half(hemY), y: hemY }, { x: s * half(hemY - slit.cm), y: hemY - slit.cm }];
    return { slit: [up(1), up(-1)] };
  }
  if ((slit.at === 'back') !== (side === 'back')) return {};
  return { slit: [[{ x: 0, y: hemY }, { x: 0, y: hemY - slit.cm }]] };
}
