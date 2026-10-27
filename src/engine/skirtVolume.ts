// Fullness added to a block skirt (straight, pencil or A-line), drafted the way a pattern cutter adds it
// (Aldrich, Armstrong):
//   Knife and box pleats: the block is slashed down its length at each pleat and spread parallel by the
//   pleat's underlay, with the side seam hidden in the inside fold of the pleat at each side. The darts
//   are left out and their waist intake goes into the pleats: each is stitched down from the waist to
//   the hip, taking a little more at the waist and tapering to its plain depth at the hip.
//   Inverted pleats: one at the centre front, on the fold, and one at the centre back below the zip;
//   the rest of the skirt keeps its darts.
//   Godets: triangles cut as sectors of a circle, so the hem stays level, set into slashes (and, for six,
//   the side seams) from above the knee or mid-thigh to the hem.
//   Hem flounce: the skirt is shortened and a circular flounce, a ring whose inner edge is exactly the
//   skirt's new hem, is sewn on below it.
//   Tiers: a fitted yoke to just below the hip, then two or three gathered rectangles, each wider than
//   the one above.
// Keep to plain ASCII punctuation in the words: they go into the PDF.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { cutLine, type Label, type Piece } from './piece';
import { layPlan } from './layplan';
import { arc, cm, onCircle } from './skirt';
import type { Length, Silhouette, SkirtDraft, SkirtMeasurements, SkirtStyle } from './skirt';
import type { SewStep } from './instructions';
import type { AsymHem } from './asymHem';
import type { FabricAdvice, FabricPick, MyFabric } from './fabrics';

export type Pleats = 'none' | 'knife' | 'box' | 'inverted';
export type GodetCount = 0 | 4 | 6 | 8;
export type Flounce = 'none' | 'hem_flounce' | 'tiers';
/** The one detail a skirt carries: pleats, godets, a hem flounce or tiers. */
export type VolumeKind = 'none' | 'knife' | 'box' | 'inverted' | 'godets' | 'hem_flounce' | 'tiers';

/** The choices that bear on the detail. */
export interface VolumeStyle {
  silhouette: Silhouette;
  length: Length;
  pleats?: Pleats;
  godets?: GodetCount;
  flounce?: Flounce;
  /** A high-low or diagonal hem (asymHem.ts): only godets go with one. */
  asymHem?: AsymHem;
}

const BLOCK: Silhouette[] = ['straight', 'pencil', 'a_line'];
/** Godets and tiers need the length below the hip to show: knee and longer. */
const LONG: Length[] = ['knee', 'midi', 'maxi'];

/** The chips for the Details group, in order. */
export const VOLUME_OPTIONS: [VolumeKind, string][] = [
  ['none', 'None'],
  ['knife', 'Knife pleats'],
  ['box', 'Box pleats'],
  ['inverted', 'Inverted pleats'],
  ['godets', 'Godets'],
  ['hem_flounce', 'Hem flounce'],
  ['tiers', 'Tiers'],
];
export const GODET_OPTIONS: [GodetCount, string][] = [
  [4, '4 godets'],
  [6, '6 godets'],
  [8, '8 godets'],
];

/** Whether a detail suits the shape, length and hem: all of them need a block skirt (a circle or
 * trumpet is already full at the hem, and a bias slip is cut whole and moulds to the body), and godets
 * and tiers need a skirt to the knee or longer. A diagonal hem is cut whole, single layer, so it takes
 * none of them; a high-low hem takes godets, which follow the hem, but not pleats (the folds would
 * twist round the curve), a flounce or tiers (they would need the curve drafted into them too). */
export function volumeAllowed(s: { silhouette: Silhouette; length: Length; asymHem?: AsymHem }, kind: VolumeKind): boolean {
  if (kind === 'none') return true;
  if (!BLOCK.includes(s.silhouette)) return false;
  if (s.asymHem === 'diagonal') return false;
  if (s.asymHem === 'high_low' && kind !== 'godets') return false;
  if (kind === 'godets' || kind === 'tiers') return LONG.includes(s.length);
  if (kind === 'hem_flounce') return s.length !== 'mini';
  return true;
}

/** The detail the choices ask for, made valid: pleats first, then a flounce or tiers, then godets.
 * One the shape or length doesn't allow falls back to none. */
export function volumeOf(s: VolumeStyle): VolumeKind {
  const want: VolumeKind = s.pleats && s.pleats !== 'none' ? s.pleats : s.flounce && s.flounce !== 'none' ? s.flounce : s.godets ? 'godets' : 'none';
  return volumeAllowed(s, want) ? want : 'none';
}

/** How many godets, four, six or eight. */
const godetCount = (s: { godets?: GodetCount }): 4 | 6 | 8 => (s.godets === 4 || s.godets === 8 ? s.godets : 6);

/** The choices with one detail set and the others cleared. */
export function setVolume<C extends Partial<VolumeStyle>>(c: C, kind: VolumeKind, godets?: GodetCount): C {
  const { pleats: _p, godets: g, flounce: _f, ...rest } = c;
  if (kind === 'none') return rest as C;
  if (kind === 'knife' || kind === 'box' || kind === 'inverted') return { ...rest, pleats: kind } as C;
  if (kind === 'godets') return { ...rest, godets: godets ?? (g ? godetCount({ godets: g }) : 6) } as C;
  return { ...rest, flounce: kind } as C;
}

/** The detail in a skirt's name: "with knife pleats", "with 6 godets". Empty for none. */
export function volumeWords(s: VolumeStyle): string {
  const k = volumeOf(s);
  if (k === 'godets') return `with ${godetCount(s)} godets`;
  return { none: '', knife: 'with knife pleats', box: 'with box pleats', inverted: 'with inverted pleats', hem_flounce: 'with a hem flounce', tiers: 'with gathered tiers' }[k];
}

/** No walking slit is needed once a skirt has pleats, godets, a flounce or tiers: they give the room. */
export const needsNoSlit = (s: VolumeStyle) => volumeOf(s) !== 'none';

// ---------------------------------------------------------------------------------------------------
// What was drafted.

/** A gathered tier: a rectangle given as measurements, like the waistband, cut in panels across the fabric. */
export interface TierBand {
  name: string;
  /** Finished depth, from the seam above to the hem or the seam below. */
  depth: number;
  /** Round the skirt, finished, before gathering. */
  round: number;
  /** The edge it is gathered onto, round the skirt. */
  gatheredTo: number;
  /** Its round over the edge above: 1.5 gathers to two-thirds. */
  ratio: number;
  panels: number;
  cutLength: number;
  cutWidth: number;
}

export interface VolumeDraft {
  kind: Exclude<VolumeKind, 'none'>;
  /** Knife and box pleats: how many round the skirt, the visible width of each face at the hip, the
   * depth each fold hides, and the hem with the pleats opened out flat. */
  pleats?: { count: number; face: number; depth: number; openHem: number; waistIntake: number; split: boolean };
  /** Inverted pleats: their depth, and how far below the waist the back one opens. */
  inverted?: { depth: number; backFrom?: number; frontSeam?: boolean };
  /** Godets: how many, how long from the point to the hem, and how wide each is at the hem. */
  godets?: { count: number; length: number; hemWidth: number; from: number; inSeams: boolean };
  /** Hem flounce: its depth, where it joins (below the waist), and its hem round. */
  flounce?: { depth: number; joinAt: number; hem: number };
  /** Tiers below the yoke, top to bottom, and how far below the waist the yoke ends. */
  tiers?: { yoke: number; bands: TierBand[] };
  /** Per piece (front, back), in the worn block's coordinates: the pleat folds and the godet slashes, for the flat. */
  folds?: { top: P; hip: P; hem: P }[][];
  slashes?: [P, P][][];
}

// ---------------------------------------------------------------------------------------------------
// Drafting.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
/** Folded 140 cm fabric leaves about 68 cm for a piece placed on the fold (as for the circle skirt). */
const FOLD_WIDTH_MAX = 68;
/** A cut piece (allowances included) at most this wide still lies on folded 140 cm fabric, clear of the fold. */
const CUT_WIDTH_MAX = 67.5;
const cutWidth = (pc: Piece) => {
  const xs = cutLine(pc).map((q) => q.x);
  return Math.max(...xs) - Math.min(...xs);
};
/** Gathered tiers are cut in panels no wider than this, so they cut from folded 140 cm fabric. */
const PANEL_MAX = 62;

/**
 * Add the detail to a drafted block skirt. `redraft` drafts the block again in another length, for the
 * skirt above a flounce or the yoke above the tiers. A detail that can't be drafted for this skirt (too
 * short below the hip for godets, say) leaves the skirt as it was.
 */
export function addVolume(m: SkirtMeasurements, s: SkirtStyle, draft: SkirtDraft, redraft: (st: SkirtStyle) => SkirtDraft): SkirtDraft {
  const kind = volumeOf(s);
  if (kind === 'none' || draft.circleShare || draft.pieces.length !== 2) return draft;
  if (kind === 'knife' || kind === 'box') return pleated(m, draft, kind);
  if (kind === 'inverted') return inverted(m, draft);
  if (kind === 'godets') return withGodets(m, s, draft, godetCount(s));
  return flounced(m, s, draft, redraft, kind);
}

/** The block's edges as polylines: the waist with its darts left out, the side seam and the hem. */
interface Shape {
  /** Centre to side waist, x rising, dart legs bridged straight across. */
  waist: P[];
  side: P[];
  /** Centre to side, x rising. */
  hem: P[];
}

