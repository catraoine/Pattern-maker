import type { Garment } from '../measurements';

/** Skirt or bodice: which pattern the measuring and styling steps are for. */
export function GarmentSwitch({ garment, onGarment }: { garment: Garment; onGarment: (g: Garment) => void }) {
  return (
    <div className="seg" role="group" aria-label="What are you making?">
      {(['skirt', 'bodice'] as Garment[]).map((g) => (
        <button key={g} type="button" aria-pressed={garment === g} className={garment === g ? 'on' : ''} onClick={() => onGarment(g)}>
          {g === 'skirt' ? 'Skirt' : 'Bodice'}
        </button>
      ))}
    </div>
  );
}
