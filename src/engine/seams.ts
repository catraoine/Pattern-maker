// Style seams other than princess lines, drawn on the form: a yoke across the upper chest or the
// shoulder blades, an empire seam under the bust with a midriff band below it to the waist, and side
// panels from the lower armhole down to the waist. Each cuts the drafted block along its line into
// pieces that sew back up to the block's shape:
// - a front yoke takes the bust dart: it is closed at the side and opens on the yoke seam over the
//   bust point, a dart in the front below the yoke. A back yoke is cut straight across the shoulder
//   blades; the block has no back shoulder dart, so its shoulder keeps the 1 cm of ease as drafted.
// - an empire seam: the bust dart is closed into the waist dart first, so one dart runs from the waist
//   up to the bust point. Above the seam it opens on the seam; in the band its two halves are brought
//   together at the seam, leaving a dart from the waist to a point on the seam. The back is cut the
//   same way, level with the front at the side seam.
// - side panels: the bust dart closed into the waist dart, then the front and back cut from the lower
//   armhole to the waist, about as far in from the side seam all the way down. The waist darts stay in
//   the centre panels.
// Everything is in the block's coordinates: cm, the centre at x = 0, y running down.
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { finishDart } from './darts';
import { insidePolygon } from './marks';
import { Ring, pathOf, polyLen, ringOf } from './manipulate';
import { moveFrontDart } from './shaping';
import { DraftPoint, Piece } from './piece';
import { cm } from './skirt';
import type { BodiceDraft, BodiceStyle } from './bodice';
import { squaredWaist } from './bodice';

export type SeamKind = 'yoke' | 'empire' | 'panel';

/** A yoke's depth at the centre, front and back: cm below the neck point (the high point of the shoulder). */
export interface Yoke {
  front?: number;
  back?: number;
}

/** Side panels: where the seam leaves the armhole, 0 at the shoulder to 1 at the underarm. */
export interface Panel {
  at: number;
}

/** A style seam as sewn, in the block's coordinates, for the flat, the sketch and the form. */
export interface StyleSeam {
  kind: SeamKind;
  side: 'front' | 'back';
  pts: P[];
}

/** How deep a yoke can sit below the neck point, and an empire seam below the bust point, in cm; and
 * how far down the armhole a side panel can start. Each is kept inside what the draft itself allows. */
export const YOKE_RANGE = { min: 8, max: 22 };
export const EMPIRE_RANGE = { min: 5, max: 16 };
export const PANEL_RANGE = { min: 0.45, max: 0.92 };

const WORDS: Record<SeamKind, string> = { yoke: 'yoke', empire: 'empire seam', panel: 'side panels' };

/** Which style seam a bodice has: an empire seam, side panels or a yoke, one at a time. */
export function seamOf(s: { yoke?: Yoke; empire?: number; panel?: Panel }): SeamKind | undefined {
  if (s.empire !== undefined) return 'empire';
  if (s.panel) return 'panel';
  if (s.yoke && (s.yoke.front !== undefined || s.yoke.back !== undefined)) return 'yoke';
  return undefined;
}

/**
 * The style a seamed bodice is drafted with: the bust dart left in the side seam for the seam to take,
 * and a back zip for a yoke or an empire seam, which would cross a button front. Princess seams and a
 * draped neckline are their own shaping, so they let go of the style seam instead.
 */
export function seamStyle<S extends BodiceStyle>(s: S): S {
  const kind = seamOf(s);
  if (!kind) return s;
  if ((s.princess && s.princess !== 'none') || s.neckline === 'one_shoulder' || s.neckline === 'cowl' || (s.unevenNeck && kind !== 'yoke')) return { ...s, yoke: undefined, empire: undefined, panel: undefined };
  // An uneven neckline's whole front takes no front yoke; a back yoke still goes on the back pair.
  if (s.unevenNeck && s.yoke?.front !== undefined) s = { ...s, yoke: s.yoke.back !== undefined ? { back: s.yoke.back } : undefined };
  if (!seamOf(s)) return s;
  return { ...s, bustDart: 'side', ...(kind !== 'panel' ? { closure: 'back_zip' } : {}) };
}

// ---- cutting a ring along a line ---------------------------------------------------------------

/** Where segment a-b meets segment c-d, and how far along each (0 to 1; c-d's end is left to the next edge). */
function meet(a: P, b: P, c: P, d: P): { q: P; t: number; u: number } | undefined {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return undefined;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  // A line ending on an edge still meets it: a hair's tolerance at the line's ends.
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= 0 && u < 1 ? { q: add(a, mul(r, Math.min(1, Math.max(0, t)))), t: Math.min(1, Math.max(0, t)), u } : undefined;
}

interface Crossing {
  /** The ring's edge, how far along it, and how far along the line (cm). */
  i: number;
  u: number;
  s: number;
  q: P;
}

