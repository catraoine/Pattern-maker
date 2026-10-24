// The garments the app can make, and the style choices saved for each.
import { CUFFS, Cuff, cuffAllowed } from './engine/cuffs';
import { BACK_NECKS, BackNeck, backBlocked } from './engine/backNeck';
import type { Choices } from './App';
import type { BodiceDarts, BodiceFit, BodiceLength, DrawnNeck, Neckline, UnevenNeck } from './engine/bodice';
import { SHAPES_FOR_LENGTH, SleeveLength, SleeveShape } from './engine/sleeve';
import { SLEEVE_CUTS, SleeveCut, sleeveCutBlocked, sleeveCutOf } from './engine/sleeveCut';
import type { DartPlace, PrincessLine } from './engine/manipulate';
import type { Closure, Collar } from './engine/collar';
import { LEG_WORDS, Leg, TrouserClosure, TrouserLength } from './engine/trousers';
import type { Fit, WaistStyle } from './engine/skirt';
import type { WaistSeam } from './engine/dress';
import type { PocketStyle } from './engine/pockets';
import type { Stretch, TeeFit, TeeLength, TeeNeck, TeeSleeve } from './engine/tee';
import { isSwim, type CupStyle, type LegCut, type LingerieFit, type LingeriePiece, type LingerieStretch, type Rise, type StretchWay } from './engine/lingerie';
import { Peplum, isDraped } from './engine/drape';
import { isShaped } from './engine/hem';
import type { HemShape } from './engine/hem';
import { Structure, isBoned, isStrapless, isTop } from './engine/corset';
import { isShirred } from './engine/shirred';
import { RUFFLE_NECKS } from './engine/collar';
import { WRAP_BUST_DARTS } from './engine/wrap';
import type { Panel, SeamKind, Yoke } from './engine/seams';
import type { OuterCollar, OuterFit, OuterFlare, OuterFront, OuterKind, OuterLength, OuterPads, OuterPockets, OuterShaping, OuterSleeve, OuterTrim, OuterVent } from './engine/outerwear';

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
  /** Drawn on the form: a curved, dipped or back-longer hem, on a bodice below the waist; and a front
   * neckline drawn differently on each side, cut across a whole front. */
  hem?: HemShape;
  unevenNeck?: UnevenNeck;
  /** Older saves have no sleeves. */
  sleeve?: SleeveLength;
  sleeveShape?: SleeveShape;
  /** Set on the sleeve slider: crown point to hem in cm, in place of the named length's. `sleeve` is
   * kept as the named length nearest it, which says which shapes it can have. */
  sleeveCm?: number;
  /** A cuff on a straight or bishop sleeve that can take one (see cuffs.ts). Older saves have none. */
  sleeveCuff?: Cuff;
  /** How the sleeve meets the body: set in, a dropped shoulder, raglan or kimono (see sleeveCut.ts).
   * Older saves are set in. */
  sleeveCut?: SleeveCut;
  /** Older saves have the block's side bust dart, no princess seams, a back zip and no collar. */
  bustDart?: DartPlace;
  princess?: PrincessLine;
  /** Drawn on the form: where the princess seam or moved bust dart starts along its edge (0 to 1), and
   * how deep a cowl hangs (cm). Picking a seam, dart or neckline chip lets go of them. */
  lineAt?: number;
  cowlDepth?: number;
  shoulder?: 'left' | 'right';
  closure?: Closure;
  collar?: Collar;
  /** A scoop or V back, or a keyhole at the back neck (see backNeck.ts). Older saves are plain. */
  back?: BackNeck;
  /** A peplum at the waist seam, on a waist-length bodice. */
  peplum?: Peplum;
  /** Boned like a corset. Older saves are soft; a strapless neckline is always boned. */
  structure?: Structure;
  /** Seams drawn on the form, one kind at a time: a front and/or back yoke (cm below the neck point at
   * the centre), an empire seam (cm below the bust point), or side panels (where the seam leaves the
   * armhole, 0 at the shoulder to 1 at the underarm). Older saves have none. */
  yoke?: Yoke;
  empire?: number;
  panel?: Panel;
}

/** A dress: a waist-length bodice and a skirt, in one fit. */
/** A dress with a waist seam, or cut in one from shoulder to hem: a sheath, or a shift. */
export const DRESS_CUTS: [string, string][] = [
  ['seam', 'Waist seam'],
  ['sheath', 'Sheath'],
  ['shift', 'Shift'],
];

export interface DressChoices {
  garment: 'dress';
  fit: BodiceFit;
  bodice: BodiceChoices;
  skirt: Choices;
  /** Where the bodice meets the skirt, from empire to low; older saves have none (the natural waist). */
  waistSeam?: WaistSeam;
  /** A seam dragged to its own height: cm below the natural waist, negative above it. */
  waistSeamCm?: number;
}

/** The dress's waist seam, from just under the bust down to low on the hip. */
export const WAIST_SEAM_GROUP = {
  id: 'waistSeam',
  label: 'Waist seam',
  options: [
    ['empire', 'Empire'],
    ['raised', 'High'],
    ['natural', 'At the waist'],
    ['dropped', 'Dropped'],
    ['low', 'Low'],
  ] as [WaistSeam, string][],
};

/** Trousers: the leg's shape and length, a fly or side zip (or a pull-on elastic waist), and pockets. */
export interface TrousersChoices {
  garment: 'trousers';
  fit: Fit;
  leg: Leg;
  length: TrouserLength;
  closure: TrouserClosure;
  /** Older saves have no pockets and a waistband with a zip. */
  pockets?: PocketStyle;
  waist?: WaistStyle;
  /** Drawn on the form (see formTrousers.ts): the leg's widths round the knee and a full-length hem, the
   * outside leg's length and where the waistband sits, in cm. Older saves have none. */
  legCm?: { knee: number; hem: number };
  lengthCm?: number;
  riseCm?: number;
}

export const DEFAULT_TROUSERS_CHOICES: TrousersChoices = { garment: 'trousers', fit: 'regular', leg: 'straight', length: 'full', closure: 'fly' };

