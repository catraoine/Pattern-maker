import { describe, expect, it } from 'vitest';
import { evenLight, seamless } from './fabricTile';
import { fabricLabel, pickFabric, pickPhoto, pickShopFabric } from '../ui/FabricFill';
import type { Finish } from '../savedWork';

/** A test photo: a fine weave over light falling from left to right, its edges not meeting. */
function photo(n: number) {
  const data = new Uint8ClampedArray(n * n * 4);
  const low = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const light = 0.5 + x / n;
      const weave = (x + y) % 4 < 2 ? 150 : 110;
      for (let j = 0; j < 3; j++) {
        data[i + j] = weave * light;
        low[i + j] = 130 * light;
      }
      data[i + 3] = low[i + 3] = 255;
    }
  return { data, low };
}

const col = (d: Uint8ClampedArray, n: number, x: number) => Array.from({ length: n }, (_, y) => d[(y * n + x) * 4]);
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

describe('a fabric photo made into a tile', () => {
  it('lifts the light falling across it, keeping the weave', () => {
    const n = 32;
    const { data, low } = photo(n);
    const before = mean(col(data, n, n - 1)) - mean(col(data, n, 0));
    evenLight({ data, n }, low);
    const after = mean(col(data, n, n - 1)) - mean(col(data, n, 0));
    expect(Math.abs(after)).toBeLessThan(Math.abs(before) * 0.25);
    // The weave still reads: neighbouring threads differ.
    expect(Math.abs(data[0] - data[8])).toBeGreaterThan(10);
  });

  it('repeats with no line: the last column runs into the first as smoothly as any two neighbours', () => {
    const n = 64;
    const { data } = photo(n);
    const jump = (d: Uint8ClampedArray, a: number, b: number) => mean(col(d, n, a).map((v, y) => Math.abs(v - col(d, n, b)[y])));
    expect(jump(data, n - 1, 0)).toBeGreaterThan(40);
    seamless({ data, n });
    expect(jump(data, n - 1, 0)).toBeLessThan(jump(data, n / 2, n / 2 + 1) + 12);
  });
});

describe('picking your own photo', () => {
  const finish = { fabric: { fibre: 'linen', colour: 'Rust' } } as unknown as Finish;
  it('keeps what the cloth is, drops the colour, and names it your fabric', () => {
    const f = pickPhoto(finish, 'fabric-x').fabric!;
    expect(f.fibre).toBe('linen');
    expect(f.colour).toBeUndefined();
    expect(f.photo).toEqual({ id: 'fabric-x', size: 20 });
    expect(fabricLabel(f)).toBe('Your fabric');
  });
  it('comes off with None and with a shop fabric', () => {
    const on = pickPhoto(finish, 'fabric-x');
    expect(pickFabric(on, undefined).fabric?.photo).toBeUndefined();
    const shop = pickShopFabric(on, 'mood-denim');
    expect(shop.fabric?.shop).toBe('mood-denim');
    expect(shop.fabric?.photo).toBeUndefined();
  });
});
