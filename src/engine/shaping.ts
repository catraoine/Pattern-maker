// The bodice's shaping as styled: the bust dart moved from the side seam, or princess seams from the
// shoulder or the armhole. Works on the drafted block's pieces (see manipulate.ts).
import { P, Path, add, len, lerp, mul, p, sub, unit } from './geometry';
import { insidePolygon } from './marks';
import { DartPlace, PrincessLine, Ring, clampAt, marksAlong, moveBustDart, pathOf, polyLen, ringOf, trueSeams } from './manipulate';
import { DraftPoint, Piece } from './piece';

const WORDS: Record<DartPlace, string> = {
  side: 'side seam',
  french: 'lower side seam',
  shoulder: 'shoulder',
  neck: 'neckline',
  armhole: 'armhole',
  waist: 'waist',
};

const threePoint = (ln: Path) => ln.points();
/** The side bust dart's line: a dart whose opening runs down the piece. */
const isSideDart = (ln: Path) => {
  const q = threePoint(ln);
  return q.length === 3 && Math.abs(q[2].y - q[0].y) > Math.abs(q[2].x - q[0].x);
};
const isWaistDart = (ln: Path) => {
  const q = threePoint(ln);
  return q.length === 3 && Math.abs(q[2].x - q[0].x) >= Math.abs(q[2].y - q[0].y);
};
const fishEyeOf = (pc: Piece) => pc.lines.map((l) => l.points()).find((q) => q.length === 5 && len(sub(q[0], q[4])) < 1e-6);

const moveNotch = (move: (q: P) => P) => ([q, d]: [P, P]): [P, P] => {
  const a = move(q);
  return [a, sub(move(add(q, d)), a)];
};

/** The front with its bust dart moved from the side seam to `to`. */
export function moveFrontDart(front: Piece, apex: P, to: DartPlace, waistSide?: P, at?: number): Piece {
  const m = moveBustDart(front.outline, apex, to, { armholeNotch: front.notches[0]?.[0], waistSide, at });
  if (!m || !m.dart) return front;
  const merged = to === 'waist' && !!front.lines.find(isWaistDart);
  const lines = front.lines.filter((ln) => !isSideDart(ln) && !(merged && isWaistDart(ln)));
  lines.unshift(new Path(m.dart.near).line(m.dart.tip).line(m.dart.far));
  const upward = to === 'shoulder' || to === 'neck' || to === 'armhole';
  const width = len(sub(m.dart.far, m.dart.near));
  const points: DraftPoint[] = (front.draft?.points ?? [])
    .filter((pt) => pt.n !== 'B' && !(merged && pt.n === 'D'))
    .map((pt) => ({ ...pt, at: m.move(pt.at) }));
  points.push({
    n: 'M',
    at: m.dart.tip,
    note: `Bust dart moved to the ${WORDS[to]}: slash from the ${WORDS[to]} to the bust point, close the side dart, and the new dart opens ${width.toFixed(1)} cm.${merged ? ' It joins the waist dart into one.' : ''} It ends ${len(sub(m.dart.tip, apex)).toFixed(1)} cm short of the bust point.`,
  });
  const alternate = front.alternate && !upward ? moveBustDart(front.alternate.outline, apex, to, { waistSide }) : undefined;
  return {
    ...front,
    outline: pathOf(m.ring),
    lines,
    notches: front.notches.map(moveNotch(m.move)),
    grain: front.grain ? [p(apex.x * 0.5, front.grain[0].y), p(apex.x * 0.5, front.grain[1].y)] : undefined,
    balance: upward ? undefined : front.balance,
    // Clear of a dart from the shoulder or neck, which runs through where the name sits on the block.
    labels: upward ? front.labels.map((l) => ({ ...l, at: add(l.at, p(0, 8)) })) : front.labels,
    alternate: front.alternate ? (alternate ? { ...front.alternate, outline: pathOf(alternate.ring) } : front.alternate) : undefined,
    draft: front.draft ? { frame: front.draft.frame, points } : undefined,
    // The dart on the garment as sewn (the block's coordinates), for the flat drawing; none when it
    // joins the waist dart, which is drawn already.
    meta: { ...front.meta, bustDart: to, sewnDart: merged ? undefined : [m.closedAt, add(apex, mul(unit(sub(m.closedAt, apex)), len(sub(m.dart.tip, apex))))] },
  };
}

