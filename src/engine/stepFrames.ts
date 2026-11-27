// Close-up drawings for the trickier sewing steps (a tester asked for them on the back welt pocket, Nov 27): a few small
// drawings per step, each one showing the sentence it sits beside, in the same fine-line style as the step diagrams.
// Each drawing is picked by the words of its sentence, never by its place in the step, so a reworded step still finds
// its drawings, and one that no longer matches shows the step's usual picture instead of a wrong one.
import { p } from './geometry';
import { type Diagram, type DiagramPart, arrow, curve, line, rect } from './diagrams';

export interface Frame {
  /** The sentence this drawing shows. A sentence with no drawing of its own keeps the one before it. */
  match: RegExp;
  dg: Diagram;
}

export interface FrameSet {
  /** The steps it is drawn for, by title. */
  title: RegExp;
  frames: Frame[];
}

const W = 40;
const H = 24;
const dg = (caption: string, parts: DiagramPart[], notes: Diagram['notes'] = []): Diagram => ({ w: W, h: H, caption, parts, notes });

// The welt pocket, drawn at 2 units to the cm across, so the 13 cm opening runs from 7 to 33, and twice that up and
// down, so a 1.2 cm box (BACK_WELT.depth) is deep enough to see its corners: 4.8 units, from the upper line at 8.6.
const X0 = 7;
const X1 = 33;
const V = 4;
const UP = 8.6;
const LO = UP + 1.2 * V;
const MID = (UP + LO) / 2;
const box = (): DiagramPart => ({ pts: [p(X0, UP), p(X1, UP), p(X1, LO), p(X0, LO)], kind: 'chalk', closed: true });
/** The welt, folded, its stitching on the box's lower line: its fold 1.2 cm below, its raw edges 1 cm above (its
 *  1 cm seam allowance), and 1 cm past each end. */
const weltDown = (): DiagramPart[] => [rect(X0 - 2, LO - V, X1 + 2, LO + 1.2 * V, 'fold'), line('edge', p(X0 - 2, LO + 1.2 * V), p(X1 + 2, LO + 1.2 * V))];

