// All the way round: the garment on the dress form, turning, so you can see what the flat sketch can't:
// every seam and dart meeting where they join, the neck and the hem all the way round (the hem unrolled
// into one line under the form), the sleeves and trouser legs, and stripes meeting at the side seams when
// the fabric has them. Drag anywhere to turn it. It is a shape preview drawn from the draft, not a cloth
// simulation. Seams are trued as each garment is drafted, so nothing here is ever flagged as a problem:
// when a change is trued, the seams glow softly, and that is the only sign.
import { useEffect, useMemo, useRef } from 'react';
import { RoundGarment, RoundPt, RoundSeam, stripesMeet } from '../engine/allRound';
import { R as formHalfWidth } from '../engine/form';
import { FORM_CROTCH, FORM_DEPTH, FORM_FLOOR, FORM_HIP, FORM_KNEE, FORM_LEG, FORM_LEG_X, paintFigure } from './ContourForm';

// Matching --gild, --gild-glow, --guide, --muted and --ok in styles.css.
const GILD = '#d9c49b';
const GLOW = '#f3e6c8';
const GUIDE = '#4a4338';
const MUTED = '#9a8e78';
const OK = '#a9c49b';

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
const WAIST = 0.1;
/** Where the nape and the bust sit on the form. */
const NAPE_Y = -1.45;
const BUST_Y = -0.58;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const STRIP = 96; // the unrolled hem line under the figure, in px

type Pt = [number, number, number];

/** The measurements the view places the garment by; any it lacks fall back to the form's own. */
export interface RoundMeasurements {
  waist?: number;
  full_bust?: number;
  full_hip?: number;
  waist_to_hip?: number;
  waist_to_knee?: number;
  waist_to_floor?: number;
  nape_to_waist?: number;
  crotch_depth?: number;
}

interface Props {
  round: RoundGarment;
  m: RoundMeasurements;
  /** The fabric has checks or stripes to match: which, so the note names the right one. */
  striped?: boolean | 'checks' | 'stripes';
  label: string;
}

interface Row {
  id: string;
  name: string;
  text: string;
  /** Where to turn the form to when the row is tapped. */
  turn: number;
}

/** Where a top's hem falls, in words. */
const fromWaist = (v: number) => (v < 0 ? `${-v} cm above the waist` : v === 0 ? 'at the waist' : `${v} cm below the waist`);

/** The rows under the view: plain facts about the garment, never problems. */
export function roundRows(r: RoundGarment, striped: boolean | 'checks' | 'stripes'): Row[] {
  const rows: Row[] = [];
  const n = r.seams.filter((s) => !s.cont).length;
  const d = r.darts.length;
  const where = r.kind === 'skirt' ? 'at the waist and the hem' : r.kind === 'trousers' ? 'from the waist to the hems' : 'from the neck to the hem';
  if (r.seamsMeet) {
    rows.push({ id: 'seams', name: 'Seams', text: `All ${n} seams${d ? ` and ${d} darts` : ''} meet ${where}.`, turn: HALF });
  }
  const { front, back, left, right } = r.readings;
  const sides = Math.round((left + right) / 2);
  let text: string;
  if (r.legs) text = `${front} cm from the waist to the hem, ${Math.round(r.legs.hemCm)} cm round each leg.`;
  else if (r.kind === 'top')
    text =
      // Within a centimetre all the way round reads as level.
      Math.max(front, back, sides) - Math.min(front, back, sides) <= 1
        ? `Ends ${fromWaist(Math.abs(sides) <= 1 ? 0 : sides)} all the way round.`
        : `Ends ${fromWaist(front)} at the front, ${fromWaist(sides)} at the sides and ${fromWaist(back)} at the back.`;
  else
    text =
      Math.abs(left - right) >= 1
        ? `From the waist: ${left} cm on your left, ${right} cm on your right, ${front} at the front and ${back} at the back.`
        : front === back && front === left
          ? `${front} cm from the waist all the way round.`
          : `${front} cm at the front, ${sides} at the sides, ${back} at the back.`;
  rows.push({ id: 'hem', name: 'Hem', text, turn: back > front ? Math.PI : 0 });
  if (r.sleeve) {
    rows.push({ id: 'sleeves', name: 'Sleeves', text: `${Math.round(r.sleeve.lengthCm)} cm from the shoulder, ${Math.round(r.sleeve.hemCm)} cm round the hem.`, turn: HALF });
  }
  if (striped && stripesMeet(r)) {
    rows.push({ id: 'stripes', name: striped === 'checks' ? 'Checks' : 'Stripes', text: 'Meet at both side seams. Line them up at the notches when you cut.', turn: -HALF });
  }
  return rows;
}