function shapeOf(pc: Piece): Shape {
  const { pts, tags } = pc.outline.taggedPoints(256);
  const n = tags.length;
  const push = (run: P[], q: P) => {
    if (len(sub(q, run[run.length - 1])) > 1e-6) run.push(q);
  };
  let i = 0;
  const waist = [pts[0]];
  while (i < n && (tags[i] === 'waist' || tags[i] === 'dart')) {
    // A dart's peak sits between its two dart edges: leave it out, so the waist runs straight across.
    if (!(tags[i] === 'dart' && tags[i + 1] === 'dart')) push(waist, pts[i + 1]);
    i++;
  }
  const side = [pts[i]];
  while (i < n && tags[i] === 'side') push(side, pts[++i]);
  const hem = [pts[i]];
  while (i < n && tags[i] === 'hem') push(hem, pts[++i]);
  return { waist, side, hem: hem.reverse() };
}

/** y at x along a run with x rising; past the centre it mirrors, past the end it carries on level. */
function yAt(run: P[], x: number): number {
  const xx = Math.abs(x);
  if (xx <= run[0].x) return run[0].y;
  for (let i = 1; i < run.length; i++) {
    if (run[i].x >= xx) {
      const a = run[i - 1];
      const b = run[i];
      return b.x - a.x < 1e-9 ? b.y : a.y + ((b.y - a.y) * (xx - a.x)) / (b.x - a.x);
    }
  }
  return run[run.length - 1].y;
}

/** The part of a run between x0 and x1, ends included. */
function runBetween(run: P[], x0: number, x1: number): P[] {
  const out = [p(x0, yAt(run, x0))];
  for (const q of run) if (q.x > x0 + 1e-6 && q.x < x1 - 1e-6) out.push(q);
  out.push(p(x1, yAt(run, x1)));
  return out;
}

/** A polyline being built point by point, each edge carrying a tag. */
class Edge {
  pts: P[] = [];
  tags: string[] = [];
  add(q: P, tag: string) {
    if (this.pts.length && len(sub(q, this.pts[this.pts.length - 1])) < 1e-6) return;
    if (this.pts.length) this.tags.push(tag);
    this.pts.push(q);
  }
  get last() {
    return this.pts[this.pts.length - 1];
  }
}

/** A closed outline from a top edge (left to right), the right boundary down, a bottom edge (left to
 * right, walked back) and the left boundary up to the start. */
function outlineOf(top: Edge, right: P[], rightTag: string, bottom: Edge, left: P[], leftTag: string): Path {
  const out = new Path(top.pts[0]);
  top.pts.slice(1).forEach((q, i) => out.line(q, top.tags[i]));
  for (const q of right.slice(1)) out.line(q, rightTag);
  for (let i = bottom.pts.length - 2; i >= 0; i--) out.line(bottom.pts[i], bottom.tags[i]);
  for (const q of left.slice(1)) out.line(q, leftTag);
  out.closed = true;
  return out;
}

const pathOf = (pts: P[]) => {
  const out = new Path(pts[0]);
  for (const q of pts.slice(1)) out.line(q);
  return out;
};

/** An arrow on the pattern, from a to b. Drawn tail, point, one barb, back to the point, the other barb,
 * so it is never mistaken for a dart (three points). */
function arrow(a: P, b: P): Path {
  const u = unit(sub(b, a));
  const n = p(-u.y, u.x);
  const back = sub(b, mul(u, 0.7));
  return new Path(a).line(b).line(add(back, mul(n, 0.35))).line(b).line(sub(back, mul(n, 0.35)));
}

/** A copy of an outline with one tag renamed. */
function retagged(path: Path, from: string, to: string): Path {
  const out = new Path(path.start);
  out.segs = [...path.segs];
  out.tags = path.tags.map((t) => (t === from ? to : t));
  out.closed = path.closed;
  return out;
}

/** The point at a share of the way along the edges carrying `tag`, and the direction there. */
function alongTag(path: Path, tag: string, share: number): { at: P; dir: P } | undefined {
  const { pts, tags } = path.taggedPoints(48);
  const total = taggedLength(path, tag);
  if (!(total > 0)) return undefined;
  let acc = 0;
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] !== tag) continue;
    const l = len(sub(pts[i + 1], pts[i]));
    if (acc + l >= share * total) return { at: lerp(pts[i], pts[i + 1], l ? (share * total - acc) / l : 0), dir: unit(sub(pts[i + 1], pts[i])) };
    acc += l;
  }
  return undefined;
}

const hipOf = (pc: Piece, m: SkirtMeasurements) => pc.balance?.find((b) => b.label === 'HIP LINE')?.pts[0].y ?? m.waist_to_hip;

// ---- Knife and box pleats ---------------------------------------------------------------------------

interface Layout {
  kind: 'knife' | 'box';
  /** Pleats inside each quarter; one more is shared at each side seam. */
  n: number;
  /** Visible width of each face at the hip. */
  face: number;
  /** How deep each fold goes: the width of fabric it hides, twice over. */
  depth: number;
  /** The spread at each pleat inside the quarter, and the share of the side pleat each piece carries. */
  under: number;
  sideHalf: number;
}

/** Faces about 5 cm wide for knife pleats and about 7.5 cm for box pleats, fitted evenly to the hip:
 * half a face either side of the centre front and back, a pleat at each side seam. */
function layoutFor(kind: 'knife' | 'box', hipQ: number): Layout {
  if (kind === 'knife') {
    const n = Math.max(2, Math.round(hipQ / 5 - 0.5));
    const face = hipQ / (n + 0.5);
    const depth = clamp(0.6 * face, 2.5, 4);
    return { kind, n, face, depth, under: 2 * depth, sideHalf: depth };
  }
  const n = Math.max(1, Math.round(hipQ / 7.5 - 0.5));
  const face = hipQ / (n + 0.5);
  const depth = clamp(0.35 * face, 2.5, 4);
  return { kind, n, face, depth, under: 4 * depth, sideHalf: 2 * depth };
}

interface Spread {
  top: Edge;
  bottom: Edge;
  side: P[];
  /** Where each pleat's lines run, in the spread piece. */
  pleats: { folds: P[][]; places: P[][]; arrows: [P, P][]; splitTop: number; splitBottom: number; split: P[] }[];
  sidePleat: { folds: P[][]; places: P[][]; arrows: [P, P][] };
  /** The block's own fold positions, for the flat. */
  worn: { top: P; hip: P; hem: P }[];
  width: number;
}

/**
 * Spread one quarter of the block. Pleat k is slashed `face/2 + (k-1) face` from the centre at the hip,
 * running straight down to the hem and up to the same share of the waist; each slash opens by the
 * underlay. Knife pleats on the front fold toward the side seam, on the back toward the centre back, so
 * every fold points to the back. Each pleat also takes `e` more at the waist, from the face its fold
 * belongs to, tapering to nothing at the hip.
 */
