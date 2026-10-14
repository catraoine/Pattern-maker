import { useEffect, useRef } from 'react';

// The welcome screen's dress form, drawn in fine contour lines on black.
// It draws on once, a band of light sweeps across it, and a tape settles at the waist.

const DURATION = 2900;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);

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

// Half-width of the form from neck (top) to hip (bottom); the waist sits at y = 0.1.
const R = spline([
  [-1.75, 0.12], [-1.5, 0.13], [-1.36, 0.17], [-1.24, 0.42], [-1.08, 0.55], [-0.8, 0.58], [-0.55, 0.61],
  [-0.3, 0.53], [-0.05, 0.45], [0.1, 0.43], [0.3, 0.49], [0.55, 0.61], [0.8, 0.65], [1.05, 0.63], [1.3, 0.58],
]);
const YS = Array.from({ length: 221 }, (_, i) => -1.75 + (3.05 * i) / 220);
const LINES = 23;
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

function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const S = Math.min(w * 0.82, h * 0.46);
  const cx = w / 2;
  const wy = h * 0.5;
  const lw = Math.max(0.7, S / 252) * 1.2;
  const Y = (y: number) => wy + (y - 0.1) * S;
  const P = (y: number, th: number, grow = 0): Pt => {
    const r = R(y) + grow;
    return [cx + Math.cos(th) * r * S, Y(y) + Math.sin(th) * r * S * DEPTH, Math.cos(th)];
  };

  // Outline
  taper(g, YS.map((y) => [cx - R(y) * S, Y(y)]), inOut(seg(t, 0, 900)), (u) => lw * (0.5 + Math.sin(Math.PI * u)));
  taper(g, YS.map((y) => [cx + R(y) * S, Y(y)]), inOut(seg(t, 120, 1020)), (u) => lw * (0.5 + Math.sin(Math.PI * u)));

  // Long vertical lines, brightened by the light as it sweeps across
  const on = t >= 1250;
  const lx = -1.15 + 2.3 * inOut(seg(t, 1250, 2550));
  for (let j = 0; j < LINES; j++) {
    const th = (Math.PI * (j + 0.5)) / LINES;
    const c = Math.cos(th);
    const rank = Math.round(Math.abs(j - (LINES - 1) / 2));
    const appear = out(seg(t, 650 + rank * 45, 650 + rank * 45 + 420));
    if (appear <= 0) continue;
    const passed = on && -c < lx;
    const near = on ? Math.exp(-1 * ((-c - lx) / 0.14) ** 2) : 0;
    g.globalAlpha = Math.min(1, (0.28 + (passed ? 0.42 : 0) + 0.5 * near) * appear);
    g.lineWidth = lw * (0.42 + (passed ? 0.18 : 0) + 0.3 * near) * (1 - 0.35 * Math.abs(c));
    const pts = YS.map((y) => P(y, th));
    for (let i = 1; i < pts.length; i++) stroke(g, pts[i - 1], pts[i]);
  }

  // The tape at the waist, with a soft glow
  const tape: Pt[] = Array.from({ length: 81 }, (_, i) => P(0.1, (0.1 + (0.8 * i) / 80) * Math.PI, 0.014));
  const n = Math.floor(80 * out(seg(t, 1900, 2600)));
  if (n > 0) {
    g.save();
    g.globalAlpha = 1;
    g.shadowColor = 'rgba(255,255,255,.9)';
    g.shadowBlur = 10;
    for (let i = 1; i <= n; i++) {
      g.lineWidth = lw * 2.5 * Math.sin((Math.PI * i) / 80) ** 0.8 + 0.3;
      stroke(g, tape[i - 1], tape[i]);
    }
    g.restore();
  }

  // Label: the measurement's name and units, never a number
  g.save();
  g.globalAlpha = out(seg(t, 2350, 2800));
  g.fillStyle = '#fff';
  g.font = "500 9px 'Chakra Petch', sans-serif";
  try {
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  } catch {
    // Older browsers draw the label without tracking.
  }
  g.fillText('WAIST  ·  CM / IN', cx + R(0.1) * S * 0.35, Y(0.1) + R(0.1) * S * DEPTH + 22);
  g.restore();

  // Fade the lower body into the black so the copy below sits cleanly
  const fade = g.createLinearGradient(0, h * 0.78, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalAlpha = 1;
  g.fillStyle = fade;
  g.fillRect(0, h * 0.78, w, h * 0.22);
}

export function ContourForm() {
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
    const paint = (t: number) => draw(g, size.w, size.h, t);
    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      paint(Math.min(t, DURATION));
      if (t < DURATION) frame = requestAnimationFrame(tick);
    };

    fit();
    const ro = new ResizeObserver(() => {
      fit();
      if (still || (start && performance.now() - start >= DURATION)) paint(DURATION);
    });
    ro.observe(canvas);
    const go = () => {
      if (gone) return;
      if (still) paint(DURATION);
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
  }, []);

  return <canvas ref={ref} className="contour" aria-hidden="true" />;
}
