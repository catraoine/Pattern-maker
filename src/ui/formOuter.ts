// Draw on your form, for jackets and coats: the vent and the pockets (the hem, side, front edge, collar,
// shaping and sleeves are read in formTops.ts and formSleeves.ts).
// - a vent: a line straight up from the hem at the centre is the centre back vent, as long as the line;
//   a line across the hem at the centre closes it;
// - a pocket: a box drawn on the front is a patch pocket, a short level line a welt pocket, each cut
//   where it was drawn (kept clear of the buttons and the seams).
// The same coordinates as formLines.ts: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import type { OuterDraft } from '../engine/outerwear';
import type { OuterChoices } from '../garments';
import { FormLine, Reading, median } from './formLines';

const span = (vs: number[]) => Math.max(...vs) - Math.min(...vs);
const footOf = (draft: OuterDraft) => Math.max(...draft.block[0].outline.points(4).map((q) => q.y));

/** A vent line: up from the hem at the centre, its length; across the hem there, none. */
export function readOuterVent(stroke: P[], draft: OuterDraft, c: OuterChoices): Reading<OuterChoices> {
  if (c.length === 'cropped') return { said: 'A cropped jacket is too short for a back vent.' };
  const foot = footOf(draft);
  const xs = stroke.map((q) => q.x);
  const ys = stroke.map((q) => q.y);
  if (span(xs) > span(ys) && Math.abs(median(ys) - foot) < 5 && Math.abs(median(xs)) < 6) return { choices: { ...c, vent: 'none', ventCm: undefined }, said: 'No vent: the back is closed to the hem.' };
  if (Math.max(...ys) < foot - 6 || span(ys) < 6 || Math.abs(median(xs)) > 5) return { said: 'Draw straight up from the hem at the centre, as long as the vent should be.' };
  const cm = Math.round(foot - Math.min(...ys));
  const next = { ...c, vent: 'centre' as const, ventCm: cm };
  return { choices: next, said: `A centre back vent, about ${cm} cm up from the hem (it stops at 12 cm at the shortest and well below the waist at the longest).` };
}

/** A pocket line: a box is a patch pocket, a short level line a welt, either placed where it was drawn. */
export function readOuterPocket(stroke: P[], c: OuterChoices): Reading<OuterChoices> {
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const closed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < Math.max(3, 0.35 * Math.max(span(xs), span(ys)));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  if (closed && span(xs) > 5 && span(ys) > 5) return { choices: { ...c, pockets: 'patch', pocketAt: { x: Math.round(cx), y: Math.round(Math.min(...ys)) } }, said: 'Patch pockets, sewn on where you drew them.' };
  if (span(xs) > 5 && span(ys) < Math.max(3, span(xs) * 0.4)) return { choices: { ...c, pockets: 'welt', pocketAt: { x: Math.round(cx), y: Math.round(median(ys) - 1) } }, said: 'Welt pockets, cut in where you drew them.' };
  return { said: 'Draw a box on the front for a patch pocket, or a short level line for a welt pocket.' };
}

/** Where the pockets sit, both sides of the front. */
export function outerPocketLines(draft: OuterDraft): Partial<Record<FormLine, P[][]>> {
  const pk = draft.pocket;
  if (!pk) return {};
  const box = [{ x: pk.x, y: pk.y }, { x: pk.x + pk.w, y: pk.y }, { x: pk.x + pk.w, y: pk.y + pk.h }, { x: pk.x, y: pk.y + pk.h }, { x: pk.x, y: pk.y }];
  return { pocket: [box, box.map((q) => ({ x: -q.x, y: q.y }))] };
}
