// A slit, chosen: at the centre back (the walking slit), the centre front, or up the left side seam,
// at a height set in cm above the hem. Left unchosen, a pencil skirt or a straight one below the knee
// gets the 15 cm walking slit at the back, as it always has. The seam stops at a SLIT ENDS notch and
// is left open below it, its edges turned under along the seam line; a front slit needs a centre front
// seam, so the front is cut as a pair instead of on the fold. Plain ASCII punctuation (see instructions.ts).
import { len, sub } from './geometry';
import { pathOf, ringOf } from './manipulate';
import { markSeam } from './pockets';
import type { Piece } from './piece';

export type SlitPlace = 'none' | 'back' | 'side' | 'front';
export const SLIT_PLACES: [SlitPlace, string][] = [
  ['none', 'None'],
  ['back', 'Back'],
  ['side', 'Side'],
  ['front', 'Front'],
];

/** Heights in cm above the hem: the walking slit's, each place's first height, the lowest, and how far
 * below the hip line the highest stops (the seam has to hold the skirt over the hip). */
export const SLIT = { walking: 15, start: { back: 15, side: 30, front: 20 }, min: 8, belowHip: 5 };

export interface SlitStyle {
  silhouette: string;
  length: string;
  slit?: SlitPlace;
  slitCm?: number;
  pleats?: string;
  godets?: unknown;
  flounce?: string;
  asymHem?: string;
  wrap?: boolean;
}

/** The slit as drafted: where, and its height above the hem. */
export interface Slit {
  at: Exclude<SlitPlace, 'none'>;
  cm: number;
}

/** A pencil skirt, or a straight one below the knee, needs a walking slit at the centre back, unless
 * pleats, godets, a flounce or tiers give the room to walk. */
export function walkingSlit(s: SlitStyle): boolean {
  if (!plain(s)) return false;
  return s.silhouette === 'pencil' || (s.silhouette === 'straight' && (s.length === 'midi' || s.length === 'maxi'));
}

const plain = (s: SlitStyle) => (s.pleats ?? 'none') === 'none' && !s.godets && (s.flounce ?? 'none') === 'none';

/**
 * Where a slit can go: in a seam of a pencil, straight or A-line skirt with a level hem and nothing
 * added. Fuller skirts and the flare of a trumpet need none, and a wrap opens already.
 */
export const slitAllowed = (s: SlitStyle) =>
  ['pencil', 'straight', 'a_line'].includes(s.silhouette) && plain(s) && (s.asymHem ?? 'none') === 'none' && !s.wrap;

/** The slit chosen, or the walking slit a skirt gets unasked, before its height is fitted to the skirt. */
export function slitOf(s: SlitStyle): Slit | undefined {
  if (!slitAllowed(s)) return undefined;
  const at = s.slit ?? (walkingSlit(s) ? 'back' : 'none');
  if (at === 'none') return undefined;
  return { at, cm: s.slitCm ?? SLIT.start[at] };
}

/** The heights a slit can be on a skirt this long, with its hip line this far down. */
export function slitRange(lengthCm: number, hipDepth: number): { min: number; max: number } {
  const max = Math.max(SLIT.min, Math.floor(lengthCm - hipDepth - SLIT.belowHip));
  return { min: SLIT.min, max };
}

/** A piece cut on the fold, cut as a pair with a centre seam instead. */
function unfold(pc: Piece): Piece {
  if (!pc.fold) return pc;
  const r = ringOf(pc.outline);
  const cut = 'Cut 2 (1 pair)';
  const { fold: _f, ...allowances } = pc.allowances;
  return {
    ...pc,
    outline: pathOf({ pts: r.pts, tags: r.tags.map((t) => (t === 'fold' ? 'centre' : t)) }),
    fold: undefined,
    labels: pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: cut } : l)),
    cut,
    allowances,
    meta: { ...pc.meta, slitSeam: true },
  };
}

/** The piece with its SLIT ENDS notch on the seam, `cm` up from the hem. */
function notched(pc: Piece, tag: string, cm: number): Piece {
  const r = ringOf(pc.outline);
  const n = r.pts.length;
  const start = r.tags.findIndex((t, i) => t === tag && r.tags[(i - 1 + n) % n] !== tag);
  if (start < 0) return pc;
  const run = [r.pts[start]];
  for (let i = start; r.tags[i % n] === tag && run.length <= n; i++) run.push(r.pts[(i + 1) % n]);
  let total = 0;
  for (let i = 1; i < run.length; i++) total += len(sub(run[i], run[i - 1]));
  // The seam may run up from the hem or down to it.
  const fromHem = run[0].y > run[run.length - 1].y;
  return markSeam(pc, tag, [fromHem ? cm : total - cm], 'SLIT ENDS');
}

/** The skirt's front and back with the slit marked, the front cut as a pair for a front slit. */
export function slitPieces(front: Piece, back: Piece, slit: Slit): [Piece, Piece] {
  if (slit.at === 'side') return [notched(front, 'side', slit.cm), notched(back, 'side', slit.cm)];
  if (slit.at === 'front') return [notched(unfold(front), 'centre', slit.cm), back];
  return [front, notched(unfold(back), 'centre', slit.cm)];
}

// ---------------------------------------------------------------------------------------------------
// Words for the sewing steps.

/** Where a seam is sewn to: down to the slit's notch when the slit is in it, or to the hem. */
export const toHem = (slit: Slit | undefined, where: Slit['at']) => (slit?.at === where ? 'down to the SLIT ENDS notch' : 'to the hem');

/** What happens at the bottom of a seam with the slit in it. */
export function slitStop(slit: Slit | undefined, where: Slit['at']): string {
  if (slit?.at !== where) return '';
  const lead = where === 'side' ? 'On the left side (as you wear it), sew only down to the SLIT ENDS notch and backstitch firmly there' : 'Backstitch firmly at the SLIT ENDS notch';
  // A short slit at the back is the walking slit a narrow skirt needs, and is called that.
  const name = where === 'back' && slit.cm <= 20 ? 'walking slit' : 'slit';
  return ` ${lead}: below it the seam stays open as a ${slit.cm} cm ${name}, its edges pressed under along the seam line.`;
}

/** Finishing the slit's edges, after the hem is turned up. */
export function slitHem(slit: Slit | undefined): string {
  if (!slit) return '';
  return ` Turn the hem up across the slit's edges, then fold the slit's seam allowances under by half and topstitch round the slit 1 cm from its edges, across the top at the notch, so it cannot tear.`;
}

/** The lining's seam stops higher, so it never shows in the slit. */
export function slitLining(slit: Slit | undefined): string {
  if (!slit) return '';
  const seam = slit.at === 'side' ? 'left side seam' : slit.at === 'back' ? 'centre back seam' : 'centre front seam';
  return ` Leave the lining's ${seam} open below its SLIT ENDS notch, and press those edges under 1.5 cm and stitch them, so the lining stays clear of the slit.`;
}

/** The slit for the pattern's notes: "A 30 cm slit up the left side seam, from the hem." */
export const slitNote = (slit: Slit | undefined) =>
  slit ? `A ${slit.cm} cm slit up the ${slit.at === 'side' ? 'left side seam' : `centre ${slit.at} seam`}, from the hem, ending at the SLIT ENDS notch.` : '';

