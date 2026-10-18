// Turning a photo reading into any garment's style choices: the garment the photo shows, or another one
// the sewist picks, using whatever parts of the reading fit it. Every result is made valid the same way
// the style screens make a tapped choice valid.
import type { Choices } from '../App';
import {
  BodiceChoices,
  DARTS_FOR_FIT,
  DEFAULT_BODICE,
  DEFAULT_COAT_CHOICES,
  DEFAULT_JACKET_CHOICES,
  DEFAULT_TEE_CHOICES,
  DEFAULT_TROUSERS_CHOICES,
  DressChoices,
  OuterChoices,
  PatternChoices,
  TeeChoices,
  TrousersChoices,
  outerAllowed,
  sleeveOf,
  validDetails,
  validTrousers,
} from '../garments';
import type { BodiceLength } from '../engine/bodice';
import type { OuterLength } from '../engine/outerwear';
import type { TeeLength, TeeNeck, TeeSleeve } from '../engine/tee';
import { setVolume, volumeOf } from '../engine/skirtVolume';
import { validCut } from '../engine/slip';
import { elasticAllowed, pocketsAllowed } from '../screens/StyleScreen';
import { fitOf, shapeOf } from './shape';
import type { Confidence, PhotoReading, PieceKind, TopReading } from './types';

export const PIECE_WORDS: Record<PieceKind, string> = {
  skirt: 'skirt',
  dress: 'dress',
  top: 'top',
  tee: 'T-shirt',
  trousers: 'trousers',
  jacket: 'jacket',
  coat: 'coat',
};

/** Every garment the photo can be drafted as, in the order the garment list shows them. */
export const PIECE_KINDS: PieceKind[] = ['skirt', 'dress', 'top', 'tee', 'trousers', 'jacket', 'coat'];

/** "fitted" only when the photo clearly shows it: too tight is worse than too roomy (see fitOf). */
const safeFit = <F extends string>(f: { value: F; confidence: Confidence }): F | 'regular' => (f.value === 'fitted' && f.confidence !== 'high' ? 'regular' : f.value);

/** The garment to start from: the main one, when the app drafts it. */
export function mainPiece(r: PhotoReading): PieceKind | undefined {
  return r.garment === 'other' || r.garment === 'none' ? undefined : r.garment;
}

/** The pieces to label on the photo, when it shows more than one garment (G3). */
export function piecesToPick(r: PhotoReading) {
  const seen = (r.pieces ?? []).filter((p, i, all) => all.findIndex((q) => q.garment === p.garment) === i);
  return seen.length > 1 ? seen.map((p) => ({ ...p, x: Math.min(0.92, Math.max(0.08, p.x)), y: Math.min(0.95, Math.max(0.05, p.y)) })) : [];
}

/**
 * The skirt, or a dress's skirt: the shape as read, plus pleats, godets, a flounce or tiers, a high-low or
 * diagonal hem, pockets and an elastic waist when the photo shows them and the shape allows them. A detail
 * replaces the photo's exact proportions, as tapping one does on the style screen.
 */
export function skirtChoices(r: PhotoReading, garment: 'skirt' | 'dress' = 'skirt'): Choices {
  let c: Choices = { fit: fitOf(r), silhouette: r.silhouette.value, length: r.length.value, shape: shapeOf(r) };
  const x = r.extras;
  if (!x) return c;
  if (x.asymHem !== 'none') c = { ...c, asymHem: x.asymHem };
  c = validCut({ ...c, ...(garment === 'dress' ? { joinTo: true } : {}) });
  delete (c as { joinTo?: unknown }).joinTo;
  if (x.volume !== 'none') {
    const v = setVolume(c, x.volume);
    if (volumeOf(v) !== 'none') c = v;
  }
  if (garment === 'skirt' && x.elasticWaist && elasticAllowed(c)) c = { ...c, waist: 'elastic' };
  if (x.pockets && pocketsAllowed(c)) c = { ...c, pockets: 'inseam' };
  if (c.asymHem || volumeOf(c) !== 'none') delete c.shape;
  return c;
}

const BODICE_LENGTH: Record<TopReading['length'], BodiceLength> = { cropped: 'waist', waist: 'waist', high_hip: 'high_hip', hip: 'hip', tunic: 'hip' };

/** A woven top, or a dress's bodice (waist length, no peplum, zipped at the back). */
export function bodiceChoices(t: TopReading | null | undefined, garment: 'bodice' | 'dress' = 'bodice'): BodiceChoices {
  if (!t) return { ...DEFAULT_BODICE };
  const fit = safeFit(t.fit);
  // An unshaped top goes without darts where the fit allows it; anything shaped keeps both.
  const darts = t.seams === 'none' && DARTS_FOR_FIT[fit].includes('none') ? 'none' : 'bust_waist';
  const raw: BodiceChoices = {
    garment: 'bodice',
    fit,
    neckline: t.neckline,
    length: garment === 'dress' ? 'waist' : BODICE_LENGTH[t.length],
    darts,
    sleeve: t.sleeve,
    sleeveShape: t.sleeveShape,
    princess: t.seams === 'princess' ? 'shoulder' : 'none',
    closure: t.opening === 'front_buttons' ? 'front_buttons' : 'back_zip',
    collar: t.collar,
    structure: t.boned ? 'boned' : 'none',
    peplum: garment === 'dress' ? 'none' : t.peplum,
  };
  const v = validDetails(raw, garment);
  return { ...v, sleeveShape: sleeveOf(v).shape };
}

