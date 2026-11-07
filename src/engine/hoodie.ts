// The hoodie (Garment range, Cat 2026-11-07): the T-shirt block in a sweatshirt knit, with long sleeves, a two-piece
// hood lined in the same knit, rib cuffs and (most often) a rib hem band. Five starting Looks on the option sheet:
// H1 classic, H2 zip-up, H3 cropped, H4 oversized, H5 half-zip. In testing until testers sew it.
//
// - Its front is cut on the fold for a pullover, in two for a zip all the way down, or on the fold with a short slit
//   and a facing for a half-zip.
// - The hood is two pieces, seamed over the head and down the back, sewn to the neckline with its front edges meeting
//   at the centre front (or at the zip), lined so its face edge is clean, with a drawcord channel round the face.
// - The kangaroo pocket is one piece across the front, its sides open; split pockets are two, one each side of a zip.
import { P, Path, p, taggedLength } from './geometry';
import type { Piece } from './piece';
import { DraftError } from './skirt';
import { KNIT_SEAM, Stretch, TeeDraft, TeeFit, TeeMeasurements, draftTee } from './tee';
import { ribBands } from './knitBands';

export type HoodieLength = 'cropped' | 'hip' | 'long';
export type HoodieFront = 'pullover' | 'zip' | 'half_zip';
export type HoodiePocket = 'kangaroo' | 'split' | 'none';
export type HoodSize = 'standard' | 'big';
export const HOODIE_LENGTHS: HoodieLength[] = ['cropped', 'hip', 'long'];
export const HOODIE_FRONTS: HoodieFront[] = ['pullover', 'zip', 'half_zip'];
export const HOODIE_POCKETS: HoodiePocket[] = ['kangaroo', 'split', 'none'];

/** The T-shirt's fits, and boxy: the oversized hoodie, wide and straight with dropped shoulders (Cat, 2026-11-07). */
export type HoodieFit = TeeFit | 'boxy';

export interface HoodieStyle {
  fit: HoodieFit;
  stretch: Stretch;
  length: HoodieLength;
  front: HoodieFront;
  pocket: HoodiePocket;
  hood: HoodSize;
  /** A rib band at the hem; without it the hem is turned and stitched (a cropped hoodie's raw look). */
  hemBand: boolean;
  flatFront?: boolean;
}

/** A boxy hoodie's room over the T-shirt's boxy body, as a share of the bust (about 34% in all on a sweatshirt knit). */
const BOXY_EXTRA = 0.18;
/** How much longer a boxy hoodie hangs than its named length, in cm. */
const BOXY_LONGER = 5;
/** A boxy hoodie's hem band, as a share of the hem: nearly its full width. */
const BOXY_HEM_RATIO = 0.95;

const DEFAULT_HOODIE: HoodieStyle = { fit: 'relaxed', stretch: 'low', length: 'hip', front: 'pullover', pocket: 'kangaroo', hood: 'standard', hemBand: true };

/** Rib depths, finished, in cm: the hem band and the cuffs. A long hoodie's are deeper. */
const HOODIE_RIB: Record<HoodieLength, { hem: number; cuff: number }> = { cropped: { hem: 5, cuff: 6 }, hip: { hem: 6, cuff: 6 }, long: { hem: 8, cuff: 9 } };
/** The hood, before it is sized to the neckline: neck to crown, and face edge to the back. */
const HOOD_SIZE: Record<HoodSize, { height: number; depth: number }> = { standard: { height: 34, depth: 25 }, big: { height: 37, depth: 28.5 } };
/** The half-zip's opening from the neck, and the zip's tape each side. */
const HALF_ZIP_CM = 18;
const ZIP_SEAM = 1.5;
/** The drawcord channel round the face, finished, in cm. */
const CHANNEL_CM = 2.5;

