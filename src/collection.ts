// The Maison collection: the house's signature designs, each a set of style choices drafted to the
// sewist's own measurements like any other pattern. Making a look opens its style screen with the
// choices set, so every detail can still be changed.
import type { Choices } from './App';
import { draftBodice } from './engine/bodice';
import { draftDress } from './engine/dress';
import { Flat, bodiceFlat, dressFlat, outerFlat, skirtFlat, teeFlat, trousersFlat } from './engine/flat';
import { draftOuter } from './engine/outerwear';
import { draftSkirt } from './engine/skirt';
import { SleeveDraft, draftSleeve, needsArms } from './engine/sleeve';
import { draftTrousers } from './engine/trousers';
import { draftTee } from './engine/tee';
import type { BodiceDraft } from './engine/bodice';
import {
  BodiceChoices,
  DEFAULT_BODICE,
  DEFAULT_COAT_CHOICES,
  DEFAULT_JACKET_CHOICES,
  DressChoices,
  OuterChoices,
  PatternChoices,
  TrousersChoices,
  isBodice,
  isDress,
  isOuter,
  isLingerie,
  isTee,
  isTrousers,
  sleeveOf,
  validDetails,
} from './garments';
import { EXAMPLE_BODY, Garment, MeasurementValues, isComplete } from './measurements';

export interface HouseLook {
  id: string;
  /** Its place in the collection, printed as LOOK 01. */
  number: number;
  name: string;
  /** One line on the look, in the house's voice. */
  line: string;
  fabric: string;
  garment: Garment;
  choices: PatternChoices;
}

const skirt = (c: Partial<Choices>): Choices => ({ fit: 'regular', silhouette: 'a_line', length: 'knee', ...c });
const bodice = (c: Partial<BodiceChoices>): BodiceChoices => ({ ...DEFAULT_BODICE, ...c });
const dress = (fit: BodiceChoices['fit'], b: Partial<BodiceChoices>, s: Partial<Choices>): DressChoices => ({
  garment: 'dress',
  fit,
  bodice: bodice({ ...b, fit, length: 'waist' }),
  skirt: skirt({ ...s, fit }),
});

export const COLLECTION: HouseLook[] = [
  {
    id: 'tailleur',
    number: 1,
    name: 'Tailleur',
    line: 'The house jacket: double-breasted, a notched lapel, a two-piece sleeve and a soft shoulder.',
    fabric: 'Wool suiting, or a fine bouclé',
    garment: 'jacket',
    choices: { ...DEFAULT_JACKET_CHOICES, fit: 'fitted', shaping: 'princess', front: 'double', pockets: 'welt' } as OuterChoices,
  },
  {
    id: 'bal',
    number: 2,
    name: 'Bal',
    line: 'A boned sweetheart bodice, cut like a corset, over a full circle skirt to the mid-calf.',
    fabric: 'Silk duchess satin, or a taffeta',
    garment: 'dress',
    choices: dress('fitted', { neckline: 'sweetheart', structure: 'boned' }, { silhouette: 'circle', length: 'midi' }),
  },
  {
    id: 'lune',
    number: 3,
    name: 'Lune',
    line: 'The slip dress: a skirt cut on the bias that moulds to the hip, under a cami top on fine straps.',
    fabric: 'Silk charmeuse, or a crepe de chine',
    garment: 'dress',
    choices: dress('regular', { neckline: 'cami' }, { silhouette: 'slip', length: 'maxi' }),
  },
  {
    id: 'plisse',
    number: 4,
    name: 'Plissé',
    line: 'Knife pleats all the way round, stitched flat to the hip and falling free to the mid-calf.',
    fabric: 'Wool crepe, or a fine gabardine that holds a crease',
    garment: 'skirt',
    choices: skirt({ fit: 'regular', silhouette: 'straight', length: 'midi', pleats: 'knife' }),
  },
  {
    id: 'epaule',
    number: 5,
    name: 'Épaule',
    line: 'One bare shoulder, a clean diagonal neckline, and a hem that dips longer at the back.',
    fabric: 'Silk crepe, or a heavy crepe-backed satin',
    garment: 'dress',
    choices: dress('fitted', { neckline: 'one_shoulder' }, { silhouette: 'a_line', length: 'midi', asymHem: 'high_low' }),
  },
  {
    id: 'drape',
    number: 6,
    name: 'Drapé',
    line: 'A cowl neck that falls in soft folds at the front, its front cut on the bias.',
    fabric: 'Silk satin, or a fluid viscose crepe',
    garment: 'bodice',
    choices: bodice({ fit: 'regular', neckline: 'cowl' }),
  },
  {
    id: 'peplum',
    number: 7,
    name: 'Basque',
    line: 'A fitted bodice with a boat neck and a flared peplum that stands out from the waist.',
    fabric: 'Wool crepe, or a silk faille',
    garment: 'bodice',
    choices: bodice({ fit: 'fitted', neckline: 'boat', peplum: 'flared' }),
  },
  {
    id: 'sirene',
    number: 8,
    name: 'Sirène',
    line: 'A pencil skirt to the floor, opened out below the knee by eight godets.',
    fabric: 'Crepe-backed satin, or a silk crepe',
    garment: 'skirt',
    choices: skirt({ fit: 'fitted', silhouette: 'pencil', length: 'maxi', godets: 8 }),
  },
  {
    id: 'colonne',
    number: 9,
    name: 'Colonne',
    line: 'A long, narrow column: a fitted bodice with a boat neck over a floor-length straight skirt.',
    fabric: 'Wool crepe, or a heavy silk crepe',
    garment: 'dress',
    choices: dress('fitted', { neckline: 'boat', princess: 'armhole' }, { silhouette: 'straight', length: 'maxi' }),
  },
  {
    id: 'volant',
    number: 10,
    name: 'Volant',
    line: 'An A-line skirt that ends in a circular flounce, so the hem moves with every step.',
    fabric: 'Silk georgette, or a light crepe',
    garment: 'skirt',
    choices: skirt({ fit: 'regular', silhouette: 'a_line', length: 'midi', flounce: 'hem_flounce' }),
  },
  {
    id: 'ligne',
    number: 11,
    name: 'Ligne',
    line: 'An A-line skirt with its hem cut on a diagonal, short on one side and long on the other.',
    fabric: 'Wool crepe, or a heavy linen, the same on both sides',
    garment: 'skirt',
    choices: skirt({ fit: 'regular', silhouette: 'a_line', length: 'midi', asymHem: 'diagonal' }),
  },
  {
    id: 'manteau',
    number: 12,
    name: 'Manteau',
    line: 'The house coat: princess seams, flaring to an A-line below the hip, to the knee.',
    fabric: 'Double-faced wool, or a melton',
    garment: 'coat',
    choices: { ...DEFAULT_COAT_CHOICES, flare: 'a_line', pads: 'structured' } as OuterChoices,
  },
  {
    id: 'palazzo',
    number: 13,
    name: 'Palazzo',
    line: 'Wide, fluid trousers that fall from the hip to the floor.',
    fabric: 'Silk crepe, viscose or a fluid wool',
    garment: 'trousers',
    choices: { garment: 'trousers', fit: 'regular', leg: 'wide', length: 'full', closure: 'side_zip' } as TrousersChoices,
  },
];

