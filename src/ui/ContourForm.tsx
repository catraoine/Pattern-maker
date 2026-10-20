import { useEffect, useRef } from 'react';
import type { FormKind, MeasurementId } from '../measurements';
import { LEG, LEG_FLOOR, LEG_KNEE, LEG_X } from '../engine/form';

// The dress form, drawn in contour lines on black: one figure for every screen (Cat, 2026-10-18: the body must
// stay the same everywhere). It has a faceless head like an artist's wooden mannequin, about 8 cm of neck, and
// legs to the feet drawn as fine outlines like the Style page's (Cat, 2026-10-20). The welcome shows it without
// the legs, with a light passing across it once (Cat's C1 Light Pass). The measuring pages show the whole
// figure and play an ivory tape once to where each measurement goes.

// Champagne lines (Cat's G4 pick), matching --gild and --gild-glow in styles.css.
const CHAMPAGNE = '#d9c49b';
// The tape: an ivory band with tick marks, like a real tape measure.
const PAPER = '#e9dec4';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Pt = [number, number, number?];

/** Smooth curve through keypoints (Catmull-Rom). */
function spline(keys: [number, number][]) {
  return (y: number) => {
    const n = keys.length;
    if (y <= keys[0][0]) return keys[0][1];
    if (y >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (keys[i + 1][0] < y) i++;
    const p0 = keys[Math.max(i - 1, 0)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, n - 1)];
    const d = p2[0] - p1[0], u = (y - p1[0]) / d;
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * d;
    const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * d;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
}

// Half-width of the form from neck (top) to hip (bottom); the waist sits at y = 0.1. A dressmaker's form
// (Cat's pick N1): a short, full neck and broad, nearly level shoulders that round off at the arm.
const R_WOMENSWEAR = spline([
  [-1.75, 0.15], [-1.55, 0.155], [-1.47, 0.17], [-1.43, 0.25], [-1.38, 0.42], [-1.32, 0.52], [-1.22, 0.57],
  [-1.05, 0.58], [-0.8, 0.59], [-0.55, 0.61],
  [-0.3, 0.53], [-0.05, 0.45], [0.1, 0.43], [0.3, 0.49], [0.55, 0.61], [0.8, 0.65], [1.05, 0.63], [1.3, 0.58],
]);
// The menswear form (Cat's B2 Two Forms, 2026-10-18; shape M1 Tailor's Form, 2026-10-20): a suit-maker's form,
// with a full neck, wide squared shoulders and the chest tapering in a clean V to a straight waist and hip.
const R_MENSWEAR = spline([
  [-1.75, 0.19], [-1.55, 0.195], [-1.47, 0.215], [-1.43, 0.33], [-1.4, 0.56], [-1.35, 0.68], [-1.26, 0.72],
  [-1.1, 0.71], [-0.85, 0.665], [-0.55, 0.615],
  [-0.3, 0.575], [-0.05, 0.55], [0.1, 0.545], [0.3, 0.55], [0.55, 0.565], [0.8, 0.575], [1.05, 0.565], [1.3, 0.545],
]);
// Every drawing below reads the form through R. Each paint picks the person's form first (JS paints one canvas
// at a time, so two forms on one screen each draw their own).
let R = R_WOMENSWEAR;
const pickForm = (kind: FormKind = 'womenswear') => {
  R = kind === 'menswear' ? R_MENSWEAR : R_WOMENSWEAR;
};
// The form's own neck starts at -1.66: short and full, like a dressmaker's form.
const YS = Array.from({ length: 221 }, (_, i) => -1.66 + (2.96 * i) / 220);
const DEPTH = 0.16;
const LINES = 23;
const FLOOR = LEG_FLOOR;
const KNEE = LEG_KNEE;

function stroke(g: CanvasRenderingContext2D, a: Pt, b: Pt) {
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

function taper(g: CanvasRenderingContext2D, pts: Pt[], frac: number, width: (u: number) => number) {
  const n = Math.floor((pts.length - 1) * clamp(frac, 0, 1));
  for (let i = 1; i <= n; i++) {
    g.lineWidth = width(i / (pts.length - 1));
    stroke(g, pts[i - 1], pts[i]);
  }
}

/** One line through the points, drawn as far as `frac` of the way along. */
function path(g: CanvasRenderingContext2D, pts: Pt[], frac = 1) {
  const n = Math.floor((pts.length - 1) * clamp(frac, 0, 1));
  if (n < 1) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

// The head and neck. Proportions from a real body at the app's scale (about 22.5 cm to a unit, waist at 0.1,
// floor at LEG_FLOOR): the head is about 21 cm, chin at -1.72 and crown at -2.66, so about 8 cm of neck shows
// above the form. The head is an almond, a little fuller at the crown and narrowing to the chin like a soft
// heart, with no face. The neck runs up into it.
export const HEAD_TOP = -2.66;
const HEAD_C = -2.19, HEAD_H = 0.47, HEAD_W = 0.33;
const headHalf = (t: number) => HEAD_W * Math.pow(Math.sin(t), 0.92) * (0.84 + 0.2 * Math.cos(t));
const headY = (t: number) => HEAD_C - HEAD_H * Math.cos(t);
/** The head in form units, for drawings made at another scale (Draw on your form): its outline round from the
 *  chin, and its long lines, each a list of [x, y] points. The chin is at HEAD_CHIN. */
export const HEAD_CHIN = HEAD_C + HEAD_H;
/** Centimetres to one form unit, at the proportions the head is drawn to. */
export const CM_PER_UNIT = 22.5;
export function headLines(lines = 9): { outline: [number, number][]; lines: [number, number][][] } {
  const ts = Array.from({ length: 49 }, (_, i) => (Math.PI * i) / 48);
  const outline = [...ts.map((t): [number, number] => [headHalf(t), headY(t)]), ...[...ts].reverse().map((t): [number, number] => [-headHalf(t), headY(t)])];
  return {
    outline,
    lines: Array.from({ length: lines }, (_, j) => {
      const u = Math.cos((Math.PI * (j + 0.5)) / lines);
      return ts.slice(1, -1).map((t): [number, number] => [u * headHalf(t), headY(t)]);
    }),
  };
}
const HEAD_TS = Array.from({ length: 91 }, (_, i) => (Math.PI * i) / 90);
const NECK_YS = Array.from({ length: 18 }, (_, i) => -2.0 + (0.34 * i) / 17);
/** How bright each long line is, by where it sits across the front (u from -1 at the left to 1 at the right). */
type Light = (u: number) => number;
const EVEN: Light = () => 0.7;

/** The neck above the form and the head on it. `spin` turns the lines round, as the form turns. */
function paintHead(g: CanvasRenderingContext2D, S: number, cx: number, Y: (y: number) => number, lw: number, light: Light = EVEN, spin = 0, alpha = 1) {
  g.strokeStyle = CHAMPAGNE;
  // The neck: the form's long lines carry on up past its top and into the head.
  for (let j = 0; j < 2 * LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES - spin;
    if (Math.sin(th) <= 1e-6) continue;
    const u = Math.cos(th);
    g.globalAlpha = alpha * light(u);
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(u));
    path(g, NECK_YS.map((y): Pt => [cx + u * R(y) * S, Y(y) + Math.sin(th) * R(y) * S * DEPTH]));
  }
  g.globalAlpha = alpha;
  g.lineWidth = lw;
  path(g, NECK_YS.map((y): Pt => [cx - R(y) * S, Y(y)]));
  path(g, NECK_YS.map((y): Pt => [cx + R(y) * S, Y(y)]));
  // Black inside the head, so the top of the neck disappears into the jaw.
  const outline: Pt[] = [...HEAD_TS.map((t): Pt => [cx + headHalf(t) * S, Y(headY(t))]), ...[...HEAD_TS].reverse().map((t): Pt => [cx - headHalf(t) * S, Y(headY(t))])];
  g.globalAlpha = alpha;
  g.fillStyle = '#000';
  g.beginPath();
  outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  const inner = HEAD_TS.slice(1, -1);
  for (let j = 0; j < 22; j++) {
    const th = (Math.PI * (j + 0.5)) / 11 - spin;
    if (Math.sin(th) <= 1e-6) continue;
    const u = Math.cos(th);
    g.globalAlpha = alpha * light(u);
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(u));
    path(g, inner.map((t): Pt => [cx + u * headHalf(t) * S, Y(headY(t)) + Math.sin(th) * headHalf(t) * S * DEPTH]));
  }
  g.globalAlpha = alpha;
  g.lineWidth = lw * 1.1;
  path(g, outline);
  g.globalAlpha = 1;
}

// The legs, as fine outlines like the legs on the Style page: one unbroken outer line from the hip down the leg
// to the floor, the inner lines parting at the crotch, and the form's own lines fading out above its hem.
const LEG_DOWN = Array.from({ length: Math.round((FLOOR - 0.9) / 0.02) + 1 }, (_, i) => 0.9 + i * 0.02);
const CROTCH = 1.36;
function paintLegs(g: CanvasRenderingContext2D, S: number, cx: number, Y: (y: number) => number, lw: number, k = 1) {
  if (k <= 0) return;
  const f0 = Y(0.95), f1 = Y(1.3) + S * 0.14;
  const fade = g.createLinearGradient(0, f0, 0, f1);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, '#000');
  g.globalAlpha = k;
  g.fillStyle = fade;
  g.fillRect(cx - S * 0.8, f0, S * 1.6, f1 - f0 + 2);
  g.strokeStyle = CHAMPAGNE;
  const blend = (y: number) => {
    const q = inOut(clamp((y - 1.2) / 0.3, 0, 1));
    return (1 - q) * R(Math.min(y, 1.3)) + q * (LEG_X + LEG(Math.max(y, 1.3)));
  };
  const inner = LEG_DOWN.filter((y) => y >= CROTCH + 0.02);
  for (const sx of [-1, 1]) {
    const c0 = cx + sx * LEG_X * S;
    g.globalAlpha = k;
    g.lineWidth = lw * 1.1;
    path(g, LEG_DOWN.map((y): Pt => [cx + sx * blend(y) * S, Y(y)]));
    g.globalAlpha = k * 0.7;
    g.lineWidth = lw * 0.8;
    path(g, [[cx, Y(CROTCH)], ...inner.map((y): Pt => [c0 - sx * LEG(y) * S, Y(y)])]);
    stroke(g, [c0 - LEG(FLOOR) * S, Y(FLOOR)], [c0 + LEG(FLOOR) * S, Y(FLOOR)]);
  }
  g.globalAlpha = 1;
}

