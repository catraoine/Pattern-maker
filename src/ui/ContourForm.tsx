import { useEffect, useRef } from 'react';
import type { MeasurementId } from '../measurements';
import { R, spline } from '../engine/form';

// The welcome screen's dress form, drawn in contour lines on black. It is the same form as the measuring pages
// (Cat, 2026-10-18: the body must stay the same everywhere). The outline is drawn first, or handed over already
// drawn by the loading screen, then all the long lines are drawn down together from the shoulders (Cat's T5
// Drawn Down). No tape on the welcome.

const DOWN = 1300; // the long lines are drawn down over this long
// Champagne lines (Cat's G4 pick), matching --gild and --gild-glow in styles.css.
const CHAMPAGNE = '#d9c49b';
const CHAMPAGNE_GLOW = '#f3e6c8';
// The tape (Cat's G2 Ivory Line, 2026-10-18): a crisp ivory line this many times the outline's weight, no glow.
const TAPE_W = 1.5;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);

type Pt = [number, number, number?];

// The neck starts at -1.66: short and full, like a dressmaker's form.
const YS = Array.from({ length: 221 }, (_, i) => -1.66 + (2.96 * i) / 220);
const DEPTH = 0.16;

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

const LINES = 23;

/** One line through the points, drawn as far as `frac` of the way along. */
function path(g: CanvasRenderingContext2D, pts: Pt[], frac = 1) {
  const n = Math.floor((pts.length - 1) * clamp(frac, 0, 1));
  if (n < 1) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

/** A point on the form at height y, a fraction u of the way from the centre to the side, curving round the front. */
function onForm(cx: number, S: number, Y: (y: number) => number, y: number, u: number): Pt {
  return [cx + u * R(y) * S, Y(y) + Math.sqrt(Math.max(0, 1 - u * u)) * R(y) * S * DEPTH, u];
}


/** Where the form sits in a canvas of this size. */
function layout(w: number, h: number) {
  const S = Math.min(w * 0.82, h * 0.46);
  const cx = w / 2;
  const wy = h * 0.5;
  return { S, cx, wy, lw: Math.max(0.7, S / 252) * 1.2, Y: (y: number) => wy + (y - 0.1) * S };
}

/**
 * The form's outline as one closed loop, clockwise from the top left (across the neck, down the right side,
 * across the hem, up the left side), so the loading screen's bodice can be reshaped into it.
 */
export function formOutline(w: number, h: number): { pts: [number, number][]; lw: number } {
  const { S, cx, Y, lw } = layout(w, h);
  const left = YS.map((y): [number, number] => [cx - R(y) * S, Y(y)]);
  const right = YS.map((y): [number, number] => [cx + R(y) * S, Y(y)]);
  return { pts: [left[0], ...right, ...left.reverse()], lw };
}

/** The bottom of the form fades into the black from here (a fraction of the canvas height). */
export const FADE_FROM = 0.78;

// `drawn`: the loading screen handed the outline over already drawn, so the lines are drawn down straight away.
function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, drawn: boolean, text = 'CM  /  IN') {
  const t0 = drawn ? 0 : OUTLINE;
  settledForm(g, w, h, drawn ? 1 : inOut(seg(t, 0, OUTLINE - 100)), inOut(seg(t, t0, t0 + DOWN)));

  // The units, small in the corner: never a number
  g.save();
  g.globalAlpha = out(seg(t, t0 + DOWN - 200, t0 + DOWN + 300));
  g.fillStyle = CHAMPAGNE;
  g.font = "500 9px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  } catch {
    // Older browsers draw the label without tracking.
  }
  g.textAlign = 'right';
  g.fillText(text, w - 14, h - 12);
  g.restore();
}

/**
 * The form at rest, drawn by this one function on the welcome and on the bust, waist and hip pages that follow
 * it at the same size and place, so the lines are identical: the outline and the long lines, each drawn as far
 * as given.
 */
