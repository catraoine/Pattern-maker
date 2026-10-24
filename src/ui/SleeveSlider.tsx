import type { SleeveDraft } from '../engine/sleeve';
import { BodiceChoices, slideSleeve, sleeveOf } from '../garments';

const NAMES = { short: 'short', elbow: 'elbow', three_quarter: 'three-quarter', long: 'long' } as const;

/** Where a length sits among the named ones, in words: "at the elbow", "between elbow and three-quarter". */
export function sleeveLengthWords(cm: number, named: SleeveDraft['length']['named']): string {
  const order = (['short', 'elbow', 'three_quarter', 'long'] as const).filter((l) => named[l] !== undefined);
  const on = order.find((l) => Math.abs(named[l] - cm) < 1);
  if (on) return on === 'elbow' ? 'At the elbow.' : on === 'long' ? 'Down to the wrist.' : `The ${NAMES[on]} length.`;
  if (cm < named.short) return 'Shorter than a short sleeve.';
  const below = [...order].reverse().find((l) => named[l] < cm)!;
  const above = order.find((l) => named[l] > cm);
  return above ? `Between ${NAMES[below]} and ${NAMES[above]}.` : 'Down to the wrist.';
}

/**
 * The sleeve's length, set anywhere from just below the underarm to the wrist, measured from the
 * shoulder point. A cap sleeve keeps its own length, so it has none.
 */
export function SleeveSlider({ sleeve, choices, onChoices }: { sleeve?: SleeveDraft; choices: BodiceChoices; onChoices: (c: BodiceChoices) => void }) {
  const { length, shape } = sleeveOf(choices);
  if (!sleeve || length === 'none' || shape === 'cap' || shape === 'tailored') return null;
  const { cm, min, max, named } = sleeve.length;
  return (
    <div className="sleeve-length">
      <input
        type="range"
        min={Math.ceil(min)}
        max={Math.floor(max)}
        step={1}
        value={Math.round(cm)}
        aria-label="Sleeve length, in cm from the shoulder"
        onChange={(e) => onChoices(slideSleeve(choices, Number(e.target.value), named))}
      />
      <p className="muted small" aria-live="polite">
        {Math.round(cm)} cm from the shoulder. {sleeveLengthWords(cm, named)}
      </p>
    </div>
  );
}
