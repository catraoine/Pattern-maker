import { ALLOWANCE_LABELS, AllowanceStyle } from '../engine/allowances';
import type { BodiceEdges } from '../engine/instructions';
import type { Finish } from '../savedWork';
import type { Garment } from '../measurements';
import { isOuterwear } from '../measurements';

const EDGES: { id: BodiceEdges; label: string; detail: string }[] = [
  { id: 'binding', label: 'Bias binding', detail: 'Quick and neat' },
  { id: 'facings', label: 'Facings', detail: 'Clean edge, interfaced' },
  { id: 'lined', label: 'Fully lined', detail: 'The couture finish' },
];

/** How the garment is finished inside. These change the pattern pieces, so they're chosen with the style. */
export function FinishChoices({
  garment,
  finish,
  onFinish,
  sleeved = false,
  edgeIds,
  edgeLegend,
}: {
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  sleeved?: boolean;
  /** The edge finishes this style allows (a boned bodice is always lined), when not all of them. */
  edgeIds?: BodiceEdges[];
  edgeLegend?: string;
}) {
  const edges = edgeIds ? EDGES.filter((e) => edgeIds.includes(e.id)) : EDGES;
  const current = edges.some((e) => e.id === finish.bodiceEdges) ? finish.bodiceEdges : (edges.find((e) => e.id === 'lined') ?? edges[0]).id;
  return (
    <>
      {garment === 'trousers' || isOuterwear(garment) ? null : garment === 'skirt' ? (
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
          <legend>{edgeLegend ?? (sleeved ? 'Neckline' : 'Neck and armholes')}</legend>
          {edges.map((e) => (
            <label key={e.id} className={current === e.id ? 'radio on' : 'radio'}>
              <input type="radio" name="edges" checked={current === e.id} onChange={() => onFinish({ ...finish, bodiceEdges: e.id })} />
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