export function AllRound({ round, m, striped = false, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const turn = useRef({ phi: 0.6, target: null as number | null, dragging: false, idle: 0 });
  const pulse = useRef(-1e9);
  const rows = useMemo(() => roundRows(round, striped), [round, striped]);

  // When the garment changes, it has been trued as it was drafted: the seams glow, softly, once.
  const key = JSON.stringify(round.readings) + round.flare.toFixed(3) + round.seams.length + (round.sleeve?.lengthCm ?? 0);
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

    const trousers = round.kind === 'trousers';
    const isTop = round.kind === 'top' || round.kind === 'dress';
    const strip = trousers ? 0 : STRIP;

    // Lengths in cm from the waist, onto the form: the nape, waist, hip, crotch, knee and floor each at
    // their own line on the figure.
    const N = m.nape_to_waist ?? 41;
    const wh = m.waist_to_hip ?? 20.5;
    const knots: [number, number][] = [
      [-N, NAPE_Y],
      [0, WAIST],
      [wh, FORM_HIP],
    ];
    const add = (cm: number | undefined, y: number) => {
      if (cm !== undefined && cm > knots[knots.length - 1][0] + 1) knots.push([cm, y]);
    };
    add(m.crotch_depth ?? wh * 1.3, FORM_CROTCH);
    add(m.waist_to_knee, FORM_KNEE);
    add(Math.max(m.waist_to_floor ?? 104, wh + 2), FORM_FLOOR);
    const yOf = (cm: number) => {
      let i = 1;
      while (i < knots.length - 1 && cm > knots[i][0]) i++;
      const [c0, y0] = knots[i - 1];
      const [c1, y1] = knots[i];
      return y0 + ((cm - c0) / (c1 - c0)) * (y1 - y0);
    };
    const kY = (WAIST - NAPE_Y) / N;

    // The garment's ease over the body, as form units, at the bust, the waist and the hip.
    const krB = formHalfWidth(BUST_Y) / ((m.full_bust ?? 90) / TAU);
    const krW = formHalfWidth(WAIST) / ((m.waist ?? 72) / TAU);
    const krH = formHalfWidth(FORM_HIP) / ((m.full_hip ?? 98) / TAU);
    const easeOf = (fin: number | undefined, body: number | undefined, kr: number) => (fin && body ? clamp(((fin - body) / TAU) * kr, 0.012, 0.25) : undefined);
    const eW = easeOf(round.girth.waist, m.waist, krW) ?? 0.02;
    const eB = easeOf(round.girth.bust, m.full_bust, krB) ?? eW;
    const eH = easeOf(round.girth.hip, m.full_hip, krH) ?? eW;
    const easeAt = (y: number) =>
      y <= BUST_Y ? 0.01 + (eB - 0.01) * smooth(clamp((y - NAPE_Y) / (BUST_Y - NAPE_Y), 0, 1)) : y <= WAIST ? eB + (eW - eB) * ((y - BUST_Y) / (WAIST - BUST_Y)) : y <= FORM_HIP ? eW + (eH - eW) * ((y - WAIST) / (FORM_HIP - WAIST)) : eH;

    const lengths = Array.from({ length: 73 }, (_, i) => round.lengthAt((TAU * i) / 72));
    const tops = Array.from({ length: 73 }, (_, i) => round.topAt((TAU * i) / 72));
    const longest = Math.max(...lengths);
    const highest = Math.min(...tops);
    const meanY = yOf(lengths.reduce((t, v) => t + v, 0) / lengths.length);
    const hipR = formHalfWidth(FORM_HIP) + eH;
    const flares = !trousers && meanY > FORM_HIP + 0.05;
    const hemR = hipR * clamp(round.flare, 0.85, 2.3);
    const radius = (y: number) =>
      y <= FORM_HIP || !flares ? formHalfWidth(Math.min(y, 1.3)) + easeAt(y) : hipR + (hemR - hipR) * clamp((y - FORM_HIP) / Math.max(0.05, meanY - FORM_HIP), 0, 1.3);
    const bandTop = WAIST - round.bandCm * kY;

    // Sleeves hang from the armhole: out from the shoulder tip, then down the arm.
    const arm = round.armhole;
    const yS = arm ? yOf(arm.shoulderCm) : 0;
    const yU = arm ? yOf(arm.underarmCm) : 0;
    const sl = round.sleeve;
    const ra = sl ? Math.max(0.08, (sl.bicepCm / TAU) * krB * 0.95) : 0;
    const rh = sl ? Math.max(0.05, (sl.hemCm / TAU) * krB * 0.95) : 0;
    const yE = sl ? Math.max(yS + sl.lengthCm * kY, yU + 0.05) : 0;
    const axisX = (y: number) => formHalfWidth(yS) - 0.04 + (formHalfWidth(yU) + ra * 0.85 - formHalfWidth(yS) + 0.04) * smooth(clamp((y - yS) / (yU - yS || 1), 0, 1)) + Math.max(0, y - yU) * 0.04;
    const sleeveR = (y: number) => (y < yU ? ra * Math.sqrt(clamp((y - yS) / (yU - yS || 1), 0.12, 1)) : ra + (rh - ra) * clamp((y - yU) / (yE - yU || 1), 0, 1));

    // Trouser legs, round the form's own legs: easy at the thigh, then to the knee and the hem.
    const lg = round.legs;
    const yC = lg ? yOf(lg.crotchCm) : 0;
    const yH = lg ? yOf(lg.lengthCm) : 0;
    const yK = lg ? Math.min(yOf(m.waist_to_knee ?? lg.crotchCm + 31), yH) : 0;
    const krL = krH * 0.85;
    const thighR = lg ? FORM_LEG(yC) + 0.045 : 0;
    const kneeR = lg ? Math.max(FORM_LEG(yK) + 0.02, (lg.kneeCm / TAU) * krL) : 0;
    const legHemR = lg ? Math.max(FORM_LEG(yH) + 0.012, (lg.hemCm / TAU) * krL) : 0;
    const legR = (y: number) =>
      y <= yK ? thighR + (kneeR - thighR) * clamp((y - yC) / (yK - yC || 1), 0, 1) : kneeR + (legHemR - kneeR) * clamp((y - yK) / (yH - yK || 1), 0, 1);

    const reach = Math.max(hemR, sl ? axisX(yE) + rh : 0, lg ? FORM_LEG_X + Math.max(thighR, kneeR, legHemR) : 0, formHalfWidth(-0.55) + eB);

    const draw = (now: number) => {
      const top = Math.min(-0.45, yOf(highest) - 0.3);
      const bottom = trousers ? FORM_FLOOR + 0.1 : Math.min(FORM_FLOOR + 0.1, Math.max(yOf(longest), sl ? yE : -9) + 0.45);
      const fig = h - strip;
      const S = Math.min((fig - 16) / (bottom - top), (w / 2 - 14) / (reach * 1.04));
      const cx = w / 2;
      const Y = (y: number) => 8 + (y - top) * S;
      const lw = Math.max(0.7, S / 252) * 1.2;
      const phi = st.phi;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      /** A point round the body at angle a and radius r. */
      const P = (a: number, r: number, y: number): Pt => {
        const th = a + phi;
        return [cx + Math.sin(th) * r * S, Y(y) + Math.cos(th) * r * S * FORM_DEPTH, Math.cos(th)];
      };
      /** A point round a tube (a sleeve or a leg) standing at x = X, at angle a round it. */
      const T = (X: number, a: number, r: number, y: number): Pt => {
        const x = X + Math.sin(a) * r;
        const z = Math.cos(a) * r;
        return [cx + (x * c + z * s) * S, Y(y) + (z * c - x * s) * S * FORM_DEPTH, Math.cos(a + phi)];
      };
      /** Where a tube's centre comes on the screen, and how far in front of the body it stands. */
      const centre = (X: number, y: number) => ({ x: cx + X * c * S, y: Y(y) - X * s * S * FORM_DEPTH, z: -X * s });
      const seg = (a: Pt | [number, number], b: Pt | [number, number]) => {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      };
      /** A line through points: bright where it faces you, faint behind. */
      const line = (pts: Pt[], colour: string, width: number, back = 0.2, alpha = 1) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        for (let i = 1; i < pts.length; i++) {
          const f = (pts[i][2] + pts[i - 1][2]) / 2;
          g.globalAlpha = alpha * (f > 0 ? 0.55 + 0.45 * Math.min(1, f) : back);
          seg(pts[i - 1], pts[i]);
        }
        g.globalAlpha = 1;
      };
      const polyline = (pts: [number, number][], colour: string, width: number, alpha = 1) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        g.globalAlpha = alpha;
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.stroke();
        g.globalAlpha = 1;
      };
      const legX = (leg: number) => leg * FORM_LEG_X;
      /** A point on the garment, on the body or down a trouser leg. */
      const spot = (p: RoundPt, leg?: number): Pt => {
        const y = yOf(p.cm);
        return leg ? T(legX(leg), p.phi, legR(y), y) : P(p.phi, radius(y), y);
      };
      /** A seam or dart through its points, in small steps so it follows the body. */
      const along = (pts: RoundPt[], leg?: number): Pt[] => {
        const out: Pt[] = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          for (let k = i === 1 ? 0 : 1; k <= 10; k++) out.push(spot({ phi: a.phi + ((b.phi - a.phi) * k) / 10, cm: a.cm + ((b.cm - a.cm) * k) / 10 }, leg));
        }
        return out;
      };
      const ring = (yAt: (a: number) => number, rAt: (a: number, y: number) => number, colour: string, width: number, back = 0.25) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 144; i++) {
          const a = -Math.PI + (TAU * i) / 144;
          const y = yAt(a);
          pts.push(P(a, rAt(a, y), y));
        }
        line(pts, colour, width, back);
      };
      const tubeRing = (X: number, r: number, y: number, colour: string, width: number, alpha = 1) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 48; i++) pts.push(T(X, -Math.PI + (TAU * i) / 48, r, y));
        line(pts, colour, width, 0.25, alpha);
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
      const text = (str: string, x: number, y: number, align: CanvasTextAlign = 'left') => {
        g.font = '500 9px "Chakra Petch", ui-monospace, monospace';
        g.fillStyle = MUTED;
        g.textAlign = align;
        g.fillText(str.toUpperCase(), x, y);
      };
      const hemY = (a: number) => yOf(round.lengthAt(a));
      const topY = (a: number) => yOf(round.topAt(a));

      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // The figure stops above the hem line, so its legs don't run through it. Under trousers its legs
      // turn with the garment.
      g.save();
      g.beginPath();
      g.rect(0, 0, w, fig);
      g.clip();
      g.globalAlpha = 0.6;
      g.strokeStyle = GILD;
      paintFigure(g, S, cx, Y, lw, trousers ? 0 : 1, false, phi);
      g.restore();
      if (trousers) {
        const ys = Array.from({ length: 71 }, (_, i) => FORM_CROTCH + ((FORM_FLOOR - 0.02 - FORM_CROTCH) * i) / 70);
        for (const leg of [-1, 1]) {
          for (const e of [-1, 1]) {
            polyline(
              ys.map((y) => {
                const o = centre(legX(leg), y);
                return [o.x + e * FORM_LEG(y) * S, o.y];
              }),
              GILD,
              lw * 0.9,
              0.5,
            );
          }
          for (const a of [-0.9, 0, 0.9]) line(ys.map((y) => T(legX(leg), a, FORM_LEG(y), y)), GILD, lw * 0.45, 0, 0.45);
        }
        g.globalAlpha = 0.6;
        g.lineWidth = 0.6;
        g.strokeStyle = MUTED;
        seg([cx - 0.9 * S, Y(FORM_FLOOR)], [cx + 0.9 * S, Y(FORM_FLOOR)]);
        g.globalAlpha = 1;
      }

      // The garment: its top edge and waistband, its hem and its outline.
      if (round.bandCm) {
        ring(() => bandTop, () => radius(WAIST), GLOW, lw * 0.8, 0.2);
        for (const e of [-1, 1]) seg([cx + e * radius(WAIST) * S, Y(bandTop)], [cx + e * radius(WAIST) * S, Y(WAIST)]);
      }
      ring(topY, (_, y) => radius(y), GLOW, lw * 1.1);
      for (const r of round.rings) ring((a) => yOf(r(a)), (_, y) => radius(y), GLOW, lw * 0.9);
      if (!trousers) ring(hemY, (_, y) => radius(y), GLOW, lw * 1.3, 0.3);
      for (const e of [1, -1]) {
        const a = (e * Math.PI) / 2 - phi;
        const y0 = isTop && arm ? yU : topY(a);
        const y1 = trousers && lg ? yC : hemY(a);
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const y = y0 + ((y1 - y0) * i) / 40;
          pts.push([cx + e * radius(y) * S, Y(y)]);
        }
        polyline(pts, GLOW, lw * 1.2);
        // Over the shoulder, from the neck to the shoulder tip.
        if (isTop && arm) {
          const n0 = topY(a);
          const sh: [number, number][] = [];
          for (let i = 0; i <= 16; i++) {
            const y = n0 + ((yS - n0) * i) / 16;
            sh.push([cx + e * radius(y) * S, Y(y)]);
          }
          polyline(sh, GLOW, lw);
        }
      }
      // Gathers on an elastic waist.
      if (round.elastic) {
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
      if (striped && !trousers) {
        const step = 6;
        const sec = (dg: number) => 1 / Math.cos((dg * Math.PI) / 180);
        for (let d = Math.ceil(highest / step) * step + step; d < longest; d += step) {
          const yAt = (a: number) => {
            const ang = Math.abs(a) <= HALF ? round.sideAngle.front : round.sideAngle.back;
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
            const inside = y < hemY(a) - 0.01 && y > topY(a) + 0.01 && !(isTop && arm && y < yU && Math.abs(Math.abs(a) - HALF) < 0.35);
            // Each panel is drawn on its own, so stripes that don't meet would show as a break at the seam.
            const isFront = Math.abs(a) <= HALF;
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

      // Armholes, and the sleeves set into them.
      if (arm) {
        for (const e of [1, -1]) {
          const mid = (yS + yU) / 2;
          const half = (yU - yS) / 2;
          const loop: Pt[] = [];
          for (let i = 0; i <= 48; i++) {
            const t = (TAU * i) / 48;
            const y = mid - half * Math.cos(t);
            loop.push(P(e * HALF + 0.32 * Math.sin(t), radius(y) + 0.004, y));
          }
          line(loop, GLOW, lw * 1.05);
          if (!sl) continue;
          const ys = Array.from({ length: 41 }, (_, i) => yS + ((yE - yS) * i) / 40);
          const o = centre(e * axisX(yU), yU);
          const alpha = clamp(0.55 + o.z / (formHalfWidth(yU) + ra), 0.22, 1);
          for (const side of [-1, 1]) {
            polyline(
              ys.map((y) => {
                const q = centre(e * axisX(y), y);
                return [q.x + side * sleeveR(y) * S, q.y];
              }),
              GLOW,
              lw * 1.1,
              alpha,
            );
          }
          tubeRing(e * axisX(yE), rh, yE, GLOW, lw * 1.2, alpha);
          // The underarm seam, on the side of the sleeve toward the body.
          line(
            ys.filter((y) => y >= yU).map((y) => T(e * axisX(y), -e * HALF, sleeveR(y), y)),
            GLOW,
            lw,
            0.2,
            alpha,
          );
        }
      }

      // Trouser legs.
      if (lg) {
        const ys = Array.from({ length: 61 }, (_, i) => yC + ((yH - yC) * i) / 60);
        for (const leg of [-1, 1]) {
          for (const e of [-1, 1]) {
            polyline(
              ys.map((y) => {
                const o = centre(legX(leg), y);
                return [o.x + e * legR(y) * S, o.y];
              }),
              GLOW,
              lw * 1.2,
            );
          }
          tubeRing(legX(leg), legHemR, yH, GLOW, lw * 1.3);
        }
      }

      // Darts, seams, the zip, buttons and the vent.
      for (const dt of round.darts) line(along([dt.base, dt.tip]), GILD, lw * 0.8);
      const drawn = (sm: RoundSeam) => sm.kind !== 'sleeve';
      for (const sm of round.seams.filter(drawn)) line(along(sm.pts, sm.leg), GLOW, lw * 1.1);
      if (round.zip) {
        const z = round.zip;
        g.strokeStyle = GILD;
        g.lineWidth = 0.8;
        for (let cm = z.fromCm + 1; cm < z.toCm; cm += 1.6) {
          const q = spot({ phi: z.phi, cm });
          if (q[2] <= 0) continue;
          g.globalAlpha = q[2];
          seg([q[0] - 2.5, q[1]], [q[0] + 2.5, q[1]]);
        }
        g.globalAlpha = 1;
      }
      for (const b of round.opening?.buttons ?? []) {
        const y = yOf(b);
        dot(P(0.05, radius(y) + 0.005, y), GILD, 2.2);
      }
      if (round.vent) line(along([{ phi: Math.PI + 0.05, cm: round.vent.fromCm }, { phi: Math.PI + 0.05, cm: round.lengthAt(Math.PI) }]), GILD, lw * 0.8);

      // Where they meet: every seam at both ends, every dart point, stripes at the sides.
      const glow = clamp(1 - (now - pulse.current) / 1600, 0, 1);
      const meet = (q: Pt) => {
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
      };
      for (const sm of round.seams.filter(drawn)) {
        if (sm.pts.length < 2) continue;
        if (!sm.cont) dot(spot(sm.pts[0], sm.leg), OK);
        meet(spot(sm.pts[sm.pts.length - 1], sm.leg));
      }
      if (sl && arm) {
        for (const e of [1, -1]) {
          dot(P(e * HALF, radius(yU), yU), OK);
          meet(T(e * axisX(yE), -e * HALF, rh, yE));
        }
      }
      for (const dt of round.darts) dot(spot(dt.tip), OK, 2.4);
      if (striped && stripesMeet(round)) {
        for (const a of [HALF, -HALF]) {
          for (let d = Math.max(12, Math.ceil(highest / 12) * 12 + 12); d < round.lengthAt(a) - 2; d += 12) {
            const y = yOf(d + Math.max(0, d - wh * 0.6) * (1 / Math.cos((round.sideAngle.front * Math.PI) / 180) - 1));
            dot(P(a, radius(y), y), OK, 2.2);
          }
        }
      }

      text('Drag to turn', 8, fig - 4);
      if (!strip) return;

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
        [HALF, 'Left', 'center'],
        [Math.PI, 'CB', 'center'],
        [(3 * Math.PI) / 2, 'Right', 'center'],
        [TAU - 1e-4, 'CF', 'right'],
      ];
      for (const [a, name, align] of marks) {
        const x = ax(a);
        seg([x, t0 - 4], [x, b0 + 2]);
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
      for (const sm of round.seams) {
        const end = sm.pts[sm.pts.length - 1];
        if (!end || sm.leg || Math.abs(end.cm - round.lengthAt(end.phi)) > 0.5) continue;
        dot([ax(((end.phi % TAU) + TAU) % TAU), ay(end.cm), 1], OK, 3);
      }
      const facing = ((-phi % TAU) + TAU) % TAU;
      g.strokeStyle = GILD;
      g.globalAlpha = 0.6;
      g.setLineDash([2, 3]);
      seg([ax(facing), t0 - 6], [ax(facing), b0]);
      g.setLineDash([]);
      g.globalAlpha = 1;
      const cmText = (v: number) => (v < 0 ? `${-v} cm above` : `${v} cm`);
      text(cmText(round.readings.front), x0 + 3, ay(round.readings.front) - 5);
      if (round.readings.back !== round.readings.front) text(cmText(round.readings.back), ax(Math.PI) + 4, ay(round.readings.back) - 5);
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
  }, [round, m, striped]);

  const turnTo = (a: number) => {
    turn.current.target = -a + 0.3;
    turn.current.idle = performance.now();
  };

  return (
    <div className="all-round">
      <canvas ref={ref} className={`all-round-canvas${round.legs ? ' all-round-tall' : ''}`} role="img" aria-label={label} />
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
