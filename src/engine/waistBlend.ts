// A top whose princess and side seams run on a few centimetres below the waist (the Ice Peplum, its peplum seam 6 cm
// down) is drafted with each seam in to the waist in one line and out to the hem in another, so it met itself at the
// waist in a corner: up to 16 degrees on the princess seams, and up to 11 on the side back's side seam, whose front had
// been faired round it on Nov 18 and the back missed. On paper it read as a jog near the bottom of the seams (a fit
// tester, Nov 21). A pattern cutter blends that corner: the seam now leaves its two lines BLEND cm either side of the
// waist and curves through the waist point itself, so the waist stays where it was and both pieces of a seam are
// blended alike.
import { P, Path, add, len, lerp, mul, sub, unit } from './geometry';
import type { Piece } from './piece';

/** How far either side of the waist the blend starts, in cm. */
const BLEND = 3;
/** A turn gentler than this, in degrees, is left as it is. */
const MIN_TURN = 2;
/** Where the waist sits above the seam's lower end, in cm: the peplum seam is 6 cm below it. */
const WAIST_ABOVE = [3, 10];

/** The piece with the waist corner blended on each of these seams that has one. */
export function blendWaist(pc: Piece, seams: string[]): Piece {
  let outline = pc.outline;
  for (const tag of seams) outline = blendRun(outline, tag) ?? outline;
  return outline === pc.outline ? pc : { ...pc, outline };
}

function blendRun(path: Path, tag: string): Path | undefined {
  const segs = path.segs;
  const at = segs.map((_, i) => i).filter((i) => path.tags[i] === tag);
  if (at.length < 2 || at[at.length - 1] - at[0] !== at.length - 1) return undefined;
  if (at.some((i) => segs[i].kind !== 'L')) return undefined;
  // The run as points: vs[k] is where seg at[0] + k starts.
  const from = at[0] === 0 ? path.start : segs[at[0] - 1].to;
  const vs: P[] = [from, ...at.map((i) => segs[i].to)];
  const along: number[] = [0];
  for (let k = 1; k < vs.length; k++) along.push(along[k - 1] + len(sub(vs[k], vs[k - 1])));
  const total = along[along.length - 1];
  const pointAt = (d: number): P => {
    let k = 1;
    while (k < vs.length - 1 && along[k] < d) k++;
    const l = along[k] - along[k - 1];
    return l < 1e-9 ? vs[k] : lerp(vs[k - 1], vs[k], (d - along[k - 1]) / l);
  };
  const bottom = Math.max(vs[0].y, vs[vs.length - 1].y);
  // The waist: the sharpest turn (read over a centimetre each way) in the stretch just above the seam's lower end.
  let best = 0;
  let k0 = -1;
  for (let k = 1; k < vs.length - 1; k++) {
    const up = bottom - vs[k].y;
    if (up < WAIST_ABOVE[0] || up > WAIST_ABOVE[1] || along[k] < 1 || total - along[k] < 1) continue;
    const u = unit(sub(vs[k], pointAt(along[k] - 1)));
    const v = unit(sub(pointAt(along[k] + 1), vs[k]));
    const turn = (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) * 180) / Math.PI;
    if (turn > best) {
      best = turn;
      k0 = k;
    }
  }
  if (k0 < 0 || best < MIN_TURN) return undefined;
  const c = vs[k0];
  const ra = Math.min(BLEND, along[k0] * 0.45);
  const rb = Math.min(BLEND, (total - along[k0]) * 0.45);
  const s = pointAt(along[k0] - ra);
  const e = pointAt(along[k0] + rb);
  // The seam's own direction where the blend leaves it and where it joins it again (read over the half centimetre
  // outside, as the seam below the waist may already curve).
  const ua = unit(sub(s, pointAt(Math.max(0, along[k0] - ra - 0.5))));
  const ub = unit(sub(pointAt(Math.min(total, along[k0] + rb + 0.5)), e));
  // Two curves meeting at the waist point, along the line from the blend's start to its end: they leave and join the
  // seam smoothly, and the waist (and a notch on it) stays on the seam.
  const m = unit(sub(e, s));
  const la = len(sub(c, s)) / 3;
  const lb = len(sub(e, c)) / 3;
  const first = [add(s, mul(ua, la)), sub(c, mul(m, la)), c];
  const second = [add(c, mul(m, lb)), sub(e, mul(ub, lb)), e];
  const out = new Path(path.start);
  out.closed = path.closed;
  segs.forEach((sg, i) => {
    const k = i - at[0];
    if (k < 0 || k >= vs.length - 1) {
      if (sg.kind === 'L') out.line(sg.to, path.tags[i]);
      else out.curve(sg.c1, sg.c2, sg.to, path.tags[i]);
      return;
    }
    // Inside the run: the lines up to the blend's start, the blend, then the lines on from its end.
    if (along[k + 1] < along[k0] - ra) out.line(sg.to, tag);
    else if (along[k] < along[k0] - ra) {
      out.line(s, tag).curve(first[0], first[1], first[2], tag).curve(second[0], second[1], second[2], tag);
      if (along[k + 1] > along[k0] + rb) out.line(sg.to, tag);
    } else if (along[k + 1] > along[k0] + rb) out.line(sg.to, tag);
  });
  return out;
}
