import { lingerieShown } from './lingerieFlag';
import { FIELDS, MENSWEAR_SKIPS, fieldsFor, worded, type FormKind, type Garment, type MeasurementField, type MeasurementId, type MeasurementValues } from './measurements';

// First-time measuring: one base set that every garment uses, then only the extras a garment still needs.
// Every measurement is kept with the person, so a later garment asks only for what is missing.

/** Taken by everyone first, the way the tape travels (Cat, 2026-10-21): round the waist, where the welcome's form
 * is centred, up to the bust, down to the hips, then out to the long ones, waist to floor and last the height. The
 * girths are checked against each other as they come in, and the lengths against the height once it is in. */
export const BASE: MeasurementId[] = ['waist', 'full_bust', 'full_hip', 'waist_to_floor', 'height'];
/** The base measurements a draft needs. The height isn't one: a profile measured before it was asked still drafts. */
const TAPE_BASE: MeasurementId[] = BASE.filter((id) => id !== 'height');

/** Lingerie is in the list only while previewing, until the fit test passes (lingerieFlag.ts). */
export const GARMENTS: Garment[] = ['skirt', 'dress', 'bodice', 'trousers', 'tee', 'jacket', 'coat', ...(lingerieShown ? (['lingerie'] as const) : [])];
export const GARMENT_NAME: Record<Garment, string> = { skirt: 'skirt', dress: 'dress', bodice: 'bodice', trousers: 'trousers', tee: 'T-shirt', jacket: 'jacket', coat: 'coat', lingerie: 'lingerie' };

const ALL = new Map<MeasurementId, MeasurementField>();
for (const list of Object.values(FIELDS)) for (const f of list) if (!ALL.has(f.id)) ALL.set(f.id, f);
// The first listing of each measurement, which is the plain one (the dress makes some optional ones required).
export const fieldOf = (id: MeasurementId) => ALL.get(id)!;

const has = (v: MeasurementValues, id: MeasurementId) => typeof v[id] === 'number' && !Number.isNaN(v[id]);

/** The measurements a garment needs beyond the base set, on this form. */
export const extrasFor = (garment: Garment, form?: FormKind) => fieldsFor(garment, form).filter((f) => !f.optional && !BASE.includes(f.id));
/** The extras still to take. */
export const missingFor = (garment: Garment, v: MeasurementValues, form?: FormKind) => extrasFor(garment, form).filter((f) => !has(v, f.id));
/** Everything a garment still needs when measuring for it again: any of the base set it uses that's missing, in the
 * tape's order, then its own extras. Asked on the garment's own pages, never by starting over (Cat's A, 2026-10-24). */
export const neededFor = (garment: Garment, v: MeasurementValues, form?: FormKind) => [
  ...BASE.map((id) => fieldsFor(garment, form).find((f) => f.id === id && !f.optional && !has(v, id))).filter((f): f is MeasurementField => !!f),
  ...missingFor(garment, v, form),
];
/** Whether anything has been measured yet: until then, measuring opens on the first-visit page. */
export const begun = (v: MeasurementValues) => Object.keys(v).some((id) => has(v, id as MeasurementId));
export const baseDone = (v: MeasurementValues) => TAPE_BASE.every((id) => has(v, id));

/** Every measurement the app uses, for "Something else": the ones still to take, after the base set. */
export const fullSetMissing = (v: MeasurementValues, form?: FormKind) =>
  [...ALL.values()].filter((f) => !BASE.includes(f.id) && !has(v, f.id) && !(form === 'menswear' && MENSWEAR_SKIPS.includes(f.id)));

/** A measurement's name on the form: the menswear form's full bust is the chest. */
export const labelOf = (id: MeasurementId, form?: FormKind) => worded(fieldOf(id).label, form);