export interface HoodieDraft {
  pieces: Piece[];
  tee: TeeDraft;
  style: HoodieStyle;
  /** Waist to hem at the side (the band's included). */
  belowWaist: number;
  hood: { height: number; depth: number; neckCm: number };
  /** The zip's length, neck to hem, for a zip-up or a half-zip. */
  zipCm?: number;
  bands: { hemBand?: number; cuff?: number };
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Where each length ends below the waist at the side, the band included. */
function hoodieBelowWaist(m: Pick<TeeMeasurements, 'waist_to_hip'>, l: HoodieLength): number {
  return { cropped: 2, hip: m.waist_to_hip + 2, long: m.waist_to_hip + 16 }[l];
}

export function draftHoodie(m: TeeMeasurements, style: Partial<HoodieStyle> = {}): HoodieDraft {
  const s: HoodieStyle = { ...DEFAULT_HOODIE, ...style };
  if (!m.arm_length) throw new DraftError('Add your arm length for the sleeves.');
  const rib = HOODIE_RIB[s.length];
  const band = s.hemBand ? rib.hem : 0;
  const boxy = s.fit === 'boxy';
  // A boxy hoodie hangs a little longer than its named length (Cat, 2026-11-07: "slightly longer").
  const total = hoodieBelowWaist(m, s.length) + (boxy ? BOXY_LONGER : 0);
  const fit: TeeFit = s.fit === 'boxy' ? 'relaxed' : s.fit;
  // Boxy: the T-shirt's dropped-shoulder boxy body, with an oversized hoodie's extra room on top.
  const boxyBody = boxy ? { shoulder: 'dropped' as const, boxyExtra: BOXY_EXTRA } : {};
  const full = draftTee(m, { fit, ...boxyBody, stretch: s.stretch, neckline: 'crew', sleeve: 'long', flatFront: s.flatFront }).sleeve;
  const sleeveCm = Math.max(full.length.min, full.length.cm - rib.cuff);
  const tee = draftTee(m, {
    fit,
    ...boxyBody,
    stretch: s.stretch,
    neckline: 'crew',
    sleeve: 'long',
    length: 'tunic',
    flatFront: s.flatFront,
    // A band pulls the hem in, so the body stays straight to it; a long relaxed hoodie hangs a little wider. A boxy one
    // drops straight from the underarm.
    carry: { belowWaist: Math.max(1, total - band), hemFlare: s.fit === 'relaxed' ? 1 : 0 },
    sleeveCm,
  });
  const warnings = [...tee.warnings];
  const [teeFront, teeBack, ...sleeveAndBand] = tee.pieces;
  // The hood takes the place of the neckband.
  const sleeves = sleeveAndBand.filter((pc) => !pc.meta.neckband);
  const relabel = (pc: Piece, name: string, label: string): Piece => ({
    ...pc,
    name,
    labels: pc.labels.map((l) => (l.text === 'TEE FRONT' || l.text === 'TEE BACK' ? { ...l, text: label } : l)),
    allowances: { ...pc.allowances, ...(band ? { hem: KNIT_SEAM } : {}) },
  });
  const back = relabel(teeBack, 'Hoodie back', 'HOODIE BACK');
  const pieces: Piece[] = [];
  let front = relabel(teeFront, 'Hoodie front', 'HOODIE FRONT');
  const hemY = Math.max(...front.outline.points().map((q) => q.y));
  const neckTop = Math.min(...front.outline.points().filter((q) => q.x < 0.5).map((q) => q.y));
  let zipCm: number | undefined;
  if (s.front === 'zip') {
    // Cut in two: the fold becomes the zip's edge, with room for the zip's tape.
    front = {
      ...front,
      cut: 'Cut 2 (1 pair)',
      fold: undefined,
      allowances: { ...front.allowances, fold: ZIP_SEAM },
      labels: front.labels.map((l) => (l.text === 'Cut 1 on fold' ? { ...l, text: 'Cut 2 (1 pair)' } : l)),
      meta: { ...front.meta, zipEdge: 'fold' },
    };
    zipCm = r1(hemY - neckTop + band);
  } else if (s.front === 'half_zip') {
    const slit = new Path(p(0, neckTop)).line(p(0, neckTop + HALF_ZIP_CM), 'slit');
    front = { ...front, lines: [...front.lines, slit], meta: { ...front.meta, halfZip: HALF_ZIP_CM } };
    zipCm = HALF_ZIP_CM;
    pieces.push(zipFacing(neckTop));
  }
  pieces.unshift(front, back, ...sleeves);
  const neckHalf = taggedLength(teeFront.outline, 'neck') + taggedLength(teeBack.outline, 'neck');
  const hood = hoodPieces(neckHalf, HOOD_SIZE[s.hood]);
  pieces.push(...hood.pieces);
  if (s.pocket === 'kangaroo') pieces.push(kangaroo(front, hemY));
  else if (s.pocket === 'split') pieces.push(splitPocket(front, hemY));
  const hemCm = tee.finishedHem;
  // A boxy hoodie's band barely pulls in, so the body stays square to the hem instead of blousing over it.
  const rb = ribBands({ hem: band, cuff: rib.cuff }, hemCm, tee.sleeve.hemCm, m.full_bust * 1.02, boxy ? BOXY_HEM_RATIO : undefined);
  // A zip-up's band is cut in two, one each side of the zip; the length is the same.
  pieces.push(...rb.pieces.map((pc) => (s.front === 'zip' && pc.name === 'Hem band' ? { ...pc, cut: 'Cut 2 from rib', fold: undefined, allowances: { fold: ZIP_SEAM } } : pc)));
  return {
    pieces,
    tee,
    style: s,
    belowWaist: r1(total),
    hood: { height: hood.height, depth: hood.depth, neckCm: r1(2 * neckHalf) },
    zipCm,
    bands: { hemBand: rb.hemBand, cuff: rb.cuff },
    warnings,
  };
}

/**
 * The hood: two outer pieces and two lining, each sized so its neck edge is half the neckline. The face edge is
 * straight; the crown rounds back from it; the centre back curves in to the nape. The face edge is folded back to the
 * lining's stitching as a channel for the drawcord. Unlike the jacket's hood, its neck leaves the centre back square.
 */
function hoodPieces(neckHalf: number, size: { height: number; depth: number }) {
  const H = size.height;
  let D = size.depth;
  const build = (depth: number) => {
    const outline = new Path(p(0, H))
      .line(p(0, 1.5), 'face')
      .curve(p(depth * 0.4, -2.2), p(depth * 0.98, -0.4), p(depth, 9), 'centre')
      .curve(p(depth * 1.01, H * 0.5), p(depth * 0.84, H - 7), p(depth * 0.84, H - 3.2), 'centre')
      // Square off the centre back seam, so the two halves' necklines run on smooth across it once sewn.
      .curve(p(depth * 0.55, H - 3.2), p(depth * 0.22, H + 1.1), p(0, H), 'neck');
    outline.closed = true;
    return outline;
  };
  for (let i = 0; i < 4; i++) D *= neckHalf / taggedLength(build(D), 'neck');
  const outline = build(D);
  const { pts, tags } = outline.taggedPoints(48);
  const onEdge = (tag: string, x: number): P => pts.filter((_, i) => tags[i] === tag).sort((u, v) => Math.abs(u.x - x) - Math.abs(v.x - x))[0];
  const channel = new Path(p(CHANNEL_CM, H - 2)).line(p(CHANNEL_CM, 3), 'channel');
  const piece = (name: string, cut: string, fabric?: string): Piece => ({
    name,
    outline,
    lines: name === 'Hood' ? [channel] : [],
    grain: [p(D * 0.45, 6), p(D * 0.45, H - 6)],
    notches: [
      [onEdge('centre', D * 0.6), p(0, -1)],
      [onEdge('neck', D * 0.4), p(0, 1)],
    ],
    labels: [
      { at: p(D * 0.5, H * 0.4), text: name.toUpperCase(), size: 1.4 },
      { at: p(D * 0.5, H * 0.4 + 3.5), text: cut, size: 0.9 },
      { at: p(D * 0.35, H - 1.2), text: 'NECK', size: 0.6 },
      { at: p(1.2, H * 0.5), text: 'FACE EDGE', size: 0.6, rotate: 90 },
    ],
    cut,
    ...(fabric ? { fabric, kind: 'lining' as const } : {}),
    seamAllowance: KNIT_SEAM,
    allowances: { face: KNIT_SEAM },
    meta: { hood: true, height: H, depth: r1(D), knit: true },
  });
  return { pieces: [piece('Hood', 'Cut 2 (1 pair)'), piece('Hood lining', 'Cut 2 (1 pair)', 'same knit')], height: H, depth: r1(D) };
}

/** The kangaroo pocket: one piece across the front, cut on the fold, its slanted sides left open as the openings. */
function kangaroo(front: Piece, hemY: number): Piece {
  const pts = front.outline.points();
  const sideAt = (y: number) => Math.max(...pts.filter((q) => Math.abs(q.y - y) < 1.5).map((q) => q.x));
  const bottom = hemY;
  const top = bottom - 21;
  const wB = Math.min(17, sideAt(bottom - 1) - 4);
  const wT = wB - 6;
  const outline = new Path(p(0, top))
    .line(p(wT, top), 'top')
    .curve(p(wT + 3, top + 8), p(wB - 1.5, bottom - 6), p(wB, bottom - 2), 'opening')
    .line(p(wB, bottom), 'side')
    .line(p(0, bottom), 'hem')
    .line(p(0, top), 'fold');
  outline.closed = true;
  return {
    name: 'Kangaroo pocket',
    kind: 'pocket',
    outline,
    lines: [],
    grain: [p(wT * 0.5, top + 3), p(wT * 0.5, bottom - 3)],
    fold: [p(0, top + 1), p(0, bottom - 1)],
    notches: [],
    labels: [
      { at: p(wT * 0.3, top + 7), text: 'POCKET', size: 1.1 },
      { at: p(wT * 0.3, top + 9.5), text: 'Cut 1 on fold', size: 0.8 },
    ],
    cut: 'Cut 1 on fold',
    seamAllowance: KNIT_SEAM,
    allowances: { opening: 2, top: KNIT_SEAM, fold: 0, hem: KNIT_SEAM },
    meta: { pocket: 'kangaroo', knit: true, placeAt: { y: top } },
  };
}

/** A split pocket for a zip-up: the kangaroo's half, one each side, its inner edge stopping short of the zip. */
function splitPocket(front: Piece, hemY: number): Piece {
  const k = kangaroo(front, hemY);
  const pts = k.outline.points();
  const top = Math.min(...pts.map((q) => q.y));
  const inner = 3;
  const outline = new Path(p(inner, top));
  const raw = k.outline.taggedPoints(12);
  // Shift the half across, keeping its slanted opening: the fold edge becomes a turned edge 3 cm from the zip.
  const shifted = raw.pts.map((q) => (q.x < 0.01 ? p(inner, q.y) : q));
  shifted.slice(1).forEach((q, i) => outline.line(q, raw.tags[i] === 'fold' ? 'inner' : raw.tags[i]));
  outline.closed = true;
  return {
    ...k,
    name: 'Pocket',
    outline,
    fold: undefined,
    cut: 'Cut 2 (1 pair)',
    labels: k.labels.map((l) => (l.text === 'Cut 1 on fold' ? { ...l, text: 'Cut 2 (1 pair)' } : l)),
    allowances: { ...k.allowances, inner: 1.5, fold: 1.5 },
    meta: { ...k.meta, pocket: 'split' },
  };
}

/** The half-zip's facing: a strip round the slit, cut on the fold, stitched to the front and turned through. */
function zipFacing(neckTop: number): Piece {
  const L = HALF_ZIP_CM + 3;
  const W = 4;
  const outline = new Path(p(0, 0)).line(p(W, 0), 'top').line(p(W, L), 'side').curve(p(W, L + 2.5), p(0, L + 2.5), p(0, L + 2.5), 'bottom').line(p(0, 0), 'fold');
  outline.closed = true;
  return {
    name: 'Zip facing',
    kind: 'facing',
    outline,
    lines: [new Path(p(0, 0)).line(p(0, HALF_ZIP_CM), 'slit')],
    grain: [p(W * 0.6, 2), p(W * 0.6, L - 2)],
    fold: [p(0, 1), p(0, L - 1)],
    notches: [[p(0, HALF_ZIP_CM), p(-1, 0)]],
    labels: [{ at: p(W * 0.55, L * 0.5), text: 'ZIP FACING · Cut 1 on fold', size: 0.5, rotate: 90 }],
    cut: 'Cut 1 on fold',
    seamAllowance: KNIT_SEAM,
    allowances: { fold: 0 },
    meta: { facing: 'half zip', knit: true, neckTop: r1(neckTop) },
  };
}

