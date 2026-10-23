// The dress: the waist-length bodice and a skirt, joined at the waist. The skirt is drafted to the
// bodice rather than to a waistband: its front and back waist seams are walked to the bodice's, front
// to front and back to back, and its darts sit under the bodice's so they run on as one line through
// the seam. One long zip opens the centre back from the neck to below the waist; a shirt dress buttons
// down the front instead, from the neck through the waist seam and on down the skirt.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceMeasurements, BodiceStyle, draftBodice } from './bodice';
import { Buttons, EXTENSION_CM, backOnFold, openFront } from './collar';
import { LENGTHS, NoSeam, Silhouette, SkirtDraft, SkirtMeasurements, SkirtStyle, draftSkirt, lengthRange } from './skirt';
import { wrapSkirtAllowed } from './wrapSkirt';
import { walkingSlit } from './slit';
import { isTop } from './corset';
import { volumeOf } from './skirtVolume';
import { pathOf, ringOf } from './manipulate';
import type { SleeveMeasurements } from './sleeve';
import { SIDE_ZIPS } from './drape';

export type DressMeasurements = BodiceMeasurements & SkirtMeasurements & SleeveMeasurements;

/** Standard dress zips, in cm. */
export const DRESS_ZIPS = [45, 50, 55, 60, 65];
/** How far the zip runs on below the waist, at least, so the dress steps on over the hips. */
export const ZIP_BELOW_WAIST = 12;

export interface DressDraft {
  bodice: BodiceDraft;
  skirt: SkirtDraft;
  /** The bodice and skirt pieces, ready to print: the bodice's zip mark moved down into the skirt. */
  pieces: Piece[];
  /** The zip, from the neck edge, and how much of it is below the waist. */
  zipCm: number;
  zipBelowWaist: number;
  /** One-shoulder: the zip is in the right side seam, from under the arm, not at the centre back. */
  zipSide?: boolean;
  /** A shirt dress: no zip, the buttons running on below the waist, down the skirt front (in the
   * skirt's own coordinates, down from the waist). `skirt` keeps its front whole; `pieces` has it opened. */
  skirtButtons?: Buttons;
  /** Nape to hem at the centre back. */
  lengthCm: number;
  /** Cut with no waist seam: the front and back each one piece, from the shoulder to the hem. */
  noSeam?: NoSeam;
  finishedBust: number;
  finishedWaist: number;
  finishedHip: number;
  warnings: string[];
}

/** The centre of the waist dart on a piece's waist edge, in cm from the centre, if it has one. */
export function waistDartAt(pc: Piece): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(2);
  for (let i = 1; i < tags.length; i++) {
    if (tags[i] !== 'dart' || tags[i - 1] !== 'waist') continue;
    let k = i;
    while (tags[k] === 'dart') k++;
    return (pts[i].x + pts[k].x) / 2;
  }
  return undefined;
}

/** A skirt piece with its zip moved from the centre back to the right side seam: the back's centre
 * mark taken off, and a ZIP ENDS notch `below` cm down the side seam of the front and back. */
function sideZip(pc: Piece, below: number): Piece {
  const isBack = /back/i.test(pc.name);
  const { pts, tags } = pc.outline.taggedPoints(4);
  let k = tags.indexOf('side');
  if (k < 0) return pc;
  let acc = 0;
  while (tags[k + 1] === 'side' && acc + len(sub(pts[k + 1], pts[k])) < below) {
    acc += len(sub(pts[k + 1], pts[k]));
    k++;
  }
  const l = len(sub(pts[k + 1], pts[k]));
  const dir = unit(sub(pts[k + 1], pts[k]));
  const at: P = add(pts[k], mul(dir, Math.min(l, below - acc)));
  const out = p(dir.y, -dir.x);
  const outward = out.x >= 0 ? out : mul(out, -1);
  return {
    ...pc,
    notches: [...pc.notches.filter(([q, d]) => !(isBack && Math.abs(q.x) < 1e-6 && d.x < 0)), [at, outward]],
    labels: [
      ...pc.labels.filter((lb) => lb.text !== 'ZIP ENDS'),
      ...(isBack ? [{ at: add(at, p(-4.5, 0.3)), text: 'ZIP ENDS', size: 0.7 }] : []),
    ],
  };
}

/** The skirts a button front runs on down: a straight centre front cut on the fold, with no pleats,
 * godets, flounce or uneven hem in the way, and no back vent (the back is cut on the fold). */
