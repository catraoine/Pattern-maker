// Skirt measurements, with ranges from the measurements spec (measurements/measurements.json).
import type { SkirtMeasurements } from './engine/skirt';

export type MeasurementId = keyof SkirtMeasurements;

export interface MeasurementField {
  id: MeasurementId;
  label: string;
  hard: [number, number]; // cm; outside this is an error
  typical: [number, number]; // cm; outside this is a warning
  tip: string;
}

export const SKIRT_FIELDS: MeasurementField[] = [
  {
    id: 'waist',
    label: 'Waist',
    hard: [45, 200],
    typical: [55, 145],
    tip: 'Around your natural waist, the narrowest part of your torso. Bend to one side; the crease that forms is your waist.',
  },
  {
    id: 'full_hip',
    label: 'Full hip',
    hard: [60, 220],
    typical: [80, 160],
    tip: 'Around the fullest part of your seat, keeping the tape level. Check from the side in a mirror.',
  },
  {
    id: 'waist_to_hip',
    label: 'Waist to hip',
    hard: [10, 35],
    typical: [15, 26],
    tip: 'Down your side, from your waist to the fullest part of your hip.',
  },
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
];

export type Unit = 'cm' | 'in';
export type MeasurementValues = Partial<Record<MeasurementId, number>>; // always stored in cm

export const EXAMPLE_VALUES: MeasurementValues = {
  waist: 76,
  full_hip: 102,
  waist_to_hip: 20.5,
  waist_to_knee: 58,
  waist_to_floor: 104,
};

export interface Check {
  id: MeasurementId;
  level: 'error' | 'warning';
  message: string;
}

const fmt = (cm: number, unit: Unit) => (unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);

export function checkMeasurements(v: MeasurementValues, unit: Unit): Check[] {
  const out: Check[] = [];
  for (const f of SKIRT_FIELDS) {
    const x = v[f.id];
    if (x === undefined || Number.isNaN(x)) {
      out.push({ id: f.id, level: 'error', message: `${f.label} is needed.` });
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
  return out;
}

export function isComplete(v: MeasurementValues): v is SkirtMeasurements {
  return SKIRT_FIELDS.every((f) => typeof v[f.id] === 'number' && !Number.isNaN(v[f.id]));
}
