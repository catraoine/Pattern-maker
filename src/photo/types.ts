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
  details: string; // one plain sentence on what we noticed but can't draft yet (gathers, a yoke...), or ''
  /** Readings from before other garments have none of these: they read skirts only. */
  pieces?: PhotoPiece[];
  extras?: SkirtExtras;
  top?: TopReading | null;
  trousers?: TrousersReading | null;
  outer?: OuterReading | null;
}

export type PhotoResponse = { ok: true; reading: PhotoReading } | { ok: false; error: PhotoError };

export type PhotoError = 'not_configured' | 'too_large' | 'bad_image' | 'declined' | 'failed' | 'limit_reached' | 'busy';

export const MAX_IMAGE_BYTES = 4_000_000; // base64 text, well under Netlify's 6 MB request limit
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
