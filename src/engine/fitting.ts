// The toile fitting loop: what a person sees when they try on a toile, and the pattern correction a
// pattern cutter makes for each. Corrections add up across fittings and travel with the person, so
// every pattern drafted for them afterwards carries them.
import type { Side, SkirtFitting } from './skirt';
import type { BodiceFitting } from './bodice';
import { isKnit, isOuterwear } from '../measurements';

export type FitGarment = 'skirt' | 'bodice';
/** Every garment that can be fitted in a toile: a dress takes both kinds of correction, trousers the skirt's waist and hip. */
export type FitTarget = FitGarment | 'dress' | 'trousers' | 'tee' | 'jacket' | 'coat' | 'lingerie';

export interface FitIssue {
  id: string;
  garment: FitGarment;
  /** Where on the body, to group the list. */
  area: string;
  /** What you see on the toile, in a few words. */
  title: string;
  /** How to recognise it. */
  detail: string;
  /** What changes on the pattern, in a pattern cutter's words. */
  fix: string;
  /** The alteration as a pattern cutter makes it on their own block, with {v} for the amount, {h} half and
   * {q} a quarter of it, and {side} for the side. */
  pro: string;
  /** The change in a few words for the pattern's notes, with {v} for the amount and {side} for the side. */
  note: string;
  /** The correction it makes, and which way. */
  keys: string[];
  sign: 1 | -1;
  unit: 'cm' | 'degrees';
  start: number;
  max: number;
  step: number;
  /** For one side of the body only: asks which side. */
  sided?: boolean;
  /** The issue that is its opposite, which it replaces. */
  opposite?: string;
  /** Only for patterns with a bust dart. */
  needsBustDart?: boolean;
}

const cmIssue = (i: Omit<FitIssue, 'unit' | 'step'> & { step?: number }): FitIssue => ({ unit: 'cm', step: 0.5, ...i });

