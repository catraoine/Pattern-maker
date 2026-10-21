// Body measurements for each garment, with ranges from the measurements spec (measurements/measurements.json).
import type { SkirtMeasurements } from './engine/skirt';
import type { BodiceMeasurements } from './engine/bodice';
import type { SleeveMeasurements } from './engine/sleeve';
import type { TrousersMeasurements } from './engine/trousers';
import type { LingerieMeasurements } from './engine/lingerie';

export type Garment = 'skirt' | 'bodice' | 'dress' | 'trousers' | 'tee' | 'jacket' | 'coat' | 'lingerie';

/** The engine's measurements, and the height, which no block uses directly: it anchors the checks and the estimates. */
export type MeasurementId = keyof SkirtMeasurements | keyof BodiceMeasurements | keyof SleeveMeasurements | keyof TrousersMeasurements | keyof LingerieMeasurements | 'height';

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

/** Asked of everyone, last of the five on the measuring pages and first in the lists. Nothing is drafted from it, so an older profile without it still drafts; it is
 * what the lengths are checked against, and what the estimates scale from. */
export const HEIGHT: MeasurementField = {
  id: 'height',
  label: 'Height',
  hard: [120, 230],
  typical: [145, 200],
  optional: 'Used to double-check your other measurements and to fill in estimates. Nothing is drafted from it.',
  tip: 'Standing barefoot against a wall, looking straight ahead.',
};

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
  HEIGHT,
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
    tip: 'From your centre front waist, down between your legs, and up to your centre back waist. Hold the tape snug but not tight, as you would want the seam to sit. Ask someone to hold the end at the back: alone, it often comes out a few cm off.',
  },
  ...SKIRT_FIELDS.filter((f) => f.fit),
];

const HIP_NOTE = 'Only needed for tops that reach below the waist.';
const ARM_NOTE = 'Only needed for sleeves.';

