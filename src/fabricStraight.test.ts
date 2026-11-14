import { describe, expect, it } from 'vitest';
import { stripeLean } from './fabricStraight';

const N = 96;
/** Stripes 9 px apart, leaning `deg` from straight down (or across), drawn on an n by n grey square. */
const stripes = (deg: number, across = false) => {
  const t = (deg * Math.PI) / 180 + (across ? Math.PI / 2 : 0);
  const out = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[y * N + x] = 128 + 100 * Math.sin(((x * Math.cos(t) + y * Math.sin(t)) * 2 * Math.PI) / 9);
  return out;
};
/** The square turned the way fabricPhoto.ts turns its tile, by minus the lean: each point read from where it came. */
const turned = (g: Float64Array, lean: number) => {
  const out = new Float64Array(N * N);
  const c = N / 2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [dx, dy] = [x - c, y - c];
      const sx = Math.round(c + dx * Math.cos(lean) - dy * Math.sin(lean));
      const sy = Math.round(c + dx * Math.sin(lean) + dy * Math.cos(lean));
      out[y * N + x] = sx >= 0 && sy >= 0 && sx < N && sy < N ? g[sy * N + sx] : 128;
    }
  return out;
};
const deg = (r: number) => (r * 180) / Math.PI;

// Fabric photos taken at a slant (Cat's leopard cotton, Nov 14): the tile is set straight before it is drawn.
describe('a fabric photo set on the grain', () => {
  it.each([8, -12, 20])('reads stripes leaning %i degrees, and turning by it sets them straight', (d) => {
    const lean = stripeLean(stripes(d), N);
    expect(Math.abs(deg(lean))).toBeGreaterThan(Math.abs(d) - 2);
    expect(Math.abs(deg(lean))).toBeLessThan(Math.abs(d) + 2);
    // (Read again once turned: next to nothing left.)
    const inner = turned(stripes(d), lean);
    const mid = new Float64Array(48 * 48).map((_, i) => inner[(24 + Math.floor(i / 48)) * N + 24 + (i % 48)]);
    expect(Math.abs(deg(stripeLean(mid, 48)))).toBeLessThan(2.5);
  });

  it('sets bands that run across straight across', () => {
    expect(Math.abs(deg(stripeLean(stripes(10, true), N)))).toBeGreaterThan(8);
  });

  it('leaves straight stripes, spots, and a stripe meant to run on the bias as they are', () => {
    expect(stripeLean(stripes(0), N)).toBe(0);
    expect(stripeLean(stripes(40), N)).toBe(0);
    const spots = new Float64Array(N * N).map((_, i) => 128 + 100 * Math.sin((i % N) / 3) * Math.sin(Math.floor(i / N) / 3));
    expect(stripeLean(spots, N)).toBe(0);
  });
});
