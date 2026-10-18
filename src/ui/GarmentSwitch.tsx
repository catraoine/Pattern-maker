import { createContext, useContext } from 'react';

/** Opens the Maison collection; given on the style screens, so their Looks tab can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose, label = 'Choose another garment' }: { onChoose: () => void; label?: string }) {
  return (
    <button type="button" className="link quiet garment-change" onClick={onChoose}>
      {label}
    </button>
  );
}

/** The Looks tab's way into the Maison collection, where it is offered. */
export function CollectionEntry() {
  const openCollection = useContext(CollectionLink);
  if (!openCollection) return null;
  return (
    <button type="button" className="secondary collection-entry" onClick={openCollection}>
      Start from the Maison collection
    </button>
  );
}
