// Two skirt details drafted from the darted block: a yoke and a button front.
// - The yoke: a shaped band at the top of the skirt, cut off along a line that runs square from the
//   centre, through the point of every waist dart, and meets the side seam square. The darts end on the
//   line, so the skirt below has none; in the yoke each dart is closed by swinging the part beyond it
//   round its point, so the yoke curves round the body as the darts did. Every edge keeps its length, so
//   the yoke and the skirt sew back together edge for edge.
// - The button front: the front opened at the centre front, an extension and a facing added, buttons
//   from the waistband down to 15 cm above the hem, and the back on the fold with no zip. The waistband
//   runs on across both extensions and buttons too.
// Plain ASCII punctuation (see instructions.ts).
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { pathOf, ringOf } from './manipulate';
import type { Ring } from './manipulate';
import { insidePolygon } from './marks';
import { BUTTON_CM, Buttons, EXTENSION_CM, backOnFold, openFront } from './collar';
import type { DraftPoint, Piece } from './piece';
import type { SewingGuide, SewStep } from './instructions';

/** The buttons stop 15 cm or more above the hem, so the skirt opens a little to walk in. */
export const BUTTONS_STOP_ABOVE_HEM = 15;
/** How far the front facing reaches in from the centre front. */
const FACING_IN = 6.5;
/** The skirt yoke: how many cm down the side seam it reaches at least and at most, and how far above
 * the hip line it stays. */
const SKIRT_YOKE = { min: 8, max: 16, aboveHip: 3 };

interface FrontStyle {
  silhouette: string;
  pleats?: string;
  godets?: unknown;
  flounce?: string;
  asymHem?: string;
  wrap?: boolean;
  shape?: unknown;
  waist?: string;
  pockets?: string;
  zip?: string;
  slit?: string;
  joinTo?: unknown;
  yoke?: boolean;
  buttons?: boolean;
}

const plain = (s: FrontStyle) => (s.pleats ?? 'none') === 'none' && !s.godets && (s.flounce ?? 'none') === 'none' && !s.wrap && !s.shape;

/** Why a skirt can't have a yoke, or undefined when it can: it is cut from the darts of a plain block,
 * and sits under a waistband with the zip at the back. */
export function yokeBlocked(s: FrontStyle): string | undefined {
  if (!['pencil', 'straight', 'a_line', 'trumpet'].includes(s.silhouette) || !plain(s) || s.asymHem === 'diagonal')
    return 'A yoke is cut from the darts of a plain pencil, straight, A-line or trumpet skirt, with no pleats, godets or flounce.';
  if (s.waist && s.waist !== 'band') return 'A yoke sits under a waistband, so it takes the band with a zip.';
  if (s.pockets === 'inseam') return 'In-seam pockets open where the yoke meets the side seam.';
  if (s.zip === 'side') return 'A yoke takes the zip at the centre back.';
  if (s.buttons) return 'A yoke and a button front are one detail too many at the top: choose one.';
  return undefined;
}

/** Why a skirt can't button down the front, or undefined when it can: a straight centre front cut on the
 * fold, with no pleats, godets, flounce or uneven hem in the way, under a waistband. */
export function buttonsBlocked(s: FrontStyle): string | undefined {
  if (!['straight', 'a_line', 'gathered', 'trumpet'].includes(s.silhouette) || !plain(s) || (s.asymHem ?? 'none') !== 'none')
    return 'Buttons run down a straight, A-line, gathered or trumpet skirt with a level hem and no pleats, godets or flounce.';
  if (s.waist && s.waist !== 'band') return 'A button front closes into a waistband, so it takes the band.';
  if (s.slit === 'front') return 'The button front opens at the centre front already, so it takes no front slit.';
  if (s.zip === 'side') return 'A button front is the opening, so the skirt needs no zip.';
  return undefined;
}

export const yokeOf = (s: FrontStyle) => !s.joinTo && !!s.yoke && !yokeBlocked(s);
export const buttonsOf = (s: FrontStyle) => !s.joinTo && !!s.buttons && !buttonsBlocked(s);

// ---- the yoke ----------------------------------------------------------------------------------

