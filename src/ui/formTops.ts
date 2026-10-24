// Draw on your form, for the T-shirt and for jackets and coats. These patterns come in set options
// rather than drawn shapes, so each line picks the option nearest to it, and says so when the line
// asked for more than the pattern can do:
// - the T-shirt: a neckline is crew, scoop or V, by how deep it falls at the centre front and whether
//   it runs straight to a point; the side line is the fit, from the room at the bust in the knit's
//   stretch; a hem is cropped, hip or tunic length, always level; a line across the arm is the sleeve.
// - a jacket or coat: a hem is the nearest of its lengths, level; the side line is the fit; a line
//   down the front is the front edge, single- or double-breasted by how far past the centre it sits;
//   a line from the shoulder down the front is the collar, notched lapels when it runs down to the
//   bust and collarless when it curves round to the centre high up; a line through the bust down to
//   the waist is princess seams, and any other shaping line keeps the darts.
// The same coordinates as formLines.ts: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import { TEE_EASE, TEE_NECKS, TeeDraft, TeeFit, TeeLength, TeeMeasurements, TeeNeck, TeeSleeve, draftTee, pctWords } from '../engine/tee';
import { OUTER_EASE, OUTER_EXTENSION, OUTER_LENGTHS, OuterDraft, OuterFit, OuterFront, OuterMeasurements, outerDrop } from '../engine/outerwear';
import { OUTER_LENGTH_WORDS, OuterChoices, TeeChoices } from '../garments';
import { FormArm, FormBody, armAt, armFor, torsoForm } from './DrawOnForm';
import { APEX_REACH, FormLine, Reading, WAIST_REACH, bodiceLines, edgeAt, half, landmarks, median, mirror, standingBand } from './formLines';

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The option whose value is nearest to v. */
const nearest = <K extends string>(options: K[], at: (k: K) => number, v: number) => options.reduce((a, b) => (Math.abs(at(b) - v) < Math.abs(at(a) - v) ? b : a));

/** The edge of a piece's outline tagged `tag`, from its first point to its last, passing over anything
 * that interrupts it (a bust dart in the side seam). */
function edgeRun(pc: Piece, tag: string): P[] {
  const { pts, tags } = pc.outline.taggedPoints(16);
  const run: P[] = [];
  tags.forEach((t, i) => {
    if (t !== tag) return;
    if (run[run.length - 1] !== pts[i]) run.push(pts[i]);
    run.push(pts[i + 1]);
  });
  return run;
}

/** The side line's distance out from the centre beside the bust, or none when it isn't drawn there. */
function sideAt(stroke: P[], bustY: number, waistY: number) {
  const nearBust = stroke.filter((q) => q.y > bustY - 6 && q.y < waistY - 4);
  const pts = nearBust.length >= 3 ? nearBust : stroke;
  return pts.length ? median(pts.map((q) => Math.abs(q.x))) : undefined;
}

// ---- The T-shirt -----------------------------------------------------------------------------

const TEE_FITS: TeeFit[] = ['fitted', 'regular', 'relaxed'];
const NECKS: TeeNeck[] = ['crew', 'scoop', 'v', 'mock'];
const LENGTHS: TeeLength[] = ['cropped', 'hip', 'tunic'];
const SLEEVES: TeeSleeve[] = ['short', 'elbow', 'long'];
const NECK_WORDS: Record<TeeNeck, string> = { crew: 'A crew neck', scoop: 'A scoop neck', v: 'A V-neck', mock: 'A mock neck' };
const SLEEVE_WORDS: Record<TeeSleeve, string> = { short: 'Short sleeves', elbow: 'Elbow-length sleeves', long: 'Long sleeves' };

export type TeeFormMeasurements = TeeMeasurements & { bust_depth?: number; wrist?: number };

/** The T-shirt's form, its arms, and where each of its options falls on it. */
export interface TeeForm {
  body: FormBody;
  arm: FormArm;
  bustY: number;
  /** For each option: how low the neckline is at the centre front, the hem's height, and the sleeve's length from the shoulder. */
  necks: Record<TeeNeck, number>;
  hems: Record<TeeLength, number>;
  sleeves: Record<TeeSleeve, number>;
}

