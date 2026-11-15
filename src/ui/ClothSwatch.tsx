import { useId } from 'react';
import { ClothDefs, ClothOverlay, throughOpacity, useFabricLook } from './ClothLook';

// A cut swatch of the cloth under a collection drawing, the way an atelier pins the fabric beside the sketch (the H8
// Atelier Sheet, Nov 14): the colour and the print read at a glance, at their true scale, without the drawing's light.
// It sits inside GarmentFabric, so it is filled with the very cloth the drawing is.

/** The swatch's side, in cm of cloth: big enough to hold a whole repeat of the largest house print (26 cm), so a
 *  print reads as a print and not a blotch. */
const SIDE = 30;
const SQUARE = `M0,0L${SIDE},0L${SIDE},${SIDE}L0,${SIDE}Z`;

/** The cloth as a small square, and its name in small caps beside it. */
export function ClothSwatch({ name }: { name: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const look = useFabricLook();
  return (
    <figure className="cloth-swatch">
      <svg viewBox={`0 0 ${SIDE} ${SIDE}`} aria-hidden="true" focusable="false">
        <ClothDefs uid={uid} x1={0} x2={SIDE} look={look} flat />
        <path d={SQUARE} className="cloth-swatch-cloth" fillOpacity={throughOpacity(look)} />
        {/* (Its bottom edge as the hem, so a border print shows along it.) */}
        <ClothOverlay d={SQUARE} uid={uid} k="s" look={look} hemY={SIDE} />
      </svg>
      <figcaption>{name}</figcaption>
    </figure>
  );
}
