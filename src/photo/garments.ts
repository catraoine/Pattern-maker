// Turning a photo reading into any garment's style choices: the garment the photo shows, or another one
// the sewist picks, using whatever parts of the reading fit it. Every result is made valid the same way
// the style screens make a tapped choice valid.
import type { Choices } from '../savedWork';
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
  isBodice,
  isDress,
  isOuter,
  isTee,
  isTrousers,
  outerAllowed,
  sleeveOf,
  validDetails,
  validTrousers,
} from '../garments';
import type { BodiceLength } from '../engine/bodice';
import { noSeamAllowed } from '../engine/dress';
import type { MyFabric } from '../engine/fabrics';
import type { OuterLength } from '../engine/outerwear';
import type { TeeLength, TeeNeck, TeeSleeve } from '../engine/tee';
import { setVolume, volumeOf } from '../engine/skirtVolume';
import { validCut } from '../engine/slip';
import { slitAllowed } from '../engine/slit';
import { backBlocked } from '../engine/backNeck';
import { elasticAllowed, pocketsAllowed } from '../skirtChoices';
import { NECKLINES } from '../engine/bodice';
import { FULLNESS } from '../ui/BodiceShape';
import { fitOf, shapeOf } from './shape';
import type { BackReading, Confidence, PhotoReading, PieceKind, TopReading } from './types';

/** The wearer's measurements the photo's exact sizes are scaled by, when they've been taken. */
export interface PhotoBody {
  waist_to_floor?: number;
  arm_length?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Necklines whose depth the photo can set: the open ones drawn as a curve or a point. */
const DEEPENED: TopReading['neckline'][] = ['scoop', 'v', 'square'];

/**
 * The exact sizes the photo showed, laid over the named choices: the neckline's depth (as the
 * Draw-on-form neckline, keeping the named one's width and curve), the sleeve's length and a top's hem.
 * A size close to the named choice's own is left alone, so a plain scoop stays a scoop.
 */
function measuredBodice(c: BodiceChoices, r: PhotoReading, body: PhotoBody | undefined, garment: 'bodice' | 'dress'): BodiceChoices {
  const m = r.measures;
  if (!m) return c;
  let out = c;
  const named = NECKLINES[c.neckline];
  if (num(m.neckDepthCm) && DEEPENED.includes(c.neckline) && (!c.collar || c.collar === 'none') && Math.abs(m.neckDepthCm - named.frontDepth) >= 2.5) {
    out = { ...out, neck: { ...named, frontDepth: clamp(Math.round(m.neckDepthCm), 4, 30), fullness: FULLNESS[c.neckline] } };
  }
  const sleeve = sleeveOf(out);
  if (num(m.sleeveEndsAt) && body?.arm_length && sleeve.length !== 'none' && sleeve.shape !== 'cap' && !sleeve.cut) {
    out = { ...out, sleeveCm: Math.round(clamp(m.sleeveEndsAt, 0.15, 1) * body.arm_length) };
  }
  if (garment === 'bodice' && num(m.topHemAt) && body?.waist_to_floor && out.length !== 'waist') {
    out = { ...out, dropCm: Math.round(clamp(m.topHemAt, 0, 0.45) * body.waist_to_floor) };
  }
  return out;
}

export const PIECE_WORDS: Record<PieceKind, string> = {
  skirt: 'skirt',
  dress: 'dress',
  top: 'top',
  tee: 'T-shirt',
  trousers: 'trousers',
  jacket: 'jacket',
  coat: 'coat',
};

/** "a dress", "trousers". */
export const aPiece = (g: PieceKind) => (g === 'trousers' ? 'trousers' : `a ${PIECE_WORDS[g]}`);

/** "Dress", "T-shirt", for labels and chips. */
export const pieceName = (g: PieceKind) => PIECE_WORDS[g][0].toUpperCase() + PIECE_WORDS[g].slice(1);

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
  if (x.slit && x.slit !== 'none' && slitAllowed(c)) c = { ...c, slit: x.slit };
  if (c.asymHem || volumeOf(c) !== 'none') delete c.shape;
  return c;
}

const BODICE_LENGTH: Record<TopReading['length'], BodiceLength> = { cropped: 'waist', waist: 'waist', high_hip: 'high_hip', hip: 'hip', tunic: 'hip' };

