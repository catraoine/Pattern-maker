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
  oversizeOuter,
  sleeveOf,
  validDetails,
  validTrousers,
} from '../garments';
import type { BodiceLength } from '../engine/bodice';
import { noSeamAllowed } from '../engine/dress';
import type { MyFabric } from '../engine/fabrics';
import { OUTER_EASE, OUTER_EASE_MAX, OUTER_LENGTHS, OUTER_SHOULDER, lapelled, measuredOuterDrop, outerDrop, type OuterLength, type OuterMeasurements } from '../engine/outerwear';
import type { TeeLength, TeeNeck, TeeSleeve } from '../engine/tee';
import { setSkirtDetail, skirtDetailOf, volumeOf } from '../engine/skirtVolume';
import { validCut } from '../engine/slip';
import { slitAllowed } from '../engine/slit';
import { backBlocked } from '../engine/backNeck';
import { elasticAllowed, pocketsAllowed } from '../skirtChoices';
import { BODICE_FIT_EASE, BUST_EASE_RANGE, NECKLINES } from '../engine/bodice';
import { FULLNESS } from '../ui/BodiceShape';
import { DROP } from '../engine/sleeveCut';
import { fitOf, shapeOf } from './shape';
import type { BackReading, Confidence, PhotoReading, PieceKind, TopReading } from './types';

/** The wearer's measurements the photo's exact sizes are scaled by, when they've been taken. */
export interface PhotoBody {
  waist_to_floor?: number;
  arm_length?: number;
  full_bust?: number;
  full_hip?: number;
  waist_to_hip?: number;
  waist_to_knee?: number;
  front_hps_to_waist?: number;
}

/** An average adult's front, neck to waist, in cm: sizes the photo reads in cm are scaled from it to the wearer's. */
const AVERAGE_FRONT = 44;

/** From this many times her bust round, a jacket or coat in a photo is the oversized cut. */
export const OVERSIZED_FROM = 1.28;

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
  if (num(m.neckDepthCm) && (DEEPENED as string[]).includes(c.neckline) && (!c.collar || c.collar === 'none') && Math.abs(m.neckDepthCm - named.frontDepth) >= 2.5) {
    out = { ...out, neck: { ...named, frontDepth: clamp(Math.round(m.neckDepthCm), 4, 30), fullness: FULLNESS[c.neckline] } };
  }
  const sleeve = sleeveOf(out);
  if (num(m.sleeveEndsAt) && body?.arm_length && sleeve.length !== 'none' && sleeve.shape !== 'cap' && !sleeve.cut) {
    out = { ...out, sleeveCm: Math.round(clamp(m.sleeveEndsAt, 0.15, 1) * body.arm_length) };
  }
  // The room at the bust as the photo showed it, for a woven top that isn't boned: the nearest fit, with its ease
  // set to the photo's where it differs by more than a little. Never closer than a fitted top's.
  if (garment === 'bodice' && num(m.bustRoom) && body?.full_bust && out.structure !== 'boned') {
    const ease = clamp((m.bustRoom - 1) * body.full_bust, BUST_EASE_RANGE.min + 1, BUST_EASE_RANGE.max);
    const fits = ['fitted', 'regular', 'relaxed'] as const;
    const fit = fits.reduce((a, b) => (Math.abs(BODICE_FIT_EASE[b].bust - ease) < Math.abs(BODICE_FIT_EASE[a].bust - ease) ? b : a));
    const named = { ...out, fit };
    out = Math.abs(BODICE_FIT_EASE[fit].bust - ease) >= 2 ? { ...named, bustEase: Math.round(ease) } : named;
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
    const v = setSkirtDetail(c, x.volume);
    if (skirtDetailOf(v) !== 'none') c = v;
  }
  if (garment === 'skirt' && x.elasticWaist && elasticAllowed(c)) c = { ...c, waist: 'elastic' };
  // Ruched sides keep their side seams plain: no pocket or slit in them.
  if (x.pockets && pocketsAllowed(c) && !c.ruched) c = { ...c, pockets: 'inseam' };
  if (x.slit && x.slit !== 'none' && slitAllowed(c) && !(c.ruched && x.slit === 'side')) c = { ...c, slit: x.slit };
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

/**
 * The leg's widths as the photo showed them, as rounds in cm: the knee, and the hem carried on to full length
 * (the leg widens or narrows evenly from the knee down, as when it is drawn on the form). Only when the wearer's
 * hips are known, and not for a culotte, whose width is its shape.
 */
