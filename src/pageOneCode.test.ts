import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY } from './measurements';
import { OVERLAP, PAGE_MARGIN, TEST_SQUARE_X, layout, pageSize, textWidth } from './engine/export';

// The tester email says the pattern code is at the top of page 1 and the test square on page 2. The code sat only at the
// end of the title line, which runs on across the sheets, so it printed on page 2, and the square was on page 1
// (pretend-tester walk, Nov 17). Rather than email every tester a correction (Cat, Nov 18), the PDF now matches the
// email: the whole code on page 1, the whole square on page 2 and none of it on page 1.
const IDS = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'];
const CODE = '1234-100-90-0-AB12';

describe('pages 1 and 2 of the pattern', () => {
  for (const id of IDS)
    it(`${id}: the whole code on page 1, the test square on page 2, Letter and A4`, () => {
      const look = COLLECTION.find((l) => l.id === id)!;
      const values = withEstimates(EXAMPLE_BODY);
      const { garment, ...next } = lookPatch(look, values);
      const fabric = lookFabric(look.fabric);
      const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
      const saved = { ...INITIAL, ...next, garment, finish } as Saved;
      const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
      const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
      const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) })!;
      const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Me', code: CODE });
      // The title card (x 31 to 59, y 3 to 13) holds its whole text: every line written from its left edge ends inside it.
      for (const pr of sheet.prims)
        if (pr.kind === 'text' && pr.piece === undefined && Math.abs(pr.at.x - 32.2) < 0.01) {
          expect(pr.at.x + textWidth(pr.text, pr.size, pr.tracking ?? 0), pr.text).toBeLessThanOrEqual(59);
          expect(pr.at.y, pr.text).toBeLessThanOrEqual(13);
        }
      // Page 1 is the sheet's top-left tile: whatever lies wholly inside it prints there whole.
      for (const paper of ['letter', 'a4'] as const) {
        const [pw, ph] = pageSize(sheet, paper);
        const room = { w: pw - 2 * PAGE_MARGIN, h: ph - 2 * PAGE_MARGIN };
        const whole = sheet.prims.filter((pr) => {
          if (pr.kind !== 'text' || !pr.text.includes(`CODE ${CODE}`)) return false;
          const w = textWidth(pr.text, pr.size, pr.tracking ?? 0);
          const x0 = pr.anchor === 'middle' ? pr.at.x - w / 2 : pr.at.x;
          return x0 >= 0 && x0 + w <= room.w && pr.at.y <= room.h;
        });
        expect(whole.length, paper).toBeGreaterThan(0);
        // Page 2 is the next tile to the right: it starts one step (the page less its overlap) along the sheet.
        const step = room.w - OVERLAP;
        const square = sheet.prims.filter((pr) => pr.kind === 'poly' && pr.style === 'stitchSolid' && pr.closed && pr.pts.length === 4 && pr.piece === undefined && Math.abs(Math.min(...pr.pts.map((q) => q.x)) - TEST_SQUARE_X) < 1e-6);
        expect(square.length, paper).toBe(1);
        const xs = square[0].kind === 'poly' ? square[0].pts.map((q) => q.x) : [];
        const ys = square[0].kind === 'poly' ? square[0].pts.map((q) => q.y) : [];
        expect(Math.max(...xs) - Math.min(...xs), paper).toBeCloseTo(10, 6);
        expect(Math.min(...xs), `${paper}: clear of page 1`).toBeGreaterThan(room.w);
        expect(Math.min(...xs), `${paper}: inside page 2`).toBeGreaterThanOrEqual(step);
        expect(Math.max(...xs), `${paper}: inside page 2`).toBeLessThanOrEqual(step + room.w);
        expect(Math.max(...ys), `${paper}: top row`).toBeLessThanOrEqual(room.h);
      }
    });
});
