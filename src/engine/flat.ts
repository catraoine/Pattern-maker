// The technical flat: the garment drawn flat, front and back, the way a designer hands it to a
// pattern room. Drawn to scale from the draft itself: each half piece with its darts sewn (waist
// darts closed into the waist, the bust dart folded into the side seam), mirrored across the centre,
// with its seams, darts, zip and visible stitching.
import { P, add, len, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import type { SkirtDraft } from './skirt';
import { WAISTBAND_CM } from './skirt';
import { HIGH } from './skirtWaist';
import { BodiceDraft, blockOf } from './bodice';
import { BANDS, isBandCollar } from './collar';
import type { BodiceEdges } from './instructions';
import { BAND_CM, SleeveDraft } from './sleeve';
import type { DressDraft } from './dress';
import type { TrousersDraft } from './trousers';
import { TeeDraft } from './tee';
import { INSEAM, SLANT } from './pockets';
import type { OuterDraft } from './outerwear';
import { lerp } from './geometry';
import { COWL_DEPTH, UNDER_ARM, oneShoulderEdge } from './drape';
import { unevenEdge } from './uneven';
import type { BeltDraft } from './belt';

export type FlatLineKind = 'seam' | 'dart' | 'stitch' | 'zip';

export interface FlatView {
  label: 'FRONT' | 'BACK';
  /** The garment's outer edge, and any part drawn as its own shape (the waistband). Closed. */
  shapes: P[][];
  lines: { pts: P[]; kind: FlatLineKind }[];
  /** Where the label goes, below the view. */
  at: P;
  /** How far the view was moved to sit beside the others: take it off to get the pieces' own coordinates
   *  (the centre at x = 0), which is where the Style page draws the garment on the form. */
  origin: P;
  /** Which of `shapes` are the sleeves (and their bands), drawn out at an angle as flats are. */
  sleeves?: number[];
}

export interface Flat {
  views: FlatView[];
  width: number;
  height: number;
}

const GAP = 12; // cm between the front and back views

const mirror = (pts: P[]) => pts.map((q) => p(-q.x, q.y));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function inside(q: P, pts: P[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** A run of points moved `d` cm into the shape, keeping only the part that stays inside it. */
function inset(run: P[], d: number, shape: P[]): P[][] {
  const out: P[][] = [[]];
  run.forEach((q, i) => {
    const t = unit(sub(run[Math.min(i + 1, run.length - 1)], run[Math.max(i - 1, 0)]));
    const n = p(-t.y, t.x);
    const a = add(q, mul(n, d));
    const b = add(q, mul(n, -d));
    const pick = inside(a, shape) ? a : inside(b, shape) ? b : undefined;
    if (pick) out[out.length - 1].push(pick);
    else if (out[out.length - 1].length) out.push([]);
  });
  return out.filter((r) => r.length > 1);
}

interface Half {
  /** The half piece's edge as sewn, from the top of the centre line round to its foot. */
  run: P[];
  /** tags[i] names the edge run[i] -> run[i + 1]. */
  tags: string[];
  darts: P[][];
  /** Where a point of the flat piece ends up once its darts are sewn. */
  move: (q: P) => P;
}

/**
 * A half piece with its darts sewn. Waist darts close into the waist, the fabric either side drawn in
 * and easing back to full width over twice the dart's length. A dart in the side seam is
 * folded away, and the piece below it drawn up to `bottom`, so the front's side seam is as long as
 * the back's.
 */
function sewn(pc: Piece, bottom?: number, skip?: 'side' | 'all' | 'none', centreDrop = 0): Half {
  let { pts, tags } = pc.outline.taggedPoints(8);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  tags = tags.slice(0, pts.length);
  // Long straight edges are split, so they bend smoothly where the darts draw the piece in.
  {
    const sp: P[] = [];
    const st: string[] = [];
    pts.forEach((q, i) => {
      const next = pts[(i + 1) % pts.length];
      const steps = tags[i] === 'dart' ? 1 : Math.max(1, Math.floor(len(sub(next, q))));
      for (let s = 0; s < steps; s++) {
        sp.push(add(q, mul(sub(next, q), s / steps)));
        st.push(tags[i]);
      }
    });
    pts = sp;
    tags = st;
  }
  const n = pts.length;

  // Each run of dart edges in the outline: its two ends, joined straight.
  const keep: boolean[] = new Array(n).fill(true);
  const openings: { a: P; b: P }[] = [];
  for (let i = 0; i < n; i++) {
    if (tags[i] !== 'dart' || tags[(i - 1 + n) % n] === 'dart') continue;
    let k = i;
    while (tags[k % n] === 'dart') k++;
    for (let j = i + 1; j < k; j++) keep[j % n] = false;
    openings.push({ a: pts[i], b: pts[k % n] });
  }
  const linePts = pc.lines.map((l) => l.points(4));
  const tipOf = (a: P, b: P): P | undefined => {
    const l = linePts.find((ps) => ps.length >= 3 && len(sub(ps[0], a)) < 0.5 && len(sub(ps[ps.length - 1], b)) < 0.5)
      ?? linePts.find((ps) => ps.length >= 3 && len(sub(ps[0], b)) < 0.5 && len(sub(ps[ps.length - 1], a)) < 0.5);
    if (!l) return undefined;
    const mid = mul(add(a, b), 0.5);
    return l.reduce((far, q) => (len(sub(q, mid)) > len(sub(far, mid)) ? q : far), l[0]);
  };
  const waistDarts = openings
    .filter(({ a, b }) => Math.abs(b.x - a.x) > Math.abs(b.y - a.y))
    .map(({ a, b }) => {
      const tip = tipOf(a, b);
      const mid = mul(add(a, b), 0.5);
      return { lo: Math.min(a.x, b.x), g: Math.abs(b.x - a.x), y: mid.y, reach: 2 * (tip ? len(sub(tip, mid)) : 8) };
    });
  const side = openings.find(({ a, b }) => Math.abs(b.y - a.y) >= Math.abs(b.x - a.x));
  // The bust dart's shaped end stands proud of the side seam until it is sewn: draw the seam straight past it.
  // The seam above it is angled to meet the dart too, so it runs straight from the underarm.
  if (side) {
    const a = pts.indexOf(side.a);
    let s0 = a;
    while (s0 > 0 && tags[s0 - 1] === 'side') s0--;
    for (let i = s0 + 1; i <= a; i++) keep[i] = false;
    keep[pts.indexOf(side.b)] = false;
  }

  // The foot of the side seam, and where the drawing up starts: the side dart, or the underarm.
  const lastSide = tags.lastIndexOf('side');
  const footPt = lastSide >= 0 ? pts[(lastSide + 1) % n] : pts.reduce((m, q) => (q.y > m.y ? q : m));
  const centreFoot = pts.find((q) => Math.abs(q.x) < 1e-6 && q.y > footPt.y - 20 && q.y >= Math.max(...pts.filter((r) => Math.abs(r.x) < 1e-6).map((r) => r.y))) ?? footPt;
  const from = side ? Math.min(side.a.y, side.b.y) : lastSide >= 0 ? pts[tags.indexOf('side')].y : 0;
  // Drawn up by its own amount at the side and at the centre, so a front with its bust shaping left
  // in the hem (no darts) hangs level with the back. A shaped hem's centre hangs `centreDrop` below.
  const scale = (foot: number, to = bottom) => (to !== undefined && foot - from > 1 ? (to - from) / (foot - from) : 1);
  const kSide = scale(footPt.y);
  const kCentre = scale(centreFoot.y, bottom !== undefined ? bottom + centreDrop : undefined);

  const move = (q: P): P => {
    let x = q.x;
    // Each dart draws in toward the centre: on a piece cut whole, the darts left of it pull the other way.
    for (const d of waistDarts) {
      const pull = d.g * clamp01(1 - Math.abs(q.y - d.y) / d.reach);
      x += d.lo + d.g / 2 < 0 ? pull * clamp01((d.lo + d.g - q.x) / d.g) : -pull * clamp01((q.x - d.lo) / d.g);
    }
    const k = kCentre + (kSide - kCentre) * clamp01(Math.abs(q.x) / Math.max(Math.abs(footPt.x), 1));
    const y = q.y > from ? from + (q.y - from) * k : q.y;
    return p(x, y);
  };

  // Start just after the centre line and end where it begins, so the half mirrors into a whole.
  const centre = tags.findIndex((t, i) => (t === 'fold' || t === 'centre') && tags[(i + 1) % n] !== t);
  const start = centre >= 0 ? (centre + 1) % n : 0;
  const top = tags.findIndex((t, i) => (t === 'fold' || t === 'centre') && tags[(i - 1 + n) % n] !== t);
  const run: P[] = [];
  const runTags: string[] = [];
  for (let s = 0; s < n; s++) {
    const i = (start + s) % n;
    if (centre >= 0 && i === top) break;
    if (!keep[i]) continue;
    run.push(move(pts[i]));
    runTags.push(tags[i]);
  }
  // End at the foot of the centre line (or back at the start when there is none).
  run.push(centre >= 0 ? move(pts[top]) : run[0]);

  // Darts drawn as stitched: a single line from the middle of the opening to the point, or for a
  // dart inside the piece (a fish-eye) from end to end.
  const darts: P[][] = [];
  for (const ps of linePts) {
    if (ps.length < 3) continue;
    // A moved bust dart or princess seams are drawn instead of the block's own.
    if (skip === 'all' || (skip === 'side' && ps.length === 3 && Math.abs(ps[2].y - ps[0].y) > Math.abs(ps[2].x - ps[0].x))) continue;
    const a = ps[0];
    const b = ps[ps.length - 1];
    let line: P[];
    if (len(sub(a, b)) < 0.1) {
      const top = ps.reduce((m, q) => (q.y < m.y ? q : m));
      const bot = ps.reduce((m, q) => (q.y > m.y ? q : m));
      line = [top, bot];
    } else {
      const mid = mul(add(a, b), 0.5);
      line = [mid, ps.reduce((far, q) => (len(sub(q, mid)) > len(sub(far, mid)) ? q : far))];
    }
    if (len(sub(line[1], line[0])) >= 2) darts.push(line.map(move));
  }
  return { run, tags: runTags, darts, move };
}

/** The height where a line across the centre crosses it. */
function centreCrossing(pts: P[]): number {
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].x * pts[i].x <= 0 && pts[i - 1].x !== pts[i].x) return lerp(pts[i - 1], pts[i], pts[i - 1].x / (pts[i - 1].x - pts[i].x)).y;
  return Math.max(...pts.map((q) => q.y));
}

/** The half run and its mirror, as one closed outline. */
const whole = (run: P[]) => [...run, ...mirror([...run].reverse())];

/** The points of the run along edges tagged `tag`, in one or more stretches. */
function along(h: Half, tag: string | string[]): P[][] {
  const want = Array.isArray(tag) ? tag : [tag];
  const out: P[][] = [];
  h.tags.forEach((t, i) => {
    if (!want.includes(t)) return;
    const last = out[out.length - 1];
    if (last && last[last.length - 1] === h.run[i]) last.push(h.run[i + 1]);
    else out.push([h.run[i], h.run[i + 1]]);
  });
  return out;
}

const both = (pts: P[]) => [pts, mirror(pts)];

/** An elastic waist's gathers: short strokes across the band and just below it. */
function gathers(a: P, b: P, band: number): FlatView['lines'] {
  const n = Math.max(3, Math.round(len(sub(b, a)) / 1.6));
  return Array.from({ length: n }, (_, i) => {
    const q = add(a, mul(sub(b, a), (i + 0.5) / n));
    return { pts: [p(q.x, q.y - band + 0.4), p(q.x + 0.1, q.y + 1.2)], kind: 'seam' as const };
  });
}

/**
 * An in-seam pocket seen through the front: its bag drawn hidden (dashed) beside the side seam, from
 * `top` down to `bottom` on a side line that runs from `a` to `b`, with bar tacks at the opening's ends.
 */
function pocketBag(a: P, b: P, opening: [number, number], inwardX: number): FlatView['lines'] {
  const along = unit(sub(b, a));
  const at = (d: number, inX: number) => add(add(a, mul(along, d)), p(inX * inwardX, 0));
  const top = opening[0] - 2;
  const foot = opening[1] + 3;
  const bag = [at(foot, 0), at(foot + 6, 3), at(foot + 8, 8), at(foot + 5, 13), at(top + 3, 13), at(top, 10), at(top, 0)];
  const tack = (d: number) => ({ pts: [at(d, -0.5), at(d, 0.9)], kind: 'seam' as const });
  return [{ pts: bag, kind: 'stitch' }, tack(opening[0]), tack(opening[1])];
}

/** A centre back zip: the seam down from `top`, the pull at the top and a stop at the bottom. */
function zip(top: number, cm: number): FlatView['lines'] {
  return [
    { pts: [p(0, top), p(0, top + cm)], kind: 'zip' },
    { pts: [p(-0.35, top + 0.3), p(0.35, top + 0.3), p(0.35, top + 1.8), p(-0.35, top + 1.8), p(-0.35, top + 0.3)], kind: 'seam' },
    { pts: [p(-0.6, top + cm), p(0.6, top + cm)], kind: 'seam' },
  ];
}

/** Front and back side by side, from the top left at 0, 0. */
function arrange(views: Omit<FlatView, 'at' | 'origin'>[]): Flat {
  const all = (v: Omit<FlatView, 'at' | 'origin'>) => [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)];
  const top = Math.min(...views.flatMap((v) => all(v).map((q) => q.y)));
  const bottom = Math.max(...views.flatMap((v) => all(v).map((q) => q.y)));
  let x = 0;
  const placed = views.map((v) => {
    const xs = all(v).map((q) => q.x);
    const dx = x - Math.min(...xs);
    x += Math.max(...xs) - Math.min(...xs) + GAP;
    const shift = (q: P) => p(q.x + dx, q.y - top);
    return {
      label: v.label,
      shapes: v.shapes.map((s) => s.map(shift)),
      lines: v.lines.map((l) => ({ ...l, pts: l.pts.map(shift) })),
      at: p(dx, bottom - top),
      origin: p(dx, -top),
      sleeves: v.sleeves,
    };
  });
  return { views: placed, width: x - GAP, height: bottom - top };
}

