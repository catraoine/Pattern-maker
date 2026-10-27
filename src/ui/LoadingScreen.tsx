import { useEffect, useRef, useState } from 'react';
import { FADE_FROM, formOutline } from './ContourForm';
import type { FormKind } from '../measurements';

// The loading screen shown when the app opens, one thing at a time (Cat's M1, 2026-10-18): MAISON TRACÉ
// appears and rises into the header, then a pen drafts the bodice block, as big as the form it is about to
// become. When the app opens on the welcome screen, the flat block then wraps into the welcome's dress form,
// exactly where it sits, and the welcome takes over: the form's lines peel in from that outline.
// Every line is one weight. A tap or key skips it.

const NAME_IN = 400; // the name has faded in
const RISE: [number, number] = [700, 1300]; // the name rises into the header
const PEN: [number, number] = [1400, 3200]; // the pen drafts the block
const DRAW = 3200; // the drawing is complete by here
const HOLD = 3500; // then the whole screen fades away, or the block starts to wrap into the form
const MORPH = 4600; // the block has become the form's outline
const FADE = 400;
const LOOP = 420; // points on each outline while one becomes the other
const ASPECT = 0.58; // the block's width to its height

// Champagne, as picked for the app's look
const LINE = '#D9C49B';
const BRIGHT = '#F3E6C8';
const TEXT = '#EFE4CC';
const GLOW = 'rgba(243,230,200,.9)';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Pt = [number, number];

const line = (a: Pt, b: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);

const quad = (a: Pt, c: Pt, b: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n, v = 1 - u;
    return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
  });

/**
 * A front bodice block in a unit box, as one closed pen stroke: neck, shoulder, armhole, side seam, waist dart,
 * centre front. Cat's L1 Slim Dart (2026-10-21): taller than wide like a real front bodice, with the dart at its
 * true size so the waist no longer splits into two legs.
 */
export const BODICE: Pt[] = [
  quad([0, 0.17], [0.22, 0.165], [0.27, 0], 30),
  line([0.27, 0], [0.82, 0.075], 30),
  quad([0.82, 0.075], [0.71, 0.37], [0.98, 0.42], 40),
  line([0.98, 0.42], [0.92, 1], 34),
  line([0.92, 1], [0.56, 1], 18),
  line([0.56, 1], [0.5, 0.7], 16),
  line([0.5, 0.7], [0.44, 1], 16),
  line([0.44, 1], [0, 1], 22),
  line([0, 1], [0, 0.17], 34),
].reduce<Pt[]>((all, part) => all.concat(all.length ? part.slice(1) : part), []);