function settledForm(g: CanvasRenderingContext2D, w: number, h: number, outline = 1, lines = 1) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = CHAMPAGNE;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const { S, cx, lw, Y } = layout(w, h);
  const edge = (u: number) => lw * (0.5 + Math.sin(Math.PI * u));
  taper(g, YS.map((y) => [cx - R(y) * S, Y(y)]), outline, edge);
  taper(g, YS.map((y) => [cx + R(y) * S, Y(y)]), outline, edge);
  for (let j = 0; j < LINES && lines > 0; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES;
    const c = Math.cos(th);
    g.globalAlpha = 0.7;
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(c));
    path(g, YS.map((y) => onForm(cx, S, Y, y, c)), lines);
  }
  const fade = g.createLinearGradient(0, h * FADE_FROM, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalAlpha = 1;
  g.fillStyle = fade;
  g.fillRect(0, h * FADE_FROM, w, h * (1 - FADE_FROM));
}

/** How long the outline takes to draw when the welcome draws it itself. */
const OUTLINE = 1000;

// When the app opens on the welcome screen, the loading screen reshapes its bodice into this form's outline.
// 'wait' draws nothing until then; 'drawn' starts with the outline already in place; 'fresh' plays it all.
export type FormStart = 'wait' | 'drawn' | 'fresh';


export function ContourForm({ start: from = 'fresh' }: { start?: FormStart }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || from === 'wait') return;
    const drawn = from === 'drawn';
    const end = (drawn ? 0 : OUTLINE) + DOWN + 300;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = 0;
    let gone = false;
    let frame = 0;
    let size = { w: 0, h: 0 };

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const paint = (t: number) => draw(g, size.w, size.h, t, drawn);
    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      paint(Math.min(t, end));
      if (t < end) frame = requestAnimationFrame(tick);
    };

    fit();
    const ro = new ResizeObserver(() => {
      fit();
      if (still || (start && performance.now() - start >= end)) paint(end);
    });
    ro.observe(canvas);
    const go = () => {
      if (gone) return;
      if (still) paint(end);
      else frame = requestAnimationFrame(tick);
    };
    // Wait for the label font so the last frame isn't drawn in a fallback face.
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    else go();

    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [from]);

  return <canvas ref={ref} className="contour" aria-hidden="true" />;
}

// The measuring pages keep the welcome's form and show, on a loop, where the tape goes for one
// measurement: girths wrap round the form, lengths and widths draw along it. No numbers, as on the welcome.

