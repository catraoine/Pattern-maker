// The skirt on a figure built from your measurements, drawn in contour lines. Swipe to turn it,
// pinch to zoom in, double-tap to reset.
import { useEffect, useMemo, useRef, useState } from 'react';
import { offsetAt } from '../engine/hem';
import type { SkirtDraft, SkirtMeasurements } from '../engine/skirt';

// An ellipse this deep (as a share of its width) has a perimeter of PERIM times its half-width.
const SKIRT_DEPTH = 0.78;
const BODY_DEPTH = 0.72;
const perim = (k: number) => Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k)));
const TILT = 0.14; // how far above the figure we look from

/** Smooth curve through keypoints (Catmull-Rom), as in the welcome screen's dress form. */
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

/** Widest point of a piece's outline at depth y below the waist. */
function widthAt(pts: { x: number; y: number }[], y: number): number {
  let best = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) best = Math.max(best, a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
  }
  return best;
}

interface Model {
  torsoTop: number;
  crotch: number;
  floor: number;
  body: (y: number) => number; // half-width of the torso
  leg: (y: number) => number; // half-width of one leg
  legAt: (y: number) => number; // how far each leg's centre sits from the middle
  skirt: (y: number) => number; // half-width of the skirt
  hem: (phi: number) => number; // depth of the hem at angle phi round the body (0 is centre front)
  folds: number; // circle skirts fall into folds
}

function buildModel(draft: SkirtDraft, m: SkirtMeasurements): Model {
  const ws = m.waist / perim(BODY_DEPTH);
  const hs = m.full_hip / perim(BODY_DEPTH);
  const T = 0.42 * m.waist_to_floor;
  const crotch = m.waist_to_hip + 7;
  const body = spline([
    [-T, 0.34 * ws], [-T + 4, 0.38 * ws], [-T + 8, 1.12 * hs], [-T + 13, 1.02 * hs], [-0.55 * T, 0.97 * hs],
    [-0.33 * T, 1.04 * ws], [0, ws], [m.waist_to_hip * 0.5, (ws + hs) / 2 + 0.03 * hs], [m.waist_to_hip, hs], [crotch, 0.97 * hs],
  ]);
  const knee = m.waist_to_knee;
  const floor = m.waist_to_floor;
  const leg = spline([[crotch - 2, 0.5 * hs], [crotch + (knee - crotch) * 0.5, 0.42 * hs], [knee, 0.3 * hs], [knee + (floor - knee) * 0.35, 0.33 * hs], [floor - 7, 0.18 * hs], [floor, 0.2 * hs]]);
  const legAt = spline([[crotch - 2, 0.5 * hs], [knee, 0.4 * hs], [floor, 0.36 * hs]]);

  const L = draft.lengthCm;
  let skirt: (y: number) => number;
  let folds = 0;
  if (draft.circleShare) {
    // Circle skirts hang in a bell, much wider at the hem than they sit at the waist.
    const wh = draft.finishedWaist / perim(SKIRT_DEPTH);
    const hh = wh + L * (0.25 + 0.4 * draft.circleShare) * 0.9;
    skirt = (y) => Math.max(body(Math.min(y, crotch)) + 0.4, wh + (hh - wh) * Math.max(0, Math.min(1, y / L)) ** 1.6);
    folds = 6 + Math.round(4 * draft.circleShare);
  } else {
    // Read the skirt's width from the pieces down to where the side seams end; below that a shaped
    // hem carries on at the same width.
    const outlines = draft.pieces.map((pc) => pc.outline.taggedPoints(16));
    const sideEnd = Math.min(...outlines.map(({ pts, tags }) => pts[tags.indexOf('hem')].y)) - 0.2;
    const [front, back] = outlines.map((o) => o.pts);
    const table = Array.from({ length: Math.floor(sideEnd) + 1 }, (_, y) => (2 * (widthAt(front, y) + widthAt(back, y))) / perim(SKIRT_DEPTH));
    table.push((2 * (widthAt(front, sideEnd) + widthAt(back, sideEnd))) / perim(SKIRT_DEPTH));
    skirt = (y) => {
      const x = Math.max(0, Math.min(sideEnd, y));
      const i = Math.min(table.length - 2, Math.floor(x));
      const t = (x - i) / Math.max(1e-6, Math.min(1, sideEnd - i));
      const w = table[i] * (1 - t) + table[i + 1] * t;
      return Math.max(w, (y < crotch ? body(y) : 0) + 0.3);
    };
  }
  const hem = (phi: number) => {
    const a = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
    const offs = draft.hem;
    if (!offs) return L;
    return a <= Math.PI / 2 ? L + offsetAt(offs.front, a / (Math.PI / 2)) : L + offsetAt(offs.back, (Math.PI - a) / (Math.PI / 2));
  };
  return { torsoTop: -T, crotch, floor, body, leg, legAt, skirt, hem, folds };
}

