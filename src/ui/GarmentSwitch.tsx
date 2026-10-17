import { createContext, useContext } from 'react';

/** Opens the Maison collection; given on the style screens, so they can offer it next to the garment link. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose }: { onChoose: () => void }) {
  const openCollection = useContext(CollectionLink);
  const change = (
    <button type="button" className="link quiet garment-change" onClick={onChoose}>
      Choose another garment
    </button>
  );
  if (!openCollection) return change;
  return (
    <div className="garment-pick">
      {change}
      <button type="button" className="link quiet garment-change" onClick={openCollection}>
        Or start from the Maison collection
      </button>
    </div>
  );
}