/**
 * A circle skirt's flat can't come from its pieces laid open, so it is drawn as it hangs: the waist
 * at its finished width, the fullness falling in soft folds to a wide hem.
 */
function circleHalf(d: SkirtDraft, back: boolean): { shapes: P[][]; lines: FlatView['lines']; waist: P[] } {
  const w = d.finishedWaist / 4;
  const L = d.lengthCm;
  const share = d.circleShare ?? 1;
  const H = w + L * (0.22 + 0.33 * share);
  const folds = 3;
  const per = 8;
  const hem: P[] = [];
  for (let i = 0; i <= folds * per; i++) {
    const t = i / (folds * per);
    hem.push(p(H * (1 - t), L + 1.2 * Math.cos(t * folds * 2 * Math.PI)));
  }
  const top = back ? 0.6 : 0;
  const run = [p(0, top), p(w, 0), p(H, hem[0].y), ...hem];
  // A soft fold falls from the waist to each rise in the hem.
  const lines: FlatView['lines'] = [];
  for (let f = 0; f < folds; f++) {
    const at = hem[f * per + per / 2];
    const from = p(w * (at.x / H) * 0.85, L * 0.12);
    lines.push(...both([from, p(at.x, at.y - 0.4)]).map((pts) => ({ pts, kind: 'seam' as const })));
  }
  return { shapes: [whole(run)], lines, waist: [p(0, top), p(w, 0)] };
}

type RawView = Omit<FlatView, 'at' | 'origin'>;

/**
 * One view's shapes in the pieces' own coordinates (the centre at x = 0, y as drafted), as the Style page
 * lays the garment on the form. The sleeves are left out unless asked for: on the form they hang on the arms.
 */
export function wornShapes(flat: Flat, view = 0, withSleeves = false): P[][] {
  const v = flat.views[view];
  if (!v) return [];
  const sleeves = new Set(withSleeves ? [] : v.sleeves ?? []);
  return v.shapes.filter((_, i) => !sleeves.has(i)).map((s) => s.map((q) => p(q.x - v.origin.x, q.y - v.origin.y)));
}

/** One view's lines (seams, darts, stitching, zip) in the pieces' own coordinates, as `wornShapes` gives its shapes. */
export function wornLines(flat: Flat, view = 0): P[][] {
  const v = flat.views[view];
  if (!v) return [];
  return v.lines.map((l) => l.pts.map((q) => p(q.x - v.origin.x, q.y - v.origin.y)));
}

/** The skirt: waistband, darts, centre back seam and zip, and its slit when it has one. */
export function skirtFlat(d: SkirtDraft, belt?: BeltDraft): Flat {
  // A slip, and a faced or high waist, have facings inside, so no band shows.
  const band = !d.faced && !d.waistFinish;
  const views = skirtViews(d, { band, zipCm: d.zipCm });
  return arrange(belt ? views.map((v) => beltOn(v, band ? v.waistY - WAISTBAND_CM / 2 : v.waistY, belt, band ? WAISTBAND_CM : undefined)) : views);
}

/** Where a horizontal line at y crosses the garment's outline, as the half-width there. */
function halfWidthAt(shapes: P[][], y: number): number {
  let x = 0;
  for (const pts of shapes)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a.y > y === b.y > y) continue;
      x = Math.max(x, Math.abs(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)));
    }
  return x;
}

/**
 * A sash round the waist at height y, knotted at the front with its ends hanging, and its belt loops;
 * or loops alone for a belt of your own. On a waistband (`band` cm deep, centred on y) the loops run
 * from its top edge to just below it.
 */
function beltOn<V extends Omit<FlatView, 'at' | 'origin'>>(v: V, y: number, b: BeltDraft, band?: number): V {
  const body = v.shapes.filter((_, i) => !v.sleeves?.includes(i));
  const X = halfWidthAt(body, y) || halfWidthAt(body, y + 1);
  if (!X) return v;
  const shapes = [...v.shapes];
  const w = b.sash?.widthCm ?? b.loops?.holdsCm ?? 3;
  if (b.sash) {
    shapes.push([p(-X - 0.2, y - w / 2), p(X + 0.2, y - w / 2), p(X + 0.2, y + w / 2), p(-X - 0.2, y + w / 2)]);
    if (v.label === 'FRONT') shapes.push(...tieKnot(p(0.5, y)));
  }
  if (b.loops) {
    const [top, foot] = band ? [y - band / 2, y + band / 2 + 0.6] : [y - w / 2 - 0.5, y + w / 2 + 0.5];
    const xs = b.sash ? [X - 0.9] : [X * 0.5];
    for (const x of xs) for (const s2 of [1, -1]) shapes.push([p(s2 * x - 0.5, top), p(s2 * x + 0.5, top), p(s2 * x + 0.5, foot), p(s2 * x - 0.5, foot)]);
  }
  return { ...v, shapes };
}