/** Index of the point of the ring nearest q. */
const nearestIndex = (r: Ring, q: P) => r.pts.reduce((best, x, i) => (len(sub(x, q)) < len(sub(r.pts[best], q)) ? i : best), 0);

function runOf(r: Ring, tag: string): [number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++) {
    if (r.tags[i] !== tag || r.tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (r.tags[(j + 1) % n] === tag && j - i < n) j++;
    return [i, j];
  }
  return undefined;
}
function insertAt(r: Ring, i: number, t: number): number {
  const q0 = r.pts[i];
  const q1 = r.pts[(i + 1) % r.pts.length];
  if (t < 1e-3) return i;
  if (t > 1 - 1e-3) return i + 1;
  r.pts.splice(i + 1, 0, lerp(q0, q1, t));
  r.tags.splice(i + 1, 0, r.tags[i]);
  return i + 1;
}
/** A point s cm along the run [a, b]. */
function insertAlong(r: Ring, [a, b]: [number, number], s: number): number {
  let acc = 0;
  for (let i = a; i <= b; i++) {
    const l = len(sub(r.pts[(i + 1) % r.pts.length], r.pts[i]));
    if (acc + l >= s || i === b) return insertAt(r, i, l ? Math.min(1, (s - acc) / l) : 0);
    acc += l;
  }
  return b;
}
const runLen = (r: Ring, [a, b]: [number, number]) => {
  let s = 0;
  for (let i = a; i <= b; i++) s += len(sub(r.pts[(i + 1) % r.pts.length], r.pts[i]));
  return s;
};
function insertAtX(r: Ring, tag: string, x0: number): number | undefined {
  const run = runOf(r, tag);
  if (!run) return undefined;
  for (let i = run[0]; i <= run[1]; i++) {
    const q0 = r.pts[i];
    const q1 = r.pts[(i + 1) % r.pts.length];
    if ((q0.x - x0) * (q1.x - x0) > 0 || q0.x === q1.x) continue;
    return insertAt(r, i, (x0 - q0.x) / (q1.x - q0.x));
  }
  return undefined;
}
function dartAfter(r: Ring, after: string): [number, number, number] | undefined {
  const n = r.tags.length;
  for (let i = 0; i < n; i++)
    if (r.tags[i] === 'dart' && r.tags[(i - 1 + n) % n] === after && r.tags[(i + 1) % n] === 'dart') return [i, i + 1, i + 2];
  return undefined;
}

export interface Split {
  ring: Ring;
  /** Where the line leaves the top edge: one point, or the two ends of a closed dart (front). */
  i1: number;
  i2: number;
  /** The pivot the seams pass through (bust point, or the back dart's point). */
  pivot: P;
  move: (q: P) => P;
  /** The top of the line on the block as drafted (before the bust dart was moved into it). */
  top: P;
}

