// Scoring photo readings against hand labels, for the photo-to-pattern eval (scripts/eval-photo.ts).
import { checkPattern } from '../engine/qc';
import { DraftError, Fit, Length, Silhouette, SkirtMeasurements, draftSkirt } from '../engine/skirt';
import type { Fibre } from '../engine/fabrics';
import type { WaistSeam } from '../engine/dress';
import type { Special } from '../engine/specialFabrics';
import { fitOf, shapeOf } from './shape';
import type { PhotoReading, TopReading } from './types';

/** What the skirt in a photo really is, labelled by a person. */
export interface Truth {
  garment: PhotoReading['garment'];
  silhouette: Silhouette;
  length: Length;
  fit: Fit;
  hemAt: number;
  hemFullness: number;
  /** True when it has features the app can't draft yet (pleats, gathers, a slit, seam lines, a special waistband...), so details should say so. */
  hasDetails: boolean;
  /** What else the photo shows. The reader has no slot for some of these yet; those are listed as "not read" rather than scored. */
  top?: Partial<Pick<TopReading, 'neckline' | 'sleeve' | 'sleeveShape' | 'collar' | 'opening'>>;
  /** For a dress: where the waist seam sits, or none. */
  waistSeam?: WaistSeam | 'none';
  /** A belt, sash or ties at the waist. */
  belt?: 'none' | 'sash' | 'loops' | 'ties';
  /** The cloth as a sewist would name it, and its colour and print. */
  fabric?: { type?: FabricType; fibre?: Fibre; colour?: string; print?: 'none' | 'checks' | 'stripes' | 'floral' | 'animal' | 'abstract' | 'border'; sheer?: boolean };
}

/** Cloth types a photo can show. The app's own special cloths, plus the ones it has no setting for yet. */
export type FabricType = Special | 'knit' | 'fleece' | 'chiffon' | 'crepe' | 'gauze' | 'plain';

/** The parts of a label the reader has no slot for, so a photo can never set them (see evals/photo/README). */
export function notRead(t: Truth): string[] {
  const out: string[] = [];
  // Since the reader gained its fabric, waist-seam and belt slots (October 2026), only a fibre is still unread.
  if (t.fabric?.fibre) out.push(`fibre (${t.fabric.fibre})`);
  return out;
}

/** How a fabric label compares with the reading: type (a chiffon reads as sheer too), colour, print and sheerness. */
function fabricRight(r: PhotoReading, t: Truth): { right: number; of: number; wrong: string[] } | undefined {
  const want = t.fabric;
  const got = r.fabric;
  if (!want || !got) return undefined;
  const wrong: string[] = [];
  let of = 0;
  const same = (a: string, b: string) => a === b || (a === 'chiffon' && b === 'sheer') || (a === 'sheer' && b === 'chiffon');
  if (want.type) {
    of++;
    if (!same(want.type, got.type)) wrong.push(`type ${got.type}≠${want.type}`);
  }
  if (want.colour) {
    of++;
    if (got.colour !== want.colour.toLowerCase()) wrong.push(`colour ${got.colour}≠${want.colour}`);
  }
  if (want.print) {
    of++;
    if (got.print !== want.print) wrong.push(`print ${got.print}≠${want.print}`);
  }
  if (want.sheer !== undefined) {
    of++;
    if (got.sheer !== want.sheer) wrong.push(`sheer ${got.sheer}≠${want.sheer}`);
  }
  if (t.waistSeam && r.top) {
    of++;
    if ((r.top.waistSeamAt ?? 'natural') !== t.waistSeam) wrong.push(`waist seam ${r.top.waistSeamAt}≠${t.waistSeam}`);
  }
  if (t.belt && r.top) {
    of++;
    if ((r.top.belt ?? 'none') !== t.belt) wrong.push(`belt ${r.top.belt}≠${t.belt}`);
  }
  return { right: of - wrong.length, of, wrong };
}

