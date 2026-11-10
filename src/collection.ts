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
import { draftSkirt, skirtFitOf } from './engine/skirt';
import { SleeveDraft, draftSleeve, needsArms } from './engine/sleeve';
import { draftTrousers } from './engine/trousers';
import { draftTee } from './engine/tee';
import { isRange, rangeFlat } from './garmentRange';
import type { BodiceDraft } from './engine/bodice';
import {
  BodiceChoices,
  DEFAULT_BODICE,
  DEFAULT_TROUSERS_CHOICES,
  DressChoices,
  PatternChoices,
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

/** The house's own colours, named in a look's fabric words and not on the shop's list (SS27, 2026-11-05). */
const HOUSE_COLOURS: [string, string][] = [['gold', '#C9962E'], ['ice', '#9CC3E6'], ['lavender', '#a796c4'], ['blue-grey', '#B9C3CF']];

/** The house's own prints, photographed from the real cloth: the words that name one in a look's fabric, its tile in
 * public/prints/house (see fabricPhoto.ts) and how wide one tile shows on the garment, in cm. */
const HOUSE_PRINTS: [string, { id: string; size: number }][] = [['leopard python', { id: 'house-leopard-python', size: 26 }]];

/** The fabric a look is named for, read from its words, so its thumbnail draws in that cloth. */
export function lookFabric(words: string): MyFabric {
  const w = words.toLowerCase();
  const special = (['denim', 'leather', 'velvet', 'corduroy', 'satin', 'lace', 'sequin'] as const).find((k) => w.includes(k));
  const sheer = /georgette|chiffon|organza|voile|sheer/.test(w);
  const fibre = (['silk', 'wool', 'cotton', 'linen', 'viscose', 'polyester'] as const).find((k) => w.includes(k));
  const colour = COLOURS.map((c) => c.name).find((c) => w.includes(c.toLowerCase())) ?? HOUSE_COLOURS.find(([n]) => w.includes(n))?.[1];
  // A python (or any animal skin) is a one-way print: its scales run one way down the cloth.
  const print = /python|snake|leopard|zebra/.test(w) ? 'oneway' : undefined;
  const crisp = /crisp|sateen|gabardine|poplin|taffeta/.test(w);
  const photo = HOUSE_PRINTS.find(([k]) => w.includes(k))?.[1];
  return {
    ...(fibre ? { fibre } : {}),
    ...(special ? { special: special === 'sequin' ? 'sequins' : special } : sheer ? { special: 'sheer' } : {}),
    ...(colour ? { colour } : {}),
    ...(print ? { print } : {}),
    ...(crisp ? { drape: 'crisp' } : {}),
    ...(photo ? { photo } : {}),
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
  skirt: skirt({ ...s, fit: skirtFitOf(fit) }),
});

/** The season the house is showing: a new set of looks each spring and autumn, drawn from that season's
 * shows in its colours (Cat, 2026-10-29). Last season's looks move to the Archive, still made the same way. */
export const SEASON = { code: 'SS27', name: 'Spring Summer 2027' };

export const COLLECTION: HouseLook[] = [
  {
    id: 'blush-shift',
    number: 1,
    name: 'Blush Shift',
    line: 'A sleeveless shift above the knee with a little room at the bust, flaring just enough, and tied at one side.',
    fabric: 'Blush wool crepe',
    garment: 'dress',
    choices: dress('regular', { neckline: 'crew', sleeve: 'none', darts: 'bust', bustDart: 'french', bustEase: 5 }, { silhouette: 'straight', length: 'mini', noSeam: 'shift', belt: 'side_tie', flareCm: 4 }),
  },
  {
    id: 'gold-shorts',
    number: 2,
    name: 'Gold Python Bermuda',
    line: 'Loose pleated Bermudas falling straight from the hip to just below the knee, belt loops at the waist, in the same gold python as the slip.',
    fabric: 'Gold python silk',
    garment: 'trousers',
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'wide', length: 'knee', lengthCm: 68, legCm: { knee: 66, hem: 66 }, pockets: 'slant', pleats: 'double', loops: 'loops' },
  },
  {
    id: 'ivory-palazzo',
    number: 3,
    name: 'Ivory Palazzo',
    line: 'Wide and easy, falling from slanted pockets to the floor. Ivory, and nothing else.',
    fabric: 'Ivory linen',
    garment: 'trousers',
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'wide', length: 'full', pockets: 'slant' },
  },
  {
    id: 'pleat-dress',
    number: 4,
    name: 'Red Pleat Dress',
    line: 'A scoop neck over a dropped waist, and knife pleats from the hip to the mid-calf, in a crisp red sateen.',
    fabric: 'Red crisp cotton sateen',
    garment: 'dress',
    choices: { ...dress('regular', { neckline: 'scoop', sleeve: 'none', darts: 'bust', bustDart: 'french' }, { silhouette: 'straight', length: 'midi', pleats: 'knife' }), waistSeam: 'dropped' },
  },
  {
    id: 'ice-peplum',
    number: 5,
    name: 'Ice Peplum Top',
    line: 'Sheer ice blue, ruffled at the neck, with bishop sleeves and a big flared peplum from a lowered waist.',
    fabric: 'Ice sheer silk organza',
    garment: 'bodice',
    choices: bodice({ fit: 'fitted', neckline: 'crew', collar: 'ruffle', sleeve: 'long', sleeveShape: 'bishop', length: 'waist', dropCm: 6, peplum: 'flared', peplumSize: 'big' }),
  },
  {
    id: 'lilac-lace',
    number: 6,
    name: 'Lilac Lace Blouse',
    line: 'Lilac lace plunging to the waist, with full bishop sleeves gathered at the wrist. Worn with gold micro shorts.',
    fabric: 'Lilac silk lace',
    garment: 'bodice',
    choices: bodice({ fit: 'regular', darts: 'bust', neckline: 'plunge', plungeDepth: 'waist', sleeve: 'long', sleeveShape: 'bishop', sleeveFullness: 'full', sleeveCuff: 'elastic', length: 'high_hip' }),
  },
  {
    id: 'gold-slip',
    number: 7,
    name: 'Gold Python Slip',
    line: 'The house slip, cut on the bias to the floor, plunging at the front and dipping to a V at the back.',
    fabric: 'Gold python silk satin',
    garment: 'dress',
    choices: dress('regular', { neckline: 'plunge', sleeve: 'none', back: 'v' }, { silhouette: 'slip', length: 'maxi' }),
  },
  {
    // Cat's own Japanese leopard and python cotton, and the house shirt cut (2026-11-10).
    id: 'leopard-shirt-dress',
    number: 8,
    name: 'Leopard Shirt Dress',
    line: 'A big shirt cut down to a mini: a long-point collar, wide sleeves to the elbow, and a shirttail hem that hangs longer at the back.',
    fabric: 'Ivory leopard python cotton',
    garment: 'bodice',
    choices: bodice({
      fit: 'oversized',
      neckline: 'crew',
      collar: 'shirt',
      closure: 'front_buttons',
      sleeve: 'elbow',
      sleeveShape: 'straight',
      length: 'long',
      dropCm: 47,
      bustEase: 36,
      // A shirttail: the sides scooped up 7.5 cm, the back 3 cm longer than the front.
      hem: { front: [0, 0, -0.2, -0.7, -1.6, -3, -4.8, -6.5, -7.5], back: [3, 3, 2.9, 2.5, 1.6, 0.2, -2.2, -5.2, -7.5] },
      shirtCut: 'house',
    }),
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

function sleeveFor(b: BodiceDraft, c: BodiceChoices, own: MeasurementValues): SleeveDraft | undefined {
  const { length, shape, cm, cuff, fullness } = sleeveOf(c);
  // Measured for the body but not the arms yet: the drawing borrows the sample arms, so a shirt still shows its
  // sleeves (it came out sleeveless; 2026-10-30).
  const m = needsArms(own as never) ? { ...EXAMPLE_BODY, ...own } : own;
  if (length === 'none' || needsArms(m as never)) return undefined;
  return draftSleeve(b, m as never, { length, shape, ...(cm !== undefined ? { lengthCm: cm } : {}), ...(cuff ? { cuff } : {}), ...(fullness ? { fullness } : {}), fit: c.fit, seamAllowance: b.pieces[0].seamAllowance, armholeAllowance: b.pieces[0].allowances.armhole ?? 1, hemAllowance: 2.5 });
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
      const d = draftDress(m as never, b, { ...c.skirt, fit: skirtFitOf(c.fit) }, { at: c.waistSeam, cm: c.waistSeamCm });
      return dressFlat(d, 'binding', { sleeve: sleeveFor(d.bodice, b, m), belt: dressBelt(c.skirt.belt, d) });
    }
    if (isBodice(c)) {
      const b = validDetails(c);
      const d = draftBodice(m as never, b);
      return bodiceFlat(d, 'binding', sleeveFor(d, b, m));
    }
    if (isLingerie(c)) return undefined;
    if (isRange(c)) return rangeFlat(c, m);
    const k = draftSkirt(m as never, c);
    return skirtFlat(k, skirtBelt(c.belt, k));
  } catch {
    return undefined;
  }
}

/** For the Archive's cuts, set out the same way as the house's. */
export { bodice as bodiceChoices, dress as dressChoices, skirt as skirtLook };
