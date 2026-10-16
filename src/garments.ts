// The garments the app can make, and the style choices saved for each.
import type { Choices } from './App';
import type { BodiceDarts, BodiceFit, BodiceLength, DrawnNeck, Neckline } from './engine/bodice';
import { SHAPES_FOR_LENGTH, SleeveLength, SleeveShape } from './engine/sleeve';
import type { DartPlace, PrincessLine } from './engine/manipulate';
import type { Closure, Collar } from './engine/collar';
import { LEG_WORDS, Leg, TrouserClosure, TrouserLength } from './engine/trousers';
import type { Fit } from './engine/skirt';

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
  /** Older saves have no sleeves. */
  sleeve?: SleeveLength;
  sleeveShape?: SleeveShape;
  /** Older saves have the block's side bust dart, no princess seams, a back zip and no collar. */
  bustDart?: DartPlace;
  princess?: PrincessLine;
  closure?: Closure;
  collar?: Collar;
}

/** A dress: a waist-length bodice and a skirt, in one fit. */
export interface DressChoices {
  garment: 'dress';
  fit: BodiceFit;
  bodice: BodiceChoices;
  skirt: Choices;
}

/** Trousers: the leg's shape and length, and a fly or side zip. */
export interface TrousersChoices {
  garment: 'trousers';
  fit: Fit;
  leg: Leg;
  length: TrouserLength;
  closure: TrouserClosure;
}

export const DEFAULT_TROUSERS_CHOICES: TrousersChoices = { garment: 'trousers', fit: 'regular', leg: 'straight', length: 'full', closure: 'fly' };

export const TROUSER_GROUPS: { id: 'fit' | 'leg' | 'length' | 'closure'; label: string; options: [string, string][] }[] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'leg', label: 'Leg', options: [['straight', 'Straight'], ['wide', 'Wide'], ['tapered', 'Tapered'], ['culotte', 'Culotte']] },
  { id: 'length', label: 'Length', options: [['full', 'Full length'], ['ankle', 'Ankle']] },
  { id: 'closure', label: 'Opening', options: [['fly', 'Fly zip'], ['side_zip', 'Side zip']] },
];

/** A plain name, such as "Ankle-length wide-leg trousers with a side zip". */
export function describeTrousers(c: TrousersChoices) {
  const length = c.leg === 'culotte' ? '' : c.length === 'ankle' ? 'Ankle-length ' : '';
  const words = `${length}${LEG_WORDS[c.leg]} with a ${c.closure === 'fly' ? 'fly front' : 'side zip'}`;
  return words[0].toUpperCase() + words.slice(1);
}

/** A saved pattern's choices. Skirt choices predate bodices, so they carry no garment field. */
export type PatternChoices = Choices | BodiceChoices | DressChoices | TrousersChoices;

export const isBodice = (c: PatternChoices): c is BodiceChoices => (c as BodiceChoices).garment === 'bodice';
export const isDress = (c: PatternChoices): c is DressChoices => (c as DressChoices).garment === 'dress';
export const isTrousers = (c: PatternChoices): c is TrousersChoices => (c as TrousersChoices).garment === 'trousers';

export const DEFAULT_BODICE: BodiceChoices = { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight' };

type Group<K extends keyof BodiceChoices> = { id: K; label: string; options: [NonNullable<BodiceChoices[K]>, string][] };

// Options from styling/styling-options.json (top). Oversized fit needs its own block.
export const BODICE_GROUPS: [Group<'fit'>, Group<'neckline'>, Group<'length'>, Group<'darts'>, Group<'sleeve'>, Group<'sleeveShape'>, Group<'princess'>, Group<'bustDart'>, Group<'closure'>, Group<'collar'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'neckline',
    label: 'Neckline',
    options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['square', 'Square'], ['boat', 'Boat']],
  },
  { id: 'length', label: 'Length', options: [['waist', 'Waist'], ['high_hip', 'High hip'], ['hip', 'Hip']] },
  { id: 'darts', label: 'Darts', options: [['bust_waist', 'Bust and waist'], ['bust', 'Bust only'], ['none', 'No darts']] },
  {
    id: 'sleeve',
    label: 'Sleeves',
    options: [['none', 'Sleeveless'], ['short', 'Short'], ['elbow', 'Elbow'], ['three_quarter', 'Three-quarter'], ['long', 'Long']],
  },
  { id: 'sleeveShape', label: 'Sleeve shape', options: [['fitted', 'Fitted'], ['straight', 'Straight'], ['puff', 'Puff'], ['bishop', 'Bishop']] },
  { id: 'princess', label: 'Princess seams', options: [['none', 'None'], ['shoulder', 'From the shoulder'], ['armhole', 'From the armhole']] },
  {
    id: 'bustDart',
    label: 'Bust dart from',
    options: [['side', 'Side seam'], ['french', 'French (low side)'], ['shoulder', 'Shoulder'], ['neck', 'Neckline'], ['armhole', 'Armhole'], ['waist', 'Waist']],
  },
  { id: 'closure', label: 'Opening', options: [['back_zip', 'Back zip'], ['front_buttons', 'Front buttons']] },
  { id: 'collar', label: 'Collar', options: [['none', 'None'], ['peter_pan', 'Peter Pan'], ['mandarin', 'Mandarin'], ['shirt', 'Shirt collar']] },
];