/** Points from the flat dress-form figure (200 x 420, see TapeFigure) mapped onto the contour form. */
const FIG_Y: [number, number][] = [[40, -1.75], [56, -1.5], [76, -1.3], [88, -1.08], [104, -0.78], [150, 0.1], [208, 0.82], [232, 1.3]];
function figY(y: number) {
  if (y >= 232) return 1.3 + (y - 232) * 0.02;
  let i = 0;
  while (FIG_Y[i + 1][0] < y) i++;
  const [a, b] = [FIG_Y[i], FIG_Y[i + 1]];
  return a[1] + ((y - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}

type Demo =
  | { kind: 'girth'; y: number }
  | { kind: 'path'; pts: [number, number][]; back?: boolean }
  | { kind: 'down'; from: number; to: number; back?: boolean };

const DEMOS: Partial<Record<MeasurementId, Demo>> = {
  waist: { kind: 'girth', y: 0.1 },
  full_hip: { kind: 'girth', y: 0.82 },
  full_bust: { kind: 'girth', y: -0.58 },
  high_bust: { kind: 'girth', y: -1.08 },
  neck: { kind: 'girth', y: -1.5 },
  // Round the arm where it joins the body: a narrow loop from the shoulder point down under the arm.
  armscye: { kind: 'path', pts: Array.from({ length: 33 }, (_, i): [number, number] => [149 + 8 * Math.sin((i / 32) * 2 * Math.PI), 98 - 22 * Math.cos((i / 32) * 2 * Math.PI)]) },
  shoulder_width: { kind: 'path', pts: [[46, 76], [154, 76]], back: true },
  shoulder_length: { kind: 'path', pts: [[115, 60], [152, 73]] },
  across_back: { kind: 'path', pts: [[54, 96], [146, 96]], back: true },
  across_front: { kind: 'path', pts: [[56, 86], [144, 86]] },
  front_hps_to_waist: { kind: 'path', pts: [[113, 59], [124, 104], [124, 150]] },
  bust_depth: { kind: 'path', pts: [[113, 59], [124, 104]] },
  apex_separation: { kind: 'path', pts: [[76, 104], [124, 104]] },
  front_shoulder_slope: { kind: 'path', pts: [[100, 150], [152, 73]] },
  back_shoulder_slope: { kind: 'path', pts: [[100, 150], [152, 73]], back: true },
  nape_to_waist: { kind: 'down', from: 46, to: 150, back: true },
  waist_to_hip: { kind: 'down', from: 150, to: 208 },
  waist_to_knee: { kind: 'down', from: 150, to: 330 },
  waist_to_floor: { kind: 'down', from: 150, to: 404 },
  front_waist_to_hip: { kind: 'down', from: 150, to: 208 },
  back_waist_to_hip: { kind: 'down', from: 150, to: 208, back: true },
};

export const DEMO_LOOP = 4800;

function drawDemo(g: CanvasRenderingContext2D, w: number, h: number, t: number, id: MeasurementId, name: string) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const demo = DEMOS[id] ?? { kind: 'girth', y: 0.1 };

  // Frame the part of the body this measurement uses, as a close crop like the welcome's.
  let top: number, bottom: number;
  if (demo.kind === 'girth') [top, bottom] = [demo.y - 0.95, demo.y + 0.95];
  // Knee and floor are far below the form: keep the form a good size and let the tape run on past its hem.
  else if (demo.kind === 'down') [top, bottom] = [figY(demo.from) - 0.45, Math.min(figY(demo.to), 2.2) + 0.3];
  else {
    const ys = demo.pts.map((p) => figY(p[1]));
    [top, bottom] = [Math.min(...ys) - 0.7, Math.max(...ys) + 0.7];
  }
  top = Math.max(top, -1.85);
  const S = Math.min(h / (bottom - top), w * 0.62);
  const cx = w / 2;
  const Y = (y: number) => h / 2 + (y - (top + bottom) / 2) * S;
  const X = (x: number) => cx + ((x - 100) / 56) * 0.58 * S;
  const lw = Math.max(0.7, S / 252) * 1.2;
  const P = (y: number, th: number, grow = 0): Pt => {
    const r = R(y) + grow;
    return [cx + Math.cos(th) * r * S, Y(y) + Math.sin(th) * r * S * DEPTH];
  };
  const formYs = YS.filter((y) => Y(y) > -20 && Y(y) < h + 20);

  // The form, with its outline and long lines, settled as the light pass leaves it
  g.strokeStyle = CHAMPAGNE;
  const edge = (u: number) => lw * (0.5 + Math.sin(Math.PI * u));
  taper(g, formYs.map((y) => [cx - R(y) * S, Y(y)]), 1, edge);
  taper(g, formYs.map((y) => [cx + R(y) * S, Y(y)]), 1, edge);
  for (let j = 0; j < LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES;
    const c = Math.cos(th);
    g.globalAlpha = 0.7;
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(c));
    const pts = formYs.map((y) => P(y, th));
    for (let i = 1; i < pts.length; i++) stroke(g, pts[i - 1], pts[i]);
  }

  const p = inOut(seg(t, 350, 2500));
  const fadeOut = 1 - seg(t, DEMO_LOOP - 450, DEMO_LOOP);
  const glow = (draw: () => void, alpha = 1) => {
    g.save();
    g.globalAlpha = alpha * fadeOut;
    g.strokeStyle = CHAMPAGNE_GLOW;
    draw();
    g.restore();
  };
  let labelAt: Pt = [cx, h - 18];
  let labelAlong = false;
  let labelArrow = false;
  let labelCentre = false;

  if (demo.kind === 'girth') {
    // Round the back first (faint, behind the form), then across the front, glowing.
    const back = Math.min(1, p * 2);
    const front = Math.max(0, p * 2 - 1);
    const behind: Pt[] = Array.from({ length: 61 }, (_, i) => P(demo.y, Math.PI + (i / 60) * back * Math.PI, 0.014));
    glow(() => {
      g.shadowBlur = 0;
      g.lineWidth = lw * 1.1;
      for (let i = 1; i < behind.length; i++) stroke(g, behind[i - 1], behind[i]);
    }, 0.35);
    const n = Math.floor(80 * front);
    const tape: Pt[] = Array.from({ length: 81 }, (_, i) => P(demo.y, 2 * Math.PI - (i / 80) * Math.PI, 0.014));
    glow(() => {
      g.lineWidth = TAPE_W * lw;
      for (let i = 1; i <= n; i++) stroke(g, tape[i - 1], tape[i]);
    });
    labelAt = [cx + R(demo.y) * S * 0.35, Y(demo.y) + R(demo.y) * S * DEPTH + 22];
  } else {
    const pts: Pt[] =
      demo.kind === 'down'
        ? [
            [demo.back ? cx : cx + R(figY(demo.from)) * S + 10, Y(figY(demo.from))],
            [demo.back ? cx : cx + R(figY(demo.from)) * S + 10, Y(figY(demo.to))],
          ]
        : demo.pts.map(([x, y]) => [X(x), Y(figY(y))]);
    const past = demo.kind === 'down' && figY(demo.to) > 1.3;
    if (demo.kind === 'down' && !demo.back) {
      // Lengths run down the side, just clear of the form, and on past the hem for the knee and floor.
      for (const pt of pts) pt[0] = cx + 0.72 * S;
      if (past) pts[1][1] = h - 6;
    }
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    let left = total * p;
    glow(
      () => {
        g.lineWidth = TAPE_W * lw;
        for (let i = 1; i < pts.length && left > 0; i++) {
          const f = Math.min(1, left / lens[i - 1]);
          stroke(g, pts[i - 1], [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
          left -= lens[i - 1];
        }
        g.shadowBlur = 0;
        g.fillStyle = CHAMPAGNE_GLOW;
        const ends = demo.kind === 'path' && pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] ? [pts[0]] : [pts[0], pts[pts.length - 1]];
        ends.forEach((e, i) => {
          if (i && p < 1) return;
          g.beginPath();
          g.arc(e[0], e[1], lw * 1.6, 0, Math.PI * 2);
          g.fill();
        });
      },
      demo.back ? 0.75 : 1,
    );
    const last = pts[pts.length - 1];
    labelAt =
      demo.kind === 'down'
        ? [last[0] + 14, (pts[0][1] + (past ? Y(1.3) + 40 : last[1])) / 2]
        : [(Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2, Math.max(...pts.map((q) => q[1])) + 22];
    labelAlong = demo.kind === 'down';
    labelCentre = demo.kind === 'path';
    labelArrow = past;
  }

  // Label: the measurement's name, never a number; "at the back" when the form shows the front
  g.save();
  g.globalAlpha = out(seg(t, 2200, 2700)) * fadeOut;
  g.fillStyle = CHAMPAGNE;
  g.font = "500 9px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  } catch {
    // Older browsers draw the label without tracking.
  }
  const back = 'back' in demo && demo.back;
  const text = name.toUpperCase() + (back ? '  ·  AT THE BACK' : '') + (labelArrow ? '  ↓' : '');
  if (labelAlong) {
    // Lengths are labelled along the tape, reading downwards like the tape itself.
    g.translate(labelAt[0], labelAt[1]);
    g.rotate(Math.PI / 2);
    g.textAlign = 'center';
    g.fillText(text, 0, 0);
  } else {
    if (labelCentre) g.textAlign = 'center';
    g.fillText(text, labelAt[0], labelAt[1]);
  }
  g.restore();

  const fade = g.createLinearGradient(0, h * FADE_FROM, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalAlpha = 1;
  g.fillStyle = fade;
  g.fillRect(0, h * FADE_FROM, w, h * (1 - FADE_FROM));
}


// The measuring pages use the welcome's own form, at the same size and place, so moving on from the welcome
// changes nothing but the tape. Girths on the form wrap like the welcome's waist tape. Lengths pull back to the
// whole figure and run a line from a START dot to a STOP dot. The rest keep the close crop in drawDemo.
function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, a: number, align: CanvasTextAlign = 'left') {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = CHAMPAGNE;
  g.font = "500 9px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  } catch {
    // Older browsers draw the label without tracking.
  }
  g.textAlign = align;
  g.fillText(text, x, y);
  g.restore();
}
/** The welcome's tape, drawn across the front at height y. The label goes above it when it would fall below `seen`. */
function tapeAt(g: CanvasRenderingContext2D, w: number, h: number, y: number, t: number, text: string, seen = h) {
  const { S, cx, lw, Y } = layout(w, h);
  const P = (yy: number, th: number, grow = 0): Pt => {
    const r = R(yy) + grow;
    return [cx + Math.cos(th) * r * S, Y(yy) + Math.sin(th) * r * S * DEPTH, Math.cos(th)];
  };
  const tape: Pt[] = Array.from({ length: 81 }, (_, i) => P(y, (0.1 + (0.8 * i) / 80) * Math.PI, 0.014));
  const n = Math.floor(80 * out(seg(t, 1900, 2600)));
  if (n > 0) {
    g.save();
    g.strokeStyle = CHAMPAGNE_GLOW;
    g.lineWidth = TAPE_W * lw;
    for (let i = 1; i <= n; i++) stroke(g, tape[i - 1], tape[i]);
    g.restore();
  }
  const below = Y(y) + R(y) * S * DEPTH + 22;
  label(g, text, cx + R(y) * S * 0.35, below < seen - 6 ? below : Y(y) - R(y) * S * DEPTH - 8, out(seg(t, 2350, 2800)));
}
// Lengths: the view pulls back from the welcome's framing to the whole figure, legs and floor, so both ends show.
// z = 0 is exactly the welcome's framing; z = 1 has zoomed out so the floor is in view.
const LEG = spline([[1.2, 0.3], [1.6, 0.28], [2.3, 0.21], [3.15, 0.15], [3.4, 0.16], [4.1, 0.12], [4.55, 0.08], [4.7, 0.1]]);
const LEG_YS = Array.from({ length: 141 }, (_, i) => 1.2 + (3.5 * i) / 140);
const FLOOR = 4.72;
function frame(w: number, h: number, z: number, seen = h) {
  const a = layout(w, h);
  // Zoomed right out, the floor sits just inside what the page shows of the canvas.
  const S1 = (seen - 34 - 30) / (FLOOR - -1.75 + 0.15);
  const wy1 = 10 + (0.1 + 1.75) * S1;
  const k = inOut(clamp(z, 0, 1));
  const S = a.S + (S1 - a.S) * k;
  const wy = a.wy + (wy1 - a.wy) * k;
  return { S, cx: a.cx, wy, lw: Math.max(0.7, S / 252) * 1.2, Y: (y: number) => wy + (y - 0.1) * S, k };
}
/** The form with its legs and floor line, at any scale: `legs` fades the legs in (0 to 1). The same
 * body as every other screen, for views that need the whole figure (the turning shape preview). */
