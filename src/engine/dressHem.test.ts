import { describe, expect, it } from 'vitest';
import { draftDress } from './dress';
import { hipToHem, levelSideHem, squareHem } from './dressHem';
import { Path, p, taggedLength } from './geometry';
import type { Piece } from './piece';
import { randomBody, rng } from './randomBodies';

// A one-piece dress's hem (fit audit, Nov 22): the Blush Shift and the Ivory Bias Slip printed a hem that dipped 1 to
// 3 cm between the centre and the side seam on every body, because it left the flared side seam square on a long
// handle and came back up to the centre's level.
const shift = (m: Parameters<typeof draftDress>[0]) =>
  draftDress(m, { fit: 'regular', neckline: 'crew', sleeve: 'none', darts: 'bust', bustDart: 'french', bustEase: 5, shiftBack: 'shaped' }, { silhouette: 'straight', length: 'mini', noSeam: 'shift', flareCm: 4 });
const slip = (m: Parameters<typeof draftDress>[0]) =>
  draftDress(m, { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', bustEase: 4, neck: { frontDepth: 14.5, width: 2, backDepth: 18, fullness: 0.85, strap: 3 }, armholeLower: 8 }, { silhouette: 'straight', length: 'maxi', floorClear: 13, noSeam: 'bias', flareCm: 16, slit: 'none' });

/** The hem's points, from one side seam to the centre (a half piece) or to the other side seam (a piece cut whole). */
function hemOf(pc: Piece) {
  const { pts, tags } = pc.outline.taggedPoints(16);
  return pts.filter((_, i) => tags[i] === 'hem' || tags[i - 1] === 'hem');
}

describe('a one-piece dress hem', () => {
  it('never dips below its ends on the Blush Shift and the Ivory Bias Slip, on 40 random bodies each', () => {
    const failures: string[] = [];
    for (const [name, draft] of [['shift', shift], ['slip', slip]] as const) {
      for (let s = 1; s <= 40; s++) {
        const d = draft(randomBody(rng(s)));
        const [front, back] = ['Dress front', 'Dress back'].map((n) => d.pieces.find((pc) => pc.name === n)!);
        for (const pc of [front, back]) {
          const hem = hemOf(pc);
          const xs = hem.map((q) => q.x);
          const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
          // The centre: the middle of a whole piece, the fold or centre seam of a half one.
          const cx = pc.meta.whole ? mid : Math.min(...xs);
          const centre = hem.reduce((a, q) => (Math.abs(q.x - cx) < Math.abs(a.x - cx) ? q : a));
          const side = hem.reduce((a, q) => (q.x > a.x ? q : a));
          const low = Math.max(...hem.map((q) => q.y));
          // (A front whose centre is cut higher than its side still leaves the seam square, a dip of a millimetre or two.)
          if (low > Math.max(centre.y, side.y) + (pc === back ? 0.05 : 0.35)) failures.push(`${name} body ${s} ${pc.name}: ${(low - Math.max(centre.y, side.y)).toFixed(2)} cm below`);
        }
        // Front and back still sew together down the side.
        if (Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side')) > 0.1) failures.push(`${name} body ${s}: side seams differ`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('ends a flared side seam where the seam is as long as the drop at the centre, bent or straight', () => {
    const hip = p(28, 60);
    for (const straight of [false, true]) {
      for (const flare of [2, 4, 10, 16]) {
        const foot = levelSideHem(hip, p(28 + flare, 100), straight);
        const seam = new Path(hip);
        if (straight) seam.line(foot, 'side');
        else hipToHem(seam, hip, foot, 'side');
        expect(seam.length()).toBeCloseTo(40, 2);
        expect(foot.x).toBe(28 + flare);
        expect(foot.y).toBeLessThan(100);
        // The hem leaves the seam square, and its handle stays on or above the hem's level.
        const handle = squareHem(hip, foot, 100);
        expect(handle.y).toBeLessThanOrEqual(100 + 1.5 * ((foot.x - hip.x) / Math.hypot(foot.x - hip.x, foot.y - hip.y)) + 1e-9);
        expect((handle.x - foot.x) * (foot.x - hip.x) + (handle.y - foot.y) * (foot.y - hip.y)).toBeCloseTo(0, 6);
      }
    }
  });

  it('leaves a straight or tapered seam where it was', () => {
    expect(levelSideHem(p(28, 60), p(28, 100), false)).toEqual(p(28, 100));
    expect(levelSideHem(p(28, 60), p(26.5, 100), false)).toEqual(p(26.5, 100));
    // With no level given the handle is the old 0.35 of the hem's width.
    expect(squareHem(p(28, 60), p(28, 100))).toEqual(p(28 - 28 * 0.35, 100));
  });
});