/** Every point where a polyline crosses the ring's edges, in order along the line. */
function crossings(r: Ring, line: P[]): Crossing[] {
  const n = r.pts.length;
  const out: Crossing[] = [];
  let acc = 0;
  for (let j = 1; j < line.length; j++) {
    const l = len(sub(line[j], line[j - 1]));
    for (let i = 0; i < n; i++) {
      const m = meet(line[j - 1], line[j], r.pts[i], r.pts[(i + 1) % n]);
      if (m) out.push({ i, u: m.u, s: acc + m.t * l, q: m.q });
    }
    acc += l;
  }
  out.sort((a, b) => a.s - b.s);
  return out.filter((c, k) => k === 0 || c.s - out[k - 1].s > 1e-6);
}

/** The points of a polyline strictly between two distances along it. */
function between(line: P[], s1: number, s2: number): P[] {
  const out: P[] = [];
  let acc = 0;
  line.forEach((q, j) => {
    if (j) acc += len(sub(q, line[j - 1]));
    if (acc > s1 + 1e-6 && acc < s2 - 1e-6) out.push(q);
  });
  return out;
}

interface Cut {
  /** Round the ring from the first crossing (along the line) to the second, then back along the line. */
  a: Ring;
  /** Round the rest of the ring from the second crossing to the first, then along the line. */
  b: Ring;
  /** The line between the crossings, from the first to the second. */
  seam: P[];
  /** The edges each crossing is on. */
  on: [string, string];
}

/** Cut a ring along a line that crosses it twice, the line's edges tagged `tag` on both parts. */
function cutRing(r: Ring, line: P[], tag: string): Cut | undefined {
  const cs = crossings(r, line);
  if (cs.length !== 2) return undefined;
  const on: [string, string] = [r.tags[cs[0].i], r.tags[cs[1].i]];
  const pts = [...r.pts];
  const tags = [...r.tags];
  // Each crossing put in the ring, the later edge first so the earlier one's index still holds.
  for (const c of [...cs].sort((x, y) => y.i - x.i || y.u - x.u)) {
    if (c.u < 1e-6) c.q = pts[c.i];
    else if (c.u > 1 - 1e-6) c.q = pts[(c.i + 1) % pts.length];
    else {
      pts.splice(c.i + 1, 0, c.q);
      tags.splice(c.i + 1, 0, tags[c.i]);
    }
  }
  const n = pts.length;
  const walk = (from: number, to: number) => {
    const ks: number[] = [];
    for (let k = from; ; k = (k + 1) % n) {
      ks.push(k);
      if (k === to) return ks;
    }
  };
  const k1 = pts.indexOf(cs[0].q);
  const k2 = pts.indexOf(cs[1].q);
  const seam = [cs[0].q, ...between(line, cs[0].s, cs[1].s), cs[1].q];
  const along = seam.slice(1).map(() => tag);
  const ia = walk(k1, k2);
  const ib = walk(k2, k1);
  return {
    a: { pts: [...ia.map((k) => pts[k]), ...[...seam].reverse().slice(1, -1)], tags: [...ia.slice(0, -1).map((k) => tags[k]), ...along] },
    b: { pts: [...ib.map((k) => pts[k]), ...seam.slice(1, -1)], tags: [...ib.slice(0, -1).map((k) => tags[k]), ...along] },
    seam,
    on,
  };
}

/** The ring started from point k. */
const from = (r: Ring, k: number): Ring => ({ pts: [...r.pts.slice(k), ...r.pts.slice(0, k)], tags: [...r.tags.slice(k), ...r.tags.slice(0, k)] });
/** The last run of edges tagged `tag`, as points from its start to its end: the side seam below a dart. */
function lastRun(r: Ring, tag: string): P[] {
  const n = r.tags.length;
  const ends = r.tags.map((t, i) => (t === tag && r.tags[(i + 1) % n] !== tag ? i : -1)).filter((i) => i >= 0);
  if (!ends.length) return [];
  let a = ends[ends.length - 1];
  while (r.tags[(a - 1 + n) % n] === tag && a > 0) a--;
  return r.pts.slice(a, ends[ends.length - 1] + 2);
}
/** Where the first run of edges tagged `tag` begins. */
const runStart = (r: Ring, tag: string) => r.tags.findIndex((t, i) => t === tag && r.tags[(i - 1 + r.tags.length) % r.tags.length] !== tag);
/** The first run of edges tagged `tag`, as points from its start to its end. */
function run(r: Ring, tag: string): P[] {
  const a = runStart(r, tag);
  if (a < 0) return [];
  const out = [r.pts[a]];
  for (let i = a; r.tags[i % r.tags.length] === tag && out.length <= r.pts.length; i++) out.push(r.pts[(i + 1) % r.pts.length]);
  return out;
}
/** The point `s` cm along a polyline, and the direction it runs there. */
function pointAlong(poly: P[], s: number): { q: P; dir: P } {
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const l = len(sub(poly[i], poly[i - 1]));
    if (acc + l >= s || i === poly.length - 1) return { q: lerp(poly[i - 1], poly[i], l ? Math.min(1, Math.max(0, (s - acc) / l)) : 0), dir: unit(sub(poly[i], poly[i - 1])) };
    acc += l;
  }
  return { q: poly[0], dir: p(0, 1) };
}
/** Where a polyline crosses the level y, and the direction it runs there. */
function atLevel(poly: P[], y: number): { q: P; dir: P } | undefined {
  for (let i = 1; i < poly.length; i++) {
    const [a, b] = [poly[i - 1], poly[i]];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return { q: lerp(a, b, (y - a.y) / (b.y - a.y)), dir: unit(sub(b, a)) };
  }
  return undefined;
}
const rotAbout = (c: P, a: number) => (q: P) => {
  const v = sub(q, c);
  return add(c, p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)));
};
/** The angle that turns a about c onto b. */
const turnBetween = (c: P, a: P, b: P) => {
  const u = sub(a, c);
  const v = sub(b, c);
  return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
};

