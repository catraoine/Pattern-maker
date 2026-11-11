// A seam straight across a jacket or waistcoat's chest, front and back (In testing): Cat's SS27 vest picture has one
// across the chest just below the lapels' break, the first buttonhole just under it (2026-11-07). The front and the back
// are each cut in two along it, an upper part and the body below, which sew back up to the same shape; front and back
// meet it at the same place on the side seam (or up the armhole, if it runs above the underarm). Everything is in the
// pieces' own coordinates: cm, y running down.
import { P, Path, p } from './geometry';
import { Ring, pathOf, ringOf } from './manipulate';
import { insidePolygon } from './marks';
import { Piece } from './piece';

/** How far below the centre front neck the seam can run, in cm. */
export const CHEST_SEAM_RANGE = { min: 8, max: 40 };

/** How far clear of the underarm the seam runs, in cm. */
const UNDERARM_CLEAR = 1;

/** Where the side seam starts (the underarm): the highest point on it. */
function underarm(pc: Piece): number | undefined {
  const r = ringOf(pc.outline, 8);
  let y = Infinity;
  r.tags.forEach((t, i) => {
    if (t === 'side') y = Math.min(y, r.pts[i].y);
  });
  return Number.isFinite(y) ? y : undefined;
}

/** A closed outline cut across at height `Y`: the part above and the part below, the cut edge tagged 'yoke'. Only an
 *  outline the line crosses exactly twice is cut. */
function cutRing(r: Ring, Y: number): { up: Ring; down: Ring } | undefined {
  const n = r.pts.length;
  const cross: { i: number; q: P }[] = [];
  for (let i = 0; i < n; i++) {
    const a = r.pts[i];
    const b = r.pts[(i + 1) % n];
    if ((a.y - Y) * (b.y - Y) < 0 || (a.y === Y && b.y !== Y)) {
      const t = (Y - a.y) / (b.y - a.y);
      cross.push({ i, q: p(a.x + (b.x - a.x) * t, Y) });
    }
  }
  if (cross.length !== 2) return undefined;
  const part = (from: { i: number; q: P }, to: { i: number; q: P }): Ring => {
    // From one crossing round the outline to the other, then back along the cut.
    const pts: P[] = [from.q];
    const tags: string[] = [r.tags[from.i]];
    for (let k = (from.i + 1) % n; ; k = (k + 1) % n) {
      pts.push(r.pts[k]);
      tags.push(r.tags[k]);
      if (k === to.i) break;
    }
    pts.push(to.q);
    tags.push('yoke');
    return { pts, tags };
  };
  const a = part(cross[0], cross[1]);
  const b = part(cross[1], cross[0]);
  const above = (x: Ring) => x.pts.reduce((s, q) => s + q.y, 0) / x.pts.length < Y;
  return above(a) ? { up: a, down: b } : { up: b, down: a };
}

/** A line kept to the part of it on one side of `Y`, or dropped if none of it is. */
function clipLine(l: Path, Y: number, up: boolean): Path | undefined {
  const pts = l.points(8);
  const keep = (q: P) => (up ? q.y <= Y : q.y >= Y);
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (keep(q)) out.push(q);
    const nx = pts[i + 1];
    if (nx && keep(q) !== keep(nx) && nx.y !== q.y) {
      const t = (Y - q.y) / (nx.y - q.y);
      out.push(p(q.x + (nx.x - q.x) * t, Y));
    }
  }
  if (out.length < 2) return undefined;
  // (A line that was all on one side stays as drawn, curves and all.)
  if (pts.every(keep)) return l;
  const path = new Path(out[0]);
  for (const q of out.slice(1)) path.line(q);
  return path;
}

/** One piece cut in two at `Y`. */
function cutPiece(pc: Piece, Y: number, upName: string): { up: Piece; down: Piece } | undefined {
  const parts = cutRing(ringOf(pc.outline), Y);
  if (!parts) return undefined;
  const make = (ring: Ring, up: boolean, name: string): Piece => {
    const ys = ring.pts.map((q) => q.y);
    const xs = ring.pts.map((q) => q.x);
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const inside = (q: P) => insidePolygon(q, ring.pts);
    const gx = pc.grain ? (pc.grain[0].x + pc.grain[1].x) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2;
    // (Its place-on-fold edge, if any, kept to its own part.)
    const fy = pc.fold ? [Math.min(pc.fold[0].y, pc.fold[1].y), Math.max(pc.fold[0].y, pc.fold[1].y)] : undefined;
    const fold = pc.fold && fy && (up ? fy[0] < Y - 1 : fy[1] > Y + 1) ? ([p(pc.fold[0].x, up ? fy[0] : Y + 0.6), p(pc.fold[0].x, up ? Y - 0.6 : fy[1])] as [P, P]) : undefined;
    // (The piece's name and how many to cut written afresh on each part; its other words stay where they were.)
    const own = (t: string) => t === pc.name.toUpperCase() || /^Cut /.test(t);
    const labels = pc.labels.filter((l) => inside(l.at) && !own(l.text));
    const cut = pc.labels.find((l) => /^Cut /.test(l.text))?.text ?? pc.cut;
    const mid = p(gx, y0 + (y1 - y0) * (up ? 0.55 : 0.3));
    return {
      ...pc,
      name,
      outline: pathOf(ring),
      lines: pc.lines.map((l) => clipLine(l, Y, up)).filter((l): l is Path => !!l),
      grain: [p(gx, y0 + (y1 - y0) * 0.25), p(gx, y1 - (y1 - y0) * 0.25)],
      ...(fold ? { fold } : { fold: undefined }),
      notches: [...pc.notches.filter(([q]) => (up ? q.y < Y : q.y > Y)), [p(gx, Y), p(0, up ? 1 : -1)]],
      balance: (pc.balance ?? []).filter((b) => b.pts.every((q) => (up ? q.y < Y : q.y > Y))),
      labels: [{ at: mid, text: name.toUpperCase(), size: 0.8 }, { at: p(mid.x, mid.y + 1.6), text: cut, size: 0.6 }, ...labels],
      allowances: { ...pc.allowances, yoke: 1 },
      meta: { ...pc.meta, chestPart: up ? 'upper' : 'lower' },
      ...(up ? {} : { draft: undefined }),
      ...(up ? { finished: undefined } : {}),
    };
  };
  // (The body below keeps the piece's own name; the part above is its yoke.)
  return { up: make(parts.up, true, upName), down: make(parts.down, false, pc.name) };
}

/** The front and back cut across at the chest seam, `yFront` on the front; the back at the same place on its side
 *  seam. Undefined when either can't be cut cleanly (the line misses, or crosses the outline more than twice). */
export function chestSeam(front: Piece, back: Piece, yFront: number): { pieces: Piece[]; front: number; back: number } | undefined {
  const uf = underarm(front);
  const ub = underarm(back);
  if (uf === undefined || ub === undefined) return undefined;
  // (A seam within a centimetre of the underarm is moved up to a centimetre above it, into the armhole: right on it, the
  // yoke kept a sliver of side seam a millimetre long, too short to sew, on the Look 02 vest for small busts, Nov 11.)
  if (Math.abs(yFront - uf) < UNDERARM_CLEAR) yFront = uf - UNDERARM_CLEAR;
  const yBack = ub + (yFront - uf);
  const f = cutPiece(front, yFront, `${front.name} yoke`);
  const b = cutPiece(back, yBack, `${back.name} yoke`);
  if (!f || !b) return undefined;
  return { pieces: [f.up, f.down, b.up, b.down], front: yFront, back: yBack };
}
