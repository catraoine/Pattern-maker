// The Garment range's choices (Cat broke the freeze for them on 2026-11-07, "I want to do all"): the knit dress, the
// hoodie and the jumpsuit, with their option groups, their plain names and the five starting Looks each that Cat kept
// from the round 1 option sheet (all fifteen, 2026-11-07). All three are In testing until testers sew them.
import type { Stretch, TeeFit, TeeNeck, TeeSleeve } from './engine/tee';
import type { KnitDressLength, KnitDressSkirt } from './engine/knitDress';
import type { HoodieFit, HoodieFront, HoodieLength, HoodiePocket, HoodSize } from './engine/hoodie';
import type { BodiceFit, Neckline } from './engine/bodice';
import type { SleeveLength, SleeveShape } from './engine/sleeve';
import type { Leg, TrouserLength } from './engine/trousers';
import type { Fit } from './engine/skirt';
import { type JumpsuitMeasurements, type JumpsuitStyle, draftJumpsuit } from './engine/jumpsuit';
import { type KnitDressMeasurements, draftKnitDress } from './engine/knitDress';
import { draftHoodie } from './engine/hoodie';
import type { Flat } from './engine/flat';
import { hoodieFlat, jumpsuitFlat, knitDressFlat } from './engine/rangeFlat';
import type { TeeMeasurements } from './engine/tee';
import type { TrousersMeasurements } from './engine/trousers';
import type { MeasurementValues } from './measurements';

export interface KnitDressChoices {
  garment: 'knit_dress';
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  sleeve: TeeSleeve;
  skirt: KnitDressSkirt;
  length: KnitDressLength;
  ribbed: boolean;
}

export interface HoodieChoices {
  garment: 'hoodie';
  fit: HoodieFit;
  stretch: Stretch;
  length: HoodieLength;
  front: HoodieFront;
  pocket: HoodiePocket;
  hood: HoodSize;
  hemBand: boolean;
}

/** The jumpsuit's top (a bodice cut to the waist) and its legs. */
export interface JumpsuitChoices {
  garment: 'jumpsuit';
  fit: BodiceFit;
  neckline: JumpsuitNeck;
  collar: 'none' | 'shirt';
  /** Buttons down the front (the boiler suit), or a back zip. */
  closure: 'back_zip' | 'front_buttons';
  sleeve: SleeveLength;
  sleeveShape: SleeveShape;
  leg: Leg;
  legFit: Fit;
  length: TrouserLength;
}

/** The necklines a jumpsuit's top takes (the bodice's, less the draped and boned ones). */
export type JumpsuitNeck = Extract<Neckline, 'crew' | 'scoop' | 'v' | 'square' | 'boat' | 'cami' | 'halter'>;

export type RangeChoices = KnitDressChoices | HoodieChoices | JumpsuitChoices;
type RangeGarment = RangeChoices['garment'];
export const isRangeGarment = (g: string): g is RangeGarment => g === 'knit_dress' || g === 'hoodie' || g === 'jumpsuit';
/** Where each is kept in the saved work. */
const RANGE_SLOT = { knit_dress: 'knitDress', hoodie: 'hoodie', jumpsuit: 'jumpsuit' } as const satisfies Record<RangeGarment, string>;
export const rangeSlot = (g: RangeGarment) => RANGE_SLOT[g];
const garmentOf = (c: object) => (c as { garment?: string }).garment;
export const isKnitDress = (c: object): c is KnitDressChoices => garmentOf(c) === 'knit_dress';
export const isHoodie = (c: object): c is HoodieChoices => garmentOf(c) === 'hoodie';
export const isJumpsuit = (c: object): c is JumpsuitChoices => garmentOf(c) === 'jumpsuit';
export const isRange = (c: object): c is RangeChoices => isKnitDress(c) || isHoodie(c) || isJumpsuit(c);

/** One starting Look: its code on the option sheet, its name, and the choices it sets. */
interface RangeLook<C> {
  code: string;
  name: string;
  choices: C;
}

