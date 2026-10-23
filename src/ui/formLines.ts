// Draw on your form: lines drawn with a finger on a dress form built from your measurements, read
// the way a draper reads style tape and pinned cloth on a form. Each line becomes a choice the pattern
// already knows, placed where it was drawn:
// - a neckline: its depth, width along the shoulder and fullness (as "Draw neck" reads it), front or
//   back; one drawn from a shoulder across to under the other arm is a one-shoulder neckline;
// - a seam or dart: drawn from an edge towards the bust point. One that runs on down to the waist is
//   a princess seam (from the shoulder or the armhole); one that stops at the bust is the bust dart,
//   moved to the edge it starts from. Either starts where along the edge it was drawn;
// - drape: cloth hung between the shoulders is a cowl, as deep as it was drawn; a flare below the
//   waist is a peplum (gathered when the line is wavy);
// - fit: the side line pinned in or let out, for the ease;
// - a hem: level, curved, or longer at the back (high-low), for the bodice, the dress or the skirt.
// The T-shirt's and the jacket's lines (sleeve, front edge, collar among them) are read in formTops.ts.
// Everything is in the pieces' own coordinates: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import { BodiceDraft, BodiceMeasurements } from '../engine/bodice';
import type { DartPlace, PrincessLine } from '../engine/manipulate';
import { isTop } from '../engine/corset';
import { COWL_DEPTH_RANGE } from '../engine/drape';
import { BodiceChoices, DARTS_FOR_FIT, detailAllowed, validDetails } from '../garments';
import { FIT_EASE, Fit, Length, SkirtDraft, SkirtMeasurements, lengthRange } from '../engine/skirt';
import { HEM_SAMPLES, matchSides, offsetAt } from '../engine/hem';
import { asymOffset, planFor } from '../engine/asymHem';
import { volumeOf } from '../engine/skirtVolume';
import type { Choices } from '../App';
import { blockOf } from '../engine/bodice';
import { currentNeck, dragDrop, dragEase, strokeToNeck, worn } from './BodiceShape';
import { dragFlare, dragLength, strokeToHem } from './ShapeSketch';

export type FormLine = 'neckline' | 'seam' | 'drape' | 'fit' | 'hem' | 'sleeve' | 'front' | 'collar';
export type FormSide = 'front' | 'back';

/** What a drawn line was read as: the new choices, or none when it couldn't be used, and why, in words. */
export interface Reading<C> {
  choices?: C;
  said: string;
}

type Garment = 'bodice' | 'dress';
type Edge = 'neck' | 'shoulder' | 'armhole' | 'side' | 'waist';
const EDGES: Edge[] = ['neck', 'shoulder', 'armhole', 'side', 'waist'];

/** How close a line must start to an edge, how close it must pass the bust point, and how near the
 * waist a seam must reach to be a princess seam, in cm. */
export const EDGE_REACH = 5;
export const APEX_REACH = 6;
export const WAIST_REACH = 4;

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export const half = (stroke: P[]) => stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
const round = (v: number, step: number) => Math.round(v / step) * step;
export const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Where a point sits on the segment a to b: how far from it, and how far along it (0 to 1). */
const project = (q: P, a: P, b: P) => {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / l2)) : 0;
  return { d: dist(q, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }), t };
};

/** Where the body's landmarks sit on the front or back: the neck point, shoulder tip, underarm and waist. */
export function landmarks(draft: BodiceDraft, side: FormSide = 'front') {
  const { pts, tags } = worn(draft, side).top;
  const first = (tag: string) => pts[Math.max(0, tags.indexOf(tag))];
  const land = side === 'front' ? draft.front : draft.back;
  return {
    neckPoint: first('shoulder'),
    shoulderTip: first('armhole'),
    underarm: first('side'),
    // The back has no bust point: its seams pass the point of the waist dart, about level with it.
    apex: draft.front.apex,
    waistY: land.waistCentre.y,
    // Each stretch of the outline, from one point to the next, and the edge it belongs to, in order.
    edges: pts.slice(0, -1).map((a, i) => ({ a, b: pts[i + 1], tag: tags[i] })).filter((e): e is { a: P; b: P; tag: Edge } => EDGES.includes(e.tag as Edge)),
  };
}