/** A woven top, or a dress's bodice (waist length, no peplum, zipped at the back). */
function bodiceChoices(t: TopReading | null | undefined, garment: 'bodice' | 'dress' = 'bodice', r?: PhotoReading, body?: PhotoBody): BodiceChoices {
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
  const shaped = { ...v, sleeveShape: sleeveOf(v).shape };
  return r ? measuredBodice(shaped, r, body, garment) : shaped;
}

function dressChoices(r: PhotoReading, body?: PhotoBody): DressChoices {
  const bodice = bodiceChoices(r.top, 'dress', r, body);
  let skirt = skirtChoices(r, 'dress');
  const t = r.top;
  // A belt at the waist: a sash, or loops for a belt; a wrap ties already.
  const belt = t?.belt === 'sash' ? 'sash' : t?.belt === 'loops' ? 'loops' : undefined;
  if (belt && bodice.closure !== 'wrap') skirt = { ...skirt, belt };
  // Where the seam sits, when the reading says; a dress cut in one is a sheath where the skirt shape allows it.
  const at = t?.waistSeamAt;
  if (at === 'none' && noSeamAllowed(bodice) && bodice.closure === 'back_zip') skirt = { ...skirt, noSeam: 'sheath' };
  const waistSeam = at && at !== 'none' && at !== 'natural' ? { waistSeam: at } : {};
  return { garment: 'dress', fit: bodice.fit, bodice, skirt, ...waistSeam };
}

/** The maker's fabric as a photo read it: the app's own cloths by name, the rest by their nearest fibre, with the colour and print. */
export function fabricFor(r: PhotoReading): MyFabric | undefined {
  const f = r.fabric;
  if (!f) return undefined;
  const type = f.type;
  const special: MyFabric['special'] | undefined = type === 'chiffon' ? 'sheer' : (['denim', 'leather', 'velvet', 'corduroy', 'sheer', 'satin', 'lace', 'sequins'] as const).find((k) => k === type);
  const fibre: MyFabric['fibre'] | undefined = type === 'knit' || type === 'gauze' || type === 'corduroy' || type === 'denim' ? 'cotton' : type === 'fleece' ? 'wool' : type === 'chiffon' || type === 'satin' ? 'silk' : type === 'crepe' ? 'viscose' : type === 'plain' ? 'cotton' : undefined;
  const colour = f.colour !== 'other' ? f.colour.replace(/^./, (c) => c.toUpperCase()) : undefined;
  const print: Partial<MyFabric> =
    f.print === 'checks' ? { print: 'checks', checks: {} } : f.print === 'stripes' ? { print: 'checks', checks: { stripes: true } } : f.print === 'border' ? { print: 'border' } : f.print !== 'none' ? { print: 'ditsy' } : {};
  const sheer = f.sheer && !special ? { special: 'sheer' as const } : {};
  return { ...(fibre ? { fibre } : {}), ...(special ? { special } : {}), ...sheer, ...(colour ? { colour } : {}), ...(type === 'fleece' ? { weight: 'heavy' as const } : {}), ...print };
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
  halter: 'crew',
  v: 'v',
};
const TEE_SLEEVE: Record<TopReading['sleeve'], TeeSleeve> = { none: 'short', short: 'short', elbow: 'elbow', three_quarter: 'elbow', long: 'long' };
const TEE_LENGTH: Record<TopReading['length'], TeeLength> = { cropped: 'cropped', waist: 'cropped', high_hip: 'hip', hip: 'hip', tunic: 'tunic' };

/** A knit T-shirt. A photo can't show the knit's stretch, so that stays for the sewist to set. */
function teeChoices(t: TopReading | null | undefined): TeeChoices {
  if (!t) return { ...DEFAULT_TEE_CHOICES };
  return { ...DEFAULT_TEE_CHOICES, fit: safeFit(t.fit), neckline: TEE_NECK[t.neckline], sleeve: TEE_SLEEVE[t.sleeve], length: TEE_LENGTH[t.length] };
}