type Pt = [number, number];

function draw(g: CanvasRenderingContext2D, w: number, h: number, md: Model, theta: number, zoom: number, pan: number) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9c49b'; // champagne, matching --gild
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const top = md.torsoTop - 24; // room for the head
  // Fit the height, or the width for a full skirt that spreads wider than the frame.
  let widest = 0;
  for (let y = 0; y <= md.floor; y += 2) widest = Math.max(widest, md.skirt(y) * 1.08);
  const S0 = Math.min((h * 0.94) / (md.floor - top), (w * 0.94) / (2 * widest));
  const S = S0 * zoom;
  const cx = w / 2;
  // Zoomed in, the view centres on the skirt and can be panned up and down.
  const focus = md.hem(0) * 0.45;
  const atRest = Math.max(h * 0.03, (h - (md.floor - top) * S0) / 2) + (focus - top) * S0;
  const cy = atRest + (h / 2 - atRest) * Math.min(1, zoom - 1) - focus * S + pan;
  const Y = (y: number) => cy + y * S;
  const lw = Math.max(0.6, S / 5);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // A point at angle phi round an ellipse of half-width a (0 is centre front), turned by theta.
  const at = (a: number, depth: number, phi: number, y: number, dx = 0, dz = 0): [number, number, number] => {
    const X = a * Math.sin(phi) + dx;
    const Z = a * depth * Math.cos(phi) + dz;
    const Xr = X * cos + Z * sin;
    const Zr = -X * sin + Z * cos;
    return [cx + Xr * S, Y(y) + Zr * S * TILT, Zr];
  };
  const line = (pts: Pt[]) => {
    if (pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
    g.stroke();
  };
  // Half-width on screen of a turned ellipse, and the angle of its right-hand edge.
  const edge = (depth: number) => Math.atan2(cos, depth * sin);
  const ext = (a: number, depth: number) => a * Math.hypot(cos, depth * sin);

  const hemC = md.hem(0);

  // Floor
  g.globalAlpha = 0.25;
  g.lineWidth = lw * 0.6;
  line(Array.from({ length: 65 }, (_, i) => at(md.legAt(md.floor) + 10, 0.5, (i / 64) * 2 * Math.PI, md.floor).slice(0, 2) as Pt));

  // Legs, drawn first so the skirt hides their tops
  for (const s of [-1, 1]) {
    const ys = Array.from({ length: 60 }, (_, i) => md.crotch - 2 + ((md.floor - md.crotch + 2) * i) / 59);
    const centre = (y: number) => at(0, BODY_DEPTH, 0, y, s * md.legAt(y), 0);
    g.globalAlpha = 0.55;
    g.lineWidth = lw * 0.7;
    for (const side of [-1, 1]) line(ys.map((y) => { const c = centre(y); return [c[0] + side * ext(md.leg(y), 1) * S, c[1]] as Pt; }));
    g.globalAlpha = 0.22;
    g.lineWidth = lw * 0.5;
    for (let j = 1; j < 6; j++) {
      const phi = edge(1) - Math.PI + (j * Math.PI) / 6;
      line(ys.map((y) => at(md.leg(y), 1, phi, y, s * md.legAt(y), 0).slice(0, 2) as Pt));
    }
  }

  // Torso above the waist, a dress form: outline, contour lines, neck and head
  const ty = Array.from({ length: 50 }, (_, i) => md.torsoTop + (-md.torsoTop * i) / 49);
  g.globalAlpha = 0.6;
  g.lineWidth = lw * 0.8;
  for (const side of [-1, 1]) line(ty.map((y) => [cx + side * ext(md.body(y), BODY_DEPTH) * S, Y(y)] as Pt));
  g.globalAlpha = 0.25;
  g.lineWidth = lw * 0.5;
  for (let j = 1; j < 10; j++) {
    const phi = edge(BODY_DEPTH) - Math.PI + (j * Math.PI) / 10;
    line(ty.map((y) => at(md.body(y), BODY_DEPTH, phi, y).slice(0, 2) as Pt));
  }
  g.globalAlpha = 0.5;
  g.lineWidth = lw * 0.6;
  const neckR = md.body(md.torsoTop);
  line(Array.from({ length: 41 }, (_, i) => at(neckR, BODY_DEPTH, (i / 40) * 2 * Math.PI, md.torsoTop).slice(0, 2) as Pt));
  g.beginPath();
  g.ellipse(cx, Y(md.torsoTop - 12), neckR * 1.55 * S, 11 * S, 0, 0, 2 * Math.PI);
  g.stroke();

  // The skirt: a black silhouette over the legs, then its outline, seam-like contour lines and hem
  const ry = (bottom: number) => Array.from({ length: 70 }, (_, i) => (bottom * i) / 69);
  const fold = (phi: number, y: number) => (md.folds ? 1 + 0.06 * Math.min(1, y / hemC) * Math.sin(md.folds * phi) : 1);
  const ring = (y: number | ((phi: number) => number), from: number, to: number, n = 96) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const phi = from + ((to - from) * i) / n;
      const yy = typeof y === 'number' ? y : y(phi);
      return at(md.skirt(yy) * fold(phi, yy), SKIRT_DEPTH, phi, yy);
    });
  const eR = edge(SKIRT_DEPTH);
  const front = ring(md.hem, eR, eR - Math.PI);
  const rightSide = ry(md.hem(eR)).map((y) => [cx + ext(md.skirt(y), SKIRT_DEPTH) * S, Y(y)] as Pt);
  const leftSide = ry(md.hem(eR - Math.PI)).map((y) => [cx - ext(md.skirt(y), SKIRT_DEPTH) * S, Y(y)] as Pt);
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.beginPath();
  [...rightSide, ...front.map((q) => [q[0], q[1]] as Pt), ...leftSide.reverse()].forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  // across the back of the waist, so the fill closes over the body
  ring(0, eR - Math.PI, eR - 2 * Math.PI, 24).forEach((q) => g.lineTo(q[0], q[1]));
  g.closePath();
  g.fill();

  // Back of the hem, seen through the skirt on a high-low or turned view
  g.globalAlpha = 0.28;
  g.lineWidth = lw * 0.6;
  g.setLineDash([lw * 2, lw * 2.5]);
  line(ring(md.hem, eR - Math.PI, eR - 2 * Math.PI).map((q) => [q[0], q[1]] as Pt));
  g.setLineDash([]);

  // Contour lines down the skirt
  const N = 22;
  for (let j = 0; j < N; j++) {
    const phi = (2 * Math.PI * (j + 0.5)) / N;
    const pts = ry(md.hem(phi)).map((y) => at(md.skirt(y) * fold(phi, y), SKIRT_DEPTH, phi, y));
    const zMid = pts[35][2];
    if (zMid <= 0) continue;
    const c = Math.min(1, zMid / (md.skirt(md.hem(phi) * 0.5) * SKIRT_DEPTH || 1));
    g.globalAlpha = 0.18 + 0.4 * c;
    g.lineWidth = lw * (0.4 + 0.25 * c);
    line(pts.map((q) => [q[0], q[1]] as Pt));
  }
  // Side seams and centre front, a little brighter
  for (const phi of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const pts = ry(md.hem(phi)).map((y) => at(md.skirt(y) * fold(phi, y), SKIRT_DEPTH, phi, y));
    if (pts[35][2] <= 0) continue;
    g.globalAlpha = phi === 0 || phi === Math.PI ? 0.35 : 0.8;
    g.lineWidth = lw * 0.7;
    if (phi === 0 || phi === Math.PI) g.setLineDash([lw * 3, lw * 3]);
    line(pts.map((q) => [q[0], q[1]] as Pt));
    g.setLineDash([]);
  }

  // Outline, waistband and hem
  g.globalAlpha = 1;
  g.lineWidth = lw * 1.1;
  line(rightSide);
  line(leftSide);
  line(front.map((q) => [q[0], q[1]] as Pt));
  g.lineWidth = lw * 0.9;
  for (const y of [-3, 0]) line(ring(y, eR, eR - Math.PI, 40).map((q) => [q[0], q[1]] as Pt));
  g.globalAlpha = 0.35;
  for (const y of [-3, 0]) line(ring(y, eR - Math.PI, eR - 2 * Math.PI, 40).map((q) => [q[0], q[1]] as Pt));
  g.globalAlpha = 1;
  for (const s of [-1, 1]) line([[cx + s * ext(md.skirt(0), SKIRT_DEPTH) * S, Y(-3)], [cx + s * ext(md.skirt(0), SKIRT_DEPTH) * S, Y(0)]]);
}

