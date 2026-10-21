import { createContext, useContext } from 'react';

/** Opens the Maison collection; given on the style screens, so their Looks tab can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose, label = 'Choose another garment' }: { onChoose: () => void; label?: string }) {
  return (
    <button type="button" className="later go garment-change" onClick={onChoose}>
      {label}
    </button>
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