/**
 * A piece cut whole, as it hangs: its own outline (the two sides may differ), darts sewn, and for a
 * front with the zip in its left side seam (the +x side), the zip down that seam from the waist.
 */
function wholeView(pc: Piece, zipCm?: number): { shapes: P[][]; lines: FlatView['lines']; waist: P[] } {
  const h = sewn(pc);
  const run = h.run.slice(0, -1);
  const lines: FlatView['lines'] = h.darts.map((pts) => ({ pts, kind: 'dart' as const }));
  // The waist from the -x side round to the +x side, for a band above it.
  const stretches = along(h, ['waist', 'dart']);
  const waist = stretches.length > 1 ? [...stretches[stretches.length - 1], ...stretches[0].slice(1)] : stretches[0] ?? [run[0]];
  if (zipCm) lines.push(...sideZip(along(h, 'side')[0] ?? [], zipCm));
  return { shapes: [run], lines, waist };
}

/** A zip down the +x side seam from its top, `cm` long, just inside the edge. */
function sideZip(side: P[], cm: number): FlatView['lines'] {
  const pts: P[] = [];
  let acc = 0;
  for (let i = 0; i < side.length && acc < cm; i++) {
    if (i) acc += len(sub(side[i], side[i - 1]));
    pts.push(add(side[i], p(-0.4, 0)));
  }
  return pts.length > 1 ? [{ pts, kind: 'zip' }, { pts: [add(pts[pts.length - 1], p(-0.6, 0)), add(pts[pts.length - 1], p(0.6, 0))], kind: 'seam' }] : [];
}

/**
 * The skirt's views, with their waist at the top. A dress's skirt has no waistband, and its zip is
 * drawn with the bodice's, so the centre back seam starts at `seamFrom` above the waist.
 */
function skirtViews(d: SkirtDraft, opts: { band: boolean; zipCm?: number; seamFrom?: number }): (RawView & { waistY: number })[] {
  return (['FRONT', 'BACK'] as const).map((label, i) => {
    const back = i === 1;
    let shapes: P[][];
    let lines: FlatView['lines'] = [];
    let waist: P[];
    let hemY: number;
    let seamY: number | undefined;
    const wholePc = d.pieces[i].meta.whole;
    if (d.circleShare) {
      const c = circleHalf(d, back);
      ({ shapes, lines, waist } = c);
      hemY = d.lengthCm;
    } else if (wholePc) {
      // Cut whole: drawn from the whole piece, so a hem that differs side to side shows as it is.
      ({ shapes, lines, waist } = wholeView(d.pieces[i], !back && d.opening === 'left_side' ? d.zipCm : undefined));
      hemY = d.lengthCm;
    } else {
      // Pleats are drawn on the skirt as it hangs; knife and box pleats take the darts' place.
      const pleated = !!(d.volume?.pleats || d.volume?.inverted) && !!d.block;
      const h = sewn((pleated ? d.block! : (d.low ?? d.pieces))[i]);
      waist = along(h, ['waist', 'dart'])[0] ?? [h.run[0]];
      lines = d.volume?.pleats ? [] : h.darts.flatMap((dt) => both(dt).map((pts) => ({ pts, kind: 'dart' as const })));
      let run = h.run;
      // A high waist carries on up past the waist, its darts running on to the top.
      if (d.low && d.waistFinish === 'high') {
        const rise = (d.pieces[i].meta.rise as number | undefined) ?? HIGH.rise;
        const xs = waist[waist.length - 1].x || 1;
        const top = waist.map((q) => p(q.x + HIGH.sideOut * (q.x / xs) ** 4, q.y - rise));
        run = [...top, ...h.run.slice(waist.length - 1)];
        lines = lines.map((l) => ({ ...l, pts: [p(l.pts[0].x, l.pts[0].y - rise), ...l.pts] }));
        waist = top;
      }
      shapes = [whole(run)];
      // The zip in the left side seam: on the right of the front as drawn.
      if (!back && d.opening === 'left_side' && opts.zipCm) {
        lines.push(...sideZip(run.slice(waist.length - 1), opts.zipCm));
      }
      hemY = h.run[h.run.length - 1].y;
      // A side slit opens the left side seam: on the right of the front as drawn, the left of the back.
      if (d.slit?.at === 'side') {
        const k = h.tags.findIndex((t, j) => t === 'hem' && h.tags[j - 1] === 'side');
        if (k > 0) {
          const foot = h.run[k];
          const top = yOn(h.run.slice(0, k + 1), foot.y - d.slit.cm) ?? foot;
          const s = back ? -1 : 1;
          lines.push(...[-0.4, 0.4].map((dx) => ({ pts: [p(s * top.x, top.y), p(s * (foot.x + dx), foot.y)], kind: 'seam' as const })));
        }
      }
      if (d.volume) {
        const v = volumeFlat(d, i, h, hemY);
        shapes.push(...v.shapes);
        lines.push(...v.lines);
        hemY = v.hemY;
        seamY = v.seamTo ?? hemY;
      }
      // The pocket bag, where it hangs behind the front.
      const bag = d.pieces.find((pc) => pc.kind === 'pocket');
      if (bag && !back) {
        const pts = bag.outline.points(8).map(h.move);
        lines.push(...both(pts).map((q) => ({ pts: q, kind: 'stitch' as const })));
      }
    }
    if (d.pocket && !back && d.circleShare) {
      const side = shapes[0].slice(0, 3);
      lines.push(...[1, -1].flatMap((s) => pocketBag(p(side[1].x * s, side[1].y), p(side[2].x * s, side[2].y), d.pocket!, -s)));
    }
    // The waistband sits above the waist, as wide as it, gathered on an elastic waist.
    const band = [...waist, ...[...waist].reverse().map((q) => p(q.x, q.y - WAISTBAND_CM))];
    if (opts.band) shapes.push(wholePc ? band : whole(band));
    // A wrap skirt's ties knot at the side, where the band runs on past the top front's edge.
    if (opts.band && d.wrap?.ties && !back) shapes.push(...tieKnot(add(waist[waist.length - 1], p(0, -WAISTBAND_CM / 2))));
    if (opts.band && d.elastic) for (const run of [waist, mirror(waist)]) lines.push(...gathers(run[0], run[run.length - 1], WAISTBAND_CM));
    // A gathered skirt shows its gathers under the band or the bodice seam.
    else if (d.gathers) for (const run of [waist, mirror(waist)]) lines.push(...gathers(run[0], run[run.length - 1], opts.band ? WAISTBAND_CM : 0));
    const cbTop = wholePc ? waist[Math.floor(waist.length / 2)].y : waist[0].y;
    // A back cut whole has no centre back seam: the zip is in the left side seam. A pull-on back is cut on the fold.
    if (back && !wholePc && !d.pieces[1].fold) {
      const from = cbTop - (opts.band ? WAISTBAND_CM : (opts.seamFrom ?? 0));
      if (d.slit?.at === 'back') {
        const top = hemY - d.slit.cm;
        lines.push({ pts: [p(0, from), p(0, top)], kind: 'seam' });
        lines.push({ pts: [p(0, top), p(-0.5, hemY)], kind: 'seam' }, { pts: [p(0, top), p(0.5, hemY)], kind: 'seam' });
      } else lines.push({ pts: [p(0, from), p(0, seamY ?? hemY)], kind: 'seam' });
      if (opts.zipCm && d.opening !== 'left_side') lines.push(...zip(cbTop, opts.zipCm));
    }
    // A front slit opens the centre front seam.
    if (!back && d.slit?.at === 'front') {
      const top = hemY - d.slit.cm;
      lines.push({ pts: [p(0, cbTop - (opts.band ? WAISTBAND_CM : (opts.seamFrom ?? 0))), p(0, top)], kind: 'seam' });
      lines.push({ pts: [p(0, top), p(-0.5, hemY)], kind: 'seam' }, { pts: [p(0, top), p(0.5, hemY)], kind: 'seam' });
    }
    return { label, shapes, lines, waistY: cbTop };
  });
}

/** The point on a polyline at height y, by its last crossing. */
function yOn(pts: P[], y: number): P | undefined {
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return lerp(a, b, (y - a.y) / (b.y - a.y));
  }
  return undefined;
}

/**
 * The skirt's pleats, godets, flounce or tiers on its flat, over the half as sewn: pleat folds stitched
 * down to the hip, godets opening out below their points, a flounce rippling out below its seam, and
 * tiers widening down from the yoke with their gathers. Where the centre back seam stops, when it stops
 * short of the hem (tiers are rings).
 */
