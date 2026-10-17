import { createContext, useContext } from 'react';
import type { Garment } from '../measurements';

/** Opens the Maison collection; given on the style screens, so their garment switch can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** Skirt, trousers, bodice, dress, jacket or coat: which pattern the measuring and styling steps are for. */
export function GarmentSwitch({ garment, onGarment }: { garment: Garment; onGarment: (g: Garment) => void }) {
  const openCollection = useContext(CollectionLink);
  const seg = (
    <div className="seg garments" role="group" aria-label="What are you making?">
      {(['skirt', 'trousers', 'bodice', 'dress', 'jacket', 'coat'] as Garment[]).map((g) => (
        <button key={g} type="button" aria-pressed={garment === g} className={garment === g ? 'on' : ''} onClick={() => onGarment(g)}>
          {{ skirt: 'Skirt', trousers: 'Trousers', bodice: 'Bodice', dress: 'Dress', jacket: 'Jacket', coat: 'Coat' }[g]}
        </button>
      ))}
    </div>
  );
  if (!openCollection) return seg;
  return (
    <div className="garment-pick">
      {seg}
      <button type="button" className="link quiet-link" onClick={openCollection}>
        Or start from the Maison collection
      </button>
    </div>
  );
}
