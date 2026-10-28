// Draw on your form: collars and the front opening, on the bodice and the dress. A line round the neck
// is read the way a draper reads a collar pinned on a form:
// - standing up above the neckline: a band collar, a mandarin when it stands low, a funnel neck when it
//   stands tall;
// - lying flat below the neckline and curving round to the centre front: a Peter Pan collar; coming to
//   points at the front: a shirt collar, which buttons down the front; hanging down at the centre front:
//   a pussy bow; wavy along the neckline: a ruffle; drawn over the neckline itself: no collar.
// A front line: straight down the centre front opens it with buttons; crossing from the neck over to the
// side at the waist is a wrap; down the centre back puts the zip back.
// The same coordinates as formLines.ts: cm, the centre at x = 0, y running down.
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';
import type { Collar } from '../engine/collar';
import { BodiceChoices, detailAllowed, validDetails } from '../garments';
import { FormSide, Reading, bodiceLines, landmarks, median } from './formLines';

type Garment = 'bodice' | 'dress';
const COLLAR_WORDS: Record<Collar, string> = {
  none: 'No collar: the neckline is finished plain.',
  peter_pan: 'A Peter Pan collar, lying flat and rounded at the front.',
  mandarin: 'A mandarin collar, a low band standing round the neck.',
  mock: 'A mock neck.',
  funnel: 'A funnel neck, standing tall from the neckline.',
  shirt: 'A shirt collar on a stand, its points at the front.',
  bow: 'A pussy bow, tied at the centre front.',
  ruffle: 'A ruffle sewn into the neckline.',
  cape: 'A cape sewn into the neckline, falling over the shoulders to the elbow.',
};
const COLLAR_NEEDS: Partial<Record<Collar, string>> = {
  shirt: 'A shirt collar goes on a crew neckline that buttons down the front.',
  bow: 'A pussy bow ties on a crew or V neck that opens at the back.',
  ruffle: 'A ruffle goes round a neckline that rings the neck.',
};

/** The angle at a line's corner, in degrees: 180 is straight on, small is a sharp point. */
function cornerAt(pts: P[], i: number, reach = 1.5): number {
  const back = [...pts.slice(0, i)].reverse().find((q) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y) >= reach);
  const on = pts.slice(i + 1).find((q) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y) >= reach);
  if (!back || !on) return 180;
  const a = { x: back.x - pts[i].x, y: back.y - pts[i].y };
  const b = { x: on.x - pts[i].x, y: on.y - pts[i].y };
  return (Math.acos((a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y))) * 180) / Math.PI;
}

/** A collar line, read against the neckline as it stands. */
export function readCollar(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice'): Reading<BodiceChoices> {
  const neck = (bodiceLines(draft, 'front').neckline ?? []).flat();
  if (!neck.length || stroke.length < 3) return { said: 'Draw the collar round the neck.' };
  const { neckPoint } = landmarks(draft);
  // How far each point is below the neckline (above it when negative), against the nearest point on it.
  const below = stroke.map((q) => {
    const n = neck.reduce((a, b) => (Math.abs(b.x - q.x) < Math.abs(a.x - q.x) ? b : a));
    return q.y - n.y;
  });
  const near = stroke.filter((q) => Math.abs(q.x) < neckPoint.x + 10 && q.y < neckPoint.y + 25);
  if (near.length < stroke.length * 0.6) return { said: 'Draw the collar round the neck, from the shoulder to the centre front.' };
  const centre = stroke.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
  const cfNeck = neck.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
  let collar: Collar;
  const ups = below.filter((d) => d < -0.8);
  const waves = stroke.reduce((n, q, i) => (i > 1 && Math.sign(q.y - stroke[i - 1].y) !== Math.sign(stroke[i - 1].y - stroke[i - 2].y) && Math.abs(q.y - stroke[i - 1].y) > 0.2 ? n + 1 : n), 0);
  if (ups.length > stroke.length * 0.6) collar = -median(ups) > 3.5 ? 'funnel' : 'mandarin';
  else if (below.every((d) => Math.abs(d) < 1.3)) collar = waves >= 4 ? 'ruffle' : 'none';
  else if (stroke.some((q) => Math.abs(q.x) < 5 && q.y > cfNeck.y + 7)) collar = 'bow';
  else {
    const i = stroke.indexOf(centre);
    const lowest = stroke.reduce((a, b) => (b.y > a.y ? b : a));
    const pointed = cornerAt(stroke, i) < 115 || cornerAt(stroke, stroke.indexOf(lowest)) < 115;
    collar = pointed ? 'shirt' : 'peter_pan';
  }
  let next: BodiceChoices = { ...c, collar };
  let also = '';
  if (collar === 'shirt' && c.closure !== 'front_buttons' && detailAllowed(c, 'closure', 'front_buttons', garment)) {
    next = { ...next, closure: 'front_buttons' };
    also = ' It buttons down the front.';
  }
  if (!detailAllowed(next, 'collar', collar, garment)) return { said: COLLAR_NEEDS[collar] ?? 'A collar goes on a crew neckline (a Peter Pan on a scoop too), with a plain back and no wrap.' };
  return { choices: validDetails(next, garment), said: COLLAR_WORDS[collar] + also };
}

/** A front line: buttons down the centre front, a wrap crossing to the side, or the zip at the centre back. */
export function readFront(stroke: P[], draft: BodiceDraft, c: BodiceChoices, garment: Garment = 'bodice', side: FormSide = 'front', allow: (closure: NonNullable<BodiceChoices['closure']>) => boolean = () => true): Reading<BodiceChoices> {
  const { neckPoint, apex, waistY } = landmarks(draft);
  const ys = stroke.map((q) => q.y);
  const xs = stroke.map((q) => q.x);
  const top = stroke.reduce((a, b) => (b.y < a.y ? b : a));
  const end = stroke.reduce((a, b) => (b.y > a.y ? b : a));
  const down = Math.max(...ys) - Math.min(...ys);
  if (down < 8) return { said: 'Draw down the front: straight down the centre for buttons, or crossing over to the side at the waist for a wrap.' };
  const set = (closure: NonNullable<BodiceChoices['closure']>, said: string): Reading<BodiceChoices> => {
    if (!detailAllowed(c, 'closure', closure, garment) || !allow(closure))
      return { said: closure === 'back_zip' ? 'This one opens at the back already.' : closure === 'wrap' ? 'A wrap front needs a neckline with shoulders, and no collar or princess seams.' : 'Buttons down the front need a neckline with shoulders, and a skirt that can carry them on.' };
    const { closure: _c, ...rest } = c;
    return { choices: validDetails(closure === 'back_zip' ? rest : { ...rest, closure }, garment), said };
  };
  const straight = xs.every((x) => Math.abs(x) < 2.5);
  if (side === 'back') return straight ? set('back_zip', 'A zip at the centre back.') : { said: 'On the back, draw straight down the centre for the zip.' };
  if (straight) return set('front_buttons', 'Buttoned down the centre front, the back cut on the fold.');
  if (top.y < apex.y && Math.abs(top.x) < neckPoint.x + 4 && Math.abs(end.y - waistY) < 8 && Math.abs(end.x) > 6 && Math.abs(end.x - top.x) > 8)
    return set('wrap', 'A wrap front: one side crosses over the other and ties at the waist.');
  return { said: 'Draw down the front: straight down the centre for buttons, or from the neck crossing to the side at the waist for a wrap.' };
}
