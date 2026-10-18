import { describe, expect, it } from 'vitest';
import { roundSkirt, stripesMeet } from './allRound';
import { draftSkirt } from './skirt';
import { roundRows } from '../ui/AllRound';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const side = Math.PI / 2;

describe('all round', () => {
  it('reads a level skirt as one length all the way round, with its seams, darts and zip', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }));
    expect(r.readings).toEqual({ front: 58, back: 58, left: 58, right: 58 });
    expect(r.seams.map((s) => s.kind)).toEqual(['side', 'side', 'centre_back']);
    expect(r.seams[2].zipCm).toBeGreaterThan(15);
    expect(r.darts).toHaveLength(8);
    expect(r.seamsMeet).toBe(true);
    expect(r.flare).toBeGreaterThan(1);
  });

  it('follows a high-low hem round the body, and a diagonal one side to side', () => {
    const hl = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', asymHem: 'high_low' })).readings;
    expect(hl.front).toBeLessThan(hl.left);
    expect(hl.back).toBeGreaterThan(hl.left);
    const dg = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', asymHem: 'diagonal' })).readings;
    expect(dg.left).not.toBe(dg.right);
  });

  // A hem drawn by hand is trued as it is drafted: front and back come to the same length at each side
  // seam, so the view shows them meeting and never flags a step.
  it('shows a hand-drawn hem meeting at the side seams', () => {
    const front = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const back = [6, 5, 4, 3, 2, 1, 0, -1, -2];
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', hem: { front, back } }));
    for (const s of [side, -side]) expect(Math.abs(r.lengthAt(s - 1e-6) - r.lengthAt(s + 1e-6))).toBeLessThan(0.05);
    expect(r.seamsMeet).toBe(true);
  });

  it('has no darts or zip on an elastic waist, and no centre back seam when the back is on the fold', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', waist: 'elastic' }));
    expect(r.darts).toHaveLength(0);
    expect(r.seams.every((s) => !s.zipCm)).toBe(true);
    expect(r.seams.some((s) => s.kind === 'centre_back')).toBe(false);
  });

  it('says only true things, and stripes only when the fabric has them and they meet', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }));
    expect(stripesMeet(r)).toBe(true);
    expect(roundRows(r, false).map((x) => x.id)).toEqual(['seams', 'hem']);
    expect(roundRows(r, true).map((x) => x.id)).toEqual(['seams', 'hem', 'stripes']);
    const rows = roundRows(r, true).map((x) => x.text).join(' ');
    expect(rows).not.toMatch(/problem|fix|wrong|longer than/i);
  });
});
