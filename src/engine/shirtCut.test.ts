import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftSleeve } from './sleeve';
import type { SleeveStyle } from './sleeve';
import { checkPattern } from './qc';
import { ringOf } from './manipulate';
import { yokesJoined } from './seams';
import { bodiceGuide } from './instructions';
import type { Piece } from './piece';
import { randomArms, randomBody, rng } from './randomBodies';
import { COLLECTION, lookFabric } from '../collection';
import { isBodice, validDetails } from '../garments';
import { isHousePhoto } from '../fabricPhoto';

// The house shirt cut (the Leopard Shirt Dress, 2026-11-10): a long-point shirt collar, a back yoke with a box pleat
// under it, and a shirttail hem that may run on past the hip. Set by the look only, so a shirt without it is cut as
// before.
const body = (seed: number) => {
  const b = randomBody(rng(seed));
  return { ...b, ...randomArms(b, rng(seed + 100)) };
};
const sleeveStyle = (length: SleeveStyle['length']): SleeveStyle => ({ length, shape: 'straight', fit: 'oversized', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
const look = COLLECTION.find((l) => l.id === 'leopard-shirt-dress')!;
const choices = (() => {
  if (!isBodice(look.choices)) throw new Error('the leopard shirt dress is a top carried to a mini');
  return validDetails(look.choices);
})();
const plain = { ...choices, shirtCut: undefined, yoke: undefined };
const collarOf = (d: { pieces: Piece[] }) => d.pieces.find((pc) => pc.name === 'Collar')!;
const depth = (pc: Piece) => {
  const ys = ringOf(pc.outline).pts.map((q) => q.y);
  return Math.max(...ys) - Math.min(...ys);
};

describe('the house shirt cut', () => {
  it('drafts the Leopard Shirt Dress on 30 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = body(seed);
      const d = draftBodice(m, choices);
      const sl = draftSleeve(d, m, sleeveStyle('elbow'));
      for (const c of checkPattern([...d.pieces, ...sl.pieces])) if (!c.ok) failures.push(`seed ${seed}: ${c.label} (${c.detail})`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('cuts the collar deeper with long points', () => {
    const m = body(4);
    const long = collarOf(draftBodice(m, choices));
    const was = collarOf(draftBodice(m, plain));
    expect(long.meta?.longPoint).toBe(true);
    expect(was.meta?.longPoint).toBeUndefined();
    // 5.5 cm at the back and a point 4.5 cm past it, where the plain collar is 4.5 and 1.5.
    expect(depth(long)).toBeGreaterThan(depth(was) + 3.5);
  });

  it('lets the shirttail hang below a hem that is itself past the hip', () => {
    const m = body(4);
    const d = draftBodice(m, choices);
    const was = draftBodice(m, plain);
    // The back 3 cm longer than the front at the centre, the sides scooped up 7.5 cm.
    expect(d.hem!.back[0]).toBeCloseTo(3, 1);
    expect(d.hem!.front[0]).toBeCloseTo(0, 1);
    expect(d.hem!.front[8]).toBeCloseTo(-7.5, 1);
    // Without the cut a shaped hem stops 12 cm below the hip, so this one would be pulled up short.
    expect(was.hem!.back[0]).toBeLessThan(0);
  });

  it('keeps its buttons under a back yoke, where any other button front gives the yoke up', () => {
    const m = body(4);
    expect(choices.yoke).toEqual({ back: 9 });
    const d = draftBodice(m, choices);
    expect(d.closure).toBe('front_buttons');
    expect(d.pieces.map((pc) => pc.name)).toContain('Bodice back yoke');
    expect(d.pieces.find((pc) => pc.name === 'Bodice back yoke')!.cut).toBe('Cut 1 on fold');
    // Without the house cut the yoke is taken off again, as before.
    expect(validDetails({ ...look.choices, shirtCut: undefined } as typeof choices).yoke).toBeUndefined();
    // And a front yoke would still cross the buttons.
    expect(validDetails({ ...look.choices, yoke: { front: 9, back: 9 } } as typeof choices).yoke).toEqual({ back: 9 });
  });

  it('cuts a 3 cm box pleat into the back under the yoke, on the fold', () => {
    const m = body(4);
    const d = draftBodice(m, choices);
    const back = d.pieces.find((pc) => pc.name === 'Bodice back')!;
    const xs = ringOf(back.outline).pts.map((q) => q.x);
    expect(back.meta.boxPleat).toBe(3);
    expect(Math.min(...xs)).toBeCloseTo(-3, 6);
    expect(back.cut).toBe('Cut 1 on fold');
    expect(back.fold![0].x).toBeCloseTo(-3, 6);
    expect(back.balance!.map((b) => b.label)).toEqual(expect.arrayContaining(['PLEAT FOLD', 'CENTRE BACK']));
    // The yoke seam still matches once the pleat is folded.
    const seam = checkPattern(d.pieces).find((c) => c.label === 'Back yoke seam')!;
    expect(seam.ok).toBe(true);
    expect(seam.detail).toContain('box pleat folded');
    const steps = bodiceGuide(d, { length: 'long' }, 1.5, 1).steps;
    expect(steps.find((st) => st.title === 'Join the pleated back to its yoke')?.text).toContain('box pleat lies 3.0 cm across');
  });

  it('goes on the form with its yoke sewn on and the pleat folded away', () => {
    const d = draftBodice(body(4), choices);
    const joined = yokesJoined(d.pieces);
    expect(joined.length).toBe(d.pieces.length - 1);
    const back = joined.find((pc) => pc.name === 'Bodice back')!;
    const r = ringOf(back.outline);
    expect(r.tags).not.toContain('yoke');
    expect(r.tags).toEqual(expect.arrayContaining(['neck', 'shoulder', 'armhole', 'side', 'hem']));
    expect(Math.min(...r.pts.map((q) => q.x))).toBeGreaterThanOrEqual(-1e-6);
    expect(back.lines.some((ln) => ln.tags[0] === 'newseam')).toBe(true);
  });

  it('comes in the house print, photographed from the real cloth', () => {
    const f = lookFabric(look.fabric);
    expect(isHousePhoto(f.photo?.id)).toBe(true);
    expect(f.print).toBe('oneway');
    expect(lookFabric('Gold python silk').photo).toBeUndefined();
  });
});