/** The edge of the piece a point sits on, if it is near one, and how far along that edge (0 to 1, in
 * the outline's own order: from the neck point along the shoulder, from the shoulder down the armhole). */
export function edgeAt(draft: BodiceDraft, at: P, side: FormSide = 'front'): { edge: Edge; along: number } | undefined {
  const { edges } = landmarks(draft, side);
  let best: { i: number; d: number; t: number } | undefined;
  edges.forEach((e, i) => {
    const pr = project(at, e.a, e.b);
    if (!best || pr.d < best.d) best = { i, d: pr.d, t: pr.t };
  });
  if (!best || best.d > EDGE_REACH) return undefined;
  const tag = edges[best.i].tag;
  // The run of that edge the nearest stretch is in, and how far along it the point falls.
  let a = best.i;
  while (a > 0 && edges[a - 1].tag === tag) a--;
  let b = best.i;
  while (b < edges.length - 1 && edges[b + 1].tag === tag) b++;
  const lens = edges.slice(a, b + 1).map((e) => dist(e.a, e.b));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  const before = lens.slice(0, best.i - a).reduce((s, l) => s + l, 0);
  return { edge: tag, along: Math.min(1, Math.max(0, (before + lens[best.i - a] * best.t) / total)) };
}

/** A line drawn across the centre from high on one side to low on the other: a one-shoulder edge. */
function slanting(stroke: P[], draft: BodiceDraft) {
  const { shoulderTip, underarm } = landmarks(draft);
  const [a, b] = [stroke[0], stroke[stroke.length - 1]];
  const [high, low] = a.y <= b.y ? [a, b] : [b, a];
  return Math.sign(high.x) !== Math.sign(low.x) && Math.abs(high.x) > 2 && high.y < shoulderTip.y + 4 && low.y > underarm.y - 6 && Math.abs(low.x) > underarm.x * 0.6 ? { high, low } : undefined;
}

export function readNeckline(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice', side: FormSide = 'front'): Reading<BodiceChoices> {
  if (isTop(c.neckline)) return { said: 'A strapless, sweetheart or cami top has no neckline to draw. Pick a higher neckline first.' };
  if (side === 'front') {
    const slant = slanting(stroke, draft);
    if (slant) return oneShoulder(slant.high, c, garment);
  }
  const neck = strokeToNeck(half(stroke), side, draft, currentNeck(c));
  if (!neck) return { said: 'Draw down from the shoulder to where you want the neckline to sit.' };
  const { cowlDepth: _c, unevenNeck: _u, ...rest } = c;
  // A drawn neckline replaces a draped or uneven one: the bodice goes back to its round neck, reshaped.
  const base = c.neckline === 'one_shoulder' || c.neckline === 'cowl' ? { ...rest, neckline: 'scoop' as const } : rest;
  return {
    choices: validDetails({ ...base, neck }, garment),
    said: side === 'front' ? `Neckline ${Math.round(neck.frontDepth)} cm below your neck at the centre front.` : `Back neckline ${Math.round(neck.backDepth)} cm below the nape.`,
  };
}

function oneShoulder(high: P, c: BodiceChoices, garment: Garment): Reading<BodiceChoices> {
  const { neck: _n, cowlDepth: _c, shoulder: _s, unevenNeck: _u, ...rest } = c;
  // Facing the form, the wearer's left is on your right.
  const shoulder = high.x < 0 ? ('right' as const) : ('left' as const);
  const next = validDetails({ ...rest, neckline: 'one_shoulder', ...(shoulder === 'right' ? { shoulder } : {}) }, garment);
  return { choices: next, said: `One-shoulder neckline over your ${shoulder} shoulder, sleeveless, with a zip in the ${shoulder === 'right' ? 'left' : 'right'} side seam.` };
}

const DART_WORDS: Record<DartPlace, string> = {
  side: 'the side seam',
  french: 'low on the side seam, as a French dart',
  shoulder: 'the shoulder',
  neck: 'the neckline',
  armhole: 'the armhole',
  waist: 'the waist',
};