function volumeFlat(d: SkirtDraft, i: number, h: Half, hemY: number): { shapes: P[][]; lines: FlatView['lines']; hemY: number; seamTo?: number } {
  const v = d.volume!;
  const shapes: P[][] = [];
  const lines: FlatView['lines'] = [];
  const add2 = (pts: P[], kind: FlatLineKind) => lines.push(...both(pts).map((q) => ({ pts: q, kind })));
  if (v.pleats) {
    for (const f of v.folds?.[i] ?? []) {
      add2([h.move(f.top), h.move(f.hip)], 'stitch');
      add2([h.move(f.hip), h.move(f.hem)], 'seam');
    }
    return { shapes, lines, hemY };
  }
  if (v.inverted) {
    const hip = d.block![0].balance?.[0]?.pts[0].y ?? hemY / 3;
    const top = i === 0 ? h.run[0].y : (v.inverted.backFrom ?? hemY) + h.run[0].y;
    if (i === 0) {
      lines.push({ pts: [p(0, hip), p(0, hemY)], kind: 'seam' });
      add2([p(0.5, top), p(0.5, hip)], 'stitch');
    } else if (v.inverted.backFrom !== undefined) add2([p(0, top), p(1.5, top - 0.8)], 'stitch');
    return { shapes, lines, hemY };
  }
  if (v.godets) {
    const w = v.godets.hemWidth * 0.3;
    const slashes = v.slashes?.[i] ?? [];
    slashes.forEach(([top, hem], k) => {
      const a = h.move(top);
      const b = h.move(hem);
      // A godet in the side seam (the last, when there are side godets) swings the silhouette out; one
      // in a slash opens a V below its point.
      if (v.godets!.inSeams && k === slashes.length - 1) {
        const out = [a, b, p(b.x + w, b.y - 0.3)];
        shapes.push(out, mirror(out));
      } else {
        add2([a, p(b.x - w / 2, b.y)], 'seam');
        add2([a, p(b.x + w / 2, b.y)], 'seam');
      }
    });
    return { shapes, lines, hemY };
  }
  const tag = v.flounce ? 'flounce' : 'tier';
  const join = along(h, tag)[0];
  if (!join) return { shapes, lines, hemY };
  const [side, centre] = [join[0], join[join.length - 1]];
  if (v.flounce) {
    const D = v.flounce.depth;
    const out = D * 0.6;
    const folds = 3;
    const per = 8;
    const W = side.x + out;
    const hem: P[] = [];
    for (let k = 0; k <= folds * per; k++) {
      const t = k / (folds * per);
      hem.push(p(W * (1 - t), lerp(p(0, side.y + D), p(0, centre.y + D), t).y + 1 * Math.cos(t * folds * 2 * Math.PI)));
    }
    shapes.push(whole([...[...join].reverse(), ...hem]));
    for (let f = 0; f < folds; f++) {
      const at = hem[f * per + per / 2];
      add2([p((side.x * at.x) / W, lerp(centre, side, at.x / W).y + 1), p(at.x, at.y - 0.4)], 'seam');
    }
    return { shapes, lines, hemY: hem[hem.length - 1].y };
  }
  // Tiers: each a little wider than the one above, gathered into the seam.
  let top = { left: centre.y, right: side };
  for (const b of v.tiers?.bands ?? []) {
    const right = p(top.right.x + b.depth * 0.22, top.right.y + b.depth);
    const left = top.left + b.depth;
    shapes.push(whole([p(0, top.left), top.right, right, p(0, left)]));
    for (let k = 1; k <= 6; k++) {
      const x = (top.right.x * k) / 7;
      const y = top.left + (top.right.y - top.left) * (k / 7);
      add2([p(x, y + 0.4), p(x + 0.1, y + 1.8)], 'seam');
    }
    top = { left, right };
  }
  return { shapes, lines, hemY: top.left, seamTo: centre.y };
}

/** A quadratic curve from `a` to `b`, pulled toward `c`. */
function quad(a: P, c: P, b: P, n = 12): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return add(add(mul(a, (1 - t) * (1 - t)), mul(c, 2 * t * (1 - t))), mul(b, t * t));
  });
}

/** How far a flat's sleeve is turned out from hanging straight down, in radians: 20 to 40 degrees. */
const MIN_SLEEVE_TURN = 0.35;
const MAX_SLEEVE_TURN = 0.72;

/**
 * A sleeve hanging from one half's armhole, drawn as it lies flat: the outer fold from the shoulder
 * point, the underseam from the underarm, half the finished bicep apart. The sleeve is turned out
 * until it is that wide, up to about 40 degrees; past that the crown rounds out a little over the
 * shoulder, and the rest is drawn narrower to scale, as flats are. Gathered sleeves billow into their band.
 */
function sleeveSide(h: Half, sl: SleeveDraft): { shape: P[]; band?: P[]; lines: FlatView['lines']; seam?: P[] } {
  const arm = along(h, 'armhole')[0];
  if (!arm) return { shape: [], lines: [] };
  const hole = arm[0].y <= arm[arm.length - 1].y ? arm : [...arm].reverse();
  const S = hole[0];
  const U = hole[hole.length - 1];
  const v = sub(U, S);
  // Turn the sleeve out until the underarm is half the bicep from its outer fold.
  const half = sl.bicep / 2;
  let lo = 0.1;
  let hi = 1.2;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    if (Math.sin(t) * v.y - Math.cos(t) * v.x < half) lo = t;
    else hi = t;
  }
  const t = Math.max(MIN_SLEEVE_TURN, Math.min((lo + hi) / 2, MAX_SLEEVE_TURN));
  const a = p(Math.sin(t), Math.cos(t));
  const n = p(-Math.cos(t), Math.sin(t));
  // Where the outer fold runs: half the bicep out from the underarm. The crown rounds out to meet it.
  const O = add(U, mul(n, -half));
  const Os = add(O, mul(a, (S.x - O.x) * a.x + (S.y - O.y) * a.y));
  const reach = Math.sin(t) * v.y - Math.cos(t) * v.x;
  const gap = Math.max(0, half - reach);
  const out = Math.min(gap, 1.5);
  const k = (Math.min(reach, half) + out) / half;
  const Oh = add(S, mul(sub(Os, S), out / Math.max(gap, 1e-6)));
  const head = out > 0.3 ? quad(S, add(Oh, mul(a, -out * 0.3)), add(Oh, mul(a, out * 2.5)), 8) : [S];
  const top = head[head.length - 1];
  const gathered = !!sl.gathers;
  // A cuff is drawn as the band it is, as deep as it is finished; elastic as its casing.
  const band = sl.cuff ? sl.cuff.depth : gathered ? BAND_CM : 0;
  const L = sl.lengthCm - band;
  const Ho = add(S, add(sub(top, S), mul(a, L - len(sub(top, S)))));
  const lines: FlatView['lines'] = [];
  if (!gathered) {
    const Hi = add(Ho, mul(n, (k * sl.hemCm) / 2));
    const shape = [...head, Ho, Hi, U, ...[...hole].reverse().slice(1, -1)];
    const lift = 2;
    lines.push({ pts: [add(Ho, mul(a, -lift)), add(Hi, mul(a, -lift))], kind: 'stitch' });
    // The wrist vent: a short slit up the underseam from the hem.
    if (sl.vent) lines.push({ pts: [add(Hi, mul(n, -0.4)), add(add(Hi, mul(n, -0.4)), mul(a, -sl.vent.lengthCm))], kind: 'seam' });
    // A two-piece sleeve's back seam, seen from the back: from above the back notch down to the wrist.
    let seam: P[] | undefined;
    if (sl.pieces.some((pc) => pc.meta.tailored)) {
      // Parallel to the sleeve, 45% of the way in from its outer fold, up to where it meets the armhole.
      const end = lerp(Ho, Hi, 0.45);
      const mid = lerp(top, U, 0.45);
      const dir = unit(sub(mid, end));
      const off = (q: P) => Math.abs((q.x - end.x) * dir.y - (q.y - end.y) * dir.x);
      const start = hole.reduce((best, q) => (off(q) < off(best) ? q : best), hole[0]);
      seam = [start, end];
    }
    return { shape, lines, seam };
  }
  // A gathered sleeve: the band at the hem, the sleeve billowing above it.
  const w = (k * sl.hemCm) / 2;
  const mid = add(Ho, mul(n, w / 2));
  const Bo = add(mid, mul(n, -w / 2));
  const Bi = add(mid, mul(n, w / 2));
  const puff = sl.gathers?.crown !== undefined;
  const swell = puff ? 2.5 : 4;
  const outer = [...head.slice(0, -1), ...quad(top, add(add(top, mul(a, L * (puff ? 0.45 : 0.7))), mul(n, -swell)), Bo)];
  const inner = quad(Bi, add(add(U, mul(sub(Bi, U), puff ? 0.55 : 0.75)), mul(n, swell)), U);
  const shape = [...outer, ...inner, ...[...hole].reverse().slice(1, -1)];
  const bandShape = [Bo, Bi, add(Bi, mul(a, band)), add(Bo, mul(a, band))];
  // Gathering: short strokes fanning into the band, and over the crown of a puff sleeve.
  for (let i = 1; i < 6; i++) {
    const q = add(Bo, mul(sub(Bi, Bo), i / 6));
    lines.push({ pts: [q, add(q, add(mul(a, -2.2), mul(n, (i / 6 - 0.5) * 1.6)))], kind: 'seam' });
  }
  if (puff)
    for (let i = 2; i < hole.length - 2; i += Math.max(1, Math.floor(hole.length / 6))) {
      const q = hole[i];
      lines.push({ pts: [q, add(q, mul(unit(sub(q, mul(add(S, U), 0.5))), -1.6))], kind: 'seam' });
    }
  // A shirt cuff's button near its outer end; a tie cuff's ties hanging from the inner side.
  if (sl.cuff?.kind === 'shirt') {
    const c = add(lerp(Bo, Bi, 0.18), mul(a, band / 2));
    lines.push({ pts: Array.from({ length: 13 }, (_, j) => add(c, p(0.5 * Math.cos((j / 12) * 2 * Math.PI), 0.5 * Math.sin((j / 12) * 2 * Math.PI)))), kind: 'seam' });
  }
  if (sl.cuff?.kind === 'tie') {
    const knot = add(Bi, mul(a, band / 2));
    lines.push({ pts: [knot, add(knot, add(mul(a, 7), mul(n, 1.5)))], kind: 'seam' }, { pts: [knot, add(knot, add(mul(a, 6), mul(n, 3)))], kind: 'seam' });
  }
  return { shape, band: bandShape, lines };
}