/** Which saved choices a look's garment lives under. */
export function lookPatch(look: HouseLook): { garment: Garment } & Record<string, unknown> {
  const { garment, choices } = look;
  if (isDress(choices)) return { garment, dress: choices };
  if (isBodice(choices)) return { garment, bodice: choices };
  if (isTrousers(choices)) return { garment, trousers: choices };
  if (isTee(choices)) return { garment, tee: choices };
  if (isOuter(choices)) return { garment, [garment]: choices };
  return { garment, choices };
}

function sleeveFor(b: BodiceDraft, c: BodiceChoices, m: MeasurementValues): SleeveDraft | undefined {
  const { length, shape, cm, cuff } = sleeveOf(c);
  if (length === 'none' || needsArms(m as never)) return undefined;
  return draftSleeve(b, m as never, { length, shape, ...(cm !== undefined ? { lengthCm: cm } : {}), ...(cuff ? { cuff } : {}), fit: c.fit, seamAllowance: b.pieces[0].seamAllowance, armholeAllowance: b.pieces[0].allowances.armhole ?? 1, hemAllowance: 2.5 });
}

/** The measurements a look is drawn to: the sewist's own when the garment has all it needs, or the sample set. */
export function lookValues(look: HouseLook, values: MeasurementValues): { values: MeasurementValues; own: boolean } {
  return isComplete(values, look.garment) ? { values, own: true } : { values: EXAMPLE_BODY, own: false };
}

/** The look's technical flat, drafted to the given measurements; undefined if it can't be drafted for them. */
export function lookFlat(look: HouseLook, m: MeasurementValues): Flat | undefined {
  return choicesFlat(look.choices, m);
}

/** The technical flat of any set of choices (a look, a saved pattern), drafted to the given measurements. */
export function choicesFlat(c: PatternChoices, m: MeasurementValues): Flat | undefined {
  try {
    if (isOuter(c)) return outerFlat(draftOuter(m as never, { ...c, kind: c.garment }));
    if (isTrousers(c)) return trousersFlat(draftTrousers(m as never, c), m as never);
    if (isTee(c)) return teeFlat(draftTee(m as never, c));
    if (isDress(c)) {
      const b = { ...validDetails(c.bodice, 'dress'), fit: c.fit, length: 'waist' as const };
      const d = draftDress(m as never, b, { ...c.skirt, fit: c.fit }, { at: c.waistSeam, cm: c.waistSeamCm });
      return dressFlat(d, 'binding', { sleeve: sleeveFor(d.bodice, b, m) });
    }
    if (isBodice(c)) {
      const b = validDetails(c);
      const d = draftBodice(m as never, b);
      return bodiceFlat(d, 'binding', sleeveFor(d, b, m));
    }
    if (isLingerie(c)) return undefined;
    return skirtFlat(draftSkirt(m as never, c));
  } catch {
    return undefined;
  }
}

/** For the Archive's cuts, set out the same way as the house's. */
export { dress as dressChoices };
