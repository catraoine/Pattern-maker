import { useState } from 'react';
import { checkMeasurements, FIELDS, type Garment, type MeasurementValues, type Unit } from '../measurements';
import { TapeDemo } from '../ui/ContourForm';

interface Props {
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  /** Back from the first measurement. */
  onBack: () => void;
  /** After the last measurement. */
  onDone: () => void;
}

const toDisplay = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '' : String(unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10);

// First-time measuring, one measurement per page, laid out like the welcome: the form on top with the tape
// showing where to measure, then a line of how-to, the box to type it in with cm / in under it, and Next.
// The optional measurements are left for the full measurements screen.
export function MeasureStepsScreen({ garment, unit, values, onUnit, onValues, onBack, onDone }: Props) {
  const fields = FIELDS[garment].filter((f) => !f.optional);
  const [at, setAt] = useState(() => Math.max(0, fields.findIndex((f) => values[f.id] === undefined)));
  const [text, setText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const field = fields[Math.min(at, fields.length - 1)];
  const next = fields[at + 1];
  const value = values[field.id];
  const problems = checkMeasurements(values, unit, garment).filter((c) => c.id === field.id);
  const error = problems.find((c) => c.level === 'error');
  const note = value !== undefined ? (error ?? problems[0]) : tried ? { level: 'error', message: `Enter your ${field.label.toLowerCase()} to carry on.` } : undefined;

  const go = (to: number) => {
    setText(null);
    setTried(false);
    if (to < 0) onBack();
    else if (to >= fields.length) onDone();
    else setAt(to);
  };

  const type = (t: string) => {
    setText(t);
    const n = parseFloat(t.replace(',', '.'));
    const v = { ...values };
    if (Number.isNaN(n)) delete v[field.id];
    else v[field.id] = Math.round((unit === 'cm' ? n : n * 2.54) * 10) / 10;
    onValues(v);
  };

  const submit = () => {
    if (value === undefined || error) setTried(true);
    else go(at + 1);
  };

  return (
    <div className="welcome">
      <section className="card welcome-card measure-step" aria-labelledby="stitle">
        <div className="welcome-top">
          <button type="button" className="back-arrow" aria-label="Back" onClick={() => go(at - 1)}>
            ←
          </button>
          <div className="dots" aria-hidden="true">
            {fields.map((f, i) => (
              <span key={f.id} className={i <= at ? 'dot on' : 'dot'} />
            ))}
          </div>
        </div>

        <div className="welcome-hero">
          <TapeDemo key={field.id} id={field.id} name={field.label} />
        </div>
        <p className="eyebrow">
          Made to measure · {at + 1} of {fields.length}
        </p>
        <h1 id="stitle">{at === 0 ? "First, let's take your measurements." : field.label}</h1>
        <p className="muted step-tip">{field.tip}</p>

        <form
          className="measure-entry"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className={note?.level === 'error' ? 'entry-box error' : 'entry-box'}>
            <label htmlFor="step-value">{field.label}</label>
            <div className="entry-row">
              <input
                id="step-value"
                key={field.id}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint={next ? 'next' : 'done'}
                value={text ?? toDisplay(value, unit)}
                aria-invalid={note?.level === 'error' ? true : undefined}
                aria-describedby={note ? 'step-msg' : undefined}
                onChange={(e) => type(e.target.value)}
              />
              <span className="entry-unit">{unit}</span>
            </div>
          </div>
          {note && (
            <p id="step-msg" className={note.level === 'error' ? 'msg error' : 'msg'}>
              {note.message}
            </p>
          )}
          <div className="unit-switch" role="group" aria-label="Units">
            {(['cm', 'in'] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                className={unit === u ? 'on' : ''}
                onClick={() => {
                  setText(null);
                  onUnit(u);
                }}
              >
                {u === 'cm' ? 'Centimetres' : 'Inches'}
              </button>
            ))}
          </div>

          <button type="submit" className="primary step-next">
            {next ? `Next · ${next.label}` : `Next: style your ${garment}`}
          </button>
        </form>
      </section>
    </div>
  );
}