// ---- the pieces --------------------------------------------------------------------------------

/** Notches on a seam at the given points, each pointing out of the piece into the seam allowance. */
function seamNotches(at: P[], seam: P[], r: Ring): [P, P][] {
  return at.map((q) => {
    let k = 1;
    for (let i = 1; i < seam.length; i++) if (len(sub(lerp(seam[i - 1], seam[i], 0.5), q)) < len(sub(lerp(seam[k - 1], seam[k], 0.5), q))) k = i;
    const u = unit(sub(seam[k], seam[k - 1]));
    const out = p(-u.y, u.x);
    return insidePolygon(add(q, mul(out, 0.3)), r.pts) ? [q, mul(out, -1)] : [q, out];
  });
}

/** Where a vertical line at x enters and leaves the outline, top and bottom. */
function spanAt(pts: P[], x: number): [number, number] | undefined {
  const ys: number[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    if ((a.x - x) * (b.x - x) < 0) ys.push(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  });
  return ys.length >= 2 ? [Math.min(...ys), Math.max(...ys)] : undefined;
}

/**
 * A piece cut from `pc` along a style seam, outline `r`: the notches, lines and draft points of `pc`
 * that fall inside it (unless given), and its own name, cut, grain, fold and labels.
 */
function part(pc: Piece, r: Ring, name: string, cut: string, extra: { notches?: [P, P][]; lines?: Path[]; points?: DraftPoint[]; meta?: Record<string, unknown> } = {}): Piece {
  const inside = (q: P) => insidePolygon(q, r.pts);
  const near = (q: P) => r.pts.some((x) => len(sub(x, q)) < 0.6);
  const mine = ([q, d]: [P, P]) => inside(sub(q, mul(unit(d), 0.3)));
  const lines =
    extra.lines ??
    pc.lines.filter((ln) => {
      const q = ln.points();
      // A dart goes with its point, a bust point cross or a fish-eye with its middle.
      return inside(q.length === 3 ? q[1] : mul(q.reduce((s, x) => add(s, x), p(0, 0)), 1 / q.length));
    });
  const zip = pc.notches.find(([q, d]) => Math.abs(q.x) < 1e-6 && d.x < 0);
  const notches = [...pc.notches.filter(mine), ...(extra.notches ?? [])];
  const piece: Piece = {
    ...pc,
    name,
    outline: pathOf(r),
    lines,
    notches,
    balance: pc.balance?.filter((b) => b.pts.every((q) => inside(q) || near(q))),
    labels: zip && mine(zip) ? pc.labels.filter((l) => l.text === 'ZIP ENDS') : [],
    cut,
    alternate: undefined,
    draft: pc.draft ? { frame: pc.draft.frame, points: [...pc.draft.points.filter((pt) => inside(pt.at) || near(pt.at)), ...(extra.points ?? [])] } : undefined,
    meta: { ...pc.meta, ...extra.meta },
  };
  return dressed(piece, name, cut);
}