/** The torso: outline and long lines, each drawn as far as given; `spin` turns the long lines round. */
function paintTorso(g: CanvasRenderingContext2D, S: number, cx: number, Y: (y: number) => number, lw: number, light: Light = EVEN, outline = 1, lines = 1, spin = 0) {
  g.strokeStyle = CHAMPAGNE;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const edge = (u: number) => lw * (0.5 + Math.sin(Math.PI * u));
  g.globalAlpha = 1;
  taper(g, YS.map((y): Pt => [cx - R(y) * S, Y(y)]), outline, edge);
  taper(g, YS.map((y): Pt => [cx + R(y) * S, Y(y)]), outline, edge);
  if (lines <= 0) return;
  for (let j = 0; j < 2 * LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES - spin;
    if (Math.sin(th) <= 1e-6) continue;
    const u = Math.cos(th);
    g.globalAlpha = light(u);
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(u));
    path(g, YS.map((y): Pt => [cx + u * R(y) * S, Y(y) + Math.sin(th) * R(y) * S * DEPTH]), lines);
  }
  g.globalAlpha = 1;
}

/** The view a welcome-sized canvas shows: a little above the crown down to the hem, which fades out. */
const REST_TOP = -2.8;
/** Where the form sits in a canvas of this size: centred, or to the right of the title in a wide window. */
function layout(w: number, h: number) {
  const S = Math.min(w * 0.6, (h * 0.96) / (1.3 - REST_TOP));
  const cx = w > h * 1.25 ? w * 0.64 : w / 2;
  const wy = h * 0.04 + (0.1 - REST_TOP) * S;
  return { S, cx, wy, lw: lineFor(S), Y: (y: number) => wy + (y - 0.1) * S };
}
const lineFor = (S: number) => Math.max(0.7, S / 252) * 1.2;
/** The welcome's own framing: a close crop of the torso, the neck running off the top and no head in view
 *  (Cat went back to this from the full figure, 2026-10-20). */