/** The form built from the T-shirt's measurements, in the tee's own coordinates (the neck point about 2 cm above the nape). */
export function teeForm(m: TeeFormMeasurements, c: TeeChoices, draft: TeeDraft): TeeForm {
  const [front] = draft.pieces;
  const shoulder = edgeRun(front, 'shoulder');
  const [hps, sp] = [shoulder[0], shoulder[shoulder.length - 1]];
  // The body's own neck point and shoulder tip, along the drafted shoulder line (a relaxed tee runs past the shoulder).
  const along = (x: number) => ({ x, y: hps.y + ((x - hps.x) * (sp.y - hps.y)) / (sp.x - hps.x) });
  const tip = along(m.shoulder_width / 2);
  const neckPoint = along(m.neck / 5);
  const bustY = m.bust_depth ? neckPoint.y + m.bust_depth : draft.armholeDepth + 3;
  const body = torsoForm({ neckPoint, shoulderTip: tip, apex: { x: 0, y: bustY }, waistY: m.nape_to_waist }, m);
  const underY = draft.armholeDepth - 2;
  const arm = armFor(tip, { x: body.width(underY), y: underY }, { arm_length: m.arm_length!, upper_arm: m.upper_arm!, wrist: m.wrist });
  // Each option drafted, to see where it falls; the one chosen is the draft already made.
  const variant = <K extends 'neckline' | 'length' | 'sleeve'>(k: K, v: TeeChoices[K]) => (c[k] === v ? draft : draftTee(m, { ...c, [k]: v }));
  const each = <K extends string>(options: K[], value: (k: K) => number) => Object.fromEntries(options.map((k) => [k, value(k)])) as Record<K, number>;
  return {
    body,
    arm,
    bustY,
    necks: each(NECKS, (n) => variant('neckline', n).pieces[0].outline.start.y),
    hems: each(LENGTHS, (l) => variant('length', l).backLength + TEE_NECKS[c.neckline].backDepth),
    sleeves: each(SLEEVES, (s) => variant('sleeve', s).sleeve.lengthCm),
  };
}

/** A neckline from the shoulder to the centre front: crew close to the neck; lower, a V when it runs straight to its point, otherwise a scoop. */
export function readTeeNeckline(stroke: P[], tf: TeeForm, c: TeeChoices): Reading<TeeChoices> {
  const pts = half(stroke);
  if (pts.length < 2) return { said: 'Draw the neckline from the shoulder down to the centre front.' };
  const centre = pts.reduce((a, q) => (q.x < a.x ? q : a));
  if (centre.x > 4) return { said: 'Carry the neckline on down to the centre front.' };
  const top = pts.reduce((a, q) => (q.y < a.y ? q : a));
  // How far the line bows away from straight between the shoulder and the centre, for its length.
  const chord = dist(top, centre) || 1;
  const bow = Math.max(...pts.map((q) => Math.abs((centre.x - top.x) * (top.y - q.y) - (top.x - q.x) * (centre.y - top.y)) / chord)) / chord;
  const y = centre.y;
  const low = Math.abs(y - tf.necks.crew) > Math.abs(y - Math.min(tf.necks.scoop, tf.necks.v));
  // A line close round the neck keeps a mock neck, whose band stands above it.
  const neckline: TeeNeck = !low ? (c.neckline === 'mock' ? 'mock' : 'crew') : bow < 0.08 ? 'v' : 'scoop';
  const depth = Math.round(tf.necks[neckline] - tf.necks.crew);
  const off = Math.abs(y - tf.necks[neckline]) > 3 ? ' The T-shirt’s necklines come at set depths, and this is the nearest to your line.' : '';
  return {
    choices: { ...c, neckline },
    said: `${NECK_WORDS[neckline]}${neckline === 'crew' || neckline === 'mock' ? ', close round the neck' : `, ${depth} cm lower than a crew at the centre front`}.${off}`,
  };
}