export function dressChoices(r: PhotoReading): DressChoices {
  const bodice = bodiceChoices(r.top, 'dress');
  return { garment: 'dress', fit: bodice.fit, bodice, skirt: skirtChoices(r, 'dress') };
}

const TEE_NECK: Record<TopReading['neckline'], TeeNeck> = {
  crew: 'crew',
  boat: 'crew',
  scoop: 'scoop',
  square: 'scoop',
  sweetheart: 'scoop',
  cowl: 'scoop',
  one_shoulder: 'crew',
  strapless: 'scoop',
  cami: 'scoop',
  v: 'v',
};
const TEE_SLEEVE: Record<TopReading['sleeve'], TeeSleeve> = { none: 'short', short: 'short', elbow: 'elbow', three_quarter: 'elbow', long: 'long' };
const TEE_LENGTH: Record<TopReading['length'], TeeLength> = { cropped: 'cropped', waist: 'cropped', high_hip: 'hip', hip: 'hip', tunic: 'tunic' };

/** A knit T-shirt. A photo can't show the knit's stretch, so that stays for the sewist to set. */
export function teeChoices(t: TopReading | null | undefined): TeeChoices {
  if (!t) return { ...DEFAULT_TEE_CHOICES };
  return { ...DEFAULT_TEE_CHOICES, fit: safeFit(t.fit), neckline: TEE_NECK[t.neckline], sleeve: TEE_SLEEVE[t.sleeve], length: TEE_LENGTH[t.length] };
}

export function trousersChoices(r: PhotoReading): TrousersChoices {
  const t = r.trousers;
  if (!t) return { ...DEFAULT_TROUSERS_CHOICES };
  return validTrousers({
    garment: 'trousers',
    fit: safeFit(t.fit),
    leg: t.leg,
    length: t.length,
    closure: t.opening,
    waist: t.elasticWaist ? 'elastic' : 'band',
    pockets: t.pockets,
  });
}

const JACKET_LENGTHS: OuterLength[] = ['cropped', 'hip', 'long'];
const COAT_LENGTHS: OuterLength[] = ['thigh', 'knee', 'midi'];
const AS_JACKET: Partial<Record<OuterLength, OuterLength>> = { thigh: 'long', knee: 'long', midi: 'long' };
const AS_COAT: Partial<Record<OuterLength, OuterLength>> = { cropped: 'thigh', hip: 'thigh', long: 'thigh' };

/** A jacket or a coat. The back vent and the two-piece sleeve can't be seen from the front, so they keep their defaults. */
export function outerChoices(r: PhotoReading, kind: 'jacket' | 'coat'): OuterChoices {
  const base = kind === 'jacket' ? DEFAULT_JACKET_CHOICES : DEFAULT_COAT_CHOICES;
  const o = r.outer;
  if (!o) return { ...base };
  const length = (kind === 'jacket' ? JACKET_LENGTHS : COAT_LENGTHS).includes(o.length) ? o.length : ((kind === 'jacket' ? AS_JACKET : AS_COAT)[o.length] ?? base.length);
  const c: OuterChoices = {
    ...base,
    fit: safeFit(o.fit),
    length,
    front: o.front,
    collar: o.collar,
    pockets: o.pockets,
    shaping: o.shaping,
    pads: o.pads,
    flare: kind === 'coat' ? o.flare : 'straight',
  };
  if (!outerAllowed(c, 'shaping', c.shaping)) c.shaping = 'darts';
  if (!outerAllowed(c, 'vent', c.vent)) c.vent = 'none';
  return c;
}

/** The style choices for one garment, from the photo. */
export function choicesFor(r: PhotoReading, garment: PieceKind): PatternChoices {
  switch (garment) {
    case 'skirt':
      return skirtChoices(r);
    case 'dress':
      return dressChoices(r);
    case 'top':
      return bodiceChoices(r.top);
    case 'tee':
      return teeChoices(r.top);
    case 'trousers':
      return trousersChoices(r);
    case 'jacket':
    case 'coat':
      return outerChoices(r, garment);
  }
}

/**
 * A plain note when the photo shows something the chosen garment can't be: a dress with no waist seam
 * is drafted with one, a sleeveless knit top gets short sleeves, a T-shirt's stretch comes from your knit.
 */
export function pieceNote(r: PhotoReading, garment: PieceKind): string {
  const t = r.top;
  if (garment === 'dress' && t && !t.waistSeam) return 'This dress has no waist seam. We draft dresses with one, so the pattern joins bodice and skirt at your waist.';
  if (garment === 'tee' && t?.sleeve === 'none') return 'T-shirts come with sleeves, so this starts with short ones.';
  if (garment === 'tee') return 'A photo can’t show how stretchy a knit is, so set your own knit’s stretch on the next screen.';
  if ((garment === 'jacket' || garment === 'coat') && r.outer) return 'The back vent and sleeve can’t be seen from the front, so they start as standard.';
  return '';
}
