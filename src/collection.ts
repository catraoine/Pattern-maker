// The Maison collection: the house's signature designs, each a set of style choices drafted to the
// sewist's own measurements like any other pattern. Making a look opens its style screen with the
// choices set, so every detail can still be changed.
import type { Choices } from './App';
import { draftBodice } from './engine/bodice';
import { draftDress } from './engine/dress';
import { Flat, bodiceFlat, dressFlat, outerFlat, skirtFlat, trousersFlat } from './engine/flat';
import { hasSlit } from './engine/instructions';
import { draftOuter } from './engine/outerwear';
import { draftSkirt } from './engine/skirt';
import { SleeveDraft, draftSleeve, needsArms } from './engine/sleeve';
import { draftTrousers } from './engine/trousers';
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
  isTrousers,
  sleeveOf,
  validDetails,
} from './garments';
import { EXAMPLE_VALUES, Garment, MeasurementValues, isComplete } from './measurements';

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
    id: 'colonne',
    number: 2,
    name: 'Colonne',
    line: 'A long, narrow column: a fitted bodice with a boat neck over a floor-length straight skirt.',
    fabric: 'Wool crepe, or a heavy silk crepe',
    garment: 'dress',
    choices: dress('fitted', { neckline: 'boat', princess: 'armhole' }, { silhouette: 'straight', length: 'maxi' }),
  },
  {
    id: 'cloche',
    number: 3,
    name: 'Cloche',
    line: 'A full circle skirt to the mid-calf, swinging out from a narrow waist.',
    fabric: 'Silk faille, taffeta or a light wool',
    garment: 'skirt',
    choices: skirt({ fit: 'fitted', silhouette: 'circle', length: 'midi' }),
  },
  {
    id: 'sirene',
    number: 4,
    name: 'Sirène',
    line: 'Close down to the knee, then a trumpet flare to the floor.',
    fabric: 'Duchess satin, or a crepe-backed satin',
    garment: 'skirt',
    choices: skirt({ fit: 'fitted', silhouette: 'trumpet', length: 'maxi' }),
  },
  {
    id: 'manteau',
    number: 5,
    name: 'Manteau',
    line: 'The house coat: princess seams, flaring to an A-line below the hip, to the knee.',
    fabric: 'Double-faced wool, or a melton',
    garment: 'coat',
    choices: { ...DEFAULT_COAT_CHOICES, flare: 'a_line', pads: 'structured' } as OuterChoices,
  },
  {
    id: 'palazzo',
    number: 6,
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
  if (isOuter(choices)) return { garment, [garment]: choices };
  return { garment, choices };
}

function sleeveFor(b: BodiceDraft, c: BodiceChoices, m: MeasurementValues): SleeveDraft | undefined {
  const { length, shape } = sleeveOf(c);
  if (length === 'none' || needsArms(m as never)) return undefined;
  return draftSleeve(b, m as never, { length, shape, fit: c.fit, seamAllowance: b.pieces[0].seamAllowance, armholeAllowance: b.pieces[0].allowances.armhole ?? 1, hemAllowance: 2.5 });
}

/** The measurements a look is drawn to: the sewist's own when the garment has all it needs, or the sample set. */
export function lookValues(look: HouseLook, values: MeasurementValues): { values: MeasurementValues; own: boolean } {
  return isComplete(values, look.garment) ? { values, own: true } : { values: EXAMPLE_VALUES, own: false };
}

/** The look's technical flat, drafted to the given measurements; undefined if it can't be drafted for them. */
export function lookFlat(look: HouseLook, m: MeasurementValues): Flat | undefined {
  const c = look.choices;
  try {
    if (isOuter(c)) return outerFlat(draftOuter(m as never, { ...c, kind: c.garment }));
    if (isTrousers(c)) return trousersFlat(draftTrousers(m as never, c), m as never);
    if (isDress(c)) {
      const b = { ...validDetails(c.bodice, 'dress'), fit: c.fit, length: 'waist' as const };
      const d = draftDress(m as never, b, { ...c.skirt, fit: c.fit });
      return dressFlat(d, 'binding', { sleeve: sleeveFor(d.bodice, b, m), slit: hasSlit(c.skirt) });
    }
    if (isBodice(c)) {
      const b = validDetails(c);
      const d = draftBodice(m as never, b);
      return bodiceFlat(d, 'binding', sleeveFor(d, b, m));
    }
    return skirtFlat(draftSkirt(m as never, c), { slit: hasSlit(c) });
  } catch {
    return undefined;
  }
}
