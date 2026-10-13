import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { bounds } from './piece';
import { draftSkirt } from './skirt';
import { layout, tileGrid, toSvg } from './export';
import { toTiledPdf } from './pdf';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
// Same ease as the Python prototype's defaults, so the numbers can be compared directly.
const pythonEase = { fit: 'fitted' as const };

describe('skirt block', () => {
  it('matches the Python prototype for the example body', () => {
    // Python: fitted-equivalent ease 4 / 1 -> darts 1.92 x2 front, 2.42 x2 back, side 2.9
    const { pieces } = draftSkirt(m, { ...pythonEase, silhouette: 'straight', length: 'knee' });
    const [front, back] = pieces;
    expect(front.meta.dartsCm).toEqual([1.92, 1.92]);
    expect(back.meta.dartsCm).toEqual([2.42, 2.42]);
    expect(front.meta.sideSuppressionCm).toBe(2.9);
    const b = bounds(front).map((v) => Math.round(v * 100) / 100);
    expect(b).toEqual([0, -2.85, 26.5, 62]);
  });

  it.each(['straight', 'a_line', 'pencil'] as const)('front and back side seams match (%s)', (silhouette) => {
    for (const length of ['mini', 'knee', 'maxi'] as const) {
      const [front, back] = draftSkirt(m, { silhouette, length }).pieces;
      expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.05);
    }
  });

  it('refuses a waist larger than the hip', () => {
    expect(() => draftSkirt({ ...m, waist: 110 })).toThrow(/waist is larger/);
  });

  it('exports SVG and a tiled PDF', async () => {
    const draft = draftSkirt(m);
    const sheet = layout(draft.pieces, 'Test skirt', ['note']);
    expect(toSvg(sheet)).toContain('<polygon');
    const grid = tileGrid(sheet, 'a4');
    const pdf = await toTiledPdf(sheet, 'a4');
    expect(pdf.length).toBeGreaterThan(1000);
    expect(grid.rows * grid.cols).toBeGreaterThan(1);
  });
});