export interface Score {
  points: number; // out of MAX_POINTS
  parts: { garment: number; silhouette: number; length: number; fit: number; hemAt: number; hemFullness: number; details: number };
  /** Said "high" confidence about a silhouette or length it got wrong. */
  confidentlyWrong: string[];
  /** Labelled things the reader has no slot for: the photo could be read perfectly and the app would still not know them. */
  notRead: string[];
  /** For a dress or top: which of the labelled top fields the reading got right, out of those labelled. */
  topRight?: { right: number; of: number; wrong: string[] };
  /** How the fabric, waist seam and belt were read against the label. */
  fabricRight?: { right: number; of: number; wrong: string[] };
  /** The reading turned into a pattern that passes every seam check on the reference body. */
  drafts: boolean;
  draftNote: string;
}

export const MAX_POINTS = 10;

// Silhouettes from narrowest to fullest hem; one step either way earns half marks.
const ORDER: Silhouette[] = ['pencil', 'straight', 'a_line', 'half_circle', 'circle'];
const NEAR_TRUMPET: Silhouette[] = ['pencil', 'straight', 'a_line'];
const LENGTH_ORDER: Length[] = ['mini', 'above_knee', 'knee', 'midi', 'maxi'];

/** A mid-size body to draft each reading on. */
const REFERENCE_BODY: SkirtMeasurements = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

function silhouettePoints(got: Silhouette, want: Silhouette): number {
  if (got === want) return 3;
  if (got === 'trumpet' || want === 'trumpet') return NEAR_TRUMPET.includes(got === 'trumpet' ? want : got) ? 1.5 : 0;
  return Math.abs(ORDER.indexOf(got) - ORDER.indexOf(want)) === 1 ? 1.5 : 0;
}

function lengthPoints(got: Length, want: Length): number {
  const steps = Math.abs(LENGTH_ORDER.indexOf(got) - LENGTH_ORDER.indexOf(want));
  return steps === 0 ? 2 : steps === 1 ? 1 : 0;
}

/** Full marks within 0.06 of waist-to-floor (about 6 cm), half within 0.12. */
const hemAtPoints = (got: number, want: number) => (Math.abs(got - want) <= 0.06 ? 1 : Math.abs(got - want) <= 0.12 ? 0.5 : 0);

/** Full marks within 25% of the true fullness, half within 50%. */
function fullnessPoints(got: number, want: number): number {
  const off = Math.abs(Math.log(got / want));
  return off <= Math.log(1.25) ? 1 : off <= Math.log(1.5) ? 0.5 : 0;
}

function draftCheck(r: PhotoReading): { drafts: boolean; draftNote: string } {
  try {
    const d = draftSkirt(REFERENCE_BODY, { fit: fitOf(r), silhouette: r.silhouette.value, length: r.length.value, shape: shapeOf(r) });
    const failed = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
    return failed.length ? { drafts: false, draftNote: failed.map((c) => c.label).join('; ') } : { drafts: true, draftNote: '' };
  } catch (e) {
    if (e instanceof DraftError) return { drafts: false, draftNote: e.message };
    throw e;
  }
}

export function scoreReading(r: PhotoReading, t: Truth): Score {
  const parts = {
    garment: r.garment === t.garment ? 1 : 0,
    silhouette: silhouettePoints(r.silhouette.value, t.silhouette),
    length: lengthPoints(r.length.value, t.length),
    fit: fitOf(r) === t.fit ? 1 : 0, // scores the fit the app starts from
    hemAt: hemAtPoints(r.shape.hemAt, t.hemAt),
    hemFullness: fullnessPoints(r.shape.hemFullness, t.hemFullness),
    details: (r.details.trim() !== '') === t.hasDetails ? 1 : 0,
  };
  const confidentlyWrong: string[] = [];
  if (r.silhouette.confidence === 'high' && r.silhouette.value !== t.silhouette) confidentlyWrong.push('silhouette');
  if (r.length.confidence === 'high' && r.length.value !== t.length) confidentlyWrong.push('length');
  const points = Object.values(parts).reduce((a, b) => a + b, 0);
  let topRight: Score['topRight'];
  if (t.top && r.top) {
    const wrong = (Object.keys(t.top) as (keyof NonNullable<Truth['top']>)[]).filter((k) => t.top![k] !== undefined && r.top![k] !== t.top![k]);
    const of = Object.values(t.top).filter((v) => v !== undefined).length;
    topRight = { right: of - wrong.length, of, wrong };
  }
  return { points, parts, confidentlyWrong, notRead: notRead(t), topRight, fabricRight: fabricRight(r, t), ...draftCheck(r) };
}
