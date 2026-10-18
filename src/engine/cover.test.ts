import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { layout, pageCount } from './export';
import { skirtFlat } from './flat';
import { toTiledPdf } from './pdf';
import { draftSkirt } from './skirt';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

// The envelope cover (Cat's pick with D1, 2026-10-18) is page 1 when there's a flat to draw on it.
describe('envelope cover', () => {
  it('goes before the pattern pages, and only with a flat', async () => {
    const draft = draftSkirt(m);
    const sheet = layout(draft.pieces, 'Knee a-line skirt', []);
    const tiles = pageCount(sheet, 'a4');
    const plain = await PDFDocument.load(await toTiledPdf(sheet, 'a4', { title: 'knee a-line skirt', summary: { rows: [], checks: [] } }));
    const bytes = await toTiledPdf(sheet, 'a4', { title: 'knee a-line skirt', summary: { rows: [], checks: [], madeFor: 'Me', flat: skirtFlat(draft) } });
    const covered = await PDFDocument.load(bytes);
    expect(covered.getPageCount()).toBe(plain.getPageCount() + 1);
    // The cover is A4 portrait; the first pattern page follows it.
    const [w, h] = [covered.getPage(0).getWidth(), covered.getPage(0).getHeight()];
    expect(h).toBeGreaterThan(w);
    expect(plain.getPageCount()).toBeGreaterThan(tiles);
  });
});
