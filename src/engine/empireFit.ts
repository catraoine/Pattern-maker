// An empire waist seam sits close under the bust: the underbust plus 5 cm (Cat, Nov 14 2026, "Empire yes"). The bodice
// is cut across from the waist-length draft (raiseBodice in waistline.ts), which keeps the waist's room there: 13 to
// 17 cm over the underbust on the Sixties empire mini (tester pattern review, Nov 14). Here the waist dart that crosses
// the seam on each piece is opened wider at the seam, from nothing at its point to the full amount at the seam, as a
// pattern cutter deepens an under-bust dart. The side seams and the centre stay where they are, so the side seams still
// match and the bust keeps its room; only the seam between them comes in. A bodice with too little seam either side of
// its darts to give it all comes in as far as it can.
import { P, Path, len, p, sub, taggedLength, unit } from './geometry';
import { finishDart } from './darts';
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

/** A piece's waist dart where it meets the seam: its two legs (nearer and further from the centre), its point, the side
 *  seam's foot, and the seam itself as a run of points from the centre out. */
interface Dart {
  near: number;
  far: number;
  tip: number;
  foot: P;
  seam: P[];
}

function dartAt(pc: Piece): Dart | undefined {
  const { pts, tags } = pc.outline.taggedPoints(4);
  const legs = pts.filter((_, i) => (tags[i] === 'dart' && tags[i - 1] === 'waist') || (tags[i] === 'waist' && tags[i - 1] === 'dart'));
  const sides = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  if (legs.length !== 2 || !sides.length) return undefined;
  const foot = sides.reduce((a, q) => (q.y > a.y ? q : a));
  const [near, far] = legs.map((q) => Math.abs(q.x)).sort((a, b) => a - b);
  // Its point: the highest point of the internal dart line that runs down to it.
  const line = pc.lines.find((l) => l.points(4).some((q) => legs.some((g) => Math.hypot(q.x - g.x, q.y - g.y) < 0.6)));
  const tip = line ? Math.min(...line.points(4).map((q) => q.y)) : undefined;
  const onSeam = (t: string | undefined) => t === 'waist' || t === 'dart';
  const seam = pts.filter((_, i) => onSeam(tags[i]) || onSeam(tags[i - 1])).sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  if (tip === undefined || !(foot.y - tip > 1) || !(Math.abs(foot.x) > far) || legs.some((g) => !(g.y - tip > 1))) return undefined;
  return { near, far, tip, foot, seam };
}

/** How far down the seam is at a distance x from the centre, read off the seam's own points. */
function seamAt(seam: P[], x: number): number {
  const i = seam.findIndex((q) => Math.abs(q.x) >= x);
  if (i <= 0) return (i === 0 ? seam[0] : seam[seam.length - 1]).y;
  const [a, b] = [seam[i - 1], seam[i]];
  const span = Math.abs(b.x) - Math.abs(a.x);
  return span > 1e-9 ? a.y + ((b.y - a.y) * (x - Math.abs(a.x))) / span : Math.max(a.y, b.y);
}

