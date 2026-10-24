import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { sewingGuide } from './instructions';
import { waistPieces } from './finishing';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { skirtFlat } from './flat';
import { skirtSpec } from './spec';
import { len, sub } from './geometry';
import { ringOf } from './manipulate';
import { HIGH, facedAllowed, highAllowed, sideZipAllowed } from './skirtWaist';
import { describePattern } from '../screens/describe';
import type { Piece } from './piece';

const ascii = (g: { steps: { title: string; text: string }[] }) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text));
/** The length of a piece's edges tagged `tag`. */
const edge = (pc: Piece, tag: string) => {
  const r = ringOf(pc.outline);
  return r.pts.reduce((t, q, i) => (r.tags[i] === tag ? t + len(sub(r.pts[(i + 1) % r.pts.length], q)) : t), 0);
};
const zipEnds = (pc: Piece) => pc.labels.filter((l) => l.text === 'ZIP ENDS').length;

describe('skirt waist: faced, high, side zip', () => {
  it('drafts a faced or high waist and a side zip on 30 random bodies, every seam matching and the facings fitting', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 30; s++) {
      const m = randomBody(rng(s));
      const silhouette = (['pencil', 'straight', 'a_line', 'trumpet'] as const)[s % 4];
      const length = (['knee', 'midi', 'mini'] as const)[s % 3];
      for (const waist of ['faced', 'high'] as const) {
        for (const zip of ['back', 'side'] as const) {
          const d = draftSkirt(m, { silhouette, length, waist, zip });
          expect(d.waistFinish).toBe(waist);
          const [front, back] = d.pieces;
          if (zip === 'side') {
            expect(d.opening).toBe('left_side');
            expect(zipEnds(front) + zipEnds(back)).toBe(2);
            // The back is cut on the fold unless a back slit keeps its seam.
            if (d.slit?.at !== 'back') expect(back.fold).toBeTruthy();
          }
          for (const c of checkPattern(d.pieces.filter((pc) => !pc.kind), { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${s} ${silhouette} ${waist} ${zip}: ${c.label} ${c.detail}`);
          // The facings' top edges, doubled where cut on the fold, go round the skirt's top.
          const facings = waistPieces(d, 1.5);
          expect(facings.map((f) => f.name)).toEqual(['Front waist facing', 'Back waist facing']);
          const tag = waist === 'high' ? 'top' : 'waist';
          const round = 2 * facings.reduce((t, f) => t + edge(f, tag), 0);
          if (waist === 'faced') expect(Math.abs(round - d.finishedWaist)).toBeLessThan(1);
          else {
            expect(round).toBeGreaterThan(d.finishedWaist);
            expect(round).toBeLessThan(d.finishedWaist + 8);
            expect(d.pieces[0].balance?.some((b) => b.label === 'WAIST')).toBe(true);
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('keeps the band where the skirt cannot take a facing, a high waist or a side zip', () => {
    const m = randomBody(rng(3));
    expect(facedAllowed({ silhouette: 'gathered' })).toBe(false);
    expect(facedAllowed({ silhouette: 'circle' })).toBe(true);
    expect(highAllowed({ silhouette: 'circle' })).toBe(false);
    expect(highAllowed({ silhouette: 'a_line', pleats: 'knife' })).toBe(false);
    expect(sideZipAllowed({ silhouette: 'a_line', pockets: 'inseam' })).toBe(false);
    expect(draftSkirt(m, { silhouette: 'gathered', length: 'knee', waist: 'faced' }).waistFinish).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'circle', length: 'knee', waist: 'high' }).waistFinish).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'a_line', length: 'knee', zip: 'side', pockets: 'inseam' }).opening).toBeUndefined();
    // A high waist's zip runs on up past the waist.
    const band = draftSkirt(m, { silhouette: 'a_line', length: 'knee' });
    expect(draftSkirt(m, { silhouette: 'a_line', length: 'knee', waist: 'high' }).zipCm).toBe(band.zipCm + HIGH.rise);
  });

  it('is sewn with facings, its darts running up, and the zip at the side; drawn, named and measured', () => {
    const m = randomBody(rng(7));
    for (const waist of [undefined, 'faced', 'high'] as const) {
      for (const zip of ['back', 'side'] as const) {
        if (!waist && zip === 'back') continue;
        const style = { silhouette: 'a_line' as const, length: 'knee' as const, waist, zip };
        const d = draftSkirt(m, style);
        for (const lined of [false, true]) {
          const g = sewingGuide(d, style, 1.5, lined ? { liningM: 1 } : {});
          const titles = g.steps.map((st) => st.title);
          const text = g.steps.map((st) => st.text).join(' ');
          expect(titles).toEqual([...new Set(titles)]);
          expect(ascii(g)).toEqual([]);
          if (waist) {
            expect(titles).toContain('Face the waist');
            expect(titles).not.toContain('Attach the waistband');
            expect(text).not.toMatch(/waistband/);
          } else expect(titles).toContain('Attach the waistband');
          if (waist === 'high') expect(text).toMatch(/diamond/);
          if (zip === 'side') {
            expect(text).toMatch(/left side seam edges/);
            expect(titles).not.toContain('Close the centre back');
          } else expect(text).toMatch(/centre back edges/);
        }
        const flat = skirtFlat(d);
        expect(flat.views[0].lines.some((l) => l.kind === 'zip')).toBe(zip === 'side');
        expect(flat.views[1].lines.some((l) => l.kind === 'zip')).toBe(zip === 'back');
        const rows = skirtSpec(m, d).map((r) => r.label);
        expect(rows).toContain(zip === 'side' ? 'Invisible zip, left side seam' : 'Invisible zip, centre back');
        if (waist) expect(rows.some((r) => /Waist facing/.test(r))).toBe(true);
      }
    }
    expect(describePattern({ fit: 'regular', silhouette: 'a_line', length: 'knee', waist: 'high' } as never)).toMatch(/high-waisted/i);
  });
});
