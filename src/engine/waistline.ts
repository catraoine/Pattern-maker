// A dress's waist seam raised above the natural waist: empire, babydoll, or anywhere between the waist
// and just under the bust. The waist-length bodice is cut across, R cm above its waist at the centre
// and R cm up the side seam, so the front and back side seams still match. A waist dart crossing the
// cut stays open in the seam, trued with a peak like the waist's own, so the seam is measured with the
// darts closed. The skirt is then drafted from the cut (see fromSeam in dress.ts).
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
import type { Piece } from './piece';
import type { BodiceDraft } from './bodice';

/** How far below the bust point the seam can go up to, at most: room for the bust to sit above it. */
const UNDER_BUST = 6;
/** Clearance kept between the cut and a side bust dart. */
const SIDE_DART_CLEAR = 1.5;


/** The side seam's points, from the underarm down to the waist. */
function sideRun(pc: Piece): P[] {
  const { pts, tags } = pc.outline.taggedPoints(12);
  const run: P[] = [];
  tags.forEach((t, i) => {
    if (t !== 'side') return;
    if (!run.length || len(sub(run[run.length - 1], pts[i])) > 1e-6) run.push(pts[i]);
    run.push(pts[i + 1]);
  });
  return run;
}

/** The point `d` cm back up a run of points from its end. */
function upFromEnd(run: P[], d: number): P {
  let left = d;
  for (let i = run.length - 1; i > 0; i--) {
    const l = len(sub(run[i], run[i - 1]));
    if (l >= left) return lerp(run[i], run[i - 1], left / (l || 1));
    left -= l;
  }
  return run[0];
}

/** How high above the waist the seam can go on this bodice: under the bust, and clear of a side dart. */
export function maxRaise(b: BodiceDraft): number {
  const front = b.pieces.find((pc) => /front/i.test(pc.name) && !pc.kind);
  if (!front) return 0;
  const bust = b.front.waistCentre.y - b.front.apex.y - UNDER_BUST;
  // A side bust dart: the cut stays below its lower leg, measured up the side seam.
  const run = sideRun(front);
  const { pts, tags } = front.outline.taggedPoints(12);
  const waistY = b.front.waistSide.y;
  const dartYs = pts.filter((_, i) => (tags[i] === 'dart' || tags[i - 1] === 'dart') && pts[i].y < waistY - 2).map((q) => q.y);
  let side = Infinity;
  if (dartYs.length && run.length > 1) {
    const lowest = Math.max(...dartYs);
    // Distance up the side seam from the waist to the dart's lower leg.
    let d = 0;
    for (let i = run.length - 1; i > 0 && run[i].y > lowest; i--) d += len(sub(run[i], run[i - 1]));
    side = d - SIDE_DART_CLEAR;
  }
  return Math.max(0, Math.round(Math.min(bust, side) * 10) / 10);
}

type Seg = Path['segs'][number];

/** Points along one segment of a path, its start first. */
function segPoints(from: P, sg: Seg, steps = 24): P[] {
  if (sg.kind === 'L') return [from, sg.to];
  const out = [from];
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const mt = 1 - t;
    out.push(
      p(
        mt ** 3 * from.x + 3 * mt ** 2 * t * sg.c1.x + 3 * mt * t ** 2 * sg.c2.x + t ** 3 * sg.to.x,
        mt ** 3 * from.y + 3 * mt ** 2 * t * sg.c1.y + 3 * mt * t ** 2 * sg.c2.y + t ** 3 * sg.to.y,
      ),
    );
  }
  return out;
}

/**
 * The cut across a piece: square off the centre line at A, curving to meet the side seam square at B,
 * and carried straight on past each end. Kept as the height of the cut at each x, since it runs across.
 */
