// Jackets and coats, drafted on the bodice block. The block is drafted with outerwear ease (it goes on
// over a blouse or a jumper), a slightly wider, lower neck, and to the hip; longer lengths carry the
// side and panel seams on down, flaring a little so a coat walks. The front then gets its opening: an
// extension for single or double-breasted buttons, and a notched lapel with its collar, a stand
// collar or a plain collarless edge. Facings, a full lining and patch pockets are cut from the
// pieces as drafted, and the sleeve is drafted to the armhole with jacket or coat ease.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceFitting, BodiceMeasurements, BodiceStyle, blockOf, draftBodice } from './bodice';
import { Ring, pathOf, ringOf } from './manipulate';
import { backOnFold, collarPieces } from './collar';
import { SleeveDraft, SleeveMeasurements, draftSleeve } from './sleeve';
import { DraftError } from './skirt';

export type OuterKind = 'jacket' | 'coat';
export type OuterFit = 'fitted' | 'regular' | 'relaxed';
export type OuterLength = 'cropped' | 'hip' | 'long' | 'thigh' | 'knee' | 'midi';
export type OuterShaping = 'darts' | 'princess' | 'boxy';
/** Buttons in one or two rows, or a separating zip up the centre front with no overlap. */
export type OuterFront = 'single' | 'double' | 'zip';
/** A notched lapel, a stand collar, no collar, or a hood in two pieces sewn to the neck. */
export type OuterCollar = 'notched' | 'stand' | 'collarless' | 'hood';
export type OuterPockets = 'none' | 'patch' | 'welt';
/** 'tailored' is the two-piece sleeve, top and under sleeve; 'fitted' the one-piece with an elbow dart;
 *  'raglan' runs up to the neck, the shoulders cut off the body and on to the sleeve. */
export type OuterSleeve = 'tailored' | 'fitted' | 'straight' | 'raglan';
/** Rib knit bands at the hem and the cuffs (a bomber, a fleece), or plain hems. */
export type OuterTrim = 'none' | 'rib';
export type OuterPads = 'none' | 'soft' | 'structured';
export type OuterVent = 'none' | 'centre';
export type OuterFlare = 'straight' | 'a_line';

export type OuterMeasurements = BodiceMeasurements & SleeveMeasurements & { waist_to_knee?: number; waist_to_floor?: number };

export interface OuterStyle {
  kind: OuterKind;
  fit: OuterFit;
  length: OuterLength;
  shaping: OuterShaping;
  front: OuterFront;
  collar: OuterCollar;
  pockets: OuterPockets;
  sleeve: OuterSleeve;
  /** Below the hip: straight, or flaring out to the hem. */
  flare: OuterFlare;
  /** Shoulder pads, drafted in: the shoulders raised by the pad and the sleeve crown with them. */
  pads: OuterPads;
  /** A vent at the centre back hem. Not on a cropped jacket. */
  vent: OuterVent;
  /** Rib bands at the hem and cuffs. Older choices have none. */
  trim?: OuterTrim;
  /** Drawn on the form: the vent's length up from the hem, in cm, in place of the length's own. */
  ventCm?: number;
  /** Drawn on the form: where the pockets go, their centre across from the centre front and their top
   * edge, in the front's own coordinates (cm, y down from the neck). Kept clear of the buttons and seams. */
  pocketAt?: P;
  /** Drawn on the form: a cutaway front, the hem curving up from the hem to the front edge over this many cm. */
  cutawayCm?: number;
  seamAllowance: number;
  hemAllowance: number;
  fitting?: BodiceFitting;
}

/** The lengths each garment offers. */
export const OUTER_LENGTHS: Record<OuterKind, OuterLength[]> = { jacket: ['cropped', 'hip', 'long'], coat: ['thigh', 'knee', 'midi'] };

/** Ease at the bust, in cm. A jacket goes on over a blouse, a coat over a jacket or a jumper. */
export const OUTER_EASE: Record<OuterKind, Record<OuterFit, number>> = {
  jacket: { fitted: 10, regular: 13, relaxed: 17 },
  coat: { fitted: 13, regular: 17, relaxed: 21 },
};

/** The neckline sits a little wider and lower than a blouse's, over the clothes beneath. */
const OUTER_NECK = { frontDepth: 2, width: 1, backDepth: 0.5, fullness: 0.45 };

/** The extension beyond the centre front, and the button size, in cm. */
export const OUTER_EXTENSION: Record<OuterKind, Record<OuterFront, number>> = { jacket: { single: 2, double: 6.5, zip: 0 }, coat: { single: 2.5, double: 8, zip: 0 } };
/** The rib bands, finished depth in cm, and how much shorter than the edge they are cut, so they pull in. */
export const RIB = { hem: 6, cuff: 5, draw: 0.85 };
/** The hood: from the neck to the top and from the face edge to the centre back, in cm, before it is sized to the neck. */
const HOOD = { jacket: { height: 34, depth: 26 }, coat: { height: 36, depth: 27.5 } };
export const OUTER_BUTTON: Record<OuterKind, number> = { jacket: 2, coat: 2.5 };

/** How thick each pad is at the shoulder point, in cm. */
export const PAD_CM: Record<OuterKind, Record<OuterPads, number>> = { jacket: { none: 0, soft: 0.6, structured: 1.2 }, coat: { none: 0, soft: 0.8, structured: 1.5 } };
/** How far the vent's underlap reaches past the centre back, in cm. */
export const VENT_WIDTH: Record<OuterKind, number> = { jacket: 4, coat: 5 };

/** Flare added to each seam at the hem, per 40 cm below the hip. */
export const FLARE_PER_40: Record<OuterFlare, number> = { straight: 1.2, a_line: 4 };

export const DEFAULT_OUTER: Record<OuterKind, OuterStyle> = {
  jacket: { kind: 'jacket', fit: 'regular', length: 'hip', shaping: 'darts', front: 'single', collar: 'notched', pockets: 'patch', sleeve: 'tailored', flare: 'straight', pads: 'soft', vent: 'centre', seamAllowance: 1.5, hemAllowance: 4 },
  coat: { kind: 'coat', fit: 'regular', length: 'knee', shaping: 'princess', front: 'single', collar: 'notched', pockets: 'welt', sleeve: 'tailored', flare: 'straight', pads: 'soft', vent: 'centre', seamAllowance: 1.5, hemAllowance: 5 },
};

/** The lapel as worn, for the flat: the break point, the roll line and the lapel and collar outlines. */
export interface Lapel {
  breakPt: P;
  roll: [P, P];
  /** The lapel folded back over the front, from the break point round to the gorge. */
  worn: P[];
  /** The collar's points on the front, as worn: the notch end of the gorge and the collar point. */
  notch: P;
  collarPoint: P;
  neckPoint: P;
  gorge: P;
}

