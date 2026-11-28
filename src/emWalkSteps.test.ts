import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { stepLines } from './engine/stepLines';
import { EXAMPLE_VALUES } from './measurements';

// The pretend-tester walk on release EM (Nov 28) ticked down the Blush Shift's and Black Pleated Skirt's steps.
function steps(id: string) {
  const look = COLLECTION.find((l) => l.id === id)!;
  const values = withEstimates(EXAMPLE_VALUES);
  const { garment, ...next } = lookPatch(look, values);
  const fabric = lookFabric(look.fabric);
  const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
  const saved = { ...INITIAL, ...next, garment, finish } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
  const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
  const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) });
  return print!.guide.steps;
}

describe('the EM walk steps', () => {
  // Its first tick box said "Sew the 60 cm invisible zip into the centre back edges", and only then to press the coils
  // and lay the tapes: ticking down, the zip went in before it was ready.
  for (const id of ['blush-shift', 'black-pleated-skirt'])
    it(`${id}: the zip step says where the zip goes before it says to sew`, () => {
      const zip = steps(id).find((st) => /^Put in the zip$/.test(st.title))!;
      const lines = stepLines(zip.text);
      expect(lines[0]).toMatch(/invisible zip goes into the centre back edges/);
      expect(lines[0]).not.toMatch(/^Sew\b/);
      expect(lines.findIndex((l) => /press its coils/.test(l))).toBeLessThan(lines.findIndex((l) => /sew close beside them/.test(l)));
    });

  // "Clip into the seam allowance just above the hem's depth" didn't say how far up.
  it('black-pleated-skirt: the hem says how far up to clip', () => {
    const hem = steps('black-pleated-skirt').find((st) => /^Hem the skirt$/.test(st.title))!;
    expect(hem.text).toMatch(/clip into the seam allowance [\d.]+ cm up from the bottom edge/);
  });
});
