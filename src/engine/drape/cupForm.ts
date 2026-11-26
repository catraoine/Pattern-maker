// A full cup on the form. The form is one shape scaled ring by ring to the wearer's girths, and above the bust it keeps
// the full bust's scale all the way up. That is a body whose bust is about 6 cm more than its high bust. A wearer with a
// fuller cup (bust 112, high bust 94) has a narrower back and upper chest than that, and more of the bust out in front.
// Their top is drafted that way, from the high bust with the cup added to the front, so on the even form its back sank
// into the form's back and the front was pulled tight across it (bug hunt, Nov 25: the Black Vest and the Ice Peplum
// fell back to the drawing on the fuller-bust body). Here the form is drawn in above the bust to the high bust, and at
// the bust the front stands further forward, each ring keeping its girth. On eight full-cup bodies (Nov 26) the vest and
// the peplum, sleeves on, showed All round 14 times in 16, against 6 on the even form.
import { bodyHalf, shapeAt } from '../body';
import { knob } from './knob';

/** The bust's line on the form, the high bust's above it, and the waist's. */
const BUST_Y = -0.575;
const HIGH_BUST_Y = -0.95;
const WAIST_Y = 0.1;
/** The bust the form is shaped for, over the high bust (cm), as the drawing's form takes it (body3d.ts). */
const FORM_CUP = 6;
/** How far forward the front stands at the bust, per cm of cup past the form's, and at most (as body3d.ts). */
const FORWARD = 0.025;
const FORWARD_MAX = 0.3;
const N = 96;

/** Half a ring's length round the front, side and back, its point at angle a from the front r(a) out. */
function halfRound(r: (a: number) => number): number {
  let len = 0;
  let px = 0;
  let pz = r(0);
  for (let k = 1; k <= N; k++) {
    const a = (Math.PI * k) / N;
    const x = Math.sin(a) * r(a);
    const z = Math.cos(a) * r(a);
    len += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return len;
}

/** How much further out than the even form the body stands at angle `a` (from the front) on the form's line `y`, for a
 *  wearer with this full and high bust: undefined when the form already fits (no high bust given, or a cup no fuller
 *  than the form's). */
export function cupForm(fullBust: number | undefined, highBust: number | undefined): ((a: number, y: number) => number) | undefined {
  // (__noCup draws the even form, to compare.)
  if (knob('__noCup') || !fullBust || !highBust || fullBust - highBust <= FORM_CUP) return undefined;
  const high = (highBust + FORM_CUP) / fullBust;
  const forward = Math.min(FORWARD_MAX, (fullBust - highBust - FORM_CUP) * FORWARD);
  const memo = new Map<number, { g: number; cup: number; keep: number }>();
  const at = (y: number) => {
    const key = Math.round(y * 400);
    const hit = memo.get(key);
    if (hit) return hit;
    // Drawn in toward the high bust from the bust up, and all the way in from the high bust to the top: the shoulders
    // are set by their own width (makeSpace's widen), so only the back and chest under them come in.
    const up = y >= BUST_Y ? 0 : y >= HIGH_BUST_Y ? (BUST_Y - y) / (BUST_Y - HIGH_BUST_Y) : 1;
    const g = 1 - up * (1 - high);
    // The bust forward most at its line, less toward the high bust and the waist.
    const cup = forward * (y <= BUST_Y ? Math.max(0, 1 - (BUST_Y - y) / (BUST_Y - HIGH_BUST_Y)) : Math.max(0, 1 - (y - BUST_Y) / (WAIST_Y - BUST_Y)));
    // (Each ring keeps the length it had once drawn in: the bust forward is taken from round the back.)
    const even = (a: number) => bodyHalf(y) * shapeAt(a, y);
    const keep = cup > 0 ? halfRound(even) / halfRound((a) => even(a) * (1 + cup * Math.max(0, Math.cos(a)) ** 2)) : 1;
    const v = { g, cup, keep };
    memo.set(key, v);
    return v;
  };
  return (a, y) => {
    const { g, cup, keep } = at(y);
    return g * (cup > 0 ? (1 + cup * Math.max(0, Math.cos(a)) ** 2) * keep : 1);
  };
}
