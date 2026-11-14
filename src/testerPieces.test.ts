import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { taggedLength } from './engine/geometry';
import type { MeasurementValues } from './measurements';
import type { Piece } from './engine/piece';

// The five pieces the fit testers sew (Blush Shift, Ice Peplum Top, Black Pleated Skirt, Chocolate Barrel Trouser and the
// Black Vest), made the way the app makes a look, in its own cloth, on a small, a middle and a large body, and read as a
// pattern cutter reads a pattern before it is cut (tester pattern review, 2026-11-13): what the first page and the steps
// say has to be what the pieces are.
const BODIES: Record<string, MeasurementValues> = {
  small: { height: 162, waist: 66, full_bust: 84, high_bust: 81, underbust: 72, full_hip: 86, waist_to_hip: 19.5, waist_to_knee: 56, waist_to_floor: 100, nape_to_waist: 39.5, shoulder_width: 37, crotch_depth: 25.5, crotch_length: 62, arm_length: 57, upper_arm: 26, wrist: 15 },
  middle: { height: 166, waist: 83, full_bust: 100, high_bust: 93, underbust: 85, full_hip: 105, waist_to_hip: 21, waist_to_knee: 59, waist_to_floor: 103, nape_to_waist: 41, shoulder_width: 39.5, crotch_depth: 28, crotch_length: 73, arm_length: 59, upper_arm: 31.5, wrist: 16.5 },
  large: { height: 168, waist: 114, full_bust: 128, high_bust: 117, underbust: 111, full_hip: 136, waist_to_hip: 22.5, waist_to_knee: 60, waist_to_floor: 104, nape_to_waist: 42, shoulder_width: 42, crotch_depth: 31.5, crotch_length: 88, arm_length: 60, upper_arm: 41, wrist: 18.5 },
};

/** A look's printed pattern as the app makes it: its choices fitted to the body, in the cloth it is named for. */
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

const piece = (pieces: Piece[], name: string) => pieces.find((pc) => pc.name === name)!;
const step = (p: ReturnType<typeof made>, title: string) => p.guide.steps.find((s) => s.title === title)!.text;
/** The two ends of a piece's side seam, top first. */
function sideEnds(pc: Piece) {
  const { pts, tags } = pc.outline.taggedPoints(24);
  const on = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  return on[0].y < on[on.length - 1].y ? [on[0], on[on.length - 1]] : [on[on.length - 1], on[0]];
}

