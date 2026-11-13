import { P, Path, add, len, p, sub } from './geometry';
import type { Piece } from './piece';

/**
 * The SS27 vest's side seams as single straight lines, underarm to hem (Cat, Nov 13: "One line"). The drafted side bows
 * out under the arm for the bust and bends at the waist; here each side seam is redrawn as one straight line between
 * its own ends. Straight, the front's seam comes out shorter than the back's (its bust swing is gone), so the shorter
 * piece's hem corner is let down until the two match: the front hem, which rose to the side, then lies nearer level.
 */
export function straightSidePair(front: Piece, back: Piece): [Piece, Piece] {
  const run = (pc: Piece) => {
    const o = pc.outline;
    const first = o.tags.indexOf('side');
    let last = first;
    while (last + 1 < o.tags.length && o.tags[last + 1] === 'side') last++;
    const startOf = (i: number) => (i === 0 ? o.start : o.segs[i - 1].to);
    return { first, last, from: startOf(first), to: o.segs[last].to };
  };
  const rf = run(front);
  const rb = run(back);
  if (rf.first < 0 || rb.first < 0) return [front, back];
  const lf = len(sub(rf.to, rf.from));
  const lb = len(sub(rb.to, rb.from));
  // Let the shorter piece's corner down, straight below, to the longer's length.
  const down = (r: typeof rf, want: number) => {
    const dx = r.to.x - r.from.x;
    return Math.sqrt(Math.max(0, want * want - dx * dx)) - (r.to.y - r.from.y);
  };
  const dyF = lf < lb ? down(rf, lb) : 0;
  const dyB = lb < lf ? down(rb, lf) : 0;
  return [redraw(front, rf, dyF), redraw(back, rb, dyB)];
}

function redraw(pc: Piece, r: { first: number; last: number; from: P; to: P }, dy: number): Piece {
  const o = pc.outline;
  const to = add(r.to, p(0, dy));
  const out = new Path(o.start);
  // The hem squares off for up to 4 cm from the corner. Letting only the corner down would leave a hook there,
  // so the hem near the corner goes down with it in full and the drop eases out further along.
  const ease = (q: P) => {
    const d = len(sub(q, r.to));
    const t = Math.min(1, Math.max(0, (d - 4) / 5));
    return add(q, p(0, dy * (1 - t * t * (3 - 2 * t))));
  };
  o.segs.forEach((s, i) => {
    if (i === r.first) out.line(to, 'side');
    else if (i > r.first && i <= r.last) return;
    else if (i > r.last && dy !== 0) {
      if (s.kind === 'L') out.line(ease(s.to), o.tags[i]);
      else out.curve(ease(s.c1), ease(s.c2), ease(s.to), o.tags[i]);
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