export interface OuterDraft {
  kind: OuterKind;
  /** The bodice block it was drafted on: the sleeve is drafted to its armhole. */
  base: BodiceDraft;
  sleeve: SleeveDraft;
  /** Every piece, in print order: the shell, the collar, the facings and pockets, then the lining. */
  pieces: Piece[];
  /** The front and back as sewn, closed at the centre front and down to the hem: for the flat and the ease map. */
  block: [Piece, Piece];
  ext: number;
  buttons: { at: number[]; sizeCm: number; columns: number[] };
  /** Buttoned left over right, as menswear is; right over left when missing. */
  lapsLeft?: boolean;
  lapel?: Lapel;
  /** Where the pockets sit on the front, as drafted: a patch pocket's outline, or a welt's opening. */
  pocket?: { x: number; y: number; w: number; h: number; kind: 'patch' | 'welt' };
  /** The pad thickness drafted into the shoulders, in cm (0 for none). */
  pads: number;
  /** The centre back vent: where it starts below the neck and how far the underlap reaches. */
  vent?: { top: number; width: number; length: number };
  /** Rib bands at the hem and the cuffs, their finished depths. */
  rib?: { hem: number; cuff: number };
  /** A hood, its height from the neck and its depth from the face edge to the centre back. */
  hood?: { height: number; depth: number };
  /** A cutaway front: how far up the front edge the hem curves away, and how far in along the hem from the front edge, in cm. */
  cutaway?: { up: number; along: number };
  finishedBust: number;
  finishedWaist: number;
  finishedHem: number;
  /** How far the hem sits below the waist, and the centre back from the neck to the hem. */
  drop: number;
  lengthCm: number;
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** Where a piece's outline crosses the level y: its leftmost and rightmost x. */
function spanAt(pc: Piece, y: number): [number, number] {
  const pts = pc.outline.points(8);
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a.y - y) * (b.y - y) <= 0 && Math.abs(b.y - a.y) > 1e-9) xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 0];
}

/** How far below the waist the hem sits for each length. */
export function outerDrop(m: OuterMeasurements, length: OuterLength): number {
  const WH = m.waist_to_hip ?? 20;
  const knee = m.waist_to_knee ?? WH + 38;
  const floor = m.waist_to_floor ?? knee + 45;
  switch (length) {
    case 'cropped':
      return WH / 2;
    case 'hip':
      return WH;
    case 'long':
      return WH + 10;
    case 'thigh':
      return WH + 0.5 * (knee - WH);
    case 'knee':
      return knee + 3;
    default:
      return knee + 0.45 * (floor - knee);
  }
}

/** Indices of the first run of edges tagged `tag`: [first edge, last edge]. */
function runOf(r: Ring, tag: string): [number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    return [i, j];
  }
  return undefined;
}

/**
 * The piece carried on below its hem by `extra` cm: the centre line and fold straight down, the side
 * and panel seams out by `flare` at the new hem, so the seams either side flare alike.
 */
export function extendPiece(pc: Piece, extra: number, flare: number): Piece {
  if (extra <= 0.05) return pc;
  const r = ringOf(pc.outline, 12);
  const hem = runOf(r, 'hem');
  if (!hem) return pc;
  const n = r.pts.length;
  const [i, j] = hem;
  const a = r.pts[i];
  const b = r.pts[(j + 1) % n];
  const before = r.tags[(i - 1 + n) % n];
  const after = r.tags[(j + 1) % n];
  const straight = (t: string) => t === 'fold' || t === 'centre' || t === 'opening';
  const out = (q: P, other: P, t: string) => add(q, p(straight(t) ? 0 : Math.sign(q.x - other.x) * flare, extra));
  let a2 = out(a, b, before);
  let b2 = out(b, a, after);
  // A flared seam meets the hem square, the hem curving up a little toward it over its last few centimetres.
  const square = (c2: P, c: P, other: P): { end: P; run: P[] } => {
    if (Math.abs(c2.x - c.x) < 1e-6) return { end: c2, run: [] };
    const sd = unit(sub(c2, c));
    const h = unit(sub(other, c2));
    const reach = 3.5; // the same on every piece, however narrow, so the seams either side match
    // Taken up the seam by the same amount on every piece, so the seams either side stay the same length.
    const end = sub(c2, mul(sd, (reach / 2) * Math.abs(sd.x)));
    let perp = p(-sd.y, sd.x);
    if (perp.x * h.x + perp.y * h.y < 0) perp = mul(perp, -1);
    const k = add(end, mul(perp, reach / 2));
    const to = add(c2, mul(h, reach));
    return { end, run: Array.from({ length: 8 }, (_, t) => quad(end, k, to, (t + 1) / 8)) };
  };
  const sa = square(a2, a, b2);
  const sb = square(b2, b, a2);
  a2 = sa.end;
  b2 = sb.end;
  const hemRun = [...sa.run, ...[...sb.run].reverse()];
  // A straight centre edge carries on down in one line: its old corner goes.
  const dropA = straight(before);
  const dropB = straight(after);
  const bi = (j + 1) % n;
  const pts: P[] = [];
  const tags: string[] = [];
  for (let k = 0; k < n; k++) {
    if (k > i && k <= j) continue;
    if (k === bi) continue;
    if (k === i) {
      if (!dropA) {
        pts.push(a);
        tags.push(before);
      }
      pts.push(a2, ...hemRun, b2);
      tags.push(...hemRun.map(() => 'hem'), 'hem', after);
      if (!dropB) {
        pts.push(b);
        tags.push(after);
      }
    } else {
      pts.push(r.pts[k]);
      tags.push(r.tags[k]);
    }
  }
  const moved = (q: P) => (q.y >= Math.min(a.y, b.y) - 0.5 ? add(q, p(0, extra)) : q);
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    fold: pc.fold ? [pc.fold[0], add(pc.fold[1], p(0, extra))] : undefined,
    grain: pc.grain ? [pc.grain[0], add(pc.grain[1], p(0, extra))] : undefined,
    labels: pc.labels.map((l) => ({ ...l, at: moved(l.at) })),
  };
}

/** The part of a ring on one side of the line x = g(y), the cut edge tagged `tag` and following the line. */
export function clipRing(r: Ring, g: (y: number) => number, keepLeft: boolean, tag: string, boundary: P[]): Ring {
  const inside = (q: P) => (keepLeft ? q.x <= g(q.y) + 1e-9 : q.x >= g(q.y) - 1e-9);
  const n = r.pts.length;
  const first = r.pts.findIndex(inside);
  if (first < 0) return { pts: [], tags: [] };
  const cross = (a: P, b: P) => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (inside(lerp(a, b, m)) === inside(a)) lo = m;
      else hi = m;
    }
    return lerp(a, b, (lo + hi) / 2);
  };
  const pts: P[] = [];
  const tags: string[] = [];
  let exit: P | undefined;
  for (let s = 0; s < n; s++) {
    const k = (first + s) % n;
    const a = r.pts[k];
    const b = r.pts[(k + 1) % n];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) {
      pts.push(a);
      tags.push(r.tags[k]);
    }
    if (ia && !ib) {
      exit = cross(a, b);
      pts.push(exit);
      tags.push(tag);
    } else if (!ia && ib) {
      const entry = cross(a, b);
      if (exit) {
        const [y0, y1] = [exit.y, entry.y];
        const between = boundary.filter((q) => (q.y - y0) * (q.y - y1) < 0 && Math.abs(q.y - y0) > 0.05 && Math.abs(q.y - y1) > 0.05);
        between.sort((u, v) => (y1 > y0 ? u.y - v.y : v.y - u.y));
        for (const q of between) {
          pts.push(q);
          tags.push(tag);
        }
      }
      pts.push(entry);
      tags.push(r.tags[k]);
    }
  }
  return { pts, tags };
}

const quad = (a: P, c: P, b: P, k: number) => add(add(mul(a, (1 - k) ** 2), mul(c, 2 * k * (1 - k))), mul(b, k * k));
const cubic = (a: P, c1: P, c2: P, b: P, k: number) =>
  add(add(mul(a, (1 - k) ** 3), mul(c1, 3 * k * (1 - k) ** 2)), add(mul(c2, 3 * k * k * (1 - k)), mul(b, k ** 3)));

