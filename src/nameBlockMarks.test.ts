import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY, type MeasurementValues } from './measurements';
import { layout, textWidth } from './engine/export';

// The Ice Peplum's finished-waist bullseye printed through the middle of the peplum front's name block, on a tester's
// own measurements (pretend-tester walk, Nov 17). A piece's name and cutting lines keep clear of its bullseyes.
const IN = 2.54;
const BODIES: Record<string, MeasurementValues> = {
  sample: EXAMPLE_BODY,
  'hand-measured': { ...EXAMPLE_BODY, height: 165, full_bust: 46 * IN, high_bust: 42 * IN, underbust: 37 * IN, waist: 39 * IN, nape_to_waist: 17.5 * IN, front_hps_to_waist: 21 * IN, bust_depth: 12 * IN, apex_separation: 10 * IN, full_hip: 44 * IN, waist_to_hip: 20 },
};
const IDS = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'];

describe('the name blocks keep off the finished-measurement marks', () => {
  for (const id of IDS)
    for (const [bodyName, body] of Object.entries(BODIES))
      it(`${id}, ${bodyName}`, () => {
        const look = COLLECTION.find((l) => l.id === id)!;
        const values = withEstimates(body);
        const { garment, ...next } = lookPatch(look, values);
        const fabric = lookFabric(look.fabric);
        const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
        const saved = { ...INITIAL, ...next, garment, finish } as Saved;
        const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
        const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
        const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) })!;
        const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Me' });
        // A bullseye is the 25-point ring of radius 0.5 cm; its cross reaches 0.75 cm.
        const centres = sheet.prims.flatMap((pr) => (pr.kind === 'poly' && pr.pts.length === 25 ? [{ x: (pr.pts[0].x + pr.pts[12].x) / 2, y: (pr.pts[0].y + pr.pts[12].y) / 2 }] : []));
        const over: string[] = [];
        for (const c of centres)
          for (const t of sheet.prims) {
            if (t.kind !== 'text' || t.rotate || !/^PIECE \d+ OF \d+/.test(t.text)) continue;
            const w = textWidth(t.text, t.size, t.tracking ?? 0);
            const x0 = t.anchor === 'middle' ? t.at.x - w / 2 : t.at.x;
            if (c.x + 0.75 > x0 && c.x - 0.75 < x0 + w && c.y + 0.75 > t.at.y - t.size && c.y - 0.75 < t.at.y) over.push(t.text);
          }
        expect(over).toEqual([]);
      });
});
