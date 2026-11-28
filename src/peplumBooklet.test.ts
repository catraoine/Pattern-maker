import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { checkMeasurements, type MeasurementValues } from './measurements';
import { checkPattern } from './engine/qc';
import { inInches } from './units';
import { layout, textWidth } from './engine/export';

// The pretend-tester walk on release DW (Nov 21) read the Ice Peplum's booklet against its pattern and found four
// places where the two said different things: the neck ruffle's length, the neck binding's seam, the sleeve crown ease
// and the French seam's width. Each is checked here on a small and a large body, as the testers print it.
const BODIES: Record<string, MeasurementValues> = {
  small: { height: 162, waist: 64, full_bust: 82, high_bust: 79, full_hip: 90, waist_to_hip: 19.5, nape_to_waist: 39.5, arm_length: 57, upper_arm: 26, wrist: 15 } as MeasurementValues,
  large: { height: 168, waist: 107, full_bust: 122, high_bust: 112, full_hip: 132, waist_to_hip: 22.5, nape_to_waist: 42, arm_length: 60, upper_arm: 38, wrist: 18 } as MeasurementValues,
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

const num = (s: string) => Number(s);

describe('the Ice Peplum booklet agrees with its pattern', () => {
  for (const [name, body] of Object.entries(BODIES)) {
    const print = made('ice-peplum', body);
    const steps = print.guide.steps;
    const step = (title: RegExp) => steps.find((st) => title.test(st.title))?.text ?? '';
    const checks = checkPattern(print.pieces);

    it(`${name}: the neck ruffle's seam check says it is gathered, as step 11 does`, () => {
      const c = checks.find((x) => x.label === 'Neck ruffle to neckline')!;
      expect(c.detail).toMatch(/^ruffle [\d.]+ cm, gathered to [\d.]+ cm, neckline [\d.]+ cm \(half\), identical once gathered$/);
      const [cut, gathered] = [...c.detail.matchAll(/([\d.]+) cm/g)].map((m) => num(m[1]));
      expect(cut).toBeGreaterThan(gathered * 1.5);
      expect(c.detail).not.toMatch(/collar/);
    });

    it(`${name}: the neck binding is sewn on the neck's stitching line, then trimmed`, () => {
      const t = step(/^Bind the neckline$/);
      expect(t).toMatch(/sew it on the neck's stitching line, 1 cm from the edge\. Trim the seam to 0\.5 cm/);
      expect(t).not.toMatch(/sew 0\.5 cm from the edge/);
    });

    it(`${name}: the crown ease is one number on the pattern, in the seam check and in the steps`, () => {
      const c = checks.find((x) => x.label === 'Sleeve crown ease')!;
      const [f, b] = [...c.detail.matchAll(/([\d.]+) cm/g)].map((m) => num(m[1]));
      const note = print.notes.find((n) => /crown ease/.test(n))!;
      expect(note).toContain(`crown ease ${f} cm front, ${b} cm back`);
      // Front and back, as the note says, with no total: in inches a total rounded on its own read 1-1/4 in beside 1/2 +
      // 5/8 in (pretend tester DX walk, Nov 22).
      expect(step(/^Ease the sleeve heads$/)).toContain(`longer than the armhole by its ease, ${f} cm at the front and ${b} cm at the back`);
    });

    it(`${name}: the shoulder ease is one number in the seam check and in the steps`, () => {
      // Each panel's 0.5 cm read 1/4 in, so the two added up to 1/2 in beside step 9's 3/8 in (pretend tester EJ walk,
      // Nov 27): a panel names its share as half the back's whole ease, the number the step gives.
      const panels = checks.filter((x) => /shoulder seams$/i.test(x.label));
      expect(panels.length).toBe(2);
      for (const c of panels) {
        expect(c.ok).toBe(true);
        expect(c.detail).toMatch(/: its half of the back's 1\.0 cm of shoulder ease, as drafted$/);
      }
      expect(inInches(panels[0].detail)).toContain("half of the back's ⅜ in of shoulder ease");
      expect(inInches(step(/^Sew the shoulders$/))).toContain('⅜ in longer');
    });

    it(`${name}: the French seam's fold is the 0.6 cm between its two rows of stitching`, () => {
      const t = step(/^Sew French seams$/);
      expect(t).toMatch(/0\.6 cm fold inside/);
      expect(t).toMatch(/sew 0\.6 cm outside the stitching line/);
    });
  }
});

// The same walk typed a 48 in waist into the cm form: it passed the waist's own range (from 45 cm), and the check that
// caught it against the bust said to breathe out and keep the tape snug.
describe('a number typed in inches in the cm form', () => {
  const v = withEstimates({ ...BODIES.large, waist: 48 });
  it('is asked about as inches, with the number in cm', () => {
    const w = checkMeasurements(v, 'cm', 'bodice').find((c) => c.id === 'waist')!;
    expect(w.message).toBe('Just checking your waist: 48 cm is small next to your full bust. Was it measured in inches? 48 in is 122 cm, so type that if so.');
  });
  it('is not, when the number read as inches would be no better', () => {
    const w = checkMeasurements({ ...v, waist: 30 }, 'cm', 'bodice').find((c) => c.id === 'waist');
    expect(w?.message ?? '').not.toMatch(/inches/);
  });
});

// The EK walk (Nov 27) read the Ice Peplum's inch pattern: its bust mark said "EASE +1-5/8 IN" beside 36 in and
// 37-1/2 in, where the booklet said +1-1/2, as the mark's ease was rounded on its own; and a FINISHED WAIST sat on the
// peplum, whose waist edge is the peplum seam, not the waist.
describe('the Ice Peplum finished marks', () => {
  const eighths = (s: string) => {
    const m = /^(\d*)(?:([⅛¼⅜½⅝¾⅞]))? IN$/.exec(s)!;
    return Number(m[1] || 0) * 8 + (m[2] ? '⅛¼⅜½⅝¾⅞'.indexOf(m[2]) + 1 : 0);
  };
  for (const [name, body] of Object.entries(BODIES)) {
    const marks = made('ice-peplum', body).pieces.flatMap((pc) => (pc.finished ?? []).map((f) => ({ piece: pc.name, ...f })));
    it(`${name}: the inch ease is the finished size less the body, as the booklet works it`, () => {
      const bust = marks.find((f) => f.title.startsWith('FINISHED BUST '))!;
      const [, fin] = /^FINISHED BUST (.+)$/.exec(bust.inch!.title)!;
      const [, you, sign, ease] = /^YOU (.+) · EASE ([+-])(.+)$/.exec(bust.inch!.note)!;
      expect((sign === '-' ? -1 : 1) * eighths(ease)).toBe(eighths(fin) - eighths(you));
    });
    it(`${name}: no finished waist on the peplum`, () => {
      expect(marks.filter((f) => /peplum/i.test(f.piece) && f.title.startsWith('FINISHED WAIST '))).toEqual([]);
    });
    // The booklet listed the waist's ease with no mark on the paper to check it against (EL walk, Nov 27): the top runs
    // on past the waist, and is marked there.
    it(`${name}: the waist the booklet lists is marked on the top, at the waist`, () => {
      const w = marks.find((f) => f.title.startsWith('FINISHED WAIST '));
      expect(w?.piece).toMatch(/^Bodice/);
    });
    // On D6 the bust's bullseye printed over its own "YOU 36 IN · EASE" (EL walk, Nov 27).
    it(`${name}: the marks' words keep off the bullseyes`, () => {
      const sheet = layout(made('ice-peplum', body).pieces, 'Ice', [], { pattern: 'Ice' });
      const rings = sheet.prims.flatMap((x) => (x.kind === 'poly' && x.closed && x.pts.length === 25 ? [{ x: (x.pts[0].x + x.pts[12].x) / 2, y: (x.pts[0].y + x.pts[12].y) / 2 }] : []));
      const words = marks.flatMap((f) => [f.title, f.note]);
      const on = sheet.prims.flatMap((x) => {
        if (x.kind !== 'text' || !words.includes(x.text)) return [];
        const hw = Math.max(textWidth(x.text, x.size, 0.12), textWidth(x.inch ?? '', x.size, 0.12)) / 2;
        const cy = x.at.y - x.size * 0.32;
        return rings.some((c) => Math.abs(c.x - x.at.x) < hw + 0.6 && Math.abs(c.y - cy) < x.size * 0.4 + 0.6) ? [x.text] : [];
      });
      expect(on).toEqual([]);
    });
  }
});
