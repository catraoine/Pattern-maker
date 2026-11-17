import { PDFPage, type PDFFont } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { EXAMPLE_BODY } from './measurements';
import { printedPattern } from './patternSweep';
import { layout } from './engine/export';
import { toTiledPdf } from './engine/pdf';

// A shift tester on a Mac, Nov 17: in inches, "1⅝ yd", "21⅝ in invisible zip" and "⅝ in at the neck" printed as empty
// boxes, because the text face has no fraction characters. Every character drawn into the PDF must be one its face has.
const TESTER = [/Blush Shift/, /Ice Peplum/, /pleat/i, /Barrel/, /Black Vest/];

describe('inch PDFs print every character', () => {
  afterEach(() => vi.restoreAllMocks());
  for (const look of COLLECTION.filter((l) => TESTER.some((r) => r.test(l.name)))) {
    it(`${look.name}: pattern and instructions booklet, Letter`, async () => {
      const { garment, ...saved } = lookPatch(look, EXAMPLE_BODY);
      const { made } = printedPattern({ garment, saved: saved as never }, EXAMPLE_BODY);
      const sheet = layout(made.pieces, `Maison Tracé: ${look.name}`, made.notes, { pattern: look.name });
      const summary = { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks: [], flat: made.flat, fabric: made.guide.fabric, lays: made.lays };
      const missing = new Set<string>();
      let drawn = '';
      const real = PDFPage.prototype.drawText;
      vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: { font?: PDFFont }) {
        if (o?.font) {
          const has = new Set(o.font.getCharacterSet());
          for (const c of text) if (!has.has(c.codePointAt(0)!) && c !== ' ' && c !== '\n') missing.add(`${c} in "${text}"`);
        }
        drawn += text + '\n';
        return real.call(this, text, o as never);
      });
      await toTiledPdf(sheet, 'letter', { title: look.name, unit: 'in', part: 'pattern' });
      await toTiledPdf(sheet, 'letter', { title: look.name, guide: made.guide, summary, unit: 'in', part: 'booklet' });
      expect([...missing]).toEqual([]);
      // Whole and part are joined the envelope way, "1-1/4 yd": with a space this face read as "11/4 yd".
      expect(drawn).toMatch(/\d-\d\/[248] (in|yd)/);
      expect(drawn).not.toMatch(/\d \d\/\d/);
      // Each length is rewritten in inches once: the test square line read "(3.94 in) (3.94 in)".
      expect(drawn).not.toMatch(/\(3\.94 in\)\s*\(3\.94 in\)/);
      // No length is left in centimetres except the test square, which keeps both.
      expect(drawn.replace(/10 CM · 3\.94 IN|10 cm \(3\.94 in\)/g, '')).not.toMatch(/\d\s*(cm|CM)\b/);
      if (/exactly 10 cm/.test(drawn)) expect(drawn).toMatch(/exactly 10 cm \(3\.94 in\)/);
    });
  }
});
