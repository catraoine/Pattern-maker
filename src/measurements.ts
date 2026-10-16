// Body measurements for each garment, with ranges from the measurements spec (measurements/measurements.json).
import type { SkirtMeasurements } from './engine/skirt';
import type { BodiceMeasurements } from './engine/bodice';

export type Garment = 'skirt' | 'bodice';

export type MeasurementId = keyof SkirtMeasurements | keyof BodiceMeasurements;

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

const HIP_NOTE = 'Only needed for tops that reach below the waist.';

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

export const FIELDS: Record<Garment, MeasurementField[]> = { skirt: SKIRT_FIELDS, bodice: BODICE_FIELDS };

export type Unit = 'cm' | 'in';
export type MeasurementValues = Partial<Record<MeasurementId, number>>; // always stored in cm

export const EXAMPLE_VALUES: MeasurementValues = {
  waist: 76,
  full_hip: 102,
  waist_to_hip: 20.5,
  waist_to_knee: 58,
  waist_to_floor: 104,
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
  if (garment === 'skirt') {
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
    return out;
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
  return out;
}

/** True when every measurement the garment always needs is filled in. */
export function isComplete(v: MeasurementValues, garment: Garment = 'skirt'): boolean {
  return FIELDS[garment].every((f) => f.optional || has(v, f.id));
}

export const hasHip = (v: MeasurementValues) => has(v, 'full_hip') && has(v, 'waist_to_hip');