const WELT: Frame[] = [
  {
    match: /\bchalk the\b.*\bbox\b|\binterfacing behind\b/i,
    dg: dg(
      'The pocket box chalked on the right side of the back, from the pattern, with interfacing fused behind it.',
      [rect(2, 2, 38, 22), rect(4, 5, 36, 17, 'under'), box()],
      [
        { at: p(20, MID + 0.5), text: 'POCKET BOX' },
        { at: p(37, 20.6), text: 'RIGHT SIDE', end: true },
        { at: p(5, 19.4), text: 'INTERFACING BEHIND' },
      ],
    ),
  },
  {
    match: /^Fold each (back )?welt\b/i,
    dg: dg(
      'The welt folded in half along its length, right side out, and pressed.',
      [rect(4, 11, 36, 18), rect(4, 4, 36, 11, 'fold'), line('edge', p(4, 11), p(36, 11)), ...arrow(curve(p(37.2, 3.5), p(39.6, 7.5), p(37.2, 11.5), 6))],
      [
        { at: p(20, 8), text: 'WELT, FOLDED DOWN' },
        { at: p(4, 21), text: 'FOLD, RIGHT SIDE OUT' },
      ],
    ),
  },
  {
    match: /^Lay it on the .* below (the|its) box\b/i,
    dg: dg(
      'The folded welt below the box, its raw edges toward the box, stitched along the box\'s lower line from end to end.',
      [rect(2, 2, 38, 22), box(), ...weltDown(), line('machine', p(X0, LO), p(X1, LO))],
      [
        { at: p(20, UP - 1.6), text: 'POCKET BOX' },
        { at: p(20, LO + 1.2 * V - 1.3), text: 'WELT' },
      ],
    ),
  },
  {
    match: /\bfacing\b.*\bupper line\b/i,
    dg: dg(
      'The facing laid above the box, edge toward it, stitched along the upper line, stopping 0.5 cm short of each end.',
      [rect(2, 2, 38, 22), ...weltDown(), rect(5, 2, 35, UP + V, 'fold'), line('machine', p(X0, LO), p(X1, LO)), line('machine', p(X0 + 1, UP), p(X1 - 1, UP)), line('edge', p(X0 + 1, UP + 0.8), p(X0 + 1, UP + 2)), line('edge', p(X1 - 1, UP + 0.8), p(X1 - 1, UP + 2))],
      [
        { at: p(20, 5.6), text: 'POCKET FACING' },
        { at: p(X1 - 0.6, UP + 3.2), text: '0.5 CM SHORT', end: true },
        { at: p(20, LO + 1.2 * V - 1.3), text: 'WELT' },
      ],
    ),
  },
  {
    match: /^Cut (through )?(the (back|front) )?between the lines\b/i,
    dg: dg(
      'From the wrong side: cut along the middle of the box, then into each corner in a small V, just short of the stitching.',
      [
        rect(2, 2, 38, 22),
        line('machine', p(X0, LO), p(X1, LO)),
        line('machine', p(X0 + 1, UP), p(X1 - 1, UP)),
        line('edge', p(X0 + 3, MID), p(X1 - 3, MID)),
        line('edge', p(X0 + 1.4, UP + 0.5), p(X0 + 3, MID), p(X0 + 0.4, LO - 0.5)),
        line('edge', p(X1 - 1.4, UP + 0.5), p(X1 - 3, MID), p(X1 - 0.4, LO - 0.5)),
      ],
      [
        { at: p(20, UP - 1.6), text: 'CUT, THEN SNIP A V' },
        { at: p(37, 20.6), text: 'WRONG SIDE', end: true },
      ],
    ),
  },
  {
    match: /\bflip the welt up\b/i,
    dg: dg(
      'From the right side: the facing pushed through and the welt flipped up to fill the opening, then pressed.',
      [rect(2, 2, 38, 22), rect(X0, UP, X1, LO, 'fold'), line('edge', p(X0, UP), p(X1, UP)), line('edge', p(X0, UP), p(X0, LO)), line('edge', p(X1, UP), p(X1, LO)), ...arrow([p(20, 20), p(20, LO + 1)])],
      [
        { at: p(20, UP - 1.6), text: 'WELT FLIPPED UP' },
        { at: p(37, 20.6), text: 'RIGHT SIDE', end: true },
      ],
    ),
  },
  {
    match: /\bpocket bag\b|\bbags? hang\b/i,
    dg: dg(
      'From the wrong side: a bag sewn to the welt and one to the facing, then the two bags sewn together round their edges, catching the little triangles at the ends.',
      [
        rect(2, 2, 38, 22),
        { pts: [p(5, 5), p(5, 19), ...curve(p(5, 19), p(5, 22), p(8, 22), 6), p(32, 22), ...curve(p(32, 22), p(35, 22), p(35, 19), 6), p(35, 5)], kind: 'fold', closed: true },
        { pts: [p(6, 5), p(6, 19), ...curve(p(6, 19), p(6, 21), p(8, 21), 6), p(32, 21), ...curve(p(32, 21), p(34, 21), p(34, 19), 6), p(34, 5)], kind: 'machine' },
        { pts: [p(X0, UP), p(X0 + 1.6, MID), p(X0, LO)], kind: 'cloth', closed: true },
        { pts: [p(X1, UP), p(X1 - 1.6, MID), p(X1, LO)], kind: 'cloth', closed: true },
        line('under', p(X0, UP), p(X1, UP)),
        line('under', p(X0, LO), p(X1, LO)),
      ],
      [
        { at: p(20, 18.5), text: 'BAGS SEWN TOGETHER' },
        { at: p(X0 + 0.4, UP - 1.4), text: 'CATCH THE TRIANGLES' },
      ],
    ),
  },
];

export const FRAME_SETS: FrameSet[] = [{ title: /\bwelt pockets?\b/i, frames: WELT }];

/** The drawing for each of a step's lines (its sentences), or none when the step has no close-ups. A line before the
 *  first drawing's sentence shows the first drawing. */
export function framesFor(title: string, lines: string[]): Diagram[] | undefined {
  const set = FRAME_SETS.find((s) => s.title.test(title));
  if (!set) return undefined;
  let at = 0;
  let seen = false;
  const out = lines.map((ln) => {
    const k = set.frames.findIndex((f) => f.match.test(ln));
    if (k >= 0) {
      at = k;
      seen = true;
    }
    return at;
  });
  // Words that no longer match any drawing get the step's usual picture, not a guess.
  if (!seen) return undefined;
  return out.map((k) => set.frames[k].dg);
}
