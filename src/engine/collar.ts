// Closures and collars for the bodice. A front button opening adds an extension and a facing to the
// front and puts the back on the fold; collars are drafted to the neckline as sewn, so a collar's neck
// edge is the bodice's neckline to the millimetre.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { Ring, pathOf, ringOf, roundCorner } from './manipulate';
import { facing } from './finishing';
import { DraftPoint, Piece } from './piece';

export type Closure = 'back_zip' | 'front_buttons';
export type Collar = 'none' | 'peter_pan' | 'mandarin' | 'shirt';

/** Button size and the extension beyond the centre front that carries it, in cm. */
export const BUTTON_CM = 1.5;
export const EXTENSION_CM = 1.5;
/** How far the front facing reaches in from the centre front, and along the shoulder. */
const FACING_IN = 6.5;
const FACING_SHOULDER = 4;

const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);
const runOf = (r: Ring, tag: string): [number, number] | undefined => {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    return [i, j];
  }
  return undefined;
};

export interface Buttons {
  count: number;
  /** Down the centre front, from the top. */
  at: number[];
  sizeCm: number;
}

/** Where the buttons go: the first just below the neck (or below the collar band), one level with the
 * bust point, the last a little above the waist or hem, about 8 cm apart. */
export function buttonPlaces(top: number, bottom: number, banded: boolean, waistLength: boolean, bust?: number): Buttons {
  const first = top + (banded ? 6 : 1.6);
  const last = bottom - (waistLength ? 2 : 8);
  const even = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  let at: number[];
  if (bust !== undefined && bust > first + 4 && bust < last - 4) {
    // One button sits level with the bust point, where a front gapes first; the rest space out from it.
    at = [...even(first, bust, Math.max(1, Math.round((bust - first) / 8))), ...even(bust, last, Math.max(1, Math.round((last - bust) / 8))).slice(1)];
  } else {
    at = even(first, last, Math.max(2, Math.round((last - first) / 8)));
  }
  at = at.map((y) => Math.round(y * 10) / 10);
  return { count: at.length, at, sizeCm: BUTTON_CM };
}

/** The front opened at the centre front: the fold becomes an extension, buttonholes on it. */
export function openFront(pc: Piece, buttons?: Buttons): Piece {
  const r = ringOf(pc.outline);
  const n = r.tags.length;
  const fi = r.tags.indexOf('fold');
  if (fi < 0) return pc;
  // The fold runs from the foot of the centre front up to the neck (the outline's start).
  const foot = r.pts[fi];
  const neck = r.pts[(fi + 1) % n];
  const bottomTag = r.tags[(fi - 1 + n) % n];
  const pts = [...r.pts.slice(0, fi + 1), p(-EXTENSION_CM, foot.y), p(-EXTENSION_CM, neck.y)];
  const tags = [...r.tags.slice(0, fi), 'opening-hem', 'opening', 'opening-neck'];
  const lines = [...pc.lines];
  const labels = pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: 'Cut 2 (1 pair)' } : l));
  // The centre front line, which the buttons sit on.
  lines.push(new Path(p(0, neck.y + 0.5)).line(p(0, foot.y - 0.5)));
  labels.push({ at: p(0.7, (neck.y + foot.y) / 2 + 6), text: 'CENTRE FRONT', size: 0.6, rotate: 90 });
  for (const y of buttons?.at ?? []) lines.push(new Path(p(-0.3, y)).line(p(BUTTON_CM, y)));
  if (buttons?.at.length) labels.push({ at: p(BUTTON_CM + 2.6, buttons.at[0] + 0.25), text: 'BUTTONHOLE', size: 0.5 });
  return {
    ...pc,
    outline: pathOf({ pts, tags }),
    lines,
    labels,
    fold: undefined,
    cut: 'Cut 2 (1 pair)',
    allowances: { ...pc.allowances, opening: 1, 'opening-neck': pc.allowances.neck ?? pc.seamAllowance, 'opening-hem': pc.allowances[bottomTag] ?? pc.seamAllowance },
    meta: { ...pc.meta, buttons: buttons?.at, pointedAtCentre: undefined },
  };
}