export const KNIT_DRESS_LOOKS: RangeLook<KnitDressChoices>[] = [
  { code: 'K1', name: 'T-shirt dress', choices: { garment: 'knit_dress', fit: 'relaxed', stretch: 'medium', neckline: 'crew', sleeve: 'short', skirt: 'straight', length: 'above_knee', ribbed: false } },
  { code: 'K2', name: 'Rib midi', choices: { garment: 'knit_dress', fit: 'fitted', stretch: 'high', neckline: 'mock', sleeve: 'long', skirt: 'hugging', length: 'midi', ribbed: false } },
  { code: 'K3', name: 'Skater', choices: { garment: 'knit_dress', fit: 'fitted', stretch: 'medium', neckline: 'scoop', sleeve: 'elbow', skirt: 'skater', length: 'knee', ribbed: false } },
  { code: 'K4', name: 'Column maxi', choices: { garment: 'knit_dress', fit: 'fitted', stretch: 'high', neckline: 'v', sleeve: 'long', skirt: 'straight', length: 'maxi', ribbed: false } },
  { code: 'K5', name: 'Jumper dress', choices: { garment: 'knit_dress', fit: 'relaxed', stretch: 'low', neckline: 'crew', sleeve: 'long', skirt: 'straight', length: 'mini', ribbed: true } },
];

export const HOODIE_LOOKS: RangeLook<HoodieChoices>[] = [
  { code: 'H1', name: 'Classic', choices: { garment: 'hoodie', fit: 'relaxed', stretch: 'low', length: 'hip', front: 'pullover', pocket: 'kangaroo', hood: 'standard', hemBand: true } },
  { code: 'H2', name: 'Zip-up', choices: { garment: 'hoodie', fit: 'regular', stretch: 'low', length: 'hip', front: 'zip', pocket: 'split', hood: 'standard', hemBand: true } },
  { code: 'H3', name: 'Cropped', choices: { garment: 'hoodie', fit: 'relaxed', stretch: 'low', length: 'cropped', front: 'pullover', pocket: 'none', hood: 'standard', hemBand: false } },
  { code: 'H4', name: 'Oversized', choices: { garment: 'hoodie', fit: 'boxy', stretch: 'low', length: 'hip', front: 'pullover', pocket: 'kangaroo', hood: 'big', hemBand: true } },
  { code: 'H5', name: 'Half-zip', choices: { garment: 'hoodie', fit: 'regular', stretch: 'low', length: 'hip', front: 'half_zip', pocket: 'none', hood: 'standard', hemBand: true } },
];

export const JUMPSUIT_LOOKS: RangeLook<JumpsuitChoices>[] = [
  { code: 'J1', name: 'Boiler', choices: { garment: 'jumpsuit', fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', leg: 'straight', legFit: 'regular', length: 'full' } },
  { code: 'J2', name: 'Cami wide leg', choices: { garment: 'jumpsuit', fit: 'fitted', neckline: 'cami', collar: 'none', closure: 'back_zip', sleeve: 'none', sleeveShape: 'straight', leg: 'wide', legFit: 'regular', length: 'full' } },
  { code: 'J3', name: 'Halter flare', choices: { garment: 'jumpsuit', fit: 'fitted', neckline: 'halter', collar: 'none', closure: 'back_zip', sleeve: 'none', sleeveShape: 'straight', leg: 'flare', legFit: 'regular', length: 'full' } },
  { code: 'J4', name: 'Tailored V', choices: { garment: 'jumpsuit', fit: 'fitted', neckline: 'v', collar: 'none', closure: 'back_zip', sleeve: 'none', sleeveShape: 'straight', leg: 'tapered', legFit: 'fitted', length: 'ankle' } },
  { code: 'J5', name: 'Playsuit', choices: { garment: 'jumpsuit', fit: 'regular', neckline: 'square', collar: 'none', closure: 'back_zip', sleeve: 'short', sleeveShape: 'puff', leg: 'straight', legFit: 'regular', length: 'shorts' } },
];

export const DEFAULT_KNIT_DRESS_CHOICES = KNIT_DRESS_LOOKS[0].choices;
export const DEFAULT_HOODIE_CHOICES = HOODIE_LOOKS[0].choices;
export const DEFAULT_JUMPSUIT_CHOICES = JUMPSUIT_LOOKS[1].choices;

type Groups<C> = { id: keyof C & string; label: string; options: [string, string][] }[];

export const KNIT_DRESS_GROUPS: Groups<KnitDressChoices> = [
  { id: 'stretch', label: 'Your knit’s stretch', options: [['low', 'Low 20–30%'], ['medium', 'Medium 30–50%'], ['high', 'High 50%+']] },
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'neckline', label: 'Neckline', options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['mock', 'Mock neck']] },
  { id: 'sleeve', label: 'Sleeves', options: [['short', 'Short'], ['elbow', 'Elbow'], ['long', 'Long']] },
  { id: 'skirt', label: 'Skirt', options: [['straight', 'Straight'], ['hugging', 'Close'], ['aline', 'A-line'], ['skater', 'Skater']] },
  { id: 'length', label: 'Length', options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']] },
  { id: 'ribbed', label: 'Finish', options: [['false', 'Hemmed'], ['true', 'Rib cuffs and band']] },
];

export const HOODIE_GROUPS: Groups<HoodieChoices> = [
  { id: 'stretch', label: 'Your knit’s stretch', options: [['low', 'Low 20–30%'], ['medium', 'Medium 30–50%'], ['high', 'High 50%+']] },
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed'], ['boxy', 'Boxy']] },
  { id: 'front', label: 'Front', options: [['pullover', 'Pullover'], ['zip', 'Zip-up'], ['half_zip', 'Half-zip']] },
  { id: 'pocket', label: 'Pocket', options: [['kangaroo', 'Front'], ['split', 'Two'], ['none', 'None']] },
  { id: 'hood', label: 'Hood', options: [['standard', 'Standard'], ['big', 'Big']] },
  { id: 'length', label: 'Length', options: [['cropped', 'Cropped'], ['hip', 'Hip'], ['long', 'Long']] },
  { id: 'hemBand', label: 'Hem', options: [['true', 'Rib band'], ['false', 'Turned hem']] },
];

export const JUMPSUIT_GROUPS: Groups<JumpsuitChoices> = [
  { id: 'fit', label: 'Fit at the top', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'neckline', label: 'Neckline', options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['square', 'Square'], ['boat', 'Boat'], ['cami', 'Cami straps'], ['halter', 'Halter']] },
  { id: 'closure', label: 'Opening', options: [['back_zip', 'Back zip'], ['front_buttons', 'Buttons and fly']] },
  { id: 'collar', label: 'Collar', options: [['none', 'None'], ['shirt', 'Shirt collar']] },
  { id: 'sleeve', label: 'Sleeves', options: [['none', 'Sleeveless'], ['short', 'Short'], ['elbow', 'Elbow'], ['three_quarter', 'Three-quarter'], ['long', 'Long']] },
  { id: 'sleeveShape', label: 'Sleeve shape', options: [['straight', 'Straight'], ['fitted', 'Fitted'], ['puff', 'Puff'], ['flutter', 'Flutter']] },
  { id: 'leg', label: 'Leg', options: [['straight', 'Straight'], ['wide', 'Wide'], ['tapered', 'Tapered'], ['flare', 'Flared'], ['culotte', 'Culotte']] },
  { id: 'legFit', label: 'Fit at the hip', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'length', label: 'Length', options: [['shorts', 'Shorts'], ['knee', 'Knee'], ['cropped', 'Cropped'], ['ankle', 'Ankle'], ['full', 'Full']] },
];