export const COLLAR_WORDS: Record<Collar, string> = { none: '', peter_pan: 'Peter Pan collar', mandarin: 'mandarin collar', shirt: 'shirt collar' };

/**
 * Which styled details a bodice allows, and why not when it doesn't: princess seams need bust and waist
 * darts to carry; a top below the waist has no waist seam for the bust dart; collars sit on a high
 * round neck (a Peter Pan on a scoop too); a shirt collar needs the button front.
 */
export function detailAllowed(c: BodiceChoices, id: 'princess' | 'bustDart' | 'closure' | 'collar', opt: string, garment: 'bodice' | 'dress' = 'bodice'): boolean {
  if (id === 'princess') return opt === 'none' || c.darts === 'bust_waist';
  if (id === 'bustDart') return c.darts !== 'none' && (opt !== 'waist' || c.length === 'waist');
  if (id === 'closure') return opt === 'back_zip' || garment === 'bodice';
  if (opt === 'none') return true;
  if (opt === 'shirt') return c.closure === 'front_buttons' && c.neckline === 'crew';
  return c.neckline === 'crew' || (opt === 'peter_pan' && c.neckline === 'scoop');
}

/** The choices made valid: details the rest of the choices don't allow fall back to the plain ones. */
export function validDetails(c: BodiceChoices, garment: 'bodice' | 'dress' = 'bodice'): BodiceChoices {
  const out = { ...c };
  if (out.princess && !detailAllowed(out, 'princess', out.princess, garment)) out.princess = 'none';
  if (out.bustDart && !detailAllowed(out, 'bustDart', out.bustDart, garment)) out.bustDart = 'side';
  if (out.closure && !detailAllowed(out, 'closure', out.closure, garment)) out.closure = 'back_zip';
  if (out.collar && !detailAllowed(out, 'collar', out.collar, garment)) out.collar = 'none';
  return out;
}

/** The sleeve as chosen, made valid: a shape the length allows. */
export function sleeveOf(c: BodiceChoices): { length: SleeveLength; shape: SleeveShape } {
  const length = c.sleeve ?? 'none';
  const shapes = SHAPES_FOR_LENGTH[length];
  const shape = c.sleeveShape && shapes.includes(c.sleeveShape) ? c.sleeveShape : (shapes.includes('straight') ? 'straight' : shapes[0]) ?? 'straight';
  return { length, shape };
}

/** Which dart choices each fit allows: a fitted bodice needs both, and only a relaxed one can go without. */
export const DARTS_FOR_FIT: Record<BodiceFit, BodiceDarts[]> = {
  fitted: ['bust_waist'],
  regular: ['bust_waist', 'bust'],
  relaxed: ['bust_waist', 'bust', 'none'],
};

const NECK_WORDS: Record<Neckline, string> = { crew: 'crew neck', scoop: 'scoop neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' };
const LENGTH_WORDS: Record<BodiceLength, string> = { waist: 'waist-length', high_hip: 'high-hip-length', hip: 'hip-length' };

const SLEEVE_WORDS: Record<SleeveLength, string> = { none: '', short: 'short', elbow: 'elbow-length', three_quarter: 'three-quarter', long: 'long' };

/** The bodice's neckline and sleeves, for a dress's name: "a scoop neck and short puff sleeves". */
export function bodiceDetails(c: BodiceChoices) {
  const { length, shape } = sleeveOf(c);
  const v = validDetails(c, 'dress');
  const collarWords = v.collar && v.collar !== 'none' && !c.neck ? COLLAR_WORDS[v.collar] : '';
  const neck = collarWords ? `a ${collarWords}` : `a ${c.neck ? 'drawn neckline' : NECK_WORDS[c.neckline]}`;
  return length === 'none' ? neck : `${neck} and ${SLEEVE_WORDS[length]} ${shape === 'straight' ? '' : `${shape} `}sleeves`;
}

export function describeBodice(c: BodiceChoices) {
  const { length, shape } = sleeveOf(c);
  const sleeve = length === 'none' ? '' : ` with ${SLEEVE_WORDS[length]} ${shape === 'straight' ? '' : `${shape} `}sleeves`;
  const v = validDetails(c);
  const princess = v.princess && v.princess !== 'none' ? ' princess' : '';
  const collar = v.collar && v.collar !== 'none' && !c.neck ? COLLAR_WORDS[v.collar] : '';
  const front = v.closure === 'front_buttons' ? 'button-front ' : '';
  const neck = collar ? `${front}${collar.replace(' collar', '')}-collar` : `${front}${c.neck ? 'drawn-neckline' : NECK_WORDS[c.neckline]}`;
  const dropped = c.dropCm !== undefined && c.dropCm >= 3;
  const lengthWords = dropped ? '' : `${c.dropCm !== undefined ? 'waist-length' : LENGTH_WORDS[c.length]} `;
  return `${lengthWords}${neck}${princess} bodice${sleeve}${dropped ? `, ${Math.round(c.dropCm!)} cm below the waist` : ''}`;
}