export type TrouserGroupId = 'fit' | 'leg' | 'length' | 'waist' | 'closure' | 'pockets';

export const TROUSER_GROUPS: { id: TrouserGroupId; label: string; options: [string, string][] }[] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'leg', label: 'Leg', options: [['straight', 'Straight'], ['wide', 'Wide'], ['tapered', 'Tapered'], ['flare', 'Flare'], ['bootcut', 'Bootcut'], ['culotte', 'Culotte']] },
  { id: 'length', label: 'Length', options: [['shorts', 'Shorts'], ['knee', 'Knee'], ['capri', 'Capri'], ['cropped', 'Cropped'], ['ankle', 'Ankle'], ['full', 'Full length']] },
  { id: 'waist', label: 'Waist', options: [['band', 'Waistband with zip'], ['elastic', 'Elastic, pull-on']] },
  { id: 'closure', label: 'Opening', options: [['fly', 'Fly zip'], ['side_zip', 'Side zip']] },
  { id: 'pockets', label: 'Pockets', options: [['none', 'None'], ['inseam', 'In-seam'], ['slant', 'Slant front']] },
];

/** A trouser choice as saved, older saves falling back to no pockets and a zipped waistband. */
export const trouserChoice = (c: TrousersChoices, id: TrouserGroupId): string => (id === 'pockets' ? (c.pockets ?? 'none') : id === 'waist' ? (c.waist ?? 'band') : c[id]);

/**
 * Whether a trouser choice can be picked with the rest, and why not: a pull-on waist has no opening
 * to choose, and slant pockets sit where a side zip would go.
 */
export function trouserAllowed(c: TrousersChoices, id: TrouserGroupId, opt: string): boolean {
  if (id === 'closure') return c.waist !== 'elastic';
  if (id === 'pockets' && opt === 'slant') return c.waist === 'elastic' || c.closure === 'fly';
  return true;
}

/** The choices made valid: slant pockets beside a side zip fall back to in-seam ones. */
export function validTrousers(c: TrousersChoices): TrousersChoices {
  return c.pockets === 'slant' && !trouserAllowed(c, 'pockets', 'slant') ? { ...c, pockets: 'inseam' } : c;
}

/** A plain name, such as "Ankle-length wide-leg trousers with a side zip and in-seam pockets". */
export function describeTrousers(c: TrousersChoices) {
  const shorts = c.leg !== 'culotte' && c.length === 'shorts';
  const drawn = c.leg !== 'culotte' && c.lengthCm !== undefined && !shorts ? `${Math.round(c.lengthCm)} cm ` : undefined;
  const rise = !c.riseCm ? '' : c.riseCm > 0 ? 'high-rise ' : 'low-rise ';
  const length = (drawn ?? (c.leg === 'culotte' || shorts ? '' : { full: '', ankle: 'Ankle-length ', cropped: 'Cropped ', capri: 'Capri ', knee: 'Knee-length ', shorts: '' }[c.length])) + rise;
  const pockets = c.pockets === 'slant' ? 'slant pockets' : c.pockets === 'inseam' ? 'in-seam pockets' : '';
  const opening = c.waist === 'elastic' ? 'an elastic waist' : `a ${c.closure === 'fly' ? 'fly front' : 'side zip'}`;
  const words = `${length}${shorts ? `${c.leg === 'straight' ? '' : `${c.leg} `}shorts` : LEG_WORDS[c.leg]} with ${opening}${pockets ? ` and ${pockets}` : ''}`;
  return words[0].toUpperCase() + words.slice(1);
}

/** A knit T-shirt: the fit, the fabric's stretch, and the neckline, sleeves and length. */
export interface TeeChoices {
  garment: 'tee';
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
  sleeve: TeeSleeve;
  length: TeeLength;
  /** Drawn on the form: a shirttail or high-low hem (see tee.ts). Older saves have a level hem. */
  hemShape?: { sides?: number; back?: number };
}

export const DEFAULT_TEE_CHOICES: TeeChoices = { garment: 'tee', fit: 'regular', stretch: 'medium', neckline: 'crew', sleeve: 'short', length: 'hip' };

export const TEE_GROUPS: { id: 'stretch' | 'fit' | 'neckline' | 'sleeve' | 'length'; label: string; options: [string, string][] }[] = [
  { id: 'stretch', label: 'Your knit’s stretch', options: [['low', 'Low 20–30%'], ['medium', 'Medium 30–50%'], ['high', 'High 50%+']] },
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'neckline', label: 'Neckline', options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['mock', 'Mock neck']] },
  { id: 'sleeve', label: 'Sleeves', options: [['short', 'Short'], ['elbow', 'Elbow'], ['long', 'Long']] },
  { id: 'length', label: 'Length', options: [['cropped', 'Cropped'], ['hip', 'Hip'], ['tunic', 'Tunic']] },
];

const TEE_NECK_WORDS: Record<TeeNeck, string> = { crew: 'crew-neck', scoop: 'scoop-neck', v: 'V-neck', mock: 'mock-neck' };
const TEE_SLEEVE_WORDS: Record<TeeSleeve, string> = { short: 'short sleeves', elbow: 'elbow-length sleeves', long: 'long sleeves' };
const TEE_LENGTH_WORDS: Record<TeeLength, string> = { cropped: 'Cropped ', hip: '', tunic: 'Tunic-length ' };

/** A plain name, such as "Fitted scoop-neck T-shirt with long sleeves". */
export function describeTee(c: TeeChoices) {
  const fit = c.fit === 'regular' ? '' : `${c.fit} `;
  const words = `${TEE_LENGTH_WORDS[c.length]}${fit}${TEE_NECK_WORDS[c.neckline]} T-shirt with ${TEE_SLEEVE_WORDS[c.sleeve]}`;
  return words[0].toUpperCase() + words.slice(1);
}

