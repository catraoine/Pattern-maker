// A wrap front: each front crosses over the other and ties at the waist, so the bodice needs no zip
// and the back is cut on the fold. The half block is traced twice, the second time turned over, and
// the front edge is drawn from the neck point straight down to cross the centre front a little above
// the bust point, then curving on across the other half, below its bust point, to that side's waist.
// Everything above the edge on the far half goes, with its side seam: the far end is a free edge that
// carries a tie. The far half's waist dart stays, shortened to end below the edge, so the overlap is
// shaped at the waist like the half under it. The two fronts are the same piece cut as a pair, each
// one wearing its own half and lying over (or under) the other's.
import { P, Path, add, lerp, len, mul, p, sub, taggedLength, unit } from './geometry';
import { pathOf, ringOf } from './manipulate';
import { finishDart } from './darts';
import { coveredRun, cubic } from './drape';
import { insidePolygon } from './marks';
import type { DraftPoint, Piece } from './piece';
import type { BodiceStyle } from './bodice';
export { wrapTies } from './wrapSkirt';
import { cm } from './skirt';

/**
 * Where the front edge crosses the centre front, in cm above the bust point's level, and how far below
 * the edge the far waist dart must end.
 */
export const WRAP = { crossAbove: 3, dartClear: 3 };


/** Bust darts that a wrap front keeps whole: one opening in the edge or the far side seam is cut away. */
export const WRAP_BUST_DARTS = ['side', 'shoulder', 'armhole', 'waist'] as const;

/**
 * A wrap's own style: a V crossing over, so no other neckline, collar, princess seams, yoke, peplum
 * or hip length; a bust dart from the neckline or low on the side would be cut through by the edge.
 */
export function wrapStyle<S extends BodiceStyle>(s: S): S {
  if (s.closure !== 'wrap') return s;
  const bustDart = (WRAP_BUST_DARTS as readonly string[]).includes(s.bustDart ?? 'side') ? s.bustDart : 'side';
  return { ...s, neckline: 'v', neck: undefined, unevenNeck: undefined, collar: 'none', princess: 'none', yoke: undefined, empire: undefined, panel: undefined, peplum: 'none', length: 'waist', dropCm: undefined, bustDart, structure: 'none' };
}
const mx = (q: P) => p(-q.x, q.y);

/** The y of a polyline at x, by its first crossing. */
function yAt(pts: P[], x: number): number | undefined {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return undefined;
}

/** The front edge, from the far side's waist up across the centre front to the neck point `N`. */
function wrapEdge(N: P, into: P, cross: P, far: P): P[] {
  const down = unit(sub(cross, N));
  const k = len(sub(far, cross)) * 0.45;
  // Leaving the cross point on the line of the V, and arriving at the far side heading out and down, about 35° to the waist.
  const lower = cubic(cross, add(cross, mul(down, k)), add(far, p(k * 0.7, -k * 0.5)), far, 20);
  // Leaving the neck point square to the shoulder, so it runs on into the back neck, then straight down.
  const upper = cubic(N, add(N, mul(into, len(sub(cross, N)) * 0.2)), lerp(N, cross, 2 / 3), cross, 12);
  return [...[...lower].reverse(), ...[...upper].reverse().slice(1)];
}

export interface WrapFront {
  piece: Piece;
  /** The front edge from the far waist to the neck point, as the piece lies (its own half on x > 0). */
  edge: P[];
  /** Where the edge crosses the centre front. */
  cross: P;
  /** Where the tie goes on: the far end of the edge, at the waist. */
  tieAt: P;
}

