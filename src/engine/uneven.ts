// An uneven neckline: a front neckline drawn differently on the two sides, lower on one side or an
// asymmetric V. Like the one-shoulder's front (drape.ts), the half block is traced twice into a whole
// front, since the two sides differ, and cut once from a single layer, right side up. The neckline is
// drawn across both halves, from one neck point down to its lowest point and up to the other, leaving
// each neck point square to the shoulder as the block's own neckline does, so it runs on into the back
// neck once the shoulders are sewn. The neck points, the shoulders and the back neck stay as drafted,
// so the back is still a pair and sews to the front as usual.
import { P, add, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { pathOf, ringOf } from './manipulate';
import type { DraftPoint, Piece } from './piece';
import type { BodiceDraft, BodiceStyle, UnevenNeck } from './bodice';
import { POINTED_NECK } from './bodice';
import { coveredRun, cubic, moveLine } from './drape';
import { cm } from './skirt';

const r1 = (v: number) => Math.round(v * 10) / 10;
const mx = (q: P) => p(-q.x, q.y);

/** An uneven neckline allows no princess seams, moved bust dart, collar or button front: the front is
 * one piece across the centre, with no fold or opening there. */
export function unevenStyle<S extends BodiceStyle>(s: S): S {
  if (!s.unevenNeck) return s;
  return { ...s, princess: 'none', bustDart: 'side', collar: 'none', closure: 'back_zip' };
}

/** The neck point and the way into the body, square to the shoulder, of a half run from its neck point. */
function neckPoint(run: P[], k: number) {
  const N = p(run[0].x * k, run[0].y);
  const along = unit(sub(p(run[1].x * k, run[1].y), N));
  const into = p(-along.y, along.x);
  return { N, into: into.y >= 0 ? into : mul(into, -1) };
}

/**
 * One side of the neckline, from its lowest point `B` up to the neck point `N`: leaving B level, so the
 * two sides meet smoothly there, and arriving square to the shoulder. `full` is how full the curve is,
 * as for a drawn neckline; below `POINTED_NECK` it is straight from B, like the side of a V.
 */
function side(B: P, N: P, into: P, full: number): P[] {
  const drop = B.y - N.y;
  const toward = (k: number) => add(N, mul(into, drop * k));
  if (full < POINTED_NECK) {
    const m = lerp(B, N, 0.5);
    return [B, ...cubic(B, lerp(B, m, 1 / 3), lerp(B, m, 2 / 3), m, 6), ...cubic(m, lerp(B, N, 0.75), toward(0.15), N)];
  }
  return [B, ...cubic(B, add(B, p((N.x - B.x) * (0.45 + 0.5 * full), 0)), toward(0.2 + 0.5 * full), N)];
}

/** Where the lowest point can go: below the block's neck, 5 cm clear of the bust points, and no further
 * across than most of the way to a neck point. */
function unevenLimits(d: BodiceDraft) {
  const top = d.neckBlock.front.neckY;
  const front = d.block?.[0] ?? d.pieces[0];
  const { pts, tags } = front.outline.taggedPoints(4);
  const N = pts[tags.indexOf('shoulder')] ?? p(d.neckBlock.front.neckX, 0);
  return { depth: { min: 0, max: Math.max(0, d.front.apex.y - 5 - top) }, x: 0.6 * Math.abs(N.x) };
}

/** The uneven neck, kept inside the limits. */
export function clampUneven(u: UnevenNeck, d: BodiceDraft): UnevenNeck {
  const lim = unevenLimits(d);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { depth: clamp(u.depth, lim.depth.min, lim.depth.max), x: clamp(u.x, -lim.x, lim.x), left: clamp(u.left, 0, 1), right: clamp(u.right, 0, 1) };
}

/** The whole front with an uneven neckline, the wearer's left on x > 0 as it lies right side up. */
export function unevenFront(d: BodiceDraft, s: BodiceStyle): BodiceDraft {
  if (!s.unevenNeck) return d;
  const u = clampUneven(s.unevenNeck, d);
  const front = d.pieces[0];
  // A back yoke splits the back: the block's back keeps its neck and shoulder for the flat and the neck.
  const back = d.block?.[1] ?? d.pieces[1];
  const B = p(u.x, d.neckBlock.front.neckY + u.depth);
  /** The whole front from two halves, the left on x > 0, and the neckline from the right neck point
   * down to its lowest point and up to the left one. */
  const whole = (leftPc: Piece, rightPc: Piece) => {
    const left = coveredRun(ringOf(leftPc.outline));
    const right = coveredRun(ringOf(rightPc.outline));
    const L = neckPoint(left.pts, 1);
    const R = neckPoint(right.pts, -1);
    const edge = [...[...side(B, R.N, R.into, u.right)].reverse(), ...side(B, L.N, L.into, u.left).slice(1)];
    const ring = {
      pts: [...left.pts, ...[...right.pts].reverse().slice(1).map(mx), ...edge.slice(1, -1)],
      tags: [...left.tags, ...[...right.tags].reverse(), ...edge.slice(1).map(() => 'neck')],
    };
    return { outline: pathOf(ring), edge, foot: left.pts[left.pts.length - 1].y };
  };
  const { outline, edge, foot } = whole(front, front);
  // A lower shoulder: the whole front again with that side's half drafted lower, as a second line, the
  // way the block and the back carry it.
  const low = d.lowShoulder;
  const alternate = low && front.alternate ? { outline: whole(low.side === 'left' ? low.pieces[0] : front, low.side === 'right' ? low.pieces[0] : front).outline, label: front.alternate.label } : undefined;

  // Where the neckline crosses the centre front, for the grain line and the centre front mark.
  let top = B.y;
  for (let i = 1; i < edge.length; i++)
    if (edge[i - 1].x * edge[i].x <= 0 && edge[i - 1].x !== edge[i].x) top = lerp(edge[i - 1], edge[i], edge[i - 1].x / (edge[i - 1].x - edge[i].x)).y;
  const cut = 'Cut 1, right side up';
  const deeper = Math.abs(u.x) < 0.5 ? 'at the centre front' : `${cm(Math.abs(u.x))} toward the ${u.x > 0 ? 'left' : 'right'} side`;
  const points: DraftPoint[] = [
    ...(front.draft?.points ?? []).filter((pt) => pt.n !== '1'),
    {
      n: 'L',
      at: B,
      note: `Lowest point of the neckline: ${cm(u.depth)} below the block's centre front neck, ${deeper}. The half block is traced again, turned over, for the right side, since the two sides differ, and the neckline is drawn across both from neck point to neck point, square to each shoulder.`,
    },
  ];
  const pointed = u.left < POINTED_NECK && u.right < POINTED_NECK;
  const newFront: Piece = {
    ...front,
    outline,
    lines: [...front.lines, ...front.lines.map(moveLine(mx))],
    grain: [p(0, top + 4), p(0, foot - 4)],
    fold: undefined,
    alternate,
    balance: [{ pts: [p(0, top), p(0, foot)], label: 'CENTRE FRONT' }],
    notches: [...front.notches, ...front.notches.map(([q, dir]): [P, P] => [mx(q), mx(dir)])],
    labels: [
      ...front.labels.map((l) => (l.text === front.cut ? { ...l, text: cut } : l)),
      { at: add(front.labels[1]?.at ?? p(d.front.apex.x, d.armholeDepth - 2.5), p(0, 1.7)), text: 'LEFT SIDE', size: 0.7 },
    ],
    cut,
    draft: front.draft ? { frame: front.draft.frame, points } : undefined,
    // A V meeting at the centre front comes to a point there on purpose.
    meta: { ...front.meta, whole: true, singleLayer: true, rightSideUp: true, pointedAtCentre: pointed && Math.abs(u.x) < 1e-6 ? ['neck'] : undefined },
  };
  return {
    ...d,
    pieces: [newFront, ...d.pieces.slice(1)],
    block: [d.block?.[0] ?? front, back],
    // A back yoke's seam stays; the whole front takes no style lines.
    styleLines: d.styleLines?.back.length ? { ...d.styleLines, front: [] } : undefined,
    neck: r1(2 * taggedLength(back.outline, 'neck') + taggedLength(outline, 'neck')),
    drape: { kind: 'uneven', uneven: u },
  };
}

/** The uneven neckline as drafted, from the wearer's right neck point to the left, as the front lies
 * right side up (and as it is seen, worn): for drawing it on the form or the sketch. */
export function unevenEdge(d: BodiceDraft): P[] {
  if (d.drape?.kind !== 'uneven') return [];
  const { pts, tags } = d.pieces[0].outline.taggedPoints(4);
  return pts.filter((_, i) => tags[i] === 'neck' || (i > 0 && tags[i - 1] === 'neck'));
}