function welcomeLayout(w: number, h: number) {
  const S = Math.min(w * 0.82, h * 0.46);
  const cx = w / 2;
  const wy = h * 0.5;
  return { S, cx, wy, lw: lineFor(S), Y: (y: number) => wy + (y - 0.1) * S };
}

/**
 * The form's outline as one closed loop, clockwise from the top left (across the neck, down the right side,
 * across the hem, up the left side), so the loading screen's bodice can be reshaped into it.
 */
export function formOutline(w: number, h: number, kind?: FormKind): { pts: [number, number][]; lw: number } {
  pickForm(kind);
  const { S, cx, Y, lw } = welcomeLayout(w, h);
  const left = YS.map((y): [number, number] => [cx - R(y) * S, Y(y)]);
  const right = YS.map((y): [number, number] => [cx + R(y) * S, Y(y)]);
  return { pts: [left[0], ...right, ...left.reverse()], lw };
}

/** The bottom of the form fades into the black from here (a fraction of the canvas height). */
export const FADE_FROM = 0.78;

function fadeBottom(g: CanvasRenderingContext2D, w: number, h: number) {
  const fade = g.createLinearGradient(0, h * FADE_FROM, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalAlpha = 1;
  g.fillStyle = fade;
  g.fillRect(0, h * FADE_FROM, w, h * (1 - FADE_FROM));
}

/**
 * The form at rest, as the welcome leaves it: head, neck and torso, no legs, the hem fading into the black.
 * The pages between the welcome and the measuring (the check page, what to make) show it the same way.
 */
function settledForm(g: CanvasRenderingContext2D, w: number, h: number, outline = 1, lines = 1, light: Light = EVEN) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const { S, cx, lw, Y } = layout(w, h);
  paintTorso(g, S, cx, Y, lw, light, outline, lines);
  if (lines > 0) paintHead(g, S, cx, Y, lw, light, 0, Math.min(1, lines * 1.5));
  fadeBottom(g, w, h);
}

// The welcome (Cat's T5 Drawn Down): the outline draws, or arrives already drawn from the loading screen, then
// all the long lines are drawn down together from the shoulders. A close crop, so the head is out of view.
const OUTLINE = 1000;
const DOWN = 1300;
const WELCOME_END = OUTLINE + DOWN + 300;
function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, drawn: boolean) {
  const t0 = drawn ? 0 : OUTLINE;
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const { S, cx, lw, Y } = welcomeLayout(w, h);
  paintTorso(g, S, cx, Y, lw, EVEN, drawn ? 1 : inOut(seg(t, 0, OUTLINE - 100)), inOut(seg(t, t0, t0 + DOWN)));
  fadeBottom(g, w, h);
}

// When the app opens on the welcome screen, the loading screen reshapes its bodice into this form's outline.
// 'wait' draws nothing until then; 'drawn' starts with the outline already in place; 'fresh' plays it all.
export type FormStart = 'wait' | 'drawn' | 'fresh';