/** The line the facing and the lining meet along: from the shoulder, curving down to `x` from the centre front, then straight to the hem. */
function facingLine(s4: P, x: number, join: number, bottom: number): { g: (y: number) => number; pts: P[] } {
  const c = p(x, s4.y + (join - s4.y) * 0.25);
  const curve = Array.from({ length: 25 }, (_, i) => quad(s4, c, p(x, join), i / 24));
  const pts = [...curve];
  for (let y = Math.ceil(join); y < bottom + 5; y += 1) pts.push(p(x, y));
  const g = (y: number) => {
    if (y <= s4.y) return s4.x + (s4.y - y) * 5;
    if (y >= join) return x;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      if ((y - a.y) * (y - b.y) <= 0 && Math.abs(b.y - a.y) > 1e-9) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    }
    return x;
  };
  return { g, pts };
}

/** A piece cut from another: the same markings that fall inside it. */
function cutFrom(pc: Piece, r: Ring, name: string, over: Partial<Piece>): Piece {
  const xs = r.pts.map((q) => q.x);
  const ys = r.pts.map((q) => q.y);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const within = (q: P) => q.x >= box[0] - 0.01 && q.x <= box[2] + 0.01 && q.y >= box[1] - 0.01 && q.y <= box[3] + 0.01;
  const mid = p((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
  const cut = over.cut ?? pc.cut;
  return {
    ...pc,
    name,
    outline: pathOf(r),
    lines: [],
    notches: pc.notches.filter(([q]) => within(q)),
    balance: undefined,
    draft: undefined,
    fold: undefined,
    alternate: undefined,
    grain: [p(mid.x, mid.y - 8), p(mid.x, mid.y + 8)],
    labels: [
      { at: add(mid, p(0, -2)), text: name.toUpperCase(), size: 0.9, rotate: box[2] - box[0] < 12 ? 90 : 0 },
      { at: add(mid, p(box[2] - box[0] < 12 ? -1.2 : 0, box[2] - box[0] < 12 ? -2 : -0.6)), text: cut, size: 0.55, rotate: box[2] - box[0] < 12 ? 90 : 0 },
    ],
    cut,
    meta: {},
    ...over,
  };
}

interface FrontOpening {
  piece: Piece;
  lapel?: Lapel;
  /** The front facing's inner edge; no points when the facing is the whole centre panel of a princess front. */
  facing: { g: (y: number) => number; pts: P[] };
  /** The front neck seam's length, centre front (or the gorge) to the neck point. */
  frontNeck: number;
}

/** The cutaway's reach up the front edge, in cm: as drawn, kept 3 cm below the last button and 4 cm
 * clear of the side of the front. None when not drawn. */
export function cutawayOf(s: Pick<OuterStyle, 'cutawayCm'>, foot: number, buttons: OuterDraft['buttons']): number | undefined {
  if (!s.cutawayCm || s.cutawayCm < 2) return undefined;
  const last = Math.max(...buttons.at);
  const r = Math.min(s.cutawayCm, foot - last - 3 - OUTER_BUTTON.coat / 2);
  return r >= 2 ? r1(r) : undefined;
}

/**
 * The front's corner at the hem and the front edge cut away in a curve: from `r` cm in along the hem
 * (from the front edge) to `r` cm up the front edge, the way a morning coat's front curves back. The
 * curve leaves the hem and the front edge along their own lines, so both stay smooth.
 */
export function cutAway(ring: Ring, ext: number, foot: number, r: number): Ring & { along: number } {
  const n = ring.pts.length;
  const corner = ring.pts.findIndex((q) => Math.abs(q.x + ext) < 1e-6 && Math.abs(q.y - foot) < 1e-6);
  if (corner < 0) return { ...ring, along: 0 };
  // The hem's far end from the front edge: where it meets the side or princess seam. The curve leaves
  // the hem well short of it, so that seam keeps its length.
  let e = corner;
  while (Math.abs(ring.pts[(e - 1 + n) % n].y - foot) < 0.6 && e !== (corner + 1) % n) e = (e - 1 + n) % n;
  const from = p(Math.min(-ext + Math.min(r * 1.4, ext + 14), ring.pts[e].x - 3), foot);
  const to = p(-ext, foot - r);
  // Back along the hem from the corner, past the points the curve takes off; on up the front edge likewise.
  let a = corner;
  while (Math.abs(ring.pts[(a - 1 + n) % n].y - foot) < 0.6 && ring.pts[(a - 1 + n) % n].x < from.x) a = (a - 1 + n) % n;
  let b = corner;
  while (Math.abs(ring.pts[(b + 1) % n].x + ext) < 1e-6 && ring.pts[(b + 1) % n].y > to.y) b = (b + 1) % n;
  const before = (a - 1 + n) % n;
  const curve = Array.from({ length: 15 }, (_, i) => quad(from, p(-ext, foot), to, (i + 1) / 16));
  const pts: P[] = [];
  const tags: string[] = [];
  for (let k = (b + 1) % n; ; k = (k + 1) % n) {
    pts.push(ring.pts[k]);
    tags.push(ring.tags[k]);
    if (k === before) break;
  }
  // The hem runs on to where the curve leaves it, then the curve (hemmed like the hem) up to the front edge.
  pts.push(from, ...curve, to);
  tags.push('opening-hem', ...curve.map(() => 'opening-hem'), 'opening');
  // Starting where the front did.
  const s0 = Math.max(0, pts.indexOf(ring.pts[0]));
  return { pts: [...pts.slice(s0), ...pts.slice(0, s0)], tags: [...tags.slice(s0), ...tags.slice(0, s0)], along: from.x + ext };
}

/** The front opened at the centre front: the extension, the buttonholes, and the lapel or the collar's neck. */
function openFront(pc: Piece, s: OuterStyle, ext: number, buttons: OuterDraft['buttons'], breakY: number): FrontOpening {
  const r = ringOf(pc.outline, 24);
  const n = r.pts.length;
  const fi = r.tags.indexOf('fold');
  const foot = r.pts[fi];
  const neckCF = r.pts[(fi + 1) % n];
  // A raglan body has no shoulder: its raglan line stands in, from the neck end to the armhole notch.
  const sh = runOf(r, 'shoulder') ?? runOf(r, 'raglan')!;
  const hps = r.pts[sh[0]];
  const sp = r.pts[sh[1] + 1];
  const uSh = unit(sub(sp, hps));
  const bottomTag = r.tags[(fi - 1 + n) % n];
  const lines: Path[] = [new Path(p(0, neckCF.y + 0.5)).line(p(0, foot.y - 0.5))];
  const labels = pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: 'Cut 2 (1 pair)' } : l));
  labels.push({ at: p(0.7, (neckCF.y + foot.y) / 2 + 8), text: 'CENTRE FRONT', size: 0.6, rotate: 90 });
  // Buttonholes on the right front, keyhole end toward the edge, at the outer column; a zip front has none.
  const hx = buttons.columns[0];
  for (const y of buttons.at) lines.push(new Path(p(hx - 0.3, y)).line(p(hx - 0.3 + buttons.sizeCm + 0.3, y)));
  if (buttons.columns.length > 1)
    for (const y of buttons.at) {
      const bx = buttons.columns[1];
      lines.push(new Path(p(bx - 0.5, y)).line(p(bx + 0.5, y)), new Path(p(bx, y - 0.5)).line(p(bx, y + 0.5)));
    }
  if (buttons.at.length) labels.push({ at: p(hx + buttons.sizeCm / 2, buttons.at[0] - 0.6), text: 'BUTTONHOLE', size: 0.5 });
  if (s.front === 'zip') labels.push({ at: p(1.6, neckCF.y + 6), text: 'ZIP', size: 0.6, rotate: 90 });
  const facingX = s.front === 'double' ? (buttons.columns[1] ?? 0) + 4.5 : s.front === 'zip' ? 6.5 : 7.5;
  // With princess seams the front is a narrow centre panel: the facing is the whole panel, cut to the
  // princess seam, and the lining is cut from the side front only.
  const toSeam = pc.outline.tags.includes('princess');
  const s4 = add(hps, mul(uSh, Math.min(4, len(sub(sp, hps)) * 0.4)));
  let pts: P[];
  let tags: string[];
  let lapel: Lapel | undefined;
  let frontNeck: number;
  let join: number;
  if (s.collar === 'notched') {
    // The roll line runs from the break point to 2 cm beyond the neck point along the shoulder line.
    const B = p(-ext, breakY);
    const R = sub(hps, mul(uSh, 2));
    const u = unit(sub(R, B));
    const Lr = len(sub(R, B));
    const nrm = p(-u.y, u.x); // toward the body
    const at = (sAlong: number, t: number) => add(B, add(mul(u, sAlong), mul(nrm, t)));
    const W = s.front === 'double' ? (s.kind === 'coat' ? 10 : 9) : s.kind === 'coat' ? 8.5 : 7.5;
    // The gorge meets the roll line well below the neck point, rising a little to the notch.
    const Q = at(Lr - 10, 0);
    const K = at(Lr - 9.4, -4.3);
    const Lp = at(Lr - (s.front === 'double' ? 6.5 : 10.4), -W);
    const lapelEdge = Array.from({ length: 21 }, (_, i) => cubic(Lp, at(Lr * 0.5, -W - 0.7), at(Lr * 0.18, -W * 0.7), B, i / 20)).reverse();
    // The neck seam curves up from the gorge to arrive square to the shoulder, so it runs on smoothly
    // into the back neck once the shoulders are sewn.
    let up = p(uSh.y, -uSh.x);
    if (up.y > 0) up = mul(up, -1);
    // Close steps at the neck point, so the direction it arrives in is the curve's own.
    const neckC = sub(hps, mul(up, len(sub(hps, Q)) * 0.45));
    const neckSeam = [...Array.from({ length: 12 }, (_, i) => i / 12), 0.96, 0.99, 0.998].map((t) => quad(Q, neckC, hps, t));
    pts = [...r.pts.slice(sh[0], fi + 1), p(-ext, foot.y), ...lapelEdge, K, ...neckSeam];
    tags = [...r.tags.slice(sh[0], fi), 'opening-hem', 'opening', ...lapelEdge.slice(1).map(() => 'lapel'), 'lapel', 'gorge', ...neckSeam.map(() => 'neck')];
    lines.push(new Path(B).line(lerp(B, R, 0.93)));
    labels.push({ at: add(at(Lr * 0.55, 0.9), p(0, 0)), text: 'ROLL LINE', size: 0.5, rotate: (Math.atan2(u.y, u.x) * 180) / Math.PI });
    const reflect = (q: P) => {
      const v = sub(q, B);
      const along = v.x * u.x + v.y * u.y;
      const across = v.x * nrm.x + v.y * nrm.y;
      return at(along, -across);
    };
    // The collar point, turned up from the lapel's top edge to leave a notch of about 50 degrees.
    const dl = unit(sub(Lp, K));
    const ang = (50 * Math.PI) / 180;
    const Cp = add(K, mul(add(mul(dl, Math.cos(ang)), mul(u, Math.sin(ang))), s.kind === 'coat' ? 4.6 : 4));
    lapel = { breakPt: B, roll: [B, R], worn: [...lapelEdge, K, Q].map(reflect), notch: reflect(K), collarPoint: reflect(Cp), neckPoint: hps, gorge: Q };
    frontNeck = polyLen([...neckSeam, hps]);
    join = breakY + 4;
    // For the collar: where the gorge runs and where the collar point sits, on the flat front.
    pc = { ...pc, meta: { ...pc.meta, gorge: [Q, K], collarPoint: Cp, neckPoint: hps } };
  } else {
    frontNeck = taggedLength(pc.outline, 'neck');
    pts = [...r.pts.slice(0, fi + 1), p(-ext, foot.y), p(-ext, neckCF.y)];
    tags = [...r.tags.slice(0, fi), 'opening-hem', 'opening', 'neck'];
    join = neckCF.y + 7;
  }
  const facing = toSeam ? { g: () => Infinity, pts: [] as P[] } : facingLine(s4, facingX, Math.max(join, s4.y + 10), foot.y);
  if (!toSeam) {
    const faceLine = new Path(facing.pts[0]);
    for (const q of facing.pts.slice(1)) if (q.y < foot.y - 0.5) faceLine.line(q);
    lines.push(faceLine);
    labels.push({ at: p(facingX + 0.8, foot.y - 14), text: 'FACING LINE', size: 0.5, rotate: 90 });
  }
  return {
    piece: {
      ...pc,
      outline: pathOf({ pts, tags }),
      lines: [...pc.lines, ...lines],
      labels,
      fold: undefined,
      cut: 'Cut 2 (1 pair)',
      allowances: { ...pc.allowances, opening: 1, lapel: 1, gorge: 1, 'opening-neck': 1, 'opening-hem': pc.allowances[bottomTag] ?? s.hemAllowance },
      meta: { ...pc.meta, buttons: buttons.at },
    },
    lapel,
    facing,
    frontNeck,
  };
}

