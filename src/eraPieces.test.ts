import { describe, expect, it } from 'vitest';
import { lookFabric, lookPatch } from './collection';
import { eraLine } from './eraLines';
import { ERAS } from './engine/eras';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import type { MeasurementValues } from './measurements';

// The era pieces, made the way the app makes a look, in the cloth each is named for, on a small, a middle and a large
// body, and read as a pattern cutter reads a pattern before it is cut (era pattern review, 2026-11-14): what the first
// page, the measurement table, the shopping list and the steps say has to be what the pieces are.
const BODIES: Record<string, MeasurementValues> = {
  small: { height: 162, waist: 66, full_bust: 84, high_bust: 81, underbust: 72, full_hip: 86, waist_to_hip: 19.5, waist_to_knee: 56, waist_to_floor: 100, nape_to_waist: 39.5, shoulder_width: 37, crotch_depth: 25.5, crotch_length: 62, arm_length: 57, upper_arm: 26, wrist: 15 },
  middle: { height: 166, waist: 83, full_bust: 100, high_bust: 93, underbust: 85, full_hip: 105, waist_to_hip: 21, waist_to_knee: 59, waist_to_floor: 103, nape_to_waist: 41, shoulder_width: 39.5, crotch_depth: 28, crotch_length: 73, arm_length: 59, upper_arm: 31.5, wrist: 16.5 },
  large: { height: 168, waist: 114, full_bust: 128, high_bust: 117, underbust: 111, full_hip: 136, waist_to_hip: 22.5, waist_to_knee: 60, waist_to_floor: 104, nape_to_waist: 42, shoulder_width: 42, crotch_depth: 31.5, crotch_length: 88, arm_length: 60, upper_arm: 41, wrist: 18.5 },
};
const ERA_PIECES = ERAS.flatMap((e) => eraLine(e.id));

