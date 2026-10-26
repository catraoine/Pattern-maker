// The two ways to look at a garment on the style screens (Cat's D1, 2026-10-18): the garment itself, on
// the form, or the paper pieces to cut. The fit is a switch on the pieces, not a view of its own.

type Look = 'garment' | 'pattern';

/** Garment / Pattern, side by side, each with a short hint under its name. */
export function PreviewSwitch({ look, onLook }: { look: Look; onLook: (look: Look) => void }) {
  const boxes: [Look, string, string][] = [
    ['garment', 'Garment', 'On your form'],
    ['pattern', 'Pattern', 'Pieces to cut'],
  ];
  return (
    <div className="lookboxes" role="group" aria-label="Preview view">
      {boxes.map(([id, name, hint]) => (
        <button key={id} type="button" aria-pressed={look === id} className={look === id ? 'on' : ''} onClick={() => onLook(id)}>
          <span className="lookname">{name}</span>
          <span className="lookhint">{hint}</span>
        </button>
      ))}
    </div>
  );
}

/** The ways to see the garment itself: a sketch's sides, the flat drawing, all round on the form. */
export function GarmentViews<T extends string>({ views, view, onView }: { views: [T, string][]; view: T; onView: (v: T) => void }) {
  if (views.length < 2) return null;
  return (
    <div className="seg" role="group" aria-label="Garment view">
      {views.map(([id, name]) => (
        <button key={id} type="button" aria-pressed={view === id} className={view === id ? 'on' : ''} onClick={() => onView(id)}>
          {name}
        </button>
      ))}
    </div>
  );
}

/** Show fit: shades the pattern pieces by how much room they leave over the body. */
export function FitSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'fitswitch on' : 'fitswitch'} onClick={() => onChange(!on)}>
      <span className="knob" aria-hidden="true" />
      Show fit
    </button>
  );
}