/** Lingerie and swimwear: which piece, the knit's stretch, and the leg, rise and cup. */
export interface LingerieChoices {
  garment: 'lingerie';
  piece: LingeriePiece;
  stretch: LingerieStretch;
  /** Patterns saved before this choice was added read as four-way. */
  way?: StretchWay;
  leg: LegCut;
  rise: Rise;
  cup: CupStyle;
  closure?: 'none' | 'snaps';
  /** What the maker saw when they tried one on. */
  tried?: LingerieFit;
}

export const DEFAULT_LINGERIE_CHOICES: LingerieChoices = { garment: 'lingerie', piece: 'brief', stretch: 'medium', way: 'four', leg: 'classic', rise: 'high', cup: 'triangle', closure: 'none' };

export type LingerieGroupId = 'piece' | 'way' | 'stretch' | 'leg' | 'rise' | 'cup' | 'closure';

export const LINGERIE_GROUPS: { id: LingerieGroupId; label: string; options: [string, string][] }[] = [
  { id: 'piece', label: 'Piece', options: [['brief', 'Brief'], ['bralette', 'Bralette'], ['bodysuit', 'Bodysuit'], ['swimsuit', 'Swimsuit'], ['bikini', 'Bikini']] },
  { id: 'way', label: 'Which way it stretches', options: [['four', 'Both ways'], ['two', 'Across only']] },
  { id: 'stretch', label: 'How far it stretches', options: [['medium', 'Medium: jersey, lace, power mesh'], ['high', 'High: Lycra, microfibre']] },
  { id: 'leg', label: 'Leg', options: [['classic', 'Classic'], ['high', 'High cut']] },
  { id: 'rise', label: 'Rise', options: [['high', 'High waist'], ['mid', 'Mid rise']] },
  { id: 'cup', label: 'Cup', options: [['triangle', 'Triangle'], ['longline', 'Longline']] },
  { id: 'closure', label: 'Crotch', options: [['none', 'Sewn closed'], ['snaps', 'Snap opening']] },
];

/** Whether a group applies to the piece: swimwear is always cut for four-way Lycra, only briefs have a rise,
 * only tops a cup, only the bodysuit a snap crotch. */
export function lingerieGroupShown(c: LingerieChoices, id: LingerieGroupId): boolean {
  if (id === 'stretch' || id === 'way') return !isSwim(c.piece);
  if (id === 'leg') return c.piece !== 'bralette';
  if (id === 'rise') return c.piece === 'brief' || c.piece === 'bikini';
  if (id === 'cup') return c.piece === 'bralette' || c.piece === 'bikini';
  if (id === 'closure') return c.piece === 'bodysuit';
  return true;
}

/** The value a group shows as picked, with the defaults for patterns saved before it existed. */
export const lingeriePick = (c: LingerieChoices, id: LingerieGroupId): string => (id === 'way' ? (c.way ?? 'four') : id === 'closure' ? (c.closure ?? 'none') : c[id]);

const LINGERIE_PIECE_WORDS: Record<LingeriePiece, string> = { brief: 'brief', bralette: 'bralette', bodysuit: 'bodysuit', swimsuit: 'swimsuit', bikini: 'bikini' };

/** A plain name, such as "High-waist high-cut brief" or "Longline bralette". */
export function describeLingerie(c: LingerieChoices) {
  const bits: string[] = [];
  if (lingerieGroupShown(c, 'cup')) bits.push(c.cup === 'longline' ? 'longline' : 'triangle');
  if (lingerieGroupShown(c, 'rise')) bits.push(c.rise === 'high' ? 'high-waist' : 'mid-rise');
  if (lingerieGroupShown(c, 'leg') && c.leg === 'high') bits.push('high-cut');
  const words = `${bits.join(' ')}${bits.length ? ' ' : ''}${LINGERIE_PIECE_WORDS[c.piece]}`;
  return words[0].toUpperCase() + words.slice(1);
}

/** A jacket or a coat: drafted on the bodice block, with a button front, a collar and a lining. */
export interface OuterChoices {
  garment: OuterKind;
  fit: OuterFit;
  length: OuterLength;
  shaping: OuterShaping;
  front: OuterFront;
  collar: OuterCollar;
  pockets: OuterPockets;
  sleeve: OuterSleeve;
  flare: OuterFlare;
  pads: OuterPads;
  vent: OuterVent;
  /** Rib bands at the hem and cuffs, as on a bomber; older saves have none. */
  trim?: OuterTrim;
  /** Drawn on the form (see formOuter.ts): the vent's length, where the pockets go, and a cutaway front. Older saves have none. */
  ventCm?: number;
  pocketAt?: { x: number; y: number };
  cutawayCm?: number;
}

export const DEFAULT_JACKET_CHOICES: OuterChoices = { garment: 'jacket', fit: 'regular', length: 'hip', shaping: 'darts', front: 'single', collar: 'notched', pockets: 'patch', sleeve: 'tailored', flare: 'straight', pads: 'soft', vent: 'centre', trim: 'none' };
export const DEFAULT_COAT_CHOICES: OuterChoices = { garment: 'coat', fit: 'regular', length: 'knee', shaping: 'princess', front: 'single', collar: 'notched', pockets: 'welt', sleeve: 'tailored', flare: 'straight', pads: 'soft', vent: 'centre', trim: 'none' };

type OuterGroupId = 'fit' | 'length' | 'shaping' | 'front' | 'collar' | 'sleeve' | 'pads' | 'pockets' | 'vent' | 'trim' | 'flare';