/** The back with no zip: cut on the fold at the centre back. */
export function backOnFold(pc: Piece): Piece {
  const r = ringOf(pc.outline);
  if (!r.tags.includes('centre')) return pc;
  const tags = r.tags.map((t) => (t === 'centre' ? 'fold' : t));
  const ys = r.pts.filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const cut = 'Cut 1 on fold';
  return {
    ...pc,
    outline: pathOf({ pts: r.pts, tags }),
    fold: [p(0, top + 2), p(0, bottom - 2)],
    notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)),
    labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS').map((l) => (l.text === pc.cut ? { ...l, text: cut } : l)),
    cut,
    allowances: { ...pc.allowances, fold: 0 },
  };
}

/**
 * The front facing for a button opening: the extension and the centre front, 6.5 cm in, up round the
 * neckline and 4 cm along the shoulder. Cut from the front as sewn (any neck or shoulder dart closed).
 */
export function frontFacing(opened: Piece): Piece {
  const r = ringOf(opened.outline);
  const n = r.pts.length;
  const sh = runOf(r, 'shoulder')!;
  const hps = r.pts[sh[0]];
  const along = Math.min(FACING_SHOULDER, len(sub(r.pts[sh[1] + 1], hps)) * 0.5);
  const s4 = add(hps, mul(unit(sub(r.pts[sh[1] + 1], hps)), along));
  const iOpen = r.tags.indexOf('opening-hem');
  // The outline from the shoulder back round the neck to the centre front, then the extension.
  const top: P[] = [s4, ...r.pts.slice(0, sh[0] + 1).reverse()];
  const topTags = ['shoulder', ...r.tags.slice(0, sh[0]).reverse()];
  const ext = [r.pts[(iOpen + 2) % n], r.pts[iOpen + 1], r.pts[iOpen]];
  // Back along the bottom edge from the centre front until 6.5 cm in.
  const bottom: P[] = [];
  const bottomTags: string[] = [];
  for (let i = iOpen; i > 0; i--) {
    const a = r.pts[i];
    const b = r.pts[i - 1];
    if (b.x >= FACING_IN) {
      bottom.push(lerp(a, b, (FACING_IN - a.x) / (b.x - a.x || 1)));
      bottomTags.push(r.tags[i - 1]);
      break;
    }
    bottom.push(b);
    bottomTags.push(r.tags[i - 1]);
  }
  const b6 = bottom[bottom.length - 1];
  // The inner edge: straight up, then curving out to meet the shoulder square, so the cutting line's
  // mitre at the shoulder stays a seam allowance from the corner instead of running out in a spike.
  const m = p(FACING_IN, Math.min(b6.y - 2, r.pts[0].y + 4));
  const inner: P[] = [];
  const uSh = unit(sub(r.pts[sh[1] + 1], hps));
  const inward = p(-uSh.y, uSh.x).y > 0 ? p(-uSh.y, uSh.x) : p(uSh.y, -uSh.x);
  const c = add(s4, mul(inward, Math.max(2, Math.min(5, (m.y - s4.y) * 0.5))));
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    inner.push(p((1 - t) ** 2 * m.x + 2 * (1 - t) * t * c.x + t * t * s4.x, (1 - t) ** 2 * m.y + 2 * (1 - t) * t * c.y + t * t * s4.y));
  }
  const pts = [...top, ...ext, ...bottom, m, ...inner.slice(0, -1)];
  // One 'facing' tag per inner-edge point, and one more for the edge that closes the ring back to the shoulder.
  const tags = [...topTags, 'opening-neck', 'opening', 'opening-hem', ...bottomTags, ...Array(inner.length + 1).fill('facing')];
  // The ring ran neck-first from the centre front; here the extension edges follow the neck.
  tags[topTags.length - 1] = topTags[topTags.length - 1];
  const outline = pathOf({ pts, tags: tags.slice(0, pts.length) });
  const cut = 'Cut 2 (1 pair)';
  const mid = p(FACING_IN * 0.45, (r.pts[0].y + b6.y) / 2);
  return {
    name: 'Front facing',
    kind: 'facing',
    outline,
    lines: [],
    grain: [p(FACING_IN * 0.3, mid.y - 6), p(FACING_IN * 0.3, mid.y + 6)],
    notches: [],
    labels: [
      { at: mid, text: 'FRONT FACING', size: 0.8, rotate: 90 },
      { at: add(mid, p(-1.1, 0)), text: cut, size: 0.55, rotate: 90 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: opened.seamAllowance,
    allowances: { ...opened.allowances, facing: 0 },
    meta: {},
  };
}

/** The back neck facing for a button opening, cut on the fold. */
export const backNeckFacing = (backFold: Piece) => facing(backFold, 'neck', 5, 'Back neck facing');

// ---- collars ---------------------------------------------------------------------------------

interface CollarIn {
  /** Half the neckline as sewn: back neck and front neck, centre back to centre front. */
  back: number;
  front: number;
  /** The extension the collar runs on over, for a band on a button front (0 otherwise). */
  ext: number;
  closure: Closure;
  sa: number;
}

/** A polyline with the corner at index `k` rounded: points within `reach` of it are eased onto a smooth
 * curve by averaging each with its neighbours, the two ends of the reach and the ends of the line fixed. */
function smoothJoin(pts: P[], k: number, reach: number): P[] {
  const out = pts.map((q) => p(q.x, q.y));
  const near = (i: number) => len(sub(pts[i], pts[k])) < reach;
  for (let pass = 0; pass < 6; pass++) {
    const prev = out.map((q) => p(q.x, q.y));
    for (let i = 1; i < out.length - 1; i++) {
      if (!near(i)) continue;
      out[i] = p((prev[i - 1].x + 2 * prev[i].x + prev[i + 1].x) / 4, (prev[i - 1].y + 2 * prev[i].y + prev[i + 1].y) / 4);
    }
  }
  return out;
}

/** A neck curve x along, y up (negative), stretched until its length is exactly `L`. */
function neckCurve(L: number, y: (t: number) => number): P[] {
  let k = L;
  let pts: P[] = [];
  for (let it = 0; it < 30; it++) {
    pts = Array.from({ length: 41 }, (_, i) => p((k * i) / 40, y(i / 40)));
    const got = polyLen(pts);
    if (Math.abs(got - L) < 1e-4) break;
    k *= L / got;
  }
  return pts;
}
const upNormal = (pts: P[], i: number) => {
  const t = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
  return p(t.y, -t.x);
};
/** The point `s` cm along a polyline, as an index into a resampled copy. */
function pointAt(pts: P[], s: number): P {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    if (acc + l >= s) return lerp(pts[i - 1], pts[i], l ? (s - acc) / l : 0);
    acc += l;
  }
  return pts[pts.length - 1];
}
const notchAt = (pts: P[], s: number): [P, P] => {
  const q = pointAt(pts, s);
  const q2 = pointAt(pts, s + 0.1);
  const t = unit(sub(q2, q));
  return [q, p(-t.y, t.x)];
};

