// Turning a photo reading into exact skirt proportions, and describing them in plain words.
import type { SkirtShape } from '../engine/skirt';
import type { PhotoReading } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The photo's exact proportions, kept to sensible bounds in case a reading is off. */
export function shapeOf(r: PhotoReading): SkirtShape | undefined {
  const s = r.shape;
  if (!s || !Number.isFinite(s.hemAt) || !Number.isFinite(s.hemFullness)) return undefined;
  return {
    hemAt: clamp(s.hemAt, 0.25, 0.98),
    hemFullness: clamp(s.hemFullness, 0.8, 8),
    ...(r.silhouette.value === 'trumpet' && s.flareAt !== null && Number.isFinite(s.flareAt) ? { flareAt: clamp(s.flareAt, 0.25, 0.9) } : {}),
  };
}

/** One plain sentence describing the matched shape. */
export function shapeLine(shape: SkirtShape): string {
  const at = shape.hemAt;
  const where =
    at < 0.33 ? 'high on the thigh' : at < 0.45 ? 'at mid-thigh' : at < 0.53 ? 'just above the knee' : at < 0.6 ? 'at the knee' : at < 0.7 ? 'below the knee' : at < 0.82 ? 'at mid-calf' : at < 0.9 ? 'at the lower calf' : 'at the ankle';
  const f = shape.hemFullness;
  const full = f < 0.97 ? 'narrower than your hips' : f < 1.08 ? 'about as wide as your hips' : `${f.toFixed(1)} times your hips round the hem`;
  return `Hem ${where}, ${full}${shape.flareAt !== undefined ? ', flaring from ' + (shape.flareAt < 0.48 ? 'above the knee' : shape.flareAt < 0.6 ? 'the knee' : 'below the knee') : ''}.`;
}