/** A run offset by d, square to it, to the side away from `from`. */
function offsetRun(run: P[], d: (i: number) => number, from: P): P[] {
  return run.map((q, i) => {
    const t = unit(sub(run[Math.min(i + 1, run.length - 1)], run[Math.max(i - 1, 0)]));
    let n = p(-t.y, t.x);
    if ((q.x - from.x) * n.x + (q.y - from.y) * n.y < 0) n = mul(n, -1);
    return add(q, mul(n, d(i)));
  });
}

/** The collar as seen on the flat, half of it from the centre: a band standing up from the neck, a
 * Peter Pan lying on the body, or a shirt collar's points over its stand. */
function collarHalf(neck: P[], kind: BodiceDraft['collar'], front: boolean): { a: P[]; b: P[] }[] {
  if (kind === 'none' || neck.length < 2) return [];
  const up = (h: number) => neck.map((q) => p(q.x, q.y - h));
  // A band stands up from the neck: a mock neck leans in a little to hug it, a funnel stands out from it.
  if (isBandCollar(kind)) {
    const lean = kind === 'funnel' ? 1.12 : kind === 'mock' ? 0.96 : 1;
    return [{ a: neck, b: up(BANDS[kind].height).map((q) => p(q.x * lean, q.y)) }];
  }
  if (kind === 'peter_pan') {
    const L = neck.reduce((s2, q, i) => (i ? s2 + len(sub(q, neck[i - 1])) : 0), 0);
    let acc = 0;
    const w = neck.map((q, i) => {
      if (i) acc += len(sub(q, neck[i - 1]));
      return front ? 6 * Math.sqrt(Math.min(1, acc / Math.min(5, L))) : 6;
    });
    return [{ a: neck, b: offsetRun(neck, (i) => w[i], p(0, -100)) }];
  }
  // A pussy bow: the folded strip lying round the neck, and at the front its loops and the ties hanging.
  if (kind === 'bow') {
    const parts = [{ a: neck, b: offsetRun(neck, () => 2, p(0, -100)) }];
    if (front) {
      const k = neck[0];
      const curve = (a: P, c: P, b: P) => Array.from({ length: 9 }, (_, j) => {
        const t = j / 8;
        return p((1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y);
      });
      // The loop, out to the side and back to the knot; the tie, falling and swinging out a little.
      parts.push({ a: curve(k, add(k, p(5, -5)), add(k, p(9.5, -0.5))), b: curve(k, add(k, p(5.5, 4.5)), add(k, p(9.5, -0.5))) });
      parts.push({ a: curve(k, add(k, p(0.6, 9)), add(k, p(3, 20))), b: curve(k, add(k, p(3.6, 9)), add(k, p(6.6, 19.2))) });
    }
    return parts;
  }
  // Shirt: the stand, and the collar falling from its top edge over it, to a point at the front.
  const stand = up(2.6);
  const fall = offsetRun(neck, () => (front ? 3.2 : 4.5), p(0, -100));
  if (front) fall[0] = add(neck[0], p(2.2, 6));
  return [{ a: neck, b: stand }, { a: stand, b: fall }];
}

/** Both halves of a collar part (each run starting at the centre line), as one outline when it is
 * one piece across the centre, or as two meeting there. */
function collarShapes(c: { a: P[]; b: P[] }, joined: boolean): P[][] {
  const half = [...c.a, ...[...c.b].reverse()];
  if (!joined) return [half, mirror(half)];
  return [[...mirror(c.a).reverse(), ...c.a.slice(1), ...[...c.b].reverse(), ...mirror(c.b).slice(1)]];
}

/**
 * The one-shoulder bodice's view, drawn from the sewn half: the covered half on the wearer's left (the
 * right of a front view, the left of a back view), the bare half from under the arm, and the top edge
 * between them, as drafted.
 */
function oneShoulderView(d: BodiceDraft, h: Half, i: number, edges: BodiceEdges): RawView & { foot: number } {
  // Cut for the right shoulder, the whole view turns over.
  const turn = d.drape?.side === 'right' ? -1 : 1;
  const k = (i === 0 ? 1 : -1) * turn;
  const iSh = h.tags.indexOf('shoulder');
  const iS = h.tags.indexOf('side');
  let j = iS;
  let acc = 0;
  while (h.tags[j + 1] === 'side' && acc + len(sub(h.run[j + 1], h.run[j])) < UNDER_ARM) {
    acc += len(sub(h.run[j + 1], h.run[j]));
    j++;
  }
  const seg = len(sub(h.run[j + 1], h.run[j]));
  const U = lerp(h.run[j], h.run[j + 1], seg ? Math.min(1, (UNDER_ARM - acc) / seg) : 0);
  const down = unit(sub(h.run[j + 1], h.run[j]));
  const cov = h.run.slice(iSh).map((q) => p(q.x * k, q.y));
  const bare = [U, ...h.run.slice(j + 1)].map((q) => p(-q.x * k, q.y));
  const N = cov[0];
  const toward = (a: P, t: P) => {
    const n = p(-a.y, a.x);
    return n.x * t.x + n.y * t.y >= 0 ? n : mul(n, -1);
  };
  // The edge's point over the bust (or clear of the back dart), from the drafted piece.
  const drafted = d.pieces[i].draft?.points.find((pt) => pt.n === 'V')?.at;
  const mv = (q: P) => {
    const m = h.move(p(Math.abs(q.x), q.y));
    return p(Math.sign(q.x) * m.x, m.y);
  };
  const V = drafted ? ((q) => p(q.x * turn, q.y))(mv(drafted)) : p(bare[0].x * 0.5, bare[0].y - 5);
  const edge = oneShoulderEdge(bare[0], toward(p(-down.x * k, down.y), p(k, 0)), V, N, toward(unit(sub(cov[1], N)), p(0, 1)));
  const shape = [...cov, ...[...bare].reverse().slice(1), ...edge.slice(1, -1)];
  const lines: FlatView['lines'] = h.darts
    .flatMap((dt) => both(dt))
    // Darts above the edge on the bare side go; one end of each sits on the outline, so test just in from it.
    .filter((dt) => [0.1, 0.9].every((t) => inside(lerp(dt[0], dt[dt.length - 1], t), shape)))
    .map((pts) => ({ pts, kind: 'dart' as const }));
  if (edges === 'binding')
    for (const run of [edge, ...along(h, 'armhole').map((r) => r.map((q) => p(q.x * k, q.y)))]) for (const r of inset(run, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
  if (d.finishedHem !== undefined)
    for (const run of along(h, 'hem')) for (const pts of [run, mirror(run)]) for (const r of inset(pts, 2, shape)) lines.push({ pts: r, kind: 'stitch' });
  return { label: i === 0 ? 'FRONT' : 'BACK', shapes: [shape], lines, foot: h.run[h.run.length - 1].y };
}

/** The cowl front's neckline as it hangs: a soft curve from neck point to neck point, `depthCm` below the
 * block's neck at the centre, with the folds of the drape falling inside it. */
function cowlFront(d: BodiceDraft, h: Half, v: RawView & { foot: number }): RawView & { foot: number } {
  const iSh = h.tags.indexOf('shoulder');
  const N = h.run[iSh];
  const Y = h.move(p(0, d.neckBlock.front.neckY + (d.drape?.depthCm ?? COWL_DEPTH))).y;
  const hang = (a: P, y: number) => quad(p(0, y), p(a.x * 0.55, y), a, 14);
  const run = [...hang(N, Y), ...h.run.slice(iSh + 1)];
  const shape = whole(run);
  // The bust dart is closed into the drape, and the waist dart too when the drape took all of it.
  const waistDart = d.pieces[0].lines.some((ln) => ln.points().length >= 3);
  const lines = v.lines.filter((l) => {
    if (l.kind !== 'dart') return true;
    const [a, b] = [l.pts[0], l.pts[l.pts.length - 1]];
    return waistDart && Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  });
  // The folds: each from a little along the shoulder down to the centre below the edge.
  const sh = unit(sub(h.run[iSh + 1], N));
  for (let f = 1; f <= 3; f++) {
    const from = add(N, mul(sh, 1.4 * f));
    const pts = hang(from, Y + 2.4 * f).filter((q) => inside(q, shape));
    if (pts.length > 2) lines.push(...both(pts).map((q) => ({ pts: q, kind: 'seam' as const })));
  }
  return { ...v, shapes: [shape, ...v.shapes.slice(1)], lines };
}

/** The peplum below the waist seam: a flared one rippling to a wide hem, a gathered one hanging
 * straighter from its gathers; each with its narrow hem stitched. */
function withPeplumView(d: BodiceDraft, h: Half, v: RawView & { foot: number }): RawView & { foot: number } {
  if (!d.peplum) return v;
  const lastSide = h.tags.lastIndexOf('side');
  const waist = h.run.slice(lastSide + 1).reverse();
  const ws = waist[waist.length - 1];
  const D = d.peplum.depthCm;
  const flared = d.peplum.kind === 'flared';
  const H = ws.x + D * (flared ? 0.55 : 0.18);
  const folds = flared ? 3 : 5;
  const per = 8;
  const amp = flared ? 1.2 : 0.4;
  const hem: P[] = [];
  for (let s = 0; s <= folds * per; s++) {
    const t = s / (folds * per);
    hem.push(p(H * (1 - t), ws.y + D + amp * Math.cos(t * folds * 2 * Math.PI)));
  }
  const shape = whole([...waist, ...hem]);
  const lines: FlatView['lines'] = [...v.lines];
  lines.push(...both(hem.map((q) => p(q.x, q.y - 0.6)).filter((q) => q.x < H - 0.4)).map((pts) => ({ pts, kind: 'stitch' as const })));
  if (flared)
    for (let f = 0; f < folds; f++) {
      const at = hem[f * per + per / 2];
      lines.push(...both([p(ws.x * (at.x / H) * 0.85, ws.y + D * 0.15), p(at.x, at.y - 0.4)]).map((pts) => ({ pts, kind: 'seam' as const })));
    }
  else
    for (let s = 1; s < 8; s++) {
      const x = (ws.x * s) / 8;
      const y = ws.y + ((waist[0].y - ws.y) * (ws.x - x)) / Math.max(ws.x, 1);
      lines.push(...both([p(x, y + 0.3), p(x + (H - ws.x) * (x / ws.x), y + 2.6)]).map((pts) => ({ pts, kind: 'seam' as const })));
    }
  return { ...v, shapes: [v.shapes[0], shape, ...v.shapes.slice(1)], lines, sleeves: v.sleeves?.map((j) => j + 1) };
}

/** A boned bodice's side seam channel: just inside the seam, stopping short of the top edge and the waist. */
function sideChannel(h: Half, shape: P[]): FlatView['lines'] {
  const run = along(h, 'side').sort((a, b) => b.length - a.length)[0];
  if (!run) return [];
  const out: FlatView['lines'] = [];
  for (const r of inset(run, 0.6, shape)) {
    const L = r.reduce((t, q, k) => (k ? t + len(sub(q, r[k - 1])) : 0), 0);
    let acc = 0;
    const keep = r.filter((q, k) => {
      if (k) acc += len(sub(q, r[k - 1]));
      return acc >= 2 && acc <= L - 1.5;
    });
    if (keep.length > 1) for (const pts of both(keep)) out.push({ pts, kind: 'stitch' });
  }
  return out;
}

/** A wrap front as worn, in the flat's coordinates: the V neckline from neck point to neck point (the two
 * fronts' edges down to where they cross), the top front's edge on from there to its far side, and its
 * tie knotted there with two tails. */
function wrapEdges(w: NonNullable<BodiceDraft['wrap']>, h: Half): { neck: P[]; lap: P[]; tie: P[][] } {
  const mv = (q: P) => {
    const m = h.move(p(Math.abs(q.x), q.y));
    return p(Math.sign(q.x) * m.x, m.y);
  };
  const top = w.edge.map(mv);
  const ic = top.reduce((best, q, k) => (Math.abs(q.x) < Math.abs(top[best].x) ? k : best), 0);
  const upper = top.slice(ic);
  const neck = [...mirror(upper).reverse(), ...upper.slice(1)];
  return { neck, lap: top.slice(0, ic + 1), tie: tieKnot(top[0]) };
}

/** A knot at `W` with its two tails hanging. */
function tieKnot(W: P): P[][] {
  const knot = [p(W.x - 1.4, W.y - 1), p(W.x + 0.4, W.y - 1), p(W.x + 0.4, W.y + 1.4), p(W.x - 1.4, W.y + 1.4)];
  return [strap([p(W.x - 0.8, W.y + 1), p(W.x - 4, W.y + 16)], 2.2), strap([p(W.x - 0.2, W.y + 1), p(W.x + 1.8, W.y + 13)], 2.2), knot];
}

/** A spaghetti strap from the top edge up to the shoulder, about 6 mm wide as drawn. */
function strap([a, b]: [P, P], width = 0.7): P[] {
  const u = unit(sub(b, a));
  const n = mul(p(-u.y, u.x), width / 2);
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

/** The bodice: darts, the back neck seen over the front, centre back seam and zip, sleeves when it has
 * them, and the stitching that shows: binding round the neck (and the armholes of a sleeveless one),
 * and the hem of a longer top. */
export function bodiceFlat(d: BodiceDraft, edges: BodiceEdges = 'binding', sleeve?: SleeveDraft): Flat {
  return arrange(bodiceViews(d, edges, sleeve, true));
}

/** The bodice's views, and where each meets its waist at the centre. */
function bodiceViews(d: BodiceDraft, edges: BodiceEdges, sleeve: SleeveDraft | undefined, zipped: boolean): (RawView & { foot: number })[] {
  const [bf, bb] = blockOf(d);
  const style = d.styleLines;
  const back = sewn(bb, undefined, style?.skip === 'all' ? 'all' : undefined);
  const backFoot = back.run[back.tags.lastIndexOf('side') + 1].y;
  // A shaped hem hangs as drafted, the front's centre as far from its side seams as its shape says.
  const front = sewn(bf, backFoot, style?.skip, d.hem ? d.hem.front[0] - d.hem.front[d.hem.front.length - 1] : 0);
  const hps = (h: Half) => h.run[h.tags.indexOf('shoulder')];
  return ([front, back] as const).map((h, i) => {
    if (d.drape?.kind === 'one_shoulder') return withPeplumView(d, h, oneShoulderView(d, h, i, edges));
    // An uneven front: both halves to the neck points, and the neckline as drafted across them.
    // A wrap: the top front's edge from its neck point down across the centre front, the under front's
    // the same the other way; the two V edges make the neckline, and the top front's runs on to its tie.
    const wrapped = i === 0 && d.wrap ? wrapEdges(d.wrap, h) : undefined;
    const uneven = i === 0 && d.drape?.kind === 'uneven' ? unevenEdge(d) : wrapped?.neck;
    const fromNeck = uneven ? h.run.slice(h.tags.indexOf('shoulder')) : [];
    const shape = uneven ? [...fromNeck, ...mirror([...fromNeck].reverse()).slice(1), ...uneven.slice(1, -1)] : whole(h.run);
    const frontNeckY = uneven ? centreCrossing(uneven) : front.run[0].y;
    const lines: FlatView['lines'] = h.darts.flatMap((dt) => both(dt).map((pts) => ({ pts, kind: 'dart' as const })));
    for (const sl of (i === 0 ? style?.front : style?.back) ?? []) lines.push(...both(sl.pts.map(h.move)).map((pts) => ({ pts, kind: sl.kind })));
    if (i === 0 && h.tags.includes('shoulder')) {
      // The back neckline shows through a lower front neck.
      const shift = sub(hps(front), hps(back));
      const neck = along(back, 'neck')[0]?.map((q) => add(q, shift));
      if (neck && frontNeckY > neck[0].y + 1) lines.push(...both(neck).map((pts) => ({ pts, kind: 'seam' as const })));
    }
    // A cowl front's neck is finished by its own facing.
    const collared = d.collar !== 'none' || d.closure === 'front_buttons' || (i === 0 && d.drape?.kind === 'cowl');
    // A boned bodice's top edge is lined and understitched, so no stitching shows; its boning is drawn instead.
    if (d.top?.boned) lines.push(...sideChannel(h, shape));
    if (edges === 'binding' && !d.top?.boned) {
      for (const run of [...(collared || uneven ? [] : along(h, 'neck')), ...(sleeve ? [] : along(h, 'armhole'))])
        for (const pts of [run, mirror(run)]) for (const r of inset(pts, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
      if (uneven) for (const r of inset(uneven, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
    }
    if (d.finishedHem !== undefined)
      for (const run of along(h, 'hem')) for (const pts of [run, mirror(run)]) for (const r of inset(pts, 2, shape)) lines.push({ pts: r, kind: 'stitch' });
    if (i === 0 && d.closure === 'front_buttons' && d.buttons) {
      // The right front laps over the left (the left over the right for menswear): its edge, and the buttons on the centre front.
      const top = h.run[0].y;
      const foot = h.run[h.run.length - 1].y;
      const edge = d.lapsLeft ? 1.5 : -1.5;
      lines.push({ pts: [p(edge, top), p(edge, foot)], kind: 'seam' });
      for (const y of d.buttons.at) {
        const c = h.move(p(0, y));
        lines.push({ pts: Array.from({ length: 13 }, (_, k) => add(p(0, c.y), p(0.65 * Math.cos((k / 12) * 2 * Math.PI), 0.65 * Math.sin((k / 12) * 2 * Math.PI)))), kind: 'seam' });
      }
    }
    if (wrapped) {
      lines.push({ pts: wrapped.lap, kind: 'seam' });
      if (edges === 'binding') for (const r of inset(wrapped.lap, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
    }
    if (i === 1 && zipped && d.closure !== 'front_buttons' && d.closure !== 'wrap') {
      const top = h.run[0].y;
      lines.push({ pts: [p(0, top), p(0, h.run[h.run.length - 1].y)], kind: 'seam' }, ...zip(top, d.zipCm));
    }
    const shapes = [shape, ...(wrapped?.tie ?? [])];
    // Spaghetti straps, from the top edge up over the shoulder.
    const st = d.top?.strapAt && (i === 0 ? d.top.strapAt.front : d.top.strapAt.back);
    // A halter's ties are wider bands, rising from the strap ends round the neck.
    if (st) shapes.push(...both(strap([h.move(st[0]), h.move(st[1])], d.top?.ties ? 2 : 0.7)));
    const neckRun = uneven ? undefined : along(h, 'neck')[0];
    const collar = neckRun ? collarHalf(neckRun, d.collar, i === 0) : [];
    const sleeves: number[] = [];
    if (sleeve) {
      const sl = sleeveSide(h, sleeve);
      for (const flip of [false, true]) {
        const f = (pts: P[]) => (flip ? mirror(pts) : pts);
        if (sl.shape.length) sleeves.push(shapes.push(f(sl.shape)) - 1);
        if (sl.band) sleeves.push(shapes.push(f(sl.band)) - 1);
        lines.push(...sl.lines.map((l) => ({ ...l, pts: f(l.pts) })));
      }
    }
    // The collar goes on last, over the sleeves' heads.
    // In one piece across the centre back on a button front; meeting at the zip or the centre front otherwise.
    for (const c of collar) shapes.push(...collarShapes(c, i === 1 && d.closure === 'front_buttons'));
    const view = { label: i === 0 ? ('FRONT' as const) : ('BACK' as const), shapes, lines, sleeves, foot: h.run[h.run.length - 1].y };
    return withPeplumView(d, h, i === 0 && d.drape?.kind === 'cowl' ? cowlFront(d, h, view) : view);
  });
}

/**
 * The dress: the bodice over its skirt, joined at the waist, the darts running on through the seam,
 * and one zip down the centre back from the neck to below the waist.
 */
export function dressFlat(d: DressDraft, edges: BodiceEdges = 'binding', opts: { sleeve?: SleeveDraft; belt?: BeltDraft } = {}): Flat {
  const belt = opts.belt;
  // With no waist seam the bodice runs on to the hem, its fish-eye darts and zip as drawn on it; a sash
  // goes round the natural waist.
  if (d.noSeam) {
    const views = bodiceViews(d.bodice, edges, opts.sleeve, true);
    return arrange(belt ? views.map((v, i) => beltOn(v, (i === 0 ? d.bodice.front : d.bodice.back).waistCentre.y, belt)) : views);
  }
  const top = bodiceViews(d.bodice, edges, opts.sleeve, false);
  const below = skirtViews(d.skirt, { band: false });
  return arrange(
    top.map((b, i) => {
      const view = dressView(b, i);
      // The sash at the natural waist, above or below a moved waist seam.
      return belt ? beltOn(view, b.foot - d.seamDrop, belt) : view;
    }),
  );
  function dressView(b: (typeof top)[number], i: number) {
      const k = below[i];
      const dy = b.foot - k.waistY;
      const move = (pts: P[]) => pts.map((q) => p(q.x, q.y + dy));
      const lines = [...b.lines, ...k.lines.map((l) => ({ ...l, pts: move(l.pts) }))];
      // A shirt dress: the lapped edge and the buttons run on down the skirt front.
      if (b.label === 'FRONT' && d.skirtButtons) {
        const edge = d.bodice.lapsLeft ? 1.5 : -1.5;
        const hemY = k.shapes[0].reduce((m, q) => (Math.abs(q.x) < 0.5 && q.y > m ? q.y : m), -Infinity);
        lines.push({ pts: [p(edge, b.foot), p(edge, hemY + dy)], kind: 'seam' });
        for (const y of d.skirtButtons.at) {
          const c = p(0, k.waistY + y + dy);
          lines.push({ pts: Array.from({ length: 13 }, (_, n) => add(c, p(0.65 * Math.cos((n / 12) * 2 * Math.PI), 0.65 * Math.sin((n / 12) * 2 * Math.PI)))), kind: 'seam' });
        }
      }
      // A one-shoulder dress zips in the side seam, out of sight; a shirt dress or a wrap has no zip.
      if (b.label === 'BACK' && !d.zipSide && !d.skirtButtons && !d.bodice.wrap) {
        const neck = b.shapes[0].reduce((m, q) => (Math.abs(q.x) < 1e-6 && q.y < m ? q.y : m), Infinity);
        lines.push({ pts: [p(0, neck), p(0, b.foot)], kind: 'seam' }, ...zip(neck, d.zipCm));
      }
      return { label: b.label, shapes: [b.shapes[0], ...k.shapes.map(move), ...b.shapes.slice(1)], lines, sleeves: b.sleeves?.map((j) => j + k.shapes.length) };
  }
}

/** A quadratic run of points from a to b pulled toward c, as a list. */
const bend = (a: P, c: P, b: P, n = 10) => quad(a, c, b, n);

/**
 * Trousers, drawn as they lie flat: the waistband, each leg hanging from the hip with its crease down
 * the middle, at half its knee and hem round, and the fly or side zip with its stitching.
 */
export function trousersFlat(d: TrousersDraft, m: { waist_to_hip: number; crotch_depth: number }): Flat {
  return arrange((['FRONT', 'BACK'] as const).map((label) => ({ label, ...trousersView(d, m, label === 'BACK') })));
}

/** One view of the trousers as worn, the waist at y = 0 and the centre front at x = 0: the Style page draws the front on the form. */
export function trousersView(d: TrousersDraft, m: { waist_to_hip: number; crotch_depth: number }, back = false): { shapes: P[][]; lines: FlatView['lines'] } {
  const W = d.finishedWaist / 4;
  const hw = d.finishedHip / 4 + 0.5;
  const hd = m.waist_to_hip;
  const cd = m.crotch_depth + 1;
  const L = d.lengthCm;
  const kn = Math.min(cd + (L - cd) * 0.45, L - 4);
  const xc = hw / 2;
  const knee = Math.max(d.kneeCm / 4, 4);
  const hem = Math.max(d.hemCm / 4, 4);
  {
    const top = back ? -0.8 : 0;
    const run = [
      p(0, top),
      p(W, 0),
      ...bend(p(W, 0), p(hw, hd * 0.45), p(hw, hd)).slice(1),
      ...bend(p(hw, hd), p(hw, (hd + kn) / 2), p(xc + knee, kn)).slice(1),
      p(xc + hem, L),
      p(xc - hem, L),
      p(xc - knee, kn),
      ...bend(p(xc - knee, kn), p(0.4, cd + 2), p(0, cd)).slice(1),
    ];
    const shapes = [whole(run), whole([p(0, top), p(W, 0), p(W, -WAISTBAND_CM), p(0, top - WAISTBAND_CM)])];
    const lines: FlatView['lines'] = [
      { pts: [p(0, top), p(0, cd)], kind: 'seam' },
      ...both([p(xc, hd + 2), p(xc, L)]).map((pts) => ({ pts, kind: 'stitch' as const })),
    ];
    const darts = back ? [0.36, 0.66].slice(0, d.dartsPerSide.back) : [0.5].slice(0, d.dartsPerSide.front);
    for (const f of darts) lines.push(...both([p(W * f, 0), p(W * f + 0.2, back ? 12 : 8)]).map((pts) => ({ pts, kind: 'dart' as const })));
    if (d.elastic) for (const s of [1, -1]) lines.push(...gathers(p(0, top), p(W * s, 0), WAISTBAND_CM));
    // Pockets, on the front: the slant opening and its topstitching, or an in-seam bag behind the side seam.
    const sideAt = (y: number) => (y >= hd ? hw : W + (hw - W) * Math.sin((Math.min(y, hd) / hd) * (Math.PI / 2)));
    if (!back && d.pockets === 'slant') {
      const B = p(sideAt(SLANT.down), SLANT.down);
      const A = p(W - SLANT.in, 0);
      lines.push(...both([A, B]).map((pts) => ({ pts, kind: 'seam' as const })), ...both([add(A, p(-0.7, 0)), add(B, p(-0.7, 0.6))]).map((pts) => ({ pts, kind: 'stitch' as const })));
    }
    if (!back && d.pockets === 'inseam') {
      const o: [number, number] = [INSEAM.top, INSEAM.top + INSEAM.opening];
      // The right side as worn is the viewer's left on the front.
      for (const s of d.pocketSides === 'right' ? [-1] : [1, -1]) lines.push(...pocketBag(p(W * s, 0), p(hw * s, hd + 12), o, -s));
    }
    if (!back && d.closure === 'fly') {
      const z = d.zipCm;
      lines.push({ pts: [p(-3.5, 0), ...bend(p(-3.5, z - 2), p(-3.5, z + 0.5), p(0, z + 1.5))], kind: 'stitch' });
    }
    if (d.closure === 'side_zip') {
      // The left side, as worn: the viewer's right on the back, left on the front.
      const sx = back ? -1 : 1;
      const pts = bend(p(W, 0), p(hw, hd * 0.45), p(hw, hd), 16).filter((q) => q.y <= d.zipCm).map((q) => p(q.x * sx, q.y));
      lines.push({ pts, kind: 'zip' });
    }
    return { shapes, lines };
  }
}

/**
 * The T-shirt: no darts and no opening. The neckband stands up from the neckline with stitching below
 * it, the back neck shows through a lower front, and the sleeves and hem carry twin-needle stitching.
 */
export function teeFlat(d: TeeDraft): Flat {
  const [front, back] = [sewn(d.pieces[0]), sewn(d.pieces[1])];
  const hps = (h: Half) => h.run[h.tags.indexOf('shoulder')];
  const views = ([front, back] as const).map((h, i): RawView => {
    const shape = whole(h.run);
    const lines: FlatView['lines'] = [];
    const neck = along(h, 'neck')[0] ?? [];
    if (i === 0) {
      // The back neckband shows through a lower front neck.
      const shift = sub(hps(front), hps(back));
      const backNeck = along(back, 'neck')[0]?.map((q) => add(q, shift));
      if (backNeck && front.run[0].y > backNeck[0].y + 1) {
        const band = offsetRun(backNeck, () => d.neckband.width, p(0, 1000));
        for (const pts of [...both(backNeck), ...both(band)]) lines.push({ pts, kind: 'seam' });
      }
    }
    for (const run of along(h, 'hem'))
      for (const pts of [run, mirror(run)])
        for (const at of [1.5, 2.1]) for (const r of inset(pts, at, shape)) lines.push({ pts: r, kind: 'stitch' });
    for (const pts of both(neck)) for (const r of inset(pts, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
    const shapes = [shape];
    const sleeves: number[] = [];
    const sl = sleeveSide(h, d.sleeve);
    for (const flip of [false, true]) {
      const f = (pts: P[]) => (flip ? mirror(pts) : pts);
      if (sl.shape.length) sleeves.push(shapes.push(f(sl.shape)) - 1);
      lines.push(...sl.lines.map((l) => ({ ...l, pts: f(l.pts) })));
    }
    // The band on top, standing up from the neckline into the opening.
    if (neck.length > 1) {
      const band = offsetRun(neck, () => d.neckband.width, p(0, 1000));
      const half = [...neck, ...[...band].reverse()];
      shapes.push(half, mirror(half));
    }
    return { label: i === 0 ? 'FRONT' : 'BACK', shapes, lines, sleeves };
  });
  return arrange(views);
}

/**
 * A jacket or a coat, buttoned: the right front lapping over the left to the extension's edge, the
 * lapels rolled back from the break point with the collar over them (or a stand collar, or a plain
 * edge), set-in sleeves, patch pockets, and the buttons. The back shows the collar lying over the neck.
 */
export function outerFlat(d: OuterDraft): Flat {
  const [bf, bb] = d.block;
  const style = d.base.styleLines;
  const extra = d.drop - d.base.drop;
  const oldHem = d.base.front.hemCentre.y;
  // Princess lines carried on down to the new hem.
  const longer = (pts: P[]) => (extra > 0.05 && Math.abs(Math.max(...pts.map((q) => q.y)) - Math.max(oldHem, d.base.back.hemCentre.y)) < 2 ? [...pts, add(pts[pts.length - 1], p(0, extra))] : pts);
  const back = sewn(bb, undefined, style?.skip === 'all' ? 'all' : undefined);
  const backFoot = back.run[back.tags.lastIndexOf('side') + 1].y;
  const front = sewn(bf, backFoot, style?.skip);
  const hpsOf = (h: Half) => h.run[h.tags.indexOf('shoulder')];
  const footY = front.run[front.run.length - 1].y;
  const ext = d.ext;
  const circle = (c: P, r: number) => Array.from({ length: 13 }, (_, k) => add(c, p(r * Math.cos((k / 12) * 2 * Math.PI), r * Math.sin((k / 12) * 2 * Math.PI))));

  const views = ([front, back] as const).map((h, i) => {
    const isFront = i === 0;
    const lines: FlatView['lines'] = h.darts.flatMap((dt) => both(dt).map((pts) => ({ pts, kind: 'dart' as const })));
    for (const sl of (isFront ? style?.front : style?.back) ?? []) lines.push(...both(longer(sl.pts).map(h.move)).map((pts) => ({ pts, kind: sl.kind })));
    for (const run of along(h, 'hem')) for (const pts of [run, mirror(run)]) for (const r of inset(pts, 2.5, whole(h.run))) lines.push({ pts: r, kind: 'stitch' });
    const shapes: P[][] = [];
    const over: P[][] = [];
    const hps = hpsOf(h);
    const shoulder = along(h, 'shoulder')[0] ?? [hps, hps];
    const uSh = unit(sub(shoulder[shoulder.length - 1], shoulder[0]));
    if (isFront) {
      const run = h.run.slice(h.tags.indexOf('shoulder'));
      const neckRun = h.run.slice(0, h.tags.indexOf('shoulder') + 1);
      let half: P[];
      if (d.lapel) {
        const L = d.lapel;
        const top = lerp(L.roll[0], L.roll[1], 0.94);
        half = [...run, p(-ext, footY), L.breakPt, top];
        // The lapel rolled back over the front, and the collar from the notch round behind the neck.
        over.push([...L.worn]);
        const out = add(hps, mul(uSh, d.kind === 'coat' ? 4.5 : 3.8));
        const behind = p(0, hps.y - 1.6);
        over.push([L.notch, L.collarPoint, out, add(hps, p(-hps.x * 0.5, -1.4)), behind, p(0, top.y + 0.2), top, L.gorge]);
      } else {
        half = [...run, p(-ext, footY), p(-ext, neckRun[0].y), ...neckRun];
        if (d.pieces.some((pc) => pc.name === 'Collar')) {
          const neck = [p(-ext, neckRun[0].y), ...neckRun];
          over.push([...neck, ...neck.map((q) => p(q.x, q.y - 3.5)).reverse()]);
        }
      }
      // The left front under the right, then the right front over it.
      shapes.push(mirror(half), half);
      lines.push({ pts: [p(-ext, footY), p(-ext, d.lapel ? d.lapel.breakPt.y : neckRun[0].y)], kind: 'seam' });
      for (const y of d.buttons.at) for (const x of d.buttons.columns) lines.push({ pts: circle(h.move(p(x, y)), d.buttons.sizeCm / 2), kind: 'seam' });
      if (d.pocket) {
        const { x, y, w, h: ph } = d.pocket;
        const box = [p(x, y), p(x, y + ph), p(x + w, y + ph), p(x + w, y), p(x, y)].map(h.move);
        if (d.pocket.kind === 'welt') for (const pts of both(box)) lines.push({ pts, kind: 'seam' });
        else {
          for (const pts of both(box.slice(0, 4))) lines.push({ pts, kind: 'stitch' });
          for (const pts of both([h.move(p(x, y + 3)), h.move(p(x + w, y + 3))])) lines.push({ pts, kind: 'stitch' });
        }
      }
    } else {
      shapes.push(whole(h.run));
      if (d.vent) {
        // The centre back seam down to the vent, the vent's edge on to the hem, and its top stitched across.
        const top = h.move(p(0, d.vent.top));
        const cb = h.run.filter((q) => Math.abs(q.x - top.x) < 1e-6);
        const neckY = Math.min(...cb.map((q) => q.y), top.y);
        const hemY = Math.max(...cb.map((q) => q.y), top.y);
        lines.push({ pts: [p(top.x, neckY), p(top.x, hemY)], kind: 'seam' });
        lines.push({ pts: [top, add(top, p(d.vent.width, d.vent.width))], kind: 'seam' });
      }
      const neckRun = along(h, 'neck')[0];
      if (neckRun && d.pieces.some((pc) => pc.name === 'Collar')) {
        // A stand collar stands up from the neck; a notched collar's fall lies over the neck seam from its roll.
        const up = neckRun.map((q) => p(q.x, q.y - (d.lapel ? 2.6 : 3.5)));
        const down = d.lapel ? offsetRun(neckRun, () => (d.kind === 'coat' ? 2.4 : 1.8), p(0, -100)) : neckRun;
        const half = [...down, ...[...up].reverse()];
        over.push([...mirror(half).reverse(), ...half]);
      }
    }
    const sl = sleeveSide(h, d.sleeve);
    const sleeves: number[] = [];
    for (const flip of [false, true]) {
      const f = (pts: P[]) => (flip ? mirror(pts) : pts);
      if (sl.shape.length) sleeves.push(shapes.push(f(sl.shape)) - 1);
      lines.push(...sl.lines.map((l) => ({ ...l, pts: f(l.pts) })));
      if (sl.seam && !isFront) lines.push({ pts: f(sl.seam), kind: 'seam' });
    }
    for (const o of over) shapes.push(isFront ? mirror(o) : o, ...(isFront ? [o] : []));
    // Menswear buttons left over right: the same front seen in a mirror.
    if (isFront && d.lapsLeft) return { label: 'FRONT' as const, shapes: shapes.map(mirror), lines: lines.map((l) => ({ ...l, pts: mirror(l.pts) })), sleeves };
    return { label: isFront ? ('FRONT' as const) : ('BACK' as const), shapes, lines, sleeves };
  });
  return arrange(views);
}