export const FIT_ISSUES: FitIssue[] = [
  // ---- skirt ----
  cmIssue({
    id: 'skirt-hip-tight',
    pro: 'Let out the hip by {v} in all: add {q} at each side seam at the hip line, front and back, blending to the waist and hem.',
    note: 'hip ease +{v}',
    garment: 'skirt',
    area: 'Hips',
    title: 'Pulls across the hips',
    detail: 'Strain lines run across the hips or the skirt rides up when you walk.',
    fix: 'Adds ease at the hip line, shared between the side seams.',
    keys: ['hipEase'],
    sign: 1,
    start: 2,
    max: 6,
    opposite: 'skirt-hip-loose',
  }),
  cmIssue({
    id: 'skirt-hip-loose',
    pro: 'Take in the hip by {v} in all: remove {q} at each side seam at the hip line, front and back, blending to the waist and hem.',
    note: 'hip ease -{v}',
    garment: 'skirt',
    area: 'Hips',
    title: 'Loose at the hips',
    detail: 'You can pinch out more than a centimetre at each side seam below the waist.',
    fix: 'Takes ease out at the hip line.',
    keys: ['hipEase'],
    sign: -1,
    start: 2,
    max: 4,
    opposite: 'skirt-hip-tight',
  }),
  cmIssue({
    id: 'skirt-waist-tight',
    pro: 'Let out the waist by {v} in all: take {q} less into the darts of each front and back quarter, and lengthen the waistband by {v}.',
    note: 'waist ease +{v}',
    garment: 'skirt',
    area: 'Waist',
    title: 'Tight at the waist',
    detail: 'The waistband digs in, or the zip strains at the top.',
    fix: 'Adds ease at the waist; the darts take less and the waistband grows to match.',
    keys: ['waistEase'],
    sign: 1,
    start: 1,
    max: 4,
    opposite: 'skirt-waist-loose',
  }),
  cmIssue({
    id: 'skirt-waist-loose',
    pro: 'Take in the waist by {v} in all: take {q} more into the darts of each front and back quarter, and shorten the waistband by {v}.',
    note: 'waist ease -{v}',
    garment: 'skirt',
    area: 'Waist',
    title: 'Loose at the waist',
    detail: 'The waistband stands away from your body or slips down.',
    fix: 'Takes ease out of the waist; the darts take more and the waistband shortens to match.',
    keys: ['waistEase'],
    sign: -1,
    start: 1,
    max: 3,
    opposite: 'skirt-waist-tight',
  }),
  cmIssue({
    id: 'skirt-sway-back',
    pro: 'Sway back: lower the centre back waist by {v}, tapering to nothing at the side seams. Re-true the back darts.',
    note: 'centre back waist lowered {v}',
    garment: 'skirt',
    area: 'Back',
    title: 'Folds below the back waist',
    detail: 'Horizontal folds sit just under the waistband at the back: a sway back.',
    fix: 'Lowers the centre back waist, tapering to nothing at the side seams.',
    keys: ['backDrop'],
    sign: 1,
    start: 1.5,
    max: 3,
    opposite: 'skirt-seat',
  }),
  cmIssue({
    id: 'skirt-seat',
    pro: 'Full seat: raise the centre back waist by {v}, tapering to nothing at the side seams. Re-true the back darts.',
    note: 'centre back waist raised {v}',
    garment: 'skirt',
    area: 'Back',
    title: 'Hem rises at the back',
    detail: 'The back hem lifts and the skirt cups under the seat.',
    fix: 'Raises the centre back waist, giving more length over a fuller seat.',
    keys: ['backDrop'],
    sign: -1,
    start: 1.5,
    max: 3,
    opposite: 'skirt-sway-back',
  }),
  cmIssue({
    id: 'skirt-tummy',
    pro: 'Full tummy: raise the centre front waist by {v}, tapering to nothing at the side seams. Re-true the front darts.',
    note: 'centre front waist raised {v}',
    garment: 'skirt',
    area: 'Front',
    title: 'Hem rises at the front',
    detail: 'The front hem kicks up, or the side seams swing toward the front.',
    fix: 'Raises the centre front waist, giving more length over the tummy.',
    keys: ['frontDrop'],
    sign: -1,
    start: 1.5,
    max: 3,
    opposite: 'skirt-front-folds',
  }),
  cmIssue({
    id: 'skirt-front-folds',
    pro: 'Lower the centre front waist by {v}, tapering to nothing at the side seams. Re-true the front darts.',
    note: 'centre front waist lowered {v}',
    garment: 'skirt',
    area: 'Front',
    title: 'Folds below the front waist',
    detail: 'Horizontal folds sit just under the waistband at the front.',
    fix: 'Lowers the centre front waist, tapering to nothing at the side seams.',
    keys: ['frontDrop'],
    sign: 1,
    start: 1,
    max: 2.5,
    opposite: 'skirt-tummy',
  }),
  cmIssue({
    id: 'skirt-dart-bubble',
    pro: 'Shorten the waist darts by {v}, redrawing the legs to the new point.',
    note: 'darts shortened {v}',
    garment: 'skirt',
    area: 'Darts',
    title: 'Bubbles at the dart ends',
    detail: 'Each dart ends in a small pouch: it points past the fullest part of you.',
    fix: 'Shortens the darts.',
    keys: ['dartLength'],
    sign: -1,
    start: 1.5,
    max: 4,
    opposite: 'skirt-dart-short',
  }),
  cmIssue({
    id: 'skirt-dart-short',
    pro: 'Lengthen the waist darts by {v}, keeping each point at least 3 cm above the hip line.',
    note: 'darts lengthened {v}',
    garment: 'skirt',
    area: 'Darts',
    title: 'Puffs below the darts',
    detail: 'Fullness stands out below where the darts end.',
    fix: 'Lengthens the darts, never past 3 cm above the hip line.',
    keys: ['dartLength'],
    sign: 1,
    start: 1.5,
    max: 3,
    opposite: 'skirt-dart-bubble',
  }),
  cmIssue({
    id: 'skirt-high-hip',
    pro: 'High {side} hip: raise the {side} side seam at the waist by {v}, tapering to nothing at centre front and back. Cut the {side} side on the raised line.',
    note: '{side} hip {v} higher',
    garment: 'skirt',
    area: 'One side',
    title: 'One side hangs lower',
    detail: 'The hem dips on one side and folds form below the waist there: that hip is higher.',
    fix: 'Adds a second waist line for that side, raised at the side seam and tapering to the centre.',
    keys: ['highHip'],
    sign: 1,
    start: 1,
    max: 3,
    sided: true,
  }),

  // ---- bodice ----
  cmIssue({
    id: 'bodice-bust-tight',
    pro: 'Let out the bust by {v} in all: add {q} at each side seam at the underarm, front and back, blending to the waist.',
    note: 'bust ease +{v}',
    garment: 'bodice',
    area: 'Bust',
    title: 'Pulls across the bust',
    detail: 'Strain lines run between the bust points, or the zip strains at bust level.',
    fix: 'Adds ease at the bust, shared between the side seams.',
    keys: ['bustEase'],
    sign: 1,
    start: 2,
    max: 6,
    opposite: 'bodice-bust-loose',
  }),
  cmIssue({
    id: 'bodice-bust-loose',
    pro: 'Take in the bust by {v} in all: remove {q} at each side seam at the underarm, front and back, blending to the waist.',
    note: 'bust ease -{v}',
    garment: 'bodice',
    area: 'Bust',
    title: 'Loose at the bust',
    detail: 'You can pinch out more than a centimetre at each side seam at bust level.',
    fix: 'Takes ease out at the bust.',
    keys: ['bustEase'],
    sign: -1,
    start: 2,
    max: 4,
    opposite: 'bodice-bust-tight',
  }),
  cmIssue({
    id: 'bodice-dart-high',
    pro: 'Lower the bust point by {v}. Move the dart points down with it and re-true the darts.',
    note: 'bust point lowered {v}',
    garment: 'bodice',
    area: 'Bust',
    title: 'Darts point above the bust',
    detail: 'The dart points sit above your bust points, with a pouch below them.',
    fix: 'Lowers the bust point, and the darts with it.',
    keys: ['bustPoint'],
    sign: 1,
    start: 1.5,
    max: 4,
    opposite: 'bodice-dart-low',
    needsBustDart: true,
  }),
  cmIssue({
    id: 'bodice-dart-low',
    pro: 'Raise the bust point by {v}. Move the dart points up with it and re-true the darts.',
    note: 'bust point raised {v}',
    garment: 'bodice',
    area: 'Bust',
    title: 'Darts point below the bust',
    detail: 'The dart points sit below your bust points, flattening the bust.',
    fix: 'Raises the bust point, and the darts with it.',
    keys: ['bustPoint'],
    sign: -1,
    start: 1.5,
    max: 4,
    opposite: 'bodice-dart-high',
    needsBustDart: true,
  }),
  cmIssue({
    id: 'bodice-waist-tight',
    pro: 'Let out the waist by {v} in all: take {q} less into the waist dart of each front and back half.',
    note: 'waist ease +{v}',
    garment: 'bodice',
    area: 'Waist',
    title: 'Tight at the waist',
    detail: 'Strain lines pull across the waist.',
    fix: 'Adds ease at the waist; the darts take less.',
    keys: ['waistEase'],
    sign: 1,
    start: 1.5,
    max: 5,
    opposite: 'bodice-waist-loose',
  }),
  cmIssue({
    id: 'bodice-waist-loose',
    pro: 'Take in the waist by {v} in all: take {q} more into the waist dart of each front and back half.',
    note: 'waist ease -{v}',
    garment: 'bodice',
    area: 'Waist',
    title: 'Loose at the waist',
    detail: 'You can pinch out more than a centimetre at each side seam at the waist.',
    fix: 'Takes ease out of the waist; the darts take more.',
    keys: ['waistEase'],
    sign: -1,
    start: 1.5,
    max: 4,
    opposite: 'bodice-waist-tight',
  }),
  cmIssue({
    id: 'bodice-neck-gape',
    pro: 'Gaping neckline: pinch out {v} at the front neck edge and pivot it into the bust dart. Re-true the neckline and the dart.',
    note: 'neck gape of {v} pivoted into the bust dart',
    garment: 'bodice',
    area: 'Neck',
    title: 'Neckline gapes',
    detail: 'The front neckline stands away from your chest. Pinch out the gape to measure it.',
    fix: 'Closes the gape by pivoting it into the bust dart, so the neckline lies flat and the grain stays true.',
    keys: ['neckGape'],
    sign: 1,
    start: 1,
    max: 2.5,
    needsBustDart: true,
  }),
  {
    id: 'bodice-sloping',
    pro: 'Sloping shoulders: lower the shoulder point so each shoulder seam slopes {v} more, front and back, from the neck point. Re-blend the armhole.',
    note: 'shoulders {v} more sloping',
    garment: 'bodice',
    area: 'Shoulders',
    title: 'Folds from neck to underarm',
    detail: 'Diagonal folds run from the neck toward the underarm: your shoulders slope more than the pattern.',
    fix: 'Drops the shoulder point, sloping the shoulder seam more on the front and back.',
    keys: ['frontSlope', 'backSlope'],
    sign: 1,
    unit: 'degrees',
    start: 3,
    max: 8,
    step: 1,
    opposite: 'bodice-square',
  },
  {
    id: 'bodice-square',
    pro: 'Square shoulders: raise the shoulder point so each shoulder seam slopes {v} less, front and back, from the neck point. Re-blend the armhole.',
    note: 'shoulders {v} squarer',
    garment: 'bodice',
    area: 'Shoulders',
    title: 'Pulls from shoulder to neck',
    detail: 'Strain lines run from the shoulder tips up to the neck: your shoulders are squarer than the pattern.',
    fix: 'Raises the shoulder point, squaring the shoulder seam on the front and back.',
    keys: ['frontSlope', 'backSlope'],
    sign: -1,
    unit: 'degrees',
    start: 3,
    max: 8,
    step: 1,
    opposite: 'bodice-sloping',
  },
  cmIssue({
    id: 'bodice-armhole-tight',
    pro: "Lower the armhole by {v} at the underarm, front and back. Lower the sleeve's underarm to match.",
    note: 'armhole lowered {v}',
    garment: 'bodice',
    area: 'Armholes',
    title: 'Armhole cuts in',
    detail: 'The armhole digs in under the arm.',
    fix: 'Lowers the armhole at the underarm.',
    keys: ['armhole'],
    sign: 1,
    start: 1,
    max: 2.5,
    opposite: 'bodice-armhole-low',
  }),
  cmIssue({
    id: 'bodice-armhole-low',
    pro: "Raise the armhole by {v} at the underarm, front and back. Raise the sleeve's underarm to match.",
    note: 'armhole raised {v}',
    garment: 'bodice',
    area: 'Armholes',
    title: 'Armhole sits too low',
    detail: 'It shows your bra at the side, or gapes under the arm.',
    fix: 'Raises the armhole at the underarm.',
    keys: ['armhole'],
    sign: -1,
    start: 1,
    max: 2,
    opposite: 'bodice-armhole-tight',
  }),
  cmIssue({
    id: 'bodice-back-long',
    pro: 'Shorten the back by {v} between the underarm and the waist: fold out a level tuck, then re-blend the centre back and side seam.',
    note: 'back shortened {v}',
    garment: 'bodice',
    area: 'Back',
    title: 'Folds across the back waist',
    detail: 'Horizontal folds sit just above the waist at the back.',
    fix: 'Shortens the back between the underarm and the waist.',
    keys: ['backLength'],
    sign: -1,
    start: 1.5,
    max: 3,
  }),
  cmIssue({
    id: 'bodice-back-tight',
    pro: 'Widen the across back by {v} in all: add {h} to the back half at the across-back line, moving the back armhole out.',
    note: 'across back +{v}',
    garment: 'bodice',
    area: 'Back',
    title: 'Pulls across the back',
    detail: 'Strain lines cross the shoulder blades when you reach forward.',
    fix: 'Widens the across back, moving the back armhole out.',
    keys: ['acrossBack'],
    sign: 1,
    start: 1,
    max: 3,
  }),
  cmIssue({
    id: 'bodice-low-shoulder',
    pro: 'Low {side} shoulder: lower the {side} shoulder point and the {side} armhole by {v}. Cut the {side} side on the lower line.',
    note: '{side} shoulder {v} lower',
    garment: 'bodice',
    area: 'One side',
    title: 'One shoulder sits lower',
    detail: 'Folds run down from one shoulder, and its shoulder seam lies loose.',
    fix: 'Adds a second shoulder and armhole line for that side, dropped and lowered by the same amount.',
    keys: ['lowShoulder'],
    sign: 1,
    start: 1,
    max: 2.5,
    sided: true,
  }),
];