/** A Catmull-Rom curve through the points, from the first to the last, with a ghost point at each end. */
function through(pts: P[], before: P, after: P, steps = STEPS): P[] {
  const all = [before, ...pts, after];
  const out: P[] = [pts[0]];
  for (let i = 1; i < all.length - 2; i++) {
    const [a, b, c, d] = [all[i - 1], all[i], all[i + 1], all[i + 2]];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (u: number, v: number, w: number, z: number) => 0.5 * (2 * v + (-u + w) * t + (2 * u - 5 * v + 4 * w - z) * t2 + (-u + 3 * v - 3 * w + z) * t3);
      out.push(p(f(a.x, b.x, c.x, d.x), f(a.y, b.y, c.y, d.y)));
    }
  }
  return out;
}

const STEPS = 12;
const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** The point `s` cm along a polyline, and the edge it is on. */
function along(poly: P[], s: number): { q: P; k: number } {
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const l = len(sub(poly[i], poly[i - 1]));
    if (acc + l >= s) return { q: lerp(poly[i - 1], poly[i], l ? (s - acc) / l : 0), k: i - 1 };
    acc += l;
  }
  return { q: poly[poly.length - 1], k: poly.length - 2 };
}

interface Dart {
  near: number;
  far: number;
  tip: P;
}

/** The waist darts of a half piece, from the centre out: the ring indices of their legs, and their points. */
function dartsOf(pc: Piece, r: Ring, side: number): Dart[] {
  const lines = pc.lines.map((l) => l.points(1));
  const out: Dart[] = [];
  for (let i = 1; i < side; i++) {
    if (r.tags[i] !== 'dart' || r.tags[i - 1] === 'dart') continue;
    const line = lines.find((l) => l.length === 3 && len(sub(l[0], r.pts[i])) < 0.3 && len(sub(l[2], r.pts[i + 2])) < 0.3);
    if (line) out.push({ near: i, far: i + 2, tip: line[1] });
  }
  return out;
}

const rotation = (c: P, a: number) => (q: P) => {
  const v = sub(q, c);
  return add(c, p(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)));
};
const turn = (c: P, a: P, b: P) => {
  const u = sub(a, c);
  const v = sub(b, c);
  return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
};

/** Notches on a seam, `at` cm along it, each pointing out of the piece. */
function seamNotches(seam: P[], at: number[], ring: P[]): [P, P][] {
  return at.map((s) => {
    const { q, k } = along(seam, s);
    const u = unit(sub(seam[k + 1], seam[k]));
    const out = p(-u.y, u.x);
    return insidePolygon(add(q, mul(out, 0.3)), ring) ? [q, mul(out, -1)] : [q, out];
  });
}

/** How far down the side seam the yoke meets it: level with the outer dart points, front and back alike. */
export function yokeSideAt(front: Piece, back: Piece, hipDepth: number): number {
  const depth = (pc: Piece) => {
    const r = ringOf(pc.outline);
    const s = r.tags.indexOf('side');
    const ds = dartsOf(pc, r, s);
    return ds.length ? ds[ds.length - 1].tip.y - r.pts[s].y : undefined;
  };
  const ds = [depth(front), depth(back)].filter((d): d is number => d !== undefined);
  const want = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 11;
  return Math.max(SKIRT_YOKE.min, Math.min(SKIRT_YOKE.max, hipDepth - SKIRT_YOKE.aboveHip, want));
}

/**
 * A half skirt piece cut into its yoke and the skirt below, the yoke's darts closed. `sideAt` is how far
 * down the side seam the yoke line meets it, the same on the front and the back.
 */
