// Body measurements for each garment, with ranges from the measurements spec (measurements/measurements.json).
import type { SkirtMeasurements } from './engine/skirt';
import type { BodiceMeasurements } from './engine/bodice';
import type { SleeveMeasurements } from './engine/sleeve';
import type { TrousersMeasurements } from './engine/trousers';

export type Garment = 'skirt' | 'bodice' | 'dress' | 'trousers' | 'jacket' | 'coat';

export type MeasurementId = keyof SkirtMeasurements | keyof BodiceMeasurements | keyof SleeveMeasurements | keyof TrousersMeasurements;

export interface MeasurementField {
  id: MeasurementId;
  label: string;
  hard: [number, number]; // cm; outside this is an error
  typical: [number, number]; // cm; outside this is a warning
  tip: string;
  /** Only needed for some styles; the app says which. */
  optional?: string;
  /** Easier with someone else holding the tape. */
  helper?: boolean;
  /** Posture measurements for a closer fit, listed after the rest under their own heading. */
  fit?: boolean;
}

const WAIST: MeasurementField = {
  id: 'waist',
  label: 'Waist',
  hard: [45, 200],
  typical: [55, 145],
  tip: 'Around your natural waist, the narrowest part of your torso. Bend to one side; the crease that forms is your waist.',
};

const FULL_HIP: MeasurementField = {
  id: 'full_hip',
  label: 'Full hip',
  hard: [60, 220],
  typical: [80, 160],
  tip: 'Around the fullest part of your seat, keeping the tape level. Check from the side in a mirror.',
};

const WAIST_TO_HIP: MeasurementField = {
  id: 'waist_to_hip',
  label: 'Waist to hip',
  hard: [10, 35],
  typical: [15, 26],
  tip: 'Down your side, from your waist to the fullest part of your hip.',
};

const CLOSER = 'For a closer fit.';

const FRONT_WAIST_TO_HIP: MeasurementField = {
  id: 'front_waist_to_hip',
  label: 'Front waist to hip',
  hard: [8, 38],
  typical: [14, 28],
  optional: CLOSER,
  fit: true,
  tip: 'Down the centre front, from your waist to the level of your full hip. Hold a ruler level across your front at hip height and measure to it. Longer than your side means a rounder tummy, and the skirt is raised at the front to hang level.',
};

const BACK_WAIST_TO_HIP: MeasurementField = {
  id: 'back_waist_to_hip',
  label: 'Back waist to hip',
  hard: [8, 38],
  typical: [13, 27],
  optional: CLOSER,
  fit: true,
  helper: true,
  tip: 'Down the centre back, from your waist to the level of your full hip. Shorter than your side means a sway back, longer means a full seat; the back waist is lowered or raised to match.',
};

export const SKIRT_FIELDS: MeasurementField[] = [
  WAIST,
  FULL_HIP,
  WAIST_TO_HIP,
  {
    id: 'waist_to_knee',
    label: 'Waist to knee',
    hard: [40, 75],
    typical: [50, 65],
    tip: 'Down your side, from your waist to the middle of your knee.',
  },
  {
    id: 'waist_to_floor',
    label: 'Waist to floor',
    hard: [70, 150],
    typical: [90, 120],
    tip: 'Down your side, from your waist to the floor, standing barefoot.',
  },
  FRONT_WAIST_TO_HIP,
  BACK_WAIST_TO_HIP,
];

/** Trousers take the skirt's measurements and two more for the crotch. */
export const TROUSERS_FIELDS: MeasurementField[] = [
  ...SKIRT_FIELDS.filter((f) => !f.fit),
  {
    id: 'crotch_depth',
    label: 'Crotch depth',
    hard: [15, 45],
    typical: [21, 36],
    tip: 'Sit up straight on a hard, flat chair. Measure down your side from your waist to the seat of the chair, holding a ruler upright against your hip.',
  },
  {
    id: 'crotch_length',
    label: 'Crotch length',
    hard: [45, 115],
    typical: [56, 95],
    helper: true,
    tip: 'From your centre front waist, down between your legs, and up to your centre back waist. Hold the tape snug but not tight, as you would want the seam to sit.',
  },
  ...SKIRT_FIELDS.filter((f) => f.fit),
];

const HIP_NOTE = 'Only needed for tops that reach below the waist.';
const ARM_NOTE = 'Only needed for sleeves.';