export const issueById = (id: string) => FIT_ISSUES.find((i) => i.id === id);

/** The skirt corrections trousers take: the waist, the hip and the centre waists (not darts or one hip). */
const TROUSER_KEYS = ['hipEase', 'waistEase', 'frontDrop', 'backDrop'];

/** Whether a correction applies to a garment. */
export function appliesTo(issue: FitIssue, garment: FitTarget): boolean {
  if (garment === 'dress') return true;
  // A knit T-shirt is cut from its own block and fits by stretch: the woven toiles' corrections don't carry over.
  if (isKnit(garment)) return false;
  // Jackets and coats are drafted on the bodice block, so they take the bodice's corrections.
  if (isOuterwear(garment)) return issue.garment === 'bodice';
  if (garment === 'trousers') return issue.garment === 'skirt' && issue.keys.every((k) => TROUSER_KEYS.includes(k));
  return issue.garment === garment;
}

/** One person's corrections for one garment: each issue seen, with how much, and which side. */
export interface Fitting {
  issues: Record<string, number>;
  sides?: Record<string, Side>;
  /** How many times the corrections have been saved: the pattern's version is one more. */
  round: number;
  /** When they were last saved, as YYYY-MM-DD. */
  date?: string;
  /** Earlier saved versions, oldest first, for comparing. */
  history?: Fitting[];
  /** Issues this toile was checked for when saved (ticked or not), so one cleared here isn't carried in. */
  checked?: string[];
}

