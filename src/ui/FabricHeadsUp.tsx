import { createContext, useContext } from 'react';
import { Detail, FabricStyle, MyFabric, fabricHeadsUp } from '../engine/fabrics';

/** The style the fabric is checked against, set once in App from the garment being styled. */
export const FabricStyleOf = createContext<FabricStyle | undefined>(undefined);

/** Opens a style detail by its name in the Style list ("Silhouette", "Neckline"...), or undefined when this garment
 * has no such detail. Given by StyleLayout. */
export const OpenDetail = createContext<(about: string) => (() => void) | undefined>(() => undefined);

/** Each detail's name in the Style list, as the garments word it: the dress says "Skirt shape" where the skirt
 * says "Silhouette". The first one this garment has is the one opened. */
const NAMES: Record<Detail, string[]> = {
  shape: ['Skirt shape', 'Silhouette'],
  fullness: ['Pleats and frills', 'Fullness'],
  neckline: ['Neckline'],
  fit: ['Fit'],
  structure: ['Structure'],
  leg: ['Leg'],
};

/** The fabric's heads up on Style's Fabric step, where it is picked, with a link to the style detail that a
 * different choice would fix (Cat, Nov 14: before this the warnings showed only on Print). A good match says
 * nothing, so the screen stays clear. */
export function FabricHeadsUp({ fabric }: { fabric: MyFabric | undefined }) {
  const style = useContext(FabricStyleOf);
  const open = useContext(OpenDetail);
  const notes = style ? fabricHeadsUp(style, fabric) : [];
  if (!notes.length) return null;
  return (
    <div className="fabric-heads-up" role="status">
      {notes.map((n) => {
        const name = n.about && NAMES[n.about].find((l) => open(l));
        const go = name ? open(name) : undefined;
        return (
          <p key={n.text}>
            <b>Heads up</b> {n.text}
            {go && (
              <>
                <br />
                <button type="button" className="heads-up-go" onClick={go}>
                  Change the {name!.toLowerCase()} <span aria-hidden="true">›</span>
                </button>
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}
