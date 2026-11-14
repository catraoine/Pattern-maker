import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { sewingGuide } from './instructions';
import { checkPattern } from './qc';
import { taggedLength } from './geometry';
import { randomBody, rng } from './randomBodies';
import { EXAMPLE_VALUES } from '../measurements';
import { optionDesigns, sewDesign } from '../drapeSweep';

const m = EXAMPLE_VALUES as Parameters<typeof draftSkirt>[0];
const names = (d: ReturnType<typeof draftSkirt>) => d.pieces.map((pc) => pc.name);

// A trumpet in two pieces on the fold could only flare at its side seams: in CLO the flare kicked out at the sides and
// the front and back hung flat (dress 36, Nov 12). Cut in six panels, every seam takes its share.
describe('six-panel trumpet', () => {
  it('cuts a centre and a side panel front and back, the panel seams matching and each flaring', () => {
    for (const length of ['knee', 'midi', 'maxi'] as const) {
      const d = draftSkirt(m, { silhouette: 'trumpet', length });
      expect(names(d)).toEqual(['Skirt front', 'Skirt back', 'Skirt side front', 'Skirt side back']);
      for (const [c, s] of [
        [d.pieces[0], d.pieces[2]],
        [d.pieces[1], d.pieces[3]],
      ]) {
        expect(Math.abs(taggedLength(c.outline, 'gore') - taggedLength(s.outline, 'gore'))).toBeLessThan(0.05);
        expect(c.meta.goreSeam).toBe(s.name);
        // Each side of the panel seam swings out a good few cm at the hem, as the side seam does.
        expect(c.meta.goreFlareCm as number).toBeGreaterThan(1.5);
        const xs = c.outline.points().map((q) => q.x);
        const seamTop = (c.meta.trumpetQuarter as { slash: { x: number }[] }).slash[0].x;
        expect(Math.max(...xs) - seamTop).toBeGreaterThan(1.5);
      }
      expect(d.pieces[2].cut).toBe('Cut 2 (1 pair)');
      expect(d.pieces[0].fold).toBeDefined();
    }
  });

  it('keeps the hem round of the two-piece trumpet it replaces, within a tenth', () => {
    for (const length of ['knee', 'midi', 'maxi'] as const) {
      const panels = draftSkirt(m, { silhouette: 'trumpet', length });
      const two = draftSkirt(m, { silhouette: 'trumpet', length, zip: 'side' });
      const round = (d: typeof panels) => 2 * d.pieces.reduce((t, pc) => t + taggedLength(pc.outline, 'hem'), 0);
      // (A knee-length trumpet comes out about 8% fuller: in two pieces its short flare was held back by the side seam's
      // steepest angle, which three seams sharing it no longer reach.)
      expect(Math.abs(round(panels) - round(two)) / round(two)).toBeLessThan(0.1);
      expect(Math.abs(panels.hemCm - round(panels))).toBeLessThan(3);
    }
  });

  it('passes every pattern check on random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const body = randomBody(rng(seed)) as unknown as Parameters<typeof draftSkirt>[0];
      for (const length of ['knee', 'maxi'] as const) {
        const d = draftSkirt(body, { silhouette: 'trumpet', length });
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${length}: ${c.label} ${c.detail}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('stays in two pieces where nothing is drafted for panels yet: a side zip, or a waist as big as the hip', () => {
    expect(names(draftSkirt(m, { silhouette: 'trumpet', length: 'knee', zip: 'side' }))).toEqual(['Skirt front', 'Skirt back']);
    expect(draftSkirt({ ...m, waist: 110 }, { silhouette: 'trumpet', length: 'knee' }).pieces.filter((pc) => !pc.kind).length).toBe(2);
  });

  it('says to cut the side panels as pairs and sew the panel seams before the side seams, with one dart fewer a quarter', () => {
    const plain = draftSkirt(m, { silhouette: 'pencil', length: 'knee' });
    const d = draftSkirt(m, { silhouette: 'trumpet', length: 'knee' });
    expect(d.dartsPerSide.front + d.dartsPerSide.back).toBe(plain.dartsPerSide.front + plain.dartsPerSide.back - 2);
    const g = sewingGuide(d, { silhouette: 'trumpet', length: 'knee' }, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles.indexOf('Sew the panel seams')).toBeGreaterThan(0);
    expect(titles.indexOf('Sew the panel seams')).toBeLessThan(titles.indexOf('Sew the side seams'));
    expect(g.steps.find((s) => s.title === 'Cut out')!.text).toMatch(/skirt side front and the skirt side back twice each/);
  });

  it('draws the trumpet dress in All round without problems', () => {
    const o = optionDesigns().find((x) => x.key === 'dress skirt.silhouette=trumpet')!;
    expect(sewDesign(o.design).quality?.problems ?? []).toEqual([]);
  }, 240_000);
});
