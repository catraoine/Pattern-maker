// How far a fabric photo's stripes lean, so its tile can be drawn on the grain (fabricPhoto.ts): kept in its own file.

/** The turn, in radians, that sets a photo's stripes or bands straight: down the cloth or across it, whichever is
 *  nearer. A phone photo of cloth on a table is rarely square to the selvedge: Cat's own leopard and python cotton,
 *  photographed at a slant, drew its stripes on a diagonal down the whole dress (Nov 14), where on the body they hang
 *  straight down. 0 when the photo has no clear direction (a spotted or plain cloth) or leans so far it may be meant
 *  to (a bias stripe), so only a slip of the camera is taken out. `grey` is n by n, row by row, 0 to 255. Turning the
 *  drawing by minus this many radians (canvas y running down) straightens it. */
export function stripeLean(grey: ArrayLike<number>, n: number): number {
  let jxx = 0;
  let jyy = 0;
  let jxy = 0;
  const at = (x: number, y: number) => grey[y * n + x];
  for (let y = 1; y < n - 1; y++)
    for (let x = 1; x < n - 1; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      jxx += gx * gx;
      jyy += gy * gy;
      jxy += gx * gy;
    }
  const sum = jxx + jyy;
  if (!sum) return 0;
  // How much the light changes one way more than the other: near 0 for spots, toward 1 for clean stripes.
  const coherence = Math.hypot(jxx - jyy, 2 * jxy) / sum;
  if (coherence < MIN_COHERENCE) return 0;
  // The way the light changes fastest: across the stripes.
  const across = 0.5 * Math.atan2(2 * jxy, jxx - jyy);
  const lean = across - Math.round(across / (Math.PI / 2)) * (Math.PI / 2);
  const deg = Math.abs((lean * 180) / Math.PI);
  return deg < MIN_DEG || deg > MAX_DEG ? 0 : lean;
}

/** Below this the photo has no clear direction to straighten. */
const MIN_COHERENCE = 0.12;
/** Too small a lean to see; and past this, leave it, it may be a print that is meant to run on the bias. */
const MIN_DEG = 1.5;
const MAX_DEG = 25;
