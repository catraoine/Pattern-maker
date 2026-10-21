import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FIELDS, checkMeasurements, type Check, type FormKind, type Garment, type MeasurementId, type MeasurementValues, type Unit } from '../measurements';
import { BASE, baseDone, fullSetMissing, GARMENT_NAME, GARMENTS, labelOf, missingFor, stepsOf, tipOf, titleOf } from '../measureFlow';
import { WEIGHT_HARD, WeightEntry, fromKg, weightUnitOf } from '../ui/WeightEntry';
import { FormPicture, TapeDemo } from '../ui/ContourForm';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { estimateOne } from '../estimate';
import { Title } from '../ui/Title';
import type { PatternChoices } from '../garments';
import { IN_TESTING, inTesting } from '../launch';
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
  /** Skip, the quiet link under the button: try the app with example measurements (for the garment being measured). */
  onSkip?: (garment?: Garment) => void;
  /** Finish later: stop measuring, keeping what's in, and pick up at the first one still to take. */
  onLater?: () => void;
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
  | { kind: 'weight'; back?: 'check' }
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
/** A height in feet and inches, for the two boxes. */
const ftOf = (cm: number) => String(Math.floor(Math.round((cm / 2.54) * 10) / 10 / 12));
const inOf = (cm: number) => String(Math.round(((cm / 2.54) % 12) * 10) / 10 % 12);
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
// tape and asks their name first (Cat's pick V2, 2026-10-17). A quiet "Measure later" in capitals sits under the
// button wherever measuring can be skipped.
export function MeasureStepsScreen({ testerCode, garment: current, unit, values, onUnit, onValues, weight, onWeight, onDone, start, onSomeoneElse, theirs, onSkip, onLater, form = 'womenswear', onForm, onIdea, onPhoto, onNews }: Props) {
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

  /** Back after Finish later: on at the first base measurement still to take. */
  const firstToTake = () => Math.max(0, BASE.findIndex((m) => values[m] === undefined));
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
      setPage({ kind: 'base', at: firstToTake() });
    };
    return (
      // Cat's R1 Two Switches (2026-10-21): the body alone, then two switches of the same kind, for the form and
      // for whom, Begin, and Measure later in quiet capitals. No underlined links.
      <Shell title="First, let's take some measurements.">
        {onForm && (
          <div className="form-taped">
            <FormPicture kind={chosen} />
            <LandedTape />
          </div>
        )}
        {onForm && (
          <div className="switch" role="radiogroup" aria-label="Which form to draft on?">
            {(['womenswear', 'menswear'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={chosen === k} onClick={() => setChosen(k)}>
                {k === 'womenswear' ? 'Womenswear' : 'Menswear'}
                {k === 'menswear' && <span className="testing-tag">{IN_TESTING}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="switch" role="radiogroup" aria-label="Who are you designing for?">
          <button type="button" role="radio" aria-checked={!helper} onClick={() => setHelper(false)}>
            For me
          </button>
          <button type="button" role="radio" aria-checked={helper} onClick={() => setHelper(true)}>
            Someone else
          </button>
        </div>
        {helper && (
          <div className="field plain ready">
            <label htmlFor="who-name">Name</label>
            <input id="who-name" autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <button type="button" className="primary" disabled={helper && !name.trim()} onClick={begin}>
          Begin measuring
        </button>
        {onSkip && (
          <button type="button" className="later" onClick={() => onSkip()}>
            Measure later
          </button>
        )}
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
                  {k === 'menswear' && <span className="testing-tag">{IN_TESTING}</span>}
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
            else setPage({ kind: 'base', at: firstToTake() });
          }}
        >
          Continue
        </button>
      </Shell>
    );

  // Weight on its own page after the five basics (Cat, 2026-10-20): why it's asked, kg or lb, and a skip.
  if (page.kind === 'weight') {
    const wrong = weight !== undefined && (weight < WEIGHT_HARD[0] || weight > WEIGHT_HARD[1]);
    const done = () => (page.back && canGoBack() ? goBack() : setPage({ kind: 'check' }));
    return (
      <Shell eyebrow="Optional" title={helper ? 'Their weight' : 'Your weight'} hero={<TapeDemo id="waist" mode="still" kind={form} />} short>
        <p className="muted step-tip">
          It helps us catch a slipped tape or a wrong unit: we check {helper ? 'their' : 'your'} measurements against {helper ? 'their' : 'your'} height and weight before anything is drafted. It's never drafted from, shown on a pattern or sent anywhere.
        </p>
        <form
          className="measure-entry"
          onSubmit={(e) => {
            e.preventDefault();
            if (!wrong) done();
          }}
        >
          <WeightEntry unit={unit} helper={helper} weight={weight} onWeight={onWeight!} note={false} />
          <button type="submit" className="primary step-next">
            {page.back ? 'Save' : 'Next'}
          </button>
        </form>
        <button
          type="button"
          className="link quiet skip-link"
          onClick={() => {
            if (!page.back) onWeight?.(undefined);
            done();
          }}
        >
          {page.back ? 'Back' : 'Skip this step'}
        </button>
      </Shell>
    );
  }

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
          {onWeight && (
            <li>
              <button type="button" onClick={() => setPage({ kind: 'weight', back: 'check' })}>
                <span>Weight</span>
                {weight === undefined ? <em className="add">Add</em> : <span>{`${fromKg(weight, weightUnitOf(unit))} ${weightUnitOf(unit)}`}</span>}
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
              {g !== 'other' && inTesting(g) && <span className="testing-tag">{IN_TESTING}</span>}
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
    (page.kind === 'base' && page.back === 'check') || (page.kind === 'extra' && page.redo && last) ? 'Save' : page.kind === 'extra' && page.redo ? 'Next' : page.kind === 'base' ? (last && !onWeight ? 'Done' : 'Next') : g === 'other' ? (last ? 'Done' : 'Next') : last ? `Next: style your ${GARMENT_NAME[g!]}` : 'Next';
  const next = () => {
    // A redo from the check returns to it, the same as going back.
    if (page.kind === 'base' && page.back === 'check' && canGoBack()) goBack();
    // A redo from the measurements list goes back to the list, past every page it took.
    else if (page.kind === 'extra' && page.redo && last && canGoBack()) window.history.go(-(at + 1));
    else if (page.kind === 'base') setPage(last ? (onWeight ? { kind: 'weight' } : { kind: 'check' }) : { ...page, at: at + 1 });
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
      onNext={next}
      label={label}
      skip={onSkip && page.kind === 'base' && !page.back && at === 0 && !Object.keys(values).length ? () => onSkip() : undefined}
      later={onLater && !(page.kind === 'base' && page.back) && !(page.kind === 'extra' && page.redo) ? onLater : undefined}
      canEstimate={page.kind === 'extra'}
      ids={ids}
      listTitle={page.kind === 'base' ? (helper ? 'Their measurements' : 'Your measurements') : g === 'other' ? 'Full set' : cap(GARMENT_NAME[g!])}
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

const TAPE_MARKS = Array.from({ length: 50 }, (_, i) => i + 41);

/** The tape Begin pulls out on the welcome lands round the form's bust on the first page, measuring it (Cat's T3,
 *  2026-10-21). It comes down from where the welcome left it, across the top, so it never jumps. */
function LandedTape() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tape = ref.current;
    const card = tape?.closest('.welcome-card');
    if (!tape || !card) return;
    // Measured once the form has drawn and placed the bust, a frame or two after the page appears.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const at = tape.getBoundingClientRect();
        const top = card.getBoundingClientRect();
        const phone = window.matchMedia('(max-width: 640px)').matches;
        const dx = (phone ? 14 : top.left - 22) - at.left;
        const dy = top.top - 17 - at.top;
        tape.classList.remove('waiting');
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          tape.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={ref} className="tape-band landed waiting" aria-hidden="true">
      <div className="tape-marks">
        {TAPE_MARKS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

export function Shell({
  eyebrow,
  title,
  hero,
  dots,
  short,
  skip,
  later,
  aside,
  children,
}: {
  /** A small line above the title, only where it tells you something (which step, which garment). */
  eyebrow?: string;
  title: string;
  /** The picture: the form, with the tape on the measuring pages. The first page has none, so it opens on the words. */
  hero?: ReactNode;
  /** Skip, a quiet link under the button: try the app with example measurements. */
  skip?: () => void;
  /** Finish later, in place of Skip once real measurements are in (Cat, 2026-10-20): an example under real
   *  numbers would draft a pattern that fits no one, so later pages only offer to stop and keep them. */
  later?: () => void;
  dots?: [number, number];
  /** A shorter form on top, so a longer list fits above its button. */
  short?: boolean;
  /** The left-hand column on a computer (Cat's W3 Drafting Table): the measurements on this run. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  // On a phone the words follow the form in one column. On a computer the page is three columns: the list, the
  // form in the middle, and the question on the right; with no list the form takes the first two.
  return (
    <div className="welcome">
      <section className={['card welcome-card measure-step', short && 'short', hero && 'has-hero', aside && 'has-aside'].filter(Boolean).join(' ')} aria-labelledby="stitle">
        {aside && <aside className="step-list">{aside}</aside>}
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
        <div className="step-words">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <ShellTitle text={title} />
          {children}
          {skip ? (
            <button type="button" className="later" onClick={skip}>
              Measure later
            </button>
          ) : (
            later && (
              <button type="button" className="later skip-link" onClick={later}>
                Finish later
              </button>
            )
          )}
        </div>
      </section>
    </div>
  );
}

/** The measurements on this run, for the list beside the form: body, arms and lengths, each with its number once taken. */
const ARM_IDS: MeasurementId[] = ['arm_length', 'upper_arm', 'wrist', 'armscye'];
const GIRTH_IDS: MeasurementId[] = ['height', 'full_bust', 'high_bust', 'waist', 'full_hip', 'neck'];
function StepList({ title, ids, at, values, unit, form }: { title: string; ids: MeasurementId[]; at: number; values: MeasurementValues; unit: Unit; form: FormKind }) {
  const groups: [string, MeasurementId[]][] =
    ids.length > 6
      ? ([
          ['Body', ids.filter((i) => GIRTH_IDS.includes(i))],
          ['Arms', ids.filter((i) => ARM_IDS.includes(i))],
          ['Lengths and widths', ids.filter((i) => !GIRTH_IDS.includes(i) && !ARM_IDS.includes(i))],
        ] as [string, MeasurementId[]][]).filter(([, g]) => g.length)
      : [['', ids]];
  return (
    <>
      <p className="eyebrow">
        {title} · {ids.length}
      </p>
      {groups.map(([name, g]) => (
        <div key={name} className="step-group">
          {name && <p className="step-group-name">{name}</p>}
          <ol>
            {g.map((i) => (
              <li key={i} className={i === ids[at] ? 'on' : undefined} aria-current={i === ids[at] ? 'step' : undefined}>
                <span>{labelOf(i, form)}</span>
                <em>{shown(values[i], unit)}</em>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
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
  onNext,
  label,
  skip,
  later,
  canEstimate,
  ids,
  listTitle,
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
  /** Their weight, if given on its own page, which only ever double-checks the girths. */
  weight?: number;
  onNext: () => void;
  label: string;
  skip?: () => void;
  later?: () => void;
  /** A garment's own measurement, which can be estimated from the base ones when you're not sure. */
  canEstimate?: boolean;
  /** Every measurement on this run, for the list beside the form on a computer, and what to call it. */
  ids?: MeasurementId[];
  listTitle?: string;
}) {
  const fieldLabel = labelOf(id, form);
  const guess = canEstimate ? estimateOne(id, values, form) : undefined;
  const [estimated, setEstimated] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [how, setHow] = useState(false);
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

  const feetInches = id === 'height' && unit === 'in';
  const [ftIn, setFtIn] = useState<[string, string] | null>(null);
  const typeFtIn = (ft: string, inch: string) => {
    setFtIn([ft, inch]);
    const f = parseFloat(ft.replace(',', '.')), i = parseFloat(inch.replace(',', '.'));
    const v = { ...values };
    if (Number.isNaN(f) && Number.isNaN(i)) delete v[id];
    else v[id] = Math.round(((Number.isNaN(f) ? 0 : f) * 12 + (Number.isNaN(i) ? 0 : i)) * 2.54 * 10) / 10;
    onValues(v);
  };
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
    <Shell
      eyebrow={eyebrow}
      title={titleOf(id, helper, form)}
      dots={dots}
      skip={skip}
      later={later}
      hero={<TapeDemo id={id} kind={form} />}
      aside={ids && <StepList title={listTitle ?? 'Your measurements'} ids={ids} at={dots[1]} values={values} unit={unit} form={form} />}
    >
      <p className="muted step-tip">{tipOf(id, helper, form)}</p>
      <p className="how-row">
        <button type="button" className="later go how-link" aria-expanded={how} onClick={() => setHow(true)}>
          How to do it <span aria-hidden="true">›</span>
        </button>
      </p>
      <form
        className="measure-entry"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === undefined || error) setTried(true);
          else onNext();
        }}
      >
        <div className={note ? 'entry-box error' : 'entry-box'}>
          {/* The title already names it (Cat, 2026-10-20): the label is kept for screen readers only. */}
          <label htmlFor="step-value" className="visually-hidden">
            {fieldLabel}
          </label>
          <div className="entry-row">
            {feetInches ? (
              // Height in feet and inches (Cat, 2026-10-20), the way most people know it.
              <span className="ft-in">
                <input
                  id="step-value"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`${fieldLabel}, feet`}
                  value={ftIn?.[0] ?? (value === undefined ? '' : ftOf(value))}
                  aria-invalid={note ? true : undefined}
                  aria-describedby={note ? 'step-msg' : undefined}
                  onChange={(e) => typeFtIn(e.target.value, ftIn?.[1] ?? (value === undefined ? '' : inOf(value)))}
                />
                <span aria-hidden="true">ft</span>
                <input
                  id="step-inches"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="next"
                  aria-label={`${fieldLabel}, inches`}
                  value={ftIn?.[1] ?? (value === undefined ? '' : inOf(value))}
                  aria-invalid={note ? true : undefined}
                  onChange={(e) => typeFtIn(ftIn?.[0] ?? (value === undefined ? '' : ftOf(value)), e.target.value)}
                />
                <span aria-hidden="true">in</span>
              </span>
            ) : (
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
            )}
            <span className="unit-switch" role="group" aria-label="Units">
              {(['cm', 'in'] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  aria-label={u === 'cm' ? 'Centimetres' : id === 'height' ? 'Feet and inches' : 'Inches'}
                  className={unit === u ? 'on' : ''}
                  onClick={() => {
                    setText(null);
                    setFtIn(null);
                    onUnit(u);
                  }}
                >
                  {u === 'in' && id === 'height' ? 'ft in' : u}
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