export const BUTTON_SKIRTS: Silhouette[] = ['straight', 'a_line', 'gathered', 'trumpet'];
export const buttonsOnSkirt = (s: Partial<SkirtStyle>) =>
  BUTTON_SKIRTS.includes(s.silhouette ?? 'a_line') && volumeOf({ silhouette: 'a_line', length: 'knee', ...s }) === 'none' && (!s.asymHem || s.asymHem === 'none');

/** The buttons go on 15 cm or more above the hem, so the dress opens a little to walk in. */
export const BUTTONS_STOP_ABOVE_HEM = 15;
/** How far the skirt's front facing reaches in from the centre front. */
const SKIRT_FACING_IN = 6.5;

/** The skirt's buttons, on from the bodice's at the same spacing, stopping short of the hem. */
function skirtButtonPlaces(bodice: Buttons, bodiceFoot: number, hem: number): Buttons {
  const at = bodice.at;
  const gap = at.length > 1 ? (at[at.length - 1] - at[0]) / (at.length - 1) : 8;
  const first = Math.max(3, gap - (bodiceFoot - at[at.length - 1]));
  const last = hem - BUTTONS_STOP_ABOVE_HEM;
  const out: number[] = [];
  for (let y = first; y <= last + 1e-6; y += gap) out.push(Math.round(y * 10) / 10);
  return { count: out.length, at: out, sizeCm: bodice.sizeCm };
}

/** Where a polyline crosses x, as a y (the nearest point's when it doesn't). */
function yAt(pts: P[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return lerp(a, b, (x - a.x) / (b.x - a.x)).y;
  }
  return pts.reduce((c, q) => (Math.abs(q.x - x) < Math.abs(c.x - x) ? q : c)).y;
}