export const NO_FITTING: Fitting = { issues: {}, round: 0 };

/** The corrections as the draft takes them. */
export function toFitting(f: Fitting | undefined, garment: 'skirt'): SkirtFitting;
export function toFitting(f: Fitting | undefined, garment: 'bodice'): BodiceFitting;
export function toFitting(f: Fitting | undefined, garment: FitGarment): SkirtFitting | BodiceFitting {
  const out: Record<string, unknown> = {};
  for (const [id, amount] of Object.entries(f?.issues ?? {})) {
    const issue = issueById(id);
    if (!issue || issue.garment !== garment || !(amount > 0)) continue;
    const v = Math.min(issue.max, amount);
    if (issue.sided) {
      out[issue.keys[0]] = { side: f?.sides?.[id] ?? 'right', cm: v };
      continue;
    }
    for (const k of issue.keys) out[k] = ((out[k] as number | undefined) ?? 0) + issue.sign * v;
  }
  return out as SkirtFitting | BodiceFitting;
}

const amount = (issue: FitIssue, v: number) => (issue.unit === 'cm' ? `${v} cm` : `${v} degrees`);

/** What changed, in a few words each, for the pattern's notes. */
export function describeFitting(f: Fitting | undefined, garment: FitTarget): string[] {
  return Object.entries(f?.issues ?? {})
    .map(([id, v]) => ({ issue: issueById(id), v }))
    // A dress is fitted as one toile: its bodice and its skirt corrections are kept together.
    .filter((x): x is { issue: FitIssue; v: number } => !!x.issue && appliesTo(x.issue, garment) && x.v > 0)
    .map(({ issue, v }) => issue.note.replace('{v}', amount(issue, Math.min(issue.max, v))).replace('{side}', f?.sides?.[issue.id] ?? 'right'));
}

