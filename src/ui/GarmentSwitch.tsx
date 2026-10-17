import type { Garment } from '../measurements';

/** Skirt, trousers, bodice, dress, T-shirt, jacket or coat: which pattern the measuring and styling steps are for. */
export function GarmentSwitch({ garment, onGarment }: { garment: Garment; onGarment: (g: Garment) => void }) {
  return (
    <div className="seg garments" role="group" aria-label="What are you making?">
      {(['skirt', 'trousers', 'bodice', 'dress', 'tee', 'jacket', 'coat'] as Garment[]).map((g) => (
        <button key={g} type="button" aria-pressed={garment === g} className={garment === g ? 'on' : ''} onClick={() => onGarment(g)}>
          {{ skirt: 'Skirt', trousers: 'Trousers', bodice: 'Bodice', dress: 'Dress', tee: 'Tee', jacket: 'Jacket', coat: 'Coat' }[g]}
        </button>
      ))}
    </div>
  );
}
