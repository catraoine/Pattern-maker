import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftSleeve } from './sleeve';
import type { SleeveStyle } from './sleeve';
import { checkPattern } from './qc';
import { ringOf } from './manipulate';
import type { Piece } from './piece';
import { randomArms, randomBody, rng } from './randomBodies';
import { COLLECTION, lookFabric } from '../collection';
import { isBodice, validDetails } from '../garments';
import { isHousePhoto } from '../fabricPhoto';

// The house shirt cut (the Leopard Shirt Dress, 2026-11-10): a long-point shirt collar and a shirttail hem that may
// run on past the hip. Set by the look only, so a shirt without it is cut as before.
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
const plain = { ...choices, shirtCut: undefined };
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

  it('comes in the house print, photographed from the real cloth', () => {
    const f = lookFabric(look.fabric);
    expect(isHousePhoto(f.photo?.id)).toBe(true);
    expect(f.print).toBe('oneway');
    expect(lookFabric('Gold python silk').photo).toBeUndefined();
  });
});