export function splitYoke(pc: Piece, sideAt: number, front: boolean): { yoke: Piece; skirt: Piece; seam: P[] } | undefined {
  const r = ringOf(pc.outline);
  const n = r.pts.length;
  const s = r.tags.indexOf('side');
  if (s < 0 || Math.abs(r.pts[0].x) > 1e-6 || r.tags[0] !== 'waist') return undefined;
  let e = s;
  while (r.tags[e] === 'side') e++;
  const side = r.pts.slice(s, e + 1);
  if (polyLen(side) < sideAt + 3) return undefined;
  const S = along(side, sideAt);
  const k = s + S.k;
  const darts = dartsOf(pc, r, s);
  const tips = darts.map((d) => d.tip);
  const C = p(0, tips.length ? tips[0].y : S.q.y);
  // Square to the centre, through each dart point, square to the side seam.
  const down = unit(sub(along(side, sideAt + 0.5).q, along(side, Math.max(0, sideAt - 0.5)).q));
  let out = p(down.y, -down.x);
  if (out.x < 0) out = mul(out, -1);
  const last = tips.length ? tips[tips.length - 1] : C;
  // The last 1.5 cm runs straight in, so it leaves the side seam square.
  const inner = sub(S.q, mul(out, 1.5));
  const ctrl = [C, ...tips, inner];
  const seam = [...through(ctrl, tips.length ? p(-tips[0].x, tips[0].y) : p(-inner.x, inner.y), add(last, mul(out, 2 * len(sub(inner, last))))), S.q];
  const at = [...ctrl.slice(0, -1).map((_, i) => i * STEPS), seam.length - 1];
  if (seam.some((q, i) => i > 0 && q.x <= seam[i - 1].x)) return undefined;

  // The skirt below: the seam, the side seam on from the yoke, the hem, and up the centre to the seam.
  const lowRing: Ring = {
    pts: [...seam, ...r.pts.slice(k + 1)],
    tags: [...seam.slice(1).map(() => 'yoke'), 'side', ...r.tags.slice(k + 1)],
  };
  // The yoke in parts between the darts, each swung round the dart point before it to close the dart.
  const ends = [0, ...darts.flatMap((d) => [d.near, d.far]), s];
  const moves: ((q: P) => P)[] = [(q) => q];
  darts.forEach((d, j) => {
    const prev = moves[j];
    const swing = rotation(d.tip, turn(d.tip, r.pts[d.far], r.pts[d.near]));
    moves.push((q) => prev(swing(q)));
  });
  const pts: P[] = [];
  const tags: string[] = [];
  for (let j = 0; j <= darts.length; j++) {
    const [a, b] = [ends[2 * j], ends[2 * j + 1]];
    for (let i = j ? a + 1 : a; i <= b; i++) {
      pts.push(moves[j](r.pts[i]));
      tags.push(r.tags[i] === 'dart' ? 'waist' : r.tags[i]);
    }
  }
  // Down the side seam to the yoke line, then back along it to the centre.
  for (let i = s + 1; i <= k; i++) {
    pts.push(moves[darts.length](r.pts[i]));
    tags.push('side');
  }
  const back: P[] = [];
  for (let j = darts.length; j >= 0; j--) {
    const run = seam.slice(at[j], at[j + 1] + 1).reverse();
    back.push(...run.slice(back.length ? 1 : 0).map(moves[j]));
  }
  tags[tags.length - 1] = 'side';
  pts.push(...back);
  tags.push(...back.slice(0, -1).map(() => 'yoke'), r.tags[n - 1]);
  // The last point is the centre of the seam; the edge from it closes up the centre to the waist.
  const yokeRing: Ring = { pts, tags };
  const yokeSeam = [...back].reverse();

  // Notches: one on the front yoke seam, two on the back, halfway along; the piece's own notches go
  // with the part they are on, the yoke's swung with it.
  const L = polyLen(seam);
  const marks = front ? [L * 0.5] : [L * 0.5 - 0.5, L * 0.5 + 0.5];
  const partOf = (q: P) => {
    for (let j = 0; j <= darts.length; j++) {
      const wedge = [...r.pts.slice(j ? ends[2 * j] : 0, ends[2 * j + 1] + 1), ...(j === darts.length ? r.pts.slice(s + 1, k + 1) : []), ...seam.slice(at[j], at[j + 1] + 1).reverse()];
      if (insidePolygon(q, wedge)) return j;
    }
    return -1;
  };
  const lowNotches: [P, P][] = [];
  const yokeNotches: [P, P][] = [];
  for (const [q, d] of pc.notches) {
    const inner = sub(q, mul(unit(d), 0.3));
    if (insidePolygon(inner, lowRing.pts)) lowNotches.push([q, d]);
    else {
      const j = partOf(inner);
      if (j >= 0) yokeNotches.push([moves[j](q), sub(moves[j](add(q, d)), moves[j](q))]);
    }
  }
  const name = front ? 'Skirt front' : 'Skirt back';
  const cut = pc.cut;
  const hip = pc.balance?.[0]?.pts[0].y ?? S.q.y + 8;
  const width = Math.max(...r.pts.map((q) => q.x));
  const point: DraftPoint = {
    n: 'Y',
    at: C,
    note: `Yoke: square from the centre ${front ? 'front' : 'back'}${tips.length ? `, through the point of ${tips.length === 1 ? 'the dart' : 'each dart'}` : ''}, to meet the side seam square ${sideAt.toFixed(1)} cm below the waist. ${tips.length ? 'The darts end on the line: closed in the yoke, gone from the skirt below.' : ''}`.trim(),
  };
  const skirt: Piece = {
    ...pc,
    name,
    outline: pathOf(lowRing),
    lines: pc.lines.filter((l) => l.points(1).length !== 3),
    notches: [...lowNotches, ...seamNotches(seam, marks, lowRing.pts)],
    labels: pc.labels.map((l) => (l.text === name.toUpperCase() ? { ...l, at: p(l.at.x, hip + 3.2) } : l.text === cut ? { ...l, at: p(l.at.x, hip + 5) } : l)),
    grain: pc.grain ? [p(pc.grain[0].x, Math.max(pc.grain[0].y, hip + 7)), pc.grain[1]] : undefined,
    fold: pc.fold ? [p(0, C.y + 2), pc.fold[1]] : undefined,
    draft: pc.draft ? { frame: pc.draft.frame, points: [...pc.draft.points.filter((d) => d.at.y > C.y - 0.5 && insidePolygon(add(d.at, p(0.01, 0.01)), lowRing.pts)), point] } : undefined,
  };
  const top = r.pts[0].y;
  const { hem: _hem, ...rest } = pc.allowances;
  const gx = Math.min(tips.length ? tips[0].x * 0.5 : width * 0.3, width * 0.3);
  const yoke: Piece = {
    ...pc,
    name: `${name} yoke`,
    outline: pathOf(yokeRing),
    lines: [],
    notches: [...yokeNotches, ...seamNotches(yokeSeam, marks, yokeRing.pts)],
    balance: [],
    labels: [
      { at: p(Math.max(gx + 4.5, width * 0.42), (top + C.y) / 2 - 0.2), text: `${name.toUpperCase()} YOKE`, size: 0.8 },
      { at: p(Math.max(gx + 4.5, width * 0.42), (top + C.y) / 2 + 1.2), text: cut, size: 0.6 },
    ],
    grain: [p(gx, top + 1.5), p(gx, C.y - 1.5)],
    fold: pc.fold ? [p(0, top + 1), p(0, C.y - 1)] : undefined,
    draft: undefined,
    allowances: rest,
    meta: { yoke: true },
  };
  return { yoke, skirt, seam };
}

