// An empire waist seam sits close under the bust: the underbust plus 5 cm (Cat, Nov 14 2026, "Empire yes"). The bodice
// is cut across from the waist-length draft (raiseBodice in waistline.ts), which keeps the waist's room there: 13 to
// 17 cm over the underbust on the Sixties empire mini (tester pattern review, Nov 14). Here the waist dart that crosses
// the seam on each piece is opened wider at the seam, from nothing at its point to the full amount at the seam, as a
// pattern cutter deepens an under-bust dart. The side seams and the centre stay where they are, so the side seams still
// match and the bust keeps its room; only the seam between them comes in. A bodice with too little seam either side of
// its darts to give it all comes in as far as it can.
import { P, Path, p, taggedLength } from './geometry';
import type { Piece } from './piece';
import type { BodiceDraft } from './bodice';

/** Room at an empire seam over the underbust, darts closed. */
const EMPIRE_EASE = 5;

/** The seam's girth with darts closed: what a cut bodice's 'waist' edges add up to. */
const seamGirth = (pcs: Piece[]) => 2 * pcs.filter((pc) => !pc.kind && /^Bodice/.test(pc.name)).reduce((t, pc) => t + taggedLength(pc.outline, 'waist'), 0);

const warpPath = (path: Path, f: (q: P) => P): Path => {
  const out = new Path(f(path.start));
  out.segs = path.segs.map((s) => (s.kind === 'L' ? { ...s, to: f(s.to) } : { ...s, c1: f(s.c1), c2: f(s.c2), to: f(s.to) }));
  out.tags = [...path.tags];
  out.closed = path.closed;
  return out;
};

function warpPiece(pc: Piece, f: (q: P) => P): Piece {
  return {
    ...pc,
    outline: warpPath(pc.outline, f),
    lines: pc.lines.map((l) => warpPath(l, f)),
    ...(pc.grain ? { grain: [f(pc.grain[0]), f(pc.grain[1])] as [P, P] } : {}),
    ...(pc.fold ? { fold: [f(pc.fold[0]), f(pc.fold[1])] as [P, P] } : {}),
    notches: pc.notches.map(([q, d]) => [f(q), d] as [P, P]),
    ...(pc.balance ? { balance: pc.balance.map((b) => ({ ...b, pts: b.pts.map(f) })) } : {}),
    labels: pc.labels.map((l) => ({ ...l, at: f(l.at) })),
    ...(pc.draft ? { draft: { frame: pc.draft.frame.map((fr) => fr.map(f)), points: pc.draft.points.map((d) => ({ ...d, at: f(d.at) })) } } : {}),
    ...(pc.alternate ? { alternate: { ...pc.alternate, outline: warpPath(pc.alternate.outline, f) } } : {}),
  };
}

/** Where a piece's waist dart meets the seam (its two legs, nearer and further from the centre), its point, and the side seam's foot. */
function dartAt(pc: Piece): { near: number; far: number; tip: number; foot: P } | undefined {
  const { pts, tags } = pc.outline.taggedPoints(4);
  const legs = pts.filter((_, i) => (tags[i] === 'dart' && tags[i - 1] === 'waist') || (tags[i] === 'waist' && tags[i - 1] === 'dart'));
  const sides = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  if (legs.length !== 2 || !sides.length) return undefined;
  const foot = sides.reduce((a, q) => (q.y > a.y ? q : a));
  const [near, far] = legs.map((q) => Math.abs(q.x)).sort((a, b) => a - b);
  // Its point: the highest point of the internal dart line that runs down to it.
  const line = pc.lines.find((l) => l.points(4).some((q) => legs.some((g) => Math.hypot(q.x - g.x, q.y - g.y) < 0.6)));
  const tip = line ? Math.min(...line.points(4).map((q) => q.y)) : undefined;
  if (tip === undefined || !(foot.y - tip > 1) || !(Math.abs(foot.x) > far)) return undefined;
  return { near, far, tip, foot };
}

/** A point moved so the dart is `open` cm wider each side at the seam, nothing at its point; centre and side seam stay. */
function opened(q: P, d: { near: number; far: number; tip: number; foot: P }, open: number): P {
  const w = Math.min(1, Math.max(0, (q.y - d.tip) / (d.foot.y - d.tip)));
  const x = Math.abs(q.x);
  const side = Math.abs(d.foot.x);
  if (w <= 0 || x >= side) return q;
  // Never more than the seam either side of the dart can give and still run on outward without folding back on itself.
  const a = Math.min(open, 0.45 * d.near, 0.45 * (side - d.far)) * w;
  // Eased to nothing at the centre and at the side, so the seam still leaves both square and runs on smoothly across them.
  const to =
    x <= d.near
      ? x - a * (x / d.near) ** 2
      : x < d.far
        ? d.near - a + ((x - d.near) * (d.far - d.near + 2 * a)) / (d.far - d.near)
        : x + a * (1 - (x - d.far) / (side - d.far)) ** 2;
  return p(Math.sign(q.x) * to, q.y);
}

/**
 * A bodice cut across for an empire seam (raiseBodice), its waist darts opened at the seam until the seam is the body's
 * girth there (the underbust, right under the bust) plus EMPIRE_EASE. One that already fits closer, or has no waist dart to open, is left as it is.
 */
export function snugEmpire(b: BodiceDraft, girth: number): BodiceDraft {
  const target = girth + EMPIRE_EASE;
  const before = seamGirth(b.pieces);
  if (!(before > target + 0.1)) return b;
  const main = b.pieces.filter((pc) => !pc.kind && /^Bodice/.test(pc.name));
  const darts = new Map(main.map((pc) => [pc, dartAt(pc)] as const));
  if (main.length !== 2 || [...darts.values()].some((d) => !d)) return b;
  // Each leg moves in by an eighth of the excess: two legs a piece, a front and a back, both halves of the body.
  let open = (before - target) / 8;
  // (The block, which the drawings are made from, has its own copies of the two pieces.)
  const warp = (pc: Piece) => {
    const d = !pc.kind && /^Bodice/.test(pc.name) ? (darts.get(pc) ?? dartAt(pc)) : undefined;
    return d ? warpPiece(pc, (q) => opened(q, d, open)) : pc;
  };
  // The trued dart peaks take a little of it back, so walk the opening in until the seam measures right.
  let pieces = b.pieces.map(warp);
  for (let i = 0; i < 4; i++) {
    const miss = seamGirth(pieces) - target;
    if (Math.abs(miss) < 0.1) break;
    open += miss / 8;
    pieces = b.pieces.map(warp);
  }
  return { ...b, pieces, ...(b.block ? { block: b.block.map(warp) } : {}), finishedWaist: Math.round(seamGirth(pieces) * 10) / 10 };
}
