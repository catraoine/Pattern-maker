import { colourHex } from '../engine/shopFabrics';
import type { MyFabric } from '../engine/fabrics';

/** Lightness below which a cloth is dark: on the chalk sheet its seams are drawn pale, as dark ink would vanish into it. */
const DARK_BELOW = 0.3;

/** Whether a cloth is dark enough to need pale lines: black, chocolate, navy. A print or an unknown colour is not. */
export function darkCloth(fabric: MyFabric | undefined): boolean {
  const hex = colourHex(fabric);
  if (!hex) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.3 * r + 0.59 * g + 0.11 * b < DARK_BELOW;
}