describe.each(Object.entries(BODIES))('the Ice Peplum Top on a %s body', (_size, body) => {
  const p = made('ice-peplum', body);

  it('cuts the bodice edge and the sleeve edge with the seam allowance their steps sew, not the sheer hem', () => {
    for (const name of ['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back', 'Sleeve']) expect(piece(p.pieces, name).allowances.hem, name).toBe(1.5);
    expect(step(p, 'Attach the peplum')).toContain('Sew 1.5 cm from the edge');
    expect(step(p, 'Attach the sleeve bands')).toContain('sew 1.5 cm from the edge');
    // The peplum's own hem is the sheer's narrow one, and the first page says so.
    expect(piece(p.pieces, 'Peplum front').allowances.hem).toBe(1);
    expect(p.notes.join(' ')).toContain('1 cm at the hem');
    expect(p.notes.join(' ')).not.toContain('2.5 cm at the hem');
  });

  it('asks for no more loops than fit down the back, and the same number everywhere', () => {
    const n = Number(/(\d+) small buttons and loops/.exec(p.notes.join(' '))![1]);
    const back = taggedLength(piece(p.pieces, 'Bodice centre back').outline, 'centre');
    // The first loop is 1 cm below the neck, the rest 2.5 cm apart, the last at least 1 cm above the peplum seam.
    expect(1 + (n - 1) * 2.5).toBeLessThanOrEqual(back - 1 + 1e-6);
    expect(step(p, 'Close the back with buttons and loops')).toContain(`mark ${n} points`);
    expect(step(p, 'Make the rouleau loops')).toContain(`into ${n} loops`);
    expect(p.guide.notions.join(' | ')).toContain(`${n} covered buttons`);
    expect(p.spec.find((r) => /centre back$/.test(r.label))).toEqual({ label: 'Buttons and loops, centre back', finished: `${n}` });
  });

  it("finishes the peplum's open edges on the centre back line, as the bodice's are", () => {
    expect(step(p, 'Close the back with buttons and loops')).toContain('0.75 cm then 0.75 cm');
    expect(step(p, 'Make the peplum')).toContain('Turn the open edges in twice by 0.75 cm');
  });

  it('lists no interfacing, which no step uses, and says the sheer is cut single layer in place of folding', () => {
    expect(p.guide.notions.join(' | ')).not.toMatch(/interfacing/);
    expect(p.guide.steps.some((s) => /interfac/i.test(s.text))).toBe(false);
    expect(step(p, 'Cut the sheer')).toContain('takes the place of folding the fabric in the cutting step');
  });

  it('runs the front and back side seams the same way below the waist', () => {
    const drop = (name: string) => {
      const pc = piece(p.pieces, name);
      const { pts, tags } = pc.outline.taggedPoints(24);
      const side = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side').sort((a, b) => a.y - b.y);
      const hem = side[side.length - 1];
      // Where the seam is 6 cm above its foot: the waist, the peplum seam being 6 cm below it.
      const waist = side.reduce((best, q) => (Math.abs(hem.y - q.y - 6) < Math.abs(hem.y - best.y - 6) ? q : best));
      return hem.x - waist.x;
    };
    const front = drop('Bodice side front');
    const back = drop('Bodice side back');
    expect(Math.abs(front - back)).toBeLessThan(0.5);
    expect(taggedLength(piece(p.pieces, 'Bodice side front').outline, 'side')).toBeCloseTo(taggedLength(piece(p.pieces, 'Bodice side back').outline, 'side'), 1);
  });
});

describe.each(Object.entries(BODIES))('the other tester pieces on a %s body', (_size, body) => {
  it("gives the Blush Shift's table the hip its pieces and first page have", () => {
    const p = made('blush-shift', body);
    const hip = p.spec.find((r) => r.label === 'Hip')!;
    expect(p.notes[0]).toContain(`hip ${hip.finished} cm`);
    expect(hip.ease).toBe(5);
    expect(step(p, 'Line the neck and armholes')).toContain('stop every line of stitching 3 cm short of the shoulder edges');
  });

  it("writes the Black Pleated Skirt's waist to the millimetre, no finer", () => {
    expect(made('black-pleated-skirt', body).notes[0]).toMatch(/^Finished waist \d+(\.\d)? cm,/);
  });

  it('puts the Barrel Trouser buttonhole in the end that laps over and the button on the underlap', () => {
    const p = made('chocolate-barrel', body);
    expect(step(p, 'Finish')).toContain('buttonhole in the end of the waistband on the left front');
    expect(step(p, 'Finish')).toContain('button to the extension marked UNDERLAP on the right front');
    expect(piece(p.pieces, 'Waistband').labels.map((l) => l.text)).toContain('UNDERLAP');
    expect(step(p, 'Put in the fly zip')).toContain("stitch the zip's free tape to the fly facing only");
  });

  it('describes no sleeve on the sleeveless Black Vest, and finishes the foot of its facings', () => {
    const p = made('black-vest', body);
    expect(p.pieces.some((pc) => /sleeve/i.test(pc.name))).toBe(false);
    expect(p.notes.join(' ')).not.toMatch(/Sleeve: bicep/);
    expect(step(p, 'Hem the shell')).toContain('Leave the front facings unfolded at the hem for now');
    expect(step(p, 'Bag the lining')).toContain('finish the foot of each front facing');
    // The front and back side seams are still one length.
    const [ft, fb] = sideEnds(piece(p.pieces, 'Jacket front'));
    const [bt, bb] = sideEnds(piece(p.pieces, 'Jacket back'));
    expect(Math.hypot(fb.x - ft.x, fb.y - ft.y)).toBeCloseTo(Math.hypot(bb.x - bt.x, bb.y - bt.y), 1);
  });
});