/** Cut a piece along a princess line into its centre and side panels. */
export function panels(pc: Piece, s: Split, names: [string, string], cuts: [string, string], meta: Record<string, unknown>): { centre: Piece; side: Piece; line: P[] } {
  const r = s.ring;
  let iNear: number;
  let iFar: number;
  let lowC: P[];
  let lowS: P[];
  const extra: number[] = [];
  const wd = dartAfter(r, 'waist');
  const eye = fishEyeOf(pc);
  if (wd && wd[0] > s.i2) {
    [iFar, , iNear] = wd;
    lowC = [r.pts[iNear]];
    lowS = [r.pts[iFar]];
  } else if (eye) {
    // A dart carried below the waist: the seams follow its two sides, then run on together to the hem.
    const [, left, bottom, right] = eye.map(s.move);
    const at = insertAtX(r, 'hem', bottom.x)!;
    iNear = iFar = at;
    lowC = [left, bottom, r.pts[at]];
    lowS = [right, bottom, r.pts[at]];
    extra.push(2, 3);
  } else {
    const at = insertAtX(r, 'waist', s.pivot.x) ?? insertAtX(r, 'hem', s.pivot.x)!;
    iNear = iFar = at;
    lowC = [r.pts[at]];
    lowS = [r.pts[at]];
  }
  const seams = trueSeams([r.pts[s.i1], s.pivot, ...lowC], [r.pts[s.i2], s.pivot, ...lowS], 1, extra);
  const cs = seams.centre;
  const ss = seams.side;

  const cPts = [...r.pts.slice(0, s.i1 + 1), ...cs.slice(1, -1), ...r.pts.slice(iNear)];
  const cTags = [...r.tags.slice(0, s.i1), ...cs.slice(1).map(() => 'princess'), ...r.tags.slice(iNear)];
  const rs = [...ss].reverse();
  const sPts = [...r.pts.slice(s.i2, iFar + 1), ...rs.slice(1, -1)];
  const sTags = [...r.tags.slice(s.i2, iFar), ...rs.slice(1).map(() => 'princess')];

  // Notches above and below the bust (or blade), at the same distance down both seams.
  const L = polyLen(cs);
  const top = len(sub(cs[0], s.pivot));
  const at = [top * 0.5, top + (L - top) * 0.45];
  const outward = (pts: P[]) => ([q, d]: [P, P]): [P, P] => (insidePolygon(add(q, mul(d, 0.3)), pts) ? [q, mul(d, -1)] : [q, d]);
  const cNotches = marksAlong(cs, at).map(outward(cPts));
  const sNotches = marksAlong(ss, at).map(outward(sPts));
  const own = (pts: P[]) => (q: P) => pts.some((x) => len(sub(x, q)) < 0.8) || insidePolygon(q, pts);
  const old = pc.notches.map(moveNotch(s.move));
  const cOwn = own(cPts);
  const ys = (pts: P[]) => pts.map((q) => q.y);
  const lowY = Math.max(...ys(cPts));
  const midC = p(Math.max(1.5, s.pivot.x * 0.42), (s.pivot.y + lowY) / 2);
  const sideX = Math.max(...sPts.map((q) => q.x));
  const lowS2 = lowS[lowS.length - 1];
  const midS = p((lowS[0].x + sideX) / 2, (s.pivot.y + lowS2.y) / 2);
  const points = (keep: (q: P) => boolean) => (pc.draft?.points ?? []).map((pt) => ({ ...pt, at: s.move(pt.at) })).filter((pt) => keep(pt.at));
  const label = (at2: P, name: string, cut: string) => [
    { at: at2, text: name.replace(/^Bodice /, '').toUpperCase(), size: 1.0, rotate: 90 },
    { at: add(at2, p(-1.4, 0)), text: cut, size: 0.7, rotate: 90 },
  ];
  const grainY = pc.grain ? [pc.grain[0].y, pc.grain[1].y] : [s.pivot.y, lowY - 4];
  const centre: Piece = {
    ...pc,
    name: names[0],
    outline: pathOf({ pts: cPts, tags: cTags }),
    lines: [],
    notches: [...old.filter(([q]) => cOwn(q) && !own(sPts)(q)), ...cNotches],
    grain: [p(midC.x - 1.8, Math.max(grainY[0], s.pivot.y - 2)), p(midC.x - 1.8, grainY[1])],
    balance: undefined,
    labels: [...label(midC, names[0], cuts[0]), ...pc.labels.filter((l) => l.text === 'ZIP ENDS')],
    cut: cuts[0],
    alternate: undefined,
    draft: pc.draft ? { frame: pc.draft.frame, points: points(cOwn) } : undefined,
    meta: { ...pc.meta, ...meta, waistSeamAt: (lowC[0].x + lowS[0].x) / 2 },
  };
  const sOwn = own(sPts);
  const side: Piece = {
    ...pc,
    name: names[1],
    outline: pathOf({ pts: sPts, tags: sTags }),
    lines: [],
    fold: undefined,
    notches: [...old.filter(([q]) => sOwn(q)), ...sNotches],
    grain: [p(midS.x + 1.8, Math.max(grainY[0], s.pivot.y)), p(midS.x + 1.8, Math.min(grainY[1], lowS2.y - 3))],
    balance: undefined,
    labels: label(midS, names[1], cuts[1]),
    cut: cuts[1],
    alternate: undefined,
    draft: pc.draft ? { frame: pc.draft.frame, points: points((q) => sOwn(q) && !cOwn(q)) } : undefined,
    meta: { ...meta },
  };
  delete side.meta.pointedAtCentre;
  // The seam on the garment as sewn: from the top, through the pivot, down the closed waist dart.
  const line = [s.top, s.pivot, ...(lowC.length > 1 ? lowC.slice(1) : [lerp(lowC[0], lowS[0], 0.5)])];
  return { centre, side, line };
}

