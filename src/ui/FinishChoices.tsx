import { ALLOWANCE_LABELS, AllowanceStyle } from '../engine/allowances';
import type { BodiceEdges } from '../engine/instructions';
import type { Finish } from '../App';
import type { Garment } from '../measurements';

const EDGES: { id: BodiceEdges; label: string; detail: string }[] = [
  { id: 'binding', label: 'Bias binding', detail: 'Quick and neat' },
  { id: 'facings', label: 'Facings', detail: 'Clean edge, interfaced' },
  { id: 'lined', label: 'Fully lined', detail: 'The couture finish' },
];

/** How the garment is finished inside. These change the pattern pieces, so they're chosen with the style. */
export function FinishChoices({ garment, finish, onFinish }: { garment: Garment; finish: Finish; onFinish: (f: Finish) => void }) {
  return (
    <>
      {garment === 'skirt' ? (
        <fieldset className="group">
          <legend>Lining</legend>
          {[false, true].map((on) => (
            <label key={String(on)} className={finish.skirtLined === on ? 'radio on' : 'radio'}>
              <input type="radio" name="lining" checked={finish.skirtLined === on} onChange={() => onFinish({ ...finish, skirtLined: on })} />
              <span>
                {on ? 'Lined' : 'Unlined'} <span className="muted small">{on ? 'Hangs better, never clings' : 'Lighter, quicker'}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <fieldset className="group">
          <legend>Neck and armholes</legend>
          {EDGES.map((e) => (
            <label key={e.id} className={finish.bodiceEdges === e.id ? 'radio on' : 'radio'}>
              <input type="radio" name="edges" checked={finish.bodiceEdges === e.id} onChange={() => onFinish({ ...finish, bodiceEdges: e.id })} />
              <span>
                {e.label} <span className="muted small">{e.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="group">
        <legend>Seam allowances</legend>
        {(Object.keys(ALLOWANCE_LABELS) as AllowanceStyle[]).map((a) => (
          <label key={a} className={finish.allowances === a ? 'radio on' : 'radio'}>
            <input type="radio" name="allowances" checked={finish.allowances === a} onChange={() => onFinish({ ...finish, allowances: a })} />
            <span>
              {ALLOWANCE_LABELS[a].label} <span className="muted small">{ALLOWANCE_LABELS[a].detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
