// The Maison collection: the house's signature designs, each a set of style choices drafted to the
// sewist's own measurements like any other pattern. Making a look opens its style screen with the
// choices set, so every detail can still be changed.
import type { MyFabric } from './engine/fabrics';
import { COLOURS } from './engine/shopFabrics';
import { dressBelt, skirtBelt } from './engine/belt';
import type { Choices } from './savedWork';
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

/** The fabric a look is named for, read from its words, so its thumbnail draws in that cloth. */
export function lookFabric(words: string): MyFabric {
  const w = words.toLowerCase();
  const special = (['denim', 'leather', 'velvet', 'corduroy', 'satin', 'lace', 'sequin'] as const).find((k) => w.includes(k));
  const sheer = /georgette|chiffon|organza|voile|sheer/.test(w);
  const fibre = (['silk', 'wool', 'cotton', 'linen', 'viscose', 'polyester'] as const).find((k) => w.includes(k));
  const colour = COLOURS.map((c) => c.name).find((c) => w.includes(c.toLowerCase()));
  return {
    ...(fibre ? { fibre } : {}),
    ...(special ? { special: special === 'sequin' ? 'sequins' : special } : sheer ? { special: 'sheer' } : {}),
    ...(colour ? { colour } : {}),
  };
}

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

/** The season the house is showing: a new set of looks each spring and autumn, drawn from that season's
 * shows in its colours (Cat, 2026-10-29). Last season's looks move to the Archive, still made the same way. */
export const SEASON = { code: 'SS27', name: 'Spring Summer 2027' };

export const COLLECTION: HouseLook[] = [
  {
    id: 'klein',
    number: 1,
    name: 'Klein Shirt',
    line: 'A big shirt in deep blue: relaxed, buttoned up, its sleeves long and straight.',
    fabric: 'Cobalt cotton poplin',
    garment: 'bodice',
    choices: bodice({ fit: 'relaxed', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', length: 'hip', darts: 'none' }),
  },
  {
    id: 'aqua-slip',
    number: 2,
    name: 'Aqua Slip',
    line: 'The house slip: a skirt cut on the bias to the mid-calf, under a cami top on fine straps.',
    fabric: 'Aqua silk satin',
    garment: 'dress',
    choices: dress('regular', { neckline: 'cami' }, { silhouette: 'slip', length: 'midi' }),
  },
  {
    id: 'red-jacket',
    number: 3,
    name: 'Red Jacket',
    line: 'Soft, boxy tailoring with no shoulder pads, meant to be worn red from head to toe.',
    fabric: 'Red wool and linen',
    garment: 'jacket',
    choices: { ...DEFAULT_JACKET_CHOICES, fit: 'relaxed', shaping: 'boxy', pads: 'none', pockets: 'patch' } as OuterChoices,
  },
  {
    id: 'red-trouser',
    number: 4,
    name: 'Red Trouser',
    line: 'Slouchy and wide, falling to the floor: the other half of the red suit.',
    fabric: 'Red wool and linen',
    garment: 'trousers',
    choices: { garment: 'trousers', fit: 'relaxed', leg: 'wide', length: 'full', closure: 'fly', pockets: 'slant' } as TrousersChoices,
  },
  {
    id: 'olive-pleat',
    number: 5,
    name: 'Olive Pleat',
    line: 'Knife pleats all the way round, stitched flat to the hip and falling free to the mid-calf.',
    fabric: 'Olive wool crepe, or a fine gabardine that holds a crease',
    garment: 'skirt',
    choices: skirt({ fit: 'regular', silhouette: 'straight', length: 'midi', pleats: 'knife' }),
  },
  {
    id: 'scoop-column',
    number: 6,
    name: 'Scoop Column',
    line: 'A wide, low scoop neck over a narrow column to the floor. White, and nothing else.',
    fabric: 'White heavy linen',
    garment: 'dress',
    choices: dress('fitted', { neckline: 'scoop' }, { silhouette: 'straight', length: 'maxi' }),
  },
  {
    id: 'butter-shift',
    number: 7,
    name: 'Butter Shift',
    line: 'Straight from a boat neck to above the knee. Sixties, and worn with flat shoes.',
    fabric: 'Butter wool crepe',
    garment: 'dress',
    choices: dress('regular', { neckline: 'boat' }, { silhouette: 'straight', length: 'above_knee' }),
  },
  {
    id: 'tiny-top',
    number: 8,
    name: 'Tiny Top',
    line: 'A small cami top cut to the waist, for under a big jacket or over a big skirt.',
    fabric: 'Chartreuse silk',
    garment: 'bodice',
    choices: bodice({ fit: 'fitted', neckline: 'cami' }),
  },
  {
    id: 'sash-skirt',
    number: 9,
    name: 'Sheer Sash Skirt',
    line: 'Gathered to the floor in a sheer cloth, and tied at the waist like a scarf.',
    fabric: 'White cotton organza',
    garment: 'skirt',
    choices: skirt({ fit: 'regular', silhouette: 'gathered', length: 'maxi', belt: 'sash' }),
  },
  {
    id: 'long-coat',
    number: 10,
    name: 'Long Coat',
    line: 'Oversized and double-breasted, flaring to an A-line below the hip, for a cold spring.',
    fabric: 'Camel cotton gabardine',
    garment: 'coat',
    choices: { ...DEFAULT_COAT_CHOICES, fit: 'relaxed', front: 'double', flare: 'a_line', pads: 'soft' } as OuterChoices,
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
      return dressFlat(d, 'binding', { sleeve: sleeveFor(d.bodice, b, m), belt: dressBelt(c.skirt.belt, d) });
    }
    if (isBodice(c)) {
      const b = validDetails(c);
      const d = draftBodice(m as never, b);
      return bodiceFlat(d, 'binding', sleeveFor(d, b, m));
    }
    if (isLingerie(c)) return undefined;
    const k = draftSkirt(m as never, c);
    return skirtFlat(k, skirtBelt(c.belt, k));
  } catch {
    return undefined;
  }
}

/** For the Archive's cuts, set out the same way as the house's. */
export { bodice as bodiceChoices, dress as dressChoices, skirt as skirtLook };
