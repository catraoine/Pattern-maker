// The picked fabric as one tall palette card beside the form (Cat's D1 One Palette Card, mock-up 2026-11-02): the
// cloth above a cream name strip, like the Fabric step's swatches (A1, PR #174). It changes as swatches are tapped,
// so on a phone the cloth and its name stay in sight after the swatches have scrolled away.
import type { MyFabric } from '../engine/fabrics';
import { PRINTS, printOf } from '../engine/prints';
import { GarmentFabric, fabricLabel, fabricPaint } from './FabricFill';

/** Whether there is a fabric to show: a cloth, a shop fabric or a print. None leaves the form in lines, and no card. */
export const showsPalette = (fabric: MyFabric | undefined) => !!fabricPaint(fabric, import.meta.env.BASE_URL);

/** The card's name: the cloth (or shop fabric), the print if one is picked, then the colour. */
export function paletteName(fabric: MyFabric | undefined): string {
  const kind = printOf(fabric);
  const print = kind && kind !== 'plain' ? PRINTS[kind].label : undefined;
  const colour = fabric?.colour?.trim();
  return [fabricLabel(fabric) ?? print, fabricLabel(fabric) && print, colour].filter(Boolean).join(' · ');
}

/** Cloth drawn at the drawing's own scale (about 3.4 px a centimetre on a phone), so the card and dress match. */
const CM_W = 36;
const CM_H = 46;

export function PaletteCard({ fabric }: { fabric: MyFabric | undefined }) {
  const name = paletteName(fabric);
  return (
    <figure className="palette-card" aria-label={`Fabric: ${name}`}>
      <GarmentFabric fabric={fabric}>
        <svg className="palette-tex" viewBox={`0 0 ${CM_W} ${CM_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <rect width={CM_W} height={CM_H} fill="var(--garment)" />
        </svg>
      </GarmentFabric>
      <figcaption className="palette-name">{name}</figcaption>
    </figure>
  );
}