/** The wrap front from the bodice's half front (its own half on x > 0, the far half turned over to x < 0). */
export function wrapFront(front: Piece, apex: P): WrapFront {
  const run = coveredRun(ringOf(front.outline));
  const N = run.pts[0];
  // The far half from the centre front foot along its waist to the side: the waist and its dart only.
  const rev = { pts: [...run.pts].reverse().map(mx), tags: [...run.tags].reverse() };
  let j = 0;
  while (j < rev.tags.length && (rev.tags[j] === 'waist' || rev.tags[j] === 'hem' || rev.tags[j] === 'dart')) j++;
  const farPts = rev.pts.slice(0, j + 1);
  const farTags = rev.tags.slice(0, j);
  const W = farPts[farPts.length - 1];
  const cross = p(0, apex.y - WRAP.crossAbove);
  const along = unit(sub(run.pts[1], N));
  const sq = p(-along.y, along.x);
  const edge = wrapEdge(N, sq.y > 0 ? sq : mul(sq, -1), cross, W);
  const ring = {
    pts: [...run.pts, ...farPts.slice(1), ...edge.slice(1, -1)],
    tags: [...run.tags, ...farTags, ...edge.slice(1).map(() => 'neck')],
  };

  // The far waist dart, shortened to end clear below the edge.
  const dartLine = front.lines.map((l) => l.points()).find((q) => q.length === 3 && Math.abs(q[1].y - q[0].y) > Math.abs(q[1].x - q[0].x));
  let farDart: P[] | undefined;
  if (dartLine) {
    const tip = mx(dartLine[1]);
    const edgeY = yAt(edge, tip.x) ?? cross.y;
    const newTip = p(tip.x, Math.max(tip.y, edgeY + WRAP.dartClear));
    const n = ring.tags.length;
    const at = ring.tags.findIndex((t, i) => t === 'dart' && ring.tags[(i - 1 + n) % n] === 'waist' && ring.tags[(i + 1) % n] === 'dart' && ring.pts[i].x < 0);
    if (at >= 0) {
      const nd = finishDart(newTip, ring.pts[at], ring.pts[at + 2], p(1, 0));
      ring.pts[at] = nd.near;
      ring.pts[at + 1] = nd.peak;
      ring.pts[at + 2] = nd.far;
      farDart = [nd.near, nd.tip, nd.far];
    }
  }
  const outline = pathOf(ring);
  const inside = (q: P) => insidePolygon(q, ring.pts);
  const foot = Math.max(...run.pts.filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
  const cut = 'Cut 2 (1 pair)';
  const points: DraftPoint[] = [
    ...(front.draft?.points ?? []).filter((pt) => inside(pt.at) || pt.at.x > 0.5),
    { n: 'X', at: cross, note: `The front edge crosses the centre front ${cm(WRAP.crossAbove)} above the bust point's level, straight down from the neck point.` },
    { n: 'W', at: W, note: "Far end: the other half's side waist. The edge curves across below that half's bust point to here, and the tie is sewn on here." },
  ];
  const piece: Piece = {
    ...front,
    outline,
    lines: [...front.lines, ...(farDart ? [new Path(farDart[0]).line(farDart[1]).line(farDart[2])] : [])],
    grain: [p(Math.max(2.5, apex.x * 0.5), cross.y + 3), p(Math.max(2.5, apex.x * 0.5), foot - 3)],
    fold: undefined,
    alternate: undefined,
    balance: [{ pts: [cross, p(0, foot)], label: 'CENTRE FRONT' }],
    notches: [...front.notches.filter(([q]) => !(Math.abs(q.x) < 1e-6)), ...front.notches.map(([q, dir]): [P, P] => [mx(q), mx(dir)]).filter(([q]) => inside(q) && q.y > W.y - 1)],
    labels: [...front.labels.map((l) => (l.text === front.cut ? { ...l, text: cut } : l)), { at: add(W, p(3, -1.2)), text: 'TIE', size: 0.6 }],
    cut,
    draft: front.draft ? { frame: front.draft.frame, points } : undefined,
    // Each front holds its own half and most of the other's: its waist runs the whole front, from side
    // to side, but it has one side seam. The far end is a free edge, with the tie.
    meta: { ...front.meta, whole: true, wrap: true, seams: { side: 1, waist: 2, shoulder: 1, armhole: 1 }, pointedAtCentre: undefined },
  };
  return { piece, edge, cross, tieAt: W };
}

/** The front edge's length, for its binding or facing. */
export const wrapEdgeLength = (pc: Piece) => taggedLength(pc.outline, 'neck');

