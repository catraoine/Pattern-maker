import { Belt } from './engine/belt';
import type { Paper } from './engine/export';
import type { HemShape } from './engine/hem';
import type { AsymHem } from './engine/asymHem';
import { Fit, Gathers, Length, Silhouette, NoSeam, SkirtShape, WaistStyle } from './engine/skirt';
import { type SlitPlace } from './engine/slit';
import { BodiceEdges } from './engine/instructions';
import { Cloth, Route } from './engine/couture';
import { AllowanceStyle } from './engine/allowances';
import { FabricWidth } from './engine/layplan';
import { MyFabric } from './engine/fabrics';
import { Garment, MeasurementValues, Unit } from './measurements';
import { LingerieChoices } from './garments';
import { BodiceChoices, DEFAULT_BODICE, OuterChoices, TeeChoices, TrousersChoices, DressChoices, PatternChoices, isBodice, isDress, isLingerie, isOuter, isTee, isTrousers } from './garments';
import { Flounce, GodetCount, Pleats } from './engine/skirtVolume';

// The work kept in this browser (under the "pattern-maker:skirt" key) and its parts: the skirt's choices, the other
// garments' choices and how the pattern is finished.

export interface Choices {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
  /** An era look the choices came from, kept while the shape and length still match it. */
  look?: string;
  /** Exact proportions matched from a photo, kept while the shape and length chips are left alone. */
  shape?: SkirtShape;
  /** Set by dragging the hem on the sketch: a length in cm between the named ones. */
  lengthCm?: number;
  /** Set by dragging the side seam on the sketch: the flare at the hem in cm. */
  flareCm?: number;
  /** Drawn on the sketch: a shaped hem. */
  hem?: HemShape;
  /** Pleats, godets, or a hem flounce or tiers, one at a time. Older saves have none. */
  pleats?: Pleats;
  godets?: GodetCount;
  flounce?: Flounce;
  /** Ruched side seams (engine/ruche.ts), in place of pleats, godets or a flounce. In testing. */
  ruched?: boolean;
  /** A high-low or diagonal hem, in place of a drawn one. Older saves have none. */
  asymHem?: AsymHem;
  /** A gathered skirt's fullness (In testing); unset, it follows the fit. */
  gathers?: Gathers;
  /** In-seam pockets. Older saves have none. */
  pockets?: 'none' | 'inseam';
  /** A tie sash, belt loops, or both, at the waist (see belt.ts). Older saves have none. On a dress, its skirt's choices carry it. */
  belt?: Belt;
  /** A waistband with a zip (older saves), or a pull-on elastic waist. */
  waist?: WaistStyle;
  /** A wrap skirt: the front cut as a crossing pair, the waistband running on into ties. */
  wrap?: boolean;
  /** A slit at the back, the side or the front, or none; unset, a narrow skirt gets the walking slit. */
  slit?: SlitPlace;
  /** The slit's height above the hem, in cm. */
  slitCm?: number;
  /** The zip in the left side seam, the back on the fold; unset, at the centre back. */
  zip?: 'back' | 'side';
  /** A shaped yoke at the top, the darts closed into it. Older saves have none. */
  yoke?: boolean;
  /** Buttoned down the centre front, with no zip. Older saves have none. */
  buttons?: boolean;
  /** A dress only: cut with no waist seam, as a sheath or a shift. */
  noSeam?: NoSeam;
}

// Saved under the original "skirt" key so measurements from before bodices still load; older saves
// have no garment and open as a skirt. Measurements now live with each person in the account; `values`
// is only read to move an older save's measurements across (see withPeople).
export interface Saved {
  unit: Unit;
  /** The printer paper picked on Print, kept so it holds across visits and garments. */
  paper?: Paper;
  values: MeasurementValues;
  choices: Choices;
  garment: Garment;
  bodice: BodiceChoices;
  /** The dress's choices; until it is styled, it starts from the bodice and the skirt. */
  dress?: DressChoices;
  /** The trousers' choices. */
  trousers?: TrousersChoices;
  /** The T-shirt's choices. Older saves have none. */
  tee?: TeeChoices;
  /** Lingerie's choices, while it's previewed (lingerieFlag.ts). */
  lingerie?: LingerieChoices;
  /** The jacket's and the coat's choices. */
  jacket?: OuterChoices;
  coat?: OuterChoices;
  /** How the pattern is finished and printed, chosen on the print screen. Older saves have none. */
  finish?: Finish;
  /** The Archive cut this pattern was made from, for its credit line while the garment is unchanged. */
  archive?: string;
}

/** A pattern's choices, saved under their garment's key. Skirt choices predate the others and carry no garment. */
export function choicesPatch(c: PatternChoices): [Garment, Partial<Saved>] {
  if (isOuter(c)) return [c.garment, { [c.garment]: c }];
  if (isTrousers(c)) return ['trousers', { trousers: c }];
  if (isTee(c)) return ['tee', { tee: c }];
  if (isLingerie(c)) return ['lingerie', { lingerie: c }];
  if (isDress(c)) return ['dress', { dress: c }];
  if (isBodice(c)) return ['bodice', { bodice: c }];
  return ['skirt', { choices: c }];
}

/** Seam allowances, lining and facings, and whether the draft itself is shown. */
export interface Finish {
  allowances: AllowanceStyle;
  skirtLined: boolean;
  bodiceEdges: BodiceEdges;
  atelier: boolean;
  /** Add the draft-it-by-hand guide to the PDF. Older saved settings have none. */
  byHand?: boolean;
  /** For the cutting layout: the fabric's width, and whether it has a nap. */
  fabricWidth: FabricWidth;
  nap: boolean;
  /** How to sew it: the quick route, or the couture one with hand techniques chosen for the cloth. */
  route: Route;
  cloth: Cloth;
  /** The fabric the maker has bought: named in the PDF and tech pack, checked against the style, and used to adjust the ease. */
  fabric?: MyFabric;
}

export const DEFAULT_FINISH: Finish = { allowances: 'home', skirtLined: false, bodiceEdges: 'binding', atelier: false, fabricWidth: 140, nap: false, route: 'quick', cloth: 'wool' };

export const INITIAL: Saved = {
  unit: 'cm',
  values: {},
  choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' } as Choices,
  garment: 'skirt',
  bodice: DEFAULT_BODICE,
};