/** A seam or dart drawn from an edge towards the bust point (on the back, a princess seam only). */
export function readSeam(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice', side: FormSide = 'front'): Reading<BodiceChoices> {
  const pts = half(stroke);
  if (pts.length < 2) return { said: 'Draw a line from an edge of the bodice towards the bust point.' };
  const { apex, waistY } = landmarks(draft, side);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  // Either end can be drawn first. A line from above the bust down to the waist starts at its top;
  // a shorter one starts at whichever end is further from the bust point.
  const [high, low] = a.y <= b.y ? [a, b] : [b, a];
  const toWaist = low.y >= waistY - WAIST_REACH && high.y < apex.y;
  const origin = toWaist ? high : dist(a, apex) >= dist(b, apex) ? a : b;
  if (side === 'front' && !pts.some((q) => dist(q, apex) <= APEX_REACH)) return { said: 'Seams and darts run to the bust point. Draw through the fullest part of the bust.' };
  const at = edgeAt(draft, origin, side);
  if (!at) return { said: 'Start the line at an edge: the neckline, shoulder, armhole, side seam or waist.' };
  if (isTop(c.neckline) || c.structure === 'boned') return { said: 'A top cut below the shoulders keeps its own panels.' };
  const lineAt = round(at.along, 0.05);

  if (toWaist && at.edge !== 'side' && at.edge !== 'waist') {
    const princess: PrincessLine = at.edge === 'armhole' ? 'armhole' : 'shoulder';
    if (!DARTS_FOR_FIT[c.fit].includes('bust_waist')) return { said: 'Princess seams need a fitted or regular fit.' };
    const next = { ...c, darts: 'bust_waist' as const, princess, bustDart: 'side' as const, lineAt: at.edge === 'neck' ? 0.2 : lineAt };
    if (!detailAllowed(next, 'princess', princess, garment)) return { said: 'This neckline is draped, so it takes no princess seams.' };
    return { choices: validDetails(next, garment), said: `Princess seams from the ${princess}, front and back, where you drew them.` };
  }
  if (side === 'back') return { said: 'On the back, draw a princess seam from the shoulder or armhole down to the waist.' };

  const bustDart: DartPlace = at.edge === 'side' ? (origin.y > apex.y + 3 ? 'french' : 'side') : at.edge;
  const darts = c.darts === 'none' ? DARTS_FOR_FIT[c.fit].find((d) => d !== 'none') : c.darts;
  if (!darts) return { said: 'A bodice with no darts has no bust dart to move. Choose a closer fit first.' };
  const { lineAt: _l, ...rest } = c;
  const placed = bustDart === 'shoulder' || bustDart === 'neck' || bustDart === 'armhole';
  const next = { ...rest, darts, princess: 'none' as const, bustDart, ...(placed ? { lineAt } : {}) };
  if (!detailAllowed(next, 'bustDart', bustDart, garment)) {
    return { said: bustDart === 'waist' ? 'The bust dart goes to the waist only on a waist-length bodice.' : 'This neckline keeps its bust dart in the side seam.' };
  }
  return { choices: validDetails(next, garment), said: `Bust dart moved to ${DART_WORDS[bustDart]}${placed ? ', where you drew it' : ''}.` };
}

/** How many times a line turns back on itself up and down: a wavy line is gathered cloth. */
const waves = (stroke: P[]) => {
  let turns = 0;
  let dir = 0;
  for (let i = 2; i < stroke.length; i += 2) {
    const dy = stroke[i].y - stroke[i - 2].y;
    if (Math.abs(dy) < 0.4) continue;
    const s = Math.sign(dy);
    if (dir && s !== dir) turns++;
    dir = s;
  }
  return turns;
};

/**
 * Cloth draped on the form. Hung across the front between the shoulders it is a cowl, as deep as the
 * line falls at the centre; from one shoulder across to under the other arm, a one-shoulder edge;
 * flared out below the waist, a peplum, gathered if the line is wavy.
 */