/** The side line: the fit, from the room it leaves at the bust, for the knit's stretch. */
export function readTeeFit(stroke: P[], tf: TeeForm, m: TeeMeasurements, c: TeeChoices): Reading<TeeChoices> {
  const x = sideAt(stroke, tf.bustY, tf.body.waistY);
  if (x === undefined || x < m.full_bust / 8) return { said: 'Draw down the side of the body, where the side seam goes.' };
  const drawn = (4 * x) / m.full_bust - 1;
  const fit = nearest(TEE_FITS, (f) => TEE_EASE[f][c.stretch], drawn);
  const ease = TEE_EASE[fit][c.stretch];
  const off = Math.abs(drawn - ease) > 0.05 ? ' It is the nearest of the three fits to your line.' : '';
  return {
    choices: { ...c, fit },
    said: `${cap(fit)}: ${pctWords(ease)} ease at the bust in your ${c.stretch}-stretch knit${ease < 0 ? ', so it stretches on to fit' : ''}.${off}`,
  };
}

/** A hem: the nearest length. A T-shirt hem is cut level, so a curved line sets its length only. */
export function readTeeHem(stroke: P[], tf: TeeForm, c: TeeChoices): Reading<TeeChoices> {
  if (!stroke.length) return { said: 'Draw across the body where you want the hem.' };
  const ys = stroke.map((q) => q.y);
  const y = median(ys);
  const length = nearest(LENGTHS, (l) => tf.hems[l], y);
  const words: Record<TeeLength, string> = {
    cropped: 'Cropped: the hem just below your waist.',
    hip: 'Hip length: the hem at your hip.',
    tunic: `Tunic length: the hem ${Math.round(tf.hems.tunic - tf.hems.hip)} cm below your hip.`,
  };
  const curved = Math.max(...ys) - Math.min(...ys) > 4 ? ' A T-shirt hem is cut level, so your line sets its length, at the middle.' : '';
  const off = Math.abs(y - tf.hems[length]) > 5 ? ' It is the nearest of the three lengths to your line.' : '';
  return { choices: { ...c, length }, said: words[length] + curved + off };
}

/** A line across the arm: the sleeve length, from the shoulder to where it crosses. */
export function readTeeSleeve(stroke: P[], tf: TeeForm, c: TeeChoices): Reading<TeeChoices> {
  const { arm } = tf;
  const on = stroke.filter((q) => {
    const a = armAt(arm, q.y);
    return q.y > arm.tip.y && q.y < arm.wristY + 3 && Math.abs(q.x) > a.inner - 2 && Math.abs(q.x) < a.outer + 2;
  });
  if (on.length < 2) return { said: 'Draw across the arm where you want the sleeve to end.' };
  const drawn = median(on.map((q) => q.y)) - arm.tip.y;
  const sleeve = nearest(SLEEVES, (s) => tf.sleeves[s], drawn);
  const off = Math.abs(drawn - tf.sleeves[sleeve]) > 5 ? ' It is the nearest of the three sleeve lengths to your line.' : '';
  return { choices: { ...c, sleeve }, said: `${SLEEVE_WORDS[sleeve]}, ${Math.round(tf.sleeves[sleeve])} cm from the shoulder.${off}` };
}

/** The T-shirt's lines as they stand: the neckline, the side, the hem and where the sleeves end. */
export function teeLines(draft: TeeDraft, tf: TeeForm): Partial<Record<FormLine, P[][]>> {
  const [front, back] = draft.pieces;
  const y = tf.arm.tip.y + draft.sleeve.lengthCm;
  const a = armAt(tf.arm, y);
  // A front shaped for the bust is cut longer at the centre, and the bust takes that up: worn, the hem
  // hangs level with the back's, so it's drawn there.
  const level = edgeRun(back, 'hem')[0].y;
  const neck = edgeRun(front, 'neck');
  return {
    neckline: mirror(neck),
    // A mock neck's band stands up from the neckline, hugging the neck.
    ...(draft.neckline === 'mock' ? { collar: standingBand(neck, draft.neckband.width, 0.96) } : {}),
    fit: mirror(edgeRun(front, 'side')),
    hem: mirror(edgeRun(front, 'hem').map((q) => ({ x: q.x, y: level }))),
    sleeve: mirror([{ x: a.inner, y }, { x: a.outer, y }]),
  };
}