/** The skirt's front facing: the extension and 6.5 cm in from the centre front, waist to hem. */
function skirtFrontFacing(front: Piece): Piece {
  const { pts, tags } = front.outline.taggedPoints(4);
  const run = (tag: string) => pts.filter((_, i) => tags[i] === tag || tags[i - 1] === tag);
  const waist = run('waist');
  const hem = run('hem');
  const top = (x: number) => yAt(waist, Math.max(0, x));
  const foot = (x: number) => yAt(hem, Math.max(0, x));
  const X = -EXTENSION_CM;
  const outline = new Path(p(X, top(0)))
    .line(p(SKIRT_FACING_IN, top(SKIRT_FACING_IN)), 'waist')
    .line(p(SKIRT_FACING_IN, foot(SKIRT_FACING_IN)), 'facing')
    .line(p(X, foot(0)), 'hem')
    .line(p(X, top(0)), 'opening');
  outline.closed = true;
  const mid = (top(0) + foot(0)) / 2;
  const cut = 'Cut 2 (1 pair)';
  return {
    name: 'Skirt front facing',
    kind: 'facing',
    outline,
    lines: [],
    grain: [p(SKIRT_FACING_IN * 0.3, mid - 8), p(SKIRT_FACING_IN * 0.3, mid + 8)],
    notches: [],
    labels: [
      { at: p(SKIRT_FACING_IN * 0.45, mid), text: 'SKIRT FRONT FACING', size: 0.8, rotate: 90 },
      { at: p(SKIRT_FACING_IN * 0.45 - 1.1, mid), text: cut, size: 0.55, rotate: 90 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: front.seamAllowance,
    allowances: { waist: front.allowances.waist ?? front.seamAllowance, opening: 1, hem: front.allowances.hem ?? front.seamAllowance, facing: 0 },
    meta: {},
  };
}

/**
 * Whether a dress can be cut with no waist seam: the bodice block is carried on to the hem, so it needs
 * shoulders, no princess or style seams to break at the waist, no drape and no boning.
 */
export const noSeamAllowed = (b: Partial<BodiceStyle>) =>
  !isTop(b.neckline) &&
  b.neckline !== 'cowl' &&
  b.neckline !== 'one_shoulder' &&
  (b.princess ?? 'none') === 'none' &&
  !b.yoke &&
  b.empire === undefined &&
  !b.panel &&
  b.structure !== 'boned';

/**
 * A sheath or a shift: the bodice block drafted on past the hip to the dress's hem, so there is no
 * waist seam. A sheath keeps its waist darts as fish-eye darts and narrows a little to the hem, with a
 * walking slit at the centre back once it is past the knee; a shift has bust darts only and hangs
 * straight from the bust, easing out a little to the hem. One zip opens the centre back to below the
 * waist. The skirt is drafted too, for its length and the steps it shares, but not cut.
 */
function noSeamDress(m: DressMeasurements, bodiceStyle: Partial<BodiceStyle>, skirtStyle: Partial<SkirtStyle>, kind: NoSeam): DressDraft {
  const plain: Partial<SkirtStyle> = { ...skirtStyle, silhouette: 'straight', pleats: undefined, godets: undefined, flounce: undefined, asymHem: undefined, pockets: undefined, hem: undefined, flareCm: undefined, shape: undefined };
  const belowWaist = plain.lengthCm !== undefined ? lengthRange(m).clamp(plain.lengthCm) : LENGTHS[plain.length ?? 'knee'](m);
  const bodice = draftBodice(m, {
    ...bodiceStyle,
    length: 'hip',
    dropCm: undefined,
    hem: undefined,
    peplum: 'none',
    closure: 'back_zip',
    // A dress's hem: deeper than a top's, the weight helps it hang.
    hemAllowance: skirtStyle.hemAllowance ?? 4,
    ...(kind === 'shift' ? { darts: 'bust' as const } : {}),
    dressHem: { belowWaist, shape: kind },
  });
  // The skirt as it would be under this bodice, with no waistband: its length and steps, never cut.
  // A shift's waist can be as wide as its hip, so the skirt is joined no wider than the hip.
  const joinAt = Math.min(bodice.finishedWaist, m.full_hip) / 4;
  const skirt = draftSkirt(m, { ...plain, joinTo: { front: joinAt, back: joinAt, zipCm: 0 } });
  const word = (t: string) => t.replace(/^Bodice/, 'Dress').replace(/^BODICE/, 'DRESS');
  const pieces = bodice.pieces.map((pc) => (pc.kind ? pc : { ...pc, name: word(pc.name), labels: pc.labels.map((l) => ({ ...l, text: word(l.text) })) }));
  const cbWaist = bodice.back.waistCentre.y;
  return {
    bodice,
    skirt,
    pieces,
    zipCm: bodice.zipCm,
    zipBelowWaist: Math.round((bodice.back.zipEnd.y - cbWaist) * 10) / 10,
    lengthCm: bodice.backLength,
    noSeam: kind,
    finishedBust: bodice.finishedBust,
    finishedWaist: bodice.finishedWaist,
    finishedHip: bodice.finishedHip ?? skirt.finishedHip,
    warnings: bodice.warnings,
  };
}

export function draftDress(m: DressMeasurements, bodiceStyle: Partial<BodiceStyle> = {}, skirtStyle: Partial<SkirtStyle> = {}): DressDraft {
  if (skirtStyle.noSeam && noSeamAllowed(bodiceStyle)) return noSeamDress(m, bodiceStyle, skirtStyle, skirtStyle.noSeam);
  // A shirt dress buttons down the front when its skirt can carry the buttons on; otherwise it zips.
  const wantButtons = bodiceStyle.closure === 'front_buttons' && buttonsOnSkirt(skirtStyle);
  // A wrap dress crosses over and ties at the waist when its skirt can wrap too; otherwise it zips.
  const wantWrap = bodiceStyle.closure === 'wrap' && wrapSkirtAllowed({ silhouette: 'a_line', ...skirtStyle });
  const bodice = draftBodice(m, { ...bodiceStyle, length: 'waist', closure: wantButtons ? 'front_buttons' : wantWrap ? 'wrap' : 'back_zip', peplum: 'none' });
  const buttoned = bodice.closure === 'front_buttons' && !!bodice.buttons;
  const wrapped = bodice.closure === 'wrap';
  // Front and back may each be one piece or two panels (princess seams): their waists add up, and the
  // skirt dart goes under the bodice dart or under the princess seam.
  const side = (which: 'front' | 'back') => bodice.pieces.filter((pc) => !pc.kind && new RegExp(which, 'i').test(pc.name));
  // A whole piece (one-shoulder, cowl) holds both halves; the skirt is drafted to one.
  const waistOf = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1), 0);
  const dartOf = (pcs: Piece[]) => {
    const at = pcs
      .map((pc) => waistDartAt(pc) ?? (pc.meta.waistSeamAt as number | undefined))
      .filter((x): x is number => x !== undefined)
      .map(Math.abs);
    return at.length ? Math.min(...at) : undefined;
  };
  const waist = { front: waistOf(side('front')), back: waistOf(side('back')) };
  const dartAt = { front: dartOf(side('front')), back: dartOf(side('back')) };
  const cb = bodice.backLength;
  // One-shoulder: the zip goes in the right side seam from under the arm instead.
  const sideOpen = bodice.drape?.zip;
  const zipCm = sideOpen
    ? (SIDE_ZIPS.find((z) => z - sideOpen.openingCm >= ZIP_BELOW_WAIST) ?? SIDE_ZIPS[SIDE_ZIPS.length - 1])
    : (DRESS_ZIPS.find((z) => z - cb >= ZIP_BELOW_WAIST) ?? DRESS_ZIPS[DRESS_ZIPS.length - 1]);
  const below = buttoned || wrapped ? 0 : Math.round((zipCm - (sideOpen ? sideOpen.openingCm : cb)) * 10) / 10;

  // The skirt's waist curve is a little longer than its width, so walk it to the bodice's.
  const join = { front: waist.front, back: waist.back, dartAt, zipCm: below };
  // A shirt dress has no centre seam front or back for a slit: only the side can open.
  const slit = wantButtons && (skirtStyle.slit === 'front' || skirtStyle.slit === 'back' || (skirtStyle.slit === undefined && walkingSlit({ silhouette: 'a_line', length: 'knee', ...skirtStyle }))) ? 'none' : skirtStyle.slit;
  const skirtOf = (j: typeof join) => draftSkirt(m, { ...skirtStyle, joinTo: j, wrap: wrapped || undefined, slit });
  let skirt = skirtOf(join);
  // A pleated skirt split to fit the fabric has two pieces a side: their waists add up. A skirt front
  // cut whole (a bias slip) has both halves of the waist.
  const halfWaist = (pc: Piece) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1);
  const skirtWaist = (d: SkirtDraft, which: 'front' | 'back') =>
    d.pieces.filter((pc) => /^Skirt/.test(pc.name) && new RegExp(which, 'i').test(pc.name)).reduce((t, pc) => t + halfWaist(pc), 0);
  // A gathered skirt is gathered into the seam, so its waist is longer by design.
  for (let i = 0; i < 4 && !skirt.gathers; i++) {
    const df = waist.front - skirtWaist(skirt, 'front');
    const db = waist.back - skirtWaist(skirt, 'back');
    if (Math.abs(df) < 0.005 && Math.abs(db) < 0.005) break;
    join.front += df;
    join.back += db;
    skirt = skirtOf(join);
  }

  // The zip runs on through the waist, so the bodice back loses its zip mark.
  const unzip = (pc: Piece): Piece =>
    /back/i.test(pc.name)
      ? { ...pc, notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)), labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS') }
      : pc;
  // A shirt dress: the skirt front opened for the buttons and faced, the back cut on the fold.
  let skirtPieces = sideOpen ? skirt.pieces.map((pc) => sideZip(pc, below)) : skirt.pieces;
  let skirtButtons: Buttons | undefined;
  if (buttoned) {
    const bf = bodice.pieces.find((pc) => /front/i.test(pc.name) && !pc.kind)!;
    const bodiceFoot = Math.max(...bf.outline.points(4).filter((q) => Math.abs(q.x + EXTENSION_CM) < 1e-6).map((q) => q.y));
    const front = skirtPieces.find((pc) => pc.fold && /^Skirt front/.test(pc.name))!;
    const hemCF = Math.max(...front.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
    skirtButtons = skirtButtonPlaces(bodice.buttons!, bodiceFoot, hemCF);
    // Opened like the bodice front, the extension's top is at the waist seam, not a neck.
    const raw = openFront(front, skirtButtons);
    const ring = ringOf(raw.outline);
    const { 'opening-neck': _neck, ...allowances } = raw.allowances;
    const opened: Piece = {
      ...raw,
      outline: pathOf({ pts: ring.pts, tags: ring.tags.map((t) => (t === 'opening-neck' ? 'opening-waist' : t)) }),
      allowances: { ...allowances, 'opening-waist': front.allowances.waist ?? front.seamAllowance },
    };
    skirtPieces = [
      ...skirtPieces.map((pc) => (pc === front ? opened : /^Skirt back/.test(pc.name) ? backOnFold(pc) : pc)),
      skirtFrontFacing(opened),
    ];
  }
  return {
    bodice,
    // The skirt as drafted, its front still whole, for its drawing and steps; the pieces to cut are opened.
    skirt: buttoned ? { ...skirt, zipCm: 0, pieces: skirt.pieces.map((pc) => (/^Skirt back/.test(pc.name) ? backOnFold(pc) : pc)) } : skirt,
    pieces: [...bodice.pieces.map(unzip), ...skirtPieces],
    zipCm: buttoned || wrapped ? 0 : zipCm,
    zipBelowWaist: below,
    ...(skirtButtons ? { skirtButtons } : {}),
    ...(sideOpen ? { zipSide: true } : {}),
    lengthCm: Math.round((cb + skirt.lengthCm) * 10) / 10,
    finishedBust: bodice.finishedBust,
    finishedWaist: bodice.finishedWaist,
    finishedHip: skirt.finishedHip,
    warnings: bodice.warnings,
  };
}
