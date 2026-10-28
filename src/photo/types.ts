// Shared between the photo screen and the server function that asks Claude about the photo.
import type { Fit, Length, Silhouette } from '../engine/skirt';

export type Confidence = 'low' | 'medium' | 'high';

export interface Pick<T> {
  value: T;
  confidence: Confidence;
}

/** A garment the app can draft. "top" is a woven top (the bodice), "tee" a knit T-shirt. */
export type PieceKind = 'skirt' | 'dress' | 'top' | 'tee' | 'trousers' | 'jacket' | 'coat';

/** One garment seen in the photo, and where its middle is (fractions of the photo's width and height), for its label. */
export interface PhotoPiece {
  garment: PieceKind;
  x: number;
  y: number;
}

/** What a skirt (or a dress's skirt) has besides its shape, all things the app drafts. */
export interface SkirtExtras {
  volume: 'none' | 'knife' | 'box' | 'inverted' | 'godets' | 'hem_flounce' | 'tiers';
  asymHem: 'none' | 'high_low' | 'diagonal';
  pockets: boolean;
  elasticWaist: boolean;
  /** An open slit up from the hem. Older readings leave it out. */
  slit?: 'none' | 'front' | 'side' | 'back';
}

/** A top, a T-shirt, or a dress's bodice. */
export interface TopReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  neckline: 'crew' | 'scoop' | 'v' | 'square' | 'boat' | 'one_shoulder' | 'cowl' | 'strapless' | 'sweetheart' | 'cami' | 'halter';
  sleeve: 'none' | 'short' | 'elbow' | 'three_quarter' | 'long';
  sleeveShape: 'fitted' | 'straight' | 'puff' | 'bishop' | 'cap' | 'flutter';
  length: 'cropped' | 'waist' | 'high_hip' | 'hip' | 'tunic';
  seams: 'darts' | 'princess' | 'none';
  opening: 'back' | 'front_buttons';
  collar: 'none' | 'peter_pan' | 'mandarin' | 'shirt';
  peplum: 'none' | 'flared' | 'gathered';
  boned: boolean;
  /** Knitted jersey (a T-shirt) rather than a woven fabric. */
  knit: boolean;
  /** For a dress: a seam joins bodice and skirt at the natural waist. */
  waistSeam: boolean;
  /** For a dress: where the seam between bodice and skirt sits, or "none" for a dress cut in one. Older readings leave it out. */
  waistSeamAt?: 'none' | 'empire' | 'raised' | 'natural' | 'dropped' | 'low';
  /** A belt at the waist: a tie sash, belt loops (for a belt), or ties. Older readings leave it out. */
  belt?: 'none' | 'sash' | 'loops' | 'ties';
}

/** Cloth types a photo can show: the app's own special cloths, plus the ones it has no setting for yet. */
type FabricKind = 'plain' | 'denim' | 'leather' | 'velvet' | 'corduroy' | 'sheer' | 'satin' | 'lace' | 'sequins' | 'knit' | 'fleece' | 'chiffon' | 'crepe' | 'gauze';
type PrintKindRead = 'none' | 'checks' | 'stripes' | 'floral' | 'animal' | 'abstract' | 'border';
export const READ_COLOURS = ['black', 'white', 'ivory', 'grey', 'brown', 'navy', 'cobalt', 'olive', 'emerald', 'camel', 'rust', 'red', 'burgundy', 'yellow', 'blush', 'lilac', 'other'] as const;
type ColourRead = (typeof READ_COLOURS)[number];

/** The cloth of the main garment: what it is, its colour and its print, as far as a photo shows. */
export interface FabricReading {
  type: FabricKind;
  colour: ColourRead;
  print: PrintKindRead;
  /** See-through, or partly so. */
  sheer: boolean;
}

export interface TrousersReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  leg: 'straight' | 'wide' | 'tapered' | 'culotte';
  length: 'shorts' | 'knee' | 'capri' | 'cropped' | 'ankle' | 'full';
  elasticWaist: boolean;
  opening: 'fly' | 'side_zip';
  pockets: 'none' | 'inseam' | 'slant';
}