// ---- Jackets and coats -----------------------------------------------------------------------

const OUTER_FITS: OuterFit[] = ['fitted', 'regular', 'relaxed'];
const FRONTS: OuterFront[] = ['single', 'double'];

/** A hem: the nearest of the garment's lengths, cut level. */
export function readOuterHem(stroke: P[], draft: OuterDraft, m: OuterMeasurements, c: OuterChoices): Reading<OuterChoices> {
  if (!stroke.length) return { said: 'Draw across the body where you want the hem.' };
  const kind = c.garment;
  const ys = stroke.map((q) => q.y);
  const drop = median(ys) - landmarks(draft.base).waistY;
  const lengths = OUTER_LENGTHS[kind];
  const length = nearest(lengths, (l) => outerDrop(m, l), drop);
  const words = [`${OUTER_LENGTH_WORDS[length]} ${kind}: the hem ${Math.round(outerDrop(m, length))} cm below your waist.`];
  if (kind === 'jacket' && drop > outerDrop(m, 'long') + 8) words.push('A jacket goes no longer than this; for a longer hem, make a coat.');
  else if (kind === 'coat' && drop < outerDrop(m, 'thigh') - 8) words.push('A coat goes no shorter than this; for a shorter hem, make a jacket.');
  if (Math.max(...ys) - Math.min(...ys) > 4) words.push('The hem is cut level, so your line sets its length, at the middle.');
  if (length === 'cropped' && c.vent === 'centre') words.push('It is too short for a back vent, so it has none.');
  return { choices: { ...c, length, ...(length === 'cropped' ? { vent: 'none' as const } : {}) }, said: words.join(' ') };
}

/** The side line: the fit, from the room it leaves at the bust. */
export function readOuterFit(stroke: P[], draft: OuterDraft, m: OuterMeasurements, c: OuterChoices): Reading<OuterChoices> {
  const { apex, waistY } = landmarks(draft.base);
  const x = sideAt(stroke, apex.y, waistY);
  if (x === undefined || x < m.full_bust / 8) return { said: 'Draw down the side of the body, where the side seam goes.' };
  const room = 4 * x - m.full_bust;
  const ease = OUTER_EASE[c.garment];
  const fit = nearest(OUTER_FITS, (f) => ease[f], room);
  // A fitted cut keeps its waist darts, as on the style screen.
  const boxy = fit === 'fitted' && c.shaping === 'boxy';
  const words = [`${cap(fit)}: ${ease[fit]} cm of room at the bust.`];
  if (Math.abs(room - ease[fit]) > 3) words.push('It is the nearest of the three fits to your line.');
  if (boxy) words.push(`A fitted ${c.garment} keeps its waist darts, so it is no longer boxy.`);
  return { choices: { ...c, fit, ...(boxy ? { shaping: 'darts' as const } : {}) }, said: words.join(' ') };
}

/** A line down the front: the front edge, single-breasted just past the centre, double-breasted further across. */
export function readOuterFront(stroke: P[], draft: OuterDraft, c: OuterChoices): Reading<OuterChoices> {
  const pts = half(stroke);
  const ys = pts.map((q) => q.y);
  if (pts.length < 2 || Math.max(...ys) - Math.min(...ys) < 8) return { said: 'Draw down the front, from the neck towards the hem, where the front edge should sit.' };
  const x = median(pts.map((q) => q.x));
  if (x > landmarks(draft.base).apex.x + 4) return { said: 'The front edge runs down near the centre front. Draw it closer in.' };
  const ext = OUTER_EXTENSION[c.garment];
  const front = nearest(FRONTS, (f) => ext[f], x);
  return {
    choices: { ...c, front },
    said: front === 'single' ? `Single-breasted: the edge ${ext.single} cm past the centre front, with one row of buttons.` : `Double-breasted: the edge ${ext.double} cm past the centre front, with two rows of buttons.`,
  };
}

