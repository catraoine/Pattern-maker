import { Check, Garment, MeasurementId, MeasurementValues, Unit, fieldsFor, worded } from '../measurements';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { GARMENT_NAME } from '../measureFlow';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { ME, formOf, type Account, type Person } from '../account';

interface Props {
  account: Account & { people: Person[]; active: string };
  onSwitchPerson: (id: string) => void;
  onAddPerson: (name: string) => void;
  profile: string;
  garment: Garment;
  onChooseGarment: () => void;
  unit: Unit;
  values: MeasurementValues;
  checks: Check[];
  canContinue: boolean;
  onNext: () => void;
  /** Take these measurements on their own pages (one to redo, or the ones still to take), then come back. */
  onMeasure: (ids: MeasurementId[]) => void;
  /** Why someone was sent back here, e.g. a bodice that still needs measurements. */
  notice?: string;
}

const show = (cm: number, unit: Unit) => (unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);

// The Measure step once measuring is done: just this garment's measurements, like the check page, and a
// tap on one opens its own page with the drawing and how-to. Picking another garment is a quiet link.
export function MeasureScreen({ account, onSwitchPerson, onAddPerson, profile, garment, onChooseGarment, unit, values, checks, canContinue, onNext, onMeasure, notice }: Props) {
  const form = formOf(account.people.find((p) => p.id === account.active)!);
  const fields = fieldsFor(garment, form);
  const rows = fields.filter((f) => !f.optional || values[f.id] !== undefined);
  const extra = fields.filter((f) => f.optional && values[f.id] === undefined);
  const missing = rows.filter((f) => values[f.id] === undefined);
  const wrong = (id: MeasurementId) => checks.find((c) => c.id === id && c.level === 'error' && values[id] !== undefined);
  const problem = rows.map((f) => wrong(f.id)).find(Boolean);

  return (
    <div className="welcome">
      <section className="card welcome-card measure-list" aria-labelledby="mtitle">
        {notice && (
          <p className="msg" role="status">
            {notice}
          </p>
        )}
        <h1 id="mtitle">
          {account.active === ME ? 'Your' : `${profile}'s`} {GARMENT_NAME[garment]} measurements
        </h1>
        <GarmentSwitch onChoose={onChooseGarment} />
        {account.people.length > 1 && <PeopleSwitch account={account} onSwitch={onSwitchPerson} onAdd={onAddPerson} />}
        <ul className="check-list" aria-label="Tap one to measure it again">
          {rows.map((f) => {
            const v = values[f.id];
            return (
              <li key={f.id}>
                <button type="button" onClick={() => onMeasure([f.id])}>
                  <span>{worded(f.label, form)}</span>
                  {v === undefined ? <em className="add">Add</em> : wrong(f.id) ? <em className="add">Check</em> : <span>{show(v, unit)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {problem ? <p className="msg error">{problem.message}</p> : <p className="muted step-tip">Tap one to measure it again.</p>}
        {extra.length > 0 && !missing.length && (
          <button type="button" className="link quiet" onClick={() => onMeasure(extra.map((f) => f.id))}>
            Add measurements for a closer fit
          </button>
        )}
        {missing.length ? (
          <button type="button" className="primary" onClick={() => onMeasure(missing.map((f) => f.id))}>
            Continue measuring
          </button>
        ) : (
          <button type="button" className="primary" disabled={!canContinue} onClick={onNext}>
            Style your {GARMENT_NAME[garment]}
          </button>
        )}
      </section>
    </div>
  );
}