export const BODICE_FIELDS: MeasurementField[] = [
  {
    id: 'full_bust',
    label: 'Full bust',
    hard: [60, 200],
    typical: [75, 150],
    tip: 'Around the fullest part of your bust, keeping the tape level all the way round, across your back too.',
  },
  {
    id: 'high_bust',
    label: 'High bust',
    hard: [60, 190],
    typical: [72, 140],
    tip: 'Up under your arms, above the bust and across your shoulder blades. The difference from your full bust sizes the bust darts.',
  },
  WAIST,
  {
    id: 'neck',
    label: 'Neck',
    hard: [25, 60],
    typical: [30, 48],
    tip: 'Around the base of your neck, where it meets your shoulders, over the bump at the back of your neck.',
  },
  {
    id: 'shoulder_width',
    label: 'Shoulder width',
    hard: [25, 60],
    typical: [33, 50],
    helper: true,
    tip: 'Across your back, from one shoulder point to the other. To find the shoulder point, lift your arm sideways: it is the dip that appears at the end of the shoulder bone.',
  },
  {
    id: 'shoulder_length',
    label: 'Shoulder length',
    hard: [7, 22],
    typical: [10, 17],
    tip: 'Along the top of one shoulder, from the side of your neck (where a t-shirt seam sits) to the shoulder point.',
  },
  {
    id: 'across_back',
    label: 'Across back',
    hard: [25, 55],
    typical: [30, 45],
    helper: true,
    tip: 'Across your back between the creases where your arms meet your body, about 12 cm below the bone at the back of your neck.',
  },
  {
    id: 'across_front',
    label: 'Across front',
    hard: [24, 55],
    typical: [28, 43],
    tip: 'Across your chest between the creases where your arms meet your body, about 8 cm below the base of your neck, above the bust.',
  },
  {
    id: 'nape_to_waist',
    label: 'Back length',
    hard: [28, 60],
    typical: [35, 50],
    helper: true,
    tip: 'Straight down your spine, from the bone at the back of your neck (bow your head to find it) to your waist.',
  },
  {
    id: 'front_hps_to_waist',
    label: 'Front length',
    hard: [30, 70],
    typical: [38, 58],
    tip: 'From the side of your neck, down over the fullest point of your bust, to your waist.',
  },
  {
    id: 'bust_depth',
    label: 'Bust depth',
    hard: [15, 45],
    typical: [20, 34],
    tip: 'From the side of your neck down to your bust point, the fullest point of your bust.',
  },
  {
    id: 'apex_separation',
    label: 'Bust point to bust point',
    hard: [10, 32],
    typical: [15, 24],
    tip: 'Straight across, from one bust point to the other.',
  },
  {
    id: 'armscye',
    label: 'Armhole',
    hard: [28, 75],
    typical: [34, 56],
    tip: 'Around your arm where it joins your body: up under the armpit and over the shoulder point. Keep your arm relaxed by your side.',
  },
  { ...FULL_HIP, optional: HIP_NOTE },
  { ...WAIST_TO_HIP, optional: HIP_NOTE },
  {
    id: 'arm_length',
    label: 'Arm length',
    hard: [40, 80],
    typical: [50, 68],
    optional: ARM_NOTE,
    helper: true,
    tip: 'From your shoulder point, down the outside of your arm over a slightly bent elbow, to the bone at your wrist.',
  },
  {
    id: 'upper_arm',
    label: 'Upper arm',
    hard: [18, 60],
    typical: [22, 45],
    optional: ARM_NOTE,
    tip: 'Around the fullest part of your upper arm, with your arm relaxed by your side.',
  },
  {
    id: 'wrist',
    label: 'Wrist',
    hard: [11, 26],
    typical: [13, 20],
    optional: ARM_NOTE,
    tip: 'Around your wrist, over the wrist bone.',
  },
  {
    id: 'front_shoulder_slope',
    label: 'Front shoulder slope',
    hard: [28, 70],
    typical: [35, 58],
    optional: CLOSER,
    fit: true,
    tip: 'From the middle of your waist at the front, diagonally up over your chest to your shoulder point. Square shoulders give a longer measurement, sloping shoulders a shorter one; the shoulder seam is angled to match.',
  },
  {
    id: 'back_shoulder_slope',
    label: 'Back shoulder slope',
    hard: [28, 70],
    typical: [35, 58],
    optional: CLOSER,
    fit: true,
    helper: true,
    tip: 'From the middle of your waist at the back, diagonally up across your back to your shoulder point.',
  },
];

