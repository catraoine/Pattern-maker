import { useState, type ReactNode } from 'react';
import { checkMeasurements, type Garment, type MeasurementId, type MeasurementValues, type Unit } from '../measurements';
import { BASE, baseDone, fieldOf, fullSetMissing, GARMENT_NAME, GARMENTS, missingFor, stepsOf, tipOf, titleOf } from '../measureFlow';
import { TapeDemo } from '../ui/ContourForm';
import { FIRST_PROJECT } from '../mode';

interface Props {
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  /** Back from the first page. */
  onBack: () => void;
  /** Measured for this garment: on to styling it. */
  onDone: (garment: Garment) => void;
}

type Page =
  | { kind: 'intro' }
  | { kind: 'base'; at: number; back?: 'check' }
  | { kind: 'check' }
  | { kind: 'choose' }
  | { kind: 'extra'; garment: Garment | 'other'; ids: MeasurementId[]; at: number }
  | { kind: 'saved' };

/** On the list of what to make: the garments, then "Something else", which takes the full set. */
type Pick = Garment | 'other';

const toDisplay = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '' : String(unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10);
const shown = (cm: number | undefined, unit: Unit) => (cm === undefined ? '' : `${toDisplay(cm, unit)} ${unit}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// First-time measuring, laid out like the welcome. A short "before you start", then the base set one
// measurement per page, a check of those four, then what to make: pick one and Continue measuring goes
// straight to the first extra that garment still needs. "Something else" takes every measurement.
// "Measuring someone else?" words every page for the person holding the tape.
export function MeasureStepsScreen({ garment: current, unit, values, onUnit, onValues, onBack, onDone }: Props) {
  const [page, setPage] = useState<Page>(() => (baseDone(values) ? { kind: 'check' } : { kind: 'intro' }));
  const [helper, setHelper] = useState(false);
  const [picked, setPicked] = useState<Pick | null>(null);

  const go = (g: Pick) => {
    const ids = (g === 'other' ? fullSetMissing(values) : missingFor(g, values)).map((f) => f.id);
    if (ids.length) setPage({ kind: 'extra', garment: g, ids, at: 0 });
    else if (g === 'other') setPage({ kind: 'saved' });
    else onDone(g);
  };

  if (page.kind === 'intro')
    return (
      <Shell onBack={onBack} title="First, let's take your measurements." eyebrow="About 4 minutes" helperTitle="First, let's take their measurements." helper={helper} hero={<TapeDemo id="waist" name="" mode="still" />}>
        <dl className="need">
          <div>
            <dt>You'll need</dt>
            <dd>A soft tape measure</dd>
          </div>
          <div>
            <dt>{helper ? 'They wear' : 'Wear'}</dt>
            <dd>Close-fitting clothes</dd>
          </div>
        </dl>
        <div className="stack">
          <button type="button" className="primary" onClick={() => setPage({ kind: 'base', at: 0 })}>
            Start measuring
          </button>
          <button type="button" className="link quiet" aria-pressed={helper} onClick={() => setHelper(!helper)}>
            {helper ? 'Measuring yourself?' : 'Measuring someone else?'}
          </button>
        </div>
      </Shell>
    );

  if (page.kind === 'check')
    return (
      <Shell onBack={() => setPage({ kind: 'base', at: BASE.length - 1 })} eyebrow={helper ? 'Their base measurements' : 'Your base measurements'} title="Do these look right?" hero={<TapeDemo id="waist" name="" mode="all" />}>
        <ul className="check-list" aria-label="Tap one to change it">
          {BASE.map((id, at) => (
            <li key={id}>
              <button type="button" onClick={() => setPage({ kind: 'base', at, back: 'check' })}>
                <span>{cap(titleOf(id, false).replace(/^Your /, ''))}</span>
                <span>{shown(values[id], unit)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="primary" onClick={() => setPage({ kind: 'choose' })}>
          Choose what to make
        </button>
      </Shell>
    );

  if (page.kind === 'choose')
    return (
      <Shell onBack={() => setPage({ kind: 'check' })} eyebrow="Made to measure" title="What would you like to make?" hero={<TapeDemo id="waist" name="" mode="still" />} short>
        <div className="pick-list" role="radiogroup" aria-labelledby="stitle">
          {[...GARMENTS, 'other' as const].map((g) => (
            <button key={g} type="button" role="radio" aria-checked={picked === g} className={picked === g ? 'on' : ''} onClick={() => setPicked(g)}>
              <span className="dot-pick" aria-hidden="true" />
              {g === 'other' ? 'Something else' : cap(GARMENT_NAME[g])}
              {g === FIRST_PROJECT.garment && <small className="badge first-project">First project</small>}
            </button>
          ))}
        </div>
        <p className="muted small">{FIRST_PROJECT.why}</p>
        <button type="button" className="primary" disabled={!picked} onClick={() => picked && go(picked)}>
          Continue measuring
        </button>
      </Shell>
    );

  if (page.kind === 'saved')
    return (
      <Shell onBack={() => setPage({ kind: 'choose' })} eyebrow="Full set" title="Every measurement is saved." hero={<TapeDemo id="waist" name="" mode="all" />}>
        <p className="muted step-tip">Pick something to make whenever you're ready. A dressmaker can work from these too.</p>
        <button type="button" className="primary" onClick={() => setPage({ kind: 'choose' })}>
          Choose what to make
        </button>
      </Shell>
    );

  // One measurement
  const ids = page.kind === 'base' ? BASE : page.ids;
  const at = page.at;
  const id = ids[at];
  const last = at === ids.length - 1;
  const g = page.kind === 'extra' ? page.garment : null;
  const eyebrow = page.kind === 'base' ? `${at + 1} of ${ids.length}` : g === 'other' ? 'Full set' : cap(GARMENT_NAME[g!]);
  const label =
    page.kind === 'base' && page.back === 'check' ? 'Save' : page.kind === 'base' || g === 'other' ? (last ? 'Done' : 'Next') : last ? `Next: style your ${GARMENT_NAME[g!]}` : 'Next';
  const back = () => {
    if (page.kind === 'base') setPage(page.back === 'check' ? { kind: 'check' } : at ? { ...page, at: at - 1 } : { kind: 'intro' });
    else setPage(at ? { ...page, at: at - 1 } : { kind: 'choose' });
  };
  const next = () => {
    if (page.kind === 'base') setPage(page.back === 'check' || last ? { kind: 'check' } : { ...page, at: at + 1 });
    else if (last) {
      if (page.garment === 'other') setPage({ kind: 'saved' });
      else onDone(page.garment);
    }
    else setPage({ ...page, at: at + 1 });
  };

  return (
    <MeasurePage
      key={`${page.kind}-${id}`}
      id={id}
      eyebrow={eyebrow}
      dots={[ids.length, at]}
      helper={helper}
      unit={unit}
      values={values}
      garment={g && g !== 'other' ? g : current}
      onUnit={onUnit}
      onValues={onValues}
      onBack={back}
      onNext={next}
      label={label}
    />
  );
}

function Shell({
  onBack,
  eyebrow,
  title,
  helperTitle,
  helper,
  hero,
  dots,
  short,
  children,
}: {
  onBack: () => void;
  eyebrow: string;
  title: string;
  helperTitle?: string;
  helper?: boolean;
  hero: ReactNode;
  dots?: [number, number];
  /** A shorter form on top, so a longer list fits above its button. */
  short?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="welcome">
      <section className={short ? 'card welcome-card measure-step short' : 'card welcome-card measure-step'} aria-labelledby="stitle">
        <div className="welcome-hero">
          {hero}
          <div className="welcome-top">
            <button type="button" className="back-arrow" aria-label="Back" onClick={onBack}>
              ←
            </button>
            {dots && (
              <div className="dots" aria-hidden="true">
                {Array.from({ length: dots[0] }, (_, i) => (
                  <span key={i} className={i <= dots[1] ? 'dot on' : 'dot'} />
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="stitle">{helper && helperTitle ? helperTitle : title}</h1>
        {children}
      </section>
    </div>
  );
}

function MeasurePage({
  id,
  eyebrow,
  dots,
  helper,
  unit,
  values,
  garment,
  onUnit,
  onValues,
  onBack,
  onNext,
  label,
}: {
  id: MeasurementId;
  eyebrow: string;
  dots: [number, number];
  helper: boolean;
  unit: Unit;
  values: MeasurementValues;
  garment: Garment;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  onBack: () => void;
  onNext: () => void;
  label: string;
}) {
  const field = fieldOf(id);
  const [text, setText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [how, setHow] = useState(false);
  const value = values[id];
  // Range checks for this one measurement only; the cross-checks wait for the full measurements screen.
  const problems = checkMeasurements({ [id]: value } as MeasurementValues, unit, garment).filter((c) => c.id === id && c.level === 'error' && value !== undefined);
  const error = problems[0];
  const note = error ?? (tried && value === undefined ? { level: 'error', message: `Enter ${helper ? 'their' : 'your'} ${field.label.toLowerCase()} to carry on.` } : undefined);

  const type = (t: string) => {
    setText(t);
    const n = parseFloat(t.replace(',', '.'));
    const v = { ...values };
    if (Number.isNaN(n)) delete v[id];
    else v[id] = Math.round((unit === 'cm' ? n : n * 2.54) * 10) / 10;
    onValues(v);
  };

  return (
    <Shell onBack={onBack} eyebrow={eyebrow} title={titleOf(id, helper)} dots={dots} hero={<TapeDemo id={id} name={titleOf(id, false).replace(/^Your /, '')} />}>
      <p className="muted step-tip">{tipOf(id, helper)}</p>
      <button type="button" className="link quiet how-link" aria-expanded={how} onClick={() => setHow(true)}>
        How to do it
      </button>
      <form
        className="measure-entry"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === undefined || error) setTried(true);
          else onNext();
        }}
      >
        <div className={note ? 'entry-box error' : 'entry-box'}>
          <label htmlFor="step-value">{field.label}</label>
          <div className="entry-row">
            <input
              id="step-value"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              value={text ?? toDisplay(value, unit)}
              aria-invalid={note ? true : undefined}
              aria-describedby={note ? 'step-msg' : undefined}
              onChange={(e) => type(e.target.value)}
            />
            <span className="entry-unit">{unit}</span>
          </div>
        </div>
        {note && (
          <p id="step-msg" className="msg error">
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
          {label}
        </button>
      </form>
      {how && (
        <div className="how-sheet" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={() => setHow(false)}>
          <div className="how-panel" onClick={(e) => e.stopPropagation()}>
            <p id="how-title" className="eyebrow">
              How to measure {helper ? 'their' : 'your'} {(titleOf(id, false).replace(/^Your /, '') || field.label).toLowerCase()}
            </p>
            <ol>
              {stepsOf(id, helper).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <button type="button" className="primary" autoFocus onClick={() => setHow(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