/** The neckline and collar a jumpsuit can take together: a collar sits on a crew neck, and buttons need a front that
 *  can open (not straps or a halter). Anything else falls back to what can be cut. */
export function validJumpsuit(c: JumpsuitChoices): JumpsuitChoices {
  const strappy = c.neckline === 'cami' || c.neckline === 'halter';
  const collar = c.collar === 'shirt' && c.neckline === 'crew' ? 'shirt' : 'none';
  const closure = c.closure === 'front_buttons' && !strappy ? 'front_buttons' : 'back_zip';
  const sleeve = strappy ? 'none' : c.sleeve;
  // Puff and flutter sleeves come short; a longer sleeve is straight or fitted.
  const sleeveShape = (c.sleeveShape === 'puff' || c.sleeveShape === 'flutter') && sleeve !== 'short' ? 'straight' : c.sleeveShape;
  return { ...c, collar, closure, sleeve, sleeveShape };
}

const KNIT_NECK: Record<TeeNeck, string> = { crew: 'crew-neck', scoop: 'scoop-neck', v: 'V-neck', mock: 'mock-neck' };
const KNIT_SLEEVE: Record<TeeSleeve, string> = { short: 'short sleeves', elbow: 'elbow sleeves', long: 'long sleeves', none: 'no sleeves' };
const DRESS_LENGTH: Record<KnitDressLength, string> = { mini: 'mini', above_knee: 'above-knee', knee: 'knee-length', midi: 'midi', maxi: 'maxi' };
const DRESS_SKIRT: Record<KnitDressSkirt, string> = { straight: '', hugging: 'close-fitting ', aline: 'A-line ', skater: 'skater ' };

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Fitted mock-neck midi knit dress with long sleeves". */
export function describeKnitDress(c: KnitDressChoices) {
  const fit = c.fit === 'regular' || c.skirt === 'hugging' ? '' : `${c.fit} `;
  const rib = c.ribbed ? ', rib cuffs and hem band' : '';
  return cap(`${fit}${KNIT_NECK[c.neckline]} ${DRESS_LENGTH[c.length]} ${DRESS_SKIRT[c.skirt]}knit dress with ${KNIT_SLEEVE[c.sleeve]}${rib}`);
}