function spread(pc: Piece, L: Layout, hipY: number, hipQ: number, isFront: boolean, e: number): Spread {
  const sh = shapeOf(pc);
  const sw = sh.waist[sh.waist.length - 1];
  const hemSide = sh.hem[sh.hem.length - 1];
  const c = (k: number) => (k <= 0 ? 0 : k > L.n ? hemSide.x : L.face / 2 + (k - 1) * L.face);
  const cw = (k: number) => (k <= 0 ? 0 : k > L.n ? sw.x : (c(k) * sw.x) / hipQ);
  const dir = L.kind === 'knife' ? (isFront ? 1 : -1) : 0;
  const intake = { before: dir > 0 ? e : dir < 0 ? 0 : e / 2, after: dir < 0 ? e : dir > 0 ? 0 : e / 2 };
  const d = L.depth;
  // Where the hidden layers of the underlay lie, back on the block, so the waist and hem across the
  // underlay are trued with the pleat folded: each layer takes the line of the face it lies under.
  const under = (x: number, v: number) =>
    L.kind === 'box' ? (v <= 2 * d ? x - (d - Math.abs(v - d)) : x + (d - Math.abs(v - 3 * d))) : x - dir * (d - Math.abs((dir > 0 ? v : L.under - v) - d));
  const marks = L.kind === 'box' ? [d, 2 * d, 3 * d] : [d];
  const samples = () => {
    const vs = Array.from({ length: Math.ceil(L.under / 0.25) + 1 }, (_, i) => Math.min(L.under, i * 0.25));
    return [...new Set([...vs, ...marks].map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  };

  const top = new Edge();
  const bottom = new Edge();
  const pleats: Spread['pleats'] = [];
  const worn: Spread['worn'] = [];
  for (let k = 1; k <= L.n + 1; k++) {
    const shift = (k - 1) * L.under;
    // The face between pleat k-1 and pleat k, at the waist: intake either end where a fold belongs to it.
    const x0 = cw(k - 1);
    const x1 = cw(k);
    const a = k > 1 ? intake.after : 0;
    const b = k <= L.n ? intake.before : 0;
    const at = (q: P) => add(q, p(shift, 0));
    for (const q of runBetween(sh.waist, x0, x0 + a)) top.add(at(q), 'pleat');
    for (const q of runBetween(sh.waist, x0 + a, x1 - b)) top.add(at(q), 'waist');
    for (const q of runBetween(sh.waist, x1 - b, x1)) top.add(at(q), 'pleat');
    for (const q of runBetween(sh.hem, c(k - 1), c(k))) bottom.add(at(q), 'hem');
    if (k > L.n) break;

    // The underlay, trued to the faces it folds under.
    const xs = shift + cw(k);
    const hs = shift + c(k);
    let splitTop = -1;
    let splitBottom = -1;
    const splitAt = L.kind === 'box' ? 2 * d : d;
    for (const v of samples()) {
      top.add(p(xs + v, yAt(sh.waist, under(cw(k), v))), 'pleat');
      if (Math.abs(v - splitAt) < 1e-6) splitTop = top.pts.length - 1;
    }
    for (const v of samples()) {
      bottom.add(p(hs + v, yAt(sh.hem, under(c(k), v))), 'hem');
      if (Math.abs(v - splitAt) < 1e-6) splitBottom = bottom.pts.length - 1;
    }
    const line = (v: number, waistX: number) => [p(xs + v + (waistX - cw(k)), yAt(sh.waist, waistX)), p(hs + v, hipY), p(hs + v, yAt(sh.hem, c(k)))];
    const U = L.under;
    const folds: P[][] = [];
    const places: P[][] = [];
    const arrows: [P, P][] = [];
    const ay = hipY + Math.min(6, (yAt(sh.hem, c(k)) - hipY) / 2);
    if (L.kind === 'knife') {
      const f = dir > 0 ? line(0, cw(k) - e) : line(U, cw(k) + e);
      const pl = dir > 0 ? line(U, cw(k)) : line(0, cw(k));
      folds.push(f);
      places.push(pl);
      arrows.push([p(f[1].x + dir * 0.4, ay), p(pl[1].x - dir * 0.4, ay)]);
    } else {
      const fa = line(0, cw(k) - e / 2);
      const fb = line(U, cw(k) + e / 2);
      const centre = line(2 * d, cw(k));
      folds.push(fa, fb);
      places.push(centre);
      arrows.push([p(fa[1].x + 0.4, ay), p(centre[1].x - 0.4, ay)], [p(fb[1].x - 0.4, ay), p(centre[1].x + 0.4, ay)]);
    }
    worn.push({ top: p(cw(k), yAt(sh.waist, cw(k))), hip: p(c(k), hipY), hem: p(c(k), yAt(sh.hem, c(k))) });
    // The inside fold of the pleat, where a panel seam can hide if the piece is split.
    const split = [top.pts[splitTop], p(hs + splitAt, hipY), bottom.pts[splitBottom]];
    pleats.push({ folds, places, arrows, splitTop, splitBottom, split });
  }

  // The side pleat: each piece carries half its underlay beyond the block's side seam, square to the
  // seam below the hip, so the hem meets the hidden side seam at a right angle.
  const S = L.n * L.under;
  const sideP = sh.side.map((q) => add(q, p(S, 0)));
  const down = unit(sub(sh.side[sh.side.length - 1], sh.side[sh.side.length - 2]));
  const V = mul(p(down.y, -down.x), L.sideHalf);
  top.add(add(sideP[0], V), 'pleat');
  bottom.add(add(sideP[sideP.length - 1], V), 'hem');
  // The block's side seam line becomes the side pleat's fold (or, on the back of a knife pleated skirt,
  // the line the front's fold comes to).
  const hipIdx = sideP.reduce((best, q, i) => (Math.abs(q.y - hipY) < Math.abs(sideP[best].y - hipY) ? i : best), 0);
  const above = sideP.slice(0, hipIdx + 1);
  const below = sideP.slice(hipIdx);
  const ay = hipY + Math.min(6, (sideP[sideP.length - 1].y - hipY) / 2);
  const sx = (y: number) => {
    const i = sideP.findIndex((q) => q.y >= y);
    const a = sideP[Math.max(0, i - 1)];
    const b = sideP[Math.max(0, i)];
    return b.y - a.y < 1e-9 ? b.x : a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  };
  const sidePleat: Spread['sidePleat'] =
    L.kind === 'knife' && !isFront
      ? { folds: [], places: [sideP], arrows: [] }
      : { folds: [above, below], places: [], arrows: [[p(sx(ay) + 0.4, ay), p(sx(ay) + L.sideHalf - 0.3, ay)]] };
  return { top, bottom, side: sideP.map((q) => add(q, V)), pleats, sidePleat, worn, width: Math.max(...sideP.map((q) => q.x + V.x)) };
}

function pleated(m: SkirtMeasurements, draft: SkirtDraft, kind: 'knife' | 'box'): SkirtDraft {
  const [bf, bb] = draft.pieces;
  const hipY = hipOf(bf, m);
  const hipQ = draft.finishedHip / 4;
  const L = layoutFor(kind, hipQ);
  const sa = bf.seamAllowance;
  // The waist with the darts left out is longer than the waist they close to; the difference goes into
  // the pleats, a share each. Walk it until the waist seam matches the block's to the millimetre.
  const fit = (pc: Piece, isFront: boolean) => {
    const target = taggedLength(pc.outline, 'waist');
    const sh = shapeOf(pc);
    let wl = 0;
    for (let i = 1; i < sh.waist.length; i++) wl += len(sub(sh.waist[i], sh.waist[i - 1]));
    const cap = (0.4 * L.face * sh.waist[sh.waist.length - 1].x) / hipQ;
    let e = clamp((wl - target) / L.n, 0, cap);
    let sp = spread(pc, L, hipY, hipQ, isFront, e);
    for (let i = 0; i < 4; i++) {
      const got = sp.top.tags.reduce((t, tag, j) => (tag === 'waist' ? t + len(sub(sp.top.pts[j + 1], sp.top.pts[j])) : t), 0);
      if (Math.abs(got - target) < 0.002) break;
      e = clamp(e + (got - target) / L.n, 0, cap);
      sp = spread(pc, L, hipY, hipQ, isFront, e);
    }
    return { sp, e, intake: wl - target };
  };
  const F = fit(bf, true);
  const B = fit(bb, false);
  // Too wide to cut on folded fabric: split each piece at the inside fold of a pleat, where the seam is hidden.
  let split = Math.max(F.sp.width, B.sp.width) + sa > FOLD_WIDTH_MAX;
  let front = pleatPieces(bf, F.sp, L, F.e, F.intake, hipY, true, split);
  let back = pleatPieces(bb, B.sp, L, B.e, B.intake, hipY, false, split);
  if (!split && [...front, ...back].some((pc) => cutWidth(pc) > CUT_WIDTH_MAX)) split = true;
  if (split) {
    // Split at the pleat that leaves the widest piece narrowest (on a flared skirt the side panel spreads
    // at the hem), as long as the pieces still cut from 140 cm fabric, folded or opened out.
    const widest = (pcs: Piece[]) => Math.max(...pcs.map(cutWidth));
    const options = Array.from({ length: L.n }, (_, j) => {
      const f = pleatPieces(bf, F.sp, L, F.e, F.intake, hipY, true, split, j);
      const b = pleatPieces(bb, B.sp, L, B.e, B.intake, hipY, false, split, j);
      return { f, b, w: widest([...f, ...b]) };
    }).sort((a, b) => a.w - b.w);
    const pick = options.find((o) => o.w <= CUT_WIDTH_MAX) ?? options.find((o) => layPlan([...o.f, ...o.b], 140)) ?? options[0];
    [front, back] = [pick.f, pick.b];
  }
  const openHem = Math.round(2 * [...front, ...back].reduce((t, pc) => t + taggedLength(pc.outline, 'hem'), 0));
  const count = 4 * L.n + 2;
  return {
    ...draft,
    pieces: split ? [front[0], back[0], front[1], back[1]] : [front[0], back[0]],
    block: draft.pieces,
    dartsPerSide: { front: 0, back: 0 },
    volume: {
      kind,
      pleats: { count, face: r1(L.face), depth: r1(L.depth), openHem, waistIntake: r1(F.e + B.e), split },
      folds: [F.sp.worn, B.sp.worn],
    },
  };
}

/** The spread quarter as a printed piece, or two when it is split at a pleat to fit the fabric. */
function pleatPieces(block: Piece, sp: Spread, L: Layout, e: number, intake: number, hipY: number, isFront: boolean, split: boolean, at0?: number): Piece[] {
  const centreTag = isFront ? 'fold' : 'centre';
  const cTop = sp.top.pts[0];
  const cFoot = sp.bottom.pts[0];
  const where = isFront ? 'front' : 'back';
  const lines: Path[] = [];
  const balance: Piece['balance'] = [];
  const notches: [P, P][] = block.notches.filter(([q]) => Math.abs(q.x) < 1e-6);
  const labels: Label[] = [];
  const addLines = (folds: P[][], places: P[][], arrows: [P, P][]) => {
    // Above the hip the fold is a stitching line, angled to take in the waist; below it, a plain fold.
    for (const f of folds) {
      lines.push(pathOf([f[0], f[1]]), pathOf([f[1], f[2]]));
      notches.push([f[0], p(0, -1)], [f[2], p(0, 1)]);
    }
    for (const pl of places) {
      balance.push({ pts: pl, label: 'PLACEMENT' });
      notches.push([pl[0], p(0, -1)], [pl[pl.length - 1], p(0, 1)]);
    }
    for (const [a, b] of arrows) lines.push(arrow(a, b));
  };
  sp.pleats.forEach((pl) => addLines(pl.folds, pl.places, pl.arrows));
  // The side pleat follows the block's side seam, curved above the hip.
  const sp2 = sp.sidePleat;
  if (sp2.folds.length) {
    const [above, below] = sp2.folds;
    lines.push(pathOf(above), pathOf(below));
    notches.push([above[0], p(0, -1)], [below[below.length - 1], p(0, 1)]);
  }
  for (const pl of sp2.places) {
    balance.push({ pts: pl, label: 'PLACEMENT' });
    notches.push([pl[0], p(0, -1)], [pl[pl.length - 1], p(0, 1)]);
  }
  for (const [a, b] of sp2.arrows) lines.push(arrow(a, b));

  // Hip notches on the hidden side seam: single on the front, double on the back.
  const sideHip = sp.side.reduce((best, q) => (Math.abs(q.y - hipY) < Math.abs(best.y - hipY) ? q : best), sp.side[0]);
  const out = unit(sub(sp.side[sp.side.length - 1], sp.side[sp.side.length - 2]));
  const n = p(out.y, -out.x);
  if (isFront) notches.push([sideHip, n]);
  else notches.push([add(sideHip, mul(out, -0.5)), n], [add(sideHip, mul(out, 0.5)), n]);

  const how =
    L.kind === 'knife'
      ? `Knife pleats ${cm(L.depth)} deep, folding toward the ${isFront ? 'side seam' : 'centre back'}, so every fold points to the back`
      : `Box pleats, each fold ${cm(L.depth)} deep, the folds of neighbouring boxes meeting over the dashed line`;
  const points = [
    ...(block.draft?.points.filter((q) => ['0', '1', '2'].includes(q.n)) ?? []),
    ...sp.pleats.map((pl, i) => ({
      n: `P${i + 1}`,
      at: pl.folds[0][1],
      note: `Pleat ${i + 1}: slash the block ${cm(L.face / 2 + i * L.face)} from the centre ${where} at the hip, straight down to the hem and up to the waist, and spread it ${cm(L.under)}, keeping the pieces parallel. ${
        i === 0 ? `${how}. ` : ''
      }${e > 0.05 && i === 0 ? `The darts are left out: their ${cm(intake)} goes into the pleats, each taking ${cm(e)} more at the waist and tapering to nothing at the hip, where the fold is stitched down to.` : ''}`.trim(),
    })),
    {
      n: 'S',
      at: sideHip,
      note: `Side seam: ${cm(L.sideHalf)} beyond the block's side seam, square to it, so the seam is hidden inside the pleat at the side. The block's side seam becomes the side pleat's ${L.kind === 'knife' && !isFront ? 'placement line' : 'fold'}.`,
    },
  ];
  const W = sp.width;
  const Lc = cFoot.y;
  const frame = [
    [p(0, 0), p(W, 0)],
    [p(0, Lc), p(W, Lc)],
    [p(0, hipY), p(W, hipY)],
  ];
  const cutLabel = isFront ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const base = (name: string, cut: string, x0: number, x1: number): Piece => ({
    name,
    outline: new Path(p(0, 0)),
    lines: [],
    notches: [],
    labels: [],
    cut,
    seamAllowance: block.seamAllowance,
    allowances: { ...block.allowances, pleat: block.seamAllowance },
    grain: [p((x0 + x1) / 2, hipY + 3), p((x0 + x1) / 2, Math.max(hipY + 6, Lc - 6))],
    balance: [{ pts: [p(x0, hipY), p(x1, hipY)], label: 'HIP LINE' }],
    meta: { dartsCm: [], sideSuppressionCm: block.meta.sideSuppressionCm, pleats: L.kind },
  });
  // A grain line down the middle of a face, clear of the pleat lines.
  const faceMid = (k: number) => L.face / 2 + (k - 1) * L.face + L.face / 2 + k * L.under;
  const instruction = L.kind === 'knife' ? 'FOLD EACH SOLID LINE ONTO ITS DASHED LINE, AS THE ARROWS SHOW' : 'BRING EACH PAIR OF FOLDS TO MEET ON THE DASHED LINE';
  const nameLabels = (name: string, cut: string, x0: number, x1: number): Label[] => [
    { at: p((x0 + x1) / 2, hipY - 4), text: name.toUpperCase(), size: 1.6 },
    { at: p((x0 + x1) / 2, hipY + 1), text: cut, size: 1.0 },
    { at: p((x0 + x1) / 2, hipY + 2.6), text: instruction, size: 0.55 },
  ];
  const zipLabels = block.labels.filter((l) => l.text === 'ZIP ENDS');
  const stitchLabels = (pts: P[][]): Label[] =>
    pts
      .filter((f) => f[1].y - f[0].y > 6)
      .map((f) => {
        const u = unit(sub(f[1], f[0]));
        return { at: add(lerp(f[0], f[1], 0.5), p(-0.5, 0)), text: 'STITCH', size: 0.45, rotate: (Math.atan2(u.y, u.x) * 180) / Math.PI };
      });

  if (!split) {
    const pc = base(block.name, cutLabel, 0, W);
    pc.outline = outlineOf(sp.top, sp.side, 'side', sp.bottom, [cFoot, cTop], centreTag);
    pc.lines = lines;
    pc.notches = notches;
    pc.balance = [...(pc.balance ?? []), ...balance];
    pc.labels = [...nameLabels(block.name, cutLabel, 0, W), ...zipLabels, ...stitchLabels(sp.pleats.flatMap((q) => q.folds)), ...labels];
    pc.grain = [p(faceMid(1), hipY + 3), p(faceMid(1), Math.max(hipY + 6, Lc - 6))];
    pc.fold = block.fold;
    pc.draft = { frame, points };
    return [pc];
  }

  // Split at the inside fold of a pleat (the middle one unless chosen): a panel seam that never shows.
  const j = at0 ?? Math.ceil(L.n / 2) - 1;
  const at = sp.pleats[j];
  const it = at.splitTop;
  const ib = at.splitBottom;
  const cutLine = at.split;
  const slice = (e0: Edge, a: number, b: number) => {
    const out = new Edge();
    out.pts = e0.pts.slice(a, b + 1);
    out.tags = e0.tags.slice(a, b);
    return out;
  };
  const leftTop = slice(sp.top, 0, it);
  const rightTop = slice(sp.top, it, sp.top.pts.length - 1);
  const leftBottom = slice(sp.bottom, 0, ib);
  const rightBottom = slice(sp.bottom, ib, sp.bottom.pts.length - 1);
  const xSplit = cutLine[1].x;
  const leftOf = (q: P) => q.x < xSplit - 1e-6;
  const sideName = `${block.name.replace(/^Skirt /, 'Skirt side ')}`;
  const A = base(block.name, cutLabel, 0, xSplit);
  A.outline = outlineOf(leftTop, cutLine, 'panel', leftBottom, [cFoot, cTop], centreTag);
  const B = base(sideName, 'Cut 2 (1 pair)', xSplit, W);
  B.outline = outlineOf(rightTop, sp.side, 'side', rightBottom, [...cutLine].reverse(), 'panel');
  const pick = <T>(xs: T[], q: (t: T) => P, left: boolean) => xs.filter((t) => leftOf(q(t)) === left);
  const panelNotch = (dirX: number): [P, P][] =>
    isFront ? [[cutLine[1], p(dirX, 0)]] : [[add(cutLine[1], p(0, -0.5)), p(dirX, 0)], [add(cutLine[1], p(0, 0.5)), p(dirX, 0)]];
  for (const [pc, left] of [
    [A, true],
    [B, false],
  ] as const) {
    pc.lines = pick(lines, (l) => l.start, left);
    pc.notches = [...pick(notches, (nn) => nn[0], left), ...panelNotch(left ? 1 : -1)];
    pc.balance = [...(pc.balance ?? []), ...pick(balance, (b) => b.pts[0], left)];
  }
  A.labels = [...nameLabels(A.name, cutLabel, 0, xSplit), ...zipLabels, ...stitchLabels(pick(sp.pleats.flatMap((q) => q.folds), (f) => f[0], true))];
  B.labels = [...nameLabels(B.name, B.cut, xSplit, W), ...stitchLabels(pick(sp.pleats.flatMap((q) => q.folds), (f) => f[0], false))];
  A.grain = [p(faceMid(1), hipY + 3), p(faceMid(1), Math.max(hipY + 6, Lc - 6))];
  const k = Math.min(L.n, j + 2);
  const bx = k <= L.n ? faceMid(k) : (xSplit + W) / 2;
  B.grain = [p(bx, hipY + 3), p(bx, Math.max(hipY + 6, Lc - 6))];
  A.fold = block.fold;
  A.meta = { ...A.meta, panelSeam: sideName };
  B.meta = { ...B.meta, panelSeam: block.name };
  A.draft = { frame, points: points.filter((q) => leftOf(q.at)) };
  B.draft = {
    frame,
    points: [
      ...points.filter((q) => !leftOf(q.at)),
      { n: 'J', at: cutLine[1], note: `Panel seam: cut along the inside fold of pleat ${j + 1} so the pieces fit folded fabric. The seam is hidden at the back of the pleat.` },
    ],
  };
  return [A, B];
}

// ---- Inverted pleats --------------------------------------------------------------------------------

/** A copy of an outline without its last edge (the centre line back to the start). */
function openOutline(path: Path, start?: P, firstTag = ''): Path {
  const out = new Path(start ?? path.start);
  if (start) out.line(path.start, firstTag);
  out.segs.push(...path.segs.slice(0, -1));
  out.tags.push(...path.tags.slice(0, -1));
  return out;
}

/**
 * An inverted pleat at the centre front, on the fold: the front is extended by twice the pleat depth,
 * folded on the old centre front line so the two folds meet over the extension, and stitched down to
 * the hip. At the centre back the same pleat opens below the zip, its extension seamed at the back of the pleat.
 */
function inverted(m: SkirtMeasurements, draft: SkirtDraft): SkirtDraft {
  const [bf, bb] = draft.pieces;
  const hipY = hipOf(bf, m);
  const hipQ = draft.finishedHip / 4;
  // A shallower pleat when the extension would make the pieces too wide for folded fabric; when even a
  // 3 cm pleat will not fit, the front gets a centre seam and the pieces are cut from a single layer.
  const room = (CUT_WIDTH_MAX - Math.max(cutWidth(bf), cutWidth(bb))) / 2;
  const full = clamp(hipQ * 0.2, 4, 7);
  const d = room >= 3 ? Math.min(full, room) : full;
  const ext = 2 * d;

  // Front.
  const ftop = bf.outline.start;
  const fhem = bf.outline.segs[bf.outline.segs.length - 2].to;
  const fo = openOutline(bf.outline, p(-ext, ftop.y), 'pleat');
  fo.line(p(-ext, fhem.y), 'hem').line(p(-ext, ftop.y), 'fold');
  fo.closed = true;
  const ay = hipY + Math.min(6, (fhem.y - hipY) / 2);
  let front: Piece = {
    ...bf,
    outline: fo,
    lines: [...bf.lines, pathOf([ftop, p(0, hipY)]), pathOf([p(0, hipY), fhem]), arrow(p(-0.4, ay), p(-ext + 0.6, ay))],
    fold: [p(-ext, ftop.y + 2), p(-ext, fhem.y - 2)],
    notches: [...bf.notches, [ftop, p(0, -1)], [fhem, p(0, 1)], [p(-d, ftop.y), p(0, -1)], [p(-d, fhem.y), p(0, 1)]],
    balance: [{ pts: [p(-ext, hipY), ...(bf.balance?.[0].pts.slice(1) ?? [])], label: 'HIP LINE' }, { pts: [p(-d, ftop.y), p(-d, fhem.y)], label: 'INSIDE FOLD' }],
    labels: [...bf.labels, { at: p(0.7, (ftop.y + hipY) / 2), text: 'STITCH TO HIP LINE', size: 0.5, rotate: 90 }, { at: p(-0.7, ay + 3), text: 'FOLD', size: 0.5, rotate: 90 }],
    allowances: { ...bf.allowances, pleat: bf.seamAllowance },
    draft: bf.draft && {
      frame: bf.draft.frame,
      points: [
        ...bf.draft.points,
        {
          n: 'P',
          at: p(0, hipY),
          note: `Inverted pleat: add ${cm(ext)} beyond the centre front, from the waist to the hem; the new edge goes on the fold. The old centre front line is the fold, ${cm(d)} deep: the folds from each side meet over the middle of the extension, and are stitched together down to the hip line.`,
        },
      ],
    },
    meta: { ...bf.meta, pleats: 'inverted' },
  };

  // Too wide to cut on folded fabric: a centre front seam instead, hidden at the back of the pleat.
  const frontSeam = room < 3;
  if (frontSeam) {
    const so = openOutline(bf.outline, p(-ext, ftop.y), 'pleat');
    so.line(p(-ext, fhem.y), 'hem').line(p(-ext, ftop.y), 'centre');
    so.closed = true;
    const { fold: _fold, ...rest } = front;
    front = {
      ...rest,
      outline: so,
      cut: 'Cut 2 (1 pair)',
      draft: front.draft && {
        frame: front.draft.frame,
        points: front.draft.points.map((q) =>
          q.n === 'P' ? { ...q, note: q.note.replace('the new edge goes on the fold.', 'the new edge is a centre front seam, at the back of the pleat, so the front cuts from folded fabric.') } : q,
        ),
      },
    };
  }

  // Back: below the zip, from the hip line down, at least 15 cm above the hem.
  const btop = bb.outline.start;
  const bhem = bb.outline.segs[bb.outline.segs.length - 2].to;
  const zipEnd = bb.notches.find(([q, dir]) => Math.abs(q.x) < 1e-6 && dir.x < 0)?.[0].y ?? btop.y + draft.zipCm;
  const from = Math.max(zipEnd + 3, hipY + 2);
  let back = bb;
  if (from <= bhem.y - 15) {
    const bo = openOutline(bb.outline);
    bo.line(p(-ext, bhem.y), 'hem').line(p(-ext, from + 2), 'centre').line(p(0, from), 'centre').line(btop, 'centre');
    bo.closed = true;
    const by = from + Math.min(8, (bhem.y - from) / 2);
    back = {
      ...bb,
      outline: bo,
      lines: [...bb.lines, pathOf([p(0, from), bhem]), arrow(p(-0.4, by), p(-ext + 0.6, by))],
      notches: [...bb.notches, [p(0, from), p(-1, 0)], [bhem, p(0, 1)], [p(-d, bhem.y), p(0, 1)]],
      balance: [...(bb.balance ?? []), { pts: [p(-d, from + 1), p(-d, bhem.y)], label: 'INSIDE FOLD' }],
      labels: [...bb.labels, { at: p(-0.7, by + 3), text: 'FOLD', size: 0.5, rotate: 90 }],
      draft: bb.draft && {
        frame: bb.draft.frame,
        points: [
          ...bb.draft.points,
          {
            n: 'P',
            at: p(0, from),
            note: `Inverted pleat: ${cm(from - btop.y)} below the waist, clear of the zip, add ${cm(ext)} beyond the centre back down to the hem, the top edge sloping down 2 cm. The centre back line is the fold, ${cm(d)} deep; the outer edges of the two extensions are seamed together, at the back of the pleat.`,
          },
        ],
      },
      meta: { ...bb.meta, pleats: 'inverted' },
    };
  }
  return {
    ...draft,
    pieces: [front, back],
    block: draft.pieces,
    volume: { kind: 'inverted', inverted: { depth: r1(d), ...(back !== bb ? { backFrom: r1(from - btop.y) } : {}), ...(frontSeam ? { frontSeam } : {}) } },
  };
}

// ---- Godets -----------------------------------------------------------------------------------------

function withGodets(m: SkirtMeasurements, s: SkirtStyle, draft: SkirtDraft, count: 4 | 6 | 8): SkirtDraft {
  const [bf, bb] = draft.pieces;
  const hipY = hipOf(bf, m);
  const Lc = draft.lengthCm;
  const knee = m.waist_to_knee;
  // From just above the knee on a midi or maxi; from mid-thigh on a knee-length skirt.
  const from = Lc >= knee + 5 ? knee - 8 : hipY + 0.5 * (knee - hipY);
  // Under a high-low hem every godet is as long as the shortest slash allows, its point kept 6 cm
  // below the hip line where the hem is shortest; the points then follow the hem round.
  const shortest = draft.asym ? Lc + draft.asym.shift - draft.asym.amp : Lc;
  const Lg = Math.min(Lc - from, shortest - hipY - 6);
  if (Lg < 12 || from < hipY + 6) return draft;
  const shares = count === 4 ? [0.5] : count === 6 ? [1 / 3] : [0.25, 0.75];
  const inSeams = count === 6;
  const hemSa = Math.min(s.hemAllowance, 2);

  const slashed = (pc: Piece, isFront: boolean): { pc: Piece; slashes: [P, P][] } | undefined => {
    const slashes: [P, P][] = [];
    const lines: Path[] = [];
    const notches: [P, P][] = [];
    const labels: Label[] = [];
    for (const f of shares) {
      // From a point on the hem, square to it, up the length of the godet.
      const q = alongTag(pc.outline, 'hem', 1 - f);
      if (!q) return undefined;
      const up = p(-q.dir.y, q.dir.x).y < 0 ? p(-q.dir.y, q.dir.x) : p(q.dir.y, -q.dir.x);
      const top = add(q.at, mul(up, Lg));
      slashes.push([top, q.at]);
      const mid = lerp(top, q.at, 0.5);
      const across = p(-up.y, up.x);
      lines.push(pathOf([top, q.at]), pathOf([add(mid, mul(across, 0.6)), sub(mid, mul(across, 0.6))]));
      notches.push([q.at, mul(up, -1)]);
      labels.push({ at: add(lerp(top, q.at, 0.3), mul(across, 0.7)), text: 'SLASH TO DOT', size: 0.5, rotate: (Math.atan2(up.y, up.x) * 180) / Math.PI + 180 });
    }
    if (inSeams) {
      const sh = shapeOf(pc);
      const foot = sh.side[sh.side.length - 1];
      const hipPt = sh.side.reduce((best, q2) => (Math.abs(q2.y - hipY) < Math.abs(best.y - hipY) ? q2 : best), sh.side[0]);
      const run = len(sub(hipPt, foot));
      if (Lg > run - 3) return undefined;
      const u = unit(sub(hipPt, foot));
      const top = add(foot, mul(u, Lg));
      const out = p(-u.y, u.x).x > 0 ? p(-u.y, u.x) : p(u.y, -u.x);
      slashes.push([top, foot]);
      notches.push([top, out], [add(foot, mul(u, Lg / 2)), out]);
    }
    const drills = slashes.slice(0, shares.length).map(([top]) => top);
    return {
      pc: {
        ...pc,
        lines: [...pc.lines, ...lines],
        notches: [...pc.notches, ...notches],
        labels: [...pc.labels, ...labels],
        allowances: { ...pc.allowances, hem: hemSa },
        draft: pc.draft && {
          frame: pc.draft.frame,
          points: [
            ...pc.draft.points,
            {
              n: 'G',
              at: slashes[0][0],
              note: `Godet slash: square up from the hem ${cm(Lg)}, ${shares.map((f) => `${Math.round(f * 100)}%`).join(' and ')} of the way along the hem from the centre ${isFront ? 'front' : 'back'}. Mark the point with a drill hole; the slash is cut only once the edges are staystitched.${inSeams ? ` The side seam takes a godet too, from ${cm(Lg)} above the hem.` : ''}`,
            },
          ],
        },
        meta: { ...pc.meta, slashes, drills },
      },
      slashes,
    };
  };
  const f = slashed(bf, true);
  const b = slashed(bb, false);
  if (!f || !b) return draft;

  // The godet: a sector of a circle from its point, so every point of its hem is the same distance
  // from the point and the hem stays level.
  const hemArc = (0.9 * draft.finishedHip) / count;
  const theta = clamp(hemArc / Lg, 0.26, 1.05);
  const h = theta / 2;
  const outline = new Path(p(0, 0)).line(onCircle(0, Lg, -h), 'godet');
  arc(outline, 0, Lg, -h, h, 'hem');
  outline.line(p(0, 0), 'godet');
  outline.closed = true;
  const edgeMid = (phi: number) => onCircle(0, Lg / 2, phi);
  const godet: Piece = {
    name: 'Skirt godet',
    outline,
    lines: [],
    grain: [p(0, Lg * 0.3), p(0, Lg * 0.85)],
    notches: [
      [edgeMid(-h), p(-Math.cos(h), -Math.sin(h))],
      [edgeMid(h), p(Math.cos(h), -Math.sin(h))],
    ],
    labels: [
      { at: p(-0.9, Lg * 0.6), text: 'SKIRT GODET', size: Math.min(1.2, Lg * Math.sin(h) * 0.5), rotate: 90 },
      { at: p(0.9, Lg * 0.6), text: `Cut ${count}`, size: 0.8, rotate: 90 },
    ],
    cut: `Cut ${count}`,
    seamAllowance: bf.seamAllowance,
    allowances: { hem: hemSa, godet: bf.seamAllowance },
    draft: {
      frame: [[p(0, 0), p(0, Lg)]],
      points: [
        { n: '0', at: p(0, 0), note: `The point. Square down ${cm(Lg)} for the centre line, on the straight grain, so both edges fall on the bias.` },
        {
          n: '1',
          at: onCircle(0, Lg, h),
          note: `Swing the edges out ${Math.round((h * 180) / Math.PI * 10) / 10} degrees either side of the centre line, each ${cm(Lg)} long, the length of the slash it is set into. The hem is an arc of radius ${cm(Lg)} from the point, ${cm(Lg * theta)} across, so it hangs level with the skirt's.`,
        },
      ],
    },
    meta: { godet: true, lengthCm: r1(Lg) },
  };
  // The hem grows by each godet's width (the slashes themselves take nothing away).
  const hemCm = Math.round(draft.hemCm + count * Lg * theta);
  return {
    ...draft,
    pieces: [f.pc, b.pc, godet],
    block: draft.pieces,
    hemCm,
    volume: { kind: 'godets', godets: { count, length: r1(Lg), hemWidth: r1(Lg * theta), from: r1(from), inSeams }, slashes: [f.slashes, b.slashes] },
  };
}

// ---- Hem flounce and tiers --------------------------------------------------------------------------

/** The skirt drafted again to a shorter length, its flare scaled down to match, and its hem made a seam. */
function shortened(s: SkirtStyle, draft: SkirtDraft, redraft: (st: SkirtStyle) => SkirtDraft, hipY: number, at: number, tag: string): SkirtDraft {
  const flare = draft.flareCm ?? 0;
  const k = (at - hipY) / Math.max(1, draft.lengthCm - hipY);
  const { pleats: _p, godets: _g, flounce: _f, hem: _h, shape: _s, ...rest } = s;
  const upper = redraft({ ...rest, lengthCm: at, flareCm: flare * k });
  return {
    ...upper,
    pieces: upper.pieces.map((pc) => {
      const { hem: _hem, ...allow } = pc.allowances;
      return { ...pc, outline: retagged(pc.outline, 'hem', tag), allowances: { ...allow, [tag]: pc.seamAllowance } };
    }),
  };
}

/** A ring cut from a circle: the inner edge sews to the skirt, the outer is the hem. */
function ringPiece(name: string, r: number, depth: number, angle: number, isFront: boolean, sa: number, hemSa: number): Piece {
  const R = r + depth;
  const onFold = isFront && R * Math.sin(Math.min(angle, Math.PI / 2)) + sa <= FOLD_WIDTH_MAX;
  const outline = new Path(p(0, 0));
  arc(outline, r, r, 0, angle, 'flounce');
  outline.line(onCircle(r, R, angle), 'side');
  arc(outline, r, R, angle, 0, 'hem');
  outline.line(p(0, 0), onFold ? 'fold' : 'centre');
  outline.closed = true;
  const cut = onFold ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const sideAt = (f: number) => onCircle(r, r + depth * f, angle);
  const out = p(Math.cos(angle), -Math.sin(angle));
  const along = p(Math.sin(angle), Math.cos(angle));
  const mid = onCircle(r, r, angle / 2);
  const toCentre = unit(sub(p(0, -r), mid));
  const notches: [P, P][] = [
    ...(isFront ? [[sideAt(0.5), out] as [P, P]] : [[sub(sideAt(0.5), mul(along, 0.5)), out] as [P, P], [add(sideAt(0.5), mul(along, 0.5)), out] as [P, P]]),
    [mid, toCentre],
  ];
  const lab = onCircle(r, r + depth * 0.45, angle / 2);
  const gx = Math.min(6, onCircle(r, r + depth * 0.5, angle / 2).x * 0.4);
  return {
    name,
    outline,
    lines: [],
    grain: [p(gx, depth * 0.2), p(gx, depth * 0.8)],
    fold: onFold ? [p(0, 1), p(0, depth - 1)] : undefined,
    notches,
    labels: [
      { at: lab, text: name.toUpperCase(), size: Math.min(1.4, depth / 10), rotate: (-(angle / 2) * 180) / Math.PI },
      { at: add(lab, mul(unit(sub(lab, p(0, -r))), 2)), text: cut, size: 0.8, rotate: (-(angle / 2) * 180) / Math.PI },
    ],
    cut,
    seamAllowance: sa,
    allowances: { hem: hemSa, fold: 0, flounce: sa },
    draft: {
      frame: [],
      points: [
        { n: '0', at: p(0, 0), note: `Centre ${isFront ? 'front' : 'back'} of the flounce. Its seam edge is an arc of radius ${cm(r)}, from a centre ${cm(r)} above this point: the skirt's hem divided by 2 pi, so the flounce is a full circle.` },
        { n: '1', at: p(0, depth), note: `0 to 1, the flounce's depth: ${cm(depth)}. The hem is an arc of radius ${cm(R)} from the same centre, so it hangs level.` },
        { n: '2', at: onCircle(r, r, angle), note: `Side: the seam edge runs ${Math.round((angle * 180) / Math.PI * 10) / 10} degrees round, ${cm(r * angle)}, exactly the skirt ${isFront ? 'front' : 'back'}'s lower edge. The side seam runs straight out along the radius.` },
      ],
    },
    meta: { waistRadius: r, flounce: true },
  };
}

function flounced(m: SkirtMeasurements, s: SkirtStyle, draft: SkirtDraft, redraft: (st: SkirtStyle) => SkirtDraft, kind: 'hem_flounce' | 'tiers'): SkirtDraft {
  const [bf] = draft.pieces;
  const hipY = hipOf(bf, m);
  const Lc = draft.lengthCm;
  const sa = bf.seamAllowance;
  if (kind === 'hem_flounce') {
    const depth = clamp(0.35 * (Lc - hipY), 15, 35);
    const at = Lc - depth;
    if (at < hipY + 10) return draft;
    const upper = shortened(s, draft, redraft, hipY, at, 'flounce');
    const [uf, ub] = upper.pieces;
    const Lf = taggedLength(uf.outline, 'flounce');
    const Lb = taggedLength(ub.outline, 'flounce');
    // A full circle: the inner edge, round the whole skirt, is 2 pi r.
    const r = (Lf + Lb) / Math.PI;
    const hemSa = 1;
    const ff = ringPiece('Flounce front', r, depth, Lf / r, true, sa, hemSa);
    const fb = ringPiece('Flounce back', r, depth, Lb / r, false, sa, hemSa);
    // A notch halfway along the skirt's lower edge, to meet the flounce's.
    const join = (pc: Piece): Piece => {
      const mid = alongTag(pc.outline, 'flounce', 0.5);
      return {
        ...pc,
        notches: mid ? [...pc.notches, [mid.at, p(0, 1)]] : pc.notches,
        draft: pc.draft && {
          frame: pc.draft.frame,
          points: [...pc.draft.points, { n: 'F', at: p(0, at), note: `Flounce seam: the skirt stops ${cm(depth)} above the hem, ${cm(at)} below the waist, its lower edge drawn level like a hem. The flounce sews on here.` }],
        },
      };
    };
    const hem = Math.round(2 * (taggedLength(ff.outline, 'hem') + taggedLength(fb.outline, 'hem')));
    return {
      ...upper,
      pieces: [join(uf), join(ub), ff, fb],
      lengthCm: draft.lengthCm,
      block: draft.pieces,
      hemCm: hem,
      flareCm: draft.flareCm,
      volume: { kind, flounce: { depth: r1(depth), joinAt: r1(at), hem } },
    };
  }

  // Tiers: a yoke to just below the hip and clear of the zip, then two or three gathered tiers.
  const zipEnd = draft.pieces[1].notches.find(([q, dir]) => Math.abs(q.x) < 1e-6 && dir.x < 0)?.[0].y ?? draft.zipCm;
  const yoke = Math.max(hipY + 5, zipEnd + 4);
  const T = Lc - yoke;
  const n = T >= 48 ? 3 : T >= 20 ? 2 : 0;
  if (!n) return draft;
  const upper = shortened(s, draft, redraft, hipY, yoke, 'tier');
  const named = upper.pieces.map((pc) => ({
    ...pc,
    name: `${pc.name} yoke`,
    labels: pc.labels.map((l) => (l.text === pc.name.toUpperCase() ? { ...l, text: `${pc.name} yoke`.toUpperCase() } : l)),
  }));
  const top = 2 * named.reduce((t, pc) => t + taggedLength(pc.outline, 'tier'), 0);
  // Each tier a little deeper than the one above, and gathered to a half (two tiers) or two-thirds (three).
  const ratio = n === 3 ? 1.5 : 1.8;
  const weights = n === 3 ? [1, 1.15, 1.3] : [1, 1.2];
  const wsum = weights.reduce((a, b) => a + b, 0);
  const hemSa = 2;
  let above = top;
  const bands: TierBand[] = weights.map((w, i) => {
    const depth = (T * w) / wsum;
    const round = above * ratio;
    // Panels in pairs, so a seam falls at each side; each narrow enough to cut from folded fabric.
    const perHalf = Math.ceil(round / 2 / (PANEL_MAX - 2 * sa));
    const band: TierBand = {
      name: `Tier ${i + 1}`,
      depth: r1(depth),
      round: r1(round),
      gatheredTo: r1(above),
      ratio,
      panels: 2 * perHalf,
      cutLength: r1(round / (2 * perHalf) + 2 * sa),
      cutWidth: r1(depth + sa + (i === n - 1 ? hemSa : sa)),
    };
    above = round;
    return band;
  });
  const joined = named.map((pc) => {
    const mid = alongTag(pc.outline, 'tier', 0.5);
    return {
      ...pc,
      notches: mid ? [...pc.notches, [mid.at, p(0, 1)] as [P, P]] : pc.notches,
      draft: pc.draft && {
        frame: pc.draft.frame,
        points: [...pc.draft.points, { n: 'T', at: p(0, yoke), note: `Yoke: the skirt stops ${cm(yoke)} below the waist, just below the hip and clear of the zip, its lower edge drawn level like a hem. The first tier is gathered onto it.` }],
      },
    };
  });
  return {
    ...upper,
    pieces: joined,
    lengthCm: draft.lengthCm,
    block: draft.pieces,
    hemCm: Math.round(above),
    flareCm: draft.flareCm,
    volume: { kind, tiers: { yoke: r1(yoke), bands } },
  };
}

/**
 * Pieces that are cut but not printed, for the cutting layout and the fabric needed: each tier's
 * panels as rectangles, and the godets beyond the one printed.
 */
export function layoutExtras(draft: SkirtDraft): Piece[] {
  const v = draft.volume;
  const out: Piece[] = [];
  for (const b of v?.tiers?.bands ?? []) {
    const w = b.round / b.panels;
    const h = b.depth;
    const sa = (b.cutLength - w) / 2;
    const outline = new Path(p(0, 0)).line(p(w, 0), 'tier').line(p(w, h), 'side').line(p(0, h), 'hem').line(p(0, 0), 'side');
    outline.closed = true;
    const per = b.panels / 2;
    for (let i = 0; i < per; i++)
      out.push({
        name: per > 1 ? `${b.name}, panel ${i + 1}` : b.name,
        kind: 'band',
        outline,
        lines: [],
        grain: [p(w / 2, h * 0.2), p(w / 2, h * 0.8)],
        notches: [],
        labels: [],
        cut: 'Cut 2 (1 pair)',
        seamAllowance: sa,
        allowances: { hem: b.cutWidth - h - sa },
        meta: {},
      });
  }
  const godet = draft.pieces.find((pc) => pc.meta.godet);
  if (godet && v?.godets) {
    for (let i = 0; i < (v.godets.count - 2) / 2; i++) out.push({ ...godet, cut: 'Cut 2 (1 pair)' });
    out.push(godet);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The sewing guide.

interface VolumeSewing {
  seam: string;
  waist: string;
  /** The hem depth, as drafted, for a straight hem. */
  hem: number;
}

const find = (steps: SewStep[], title: string) => steps.findIndex((s) => s.title === title);

/** The skirt's steps with the detail's own: cut and mark, then sewn in at the right moment. */
export function volumeSteps(steps: SewStep[], draft: SkirtDraft, sw: VolumeSewing, garment: 'skirt' | 'dress' = 'skirt'): SewStep[] {
  const v = draft.volume;
  if (!v) return steps;
  const out = [...steps];
  const replace = (title: string, text: string) => {
    const i = find(out, title);
    if (i >= 0) out[i] = { ...out[i], text };
  };
  const append = (title: string, text: string) => {
    const i = find(out, title);
    if (i >= 0) out[i] = { ...out[i], text: `${out[i].text} ${text}` };
  };
  // Before the first of the named steps there is.
  const insert = (before: string[], add: SewStep[]) => {
    const at = before.map((t) => find(out, t)).filter((k) => k >= 0);
    out.splice(at.length ? Math.min(...at) : out.length, 0, ...add);
  };
  const remove = (title: string) => {
    const i = find(out, title);
    if (i >= 0) out.splice(i, 1);
    return i;
  };
  const hemDepth = draft.pieces[0].allowances.hem ?? sw.hem;
  const thing = garment === 'dress' ? 'dress' : 'skirt';

  if (v.kind === 'knife' || v.kind === 'box') {
    const pl = v.pleats!;
    if (pl.split) append('Cut out', 'Cut a pair each of the skirt side front and side back too.');
    insert(garment === 'dress' ? ['Neaten the edges'] : ['Interface the waistband', 'Neaten the edges'], [
      {
        title: 'Mark the pleats',
        text: `Before you lift the pattern, mark every pleat: snip the notches at the top and bottom of each solid fold line and each dashed placement line, then chalk or thread-trace the lines on the right side, with the stitching lines above the hip. There are ${pl.count} pleats round the ${thing}.`,
      },
    ]);
    if (pl.split)
      insert(['Sew the side seams', 'Join the bodice to the skirt'], [
        {
          title: 'Join the side panels',
          text: `Sew each skirt side front to the skirt front, and each side back to its back, along the panel seams, right sides together, matching the notches. Sew ${sw.seam} from the edge and press the seams open: they fall at the inside fold of a pleat, where they never show.`,
        },
      ]);
    const knife = v.kind === 'knife';
    const hemText = `Hem before you pleat: the hem has to turn up flat across every fold. At each seam that falls inside a pleat, clip the seam allowance just above the hem and press it open below the clip. Press up 1 cm, then ${hemDepth - 1} cm more, and stitch by hand or machine.`;
    const pleatSteps: SewStep[] = [
      { title: 'Hem the skirt', text: hemText },
      {
        title: 'Fold and press the pleats',
        text: knife
          ? 'Work from the right side on the ironing board. At each pleat, fold along the solid line and bring the fold over to its dashed line, the way the arrow points: every fold faces the back, the front pleats turning away from a plain panel at the centre front, the back pleats toward the zip. Pin at the waist and hem, and baste down each fold through all the layers. Press through a damp press cloth from the waist to the hem, and let each section cool before you move it: that is what sets the crease.'
          : 'Work from the right side on the ironing board. At each pleat, fold along both solid lines and bring the two folds to meet over the dashed line between them, as the arrows show, so the faces stand out as boxes. Pin at the waist and hem, and baste down each fold through all the layers. Press through a damp press cloth from the waist to the hem, and let each section cool before you move it: that is what sets the crease.',
      },
      {
        title: 'Stitch the pleats down',
        text: `From the right side, edge-stitch each fold 2 mm from its edge, along the stitching line from the waist down to the hip line. The line is angled a little at the top: it takes in the waist shaping that darts would. Pull the threads through to the inside at the hip and knot them. Baste across the waist ${sw.waist} from the edge to hold every pleat. For pleats that stay sharp through washing, edge-stitch the inside fold of each pleat from the hem up to the hip too.`,
      },
    ];
    const i = remove('Hem');
    if (garment === 'dress') {
      insert(['Join the bodice to the skirt'], pleatSteps.map((s) => (s.title === 'Hem the skirt' ? { ...s, text: `${hemText.replace('Hem before you pleat', 'Hem the skirt pieces now, before you pleat them')} The side seams are sewn through the hem later, inside the side pleats.` } : s)));
      insert(['Finish'], [
        {
          title: 'Finish the side pleats',
          text: 'Now the side seams are sewn, fold and press the pleat at each side the same way, the seam at its inside fold, and edge-stitch it down to the hip. Clip the seam allowance just above the hem and press it open below.',
        },
      ]);
    } else if (i >= 0) insert(['Make the lining', 'Attach the waistband'], pleatSteps);
  } else if (v.kind === 'inverted') {
    const inv = v.inverted!;
    insert(['Put in the zip', 'Sew the skirt centre front', 'Join the bodice to the skirt'], [
      {
        title: 'Make the front pleat',
        text: `${inv.frontSeam ? `Sew the two front pieces together along the outer edges of the extension, ${sw.seam} from the edge, and press the seam open; it sits at the back of the pleat. ` : ''}Fold the skirt front right sides together down the middle, so the two solid fold lines lie on top of each other. Stitch along them from the waist down to the hip line, ${garment === 'dress' ? '' : `${sw.waist} `}backstitching at the hip. Open the front out and press the extension flat behind the stitching, its folded centre edge under the seam: the two folds meet at the centre front. Baste across the top. The pleat is ${cm(inv.depth)} deep each side.`,
      },
    ]);
    if (inv.backFrom !== undefined)
      replace(
        'Close the centre back',
        `Sew the rest of the centre back seam, from the bottom of the zip to the top of the pleat extension, pivot at the notch, and carry on along the slope and down the outer edges of the extension to the hem, ${sw.seam} from the edge. Press the seam open above the pleat. Then fold each half along its solid fold line so the folds meet at the centre back, and press the extension flat behind them, its seam centred. Topstitch across the top of the pleat through all the layers to hold it.`,
      );
    append('Hem', 'Turn the hem up across the pleats with them pressed closed. At the seam inside the back pleat, clip the allowance just above the hem and press it open below.');
  } else if (v.kind === 'godets') {
    const g = v.godets!;
    append('Cut out', `Cut ${g.count} godets, each with its centre line on the grain. Mark the point of each slash through the drill hole with a tailor's tack, but do not cut the slashes yet.`);
    insert(['Sew the side seams'], [
      {
        title: 'Set in the godets',
        text: `${g.inSeams ? 'For the godets in the slashes: ' : ''}staystitch a narrow V along each slash line, 0.6 cm either side of it at the hem, coming to nothing at the dot, with short stitches near the point. Cut down the line to the dot. Pin a godet into the slash, right sides together, its point at the dot and its notches at the cross mark. With the skirt on top, sew along the staystitching from the hem to the dot, leave the needle down, pivot, and sew the second side. Press the seams toward the skirt.`,
      },
    ]);
    if (g.inSeams) {
      replace(
        'Sew the side seams',
        `Pin the front to the back at the sides, right sides together, ${garment === 'dress' ? 'from the underarm, matching the waist seams and the hip notches' : 'matching the hip notches'}. Sew ${sw.seam} from the edge from the ${garment === 'dress' ? 'underarm' : 'waist'} down to the godet notch only, and backstitch. Pin a godet's edges to the front and back below the notch, its point at the end of the seam and its notches matching, and sew each side from the notch to the hem. Press the side seams open above the godet and toward the skirt beside it.`,
      );
    }
    replace(
      'Hem',
      `Hang the ${thing} up for a day before hemming: the godets' edges are on the bias and drop a little. Try it on, have someone mark an even hem with pins measured up from the floor, and trim to the marks. Press up 0.5 cm, then ${hemDepth - 0.5} cm more, easing the curve of each godet with steam, and stitch.`,
    );
  } else if (v.kind === 'hem_flounce') {
    append('Cut out', 'Cut the flounce front and flounce back the same way, keeping their grain lines on the straight grain at the centre.');
    insert(['Hem'], [
      {
        title: 'Make the flounce',
        text: `Sew the flounce front to the flounce back at the side seams and the centre back, right sides together, ${sw.seam} from the edge, and press the seams open. Staystitch the inner edge 1 cm in, then clip into the allowance every 2 cm, up to the stitching, so the curve can straighten out.`,
      },
      {
        title: 'Sew on the flounce',
        text: `Pin the flounce to the ${thing}'s lower edge, right sides together, matching the side seams, the centre back seam and the notches. The two edges are exactly the same length, so nothing is eased. Sew ${sw.seam} from the edge, press the seam up toward the ${thing}, and zigzag or overlock the edges together.`,
      },
    ]);
    replace(
      'Hem',
      `Hang the ${thing} up for a day before hemming: the flounce is cut on the round and drops where it falls on the bias. Try it on, mark an even hem with pins measured up from the floor and trim to the marks. Press up 0.5 cm, then 0.5 cm more, and stitch close to the fold, or finish with a rolled hem on the overlocker.`,
    );
  } else if (v.kind === 'tiers') {
    const bands = v.tiers!.bands;
    insert(['Interface the waistband', 'Neaten the edges'], [
      {
        title: 'Cut the tiers',
        text: `The tiers are plain rectangles, so they are given as measurements: chalk them straight onto the fabric, the short edges on the straight grain. ${bands
          .map((b) => `${b.name}: cut ${b.panels}, each ${b.cutLength} x ${b.cutWidth} cm.`)
          .join(' ')} Seam allowance ${sw.seam} is included on every edge, and 2 cm for the hem on the bottom tier.`,
      },
    ]);
    insert(['Hem'], [
      {
        title: 'Make the tiers',
        text: `Sew the panels of each tier into a ring, right sides together along the short edges, ${sw.seam} from the edge, and press the seams open. Mark each ring into quarters with pins, starting from a seam.`,
      },
      {
        title: 'Gather the tiers',
        text: `Sew two rows of long machine stitches along the top edge of each tier, 0.5 cm and 1.2 cm from the edge, stopping and starting again at each quarter. ${bands
          .map((b, i) => `${b.name} gathers from ${cm(b.round)} to ${cm(b.gatheredTo)}, onto the ${i === 0 ? `${thing}'s lower edge` : `tier above`}.`)
          .join(' ')} Pin a tier to the edge above, right sides together, matching the quarter pins to the side seams, the centre front and the centre back. Pull up the bobbin threads until it fits and spread the gathers evenly.`,
      },
      {
        title: 'Sew on the tiers',
        text: `Sew each tier on with the gathers on top, ${sw.seam} from the edge, between the two rows of gathering, starting with the first tier on the ${thing}. Pull out the gathering threads that show, zigzag or overlock the edges together and press the seam up toward the top.`,
      },
    ]);
    replace(
      'Hem',
      `Press up 0.5 cm on the bottom tier, then 1.5 cm more, and stitch close to the fold. A straight hem on a straight edge: no easing needed.`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Fabric advice.

const pick = (name: string, weight: FabricPick['weight'], drape: FabricPick['drape'], why: string): FabricPick => ({ name, weight, drape, why });

const VOLUME_FABRICS: Record<Exclude<VolumeKind, 'none'>, { picks: FabricPick[]; avoid: string; note?: string }> = {
  knife: {
    picks: [
      pick('Wool suiting or worsted flannel', ['medium'], 'crisp', 'Takes a sharp crease with steam and keeps it.'),
      pick('Polyester or poly-wool suiting', ['medium'], 'crisp', 'Can be heat-set, so the pleats survive the wash.'),
      pick('Cotton gabardine or twill', ['medium'], 'crisp', 'Presses crisply. Re-press the pleats after washing.'),
    ],
    avoid: 'Soft or fluid fabrics like viscose, jersey or chiffon, and springy ones that will not crease. The pleats fall out of them.',
    note: 'Pleats take about twice the fabric round the hip. Test a crease on a scrap before you buy.',
  },
  box: {
    picks: [
      pick('Wool suiting or worsted flannel', ['medium'], 'crisp', 'Holds the boxes square and the creases sharp.'),
      pick('Polyester or poly-wool suiting', ['medium'], 'crisp', 'Can be heat-set, so the pleats survive the wash.'),
      pick('Cotton twill or denim', ['medium'], 'crisp', 'Gives a sturdy, sporty box pleat.'),
    ],
    avoid: 'Soft or fluid fabrics like viscose, jersey or chiffon. They will not hold a crease, and the boxes collapse.',
    note: 'Box pleats take more than twice the fabric round the hip. Test a crease on a scrap before you buy.',
  },
  inverted: {
    picks: [
      pick('Wool crepe or suiting', ['medium'], 'crisp', 'Presses a clean, sharp fold at the pleats.'),
      pick('Cotton sateen or twill', ['medium'], 'crisp', 'Holds the pleats closed until you move.'),
      pick('Linen or linen blend', ['medium'], 'crisp', 'Creases well. Press the pleats again after washing.'),
    ],
    avoid: 'Very fluid fabrics like charmeuse or chiffon. The pleats will not stay pressed and hang open.',
  },
  godets: {
    picks: [
      pick('Wool crepe', ['medium'], 'soft', 'Fitted above, then swings out at the godets.'),
      pick('Viscose or rayon crepe', ['light', 'medium'], 'fluid', 'The godets flute into soft folds.'),
      pick('Crepe-back satin', ['medium'], 'fluid', 'Dressy, and the bias edges fall smoothly.'),
    ],
    avoid: 'Stiff fabrics like denim or canvas. The godets stand out in points instead of falling in folds.',
    note: 'The godet edges are on the bias, so hang the skirt for a day before hemming.',
  },
  hem_flounce: {
    picks: [
      pick('Viscose crepe or challis', ['light', 'medium'], 'fluid', 'The flounce ripples softly as you walk.'),
      pick('Silk crepe de chine', ['light'], 'fluid', 'Light enough for a deep, moving flounce.'),
      pick('Cotton lawn or poplin', ['light'], 'crisp', 'Gives a fresher, fuller flounce.'),
    ],
    avoid: 'Heavy or stiff fabrics like denim, canvas or tweed. A circular flounce in them stands out stiffly and weighs the skirt down.',
  },
  tiers: {
    picks: [
      pick('Cotton lawn or voile', ['light'], 'crisp', 'Gathers up finely without bulk.'),
      pick('Viscose challis', ['light'], 'fluid', 'Soft gathers that swing.'),
      pick('Cotton double gauze', ['light'], 'soft', 'Airy and comfortable for a summer skirt.'),
    ],
    avoid: 'Medium and heavy fabrics. The gathered seams get bulky and the tiers weigh the skirt down.',
    note: 'The bottom tier takes the most fabric: it is over twice the yoke round.',
  },
};

/** The fabric advice for a skirt with a detail: the detail's needs come first. */
export function volumeFabrics(s: VolumeStyle, base: FabricAdvice, stretch: string): FabricAdvice {
  const k = volumeOf(s);
  if (k === 'none') return base;
  const f = VOLUME_FABRICS[k];
  return { ...base, style: `${base.style} ${volumeWords(s)}`, picks: f.picks, avoid: `${f.avoid} ${stretch}`, note: f.note ?? base.note };
}

/** What to watch for with the maker's fabric in a skirt with a detail. */
export function volumeWarnings(s: VolumeStyle, f: MyFabric): string[] {
  const k = volumeOf(s);
  const out: string[] = [];
  if ((k === 'knife' || k === 'box' || k === 'inverted') && f.drape === 'fluid') out.push('A fluid fabric will not hold a pressed crease, so the pleats soften and fall open. Choose a crisp wool or polyester suiting.');
  if (k === 'tiers' && f.weight === 'heavy') out.push('A heavy fabric makes bulky gathered seams and weighs the tiers down. Choose a light fabric.');
  if ((k === 'hem_flounce' || k === 'godets') && f.drape === 'crisp' && f.weight === 'heavy') out.push('A heavy, crisp fabric makes the extra fullness stand out stiffly. A softer one falls in folds.');
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The finished measurements.

export function volumeSpec(d: SkirtDraft): { label: string; finished: number | string }[] {
  const v = d.volume;
  if (!v) return [];
  if (v.pleats)
    return [
      { label: `${v.kind === 'knife' ? 'Knife' : 'Box'} pleats round the skirt`, finished: `${v.pleats.count}` },
      { label: 'Pleat face at the hip / depth', finished: `${v.pleats.face} / ${v.pleats.depth}` },
      { label: 'Hem with the pleats opened out', finished: v.pleats.openHem },
    ];
  if (v.inverted) return [{ label: 'Inverted pleat depth', finished: v.inverted.depth }, ...(v.inverted.backFrom !== undefined ? [{ label: 'Back pleat opens, below the waist', finished: v.inverted.backFrom }] : [])];
  if (v.godets)
    return [
      { label: 'Godets', finished: `${v.godets.count}${v.godets.inSeams ? ', two in the side seams' : ''}` },
      { label: 'Godet length / width at the hem', finished: `${v.godets.length} / ${v.godets.hemWidth}` },
    ];
  if (v.flounce)
    return [
      { label: 'Flounce seam, below the waist', finished: v.flounce.joinAt },
      { label: 'Flounce depth', finished: v.flounce.depth },
    ];
  if (v.tiers)
    return [
      { label: 'Yoke, waist to first tier', finished: v.tiers.yoke },
      ...v.tiers.bands.map((b) => ({ label: `${b.name}: depth, round (gathered ${b.ratio} to 1)`, finished: `${b.depth}, ${b.round}` })),
    ];
  return [];
}