/** The upper and under collar for a notched lapel, drafted to the neck seam and the gorge. */
function notchedCollar(front: Piece, backNeck: number, frontNeck: number, s: OuterStyle): Piece {
  const [Q, K] = front.meta.gorge as [P, P];
  const N = front.meta.neckPoint as P;
  const Cp = front.meta.collarPoint as P;
  const stand = s.kind === 'coat' ? 3.5 : 3;
  const fall = s.kind === 'coat' ? 5 : 4.2;
  const spring = 2.5;
  const L = backNeck + frontNeck;
  // The neck edge: straight across the back neck, springing down along the front neck.
  const neck = Array.from({ length: 41 }, (_, i) => {
    const x = (L * i) / 40;
    const k = Math.max(0, (x - backNeck * 0.6) / (L - backNeck * 0.6));
    return p(x, spring * k * k);
  });
  // Stretch to the exact length.
  const got = polyLen(neck);
  const neckPts = neck.map((q) => p((q.x * L) / got, q.y));
  const E = neckPts[neckPts.length - 1];
  const tE = unit(sub(E, neckPts[neckPts.length - 2]));
  const up = p(tE.y, -tE.x);
  // The gorge and collar point carried over from the front: square to the neck seam as it is there.
  const d1 = unit(sub(Q, N));
  let nF = p(-d1.y, d1.x);
  const bodyward = sub(p(N.x + 5, N.y + 10), N);
  if (nF.x * bodyward.x + nF.y * bodyward.y > 0) nF = mul(nF, -1);
  const map = (q: P) => {
    const v = sub(q, Q);
    return add(E, add(mul(tE, v.x * d1.x + v.y * d1.y), mul(up, v.x * nF.x + v.y * nF.y)));
  };
  const Kc = map(K);
  const Cc = map(Cp);
  const top = p(0, -(stand + fall));
  const outer = Array.from({ length: 21 }, (_, i) => cubic(Cc, lerp(Cc, top, 0.35), p(L * 0.45, top.y), top, i / 20));
  const pts = [...neckPts, Kc, ...outer];
  const tags = [...neckPts.slice(1).map(() => 'neck'), 'gorge', 'collar', ...outer.slice(1, -1).map(() => 'collar'), 'fold'];
  const cut = 'Cut 2 on fold';
  const mid = p(L * 0.45, -(stand + fall) / 2 + 0.4);
  return {
    name: 'Collar',
    kind: 'collar',
    outline: pathOf({ pts, tags }),
    lines: [new Path(p(0, -stand)).line(p(L * 0.8, -stand + spring * 0.3))],
    grain: [p(1.5, -stand - fall + 1), p(1.5, -1)],
    fold: [p(0, -(stand + fall) + 0.6), p(0, -0.6)],
    notches: [[neckPts[Math.round((40 * backNeck) / L)], p(0, 1)]],
    balance: [],
    labels: [
      { at: add(mid, p(0, -0.3)), text: 'COLLAR', size: 0.8 },
      { at: add(mid, p(0, 0.7)), text: cut, size: 0.5 },
      { at: p(L * 0.35, -stand - 0.4), text: 'ROLL LINE', size: 0.45 },
    ],
    cut,
    fabric: 'Upper and under collar in self + interfacing',
    seamAllowance: s.seamAllowance,
    allowances: { neck: 1, gorge: 1, collar: 1, fold: 0 },
    meta: { foldAt: 'centre back' },
    draft: {
      frame: [],
      points: [
        { n: '1', at: p(0, 0), note: `Square a line the back neck plus the front neck seam long, ${r1(L)} cm, and drop its front end ${spring} cm for the spring, so the fall has room to roll over.` },
        { n: '2', at: top, note: `Square up ${stand} cm for the stand and ${fall} cm for the fall at the centre back.` },
        { n: '3', at: Kc, note: 'Carry the gorge line on from the front neck, the same length as the lapel\'s, to the notch.' },
        { n: '4', at: Cc, note: 'Mark the collar point to leave the notch open, and curve the outer edge back to the centre back, square to it.' },
      ],
    },
  };
}

