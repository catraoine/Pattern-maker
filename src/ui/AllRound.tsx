// All the way round: the skirt on the dress form, turning, so you can see what the flat sketch can't:
// every seam and dart meeting at the waist and hem, the hem's length all the way round (unrolled into
// one line under the form), and stripes meeting at the side seams when the fabric has them.
// Drag anywhere to turn it. It is a shape preview drawn from the draft, not a cloth simulation.
// Seams are trued as the skirt is drafted, so nothing here is ever flagged as a problem: when a change
// is trued, the seams glow softly, and that is the only sign.
import { useEffect, useMemo, useRef } from 'react';
import { RoundSkirt, stripesMeet } from '../engine/allRound';
import type { SkirtMeasurements } from '../engine/skirt';
import { R as formHalfWidth } from '../engine/form';
import { FORM_DEPTH, FORM_FLOOR, FORM_HIP, paintFigure } from './ContourForm';

// Matching --gild, --gild-glow, --guide, --muted and --ok in styles.css.
const GILD = '#d9c49b';
const GLOW = '#f3e6c8';
const GUIDE = '#4a4338';
const MUTED = '#9a8e78';
const OK = '#a9c49b';

const TAU = Math.PI * 2;
const WAIST = 0.1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const STRIP = 96; // the unrolled hem line under the figure, in px

type Pt = [number, number, number];

interface Props {
  round: RoundSkirt;
  m: SkirtMeasurements;
  /** The fabric has checks or stripes to match. */
  striped?: boolean;
  /** Pull-on elastic waist: gathered, with no darts or zip. */
  elastic?: boolean;
  /** A narrow faced waist rather than a waistband. */
  faced?: boolean;
  label: string;
}

interface Row {
  id: string;
  name: string;
  text: string;
  /** Where to turn the form to when the row is tapped. */
  turn: number;
}

/** The rows under the view: plain facts about the skirt, never problems. */
export function roundRows(r: RoundSkirt, striped: boolean): Row[] {
  const rows: Row[] = [];
  const n = r.seams.length;
  const d = r.darts.length;
  if (r.seamsMeet) {
    rows.push({ id: 'seams', name: 'Seams', text: `All ${n} seams${d ? ` and ${d} darts` : ''} meet at the waist and the hem.`, turn: Math.PI / 2 });
  }
  const { front, back, left, right } = r.readings;
  const text =
    Math.abs(left - right) >= 1
      ? `From the waist: ${left} cm on your left, ${right} cm on your right, ${front} at the front and ${back} at the back.`
      : front === back && front === left
        ? `${front} cm from the waist all the way round.`
        : `${front} cm at the front, ${Math.round((left + right) / 2)} at the sides, ${back} at the back.`;
  rows.push({ id: 'hem', name: 'Hem', text, turn: back > front ? Math.PI : 0 });
  if (striped && stripesMeet(r)) {
    rows.push({ id: 'stripes', name: 'Stripes', text: 'Meet at both side seams. Line them up at the notches when you cut.', turn: -Math.PI / 2 });
  }
  return rows;
}