/** A piece's grain, fold and name labels worked out from its outline (after a dart has moved, say). */
function dressed(pc: Piece, name: string, cut: string): Piece {
  const pts = pc.outline.points(4);
  const xs = pts.map((q) => q.x);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const ring = ringOf(pc.outline);
  const fold = ring.tags.includes('fold');
  const foldYs = run(ring, 'fold').map((q) => q.y);
  const [f0, f1] = [Math.min(...foldYs), Math.max(...foldYs)];
  const foldIn = Math.min(2, (f1 - f0) * 0.2);
  const ys = pts.map((q) => q.y);
  const spans = new Map<number, [number, number]>();
  const spanOf = (x: number) => spans.get(x) ?? spans.set(x, spanAt(pts, x) ?? [Math.min(...ys), Math.max(...ys)]).get(x)!;
  const narrow = x1 - x0 < 9;
  const text = (/^Bodice (front|back)$/.test(name) ? name : name.replace(/^Bodice /, '')).toUpperCase();
  // What the name and the grain line keep clear of: the darts, the bust point and the zip mark.
  const boxes = [...pc.lines.map((l) => l.points()), ...pc.labels.filter((l) => l.text === 'ZIP ENDS').map((l) => [add(l.at, p(-3, -1)), add(l.at, p(3, 0.5))])].map((q) => [
    Math.min(...q.map((v) => v.x)) - 0.6,
    Math.max(...q.map((v) => v.x)) + 0.6,
    Math.min(...q.map((v) => v.y)),
    Math.max(...q.map((v) => v.y)),
  ]);
  const across = (k: number) => x0 + (x1 - x0) * k;
  const tries = Array.from({ length: 19 }, (_, i) => across(0.05 + (0.9 * i) / 18));
  // The name sits between the centre and the side, clear of the darts and the grain line; turned to
  // run down a narrow piece. The grain goes in first, toward the side.
  const midY = (x: number) => (spanOf(x)[0] + spanOf(x)[1]) / 2;
  const want = fold ? across(0.3) : across(0.28);
  const grains = tries.filter((x) => boxes.every(([a, b]) => x + 0.3 < a || x - 0.3 > b)).sort((a, b) => Math.abs(a - across(fold ? 0.62 : 0.5)) - Math.abs(b - across(fold ? 0.62 : 0.5)));
  // Where the name fits at a size, with the grain at gx: level with the middle of the piece where it
  // can, otherwise a little above or below.
  const place = (size: number[], gx: number) => {
    const half = narrow ? 0.6 : text.length * size[0] * 0.32;
    const clear = [...boxes, [gx - 0.4, gx + 0.4, -Infinity, Infinity]];
    const spots = [0, -3, 3, -6, 6].flatMap((dy) =>
      tries
        .filter((x) => x - half > x0 && x + half < x1)
        .map((x) => ({ x, y: midY(x) + dy }))
        .filter(({ x, y }) => y - 2 > spanOf(x)[0] && y + 2 < spanOf(x)[1] && clear.every(([a, b, c, d]) => x + half < a || x - half > b || y + 2.5 < c || y - 2.5 > d)),
    );
    return spots.length ? { size, gx, ...spots.reduce((a, b) => (Math.abs(b.x - want) + Math.abs(b.y - midY(b.x)) < Math.abs(a.x - want) + Math.abs(a.y - midY(a.x)) ? b : a)) } : undefined;
  };
  const sizes = Math.max(...ys) - Math.min(...ys) < 14 ? [[0.8, 0.6]] : [[1.4, 0.9], [1, 0.7], [0.8, 0.6]];
  const gx0 = grains[0] ?? across(fold ? 0.62 : 0.5);
  let found: { size: number[]; gx: number; x: number; y: number } | undefined;
  for (const size of sizes) for (const g of grains.length ? grains : [gx0]) found ??= place(size, g);
  const { size, gx, x: lx, y: mid } = found ?? { size: sizes[sizes.length - 1], gx: gx0, x: want, y: midY(want) };
  const span = spanOf(gx);
  const inset = Math.min(2, (span[1] - span[0]) * 0.2);
  const labels = narrow
    ? [
        { at: p(lx, mid), text, size: size[0], rotate: 90 },
        { at: p(lx - 1.4, mid), text: cut, size: size[1] * 0.8, rotate: 90 },
      ]
    : [
        { at: p(lx, mid - size[0] * 0.8), text, size: size[0] },
        { at: p(lx, mid + size[1] * 1.2), text: cut, size: size[1] },
      ];
  return {
    ...pc,
    grain: [p(gx, span[0] + inset), p(gx, span[1] - inset)],
    fold: fold && foldYs.length ? [p(0, f0 + foldIn), p(0, f1 - foldIn)] : undefined,
    labels: [...labels, ...pc.labels.filter((l) => l.text === 'ZIP ENDS')],
    name,
    cut,
  };
}

const cutFor = (folded: boolean) => (folded ? 'Cut 1 on fold' : 'Cut 2 (1 pair)');

interface Seamed {
  pieces: Piece[];
  seams: StyleSeam[];
  /** The bust dart as sewn on the front, for the flat, when the seam moved it. */
  sewnDart?: P[];
  moved: boolean;
  warnings: string[];
}

// ---- yoke --------------------------------------------------------------------------------------

/** The range a yoke line can sit in on a piece: below the neck and the shoulder, above the bust point
 * (front) or well above the underarm (back), and clear of the armhole notches. */
function yokeLevel(r: Ring, depth: number, side: 'front' | 'back', apex: P, notches: [P, P][]): number | undefined {
  const shoulder = run(r, 'shoulder');
  const armhole = run(r, 'armhole');
  if (!shoulder.length || !armhole.length) return undefined;
  const neckPoint = shoulder[0];
  const tip = shoulder[shoulder.length - 1];
  const underarm = armhole[armhole.length - 1];
  const centreNeck = run(r, 'neck')[0] ?? r.pts[0];
  const lo = Math.max(centreNeck.y + (side === 'front' ? 2.5 : 3), tip.y + 1.5);
  const hi = side === 'front' ? Math.min(apex.y - 5, underarm.y - 3) : underarm.y - 5;
  if (lo > hi) return undefined;
  let y = Math.min(hi, Math.max(lo, neckPoint.y + depth));
  // Not through a notch: the armhole's balance marks stay whole on one piece.
  for (const [q] of notches) if (Math.abs(q.y - y) < 1.2 && q.x > 1) y = q.y + 1.2 <= hi ? q.y + 1.2 : q.y - 1.2;
  return Math.max(lo, y);
}

