import { useState } from 'react';
import { FIELDS, Garment, MeasurementValues, Unit } from '../measurements';
import { GARMENT_NAME } from '../measureFlow';

interface Props {
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  ownerName: string;
  onDone: (whose: 'mine' | 'other', name: string) => void;
}

const show = (cm: number, unit: Unit) => (unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);

/** Asked once, after the first measurements are in: are these yours, or someone else's? */
export function WhoseScreen({ garment, unit, values, ownerName, onDone }: Props) {
  const [whose, setWhose] = useState<'mine' | 'other'>('mine');
  const [mine, setMine] = useState(ownerName);
  const [theirs, setTheirs] = useState('');
  const rows = FIELDS[garment].filter((f) => values[f.id] !== undefined);

  return (
    <div className="welcome">
      <section className="card welcome-card" aria-labelledby="wtitle">
        <p className="eyebrow">Measurements done</p>
        <h1 id="wtitle">Whose measurements are these?</h1>
        <dl className="mlist">
          {rows.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd>{show(values[f.id]!, unit)}</dd>
            </div>
          ))}
        </dl>
        <div className="seg" role="group" aria-label="Whose measurements">
          <button type="button" aria-pressed={whose === 'mine'} className={whose === 'mine' ? 'on' : ''} onClick={() => setWhose('mine')}>
            Mine
          </button>
          <button type="button" aria-pressed={whose === 'other'} className={whose === 'other' ? 'on' : ''} onClick={() => setWhose('other')}>
            Someone else
          </button>
        </div>
        {whose === 'mine' ? (
          <div className="field plain">
            <label htmlFor="whose-name">Your name</label>
            <input id="whose-name" autoComplete="given-name" value={mine} placeholder="Me" onChange={(e) => setMine(e.target.value)} />
          </div>
        ) : (
          <div className="field plain">
            <label htmlFor="whose-name">Their name</label>
            <input id="whose-name" autoComplete="off" value={theirs} placeholder="For example, Maya" onChange={(e) => setTheirs(e.target.value)} />
          </div>
        )}
        <p className="muted small">It goes on the pattern. You can keep measurements for more than one person and switch between them.</p>
        <button type="button" className="primary" disabled={whose === 'other' && !theirs.trim()} onClick={() => onDone(whose, whose === 'mine' ? mine : theirs)}>
          Save and style the {GARMENT_NAME[garment]}
        </button>
      </section>
    </div>
  );
}