export function readDrape(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice'): Reading<BodiceChoices> {
  if (stroke.length < 3) return { said: 'Draw how the cloth hangs: across the neck for a cowl, or flaring below the waist for a peplum.' };
  const { neckPoint, waistY } = landmarks(draft);
  const xs = stroke.map((q) => q.x);
  const across = Math.min(...xs) < -2 && Math.max(...xs) > 2;
  const slant = slanting(stroke, draft);
  if (slant) {
    if (isTop(c.neckline) || c.structure === 'boned') return { said: 'Pick a neckline with shoulders first.' };
    return oneShoulder(slant.high, c, garment);
  }
  if (across && Math.max(...stroke.map((q) => q.y)) < waistY - 8) {
    if (isTop(c.neckline) || c.structure === 'boned') return { said: 'A cowl hangs from the shoulders. Pick a neckline with shoulders first.' };
    const centre = stroke.reduce((m, q) => (Math.abs(q.x) < Math.abs(m.x) ? q : m));
    const depth = Math.min(COWL_DEPTH_RANGE.max, Math.max(COWL_DEPTH_RANGE.min, round(centre.y - draft.neckBlock.front.neckY, 0.5)));
    const { neck: _n, unevenNeck: _u, ...rest } = c;
    const next = validDetails({ ...rest, neckline: 'cowl', cowlDepth: depth }, garment);
    return { choices: next, said: `A cowl, falling ${depth} cm below your neck in soft folds. It is cut on the bias, so it needs a fluid fabric.` };
  }
  if (Math.min(...stroke.map((q) => q.y)) > waistY - 3 && Math.max(...stroke.map((q) => Math.abs(q.x))) > 4) {
    if (garment === 'dress') return { said: 'A peplum goes on a bodice, not a dress. The skirt carries the fullness here.' };
    if (c.structure === 'boned' && c.neckline === 'strapless') {
      // A boned bodice takes a peplum too: no change to what is allowed.
    }
    const peplum = waves(stroke) >= 3 ? ('gathered' as const) : ('flared' as const);
    const { dropCm: _d, ...rest } = c;
    const next = { ...rest, length: 'waist' as const, peplum };
    if (!detailAllowed(next, 'peplum', peplum, garment)) return { said: 'A peplum needs a waist-length bodice.' };
    return { choices: validDetails(next, garment), said: `A ${peplum} peplum at the waist${peplum === 'gathered' ? ' (your wavy line reads as gathers)' : ''}. The bodice is waist length to take it.` };
  }
  void neckPoint;
  return { said: 'Draw across the neck from shoulder to shoulder for a cowl, from one shoulder to under the other arm for one shoulder, or out from the waist for a peplum.' };
}

/** The side line pinned in or let out: the room at the bust, from where the line sits beside the body. */
export function readFit(stroke: P[], draft: BodiceDraft, m: BodiceMeasurements, c: BodiceChoices): Reading<BodiceChoices> {
  const { apex, waistY } = landmarks(draft);
  const nearBust = stroke.filter((q) => q.y > apex.y - 6 && q.y < waistY - 4);
  const pts = nearBust.length >= 3 ? nearBust : stroke;
  if (!pts.length) return { said: 'Draw down the side of the body, closer in or further out.' };
  const x = median(pts.map((q) => Math.abs(q.x)));
  if (x < m.full_bust / 8) return { said: 'Draw down the side of the body, where the side seam goes.' };
  const next = dragEase(c, 4 * x - m.full_bust);
  const ease = next.bustEase ?? undefined;
  return { choices: next, said: ease !== undefined ? `${ease} cm of room at the bust, pinned where you drew it.` : `A ${next.fit} fit at the bust.` };
}

export function readBodiceHem(stroke: P[], draft: BodiceDraft, m: BodiceMeasurements, c: BodiceChoices): Reading<BodiceChoices> {
  if (!stroke.length) return { said: 'Draw across the body where you want the hem.' };
  if (!m.full_hip || !m.waist_to_hip) return { said: 'For a longer bodice, add your full hip and waist to hip.' };
  const ys = stroke.map((q) => q.y);
  const next = dragDrop(m, c, median(ys) - landmarks(draft).waistY);
  const curved = Math.max(...ys) - Math.min(...ys) > 4 ? ' A bodice hem stays level; it is set at the middle of your line.' : '';
  const said =
    next.dropCm !== undefined ? `Hem ${Math.round(next.dropCm)} cm below the waist.` : next.length === 'waist' ? 'Hem at the waist.' : next.length === 'hip' ? 'Hem at the hip.' : 'Hem at the high hip.';
  return { choices: next, said: said + curved };
}

