// Draw on your form, for the bodice: a shaped hem and an uneven neckline, read from lines drawn on the
// form the way formLines.ts reads the rest.
// - a hem: where the line crosses the side seam sets the length, and its curve the shape: dipped at
//   the centre front, longer at the back, or curving up. A waist-length bodice keeps a level waist;
// - an uneven neckline: drawn across the whole front, lower on one side, or a V with its point off
//   the centre. The front is then cut whole, since its two sides differ. A neckline that comes out the
//   same on both sides is left to readNeckline.
// Everything is in the pieces' own coordinates: cm, the centre at x = 0, y running down. On the front,
// x > 0 is on your right as you face the form, which is the wearer's left.
import type { P } from '../engine/geometry';
import { BodiceDraft, BodiceMeasurements, POINTED_NECK, UnevenNeck, hemDrop } from '../engine/bodice';
import { bodiceHemShape, hemWords } from '../engine/bodiceHem';
import { HEM_SAMPLES, matchSides } from '../engine/hem';
import { clampUneven, unevenEdge } from '../engine/uneven';
import { isBoned, isTop } from '../engine/corset';
import { BodiceChoices, validDetails } from '../garments';
import { dragDrop, wornHem } from './BodiceShape';
import { FormSide, Reading, landmarks } from './formLines';

type Garment = 'bodice' | 'dress';

const n = HEM_SAMPLES - 1;
const flat = () => new Array(HEM_SAMPLES).fill(0);
const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const round1 = (v: number) => Math.round(v * 10) / 10;

/** The bodice hem as it stands, front or back, across the body from side seam to side seam, as worn. */
export function bodiceHemLine(draft: BodiceDraft, side: FormSide): P[] {
  const at = wornHem(draft, side);
  const half = Array.from({ length: 17 }, (_, i) => at(i / 16));
  return [...half.slice(1).reverse().map((q) => ({ x: -q.x, y: q.y })), ...half];
}

/**
 * How far a stroke sits above or below `level` at each of the hem's samples, from the centre (0) to
 * the side seam (n), `width` being the half width at the side seam. Both halves count, so the hem stays
 * even; past the end of the line it carries on at the height it was drawn, and a stretch it missed
 * near the centre takes the nearest it reached. Smoothed, so a wobble isn't read as shape.
 */
function offsetsOf(pts: P[], width: number, level: number): number[] {
  const sums = flat();
  const counts = flat();
  for (const q of pts) {
    const k = Math.round((Math.min(width, q.x) / width) * n);
    sums[k] += q.y - level;
    counts[k]++;
  }
  const reached = counts.map((c, k) => (c ? k : -1)).filter((k) => k >= 0);
  const raw = sums.map((s, k) => {
    if (counts[k]) return s / counts[k];
    const near = reached.reduce((a, b) => (Math.abs(b - k) < Math.abs(a - k) ? b : a));
    return sums[near] / counts[near];
  });
  const smooth = raw.map((v, k) => (raw[Math.max(0, k - 1)] + 2 * v + raw[Math.min(n, k + 1)]) / 4);
  return smooth.map((v) => (Math.abs(v) < 0.5 ? 0 : round1(v)));
}

/**
 * A hem drawn across the bodice, front or back, below the waist. Where it crosses the side seam sets
 * the length (front and back meet there, so either sets it); its curve shapes that side's hem: lower at
 * the centre front for a dipped hem, lower at the centre back for one longer at the back. A line at the
 * waist makes a waist-length bodice, which keeps a level waist.
 */