/** A patch pocket, its top turned back for a facing. */
function patchPocket(w: number, h: number, sa: number): Piece {
  const top = 3.5;
  const R = 2.5;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const pts = [p(0, 0), ...arc(p(R, top + h - R), Math.PI), ...arc(p(w - R, top + h - R), Math.PI / 2), p(w, 0)];
  const tags = [...pts.slice(1).map(() => 'pocket'), 'pocket-top'];
  const cut = 'Cut 2';
  return {
    name: 'Patch pocket',
    kind: 'facing',
    outline: pathOf({ pts, tags }),
    lines: [],
    grain: [p(w * 0.25, top + 2), p(w * 0.25, top + h - 3)],
    notches: [
      [p(0, top), p(-1, 0)],
      [p(w, top), p(1, 0)],
    ],
    balance: [{ pts: [p(0, top), p(w, top)], label: 'FOLD' }],
    labels: [
      { at: p(w / 2, top + h * 0.45), text: 'PATCH POCKET', size: 0.8 },
      { at: p(w / 2, top + h * 0.45 + 1.1), text: cut, size: 0.55 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { pocket: 1, 'pocket-top': 1 },
    meta: {},
  };
}

/** The back lining: the back on the fold, with a pleat at the centre back for ease across the shoulders. */
function backLining(pc: Piece, pleat: number): Piece {
  const r = ringOf(pc.outline, 24);
  const fi = r.tags.indexOf('fold');
  if (fi < 0) return { ...pc, name: 'Back lining', kind: 'lining', fabric: 'Lining' };
  const n = r.pts.length;
  const moved = r.pts.map((q) => add(q, p(pleat, 0)));
  const a = moved[fi];
  const b = moved[(fi + 1) % n];
  const pts = [...moved.slice(0, fi + 1), p(0, a.y), p(0, b.y), ...moved.slice(fi + 1)];
  const tags = [...r.tags.slice(0, fi), r.tags[(fi - 1 + n) % n], 'fold', r.tags[(fi + 1) % n] === 'neck' ? 'neck' : r.tags[(fi + 1) % n], ...r.tags.slice(fi + 1)];
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const cut = 'Cut 1 on fold';
  return cutFrom(pc, { pts, tags }, 'Back lining', {
    kind: 'lining',
    fabric: 'Lining',
    cut,
    fold: [p(0, top + 2), p(0, bottom - 2)],
    lines: [new Path(p(pleat, top + 0.5)).line(p(pleat, top + 8))],
    labels: [
      { at: p(pleat + 8, top + 18), text: 'BACK LINING', size: 1.1 },
      { at: p(pleat + 8, top + 19.6), text: cut, size: 0.7 },
      { at: p(pleat + 0.9, top + 12), text: 'PLEAT: TACK 8 CM AT THE NECK', size: 0.45, rotate: 90 },
    ],
    allowances: { ...pc.allowances, fold: 0, hem: 1.5 },
  });
}

/**
 * The back with a centre back vent: no longer on the fold, but a centre back seam down to the vent,
 * and below it an underlap `w` wide past the centre back, its top cut at 45 degrees. Both backs are cut
 * alike: on the left back the underlap lies under the vent, on the right it folds back along the
 * centre back as the vent's facing.
 */
export function ventBack(pc: Piece, top: number, w: number): Piece {
  const r = ringOf(pc.outline, 24);
  const n = r.pts.length;
  const fi = r.tags.indexOf('fold');
  if (fi < 0) return pc;
  const a = r.pts[fi];
  const b = r.pts[(fi + 1) % n];
  const foot = Math.max(a.y, b.y);
  // Down the centre back: the seam to the vent, the underlap's slant and its edge, then the hem across it.
  const down = [p(0, top), p(-w, top + w), p(-w, foot)];
  const downTags = ['centre', 'vent', 'vent', 'hem'];
  const fromTop = a.y < b.y;
  const pts = [...r.pts.slice(0, fi + 1)];
  const tags = [...r.tags.slice(0, fi)];
  if (fromTop) {
    pts.push(...down);
    tags.push(...downTags);
  } else {
    pts.push(...[...down].reverse());
    tags.push(...[...downTags].reverse());
  }
  pts.push(...r.pts.slice(fi + 1));
  tags.push(...r.tags.slice(fi + 1));
  const cut = 'Cut 2 (1 pair)';
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    fold: undefined,
    cut,
    lines: [...pc.lines, new Path(p(0, top)).line(p(0, foot - 0.3))],
    labels: [
      ...pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: cut } : l)),
      { at: p(-w / 2, top + w + 6), text: 'VENT', size: 0.55, rotate: 90 },
      { at: p(0.7, top + w + 6), text: 'RIGHT BACK: FOLD BACK', size: 0.42, rotate: 90 },
    ],
    notches: [...pc.notches, [p(0, top), p(-1, 0)]],
    allowances: { ...pc.allowances, centre: pc.seamAllowance, vent: 1 },
    meta: { ...pc.meta, vent: { top, width: w } },
  };
}

/**
 * The back lining for a vented back: a centre back seam with the pleat above the vent; the left back
 * lining follows the underlap, and the right one (the second cutting line) is cut away to the vent
 * facing's edge.
 */