/** A canvas sized to its box at the screen's pixel density, repainted when the box changes size. */
function useCanvas(paintAt: (g: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean, deps: unknown[], wait = false) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || wait) return;
    let gone = false;
    let frame = 0;
    let size = { w: 0, h: 0 };
    let last = 0;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const tick = (now: number) => {
      last = now;
      if (paintAt(g, size.w, size.h, now)) frame = requestAnimationFrame(tick);
    };
    fit();
    const ro = new ResizeObserver(() => {
      fit();
      if (last) paintAt(g, size.w, size.h, last);
    });
    ro.observe(canvas);
    // Wait for the fonts so nothing is laid out against a fallback face.
    const go = () => !gone && (frame = requestAnimationFrame(tick));
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    else go();
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ContourForm({ start: from = 'fresh', kind }: { start?: FormStart; kind?: FormKind }) {
  const begun = useRef(0);
  const ref = useCanvas(
    (g, w, h, now) => {
      const drawn = from === 'drawn';
      const end = (drawn ? 0 : OUTLINE) + DOWN + 300;
      if (!begun.current) begun.current = now;
      const t = stillMotion() ? end : Math.min(now - begun.current, end);
      pickForm(kind);
      draw(g, w, h, t, drawn);
      return t < end;
    },
    [from, kind],
    from === 'wait',
  );
  useEffect(() => () => void (begun.current = 0), [from, kind]);
  return <canvas ref={ref} className="contour" aria-hidden="true" />;
}

/** The welcome's whole play, for the screen to time things against. */
export const WELCOME_MS = WELCOME_END;

// ---------------------------------------------------------------------------------------------------------
// The measuring pages: the whole figure, head to feet, and a tape that plays once to where the measurement
// goes, then stays. The camera eases from where the last page left it to frame the whole measure first.
// Girths slide in level from the right edge (of the form's column on a computer, of the screen on a phone) at
// their own height, then wrap round the front with the back following faintly. Lengths come in level at their
// start, then follow the body. Height rises from the floor to the top of the head. Measurements taken at the
// back turn the figure round first. No labels and no numbers.

/** The arms, for the arm measurements: each edge is a distance from the centre at a height; the outer edge
 *  starts on the form's shoulder, the inner one at the underarm, where the form's own side takes over above it. */
const ARM_OUT = spline([[-1.4, 0.42], [-1.3, 0.62], [-1.15, 0.74], [-0.95, 0.79], [-0.6, 0.795], [-0.1, 0.775], [0.3, 0.79], [0.9, 0.785], [1.15, 0.77], [1.3, 0.79], [1.5, 0.78], [1.62, 0.74]]);
const ARM_IN = spline([[-0.9, 0.6], [-0.6, 0.605], [-0.1, 0.635], [0.3, 0.645], [0.9, 0.675], [1.15, 0.69], [1.3, 0.67], [1.5, 0.68], [1.62, 0.72]]);
const ARM_YS = Array.from({ length: 121 }, (_, i) => -1.4 + (3.02 * i) / 120);
const UNDERARM = -0.9;
/** Where the shoulder point sits on the arm's outer edge, and the wrist bone. */
const SHOULDER_POINT = -1.25;
const WRIST = 1.15;

function paintArms(g: CanvasRenderingContext2D, S: number, cx: number, lw: number, Y: (y: number) => number) {
  const inner = ARM_YS.filter((y) => y >= UNDERARM);
  for (const side of [-1, 1]) {
    const X = (r: number) => cx + side * r * S;
    // Black out the form's lines behind the arm, up to the form's own side.
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.beginPath();
    ARM_YS.forEach((y, i) => (i ? g.lineTo(X(ARM_OUT(y)), Y(y)) : g.moveTo(X(ARM_OUT(y)), Y(y))));
    [...inner].reverse().forEach((y) => g.lineTo(X(ARM_IN(y)), Y(y)));
    ARM_YS.filter((y) => y < UNDERARM).reverse().forEach((y) => g.lineTo(X(R(y)), Y(y)));
    g.fill();
    g.strokeStyle = CHAMPAGNE;
    g.lineWidth = lw;
    path(g, ARM_YS.map((y): Pt => [X(ARM_OUT(y)), Y(y)]));
    path(g, inner.map((y): Pt => [X(ARM_IN(y)), Y(y)]));
    g.globalAlpha = 0.45;
    g.lineWidth = lw * 0.45;
    for (let j = 1; j < 4; j++) path(g, inner.map((y): Pt => [X(ARM_IN(y) + ((ARM_OUT(y) - ARM_IN(y)) * j) / 4), Y(y)]));
  }
  g.globalAlpha = 1;
}

const LEG_YS = Array.from({ length: 141 }, (_, i) => 1.2 + (3.5 * i) / 140);

/**
 * The whole figure at any scale, for the views that turn it round (the All round shape preview): `turn`
 * (radians) spins its long lines, head and legs round. `legs` fades the legs in (0 to 1).
 */
