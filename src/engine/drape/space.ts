// The body the cloth is sewn onto, in true cm: the form's own shape (engine/body.ts) scaled ring by ring to the wearer's
// girths, its heights in cm below the waist placed on the form's lines (placeOnForm). The cloth is laid in this space,
// where a cm is a cm every way, and drawn back on the form after. X runs to the wearer's left, C down from the
// waist, Z forward.
import { BODY_BOTTOM, BODY_TOP, SHOULDER_TIP_Y, bodyHalf, shapeAt } from '../body';
import { FORM_HIP } from '../../ui/ContourForm';
import { RoundMeasurements } from '../../ui/allRoundShape';

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
}

export function makeSpace(yOf: (c: number) => number, m: RoundMeasurements & { upper_arm?: number; wrist?: number; arm_length?: number; shoulder_width?: number }): Space {
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
  for (let r = 0; r < NR; r++) {
    const c = C0 + r * DC;
    const y = Math.max(BODY_TOP, Math.min(BODY_BOTTOM, yOf(c)));
    const s = scale(y);
    const h = bodyHalf(y);
    for (let k = 0; k <= NA; k++) tab[r * (NA + 1) + k] = h * shapeAt((Math.PI * k) / NA, y) * s;
  }
  const bodyR = (a: number, c: number) => {
    const fr = Math.max(0, Math.min(NR - 1.001, (c - C0) / DC));
    const r = Math.floor(fr);
    const u = fr - r;
    const t = (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / Math.PI) * NA;
    const k = Math.min(NA - 1, Math.floor(t));
    const v = t - k;
    const row = (rr: number) => tab[rr * (NA + 1) + k] * (1 - v) + tab[rr * (NA + 1) + k + 1] * v;
    return row(r) * (1 - u) + row(r + 1) * u;
  };
  const tipC = cOf(SHOULDER_TIP_Y);
  const tipX = bodyR(Math.PI / 2, tipC);
  const r0 = (m.upper_arm ?? 27) / TAU;
  const r1 = (m.wrist ?? 16) / TAU;
  const L = (m.arm_length ?? 60) - 4;
  // The arm hangs from the shoulder tip, a little out and forward. It holds only the sleeves: the body's own cloth
  // lies on the body, and the arm (pressed to the side of the chest, as an arm is) never pushes it in.
  // The form's shoulders are a dress form's, narrower than the wearer's: the arm hangs from the wearer's own shoulder.
  const a: [number, number, number] = [Math.max(tipX + 0.5, (m.shoulder_width ?? 38) / 2 - r0 * 0.8), tipC + r0 * 1.1, 0];
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
  return { yOf, cOf, scale, bodyR, tip: { c: tipC, x: tipX }, arm: { r0, r1, a, b }, ridge };
}
