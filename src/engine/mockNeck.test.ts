import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { bodiceGuide } from './instructions';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { HEAD_CM, MOCK_NECK_CM, NECKBAND_MAX_STRETCH, draftTee } from './tee';
import { teeGuide } from './teeGuide';

const collarOf = (pcs: ReturnType<typeof draftBodice>['pieces']) => pcs.find((pc) => pc.kind === 'collar')!;
const height = (pc: ReturnType<typeof collarOf>) => {
  const ys = pc.outline.points(4).map((q) => q.y);
  return Math.max(...ys) - Math.min(...ys);
};

describe('mock and funnel necks', () => {
  it('a mock neck hugs the neck and a funnel stands away from it, both on the bodice’s neckline', () => {
    const b = randomBody(rng(4));
    const mock = collarOf(draftBodice(b, { fit: 'regular', collar: 'mock' }).pieces);
    const funnel = collarOf(draftBodice(b, { fit: 'regular', collar: 'funnel' }).pieces);
    const mandarin = collarOf(draftBodice(b, { fit: 'regular', collar: 'mandarin' }).pieces);
    // Same neck edge as the mandarin: half the neckline as sewn.
    expect(taggedLength(mock.outline, 'neck')).toBeCloseTo(taggedLength(mandarin.outline, 'neck'), 5);
    expect(taggedLength(funnel.outline, 'neck')).toBeCloseTo(taggedLength(mandarin.outline, 'neck'), 5);
    // The top edge: shorter than the neck on a mock neck, longer on a funnel.
    expect(taggedLength(mock.outline, 'collar')).toBeLessThan(taggedLength(mock.outline, 'neck') - 0.5);
    expect(taggedLength(funnel.outline, 'collar')).toBeGreaterThan(taggedLength(funnel.outline, 'neck') + 0.5);
    expect(height(mock)).toBeGreaterThan(height(mandarin) + 2);
    expect(mock.meta.band).toBe('mock');
  });

  it('goes on a dress, and the band finishes the neck with no binding', () => {
    for (let s = 1; s <= 20; s++) {
      for (const collar of ['mock', 'funnel'] as const) {
        const d = draftDress(randomBody(rng(s)), { fit: 'regular', collar }, { silhouette: 'a_line', length: 'knee' });
        expect(d.bodice.collar).toBe(collar);
        const bad = checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar'), { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
        expect(bad.map((c) => `${s} ${collar}: ${c.label} ${c.detail}`)).toEqual([]);
      }
    }
    const g = bodiceGuide(draftBodice(randomBody(rng(2)), { fit: 'regular', collar: 'mock' }), { length: 'waist' }, 1.5, 1, { edges: 'binding' });
    const titles = g.steps.map((s) => s.title);
    expect(titles).toContain('Attach the collar');
    expect(titles).not.toContain('Bind the neckline');
  });

  it('the tee’s mock neck: a tall band that still passes over the head', () => {
    const armed = (seed: number) => {
      const r = rng(seed);
      const b = randomBody(r);
      return { ...b, ...randomArms(b, r) };
    };
    for (let s = 1; s <= 30; s++) {
      const b = armed(s);
      const d = draftTee(b, { fit: 'regular', stretch: 'medium', neckline: 'mock', sleeve: 'long', length: 'hip' });
      const band = d.pieces.find((pc) => pc.name === 'Mock neck')!;
      expect(band).toBeDefined();
      expect(d.neckband.width).toBe(MOCK_NECK_CM);
      expect(d.neckband.length).toBeGreaterThanOrEqual(Math.min(d.necklineCm, HEAD_CM / (1 + NECKBAND_MAX_STRETCH)) - 0.1);
      expect(d.neckband.length).toBeLessThanOrEqual(d.necklineCm);
      const crew = draftTee(b, { fit: 'regular', stretch: 'medium', neckline: 'crew', sleeve: 'long', length: 'hip' });
      expect(d.neckband.ratio).toBeGreaterThanOrEqual(crew.neckband.ratio);
    }
    const g = teeGuide(draftTee(armed(1), { fit: 'regular', stretch: 'medium', neckline: 'mock', sleeve: 'long', length: 'hip' }), 1.6);
    expect(g.notions.some((n) => /^Mock neck: .* 6 cm tall/.test(n))).toBe(true);
    expect(g.steps.find((s) => s.title === 'Make the neckband')!.text).toMatch(/over your head/);
  });
});