const ANGLES: [string, number][] = [
  ['Front', 0],
  ['Side', Math.PI / 2],
  ['Back', Math.PI],
];

export function TurnFigure({ draft, m, label }: { draft: SkirtDraft; m: SkirtMeasurements; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const model = useMemo(() => buildModel(draft, m), [draft, m]);
  const view = useRef({ theta: 0.6, zoom: 1, pan: 0 });
  const [angle, setAngle] = useState(0.6);
  const redraw = useRef<() => void>(() => {});
  const goal = useRef<number | null>(0);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    let size = { w: 0, h: 0 };
    let frame = 0;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const paint = () => draw(g, size.w, size.h, model, view.current.theta, view.current.zoom, view.current.pan);
    // Ease towards a goal angle (the opening turn, or a Front / Side / Back tap).
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const v = view.current;
      if (goal.current !== null) {
        const d = Math.atan2(Math.sin(goal.current - v.theta), Math.cos(goal.current - v.theta));
        if (Math.abs(d) < 0.003 || still) {
          v.theta = goal.current;
          goal.current = null;
        } else v.theta += d * 0.12;
        setAngle(v.theta);
        paint();
        frame = requestAnimationFrame(tick);
      } else frame = 0;
    };
    redraw.current = () => {
      paint();
      if (goal.current !== null && !frame) frame = requestAnimationFrame(tick);
    };
    fit();
    paint();
    if (goal.current !== null) frame = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => {
      fit();
      paint();
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [model]);

  // Gestures: one finger turns (and pans when zoomed in), two fingers pinch to zoom, double-tap resets.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef(0);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    goal.current = null;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.current.zoom };
    } else if (pointers.current.size === 1) {
      const now = performance.now();
      if (now - lastTap.current < 300) {
        view.current.zoom = 1;
        view.current.pan = 0;
        goal.current = 0;
        redraw.current();
      }
      lastTap.current = now;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view.current;
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      v.zoom = Math.min(3, Math.max(1, (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist));
      if (v.zoom === 1) v.pan = 0;
    } else {
      const w = (e.target as Element).getBoundingClientRect().width || 300;
      v.theta -= ((e.clientX - prev.x) / w) * Math.PI * 1.4;
      if (v.zoom > 1) v.pan += e.clientY - prev.y;
      setAngle(v.theta);
    }
    redraw.current();
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const turnTo = (a: number) => {
    // Go the short way round.
    const t = view.current.theta;
    goal.current = t + Math.atan2(Math.sin(a - t), Math.cos(a - t));
    redraw.current();
  };

  const deg = ((Math.round((angle * 180) / Math.PI) % 360) + 360) % 360;
  const facing = deg < 30 || deg > 330 ? 'Front' : deg > 150 && deg < 210 ? 'Back' : 'Side';

  return (
    <div className="turn">
      <canvas
        ref={ref}
        className="turn-canvas"
        role="img"
        aria-label={`${label}, ${facing.toLowerCase()} view`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <p className="turn-read" aria-hidden="true">
        {facing} · {deg}°
      </p>
      <div className="row between wrap turn-bar">
        <div className="seg" role="group" aria-label="Turn the figure">
          {ANGLES.map(([name, a]) => (
            <button key={name} type="button" className={facing === name ? 'on' : ''} aria-pressed={facing === name} onClick={() => turnTo(a)}>
              {name}
            </button>
          ))}
        </div>
        <p className="muted small">Swipe to turn. Pinch to zoom.</p>
      </div>
    </div>
  );
}