/** Princess seams: the front and back each cut into a centre and a side panel. */
export function princessPieces(front: Piece, back: Piece, apex: P, line: Exclude<PrincessLine, 'none'>, at?: number): { pieces: Piece[]; lines: { front: P[]; back: P[] } } | undefined {
  // Front: the bust dart moved into the line, opened right to the bust point; `at` is where along the
  // shoulder or armhole it was drawn, and the back's line starts the same way along its own edge.
  const m = moveBustDart(front.outline, apex, line, { princess: true, armholeNotch: front.notches[0]?.[0], belowNotch: 2, at });
  if (!m) return undefined;
  const f = panels(front, { ring: m.ring, i1: m.i1, i2: m.i1 + 1, pivot: apex, move: m.move, top: m.closedAt }, ['Bodice centre front', 'Bodice side front'], ['Cut 1 on fold', 'Cut 2 (1 pair)'], line === 'shoulder' ? {} : {});

  // Back: the line runs from the shoulder or armhole through the waist dart's point.
  const r = ringOf(back.outline);
  let iQ: number;
  if (line === 'shoulder') {
    const run = runOf(r, 'shoulder')!;
    iQ = insertAlong(r, run, runLen(r, run) * (at !== undefined ? clampAt(at, 0.2, 0.8) : 0.5));
  } else {
    const run = runOf(r, 'armhole')!;
    const notch = back.notches.length >= 2 ? lerp(back.notches[0][0], back.notches[1][0], 0.5) : r.pts[run[0] + 2];
    let s = 0;
    let best = Infinity;
    let atS = 0;
    for (let i = run[0]; i <= run[1] + 1; i++) {
      if (i > run[0]) s += len(sub(r.pts[i], r.pts[i - 1]));
      if (len(sub(r.pts[i], notch)) < best) {
        best = len(sub(r.pts[i], notch));
        atS = s;
      }
    }
    iQ = insertAlong(r, run, at !== undefined ? runLen(r, run) * clampAt(at, 0.15, 0.6) : Math.min(atS + 2, runLen(r, run) * 0.6));
  }
  const dl = back.lines.map((l) => l.points()).find((q) => q.length === 3);
  const eye = fishEyeOf(back);
  let tip: P;
  if (dl) tip = dl[1];
  else if (eye) tip = eye[0];
  else {
    const sideRun = runOf(r, 'side')!;
    const waistSide = r.pts[(sideRun[1] + 1) % r.pts.length];
    tip = p(waistSide.x * 0.48, r.pts[sideRun[0]].y + 2.5);
  }
  const b = panels(back, { ring: r, i1: iQ, i2: iQ, pivot: tip, move: (q) => q, top: r.pts[iQ] }, ['Bodice centre back', 'Bodice side back'], ['Cut 2 (1 pair)', 'Cut 2 (1 pair)'], line === 'shoulder' ? { shoulderEase: 0.5 } : {});
  return { pieces: [f.centre, f.side, b.centre, b.side], lines: { front: f.line, back: b.line } };
}

/** The front's bust point: the cross drawn on the block. */
export function apexOf(front: Piece): P | undefined {
  const cross = front.lines.map((l) => l.points()).filter((q) => q.length === 2);
  if (cross.length < 2) return undefined;
  return lerp(cross[0][0], cross[0][1], 0.5);
}

export { nearestIndex };
