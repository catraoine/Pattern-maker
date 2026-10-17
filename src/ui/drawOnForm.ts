// Draw on your form: lines drawn with a finger on a dress form built from your measurements, read
// the way a draper reads style tape on a form. Each line becomes a choice the pattern already knows:
// - a neckline: its depth, width along the shoulder and fullness (as "Draw neck" reads it);
// - a seam or dart: drawn from an edge towards the bust point. One that runs on down to the waist is
//   a princess seam (from the shoulder or the armhole); one that stops at the bust is the bust dart,
//   moved to the edge it starts from;
// - a hem: how far below the waist it sits, for the bodice's length or the dress's skirt.
// Everything is in the front piece's own coordinates: cm, the centre front at x = 0, y running down.
import type { P } from '../engine/geometry';
import { BodiceDraft, BodiceMeasurements } from '../engine/bodice';
import type { DartPlace, PrincessLine } from '../engine/manipulate';
import { isTop } from '../engine/corset';
import { BodiceChoices, DARTS_FOR_FIT, detailAllowed, validDetails } from '../garments';
import type { Length, SkirtMeasurements } from '../engine/skirt';
import type { Choices } from '../App';
import { currentNeck, dragDrop, strokeToNeck, worn } from './BodiceShape';
import { dragLength } from './ShapeSketch';

export type FormLine = 'neckline' | 'seam' | 'hem';

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
/** How far a point is from the segment a to b. */
const toSegment = (q: P, a: P, b: P) => {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / l2)) : 0;
  return dist(q, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
};
const half = (stroke: P[]) => stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));

/** Where the body's landmarks sit on the front: the neck point, shoulder tip, underarm and waist. */
export function landmarks(draft: BodiceDraft) {
  const { pts, tags } = worn(draft, 'front').top;
  const first = (tag: string) => pts[Math.max(0, tags.indexOf(tag))];
  return {
    neckPoint: first('shoulder'),
    shoulderTip: first('armhole'),
    underarm: first('side'),
    apex: draft.front.apex,
    waistY: draft.front.waistCentre.y,
    // Each stretch of the outline, from one point to the next, and the edge it belongs to.
    edges: pts.slice(0, -1).map((a, i) => ({ a, b: pts[i + 1], tag: tags[i] })).filter((e): e is { a: P; b: P; tag: Edge } => EDGES.includes(e.tag as Edge)),
  };
}

/** The edge of the front a point sits on, if it is near one. */
export function edgeAt(draft: BodiceDraft, at: P): Edge | undefined {
  const near = landmarks(draft).edges.reduce<{ tag?: Edge; d: number }>((best, e) => {
    const d = toSegment(at, e.a, e.b);
    return d < best.d ? { tag: e.tag, d } : best;
  }, { d: Infinity });
  return near.d <= EDGE_REACH ? near.tag : undefined;
}

export function readNeckline(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice'): Reading<BodiceChoices> {
  if (isTop(c.neckline)) return { said: 'A strapless, sweetheart or cami top has no neckline to draw. Pick a higher neckline first.' };
  const neck = strokeToNeck(half(stroke), 'front', draft, currentNeck(c));
  if (!neck) return { said: 'Draw down from the shoulder to where you want the neckline to sit.' };
  return { choices: validDetails({ ...c, neck }, garment), said: `Neckline ${Math.round(neck.frontDepth)} cm below your neck at the centre front.` };
}

const DART_WORDS: Record<DartPlace, string> = {
  side: 'the side seam',
  french: 'low on the side seam, as a French dart',
  shoulder: 'the shoulder',
  neck: 'the neckline',
  armhole: 'the armhole',
  waist: 'the waist',
};

