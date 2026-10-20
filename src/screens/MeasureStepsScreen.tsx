import { useState, type ReactNode } from 'react';
import { FIELDS, checkMeasurements, type Check, type FormKind, type Garment, type MeasurementId, type MeasurementValues, type Unit } from '../measurements';
import { BASE, baseDone, fullSetMissing, GARMENT_NAME, GARMENTS, labelOf, missingFor, stepsOf, tipOf, titleOf } from '../measureFlow';
import { WEIGHT_HARD, WeightEntry, WeightLink, fromKg, weightUnitOf } from '../ui/WeightEntry';
import { FormPicture, TapeDemo } from '../ui/ContourForm';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { TapeBand } from '../ui/TapeBand';
import { estimateOne } from '../estimate';
import { Title } from '../ui/Title';
import type { PatternChoices } from '../garments';
import { ideaChoices, ideaRows, pieceGarment } from '../photo/idea';
import { isSwimIntimates } from '../photo/swim';
import { InterestCard } from '../ui/InterestCard';
import { MAX_IDEA_CHARS, type IdeaReading, type IdeaResponse, type PhotoError } from '../photo/types';
import { testerHeaders } from '../ui/TesterCode';

interface Props {
  /** Sent with an idea to read, for a fit tester's larger daily allowance. */
  testerCode?: string;
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  /** Their weight in kg, if given, and giving it: asked with the height, and only read against it to double-check the girths. */
  weight?: number;
  onWeight?: (kg: number | undefined) => void;
  /** Measured for this garment: on to styling it. */
  onDone: (garment: Garment) => void;
  /** Where to open. By default the start (or the check, once the base set is in). "choose" opens the list of what
   * to make; a garment opens on the first measurement it still needs; "redo" opens one measurement and comes back. */
  start?: StepsStart;
  /** Measuring someone else: their name, given on the first page, before any measurement is taken. */
  onSomeoneElse?: (name: string) => void;
  /** The measurements in use are someone else's, so every page is worded for the person holding the tape. */
  theirs?: boolean;
  /** Skip, at the end of the tape: try the app with example measurements (for the garment being measured). */
  onSkip?: (garment?: Garment) => void;
  /** The dress form this person's patterns are drafted on, and choosing it before the first measurement. */
  form?: FormKind;
  onForm?: (form: FormKind) => void;
  /** "Something else", described and matched to a garment: style it from these choices, measuring for it first. */
  onIdea?: (choices: PatternChoices) => void;
  /** "Or start from a photo" on the describe page. */
  onPhoto?: () => void;
  /** "Tell me when it's ready", for something the app can't make yet. */
  onNews?: () => void;
}

export type StepsStart = { kind: 'choose' } | { kind: 'form' } | { kind: 'for'; garment: Garment } | { kind: 'redo'; garment: Garment; ids: MeasurementId[] };

type Page =
  | { kind: 'intro' }
  | { kind: 'form' }
  | { kind: 'base'; at: number; back?: 'check' }
  | { kind: 'check' }
  | { kind: 'choose' }
  | { kind: 'extra'; garment: Garment | 'other'; ids: MeasurementId[]; at: number; redo?: boolean }
  | { kind: 'saved' }
  | { kind: 'describe' }
  | { kind: 'idea'; idea: IdeaReading };

/** Why a described idea couldn't be read, with the way forward. */
const IDEA_ERROR: Partial<Record<PhotoError, string>> = {
  limit_reached: "You've described five ideas today. Pick from the list for now, or try again tomorrow.",
  busy: 'Lots of people are describing ideas today. Pick from the list for now, or try again tomorrow.',
  declined: "We couldn't read that as something to wear. Try naming the garment you'd like to make.",
};

/** On the list of what to make: the garments, then "Something else", which is described in words. */
type Pick = Garment | 'other';

const toDisplay = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '' : String(unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10);
const shown = (cm: number | undefined, unit: Unit) => (cm === undefined ? '' : `${toDisplay(cm, unit)} ${unit}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** "a slip dress", "an evening coat"; plurals ("wide-leg trousers", "shorts") take no article. */
const aOrAn = (name: string) => (/(s|wear|lingerie)$/i.test(name) && !/dress$/i.test(name) ? name : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`);

