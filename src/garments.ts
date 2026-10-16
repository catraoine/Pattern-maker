// The garments the app can make, and the style choices saved for each.
import type { Choices } from './App';
import type { BodiceDarts, BodiceFit, BodiceLength, DrawnNeck, Neckline } from './engine/bodice';

export interface BodiceChoices {
  garment: 'bodice';
  fit: BodiceFit;
  neckline: Neckline;
  length: BodiceLength;
  darts: BodiceDarts;
  /** Shaped by hand on the sketch: a dragged hem (cm below the waist), a dragged fit (bust ease in
   * cm) and a drawn neckline. Each replaces its named choice until that choice is picked again. */
  dropCm?: number;
  bustEase?: number;
  neck?: DrawnNeck;
}

/** A saved pattern's choices. Skirt choices predate bodices, so they carry no garment field. */
export type PatternChoices = Choices | BodiceChoices;

export const isBodice = (c: PatternChoices): c is BodiceChoices => (c as BodiceChoices).garment === 'bodice';

export const DEFAULT_BODICE: BodiceChoices = { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' };

type Group<K extends keyof BodiceChoices> = { id: K; label: string; options: [BodiceChoices[K], string][] };

// Options from styling/styling-options.json (top). Oversized fit and princess seams need their own blocks.
export const BODICE_GROUPS: [Group<'fit'>, Group<'neckline'>, Group<'length'>, Group<'darts'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'neckline',
    label: 'Neckline',
    options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['square', 'Square'], ['boat', 'Boat']],
  },
  { id: 'length', label: 'Length', options: [['waist', 'Waist'], ['high_hip', 'High hip'], ['hip', 'Hip']] },
  { id: 'darts', label: 'Darts', options: [['bust_waist', 'Bust and waist'], ['bust', 'Bust only'], ['none', 'No darts']] },
];

/** Which dart choices each fit allows: a fitted bodice needs both, and only a relaxed one can go without. */
export const DARTS_FOR_FIT: Record<BodiceFit, BodiceDarts[]> = {
  fitted: ['bust_waist'],
  regular: ['bust_waist', 'bust'],
  relaxed: ['bust_waist', 'bust', 'none'],
};

const NECK_WORDS: Record<Neckline, string> = { crew: 'crew neck', scoop: 'scoop neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' };
const LENGTH_WORDS: Record<BodiceLength, string> = { waist: 'waist-length', high_hip: 'high-hip-length', hip: 'hip-length' };

export function describeBodice(c: BodiceChoices) {
  const length = c.dropCm === undefined ? LENGTH_WORDS[c.length] : c.dropCm < 3 ? 'waist-length' : `${Math.round(c.dropCm)} cm below the waist`;
  const neck = c.neck ? 'drawn neckline' : NECK_WORDS[c.neckline];
  return c.dropCm !== undefined && c.dropCm >= 3 ? `bodice with a ${neck}, ${length}` : `${length} ${neck} bodice`;
}