export function paintFigure(g: CanvasRenderingContext2D, S: number, cx: number, Y: (y: number) => number, lw: number, legs = 1, withArms = false, turn?: number) {
  const spin = turn ?? 0;
  if (turn === undefined) {
    paintTorso(g, S, cx, Y, lw);
    paintLegs(g, S, cx, Y, lw, legs);
    if (withArms) paintArms(g, S, cx, lw, Y);
    paintHead(g, S, cx, Y, lw);
    return;
  }
  // Turning, the lines run all the way round and only the front half shows, easing out at the sides.
  paintTorso(g, S, cx, Y, lw, EVEN, 1, 0);
  for (let j = 0; j < 2 * LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES - spin;
    const front = Math.sin(th);
    if (front <= 0) continue;
    const c = Math.cos(th);
    g.globalAlpha = 0.7 * Math.min(1, front * 6);
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(c));
    path(g, YS.map((y): Pt => [cx + c * R(y) * S, Y(y) + front * R(y) * S * DEPTH]));
  }
  if (withArms) paintArms(g, S, cx, lw, Y);
  if (legs > 0) {
    for (const side of [-1, 1]) {
      const lx = cx + side * LEG_X * Math.cos(spin) * S;
      const dy = -side * LEG_X * Math.sin(spin) * S * DEPTH;
      const behind = -side * Math.sin(spin) < 0 ? 0.6 : 1;
      g.globalAlpha = legs * behind;
      g.lineWidth = lw;
      for (const e of [-1, 1]) path(g, LEG_YS.map((y): Pt => [lx + e * LEG(y) * S, Y(y) + dy]));
      for (const th of Array.from({ length: 12 }, (_, j) => (Math.PI * (j + 0.5)) / 6 - spin)) {
        if (Math.sin(th) <= 0) continue;
        g.globalAlpha = legs * 0.45 * behind * Math.min(1, Math.sin(th) * 4);
        g.lineWidth = lw * 0.45;
        path(g, LEG_YS.map((y): Pt => [lx + Math.cos(th) * LEG(y) * S, Y(y) + dy]));
      }
    }
  }
  paintHead(g, S, cx, Y, lw, (u) => 0.7 * Math.min(1, Math.sqrt(Math.max(0, 1 - u * u)) * 6), spin);
}

/** A tape: an ivory band along the points, with a tick every few millimetres and a longer one every fifth. */
function tape(g: CanvasRenderingContext2D, pts: Pt[], tw: number, alpha = 1) {
  if (pts.length < 2 || alpha <= 0) return;
  g.globalAlpha = alpha;
  g.strokeStyle = PAPER;
  g.lineWidth = tw;
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  path(g, pts);
  g.strokeStyle = '#000';
  g.lineWidth = Math.max(0.6, tw * 0.08);
  const gap = tw * 0.55;
  let acc = 0, k = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (!d) continue;
    const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
    while (acc + d >= k * gap) {
      const f = (k * gap - acc) / d, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, L = k % 5 ? 0.28 : 0.5;
      stroke(g, [x - nx * tw * 0.5, y - ny * tw * 0.5], [x - nx * tw * (0.5 - L), y - ny * tw * (0.5 - L)]);
      k++;
    }
    acc += d;
  }
  g.lineCap = 'round';
  g.globalAlpha = 1;
}

/** The first `frac` of a line, by length. */
function partial(pts: Pt[], frac: number): Pt[] {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let left = lens.reduce((a, b) => a + b, 0) * clamp(frac, 0, 1);
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length && left > 0; i++) {
    const f = Math.min(1, left / (lens[i - 1] || 1));
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.max(1, Math.ceil((lens[i - 1] * f) / 6));
    for (let s = 1; s <= n; s++) out.push([a[0] + (b[0] - a[0]) * ((f * s) / n), a[1] + (b[1] - a[1]) * ((f * s) / n)]);
    left -= lens[i - 1];
  }
  return out;
}

/** Where each measurement's tape goes. Points are [across from the centre, down] in form units. */
type Tape =
  | { kind: 'height' }
  | { kind: 'girth'; y: number }
  /** Down your side: in level at `from`, over the curve of the hip to its widest point, then straight down. */
  | { kind: 'side'; from: number; to: number }
  /** Down the centre back, with the figure turned round. */
  | { kind: 'back'; from: number; to: number }
  | { kind: 'path'; pts: [number, number][]; back?: boolean }
  | { kind: 'arm'; at: number | 'length' }
  | { kind: 'crotch' };