// ---- the button front ----------------------------------------------------------------------------

/** Where a polyline crosses x, as a y (the nearest point's when it doesn't). */
function yAt(pts: P[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return lerp(a, b, (x - a.x) / (b.x - a.x)).y;
  }
  return pts.reduce((c, q) => (Math.abs(q.x - x) < Math.abs(c.x - x) ? q : c)).y;
}

/** The skirt front opened for buttons, the extension's top at the waist (a dress's at its waist seam). */
export function openSkirtFront(front: Piece, buttons: Buttons): Piece {
  const raw = openFront(front, buttons);
  const ring = ringOf(raw.outline);
  const { 'opening-neck': _neck, ...allowances } = raw.allowances;
  return {
    ...raw,
    outline: pathOf({ pts: ring.pts, tags: ring.tags.map((t) => (t === 'opening-neck' ? 'opening-waist' : t)) }),
    allowances: { ...allowances, 'opening-waist': front.allowances.waist ?? front.seamAllowance },
  };
}

/** The skirt's front facing: the extension and 6.5 cm in from the centre front, waist to hem. */
export function skirtFrontFacing(front: Piece): Piece {
  const { pts, tags } = front.outline.taggedPoints(4);
  const run = (tag: string) => pts.filter((_, i) => tags[i] === tag || tags[i - 1] === tag);
  const waist = run('waist');
  const hem = run('hem');
  const top = (x: number) => yAt(waist, Math.max(0, x));
  const foot = (x: number) => yAt(hem, Math.max(0, x));
  const X = -EXTENSION_CM;
  const outline = new Path(p(X, top(0)))
    .line(p(FACING_IN, top(FACING_IN)), 'waist')
    .line(p(FACING_IN, foot(FACING_IN)), 'facing')
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
    grain: [p(FACING_IN * 0.3, mid - 8), p(FACING_IN * 0.3, mid + 8)],
    notches: [],
    labels: [
      { at: p(FACING_IN * 0.45, mid), text: 'SKIRT FRONT FACING', size: 0.8, rotate: 90 },
      { at: p(FACING_IN * 0.45 - 1.1, mid), text: cut, size: 0.55, rotate: 90 },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: front.seamAllowance,
    allowances: { waist: front.allowances.waist ?? front.seamAllowance, opening: 1, hem: front.allowances.hem ?? front.seamAllowance, facing: 0 },
    meta: {},
  };
}