/** A dress takes the bodice's measurements and the skirt's lengths. */
const DRESS_FIELDS: MeasurementField[] = [...BODICE_FIELDS, ...SKIRT_FIELDS.filter((f) => !BODICE_FIELDS.some((b) => b.id === f.id))].map((f) =>
  // The dress skirt needs the hip, which the bodice only asks for below the waist.
  f.id === 'full_hip' || f.id === 'waist_to_hip' ? { ...f, optional: undefined } : f,
);

/** A jacket takes the bodice's measurements with the hip (it reaches below the waist) and the arms (it
 * always has sleeves); a coat also the knee, for its length. */
const OUTER_NEEDS: MeasurementId[] = ['full_hip', 'waist_to_hip', 'arm_length', 'upper_arm'];
const JACKET_FIELDS: MeasurementField[] = BODICE_FIELDS.map((f) => (OUTER_NEEDS.includes(f.id) ? { ...f, optional: undefined } : f));
const COAT_FIELDS: MeasurementField[] = [
  ...JACKET_FIELDS.filter((f) => !f.fit),
  ...SKIRT_FIELDS.filter((f) => f.id === 'waist_to_knee'),
  ...JACKET_FIELDS.filter((f) => f.fit),
];

export const FIELDS: Record<Garment, MeasurementField[]> = { skirt: SKIRT_FIELDS, bodice: BODICE_FIELDS, dress: DRESS_FIELDS, trousers: TROUSERS_FIELDS, jacket: JACKET_FIELDS, coat: COAT_FIELDS };

export type Unit = 'cm' | 'in';
export type MeasurementValues = Partial<Record<MeasurementId, number>>; // always stored in cm

export const EXAMPLE_VALUES: MeasurementValues = {
  waist: 76,
  full_hip: 102,
  waist_to_hip: 20.5,
  waist_to_knee: 58,
  waist_to_floor: 104,
  crotch_depth: 27,
  crotch_length: 70,
  // Sample body A from the measurements thread, with the same waist.
  full_bust: 92,
  high_bust: 86,
  neck: 35,
  shoulder_width: 38,
  shoulder_length: 12,
  across_back: 35,
  across_front: 32,
  nape_to_waist: 41,
  front_hps_to_waist: 44,
  bust_depth: 26,
  apex_separation: 18,
  armscye: 40,
  arm_length: 59,
  upper_arm: 29,
  wrist: 16,
};

export interface Check {
  id: MeasurementId;
  level: 'error' | 'warning';
  message: string;
}

const fmt = (cm: number, unit: Unit) => (unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);

const has = (v: MeasurementValues, id: MeasurementId) => typeof v[id] === 'number' && !Number.isNaN(v[id]);