/** "Relaxed hip-length hoodie with a front pocket". */
export function describeHoodie(c: HoodieChoices) {
  const front = { pullover: 'hoodie', zip: 'zip-up hoodie', half_zip: 'half-zip hoodie' }[c.front];
  const length = { cropped: 'cropped ', hip: '', long: 'long ' }[c.length];
  const fit = c.fit === 'regular' ? '' : `${c.fit} `;
  const pocket = { kangaroo: ' with a front pocket', split: ' with two pockets', none: '' }[c.pocket];
  const hood = c.hood === 'big' ? `${pocket ? ' and' : ' with'} a big hood` : '';
  return cap(`${length}${fit}${front}${pocket}${hood}`);
}

const JUMP_NECK: Record<JumpsuitNeck, string> = { crew: 'crew-neck', scoop: 'scoop-neck', v: 'V-neck', square: 'square-neck', boat: 'boat-neck', cami: 'cami', halter: 'halter' };
const JUMP_LEG: Record<Leg, string> = { straight: 'straight-leg', wide: 'wide-leg', tapered: 'tapered', flare: 'flared', bootcut: 'bootcut', culotte: 'culotte', barrel: 'barrel-leg' };

/** "Cami wide-leg jumpsuit", "Square-neck playsuit with short puff sleeves", "Boiler suit with long sleeves". */
export function describeJumpsuit(choices: JumpsuitChoices) {
  const c = validJumpsuit(choices);
  const shorts = c.length === 'shorts';
  const noun = shorts ? 'playsuit' : c.closure === 'front_buttons' && c.collar === 'shirt' ? 'boiler suit' : 'jumpsuit';
  const sleeve = c.sleeve === 'none' ? '' : ` with ${c.sleeve === 'three_quarter' ? 'three-quarter' : c.sleeve} ${c.sleeveShape === 'straight' || c.sleeveShape === 'fitted' ? '' : `${c.sleeveShape} `}sleeves`;
  const legs = shorts ? '' : `${JUMP_LEG[c.leg]} `;
  const neck = noun === 'boiler suit' ? '' : `${JUMP_NECK[c.neckline]} `;
  const cropped = !shorts && c.length !== 'full' ? `${c.length === 'ankle' ? 'ankle-length' : c.length} ` : '';
  return cap(`${neck}${cropped}${legs}${noun}${sleeve}`);
}

/** The engine's styles from the saved choices. The menswear form's knits have no bust shaping, as the T-shirt's. */
export const knitDressStyleOf = (c: KnitDressChoices, flatFront: boolean) => {
  const { garment: _g, ...style } = c;
  return { ...style, ...(flatFront ? { flatFront: true } : {}) };
};
/** The hoodie's fit in the T-shirt's words: boxy is relaxed with more room (for the form drawing and fabric advice). */
export const teeFitOf = (fit: HoodieFit): TeeFit => (fit === 'boxy' ? 'relaxed' : fit);
export const hoodieStyleOf = (c: HoodieChoices, flatFront: boolean) => {
  const { garment: _g, ...style } = c;
  return { ...style, ...(flatFront ? { flatFront: true } : {}) };
};
export function jumpsuitStyleOf(choices: JumpsuitChoices): JumpsuitStyle {
  const c = validJumpsuit(choices);
  return {
    top: { fit: c.fit, neckline: c.neckline, collar: c.collar, closure: c.closure, darts: 'bust_waist' },
    ...(c.sleeve !== 'none' ? { sleeve: { length: c.sleeve, shape: c.sleeveShape } } : {}),
    legs: { leg: c.leg, fit: c.legFit, length: c.length },
  };
}

/** The technical flat of a Garment range design, drafted to these measurements (throws when it can't be drafted). */
export function rangeFlat(c: RangeChoices, m: MeasurementValues, flatFront = false): Flat {
  if (isKnitDress(c)) return knitDressFlat(draftKnitDress(m as unknown as KnitDressMeasurements, knitDressStyleOf(c, flatFront)));
  if (isHoodie(c)) return hoodieFlat(draftHoodie(m as unknown as TeeMeasurements, hoodieStyleOf(c, flatFront)));
  return jumpsuitFlat(draftJumpsuit(m as unknown as JumpsuitMeasurements, jumpsuitStyleOf(c)), m as unknown as TrousersMeasurements);
}