/** Turn an issue on (at its starting amount, replacing its opposite) or off. */
export function toggleIssue(f: Fitting, id: string): Fitting {
  const issue = issueById(id);
  if (!issue) return f;
  const issues = { ...f.issues };
  if (issues[id]) delete issues[id];
  else {
    issues[id] = issue.start;
    if (issue.opposite) delete issues[issue.opposite];
  }
  return { ...f, issues };
}

/** Set an issue's amount, kept within its range. */
export function setAmount(f: Fitting, id: string, v: number): Fitting {
  const issue = issueById(id);
  if (!issue) return f;
  return { ...f, issues: { ...f.issues, [id]: Math.round(Math.min(issue.max, Math.max(issue.step, v)) * 10) / 10 } };
}

export interface Carried {
  /** The garment's own corrections, with those found on the person's other toiles filled in. */
  fitting: Fitting;
  /** Which corrections came from which other toile. */
  from: { id: string; garment: FitTarget }[];
}

/**
 * The person's fit as one record: a garment uses its own toile's corrections, and fills in what its
 * own toile hasn't covered from the others. A sway back found on the skirt goes into the dress; the
 * bodice's corrections go into the dress bodice; the dress's go back into a bodice or a skirt. Where two
 * other toiles disagree, the more recent one wins. A correction (or its opposite) on the garment's own
 * toile always wins.
 */
