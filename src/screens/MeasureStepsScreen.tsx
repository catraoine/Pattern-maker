import { useState, type ReactNode } from 'react';
import { FIELDS, checkMeasurements, type Garment, type MeasurementId, type MeasurementValues, type Unit } from '../measurements';
import { BASE, baseDone, fieldOf, fullSetMissing, GARMENT_NAME, GARMENTS, missingFor, stepsOf, tipOf, titleOf } from '../measureFlow';
import { TapeDemo } from '../ui/ContourForm';
import { FIRST_PROJECT } from '../mode';
import { canGoBack, goBack, usePageHistory } from '../nav';

interface Props {
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  /** Measured for this garment: on to styling it. */
  onDone: (garment: Garment) => void;
  /** Where to open. By default the start (or the check, once the base set is in). "choose" opens the list of what
   * to make; a garment opens on the first measurement it still needs; "redo" opens one measurement and comes back. */
  start?: StepsStart;
  /** Measuring someone else: their name, given on the first page, before any measurement is taken. */
  onSomeoneElse?: (name: string) => void;
  /** The measurements in use are someone else's, so every page is worded for the person holding the tape. */
  theirs?: boolean;
}

export type StepsStart = { kind: 'choose' } | { kind: 'for'; garment: Garment } | { kind: 'redo'; garment: Garment; ids: MeasurementId[] };

type Page =
  | { kind: 'intro' }
  | { kind: 'base'; at: number; back?: 'check' }
  | { kind: 'check' }
  | { kind: 'choose' }
  | { kind: 'extra'; garment: Garment | 'other'; ids: MeasurementId[]; at: number; redo?: boolean }
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
export function MeasureStepsScreen({ garment: current, unit, values, onUnit, onValues, onDone, start, onSomeoneElse, theirs }: Props) {
  const aimed = start?.kind === 'for' ? start.garment : undefined;
  // Each page is a history entry, so the header's back and the phone's back go one page back.
  const [page, setPage] = usePageHistory<Page>(() => {
    if (start?.kind === 'redo') return { kind: 'extra', garment: start.garment, ids: start.ids, at: 0, redo: true };
    if (!baseDone(values)) return { kind: 'intro' };
    if (start?.kind === 'choose') return { kind: 'choose' };
    const ids = aimed ? missingFor(aimed, values).map((f) => f.id) : [];
    return ids.length ? { kind: 'extra', garment: aimed!, ids, at: 0 } : { kind: 'check' };
  });
  // Opened on the check because the measurements were taken on an earlier visit: say so.
  const [returning] = useState(() => !start && baseDone(values));
  const [helper, setHelper] = useState(!!theirs);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Pick | null>(start?.kind === 'choose' ? current : null);

  const go = (g: Pick) => {
    const ids = (g === 'other' ? fullSetMissing(values) : missingFor(g, values)).map((f) => f.id);
    if (ids.length) setPage({ kind: 'extra', garment: g, ids, at: 0 });
    else if (g === 'other') setPage({ kind: 'saved' });
    else onDone(g);
  };

  if (page.kind === 'intro')
    return (
      <Shell title="First, let's take your measurements." eyebrow="Made to measure" helperTitle="First, let's take their measurements." helper={helper} hero={<TapeDemo id="waist" name="" mode="still" />}>
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
        {helper && (
          <div className="field plain ready">
            <label htmlFor="who-name">Name</label>
            <input id="who-name" autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="stack">
          <button
            type="button"
            className="primary"
            disabled={helper && !name.trim()}
            onClick={() => {
              if (helper) onSomeoneElse?.(name.trim());
              setPage({ kind: 'base', at: 0 });
            }}
          >
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
      <Shell eyebrow={returning ? 'Welcome back' : helper ? 'Their base measurements' : 'Your base measurements'} title="Do these look right?" hero={<TapeDemo id="waist" name="" mode="all" />}>
        {returning && <p className="muted step-tip">{helper ? 'Their' : 'Your'} measurements are saved on this device. Check they still look right, then carry on.</p>}
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
        {aimed ? (
          <button type="button" className="primary" onClick={() => go(aimed)}>
            Continue measuring
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => setPage({ kind: 'choose' })}>
            Choose what to make
          </button>
        )}
      </Shell>
    );

  if (page.kind === 'choose')
    return (
      <Shell eyebrow={start?.kind === 'choose' ? 'Choose another garment' : 'Made to measure'} title="What would you like to make?" hero={<TapeDemo id="waist" name="" mode="still" />} short>
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
      <Shell eyebrow="Full set" title="Every measurement is saved." hero={<TapeDemo id="waist" name="" mode="all" />}>
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
    (page.kind === 'base' && page.back === 'check') || (page.kind === 'extra' && page.redo && last) ? 'Save' : page.kind === 'extra' && page.redo ? 'Next' : page.kind === 'base' || g === 'other' ? (last ? 'Done' : 'Next') : last ? `Next: style your ${GARMENT_NAME[g!]}` : 'Next';
  const next = () => {
    // A redo from the check returns to it, the same as going back.
    if (page.kind === 'base' && page.back === 'check' && canGoBack()) goBack();
    // A redo from the measurements list goes back to the list, past every page it took.
    else if (page.kind === 'extra' && page.redo && last && canGoBack()) window.history.go(-(at + 1));
    else if (page.kind === 'base') setPage(last ? { kind: 'check' } : { ...page, at: at + 1 });
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
      onNext={next}
      label={label}
    />
  );
}

function Shell({
  eyebrow,
  title,
  helperTitle,
  helper,
  hero,
  dots,
  short,
  children,
}: {
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
  onNext: () => void;
  label: string;
}) {
  const field = fieldOf(id);
  const [text, setText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [how, setHow] = useState(false);
  const value = values[id];
  // Range checks for this one measurement only; the cross-checks wait for the full measurements screen.
  // Checked as a garment that uses it, so a base measurement the skirt doesn't need (the bust) still is.
  const checkAs = FIELDS[garment].some((f) => f.id === id) ? garment : GARMENTS.find((g) => FIELDS[g].some((f) => f.id === id)) ?? garment;
  const problems = checkMeasurements({ [id]: value } as MeasurementValues, unit, checkAs).filter((c) => c.id === id && c.level === 'error' && value !== undefined);
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
    <Shell eyebrow={eyebrow} title={titleOf(id, helper)} dots={dots} hero={<TapeDemo id={id} name={titleOf(id, false).replace(/^Your /, '')} />}>
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
