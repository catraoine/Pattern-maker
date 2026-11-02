// The body the cloth is sewn onto, in true cm: the form's own shape (engine/body.ts) scaled ring by ring to the wearer's
// girths, its heights in cm below the waist placed on the form's lines (placeOnForm). The cloth is laid in this space,
// where a cm is a cm every way, and drawn back on the form after. X runs to the wearer's left, C down from the
// waist, Z forward.
import { BODY_BOTTOM, BODY_TOP, SHOULDER_TIP_Y, bodyHalf, shapeAt } from '../body';
import { FORM_HIP } from '../form';
import { RoundMeasurements } from '../../ui/allRoundShape';
import { knob } from './knob';

const TAU = Math.PI * 2;
const BUST_Y = -0.575;
const WAIST_Y = 0.1;

function perimeter(y: number): number {
  const n = 180;
  let P = 0;
  let px = 0;
  let pz = 0;
  for (let i = 0; i <= n; i++) {
    const a = (TAU * i) / n;
    const r = bodyHalf(y) * shapeAt(a, y);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (i) P += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return P;
}

export interface Space {
  /** Form height of a level in cm below the waist, and back. */
  yOf: (c: number) => number;
  cOf: (y: number) => number;
  /** cm per form unit across, at form height y. */
  scale: (y: number) => number;
  /** How far out the body's surface lies at angle a round it (0 ahead, pi/2 the wearer's left), at level c, in cm. */
  bodyR: (a: number, c: number) => number;
  /** The shoulder tip's level and how far out it lies, in cm. */
  tip: { c: number; x: number };
  arm: { r0: number; r1: number; a: [number, number, number]; b: [number, number, number] };
  /** The top of the shoulder at x cm out from the centre: its level (the form's shoulder, then on over the top of the
   *  arm, dropping gently past the tip, as a shoulder does). */
  ridge: (x: number) => number;
  /** Where a point x cm out at level c on the form's own shape stands on the wearer's shoulders (the form drawn the same). */
  widen: (x: number, c: number, z?: number) => number;
}

/** How much the body draws in from the form's last row to the knees (`overCm` below it): a share of its width there. */
const LEG_DRAW_IN = { overCm: 45, side: 0.22, front: 0.1 };

/** `widen`: the form drawn out to the wearer's shoulder width, for a garment with nothing on the arms (a strap, a
 *  sleeveless or wide neck rests on the wearer's own shoulder point). A sleeved garment hangs from the arm instead: its
 *  sleeve head sets the shoulder line, and on a widened form the shoulders stand square. */
export function makeSpace(yOfIn: (c: number) => number, m: RoundMeasurements & { upper_arm?: number; wrist?: number; arm_length?: number; shoulder_width?: number }, opts: { widen?: boolean } = {}): Space {
  const knots: [number, number][] = [
    [BUST_Y, (m.full_bust ?? 90) / perimeter(BUST_Y)],
    [WAIST_Y, (m.waist ?? 72) / perimeter(WAIST_Y)],
    [FORM_HIP, (m.full_hip ?? 98) / perimeter(FORM_HIP)],
  ];
  const scale = (y: number) => {
    if (y <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      if (y <= knots[i][0]) {
        const [y0, s0] = knots[i - 1];
        const [y1, s1] = knots[i];
        return s0 + ((s1 - s0) * (y - y0)) / (y1 - y0);
      }
    }
    return knots[knots.length - 1][1];
  };
  // Across, the form is the wearer's girths; up and down, its lines are placed at the wearer's lengths, measured
  // straight down. But a back's length is measured over its curve, nape to waist, and the form's back curves out over
  // the shoulder blades: read straight, its back is a few cm longer over the curve than the wearer's, and every
  // bodice drafted to their length hangs short on it. So above the waist the form's heights are drawn in until its
  // back, over its curve, is as long as theirs.
  const N = m.nape_to_waist ?? 41;
  const backArc = (K: number) => {
    let s = 0;
    let pr = 0;
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const c = -N * K * (1 - i / n);
      const y = Math.max(BODY_TOP, Math.min(BODY_BOTTOM, yOfIn(c / K)));
      const r = bodyHalf(y) * shapeAt(Math.PI, y) * scale(y);
      if (i) s += Math.hypot((N * K) / n, r - pr);
      pr = r;
    }
    return s;
  };
  let K = 1;
  if (!knob('__noLenFit')) {
    let lo = 0.8;
    let hi = 1;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (backArc(mid) > N) hi = mid;
      else lo = mid;
    }
    K = (lo + hi) / 2;
  }
  const yOf0 = (c: number) => (c < 0 ? yOfIn(c / K) : yOfIn(c));
  // The form's height table flattens above the neck point; the form is drawn with its height carried on straight up
  // from just below there, and the body the cloth lies on is read the same way, so the two agree at the neck.
  const cOf0 = (y: number) => {
    let lo = -80;
    let hi = 160;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (yOf0(mid) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const cTop = cOf0(-1.45) + 2;
  const slopeTop = (yOf0(cTop + 4) - yOf0(cTop)) / 4;
  const yOf = (c: number) => (c < cTop ? yOf0(cTop) + (c - cTop) * slopeTop : yOf0(c));
  const cOf = (y: number) => {
    let lo = -80;
    let hi = 160;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (yOf(mid) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // Tables down the body, read between their rows: the body is read many times a step.
  const C0 = -60;
  const C1 = 130;
  const DC = 0.5;
  const NR = Math.round((C1 - C0) / DC) + 1;
  const NA = 96;
  const tab = new Float32Array(NR * (NA + 1));
  // Below the form's last row the legs go on down, drawing in as they go: round both thighs to the knees, the
  // body is narrower than at the hip, more at the sides than front and back. A pencil skirt follows them in.
  const cBottom = cOf(BODY_BOTTOM);
  for (let r = 0; r < NR; r++) {
    const c = C0 + r * DC;
    const y = Math.max(BODY_TOP, Math.min(BODY_BOTTOM, yOf(c)));
    const s = scale(y);
    const h = bodyHalf(y);
    const u = Math.min(1, Math.max(0, (c - cBottom) / LEG_DRAW_IN.overCm));
    const legs = u * u * (3 - 2 * u);
    for (let k = 0; k <= NA; k++) {
      const a = (Math.PI * k) / NA;
      const side = Math.sin(a) ** 2;
      tab[r * (NA + 1) + k] = h * shapeAt(a, y) * s * (1 - legs * (LEG_DRAW_IN.front + (LEG_DRAW_IN.side - LEG_DRAW_IN.front) * side));
    }
  }
  // The form keeps stumps of its arms at the shoulders, wider than the chest under them. Cloth goes over the arm there
  // (a sleeve) or round the armhole inside it, never out over the stump: above the underarm the body is held to the
  // chest's own width.
  const tipC0 = cOf(SHOULDER_TIP_Y);
  const underC = tipC0 + 15;
  const rowOf = (c: number) => Math.round((c - C0) / DC);
  let cap = 0;
  for (let c = underC; c < underC + 6; c += DC) cap = Math.max(cap, tab[rowOf(c) * (NA + 1) + NA / 2]);
  for (let r = 0; r < NR; r++) {
    const c = C0 + r * DC;
    if (c >= underC) continue;
    for (let k = 0; k <= NA; k++) {
      const sa = Math.abs(Math.sin((Math.PI * k) / NA));
      const i = r * (NA + 1) + k;
      if (tab[i] * sa > cap) tab[i] = cap / sa;
    }
  }
  // The form's shoulders are a dress form's, narrower than the wearer's: above the underarm the body is drawn out to the
  // side, from the neck's edge out, so its shoulder point stands where the wearer's own does (half the measured width,
  // across the back's curve, as the bodice is drafted to). The neck and the chest below the underarm keep their shape.
  const tipC0w = tipC0;
  const tipX0 = (() => {
    const fr = (tipC0w - C0) / DC;
    const r = Math.round(fr);
    return tab[r * (NA + 1) + NA / 2];
  })();
  const NECK_X = 5.5;
  const wantTip = knob('__noWiden') || (opts.widen === false && !knob('__forceWiden')) ? tipX0 : Math.max(tipX0, ((m.shoulder_width ?? 38) / 2) * (knob('__widenK') ?? 0.94));
  const F = (wantTip - NECK_X) / Math.max(1, tipX0 - NECK_X);
  const widenAt = (c: number) => {
    // Full at the shoulder's top and above, gone a few cm down the armhole.
    const u = Math.min(1, Math.max(0, (c - tipC0w - 1) / ((knob('__widenDown') ?? 8) - 1)));
    // (And less up the slope toward the neck: the shoulder keeps falling from the neck to its point, not a level shelf
    // out to it.)
    const w = Math.min(1, Math.max(0, (tipC0w + 1 - c) / (knob('__widenUp') ?? 4)));
    const top = 1 - (knob('__widenTop') ?? 0.7) * w * w * (3 - 2 * w);
    return 1 + (F - 1) * (1 - u * u * (3 - 2 * u)) * top;
  };
  // Only the top of the shoulder goes out, where it runs to the arm: the chest and the back in front of and behind the
  // arm keep the form's width, so an armhole falls past the shoulder as it does round an arm.
  const ZW = knob('__widenZ') ?? 6;
  const widen = (x: number, c: number, z = 0) => {
    // (The form's arm stumps are drawn no wider than the body the cloth lies on: held to the chest's width, as above.)
    const ax = c < underC ? Math.min(Math.abs(x), cap) : Math.abs(x);
    if (ax !== Math.abs(x) && F === 1) return Math.sign(x) * ax;
    if (ax <= NECK_X || F === 1) return x;
    const v = Math.max(0, 1 - Math.abs(z) / ZW);
    const out = NECK_X + (ax - NECK_X) * (1 + (widenAt(c) - 1) * v * v * (3 - 2 * v));
    // (Never wider below the shoulder point than at it: the arm hangs from there, and a sleeve's head covers no more.)
    return Math.sign(x) * (c > tipC0w ? Math.min(out, Math.max(ax, wantTip)) : out);
  };
  if (F !== 1) {
    const xs = new Float64Array(NA + 1);
    const zs = new Float64Array(NA + 1);
    const as = new Float64Array(NA + 1);
    for (let r = 0; r < NR; r++) {
      const c = C0 + r * DC;
      if (widenAt(c) === 1) continue;
      for (let k = 0; k <= NA; k++) {
        const a = (Math.PI * k) / NA;
        const R = tab[r * (NA + 1) + k];
        xs[k] = widen(Math.sin(a) * R, c, Math.cos(a) * R);
        zs[k] = Math.cos(a) * R;
        as[k] = Math.atan2(xs[k], zs[k]);
      }
      let j = 0;
      for (let k = 0; k <= NA; k++) {
        const a = (Math.PI * k) / NA;
        while (j < NA - 1 && as[j + 1] < a) j++;
        const t = Math.min(1, Math.max(0, (a - as[j]) / (as[j + 1] - as[j] || 1e-9)));
        tab[r * (NA + 1) + k] = Math.hypot(xs[j] + (xs[j + 1] - xs[j]) * t, zs[j] + (zs[j + 1] - zs[j]) * t);
      }
    }
  }
  // A dress form's shoulders run out nearly level; a wearer's fall from the neck to the shoulder point. Out along the
  // shoulder the form is drawn lower by that fall, growing toward the point (each height takes the shape the form has
  // that much higher up), and fading out a few cm down the armhole.
  const DROP = knob('__shDrop') ?? 0;
  if (DROP > 0) {
    const src = Float64Array.from(tab);
    const span = Math.max(1, wantTip - NECK_X);
    const lastR = Math.min(NR - 1, Math.ceil((tipC0w + 2 + (knob('__shDropDown') ?? 6) - C0) / DC));
    for (let k = 0; k <= NA; k++) {
      const a = (Math.PI * k) / NA;
      const sa = Math.abs(Math.sin(a));
      const ca = Math.cos(a);
      // (The height the form's top reaches out to each distance from its axis, at this angle, from the top down.)
      const topC = (rho: number) => {
        for (let r = 0; r <= lastR; r++) if (src[r * (NA + 1) + k] >= rho) return C0 + r * DC;
        return Infinity;
      };
      const fall = (rho: number, c: number) => {
        const t = Math.min(1, Math.max(0, (rho * sa - NECK_X) / span));
        const v = Math.max(0, 1 - Math.abs(rho * ca) / ZW);
        const below = Math.min(1, Math.max(0, (c - tipC0w - 2) / (knob('__shDropDown') ?? 6)));
        return DROP * t * t * v * v * (3 - 2 * v) * (1 - below * below * (3 - 2 * below));
      };
      for (let r = 0; r <= lastR; r++) {
        const c = C0 + r * DC;
        const R = src[r * (NA + 1) + k];
        if (fall(R, c) <= 0) continue;
        let lo = 0;
        let hi = R;
        for (let it = 0; it < 24; it++) {
          const mid = (lo + hi) / 2;
          if (topC(mid) + fall(mid, c) <= c) lo = mid;
          else hi = mid;
        }
        tab[r * (NA + 1) + k] = lo;
      }
    }
  }
  const bodyR = (a: number, c: number) => {
    const fr = Math.max(0, Math.min(NR - 1.001, (c - C0) / DC));
    const r = Math.floor(fr);
    const u = fr - r;
    const t = (Math.abs(a >= -Math.PI && a <= Math.PI ? a : Math.atan2(Math.sin(a), Math.cos(a))) / Math.PI) * NA;
    const k = Math.min(NA - 1, Math.floor(t));
    const v = t - k;
    const i0 = r * (NA + 1) + k;
    const i1 = i0 + NA + 1;
    return (tab[i0] * (1 - v) + tab[i0 + 1] * v) * (1 - u) + (tab[i1] * (1 - v) + tab[i1 + 1] * v) * u;
  };
  const tipC = tipC0 + DROP;
  const tipX = bodyR(Math.PI / 2, tipC);
  const r0 = (m.upper_arm ?? 27) / TAU;
  const r1 = (m.wrist ?? 16) / TAU;
  const L = (m.arm_length ?? 60) - 4;
  // The arm hangs from the shoulder tip, a little out and forward. It holds only the sleeves: the body's own cloth
  // lies on the body, and the arm (pressed to the side of the chest, as an arm is) never pushes it in.
  // The form's shoulders are a dress form's, narrower than the wearer's: the arm hangs from the wearer's own shoulder.
  // (And pressed to the side of the chest, not sunk into it: a fitted sleeve's underarm hangs where an armpit is.)
  const a: [number, number, number] = [Math.max(tipX0 + 0.5, (m.shoulder_width ?? 38) / 2 - r0 * 0.8, cap + r0 * (knob('__armOut') ?? 0)), tipC + r0 * (knob('__armUp') ?? 1.1), 0];
  const lean = 0.08;
  const b: [number, number, number] = [a[0] + L * lean, a[1] + L, 1.5];
  const ridgeTab: number[] = [];
  for (let k = 0; k <= 60; k++) {
    const x = (k * tipX) / 60;
    let c = C0;
    while (c < tipC + 10 && bodyR(Math.PI / 2, c) < x) c += 0.1;
    ridgeTab.push(c);
  }
  const ridge = (x: number) => {
    if (x >= tipX) return tipC + (x - tipX) * 0.35;
    const f = (Math.max(0, x) / tipX) * 60;
    const k = Math.min(59, Math.floor(f));
    return ridgeTab[k] + (ridgeTab[k + 1] - ridgeTab[k]) * (f - k);
  };
  return { yOf, cOf, scale, bodyR, tip: { c: tipC, x: tipX }, arm: { r0, r1, a, b }, ridge, widen };
}

/** The same body for cloth cut boxy: below the bust the cloth falls straight to the hip instead of following the body
 *  in under the bust and round the waist, so the space between bust and hip is filled to the straight line between them. */
export function boxed(s: Space): Space {
  const bC = s.cOf(BUST_Y);
  const hC = s.cOf(FORM_HIP);
  return {
    ...s,
    bodyR: (a, c) => {
      const r = s.bodyR(a, c);
      if (c <= bC || c >= hC) return r;
      const u = (c - bC) / (hC - bC);
      return Math.max(r, s.bodyR(a, bC) * (1 - u) + s.bodyR(a, hC) * u);
    },
  };
}