/** A skirt's buttons: the first 3 cm below the waistband, the last 15 cm above the hem, about 8 cm apart. */
function skirtButtons(hem: number): Buttons {
  const first = 3;
  const last = hem - BUTTONS_STOP_ABOVE_HEM;
  const count = Math.max(2, Math.round((last - first) / 8));
  const at = Array.from({ length: count + 1 }, (_, i) => Math.round((first + ((last - first) * i) / count) * 10) / 10);
  return { count: at.length, at, sizeCm: BUTTON_CM };
}

/** The front opened and faced, the back on the fold (or keeping its seam for a back slit), with no zip. */
export function buttonFront(front: Piece, back: Piece, keepBackSeam: boolean): { front: Piece; back: Piece; facing: Piece; buttons: Buttons; closed: [Piece, Piece] } {
  const hem = Math.max(...front.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
  const buttons = skirtButtons(hem);
  const opened = openSkirtFront(front, buttons);
  const unzipped: Piece = { ...back, notches: back.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)), labels: back.labels.filter((l) => l.text !== 'ZIP ENDS') };
  const b = keepBackSeam ? unzipped : backOnFold(back);
  return { front: opened, back: b, facing: skirtFrontFacing(opened), buttons, closed: [front, b] };
}

/** The button front's waistband: from one front edge round to the other, the extensions overlapping. */
export function buttonBandLength(finishedWaist: number) {
  return finishedWaist + 2 * EXTENSION_CM;
}

/** The front's waist, centre front to side seam, darts closed. */
export const frontWaist = (front: Piece) => taggedLength(front.outline, 'waist');

// ---- the steps ---------------------------------------------------------------------------------

const step = (title: string, text: string): SewStep => ({ title, text });

/** The skirt's steps with its yoke: the yokes cut and joined before the side seams, the darts gone. */
export function yokeSteps(g: SewingGuide, seam: string): SewingGuide {
  const steps = g.steps.flatMap((s): SewStep[] => {
    switch (s.title) {
      case 'Cut out':
        return [{ ...s, text: `${s.text} Cut the front yoke on the fold and the back yoke as a pair, the same way, and snip the yoke seam notches: one on the front, two on the back.` }];
      case 'Neaten the edges':
        return [{ ...s, text: s.text.replace('of the skirt pieces', 'of the skirt pieces and the yokes, and the lower edge of each yoke') }];
      case 'Put in the zip':
        return [
          step(
            'Sew on the yokes',
            `Pin the front yoke to the top of the skirt front, right sides together, matching the notch and the ends; the curves run opposite ways, so clip the skirt's edge to the stitching line every 2 cm so it lies along the yoke. Sew ${seam} from the edge, press the seam up into the yoke and topstitch 0.6 cm above it. Join each back yoke to its back the same way, matching the double notches.`,
          ),
          { ...s, text: s.text.replace('stopping at the ZIP ENDS notch.', 'stopping at the ZIP ENDS notch, the yoke seams level on each side.') },
        ];
      case 'Sew the side seams':
        return [{ ...s, text: s.text.replace('matching the hip notches.', 'matching the yoke seams and the hip notches, the seam allowances pressed up into the yokes.') }];
      default:
        return [s];
    }
  });
  return { ...g, steps };
}