/** A seam or dart drawn from an edge towards the bust point. */
export function readSeam(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice'): Reading<BodiceChoices> {
  const pts = half(stroke);
  if (pts.length < 2) return { said: 'Draw a line from an edge of the bodice towards the bust point.' };
  const { apex, waistY } = landmarks(draft);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  // Either end can be drawn first. A line from above the bust down to the waist starts at its top;
  // a shorter one starts at whichever end is further from the bust point.
  const [high, low] = a.y <= b.y ? [a, b] : [b, a];
  const toWaist = low.y >= waistY - WAIST_REACH && high.y < apex.y;
  const origin = toWaist ? high : dist(a, apex) >= dist(b, apex) ? a : b;
  const passesApex = pts.some((q) => dist(q, apex) <= APEX_REACH);
  if (!passesApex) return { said: 'Seams and darts run to the bust point. Draw through the fullest part of the bust.' };
  const edge = edgeAt(draft, origin);
  if (!edge) return { said: 'Start the line at an edge: the neckline, shoulder, armhole, side seam or waist.' };
  if (isTop(c.neckline) || c.structure === 'boned') return { said: 'A top cut below the shoulders keeps its own panels.' };

  if (toWaist && edge !== 'side' && edge !== 'waist') {
    const princess: PrincessLine = edge === 'armhole' ? 'armhole' : 'shoulder';
    if (!DARTS_FOR_FIT[c.fit].includes('bust_waist')) return { said: 'Princess seams need a fitted or regular fit.' };
    const next = { ...c, darts: 'bust_waist' as const, princess, bustDart: 'side' as const };
    if (!detailAllowed(next, 'princess', princess, garment)) return { said: 'This neckline is draped, so it takes no princess seams.' };
    return { choices: validDetails(next, garment), said: `Princess seams from the ${princess}, carrying the bust and waist darts.` };
  }

  const bustDart: DartPlace = edge === 'side' ? (origin.y > apex.y + 3 ? 'french' : 'side') : edge;
  const darts = c.darts === 'none' ? DARTS_FOR_FIT[c.fit].find((d) => d !== 'none') : c.darts;
  if (!darts) return { said: 'A bodice with no darts has no bust dart to move. Choose a closer fit first.' };
  const next = { ...c, darts, princess: 'none' as const, bustDart };
  if (!detailAllowed(next, 'bustDart', bustDart, garment)) {
    return { said: bustDart === 'waist' ? 'The bust dart goes to the waist only on a waist-length bodice.' : 'This neckline keeps its bust dart in the side seam.' };
  }
  return { choices: validDetails(next, garment), said: `Bust dart moved to ${DART_WORDS[bustDart]}.` };
}

/** The hem's height: the middle of the stroke, so a slightly wavy line still reads as level. */
const hemY = (stroke: P[]) => {
  const ys = stroke.map((q) => q.y).sort((x, y) => x - y);
  return ys[Math.floor(ys.length / 2)];
};

export function readBodiceHem(stroke: P[], draft: BodiceDraft, m: BodiceMeasurements, c: BodiceChoices): Reading<BodiceChoices> {
  if (!stroke.length) return { said: 'Draw across the body where you want the hem.' };
  if (!m.full_hip || !m.waist_to_hip) return { said: 'For a longer bodice, add your full hip and waist to hip.' };
  const next = dragDrop(m, c, hemY(stroke) - landmarks(draft).waistY);
  const said =
    next.dropCm !== undefined ? `Hem ${Math.round(next.dropCm)} cm below the waist.` : next.length === 'waist' ? 'Hem at the waist.' : next.length === 'hip' ? 'Hem at the hip.' : 'Hem at the high hip.';
  return { choices: next, said };
}

const LENGTH_WORDS: Record<Length, string> = { mini: 'Mini', above_knee: 'Above the knee', knee: 'Knee length', midi: 'Midi', maxi: 'Maxi' };

export function readSkirtHem(stroke: P[], draft: BodiceDraft, m: SkirtMeasurements, skirt: Choices): Reading<Choices> {
  if (!stroke.length) return { said: 'Draw across the legs where you want the hem.' };
  // A shape matched from a photo is let go of, as dragging the hem does.
  const { shape: _shape, ...rest } = skirt;
  const next = dragLength(m, rest, hemY(stroke) - landmarks(draft).waistY);
  return { choices: next, said: next.lengthCm !== undefined ? `Skirt ${Math.round(next.lengthCm)} cm long.` : `${LENGTH_WORDS[next.length]} skirt.` };
}