const BODICE_ALL: MeasurementField[] = [
  HEIGHT,
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
/**
 * Upper-body measurements a first top or dress can do without (Cat, 2026-10-17: ask for the complex ones
 * later, when needed). Until they're taken the draft estimates them (see estimate.ts); taking them gives a
 * closer fit, and they're offered under "Add measurements for a closer fit".
 */
export const ESTIMATED: MeasurementId[] = ['neck', 'shoulder_length', 'across_back', 'across_front', 'front_hps_to_waist', 'bust_depth', 'apex_separation', 'armscye'];
export const ESTIMATE_NOTE = 'Estimated from your other measurements until you take it. Take it for a closer fit.';

export const BODICE_FIELDS: MeasurementField[] = BODICE_ALL.map((f) => (ESTIMATED.includes(f.id) && !f.optional ? { ...f, optional: ESTIMATE_NOTE } : f));


/** A dress takes the bodice's measurements and the skirt's lengths. */
const DRESS_FIELDS: MeasurementField[] = [...BODICE_FIELDS, ...SKIRT_FIELDS.filter((f) => !BODICE_FIELDS.some((b) => b.id === f.id))].map((f) =>
  // The dress skirt needs the hip, which the bodice only asks for below the waist.
  f.id === 'full_hip' || f.id === 'waist_to_hip' ? { ...f, optional: undefined } : f,
);

/** The T-shirt takes the bodice's girths and lengths it needs, the hip for the hem, and the arms for its
 * sleeves. The armhole, wrist and high bust are used when they've been measured; until the high bust is
 * taken, the bust shaping is estimated from the full bust (engine/tee.ts, bustShaping). */
const TEE_IDS: [MeasurementId, boolean][] = [
  ['full_bust', true],
  ['waist', true],
  ['full_hip', true],
  ['waist_to_hip', true],
  ['neck', true],
  ['shoulder_width', true],
  ['nape_to_waist', true],
  ['arm_length', true],
  ['upper_arm', true],
  ['armscye', false],
  ['wrist', false],
  ['high_bust', false],
];
const TEE_OPTIONAL: Partial<Record<MeasurementId, string>> = { wrist: 'For long sleeves.', armscye: 'For a closer armhole.', high_bust: 'For shaping over a fuller bust.' };
export const TEE_FIELDS: MeasurementField[] = [
  HEIGHT,
  ...TEE_IDS.map(([id, needed]) => {
    const f = BODICE_FIELDS.find((b) => b.id === id)!;
    return { ...f, optional: needed ? undefined : TEE_OPTIONAL[id] };
  }),
];

/** Lingerie and swimwear take the snug underbust, the crotch length for briefs and one-pieces, and the
 * back length and shoulders for straps. The neck and bust points are estimated until they're taken. */
const UNDERBUST: MeasurementField = {
  id: 'underbust',
  label: 'Underbust',
  hard: [55, 170],
  typical: [62, 130],
  tip: 'Snug round your ribcage, just under your bust, keeping the tape level all the way round. Breathe out and hold it firm, the way a bra band sits.',
};
const TORSO_LOOP: MeasurementField = {
  id: 'torso_loop',
  label: 'Torso loop',
  hard: [100, 230],
  typical: [125, 190],
  helper: true,
  tip: 'From the top of one shoulder, down the front over your bust, between your legs and up your back to the same shoulder. Stand tall and keep the tape snug. It sets a one-piece\'s length.',
};
/** Only the waist, hip and crotch length are needed for every piece (the brief); the rest are asked when a
 * piece needs them, from the style screen. */
const LINGERIE_NEEDS_FOR: [MeasurementId, string | undefined][] = [
  ['full_bust', undefined],
  ['waist', undefined],
  ['full_hip', undefined],
  ['waist_to_hip', undefined],
  ['crotch_length', undefined],
  ['underbust', 'For the bralette, bikini top and one-pieces.'],
  ['torso_loop', 'For the bodysuit and swimsuit.'],
  ['nape_to_waist', 'For tops and one-pieces.'],
  ['shoulder_width', 'For the bodysuit and swimsuit straps.'],
  ['neck', ESTIMATE_NOTE],
  ['bust_depth', ESTIMATE_NOTE],
  ['apex_separation', ESTIMATE_NOTE],
];
const LINGERIE_FIELDS: MeasurementField[] = [
  HEIGHT,
  ...LINGERIE_NEEDS_FOR.map(([id, optional]) => {
    if (id === 'underbust') return { ...UNDERBUST, optional };
    if (id === 'torso_loop') return { ...TORSO_LOOP, optional };
    const f = [...BODICE_FIELDS, ...TROUSERS_FIELDS].find((b) => b.id === id)!;
    return { ...f, optional };
  }),
];

/** A jacket takes the bodice's measurements with the hip (it reaches below the waist) and the arms (it
 * always has sleeves); a coat also the knee, for its length. */
const OUTER_NEEDS: MeasurementId[] = ['full_hip', 'waist_to_hip', 'arm_length', 'upper_arm'];
const JACKET_FIELDS: MeasurementField[] = BODICE_FIELDS.map((f) => (OUTER_NEEDS.includes(f.id) ? { ...f, optional: undefined } : f));
const COAT_FIELDS: MeasurementField[] = [
  ...JACKET_FIELDS.filter((f) => !f.fit),
  ...SKIRT_FIELDS.filter((f) => f.id === 'waist_to_knee'),
  ...JACKET_FIELDS.filter((f) => f.fit),
];

export const FIELDS: Record<Garment, MeasurementField[]> = { skirt: SKIRT_FIELDS, bodice: BODICE_FIELDS, dress: DRESS_FIELDS, trousers: TROUSERS_FIELDS, tee: TEE_FIELDS, jacket: JACKET_FIELDS, coat: COAT_FIELDS, lingerie: LINGERIE_FIELDS };

export type Unit = 'cm' | 'in';
export type MeasurementValues = Partial<Record<MeasurementId, number>>; // always stored in cm

/** The dress form a person's patterns are drafted on (Cat's B2 Two Forms, 2026-10-18). Missing means womenswear. */
export type FormKind = 'womenswear' | 'menswear';
/** The menswear form has no bust shaping, so these are never asked: the chest stands in for the high bust. */
export const MENSWEAR_SKIPS: MeasurementId[] = ['high_bust', 'bust_depth', 'apex_separation'];
/** A garment's measurements on this form. */
export const fieldsFor = (garment: Garment, form: FormKind = 'womenswear') =>
  form === 'menswear' ? FIELDS[garment].filter((f) => !MENSWEAR_SKIPS.includes(f.id)) : FIELDS[garment];
/** Copy about the bust, said of the chest for the menswear form. */
export const worded = (s: string, form: FormKind = 'womenswear') =>
  form === 'menswear' ? s.replace(/\b([Ff])ull bust\b/g, (_, f: string) => (f === 'F' ? 'Chest' : 'chest')).replace(/\bbust\b/g, 'chest').replace(/\bBust\b/g, 'Chest') : s;

export const EXAMPLE_VALUES: MeasurementValues = {
  height: 165,
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
  underbust: 76,
  torso_loop: 152,
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

/** What is known about the body beyond the tape: the weight, in kg. Never drafted from; it only checks the girths. */
export interface BodyInfo {
  weight?: number;
  /** The form the weight is read against, when the checks run on the womenswear path for the menswear form. */
  form?: FormKind;
}

export function checkMeasurements(v: MeasurementValues, unit: Unit, garment: Garment = 'skirt', form: FormKind = 'womenswear', body: BodyInfo = {}): Check[] {
  if (form === 'menswear') return checkMeasurements(v, unit, garment, 'womenswear', { ...body, form }).filter((c) => !MENSWEAR_SKIPS.includes(c.id)).map((c) => ({ ...c, message: worded(c.message, form) }));
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
  for (const c of weightChecks(v, body.weight, body.form ?? form)) if (asked.has(c.id) && !out.some((o) => o.id === c.id)) out.push(c);
  // Measurements checked against each other, after each has passed on its own.
  // A cross-check names what to look at, so it replaces the plain "is unusual" on the same measurement.
  const crossed = () => {
    for (const c of crossChecks(v)) {
      if (!asked.has(c.id) || !asked.has(c.with)) continue;
      const at = out.findIndex((o) => o.id === c.id);
      if (at < 0) out.push({ id: c.id, level: 'warning', message: c.message });
      else if (out[at].level === 'warning' && / is unusual\. /.test(out[at].message)) out[at] = { id: c.id, level: 'warning', message: c.message };
    }
  };
  // A T-shirt hangs from the shoulders and is cut from the bust down, so only the top's checks apply.
  if (garment !== 'bodice' && garment !== 'tee') {
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
  const { underbust } = v;
  if (full_bust && underbust && underbust >= full_bust) {
    out.push({ id: 'underbust', level: 'error', message: 'Underbust should be smaller than full bust. Are they swapped?' });
  } else if (full_bust && underbust && full_bust - underbust > 40) {
    out.push({ id: 'underbust', level: 'warning', message: 'Full bust is a lot bigger than underbust. Please check both.' });
  }
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
  ratio('crotch_length', 'full_hip', 0.56, 0.84,
    'Crotch length looks short for your hips. It runs from the centre front waist, right through between your legs, to the centre back waist. It is easiest with someone holding the tape at the back.',
    'Crotch length looks long for your hips. Keep the tape snug between the legs, and stop at the waist front and back. It is easiest with someone holding the tape at the back.');
  ratio('crotch_length', 'crotch_depth', 2.1, 3.3,
    'Crotch length looks short next to your crotch depth. Take the tape from the centre front waist right through between the legs to the centre back waist.',
    'Crotch length looks long next to your crotch depth. Keep the tape snug between the legs, and stop at the waist front and back.');
  // Lengths against the height: the body's proportions vary, but a length far off its share of the height is
  // usually a tape that started or stopped in the wrong place, or a height typed in the wrong unit.
  ratio('nape_to_waist', 'height', 0.2, 0.3,
    'Back length looks short next to your height. Measure from the bone at the back of the neck (bow your head to find it) straight down to the waist.',
    'Back length looks long next to your height. It stops at the waist, where a ribbon tied round settles; check your height too.');
  ratio('waist_to_floor', 'height', 0.55, 0.68,
    'Waist to floor looks short next to your height. Measure down the side from the waist to the floor in bare feet; check your height too.',
    'Waist to floor looks long next to your height. It starts at the natural waist, not the hip; check your height too.');
  ratio('waist_to_knee', 'height', 0.29, 0.4,
    'Waist to knee looks short next to your height. Measure down the side from the waist to the middle of the knee.',
    'Waist to knee looks long next to your height. It stops at the middle of the knee, not below it.');
  ratio('arm_length', 'height', 0.29, 0.42,
    'Arm length looks short next to your height. Measure from the shoulder bone over a slightly bent elbow to the wrist bone.',
    'Arm length looks long next to your height. It ends at the wrist bone, not the knuckles.');
  ratio('crotch_depth', 'height', 0.12, 0.22,
    'Crotch depth looks short next to your height. Sit on a hard chair and measure from the side waist straight down to the seat.',
    'Crotch depth looks long next to your height. Measure seated, from the side waist straight down to the chair seat, not to the floor.');
  ratio('shoulder_width', 'height', 0.17, 0.31,
    'Shoulder width looks narrow next to your height. Measure across the back from one shoulder point to the other.',
    'Shoulder width looks wide next to your height. Measure between the shoulder points, not round the arms.');
  ratio('full_hip', 'full_bust', 0.8, 1.4,
    'Your hip looks small next to your bust. Measure round the fullest part of the seat, usually about 20 cm below the waist.',
    'Your hip looks large next to your bust. Keep the tape level all the way round, at the fullest part of the seat.');
  // The base girths against each other, as they come in (measuring accuracy, 2026-10-21): bodies vary a lot here,
  // so only a gap few bodies have is said, and it names the tape most often taken wrong (a waist pulled in, a bust
  // tape riding up at the back).
  ratio('waist', 'full_bust', 0.58, 1.2,
    'Your waist looks small next to your bust. Breathe out normally and keep the tape snug, not pulled in; one finger should slide under it.',
    'Your waist looks large next to your bust. Check the bust tape is level across your back, at the fullest part, and the waist tape is at the narrowest part, not the hip.');
  // A waist larger than the hip is said already, for the skirts that can't draft it.
  if (v.waist && v.full_hip && v.waist / v.full_hip < 0.5)
    out.push({ id: 'waist', with: 'full_hip', message: 'Your waist looks small next to your hips. Breathe out normally and keep the waist tape snug, not pulled in.' });
  ratio('waist_to_hip', 'height', 0.075, 0.19,
    'Waist to hip looks short next to your height. Run the tape down your side from the waist to the fullest part of your seat, over the curve.',
    'Waist to hip looks long next to your height. Stop at the fullest part of your seat, usually about 20 cm below the waist; check your height too.');
  ratio('shoulder_width', 'full_bust', 0.26, 0.56,
    'Shoulder width looks narrow next to your bust. Measure across the back from one shoulder bone to the other, over the top of the shoulders.',
    'Shoulder width looks wide next to your bust. Measure between the shoulder bones, where the arm meets the shoulder, not round the outside of the arms.');
  ratio('across_back', 'full_bust', 0.24, 0.5,
    'Across back looks narrow next to your bust. Measure from crease to crease where the arms meet the back, with your arms relaxed.',
    'Across back looks wide next to your bust. Measure between the arm creases, halfway between the shoulder and the underarm, arms relaxed.');
  ratio('upper_arm', 'full_bust', 0.2, 0.45,
    'Your upper arm looks small next to your bust. Measure round the fullest part of the arm, relaxed at your side, the tape just touching.',
    'Your upper arm looks large next to your bust. Measure round the arm itself, not over the shoulder or a sleeve.');
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

/**
 * The girths against the height and weight, the way a pattern cutter reads a measurement sheet alongside the
 * person in front of them. At a given height and weight the bust, waist and hip each vary a lot with the body's
 * shape, but taken together they vary much less, so the check reads them together: all of them off the same
 * way means the height or weight slipped (or the unit did), and one standing far out from the others means
 * that tape did. Only ever a warning, worded about the measurement, never about the body, and nothing is said
 * without both the height and the weight.
 */
export function weightChecks(v: MeasurementValues, weight: number | undefined, form: FormKind = 'womenswear'): Check[] {
  const { height } = v;
  if (!height || !weight) return [];
  const bmi = weight / (height / 100) ** 2;
  if (bmi < 12 || bmi > 75) {
    return [{ id: 'height', level: 'warning', message: "Your height and weight don't look right together. Is one of them in the wrong unit?" }];
  }
  // Expected girths at this BMI (cm), from population averages.
  const expect: Partial<Record<MeasurementId, number>> =
    form === 'menswear'
      ? { full_bust: 2.4 * bmi + 45, waist: 2.5 * bmi + 30, full_hip: 1.6 * bmi + 60 }
      : { full_bust: 2.3 * bmi + 40, waist: 2.2 * bmi + 27, full_hip: 2.0 * bmi + 55 };
  const res = (Object.keys(expect) as MeasurementId[]).filter((id) => v[id]).map((id) => ({ id, r: v[id]! - expect[id]! }));
  if (!res.length) return [];
  const mean = res.reduce((a, b) => a + b.r, 0) / res.length;
  const name: Partial<Record<MeasurementId, string>> = { full_bust: 'Full bust', waist: 'Waist', full_hip: 'Full hip' };
  const one = (id: MeasurementId): Check => ({
    id,
    level: 'warning',
    message: `${name[id]} doesn't quite match your height and weight. It's fine if it's right, but please double-check it: tape level all the way round, snug but not tight.`,
  });
  // One girth standing far out from the others, whichever way the rest lean: the one furthest from its
  // expected value is the one to look at (with two girths each stands out from the other).
  if (res.length > 1) {
    const far = [...res].sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
    const rest = res.filter((o) => o.id !== far.id).reduce((a, b) => a + b.r, 0) / (res.length - 1);
    if (Math.abs(far.r - rest) > 28) return [one(far.id)];
  }
  if (Math.abs(mean) > 12) {
    return res.length === 1
      ? [one(res[0].id)]
      : [{ id: 'height', level: 'warning', message: "Your measurements don't quite match your height and weight. It's fine if they're right, but please double-check the height and weight." }];
  }
  return [];
}

/** True when every measurement the garment always needs is filled in. */
export function isComplete(v: MeasurementValues, garment: Garment = 'skirt', form: FormKind = 'womenswear'): boolean {
  return fieldsFor(garment, form).every((f) => f.optional || has(v, f.id));
}

export const hasHip = (v: MeasurementValues) => has(v, 'full_hip') && has(v, 'waist_to_hip');
