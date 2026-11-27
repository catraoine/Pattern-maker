import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import type { MeasurementValues } from './measurements';
import { FRAME_SETS, framesFor, stepFrames } from './engine/stepFrames';
import { stepLines } from './engine/stepLines';

// The close-up drawings for the trickier steps (a tester's ask, Nov 27) are picked by the words of each sentence. A step
// reworded later must still reach every one of its drawings in order, or a drawing would show the wrong action.
const BODY: MeasurementValues = { height: 166, waist: 83, full_bust: 100, high_bust: 93, underbust: 85, full_hip: 105, waist_to_hip: 21, waist_to_knee: 59, waist_to_floor: 103, nape_to_waist: 41, shoulder_width: 39.5, crotch_depth: 28, crotch_length: 73, arm_length: 59, upper_arm: 31.5, wrist: 16.5 };

function steps(id: string) {
  const look = COLLECTION.find((l) => l.id === id)!;
  const values = withEstimates(BODY);
  const { garment, ...next } = lookPatch(look, values);
  const fabric = lookFabric(look.fabric);
  const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
  const saved = { ...INITIAL, ...next, garment, finish } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
  const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
  const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) });
  return print!.guide.steps;
}

// The pieces testers are sewing now, and the steps in each that have drawings.
const DRAWN: Record<string, string[]> = {
  'chocolate-barrel': ['Make the back welt pockets', 'Make the slant pockets', 'Put in the fly zip'],
  'blush-shift': ['Put in the zip', 'Line the neck and armholes'],
  'black-pleated-skirt': ['Put in the zip', 'Fold and press the pleats', 'Stitch the pleats down'],
  'ice-peplum': ['Sew French seams', 'Make the rouleau loops', 'Close the back with buttons and loops'],
};

describe('close-up drawings follow the words', () => {
  for (const [id, titles] of Object.entries(DRAWN))
    it(`${id}: every drawing is reached, in order`, () => {
      const all = steps(id);
      for (const title of titles) {
        const st = all.find((s) => s.title === title);
        expect(st, `${id} has a step "${title}"`).toBeDefined();
        const lines = stepLines(st!.text);
        const set = FRAME_SETS.find((s) => s.title.test(title))!;
        const shown = stepFrames(title, lines);
        expect(shown.map((d) => d.caption), `${id}: ${title}`).toEqual(set.frames.map((f) => f.dg.caption));
        // A drawing never goes back as you tick down the step.
        const each = framesFor(title, lines)!.map((d) => set.frames.findIndex((f) => f.dg === d));
        expect(each).toEqual([...each].sort((a, b) => a - b));
      }
    });

  // Other garments share these step names but sew them another way: drawn for box pleats, two shoulders, a back welt
  // and a centre back zip, they would show the wrong thing, so these keep their usual picture (code review, Nov 27).
  it('another way of sewing a step of the same name keeps its usual picture', () => {
    const knife = 'Work from the right side on the ironing board. At each pleat, fold along the solid line and bring the fold over to its dashed line, the way the arrow points. Pin at the waist and hem, and baste down each fold through all the layers. Press through a damp press cloth from the waist to the hem.';
    expect(framesFor('Fold and press the pleats', stepLines(knife))).toBeUndefined();
    expect(framesFor('Put in the zip', ['Sew a 20 cm invisible zip into the left side seam, front and back.'])).toBeUndefined();
    expect(framesFor('Line the neck and armholes', ['Pin the lining to the dress, right sides together.', 'Press so the lining rolls just inside.'])).toBeUndefined();
    expect(framesFor('Make the welt pockets', ['Fold each welt in half lengthwise, right side out, and press.'])).toBeUndefined();
  });

  it('a step with no drawings keeps its usual picture', () => {
    expect(framesFor('Hem the skirt', ['Press up 1 cm, then 1 cm more.'])).toBeUndefined();
    expect(framesFor('Make the back welt pockets', ['Something else entirely.'])).toBeUndefined();
  });
});
