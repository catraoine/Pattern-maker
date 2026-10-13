import { useState } from 'react';
import { Check, MeasurementId, MeasurementValues, SKIRT_FIELDS, Unit } from '../measurements';
import { TapeFigure } from '../ui/TapeFigure';

interface Props {
  unit: Unit;
  values: MeasurementValues;
  checks: Check[];
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  onExample: () => void;
  canContinue: boolean;
  onNext: () => void;
}

const toDisplay = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '' : String(unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10);

export function MeasureScreen({ unit, values, checks, onUnit, onValues, onExample, canContinue, onNext }: Props) {
  const [focus, setFocus] = useState<MeasurementId>('waist');
  // Raw text per field while typing, so "72." doesn't get rewritten mid-entry.
  const [draftText, setDraftText] = useState<Partial<Record<MeasurementId, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<MeasurementId, boolean>>>({});
  const current = SKIRT_FIELDS.find((f) => f.id === focus)!;

  const setField = (id: MeasurementId, text: string) => {
    setDraftText({ ...draftText, [id]: text });
    const n = parseFloat(text.replace(',', '.'));
    const next = { ...values };
    if (Number.isNaN(n)) delete next[id];
    else next[id] = Math.round((unit === 'cm' ? n : n * 2.54) * 10) / 10;
    onValues(next);
  };

  const switchUnit = (u: Unit) => {
    setDraftText({});
    onUnit(u);
  };

  return (
    <div className="split">
      <section className="card help" aria-label="How to measure">
        <p className="eyebrow">How to measure</p>
        <h2>{current.label}</h2>
        <TapeFigure field={focus} />
        <p>{current.tip}</p>
        <p className="muted small">Wear close-fitting clothes and keep the tape snug but not tight. A helper makes it easier.</p>
      </section>

      <section className="card grow" aria-labelledby="mtitle">
        <div className="row between wrap">
          <div>
            <p className="muted small">Profile: Me · Skirt measurements</p>
            <h1 id="mtitle">Your measurements</h1>
          </div>
          <div className="seg" role="group" aria-label="Units">
            {(['cm', 'in'] as Unit[]).map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => switchUnit(u)}>
                {u === 'cm' ? 'cm' : 'inches'}
              </button>
            ))}
          </div>
        </div>

        <div className="fields">
          {SKIRT_FIELDS.map((f) => {
            const problems = checks.filter((c) => c.id === f.id && (touched[f.id] || values[f.id] !== undefined));
            const err = problems.find((c) => c.level === 'error');
            return (
              <div key={f.id} className={focus === f.id ? 'field focus' : 'field'}>
                <label htmlFor={f.id}>{f.label}</label>
                <div className="row">
                  <input
                    id={f.id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={draftText[f.id] ?? toDisplay(values[f.id], unit)}
                    aria-invalid={err && touched[f.id] ? true : undefined}
                    aria-describedby={problems.length ? `${f.id}-msg` : undefined}
                    onFocus={() => setFocus(f.id)}
                    onBlur={() => setTouched({ ...touched, [f.id]: true })}
                    onChange={(e) => setField(f.id, e.target.value)}
                  />
                  <span className="unit">{unit}</span>
                </div>
                {problems.length > 0 && touched[f.id] && (
                  <p id={`${f.id}-msg`} className={err ? 'msg error' : 'msg'}>
                    {(err ?? problems[0]).message}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="row between wrap footer">
          <button type="button" className="link" onClick={onExample}>
            Fill in example measurements
          </button>
          <button type="button" className="primary" disabled={!canContinue} onClick={onNext}>
            Next: style your skirt
          </button>
        </div>
      </section>
    </div>
  );
}
