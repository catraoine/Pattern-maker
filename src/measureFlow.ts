import { FIELDS, type Garment, type MeasurementField, type MeasurementId, type MeasurementValues } from './measurements';

// First-time measuring: one base set that every garment uses, then only the extras a garment still needs.
// Every measurement is kept with the person, so a later garment asks only for what is missing.

/** Taken by everyone first. Waist to floor is the length every garment can work from, and easier alone than height. */
export const BASE: MeasurementId[] = ['full_bust', 'waist', 'full_hip', 'waist_to_floor'];

export const GARMENTS: Garment[] = ['skirt', 'dress', 'bodice', 'trousers', 'jacket', 'coat'];
export const GARMENT_NAME: Record<Garment, string> = { skirt: 'skirt', dress: 'dress', bodice: 'bodice', trousers: 'trousers', jacket: 'jacket', coat: 'coat' };

const ALL = new Map<MeasurementId, MeasurementField>();
for (const list of Object.values(FIELDS)) for (const f of list) if (!ALL.has(f.id)) ALL.set(f.id, f);
// The first listing of each measurement, which is the plain one (the dress makes some optional ones required).
export const fieldOf = (id: MeasurementId) => ALL.get(id)!;

const has = (v: MeasurementValues, id: MeasurementId) => typeof v[id] === 'number' && !Number.isNaN(v[id]);

/** The measurements a garment needs beyond the base set. */
export const extrasFor = (garment: Garment) => FIELDS[garment].filter((f) => !f.optional && !BASE.includes(f.id));
/** The extras still to take. */
export const missingFor = (garment: Garment, v: MeasurementValues) => extrasFor(garment).filter((f) => !has(v, f.id));
export const baseDone = (v: MeasurementValues) => BASE.every((id) => has(v, id));

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Two more for a skirt." */
export const moreFor = (n: number, garment: Garment) => `${WORDS[n] ?? n} more for ${garment === 'trousers' ? 'trousers' : `a ${GARMENT_NAME[garment]}`}.`;

/** Girths read as a body part: "Your bust", "Their waist". Lengths keep their name. */
const PART: Partial<Record<MeasurementId, string>> = {
  full_bust: 'bust',
  high_bust: 'high bust',
  waist: 'waist',
  full_hip: 'hips',
  high_hip: 'high hip',
  neck: 'neck',
  armscye: 'armhole',
  upper_arm: 'upper arm',
  wrist: 'wrist',
};
export const GIRTHS = new Set(Object.keys(PART) as MeasurementId[]);

export function titleOf(id: MeasurementId, helper: boolean) {
  const part = PART[id];
  return part ? `${helper ? 'Their' : 'Your'} ${part}` : fieldOf(id).label;
}

/** Turn copy written to the wearer into copy for the person holding the tape. */
export const forHelper = (s: string) =>
  s
    .replace(/\byourself\b/g, 'themselves')
    .replace(/\byour\b/g, 'their')
    .replace(/\bYour\b/g, 'Their')
    .replace(/\byou\b/g, 'they')
    .replace(/\bYou\b/g, 'They');

/** One short line under the title. [for the wearer, for a helper] */
const TIP: Partial<Record<MeasurementId, [string, string]>> = {
  full_bust: ['Round the fullest part, keeping the tape level.', 'Round the fullest part of their bust. Check the tape is level across their back.'],
  waist: ['Round the narrowest part of your middle.', 'Stand in front of them. Wrap the narrowest part of their middle and check the tape is level at the back.'],
  full_hip: ['Round the fullest part of your seat, keeping the tape level.', 'Round the fullest part of their seat. Look from the side to check the tape is level.'],
  waist_to_floor: ['Down your side, standing barefoot.', 'Ask them to stand barefoot. Hold the tape at their waist and let it fall down their side.'],
  waist_to_hip: ['Down your side to the fullest part of your hip.', 'Hold the tape at their waist and measure down their side to the fullest part of their hip.'],
  waist_to_knee: ['Down your side to the middle of your knee.', 'Hold the tape at their waist and measure down their side to the middle of their knee.'],
};
export function tipOf(id: MeasurementId, helper: boolean) {
  const t = TIP[id];
  if (t) return t[helper ? 1 : 0];
  const tip = fieldOf(id).tip;
  return helper ? forHelper(tip) : tip;
}

/** The "How to do it" steps. [for the wearer, for a helper] */
const STEPS: Partial<Record<MeasurementId, [string[], string[]]>> = {
  full_bust: [
    ['Stand relaxed with your arms down.', 'Wrap the tape round the fullest part of your bust.', 'Keep it level all the way round, across your back too.', 'Snug, not tight, then read the number.'],
    ['Ask them to stand relaxed with their arms down.', 'Wrap the tape round the fullest part of their bust.', 'Check it is level across their back.', 'Snug, not tight, then read the number.'],
  ],
  waist: [
    ['Bend to one side. The crease that forms is your waist.', 'Wrap the tape round there, level all the way round.', 'Snug, not tight: one finger should slide under it.', 'Breathe out normally, then read the number.'],
    ['Ask them to bend to one side. The crease that forms is their waist.', 'Wrap the tape round there, level all the way round.', 'Snug, not tight: one finger should slide under it.', 'Ask them to breathe out normally, then read the number.'],
  ],
  full_hip: [
    ['Stand with your feet together.', 'Wrap the tape round the fullest part of your seat.', 'Check in a mirror from the side that it is level.', 'Snug, not tight, then read the number.'],
    ['Ask them to stand with their feet together.', 'Wrap the tape round the fullest part of their seat.', 'Look from the side to check it is level.', 'Snug, not tight, then read the number.'],
  ],
  waist_to_floor: [
    ['Take off your shoes and stand straight.', 'Hold the tape at your waist, at your side.', 'Let it fall straight down to the floor.', 'Read the number where it touches the floor.'],
    ['Ask them to take off their shoes and stand straight.', 'Hold the tape at their waist, at their side.', 'Let it fall straight down to the floor.', 'Read the number where it touches the floor.'],
  ],
  waist_to_hip: [
    ['Find the fullest part of your hip, as for your hips.', 'Hold the tape at your waist, at your side.', 'Run it straight down to that fullest part.', 'Read the number there.'],
    ['Find the fullest part of their hip, as for their hips.', 'Hold the tape at their waist, at their side.', 'Run it straight down to that fullest part.', 'Read the number there.'],
  ],
  waist_to_knee: [
    ['Stand straight with your knees relaxed.', 'Hold the tape at your waist, at your side.', 'Run it straight down to the middle of your knee.', 'Read the number there.'],
    ['Ask them to stand straight with their knees relaxed.', 'Hold the tape at their waist, at their side.', 'Run it straight down to the middle of their knee.', 'Read the number there.'],
  ],
};
export function stepsOf(id: MeasurementId, helper: boolean): string[] {
  const s = STEPS[id];
  if (s) return s[helper ? 1 : 0];
  const tip = helper ? forHelper(fieldOf(id).tip) : fieldOf(id).tip;
  const lines = tip.match(/[^.;:]+[.;:]?/g)!.map((l) => l.trim().replace(/[;:]$/, '.')).filter(Boolean);
  const last = GIRTHS.has(id) ? 'Snug, not tight: one finger should slide under it.' : 'Keep the tape straight, then read the number.';
  return [...lines.map((l) => l[0].toUpperCase() + l.slice(1)), last];
}
