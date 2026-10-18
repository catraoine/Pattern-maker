// Draw on your form: style seams drawn as tape across or down the bodice, read the way a draper reads
// them on a form:
// - a level line above the bust is a yoke, front or back, as deep below the neck point as it was drawn;
// - a level line below the bust and above the waist is an empire seam, front and back at one height;
// - a line from the armhole down to the waist that keeps clear of the bust is a side panel seam.
// Anything else (a line to or through the bust point) is left for the princess seam and dart reader.
// Everything is in the pieces' own coordinates: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';
import { EMPIRE_RANGE, PANEL_RANGE, SeamKind, YOKE_RANGE } from '../engine/seams';
import { BodiceChoices, seamBlocked, seamOf, validDetails } from '../garments';
import { APEX_REACH, FormSide, Reading, WAIST_REACH, edgeAt, landmarks } from './formLines';

type Garment = 'bodice' | 'dress';

/** How much longer one way than the other a line must run to count as level or upright, and how far
 * a level seam must reach across the half, in cm. */
const STRAIGHT = 2;
const ACROSS = 4;

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const half = (stroke: P[]) => stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
const round = (v: number, step: number) => Math.round(v / step) * step;
const clamp = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));
const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * A style seam drawn on the form: the new choices, or a reason in words when the seam can't go with
 * the rest. `kind` names the seam the line was read as; when it is undefined the line is no style
 * seam at all, and the princess seam and dart reader (readSeam) should have it instead.
 */
export function readSeamLine(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice', side: FormSide = 'front'): Reading<BodiceChoices> & { kind?: SeamKind } {
  const pts = half(stroke);
  const pass = { said: '' };
  if (pts.length < 2) return pass;
  const { neckPoint, apex, waistY } = landmarks(draft, side);
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const wide = Math.max(...xs) - Math.min(...xs);
  const tall = Math.max(...ys) - Math.min(...ys);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  // A line that ends at the bust point is a dart, and one through it a princess seam.
  if (dist(a, apex) <= APEX_REACH || dist(b, apex) <= APEX_REACH) return pass;

  if (wide >= ACROSS && wide >= STRAIGHT * tall) {
    const y = median(ys);
    if (y < apex.y - 3) {
      const depth = round(clamp(y - neckPoint.y, YOKE_RANGE), 0.5);
      const yoke = { ...(seamOf(c) === 'yoke' ? c.yoke : {}), [side]: depth };
      return chosen(c, 'yoke', { yoke }, garment, side, `${side === 'front' ? 'Front' : 'Back'} yoke ${depth} cm below the neck point.`);
    }
    if (y > apex.y + 2 && y < waistY - 3) {
      const below = round(clamp(y - apex.y, EMPIRE_RANGE), 0.5);
      return chosen(c, 'empire', { empire: below }, garment, side, `Empire seam ${below} cm below the bust point, front and back.`);
    }
    return pass;
  }

  if (tall >= STRAIGHT * wide) {
    const [high, low] = a.y <= b.y ? [a, b] : [b, a];
    const at = edgeAt(draft, high, side);
    if (!at || at.edge !== 'armhole' || low.y < waistY - WAIST_REACH) return pass;
    // Through the bust (on the back, the waist dart's point) it is a princess seam, not a panel.
    if (pts.some((q) => dist(q, apex) <= APEX_REACH)) return pass;
    const where = round(clamp(at.along, PANEL_RANGE), 0.05);
    return chosen(c, 'panel', { panel: { at: where } }, garment, side, 'Side panels from the armhole to the waist, front and back, where you drew them.');
  }
  return pass;
}

/** The choices with the drawn seam in place of any other style seam or princess seams, and the bust
 * dart back in the side seam for the seam to take; or why it can't be. */
function chosen(c: BodiceChoices, kind: SeamKind, seam: Partial<BodiceChoices>, garment: Garment, side: FormSide, said: string): Reading<BodiceChoices> & { kind: SeamKind } {
  const { yoke: _y, empire: _e, panel: _p, lineAt: _l, ...rest } = c;
  const next: BodiceChoices = { ...rest, princess: 'none', bustDart: 'side', ...seam };
  const why = seamBlocked(next, kind, garment, kind === 'yoke' ? side : 'front');
  if (why) return { kind, said: why };
  return { kind, choices: validDetails(next, garment), said };
}

/** The style seams as they stand, front or back, as polylines on both halves. */
export function seamLines(draft: BodiceDraft, side: FormSide): P[][] {
  return (draft.styleSeams ?? [])
    .filter((sm) => sm.side === side)
    .flatMap((sm) => [sm.pts, sm.pts.map((q) => ({ x: -q.x, y: q.y }))]);
}

/** A yoke, empire seam or panel when the line is one (or why it can't be), otherwise the princess and dart reader's reading. */
export const orSeam = (seam: Reading<BodiceChoices> & { kind?: SeamKind }, other: () => Reading<BodiceChoices>): Reading<BodiceChoices> => (seam.kind ? seam : other());
