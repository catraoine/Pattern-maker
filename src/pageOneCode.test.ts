import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY } from './measurements';
import { PAGE_MARGIN, layout, pageSize, textWidth } from './engine/export';

// Testers are told to print page 1 first, check the test square, and find their pattern code at the top of page 1. The
// code sat only at the end of the title line, which runs on across the sheets, so it printed on page 2 (pretend-tester
// walk, Nov 17). Page 1 of every tester piece's pattern now holds both the square and the whole code.
const IDS = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'];
const CODE = '1234-100-90-0-AB12';

describe('page 1 of the pattern', () => {
  for (const id of IDS)
    it(`${id}: the whole code beside the test square, Letter and A4`, () => {
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
      }
    });
});