function yokeSide(pc: Piece, depth: number, side: 'front' | 'back', apex: P, bustDart: number): { pieces: [Piece, Piece]; seam: P[]; sewnDart?: P[]; moved: boolean } | undefined {
  const r = ringOf(pc.outline);
  const y = yokeLevel(r, depth, side, apex, pc.notches);
  if (y === undefined) return undefined;
  const far = Math.max(...r.pts.map((q) => q.x)) + 5;
  const cut = cutRing(r, [p(-1, y), p(far, y)], 'yoke');
  if (!cut || !['fold', 'centre'].includes(cut.on[0]) || cut.on[1] !== 'armhole') return undefined;
  const front = side === 'front';
  const upper = from(cut.a, runStart(cut.a, 'neck'));
  const lower = from(cut.b, cut.b.pts.indexOf(cut.seam[0]));
  const seam = cut.seam;
  const L = polyLen(seam);
  // A notch on the front yoke seam (two on the back), between the centre and the bust dart on the front.
  const moves = front && bustDart > 0.3 && apex.x < seam[seam.length - 1].x - 2;
  const at = front ? [moves ? p(apex.x * 0.5, y) : pointAlong(seam, L * 0.5).q] : [pointAlong(seam, L * 0.5 - 0.5).q, pointAlong(seam, L * 0.5 + 0.5).q];
  const neckPoint = run(r, 'shoulder')[0];
  const note: DraftPoint = {
    n: 'Y',
    at: p(0, y),
    note: `Yoke: ruled straight across, square to the centre ${side}, ${cm(y - neckPoint.y)} below the neck point.${moves ? ' The bust dart is closed at the side and opens on the yoke seam over the bust point.' : ''}`,
  };
  const name = front ? 'Bodice front' : 'Bodice back';
  const yoke = part(pc, upper, `${name} yoke`, cutFor(front), { notches: seamNotches(at, seam, upper), meta: { yoke: true } });
  let body = part(pc, lower, name, cutFor(front), { notches: seamNotches(at, seam, lower), points: [note] });
  delete body.meta.pointedAtCentre;
  let sewnDart: P[] | undefined;
  if (moves) {
    const moved = moveFrontDart(body, apex, 'shoulder', undefined, undefined, { tag: 'yoke', along: apex.x, words: 'yoke seam' });
    if (moved !== body) {
      sewnDart = moved.meta.sewnDart as P[] | undefined;
      const { bustDart: _b, sewnDart: _s, ...meta } = moved.meta;
      body = dressed({ ...moved, meta }, name, body.cut);
    }
  }
  return { pieces: [body, yoke], seam, sewnDart, moved: !!sewnDart };
}

function yoke(d: BodiceDraft, y: Yoke): Seamed | undefined {
  const [front, back] = d.pieces;
  const f = y.front !== undefined ? yokeSide(front, y.front, 'front', d.front.apex, d.bustDart) : undefined;
  const b = y.back !== undefined ? yokeSide(back, y.back, 'back', d.front.apex, 0) : undefined;
  if (!f && !b) return undefined;
  const warnings = [...(y.front !== undefined && !f ? ['the neckline sits too low for a front yoke above the bust; it is left out'] : []), ...(y.back !== undefined && !b ? ['there is no room for a back yoke; it is left out'] : [])];
  return {
    pieces: [f ? f.pieces[0] : front, b ? b.pieces[0] : back, ...(f ? [f.pieces[1]] : []), ...(b ? [b.pieces[1]] : [])],
    seams: [...(f ? [{ kind: 'yoke' as const, side: 'front' as const, pts: f.seam }] : []), ...(b ? [{ kind: 'yoke' as const, side: 'back' as const, pts: b.seam }] : [])],
    sewnDart: f?.sewnDart,
    moved: !!f?.moved,
    warnings,
  };
}

// ---- empire ------------------------------------------------------------------------------------

/** The bust dart closed into the waist dart (or opened at the waist under the bust point), and how
 * far the piece below the old side dart turned about the bust point to get there. */
function toWaist(d: BodiceDraft): { front: Piece; turn: number } {
  const [front] = d.pieces;
  if (d.bustDart <= 0.3) return { front, turn: 0 };
  const moved = moveFrontDart(front, d.front.apex, 'waist', d.front.waistSide);
  if (moved === front) return { front, turn: 0 };
  const { bustDart: _b, sewnDart: _s, ...meta } = moved.meta;
  const side = run(ringOf(moved.outline), 'side');
  return { front: { ...moved, meta }, turn: turnBetween(d.front.apex, d.front.waistSide, side[side.length - 1]) };
}

/** The dart line a piece has at its waist: leg end, point, leg end. */
const waistDart = (pc: Piece) => pc.lines.map((l) => l.points()).find((q) => q.length === 3);

/** A squared line from the centre at y0 to the side seam at s, square to both. Run on past each end. */
function squaredLine(y0: number, s: { q: P; dir: P }): P[] {
  const y = squaredWaist(y0, s.q.x, s.q.y, s.dir);
  const n = Math.max(2, Math.ceil(s.q.x * 4));
  const out = unit(p(s.dir.y, -s.dir.x));
  // Points close to each end keep the direction the line leaves and arrives in, as the waist does.
  const ts = [0, 0.0005, 0.004, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n), 0.996, 0.9995, 1];
  return [p(-1, y0), ...ts.map((t) => p(s.q.x * t, y(s.q.x * t))), add(s.q, mul(out, 3))];
}

