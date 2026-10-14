// Shared between the photo screen and the server function that asks Claude about the photo.
import type { Fit, Length, Silhouette } from '../engine/skirt';

export type Confidence = 'low' | 'medium' | 'high';

export interface Pick<T> {
  value: T;
  confidence: Confidence;
}

export interface PhotoReading {
  garment: 'skirt' | 'dress' | 'trousers' | 'top' | 'other' | 'none';
  silhouette: Pick<Silhouette>;
  length: Pick<Length>;
  fit: Pick<Fit>;
  details: string; // one plain sentence on what we noticed but can't draft yet (pleats, pockets...), or ''
}

export type PhotoResponse = { ok: true; reading: PhotoReading } | { ok: false; error: PhotoError };

export type PhotoError = 'not_configured' | 'too_large' | 'bad_image' | 'declined' | 'failed';

export const MAX_IMAGE_BYTES = 4_000_000; // base64 text, well under Netlify's 6 MB request limit
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