/**
 * A band collar standing up from the neck: a mandarin, or a shirt collar's stand. It curves up toward
 * the front so it hugs the neck. On a button front it runs on over the extension, folded at the centre
 * back; with a back zip it is folded at the centre front and its ends go into the zip.
 */
function band(c: CollarIn, name: string, height: number, rise: number): { piece: Piece; neck: P[]; top: P[]; cfAt: number } {
  const buttons = c.closure === 'front_buttons';
  const L = c.back + c.front + c.ext;
  // Centre back at x = 0. Rising toward the front, flat where the band is folded.
  const neck = neckCurve(L, buttons ? (t) => -rise * t * t : (t) => -rise * (1 - (1 - t) ** 2));
  const top = neck.map((q, i) => add(q, mul(upNormal(neck, i), height)));
  const m = neck.length - 1;
  // Closed outline: the neck edge to the front, up the front end, back along the top, and down the
  // centre back to the start. On a button front the front end is rounded over the button.
  let pts: P[];
  let tags: string[];
  if (buttons) {
    const k = Math.max(1, Math.round(m * 0.06));
    const curve = roundCorner([neck[m], top[m], top[m - k]], 1, Math.min(1.4, height * 0.45)).slice(1, -1);
    const back = top.slice(0, m - k + 1).reverse();
    pts = [...neck, ...curve, ...back];
    tags = [...neck.slice(1).map(() => 'neck'), ...curve.map(() => 'collar'), ...back.slice(1).map(() => 'collar'), 'collar', 'fold'];
    tags = tags.slice(0, pts.length - 1).concat('fold');
  } else {
    const back = [...top].reverse();
    pts = [...neck, ...back];
    tags = [...neck.slice(1).map(() => 'neck'), 'fold', ...back.slice(1).map(() => 'collar'), 'centre'];
  }
  const outline = pathOf({ pts, tags });
  const cfAt = c.back + c.front;
  const cut = 'Cut 2 on fold';
  const foldAt: [P, P] = buttons ? [p(0, -height + 0.6), p(0, -0.6)] : [add(neck[m], mul(upNormal(neck, m), height - 0.6)), add(neck[m], mul(upNormal(neck, m), 0.6))];
  const mid = lerp(neck[Math.round(m * 0.45)], top[Math.round(m * 0.45)], 0.5);
  const piece: Piece = {
    name,
    kind: 'collar',
    outline,
    lines: [],
    grain: [add(mid, p(-3, 0)), add(mid, p(3, 0))],
    fold: foldAt,
    notches: [notchAt(neck, c.back), ...(buttons ? [notchAt(neck, cfAt)] : [])],
    labels: [
      { at: add(mid, p(0, -0.2)), text: name.toUpperCase(), size: 0.7 },
      { at: add(mid, p(0, 0.75)), text: cut, size: 0.5 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: c.sa,
    allowances: { neck: 1, collar: 1, centre: c.sa, fold: 0, stand: 1 },
    meta: { collarTo: c.ext ? 'extension' : 'centre front', foldAt: buttons ? 'centre back' : 'centre front' },
  };
  return { piece, neck, top, cfAt };
}

export function mandarinCollar(c: CollarIn): Piece[] {
  const b = band(c, 'Collar', 3.5, 1.2).piece;
  b.draft = draftNotes([
    ['1', 'Square a line the length of half the neckline as sewn: back neck, front neck' + (c.ext ? ' and the extension.' : '.')],
    ['2', 'Raise the front end 1.2 cm and curve the neck edge up to it, keeping its length.'],
    ['3', 'Square up 3.5 cm all along for the top edge, and finish the ends square to the neck edge.'],
  ], b);
  return [b];
}

/** A shirt collar: a stand like the mandarin, and the collar on it, springing out at its edge. */
export function shirtCollar(c: CollarIn): Piece[] {
  const s = band(c, 'Collar stand', 3, 1.5);
  // The stand's top edge as far as the centre front mark: the collar's lower edge is this long.
  const cfIndex = (() => {
    let acc = 0;
    for (let i = 1; i < s.neck.length; i++) {
      acc += len(sub(s.neck[i], s.neck[i - 1]));
      if (acc >= s.cfAt) return i;
    }
    return s.neck.length - 1;
  })();
  const standTop = s.top.slice(0, cfIndex + 1);
  const Lc = polyLen(standTop);
  // Re-tag the stand's top edge as far as the centre front, where the collar sews on.
  const r = ringOf(s.piece.outline);
  const topRun = r.tags.map((t, i) => (t === 'collar' ? i : -1)).filter((i) => i >= 0);
  for (const i of topRun) {
    const q = r.pts[i];
    const q2 = r.pts[(i + 1) % r.pts.length];
    const onTop = standTop.some((x) => len(sub(x, q)) < 1e-6) && standTop.some((x) => len(sub(x, q2)) < 1e-6);
    if (onTop) r.tags[i] = 'stand';
  }
  s.piece.outline = pathOf(r);
  s.piece.draft = draftNotes([
    ['1', 'Square a line half the neckline as sewn plus the extension, raise the front end 1.5 cm and curve the neck edge up to it.'],
    ['2', 'Square up 3 cm for the top edge, and round the front end over the button.'],
    ['3', 'Mark the centre front on the top edge: the collar sews on from the centre back to here.'],
  ], s.piece);

  // The collar: its lower edge curves down (the spring), so the outer edge has room to lie over the stand.
  const spring = 1.8;
  const back = 4.5;
  const lower = neckCurve(Lc, (t) => spring * t * t);
  const m = lower.length - 1;
  const end = lower[m];
  const point = add(end, p(2.2, -(back + 1.5)));
  const topEdge: P[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = p(0, -back);
    const ctl = p(Lc * 0.65, -back + spring * 0.6);
    topEdge.push(p((1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctl.x + t * t * point.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctl.y + t * t * point.y));
  }
  const pts = [...lower, ...[...topEdge].reverse()];
  const tags = [...lower.slice(1).map(() => 'stand'), 'collar', ...topEdge.slice(1).map(() => 'collar'), 'fold'];
  // pts: lower (m + 1 points), then the top edge from the point back to the centre back.
  const outline = pathOf({ pts, tags: tags.slice(0, pts.length) });
  const cut = 'Cut 2 on fold';
  const mid = p(Lc * 0.45, -back / 2);
  const collar: Piece = {
    name: 'Collar',
    kind: 'collar',
    outline,
    lines: [],
    grain: [p(Lc * 0.2 - 2, -back / 2), p(Lc * 0.2 + 2, -back / 2)],
    fold: [p(0, -back + 0.6), p(0, -0.6)],
    notches: [[pointAt(lower, (Lc * c.back) / s.cfAt), p(0, 1)]],
    labels: [
      { at: add(mid, p(0, -0.3)), text: 'COLLAR', size: 0.8 },
      { at: add(mid, p(0, 0.7)), text: cut, size: 0.5 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: c.sa,
    allowances: { stand: 1, collar: 1, fold: 0 },
    meta: { foldAt: 'centre back' },
  };
  collar.draft = draftNotes([
    ['4', `Square a line the length of the stand's top edge to the centre front, ${Lc.toFixed(1)} cm, and drop its front end ${spring} cm for the spring.`],
    ['5', `Square up ${back} cm at the centre back. Take the collar point 2.2 cm forward and 1.5 cm above that, and curve the outer edge to it.`],
  ], collar);
  return [s.piece, collar];
}

/**
 * A Peter Pan collar: the front and back necklines laid together at the shoulders, overlapped 1.5 cm at
 * the shoulder point so the collar rolls a little, and a band 6.5 cm wide drawn round them, rounding to
 * nothing at the centre front.
 */
export function peterPanCollar(front: Piece, back: Piece, c: CollarIn): Piece[] {
  const run = (pc: Piece) => {
    const r = ringOf(pc.outline);
    const nk = runOf(r, 'neck')!;
    const sh = runOf(r, 'shoulder')!;
    return { neck: r.pts.slice(nk[0], nk[1] + 2), hps: r.pts[sh[0]], sp: r.pts[sh[1] + 1] };
  };
  const f = run(front);
  const b = run(back);
  const uF = unit(sub(f.sp, f.hps));
  // The back neck turned onto the front: the back shoulder laid along the front's, the back neck on the
  // far side of it, then swung toward the front about the neck point, 1.5 cm at the shoulder point.
  const uB = unit(sub(b.sp, b.hps));
  const lap = 1.5 / len(sub(b.sp, b.hps));
  const toFront = (q: P) => {
    const v = sub(q, b.hps);
    const s = v.x * uB.x + v.y * uB.y;
    const t = -(v.x * -uB.y + v.y * uB.x);
    const along = s * Math.cos(lap) - t * Math.sin(lap);
    const across = s * Math.sin(lap) + t * Math.cos(lap);
    return add(f.hps, add(mul(uF, along), mul(p(-uF.y, uF.x), across)));
  };
  // Neck from centre back to the neck point, then on from the neck point to the centre front.
  const backNeck = b.neck.map(toFront);
  const frontNeck = [...f.neck].reverse();
  // The swing leaves a small angle where the back neck meets the front at the neck point: the join is
  // smoothed over a few centimetres each side, so the collar's edges run on without a step.
  const neck = smoothJoin([...backNeck, ...frontNeck.slice(1)], backNeck.length - 1, 2.5);
  const L = polyLen(neck);
  // Outward: away from the neck hole, which lies toward the chord from centre back to centre front.
  const chordMid = lerp(neck[0], neck[neck.length - 1], 0.5);
  const width = 6.5;
  const R = 5;
  const outer: P[] = [];
  let acc = 0;
  neck.forEach((q, i) => {
    if (i) acc += len(sub(q, neck[i - 1]));
    const t = unit(sub(neck[Math.min(i + 1, neck.length - 1)], neck[Math.max(i - 1, 0)]));
    let nrm = p(-t.y, t.x);
    if ((q.x - chordMid.x) * nrm.x + (q.y - chordMid.y) * nrm.y < 0) nrm = mul(nrm, -1);
    const left = L - acc;
    const w = left < R ? width * Math.sqrt(Math.max(0, 1 - ((R - left) / R) ** 2)) : width;
    outer.push(add(q, mul(nrm, w)));
  });
  const buttons = c.closure === 'front_buttons';
  const pts = [...neck, ...outer.slice(0, -1).reverse()];
  const tags = [...neck.slice(1).map(() => 'neck'), ...outer.slice(1, -1).map(() => 'collar'), buttons ? 'fold' : 'centre'];
  const outline = pathOf({ pts, tags: tags.slice(0, pts.length) });
  const cbDir = unit(sub(outer[0], neck[0]));
  const cut = buttons ? 'Cut 2 on fold' : 'Cut 4 (2 pairs)';
  const midI = Math.round(neck.length * 0.5);
  const mid = lerp(neck[midI], outer[midI], 0.5);
  const piece: Piece = {
    name: 'Collar',
    kind: 'collar',
    outline,
    lines: [],
    fold: buttons ? [add(neck[0], mul(cbDir, 0.6)), add(neck[0], mul(cbDir, width - 0.6))] : undefined,
    notches: [[f.hps, mul(unit(sub(chordMid, f.hps)), 1)]],
    labels: [
      { at: mid, text: 'COLLAR', size: 0.7 },
      { at: add(mid, p(0, 0.9)), text: cut, size: 0.5 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: c.sa,
    allowances: { neck: 1, collar: 1, fold: 0, centre: 1 },
    meta: { collarTo: 'centre front', foldAt: 'centre back' },
  };
  // Grain parallel to the centre back.
  const g0 = add(lerp(neck[0], outer[0], 0.5), mul(p(-cbDir.y, cbDir.x), 2.5));
  piece.grain = [sub(g0, mul(cbDir, 1.8)), add(g0, mul(cbDir, 1.8))];
  piece.draft = draftNotes([
    ['1', 'Lay the bodice front and back together at the shoulders, neck points touching, with the shoulder points overlapping 1.5 cm.'],
    ['2', 'Trace the neckline from the centre back to the centre front.'],
    ['3', `Mark the collar ${width} cm out from the neckline all round, rounding it off to the neck at the centre front.`],
  ], piece);
  return [piece];
}

function draftNotes(notes: [string, string][], pc: Piece): Piece['draft'] {
  const pts = pc.outline.points(4);
  const points: DraftPoint[] = notes.map(([n, note], i) => ({ n, at: pts[Math.floor((pts.length * i) / Math.max(notes.length, 1))], note }));
  return { frame: [], points };
}

export function collarPieces(kind: Collar, front: Piece, back: Piece, c: CollarIn): Piece[] {
  if (kind === 'peter_pan') return peterPanCollar(front, back, c);
  if (kind === 'mandarin') return mandarinCollar(c);
  if (kind === 'shirt') return shirtCollar(c);
  return [];
}

export type { CollarIn };
