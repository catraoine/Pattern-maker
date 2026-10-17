import { ESTIMATED, FIELDS, type MeasurementId, type MeasurementValues } from './measurements';

// Fills in the upper-body measurements a first pattern can do without (ESTIMATED in measurements.ts),
// from the bust, high bust, shoulder width, back length and height, with the body proportions the engine
// is stress-tested on (engine/randomBodies.ts, after Aldrich's size tables).
const hardOf = new Map<MeasurementId, [number, number]>();
for (const list of Object.values(FIELDS)) for (const f of list) if (!hardOf.has(f.id)) hardOf.set(f.id, f.hard);
const round = (id: MeasurementId, x: number) => {
  const [lo, hi] = hardOf.get(id) ?? [0, Infinity];
  return Math.round(Math.min(hi, Math.max(lo, x)) * 10) / 10;
};

/** The measurements with any missing estimable ones filled in. Measured values are never changed. */
export function withEstimates(v: MeasurementValues): MeasurementValues {
  const bust = v.full_bust;
  if (bust === undefined || ESTIMATED.every((id) => v[id] !== undefined)) return v;
  const h = v.waist_to_floor ? v.waist_to_floor / 0.615 : v.nape_to_waist ? v.nape_to_waist / 0.25 : 165;
  const cup = v.high_bust !== undefined ? Math.max(1, bust - v.high_bust) : 2.5 + Math.max(0, bust - 85) * 0.075;
  const high = v.high_bust ?? bust - cup;
  const nw = v.nape_to_waist ?? h * 0.25;
  const ab = v.across_back ?? 30 + (h - 148) * 0.08 + (high - 76) * 0.18;
  const sw = v.shoulder_width ?? ab + 3.25;
  const neck = v.neck ?? 30 + (bust - 76) * 0.11;
  const guess: Partial<Record<MeasurementId, number>> = {
    neck,
    shoulder_length: (sw / 2 - neck / 5 + 0.2) / Math.cos((20 * Math.PI) / 180),
    across_back: ab,
    across_front: ab - 2,
    front_hps_to_waist: nw + 2.5 + cup * 0.4,
    bust_depth: h * 0.15 + cup * 0.3,
    apex_separation: 15 + (bust - 76) * 0.1,
    armscye: 35 + (bust - 76) * 0.3,
  };
  const out = { ...v };
  for (const id of ESTIMATED) if (out[id] === undefined) out[id] = round(id, guess[id]!);
  return out;
}