/** An era piece's printed pattern as the app makes it: its choices fitted to the body, in the cloth it is named for. */
function made(id: string, body: MeasurementValues) {
  const look = ERA_PIECES.find((l) => l.id === id)!;
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

type Print = ReturnType<typeof made>;
const each = (id: string, check: (p: Print, body: MeasurementValues) => void) => Object.values(BODIES).forEach((b) => check(made(id, b), b));
const row = (p: Print, label: RegExp) => p.spec.find((r) => label.test(r.label));
const step = (p: Print, title: string) => p.guide.steps.find((s) => s.title === title)!.text;
const words = (p: Print) => [...p.notes, ...p.guide.notions, ...p.guide.steps.map((s) => `${s.title} ${s.text}`)].join(' ');

describe('era pieces: the collar', () => {
  it('a Peter Pan collar cut on the fold is cut on its fold line, with no allowance past it', () => {
    each('50-top', (p) => {
      const collar = p.pieces.find((pc) => pc.name === 'Collar')!;
      expect(collar.fold).toBeTruthy();
      // Every edge has its own name, so the fold takes the fold's allowance (none) and not the seams' 1.5 cm.
      expect(collar.outline.taggedPoints(8).tags.every((t) => !!t)).toBe(true);
      expect(collar.allowances.fold).toBe(0);
    });
  });
});

describe('era pieces: the measurement table', () => {
  it('a top that buttons down the front lists its buttons, not a zip it does not have', () => {
    for (const id of ['ed-blouse', '40-top', '50-top'])
      each(id, (p) => {
        expect(row(p, /zip/i)).toBeUndefined();
        expect(row(p, /^Buttons, centre front/)).toBeDefined();
      });
  });

  it('a slip that pulls on has no zip row', () => {
    each('90-dress', (p) => {
      expect(row(p, /zip/i)).toBeUndefined();
      expect(row(p, /^Opening$/)?.finished).toMatch(/pulls on/);
    });
  });

  it('a hem at the high hip is read against the body there, so its ease is the room it has', () => {
    for (const id of ['30-top', '40-top', '50-top'])
      each(id, (p, b) => {
        const hem = row(p, /^High hip \(hem\)$/)!;
        expect(hem.body as number).toBeLessThan(b.full_hip!);
        expect(hem.body as number).toBeGreaterThan(b.waist!);
        expect(hem.ease as number).toBeGreaterThan(0);
      });
  });

  it('high-rise trousers are read from where they sit: waist, crotch depth and crotch length', () => {
    for (const id of ['30-trousers', '50-trousers', '70-trousers'])
      each(id, (p, b) => {
        expect(row(p, /^Waist, 4 cm above yours$/)).toBeDefined();
        const depth = row(p, /^Crotch depth, from where they sit$/)!;
        expect(depth.body).toBe(b.crotch_depth! + 4);
        const length = row(p, /^Crotch length, from where they sit$/)!;
        expect(length.body).toBe(b.crotch_length! + 8);
        // (Read from the natural waist the same trousers showed 10 to 13 cm of crotch ease.)
        expect(length.ease as number).toBeLessThan(8);
      });
  });

  it('a strap is not marked down against the shoulder, nor its armhole against the arm', () => {
    each('90-dress', (p) => {
      expect(row(p, /^Shoulder seam/)!.body).toBeUndefined();
      expect(row(p, /^Armhole$/)!.body).toBeUndefined();
    });
  });

  it("a drop-waist dress's first page gives the waist of the pieces, as the table does", () => {
    each('20-dress', (p) => {
      expect(p.notes[0]).toContain(`waist ${row(p, /^Waist$/)!.finished} cm`);
      const seam = row(p, /^Waist seam, /)!;
      expect(seam.ease as number).toBeGreaterThan(0);
    });
  });

  it('an empire dress gives its seam under the bust, against the body there, and no fitted waist it does not have', () => {
    each('60-dress', (p, b) => {
      expect(p.notes[0]).toMatch(/under the bust \(at the seam\) [\d.]+ cm/);
      expect(p.notes[0]).not.toMatch(/waist/);
      expect(row(p, /^Waist$/)).toBeUndefined();
      expect(row(p, /^Waist seam, [\d.]+ cm above the waist$/)!.body).toBe(b.underbust);
    });
  });
});

describe('era pieces: the shopping list and the steps', () => {
  it('a blouse with cuffs, a collar and a button front buys interfacing for all three, and no binding it never uses', () => {
    each('ed-blouse', (p) => {
      expect(p.guide.notions.some((n) => /bias binding/.test(n))).toBe(false);
      expect(p.guide.notions).toContain('0.5 m lightweight fusible interfacing');
      expect(p.guide.notions.some((n) => /interfacing, for the cuffs$/.test(n))).toBe(true);
    });
    each('70-top', (p) => expect(p.guide.notions.some((n) => /bias binding/.test(n))).toBe(false));
  });

  it('a full bishop sleeve is gathered into its cuff: two pleats cannot take up that much', () => {
    for (const id of ['ed-blouse', '70-top']) each(id, (p) => expect(step(p, 'Attach the cuffs')).not.toMatch(/pleats/));
  });

  it('the elbow darts are sewn once', () => {
    for (const id of ['ed-dress', '60-dress']) each(id, (p) => expect(p.guide.steps.filter((s) => s.title === 'Sew the elbow darts')).toHaveLength(1));
  });

  it('a sheer dress is sewn as its cloth card says: French seams, and hems turned by the 1 cm they are cut with', () => {
    each('ed-dress', (p) => {
      expect(p.pieces.find((pc) => pc.name === 'Skirt front')!.allowances.hem).toBe(1);
      expect(step(p, 'Hem')).toContain('ress up 0.5 cm, then 0.5 cm more');
      expect(step(p, 'Hem the sleeves')).toContain('ress up 0.5 cm, then 0.5 cm more');
      expect(step(p, 'Sew the shoulders')).toMatch(/French seams/);
      expect(step(p, 'Sew the side seams')).toMatch(/French seams/);
      expect(step(p, 'Neaten the edges')).not.toMatch(/overlock the shoulder/);
      // Its funnel neck finishes the neck and its sleeves the armholes: nothing is bound.
      expect(p.notes.join(' ')).not.toMatch(/bias-bound/);
    });
  });

  it('a bias slip too wide for the cloth says so, and gives its layout and metres for cloth it fits', () => {
    each('90-dress', (p) => {
      const lay = p.lays.find((l) => l.fabric === 'self')!;
      expect(lay).toBeDefined();
      expect(p.guide.notions[0]).toContain(`${lay.width} cm wide`);
      const note = p.notes.find((n) => /^Cut whole on the bias, the front and back are too wide/.test(n));
      if (lay.width > DEFAULT_FINISH.fabricWidth) expect(note).toContain(`cloth ${lay.width} cm wide`);
      else expect(note).toBeUndefined();
    });
    // The middle and large bodies are the ones it used to fail silently on.
    expect(made('90-dress', BODIES.middle).lays.find((l) => l.fabric === 'self')!.width).toBe(150);
    expect(made('90-dress', BODIES.small).lays.find((l) => l.fabric === 'self')!.width).toBe(DEFAULT_FINISH.fabricWidth);
  });

  it("a side zip's waistband has no extension, and its steps name none", () => {
    for (const id of ['30-trousers', '50-trousers'])
      each(id, (p) => {
        expect(step(p, 'Attach the waistband')).not.toMatch(/extension/);
        expect(step(p, 'Finish the waistband')).not.toMatch(/extension/);
      });
    // A fly's band does run on, and still says so.
    each('70-trousers', (p) => expect(step(p, 'Attach the waistband')).toMatch(/extension/));
  });

  it('a shawl coat is called a shawl, with one button and no notch to pivot at', () => {
    each('20-coat', (p) => {
      expect(words(p)).toMatch(/a shawl collar/);
      expect(words(p)).not.toMatch(/notched collar|1 buttons|1 buttonholes|notch corners/);
      expect(words(p)).toMatch(/1 button, /);
    });
  });
});

describe('era pieces: the cloth', () => {
  it('where the words offer a choice of cloths, the first one named is the one it is made in', () => {
    expect(lookFabric('Cotton poplin or light wool').fibre).toBe('cotton');
    expect(lookFabric('Satin, crepe-back satin or velvet').special).toBe('satin');
    expect(lookFabric('Corduroy, denim or rayon').special).toBe('corduroy');
    expect(lookFabric('Wool flannel, tweed or cotton gabardine')).toEqual({ fibre: 'wool' });
    // A first cloth the tables do not know passes the turn to the next.
    expect(lookFabric('Crepe, silk-like satin or fine wool')).toMatchObject({ fibre: 'silk', special: 'satin' });
    // One cloth, named whole, reads as before.
    expect(lookFabric('Ivory silk satin')).toMatchObject({ fibre: 'silk', special: 'satin' });
  });
});
