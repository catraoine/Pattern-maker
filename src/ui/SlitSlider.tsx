import type { Slit } from '../engine/slit';

/** The slit's height, set in cm above the hem, from a short split up to 5 cm below the hip line. */
export function SlitSlider({ slit, onCm }: { slit?: Slit & { range: { min: number; max: number } }; onCm: (cm: number) => void }) {
  if (!slit || slit.range.max <= slit.range.min) return null;
  const where = slit.at === 'side' ? 'left side' : `centre ${slit.at}`;
  return (
    <div className="sleeve-length">
      <input type="range" min={slit.range.min} max={slit.range.max} step={1} value={slit.cm} aria-label="Slit height, in cm above the hem" onChange={(e) => onCm(Number(e.target.value))} />
      <p className="muted small" aria-live="polite">
        {slit.cm} cm up the {where} from the hem.{slit.cm >= slit.range.max ? ' As high as it goes: the seam above holds the skirt over the hip.' : ''}
      </p>
    </div>
  );
}

/** Why a skirt takes no slit. */
export const NO_SLIT = 'A slit goes in the seam of a pencil, straight or A-line skirt with a level hem and nothing added, not a wrap.';