/** A point moved so the dart is `open` cm wider each side at the seam, nothing at its point; centre and side seam stay. */
function opened(q: P, d: Dart, open: number): P {
  const x = Math.abs(q.x);
  // The share of the opening grows from the dart's point down to the seam, measured to the seam right there, so every
  // point of the seam opens by the same share. Measured to one fixed height instead, the seam's own small rises and
  // falls opened by different amounts: where it rose a little just beside the dart, that bit came in less than the
  // dart's foot beside it and the seam stepped back on itself (random bodies, Nov 22).
  const w = Math.min(1, Math.max(0, (q.y - d.tip) / (seamAt(d.seam, x) - d.tip)));
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

/** How far either side of a dart's foot the seam is eased up or down to meet it. */
const FOOT_BLEND = 1.5;

/**
 * The dart at the seam trued again once opened, as a pattern cutter would: the legs made equal from the point and the
 * peak drawn for the new width, and the seam eased to meet each leg's foot. raiseBodice trued it at its old width, a
 * leg's foot a millimetre or so off the seam; opened several times wider, that millimetre stood as a step at the foot,
 * and the cutting line, an even width out from it, crossed itself there on about half of all bodies (random bodies,
 * Nov 22).
 */
function retrued(pc: Piece): Piece {
  const o = pc.outline;
  // (The waist dart's two sides in the seam, not a side bust dart's.)
  const i = o.tags.findIndex((t, k) => o.tags[k - 1] === 'waist' && t === 'dart' && o.tags[k + 1] === 'dart' && o.tags[k + 2] === 'waist');
  if (i < 1) return pc;
  const pts = o.segs.map((s) => s.to);
  const [a, b] = [pts[i - 1], pts[i + 1]];
  const same = (q: P, r: P) => len(sub(q, r)) < 1e-6;
  const li = pc.lines.findIndex((l) => l.segs.length === 2 && ((same(l.start, a) && same(l.segs[1].to, b)) || (same(l.start, b) && same(l.segs[1].to, a))));
  if (li < 0) return pc;
  const tip = pc.lines[li].segs[0].to;
  // The seam's points either side, each run from beside its foot outward: toward the centre from the nearer leg, toward
  // the side from the further one.
  const n = pts.length;
  const run = (from: number, step: number) => {
    const out: number[] = [];
    for (let k = from; o.tags[step > 0 ? k : k + 1] === 'waist' && out.length < n; k = (k + step + n) % n) out.push(k);
    return out;
  };
  const before = run(i - 2, -1);
  const after = run(i + 2, 1);
  const aNear = Math.abs(a.x) < Math.abs(b.x);
  const [near, far, nearRun, farRun] = aNear ? [a, b, before, after] : [b, a, after, before];
  if (nearRun.length < 3 || farRun.length < 3) return pc;
  const ahead = pts[nearRun.find((k) => Math.abs(Math.abs(pts[k].x) - Math.abs(near.x)) >= 0.5) ?? nearRun[nearRun.length - 1]];
  const tr = finishDart(tip, near, far, unit(sub(ahead, pts[nearRun[0]])));
  const moved = new Map<number, P>([[aNear ? i - 1 : i + 1, tr.near], [i, tr.peak], [aNear ? i + 1 : i - 1, tr.far]]);
  const dropped = new Set<number>();
  for (const [foot, r] of [[tr.near, nearRun], [tr.far, farRun]] as const) {
    const fx = Math.abs(foot.x);
    const outward = Math.sign(Math.abs(pts[r[r.length - 1]].x) - fx);
    // Points the trued foot has passed would fold the seam back on itself: they go.
    const keep = r.filter((k) => (Math.abs(pts[k].x) - fx) * outward > 0.02);
    r.filter((k) => !keep.includes(k)).forEach((k) => dropped.add(k));
    if (keep.length < 2) return pc;
    // Where the seam would reach the foot, carried on from its next two points, and the rise or fall to the foot itself.
    const [q0, q1] = [pts[keep[0]], pts[keep[1]]];
    const slope = (q1.y - q0.y) / (Math.abs(q1.x) - Math.abs(q0.x) || 1e-9);
    const rise = foot.y - (q0.y + slope * (fx - Math.abs(q0.x)));
    for (const k of keep) {
      const t = 1 - Math.abs(Math.abs(pts[k].x) - fx) / FOOT_BLEND;
      if (t > 0) moved.set(k, p(pts[k].x, pts[k].y + rise * t));
    }
  }
  // (The seam is drawn in straight lines, raiseBodice's; and the run never reaches the outline's last point, its start
  // again, the neck or the centre.)
  if (dropped.has(n - 1) || moved.has(n - 1) || [...moved.keys(), ...dropped].some((k) => o.segs[k].kind !== 'L')) return pc;
  const outline = new Path(o.start);
  o.segs.forEach((s, k) => {
    if (dropped.has(k)) return;
    outline.segs.push({ ...s, to: moved.get(k) ?? s.to });
    outline.tags.push(o.tags[k]);
  });
  outline.closed = o.closed;
  const lines = pc.lines.map((l, k) => (k === li ? new Path(same(l.start, near) ? tr.near : tr.far).line(tr.tip).line(same(l.start, near) ? tr.far : tr.near) : l));
  return { ...pc, outline, lines };
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
    return d ? retrued(warpPiece(pc, (q) => opened(q, d, open))) : pc;
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
