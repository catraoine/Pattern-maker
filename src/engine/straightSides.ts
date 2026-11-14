import { P, Path, add, p, sub } from './geometry';
import type { Piece } from './piece';

/**
 * The SS27 vest's side seams as single straight lines, underarm to hem (Cat, Nov 13: "One line"), and its hem level
 * from the side to the centre. The drafted side bows out under the arm for the bust and bends at the waist; here each
 * side seam is redrawn as one straight line between its own ends. The front's hem rose toward the side and stopped
 * short of the back's, and letting its corner down alone left a small jog there (CLO, Nov 13: "front hem slopes up
 * toward the side"), so both hems are drawn level at the lower of the two. Level, the front's straight side is the
 * longer (it slants more), so the back's hem is let down by the difference, still level, and the two sew end to end.
 */
export function straightSidePair(front: Piece, back: Piece): [Piece, Piece] {
  const rf = sideRun(front);
  const rb = sideRun(back);
  if (rf.first < 0 || rb.first < 0) return [front, back];
  const low = Math.max(...hemPoints(front, rf).map((q) => q.y), ...hemPoints(back, rb).map((q) => q.y));
  const length = (r: Run, y: number) => Math.hypot(r.to.x - r.from.x, y - r.from.y);
  // The hem height that gives a side this length, straight below its corner.
  const at = (r: Run, want: number) => r.from.y + Math.sqrt(Math.max(0, want * want - (r.to.x - r.from.x) ** 2));
  const lf = length(rf, low);
  const lb = length(rb, low);
  return [redraw(front, rf, lf < lb ? at(rf, lb) : low), redraw(back, rb, lb < lf ? at(rb, lf) : low)];
}

interface Run {
  first: number;
  last: number;
  from: P;
  to: P;
}

function sideRun(pc: Piece): Run {
  const o = pc.outline;
  const first = o.tags.indexOf('side');
  let last = first;
  while (last + 1 < o.tags.length && o.tags[last + 1] === 'side') last++;
  return { first, last, from: first <= 0 ? o.start : o.segs[first - 1].to, to: first < 0 ? o.start : o.segs[last].to };
}

/** The hem's segments: the ones after the side seam, while they are still hem. */
const isHem = (pc: Piece, r: Run, i: number) => i > r.last && /hem/.test(pc.outline.tags[i]) && pc.outline.tags.slice(r.last + 1, i).every((t) => /hem/.test(t));

function hemPoints(pc: Piece, r: Run): P[] {
  return pc.outline.segs.flatMap((s, i) => (isHem(pc, r, i) ? (s.kind === 'L' ? [s.to] : [s.c1, s.c2, s.to]) : []));
}

function redraw(pc: Piece, r: Run, y: number): Piece {
  const o = pc.outline;
  const to = p(r.to.x, y);
  const out = new Path(o.start);
  const level = (q: P) => p(q.x, y);
  o.segs.forEach((s, i) => {
    if (i === r.first) out.line(to, 'side');
    else if (i > r.first && i <= r.last) return;
    else if (isHem(pc, r, i)) {
      if (s.kind === 'L') out.line(level(s.to), o.tags[i]);
      else out.curve(level(s.c1), level(s.c2), level(s.to), o.tags[i]);
    } else if (s.kind === 'L') out.line(s.to, o.tags[i]);
    else out.curve(s.c1, s.c2, s.to, o.tags[i]);
  });
  out.closed = o.closed;
  // Notches on the side seam keep their distance down it.
  const onSide = (q: P) => {
    const d = sub(to, r.from);
    const t = ((q.x - r.from.x) * d.x + (q.y - r.from.y) * d.y) / (d.x * d.x + d.y * d.y);
    return t;
  };
  const notches = pc.notches.map(([q, n]): [P, P] => {
    const nearSide = Math.abs(q.x - (r.from.x + (r.to.x - r.from.x) * ((q.y - r.from.y) / Math.max(1e-6, r.to.y - r.from.y)))) < 1.5 && q.y > r.from.y - 0.5 && q.y < r.to.y + 0.5;
    if (!nearSide) return [q, n];
    const t = Math.min(1, Math.max(0, onSide(q)));
    return [add(r.from, p((to.x - r.from.x) * t, (to.y - r.from.y) * t)), n];
  });
  return { ...pc, outline: out, notches };
}