const LENGTH_WORDS: Record<Length, string> = { mini: 'Mini', above_knee: 'Above the knee', knee: 'Knee length', midi: 'Midi', maxi: 'Maxi' };

/** The skirt's hem line as it stands, front or back, centre (x = 0) to side, in cm below the waist. */
/** A gathered skirt is cut straight, but its gathers stand it out below the hip as it hangs. */
const gatheredSpread = (draft: Pick<SkirtDraft, 'lengthCm'>, skirt: Choices, m: SkirtMeasurements) =>
  skirt.silhouette === 'gathered' ? Math.max(0, draft.lengthCm - m.waist_to_hip) * 0.2 : 0;

export function skirtHem(draft: Pick<SkirtDraft, 'lengthCm' | 'hem' | 'flareCm'>, skirt: Choices, m: SkirtMeasurements, side: FormSide): P[] {
  const halfWidth = (m.full_hip + FIT_EASE[skirt.fit].hip) / 4 + Math.max(0, draft.flareCm ?? 0) + gatheredSpread(draft, skirt, m);
  const plan = planFor(skirt, m, draft.lengthCm);
  return Array.from({ length: HEM_SAMPLES }, (_, i) => {
    const u = i / (HEM_SAMPLES - 1);
    const drawn = draft.hem ? offsetAt(draft.hem[side], u) : 0;
    const asym = plan && plan.kind === 'high_low' ? asymOffset(plan, side === 'front' ? (u * Math.PI) / 2 : Math.PI - (u * Math.PI) / 2) : 0;
    return { x: u * halfWidth, y: draft.lengthCm + drawn + asym };
  });
}

/**
 * A hem drawn on the legs, for a skirt or a dress's skirt. A level line on the front sets the length;
 * a curved one shapes the hem; on the back, a line lower than the front makes it high-low. On a skirt,
 * a line slanting across the front from one side to the other is a diagonal hem. `waistY` is where the
 * waist sits in the stroke's coordinates.
 */