/** Points from the flat dress-form figure the drawings were first made on (200 x 420) in form units. */
const FIG_Y: [number, number][] = [[40, -1.75], [56, -1.5], [76, -1.3], [88, -1.08], [104, -0.78], [150, 0.1], [208, 0.82], [232, 1.3]];
function figY(y: number) {
  let i = 0;
  while (i < FIG_Y.length - 2 && FIG_Y[i + 1][0] < y) i++;
  const [a, b] = [FIG_Y[i], FIG_Y[i + 1]];
  return a[1] + ((y - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}
const fig = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [((x - 100) / 56) * 0.58, figY(y)]);
const ARMHOLE = fig(Array.from({ length: 33 }, (_, i): [number, number] => [149 + 8 * Math.sin((i / 32) * 2 * Math.PI), 98 - 22 * Math.cos((i / 32) * 2 * Math.PI)]));

const TAPES: Partial<Record<MeasurementId, Tape>> = {
  height: { kind: 'height' },
  full_bust: { kind: 'girth', y: -0.58 },
  waist: { kind: 'girth', y: 0.1 },
  full_hip: { kind: 'girth', y: 0.82 },
  high_bust: { kind: 'girth', y: -1.08 },
  neck: { kind: 'girth', y: -1.5 },
  waist_to_hip: { kind: 'side', from: 0.1, to: 0.82 },
  front_waist_to_hip: { kind: 'side', from: 0.1, to: 0.82 },
  waist_to_knee: { kind: 'side', from: 0.1, to: KNEE },
  waist_to_floor: { kind: 'side', from: 0.1, to: FLOOR },
  // Seated, down the side to the chair: the seat is level with the crotch.
  crotch_depth: { kind: 'side', from: 0.1, to: CROTCH },
  crotch_length: { kind: 'crotch' },
  back_waist_to_hip: { kind: 'back', from: 0.1, to: 0.82 },
  nape_to_waist: { kind: 'back', from: -1.62, to: 0.1 },
  armscye: { kind: 'path', pts: ARMHOLE },
  shoulder_width: { kind: 'path', pts: fig([[46, 76], [154, 76]]), back: true },
  shoulder_length: { kind: 'path', pts: fig([[115, 60], [152, 73]]) },
  across_back: { kind: 'path', pts: fig([[54, 96], [146, 96]]), back: true },
  across_front: { kind: 'path', pts: fig([[56, 86], [144, 86]]) },
  front_hps_to_waist: { kind: 'path', pts: fig([[113, 59], [124, 104], [124, 150]]) },
  bust_depth: { kind: 'path', pts: fig([[113, 59], [124, 104]]) },
  apex_separation: { kind: 'path', pts: fig([[76, 104], [124, 104]]) },
  front_shoulder_slope: { kind: 'path', pts: fig([[152, 73], [100, 150]]) },
  back_shoulder_slope: { kind: 'path', pts: fig([[152, 73], [100, 150]]), back: true },
  arm_length: { kind: 'arm', at: 'length' },
  upper_arm: { kind: 'arm', at: -0.55 },
  wrist: { kind: 'arm', at: WRIST },
};

export const ON_FORM: Partial<Record<MeasurementId, number>> = { full_bust: -0.58, waist: 0.1, full_hip: 0.82 };
/** The menswear form's tapes: the chest across the fullest part of the ribcage, under the shoulders. */
const ON_MENSWEAR_FORM: Partial<Record<MeasurementId, number>> = { full_bust: -0.62, waist: 0.1, full_hip: 0.8 };
const onFormFor = (kind?: FormKind) => (kind === 'menswear' ? ON_MENSWEAR_FORM : ON_FORM);
const tapeFor = (id: MeasurementId, kind?: FormKind): Tape | undefined => {
  const y = onFormFor(kind)[id];
  return y !== undefined ? { kind: 'girth', y } : TAPES[id];
};
const isBack = (t: Tape) => t.kind === 'back' || (t.kind === 'path' && !!t.back);

/** What the camera frames for a tape, top and bottom in form units: always the whole measure. */
function viewFor(t: Tape): [number, number] {
  switch (t.kind) {
    case 'height':
      return [HEAD_TOP - 0.15, FLOOR + 0.14];
    case 'girth':
      return [Math.max(HEAD_TOP - 0.15, t.y - 1.5), t.y + 1.4];
    case 'side':
      return [t.from - 0.5, t.to > 1.6 ? t.to + 0.14 : t.to + 0.6];
    case 'back':
      return [Math.max(HEAD_TOP - 0.15, t.from - 0.5), t.to + 0.6];
    case 'path': {
      const ys = t.pts.map((p) => p[1]);
      return [Math.max(HEAD_TOP - 0.15, Math.min(...ys) - 0.6), Math.max(...ys) + 0.6];
    }
    case 'arm':
      return t.at === 'length' ? [-1.9, 1.75] : [t.at - 1.0, t.at + 1.0];
    case 'crotch':
      return [-0.5, 1.95];
  }
}

/** True when a measuring page has a tape of its own; the rest would show the figure with no tape. */
export const hasDemo = (id: MeasurementId) => !!tapeFor(id);
/** The view each tape frames and whether it is taken at the back, for the tests. */
export const tapeView = (id: MeasurementId) => {
  const t = tapeFor(id);
  return t && { view: viewFor(t), back: isBack(t), kind: t.kind };
};

// The camera and the figure's turn carry on from page to page: each page starts where the last one left off.
// The first page starts from the welcome's framing.
let lastView: [number, number] = [REST_TOP, 1.3];
let lastTurn = 0;
// Cat's speed pick (2026-10-20): the first five pages play in full; after that the camera and tape go about
// twice as fast, since by then the tape needs less showing.
const played = new Set<MeasurementId>();
const ZOOM = 1000;
const PLAY = 2600;

/** One frame of a measuring page: `z` is how far the camera has come (0 to 1), `p` how far the tape has played. */
function paintTape(g: CanvasRenderingContext2D, w: number, h: number, from: [number, number], to: [number, number], turn: [number, number], z: number, p: number, t: Tape | undefined) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const e = inOut(z);
  const vt = from[0] + (to[0] - from[0]) * e, vb = from[1] + (to[1] - from[1]) * e;
  const pad = Math.max(10, h * 0.03);
  const S = Math.min((h - 2 * pad) / (vb - vt), w * 0.42);
  const cx = w / 2;
  const wy = h / 2 - ((vt + vb) / 2 - 0.1) * S;
  const Y = (y: number) => wy + (y - 0.1) * S;
  const lw = lineFor(S);
  const spin = turn[0] + (turn[1] - turn[0]) * e;
  const arms = t?.kind === 'arm';

  paintTorso(g, S, cx, Y, lw, EVEN, 1, 1, spin);
  paintLegs(g, S, cx, Y, lw);
  if (arms) paintArms(g, S, cx, lw, Y);
  paintHead(g, S, cx, Y, lw, EVEN, spin);
  // The floor, faint and dashed, when the measure goes down to it.
  if (t && (t.kind === 'height' || (t.kind === 'side' && t.to > 4))) {
    g.save();
    g.strokeStyle = CHAMPAGNE;
    g.globalAlpha = 0.4;
    g.lineWidth = 1;
    g.setLineDash([3, 4]);
    stroke(g, [cx - S * 0.9, Y(FLOOR)], [cx + S * 0.95, Y(FLOOR)]);
    g.restore();
  }
  // Taken at the back: once the figure has turned, a quiet note says so (it looks the same from either side).
  if (t && isBack(t)) {
    g.save();
    g.globalAlpha = turn[0] === turn[1] ? 1 : seg(e, 0.8, 1);
    g.fillStyle = CHAMPAGNE;
    g.font = "500 9px 'Chakra Petch', sans-serif";
    try {
      (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
    } catch {
      // Older browsers draw the note without tracking.
    }
    g.fillText('SEEN FROM THE BACK', 12, 22);
    g.restore();
  }
  if (!t || p <= 0) return;

  const tw = clamp(w * 0.03, 7, 13);
  const edge = w + tw;
  const k = inOut(seg(p, 0, 0.55));
  const m = inOut(seg(p, 0.55, 0.85));
  const run = inOut(seg(p, 0, 0.85));
  const front = (y: number) => Y(y) + R(y) * S * DEPTH;

  switch (t.kind) {
    case 'height': {
      const side = cx + 0.72 * S;
      tape(g, partial([[side, Y(FLOOR)], [side, Y(HEAD_TOP)]], run), tw);
      return;
    }
    case 'girth':
      return wrap(g, cx, Y(t.y), R(t.y) * S + tw * 0.15, DEPTH * 1.1, edge, k, m, tw);
    case 'side': {
      // In at the start, over the curve of the hip to its widest point, then straight down.
      const widest = 0.8;
      const pts: Pt[] = [[edge, Y(t.from)]];
      for (let y = t.from; y <= Math.min(t.to, widest) + 1e-6; y += 0.02) pts.push([cx + R(y) * S + tw * 0.55, Y(y)]);
      if (t.to > widest) pts.push([cx + R(widest) * S + tw * 0.55, Y(t.to)]);
      tape(g, partial(pts, run), tw);
      return;
    }
    case 'back':
      tape(g, partial([[edge, front(t.from)], [cx, front(t.from)], [cx, front(t.to)]], run), tw);
      return;
    case 'path': {
      let pts: Pt[] = t.pts.map(([x, y]): Pt => [cx + x * S, Y(y)]);
      // Paths start where the tape starts; one across the body is run from its right-hand end, nearest the edge.
      const [a, b] = [pts[0], pts[pts.length - 1]];
      if (Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]) * 0.3 && a[0] < b[0]) pts = [...pts].reverse();
      tape(g, partial([[edge, pts[0][1]], ...pts], run), tw);
      return;
    }
    case 'arm': {
      if (t.at === 'length') {
        const ys = Array.from({ length: 61 }, (_, i) => SHOULDER_POINT + ((WRIST - SHOULDER_POINT) * i) / 60);
        const pts = ys.map((y): Pt => [cx + ARM_OUT(y) * S + tw * 0.55, Y(y)]);
        tape(g, partial([[edge, pts[0][1]], ...pts], run), tw);
        return;
      }
      const mid = cx + ((ARM_IN(t.at) + ARM_OUT(t.at)) / 2) * S;
      const r = ((ARM_OUT(t.at) - ARM_IN(t.at)) / 2) * S + tw * 0.15;
      return wrap(g, mid, Y(t.at), r, DEPTH * 2, edge, k, m, tw * 0.8);
    }
    case 'crotch': {
      // From the centre front waist down the front, under between the legs and up the back to the centre back
      // waist. The back, behind the figure, is faint and just to one side.
      const bottom = 1.3;
      const back = (y: number) => Y(y) - R(y) * S * DEPTH;
      const ys = Array.from({ length: 31 }, (_, i) => 0.1 + ((bottom - 0.1) * i) / 30);
      const dip = Y(CROTCH) + 4;
      const under = Array.from({ length: 13 }, (_, i): Pt => {
        const u = i / 12;
        return [cx + 5 * u, front(bottom) + (dip - front(bottom)) * Math.sin(Math.PI * u) - (front(bottom) - back(bottom)) * u];
      });
      const down: Pt[] = [[edge, front(0.1)], ...ys.map((y): Pt => [cx, front(y)]), ...under.slice(0, 7)];
      const up: Pt[] = [...under.slice(6), ...[...ys].reverse().map((y): Pt => [cx + 5, back(y)])];
      const lenOf = (pts: Pt[]) => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
      const share = lenOf(down) / (lenOf(down) + lenOf(up));
      tape(g, partial(down, run / share), tw);
      if (run > share) tape(g, partial(up, (run - share) / (1 - share)), tw * 0.8, 0.4);
      return;
    }
  }
}

