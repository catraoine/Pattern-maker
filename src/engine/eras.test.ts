import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { ERAS, LOOKS } from './eras';
import { FIT_EASE, draftSkirt } from './skirt';
import { sewingGuide } from './instructions';
import { randomBody, rng } from './randomBodies';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('era looks', () => {
  it('have unique ids and at least two looks per era', () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    for (const e of ERAS) expect(e.looks.length).toBeGreaterThanOrEqual(2);
  });

  it('draft every look for 500 random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 500; seed++) {
      const body = randomBody(rng(seed));
      for (const look of LOOKS) {
        try {
          const d = draftSkirt(body, look);
          const waist = 2 * (taggedLength(d.pieces[0].outline, 'waist') + taggedLength(d.pieces[1].outline, 'waist'));
          if (Math.abs(waist - (body.waist + FIT_EASE[look.fit].waist)) > 1) failures.push(`seed ${seed} ${look.id}: waist ${waist}`);
          if (!sewingGuide(d, look, 2).steps.length) failures.push(`seed ${seed} ${look.id}: no steps`);
        } catch (e) {
          failures.push(`seed ${seed} ${look.id}: ${(e as Error).message}`);
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

describe('circle skirts', () => {
  it('make the finished waist from a full and a half circle', () => {
    const full = draftSkirt(m, { silhouette: 'circle', length: 'knee' });
    const half = draftSkirt(m, { silhouette: 'half_circle', length: 'knee' });
    expect(full.circleShare).toBe(1);
    expect(half.circleShare).toBe(0.5);
    // Full circle hem: 2 pi (r + length), r = 72 / 2 pi.
    expect(full.hemCm).toBe(Math.round(72 + 2 * Math.PI * 58));
    expect(full.dartsPerSide).toEqual({ front: 0, back: 0 });
  });

  it('opens a half circle out when the hips need more room', () => {
    const curvy = { ...m, waist: 62, full_hip: 120, waist_to_hip: 18 };
    const d = draftSkirt(curvy, { silhouette: 'half_circle', length: 'knee' });
    expect(d.circleShare).toBeGreaterThan(0.5);
    // Room at the hip line, round the whole skirt, covers the hip plus ease.
    expect(2 * Math.PI * d.circleShare! * (64 / (2 * Math.PI * d.circleShare!) + 18)).toBeGreaterThanOrEqual(120 + 7);
  });

  it('gives a wide full circle front a centre seam instead of the fold', () => {
    const d = draftSkirt(m, { silhouette: 'circle', length: 'maxi' });
    expect(d.pieces[0].fold).toBeUndefined();
    expect(d.pieces[0].cut).toBe('Cut 2 (1 pair)');
    const steps = sewingGuide(d, { silhouette: 'circle', length: 'maxi' }, 4).steps.map((s) => s.title);
    expect(steps).toContain('Sew the centre front');
    expect(steps.some((t) => t.startsWith('Sew the') && t.endsWith('darts'))).toBe(false);
  });
});

describe('trumpet skirt', () => {
  it('flares below the knee and matches at the side seams', () => {
    const [front, back] = draftSkirt(m, { silhouette: 'trumpet', length: 'maxi' }).pieces;
    expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.05);
    const xs = front.outline.points().map((q) => q.x);
    expect(Math.max(...xs)).toBeGreaterThan(96 / 4 + 1 + 10);
  });

  it('refuses a mini that leaves no room to flare', () => {
    expect(() => draftSkirt({ ...m, waist_to_hip: 24, waist_to_knee: 52 }, { silhouette: 'trumpet', length: 'mini' })).toThrow(/longer length/);
  });
});