export function readSkirtHem(stroke: P[], waistY: number, draft: Pick<SkirtDraft, 'lengthCm' | 'hem' | 'flareCm'>, m: SkirtMeasurements, skirt: Choices, side: FormSide = 'front', garment: 'skirt' | 'dress' = 'dress'): Reading<Choices> {
  if (stroke.length < 2) return { said: 'Draw across the legs where you want the hem.' };
  const pts = stroke.map((q) => ({ x: q.x, y: q.y - waistY }));
  const ys = pts.map((q) => q.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  // A shape matched from a photo, and a named uneven hem, are let go of: the drawing takes over.
  const { shape: _shape, asymHem: _a, ...rest } = skirt;
  const ends = [pts[0], pts[pts.length - 1]].sort((a, b) => a.x - b.x);
  if (side === 'front' && ends[0].x < -5 && ends[1].x > 5 && Math.abs(ends[1].y - ends[0].y) > 8 && Math.abs(median(pts.map((q) => q.x))) < 8) {
    if (garment === 'dress') return { said: 'The dress zips at the centre back, so its hem can’t slant from side to side. Try longer at the back instead.' };
    if (skirt.silhouette === 'slip' || skirt.pleats) return { said: 'A slanting hem goes on a straight, pencil, A-line, trumpet or circle skirt.' };
    const { hem: _h, ...plain } = rest;
    return { choices: { ...plain, asymHem: 'diagonal' }, said: 'A diagonal hem, cut whole so each side can differ.' };
  }
  if (side === 'front' && spread < 3) {
    const { hem: _h, ...plain } = rest;
    const kept = skirt.hem && skirt.hem.back.some((v) => Math.abs(v) > 0.3) ? { hem: { front: new Array(HEM_SAMPLES).fill(0), back: skirt.hem.back } } : {};
    const next = { ...dragLength(m, plain as Choices, median(ys)), ...kept };
    return { choices: next, said: next.lengthCm !== undefined ? `Skirt ${Math.round(next.lengthCm)} cm long.` : `${LENGTH_WORDS[next.length]} skirt.` };
  }
  // Pleats, godets and flounces are drafted on a level hem, as on the sketch.
  if (volumeOf(skirt) !== 'none') return { said: 'Pleats, godets and flounces need a level hem. Draw it straight across to set the length.' };
  const line = skirtHem({ ...draft, hem: skirt.hem ?? draft.hem }, rest as Choices, m, side);
  const current = skirt.hem?.[side] ?? new Array(HEM_SAMPLES).fill(0);
  const range = lengthRange(m);
  const clamp = (v: number) => Math.round(Math.max(range.min - draft.lengthCm, Math.min(range.max - draft.lengthCm, v)) * 10) / 10;
  const drawn = strokeToHem(pts, line, current);
  // Past the end of the line, the hem carries on at the height it was drawn, rather than snapping back.
  const half = line[line.length - 1].x || 1;
  const reach = Math.round((Math.min(half, Math.max(...pts.map((q) => Math.abs(q.x)))) / half) * (HEM_SAMPLES - 1));
  const offsets = drawn.map((v, k) => (k > reach ? drawn[reach] : v));
  // Front and back meet at the side seams, eased in so the hem curves into them.
  const hem = matchSides({ front: skirt.hem?.front ?? new Array(HEM_SAMPLES).fill(0), back: skirt.hem?.back ?? new Array(HEM_SAMPLES).fill(0), [side]: offsets }, clamp);
  const flat = [...hem.front, ...hem.back].every((v) => Math.abs(v) < 0.5);
  const { hem: _h, ...plain } = rest;
  const backLonger = side === 'back' && median(hem.back) - median(hem.front) > 2;
  return {
    choices: flat ? (plain as Choices) : { ...(plain as Choices), hem },
    said: flat ? 'A level hem.' : backLonger ? `Longer at the back by about ${Math.round(median(hem.back) - median(hem.front))} cm: a high-low hem.` : side === 'back' ? 'The back hem follows your line.' : 'The hem follows your line.',
  };
}

const FITS: Fit[] = ['fitted', 'regular', 'relaxed'];

/** A skirt's side line: the fit from where it passes the hip, the flare from where it reaches the hem. */
export function readSkirtSide(stroke: P[], waistY: number, draft: Pick<SkirtDraft, 'lengthCm'>, m: SkirtMeasurements, skirt: Choices): Reading<Choices> {
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y - waistY }));
  const hipY = m.waist_to_hip;
  const atHip = pts.filter((q) => Math.abs(q.y - hipY) < 5);
  const nearHem = pts.filter((q) => q.y > draft.lengthCm - 12);
  if (!atHip.length && !nearHem.length) return { said: 'Draw down the side, past the hip, to where the hem flares or tapers.' };
  let next: Choices = skirt;
  const words: string[] = [];
  if (atHip.length) {
    const ease = 4 * median(atHip.map((q) => q.x)) - m.full_hip;
    const fit = FITS.reduce((a, b) => (Math.abs(FIT_EASE[b].hip - ease) < Math.abs(FIT_EASE[a].hip - ease) ? b : a));
    next = { ...next, fit };
    words.push(`a ${fit} fit at the hip`);
  }
  if (nearHem.length) {
    const hipQ = (m.full_hip + FIT_EASE[next.fit].hip) / 4;
    next = dragFlare(m, next, draft.lengthCm, median(nearHem.map((q) => q.x)) - hipQ);
    words.push(next.flareCm !== undefined ? `${next.flareCm} cm of flare at each side` : `a ${next.silhouette.replace('_', '-')} shape`);
  }
  const said = words.join(', and ');
  return { choices: next, said: said[0].toUpperCase() + said.slice(1) + '.' };
}

// The lines already on the garment, drawn on the form as tape: polylines in the same coordinates.

/** Both halves of a half line. */
export const mirror = (pts: P[]): P[][] => [pts, pts.map((q) => ({ x: -q.x, y: q.y }))];

/** Dart fold lines from the sketch's own path, as polylines. */
const darts = (draft: BodiceDraft, side: FormSide): P[][] =>
  (worn(draft, side).darts(0).match(/M[^M]+/g) ?? []).map((seg) => {
    const n = seg.match(/-?\d+(\.\d+)?/g)!.map(Number);
    return [
      { x: n[0], y: n[1] },
      { x: n[2], y: n[3] },
    ];
  });