/** Girths read as a body part: "Your bust", "Their waist". Lengths keep their name. */
const PART: Partial<Record<MeasurementId, string>> = {
  height: 'height',
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
const GIRTHS = new Set<MeasurementId>((Object.keys(PART) as MeasurementId[]).filter((id) => id !== 'height'));

export function titleOf(id: MeasurementId, helper: boolean, form?: FormKind) {
  const part = PART[id];
  return worded(part ? `${helper ? 'Their' : 'Your'} ${part}` : fieldOf(id).label, form);
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
  height: ['Barefoot, back to a wall.', 'Ask them to stand barefoot, back to a wall.'],
  full_bust: ['Round the fullest part, keeping the tape level.', 'Round the fullest part of their bust. Check the tape is level across their back.'],
  waist: ['Round the narrowest part of your middle.', 'Stand in front of them. Wrap the narrowest part of their middle and check the tape is level at the back.'],
  full_hip: ['Round the fullest part of your seat, keeping the tape level.', 'Round the fullest part of their seat. Look from the side to check the tape is level.'],
  waist_to_floor: ['Down your side, standing barefoot.', 'Ask them to stand barefoot. Hold the tape at their waist and let it fall down their side.'],
  shoulder_width: ['Across your back, shoulder point to shoulder point, arms relaxed at your sides.', 'Across their back, shoulder point to shoulder point, their arms relaxed at their sides.'],
  waist_to_hip: ['Down your side to the fullest part of your hip.', 'Hold the tape at their waist and measure down their side to the fullest part of their hip.'],
  waist_to_knee: ['Down your side to the middle of your knee.', 'Hold the tape at their waist and measure down their side to the middle of their knee.'],
};
/** The string tied round the waist (Cat, 2026-10-24): suggested on the waist page, then every length that starts or
 *  ends at the waist starts from it. */
const FROM_WAIST = new Set<MeasurementId>(['waist_to_hip', 'waist_to_knee', 'waist_to_floor', 'crotch_depth', 'front_waist_to_hip', 'back_waist_to_hip', 'nape_to_waist', 'front_hps_to_waist']);
export function stringOf(id: MeasurementId, helper: boolean, form?: FormKind): string | undefined {
  const l =
    id === 'waist'
      ? 'Tie a string there if you have one.'
      : FROM_WAIST.has(id)
        ? 'Tied a string at your waist? Start from it.'
        : undefined;
  return l && worded(helper ? forHelper(l) : l, form);
}
export function tipOf(id: MeasurementId, helper: boolean, form?: FormKind) {
  const t = TIP[id];
  if (t) return worded(t[helper ? 1 : 0], form);
  const tip = fieldOf(id).tip;
  return worded(helper ? forHelper(tip) : tip, form);
}

/** The "How to do it" steps. [for the wearer, for a helper] */
const STEPS: Partial<Record<MeasurementId, [string[], string[]]>> = {
  height: [
    ['Take off your shoes and stand against a wall, heels touching it.', 'Look straight ahead, standing tall.', 'Rest something flat (a book) on your head, level against the wall.', 'Mark where it meets the wall and measure down to the floor.'],
    ['Ask them to take off their shoes and stand against a wall, heels touching it.', 'Ask them to look straight ahead, standing tall.', 'Rest something flat (a book) on their head, level against the wall.', 'Mark where it meets the wall and measure down to the floor.'],
  ],
  full_bust: [
    ['Stand relaxed with your arms down.', 'Wrap the tape round the fullest part of your bust.', 'Keep it level all the way round, across your back too.', 'Snug, not tight, then read the number.'],
    ['Ask them to stand relaxed with their arms down.', 'Wrap the tape round the fullest part of their bust.', 'Check it is level across their back.', 'Snug, not tight, then read the number.'],
  ],
  waist: [
    ['Bend to one side. The crease that forms is your waist.', 'If you have a string, ribbon or elastic, tie it round there and leave it on: every length starts from it.', 'Wrap the tape round there, level all the way round.', 'Snug, not tight: one finger should slide under it.', 'Breathe out normally, then read the number.'],
    ['Ask them to bend to one side. The crease that forms is their waist.', 'If you have a string, ribbon or elastic, tie it round there and leave it on: every length starts from it.', 'Wrap the tape round there, level all the way round.', 'Snug, not tight: one finger should slide under it.', 'Ask them to breathe out normally, then read the number.'],
  ],
  full_hip: [
    ['Stand with your feet together.', 'Wrap the tape round the fullest part of your seat.', 'Check in a mirror from the side that it is level.', 'Snug, not tight, then read the number.'],
    ['Ask them to stand with their feet together.', 'Wrap the tape round the fullest part of their seat.', 'Look from the side to check it is level.', 'Snug, not tight, then read the number.'],
  ],
  waist_to_floor: [
    ['Take off your shoes and stand straight.', 'Hold the tape at your waist (at the string, if you tied one), at your side.', 'Let it fall straight down to the floor.', 'Read the number where it touches the floor.'],
    ['Ask them to take off their shoes and stand straight.', 'Hold the tape at their waist (at the string, if you tied one), at their side.', 'Let it fall straight down to the floor.', 'Read the number where it touches the floor.'],
  ],
  shoulder_width: [
    ['Lift one arm out to the side. The dip at the end of your shoulder bone is your shoulder point.', 'Find the other one the same way.', 'Lower both arms and let your shoulders relax: a raised arm makes the number too short.', 'Measure straight across your back from one point to the other.'],
    ['Ask them to lift one arm out to the side. The dip at the end of their shoulder bone is their shoulder point.', 'Find the other one the same way.', 'Ask them to lower both arms and let their shoulders relax: a raised arm makes the number too short.', 'Measure straight across their back from one point to the other.'],
  ],
  waist_to_hip: [
    ['Find the fullest part of your hip, as for your hips.', 'Hold the tape at your waist (at the string, if you tied one), at your side.', 'Run it down over the curve of your hip to that fullest part.', 'Read the number there.'],
    ['Find the fullest part of their hip, as for their hips.', 'Hold the tape at their waist (at the string, if you tied one), at their side.', 'Run it down over the curve of their hip to that fullest part.', 'Read the number there.'],
  ],
  waist_to_knee: [
    ['Stand straight with your knees relaxed.', 'Hold the tape at your waist (at the string, if you tied one), at your side.', 'Run it straight down to the middle of your knee.', 'Read the number there.'],
    ['Ask them to stand straight with their knees relaxed.', 'Hold the tape at their waist (at the string, if you tied one), at their side.', 'Run it straight down to the middle of their knee.', 'Read the number there.'],
  ],
};
export function stepsOf(id: MeasurementId, helper: boolean, form?: FormKind): string[] {
  if (form === 'menswear') return stepsOf(id, helper).map((l) => worded(l, form));
  const s = STEPS[id];
  if (s) return s[helper ? 1 : 0];
  const tip = helper ? forHelper(fieldOf(id).tip) : fieldOf(id).tip;
  const lines = tip.match(/[^.;:]+[.;:]?/g)!.map((l) => l.trim().replace(/[;:]$/, '.')).filter(Boolean);
  const last = GIRTHS.has(id) ? 'Snug, not tight: one finger should slide under it.' : 'Keep the tape straight, then read the number.';
  return [...lines.map((l) => l[0].toUpperCase() + l.slice(1)), last];
}

/** What most often goes wrong with each measurement at home, for the "How to do it" sheet (measuring accuracy,
 *  2026-10-21). Written to the wearer; a helper reads them through forHelper. */
const MISTAKES: Partial<Record<MeasurementId, string[]>> = {
  height: ['Shoes or thick socks on.', 'Slouching, or the chin tipped up.', 'The book tilted, not level against the wall.'],
  waist: ['Measuring over jeans or a belt.', 'Holding your breath or pulling your tummy in.', 'The tape slipping down at the back.'],
  full_bust: ['The tape riding up at the back. Check it in a mirror.', 'A different bra from the one you will wear with it.', 'Arms raised while the number is read.'],
  full_hip: ['Measuring at the hip bones, not the fullest part of the seat.', 'Feet apart, which widens the hips.', 'Something in a back pocket.'],
  waist_to_floor: ['Shoes on.', 'Starting at the hip, or at a waistband that sits low.', 'Looking down, which tips the body forward.'],
  waist_to_hip: ['Measuring straight down in the air, not over the curve of the hip.', 'Starting below the waist.'],
  waist_to_knee: ['Bending the knee.', 'Stopping at the top or bottom of the knee, not the middle.'],
  nape_to_waist: ['Starting at the top of the collar, not the neck bone.', 'Stooping while you measure.'],
  front_hps_to_waist: ['Going round the side of the bust, not over the bust point.', 'A different bra from the one you will wear with it.'],
  shoulder_width: ['Measuring with an arm still raised.', 'Measuring round the outside of the arms.', 'Hunching the shoulders forward.'],
  across_back: ['Arms pulled forward, which widens the back.', 'Measuring at the armpits, not halfway up.'],
  across_front: ['Arms pulled back.', 'Measuring at the bust, not halfway up.'],
  arm_length: ['A straight arm: bend the elbow a little.', 'Ending at the knuckles, not the wrist bone.'],
  crotch_length: ['Letting the tape sag between the legs.', 'Stopping below the waist at the back. A friend holding the back end helps most here.'],
  crotch_depth: ['Sitting on a soft chair or sofa.', 'Measuring at an angle, not straight down.'],
};
/** Another way for anyone measuring seated or alone (the accessibility review, 2026-10-30): the "How to do it" sheet
 *  assumed standing barefoot and reaching your own back. Written to the wearer measuring on their own. */
const SEATED: Partial<Record<MeasurementId, string>> = {
  height: 'Can\'t stand against a wall? The height on your ID or from a recent check-up works.',
  waist: 'Seated? Sit up tall with your feet flat. Standing with a hand on a chair back is better still, as sitting can add a little.',
  full_bust: 'Seated is fine for this one: sit up tall with your arms resting down.',
  full_hip: 'Stand for this one if you can, even holding a chair: sitting spreads the seat and makes the number bigger.',
  waist_to_floor:
    'Can\'t stand for this one? Lay full-length trousers that fit you flat. Measure the side from the top of the waistband to the hem, then add the gap between the hem and the floor when you wear them.',
  waist_to_knee: 'Seated or alone? Lay a skirt that ends at your knee flat and measure it at the side, waistband top to hem.',
  waist_to_hip: 'Seated? Measure from your waist down the side of your hip to the chair seat.',
  shoulder_width:
    'Can\'t reach your back? Lay a woven shirt that fits you well flat, buttoned, and measure across the back from one shoulder seam to the other.',
  across_back:
    'Can\'t reach your back? Lay a shirt that fits you well flat and measure across the back halfway between the shoulder seam and the underarm, seam to seam.',
  nape_to_waist: 'Can\'t reach your back? Lay a fitted top flat and measure the back from the neck seam at the centre down to where your waist sits in it.',
  arm_length: 'On your own? Lay a long-sleeved shirt that fits you flat and measure the sleeve from the shoulder seam to the end of the cuff.',
  crotch_length:
    'On your own? Measure the seam of trousers that fit you well, from the front waistband down between the legs and up to the back waistband.',
};

/** Another way to take one measurement seated or alone, or nothing when the usual way already works sitting down. */
export function seatedOf(id: MeasurementId, form?: FormKind): string | undefined {
  const s = SEATED[id];
  return s && worded(s, form);
}

const GIRTH_MISTAKES = ['Measuring over clothes.', 'Pulling the tape tight.', 'The tape twisted or not level all the way round.'];
const LENGTH_MISTAKES = ['Starting or stopping in the wrong place.', 'The tape sagging or twisted.'];

/** The common mistakes for one measurement, for whoever holds the tape. */
export function mistakesOf(id: MeasurementId, helper: boolean, form?: FormKind): string[] {
  const list = MISTAKES[id] ?? (GIRTHS.has(id) ? GIRTH_MISTAKES : LENGTH_MISTAKES);
  return list.map((l) => worded(helper ? forHelper(l) : l, form));
}
