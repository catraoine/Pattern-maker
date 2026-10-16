import { Fragment, useState } from 'react';
import { Check, FIELDS, Garment, MeasurementId, MeasurementValues, Unit } from '../measurements';
import { TapeFigure } from '../ui/TapeFigure';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { ME, type Account, type Person } from '../account';

interface Props {
  account: Account & { people: Person[]; active: string };
  onSwitchPerson: (id: string) => void;
  onAddPerson: (name: string) => void;
  profile: string;
  garment: Garment;
  onGarment: (g: Garment) => void;
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

export function MeasureScreen({ account, onSwitchPerson, onAddPerson, profile, garment, onGarment, unit, values, checks, onUnit, onValues, onExample, canContinue, onNext }: Props) {
  const fields = FIELDS[garment];
  const [focusId, setFocus] = useState<MeasurementId>(fields[0].id);
  // Raw text per field while typing, so "72." doesn't get rewritten mid-entry.
  const [draftText, setDraftText] = useState<Partial<Record<MeasurementId, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<MeasurementId, boolean>>>({});
  // Switching garment can leave the focused field behind; fall back to the first one.
  const current = fields.find((f) => f.id === focusId) ?? fields[0];
  const focus = current.id;

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
        <TapeFigure field={focus} onPick={setFocus} ids={fields.map((f) => f.id)} />
        <p key={focus} className="tip">
          {current.tip}
        </p>
        <div className="row between wrap">
          <p className="muted small">Tap the form to see how to measure each part.</p>
          <button type="button" className="ghost" onClick={() => document.getElementById(focus)?.focus()}>
            Enter {current.label.toLowerCase()}
          </button>
        </div>
        <p className="muted small">Wear close-fitting clothes and keep the tape snug but not tight. A helper makes it easier.</p>
      </section>

      <section className="card grow" aria-labelledby="mtitle">
        <div className="row between wrap">
          <div>
            <p className="muted small">{{ skirt: 'Skirt', trousers: 'Trousers', bodice: 'Bodice', dress: 'Dress' }[garment]} measurements</p>
            <h1 id="mtitle">{account.active === ME ? 'Your measurements' : `${profile}'s measurements`}</h1>
          </div>
          <GarmentSwitch garment={garment} onGarment={onGarment} />
          <div className="seg" role="group" aria-label="Units">
            {(['cm', 'in'] as Unit[]).map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => switchUnit(u)}>
                {u === 'cm' ? 'cm' : 'inches'}
              </button>
            ))}
          </div>
        </div>
        <PeopleSwitch account={account} onSwitch={onSwitchPerson} onAdd={onAddPerson} />

        <div className="fields">
          {fields.map((f, i) => {
            const problems = checks.filter((c) => c.id === f.id && (touched[f.id] || values[f.id] !== undefined));
            const err = problems.find((c) => c.level === 'error');
            // Posture measurements come last, under their own heading.
            const firstFit = f.fit && !fields[i - 1]?.fit;
            return (
              <Fragment key={f.id}>
              {firstFit && (
                <div className="fields-head">
                  <p className="eyebrow">For a closer fit</p>
                  <p className="muted small">
                    Optional. These read your posture, the way a fitter would: the pattern is adjusted where you differ from the standard.
                  </p>
                </div>
              )}
              <div className={focus === f.id ? 'field focus' : 'field'}>
                <label htmlFor={f.id}>
                  {f.label}
                  {f.optional && !f.fit && <span className="muted"> (optional)</span>}
                </label>
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
              </Fragment>
            );
          })}
        </div>

        <div className="row between wrap footer">
          {/* Examples only fill gaps, so measurements already taken for the other garment are kept. */}
          {/* Posture measurements have no example: they only help when they are your own. */}
          {fields.some((f) => !f.fit && values[f.id] === undefined) ? (
            <button type="button" className="link" onClick={onExample}>
              {fields.some((f) => values[f.id] !== undefined) ? 'Fill the gaps with example measurements' : 'Fill in example measurements'}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="primary" disabled={!canContinue} onClick={onNext}>
            Next: style your {garment}
          </button>
        </div>
      </section>
    </div>
  );
}