/**
 * One side cut along its empire line: the upper piece with the dart above the line opening on the
 * seam (its point moved square over the opening so the legs stay equal), and the band with its half
 * of the dart brought together at the seam, a dart from the waist to a point on the seam.
 */
function empireSide(pc: Piece, line: P[], side: 'front' | 'back', notchCount: 1 | 2): { upper: Piece; band: Piece; seam: P[]; split?: { n1: P; f1: P } } | undefined {
  const r = ringOf(pc.outline);
  const cut = cutRing(r, line, 'empire');
  if (!cut || !['fold', 'centre'].includes(cut.on[0]) || cut.on[1] !== 'side') return undefined;
  const front = side === 'front';
  const seam = cut.seam;
  const dl = waistDart(pc);
  const legHit = (a: P, b: P) => {
    for (let i = 1; i < seam.length; i++) {
      const m = meet(a, b, seam[i - 1], seam[i]);
      if (m) return m.q;
    }
    return undefined;
  };
  const n1 = dl && legHit(dl[1], dl[0]);
  const f1 = dl && legHit(dl[1], dl[2]);
  const name = front ? 'Bodice front' : 'Bodice back';
  const bandName = front ? 'Bodice midriff front' : 'Bodice midriff back';
  const yc = seam[0].y;
  const point: DraftPoint = { n: 'E', at: seam[0], note: `Empire seam: drawn square to the centre ${side} and to the side seam, so it runs on level round the body. The midriff band below it runs to the waist.` };
  // Notches: in the part of the seam between the centre and the dart (all of it without one).
  const notchPart = n1 ? [seam[0], ...seam.filter((q) => q.x > 0 && q.x < n1.x), n1] : seam;
  const Ln = polyLen(notchPart);
  const at = notchCount === 1 ? [pointAlong(notchPart, Ln * 0.5).q] : [pointAlong(notchPart, Ln * 0.5 - 0.5).q, pointAlong(notchPart, Ln * 0.5 + 0.5).q];
  if (!dl || !n1 || !f1) {
    // No dart crosses the line: a straight cut, any dart staying whole below it.
    const upper = from(cut.a, runStart(cut.a, 'neck'));
    const band = from(cut.b, cut.b.pts.indexOf(cut.seam[0]));
    const up = part(pc, upper, name, cutFor(front), { notches: seamNotches(at, seam, upper) });
    const low = part(pc, band, bandName, cutFor(front), { notches: seamNotches(at, seam, band), points: [point] });
    delete low.meta.pointedAtCentre;
    return { upper: up, band: low, seam };
  }

  // Above: the seam from the side to the centre, the dart opening on it.
  const back = [...seam].reverse();
  const tip0 = dl[1];
  const mid = lerp(n1, f1, 0.5);
  const across = unit(sub(f1, n1));
  let up = p(-across.y, across.x);
  if (up.x * (tip0.x - mid.x) + up.y * (tip0.y - mid.y) < 0) up = mul(up, -1);
  const tip = add(mid, mul(up, len(sub(tip0, mid))));
  const towardCentre = back.find((q) => q.x < n1.x - 1e-6) ?? seam[0];
  const dart = finishDart(tip, n1, f1, unit(sub(towardCentre, n1)));
  const edge = [...back.filter((q) => q.x > f1.x + 1e-6), f1, dart.peak, n1, ...back.filter((q) => q.x < n1.x - 1e-6)];
  const edgeTags = edge.slice(1).map((q, i) => (edge[i] === f1 || q === n1 ? 'dart' : 'empire'));
  // The ring's own part of the upper piece (from the centre round to the side), then the new edge back.
  const ringA = cut.a.pts.length - (seam.length - 2);
  const joined = { pts: [...cut.a.pts.slice(0, ringA), ...edge.slice(1, -1)], tags: [...cut.a.tags.slice(0, ringA - 1), ...edgeTags] };
  const upperRing = from(joined, runStart(joined, 'neck'));
  const keepLines = pc.lines.filter((ln) => ln.points().length !== 3);
  const upper = part(pc, upperRing, name, cutFor(front), {
    notches: seamNotches(at, seam, upperRing),
    lines: [new Path(n1).line(tip).line(f1), ...keepLines.filter((ln) => insidePolygon(ln.points()[0], upperRing.pts))],
  });

  // Below: the side part slid across until the dart's legs meet at the seam.
  const b = cut.b;
  const ringB = b.pts.length - (seam.length - 2);
  const at0 = (q: P) => b.pts.findIndex((x, k) => k < ringB && len(sub(x, q)) < 1e-6);
  const iFar = at0(dl[2]);
  const iNear = at0(dl[0]);
  const iC = ringB - 1;
  if (iFar < 0 || iNear < 0 || iFar > iNear) return undefined;
  const t = sub(n1, f1);
  const shift = (q: P) => add(q, t);
  const sidePart = b.pts.slice(0, iFar + 1).map(shift);
  const sideTags = b.tags.slice(0, iFar);
  const centrePart = b.pts.slice(iNear, iC + 1);
  const centreTags = b.tags.slice(iNear, iC);
  const cInt = seam.filter((q) => q.x > 1e-6 && q.x < n1.x - 1e-6);
  const sInt = seam.filter((q) => q.x > f1.x + 1e-6 && q.x < seam[seam.length - 1].x - 1e-6).map(shift);
  const bd = finishDart(n1, centrePart[0], sidePart[sidePart.length - 1], unit(sub(centrePart[1], centrePart[0])));
  const pts = [seam[0], ...cInt, n1, ...sInt, ...sidePart.slice(0, -1), bd.far, bd.peak, bd.near, ...centrePart.slice(1, -1)];
  const tags = [
    ...cInt.map(() => 'empire'),
    'empire',
    ...sInt.map(() => 'empire'),
    'empire',
    ...sideTags,
    'dart',
    'dart',
    ...centreTags,
  ];
  const bandRing = { pts, tags };
  const sideOwn = (q: P) => q.x > n1.x;
  const band = part({ ...pc, notches: pc.notches.filter(([q]) => q.y > yc && !sideOwn(q)) }, bandRing, bandName, cutFor(front), {
    notches: seamNotches(at, seam, bandRing),
    lines: [new Path(bd.near).line(n1).line(bd.far)],
    points: [point],
  });
  delete band.meta.pointedAtCentre;
  return { upper, band, seam, split: { n1, f1 } };
}