export function AllRound({ round, m, striped = false, elastic = false, faced = false, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const turn = useRef({ phi: 0.6, target: null as number | null, dragging: false, idle: 0 });
  const pulse = useRef(-1e9);
  const rows = useMemo(() => roundRows(round, striped), [round, striped]);

  // When the skirt changes, it has been trued as it was drafted: the seams glow, softly, once.
  const key = JSON.stringify(round.readings) + round.flare.toFixed(3);
  const seen = useRef(key);
  useEffect(() => {
    if (seen.current !== key) pulse.current = performance.now();
    seen.current = key;
  }, [key]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = turn.current;
    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth || 320;
      h = cv.clientHeight || 420;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);

    // Lengths in cm down from the waist, onto the form: the hip at its own line, the floor at the floor.
    const wh = m.waist_to_hip;
    const wf = Math.max(m.waist_to_floor, wh + 1);
    const yOf = (cm: number) => (cm <= wh ? WAIST + (cm / wh) * (FORM_HIP - WAIST) : FORM_HIP + ((cm - wh) / (wf - wh)) * (FORM_FLOOR - FORM_HIP));
    const lengths = Array.from({ length: 73 }, (_, i) => round.lengthAt((TAU * i) / 72));
    const longest = Math.max(...lengths);
    const meanY = yOf(lengths.reduce((t, v) => t + v, 0) / lengths.length);
    const hipR = formHalfWidth(FORM_HIP) + 0.03;
    const hemR = hipR * clamp(round.flare, 0.85, 2.3);
    const radius = (y: number) =>
      y <= FORM_HIP ? formHalfWidth(y) + 0.02 + 0.01 * ((y - WAIST) / (FORM_HIP - WAIST)) : hipR + (hemR - hipR) * clamp((y - FORM_HIP) / Math.max(0.05, meanY - FORM_HIP), 0, 1.3);
    const bandCm = faced ? 0 : 3;

    const draw = (now: number) => {
      const top = -0.45;
      const bottom = Math.min(FORM_FLOOR + 0.1, yOf(longest) + 0.45);
      const fig = h - STRIP;
      const S = Math.min((fig - 16) / (bottom - top), (w / 2 - 14) / (hemR * 1.04));
      const cx = w / 2;
      const Y = (y: number) => 8 + (y - top) * S;
      const lw = Math.max(0.7, S / 252) * 1.2;
      const phi = st.phi;
      const P = (a: number, r: number, y: number): Pt => {
        const th = a + phi;
        return [cx + Math.sin(th) * r * S, Y(y) + Math.cos(th) * r * S * FORM_DEPTH, Math.cos(th)];
      };
      const seg = (a: Pt, b: Pt) => {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      };
      const hemY = (a: number) => yOf(round.lengthAt(a));
      /** A line all the way round: bright where it faces you, faint behind. */
      const ring = (yAt: (a: number) => number, rAt: (a: number, y: number) => number, colour: string, width: number, back = 0.25) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        let prev: Pt | null = null;
        for (let i = 0; i <= 144; i++) {
          const a = -Math.PI + (TAU * i) / 144;
          const y = yAt(a);
          const q = P(a, rAt(a, y), y);
          if (prev) {
            g.globalAlpha = (q[2] + prev[2]) / 2 > 0 ? 1 : back;
            seg(prev, q);
          }
          prev = q;
        }
        g.globalAlpha = 1;
      };
      /** A seam or dart running down the skirt at angle a. */
      const down = (a: number, y0: number, y1: number, colour: string, width: number) => {
        const c = Math.cos(a + phi);
        g.strokeStyle = colour;
        g.lineWidth = width;
        g.globalAlpha = c > 0 ? 0.55 + 0.45 * c : 0.2;
        if (c <= 0) g.setLineDash([2, 3]);
        g.beginPath();
        for (let i = 0; i <= 32; i++) {
          const y = y0 + ((y1 - y0) * i) / 32;
          const q = P(a, radius(y), y);
          if (i) g.lineTo(q[0], q[1]);
          else g.moveTo(q[0], q[1]);
        }
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      };
      const dot = (q: Pt, colour: string, r = 3.4) => {
        g.globalAlpha = q[2] > 0 ? 1 : 0.35;
        g.strokeStyle = colour;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(q[0], q[1], r, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      };
      const text = (s: string, x: number, y: number, align: CanvasTextAlign = 'left') => {
        g.font = '500 9px "Chakra Petch", ui-monospace, monospace';
        g.fillStyle = MUTED;
        g.textAlign = align;
        g.fillText(s.toUpperCase(), x, y);
      };

      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // The figure stops above the hem line, so its legs don't run through it.
      g.save();
      g.beginPath();
      g.rect(0, 0, w, fig);
      g.clip();
      g.globalAlpha = 0.6;
      g.strokeStyle = GILD;
      paintFigure(g, S, cx, Y, lw, 1);
      g.restore();
      g.globalAlpha = 1;

      // The skirt: waistband, waist, hem and its outline.
      const bandTop = WAIST - (bandCm / wh) * (FORM_HIP - WAIST);
      if (bandCm) {
        ring(() => bandTop, () => radius(WAIST), GLOW, lw * 0.8, 0.2);
        for (const s of [-1, 1]) seg([cx + s * radius(WAIST) * S, Y(bandTop), 0], [cx + s * radius(WAIST) * S, Y(WAIST), 0]);
      }
      ring(() => WAIST, () => radius(WAIST), GLOW, lw * 1.1);
      ring(hemY, (_, y) => radius(y), GLOW, lw * 1.3, 0.3);
      g.strokeStyle = GLOW;
      g.lineWidth = lw * 1.2;
      for (const s of [1, -1]) {
        const a = (s * Math.PI) / 2 - phi;
        const y1 = hemY(a);
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const y = WAIST + ((y1 - WAIST) * i) / 40;
          const x = cx + s * radius(y) * S;
          if (i) g.lineTo(x, Y(y));
          else g.moveTo(x, Y(y));
        }
        g.stroke();
      }
      // Gathers on an elastic waist.
      if (elastic) {
        for (let a = -Math.PI; a < Math.PI; a += 0.12) {
          const q0 = P(a, radius(WAIST), WAIST);
          const q1 = P(a, radius(WAIST + 0.08), WAIST + 0.08);
          if (q0[2] > 0) {
            g.strokeStyle = GILD;
            g.lineWidth = lw * 0.6;
            g.globalAlpha = 0.7 * q0[2];
            seg(q0, q1);
          }
        }
        g.globalAlpha = 1;
      }

      // Stripes, when the fabric has them: level at the centres, dipping toward the side seams by the
      // angle each side seam cuts across the grain.
      if (striped) {
        const step = 6;
        const sec = (deg: number) => 1 / Math.cos((deg * Math.PI) / 180);
        for (let d = step; d < longest; d += step) {
          const yAt = (a: number) => {
            const ang = Math.abs(a) <= Math.PI / 2 ? round.sideAngle.front : round.sideAngle.back;
            const below = Math.max(0, d - wh * 0.6);
            return yOf(d + below * (sec(ang) - 1) * Math.sin(a) ** 2);
          };
          g.strokeStyle = GILD;
          g.lineWidth = lw * 0.75;
          let prev: Pt | null = null;
          let prevFront = true;
          for (let i = 0; i <= 144; i++) {
            const a = -Math.PI + (TAU * i) / 144;
            const y = yAt(a);
            const q = P(a, radius(y), y);
            const inside = y < hemY(a) - 0.01;
            // Each panel is drawn on its own, so stripes that don't meet would show as a break at the seam.
            const isFront = Math.abs(a) <= Math.PI / 2;
            if (prev && inside && isFront === prevFront) {
              g.globalAlpha = (q[2] + prev[2]) / 2 > 0 ? 0.75 : 0.12;
              seg(prev, q);
            }
            prevFront = isFront;
            prev = inside ? q : null;
          }
          g.globalAlpha = 1;
        }
      }

      // Darts, seams and the zip.
      for (const dt of round.darts) {
        const y1 = yOf(dt.lengthCm);
        down(dt.phi, WAIST, y1, GILD, lw * 0.8);
      }
      for (const s of round.seams) down(s.phi, bandCm ? bandTop : WAIST, hemY(s.phi), GLOW, lw * 1.1);
      for (const s of round.seams) {
        if (!s.zipCm) continue;
        const c = Math.cos(s.phi + phi);
        if (c <= 0) continue;
        g.strokeStyle = GILD;
        g.lineWidth = 0.8;
        g.globalAlpha = c;
        for (let y = WAIST + 0.02; y < yOf(s.zipCm); y += 0.035) {
          const q = P(s.phi, radius(y), y);
          seg([q[0] - 2.5, q[1], 0], [q[0] + 2.5, q[1], 0]);
        }
        g.globalAlpha = 1;
      }

      // Where they meet: every seam at the waist and the hem, every dart point, stripes at the sides.
      const glow = clamp(1 - (now - pulse.current) / 1600, 0, 1);
      for (const s of round.seams) {
        dot(P(s.phi, radius(WAIST), WAIST), OK);
        const q = P(s.phi, radius(hemY(s.phi)), hemY(s.phi));
        dot(q, OK);
        if (glow > 0 && q[2] > -0.2) {
          g.save();
          g.globalAlpha = glow * (q[2] > 0 ? 0.9 : 0.35);
          g.strokeStyle = GLOW;
          g.shadowColor = 'rgba(243,230,200,.9)';
          g.shadowBlur = 10;
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(q[0], q[1], 4 + (1 - glow) * 10, 0, TAU);
          g.stroke();
          g.restore();
        }
      }
      for (const dt of round.darts) {
        const y1 = yOf(dt.lengthCm);
        dot(P(dt.phi, radius(y1), y1), OK, 2.4);
      }
      if (striped && stripesMeet(round)) {
        for (const a of [Math.PI / 2, -Math.PI / 2]) {
          for (let d = 12; d < round.lengthAt(a) - 2; d += 12) {
            const y = yOf(d + Math.max(0, d - wh * 0.6) * (1 / Math.cos((round.sideAngle.front * Math.PI) / 180) - 1));
            dot(P(a, radius(y), y), OK, 2.2);
          }
        }
      }

      // The hem unrolled: centre front, round by the left side and the back, to the centre front again.
      const x0 = 14;
      const x1 = w - 12;
      const t0 = fig + 26;
      const b0 = h - 22;
      const lo = Math.min(...lengths);
      const hi = Math.max(...lengths);
      const span = Math.max(4, hi - lo);
      const ax = (a: number) => x0 + ((x1 - x0) * (((a % TAU) + TAU) % TAU)) / TAU;
      const ay = (cm: number) => t0 + ((cm - (lo - span * 0.15)) / (span * 1.3)) * (b0 - t0);
      text('Hem from the waist, all the way round', x0, t0 - 12);
      g.strokeStyle = GUIDE;
      g.lineWidth = 1;
      const marks: [number, string, CanvasTextAlign][] = [
        [0, 'CF', 'left'],
        [Math.PI / 2, 'Left', 'center'],
        [Math.PI, 'CB', 'center'],
        [(3 * Math.PI) / 2, 'Right', 'center'],
        [TAU - 1e-4, 'CF', 'right'],
      ];
      for (const [a, name, align] of marks) {
        const x = ax(a);
        seg([x, t0 - 4, 0], [x, b0 + 2, 0]);
        text(name, x, b0 + 13, align);
      }
      g.strokeStyle = GLOW;
      g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const a = (TAU * i) / 240;
        const x = ax(Math.min(a, TAU - 1e-4));
        const y = ay(round.lengthAt(wrap(a)));
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      for (const s of round.seams) {
        const a = ((s.phi % TAU) + TAU) % TAU;
        dot([ax(a), ay(round.lengthAt(s.phi)), 1], OK, 3);
      }
      const facing = ((-phi % TAU) + TAU) % TAU;
      g.strokeStyle = GILD;
      g.globalAlpha = 0.6;
      g.setLineDash([2, 3]);
      seg([ax(facing), t0 - 6, 0], [ax(facing), b0, 0]);
      g.setLineDash([]);
      g.globalAlpha = 1;
      text(`${round.readings.front} cm`, x0 + 3, ay(round.readings.front) - 5);
      if (round.readings.back !== round.readings.front) text(`${round.readings.back}`, ax(Math.PI) + 4, ay(round.readings.back) - 5);
      text('Drag to turn', 8, fig - 4);
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!st.dragging) {
        if (st.target !== null) {
          const d = wrap(st.target - st.phi);
          st.phi += d * Math.min(1, dt * 4);
          if (Math.abs(d) < 0.002) st.target = null;
        } else if (!still && now - st.idle > 2500) st.phi += dt * 0.3;
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let x0 = 0;
    let phi0 = 0;
    const downEv = (e: PointerEvent) => {
      st.dragging = true;
      st.target = null;
      x0 = e.clientX;
      phi0 = st.phi;
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (st.dragging) st.phi = phi0 + ((e.clientX - x0) / (cv.clientWidth || 1)) * Math.PI * 1.6;
    };
    const up = () => {
      st.dragging = false;
      st.idle = performance.now();
    };
    cv.addEventListener('pointerdown', downEv);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointerdown', downEv);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, [round, m, striped, elastic, faced]);

  const turnTo = (a: number) => {
    turn.current.target = -a + 0.3;
    turn.current.idle = performance.now();
  };

  return (
    <div className="all-round">
      <canvas ref={ref} className="all-round-canvas" role="img" aria-label={label} />
      <div className="all-round-rows">
        {rows.map((r) => (
          <button key={r.id} type="button" className="all-round-row" onClick={() => turnTo(r.turn)}>
            <span className="all-round-mark" aria-hidden="true" />
            <span>
              <span className="all-round-name">{r.name}</span>
              <span>{r.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="all-round-note">Shape preview, not a cloth simulation</p>
    </div>
  );
}