// First-time measuring, laid out like the welcome. A short "before you start", then the base set one
// measurement per page, a check of those four, then what to make: pick one and Continue measuring goes
// straight to the first extra that garment still needs. "Something else" asks what they have in mind and
// answers "We can make that", "The closest we can do" or "Not yet" (Cat's pick, 2026-10-18); only "Not yet"
// offers the full set of measurements, for a dressmaker.
// The first page asks who you are designing for, since "Someone else" words every page for the person holding the
// tape and asks their name first (Cat's pick V2, 2026-10-17). A tape runs across the top of every page, with
// Skip at its end wherever measuring can be skipped.
export function MeasureStepsScreen({ testerCode, garment: current, unit, values, onUnit, onValues, weight, onWeight, onDone, start, onSomeoneElse, theirs, onSkip, form = 'womenswear', onForm, onIdea, onPhoto, onNews }: Props) {
  const aimed = start?.kind === 'for' ? start.garment : undefined;
  // Each page is a history entry, so the header's back and the phone's back go one page back.
  const [page, setPage] = usePageHistory<Page>(() => {
    if (start?.kind === 'redo') return { kind: 'extra', garment: start.garment, ids: start.ids, at: 0, redo: true };
    if (start?.kind === 'form') return { kind: 'form' };
    if (!baseDone(values)) return { kind: 'intro' };
    if (start?.kind === 'choose') return { kind: 'choose' };
    const ids = aimed ? missingFor(aimed, values, form).map((f) => f.id) : [];
    return ids.length ? { kind: 'extra', garment: aimed!, ids, at: 0 } : { kind: 'check' };
  });
  // Opened on the check because the measurements were taken on an earlier visit: say so.
  const [returning] = useState(() => !start && baseDone(values));
  const [helper, setHelper] = useState(!!theirs);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Pick | null>(start?.kind === 'choose' ? current : null);
  const [chosen, setChosen] = useState<FormKind>(form);

  const [idea, setIdea] = useState('');
  const [asking, setAsking] = useState(false);
  const [ideaError, setIdeaError] = useState<PhotoError>();

  /** Every measurement still to take, for a dressmaker. */
  const fullSet = () => {
    const ids = fullSetMissing(values, form).map((f) => f.id);
    setPage(ids.length ? { kind: 'extra', garment: 'other', ids, at: 0 } : { kind: 'saved' });
  };
  const go = (g: Pick) => {
    if (g === 'other') return setPage({ kind: 'describe' });
    const ids = missingFor(g, values, form).map((f) => f.id);
    if (ids.length) setPage({ kind: 'extra', garment: g, ids, at: 0 });
    else onDone(g);
  };
  const ask = async () => {
    setAsking(true);
    setIdeaError(undefined);
    try {
      const res = await fetch('/.netlify/functions/describe-idea', { method: 'POST', headers: { 'Content-Type': 'application/json', ...testerHeaders(testerCode) }, body: JSON.stringify({ text: idea.trim() }) });
      const data = (await res.json()) as IdeaResponse;
      if (data.ok) setPage({ kind: 'idea', idea: data.idea });
      else setIdeaError(data.error);
    } catch {
      setIdeaError('failed');
    } finally {
      setAsking(false);
    }
  };

  // The first page (Cat's F1 Form Joins In, 2026-10-18): who you're designing for and the dress form to draft on,
  // together, then Begin measuring. "Someone else" asks their name here, before any measurement is taken.
  if (page.kind === 'intro') {
    const begin = () => {
      if (helper) onSomeoneElse?.(name.trim());
      onForm?.(chosen);
      setPage({ kind: 'base', at: 0 });
    };
    return (
      <Shell title="First, let's take some measurements." skip={onSkip && (() => onSkip())}>
        <p className="muted step-tip">Grab a soft tape measure.</p>
        <div className="who" role="group" aria-labelledby="who-q">
          <p id="who-q" className="who-q">
            Who are you designing for?
          </p>
          <div className="who-pick">
            <button type="button" className="primary" aria-pressed={!helper} onClick={() => setHelper(false)}>
              Me
            </button>
            <button type="button" className="primary" aria-pressed={helper} onClick={() => setHelper(true)}>
              Someone else
            </button>
          </div>
        </div>
        {helper && (
          <div className="field plain ready">
            <label htmlFor="who-name">Name</label>
            <input id="who-name" autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {onForm && (
          <>
            <p className="who-q" id="form-q">
              Which form to draft on?
            </p>
            <div className="form-pick on-intro" role="radiogroup" aria-labelledby="form-q">
              {(['womenswear', 'menswear'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={chosen === k} className={chosen === k ? 'on' : ''} onClick={() => setChosen(k)}>
                  <FormPicture kind={k} />
                  <span>{k === 'womenswear' ? 'Womenswear' : 'Menswear'}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" className="primary" disabled={helper && !name.trim()} onClick={begin}>
          Begin measuring
        </button>
      </Shell>
    );
  }

  // Changing the dress form later, from the measurements list (Cat's B2 Two Forms; the first pick is on the
  // intro page). The menswear form asks for the chest and none of the bust measurements.
  if (page.kind === 'form')
    return (
      <Shell title={helper ? 'Their form' : 'Your form'} skip={start?.kind !== 'form' && onSkip ? () => onSkip() : undefined}>
        <p className="who-q" id="form-q">
          Which form should we draft on?
        </p>
        <div className="form-pick" role="radiogroup" aria-labelledby="form-q">
          {(['womenswear', 'menswear'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={chosen === k} className={chosen === k ? 'on' : ''} onClick={() => setChosen(k)}>
              <FormPicture kind={k} />
              <span>{k === 'womenswear' ? 'Womenswear' : 'Menswear'}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => {
            onForm?.(chosen);
            // Changed from the measurements list: back to it, where anything the new form needs shows as Add.
            if (start?.kind === 'form' && canGoBack()) goBack();
            else setPage({ kind: 'base', at: 0 });
          }}
        >
          Continue
        </button>
      </Shell>
    );

  if (page.kind === 'check')
    return (
      <Shell eyebrow={returning ? 'Welcome back' : helper ? 'Their base measurements' : 'Your base measurements'} title="Do these look right?" hero={<TapeDemo id="waist" name="" mode="all" kind={form} />}>
        <p className="muted step-tip">
          {returning ? `${helper ? 'Their' : 'Your'} measurements are saved on this device. Check they still look right, then carry on. ` : ''}Tap a number to change it.
        </p>
        <ul className="check-list" aria-label="Tap one to change it">
          {BASE.map((id, at) => (
            <li key={id}>
              <button type="button" onClick={() => setPage({ kind: 'base', at, back: 'check' })}>
                <span>{cap(titleOf(id, false, form).replace(/^Your /, ''))}</span>
                {values[id] === undefined ? <em className="add">Add</em> : <span>{shown(values[id], unit)}</span>}
              </button>
            </li>
          ))}
          {weight !== undefined && (
            <li>
              <button type="button" onClick={() => setPage({ kind: 'base', at: 0, back: 'check' })}>
                <span>Weight</span>
                <span>{`${fromKg(weight, weightUnitOf(unit))} ${weightUnitOf(unit)}`}</span>
              </button>
            </li>
          )}
        </ul>
        <DoubleChecks checks={checkMeasurements(values, unit, 'dress', form, { weight }).filter((c) => c.level === 'warning' && BASE.includes(c.id))} />
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
      <Shell title="What would you like to make?" hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
        <div className="make-grid" role="radiogroup" aria-labelledby="stitle">
          {[...GARMENTS, 'other' as const].map((g) => (
            <button key={g} type="button" role="radio" aria-checked={picked === g} className={picked === g ? 'on' : ''} onClick={() => setPicked(g)}>
              {g === 'other' ? 'Something else' : cap(GARMENT_NAME[g])}
            </button>
          ))}
        </div>
        <button type="button" className="primary" disabled={!picked} onClick={() => picked && go(picked)}>
          {chooseLabel(picked, values, form)}
        </button>
      </Shell>
    );

  if (page.kind === 'describe')
    return (
      <Shell eyebrow="Something else" title="Tell us what you have in mind." hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
        <div className="field plain ready">
          <label htmlFor="idea">Describe it</label>
          <textarea id="idea" rows={3} maxLength={MAX_IDEA_CHARS} value={idea} onChange={(e) => setIdea(e.target.value)} />
        </div>
        <p className="muted step-tip">A few words is enough. Name the garment and anything you love about it.</p>
        {ideaError && (
          <p className="msg small" role="alert">
            {IDEA_ERROR[ideaError] ?? "We couldn't read that just now. Try again, or pick from the list."}
          </p>
        )}
        <div className="idea-actions">
          {onPhoto && (
            <button type="button" className="secondary" onClick={onPhoto}>
              Or start from a photo
            </button>
          )}
          <button type="button" className="primary" disabled={!idea.trim() || asking} onClick={ask}>
            {asking ? 'Reading your idea…' : 'See what we can make'}
          </button>
        </div>
      </Shell>
    );

  if (page.kind === 'idea') {
    const { idea: read } = page;
    const choices = ideaChoices(read);
    const back = () => (canGoBack() ? goBack() : setPage({ kind: 'describe' }));
    const choose = () => setPage({ kind: 'choose' });
    if ((!choices || !read.start) && isSwimIntimates(read.name))
      return (
        <Shell eyebrow="Coming next" title={`${cap(aOrAn(read.name))} ${/s$/i.test(read.name) && !/dress$/i.test(read.name) ? 'are' : 'is'} in our next drop.`} hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
          <InterestCard offer="swim" pattern={read.name} />
          <button type="button" className="secondary" onClick={fullSet}>
            Take my full measurements for a dressmaker
          </button>
          <p className="idea-again">
            <button type="button" className="link quiet" onClick={choose}>
              Choose something else
            </button>
          </p>
        </Shell>
      );
    if (!choices || !read.start)
      return (
        <Shell eyebrow="Not yet" title={`We can't draft ${aOrAn(read.name)} yet.`} hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
          {read.note && <p className="muted step-tip">{read.note}</p>}
          <p className="muted step-tip">We've noted that you asked for it.</p>
          <div className="idea-actions">
            <button type="button" className="secondary" onClick={fullSet}>
              Take my full measurements for a dressmaker
            </button>
            {onNews && (
              <button type="button" className="primary" onClick={onNews}>
                Tell me when it's ready
              </button>
            )}
          </div>
          <p className="idea-again">
            <button type="button" className="link quiet" onClick={choose}>
              Choose something else
            </button>
          </p>
        </Shell>
      );
    const g = pieceGarment(read.start);
    const more = missingFor(g, values, form).length;
    const closest = read.verdict === 'closest';
    return (
      <Shell eyebrow={closest ? 'The closest we can do' : 'We can make that'} title={`${cap(closest ? read.name : `${aOrAn(read.name)}`)}.`} hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
        {read.note && <p className="muted step-tip">{read.note}</p>}
        <ul className="check-list idea-picks" aria-label={`Your ${GARMENT_NAME[g]}`}>
          {ideaRows(choices).map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
        <p className="muted step-tip">{more ? `It needs ${more} more measurement${more === 1 ? '' : 's'}.` : 'You can change any of it when you style it.'}</p>
        <button type="button" className="primary" onClick={() => onIdea?.(choices)}>
          {more ? `Next: ${more} ${GARMENT_NAME[g]} measurement${more === 1 ? '' : 's'}` : `Style your ${GARMENT_NAME[g]}`}
        </button>
        <p className="idea-again">
          <button type="button" className="link quiet" onClick={closest ? choose : back}>
            {closest ? 'Choose something else' : 'Not quite it? Describe it again'}
          </button>
        </p>
      </Shell>
    );
  }

  if (page.kind === 'saved')
    return (
      <Shell eyebrow="Full set" title="Every measurement is saved." hero={<TapeDemo id="waist" name="" mode="all" kind={form} />}>
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
  const eyebrow = `${page.kind === 'base' ? '' : g === 'other' ? 'Full set · ' : `${cap(GARMENT_NAME[g!])} · `}${at + 1} of ${ids.length}`;
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
      form={form}
      unit={unit}
      values={values}
      garment={g && g !== 'other' ? g : current}
      onUnit={onUnit}
      onValues={onValues}
      weight={weight}
      onWeight={onWeight}
      onNext={next}
      label={label}
      skip={onSkip && !(page.kind === 'base' && page.back) && !(page.kind === 'extra' && page.redo) ? () => onSkip(g && g !== 'other' ? g : undefined) : undefined}
      skipRest={!(page.kind === 'base' && at === 0)}
      canEstimate={page.kind === 'extra'}
    />
  );
}

/** The measurements that could be right but don't quite agree with the rest, each with how to take it again. Nothing stops here. */
export function DoubleChecks({ checks }: { checks: Check[] }) {
  if (!checks.length) return null;
  return (
    <div className="double-checks" role="status">
      {checks.map((c) => (
        <p key={`${c.id}-${c.message}`} className="msg small doubt">
          {c.message}
        </p>
      ))}
    </div>
  );
}

/** What the button on "What would you like to make?" leads to, so it reads as the next step. */
function chooseLabel(picked: Pick | null, values: MeasurementValues, form: FormKind): string {
  if (!picked) return 'Choose a garment';
  if (picked === 'other') return 'Next: describe it';
  const n = missingFor(picked, values, form).length;
  return n ? `Next: ${n} ${GARMENT_NAME[picked]} measurement${n === 1 ? '' : 's'}` : `Style my ${GARMENT_NAME[picked]}`;
}

export function Shell({
  eyebrow,
  title,
  hero,
  dots,
  short,
  skip,
  skipRest,
  children,
}: {
  /** A small line above the title, only where it tells you something (which step, which garment). */
  eyebrow?: string;
  title: string;
  /** The picture under the tape; the first page has none, so it opens on the words. */
  hero?: ReactNode;
  /** Skip at the end of the tape. */
  skip?: () => void;
  /** Some measurements are taken already, so Skip fills in only the rest. */
  skipRest?: boolean;
  dots?: [number, number];
  /** A shorter form on top, so a longer list fits above its button. */
  short?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="welcome">
      <section className={short ? 'card welcome-card measure-step short' : 'card welcome-card measure-step'} aria-labelledby="stitle">
        <TapeBand onSkip={skip} rest={skipRest} />
        {hero && (
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
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <ShellTitle text={title} />
        {children}
      </section>
    </div>
  );
}

/** "First, let's take some measurements." reads as FIRST, with the rest as the label under it. */
function ShellTitle({ text }: { text: string }) {
  const cut = text.indexOf(', ');
  return cut > 0 && cut < 12 ? <Title id="stitle" big={text.slice(0, cut + 1)} label={text.slice(cut + 2)} /> : <h1 id="stitle">{text}</h1>;
}

export function MeasurePage({
  id,
  eyebrow,
  dots,
  helper,
  form,
  unit,
  values,
  garment,
  onUnit,
  onValues,
  weight,
  onWeight,
  onNext,
  label,
  skip,
  skipRest,
  canEstimate,
}: {
  id: MeasurementId;
  eyebrow: string;
  dots: [number, number];
  helper: boolean;
  form: FormKind;
  unit: Unit;
  values: MeasurementValues;
  garment: Garment;
  onUnit: (u: Unit) => void;
  onValues: (v: MeasurementValues) => void;
  /** On the height page: their weight too, if they like, which only ever double-checks the girths. */
  weight?: number;
  onWeight?: (kg: number | undefined) => void;
  onNext: () => void;
  label: string;
  skip?: () => void;
  skipRest?: boolean;
  /** A garment's own measurement, which can be estimated from the base ones when you're not sure. */
  canEstimate?: boolean;
}) {
  const fieldLabel = labelOf(id, form);
  const guess = canEstimate ? estimateOne(id, values, form) : undefined;
  const [estimated, setEstimated] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [how, setHow] = useState(false);
  // The weight, offered on the height page: its box opens from a link beside "How to do it".
  const askWeight = id === 'height' && !!onWeight;
  const [weightOpen, setWeightOpen] = useState(weight !== undefined);
  const value = values[id];
  // Range checks for this one measurement only; the cross-checks wait for the full measurements screen.
  // Checked as a garment that uses it, so a base measurement the skirt doesn't need (the bust) still is.
  const checkAs = FIELDS[garment].some((f) => f.id === id) ? garment : GARMENTS.find((g) => FIELDS[g].some((f) => f.id === id)) ?? garment;
  const problems = checkMeasurements({ [id]: value } as MeasurementValues, unit, checkAs, form).filter((c) => c.id === id && c.level === 'error' && value !== undefined);
  const error = problems[0];
  // A double-check against the rest (the height, the weight, the other lengths): said here, where the number is
  // typed, and never in the way. Only once the number could be right on its own.
  const doubt = !error && value !== undefined ? checkMeasurements(values, unit, checkAs, form, { weight }).find((c) => c.id === id && c.level === 'warning') : undefined;
  const note = error ?? (tried && value === undefined ? { level: 'error', message: `Enter ${helper ? 'their' : 'your'} ${fieldLabel.toLowerCase()} to carry on.` } : undefined);

  const type = (t: string) => {
    setText(t);
    setEstimated(false);
    const n = parseFloat(t.replace(',', '.'));
    const v = { ...values };
    if (Number.isNaN(n)) delete v[id];
    else v[id] = Math.round((unit === 'cm' ? n : n * 2.54) * 10) / 10;
    onValues(v);
  };

  return (
    <Shell eyebrow={eyebrow} title={titleOf(id, helper, form)} dots={dots} skip={skip} skipRest={skipRest} hero={<TapeDemo id={id} name={titleOf(id, false, form).replace(/^Your /, '')} kind={form} />}>
      <p className="muted step-tip">{tipOf(id, helper, form)}</p>
      <p className="how-row">
        <button type="button" className="link quiet how-link" aria-expanded={how} onClick={() => setHow(true)}>
          How to do it
        </button>
        {askWeight && !weightOpen && <WeightLink onOpen={() => setWeightOpen(true)} />}
      </p>
      <form
        className="measure-entry"
        onSubmit={(e) => {
          e.preventDefault();
          const weightWrong = id === 'height' && weight !== undefined && (weight < WEIGHT_HARD[0] || weight > WEIGHT_HARD[1]);
          if (value === undefined || error || weightWrong) setTried(true);
          else onNext();
        }}
      >
        <div className={note ? 'entry-box error' : 'entry-box'}>
          <label htmlFor="step-value">{fieldLabel}</label>
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
            <span className="unit-switch" role="group" aria-label="Units">
              {(['cm', 'in'] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  aria-label={u === 'cm' ? 'Centimetres' : 'Inches'}
                  className={unit === u ? 'on' : ''}
                  onClick={() => {
                    setText(null);
                    onUnit(u);
                  }}
                >
                  {u}
                </button>
              ))}
            </span>
          </div>
        </div>
        {note && (
          <p id="step-msg" className="msg error">
            {note.message}
          </p>
        )}
        {doubt && (
          <p className="msg small doubt" role="status">
            {doubt.message}
          </p>
        )}
        {askWeight && weightOpen && <WeightEntry unit={unit} helper={helper} weight={weight} onWeight={onWeight!} />}
        {estimated && value !== undefined ? (
          <p className="muted small estimate-note">Estimated from your other measurements. Swap in your own when you can, for a closer fit.</p>
        ) : (
          guess !== undefined &&
          value === undefined && (
            <button
              type="button"
              className="link quiet estimate-link"
              onClick={() => {
                setText(null);
                setTried(false);
                setEstimated(true);
                onValues({ ...values, [id]: guess });
              }}
            >
              Not sure? Estimate it for me
            </button>
          )
        )}
        <button type="submit" className="primary step-next">
          {label}
        </button>
      </form>
      {how && (
        <div className="how-sheet" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={() => setHow(false)}>
          <div className="how-panel" onClick={(e) => e.stopPropagation()}>
            <p id="how-title" className="eyebrow">
              How to measure {helper ? 'their' : 'your'} {(titleOf(id, false, form).replace(/^Your /, '') || fieldLabel).toLowerCase()}
            </p>
            <ol>
              {stepsOf(id, helper, form).map((s) => (
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
