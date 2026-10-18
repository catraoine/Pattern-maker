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
}

/** A top, a T-shirt, or a dress's bodice. */
export interface TopReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  neckline: 'crew' | 'scoop' | 'v' | 'square' | 'boat' | 'one_shoulder' | 'cowl' | 'strapless' | 'sweetheart' | 'cami';
  sleeve: 'none' | 'short' | 'elbow' | 'three_quarter' | 'long';
  sleeveShape: 'fitted' | 'straight' | 'puff' | 'bishop';
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
}

export interface TrousersReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  leg: 'straight' | 'wide' | 'tapered' | 'culotte';
  length: 'full' | 'ankle';
  elasticWaist: boolean;
  opening: 'fly' | 'side_zip';
  pockets: 'none' | 'inseam' | 'slant';
}

export interface OuterReading {
  fit: Pick<'fitted' | 'regular' | 'relaxed'>;
  length: 'cropped' | 'hip' | 'long' | 'thigh' | 'knee' | 'midi';
  front: 'single' | 'double';
  collar: 'notched' | 'stand' | 'collarless';
  pockets: 'none' | 'patch' | 'welt';
  shaping: 'darts' | 'princess' | 'boxy';
  pads: 'none' | 'soft' | 'structured';
  flare: 'straight' | 'a_line';
}

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
  /** Readings from before other garments have none of these: they read skirts only. */
  pieces?: PhotoPiece[];
  extras?: SkirtExtras;
  top?: TopReading | null;
  trousers?: TrousersReading | null;
  outer?: OuterReading | null;
}

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