export function paintFigure(g: CanvasRenderingContext2D, S: number, cx: number, Y: (y: number) => number, lw: number, legs = 1) {
  const k = legs;
  const P = (y: number, th: number): Pt => [cx + Math.cos(th) * R(y) * S, Y(y) + Math.sin(th) * R(y) * S * DEPTH, Math.cos(th)];
  taper(g, YS.map((y) => [cx - R(y) * S, Y(y)]), 1, (u) => lw * (0.5 + Math.sin(Math.PI * u)));
  taper(g, YS.map((y) => [cx + R(y) * S, Y(y)]), 1, (u) => lw * (0.5 + Math.sin(Math.PI * u)));
  for (let j = 0; j < LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES;
    const c = Math.cos(th);
    g.globalAlpha = 0.7;
    g.lineWidth = lw * 0.6 * (1 - 0.35 * Math.abs(c));
    const pts = YS.map((y) => P(y, th));
    for (let i = 1; i < pts.length; i++) stroke(g, pts[i - 1], pts[i]);
  }
  // Legs fade in as the view pulls back
  if (k > 0) {
    for (const side of [-1, 1]) {
      const lx = cx + side * 0.27 * S;
      g.globalAlpha = k;
      g.lineWidth = lw;
      for (const e of [-1, 1]) {
        const pts = LEG_YS.map((y): Pt => [lx + e * LEG(y) * S, Y(y)]);
        for (let i = 1; i < pts.length; i++) stroke(g, pts[i - 1], pts[i]);
      }
      for (let j = 1; j < 6; j++) {
        const f = -1 + (2 * j) / 6;
        g.globalAlpha = k * 0.45;
        g.lineWidth = lw * 0.45;
        const pts = LEG_YS.map((y): Pt => [lx + f * LEG(y) * S, Y(y)]);
        for (let i = 1; i < pts.length; i++) stroke(g, pts[i - 1], pts[i]);
      }
    }
    g.globalAlpha = k * 0.6;
    g.lineWidth = 0.6;
    g.strokeStyle = '#9a8e78';
    stroke(g, [cx - 0.9 * S, Y(FLOOR)], [cx + 0.9 * S, Y(FLOOR)]);
  }
}
function figure(g: CanvasRenderingContext2D, w: number, h: number, z: number, seen = h) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = CHAMPAGNE;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const { S, cx, lw, Y, k } = frame(w, h, z, seen);
  paintFigure(g, S, cx, Y, lw, k);
  // The welcome's fade, which lifts as the legs come into view
  g.globalAlpha = 1 - k;
  const fade = g.createLinearGradient(0, h * FADE_FROM, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, h * FADE_FROM, w, h * (1 - FADE_FROM));
  g.globalAlpha = 1;
}
function dot(g: CanvasRenderingContext2D, x: number, y: number, a: number) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = CHAMPAGNE_GLOW;
  g.beginPath();
  g.arc(x, y, 3.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
/** A length on the zoomed-out figure: start and stop marked with dots and named. */
function lengthOn(g: CanvasRenderingContext2D, w: number, h: number, z: number, from: number, to: number, t: number, start: string, stop: string, seen = h) {
  const { S, cx, lw, Y } = frame(w, h, z, seen);
  const x = cx + R(0.1) * S + 0.12 * S + (to > 1.3 ? 0.14 * S : 0.18 * S);
  const y0 = Y(from), y1 = Y(to);
  const p = out(seg(t, 0, 1300));
  dot(g, x, y0, out(seg(t, -300, 0)));
  label(g, 'START · ' + start, x + 10, y0 + 3, out(seg(t, -300, 0)), 'left');
  g.save();
  g.strokeStyle = CHAMPAGNE_GLOW;
  g.lineWidth = TAPE_W * lw;
  stroke(g, [x, y0], [x, y0 + (y1 - y0) * p]);
  g.restore();
  dot(g, x, y1, out(seg(t, 1200, 1500)));
  label(g, 'STOP · ' + stop, x + 10, y1 + 3, out(seg(t, 1250, 1650)), 'left');
}

export const ON_FORM: Partial<Record<MeasurementId, number>> = { full_bust: -0.58, waist: 0.1, full_hip: 0.82 };

export { formLandmarks } from '../engine/form';
const KNEE = 3.2;
/** Lengths from the waist: where they stop, how far the view pulls back, and the STOP name. */
const LENGTHS: Partial<Record<MeasurementId, { to: number; zoom: number; stop: string }>> = {
  waist_to_hip: { to: 0.82, zoom: 0.6, stop: 'HIP' },
  front_waist_to_hip: { to: 0.82, zoom: 0.6, stop: 'HIP' },
  back_waist_to_hip: { to: 0.82, zoom: 0.6, stop: 'HIP' },
  waist_to_knee: { to: KNEE, zoom: 1, stop: 'KNEE' },
  waist_to_floor: { to: FLOOR, zoom: 1, stop: 'FLOOR' },
};
export const TAPE_LOOP = 3800;
export const ZOOM_LOOP = 6400;
export const loopFor = (id: MeasurementId) => (LENGTHS[id] ? ZOOM_LOOP : ON_FORM[id] !== undefined ? TAPE_LOOP : DEMO_LOOP);
/** The frame held for reduced motion: the tape or line fully drawn and named. */
const stillFor = (id: MeasurementId) => (LENGTHS[id] ? 4000 : ON_FORM[id] !== undefined ? TAPE_LOOP - 100 : 3000);

function paintDemo(g: CanvasRenderingContext2D, w: number, h: number, t: number, id: MeasurementId, name: string, seen: number) {
  const y = ON_FORM[id];
  const len = LENGTHS[id];
  if (len) {
    const z = (seg(t, 300, 1400) - seg(t, 5300, 6200)) * len.zoom;
    figure(g, w, h, z, seen);
    if (t > 1300 && t < 5300) lengthOn(g, w, h, z, 0.1, len.to, t - 1700, 'WAIST', len.stop, seen);
  } else if (y !== undefined) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    settledForm(g, w, h);
    tapeAt(g, w, h, y, 1500 + t * 0.42, name.toUpperCase(), seen);
  } else drawDemo(g, w, h, t, id, name);
}