function empire(d: BodiceDraft, below: number): Seamed | undefined {
  const { front, turn } = toWaist(d);
  const back = d.pieces[1];
  const apex = d.front.apex;
  const fr = ringOf(front.outline);
  const fSide = run(fr, 'side');
  const fWaist = fSide[fSide.length - 1];
  const dl = waistDart(front);
  const lo = Math.max(apex.y + EMPIRE_RANGE.min, dl ? dl[1].y + 2 : -Infinity);
  // Above the waist, and above where the waist dart is shaped for pressing.
  const dartYs = fr.pts.filter((_, i) => fr.tags[i] === 'dart').map((q) => q.y);
  const hi = Math.min(d.front.waistCentre.y - 5, fWaist.y - 5, ...dartYs.map((y) => y - 3));
  if (lo > hi) return undefined;
  const yc = Math.min(hi, Math.max(lo, apex.y + below));
  const sf = atLevel(fSide, yc);
  if (!sf) return undefined;
  // The back is cut level with the front at the side seam: the band's side seams the same length.
  const bSide = run(ringOf(back.outline), 'side');
  const fromWaist = polyLen([sf.q, ...fSide.filter((q) => q.y > yc)]);
  const sb = pointAlong(bSide, polyLen(bSide) - fromWaist);
  const f = empireSide(front, squaredLine(yc, sf), 'front', 1);
  const b = empireSide(back, squaredLine(sb.q.y, sb), 'back', 2);
  if (!f || !b) return undefined;
  // The front's line on the block, for the flat: the same up to the dart, then straight on to the side
  // seam level with the back's (the flat draws the block's side as drafted, the bust dart folded away).
  const blockRing = ringOf(d.pieces[0].outline);
  const sideEnd = (atLevel(lastRun(blockRing, 'side'), sb.q.y) ?? atLevel(run(blockRing, 'side'), sb.q.y))?.q ?? f.seam[f.seam.length - 1];
  const turnAt = f.split ? f.split.f1.x : apex.x;
  const sewnFront = turn ? [...f.seam.filter((q) => q.x <= turnAt), sideEnd] : f.seam;
  return {
    pieces: [f.upper, b.upper, f.band, b.band],
    seams: [
      { kind: 'empire', side: 'front', pts: sewnFront },
      { kind: 'empire', side: 'back', pts: b.seam },
    ],
    moved: turn !== 0,
    warnings: [],
  };
}

// ---- side panels -------------------------------------------------------------------------------

/** The panel line on one piece: from `at` of the way down the armhole (below the across point) to
 * the waist, as far in from the side seam there as it starts in from the underarm. */