/** A tape round something at height y: in level from the edge, then round the front, the back following. */
function wrap(g: CanvasRenderingContext2D, cx: number, y: number, r: number, depth: number, edge: number, k: number, m: number, tw: number) {
  const N = 80;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const q = 1 - k + (k * i) / N;
    // Level, the left end of the tape lies at the left of the body; wrapped, it lies at the same place on the
    // ring, so the tape closes round without flipping.
    const A: Pt = [cx - r + q * (edge - (cx - r)), y];
    const a = Math.PI * (1 - q);
    const B: Pt = [cx + r * Math.cos(a), y + Math.sin(a) * r * depth];
    pts.push([A[0] + (B[0] - A[0]) * m, A[1] + (B[1] - A[1]) * m]);
  }
  if (m > 0.9) {
    const back = Array.from({ length: N + 1 }, (_, i): Pt => {
      const a = Math.PI * (1 + i / N);
      return [cx + r * Math.cos(a), y + Math.sin(a) * r * depth];
    });
    tape(g, back, tw * 0.8, 0.35 * seg(m, 0.9, 1));
  }
  tape(g, pts, tw);
}

/** 'play' plays the measurement's tape once; 'still' is the welcome's form at rest with no tape; 'all' has the
 *  base girths' tapes on it, for the check page. */