function ventLining(pc: Piece, top: number, w: number, pleat: number): Piece {
  const r = ringOf(pc.outline, 24);
  const moved = r.pts.map((q) => (Math.abs(q.x) < 1e-6 && q.y < top - 0.05 ? p(-pleat, q.y) : q));
  // Bring the pleat back in to nothing just above the vent.
  const iTop = moved.findIndex((q) => Math.abs(q.x) < 1e-6 && Math.abs(q.y - top) < 1e-6);
  const pts = [...moved];
  const tags = [...r.tags];
  if (iTop >= 0) {
    const prev = pts[(iTop - 1 + pts.length) % pts.length];
    const above = p(-pleat, top - 4);
    if (prev.x < 0 && prev.y < top) {
      pts.splice(iTop, 0, above);
      tags.splice(iTop, 0, 'centre');
    } else {
      pts.splice(iTop + 1, 0, above);
      tags.splice(iTop + 1, 0, 'centre');
    }
  }
  const foot = Math.max(...r.pts.map((q) => q.y));
  const ring = { pts, tags };
  const cut = 'Cut 2 (1 pair)';
  const lining = cutFrom(pc, ring, 'Back lining', {
    kind: 'lining',
    fabric: 'Lining',
    cut,
    lines: [new Path(p(0, Math.min(...pts.map((q) => q.y)) + 0.5)).line(p(0, top - 4))],
    grain: [p(5, top * 0.35), p(5, top - 3)],
    labels: [
      { at: p(9, top - 20), text: 'BACK LINING', size: 1.1 },
      { at: p(9, top - 18.4), text: cut, size: 0.7 },
      { at: p(0.9, top - 30), text: 'PLEAT LINE', size: 0.45, rotate: 90 },
      { at: p(w + 1.2, top + w + 4), text: 'CUT AWAY FOR THE RIGHT BACK', size: 0.42, rotate: 90 },
    ],
    allowances: { ...pc.allowances, centre: pc.seamAllowance, vent: 1, hem: 1.5 },
  });
  // The right back lining stops at the vent facing's edge, w in from the centre back.
  const alt = pts.map((q) => q);
  const vi = alt.findIndex((q) => Math.abs(q.x + w) < 1e-6 && Math.abs(q.y - (top + w)) < 1e-6);
  const fi2 = alt.findIndex((q) => Math.abs(q.x + w) < 1e-6 && Math.abs(q.y - foot) < 1e-6);
  if (vi >= 0 && fi2 >= 0) {
    alt[vi] = p(w, top + w);
    alt[fi2] = p(w, foot);
  }
  return { ...lining, alternate: { outline: pathOf({ pts: alt, tags }), label: 'RIGHT BACK LINING' } };
}

/** A single welt pocket: the welt, folded in half, the pocket facing and the two pocket bags. */
function weltPieces(w: number, depth: number, bag: number, sa: number): Piece[] {
  const rect = (W: number, H: number, name: string, tag: string, over: Partial<Piece>): Piece => {
    const outline = pathOf({ pts: [p(0, 0), p(W, 0), p(W, H), p(0, H)], tags: [tag, `${tag}-end`, tag, `${tag}-end`] });
    const cut = over.cut ?? 'Cut 2';
    return {
      name,
      kind: 'facing',
      outline,
      lines: [],
      grain: [p(W * 0.2, H * 0.2), p(W * 0.2, Math.max(H * 0.8, H * 0.2 + 2))],
      notches: [],
      labels: [
        { at: p(W / 2, H / 2 - 0.2), text: name.toUpperCase(), size: H < 6 ? 0.55 : 0.8 },
        { at: p(W / 2, H / 2 + (H < 6 ? 0.8 : 1.2)), text: cut, size: H < 6 ? 0.45 : 0.55 },
      ],
      cut,
      seamAllowance: sa,
      allowances: { [tag]: 1, [`${tag}-end`]: 1 },
      meta: {},
      ...over,
    };
  };
  const welt = rect(w, 2 * depth, 'Welt', 'welt', { fabric: 'Self + interfacing', balance: [{ pts: [p(0, depth), p(w, depth)], label: 'FOLD' }] });
  const facing = rect(w + 3, 7, 'Pocket facing', 'pocket', { grain: [p(2, 1.5), p(2, 5.5)] });
  // The bag: rounded at the bottom so lint does not collect in its corners.
  const W = w + 3;
  const R = 3;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const bagPts = [p(0, 0), ...arc(p(R, bag - R), Math.PI), ...arc(p(W - R, bag - R), Math.PI / 2), p(W, 0)];
  const bagCut = 'Cut 4 (2 pairs)';
  const bagPiece: Piece = {
    name: 'Pocket bag',
    kind: 'lining',
    fabric: 'Lining or pocketing',
    outline: pathOf({ pts: bagPts, tags: [...bagPts.slice(1).map(() => 'bag'), 'bag-top'] }),
    lines: [],
    grain: [p(W * 0.2, 3), p(W * 0.2, bag - 4)],
    notches: [],
    labels: [
      { at: p(W / 2, bag * 0.45), text: 'POCKET BAG', size: 0.8 },
      { at: p(W / 2, bag * 0.45 + 1.2), text: bagCut, size: 0.55 },
    ],
    cut: bagCut,
    seamAllowance: sa,
    allowances: { bag: 1, 'bag-top': 1 },
    meta: {},
  };
  return [welt, facing, bagPiece];
}

/** Buttons down the front: from the break point (or just below the neck) to above the hem, about 10 cm apart. */
function buttonsFor(s: OuterStyle, ext: number, first: number, last: number): OuterDraft['buttons'] {
  const size = OUTER_BUTTON[s.kind];
  if (s.front === 'zip') return { at: [], sizeCm: size, columns: [0] };
  const gap = s.kind === 'coat' ? 11 : 10;
  const count = Math.max(s.front === 'double' ? 2 : 1, Math.round((last - first) / gap)) + 1;
  const at = Array.from({ length: count }, (_, i) => r1(first + (count > 1 ? ((last - first) * i) / (count - 1) : 0)));
  const inset = size / 2 + 1.5;
  const columns = s.front === 'double' ? [-(ext - inset), ext - inset] : [0];
  return { at, sizeCm: size, columns };
}

/**
 * A hood in two pieces, one each side, seamed down the centre back and over the head and sewn to the neck:
 * the face edge straight, the crown rounding back from it, the centre back curving in toward the nape,
 * and the neck edge as long as half the neckline it joins (the hood's front edges meet at the centre front).
 */
