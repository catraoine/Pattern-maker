// The technical flat: the garment drawn flat, front and back, the way a designer hands it to a
// pattern room. Drawn to scale from the draft itself: each half piece with its darts sewn (waist
// darts closed into the waist, the bust dart folded into the side seam), mirrored across the centre,
// with its seams, darts, zip and visible stitching.
import { P, add, len, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import type { SkirtDraft } from './skirt';
import { WAISTBAND_CM } from './skirt';
import type { BodiceDraft } from './bodice';
import type { BodiceEdges } from './instructions';
import { BAND_CM, SleeveDraft } from './sleeve';

export type FlatLineKind = 'seam' | 'dart' | 'stitch' | 'zip';

export interface FlatView {
  label: 'FRONT' | 'BACK';
  /** The garment's outer edge, and any part drawn as its own shape (the waistband). Closed. */
  shapes: P[][];
  lines: { pts: P[]; kind: FlatLineKind }[];
  /** Where the label goes, below the view. */
  at: P;
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
function sewn(pc: Piece, bottom?: number): Half {
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
  // in the hem (no darts) hangs level with the back.
  const scale = (foot: number) => (bottom !== undefined && foot - from > 1 ? (bottom - from) / (foot - from) : 1);
  const kSide = scale(footPt.y);
  const kCentre = scale(centreFoot.y);

  const move = (q: P): P => {
    let x = q.x;
    for (const d of waistDarts) x -= d.g * clamp01((q.x - d.lo) / d.g) * clamp01(1 - Math.abs(q.y - d.y) / d.reach);
    const k = kCentre + (kSide - kCentre) * clamp01(q.x / Math.max(footPt.x, 1));
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

/** A centre back zip: the seam down from `top`, the pull at the top and a stop at the bottom. */
function zip(top: number, cm: number): FlatView['lines'] {
  return [
    { pts: [p(0, top), p(0, top + cm)], kind: 'zip' },
    { pts: [p(-0.35, top + 0.3), p(0.35, top + 0.3), p(0.35, top + 1.8), p(-0.35, top + 1.8), p(-0.35, top + 0.3)], kind: 'seam' },
    { pts: [p(-0.6, top + cm), p(0.6, top + cm)], kind: 'seam' },
  ];
}

/** Front and back side by side, from the top left at 0, 0. */
function arrange(views: Omit<FlatView, 'at'>[]): Flat {
  const all = (v: Omit<FlatView, 'at'>) => [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)];
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

/** The skirt: waistband, darts, centre back seam and zip, and a walking slit when it has one. */
export function skirtFlat(d: SkirtDraft, opts: { slit?: boolean } = {}): Flat {
  const views = (['FRONT', 'BACK'] as const).map((label, i) => {
    const back = i === 1;
    let shapes: P[][];
    let lines: FlatView['lines'] = [];
    let waist: P[];
    let hemY: number;
    if (d.circleShare) {
      const c = circleHalf(d, back);
      ({ shapes, lines, waist } = c);
      hemY = d.lengthCm;
    } else {
      const h = sewn(d.pieces[i]);
      shapes = [whole(h.run)];
      waist = along(h, ['waist', 'dart'])[0] ?? [h.run[0]];
      lines = h.darts.flatMap((dt) => both(dt).map((pts) => ({ pts, kind: 'dart' as const })));
      hemY = h.run[h.run.length - 1].y;
    }
    // The waistband sits above the waist, as wide as it.
    const band = whole([...waist, ...[...waist].reverse().map((q) => p(q.x, q.y - WAISTBAND_CM))]);
    shapes.push(band);
    const cbTop = waist[0].y;
    if (back) {
      lines.push({ pts: [p(0, cbTop - WAISTBAND_CM), p(0, cbTop)], kind: 'seam' });
      if (opts.slit) {
        const top = hemY - 15;
        lines.push({ pts: [p(0, cbTop), p(0, top)], kind: 'seam' });
        lines.push({ pts: [p(0, top), p(-0.5, hemY)], kind: 'seam' }, { pts: [p(0, top), p(0.5, hemY)], kind: 'seam' });
      } else lines.push({ pts: [p(0, cbTop), p(0, hemY)], kind: 'seam' });
      lines.push(...zip(cbTop, d.zipCm));
    }
    return { label, shapes, lines };
  });
  return arrange(views);
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
function sleeveSide(h: Half, sl: SleeveDraft): { shape: P[]; band?: P[]; lines: FlatView['lines'] } {
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
  const band = gathered ? BAND_CM : 0;
  const L = sl.lengthCm - band;
  const Ho = add(S, add(sub(top, S), mul(a, L - len(sub(top, S)))));
  const lines: FlatView['lines'] = [];
  if (!gathered) {
    const Hi = add(Ho, mul(n, (k * sl.hemCm) / 2));
    const shape = [...head, Ho, Hi, U, ...[...hole].reverse().slice(1, -1)];
    const lift = 2;
    lines.push({ pts: [add(Ho, mul(a, -lift)), add(Hi, mul(a, -lift))], kind: 'stitch' });
    return { shape, lines };
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
  return { shape, band: bandShape, lines };
}

/** The bodice: darts, the back neck seen over the front, centre back seam and zip, sleeves when it has
 * them, and the stitching that shows: binding round the neck (and the armholes of a sleeveless one),
 * and the hem of a longer top. */
export function bodiceFlat(d: BodiceDraft, edges: BodiceEdges = 'binding', sleeve?: SleeveDraft): Flat {
  const back = sewn(d.pieces[1]);
  const backFoot = back.run[back.tags.lastIndexOf('side') + 1].y;
  const front = sewn(d.pieces[0], backFoot);
  const hps = (h: Half) => h.run[h.tags.indexOf('shoulder')];
  const views = ([front, back] as const).map((h, i) => {
    const shape = whole(h.run);
    const lines: FlatView['lines'] = h.darts.flatMap((dt) => both(dt).map((pts) => ({ pts, kind: 'dart' as const })));
    if (i === 0) {
      // The back neckline shows through a lower front neck.
      const shift = sub(hps(front), hps(back));
      const neck = along(back, 'neck')[0]?.map((q) => add(q, shift));
      if (neck && front.run[0].y > neck[0].y + 1) lines.push(...both(neck).map((pts) => ({ pts, kind: 'seam' as const })));
    }
    if (edges === 'binding') {
      for (const run of [...along(h, 'neck'), ...(sleeve ? [] : along(h, 'armhole'))])
        for (const pts of [run, mirror(run)]) for (const r of inset(pts, 0.6, shape)) lines.push({ pts: r, kind: 'stitch' });
    }
    if (d.finishedHem !== undefined)
      for (const run of along(h, 'hem')) for (const pts of [run, mirror(run)]) for (const r of inset(pts, 2, shape)) lines.push({ pts: r, kind: 'stitch' });
    if (i === 1) {
      const top = h.run[0].y;
      lines.push({ pts: [p(0, top), p(0, h.run[h.run.length - 1].y)], kind: 'seam' }, ...zip(top, d.zipCm));
    }
    const shapes = [shape];
    if (sleeve) {
      const sl = sleeveSide(h, sleeve);
      for (const flip of [false, true]) {
        const f = (pts: P[]) => (flip ? mirror(pts) : pts);
        if (sl.shape.length) shapes.push(f(sl.shape));
        if (sl.band) shapes.push(f(sl.band));
        lines.push(...sl.lines.map((l) => ({ ...l, pts: f(l.pts) })));
      }
    }
    return { label: i === 0 ? ('FRONT' as const) : ('BACK' as const), shapes, lines };
  });
  return arrange(views);
}