/** One measurement's how-to: the contour form with the tape drawn on where it goes, looping. */
/** 'still' is the welcome's form at rest with no tape; 'all' has the base girths' tapes on it, for the check page. */
export type DemoMode = 'loop' | 'still' | 'all';

export function TapeDemo({ id, name, mode = 'loop' }: { id: MeasurementId; name: string; mode?: DemoMode }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = 0;
    let gone = false;
    let frame = 0;
    let size = { w: 0, h: 0 };
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // Reduced motion shows the finished frame and holds it.
    // The canvas is the welcome's height; the page may show only its top part.
    const paint = (t: number) => {
      if (mode === 'loop') return paintDemo(g, size.w, size.h, t, id, name, canvas.parentElement?.clientHeight ?? size.h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      settledForm(g, size.w, size.h);
      if (mode === 'all') for (const y of Object.values(ON_FORM)) tapeAt(g, size.w, size.h, y!, 3000, '');
    };
    const loop = loopFor(id);
    const tick = (now: number) => {
      if (!start) start = now;
      paint((now - start) % loop);
      frame = requestAnimationFrame(tick);
    };
    fit();
    const ro = new ResizeObserver(() => {
      fit();
      if (still || mode !== 'loop') paint(stillFor(id));
    });
    ro.observe(canvas);
    const go = () => {
      if (gone) return;
      if (still || mode !== 'loop') paint(stillFor(id));
      else frame = requestAnimationFrame(tick);
    };
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    else go();
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [id, name, mode]);

  return <canvas ref={ref} className="contour" aria-hidden="true" />;
}

/** Where the hip and floor sit on the form, and how deep its rings look, for drawing a garment round
 * the same body (its half-width is R in engine/form.ts). */
export const FORM_HIP = 0.82;
export const FORM_FLOOR = FLOOR;
export const FORM_DEPTH = DEPTH;
