import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SweepDesign, randomDesign, sewDesign, sweepReport } from './drapeSweep';
import { rng } from './engine/randomBodies';
import { drapeQuality } from './engine/drape/quality';
import type { Draped } from './engine/drape/garment';
import type { Saved } from './savedWork';

// Designs whose All round drawing passed its quality check, and passed by eye (Cat's SS27 looks and the first sweep,
// 2026-11-02). They stay passing: an engine change that breaks one of them fails here, before it ships. Add each
// design that comes to pass, so the list only grows.
const LOCKED: [string, SweepDesign][] = [
  ['bias slip, midi (SS27 9C skirt)', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'slip', length: 'midi' } as Saved['choices'] }, fibre: 'silk' }],
  ['bias slip, above the knee, diagonal hem', { garment: 'skirt', saved: { choices: { fit: 'fitted', silhouette: 'slip', length: 'above_knee', asymHem: 'diagonal' } as Saved['choices'] }, fibre: 'wool' }],
  ['pencil skirt, knee', { garment: 'skirt', saved: { choices: { fit: 'fitted', silhouette: 'pencil', length: 'knee', asymHem: 'none' } as Saved['choices'] }, fibre: 'cotton' }],
  ['A-line mini, crisp (SS27 07 skirt)', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'a_line', length: 'mini' } as Saved['choices'] }, fibre: 'cotton', crisp: true }],
  ['boned strapless bodice', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'strapless', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'fitted', closure: 'back_zip', collar: 'none', structure: 'boned' } as Saved['bodice'] }, fibre: 'linen' }],
  ['cami top, hip length', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'regular', neckline: 'cami', length: 'hip', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'cap', closure: 'back_zip', collar: 'none' } as Saved['bodice'] }, fibre: 'cotton' }],
  ['square neck, long sleeves, keyhole back', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'square', length: 'hip', darts: 'bust_waist', sleeve: 'long', sleeveShape: 'straight', closure: 'back_zip', collar: 'none', back: 'keyhole' } as Saved['bodice'] }, fibre: 'cotton', crisp: true }],
  ['sleeveless shell (SS27 look B top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'crew', length: 'high_hip', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight' } as Saved['bodice'] }, fibre: 'silk' }],
  ['sleeveless A-line dress, natural waist', { garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee', asymHem: 'none' }, waistSeam: 'natural' } as Saved['dress'] }, fibre: 'cotton' }],
  ['sleeveless A-line dress, dropped waist', { garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee', asymHem: 'none' }, waistSeam: 'dropped' } as Saved['dress'] }, fibre: 'cotton' }],
  ['shirt, collar and long sleeves (SS27 9C top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', sleeveCuff: 'shirt', length: 'hip', darts: 'bust_waist' } as Saved['bodice'] }, fibre: 'cotton' }],
];

describe('All round drawings that passed stay passing', () => {
  it.each(LOCKED)('%s', (_, design) => {
    const x = sewDesign(design);
    expect(x.error).toBeUndefined();
    expect(x.quality?.problems ?? []).toEqual([]);
  }, 120_000);
});

describe('the quality check', () => {
  // A two-triangle cloth, cut as a 10 cm square.
  const square = (pos: number[]): Draped =>
    ({
      panels: [
        {
          pc: { name: 'Test', meta: {} },
          mesh: { pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], tris: [[0, 1, 2], [0, 2, 3]], runs: {}, side: [], darts: [] },
          base: 0,
          role: 'front',
          turned: [false, false, false, false],
          start: [],
          thick: [],
        },
      ],
      pos: Float64Array.from(pos),
      lines: [],
      buttons: [],
    }) as unknown as Draped;
  const sp = { bodyR: () => 0, tip: { c: -100, x: 10 } };
  it('passes cloth drawn as cut', () => {
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, 10, 10, 20, 0, 10, 20]), sp).ok).toBe(true);
  });
  it('fails a point flung off or not a number', () => {
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, NaN, 10, 20, 0, 10, 20]), sp).problems[0].check).toBe('broken');
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, 900, 10, 20, 0, 10, 20]), sp).problems[0].check).toBe('broken');
  });
  it('fails cloth stretched far past its cut', () => {
    expect(drapeQuality(square([0, 0, 20, 40, 0, 20, 40, 10, 20, 0, 10, 20]), sp).problems.map((p) => p.check)).toContain('stretched');
  });
  it('fails a seam drawn open', () => {
    const q = drapeQuality(square([0, 0, 20, 10, 0, 20, 10, 10, 20, 0, 10, 20]), sp, { seams: [{ i: 0, j: 1, k: 2, t: 0 }] });
    expect(q.problems.map((p) => p.check)).toEqual(['seam']);
  });
});

// The nightly sweep: DRAPE_SWEEP=<how many> sews that many random designs (seeded by DRAPE_SEED, by default the
// date) and writes the report to DRAPE_REPORT. It doesn't fail on what it finds: the report is the result.
const N = Number(process.env.DRAPE_SWEEP ?? 0);
describe.skipIf(!N)('All round sweep of random designs', () => {
  it(`sews ${N} random designs and reports the failures`, () => {
    const seed = Number(process.env.DRAPE_SEED ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const r = rng(seed);
    const results = Array.from({ length: N }, () => sewDesign(randomDesign(r)));
    const report = `Seed ${seed}\n\n${sweepReport(results, Number(process.env.DRAPE_LIST ?? 8))}`;
    writeFileSync(process.env.DRAPE_REPORT ?? 'drape-sweep.md', report);
    expect(results.length).toBe(N);
  }, 6 * 60 * 60_000);
});
