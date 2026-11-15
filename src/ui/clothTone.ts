import { colourHex } from '../engine/shopFabrics';
import type { MyFabric } from '../engine/fabrics';
import { luminance } from './FabricFill';

/** How light a cloth may be and still count as dark: black, chocolate and navy fall under it. On the chalk sheet a dark
 *  cloth's seams are drawn pale, as dark ink would vanish into it. (Darker than the print ground's "dark", which only
 *  near-black reaches: there it picks a print's ground, here whether a line still shows.) */
const DARK_BELOW = 0.3;

/** Whether a cloth is dark enough to need pale lines. A print or a photo is drawn in its own colours, so it is not. */
export function darkCloth(fabric: MyFabric | undefined): boolean {
  if (fabric?.photo || fabric?.print) return false;
  const hex = colourHex(fabric);
  return !!hex && luminance(hex) < DARK_BELOW;
}
