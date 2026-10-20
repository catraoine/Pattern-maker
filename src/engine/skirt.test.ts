import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { bounds } from './piece';
import { draftSkirt } from './skirt';
import { layout, tileGrid, toSvg } from './export';
import { toTiledPdf } from './pdf';
import { sewingGuide } from './instructions';

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
    // -2.96 rather than the prototype's -2.85: the waist now eases onto the trued dart legs and meets
    // the side seam square, so the seam allowance corner at the side sits a little higher.
    expect(b).toEqual([0, -2.96, 26.5, 62]);
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

  it('sizes the waistband to the finished waist, and marks the zip', () => {
    const draft = draftSkirt(m);
    const band = draft.waistband;
    expect(band.cutLength).toBeCloseTo(draft.finishedWaist + 3, 5);
    expect(band.cutWidth).toBe(9);
    expect(band.sideMark).toBeCloseTo(1.5 + (m.waist + 2) / 4 - 0.5, 1);
    expect(draft.zipCm).toBe(20);
    expect(draft.pieces[1].labels.some((l) => l.text === 'ZIP ENDS')).toBe(true);
  });

  it('adds sewing steps to the PDF', async () => {
    const draft = draftSkirt(m, { silhouette: 'pencil' });
    const guide = sewingGuide(draft, { silhouette: 'pencil', length: 'knee' }, 1.4);
    expect(guide.steps.map((st) => st.text).join(' ')).toMatch(/walking slit/);
    expect(guide.notions).toContain('20 cm invisible zip');
    const sheet = layout(draft.pieces, 'Test skirt', []);
    const plain = await toTiledPdf(sheet, 'a4');
    const withSteps = await toTiledPdf(sheet, 'a4', { title: 'knee pencil skirt', guide });
    expect(withSteps.length).toBeGreaterThan(plain.length);
  });

  it('turns up a narrow hem on a flared skirt, and keeps the deep hem on a straight or pencil one', () => {
    const hemOf = (silhouette: 'straight' | 'pencil' | 'a_line' | 'trumpet', flareCm?: number) => {
      const draft = draftSkirt(m, { silhouette, length: 'knee', flareCm });
      const text = sewingGuide(draft, { silhouette, length: 'knee' }, 1.4).steps.find((s) => s.title === 'Hem')!.text;
      return { sa: draft.pieces.map((pc) => pc.allowances.hem), text };
    };
    for (const sil of ['straight', 'pencil'] as const) {
      const h = hemOf(sil);
      expect(h.sa).toEqual([4, 4]);
      expect(h.text).toMatch(/^Press up 1 cm, then 3 cm more/);
    }
    // The A-line's hem is about 128 cm round on a 96 cm hip: a 4 cm turn-up would ripple.
    const aLine = hemOf('a_line');
    expect(aLine.sa).toEqual([2, 2]);
    expect(aLine.text).toMatch(/^Press up 1 cm, then 1 cm more/);
    expect(hemOf('trumpet').sa).toEqual([2, 2]);
    // A straight skirt dragged out into a flare gets the narrow hem too.
    expect(hemOf('straight', 6).sa).toEqual([2, 2]);
  });
});
