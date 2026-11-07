// A photo of the maker's own fabric made into a tile the drawings can repeat (Design: Fabric, Nov 7). A phone photo
// has light falling across it (brighter by the window, darker by the hand holding the phone), and its edges don't
// meet when it is laid side by side, so tiled as it is the garment comes out in bright and dark squares with a hard
// line round each. Here the broad light is lifted out (the weave and the print kept) and the edges are blended into
// the middle, so the tile repeats with no line. Plain arrays, so it runs in a test as it does in the browser.

/** RGBA pixels of a square tile, `n` a side, as a canvas gives them. */
interface Pixels {
  data: Uint8ClampedArray;
  n: number;
}

const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/** Lifts out the broad light: `low` is the same photo blurred to its light alone (the canvas draws it shrunk to a few
 * pixels and back). Each pixel is brightened or darkened by how far its light is from the photo's average, so a
 * window's glow fades and the cloth reads one even colour. `keep` leaves a little of the light, so it doesn't go flat. */
export function evenLight({ data, n }: Pixels, low: Uint8ClampedArray, keep = 0.15): void {
  let sum = 0;
  for (let i = 0; i < n * n * 4; i += 4) sum += lum(low, i);
  const mean = sum / (n * n);
  for (let i = 0; i < n * n * 4; i += 4) {
    const k = mean / Math.max(8, lum(low, i));
    const f = keep + (1 - keep) * k;
    for (let j = 0; j < 3; j++) data[i + j] = data[i + j] * f;
  }
}

/** How much of the photo itself (and not its copy turned half a tile round) shows at a distance from the middle:
 * all of it in the middle, none at the edge, eased between. */
const weight = (x: number, n: number) => {
  const t = Math.min(1, Math.min(x, n - 1 - x) / (n * 0.3));
  return t * t * (3 - 2 * t);
};

/** Makes the tile repeat with no line: across, the photo is blended toward a copy of itself moved half a tile
 * sideways (whose own join falls in the middle, where the photo shows in full), then the same down. */
export function seamless({ data, n }: Pixels): void {
  const pass = (across: boolean) => {
    const src = data.slice();
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const w = weight(across ? x : y, n);
        const sx = across ? (x + n / 2) % n : x;
        const sy = across ? y : (y + n / 2) % n;
        const i = (y * n + x) * 4;
        const k = (sy * n + sx) * 4;
        for (let j = 0; j < 3; j++) data[i + j] = src[i + j] * w + src[k + j] * (1 - w);
      }
  };
  pass(true);
  pass(false);
}
