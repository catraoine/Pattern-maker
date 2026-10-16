import type { Garment } from '../measurements';

/** Skirt, bodice or dress: which pattern the measuring and styling steps are for. */
export function GarmentSwitch({ garment, onGarment }: { garment: Garment; onGarment: (g: Garment) => void }) {
  return (
    <div className="seg garments" role="group" aria-label="What are you making?">
      {(['skirt', 'bodice', 'dress'] as Garment[]).map((g) => (
        <button key={g} type="button" aria-pressed={garment === g} className={garment === g ? 'on' : ''} onClick={() => onGarment(g)}>
          {g === 'skirt' ? 'Skirt' : g === 'bodice' ? 'Bodice' : 'Dress'}
        </button>
      ))}
    </div>
  );
}