function cutCurve(A: P, B: P, sideDown: P) {
  // Square to the side seam, pointing out of the piece.
  let n = p(-sideDown.y, sideDown.x);
  if (n.x < 0) n = mul(n, -1);
  const k = len(sub(B, A)) / 3;
  const c1 = add(A, p(k, 0));
  const c2 = sub(B, mul(n, k));
  const pts = segPoints(A, { kind: 'C', c1, c2, to: B }, 200);
  const y = (x: number): number => {
    if (x <= pts[0].x) return A.y;
    if (x >= B.x) return B.y + ((x - B.x) * n.y) / (n.x || 1);
    for (let i = 1; i < pts.length; i++) if (x <= pts[i].x) return pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * (x - pts[i - 1].x)) / (pts[i].x - pts[i - 1].x || 1);
    return B.y;
  };
  const inside = (q: P) => q.y < y(q.x) - 1e-9;
  /** Where the straight run q to r crosses the cut. */
  const hit = (q: P, r: P): P => {
    let lo = 0;
    let hi = 1;
    const qIn = inside(q);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inside(lerp(q, r, mid)) === qIn) lo = mid;
      else hi = mid;
    }
    const at = lerp(q, r, (lo + hi) / 2);
    return p(at.x, y(at.x));
  };
  return { y, inside, hit };
}

/**
 * One waist-length bodice piece cut R cm above the waist. Its waist dart, if the cut crosses one, stays
 * open in the new seam with a trued peak, so the seam's 'waist' length is its length with darts closed.
 */
function cutPiece(pc: Piece, centreWaist: P, R: number): { piece: Piece; centre: P; side: P } | undefined {
  const run = sideRun(pc);
  if (run.length < 2) return undefined;
  const A = p(centreWaist.x, centreWaist.y - R);
  const B = upFromEnd(run, R);
  const cut = cutCurve(A, B, unit(sub(upFromEnd(run, Math.max(0, R - 0.5)), upFromEnd(run, R + 0.5))));
  const { inside, hit, y } = cut;
  if (!inside(pc.outline.start)) return undefined;

  // Darts crossing the cut: a leg each side of a tip above it.
  const darts: { near: P; far: P; tip: P }[] = [];
  const lines: Path[] = [];
  for (const l of pc.lines) {
    const pts = l.points();
    if (pts.length === 3 && inside(pts[1]) && !inside(pts[0]) && !inside(pts[2])) {
      const tip = pts[1];
      const x0 = hit(tip, pts[0]);
      const x2 = hit(tip, pts[2]);
      const [near, far] = Math.abs(x0.x) < Math.abs(x2.x) ? [x0, x2] : [x2, x0];
      if (len(sub(near, far)) > 0.3) darts.push({ near, far, tip });
      continue;
    }
    // Other lines: the parts above the cut.
    let cur: P[] = [];
    const flush = () => {
      if (cur.length > 1) {
        const path = new Path(cur[0]);
        for (const q of cur.slice(1)) path.line(q);
        lines.push(path);
      }
      cur = [];
    };
    pts.forEach((q, i) => {
      if (inside(q)) {
        if (!cur.length && i > 0) cur.push(hit(q, pts[i - 1]));
        cur.push(q);
      } else if (cur.length) {
        cur.push(hit(pts[i - 1], q));
        flush();
      }
    });
    flush();
  }

  /** The cut from one end to the other, with each dart's peak in it, trued and pressed to the centre. */
  const seam = (out: Path, from: P, to: P) => {
    // Finely, so the seam leaves the side seam and the centre square, as the curve does.
    const n = 160;
    const xs = Array.from({ length: n + 1 }, (_, i) => from.x + ((to.x - from.x) * i) / n);
    const forward = to.x > from.x;
    const order = [...darts].sort((d1, d2) => (forward ? d1.near.x - d2.near.x : d2.near.x - d1.near.x));
    let k = 0;
    for (const x of xs.slice(1, -1)) {
      const d = order[k];
      const first = d && (forward ? d.near : d.far);
      if (d && (forward ? x >= first.x : x <= first.x)) {
        const toward = unit(sub(p(d.near.x - 0.5, y(d.near.x - 0.5)), d.near));
        const tr = finishDart(d.tip, d.near, d.far, toward);
        const [p1, p2] = forward ? [tr.near, tr.far] : [tr.far, tr.near];
        out.line(p1, 'waist').line(tr.peak, 'dart').line(p2, 'dart');
        lines.push(new Path(tr.near).line(tr.tip).line(tr.far));
        k++;
        continue;
      }
      // Skip the stretch inside an open dart.
      const inDart = order.slice(0, k).some((o) => x > Math.min(o.near.x, o.far.x) - 1e-6 && x < Math.max(o.near.x, o.far.x) + 1e-6);
      if (!inDart) out.line(p(x, y(x)), 'waist');
    }
    out.line(to, 'waist');
  };

  // Walk the outline: whole segments above the cut are kept as drawn, curves and all.
  const outline = new Path(pc.outline.start);
  let from = pc.outline.start;
  let leave: P | undefined;
  pc.outline.segs.forEach((sg, i) => {
    const tag = pc.outline.tags[i];
    const pts = segPoints(from, sg);
    const ins = pts.map(inside);
    if (ins.every(Boolean)) {
      if (sg.kind === 'L') outline.line(sg.to, tag);
      else outline.curve(sg.c1, sg.c2, sg.to, tag);
    } else if (ins.some(Boolean)) {
      for (let j = 1; j < pts.length; j++) {
        if (ins[j - 1] && ins[j]) outline.line(pts[j], tag);
        else if (ins[j - 1] && !ins[j]) {
          leave = hit(pts[j - 1], pts[j]);
          outline.line(leave, tag);
        } else if (!ins[j - 1] && ins[j] && leave) {
          const enter = hit(pts[j], pts[j - 1]);
          seam(outline, leave, enter);
          leave = undefined;
          outline.line(pts[j], tag);
        }
      }
    }
    from = sg.to;
  });
  outline.closed = true;
  if (!darts.every((d) => lines.some((l) => len(sub(l.points()[1], d.tip)) < 1e-9))) return undefined;

  const keepPt = (q: P) => inside(q);
  const clip2 = (pair?: [P, P]): [P, P] | undefined => {
    if (!pair) return undefined;
    const [a, b] = pair;
    if (keepPt(a) && keepPt(b)) return pair;
    if (!keepPt(a) && !keepPt(b)) return undefined;
    const [i, o] = keepPt(a) ? [a, b] : [b, a];
    const x = hit(i, o);
    const short = sub(x, mul(unit(sub(o, i)), 2));
    return keepPt(a) ? [a, short] : [short, b];
  };
  const piece: Piece = {
    ...pc,
    outline,
    lines,
    grain: clip2(pc.grain),
    fold: clip2(pc.fold),
    notches: pc.notches.filter(([q]) => keepPt(q)),
    labels: pc.labels.filter((l) => keepPt(l.at)),
    balance: pc.balance?.filter((bl) => bl.pts.every(keepPt)),
    draft: pc.draft && { ...pc.draft, points: pc.draft.points.filter((pt) => keepPt(pt.at)) },
    alternate: undefined,
  };
  return { piece, centre: A, side: B };
}