function trousersChoices(r: PhotoReading, body?: PhotoBody): TrousersChoices {
  const t = r.trousers;
  if (!t) return { ...DEFAULT_TROUSERS_CHOICES };
  // The exact length, on the wearer, for any leg but a culotte (whose length is its shape); the draft keeps it in range.
  const at = r.measures?.trouserHemAt;
  const lengthCm = num(at) && body?.waist_to_floor && t.leg !== 'culotte' ? { lengthCm: Math.round(clamp(at, 0.2, 1) * body.waist_to_floor) } : {};
  return validTrousers({
    ...lengthCm,
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
function outerChoices(r: PhotoReading, kind: 'jacket' | 'coat'): OuterChoices {
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
    sleeve: o.sleeve === 'raglan' ? 'raglan' : base.sleeve,
    trim: o.trim === 'rib' ? 'rib' : 'none',
  };
  // A notched lapel needs a shoulder seam and a buttoned front; a raglan is cut off a one-piece body.
  if (!outerAllowed(c, 'collar', c.collar)) c.collar = 'stand';
  if (!outerAllowed(c, 'shaping', c.shaping)) c.shaping = 'darts';
  if (!outerAllowed(c, 'vent', c.vent)) c.vent = 'none';
  return c;
}

/** The style choices for one garment, from the photo, with its exact sizes when the wearer's measurements are known. */
export function choicesFor(r: PhotoReading, garment: PieceKind, body?: PhotoBody): PatternChoices {
  switch (garment) {
    case 'skirt':
      return skirtChoices(r);
    case 'dress':
      return dressChoices(r, body);
    case 'top':
      return bodiceChoices(r.top, 'bodice', r, body);
    case 'tee':
      return teeChoices(r.top);
    case 'trousers':
      return trousersChoices(r, body);
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

/** A back the app can draft: a low or keyhole back where the bodice allows one. */
function bodiceBack(c: BodiceChoices, b: BackReading): BodiceChoices {
  return b.backNeck !== 'plain' && !backBlocked(c, b.backNeck) ? { ...c, back: b.backNeck } : c;
}

/** A slit at the back or side where the skirt allows one, in place of the one read from the front. */
function skirtBack(c: Choices, b: BackReading): Choices {
  return b.slit !== 'none' && slitAllowed(c) && (!c.slit || c.slit === 'none') ? { ...c, slit: b.slit } : c;
}

/**
 * The garment with what its back photo showed: the back neckline, a slit, a jacket or coat's vent. A
 * photo that doesn't show the garment's back changes nothing.
 */
export function withBack(c: PatternChoices, b: BackReading | undefined): PatternChoices {
  if (!b?.shown) return c;
  if (isDress(c)) return { ...c, bodice: bodiceBack(c.bodice, b), skirt: skirtBack(c.skirt, b) };
  if (isBodice(c)) return bodiceBack(c, b);
  if (isOuter(c)) {
    const vent = b.vent ? 'centre' : 'none';
    return outerAllowed(c, 'vent', vent) ? { ...c, vent } : c;
  }
  if (isTee(c) || isTrousers(c)) return c;
  return skirtBack(c as Choices, b);
}

/** What the back showed that the app can't draft yet, for the "Not in the app yet" list. */
export function backMissing(b: BackReading | undefined): string[] {
  if (!b?.shown) return [];
  const opening = b.opening === 'buttons' ? ['buttoned back'] : b.opening === 'lace_up' ? ['lace-up back'] : [];
  return [...opening, ...b.missing];
}

/** The back details the pattern took from the back photo, in words: "V back, back slit". */
export function backWords(before: PatternChoices, after: PatternChoices): string {
  const words: string[] = [];
  const bod = (c: PatternChoices) => (isDress(c) ? c.bodice : isBodice(c) ? c : undefined);
  const sk = (c: PatternChoices) => (isDress(c) ? c.skirt : !isBodice(c) && !isOuter(c) && !isTee(c) && !isTrousers(c) ? (c as Choices) : undefined);
  const back = bod(after)?.back;
  if (back && back !== bod(before)?.back) words.push({ plain: '', scoop: 'scoop back', v: 'V back', keyhole: 'keyhole back' }[back]);
  const slit = sk(after)?.slit;
  if (slit && slit !== 'none' && slit !== sk(before)?.slit) words.push(`${slit} slit`);
  if (isOuter(after) && isOuter(before) && after.vent !== before.vent) words.push(after.vent === 'centre' ? 'back vent' : 'no back vent');
  return words.join(', ');
}
