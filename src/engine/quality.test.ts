// Stress tests: draft every block for thousands of realistic random bodies and check that each
// pattern is sound: shapes that don't cross themselves, seams that match, sizes that hit their
// targets, and darts that are trued and sit inside the piece.
import { describe, expect, it } from 'vitest';
import { P, len, sub, taggedLength } from './geometry';
import { Piece, bounds, cutLine } from './piece';
import { draftBodice } from './bodice';
import { DraftError, FIT_EASE, Length, Silhouette, draftSkirt, isCircle } from './skirt';
import { randomBody, rng } from './randomBodies';

const BODIES = 2000;

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, s: P) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** True when a closed polygon has no edges crossing each other. */
function isSimple(pts: P[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
    }
  }
  return true;
}

function inside(pt: P, poly: P[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Checks every piece of every block must pass. Returns a list of problems (empty when sound). */
function pieceProblems(pc: Piece): string[] {
  const problems: string[] = [];
  const outline = pc.outline.points();
  const cut = cutLine(pc);
  if (![...outline, ...cut].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) problems.push('non-finite point');
  if (!isSimple(outline.slice(0, -1))) problems.push('stitching line crosses itself');
  if (!isSimple(cut)) problems.push('cutting line crosses itself');
  for (const dart of pc.lines.filter((l) => l.segs.length === 2)) {
    const [near, tip, far] = dart.points();
    if (Math.abs(len(sub(near, tip)) - len(sub(far, tip))) > 0.01) problems.push('dart legs not trued');
    if (!inside(tip, outline)) problems.push('dart tip outside the piece');
  }
  return problems;
}

function report(failures: string[]) {
  // Show a handful of failures with their seeds so they can be reproduced.
  expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
}

describe('skirt block across random bodies', () => {
  const silhouettes: Silhouette[] = ['straight', 'a_line', 'pencil', 'trumpet', 'half_circle', 'circle'];
  const lengths: Length[] = ['mini', 'above_knee', 'knee', 'midi', 'maxi'];

  it(`drafts a sound pattern for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed);
      const body = randomBody(r);
      const fit = (['fitted', 'regular', 'relaxed'] as const)[seed % 3];
      const style = { fit, silhouette: silhouettes[seed % 6], length: lengths[(seed >> 1) % 5] };
      const tag = `seed ${seed} ${style.silhouette} ${style.length} ${fit}`;
      let draft;
      try {
        draft = draftSkirt(body, style);
      } catch (e) {
        // A trumpet skirt needs room between the hip and hem to flare; very short ones are refused.
        if (e instanceof DraftError && style.silhouette === 'trumpet' && style.length === 'mini') continue;
        failures.push(`${tag}: ${(e as Error).message}`);
        continue;
      }
      const [front, back] = draft.pieces;

      for (const pc of draft.pieces) pieceProblems(pc).forEach((pr) => failures.push(`${tag} ${pc.name}: ${pr}`));
      if (Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side')) > 0.05)
        failures.push(`${tag}: side seams differ`);
      // Waist seam with darts closed, times 4 quarters, should be the finished waist.
      const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      const target = body.waist + FIT_EASE[fit].waist;
      if (Math.abs(waist - target) > 1) failures.push(`${tag}: waist ${waist.toFixed(1)} vs ${target.toFixed(1)}`);
      for (const [pc, max] of [[front, 2.5], [back, 3.5]] as const) {
        for (const d of pc.meta.dartsCm as number[]) if (d > max + 0.01) failures.push(`${tag} ${pc.name}: ${d} cm dart`);
      }
      if (isCircle(style.silhouette)) {
        // The waist arcs of all four pieces make the finished waist exactly, and pieces fit 140 cm fabric.
        for (const pc of draft.pieces) {
          const [x0, , x1] = bounds(pc);
          if (x1 - x0 > 136) failures.push(`${tag} ${pc.name}: ${(x1 - x0).toFixed(0)} cm wide`);
        }
      } else if (style.silhouette !== 'pencil') {
        // A flared hem must meet the side seam square, so front and back join without a point or dip.
        const sideEnd = (pc: Piece) => {
          const { pts, tags } = pc.outline.taggedPoints(48);
          const i = tags.lastIndexOf('side');
          const a = sub(pts[i + 1], pts[i]);
          const b = sub(pts[i + 2], pts[i + 1]);
          return Math.abs((a.x * b.x + a.y * b.y) / (len(a) * len(b)));
        };
        if (sideEnd(front) > 0.05 && style.silhouette !== 'straight') failures.push(`${tag}: hem not square to side seam`);
      }
    }
    report(failures);
  });
});

describe('bodice block across random bodies', () => {
  it(`drafts a sound pattern for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const body = randomBody(rng(seed));
      const fit = (['fitted', 'regular', 'relaxed'] as const)[seed % 3];
      const tag = `seed ${seed} ${fit}`;
      const d = draftBodice(body, { fit });
      const [front, back] = d.pieces;

      for (const pc of d.pieces) pieceProblems(pc).forEach((pr) => failures.push(`${tag} ${pc.name}: ${pr}`));
      if (Math.abs(d.sideSeam.frontLessDart - d.sideSeam.back) > 0.05) failures.push(`${tag}: side seams differ`);
      if (Math.abs(d.shoulder.back - d.shoulder.front - 1) > 0.05) failures.push(`${tag}: shoulder ease`);
      if (d.warnings.length) failures.push(`${tag}: ${d.warnings.join('; ')}`);
      if (d.bustDart > 12) failures.push(`${tag}: bust dart ${d.bustDart} cm`);
      if (d.waistDarts.front > 8 || d.waistDarts.back > 6) failures.push(`${tag}: waist darts ${JSON.stringify(d.waistDarts)}`);
      const apex = front.lines[front.lines.length - 1].points()[0];
      if (!inside(apex, front.outline.points())) failures.push(`${tag}: bust point outside the front`);
      // Waist seam with darts closed should be the finished waist.
      const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      if (Math.abs(waist - d.finishedWaist) > 1.5) failures.push(`${tag}: waist ${waist.toFixed(1)} vs ${d.finishedWaist}`);
    }
    report(failures);
  });
});