function panelLine(r: Ring, at: number, dl: P[] | undefined): { line: P[]; top: P; foot: P } | undefined {
  const arm = run(r, 'armhole');
  const sideRun = run(r, 'side');
  const waist = run(r, 'waist');
  if (arm.length < 2 || sideRun.length < 2 || waist.length < 2) return undefined;
  const L = polyLen(arm);
  // The across point (the armhole's narrowest), where the seam can start below.
  let acrossS = 0;
  let acc = 0;
  let minX = Infinity;
  arm.forEach((q, i) => {
    if (i) acc += len(sub(q, arm[i - 1]));
    if (q.x < minX) {
      minX = q.x;
      acrossS = acc;
    }
  });
  const lo = Math.max(PANEL_RANGE.min, acrossS / L + 0.08);
  const top = pointAlong(arm, L * Math.min(PANEL_RANGE.max, Math.max(lo, at))).q;
  const underarm = arm[arm.length - 1];
  const waistSide = sideRun[sideRun.length - 1];
  const dartX = dl ? Math.max(dl[0].x, dl[2].x) + 1.5 : 0;
  // Never slanting out past where it leaves the armhole: just below the across point the armhole runs
  // nearly straight down, so a seam leaning outward would cut out through it.
  const x = Math.min(waistSide.x - 2, Math.max(dartX, Math.min(top.x, waistSide.x - Math.max(3, underarm.x - top.x))));
  const hit = waist.findIndex((q, i) => i > 0 && (waist[i - 1].x - x) * (q.x - x) <= 0 && waist[i - 1].x !== q.x);
  if (hit < 0) return undefined;
  const foot = lerp(waist[hit - 1], waist[hit], (x - waist[hit - 1].x) / (waist[hit].x - waist[hit - 1].x));
  const u = unit(sub(foot, top));
  // Run on a little past each end, so it crosses the armhole and the waist and nothing else.
  return { line: [sub(top, mul(u, 0.05)), top, foot, add(foot, mul(u, 2))], top, foot };
}

function panelSide(pc: Piece, at: number, side: 'front' | 'back'): { centre: Piece; side: Piece; seam: P[]; top: P; foot: P } | undefined {
  const r = ringOf(pc.outline);
  const pl = panelLine(r, at, waistDart(pc));
  if (!pl) return undefined;
  const cut = cutRing(r, pl.line, 'panel');
  if (!cut || cut.on[0] !== 'armhole' || cut.on[1] !== 'waist') return undefined;
  const front = side === 'front';
  const names: [string, string] = front ? ['Bodice centre front', 'Bodice side front'] : ['Bodice centre back', 'Bodice side back'];
  const centreRing = from(cut.b, runStart(cut.b, 'neck'));
  const sideRing = cut.a;
  const L = polyLen(cut.seam);
  const at2 = [pointAlong(cut.seam, L * 0.35).q, pointAlong(cut.seam, L * 0.7).q];
  const point: DraftPoint = { n: 'S', at: pl.top, note: `Side panel seam: from the armhole below the across ${side} point down to the waist, about as far in from the side seam all the way.` };
  const centre = part(pc, centreRing, names[0], cutFor(front), { notches: seamNotches(at2, cut.seam, centreRing), meta: { panelSeam: names[1] } });
  const sidePc = part(pc, sideRing, names[1], 'Cut 2 (1 pair)', { notches: seamNotches(at2, cut.seam, sideRing), points: [point], meta: { panelSeam: names[0] } });
  delete sidePc.meta.pointedAtCentre;
  return { centre, side: { ...sidePc, fold: undefined }, seam: cut.seam, top: pl.top, foot: pl.foot };
}

function panels(d: BodiceDraft, at: number): Seamed | undefined {
  const { front, turn } = toWaist(d);
  const f = panelSide(front, at, 'front');
  const b = panelSide(d.pieces[1], at, 'back');
  if (!f || !b) return undefined;
  const unturn = rotAbout(d.front.apex, -turn);
  return {
    pieces: [f.centre, f.side, b.centre, b.side],
    seams: [
      { kind: 'panel', side: 'front', pts: [f.top, turn ? unturn(f.foot) : f.foot] },
      { kind: 'panel', side: 'back', pts: [b.top, b.foot] },
    ],
    moved: turn !== 0,
    warnings: [],
  };
}

/**
 * The block cut along its style seam, when it has one: a yoke, an empire seam or side panels. The block
 * stays on the draft as sewn (side bust dart and all), so sleeves, facings, collars and the flat are
 * worked from it, and the seams go on the flat as lines.
 */
export function styleSeams(d: BodiceDraft, s: BodiceStyle): BodiceDraft {
  const kind = seamOf(s);
  if (!kind || d.pieces.length < 2) return d;
  const warn = (w: string) => ({ ...d, warnings: [...d.warnings, w] });
  if (d.lowShoulder) return warn(`with one shoulder lower, the ${WORDS[kind]} is left out`);
  if (kind !== 'yoke' && d.drop > 0) return warn(`${kind === 'empire' ? 'an empire seam' : 'side panels'} need a waist-length bodice; left out`);
  const out = kind === 'yoke' ? yoke(d, s.yoke!) : kind === 'empire' ? empire(d, s.empire!) : panels(d, s.panel!.at);
  if (!out) return warn(`there is no room for the ${WORDS[kind]} on this bodice; left out`);
  const [front, back] = d.pieces;
  const lines = (side: 'front' | 'back') => out.seams.filter((sm) => sm.side === side).map((sm) => ({ pts: sm.pts, kind: 'seam' as const }));
  return {
    ...d,
    block: [front, back],
    pieces: [...out.pieces, ...d.pieces.slice(2)],
    styleLines: {
      skip: out.moved ? 'side' : 'none',
      front: [...lines('front'), ...(out.sewnDart ? [{ pts: out.sewnDart, kind: 'dart' as const }] : [])],
      back: lines('back'),
    },
    styleSeams: out.seams,
    warnings: [...d.warnings, ...out.warnings],
  };
}
