import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { HEM_SAMPLES, flatHem, matchSides } from './hem';
import { bounds } from './piece';
import { draftSkirt, flareRange, lengthRange } from './skirt';
import { checkPattern } from './qc';
import { layout, toSvg } from './export';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const ramp = (centre: number, side: number) => Array.from({ length: HEM_SAMPLES }, (_, i) => centre + ((side - centre) * i) / (HEM_SAMPLES - 1));

describe('dragged length and flare', () => {
  it('uses a dragged length, kept between the hip and the floor', () => {
    expect(draftSkirt(m, { lengthCm: 70 }).lengthCm).toBe(70);
    expect(draftSkirt(m, { lengthCm: 5 }).lengthCm).toBe(lengthRange(m).min);
    expect(draftSkirt(m, { lengthCm: 300 }).lengthCm).toBe(lengthRange(m).max);
  });

  it('lets a dragged length win over a photo-matched one', () => {
    const shape = { hemAt: 0.5, hemFullness: 1.4 };
    expect(draftSkirt(m, { shape }).lengthCm).toBe(52);
    expect(draftSkirt(m, { shape, lengthCm: 70 }).lengthCm).toBe(70);
  });

  it('uses a dragged flare, within range, with matching side seams', () => {
    for (const flareCm of [-4, -1, 0, 3, 12, 99]) {
      const d = draftSkirt(m, { silhouette: 'a_line', flareCm });
      const { min, max } = flareRange(m, d.lengthCm, 'a_line');
      expect(d.flareCm).toBeGreaterThanOrEqual(min - 0.05);
      expect(d.flareCm).toBeLessThanOrEqual(max + 0.05);
      const [front, back] = d.pieces;
      expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.05);
    }
  });

  it('flares wider as the side seam is dragged out', () => {
    const narrow = draftSkirt(m, { silhouette: 'a_line', flareCm: 2 });
    const wide = draftSkirt(m, { silhouette: 'a_line', flareCm: 14 });
    expect(wide.hemCm).toBeGreaterThan(narrow.hemCm + 30);
  });
});

describe('drawn hems', () => {
  it('brings front and back to the same height at the sides', () => {
    const h = matchSides({ front: ramp(0, -6), back: ramp(10, 4) });
    expect(h.front[HEM_SAMPLES - 1]).toBeCloseTo(h.back[HEM_SAMPLES - 1]);
    expect(h.front[0]).toBe(0);
    expect(h.back[0]).toBe(10);
  });

  it.each(['straight', 'a_line', 'trumpet', 'half_circle', 'circle'] as const)('makes a high-low hem (%s)', (silhouette) => {
    const plain = draftSkirt(m, { silhouette, length: 'knee' });
    const d = draftSkirt(m, { silhouette, length: 'knee', hem: { front: ramp(-8, 0), back: ramp(12, 0) } });
    const [front, back] = d.pieces;
    const depth = (pc: (typeof d.pieces)[0]) => bounds(pc)[3];
    expect(depth(front)).toBeLessThan(depth(plain.pieces[0]) + 1);
    expect(depth(back)).toBeGreaterThan(depth(plain.pieces[1]) + 8);
    // The side seams still sew together.
    expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.3);
    // A curved hem turns up narrowly, and the pattern still exports.
    expect(front.allowances.hem).toBeLessThanOrEqual(1.5);
    expect(toSvg(layout(d.pieces, 't', []))).toContain('<polygon');
  });

  it.each(['straight', 'a_line', 'circle'] as const)('keeps a drawn hem square at the centres and smooth over the side seam (%s)', (silhouette) => {
    for (const hem of [{ front: ramp(-8, 0), back: ramp(12, 0) }, { front: ramp(6, -3), back: ramp(-4, -3) }]) {
      const d = draftSkirt(m, { silhouette, length: 'knee', hem });
      const bad = checkPattern(d.pieces.filter((pc) => !pc.kind), { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
      expect(bad.map((c) => `${c.label}: ${c.detail}`)).toEqual([]);
    }
  });

  it('never takes the hem above the hip or below the floor', () => {
    const d = draftSkirt(m, { length: 'knee', hem: { front: ramp(-80, -80), back: ramp(200, 200) } });
    for (const v of [...d.hem!.front, ...d.hem!.back]) {
      expect(d.lengthCm + v).toBeGreaterThanOrEqual(m.waist_to_hip + 5 - 1e-9);
      expect(d.lengthCm + v).toBeLessThanOrEqual(m.waist_to_floor - 1 + 1e-9);
    }
  });

  it('ignores a hem that was drawn flat', () => {
    expect(draftSkirt(m, { hem: { front: flatHem(), back: flatHem() } }).hem).toBeUndefined();
  });
});
