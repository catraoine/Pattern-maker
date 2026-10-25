import { Check, Garment, MeasurementId, MeasurementValues, Unit, fieldsFor, secondLooks, worded } from '../measurements';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { GARMENT_NAME } from '../measureFlow';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { ME, formOf, type Account, type Person } from '../account';
import { DoubleChecks } from './MeasureStepsScreen';

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
  /** Opens the choice of form to draft on (womenswear or menswear). */
  onChangeForm?: () => void;
}

const show = (cm: number, unit: Unit) => (unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);

// The Measure step once measuring is done: just this garment's measurements, like the check page, and a
// tap on one opens its own page with the drawing and how-to. One button goes on; the garment sits in a small
// label above the title with a quiet way to make something else, and a closer fit is the list's last row.
export function MeasureScreen({ account, onSwitchPerson, onAddPerson, profile, garment, onChooseGarment, unit, values, checks, canContinue, onNext, onMeasure, notice, onChangeForm }: Props) {
  const form = formOf(account.people.find((p) => p.id === account.active)!);
  const fields = fieldsFor(garment, form);
  // The height always has a row (Add, until it is taken), but a draft doesn't wait for it: older profiles have none.
  const rows = fields.filter((f) => f.id === 'height' || !f.optional || values[f.id] !== undefined);
  const extra = fields.filter((f) => f.id !== 'height' && f.optional && values[f.id] === undefined);
  const missing = rows.filter((f) => f.id !== 'height' && values[f.id] === undefined);
  const wrong = (id: MeasurementId) => checks.find((c) => c.id === id && c.level === 'error' && values[id] !== undefined);
  const problem = rows.map((f) => wrong(f.id)).find(Boolean);
  // Numbers that could be right but don't agree with the rest: marked on their row and explained under the list.
  const doubts = checks.filter((c) => c.level === 'warning' && values[c.id] !== undefined && rows.some((f) => f.id === c.id));
  const doubtful = (id: MeasurementId) => doubts.some((c) => c.id === id);
  // Once everything is in and nothing is off: the few numbers worth one more look, each a tap from its page.
  const looks = missing.length || problem ? [] : secondLooks(values, garment, form).filter((c) => !doubtful(c.id) && !doubtful(c.with) && values[c.id] !== undefined).slice(0, 3);

  return (
    <div className="welcome">
      <section className="card welcome-card measure-list" aria-labelledby="mtitle">
        {notice && (
          <p className="msg" role="status">
            {notice}
          </p>
        )}
        <p className="garment-eyebrow">
          <span>{GARMENT_NAME[garment]}</span>
          <GarmentSwitch onChoose={onChooseGarment} label="Make something else" />
        </p>
        <h1 id="mtitle">{account.active === ME ? 'Your' : `${profile}'s`} measurements</h1>
        {account.people.length > 1 && <PeopleSwitch account={account} onSwitch={onSwitchPerson} onAdd={onAddPerson} />}
        <ul className="check-list" aria-label="Tap one to measure it again">
          {onChangeForm && (
            <li>
              <button type="button" onClick={onChangeForm}>
                <span>Form</span>
                <span>{form === 'menswear' ? 'Menswear' : 'Womenswear'}</span>
              </button>
            </li>
          )}
          {rows.map((f) => {
            const v = values[f.id];
            return (
              <li key={f.id}>
                <button type="button" onClick={() => onMeasure([f.id])}>
                  <span>{worded(f.label, form)}</span>
                  {v === undefined ? <em className="add">Add</em> : wrong(f.id) ? <em className="add">Check</em> : doubtful(f.id) ? <span className="doubtful">{show(v, unit)}</span> : <span>{show(v, unit)}</span>}
                </button>
              </li>
            );
          })}
          {extra.length > 0 && !missing.length && (
            <li className="closer">
              <button type="button" onClick={() => onMeasure(extra.map((f) => f.id))}>
                <span>
                  Add {extra.length} more for a closer fit
                </span>
              </button>
            </li>
          )}
        </ul>
        {problem && <p className="msg error">{problem.message}</p>}
        {!problem && <DoubleChecks checks={doubts} />}
        {looks.length > 0 && (
          <div className="second-looks" role="status" aria-labelledby="looks-title">
            <p id="looks-title" className="eyebrow">
              Worth a second look
            </p>
            {looks.map((c) => (
              <div key={`${c.id}-${c.with}`} className="msg small doubt">
                <p>{c.message}</p>
                <button type="button" className="link" onClick={() => onMeasure(c.with === 'height' ? [c.id] : [c.id, c.with])}>
                  Measure again
                </button>
              </div>
            ))}
          </div>
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