/** The skirt's steps with a button front: the facings, the buttonholes down the front and on the band, and no zip. */
export function buttonFrontSteps(g: SewingGuide, buttons: Buttons, o: { seam: string; waist: string; backSeam: boolean }): SewingGuide {
  const count = buttons.count + 1;
  const steps = g.steps.flatMap((s): SewStep[] => {
    switch (s.title) {
      case 'Put in the zip':
        return [];
      case 'Close the centre back':
        return o.backSeam ? [{ ...s, text: s.text.replace('from the bottom of the zip', 'from the waist') }] : [];
      case 'Cut out':
        return [
          {
            ...s,
            text: `${s.text.replace(/Place the skirt front[^.]*\.|Place the skirt back on the fold, and the skirt front on both layers so you get a pair\./, o.backSeam ? 'Place the skirt front and the skirt back on both layers so you get a pair of each.' : 'Place the skirt back on the fold, and the skirt front on both layers so you get a pair.')} Cut the front facings as a pair, from the fabric and again from fusible interfacing, and mark the buttonholes on the right front (as you wear it).`,
          },
        ];
      case 'Interface the waistband':
        return [
          { ...s, text: s.text.replace('on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line)', 'on the half from the edge that joins the skirt to the fold line') },
          step('Interface the front facings', 'Fuse the interfacing to the wrong side of each front facing.'),
        ];
      case 'Neaten the edges':
        return [{ ...s, text: s.text.replace(/the side( and centre front and centre back| and centre back)? edges of the skirt pieces/, `the side${o.backSeam ? ' and centre back' : ''} edges of the skirt pieces and the inner edges of the front facings`) }];
      case 'Sew the side seams':
        return [
          s,
          step(
            'Face the front edges',
            `Pin a facing to each front edge, right sides together, from the waist to the hem. Sew 1 cm from the edge, along the extension. Trim, press the seam toward the facing and understitch it, then turn the facing inside and press, so the edge rolls just to the inside. Baste the facing to the skirt at the waist.`,
          ),
        ];
      case 'Make the lining':
        return [{ ...s, text: s.text.replace(' and the centre back seam from the ZIP ENDS notch down', o.backSeam ? ' and the centre back seam' : '') }];
      case 'Put the lining in':
        return [
          {
            ...s,
            text: s.text.replace(
              " Turn the lining's centre back edges under beside the zip and slip-stitch them to the zip tape, clear of the teeth.",
              " Cut the lining front open along its centre front, turn each edge under and slip-stitch it to the front facing, clear of the buttonholes.",
            ),
          },
        ];
      case 'Attach the waistband':
        return [{ ...s, text: s.text.replace(/Match the centre front notch to the centre front, the side notches to the side seams, and let each end extend [^ ]+ cm past the zip\./, `Match the CENTRE FRONT notches to the centre fronts, the side notches to the side seams and the centre back notch to the centre back, and let each end extend ${o.seam} past the front edges.`) }];
      case 'Hem':
        return [
          {
            ...s,
            text: `At each front edge, fold the facing back over the skirt, right sides together, and sew across it at the hem's depth. Trim, turn the facing back inside and push out the corner. Then hem the rest of the way round: ${s.text.charAt(0).toLowerCase()}${s.text.slice(1)}`,
          },
          step('Make the buttonholes', `Work ${count} buttonholes, ${buttons.count} down the right front at the marks, upright and centred on the centre front line, and one across the band's overlapping end, each a little longer than the ${buttons.sizeCm} cm buttons.`),
          step('Sew on the buttons', 'Lap the right front over the left, centre fronts together, and mark through each buttonhole onto the left front and the band. Sew a button at each mark.'),
        ];
      case 'Finish':
        return [{ ...s, text: 'Give the skirt a final press.' }];
      default:
        return [s];
    }
  });
  const notions = g.notions.filter((n) => !/invisible zip|Hook and eye/.test(n));
  return { notions: [...notions.slice(0, -1), `${count} buttons, ${buttons.sizeCm} cm`, '0.5 m lightweight fusible interfacing', notions[notions.length - 1]].filter((n, i, all) => all.indexOf(n) === i && !/^0\.3 m lightweight/.test(n)), steps };
}