export type DemoMode = 'play' | 'still' | 'all';

/** The tapes round the form at rest, for the check page. */
function allTapes(g: CanvasRenderingContext2D, w: number, h: number, kind?: FormKind) {
  const { S, cx, Y } = layout(w, h);
  const tw = clamp(w * 0.03, 6, 11);
  for (const y of Object.values(onFormFor(kind))) wrap(g, cx, Y(y!), R(y!) * S + tw * 0.15, DEPTH * 1.1, w, 1, 1, tw);
}

/** One measurement's how-to: the figure with the tape played once to where it goes. Change `replay` to play it
 *  again from the start. */
export function TapeDemo({ id, mode = 'play', kind, replay = 0 }: { id: MeasurementId; name?: string; mode?: DemoMode; kind?: FormKind; replay?: number }) {
  const run = useRef<{ start: number; from: [number, number]; to: [number, number]; turn: [number, number]; zoom: number; play: number } | null>(null);
  const ref = useCanvas(
    (g, w, h, now) => {
      pickForm(kind);
      if (mode !== 'play') {
        settledForm(g, w, h);
        if (mode === 'all') allTapes(g, w, h, kind);
        return false;
      }
      const t = tapeFor(id, kind);
      if (!run.current) {
        const fast = played.size >= 5 && !played.has(id);
        played.add(id);
        const to = t ? viewFor(t) : ([REST_TOP, 1.6] as [number, number]);
        const turnTo = t && isBack(t) ? Math.PI : 0;
        const same = Math.abs(lastView[0] - to[0]) < 1e-3 && Math.abs(lastView[1] - to[1]) < 1e-3 && lastTurn === turnTo;
        run.current = { start: now, from: lastView, to, turn: [lastTurn, turnTo], zoom: same ? 0 : fast ? ZOOM / 2 : ZOOM, play: fast ? PLAY / 2 : PLAY };
        lastView = to;
        lastTurn = turnTo;
      }
      const r = run.current;
      const el = stillMotion() ? Infinity : now - r.start;
      const z = r.zoom ? clamp(el / r.zoom, 0, 1) : 1;
      const p = clamp((el - r.zoom) / r.play, 0, 1);
      paintTape(g, w, h, r.from, r.to, r.turn, z, p, t);
      return p < 1;
    },
    [id, mode, kind, replay],
  );
  // Each new page or replay starts a fresh run from where the camera is now.
  useEffect(() => () => void (run.current = null), [id, mode, kind, replay]);
  return <canvas ref={ref} className="contour" aria-hidden="true" />;
}

/** One form at rest, small, for choosing which form to draft on. */
export function FormPicture({ kind }: { kind: FormKind }) {
  const ref = useCanvas(
    (g, w, h) => {
      pickForm(kind);
      settledForm(g, w, h);
      return false;
    },
    [kind],
  );
  return <canvas ref={ref} className="form-picture" aria-hidden="true" />;
}

/** Where each girth belongs on the form, read off its outline: bust is the widest point above the waist,
 *  waist the narrowest, hip the widest below. The tapes are tested against these so a drawing can't drift. */
export function formLandmarks(): Record<'full_bust' | 'waist' | 'full_hip', number> {
  const find = (a: number, b: number, better: (r: number, best: number) => boolean) => {
    let at = a;
    for (let y = a; y <= b; y += 0.001) if (better(R(y), R(at))) at = y;
    return at;
  };
  return {
    full_bust: find(-1.1, -0.2, (r, b) => r > b),
    waist: find(-0.3, 0.5, (r, b) => r < b),
    full_hip: find(0.4, 1.3, (r, b) => r > b),
  };
}

/** Where the hip and floor sit on the form, and how deep its rings look, for drawing a garment round
 * the same body (its half-width is R in engine/form.ts). */
export const FORM_HIP = 0.82;
export const FORM_FLOOR = FLOOR;
export const FORM_DEPTH = DEPTH;
/** The legs' half-width down from the crotch, how far apart they stand, and the knee, for views that
 * turn the legs (the shape preview of trousers). */
export const FORM_LEG = LEG;
export const FORM_LEG_X = LEG_X;
export const FORM_CROTCH = 1.2;
export const FORM_KNEE = KNEE;