export function checkMeasurements(v: MeasurementValues, unit: Unit, garment: Garment = 'skirt'): Check[] {
  const out: Check[] = [];
  for (const f of FIELDS[garment]) {
    const x = v[f.id];
    if (x === undefined || Number.isNaN(x)) {
      if (!f.optional) out.push({ id: f.id, level: 'error', message: `${f.label} is needed.` });
    } else if (x < f.hard[0] || x > f.hard[1]) {
      out.push({
        id: f.id,
        level: 'error',
        message: `${f.label} should be between ${fmt(f.hard[0], unit)} and ${fmt(f.hard[1], unit)}. Is the unit right?`,
      });
    } else if (x < f.typical[0] || x > f.typical[1]) {
      out.push({ id: f.id, level: 'warning', message: `${f.label} is unusual. It's fine if it's right, but please double-check it.` });
    }
  }
  const { waist, full_hip, waist_to_hip, waist_to_knee, waist_to_floor } = v;
  const asked = new Set(FIELDS[garment].map((f) => f.id));
  // Measurements checked against each other, after each has passed on its own.
  const crossed = () => {
    for (const c of crossChecks(v)) if (asked.has(c.id) && asked.has(c.with) && !out.some((o) => o.id === c.id)) out.push({ id: c.id, level: 'warning', message: c.message });
  };
  if (garment !== 'bodice') {
    if (waist && full_hip && waist > full_hip) {
      out.push({
        id: 'waist',
        level: 'warning',
        message: "Your waist is larger than your hip. That's right for some bodies, but this skirt block can't draft it yet.",
      });
    }
    if (waist_to_knee && waist_to_floor && waist_to_knee >= waist_to_floor) {
      out.push({ id: 'waist_to_knee', level: 'error', message: 'Waist to knee should be shorter than waist to floor. Are they swapped?' });
    }
    if (waist_to_hip && waist_to_knee && waist_to_hip >= waist_to_knee) {
      out.push({ id: 'waist_to_hip', level: 'error', message: 'Waist to hip should be shorter than waist to knee.' });
    }
    // The centre measurements usually sit within a few cm of the side; beyond 4 cm the draft stops
    // following them, so say so.
    for (const id of ['front_waist_to_hip', 'back_waist_to_hip'] as const) {
      const c = v[id];
      if (c && waist_to_hip && Math.abs(c - waist_to_hip) > 4) {
        out.push({ id, level: 'warning', message: `This is more than 4 cm from your waist to hip at the side. Please check both; the pattern adjusts by 4 cm at most.` });
      }
    }
    const { crotch_depth } = v;
    if (crotch_depth && waist_to_hip && crotch_depth <= waist_to_hip) {
      out.push({ id: 'crotch_depth', level: 'warning', message: 'Crotch depth is usually a few cm longer than waist to hip. Measure it seated, from the waist down to the chair.' });
    }
    if (crotch_depth && waist_to_knee && crotch_depth >= waist_to_knee - 12) {
      out.push({ id: 'crotch_depth', level: 'error', message: 'Crotch depth looks long next to waist to knee. Measure it seated, from the waist down to the chair.' });
    }
    if (garment === 'skirt' || garment === 'trousers') {
      crossed();
      return out;
    }
  }
  const { full_bust, high_bust, shoulder_width, across_back, front_hps_to_waist, bust_depth } = v;
  if (full_bust && high_bust && high_bust > full_bust + 2) {
    out.push({ id: 'high_bust', level: 'warning', message: 'High bust is usually the same as or smaller than full bust. Are they swapped?' });
  } else if (full_bust && high_bust && full_bust - high_bust > 20) {
    out.push({ id: 'high_bust', level: 'warning', message: 'Full bust is a lot bigger than high bust. Please check both.' });
  }
  if (bust_depth && front_hps_to_waist && bust_depth >= front_hps_to_waist) {
    out.push({ id: 'bust_depth', level: 'error', message: 'Bust depth should be shorter than front length, which carries on down to the waist.' });
  }
  const { nape_to_waist, front_shoulder_slope, back_shoulder_slope } = v;
  if (back_shoulder_slope && nape_to_waist && back_shoulder_slope <= nape_to_waist) {
    out.push({ id: 'back_shoulder_slope', level: 'warning', message: 'Back shoulder slope runs diagonally, so it is usually longer than your back length. Please check both.' });
  }
  if (front_shoulder_slope && front_hps_to_waist && front_shoulder_slope >= front_hps_to_waist + 4) {
    out.push({ id: 'front_shoulder_slope', level: 'warning', message: 'Front shoulder slope is usually about the same as your front length or a little shorter. Please check both.' });
  }
  if (shoulder_width && across_back && across_back > shoulder_width) {
    out.push({ id: 'across_back', level: 'warning', message: 'Across back is usually narrower than shoulder width. Please check both.' });
  }
  crossed();
  return out;
}

interface CrossCheck {
  /** The measurement most likely to be off, and the one it was checked against. */
  id: MeasurementId;
  with: MeasurementId;
  message: string;
}

/**
 * Measurements checked against each other, the way a pattern cutter glances down a measurement
 * sheet: bodies vary a lot, but some proportions hold for nearly everyone, and one far outside them
 * is usually a slipped tape, a misread number or two measurements swapped. Each names the one most
 * often taken wrong, with how to take it again. Warnings only: an unusual body is still drafted.
 */