/**
 * The waist-length bodice cut R cm above its waist, for a raised (empire) waist seam. The draft keeps its
 * landmarks; its hem moves up to the cut, so the drawings end the bodice there.
 */
export function raiseBodice(b: BodiceDraft, R: number): BodiceDraft {
  if (!(R > 0)) return b;
  let front: { centre: P; side: P } | undefined;
  let back: { centre: P; side: P } | undefined;
  const cut = (pcs: Piece[] | undefined) =>
    pcs?.map((pc) => {
      if (pc.kind || !/^Bodice/.test(pc.name)) return pc;
      const isBack = /back/i.test(pc.name);
      const land = isBack ? b.back : b.front;
      const r = cutPiece(pc, land.waistCentre, R);
      if (!r) return pc;
      if (isBack) back = r;
      else front = r;
      return r.piece;
    });
  const pieces = cut(b.pieces)!;
  const block = b.block ? cut(b.block) : undefined;
  const f = front;
  const k = back;
  // The bodice's own edge is now the seam: its girth with the darts closed, for the seam checks.
  const seamGirth = 2 * pieces.filter((pc) => !pc.kind && /^Bodice/.test(pc.name)).reduce((t, pc) => t + taggedLength(pc.outline, 'waist'), 0);
  return {
    ...b,
    finishedWaist: Math.round(seamGirth * 10) / 10,
    pieces,
    ...(block ? { block } : {}),
    front: f ? { ...b.front, hemCentre: f.centre, hemSide: f.side } : b.front,
    back: k ? { ...b.back, hemCentre: k.centre, hemSide: k.side } : b.back,
    backLength: Math.round((b.backLength - R) * 10) / 10,
  };
}