/** The bodice's lines as they stand, front or back, for each kind of line. */
export function bodiceLines(draft: BodiceDraft, side: FormSide): Record<Exclude<FormLine, 'sleeve' | 'front' | 'collar'>, P[][]> {
  const w = worn(draft, side);
  const land = side === 'front' ? draft.front : draft.back;
  const { neckPoint, underarm, apex } = landmarks(draft, side);
  const neckPts = w.top.pts.filter((_, i) => w.top.tags[i] === 'neck');
  const styled = draft.styleLines?.[side];
  const seam = styled && styled.length ? styled.flatMap((l) => mirror(l.pts)) : darts(draft, side);
  const waistX = Math.max(land.waistSide.x, 1);
  const hem = [{ x: -land.hemSide.x, y: land.hemCentre.y }, { x: land.hemSide.x, y: land.hemCentre.y }];
  const fit = mirror([{ x: underarm.x, y: underarm.y }, { x: waistX, y: land.waistCentre.y }]);
  let neckline = mirror(neckPts);
  let drape: P[][] = [];
  const kind = draft.drape?.kind;
  if (kind === 'cowl' && side === 'front') {
    // Soft folds hanging between the neck points, the lowest at the cowl's own depth.
    const depth = draft.drape?.depthCm ?? 10;
    const top = draft.neckBlock.front.neckY;
    drape = [1, 0.7, 0.45].map((k) =>
      Array.from({ length: 21 }, (_, i) => {
        const t = -1 + i / 10;
        const x = t * neckPoint.x * (0.75 + 0.25 * k);
        return { x, y: neckPoint.y + (top + depth * k - neckPoint.y) * (1 - t * t) };
      }),
    );
    neckline = [];
  } else if (kind === 'one_shoulder' && side === 'front') {
    // From the neck point on the covered shoulder, curving over the bust, to under the other arm.
    const turn = draft.drape?.side === 'right' ? -1 : 1;
    drape = [
      Array.from({ length: 21 }, (_, i) => {
        const t = i / 20;
        const a = { x: neckPoint.x, y: neckPoint.y };
        const c = { x: -apex.x * 0.4, y: apex.y - 8 };
        const b = { x: -underarm.x, y: underarm.y + 1.5 };
        return { x: turn * ((1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x), y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y };
      }),
    ];
    neckline = [];
  }
  if (draft.peplum) {
    const d = draft.peplum.depthCm;
    const y0 = land.waistCentre.y;
    const flare = draft.peplum.kind === 'gathered' ? 4 : 7;
    drape.push(...mirror([{ x: waistX, y: y0 }, { x: waistX + flare, y: y0 + d }]));
    drape.push(Array.from({ length: 17 }, (_, i) => {
      const x = -(waistX + flare) + ((waistX + flare) * 2 * i) / 16;
      return { x, y: y0 + d + (draft.peplum!.kind === 'gathered' ? 0.6 * Math.sin(i * 1.6) : 0) };
    }));
  }
  return { neckline, seam, drape, fit, hem: [hem] };
}

/** The skirt's lines as they stand: the hem, and the side from the hip to the hem. */
export function skirtLines(draft: Pick<SkirtDraft, 'lengthCm' | 'hem' | 'flareCm'>, skirt: Choices, m: SkirtMeasurements, side: FormSide, waistY: number): Partial<Record<FormLine, P[][]>> {
  const shift = (pts: P[]) => pts.map((q) => ({ x: q.x, y: q.y + waistY }));
  const hem = skirtHem(draft, skirt, m, side);
  const hipQ = (m.full_hip + FIT_EASE[skirt.fit].hip) / 4;
  const end = { x: hipQ + (draft.flareCm ?? 0) + gatheredSpread(draft, skirt, m), y: hem[hem.length - 1].y };
  // Gathered, the side falls from the waist, already full over the hip.
  const sideLine =
    skirt.silhouette === 'gathered'
      ? [{ x: m.waist / 4 + 1, y: 0 }, { x: hipQ + 1.5, y: m.waist_to_hip * 0.8 }, end]
      : [{ x: hipQ, y: m.waist_to_hip }, end];
  return { hem: [shift([...mirror(hem)[1].reverse(), ...hem.slice(1)])], fit: mirror(shift(sideLine)) };
}

export { blockOf };