describe('skirts matched to a photo shape across random bodies', () => {
  it(`hit the hem length and fullness for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    const sils: Silhouette[] = ['pencil', 'straight', 'a_line', 'trumpet', 'half_circle', 'circle'];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 50000);
      const body = randomBody(r);
      const silhouette = sils[seed % 6];
      const hemAt = 0.3 + r() * 0.62;
      const fullness =
        silhouette === 'pencil' ? 0.9 + r() * 0.08 : silhouette === 'straight' ? 1 + r() * 0.05 : silhouette === 'trumpet' ? 1.3 + r() * 0.8 : 1.2 + r() * 4;
      const shape = { hemAt, hemFullness: fullness, flareAt: silhouette === 'trumpet' ? 0.3 + r() * 0.15 : undefined };
      const tag = `seed ${seed} ${silhouette} ${JSON.stringify(shape)}`;
      let d;
      try {
        d = draftSkirt(body, { silhouette, shape, fit: 'regular' });
      } catch (e) {
        if (e instanceof DraftError && silhouette === 'trumpet') continue; // too short to flare
        failures.push(`${tag}: ${(e as Error).message}`);
        continue;
      }
      for (const pc of d.pieces) pieceProblems(pc).forEach((pr) => failures.push(`${tag} ${pc.name}: ${pr}`));
      const waist = 2 * (taggedLength(d.pieces[0].outline, 'waist') + taggedLength(d.pieces[1].outline, 'waist'));
      if (Math.abs(waist - d.finishedWaist) > 1) failures.push(`${tag}: waist ${waist.toFixed(1)} vs ${d.finishedWaist}`);
      const length = Math.min(Math.max(hemAt * body.waist_to_floor, body.waist_to_hip + 8), body.waist_to_floor - 2);
      if (Math.abs(d.lengthCm - length) > 0.1) failures.push(`${tag}: length ${d.lengthCm} vs ${length.toFixed(1)}`);
      // The hem is what the photo showed, unless that's more than a full circle can give, or a
      // trumpet whose short flare can't reach it.
      const target = fullness * d.finishedHip;
      const reachable = Math.min(target, d.finishedWaist + 2 * Math.PI * d.lengthCm);
      // A pencil skirt tapers at most 3 cm a side, so a narrower hem than that comes out at the limit.
      if (silhouette === 'pencil' && d.hemCm < reachable - 2) failures.push(`${tag}: pencil hem ${d.hemCm} under ${reachable.toFixed(0)}`);
      if (silhouette !== 'trumpet' && silhouette !== 'pencil' && Math.abs(d.hemCm - reachable) > Math.max(2, 0.03 * reachable))
        failures.push(`${tag}: hem ${d.hemCm} vs ${reachable.toFixed(0)}`);
      if (silhouette === 'trumpet' && d.hemCm > target * 1.03) failures.push(`${tag}: trumpet hem ${d.hemCm} over ${target.toFixed(0)}`);
    }
    report(failures);
  });
});
