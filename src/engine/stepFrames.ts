// Close-up drawings for the trickier sewing steps (a tester asked for them on the back welt pocket, Nov 27): a few small
// drawings per step, each one showing the sentence it sits beside, in the same fine-line style as the step diagrams.
// Each drawing is picked by the words of its sentence, never by its place in the step, so a reworded step still finds
// its drawings, and one that no longer matches shows the step's usual picture instead of a wrong one.
import { p } from './geometry';
import { type Diagram, type DiagramPart, arrow, curve, line, rect } from './diagrams';

interface Frame {
  /** The sentence this drawing shows. A sentence with no drawing of its own keeps the one before it. */
  match: RegExp;
  dg: Diagram;
}

interface FrameSet {
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
        { at: p(37, 4), text: 'RIGHT SIDE', end: true },
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
        { at: p(X1 - 0.6, UP + 3.2), text: 'STOP SHORT', end: true },
        { at: p(20, LO + 1.2 * V - 1.3), text: 'WELT' },
      ],
    ),
  },
  {
    match: /^Cut (through )?(the (back|front) )?between the lines\b/i,
    dg: dg(
      'From the wrong side: cut along the middle of the box through the back only, the welt and facing allowances lifted clear on the other side, then into each corner in a small V, just short of the stitching.',
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
        { at: p(20, LO + 3.4), text: 'BACK ONLY, ALLOWANCES CLEAR' },
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


// The fly zip, seen from the outside as worn (the left front on the right of the drawing), at 1 unit to the cm, so the
// 18 cm zip runs from the waist at 2 to its ZIP ENDS notch at 20. The centre front is at 20 across.
const CF = 20;
const TOP = 2;
const END = 20;
const teeth = (x: number): DiagramPart[] => Array.from({ length: 18 }, (_, i) => line('hand', p(x, TOP + 0.5 + i), p(x + 1, TOP + 0.5 + i)));
const FLY: Frame[] = [
  {
    match: /^Sew the fly facing\b/i,
    dg: dg(
      "The fly facing on the left front's centre front edge, right sides together, sewn 1 cm in from the waist to the ZIP ENDS notch.",
      [
        { pts: [p(CF - 1, TOP), p(37, TOP), p(37, 22), p(26, 22), ...curve(p(26, 22), p(CF - 1, 22), p(CF - 1, END + 0.5), 6)], kind: 'cloth', closed: true },
        { pts: [p(CF - 1, TOP), p(CF + 4, TOP), p(CF + 4, END - 4), ...curve(p(CF + 4, END - 4), p(CF + 4, END), p(CF - 1, END + 0.5), 6)], kind: 'fold', closed: true },
        line('machine', p(CF, TOP), p(CF, END)),
        line('edge', p(CF - 2.2, END), p(CF - 0.6, END)),
      ],
      [
        { at: p(30.5, 8), text: 'LEFT FRONT', mid: true },
        { at: p(CF + 5, 12), text: 'FLY FACING' },
        { at: p(CF - 2.6, END + 0.5), text: 'ZIP ENDS', end: true },
        { at: p(CF - 2.6, 6), text: 'SEAM LINE', end: true },
      ],
    ),
  },
  {
    match: /\bpress the centre front edge under\b/i,
    dg: dg(
      "The right front's centre front edge pressed under, so its fold sits 0.5 cm past the centre front line.",
      [rect(3, TOP, CF + 0.5, 22), rect(CF - 1, TOP, CF + 0.5, 22, 'under'), line('chalk', p(CF, TOP), p(CF, 22)), line('edge', p(CF + 0.5, TOP), p(CF + 0.5, 22)), ...arrow(curve(p(CF + 4, 9), p(CF + 2.6, 6.5), p(CF + 1.2, 8), 6))],
      [
        { at: p(11, 8), text: 'RIGHT FRONT', mid: true },
        { at: p(CF - 1.6, 21), text: 'CENTRE FRONT', end: true },
        { at: p(CF + 2, 12), text: 'FOLD JUST PAST' },
      ],
    ),
  },
  {
    match: /^Fold the fly shield\b/i,
    dg: dg(
      'The fly shield folded in half along its length, wrong sides together.',
      [rect(4, 11, 36, 18), rect(4, 4, 36, 11, 'fold'), line('edge', p(4, 11), p(36, 11)), ...arrow(curve(p(37.2, 3.5), p(39.6, 7.5), p(37.2, 11.5), 6))],
      [
        { at: p(20, 8), text: 'FLY SHIELD, FOLDED DOWN' },
        { at: p(4, 21), text: 'FOLD, WRONG SIDES TOGETHER' },
      ],
    ),
  },
  {
    match: /\bzip face up\b/i,
    dg: dg(
      "The zip face up under the right front's fold, the shield behind it, stitched close to the fold through all three.",
      [rect(CF - 2, TOP, CF + 8, END + 1, 'under'), rect(CF - 1, TOP, CF + 3, END + 0.5, 'fold'), ...teeth(CF + 0.8), rect(3, TOP, CF + 0.5, 22), line('machine', p(CF - 0.2, TOP), p(CF - 0.2, END))],
      [
        { at: p(11, 8), text: 'RIGHT FRONT', mid: true },
        { at: p(CF + 3.6, 9), text: 'ZIP' },
        { at: p(37, 23.2), text: 'SHIELD BEHIND', end: true },
      ],
    ),
  },
  {
    match: /^Close the zip and lap\b/i,
    dg: dg(
      'The zip closed and the left front lapped over it until the two centre front lines meet, hiding the teeth, then pinned.',
      [rect(3, TOP, CF + 0.5, 22), rect(CF, TOP, 37, 22), line('chalk', p(CF, TOP), p(CF, 22)), ...[6, 11, 16].map((y) => line('edge', p(CF + 1, y), p(CF + 4, y))), ...arrow([p(31, 12), p(26, 12)])],
      [
        { at: p(11, 8), text: 'RIGHT FRONT', mid: true },
        { at: p(30.5, 8), text: 'LEFT FRONT', mid: true },
        { at: p(CF, 21), text: 'CENTRE FRONTS MEET' },
      ],
    ),
  },
  {
    match: /\bfree tape\b/i,
    dg: dg("From the inside: the zip's free tape stitched to the fly facing only, the shield held out of the way.", [
      rect(3, TOP, 37, 22),
      { pts: [p(CF - 4, TOP), p(CF + 1, TOP), p(CF + 1, END + 0.5), ...curve(p(CF + 1, END + 0.5), p(CF - 4, END + 0.5), p(CF - 4, END - 4), 6)], kind: 'fold', closed: true },
      rect(CF - 2.5, TOP, CF + 0.5, END),
      line('machine', p(CF - 1.6, TOP), p(CF - 1.6, END - 1)),
      rect(CF + 3, TOP, CF + 9, END + 1, 'under'),
    ], [
      { at: p(CF - 5, 8), text: 'FACING ONLY', end: true },
      { at: p(CF + 3, END + 2.6), text: 'SHIELD CLEAR' },
      { at: p(36, 5), text: 'INSIDE', end: true },
    ]),
  },
  {
    match: /\bcurved fly line\b/i,
    dg: dg('From the outside: the curved fly line stitched through the left front and its facing, the shield kept clear.', [
      rect(3, TOP, 37, 22),
      line('edge', p(CF, TOP), p(CF, 22)),
      { pts: [p(CF + 3.5, TOP), p(CF + 3.5, END - 4), ...curve(p(CF + 3.5, END - 4), p(CF + 3.5, END), p(CF, END), 8)], kind: 'machine' },
    ], [
      { at: p(CF + 5, 9), text: 'FLY LINE' },
      { at: p(36, 21), text: 'OUTSIDE', end: true },
    ]),
  },
  {
    match: /^Bar-tack across the foot\b/i,
    dg: dg('A bar-tack across the foot of the fly, through the shield: close zigzag stitches over a few millimetres.', [
      rect(3, TOP, 37, 22),
      line('edge', p(CF, TOP), p(CF, 22)),
      { pts: [p(CF + 3.5, TOP), p(CF + 3.5, END - 4), ...curve(p(CF + 3.5, END - 4), p(CF + 3.5, END), p(CF, END), 8)], kind: 'machine' },
      line('hand', ...Array.from({ length: 13 }, (_, i) => p(CF - 0.6 + i * 0.3, i % 2 ? END - 0.8 : END + 0.8))),
    ], [
      { at: p(CF + 5, END + 0.5), text: 'BAR-TACK' },
      { at: p(36, 5), text: 'OUTSIDE', end: true },
    ]),
  },
];

// An invisible zip: one drawing for its one sentence.
const ZIP: Frame[] = [
  {
    match: /\binvisible zip\b/i,
    dg: dg(
      'The open invisible zip face down on the right side of each back, its teeth on the seam line, stitched close to the teeth from the top down to the ZIP ENDS notch.',
      [
        rect(2, 3, 19, 23),
        rect(21, 3, 38, 23),
        rect(15.6, 4.5, 19, 19.5, 'fold'),
        ...Array.from({ length: 15 }, (_, i) => line('hand', p(17.4, 5 + i), p(18.6, 5 + i))),
        line('machine', p(17.1, 4.5), p(17.1, 19)),
        rect(21, 4.5, 24.4, 19.5, 'under'),
        line('chalk', p(17.5, 3), p(17.5, 23)),
        line('chalk', p(22.5, 3), p(22.5, 23)),
        line('edge', p(18, 19.5), p(19.6, 19.5)),
        line('edge', p(20.4, 19.5), p(22, 19.5)),
      ],
      [
        { at: p(2, 1.8), text: 'ZIP FACE DOWN' },
        { at: p(3, 12.4), text: 'SEW HERE' },
        { at: p(3, 21.6), text: 'ZIP ENDS' },
        { at: p(25.4, 12.4), text: 'NEXT SIDE' },
        { at: p(38, 1.8), text: 'RIGHT SIDE', end: true },
      ],
    ),
  },
];

// A dress or top's upper edge, front, as one shape: its neckline between the shoulders and an armhole each side.
const NECK_A = p(15, 3);
const NECK_B = p(25, 3);
const neck = (dy = 0) => curve(p(NECK_A.x + (dy ? 0.6 : 0), NECK_A.y + dy), p(20, 13 + dy), p(NECK_B.x - (dy ? 0.6 : 0), NECK_B.y + dy), 12);
const armL = (dx = 0) => curve(p(8 + dx, 5 + dx), p(8 + dx, 13), p(3 + dx, 14), 10);
const armR = (dx = 0) => curve(p(32 - dx, 5 + dx), p(32 - dx, 13), p(37 - dx, 14), 10);
const top = (): DiagramPart[] => [{ pts: [p(3, 23), p(3, 14), ...armL().reverse(), NECK_A, ...neck(), NECK_B, ...armR(), p(37, 23)], kind: 'cloth', closed: true }];
const SHOULDERS = [line('edge', p(8, 5), NECK_A), line('edge', NECK_B, p(32, 5))];
/** Stitching 1 cm in round the neckline and each armhole, stopping short of the shoulders. */
const lined = (): DiagramPart[] => [
  { pts: neck(1.2).slice(2, -2), kind: 'machine' },
  { pts: armL(1).slice(2), kind: 'machine' },
  { pts: armR(1).slice(2), kind: 'machine' },
];
const LINING: Frame[] = [
  {
    match: /^Pin the lining to the dress\b/i,
    dg: dg('The lining laid on the dress, right sides together, neck and armholes matched.', [...top(), { pts: [p(3, 23), p(3, 14), ...armL().reverse(), NECK_A, ...neck(), NECK_B, ...armR(), p(37, 23)], kind: 'fold', closed: true }], [
      { at: p(20, 18), text: 'LINING ON TOP' },
      { at: p(20, 21), text: 'RIGHT SIDES TOGETHER' },
    ]),
  },
  {
    match: /^Sew the neckline\b|\bshoulders are still open\b/i,
    dg: dg('The neckline and each armhole sewn, every line stopping short of the open shoulders.', [...top(), ...lined()], [
      { at: p(20, 18), text: 'STOP SHORT OF THE SHOULDERS' },
    ]),
  },
  {
    match: /^Trim to\b.*\bclip the curves\b/i,
    dg: dg('The seams trimmed and the curves clipped, then understitched and turned right side out.', [
      ...top(),
      ...lined(),
      ...neck().filter((_, i) => i % 2 === 0 && i > 1 && i < 11).map((q) => line('edge', q, p(q.x, q.y + 0.9))),
      ...armL().filter((_, i) => i % 2 === 0 && i > 1).map((q) => line('edge', q, p(q.x + 0.9, q.y))),
      ...armR().filter((_, i) => i % 2 === 0 && i > 1).map((q) => line('edge', q, p(q.x - 0.9, q.y))),
    ], [{ at: p(20, 18), text: 'CLIP THE CURVES' }]),
  },
  {
    match: /^Sew the outer shoulders\b/i,
    dg: dg('The dress shoulders sewn right sides together, the lining held out of the way, then pressed open.', [
      ...top(),
      { pts: [p(4, 23), p(4, 16), ...curve(p(4, 16), p(11, 13), p(16, 10), 6), ...curve(p(16, 10), p(20, 15), p(24, 10), 8), ...curve(p(24, 10), p(29, 13), p(36, 16), 6), p(36, 23)], kind: 'fold', closed: true },
      line('machine', p(8.4, 5.6), p(14.8, 3.6)),
      line('machine', p(25.2, 3.6), p(31.6, 5.6)),
      ...SHOULDERS,
    ], [
      { at: p(20, 20), text: 'LINING HELD BACK' },
      { at: p(5, 2.6), text: 'DRESS ONLY' },
    ]),
  },
  {
    match: /\bturn under the lining shoulders\b/i,
    dg: dg('The lining shoulders turned under and slip-stitched closed over the seam, with the last few centimetres of neck and armhole.', [
      ...top(),
      ...lined(),
      ...SHOULDERS,
      ...[0.2, 0.4, 0.6, 0.8].flatMap((t) => [line('hand', p(8 + 7 * t, 5 - 2 * t + 0.8), p(8 + 7 * t + 0.5, 5 - 2 * t - 0.2)), line('hand', p(25 + 7 * t, 3 + 2 * t + 0.8), p(25 + 7 * t + 0.5, 3 + 2 * t - 0.2))]),
    ], [{ at: p(20, 18), text: 'SLIP-STITCH THE LINING SHOULDERS' }]),
  },
  {
    match: /\blining rolls just inside\b/i,
    dg: dg('Pressed so the lining rolls just inside the neck and armholes.', [...top(), ...SHOULDERS, { pts: neck(0.5), kind: 'under' }, { pts: armL(0.5), kind: 'under' }, { pts: armR(0.5), kind: 'under' }], [
      { at: p(20, 18), text: 'LINING ROLLS JUST INSIDE' },
    ]),
  },
];

// Box pleats, seen from the right side: a pleat's two solid fold lines and the dashed line between them.
const PLEATS: Frame[] = [
  {
    match: /\bfold along both solid lines\b/i,
    dg: dg('Fold along both solid lines and bring the two folds to meet over the dashed line between them.', [
      rect(2, 2, 38, 22),
      line('edge', p(11, 2), p(11, 22)),
      line('edge', p(29, 2), p(29, 22)),
      line('chalk', p(20, 2), p(20, 22)),
      ...arrow(curve(p(11, 12), p(15, 9), p(19, 12), 6)),
      ...arrow(curve(p(29, 12), p(25, 9), p(21, 12), 6)),
    ], [
      { at: p(11, 23.6), text: 'SOLID', mid: true },
      { at: p(20, 23.6), text: 'DASHED' },
      { at: p(29, 23.6), text: 'SOLID', mid: true },
    ]),
  },
  {
    match: /\bbaste down each fold\b/i,
    dg: dg('The folds meeting over the dashed line, pinned at the waist and hem and basted down each fold.', [
      rect(2, 2, 38, 22),
      rect(11, 2, 29, 22, 'under'),
      line('edge', p(19.9, 2), p(19.9, 22)),
      line('edge', p(20.1, 2), p(20.1, 22)),
      line('thread', p(18.6, 3), p(18.6, 21)),
      line('thread', p(21.4, 3), p(21.4, 21)),
      line('edge', p(16, 3), p(24, 3)),
      line('edge', p(16, 21), p(24, 21)),
    ], [
      { at: p(10, 8), text: 'FOLDS MEET', end: true },
      { at: p(30, 8), text: 'BASTE' },
    ]),
  },
  {
    match: /\bdamp press cloth\b/i,
    dg: dg('Pressed through a damp press cloth from the waist to the hem, each section left to cool before you move it.', [
      rect(2, 2, 38, 22),
      line('edge', p(20, 2), p(20, 22)),
      rect(6, 9, 34, 21, 'fold'),
      { pts: [p(12, 13), p(15, 8), p(29, 8), p(29, 13)], kind: 'cloth', closed: true },
      line('edge', p(18, 8), p(19.5, 6), p(27, 6), p(27, 8)),
    ], [{ at: p(20, 19), text: 'DAMP PRESS CLOTH' }]),
  },
];
const PLEAT_STITCH: Frame[] = [
  {
    match: /\bedge-stitch each fold\b/i,
    dg: dg('Each fold edge-stitched from the waist down to the hip line, the line angled a little at the top.', [
      rect(2, 2, 38, 22),
      line('edge', p(20, 2), p(20, 22)),
      line('chalk', p(2, 15), p(38, 15)),
      line('machine', p(18.3, 2), p(19.4, 6), p(19.4, 15)),
      line('machine', p(21.7, 2), p(20.6, 6), p(20.6, 15)),
    ], [
      { at: p(3, 14), text: 'HIP LINE' },
      { at: p(23, 9), text: 'EDGE-STITCH' },
    ]),
  },
  {
    match: /^Pull the threads through\b/i,
    dg: dg('The thread ends pulled through to the inside at the hip line and knotted, so the stitching cannot undo.', [
      rect(2, 2, 38, 22),
      line('edge', p(20, 2), p(20, 22)),
      line('chalk', p(2, 15), p(38, 15)),
      line('machine', p(19.4, 6), p(19.4, 15)),
      line('machine', p(20.6, 6), p(20.6, 15)),
      { pts: curve(p(19.4, 15), p(17, 18), p(16, 20), 6), kind: 'hand' },
      { pts: curve(p(20.6, 15), p(23, 18), p(24, 20), 6), kind: 'hand' },
    ], [{ at: p(20, 21.6), text: 'KNOT INSIDE' }]),
  },
  {
    match: /^Baste across the waist\b/i,
    dg: dg('A line of basting across the waist, just inside the seam allowance, holding every pleat.', [
      rect(2, 2, 38, 22),
      line('edge', p(12, 2), p(12, 22)),
      line('edge', p(28, 2), p(28, 22)),
      line('machine', p(10.3, 2), p(11.4, 6), p(11.4, 15)),
      line('machine', p(26.3, 2), p(27.4, 6), p(27.4, 15)),
      line('thread', p(2, 4), p(38, 4)),
    ], [{ at: p(20, 19.5), text: 'BASTE ACROSS THE WAIST' }]),
  },
];

// A French seam, from the side, at 3 units to the cm so its 0.6 cm and 0.3 cm read.
const FRENCH: Frame[] = [
  {
    match: /\bwrong sides together, sew\b.*\boutside the stitching line\b/i,
    dg: dg('The two pieces wrong sides together, sewn just outside the stitching line, inside the seam allowance.', [rect(2, 5, 36, 19), rect(2, 3, 36, 17, 'fold'), line('chalk', p(25, 2), p(25, 20)), line('machine', p(27, 3), p(27, 19))], [
      { at: p(3, 22.6), text: 'WRONG SIDES TOGETHER' },
      { at: p(24, 1.6), text: 'STITCHING LINE', end: true },
      { at: p(28, 22.6), text: 'SEW HERE' },
    ]),
  },
  {
    match: /^Trim to\b.*\bfold right sides together\b/i,
    dg: dg('Trimmed close, folded right sides together along the seam, and sewn on the stitching line, shutting the raw edges in.', [
      rect(2, 5, 24, 19),
      rect(2, 3, 24, 17, 'fold'),
      line('machine', p(22.6, 3), p(22.6, 19)),
      rect(24, 6.5, 27, 15.5, 'under'),
      line('edge', p(24, 3), p(24, 19)),
    ], [
      { at: p(28, 9), text: 'RAW EDGES' },
      { at: p(28, 12), text: 'SHUT INSIDE' },
      { at: p(3, 22.6), text: 'SEW ON THE STITCHING LINE' },
    ]),
  },
];

const ROULEAU: Frame[] = [
  {
    match: /\bbias strip\b/i,
    dg: dg('A narrow strip cut on the bias, across the grain at 45 degrees.', [rect(2, 2, 38, 22), line('edge', p(6, 22), p(26, 2)), line('edge', p(9, 22), p(29, 2)), line('chalk', p(2, 20), p(38, 20))], [
      { at: p(37, 8), text: 'BIAS STRIP', end: true },
      { at: p(3, 19), text: 'SELVEDGE' },
    ]),
  },
  {
    match: /^Fold it in half lengthwise\b/i,
    dg: dg('The strip folded in half along its length, right sides together, sewn close to the fold, the end angled out.', [rect(2, 9, 38, 15), line('edge', p(2, 9), p(38, 9)), line('machine', p(2, 10.4), p(33, 10.4), p(37, 15))], [
      { at: p(3, 7.4), text: 'FOLD' },
      { at: p(37, 19), text: 'END ANGLED OUT', end: true },
    ]),
  },
  {
    match: /\bloop turner\b/i,
    dg: dg('Trimmed close and turned right side out with a loop turner.', [rect(2, 10, 30, 14), line('under', p(3, 12), p(30, 12)), line('edge', p(30, 12), p(38, 12)), { pts: curve(p(36.6, 12), p(39, 12.5), p(37.6, 14), 4), kind: 'edge' }], [
      { at: p(20, 7.4), text: 'LOOP TURNER INSIDE' },
    ]),
  },
  {
    match: /^Cut it into\b/i,
    dg: dg('The tube cut into short loops.', [rect(2, 10, 9, 14), rect(11, 10, 18, 14), rect(20, 10, 27, 14), rect(29, 10, 36, 14)], [{ at: p(20, 7.4), text: 'CUT INTO LOOPS' }]),
  },
];

// The back opening of a top, the right back (as worn) on the left of the drawing.
const marks = [5, 9, 13, 17, 21];
const LOOPS: Frame[] = [
  {
    match: /\bmark\b.*\bpoints down the centre back line\b/i,
    dg: dg('Points marked down the centre back line of the right back, evenly spaced, the first just below the neck.', [rect(2, 2, 24, 24), line('chalk', p(21, 2), p(21, 24)), ...marks.map((y) => line('edge', p(20, y), p(22, y)))], [
      { at: p(18.6, 3.6), text: 'CENTRE BACK', end: true },
      { at: p(10, 13), text: 'RIGHT BACK', mid: true },
    ]),
  },
  {
    match: /\bbaste its ends\b/i,
    dg: dg('Each loop folded in half and basted at a mark, its ends in the allowance and the loop pointing toward the side seam.', [
      rect(2, 2, 24, 24),
      line('chalk', p(21, 2), p(21, 24)),
      ...marks.map((y) => ({ pts: [p(23.6, y - 0.6), ...curve(p(18.6, y - 0.6), p(16.2, y), p(18.6, y + 0.6), 6), p(23.6, y + 0.6)], kind: 'edge' as const })),
      line('thread', p(22.6, 3), p(22.6, 23)),
    ], [
      { at: p(9, 13), text: 'POINT IN', mid: true },
    ]),
  },
  {
    match: /\bunder twice\b/i,
    dg: dg('The allowance turned under twice so the fold falls on the centre back line, the loops standing out from the fold.', [
      rect(2, 2, 21, 24),
      rect(18, 2, 21, 24, 'under'),
      ...marks.map((y) => ({ pts: [p(21, y - 0.6), ...curve(p(23, y - 0.6), p(25.4, y), p(23, y + 0.6), 6), p(21, y + 0.6)], kind: 'edge' as const })),
      ...[4, 8, 12, 16, 20].map((y) => line('hand', p(18, y), p(18.6, y + 0.8))),
    ], [{ at: p(9, 13), text: 'STAND OUT', mid: true }]),
  },
  {
    match: /\bcovered button\b/i,
    dg: dg('A covered button on the left back opposite each loop, just in from the fold, so the edges meet with no gap.', [
      rect(2, 2, 20, 24),
      rect(20, 2, 38, 24),
      ...marks.map((y) => ({ pts: [p(20, y - 0.6), ...curve(p(22.4, y - 0.6), p(24.4, y), p(22.4, y + 0.6), 6), p(20, y + 0.6)], kind: 'edge' as const })),
      ...marks.map((y) => ({ pts: Array.from({ length: 13 }, (_, i) => p(22.6 + 1.2 * Math.cos((i / 12) * 2 * Math.PI), y + 1.2 * Math.sin((i / 12) * 2 * Math.PI))), kind: 'fold' as const, closed: true })),
    ], [
      { at: p(11, 13), text: 'RIGHT BACK', mid: true },
      { at: p(31, 13), text: 'LEFT BACK', mid: true },
    ]),
  },
];

// A slant pocket on a trouser front, its opening running down from the waist to the side.
const FRONT = (): DiagramPart => ({ pts: [p(3, 2), p(24, 2), p(37, 14), p(37, 23), p(3, 23)], kind: 'cloth', closed: true });
const SLANT: Frame[] = [
  {
    match: /\bPOCKET OPENING edge\b/i,
    dg: dg('A pocket lining pinned to the front along the slanted opening edge, right sides together.', [FRONT(), { pts: [p(19, 2), p(24, 2), p(37, 14), p(37, 18), ...curve(p(37, 18), p(26, 20), p(19, 12), 8)], kind: 'fold', closed: true }], [
      { at: p(10, 12), text: 'FRONT', mid: true },
      { at: p(22, 5), text: 'POCKET OPENING', end: true },
      { at: p(27, 15.2), text: 'LINING', mid: true },
    ]),
  },
  {
    match: /\bunderstitch\b/i,
    dg: dg('Sewn along the opening, trimmed, the lining pressed away from the front and understitched to the seam allowance.', [FRONT(), line('machine', p(23.4, 3.2), p(35.6, 14.4)), { pts: [p(24, 2), p(37, 14), p(39, 12), p(26, 0.4)], kind: 'fold', closed: true }, line('machine', p(25, 1.5), p(37.6, 13.2))], [
      { at: p(10, 12), text: 'FRONT', mid: true },
      { at: p(22, 6), text: 'UNDERSTITCH', end: true },
    ]),
  },
  {
    match: /^Turn the lining to the inside\b/i,
    dg: dg('The lining turned to the inside and the opening pressed so the lining rolls just out of sight.', [FRONT(), line('under', p(23, 3.2), p(35.8, 15.2)), line('machine', p(22.6, 3.6), p(35.4, 15.6))], [
      { at: p(10, 12), text: 'FRONT', mid: true },
      { at: p(22, 20), text: 'LINING ROLLED INSIDE', mid: true },
    ]),
  },
  {
    match: /^Lay a pocket facing under\b|^Zigzag or overlock them together\b/i,
    dg: dg('From the inside: the pocket facing laid under the lining, curved bag edges matched and sewn together.', [
      FRONT(),
      { pts: [p(19, 2), p(37, 2), p(37, 18), ...curve(p(37, 18), p(26, 20), p(19, 12), 8)], kind: 'fold', closed: true },
      { pts: curve(p(36, 17.6), p(26, 19), p(20, 12), 8), kind: 'machine' },
    ], [
      { at: p(28, 9), text: 'FACING UNDER LINING', mid: true },
      { at: p(4, 22), text: 'INSIDE' },
    ]),
  },
  {
    match: /\bfacing fills in the corner\b|\bMatch the facing's notch\b/i,
    dg: dg('The front laid flat, the facing filling in the corner, tacked along the waist and down the side inside the seam allowance.', [
      { pts: [p(3, 2), p(37, 2), p(37, 23), p(3, 23)], kind: 'cloth', closed: true },
      line('under', p(24, 2), p(37, 14)),
      line('machine', p(24, 2.8), p(36.2, 2.8), p(36.2, 16)),
      line('edge', p(36.2, 14), p(38, 14)),
    ], [
      { at: p(13, 12), text: 'ONE PIECE AGAIN', mid: true },
      { at: p(35.6, 18), text: 'TACK IN THE ALLOWANCE', end: true },
    ]),
  },
];

export const FRAME_SETS: FrameSet[] = [
  { title: /\bwelt pockets?\b/i, frames: WELT },
  { title: /\bfly zip\b/i, frames: FLY },
  { title: /^Put in the zip$/i, frames: ZIP },
  { title: /^Line the neck and armholes$/i, frames: LINING },
  { title: /^Fold and press the pleats$/i, frames: PLEATS },
  { title: /^Stitch the pleats down$/i, frames: PLEAT_STITCH },
  { title: /^Sew French seams$/i, frames: FRENCH },
  { title: /^Make the rouleau loops$/i, frames: ROULEAU },
  { title: /^Close the back with buttons and loops$/i, frames: LOOPS },
  { title: /^Make the slant pockets$/i, frames: SLANT },
];

/** The drawing for each of a step's lines (its sentences), or none when the step has no close-ups. A line before the
 *  first drawing's sentence shows the first drawing. */
/** A step's drawings once each, in order, for the printed list and booklet (paper can't follow your ticks). */
export function stepFrames(title: string, lines: string[]): Diagram[] {
  return [...new Set(framesFor(title, lines) ?? [])];
}

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
