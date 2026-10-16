import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftTrousers } from './trousers';
import { checkPattern } from './qc';
import { withAllowances } from './allowances';
import { allSizes, gradeRun, gradedNest, gradedValues, rulesFor } from './grading';
import { layPlan } from './layplan';
import { markerDxf, markerPdf, panels } from './marker';
import { toDxf } from './dxf';
import { parseDxf } from './checkFile';
import { EXAMPLE_VALUES, MeasurementValues } from '../measurements';
import { Person, recordMeasurements } from '../account';

const skirt = (m: MeasurementValues) => draftSkirt(m as never, { silhouette: 'a_line' }).pieces.map((pc) => withAllowances(pc, 'home'));

describe('grading', () => {
  it('moves each measurement by its rule, scaled to the step', () => {
    const up = gradedValues(EXAMPLE_VALUES, 1);
    expect(up.waist).toBe(80);
    expect(up.full_hip).toBe(106);
    expect(up.neck).toBe(36);
    expect(gradedValues(EXAMPLE_VALUES, -2, 5).waist).toBe(66);
    expect(rulesFor({ waist: 70 }, 5)).toEqual([{ id: 'waist', perSize: 5 }]);
  });

  it('drafts every size, each passing the seam check, and nests them on their starting points', () => {
    for (const draft of [
      skirt,
      (m: MeasurementValues) => draftBodice(m as never, { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' } as never).pieces,
      (m: MeasurementValues) => draftTrousers(m as never, { leg: 'wide' }).pieces,
    ]) {
      const run = gradeRun(EXAMPLE_VALUES, draft, { down: 2, up: 3 });
      expect(run.map((s) => s.label)).toEqual(['-2', '-1', 'Base', '+1', '+2', '+3']);
      for (const s of run) {
        expect(s.error).toBeUndefined();
        const bad = checkPattern(s.pieces!, {}).filter((c) => !c.ok);
        expect(bad.map((c) => `${s.label} ${c.label} ${c.detail}`)).toEqual([]);
      }
      const nest = gradedNest(run);
      for (const n of nest) {
        expect(n.sizes).toHaveLength(6);
        // Lined up on the starting point, and growing size on size.
        expect(new Set(n.sizes.map((s) => `${s.pts[0].x.toFixed(3)},${s.pts[0].y.toFixed(3)}`)).size).toBe(1);
        const w = n.sizes.map((s) => Math.max(...s.pts.map((q) => q.x)) - Math.min(...s.pts.map((q) => q.x)));
        // Fly pieces stay one size; the garment's own pieces grow.
        if (!/^Fly/.test(n.name)) for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
      }
    }
  });

  it('keeps a size the block cannot draft, with its reason', () => {
    const run = gradeRun(EXAMPLE_VALUES, (m) => {
      if ((m.waist ?? 0) > 85) throw new Error('Too big for this block.');
      return skirt(m);
    }, { up: 3, down: 0 });
    expect(run.find((s) => s.label === '+3')?.error).toBe('Too big for this block.');
  });
});

describe('marker', () => {
  const run = gradeRun(EXAMPLE_VALUES, skirt, { down: 1, up: 1 });
  const pieces = allSizes(run);
  const lay = layPlan(pieces, 150)!;

  it('lays every size in one marker', () => {
    expect(pieces.map((pc) => pc.name)).toContain('Skirt front (+1)');
    expect(new Set(lay.placements.map((pl) => pl.name))).toEqual(new Set(pieces.map((pc) => pc.name)));
  });

  it('splits a long marker into panels that overlap', () => {
    expect(panels(300)).toEqual([[0, 300]]);
    expect(panels(1000)).toEqual([[0, 480], [478, 958], [956, 1000]]);
  });

  it('writes a plotter PDF and a DXF', async () => {
    const pdf = await markerPdf(lay, 'Skirt');
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    const dxf = markerDxf(lay, { style: 'Skirt', date: '2026-10-16' });
    expect(dxf.match(/POLYLINE/g)!.length).toBe(lay.placements.length + 1);
    expect(dxf).toContain(`Marker: 150 cm`);
  });

  it('marks each piece of a graded DXF with its size', () => {
    const dxf = toDxf(pieces, { style: 'Skirt', size: 'graded', date: '2026-10-16' });
    expect(dxf).toContain('Size: +1');
    expect(parseDxf(dxf)).toHaveLength(pieces.length);
  });
});

describe('client book', () => {
  const person: Person = { id: 'me', name: '', values: { waist: 70 }, named: true };
  it('keeps measurements by date, replacing the same day and skipping no change', () => {
    let p = recordMeasurements(person, '2026-10-01');
    expect(p.history).toEqual([{ date: '2026-10-01', values: { waist: 70 } }]);
    expect(recordMeasurements(p, '2026-10-02')).toBe(p);
    p = recordMeasurements({ ...p, values: { waist: 71 } }, '2026-10-01');
    expect(p.history).toHaveLength(1);
    p = recordMeasurements({ ...p, values: { waist: 72 } }, '2026-10-09');
    expect(p.history!.map((h) => h.values.waist)).toEqual([71, 72]);
  });
});
