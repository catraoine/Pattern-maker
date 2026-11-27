import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import type { MeasurementValues } from './measurements';

// The Fit audit read every launch piece's steps against its pieces on Nov 27 (findings row 163) and found three steps that
// ask for something the pieces don't have: notches on the Ice Peplum's sleeve seam and the Black Vest's side seams, a
// second back yoke on the vest, and French seams on the satin slip whose next steps sew plain seams.
const BODIES: Record<string, MeasurementValues> = {
  small: { height: 162, waist: 64, full_bust: 82, high_bust: 79, full_hip: 90, waist_to_hip: 19.5, nape_to_waist: 39.5, arm_length: 57, upper_arm: 26, wrist: 15, waist_to_knee: 58, waist_to_floor: 104 } as MeasurementValues,
  large: { height: 168, waist: 107, full_bust: 122, high_bust: 112, full_hip: 132, waist_to_hip: 22.5, nape_to_waist: 42, arm_length: 60, upper_arm: 38, wrist: 18, waist_to_knee: 60, waist_to_floor: 108 } as MeasurementValues,
};

function made(id: string, body: MeasurementValues) {
  const look = COLLECTION.find((l) => l.id === id)!;
  const values = withEstimates(body);
  const { garment, ...next } = lookPatch(look, values);
  const fabric = lookFabric(look.fabric);
  const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
  const saved = { ...INITIAL, ...next, garment, finish } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
  const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
  const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) });
  if (!print) throw new Error(`${id} did not print`);
  return print;
}

describe('launch pieces: the steps ask only for what the pieces have', () => {
  for (const [name, body] of Object.entries(BODIES)) {
    const steps = (id: string) => made(id, body).guide.steps;
    const step = (id: string, title: string) => steps(id).find((st) => st.title === title)?.text ?? '';

    it(`${name}: the Ice Peplum's sleeve seam matches the underarm corners and the hem, not notches`, () => {
      expect(step('ice-peplum', 'Sew the sleeve seams')).toContain('matching the underarm corners and the hem.');
    });

    it(`${name}: the Black Vest's side seams and lining match the underarms and hems, and it has one back yoke`, () => {
      const all = steps('black-vest');
      expect(step('black-vest', 'Sew the shoulders and side seams')).toContain('Sew the side seams, matching the underarms and the hems.');
      const lining = all.find((st) => st.title === 'Make the lining')!.text;
      expect(lining).toContain("Sew the lining's shoulders and side seams, matching the underarms and the hems, leaving a 25 cm gap");
      for (const st of all) {
        expect(st.text).not.toMatch(/matching the notches/);
        expect(st.text).not.toMatch(/each back yoke/);
      }
      expect(step('black-vest', 'Sew the chest seam')).toContain('the back yoke to the back');
    });

    it(`${name}: the Ivory Slip doesn't offer French seams its later steps don't sew`, () => {
      expect(step('ivory-slip', 'Neaten the edges')).not.toMatch(/French seam/);
    });
  }
});