function measuredLeg(r: PhotoReading, leg: TrousersChoices['leg'], body: PhotoBody | undefined): { legCm: { knee: number; hem: number } } | Record<string, never> {
  const m = r.measures;
  if (!m || !body?.full_hip || leg === 'culotte' || !num(m.kneeRoom) || !num(m.legHemRoom)) return {};
  const H = body.full_hip;
  const knee = clamp(m.kneeRoom, 0.36, 0.72) * H;
  let hem = clamp(m.legHemRoom, 0.28, 0.8) * H;
  const floor = body.waist_to_floor;
  const kn = body.waist_to_knee ?? (floor ? floor * 0.56 : undefined);
  if (num(m.trouserHemAt) && floor && kn) {
    const L = clamp(m.trouserHemAt, 0.2, 1) * floor;
    const full = 0.98 * floor;
    if (L > kn + 4 && full > L) hem = knee + ((hem - knee) * (full - kn)) / (L - kn);
  }
  return { legCm: { knee: Math.round(knee), hem: Math.round(clamp(hem, 31, 0.8 * H)) } };
}

function trousersChoices(r: PhotoReading, body?: PhotoBody): TrousersChoices {
  const t = r.trousers;
  if (!t) return { ...DEFAULT_TROUSERS_CHOICES };
  // The exact length, on the wearer, for any leg but a culotte (whose length is its shape); the draft keeps it in range.
  const at = r.measures?.trouserHemAt;
  const lengthCm = num(at) && body?.waist_to_floor && t.leg !== 'culotte' ? { lengthCm: Math.round(clamp(at, 0.2, 1) * body.waist_to_floor) } : {};
  return validTrousers({
    ...lengthCm,
    ...measuredLeg(r, t.leg, body),
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

/**
 * The proportions the photo showed, laid over a jacket or coat's named choices: the hem's drop below the waist,
 * the room at the bust, the lapel break and the buttons (scaled from an average adult's front to the wearer's), the
 * shoulder line, and the flare from how wide the hem stands. A size close to the named choice's own is left alone.
 */
function measuredOuter(c: OuterChoices, r: PhotoReading, body: PhotoBody | undefined): OuterChoices {
  const m = r.measures;
  if (!m) return c;
  const out: OuterChoices = { ...c };
  const scale = body?.front_hps_to_waist ? body.front_hps_to_waist / AVERAGE_FRONT : 1;
  if (num(m.outerHemAt) && body?.waist_to_floor && r.worn !== false) {
    const om = body as OuterMeasurements;
    const drop = measuredOuterDrop(om, c.garment, clamp(m.outerHemAt, 0, 0.9) * body.waist_to_floor);
    out.dropCm = Math.round(drop);
    // The named length nearest it, so the style screen shows the right one.
    out.length = OUTER_LENGTHS[c.garment].reduce((a, b) => (Math.abs(outerDrop(om, b) - drop) < Math.abs(outerDrop(om, a) - drop) ? b : a));
    if (out.length === 'cropped' && out.vent === 'centre') out.vent = 'none';
  }
  if (num(m.bustRoom) && body?.full_bust) {
    // Ratios to her own body, not fixed ease (Cat, Nov 7: "the insp vest is oversized"): from about 1.28 times her
    // bust it is the oversized cut, with or without sleeves, taking all the room the photo shows.
    if (m.bustRoom >= OVERSIZED_FROM && out.fit !== 'oversized') return measuredOuter(oversizeOuter({ ...out, fit: 'oversized' }), r, body);
    const ease = (clamp(m.bustRoom, 1.04, 1.75) - 1) * body.full_bust;
    // Only the oversized cut takes more room than a blouse block allows.
    out.easeCm = Math.round(out.fit === 'oversized' ? Math.min(OUTER_EASE_MAX, ease) : Math.min(BUST_EASE_RANGE.max, ease));
  }
  if (num(m.breakCm) && c.front !== 'zip') out.breakCm = Math.round(clamp(m.breakCm, 6, 44) * scale);
  if (num(m.buttons) && c.front !== 'zip' && m.buttons >= 1) out.buttons = Math.round(clamp(m.buttons, 1, 8));
  if (num(m.buttonGapCm) && c.front !== 'zip' && (m.buttons ?? 2) >= 2) out.buttonGapCm = Math.round(clamp(m.buttonGapCm, 5, 20) * scale);
  // The shoulder line: an oversized sleeve already drops its shoulder DROP.out past hers, so only the rest is added.
  // A sleeveless one keeps a set-in shoulder (a dropped one buckles at the seam on the form, with no sleeve to hold
  // it out), moved out the whole way.
  if (num(m.shoulderOutCm) && out.sleeve !== 'raglan') {
    const own = out.fit === 'oversized' && out.sleeve !== 'none' ? DROP.out : 0;
    const by = Math.round(clamp(m.shoulderOutCm, OUTER_SHOULDER.min, OUTER_SHOULDER.max + own) - own);
    if (Math.abs(by) >= 1) out.shoulderCm = clamp(by, OUTER_SHOULDER.min, OUTER_SHOULDER.max);
  }
  // An oversized waistcoat hangs straight from its shoulder: the shoulder goes out at least as far as the room at
  // the side, so the armhole doesn't scoop in under a narrow shoulder and the side jut out below it.
  if (out.fit === 'oversized' && out.sleeve === 'none' && out.easeCm !== undefined) {
    const side = Math.round((out.easeCm - OUTER_EASE.jacket.regular) / 4);
    if (side > (out.shoulderCm ?? 0)) out.shoulderCm = clamp(side, 0, OUTER_SHOULDER.max);
  }
  if (num(m.outerHemFullness)) {
    const f = m.outerHemFullness;
    const flare: OuterChoices['flare'] = f >= 1.35 ? 'flared' : f >= 1.15 && c.garment === 'coat' ? 'a_line' : 'straight';
    if (outerAllowed(out, 'flare', flare)) out.flare = flare;
  }
  return out;
}

/** A jacket or a coat. The back vent and the two-piece sleeve can't be seen from the front, so they keep their defaults. */
function outerChoices(r: PhotoReading, kind: 'jacket' | 'coat', body?: PhotoBody): OuterChoices {
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
    sleeve: o.sleeve === 'raglan' ? 'raglan' : o.sleeve === 'none' && kind === 'jacket' ? 'none' : base.sleeve,
    ...(o.sleeve === 'none' && kind === 'jacket' ? { pads: 'none' as const } : {}),
    trim: o.trim === 'rib' ? 'rib' : 'none',
  };
  // A notched lapel needs a shoulder seam and a buttoned front; a raglan is cut off a one-piece body.
  if (!outerAllowed(c, 'collar', c.collar)) c.collar = 'stand';
  if (!outerAllowed(c, 'shaping', c.shaping)) c.shaping = 'darts';
  if (!outerAllowed(c, 'vent', c.vent)) c.vent = 'none';
  return measuredOuter(c, r, body);
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
      return outerChoices(r, garment, body);
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

/**
 * The proportions the pattern took from the photo, in plain words for the photo's summary line: "Hem 28 cm below
 * the waist", "Lapels break 17 cm below the neck", "3 buttons, 14 cm apart". `size` writes a length in the
 * sewist's unit.
 */
export function proportionWords(c: PatternChoices, size: (cm: number) => string): string[] {
  const words: string[] = [];
  if (isOuter(c)) {
    if (c.dropCm !== undefined) words.push(`Hem ${size(c.dropCm)} below the waist`);
    if (c.breakCm !== undefined) words.push(`${lapelled(c.collar) ? 'Lapels break' : 'Fastens from'} ${size(c.breakCm)} below the neck`);
    if (c.buttons !== undefined) words.push(`${c.buttons} button${c.buttons === 1 ? '' : 's'}${c.buttonGapCm !== undefined && c.buttons > 1 ? `, ${size(c.buttonGapCm)} apart` : ''}`);
    if (c.shoulderCm) words.push(c.shoulderCm > 0 ? `Shoulders ${size(c.shoulderCm)} past yours` : `Shoulders cut in ${size(-c.shoulderCm)}`);
    if (c.easeCm !== undefined) words.push(`${size(c.easeCm)} of room at the bust`);
  } else if (isTrousers(c)) {
    if (c.legCm) words.push(`Leg ${size(c.legCm.knee)} round the knee`);
  } else if (isBodice(c) && c.bustEase !== undefined) {
    words.push(`${size(c.bustEase)} of room at the bust`);
  }
  return words;
}