export function crossChecks(v: MeasurementValues): CrossCheck[] {
  const out: CrossCheck[] = [];
  const ratio = (a: MeasurementId, b: MeasurementId, lo: number, hi: number, low: string, high: string) => {
    const x = v[a];
    const y = v[b];
    if (!x || !y) return;
    if (x / y < lo) out.push({ id: a, with: b, message: low });
    else if (x / y > hi) out.push({ id: a, with: b, message: high });
  };
  ratio('armscye', 'full_bust', 0.34, 0.55,
    'Your armhole looks small for your bust. Measure round the top of your arm through the armpit, with the tape snug but not tight.',
    'Your armhole looks large for your bust. Keep the tape close up in the armpit and snug, not loose over the shoulder.');
  ratio('neck', 'full_bust', 0.22, 0.45,
    'Your neck looks small for your bust. Measure round the base of the neck, where a necklace sits, not round the throat.',
    'Your neck looks large for your bust. Measure round the base of the neck with the tape flat, not over a collar.');
  ratio('apex_separation', 'full_bust', 0.11, 0.26,
    'Bust point to bust point looks narrow for your bust. Measure straight across between the fullest points, in the bra you will wear.',
    'Bust point to bust point looks wide for your bust. Measure straight across between the fullest points, not round the curve.');
  ratio('shoulder_length', 'shoulder_width', 0.2, 0.42,
    'Your shoulder length looks short next to your shoulder width. It runs from the side of the neck to the shoulder point, on one side only.',
    'Your shoulder length looks long next to your shoulder width. It is one shoulder only, from the side of the neck to the shoulder bone.');
  ratio('bust_depth', 'front_hps_to_waist', 0.42, 0.78,
    'Bust depth looks short next to your front length. Measure from the side of the neck down to the fullest point of the bust.',
    'Bust depth looks long next to your front length. It stops at the bust point; front length carries on to the waist.');
  ratio('waist_to_knee', 'waist_to_floor', 0.47, 0.65,
    'Waist to knee looks short next to waist to floor. Measure down the side to the middle of the knee, standing straight.',
    'Waist to knee looks long next to waist to floor. Measure to the middle of the knee, and to the floor in bare feet.');
  ratio('crotch_length', 'crotch_depth', 2.1, 3.3,
    'Crotch length looks short next to your crotch depth. Take the tape from the centre front waist right through between the legs to the centre back waist.',
    'Crotch length looks long next to your crotch depth. Keep the tape snug between the legs, and stop at the waist front and back.');
  ratio('full_hip', 'full_bust', 0.8, 1.4,
    'Your hip looks small next to your bust. Measure round the fullest part of the seat, usually about 20 cm below the waist.',
    'Your hip looks large next to your bust. Keep the tape level all the way round, at the fullest part of the seat.');
  ratio('arm_length', 'nape_to_waist', 1.15, 1.75,
    'Arm length looks short next to your back length. Measure from the shoulder bone over a slightly bent elbow to the wrist bone.',
    'Arm length looks long next to your back length. It ends at the wrist bone, not the knuckles.');
  ratio('upper_arm', 'armscye', 0.5, 0.95,
    'Your upper arm looks small next to your armhole. Measure round the fullest part of the arm, between shoulder and elbow, arm relaxed.',
    'Your upper arm looks as big as your armhole, which is rare. Measure round the arm, not round the shoulder.');
  ratio('wrist', 'upper_arm', 0.3, 0.8,
    'Your wrist looks small next to your upper arm. Measure round the wrist bone, the tape just touching.',
    'Your wrist looks large next to your upper arm. Measure round the wrist bone, not the forearm.');
  const { across_front, across_back, front_hps_to_waist, nape_to_waist, high_hip, waist, full_hip } = v;
  if (across_front && across_back && across_front > across_back + 4)
    out.push({ id: 'across_front', with: 'across_back', message: 'Across front is usually a little narrower than across back. Measure it higher, halfway between the shoulder and the underarm, crease to crease.' });
  if (front_hps_to_waist && nape_to_waist && front_hps_to_waist < nape_to_waist - 1)
    out.push({ id: 'front_hps_to_waist', with: 'nape_to_waist', message: 'Front length is usually longer than back length, since it goes over the bust. Measure from the side of the neck over the bust point to the waist.' });
  else if (front_hps_to_waist && nape_to_waist && front_hps_to_waist > nape_to_waist + 14)
    out.push({ id: 'front_hps_to_waist', with: 'nape_to_waist', message: 'Front length looks long next to your back length. Tie a ribbon round your waist and measure to its top edge on both.' });
  if (high_hip && waist && full_hip && (high_hip < waist - 2 || high_hip > full_hip + 1))
    out.push({ id: 'high_hip', with: 'full_hip', message: 'High hip usually comes between your waist and your full hip. Measure about 10 cm below the waist, round the top of the hip bones.' });
  return out;
}

/** True when every measurement the garment always needs is filled in. */
export function isComplete(v: MeasurementValues, garment: Garment = 'skirt'): boolean {
  return FIELDS[garment].every((f) => f.optional || has(v, f.id));
}

export const hasHip = (v: MeasurementValues) => has(v, 'full_hip') && has(v, 'waist_to_hip');
