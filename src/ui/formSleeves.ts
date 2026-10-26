// Draw on your form: sleeves, on the bodice, the dress, the jacket and the coat. A line on the arm is
// read the way a draper reads tape pinned on a form's arm:
// - across the arm: the sleeve ends there, to the cm from the shoulder (as the sleeve slider sets it);
// - down the outside of the arm: its shape, from how far the line stands off the arm at the top and at
//   the hem. Close all the way is fitted, puffed out at the top is a puff, full at the wrist is a bishop,
//   flaring out from the shoulder to above the elbow is a flutter, and a short line ending well above the
//   elbow is a cap. The line's end sets the length too;
// - from the neck to under the arm: raglan sleeves; down the top of the arm, a little out from the
//   shoulder: a dropped shoulder; round the armhole from the shoulder to under the arm: set in.
// A jacket or coat sleeve runs to the wrist: its line down the arm picks the closest of its cuts.
// The same coordinates as formLines.ts: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import type { BodiceDraft, BodiceMeasurements } from '../engine/bodice';
import { SHAPES_FOR_LENGTH, SLEEVE_LENGTHS, SleeveDraft, SleeveLength, SleeveMeasurements, SleeveShape, draftSleeve } from '../engine/sleeve';
import { sleeveCutBlocked } from '../engine/sleeveCut';
import type { OuterSleeve } from '../engine/outerwear';
import { BodiceChoices, OuterChoices, detailAllowed, slideSleeve, validDetails } from '../garments';
import { FormArm, armAt } from './DrawOnForm';
import { FormLine, Reading, landmarks, median } from './formLines';

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
type Named = (typeof SLEEVE_LENGTHS)[number];

/** Where a sleeve's named lengths fall from the shoulder, and the shortest and longest it can be: from a
 * plain long sleeve drafted to this bodice's armhole. None without the arm measurements. */
interface SleeveRange {
  named: Record<Named, number>;
  min: number;
  max: number;
}