/** The style groups for a jacket or a coat: a coat has its own lengths and a flare below the hip. */
export function outerGroups(kind: OuterKind): { id: OuterGroupId; label: string; options: [string, string][] }[] {
  return [
    { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
    {
      id: 'length',
      label: 'Length',
      options: kind === 'jacket' ? [['cropped', 'Cropped'], ['hip', 'Hip'], ['long', 'Long']] : [['thigh', 'Mid-thigh'], ['knee', 'Knee'], ['midi', 'Midi']],
    },
    { id: 'shaping', label: 'Shaping', options: [['darts', 'Darts'], ['princess', 'Princess seams'], ['boxy', 'Boxy']] },
    { id: 'front', label: 'Front', options: [['single', 'Single-breasted'], ['double', 'Double-breasted'], ['zip', 'Zip front']] },
    { id: 'collar', label: 'Collar', options: [['notched', 'Notched lapel'], ['stand', 'Stand collar'], ['collarless', 'Collarless'], ['hood', 'Hood']] },
    { id: 'sleeve', label: 'Sleeves', options: [['tailored', 'Two-piece, tailored'], ['fitted', 'One-piece, elbow dart'], ['straight', 'Straight'], ['raglan', 'Raglan']] },
    { id: 'pads', label: 'Shoulder pads', options: [['soft', kind === 'coat' ? 'Soft, 8 mm' : 'Soft, 6 mm'], ['structured', kind === 'coat' ? 'Structured, 1.5 cm' : 'Structured, 1.2 cm'], ['none', 'None']] },
    { id: 'pockets', label: 'Pockets', options: [['patch', 'Patch pockets'], ['welt', 'Welt pockets'], ['none', 'None']] },
    { id: 'vent', label: 'Back vent', options: [['centre', 'Centre vent'], ['none', 'None']] },
    { id: 'trim', label: 'Hem and cuffs', options: [['none', 'Plain hems'], ['rib', 'Rib bands']] },
    ...(kind === 'coat' ? [{ id: 'flare' as const, label: 'Below the hip', options: [['straight', 'Straight'], ['a_line', 'A-line']] as [string, string][] }] : []),
  ];
}

/**
 * Whether a choice is allowed with the rest: boxy shaping needs room, so not with a fitted cut; a cropped jacket is too short for a vent;
 * a notched lapel needs a shoulder seam and a buttoned front, so not with raglan sleeves or a zip; a raglan is cut off a one-piece front and back, so not
 * with princess seams; rib bands at the hem leave no room for a vent.
 */
export const outerAllowed = (c: OuterChoices, id: OuterGroupId, opt: string) =>
  !(id === 'shaping' && opt === 'boxy' && c.fit === 'fitted') &&
  !(id === 'vent' && opt === 'centre' && (c.length === 'cropped' || c.trim === 'rib')) &&
  !(id === 'collar' && opt === 'notched' && (c.front === 'zip' || c.sleeve === 'raglan')) &&
  !(id === 'front' && opt === 'zip' && c.collar === 'notched') &&
  !(id === 'sleeve' && opt === 'raglan' && (c.collar === 'notched' || c.shaping === 'princess')) &&
  !(id === 'shaping' && opt === 'princess' && c.sleeve === 'raglan');

export const OUTER_LENGTH_WORDS: Record<OuterLength, string> = { cropped: 'Cropped', hip: 'Hip-length', long: 'Long', thigh: 'Mid-thigh', knee: 'Knee-length', midi: 'Midi' };
const OUTER_COLLAR_WORDS: Record<OuterCollar, string> = { notched: 'with notched lapels', stand: 'with a stand collar', collarless: 'collarless', hood: 'with a hood' };

/** A plain name, such as "Hip-length single-breasted jacket with notched lapels". */
export function describeOuter(c: OuterChoices) {
  const front = c.front === 'double' ? 'double-breasted' : c.front === 'zip' ? 'zip-front' : 'single-breasted';
  const collar = OUTER_COLLAR_WORDS[c.collar];
  const shape = c.garment === 'coat' && c.flare === 'a_line' ? ' A-line' : '';
  return c.collar === 'collarless'
    ? `${OUTER_LENGTH_WORDS[c.length]} collarless ${front}${shape} ${c.garment}`
    : `${OUTER_LENGTH_WORDS[c.length]} ${front}${shape} ${c.garment} ${collar}`;
}

/** A saved pattern's choices. Skirt choices predate bodices, so they carry no garment field. */
export type PatternChoices = Choices | BodiceChoices | DressChoices | TrousersChoices | TeeChoices | OuterChoices | LingerieChoices;

export const isBodice = (c: PatternChoices): c is BodiceChoices => (c as BodiceChoices).garment === 'bodice';
export const isDress = (c: PatternChoices): c is DressChoices => (c as DressChoices).garment === 'dress';
export const isTrousers = (c: PatternChoices): c is TrousersChoices => (c as TrousersChoices).garment === 'trousers';
export const isTee = (c: PatternChoices): c is TeeChoices => (c as TeeChoices).garment === 'tee';
export const isLingerie = (c: PatternChoices): c is LingerieChoices => (c as LingerieChoices).garment === 'lingerie';
export const isOuter = (c: PatternChoices): c is OuterChoices => (c as OuterChoices).garment === 'jacket' || (c as OuterChoices).garment === 'coat';

export const DEFAULT_BODICE: BodiceChoices = { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight' };

type Group<K extends keyof BodiceChoices> = { id: K; label: string; options: [NonNullable<BodiceChoices[K]>, string][] };

// Options from styling/styling-options.json (top). Oversized fit needs its own block.
export const BODICE_GROUPS: [Group<'fit'>, Group<'neckline'>, Group<'length'>, Group<'darts'>, Group<'sleeve'>, Group<'sleeveShape'>, Group<'sleeveCut'>, Group<'sleeveCuff'>, Group<'princess'>, Group<'bustDart'>, Group<'closure'>, Group<'collar'>, Group<'back'>, Group<'structure'>, Group<'peplum'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'neckline',
    label: 'Neckline',
    options: [['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck'], ['square', 'Square'], ['boat', 'Boat'], ['one_shoulder', 'One-shoulder'], ['cowl', 'Cowl'], ['strapless', 'Strapless'], ['sweetheart', 'Sweetheart'], ['cami', 'Cami straps'], ['halter', 'Halter']],
  },
  { id: 'length', label: 'Length', options: [['waist', 'Waist'], ['high_hip', 'High hip'], ['hip', 'Hip']] },
  { id: 'darts', label: 'Darts', options: [['bust_waist', 'Bust and waist'], ['bust', 'Bust only'], ['none', 'No darts']] },
  {
    id: 'sleeve',
    label: 'Sleeves',
    options: [['none', 'Sleeveless'], ['short', 'Short'], ['elbow', 'Elbow'], ['three_quarter', 'Three-quarter'], ['long', 'Long']],
  },
  { id: 'sleeveShape', label: 'Sleeve shape', options: [['fitted', 'Fitted'], ['straight', 'Straight'], ['cap', 'Cap'], ['flutter', 'Flutter'], ['puff', 'Puff'], ['bishop', 'Bishop']] },
  { id: 'sleeveCut', label: 'Sleeve cut', options: SLEEVE_CUTS },
  { id: 'sleeveCuff', label: 'Cuffs', options: CUFFS },
  { id: 'princess', label: 'Princess seams', options: [['none', 'None'], ['shoulder', 'From the shoulder'], ['armhole', 'From the armhole']] },
  {
    id: 'bustDart',
    label: 'Bust dart from',
    options: [['side', 'Side seam'], ['french', 'French (low side)'], ['shoulder', 'Shoulder'], ['neck', 'Neckline'], ['armhole', 'Armhole'], ['waist', 'Waist']],
  },
  { id: 'closure', label: 'Opening', options: [['back_zip', 'Back zip'], ['front_buttons', 'Front buttons'], ['wrap', 'Wrap']] },
  { id: 'collar', label: 'Collar', options: [['none', 'None'], ['peter_pan', 'Peter Pan'], ['mandarin', 'Mandarin'], ['mock', 'Mock neck'], ['funnel', 'Funnel neck'], ['shirt', 'Shirt collar'], ['bow', 'Pussy bow'], ['ruffle', 'Ruffle']] },
  { id: 'back', label: 'Back', options: BACK_NECKS },
  { id: 'structure', label: 'Structure', options: [['none', 'Soft'], ['boned', 'Boned, like a corset'], ['shirred', 'Shirred back']] },
  { id: 'peplum', label: 'Peplum', options: [['none', 'None'], ['flared', 'Flared'], ['gathered', 'Gathered']] },
];

const BACK_WORDS: Record<BackNeck, string> = { plain: '', scoop: 'a scoop back', v: 'a V back', keyhole: 'a keyhole back' };
export const COLLAR_WORDS: Record<Collar, string> = { none: '', peter_pan: 'Peter Pan collar', mandarin: 'mandarin collar', mock: 'mock neck', funnel: 'funnel neck', shirt: 'shirt collar', bow: 'pussy bow', ruffle: 'ruffled neckline' };

/**
 * Which styled details a bodice allows, and why not when it doesn't: princess seams need bust and waist
 * darts to carry; a top below the waist has no waist seam for the bust dart; collars sit on a high
 * round neck (a Peter Pan on a scoop too); a shirt collar needs the button front. A draped neckline
 * (one-shoulder, cowl) takes only the side bust dart, the back zip and no collar or princess seams, and
 * the one-shoulder is sleeveless. A peplum goes on a waist-length bodice, not on a dress. A drawn style
 * seam (yoke, empire, panel) is allowed when seamBlocked finds no reason against it.
 */
export function detailAllowed(c: BodiceChoices, id: 'princess' | 'bustDart' | 'closure' | 'collar' | 'back' | 'structure' | 'sleeve' | 'sleeveCut' | 'peplum' | SeamKind, opt: string, garment: 'bodice' | 'dress' = 'bodice'): boolean {
  if (id === 'back') return !backBlocked(c, opt as BackNeck);
  if (id === 'sleeveCut') return !sleeveCutBlocked(c, opt as SleeveCut);
  if (id === 'yoke' || id === 'empire' || id === 'panel') return opt === 'none' || !seamBlocked(c, id, garment, opt === 'back' ? 'back' : 'front');
  // A peplum (flared or gathered) goes on a waist-length bodice, boned or soft, never on a dress.
  if (id === 'peplum') return opt === 'none' || (garment === 'bodice' && c.length === 'waist' && c.structure !== 'shirred' && !(c.dropCm !== undefined && c.dropCm >= 3));
  if (id === 'sleeve') return opt === 'none' || (c.neckline !== 'one_shoulder' && !isTop(c.neckline)) || !!c.neck;
  // Boning needs a top edge below the shoulders, and a strapless one needs the boning to stay up.
  // A halter hangs from the neck, so it stays soft.
  // A shirred back pulls a strapless, sweetheart or cami top on and holds it up in place of the boning;
  // on a top, not a dress, and with no peplum to sew to its shirred waist.
  if (id === 'structure')
    return opt === 'boned' ? isTop(c.neckline) && c.neckline !== 'halter' : opt === 'shirred' ? isTop(c.neckline) && c.neckline !== 'halter' && garment === 'bodice' && (c.peplum ?? 'none') === 'none' : !isStrapless(c.neckline);
  // So does an uneven neckline, its front cut whole across the centre.
  if ((isDraped(c) || (c.unevenNeck && !isTop(c.neckline))) && opt !== 'none') return id === 'bustDart' ? opt === 'side' : id === 'closure' && opt === 'back_zip';
  // A top below the shoulders has no shoulder or armhole for a dart or princess line, and opens at the back.
  const top = isTop(c.neckline);
  if (id === 'princess') return opt === 'none' || (c.darts === 'bust_waist' && !top && c.closure !== 'wrap');
  if (id === 'bustDart') return c.darts !== 'none' && (opt !== 'waist' || c.length === 'waist') && !(top && (opt === 'shoulder' || opt === 'armhole')) && (c.closure !== 'wrap' || (WRAP_BUST_DARTS as readonly string[]).includes(opt));
  // A dress buttons down the front too (a shirt dress), when its skirt can carry the buttons on (see dress.ts).
  if (id === 'closure') return opt === 'back_zip' || !top;
  if (c.closure === 'wrap' && opt !== 'none') return false;
  if (opt === 'none') return true;
  // A collar goes round the back neck, so not with a low or keyhole back.
  if (c.back && c.back !== 'plain') return false;
  if (opt === 'shirt') return c.closure === 'front_buttons' && c.neckline === 'crew';
  // A pussy bow ties at the centre front, on a crew or V neck, so the opening stays at the back.
  if (opt === 'bow') return c.closure !== 'front_buttons' && (c.neckline === 'crew' || c.neckline === 'v');
  // A ruffle is sewn into the neckline seam, so it goes round any neckline that rings the neck.
  if (opt === 'ruffle') return (RUFFLE_NECKS as readonly string[]).includes(c.neckline);
  return c.neckline === 'crew' || (opt === 'peter_pan' && c.neckline === 'scoop');
}

const SEAM_WORDS: Record<SeamKind, string> = { yoke: 'A yoke', empire: 'An empire seam', panel: 'Side panels' };

/**
 * Why a style seam drawn on the form can't go with the rest of the choices, or undefined when it can.
 * A top cut below the shoulders, a boned bodice and a draped neckline are their own shaping, and so are
 * princess seams; the seam takes the bust dart, so it can't be moved anywhere else as well. A front
 * yoke needs a high neckline above it, and a yoke or an empire seam would cross a button front. An
 * empire seam and side panels run to the waist, so they need a waist-length bodice with no peplum.
 */
export function seamBlocked(c: BodiceChoices, kind: SeamKind, garment: 'bodice' | 'dress' = 'bodice', side: 'front' | 'back' = 'front'): string | undefined {
  const words = SEAM_WORDS[kind];
  if (isTop(c.neckline) || c.structure === 'boned') return `${words} needs a bodice with shoulders: a strapless or cami top keeps its own panels.`;
  if (isDraped(c)) return `This neckline is draped, so it takes no ${kind === 'panel' ? 'panel seams' : `${kind === 'yoke' ? 'yoke' : 'empire seam'}`}.`;
  if (c.unevenNeck && (kind !== 'yoke' || side === 'front')) return `An uneven neckline is cut as one whole front, so it takes no ${kind === 'panel' ? 'panel seams' : kind === 'yoke' ? 'front yoke' : 'empire seam'}.`;
  if (c.princess && c.princess !== 'none') return `${words} can't go with princess seams. Pick no princess seams first.`;
  const front = kind !== 'yoke' || side === 'front';
  if (front && c.bustDart && c.bustDart !== 'side') return `${words} takes the bust dart, so it can't be moved as well. Put the bust dart back in the side seam first.`;
  if (kind !== 'panel' && c.closure === 'front_buttons') return `${words} would cross the button front. Choose the back zip first.`;
  if (c.closure === 'wrap') return `${words} would cross the wrap's front edge. Choose the back zip first.`;
  if (kind === 'yoke' && side === 'front') {
    const depth = c.neck ? c.neck.frontDepth : NECKLINE_DEPTH[c.neckline];
    if (depth > 4) return 'A front yoke needs a high neckline: this one cuts through where the yoke goes.';
  }
  if (kind === 'yoke' && side === 'back' && c.neck && c.neck.backDepth > 4) return 'A back yoke needs a high back neckline: this one cuts through where the yoke goes.';
  if (kind !== 'yoke' && garment === 'bodice' && (c.length !== 'waist' || (c.dropCm !== undefined && c.dropCm >= 3))) return `${words} ${kind === 'panel' ? 'run' : 'runs'} to the waist, so ${kind === 'panel' ? 'they need' : 'it needs'} a waist-length bodice.`;
  if (kind !== 'yoke' && c.peplum && c.peplum !== 'none') return `${words} ${kind === 'panel' ? 'run' : 'runs'} to the waist, where the peplum goes. Take the peplum off first.`;
  return undefined;
}

/** How far each named neckline drops at the centre front, in cm (NECKLINES in bodice.ts). */
const NECKLINE_DEPTH: Record<Neckline, number> = { crew: 1, scoop: 10, v: 14, square: 10, boat: 2, one_shoulder: 1, cowl: 1, strapless: 0, sweetheart: 0, cami: 0, halter: 0 };

/** The style seam a bodice has, one kind at a time: an empire seam, then side panels, then a yoke. */
export function seamOf(c: BodiceChoices): SeamKind | undefined {
  if (c.empire !== undefined) return 'empire';
  if (c.panel) return 'panel';
  if (c.yoke && (c.yoke.front !== undefined || c.yoke.back !== undefined)) return 'yoke';
  return undefined;
}

/** The choices made valid: details the rest of the choices don't allow fall back to the plain ones. */
export function validDetails(c: BodiceChoices, garment: 'bodice' | 'dress' = 'bodice'): BodiceChoices {
  const out = { ...c };
  // A strapless neckline switches the boning on (it is what holds the bodice up), and a top cut below the
  // shoulders has no sleeves or drawn neck. A boned bodice is close-fitted to the waist, its bust and
  // waist darts carried into the princess seams. Boning goes again when the neckline goes back up.
  if (isTop(out.neckline)) {
    delete out.neck;
    delete out.unevenNeck;
    if (out.structure === 'shirred' && !detailAllowed(out, 'structure', 'shirred', garment)) delete out.structure;
    if (isStrapless(out.neckline) && out.structure !== 'shirred') out.structure = 'boned';
    if (out.neckline === 'halter' && out.structure === 'boned') out.structure = 'none';
    if (out.sleeve && out.sleeve !== 'none') out.sleeve = 'none';
    if (isBoned(out)) {
      delete out.dropCm;
      delete out.bustEase;
      Object.assign(out, { fit: 'fitted', length: 'waist', darts: 'bust_waist' });
    }
  } else if (out.structure === 'boned' || out.structure === 'shirred') out.structure = 'none';
  if (out.princess && !detailAllowed(out, 'princess', out.princess, garment)) out.princess = 'none';
  if (out.bustDart && !detailAllowed(out, 'bustDart', out.bustDart, garment)) out.bustDart = 'side';
  if (out.closure && !detailAllowed(out, 'closure', out.closure, garment)) out.closure = 'back_zip';
  // A wrap crosses over in a V and ties at the waist: its neckline, length and shaping follow.
  if (out.closure === 'wrap') {
    delete out.neck;
    delete out.unevenNeck;
    delete out.dropCm;
    Object.assign(out, { neckline: 'v', length: 'waist', princess: 'none', collar: 'none', peplum: 'none' });
  }
  if (out.collar && !detailAllowed(out, 'collar', out.collar, garment)) out.collar = 'none';
  if (out.back && backBlocked(out, out.back)) delete out.back;
  if (out.sleeve && !detailAllowed(out, 'sleeve', out.sleeve, garment)) out.sleeve = 'none';
  if (out.sleeveCut && sleeveCutBlocked(out, out.sleeveCut)) delete out.sleeveCut;
  if (out.peplum && !detailAllowed(out, 'peplum', out.peplum, garment)) out.peplum = 'none';
  // A drawn seam the rest no longer allows is let go of, and only one kind is kept.
  const kind = seamOf(out);
  for (const k of ['empire', 'panel', 'yoke'] as const) if (k !== kind) delete out[k];
  if (kind === 'yoke' && out.yoke) {
    const yoke = { ...out.yoke };
    if (yoke.front !== undefined && seamBlocked(out, 'yoke', garment, 'front')) delete yoke.front;
    if (yoke.back !== undefined && seamBlocked(out, 'yoke', garment, 'back')) delete yoke.back;
    if (yoke.front === undefined && yoke.back === undefined) delete out.yoke;
    else out.yoke = yoke;
  } else if (kind && seamBlocked(out, kind, garment)) delete out[kind];
  return out;
}

/** The sleeve as chosen, made valid: a shape the length allows. */
export function sleeveOf(c: BodiceChoices): { length: SleeveLength; shape: SleeveShape; cm?: number; cuff?: Exclude<Cuff, 'none'>; cut?: Exclude<SleeveCut, 'set_in'> } {
  const length = c.sleeve ?? 'none';
  // A kimono sleeve is cut on at its named length, with no shape, slider or cuff of its own.
  const cut = sleeveCutOf(c);
  if (cut === 'kimono') return { length, shape: 'straight', cut };
  const shapes = SHAPES_FOR_LENGTH[length];
  const shape = c.sleeveShape && shapes.includes(c.sleeveShape) ? c.sleeveShape : (shapes.includes('straight') ? 'straight' : shapes[0]) ?? 'straight';
  // A cap sleeve has its own length; any other keeps the length set on the slider.
  const cm = length !== 'none' && shape !== 'cap' ? c.sleeveCm : undefined;
  // A cuff the sleeve can't take is let go, the way a shape the length doesn't allow is.
  const cuff = c.sleeveCuff && c.sleeveCuff !== 'none' && cuffAllowed(c.sleeveCuff, length, shape) ? c.sleeveCuff : undefined;
  return { length, shape, ...(cm === undefined ? {} : { cm }), ...(cuff ? { cuff } : {}), ...(cut === 'set_in' ? {} : { cut }) };
}

/**
 * A sleeve length set on the slider: the named length nearest it (which says which shapes it can
 * have), snapping onto a named one within a centimetre. A cap sleeve has its own length, so it has
 * no slider; a shape the new length doesn't take falls back the way picking that length's chip does.
 */
export function slideSleeve(c: BodiceChoices, cm: number, named: Record<Exclude<SleeveLength, 'none'>, number>): BodiceChoices {
  const { sleeveCm: _s, ...rest } = c;
  const order = (['short', 'elbow', 'three_quarter', 'long'] as const).filter((l) => named[l] !== undefined);
  const nearest = order.reduce((a, b) => (Math.abs(named[b] - cm) < Math.abs(named[a] - cm) ? b : a));
  const next: BodiceChoices = { ...rest, sleeve: nearest };
  const shaped = { ...next, sleeveShape: sleeveOf({ ...next, sleeveShape: c.sleeveShape }).shape };
  return Math.abs(named[nearest] - cm) < 1 ? shaped : { ...shaped, sleeveCm: Math.round(cm) };
}

/** Which dart choices each fit allows: a fitted bodice needs both, and only a relaxed one can go without. */
export const DARTS_FOR_FIT: Record<BodiceFit, BodiceDarts[]> = {
  fitted: ['bust_waist'],
  regular: ['bust_waist', 'bust'],
  relaxed: ['bust_waist', 'bust', 'none'],
};

const NECK_WORDS: Record<Neckline, string> = { crew: 'crew neck', scoop: 'scoop neck', v: 'V-neck', square: 'square neck', boat: 'boat neck', one_shoulder: 'one-shoulder neckline', cowl: 'cowl neck', strapless: 'strapless', sweetheart: 'strapless sweetheart', cami: 'cami', halter: 'halter' };

/**
 * What a top below the shoulders rules out: sleeves, and on a boned bodice any fit but fitted, any
 * length but the waist and any darts but bust and waist (they become its princess seams).
 */
export function topAllowed(c: BodiceChoices, id: string, opt: string): boolean {
  if (c.closure === 'wrap') return wrapAllowed(id, opt);
  if (!isTop(c.neckline)) return true;
  if (id === 'sleeve') return opt === 'none';
  if (!isBoned(c)) return true;
  if (id === 'fit') return opt === 'fitted';
  if (id === 'length') return opt === 'waist';
  if (id === 'darts') return opt === 'bust_waist';
  return true;
}

/**
 * What a wrap rules out: it crosses over in a V and ties at the waist, so no other neckline or collar,
 * no princess seams, peplum, boning or longer length, and no bust dart its edge would cut through.
 */
function wrapAllowed(id: string, opt: string): boolean {
  if (id === 'neckline') return opt === 'v';
  if (id === 'length') return opt === 'waist';
  if (id === 'princess' || id === 'collar' || id === 'peplum' || id === 'structure') return opt === 'none';
  if (id === 'bustDart') return (WRAP_BUST_DARTS as readonly string[]).includes(opt);
  return true;
}

/** A top below the shoulders, named: "boned strapless sweetheart bodice", "cami bodice with spaghetti straps". */
function topWords(v: BodiceChoices, length: string) {
  const straps = v.neckline === 'cami' ? ' with spaghetti straps' : v.neckline === 'halter' ? ' tied at the neck' : '';
  const shirred = isShirred(v) ? `${straps ? ' and' : ' with'} a shirred back` : '';
  return `${isBoned(v) ? 'boned ' : length}${NECK_WORDS[v.neckline]} bodice${straps}${shirred}`;
}

/** A name with its peplum: "boned strapless bodice with a flared peplum". */
function withPeplum(name: string, v: BodiceChoices) {
  if (!v.peplum || v.peplum === 'none') return name;
  return `${name}${/ with /.test(name) ? ' and' : ' with'} a ${v.peplum} peplum`;
}
const LENGTH_WORDS: Record<BodiceLength, string> = { waist: 'waist-length', high_hip: 'high-hip-length', hip: 'hip-length' };

/** The style seam as a word before "bodice": "empire-waist", "side-panel", "yoked", "front-yoke". */
function seamAdjective(v: BodiceChoices) {
  const kind = seamOf(v);
  if (kind === 'empire') return 'empire-waist';
  if (kind === 'panel') return 'side-panel';
  if (kind !== 'yoke') return '';
  if (v.yoke!.front !== undefined && v.yoke!.back !== undefined) return 'yoked';
  return v.yoke!.front !== undefined ? 'front-yoke' : 'back-yoke';
}

/** The style seam for a dress's name: "an empire waist", "side panels", "a back yoke". */
function seamNoun(v: BodiceChoices) {
  const kind = seamOf(v);
  if (kind === 'empire') return 'an empire waist';
  if (kind === 'panel') return 'side panels';
  if (kind !== 'yoke') return '';
  if (v.yoke!.front !== undefined && v.yoke!.back !== undefined) return 'a yoke';
  return v.yoke!.front !== undefined ? 'a front yoke' : 'a back yoke';
}

/** Words joined as a list: "a, b and c". */
const listed = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

const SLEEVE_WORDS: Record<SleeveLength, string> = { none: '', short: 'short', elbow: 'elbow-length', three_quarter: 'three-quarter', long: 'long' };

/** "short puff sleeves", "cap sleeves", "flutter sleeves" or "sleeves" when set on the slider. */
function sleeveWordsOf({ length, shape, cm, cuff, cut }: ReturnType<typeof sleeveOf>): string {
  if (length === 'none') return '';
  const kind = `${cut ? `${cut === 'drop' ? 'dropped-shoulder' : cut} ` : ''}${shape === 'straight' ? '' : `${shape} `}`;
  const cuffs = cuff ? ` with ${cuff === 'shirt' ? 'shirt' : cuff === 'tie' ? 'tie' : 'elastic'} cuffs` : '';
  if (shape === 'cap' || shape === 'flutter' || cm !== undefined) return `${kind}sleeves${cuffs}`;
  return `${SLEEVE_WORDS[length]} ${kind}sleeves${cuffs}`;
}

/** The bodice's neckline and sleeves, for a dress's name: "a scoop neck and short puff sleeves". */
export function bodiceDetails(c: BodiceChoices) {
  const v = validDetails(c, 'dress');
  if (isTop(v.neckline)) return `a ${withPeplum(topWords(v, ''), v)}`;
  const collarWords = v.collar && v.collar !== 'none' && !c.neck ? COLLAR_WORDS[v.collar] : '';
  const neck = collarWords ? `a ${collarWords}` : v.unevenNeck ? 'an uneven neckline' : `a ${c.neck ? 'drawn neckline' : NECK_WORDS[c.neckline]}`;
  const sleeves = sleeveWordsOf(sleeveOf(v));
  return listed([neck, seamNoun(v), sleeves, v.back && v.back !== 'plain' ? BACK_WORDS[v.back] : ''].filter(Boolean));
}

export function describeBodice(c: BodiceChoices) {
  const v = validDetails(c);
  if (isTop(v.neckline)) return withPeplum(topWords(v, `${LENGTH_WORDS[v.length]} `), v);
  const peplum = v.peplum && v.peplum !== 'none' ? `a ${v.peplum} peplum` : '';
  const sleeveWords = sleeveWordsOf(sleeveOf(v));
  const backWords = v.back && v.back !== 'plain' ? BACK_WORDS[v.back] : '';
  const sleeve = sleeveWords || peplum || backWords ? ` with ${[sleeveWords, peplum, backWords].filter(Boolean).join(' and ')}` : '';
  const princess = v.princess && v.princess !== 'none' ? ' princess' : '';
  const seam = seamAdjective(v) ? ` ${seamAdjective(v)}` : '';
  const collar = v.collar && v.collar !== 'none' && !c.neck ? COLLAR_WORDS[v.collar] : '';
  const front = v.closure === 'front_buttons' ? 'button-front ' : v.closure === 'wrap' ? 'wrap ' : '';
  const draped = isDraped(c) ? (c.neckline === 'cowl' ? 'cowl-neck' : 'one-shoulder') : '';
  const neck = v.collar === 'ruffle' && collar ? `${front}ruffled ${draped || NECK_WORDS[c.neckline]}` : v.collar === 'bow' && collar ? 'pussy-bow' : collar ? `${front}${collar.replace(' collar', '')}-collar` : draped || (v.unevenNeck ? 'uneven-neckline' : `${front}${c.neck ? 'drawn-neckline' : NECK_WORDS[c.neckline]}`);
  const dropped = c.dropCm !== undefined && c.dropCm >= 3;
  const lengthWords = dropped ? '' : `${c.dropCm !== undefined ? 'waist-length' : LENGTH_WORDS[c.length]} `;
  const shapedHem = isShaped(c.hem) && (c.length !== 'waist' || dropped) ? ', with a shaped hem' : '';
  return `${lengthWords}${neck}${princess}${seam} bodice${sleeve}${dropped ? `, ${Math.round(c.dropCm!)} cm below the waist` : ''}${shapedHem}`;
}