export function readBodiceHemShape(stroke: P[], draft: BodiceDraft, m: BodiceMeasurements, c: BodiceChoices, side: FormSide = 'front'): Reading<BodiceChoices> {
  if (stroke.length < 2) return { said: 'Draw across the body where you want the hem.' };
  if (!m.full_hip || !m.waist_to_hip) return { said: 'For a longer bodice, add your full hip and waist to hip.' };
  if (isBoned(validDetails(c))) return { said: 'A boned bodice stops at the waist, so its hem stays level there.' };
  const { waistY } = landmarks(draft, side);
  const at = wornHem(draft, side);
  const width = Math.max(1, at(1).x);
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const ys = pts.map((q) => q.y);
  // Where the line crosses the side seam, or where it stops short of it.
  const reach = Math.min(width, Math.max(...pts.map((q) => q.x)));
  const nearSide = pts.filter((q) => Math.abs(q.x - reach) < 1);
  const sideY = nearSide.length ? median(nearSide.map((q) => q.y)) : pts.reduce((a, b) => (Math.abs(b.x - reach) < Math.abs(a.x - reach) ? b : a)).y;
  // As worn, the level hem hangs `extra` below the drop on the front: the length its bust needs.
  const level = at(1).y - (draft.hem?.front[n] ?? 0);
  const extra = level - waistY - draft.drop;
  const sized = dragDrop(m, c, sideY - waistY - extra);
  const drop = hemDrop(m, sized);
  const { hem: _h, ...rest } = sized;
  const peplum = c.peplum && c.peplum !== 'none' ? ' The peplum goes: it needs a waist-length bodice.' : '';
  if (drop === 0) {
    const curved = Math.max(...ys) - Math.min(...ys) > 3 ? ' A waist-length bodice keeps a level waist: draw the hem lower, below the waist, to shape it.' : '';
    return { choices: validDetails(rest), said: `Hem at the waist.${curved}` };
  }
  // The shape, from the side seam's height: front and back each keep theirs, and meet at the side.
  const drawn = offsetsOf(pts, width, sideY);
  const hem = bodiceHemShape(matchSides({ front: c.hem?.front ?? flat(), back: c.hem?.back ?? flat(), [side]: drawn }), m, drop);
  const next = validDetails(hem ? { ...rest, hem } : rest);
  const length = next.dropCm !== undefined ? `Hem ${Math.round(next.dropCm)} cm below the waist` : next.length === 'hip' ? 'Hem at the hip' : 'Hem at the high hip';
  const shape = hem ? `, ${hemWords(hem)}.` : ', level all round.';
  return { choices: next, said: `${length}${hem ? ' at the side seams' : ''}${shape}${peplum}` };
}

/** How far the halves of a neckline drawn across the front differ: the most, in cm, at the same
 * distance out on each side, as far as both reach. */
function mismatch(stroke: P[]): number {
  const halfOf = (k: number) => stroke.filter((q) => q.x * k > 0).map((q) => ({ x: Math.abs(q.x), y: q.y })).sort((a, b) => a.x - b.x);
  const yAt = (h: P[], x: number) => {
    const i = h.findIndex((q) => q.x >= x);
    if (i <= 0) return h[Math.max(0, i)].y;
    const a = h[i - 1];
    const b = h[i];
    return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  };
  const left = halfOf(1);
  const right = halfOf(-1);
  if (!left.length || !right.length) return 0;
  const out = Math.min(left[left.length - 1].x, right[right.length - 1].x);
  let most = 0;
  for (let x = 0.5; x <= out; x += 0.5) most = Math.max(most, Math.abs(yAt(left, x) - yAt(right, x)));
  return most;
}

/** How full one side of the neckline is drawn, from its lowest point up to the neck point: how far
 * across it has come halfway up, as "Draw neck" reads it (0 straight, like a V, to 1 nearly square). */
function fullness(side: P[], low: P, neckX: number): number {
  const high = side.reduce((a, b) => (b.y < a.y ? b : a), low);
  if (low.y - high.y < 1) return 0.75;
  const mid = (low.y + high.y) / 2;
  const near = side.filter((q) => Math.abs(q.y - mid) < (low.y - high.y) * 0.12);
  const span = Math.max(1, Math.abs(neckX - low.x));
  const u = near.length ? near.reduce((s, q) => s + Math.abs(q.x - low.x), 0) / near.length / span : 0.75;
  return Math.round(Math.min(1, Math.max(0, (u - 0.5) / 0.45)) * 100) / 100;
}

/** Differences smaller than these read as an even neckline drawn by hand: the two sides this close in
 * height at the same distance out, and this close in fullness. */