function hoodPiece(neckHalf: number, kind: OuterKind, sa: number): Piece {
  const { height: H } = HOOD[kind];
  let D = HOOD[kind].depth;
  const build = (depth: number) => {
    const outline = new Path(p(0, H))
      .line(p(0, 1.5), 'face')
      .curve(p(depth * 0.4, -2.2), p(depth * 0.98, -0.4), p(depth, 9), 'centre')
      .curve(p(depth * 1.01, H * 0.5), p(depth * 0.86, H - 6.5), p(depth * 0.84, H - 3.2), 'centre')
      .curve(p(depth * 0.62, H + 1.6), p(depth * 0.22, H + 1.1), p(0, H), 'neck');
    outline.closed = true;
    return outline;
  };
  // Sized so the neck edge is as long as the neckline it joins.
  for (let i = 0; i < 3; i++) D *= neckHalf / taggedLength(build(D), 'neck');
  const outline = build(D);
  const cut = 'Cut 2 (1 pair)';
  return {
    name: 'Hood',
    outline,
    lines: [],
    grain: [p(D * 0.45, 6), p(D * 0.45, H - 6)],
    notches: [
      [p(D * 0.6, 1.2), p(0, -1)],
      [p(D * 0.4, H + 0.2), p(0, 1)],
    ],
    labels: [
      { at: p(D * 0.5, H * 0.4), text: 'HOOD', size: 1.4 },
      { at: p(D * 0.5, H * 0.4 + 3.5), text: cut, size: 0.9 },
      { at: p(D * 0.5, H * 0.4 + 6), text: 'CUT 2 MORE IN LINING', size: 0.7 },
      { at: p(D * 0.35, H - 1.2), text: 'NECK', size: 0.6 },
      { at: p(1.6, H * 0.5), text: 'FACE EDGE', size: 0.6, rotate: 90 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { face: 2 },
    meta: { hood: true, height: H, depth: r1(D) },
  };
}

/** A rib band: a strip of ribbing cut to `draw` of the edge it joins, folded double to the finished depth. */
function ribBand(name: string, edgeCm: number, depth: number, sa: number, cut: string, onFold: boolean): Piece {
  const L = r1((edgeCm * RIB.draw) / (onFold ? 2 : 1));
  const W = 2 * depth;
  const outline = new Path(p(0, 0)).line(p(L, 0), 'band').line(p(L, W), 'end').line(p(0, W), 'band').line(p(0, 0), onFold ? 'fold' : 'end');
  outline.closed = true;
  return {
    name,
    kind: 'band',
    fabric: 'Rib knit',
    outline,
    lines: [],
    grain: [p(2, W * 0.3), p(Math.max(6, L - 2), W * 0.3)],
    fold: onFold ? [p(0, 1), p(0, W - 1)] : undefined,
    notches: [[p(L / 2, 0), p(0, -1)]],
    balance: [{ pts: [p(0, W / 2), p(L, W / 2)], label: 'FOLD LINE' }],
    labels: [
      { at: p(L * 0.5, W * 0.32), text: name.toUpperCase(), size: 0.9 },
      { at: p(L * 0.5, W * 0.32 + 1.6), text: `${cut}, rib knit, stretched to fit`, size: 0.6 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { fold: 0 },
    meta: { finishedWidth: depth, lengthCm: L, rib: true },
  };
}

/** Draft a jacket or a coat. */
export function draftOuter(m: OuterMeasurements, style: Partial<OuterStyle> & { kind: OuterKind }): OuterDraft {
  let s: OuterStyle = { ...DEFAULT_OUTER[style.kind], ...style };
  if (!(m.full_hip && m.waist_to_hip)) throw new DraftError(`Add your full hip and waist to hip measurements to make a ${s.kind}.`);
  if (s.kind === 'coat' && !m.waist_to_knee) throw new DraftError('Add your waist to knee measurement to make a coat.');
  if (!(m.arm_length && m.upper_arm)) throw new DraftError(`Add your arm length and upper arm measurements for the ${s.kind}'s sleeves.`);
  const length = OUTER_LENGTHS[s.kind].includes(s.length) ? s.length : DEFAULT_OUTER[s.kind].length;
  // A fitted jacket needs its waist darts; only a roomier one can go boxy.
  // A raglan sleeve is cut off a one-piece front and back, so princess seams give way to darts.
  const shaping = s.shaping === 'boxy' && s.fit === 'fitted' ? 'darts' : s.shaping === 'princess' && s.sleeve === 'raglan' ? 'darts' : s.shaping;
  // Shoulder pads drafted in: each shoulder squared up so its point rises by the pad, which lengthens
  // the armhole; the sleeve is drafted to that armhole, so its crown rises with it.
  const pad = PAD_CM[s.kind][s.pads] ?? 0;
  // A zip front or a raglan sleeve has no lapel to roll: a notched collar becomes a stand collar.
  const collarKind: OuterCollar = s.collar === 'notched' && (s.front === 'zip' || s.sleeve === 'raglan') ? 'stand' : s.collar;
  s = { ...s, collar: collarKind };
  const rib = s.trim === 'rib';
  const bodiceStyle: Partial<BodiceStyle> = {
    fit: s.fit,
    neckline: 'crew',
    neck: OUTER_NECK,
    length: length === 'cropped' ? 'high_hip' : 'hip',
    darts: shaping === 'boxy' ? 'bust' : 'bust_waist',
    princess: shaping === 'princess' ? 'armhole' : 'none',
    bustEase: OUTER_EASE[s.kind][s.fit],
    seamAllowance: s.seamAllowance,
    neckArmholeAllowance: 1,
    hemAllowance: s.hemAllowance,
    fitting: s.fitting,
    shoulderPad: pad,
    closure: 'back_zip',
    collar: 'none',
    ...(s.sleeve === 'raglan' ? { sleeveCut: 'raglan' as const, sleeve: 'long' as const } : {}),
  };
  const base = draftBodice(m, bodiceStyle);
  const drop = Math.max(base.drop, outerDrop(m, length));
  // A rib hem band stands in for the last of the length, where the shell is long enough to give it up.
  const extra = Math.max(0, drop - base.drop - (rib ? RIB.hem : 0));
  const flare = (FLARE_PER_40[s.flare] * extra) / 40;
  const KIND = s.kind === 'coat' ? 'Coat' : 'Jacket';
  const rename = (pc: Piece): Piece => ({
    ...pc,
    name: pc.name.replace(/^Bodice/, KIND),
    labels: pc.labels.map((l) => ({ ...l, text: l.text.replace(/^BODICE/, KIND.toUpperCase()) })),
  });
  const prep = (pc: Piece) => rename(extendPiece(/back/i.test(pc.name) ? backOnFold(pc) : pc, extra, flare));
  const shell = base.pieces.map(prep);
  const [bf0, bb0] = blockOf(base);
  const block: [Piece, Piece] = [prep(bf0), prep(bb0)];

  const ext = OUTER_EXTENSION[s.kind][s.front];
  const foot = Math.max(...block[0].outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
  const neckY = block[0].outline.start.y;
  const apexY = base.front.apex.y;
  const waistY = base.front.waistCentre.y;
  const breakY = s.collar === 'notched' ? (s.front === 'double' ? apexY - 2 : apexY + 2) : neckY + (s.collar === 'stand' ? 2 : 1.8);
  const lastY = s.kind === 'coat' ? Math.min(foot - 15, waistY + (m.waist_to_hip ?? 20) + 12) : foot - (length === 'cropped' ? 3.5 : 9);
  // A cutaway front curves back from below the last button, so the buttons stop above it.
  const cutTop = s.cutawayCm ? foot - Math.min(s.cutawayCm, foot - breakY - 18) - 4 - OUTER_BUTTON[s.kind] / 2 : Infinity;
  const buttons = buttonsFor(s, ext, breakY, Math.max(breakY + 12, Math.min(lastY, cutTop)));

  const fronts: Piece[] = [];
  const facings: Piece[] = [];
  const linings: Piece[] = [];
  let opening: FrontOpening | undefined;
  for (const pc of shell) {
    if (!/front/i.test(pc.name)) continue;
    if (pc.fold) {
      opening = openFront(pc, s, ext, buttons, breakY);
      const r = cutawayOf(s, foot, buttons);
      if (r) {
        const cut = cutAway(ringOf(opening.piece.outline, 24), ext, foot, r);
        opening = { ...opening, piece: { ...opening.piece, outline: pathOf(cut), meta: { ...opening.piece.meta, cutaway: { up: r, along: r1(cut.along) } } } };
      }
      fronts.push(opening.piece);
    } else fronts.push(pc);
  }
  if (!opening) throw new DraftError('The front could not be opened for buttons.');
  let backs = shell.filter((pc) => /back/i.test(pc.name));

  // The front facing, and the front lining: the opened front either side of the facing line.
  const fr = ringOf(opening.piece.outline, 12);
  const toSeam = opening.facing.pts.length === 0;
  const facingRing = toSeam ? fr : clipRing(fr, opening.facing.g, true, 'lining', opening.facing.pts);
  const facingPiece = cutFrom(opening.piece, facingRing, 'Front facing', {
    kind: 'facing',
    fabric: 'Self + interfacing',
    cut: 'Cut 2 (1 pair)',
    allowances: { ...opening.piece.allowances, lining: s.seamAllowance },
  });
  facings.push(facingPiece);
  const backNeck = taggedLength(backs.find((pc) => pc.fold)?.outline ?? backs[0].outline, 'neck');
  const sa = s.seamAllowance;
  // The centre back vent, longer on a longer garment: from 12 cm on a hip jacket to 45 cm on a long coat.
  let vent: OuterDraft['vent'];
  if (s.vent === 'centre' && length !== 'cropped' && !rib) {
    const width = VENT_WIDTH[s.kind];
    backs = backs.map((pc) => {
      if (!pc.fold) return pc;
      const backFoot = Math.max(...pc.outline.points(4).map((q) => q.y));
      const most = Math.min(45, Math.max(12, (backFoot - waistY) * 0.8));
      const top = r1(backFoot - Math.min(most, Math.max(12, s.ventCm ?? Math.min(45, Math.max(12, (backFoot - waistY) * 0.6)))));
      vent = { top, width, length: r1(backFoot - top) };
      return ventBack(pc, top, width);
    });
  }
  const collar =
    s.collar === 'notched'
      ? [notchedCollar(opening.piece, backNeck, opening.frontNeck, s)]
      : s.collar === 'stand'
        ? collarPieces('mandarin', block[0], block[1], { back: backNeck, front: opening.frontNeck, ext, closure: 'front_buttons', sa })
        : s.collar === 'hood'
          ? [hoodPiece(backNeck + opening.frontNeck, s.kind, sa)]
          : [];
  // A collarless back neck is finished with a facing; under a collar the lining runs up to the neck.
  for (const pc of fronts) {
    if (pc === opening.piece) {
      // The centre panel of a princess front is all facing: nothing left to line.
      if (toSeam) continue;
      const lr = clipRing(fr, opening.facing.g, false, 'lining', opening.facing.pts);
      linings.push(cutFrom(pc, lr, 'Front lining', { kind: 'lining', fabric: 'Lining', cut: 'Cut 2 (1 pair)', allowances: { ...pc.allowances, lining: sa, hem: 1.5 } }));
    } else linings.push(cutFrom(pc, ringOf(pc.outline, 12), `${pc.name.replace(KIND, '').trim()} lining`.replace(/^./, (c) => c.toUpperCase()), { kind: 'lining', fabric: 'Lining', allowances: { ...pc.allowances, hem: 1.5 } }));
  }
  for (const pc of backs) {
    if (pc.meta.vent && vent) linings.push(ventLining(pc, vent.top, vent.width, 1.5));
    else if (pc.fold) linings.push(backLining(pc, 1.5));
    else linings.push(cutFrom(pc, ringOf(pc.outline, 12), `${pc.name.replace(KIND, '').trim()} lining`.replace(/^./, (c) => c.toUpperCase()), { kind: 'lining', fabric: 'Lining', allowances: { ...pc.allowances, hem: 1.5 } }));
  }

  const sleeveStyle = {
    length: 'long' as const,
    shape: s.sleeve === 'raglan' ? ('straight' as const) : s.sleeve,
    fit: s.fit,
    outer: s.kind,
    seamAllowance: sa,
    armholeAllowance: 1,
    hemAllowance: rib ? 1 : 4,
  };
  let sleeve = draftSleeve(base, m, sleeveStyle);
  // Rib cuffs: the sleeve stops a cuff's depth short, and ends in a band the sleeve blouses over a little.
  if (rib) {
    const shorter = draftSleeve(base, m, { ...sleeveStyle, lengthCm: Math.max(sleeve.length.min, sleeve.lengthCm - RIB.cuff) });
    const round = r1(shorter.hemCm * RIB.draw);
    sleeve = { ...shorter, hemCm: round, gathers: { hem: r1(shorter.hemCm - round) }, cuff: { kind: 'elastic', depth: RIB.cuff, round } };
  }
  const sleevePieces = sleeve.pieces.map((pc) => ({ ...pc, labels: pc.labels }));
  const sleeveLining = sleeve.pieces.map((pc) => ({
    ...pc,
    name: `${pc.name} lining`,
    kind: 'lining' as const,
    fabric: 'Lining',
    labels: pc.labels.map((l) => (/SLEEVE$/.test(l.text) ? { ...l, text: `${l.text} LINING` } : l)),
    allowances: { ...pc.allowances, hem: 1.5 },
    meta: { ...pc.meta },
  }));

  // Pockets just below the waist, on the widest front piece at that level (the side front, with
  // princess seams), clear of the buttons and the seams.
  let pocketPieces: Piece[] = [];
  let pocket: OuterDraft['pocket'];
  if (s.pockets !== 'none') {
    const welt = s.pockets === 'welt';
    const w = welt ? (s.kind === 'coat' ? 16 : 14) : s.kind === 'coat' ? 18 : 15;
    const h = welt ? (s.kind === 'coat' ? 3 : 2.5) : s.kind === 'coat' ? 19 : length === 'cropped' ? 12 : 16;
    const lowest = welt ? foot - 8 : foot - h - 4;
    const y = s.pocketAt
      ? Math.max(waistY - 4, Math.min(lowest, s.pocketAt.y))
      : welt
        ? Math.min(waistY + (m.waist_to_hip ?? 20) * (s.kind === 'coat' ? 0.5 : 0.4), foot - 8)
        : Math.min(waistY + (m.waist_to_hip ?? 20) * 0.35, foot - h - 4);
    const carrier = fronts.reduce((best, pc) => {
      const [lo, hi] = spanAt(pc, y + h / 2);
      const [blo, bhi] = spanAt(best, y + h / 2);
      return hi - Math.max(lo, ext + 2) > bhi - Math.max(blo, ext + 2) ? pc : best;
    });
    const [lo, hi] = spanAt(carrier, y + h / 2);
    const from = Math.max(lo + 1.5, ext + 2);
    const x = Math.max(from, Math.min(hi - w - 2, s.pocketAt ? s.pocketAt.x - w / 2 : (from + hi) / 2 - w / 2));
    pocket = { x, y, w, h, kind: welt ? 'welt' : 'patch' };
    pocketPieces = welt ? weltPieces(w, h, s.kind === 'coat' ? 22 : 17, sa) : [patchPocket(w, h, sa)];
    const i = fronts.indexOf(carrier);
    fronts[i] = {
      ...carrier,
      lines: [...carrier.lines, new Path(p(x, y)).line(p(x, y + h)).line(p(x + w, y + h)).line(p(x + w, y)).line(p(x, y))],
      labels: [...carrier.labels, { at: p(x + w / 2, welt ? y - 0.8 : y + 1.2), text: welt ? 'WELT POCKET' : 'POCKET', size: 0.5 }],
    };
  }

  const backPiece = backs.find((pc) => pc.fold) ?? backs[0];
  const shellHem = r1(2 * shell.reduce((t, pc) => t + taggedLength(pc.outline, 'hem'), 0));
  // The rib bands: one hem band cut on the fold, and a cuff for each sleeve.
  const bands = rib ? [ribBand('Hem band', shellHem, RIB.hem, sa, 'Cut 1 on fold', true), ribBand('Cuff band', sleeve.hemCm / RIB.draw, RIB.cuff, sa, 'Cut 2', false)] : [];
  const pieces = [...fronts, ...backs, ...sleevePieces, ...collar, ...bands, ...facings, ...pocketPieces, ...linings, ...sleeveLining];
  const finishedHem = rib ? r1(shellHem * RIB.draw) : shellHem;
  const cbTop = backPiece.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).reduce((mn, q) => Math.min(mn, q.y), Infinity);
  const cbFoot = backPiece.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).reduce((mx, q) => Math.max(mx, q.y), -Infinity);
  return {
    kind: s.kind,
    base,
    sleeve,
    pieces,
    block,
    ext,
    buttons,
    ...(s.fitting?.flatFront ? { lapsLeft: true } : {}),
    lapel: opening.lapel,
    ...(opening.piece.meta.cutaway ? { cutaway: opening.piece.meta.cutaway as { up: number; along: number } } : {}),
    pocket,
    pads: pad,
    vent,
    ...(rib ? { rib: { hem: RIB.hem, cuff: RIB.cuff } } : {}),
    ...(s.collar === 'hood' ? { hood: { height: collar[0].meta.height as number, depth: collar[0].meta.depth as number } } : {}),
    finishedBust: base.finishedBust,
    finishedWaist: base.finishedWaist,
    finishedHem,
    drop: r1(drop),
    lengthCm: r1(cbFoot - cbTop),
    warnings: [...base.warnings, ...sleeve.warnings],
  };
}