export function sleeveRange(draft: BodiceDraft, m: BodiceMeasurements & SleeveMeasurements, fit: BodiceChoices['fit']): SleeveRange | undefined {
  if (!m.arm_length || !m.upper_arm) return undefined;
  try {
    const s = draftSleeve(draft, m, { length: 'long', shape: 'straight', fit, seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
    return { named: s.length.named, min: s.length.min, max: s.length.max };
  } catch {
    return undefined;
  }
}

const LENGTH_WORDS: Record<Exclude<SleeveLength, 'none'>, string> = { short: 'short', elbow: 'elbow-length', three_quarter: 'three-quarter', long: 'long' };
const SHAPE_WORDS: Record<SleeveShape, string> = { fitted: 'Fitted', straight: 'Straight', puff: 'Puff', bishop: 'Bishop', cap: 'Cap', flutter: 'Flutter', tailored: 'Tailored' };

/** The points of a line that lie on or beside the arm, below the shoulder. */
const onArm = (stroke: P[], arm: FormArm, reach = 3) =>
  stroke
    .map((q) => ({ x: Math.abs(q.x), y: q.y }))
    .filter((q) => {
      const a = armAt(arm, q.y);
      return q.y > arm.tip.y - 2 && q.y < arm.wristY + 4 && q.x > a.inner - reach && q.x < a.outer + reach + 6;
    });

/** What a line on the arm is: across it, down its outside, from the neck to under the arm, or down the top of the arm. */
function sleeveStroke(stroke: P[], arm: FormArm, neckPoint: P): 'cut_raglan' | 'cut_set_in' | 'cut_drop' | 'across' | 'down' | undefined {
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const [top, end] = a.y <= b.y ? [a, b] : [b, a];
  const nearNeck = dist(top, neckPoint) < 4.5 || (top.y < neckPoint.y + 4 && Math.abs(top.x - neckPoint.x) < 4);
  if (nearNeck && dist(end, arm.under) < 5) return 'cut_raglan';
  if (dist(top, arm.tip) < 3.5 && dist(end, arm.under) < 4.5) return 'cut_set_in';
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  // Down the top of the arm, inside its outline, between the shoulder tip and the underarm: where a dropped shoulder's seam sits.
  if (dy > dx && end.y < arm.under.y + 4 && top.y < arm.tip.y + 4 && median(xs) > arm.tip.x + 1.5 && pts.every((q) => q.x < armAt(arm, q.y).outer - 0.8)) return 'cut_drop';
  const on = onArm(stroke, arm);
  if (on.length < 2) return undefined;
  // Across or down the arm, measured against the arm's own outline (it rounds out over the shoulder).
  const rel = on.map((q) => q.x - armAt(arm, q.y).outer);
  if (Math.max(...rel) - Math.min(...rel) >= dy * 1.2) return 'across';
  return 'down';
}

/** How far a line down the arm stands off its outside: at the top (above the underarm) and at its end. */
function standOff(stroke: P[], arm: FormArm) {
  const on = onArm(stroke, arm).sort((a, b) => a.y - b.y);
  const off = on.map((q) => ({ y: q.y, d: q.x - armAt(arm, q.y).outer }));
  // The top: the first part of the line, down to the underarm at most (a flutter flares from there).
  const reach = on.length ? on[0].y + 0.4 * (on[on.length - 1].y - on[0].y) : 0;
  const upper = off.filter((o) => o.y < arm.under.y + 4 && o.y <= reach);
  const lower = off.slice(Math.floor(off.length * 0.7));
  const end = on[on.length - 1]?.y ?? arm.tip.y;
  return { top: upper.length ? Math.max(...upper.map((o) => o.d)) : 0, bottom: lower.length ? median(lower.map((o) => o.d)) : 0, most: Math.max(...off.map((o) => Math.abs(o.d)), 0), end };
}

/** The shape a line down the arm draws, by where it stands off the arm. */
function shapeOfLine(stroke: P[], arm: FormArm, range: SleeveRange): SleeveShape {
  const s = standOff(stroke, arm);
  const cm = s.end - arm.tip.y;
  if (cm < range.named.short - 4) return s.bottom - s.top > 1.5 ? 'flutter' : 'cap';
  if (cm < arm.elbowY - arm.tip.y - 3 && s.bottom - s.top > 2.5) return 'flutter';
  if (s.top > 2 && s.top > s.bottom + 1.5) return 'puff';
  if (s.bottom > 2.5 && s.bottom > s.top + 1.5 && cm > arm.elbowY - arm.tip.y) return 'bishop';
  if (s.most < 1.2) return 'fitted';
  return 'straight';
}

/** A sleeve line on a bodice or a dress's bodice. */
export function readBodiceSleeve(stroke: P[], draft: BodiceDraft, arm: FormArm, range: SleeveRange, c: BodiceChoices, garment: 'bodice' | 'dress' = 'bodice'): Reading<BodiceChoices> {
  const kind = sleeveStroke(stroke, arm, landmarks(draft).neckPoint);
  if (!kind) return { said: 'Draw on the arm: across it where the sleeve ends, or down its outside for the sleeve’s shape.' };
  if (kind.startsWith('cut_')) {
    const cut = kind === 'cut_raglan' ? 'raglan' : kind === 'cut_drop' ? 'drop' : 'set_in';
    if (!c.sleeve || c.sleeve === 'none') return { said: 'Draw the sleeve first: across the arm where it ends.' };
    const blocked = sleeveCutBlocked(c, cut);
    if (blocked) return { said: blocked };
    const { sleeveCut: _c, ...rest } = c;
    const next = validDetails(cut === 'set_in' ? rest : { ...rest, sleeveCut: cut }, garment);
    return { choices: next, said: cut === 'raglan' ? 'Raglan sleeves: the seam runs from the neck to under the arm.' : cut === 'drop' ? 'A dropped shoulder: the sleeve seam sits down on the top of the arm.' : 'Set-in sleeves, sewn into the armhole.' };
  }
  const allowed = (len: Exclude<SleeveLength, 'none'>) => detailAllowed(c, 'sleeve', len, garment);
  if (!allowed('short')) return { said: 'This neckline has no shoulders for a sleeve to hang from.' };
  const s = standOff(stroke, arm);
  const ends = kind === 'across' ? median(onArm(stroke, arm).map((q) => q.y)) : s.end;
  const cm = Math.min(range.max, Math.max(range.min, ends - arm.tip.y));
  const shape = kind === 'down' ? shapeOfLine(stroke, arm, range) : undefined;
  if (shape === 'cap' || shape === 'flutter') {
    if (cm < range.named.short - 4 || shape === 'cap') {
      const next = validDetails({ ...c, sleeve: 'short', sleeveShape: shape, sleeveCm: undefined }, garment);
      return { choices: next, said: shape === 'cap' ? 'Cap sleeves, just over the top of the arm.' : 'Flutter sleeves, falling loose from the shoulder.' };
    }
  }
  const slid = slideSleeve({ ...c, ...(shape ? { sleeveShape: shape } : {}), sleeve: c.sleeve && c.sleeve !== 'none' ? c.sleeve : 'short' }, cm, range.named);
  const length = slid.sleeve as Exclude<SleeveLength, 'none'>;
  if (!allowed(length)) return { said: `A ${LENGTH_WORDS[length]} sleeve doesn’t go with the rest of this bodice.` };
  const fits = !shape || SHAPES_FOR_LENGTH[length].includes(shape);
  const next = validDetails(slid, garment);
  const where = `${Math.round(cm)} cm from the shoulder`;
  if (!shape) return { choices: next, said: `Sleeves ${where}, ${LENGTH_WORDS[length]}.` };
  if (!fits) {
    const lengths = SLEEVE_LENGTHS.filter((l) => SHAPES_FOR_LENGTH[l].includes(shape)).map((l) => LENGTH_WORDS[l]);
    return { choices: next, said: `${SHAPE_WORDS[shape]} sleeves come ${lengths.join(' or ')}, so this one is straight, ${where}.` };
  }
  return { choices: next, said: `${SHAPE_WORDS[shape]} sleeves, ${LENGTH_WORDS[length]}, ${where}.` };
}

/** A sleeve line on a jacket or coat: its sleeves run to the wrist, so a line down the arm picks the cut. */
export function readOuterSleeve(stroke: P[], arm: FormArm, neckPoint: P, c: OuterChoices): Reading<OuterChoices> {
  const kind = sleeveStroke(stroke, arm, neckPoint);
  if (kind === 'across') return { said: `${c.garment === 'coat' ? 'Coat' : 'Jacket'} sleeves run to the wrist. Draw down the outside of the arm for how close they sit.` };
  if (kind === 'cut_raglan') {
    // A raglan is cut off a one-piece body with no shoulder seam: princess seams give way to darts, a notched lapel to a stand collar.
    const next: OuterChoices = { ...c, sleeve: 'raglan', shaping: c.shaping === 'princess' ? 'darts' : c.shaping, collar: c.collar === 'notched' ? 'stand' : c.collar };
    return { choices: next, said: 'Raglan sleeves: the seam runs from the neck to under the arm.' };
  }
  if (kind !== 'down') return { said: 'Draw down the outside of the arm: close to it for a fitted sleeve, further out for a straight one; from the neck to under the arm for a raglan.' };
  const s = standOff(stroke, arm);
  const sleeve: OuterSleeve = s.most < 1.6 ? 'fitted' : s.most > 3.2 ? 'straight' : 'tailored';
  const words: Record<OuterSleeve, string> = {
    fitted: 'A fitted sleeve: one piece, close to the arm, with an elbow dart.',
    tailored: 'A tailored sleeve: two pieces, following the arm’s bend.',
    straight: 'A straight sleeve: one piece, with room down to the wrist.',
    raglan: 'Raglan sleeves: the seam runs from the neck to under the arm.',
  };
  return { choices: { ...c, sleeve }, said: words[sleeve] };
}

/** Where the sleeve ends on the arm, as a line across it, both arms. */
export function sleeveEndLines(arm: FormArm, sleeve?: Pick<SleeveDraft, 'lengthCm'>): Partial<Record<FormLine, P[][]>> {
  if (!sleeve) return {};
  const y = Math.min(arm.wristY, arm.tip.y + sleeve.lengthCm);
  const a = armAt(arm, y);
  const across = [{ x: a.inner, y }, { x: a.outer, y }];
  return { sleeve: [across, across.map((q) => ({ x: -q.x, y: q.y }))] };
}

/** What to draw for a sleeve on a jacket or coat. */
export const OUTER_SLEEVE_HELP = 'Draw down the outside of the arm: close to it for a fitted sleeve, following its bend for a tailored one, further out for a straight one.';