export const UNEVEN_REACH = { cm: 2.5, fullness: 0.35 };

/**
 * A front neckline drawn from one shoulder across the centre to the other, lower on one side or an
 * asymmetric V. It is read only when the two sides clearly differ: otherwise it gives no choices and
 * says so, and the line is read as an even neckline instead. The lowest point sets the depth and where
 * across it sits; each side's curve sets how full it is. The neck points, shoulders and back neck stay
 * where they are, so the back is still cut as a pair.
 */
export function readUnevenNeckline(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice', side: FormSide = 'front'): Reading<BodiceChoices> {
  if (side === 'back') return { said: 'An uneven neckline is drawn on the front. The back neckline stays even, so the back is still cut as a pair.' };
  if (isTop(c.neckline)) return { said: 'A strapless, sweetheart or cami top has no neckline to draw. Pick a higher neckline first.' };
  if (!stroke.some((q) => q.x < -1) || !stroke.some((q) => q.x > 1)) return { said: 'Draw the whole neckline, from one shoulder across the centre to the other, so the two sides can differ.' };
  // The lowest point: the middle of the bottom of the line, which may run level for a way.
  const lowY = Math.max(...stroke.map((q) => q.y));
  const bottom = stroke.filter((q) => q.y > lowY - 0.7);
  const low = { x: bottom.reduce((t, q) => t + q.x, 0) / bottom.length, y: lowY };
  const { neckPoint } = landmarks(draft);
  const left = stroke.filter((q) => q.x >= low.x);
  const right = stroke.filter((q) => q.x <= low.x);
  const full = { left: fullness(left, low, neckPoint.x), right: fullness(right, low, -neckPoint.x) };
  const differs = mismatch(stroke) >= UNEVEN_REACH.cm || Math.abs(full.left - full.right) >= UNEVEN_REACH.fullness;
  if (!differs) return { said: 'Both sides of this neckline are the same, so it is an even neckline. Draw one side lower, or the point of a V off the centre, for an uneven one.' };
  const u: UnevenNeck = clampUneven({ depth: round1(low.y - draft.neckBlock.front.neckY), x: round1(low.x), left: full.left, right: full.right }, draft);
  // An uneven neckline replaces a drawn or draped one: the bodice goes back to its round neck.
  const { cowlDepth: _c, neck: _n, ...rest } = c;
  const base = c.neckline === 'one_shoulder' || c.neckline === 'cowl' ? { ...rest, neckline: 'scoop' as const } : rest;
  const next = validDetails({ ...base, unevenNeck: u }, garment);
  const lost = [
    c.princess && c.princess !== 'none' ? 'princess seams' : '',
    c.collar && c.collar !== 'none' ? 'the collar' : '',
    c.closure === 'front_buttons' ? 'the front buttons (it zips at the back)' : '',
    c.bustDart && c.bustDart !== 'side' ? 'the moved bust dart' : '',
  ].filter(Boolean);
  const across = Math.round(Math.abs(u.x));
  const where = across === 0 ? 'at the centre front' : `${across} cm toward your ${u.x > 0 ? 'left' : 'right'}`;
  const kind = u.left < POINTED_NECK && u.right < POINTED_NECK ? 'An asymmetric V-neck' : 'An uneven neckline';
  return {
    choices: next,
    said: `${kind}, ${Math.round(u.depth)} cm below your neck at its lowest, ${where}. The front is cut whole, right side up, so the two sides can differ.${lost.length ? ` The front is one piece, so ${lost.join(', ')} ${lost.length > 1 ? 'go' : 'goes'}.` : ''}`,
  };
}

/** The uneven neckline as drafted, for drawing on the form as tape: none when the neckline is even. */
export function unevenNecklineLines(draft: BodiceDraft): P[][] {
  const edge = unevenEdge(draft);
  return edge.length ? [edge] : [];
}

/** An uneven neckline when the line clearly is one, otherwise the even neckline reader's reading. */
export const orNeckline = (uneven: Reading<BodiceChoices>, even: () => Reading<BodiceChoices>): Reading<BodiceChoices> => (uneven.choices ? uneven : even());
