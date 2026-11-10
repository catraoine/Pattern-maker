// Unusual bodies for the drafting tests (Cat, Nov 10, 2026: "yes tests"): real people at the far edges of what the app
// takes in, where the random bodies in randomBodies.ts rarely go. Each one is built the way randomBody builds a body
// (the frame grows with height and bust, the neck and armhole with the bust), with the random parts held at their middle,
// then pushed to one edge: a long or short back, a big gap between waist and hip, a waist bigger than the hip, very small,
// very large, tall and slim, petite and full, a big cup. Every body stays inside the ranges the measuring pages accept
// without an error, so each one is a body a maker can actually enter (unusualBodies.test.ts checks that first).
import type { MeasurementValues } from '../measurements';

interface BodyShape {
  height: number;
  bust: number;
  /** Full bust minus high bust. */
  cup: number;
  waist: number;
  hip: number;
  /** Back length (nape to waist) as a share of the height: most bodies 0.23 to 0.27, the app takes 0.2 to 0.3. */
  back?: number;
  /** Waist to hip, cm. */
  waistToHip?: number;
  /** Waist to floor as a share of the height: most bodies about 0.615, the app takes 0.55 to 0.68. */
  legs?: number;
}

/** A whole set of measurements, arms and crotch included, for one body shape. */
function shapedBody(s: BodyShape): MeasurementValues {
  const { height: h, bust, cup, waist, hip } = s;
  const nw = h * (s.back ?? 0.25);
  const wf = h * (s.legs ?? 0.615);
  const ab = 30 + (h - 148) * 0.08 + (bust - cup - 76) * 0.18;
  const sw = ab + 3.2;
  const neck = 30 + (bust - 76) * 0.11;
  const wh = s.waistToHip ?? Math.min(26, Math.max(15, h * 0.12));
  const knee = wf * (0.345 / 0.615);
  const depth = Math.min(Math.max(wh + 5, h * 0.155 + (hip - 90) * 0.05), knee - 14);
  const armscye = 35 + (bust - 76) * 0.3;
  const upper = armscye * 0.7;
  return {
    height: h,
    full_bust: bust,
    high_bust: bust - cup,
    waist,
    full_hip: hip,
    neck,
    shoulder_width: sw,
    shoulder_length: (sw / 2 - neck / 5 + 0.2) / Math.cos((20 * Math.PI) / 180),
    across_back: ab,
    across_front: ab - 2,
    nape_to_waist: nw,
    front_hps_to_waist: nw + 2.5 + cup * 0.4,
    bust_depth: h * 0.15 + cup * 0.3,
    apex_separation: 15 + (bust - 76) * 0.1,
    armscye,
    waist_to_hip: wh,
    waist_to_knee: knee,
    waist_to_floor: wf,
    crotch_depth: depth,
    // Kept inside the share of the hip the measuring pages expect (0.56 to 0.84), so no body is turned back for it.
    crotch_length: Math.min(hip * 0.8, Math.max(hip * 0.6, 2 * depth + hip * 0.17)),
    arm_length: nw * 1.4,
    upper_arm: upper,
    wrist: Math.max(upper * 0.35, 13.5 + (bust - 76) * 0.05),
  };
}

/** The unusual bodies, by name. Changing one changes what the tests hold the patterns to, so add rather than edit. */
export const UNUSUAL_BODIES: Record<string, MeasurementValues> = {
  'long back, short legs': shapedBody({ height: 160, bust: 92, cup: 4, waist: 74, hip: 98, back: 0.285, legs: 0.57 }),
  'short back, long legs': shapedBody({ height: 172, bust: 88, cup: 3, waist: 68, hip: 94, back: 0.21, legs: 0.665 }),
  'small waist, full hip': shapedBody({ height: 165, bust: 90, cup: 4, waist: 62, hip: 122 }),
  'waist bigger than hip': shapedBody({ height: 168, bust: 118, cup: 4, waist: 116, hip: 108 }),
  'very small': shapedBody({ height: 148, bust: 76, cup: 2, waist: 58, hip: 82 }),
  'very large': shapedBody({ height: 172, bust: 145, cup: 8, waist: 128, hip: 158 }),
  'tall and slim': shapedBody({ height: 192, bust: 80, cup: 1.5, waist: 64, hip: 88 }),
  'petite and full': shapedBody({ height: 150, bust: 126, cup: 8, waist: 104, hip: 136 }),
  'big cup, small frame': shapedBody({ height: 160, bust: 104, cup: 14, waist: 70, hip: 96 }),
  'long waist to hip': shapedBody({ height: 170, bust: 94, cup: 4, waist: 76, hip: 104, waistToHip: 29 }),
  'short waist to hip': shapedBody({ height: 158, bust: 90, cup: 3, waist: 72, hip: 96, waistToHip: 13 }),
};