/** The same closed outline as `n` points evenly spaced along it. */
export function resample(pts: Pt[], n: number): Pt[] {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = d[d.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / (n - 1);
    while (j < d.length - 2 && d[j + 1] < s) j++;
    const u = (s - d[j]) / (d[j + 1] - d[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
  }
  return out;
}

/** Where the welcome's form is on screen, so the bodice can land on it. */
/** Where the welcome's form is, and which form it draws. */
type FormBox = { x: number; y: number; w: number; h: number; kind?: FormKind };

function polyTo(g: CanvasRenderingContext2D, pts: Pt[], frac: number): Pt {
  const n = Math.floor((pts.length - 1) * clamp(frac, 0, 1));
  if (n < 1) return pts[0];
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
  return pts[n];
}

function pen(g: CanvasRenderingContext2D, p: Pt, r: number) {
  g.save();
  g.globalAlpha = 1;
  g.fillStyle = BRIGHT;
  g.shadowColor = GLOW;
  g.shadowBlur = 12;
  g.beginPath();
  g.arc(p[0], p[1], r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Where the header's name sits, so the name can rise into it. */
type NameSpot = { x: number; y: number; w: number; h: number; font: string; tracking: string };

function findName(): NameSpot | null {
  const el = document.querySelector<HTMLElement>('.topbar .brand span');
  const r = el?.getBoundingClientRect();
  if (!el || !r || !r.width) return null;
  const cs = getComputedStyle(el);
  return { x: r.left, y: r.top, w: r.width, h: r.height, font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, tracking: cs.letterSpacing };
}

function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, box: FormBox | null, spot: NameSpot | null) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = LINE;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // The block fills about the space the form will, so nothing jumps in size when one becomes the other
  let bw: number, bh: number, x0: number, y0: number, lw: number;
  if (box) {
    bh = box.h * 0.9;
    bw = Math.min(bh * ASPECT, box.w * 0.8);
    bh = bw / ASPECT;
    // Centred in the window: on a computer the form it becomes then slides across to its place beside the title
    // (Cat, 2026-10-21), so the piece, the form and the slide are one path.
    const form = formOutline(box.w, box.h, box.kind);
    x0 = w / 2 - bw / 2;
    y0 = box.y + (box.h - bh) * 0.45;
    lw = form.lw;
  } else {
    bw = Math.min(w * 0.7, h * 0.62 * ASPECT);
    bh = bw / ASPECT;
    x0 = (w - bw) / 2;
    y0 = (h - bh) / 2 + 20;
    lw = Math.max(1, bw / 200);
  }

  const bodice: Pt[] = BODICE.map(([x, y]) => [x0 + x * bw, y0 + y * bh]);
  const m = box ? inOut(seg(t, HOLD, MORPH)) : 0;
  g.lineWidth = lw;
  if (box && m > 0) {
    morph(g, bodice, centred(box, w), m);
  } else {
    // The block, drawn in one stroke
    const f = inOut(seg(t, PEN[0], PEN[1]));
    const tip = polyTo(g, bodice, f);
    if (f > 0 && f < 1) pen(g, tip, lw * 1.6);
  }

  // The name: it appears in the middle, then rises to its place in the header
  const r = inOut(seg(t, RISE[0], RISE[1]));
  const to = spot ? { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 } : { x: w / 2, y: 40 };
  g.save();
  g.globalAlpha = seg(t, 0, NAME_IN);
  g.fillStyle = spot ? LINE : TEXT;
  g.font = spot?.font ?? "500 12px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spot?.tracking ?? '4px';
  } catch {
    // Older browsers draw the name without tracking.
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const x = w / 2 + (to.x - w / 2) * r, y = h * 0.45 + (to.y - h * 0.45) * r, k = 1.5 - 0.5 * r;
  g.translate(x, y);
  g.scale(k, k);
  g.fillText('MAISON TRACÉ', 0, 0);
  g.restore();
}

/** The form's box moved to the middle of the window, where the welcome's form starts before it slides to its place. */
const centred = (box: FormBox, w: number): FormBox => ({ ...box, x: w / 2 - box.w / 2 });

/** The flat bodice part way (m, 0 to 1) to the form's outline, cropped and faded the way the welcome draws the form. */
function morph(g: CanvasRenderingContext2D, bodice: Pt[], box: FormBox, m: number) {
  const form = formOutline(box.w, box.h, box.kind);
  const from = resample(bodice, LOOP);
  const to = resample(form.pts.map(([x, y]) => [box.x + x, box.y + y]), LOOP);
  g.save();
  // The crop closes in from the whole screen to the welcome's frame
  const top = box.y * m, bottom = g.canvas.clientHeight + (box.y + box.h - g.canvas.clientHeight) * m;
  g.beginPath();
  g.rect(box.x * m, top, g.canvas.clientWidth + (box.w - g.canvas.clientWidth) * m, bottom - top);
  g.clip();
  g.globalAlpha = 1;
  g.beginPath();
  from.forEach(([x, y], i) => {
    const px = x + (to[i][0] - x) * m, py = y + (to[i][1] - y) * m;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
  g.stroke();
  const fadeTop = box.y + box.h * FADE_FROM;
  const fade = g.createLinearGradient(0, fadeTop, 0, box.y + box.h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, `rgba(0,0,0,${m})`);
  g.fillStyle = fade;
  g.fillRect(0, fadeTop, g.canvas.clientWidth, box.h * (1 - FADE_FROM) + 1);
  g.restore();
}

interface Props {
  onDone: () => void;
  /** Where the welcome's form is, when the app is opening on the welcome screen. */
  findForm?: () => FormBox | null;
  /** Called as the loading screen starts to leave: true if the bodice became the form's outline. */
  onHandoff?: (drawn: boolean) => void;
}

export function LoadingScreen({ onDone, findForm, onHandoff }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const handoff = useRef(onHandoff);
  handoff.current = onHandoff;
  const find = useRef(findForm);
  find.current = findForm;

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = 0;
    let frame = 0;
    let started = false;
    let size = { w: 0, h: 0 };
    let box: FormBox | null = null;
    let spot: NameSpot | null = null;
    let end = DRAW;
    const timers: number[] = [];

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const paint = (t: number) => {
      // Find the form again as the wrap begins, in case the screen has changed size
      if (box && t >= HOLD) box = find.current?.() ?? box;
      draw(g, size.w, size.h, t, box, spot);
    };
    let handed = false;
    const handOver = (drawn: boolean) => {
      setLeaving(true);
      if (handed) return;
      handed = true;
      handoff.current?.(drawn);
    };
    const leave = (after: number, drawn: boolean) => {
      timers.push(window.setTimeout(() => handOver(drawn), after));
      timers.push(window.setTimeout(() => done.current(), after + FADE));
    };
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
      if (started) return;
      started = true;
      if (still) {
        spot = findName();
        paint(DRAW);
        leave(1200, false);
        return;
      }
      box = find.current?.() ?? null;
      spot = findName();
      if (box) end = MORPH;
      frame = requestAnimationFrame(tick);
      leave(box ? MORPH : HOLD, !!box);
    };
    // Wait briefly for the name's font so it isn't drawn in a fallback face.
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    timers.push(window.setTimeout(go, 600));

    const skip = () => {
      timers.forEach(clearTimeout);
      handOver(false);
      timers.push(window.setTimeout(() => done.current(), FADE));
    };
    canvas.addEventListener('click', skip);
    window.addEventListener('keydown', skip);

    return () => {
      started = true;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      ro.disconnect();
      canvas.removeEventListener('click', skip);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  return (
    <div className={leaving ? 'loading leaving' : 'loading'} role="status" aria-label="Loading Maison Tracé">
      <canvas ref={ref} aria-hidden="true" />
    </div>
  );
}
