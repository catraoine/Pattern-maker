import { DRAPES, FabricGarment, MyFabric, WEIGHTS, easeWords, printRepeat } from '../engine/fabrics';
import { SPECIALS, specialLines } from '../engine/specialFabrics';
import { printLines, printOf } from '../engine/prints';
import { PrintPicker } from './PrintPicker';

/** One row of chips for a fabric trait; tapping the chosen one again clears it. */
function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: { id: T; label: string }[]; value?: T; onPick: (v: T | undefined) => void }) {
  return (
    <fieldset className="group">
      <legend>{label}</legend>
      <div className="chips">
        {options.map((o) => (
          <button key={o.id} type="button" className={value === o.id ? 'chip on' : 'chip'} aria-pressed={value === o.id} onClick={() => onPick(value === o.id ? undefined : o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// The rest of what you can say about your fabric, on the Fabric tab under the swatches (one place to choose
// fabric, Cat 2026-10-18): its name and colour, the print, weight and drape. Folded, so the tab stays
// short on a phone. It goes on the PDF and the tech pack, and heavy cloth gets a little more room.
export function FabricDetails({ fabric = {}, onFabric, garment, simple = true }: { fabric?: MyFabric; onFabric: (f: MyFabric) => void; garment: FabricGarment; simple?: boolean }) {
  const set = (patch: Partial<MyFabric>) => onFabric({ ...fabric, ...patch });
  const details = [...specialLines(fabric.special), ...printLines(printOf(fabric), printRepeat(fabric), garment).map((text) => ({ label: '', text }))];
  return (
    <details className="fabric-more">
      <summary>About your fabric</summary>
      <p className="muted small">
        {simple
          ? 'Optional. Tell us what you bought and we’ll say whether it suits the style. It goes on the PDF, and heavy cloth gets a little more room.'
          : 'Optional. It goes on the PDF and the tech pack, sets the couture seam finish and pressing, and adjusts the ease for heavy cloth.'}
      </p>
      <div className="fields">
        <div className="field plain">
          <label htmlFor="fabname">Name</label>
          <input id="fabname" type="text" autoComplete="off" value={fabric.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field plain">
          <label htmlFor="fabcolour">Colour</label>
          <input id="fabcolour" type="text" autoComplete="off" value={fabric.colour ?? ''} onChange={(e) => set({ colour: e.target.value })} />
        </div>
      </div>
      <PrintPicker fabric={fabric} onFabric={onFabric} />
      <Chips label="Weight" options={WEIGHTS} value={fabric.weight} onPick={(weight) => set({ weight })} />
      <Chips label="Drape" options={DRAPES} value={fabric.drape} onPick={(drape) => set({ drape })} />
      {details.length > 0 && (
        <dl className="special small">
          {details.map((d) => (
            <div key={d.text}>
              {d.label && <dt>{d.label}</dt>}
              <dd className="muted">{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {(fabric.weight === 'heavy' || (fabric.special && SPECIALS[fabric.special].thick)) && garment !== 'tee' && (
        <label className="check">
          <input type="checkbox" checked={fabric.matchEase !== false} onChange={(e) => set({ matchEase: e.target.checked })} />
          <span>
            Adjust ease to my fabric <span className="muted small">{easeWords(fabric, garment)}, for the cloth's thickness</span>
          </span>
        </label>
      )}
    </details>
  );
}