export interface OuterReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  length: 'cropped' | 'hip' | 'long' | 'thigh' | 'knee' | 'midi';
  front: 'single' | 'double' | 'zip';
  collar: 'notched' | 'stand' | 'collarless' | 'hood';
  pockets: 'none' | 'patch' | 'welt';
  shaping: 'darts' | 'princess' | 'boxy';
  pads: 'none' | 'soft' | 'structured';
  flare: 'straight' | 'a_line';
  /** How the sleeve joins: a raglan seam from the neck, or set in at the shoulder. Older readings have neither. */
  sleeve?: 'set_in' | 'raglan';
  /** Rib-knit bands at the hem and cuffs. */
  trim?: 'none' | 'rib';
}

/**
 * Exact sizes, so the pattern copies the photo rather than the nearest named option. Lengths are read
 * against the body: a sleeve as a fraction of shoulder point (0) to wrist (1), a hem as a fraction of
 * natural waist (0) to floor (1).
 */
export interface PhotoMeasures {
  /** The front neckline's lowest point, cm below the hollow of the throat. */
  neckDepthCm: number | null;
  sleeveEndsAt: number | null;
  /** A top's hem, below the waist. */
  topHemAt: number | null;
  trouserHemAt: number | null;
}

export type UnsureGroup = 'silhouette' | 'length' | 'neckline' | 'sleeve' | 'leg';

export interface PhotoReading {
  /** The main garment in the photo. */
  garment: PieceKind | 'other' | 'none';
  silhouette: Pick<Silhouette>;
  length: Pick<Length>;
  fit: Pick<Fit>;
  /** Exact proportions read from the photo; see SkirtShape. flareAt is null unless it's a trumpet skirt. */
  shape: { hemAt: number; hemFullness: number; flareAt: number | null; confidence: Confidence };
  /** False when the garment is laid flat or on a hanger, so where the hem falls on a body can't be seen. Older readings leave it out. */
  worn?: boolean;
  details: string; // one plain sentence on what we noticed but can't draft yet (gathers, a yoke...), or ''
  /** Exact sizes read from the photo, each null when it doesn't show. Older readings leave it out. */
  measures?: PhotoMeasures;
  /** The one choice the reading was torn on, and the other option it might be, to ask the sewist. */
  unsure?: { group: UnsureGroup; other: string } | null;
  /** Features of the garment the app can't draft yet, a few words each ("shoulder bow"). Older readings leave it out. */
  missing?: string[];
  /** Readings from before other garments have none of these: they read skirts only. */
  pieces?: PhotoPiece[];
  extras?: SkirtExtras;
  top?: TopReading | null;
  trousers?: TrousersReading | null;
  outer?: OuterReading | null;
  /** The main garment's cloth. Older readings leave it out. */
  fabric?: FabricReading | null;
}

/** A second photo, of the garment from behind: what only the back shows. */
export interface BackReading {
  /** False when the photo doesn't show the garment's back, so nothing in it is used. */
  shown: boolean;
  backNeck: 'plain' | 'scoop' | 'v' | 'keyhole';
  opening: 'zip' | 'buttons' | 'lace_up' | 'none';
  slit: 'none' | 'back' | 'side';
  vent: boolean;
  confidence: Confidence;
  missing: string[];
}

export type BackResponse = { ok: true; back: BackReading } | { ok: false; error: PhotoError };

/** The self-check: the reading corrected against the drawing of what was drafted, and each change in a few words. */
export type CheckResponse = { ok: true; reading: PhotoReading; changes: string[] } | { ok: false; error: PhotoError };

export type PhotoResponse = { ok: true; reading: PhotoReading } | { ok: false; error: PhotoError };

/**
 * "Something else", described in words: whether the app can make it, the closest it can do, or not yet;
 * what to call it; one plain line on what will differ or why not; and the garment to start from, read
 * the same way as a photo.
 */
export interface IdeaReading {
  verdict: 'make' | 'closest' | 'not_yet';
  /** What they asked for, in a few words: "slip dress". */
  name: string;
  note: string;
  start: PieceKind | null;
  /** A skirt or dress cut on the bias, which a photo reading doesn't name. */
  bias: boolean;
  reading: PhotoReading;
}

export type IdeaResponse = { ok: true; idea: IdeaReading } | { ok: false; error: PhotoError };

export const MAX_IDEA_CHARS = 400;

export type PhotoError = 'not_configured' | 'too_large' | 'bad_image' | 'declined' | 'failed' | 'limit_reached' | 'busy';

export const MAX_IMAGE_BYTES = 4_000_000; // base64 text, well under Netlify's 6 MB request limit
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
