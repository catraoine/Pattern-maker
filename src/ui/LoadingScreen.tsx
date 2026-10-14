import { useEffect, useRef, useState } from 'react';

// The loading screen shown when the app opens ("A3 Name Drawn"): a pen line drafts a bodice block
// in champagne on black, then rules the line the name sits on. A tap or key skips it.

const DRAW = 3100; // the drawing is complete by here
const HOLD = 3500; // then the whole screen fades away
const FADE = 400;

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

/** A front bodice block in a unit box, as one closed pen stroke: neck, shoulder, armhole, side seam, waist dart, centre front. */
export const BODICE: Pt[] = [
  quad([0, 0.16], [0.24, 0.15], [0.3, 0], 30),
  line([0.3, 0], [0.8, 0.09], 30),
  quad([0.8, 0.09], [0.7, 0.42], [0.96, 0.46], 40),
  line([0.96, 0.46], [0.9, 1], 30),
  line([0.9, 1], [0.6, 1], 18),
  line([0.6, 1], [0.5, 0.58], 22),
  line([0.5, 0.58], [0.4, 1], 22),
  line([0.4, 1], [0, 1], 22),
  line([0, 1], [0, 0.16], 30),
].reduce<Pt[]>((all, part) => all.concat(all.length ? part.slice(1) : part), []);

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

function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = LINE;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const bw = Math.min(w * 0.5, h * 0.3), bh = bw * 1.15;
  const x0 = (w - bw) / 2, y0 = h * 0.4 - bh / 2;
  const lw = Math.max(0.8, bw / 150);

  // The bodice, drawn in one stroke
  g.lineWidth = lw;
  const f = inOut(seg(t, 100, 2100));
  const tip = polyTo(g, BODICE.map(([x, y]) => [x0 + x * bw, y0 + y * bh]), f);
  if (f > 0 && f < 1) pen(g, tip, lw * 1.6);

  // The same pen then rules the line the name sits on
  const rw = bw * 1.12, rx = (w - rw) / 2, ry = y0 + bh + Math.max(48, bh * 0.45);
  const rf = inOut(seg(t, 2100, 2800));
  if (rf > 0) {
    g.globalAlpha = 0.7;
    g.lineWidth = lw * 0.8;
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(rx + rw * rf, ry);
    g.stroke();
    if (rf < 1) pen(g, [rx + rw * rf, ry], lw * 1.4);
  }

  g.save();
  g.globalAlpha = seg(t, 2500, 3000);
  g.fillStyle = TEXT;
  g.font = "500 11px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
  } catch {
    // Older browsers draw the name without tracking.
  }
  g.textAlign = 'center';
  g.fillText('MAISON TRACÉ', w / 2 + 2, ry - 14);
  g.restore();
}

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = 0;
    let frame = 0;
    let started = false;
    let size = { w: 0, h: 0 };
    const timers: number[] = [];

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const paint = (t: number) => draw(g, size.w, size.h, t);
    const leave = (after: number) => {
      timers.push(window.setTimeout(() => setLeaving(true), after));
      timers.push(window.setTimeout(() => done.current(), after + FADE));
    };
    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      paint(Math.min(t, DRAW));
      if (t < DRAW) frame = requestAnimationFrame(tick);
    };

    fit();
    const ro = new ResizeObserver(() => {
      fit();
      if (still || (start && performance.now() - start >= DRAW)) paint(DRAW);
    });
    ro.observe(canvas);

    const go = () => {
      if (started) return;
      started = true;
      if (still) {
        paint(DRAW);
        leave(1200);
      } else {
        frame = requestAnimationFrame(tick);
        leave(HOLD);
      }
    };
    // Wait briefly for the name's font so it isn't drawn in a fallback face.
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    timers.push(window.setTimeout(go, 600));

    const skip = () => {
      timers.forEach(clearTimeout);
      setLeaving(true);
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