export function carriedFitting(fittings: Partial<Record<FitTarget, Fitting>> | undefined, garment: FitTarget): Carried {
  const own = fittings?.[garment];
  const issues = { ...(own?.issues ?? {}) };
  const sides = { ...(own?.sides ?? {}) };
  const from: Carried['from'] = [];
  const others = (Object.keys(fittings ?? {}) as FitTarget[])
    .filter((g) => g !== garment && fittings![g])
    .sort((a, b) => (fittings![b]!.date ?? '').localeCompare(fittings![a]!.date ?? ''));
  const covered = (id: string) => {
    const issue = issueById(id);
    return id in issues || (!!issue?.opposite && issue.opposite in issues);
  };
  for (const g of others) {
    const f = fittings![g]!;
    for (const [id, v] of Object.entries(f.issues)) {
      const issue = issueById(id);
      if (!issue || !(v > 0) || !appliesTo(issue, garment) || covered(id)) continue;
      // An issue the own toile already looked at and cleared stays cleared: only fill what it never saw.
      if (own?.checked?.includes(id)) continue;
      issues[id] = v;
      if (f.sides?.[id]) sides[id] = f.sides[id];
      from.push({ id, garment: g });
    }
  }
  return { fitting: { issues, sides, round: own?.round ?? 0, date: own?.date, history: own?.history }, from };
}

/** The corrections carried in from other toiles, in words, for the pattern's notes. */
export function describeCarried(c: Carried): string[] {
  const by = new Map<string, string[]>();
  for (const { id, garment } of c.from) {
    const issue = issueById(id)!;
    const v = c.fitting.issues[id];
    const words = issue.note.replace('{v}', amount(issue, Math.min(issue.max, v))).replace('{side}', c.fitting.sides?.[id] ?? 'right');
    by.set(garment, [...(by.get(garment) ?? []), words]);
  }
  return [...by.entries()].map(([g, ws]) => `From your ${g} toile: ${ws.join('; ')}`);
}

/**
 * Save a new version: the corrections as now, the previous version kept for comparing. `shown` lists the
 * corrections the toile was looked at for (those carried in from other toiles included), so one cleared
 * here stays cleared rather than being carried in again.
 */
export function saveVersion(prev: Fitting | undefined, next: Fitting, date: string, shown: string[] = []): Fitting {
  const { history: _h, ...was } = prev ?? NO_FITTING;
  void _h;
  const history = prev && prev.round > 0 ? [...(prev.history ?? []), was] : prev?.history ?? [];
  return { ...next, round: (prev?.round ?? 0) + 1, date, history, checked: [...new Set([...(prev?.checked ?? []), ...shown, ...Object.keys(next.issues)])] };
}

/** Every saved version of a fitting, oldest first: version 1 is the pattern before any toile. */
export function versionsOf(f: Fitting | undefined): { version: number; fitting: Fitting }[] {
  const out = [{ version: 1, fitting: NO_FITTING }];
  for (const h of f?.history ?? []) out.push({ version: h.round + 1, fitting: h });
  if (f && f.round > 0) out.push({ version: f.round + 1, fitting: f });
  return out;
}

export interface Alteration {
  area: string;
  /** What the toile showed. */
  seen: string;
  /** The alteration, in a pattern cutter's words, with the amounts worked out. */
  change: string;
}

const half = (issue: FitIssue, v: number, part: number) => amount(issue, Math.round((v / part) * 100) / 100);

/**
 * The person's toile corrections as an alteration sheet: the alterations a pattern cutter would make to
 * their own block in their own software (CLO, Gerber, Lectra, Seamly2D) to fit this person.
 */
export function alterationSheet(f: Fitting | undefined, garment: FitTarget): Alteration[] {
  return Object.entries(f?.issues ?? {})
    .map(([id, v]) => ({ issue: issueById(id), v }))
    .filter((x): x is { issue: FitIssue; v: number } => !!x.issue && appliesTo(x.issue, garment) && x.v > 0)
    .map(({ issue, v }) => {
      const n = Math.min(issue.max, v);
      return {
        area: issue.area,
        seen: issue.title,
        change: issue.pro
          .replace(/\{v\}/g, amount(issue, n))
          .replace(/\{h\}/g, half(issue, n, 2))
          .replace(/\{q\}/g, half(issue, n, 4))
          .replace(/\{side\}/g, f?.sides?.[issue.id] ?? 'right'),
      };
    });
}
