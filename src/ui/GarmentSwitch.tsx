import { createContext, useContext } from 'react';
import { inTesting, IN_TESTING } from '../launch';
import { GARMENT_NAME, GARMENTS } from '../measureFlow';
import type { Garment } from '../measurements';
import { DropMenu } from './DropMenu';

/** Opens the Maison collection; given on the style screens, so their Looks tab can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** The garment being styled and a way to switch straight to another (measuring first when it needs more); given by
 *  the app on the style screens, so the title's drop-down can offer the list. */
export const GarmentPick = createContext<{ garment: Garment; onSwitch: (g: Garment) => void } | undefined>(undefined);

/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose, label = 'Choose another garment' }: { onChoose: () => void; label?: string }) {
  return (
    <button type="button" className="later go garment-change" onClick={onChoose}>
      {label}
    </button>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The Style title's drop-down (Cat applied, 2026-10-24): "Your skirt" with the garments under it, launched ones
 *  first, and the full list with pictures at the end. Without the app's switch it opens that list for any pick. */
export function GarmentDrop({ label, onChoose }: { label?: string; onChoose: () => void }) {
  const pick = useContext(GarmentPick);
  const order = [...GARMENTS.filter((g) => !inTesting(g)), ...GARMENTS.filter(inTesting)];
  return (
    <DropMenu
      name="Garment"
      className="garment-drop"
      value={label}
      items={[
        ...order.map((g) => ({ id: g, text: cap(GARMENT_NAME[g]), on: pick?.garment === g, note: inTesting(g) ? IN_TESTING : undefined })),
        { id: 'all', text: 'See them all ›' },
      ]}
      onPick={(id) => (pick && id !== 'all' ? id !== pick.garment && pick.onSwitch(id as Garment) : onChoose())}
    />
  );
}

/** The four looks from the promo shoot (Cat's picks, 2026-10-18): the Looks tab's one row of photographs. */
const LOOKS: [string, string][] = [
  ['g01', 'Ivory column'],
  ['g03', 'Poet mustard'],
  ['g08', 'Ecru suit'],
  ['g10', 'Caramel trench'],
];

/** The Looks tab's way into the Maison collection, where it is offered: a row of looks, then the quiet link. */
export function CollectionEntry() {
  const openCollection = useContext(CollectionLink);
  if (!openCollection) return null;
  return (
    <div className="collection-entry">
      <button type="button" className="lookstrip" onClick={openCollection} aria-label="Four looks from the Maison collection">
        {LOOKS.map(([id, name]) => (
          <img key={id} src={`/looks/${id}.jpg`} alt={name} loading="lazy" />
        ))}
      </button>
      <button type="button" className="secondary" onClick={openCollection}>
        Start from the Maison collection
      </button>
    </div>
  );
}