/** A line from the shoulder down the front: notched lapels when it runs down to the bust, collarless when it curves round to the centre. */
export function readOuterCollar(stroke: P[], draft: OuterDraft, c: OuterChoices): Reading<OuterChoices> {
  const pts = half(stroke);
  if (pts.length < 2) return { said: 'Draw from the shoulder, by the neck, down the front.' };
  const { neckPoint, apex } = landmarks(draft.base);
  const top = pts.reduce((a, q) => (q.y < a.y ? q : a));
  const low = pts.reduce((a, q) => (q.y > a.y ? q : a));
  if (dist(top, neckPoint) > 6) return { said: 'Start at the shoulder, by the neck, and draw down the front.' };
  if (low.y >= apex.y - 8) {
    // The lapels roll from the top button, which the front sets: a little above the bust when double-breasted.
    const breakY = draft.lapel?.breakPt.y;
    const set = c.collar === 'notched' && breakY !== undefined && Math.abs(low.y - breakY) > 6 ? ' They roll back from the top button, so the front sets how low they go.' : '';
    return { choices: { ...c, collar: 'notched' }, said: `Notched lapels, rolling back from the neck to the top button.${set}` };
  }
  if (low.x < 5) {
    const neckY = draft.block[0].outline.start.y;
    const set = Math.abs(low.y - neckY) > 4 ? ' The neck keeps its own depth, a little below yours at the centre front.' : '';
    return { choices: { ...c, collar: 'collarless' }, said: `Collarless: a plain neck edge, faced inside.${set}` };
  }
  return { said: 'Carry the line down to the bust for lapels, or round to the centre front for a collarless neck.' };
}

/** A shaping line: through the bust down to the waist is princess seams; any other keeps the darts. */
export function readOuterShaping(stroke: P[], draft: OuterDraft, c: OuterChoices): Reading<OuterChoices> {
  const pts = half(stroke);
  if (pts.length < 2) return { said: 'Draw from the armhole through the bust down to the waist for princess seams.' };
  const { apex, waistY } = landmarks(draft.base);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const [high, low] = a.y <= b.y ? [a, b] : [b, a];
  const throughBust = pts.some((q) => dist(q, apex) <= APEX_REACH);
  if (throughBust && low.y >= waistY - WAIST_REACH && high.y < apex.y) {
    const from = edgeAt(draft.base, high)?.edge;
    const moved = from === 'shoulder' || from === 'neck' ? ` A ${c.garment}’s princess seams start at the armhole, so yours start there.` : '';
    return { choices: { ...c, shaping: 'princess' }, said: `Princess seams from the armhole, through the bust, down to the hem.${moved}` };
  }
  return {
    choices: { ...c, shaping: 'darts' },
    said: `Darts at the bust and the waist.${throughBust ? ' Carry the line on down to the waist for princess seams.' : ' A line through the bust, down to the waist, makes princess seams.'}`,
  };
}

/** The jacket's or coat's lines as they stand: the hem, the side, the front edge, the lapels or neck, and the seams or darts. */
export function outerLines(draft: OuterDraft): Partial<Record<FormLine, P[][]>> {
  const [front] = draft.block;
  const hem = edgeRun(front, 'hem');
  const foot = Math.max(...hem.map((q) => q.y));
  const top = draft.lapel?.breakPt.y ?? front.outline.start.y;
  const collar = draft.lapel ? [...mirror(draft.lapel.worn), ...mirror(draft.lapel.roll)] : mirror(edgeRun(front, 'neck'));
  return {
    hem: mirror(hem),
    fit: mirror(edgeRun(front, 'side')),
    front: [[{ x: draft.ext, y: top }, { x: draft.ext, y: foot }]],
    collar,
    // A raglan's seam runs from the neck down to the armhole, in place of the shoulder seam.
    seam: [...(bodiceLines(draft.base, 'front').seam ?? []), ...(draft.base.raglan ? mirror(draft.base.raglan.front.line) : [])],
  };
}
