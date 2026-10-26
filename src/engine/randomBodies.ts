// Random but realistic adult bodies for stress-testing the drafting engine.
import { BodiceMeasurements } from './bodice';
import { SkirtMeasurements } from './skirt';

/** Small seeded PRNG (mulberry32) so failures reproduce. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Body = BodiceMeasurements & SkirtMeasurements;

/** A random adult body. Measurements are linked the way bodies are (taller people have longer
 * backs, bigger busts have bigger necks and armholes) and stay inside the typical ranges of
 * measurements/measurements.json. */
export function randomBody(r: () => number): Body {
  const u = (lo: number, hi: number) => lo + (hi - lo) * r();
  const h = u(148, 190);
  const bust = u(76, 145);
  const cup = u(1, 4) + Math.max(0, bust - 85) * u(0, 0.15);
  const waist = bust * u(0.66, 0.97);
  const hip = Math.max(waist + u(1, 6), bust * u(0.93, 1.25));
  // Frame widths grow with the high bust about as fast as in Aldrich's size tables (across back
  // 32.4 cm at size 8 to 38.4 cm at size 20).
  const ab = 30 + (h - 148) * 0.08 + (bust - cup - 76) * 0.18 + u(-1.2, 1.2);
  const sw = ab + u(2, 4.5);
  const nw = h * 0.25 + u(-2, 2);
  const neck = 30 + (bust - 76) * 0.11 + u(-1.5, 1.5);
  return {
    full_bust: bust,
    high_bust: bust - cup,
    waist,
    full_hip: hip,
    neck,
    shoulder_width: sw,
    // Half the shoulder width is the neck width plus the shoulder length run at a ~20 degree slope.
    shoulder_length: (sw / 2 - neck / 5 + 0.2) / Math.cos((20 * Math.PI) / 180) + u(-0.8, 0.8),
    across_back: ab,
    across_front: ab - u(1, 3),
    nape_to_waist: nw,
    front_hps_to_waist: nw + 1.5 + cup * 0.4 + u(0, 2),
    bust_depth: h * 0.15 + cup * 0.3 + u(-1, 1),
    apex_separation: 15 + (bust - 76) * 0.1 + u(-1.5, 1.5),
    armscye: 35 + (bust - 76) * 0.3 + u(-2, 2),
    waist_to_hip: u(15, 26),
    waist_to_knee: h * 0.345 + u(-2, 2),
    waist_to_floor: h * 0.615 + u(-2, 2),
  };
}

/** Arms to go with a body: upper arm with the armhole, arm length with the back length. */
export function randomArms(b: Body, r: () => number): { arm_length: number; upper_arm: number; wrist: number } {
  const u = (lo: number, hi: number) => lo + (hi - lo) * r();
  return {
    arm_length: b.nape_to_waist * 1.4 + u(-3, 3),
    upper_arm: (b.armscye ?? 40) * 0.7 + u(-2.5, 2.5),
    wrist: 13.5 + (b.full_bust - 76) * 0.05 + u(-1, 1),
  };
}

/** Crotch measurements to go with a body: depth with height and hip, length about twice the depth plus a sixth of the hip. */
export function randomCrotch(b: Body, r: () => number): { crotch_depth: number; crotch_length: number } {
  const u = (lo: number, hi: number) => lo + (hi - lo) * r();
  const depth = Math.max(b.waist_to_hip + u(3, 8), (b.waist_to_floor / 0.615) * 0.155 + (b.full_hip - 90) * 0.05 + u(-1.5, 1.5));
  return { crotch_depth: Math.min(depth, b.waist_to_knee - 14), crotch_length: 2 * Math.min(depth, b.waist_to_knee - 14) + b.full_hip * 0.17 + u(-3, 3) };
}

/** How many random bodies a sweep test runs: a fifth (at least 3) on every run, all of them with SWEEP=full, which
 *  the tests workflow runs on every pull request in its own job. Keeps `npm test` to a couple of minutes. */
export const FULL_SWEEP = typeof process !== 'undefined' && process.env.SWEEP === 'full';
export const sweep = (n: number) => (FULL_SWEEP ? n : Math.max(3, Math.ceil(n / 5)));
