import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FIELDS, checkMeasurements, type Check, type FormKind, type Garment, type MeasurementId, type MeasurementValues, type Unit } from '../measurements';
import { BASE, baseDone, begun, fieldOf, fullSetMissing, GARMENT_NAME, GARMENTS, labelOf, mistakesOf, neededFor, seatedOf, stepsOf, stringOf, tipOf, titleOf } from '../measureFlow';
import { WEIGHT_HARD, WeightEntry, fromKg, weightUnitOf } from '../ui/WeightEntry';
import { HowClip } from '../ui/HowClip';
import { FormPicture, HEAD_TOP, labelLevel, readCamera, TapeDemo } from '../ui/ContourForm';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { estimateOne } from '../estimate';
import { Title } from '../ui/Title';
import type { PatternChoices } from '../garments';
import { keepMenswear, menswearOpen, testingNote } from '../launch';
import { TestingTag } from '../ui/TestingTag';
import { ideaChoices, ideaRows, pieceGarment } from '../photo/idea';
import { isSwimIntimates } from '../photo/swim';
import { InterestCard } from '../ui/InterestCard';
import { MAX_IDEA_CHARS, type IdeaReading, type IdeaResponse, type PhotoError } from '../photo/types';
import { testerHeaders } from '../ui/TesterCode';
import { typedLength } from '../units';

interface Props {
  /** Opens the Maison collection from "What would you like to make?": the fit testers sew a house look (Nov 11). */
  onLooks?: () => void;
  /** Sent with an idea to read, for a fit tester's larger daily allowance. */
  testerCode?: string;
  garment: Garment;
  unit: Unit;
  values: MeasurementValues;
  onUnit: (u: Unit) => void;
  /** With the measurements taken with someone holding the tape, once a number is typed. */
  onValues: (v: MeasurementValues, helped?: MeasurementId[]) => void;
  /** The measurements already taken with someone holding the tape. */
  helped?: MeasurementId[];
  /** Their weight in kg, if given, and giving it: asked with the height, and only read against it to double-check the girths. */
  weight?: number;
  onWeight?: (kg: number | undefined) => void;
  /** Measured for this garment: on to styling it. */
  onDone: (garment: Garment) => void;
  /** Where to open. By default the start (or the check, once the base set is in). "choose" opens the list of what
   * to make; a garment opens on the first measurement it still needs; "redo" opens one measurement and comes back. */
  start?: StepsStart;
  /** Opened just now by App for `start`, rather than stepped back into with the browser's back. */
  opening?: boolean;
  /** Measuring someone else: their name, given on the first page, before any measurement is taken, with the form picked for them. */
  onSomeoneElse?: (name: string, form: FormKind) => void;
  /** The measurements in use are someone else's, so every page is worded for the person holding the tape. */
  theirs?: boolean;
  /** Their name, for the line over the first measurement. */
  theirName?: string;
  /** Skip, the quiet link under the button: try the app with example measurements (for the garment being measured). */
  onSkip?: (garment?: Garment) => void;
  /** Finish later: stop measuring, keeping what's in, and pick up at the first one still to take. */
  onLater?: () => void;
  /** The dress form this person's patterns are drafted on, and choosing it before the first measurement. */
  form?: FormKind;
  onForm?: (form: FormKind) => void;
  /** "Something else", described and matched to a garment: style it from these choices, measuring for it first. */
  onIdea?: (choices: PatternChoices) => void;
  /** What the garment's current design doesn't draft from, so it isn't asked (a vest's arms). */
  unused?: (g: Garment) => MeasurementId[];
  /** The garment's name for its current design ("vest" for a jacket without sleeves). */
  named?: (g: Garment) => string;
  /** "Or start from a photo" on the describe page. */
  onPhoto?: () => void;
  /** "How your pattern is made", for the AI line on the describe page. */
  onMade?: () => void;
  /** "Tell me when it's ready", for something the app can't make yet. */
  onNews?: () => void;
}

export type StepsStart = { kind: 'resume' } | { kind: 'choose' } | { kind: 'form' } | { kind: 'for'; garment: Garment; also?: MeasurementId[] } | { kind: 'redo'; garment: Garment; ids: MeasurementId[] };

type Page =
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
// measurement per page, a check of those four, then what to make: tapping a garment goes
// straight to the first extra that garment still needs. "Something else" asks what they have in mind and
// answers "We can make that", "The closest we can do" or "Not yet" (Cat's pick, 2026-10-18); only "Not yet"
// offers the full set of measurements, for a dressmaker.
// There is no first page (Fable's concept A, Cat's apply, Nov 15): Begin opens on the waist. Who you are designing
// for, and the form, sit in one quiet line above the first measurement, with Change for the few who need it;
// "Someone else" words every page for the person holding the tape and asks their name before any number is taken.
export function MeasureStepsScreen({ testerCode, garment: current, unit, values, onUnit, onValues, helped = [], weight, onWeight, onDone, start, opening, onSomeoneElse, theirs, theirName, onSkip, onLater, form = 'womenswear', onForm, onIdea, onPhoto, onLooks, onMade, onNews, unused = () => [], named = (g) => GARMENT_NAME[g] }: Props) {
  const aimed = start?.kind === 'for' ? start.garment : undefined;
  // Opened afresh for a garment, a redo, the form or the garments (not a reload, and not stepped back into): its own
  // first page, not the one this history entry remembers from before.
  const [newOpening] = useState(() => !!opening && !!start && start.kind !== 'resume');
  // Each page is a history entry, so the header's back and the phone's back go one page back.
  const [page, setPage] = usePageHistory<Page>(() => {
    if (start?.kind === 'redo') return { kind: 'extra', garment: start.garment, ids: start.ids, at: 0, redo: true };
    if (start?.kind === 'form') return { kind: 'form' };
    // A reload, or the phone dropping the tab mid-measuring: the page still to take, not the first page again
    // (tester journey, Nov 11). Every number typed so far is already kept.
    if (start?.kind === 'resume') {
      if (baseDone(values)) return { kind: 'check' };
      return { kind: 'base', at: Math.max(0, BASE.findIndex((m) => values[m] === undefined)) };
    }
    // Choosing another garment, or measuring for one, never goes back to the base measurements once anything is
    // measured: straight to the garments, or to the pages that garment still needs (Cat's A, 2026-10-24).
    if (!baseDone(values) && !(begun(values) && (start?.kind === 'choose' || aimed))) return { kind: 'base', at: Math.max(0, BASE.findIndex((m) => values[m] === undefined)) };
    if (start?.kind === 'choose') return { kind: 'choose' };
    // `also`: more the design needs beyond the garment's own list (a collection top's sleeves need the arms).
    const also = start?.kind === 'for' ? (start.also ?? []).filter((id) => values[id] === undefined) : [];
    const ids = aimed ? [...neededFor(aimed, values, form).map((f) => f.id), ...also].filter((id, i, a) => a.indexOf(id) === i && !unused(aimed).includes(id)) : [];
    return ids.length ? { kind: 'extra', garment: aimed!, ids, at: 0 } : { kind: 'check' };
    // A remembered first page (from before Nov 15, when there was one) opens as if afresh. So does a remembered base
    // page once the base measurements are in (back from the collection, Nov 11): this screen's first entry is the
    // waist, and coming back to it opens on the list or the check instead. Mending one from the check is kept.
  }, (s) => typeof s === 'object' && s !== null && 'kind' in s && (s as { kind: string }).kind !== 'intro' && !((s as Page).kind === 'base' && !(s as { back?: string }).back && baseDone(values)), newOpening);
  // Opened on the check because the measurements were taken on an earlier visit: say so.
  // Not when stepping back into it during this visit: only on opening it afresh.
  const [returning] = useState(() => !start && baseDone(values) && (window.history.state as { sub?: unknown } | null)?.sub === undefined);
  const [helper, setHelper] = useState(!!theirs);
  const [who, setWho] = useState(false);
  // The who line shows on a first waist page opened with nothing measured, and stays while the waist is typed (the
  // values change on every key, Nov 15 code review).
  const [freshStart] = useState(() => !Object.keys(values).length);
  // Menswear can't be picked this fit round (launch.ts menswearOpen), unless this person already drafts on it.
  const [onMenswear] = useState(() => {
    if (form === 'menswear') keepMenswear();
    return form === 'menswear';
  });
  const formShut = (k: FormKind) => k === 'menswear' && !onMenswear && !menswearOpen();
  // Measuring yourself with a friend holding the tape (measuring accuracy, 2026-10-21): every page is then worded for
  // the friend, and the numbers taken this way are noted, so a fit report can tell them from those taken alone.
  const [friend, setFriend] = useState(false);
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
    const ids = neededFor(g, values, form).map((f) => f.id).filter((id) => !unused(g).includes(id));
    if (ids.length) setPage({ kind: 'extra', garment: g, ids, at: 0 });
    else onDone(g);
  };
  // On "What would you like to make?" a tap is the choice: the tile lights for a blink, so the tap reads as
  // taken, then the next page opens. No button underneath (Cat, 2026-11-08). A second tap in that blink is ignored.
  const going = useRef(false);
  const tapToMake = (g: Pick) => {
    if (going.current) return;
    going.current = true;
    setPicked(g);
    window.setTimeout(() => {
      going.current = false;
      go(g);
    }, TAP_BLINK_MS);
  };
  // "Your form": a tap is the choice, like the garments. The form lights for a blink, then back to where you came from.
  const tapForm = (k: FormKind) => {
    if (going.current) return;
    going.current = true;
    setChosen(k);
    window.setTimeout(() => {
      going.current = false;
      onForm?.(k);
      // Changed from the measurements list: back to it, where anything the new form needs shows as Add.
      if (start?.kind === 'form' && canGoBack()) goBack();
      else setPage({ kind: 'base', at: firstToTake() });
    }, TAP_BLINK_MS);
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

  // Changing the dress form later, from the measurements list (Cat's B2 Two Forms; the first pick is in the line
  // above the waist). The menswear form asks for the chest and none of the bust measurements.
  if (page.kind === 'form')
    return (
      <Shell title={helper ? 'Their form' : 'Your form'} skip={start?.kind !== 'form' && onSkip ? () => onSkip() : undefined}>
        <p className="who-q" id="form-q">
          Which form should we draft on?
        </p>
        <div className="form-pick" role="group" aria-labelledby="form-q">
          {(['womenswear', 'menswear'] as const).map((k) => (
            <button key={k} type="button" aria-current={chosen === k || undefined} className={chosen === k ? 'on' : ''} disabled={formShut(k)} onClick={() => tapForm(k)}>
              <FormPicture kind={k} />
              <span>{k === 'womenswear' ? 'Womenswear' : 'Menswear'}</span>
              {formShut(k) && <TestingTag tool="menswear" />}
            </button>
          ))}
        </div>
      </Shell>
    );

  // Weight on its own page after the five basics (Cat, 2026-10-20): why it's asked, kg or lb, and a skip.
  if (page.kind === 'weight') {
    const wrong = weight !== undefined && (weight < WEIGHT_HARD[0] || weight > WEIGHT_HARD[1]);
    const done = () => (page.back && canGoBack() ? goBack() : setPage({ kind: 'check' }));
    return (
      <Shell eyebrow="Optional" title={helper ? 'Their weight' : 'Your weight'}>
        <p className="muted step-tip">Helps us catch potential mismeasurements.</p>
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
          className="later skip-link"
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
      <Shell eyebrow={returning ? 'Welcome back' : undefined} title="Do these look right?">
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
      // No form here, the question and the garments centred on the page (Cat's N2 No Form, Centred, 2026-10-25: the form
      // was too small to read above the list).
      <Shell title="What would you like to make?" centred>
        <div className="make-grid" role="group" aria-labelledby="stitle">
          {onLooks && (
            // Named for what it opens, as the testers' emails and the Style title's drop-down say (Nov 12).
            <button type="button" className="make-looks" onClick={onLooks}>
              The collection ›
            </button>
          )}
          {[...GARMENTS, 'other' as const].map((g) => (
            <button key={g} type="button" aria-current={picked === g || undefined} className={picked === g ? 'on' : ''} onClick={() => tapToMake(g)}>
              {g === 'other' ? 'Something else' : cap(GARMENT_NAME[g])}
            </button>
          ))}
        </div>
        {testingNote((g) => GARMENT_NAME[g], GARMENTS) && <p className="muted small testing-note">{testingNote((g) => GARMENT_NAME[g], GARMENTS)}</p>}
      </Shell>
    );

  if (page.kind === 'describe')
    return (
      <Shell eyebrow="Something else" title="Tell us what you have in mind." hero={<TapeDemo id="waist" name="" mode="still" kind={form} />} short>
        <div className="field plain ready">
          <label htmlFor="idea">Describe it</label>
          <textarea id="idea" rows={3} maxLength={MAX_IDEA_CHARS} value={idea} onChange={(e) => setIdea(e.target.value)} />
        </div>
        <p className="muted step-tip">
          A few words is enough. Name the garment and anything you love about it. We use AI to read your words, then you check the style
          before we draft.{' '}
          {onMade && (
            <button type="button" className="inline-link" onClick={onMade}>
              How your pattern is made
            </button>
          )}
        </p>
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
    const more = neededFor(g, values, form).length;
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
  const eyebrow = `${page.kind === 'base' ? '' : g === 'other' ? 'Full set · ' : `${cap(named(g!))} · `}${at + 1} of ${ids.length}`;
  const label =
    (page.kind === 'base' && page.back === 'check') || (page.kind === 'extra' && page.redo && last) ? 'Save' : page.kind === 'extra' && page.redo ? 'Next' : page.kind === 'base' ? (last && !onWeight ? 'Done' : 'Next') : g === 'other' ? (last ? 'Done' : 'Next') : last ? `Next: style your ${named(g!)}` : 'Next';
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

  // Who it is for, and the form: one quiet line over the first measurement of a fresh start, Change opening the two
  // switches in a window (Fable's concept A, Nov 15). Set before any number is typed, as the first page did.
  const fresh = page.kind === 'base' && !page.back && at === 0 && freshStart;
  const pickWho = () => {
    // Someone else is added once; after that the window only changes their form.
    if (helper && !theirs && onSomeoneElse) onSomeoneElse(name.trim(), chosen);
    else if (chosen !== form) onForm?.(chosen);
    setWho(false);
  };
  // Closed without Done: nothing picked in the window stays, so the pages never word for someone not added.
  const dropWho = () => {
    setHelper(!!theirs);
    setChosen(form);
    setName('');
    setWho(false);
  };
  const whoLine = fresh && (onForm || onSomeoneElse) && (
    <p className="eyebrow who-line">
      <span>
        {theirs ? `For ${theirName || 'someone else'}` : helper ? `For ${name.trim() || 'someone else'}` : 'For me'} · {form === 'menswear' ? 'Menswear' : 'Womenswear'}
      </span>
      <button type="button" className="later go who-change" aria-expanded={who} onClick={() => setWho(true)}>
        Change
      </button>
    </p>
  );
  const whoWindow = who && (
    <div className="how-sheet" role="dialog" aria-modal="true" aria-labelledby="who-title" onClick={dropWho}>
      <div className="how-panel who-panel" onClick={(e) => e.stopPropagation()}>
        <p id="who-title" className="eyebrow">
          Who it is for
        </p>
        {onForm && (
          <div className="switch two-part" role="radiogroup" aria-label="Which form to draft on?">
            {(['womenswear', 'menswear'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={chosen === k} disabled={formShut(k)} onClick={() => setChosen(k)}>
                {k === 'womenswear' ? 'Womenswear' : 'Menswear'}
                {formShut(k) && <TestingTag tool="menswear" />}
              </button>
            ))}
          </div>
        )}
        {!theirs && (
          <div className="switch two-part" role="radiogroup" aria-label="Who are you designing for?">
            <button type="button" role="radio" aria-checked={!helper} onClick={() => setHelper(false)}>
              For me
            </button>
            <button type="button" role="radio" aria-checked={helper} onClick={() => setHelper(true)}>
              Someone else
            </button>
          </div>
        )}
        {helper && !theirs && (
          <div className="field plain ready">
            <label htmlFor="who-name">Name</label>
            <input id="who-name" autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <button type="button" className="primary" disabled={helper && !theirs && !name.trim()} onClick={pickWho}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <MeasurePage
      key={`${page.kind}-${id}`}
      who={whoLine}
      whoWindow={whoWindow}
      tapeFirst={fresh}
      id={id}
      eyebrow={eyebrow}
      dots={[ids.length, at]}
      helper={helper || friend}
      friend={helper ? undefined : friend}
      onFriend={helper ? undefined : setFriend}
      form={form}
      unit={unit}
      values={values}
      garment={g && g !== 'other' ? g : current}
      onUnit={onUnit}
      onValues={(v, estimated) => {
        const others = helped.filter((m) => m !== id);
        onValues(v, (helper || friend) && !estimated && v[id] !== undefined ? [...others, id] : others);
      }}
      weight={weight}
      onNext={next}
      label={label}
      skip={onSkip && page.kind === 'base' && !page.back && at === 0 && !Object.keys(values).length ? () => onSkip() : undefined}
      later={onLater && !(page.kind === 'base' && page.back) && !(page.kind === 'extra' && page.redo) ? onLater : undefined}
      canEstimate={page.kind === 'extra' && !BASE.includes(id)}
      ids={ids}
      listTitle={page.kind === 'base' ? (helper ? 'Their measurements' : 'Your measurements') : g === 'other' ? 'Full set' : cap(named(g!))}
    />
  );
}

/** The first tip begins with what to measure with, said once where it's used (the first page's list, Nov 15). */
const withTape = (tip: string) => `With a soft tape measure, ${tip.charAt(0).toLowerCase()}${tip.slice(1)}`;

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

/** How long a tapped garment stays lit before the next page opens. */
const TAP_BLINK_MS = 160;

export function Shell({
  eyebrow,
  title,
  hero,
  short,
  centred,
  skip,
  later,
  top,
  aside,
  labels,
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
  /** A quiet line above the eyebrow: who it is for, on the first measurement. */
  top?: ReactNode;
  /** Which step of how many: the picture's dots went in the aesthetic review (2026-10-21); the eyebrow says it. */
  dots?: [number, number];
  /** A shorter form on top, so a longer list fits above its button. */
  short?: boolean;
  /** No form, the words centred down the page. */
  centred?: boolean;
  /** The left-hand column on a computer (Cat's W3 Drafting Table): the measurements on this run. */
  aside?: ReactNode;
  /** On a computer, the list as names beside the form at their places on the body, in place of the aside. */
  labels?: ReactNode;
  children: ReactNode;
}) {
  // On a phone the words follow the form in one column. On a computer the page is three columns: the list, the
  // form in the middle, and the question on the right; with no list the form takes the first two.
  return (
    <div className="welcome">
      <section className={['card welcome-card measure-step', short && 'short', centred && 'centred', hero && 'has-hero', aside && 'has-aside', labels && 'has-labels'].filter(Boolean).join(' ')} aria-labelledby="stitle">
        {aside && <aside className="step-list">{aside}</aside>}
        {hero && (
          <div className="welcome-hero">
            {hero}
            {labels}
            <div className="welcome-top">
            </div>
          </div>
        )}
        <div className="step-words">
          {top}
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <ShellTitle text={title} />
          {children}
          {skip ? (
            <button type="button" className="later" onClick={skip}>
              Try it with an example body
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

/** Far enough down the form for any name's level (the floor, in form units). */
const FORM_FOOT = 5;

/** The measurements on this run as names beside the form, each at its own place on the body, the one being taken in
 *  gold, its number once taken (Cat's M3b Labels on the Form, 2026-10-21). They follow the camera as it moves and keep
 *  clear of each other, those out of view resting at the top or bottom edge. Computer only; the phone keeps its dots. */
function FormLabels({ ids, at, values, unit, form }: { ids: MeasurementId[]; at: number; values: MeasurementValues; unit: Unit; form: FormKind }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    let frame = 0;
    const place = () => {
      frame = requestAnimationFrame(place);
      const list = ref.current;
      const cam = readCamera();
      if (!list || !cam || !list.offsetParent) return;
      const box = list.getBoundingClientRect();
      const c = cam.canvas.getBoundingClientRect();
      const items = [...list.children] as HTMLElement[];
      const GAP = 26;
      const spots = items.map((li) => {
        const y = Number(li.dataset.y);
        return { li, top: c.top - box.top + cam.Y(y), right: box.right - (c.left + cam.x(y)) + 18 };
      });
      // In body order, pushed apart where they would touch and kept inside the picture.
      const order = [...spots].sort((a, b) => a.top - b.top);
      order.forEach((p, i) => (p.top = Math.max(p.top, i ? order[i - 1].top + GAP : 12)));
      for (let i = order.length - 1; i >= 0; i--) order[i].top = Math.min(order[i].top, i < order.length - 1 ? order[i + 1].top - GAP : box.height - 12);
      // A name pushed to the top or bottom edge (Height, when the camera is in close at the hips) rests beside the
      // form as it is drawn at that edge, not at its own level out of view, or it sat on the form's lines (Cat, Nov 11
      // sweep).
      const edgeX = (top: number) => {
        let x = Infinity;
        for (let y = HEAD_TOP; y <= FORM_FOOT; y += 0.02) if (Math.abs(c.top - box.top + cam.Y(y) - top) < 12) x = Math.min(x, cam.x(y));
        return x;
      };
      for (const p of spots) {
        const x = edgeX(p.top);
        if (Number.isFinite(x)) p.right = Math.max(p.right, box.right - (c.left + x) + 18);
        p.li.style.top = `${p.top}px`;
        p.li.style.right = `${Math.min(p.right, box.width - 40)}px`;
      }
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [ids, at]);
  return (
    <ol ref={ref} className="form-labels" aria-hidden="true">
      {ids.map((i, n) => (
        <li key={i} data-y={labelLevel(i, form)} className={n === at ? 'on' : undefined}>
          {labelOf(i, form)}
          {values[i] !== undefined && <b>{shown(values[i], unit)}</b>}
        </li>
      ))}
    </ol>
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
  friend,
  onFriend,
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
  who,
  whoWindow,
  tapeFirst,
}: {
  /** Who it is for and the form, a quiet line over the first measurement, and the window Change opens. */
  who?: ReactNode;
  whoWindow?: ReactNode;
  /** The first measurement of a fresh start: its tip begins with what to measure with (the first page's list, Nov 15). */
  tapeFirst?: boolean;
  id: MeasurementId;
  eyebrow: string;
  dots: [number, number];
  /** Every page worded for the person holding the tape. */
  helper: boolean;
  /** Measuring yourself, with a friend holding the tape or not, and the switch between the two. */
  friend?: boolean;
  onFriend?: (on: boolean) => void;
  form: FormKind;
  unit: Unit;
  values: MeasurementValues;
  garment: Garment;
  onUnit: (u: Unit) => void;
  /** `estimated` when the number was filled in for them rather than taken. */
  onValues: (v: MeasurementValues, estimated?: boolean) => void;
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
  // The base set is checked as a dress, which asks all five, so the girths are read against each other as they come in.
  const checkAs = BASE.includes(id) ? 'dress' : FIELDS[garment].some((f) => f.id === id) ? garment : GARMENTS.find((g) => FIELDS[g].some((f) => f.id === id)) ?? garment;
  const problems = checkMeasurements({ [id]: value } as MeasurementValues, unit, checkAs, form).filter((c) => c.id === id && c.level === 'error' && value !== undefined);
  const error = problems[0];
  // A number still short of the range while it's being typed (the 6 of 62) isn't wrong yet: its error waits for Next or
  // for the box to be left, so nobody is told off mid-number (the film's critic review, Nov 16). Too big shows at once,
  // and a saved or estimated number nobody is typing is checked straight away.
  const [typing, setTyping] = useState(false);
  const least = FIELDS[checkAs].find((f) => f.id === id)?.hard[0];
  const shownError = error && typing && !tried && value !== undefined && least !== undefined && value < least ? undefined : error;
  // A double-check against the rest (the height, the weight, the other lengths): said here, where the number is
  // typed, and never in the way. Only once the number could be right on its own.
  // A check this number sets off on another one says so here too (Cat, 2026-10-21: the girths checked against each
  // other as they come in, the lengths against the height once it's in), e.g. a waist larger than the hip just typed.
  const doubt = (() => {
    if (error || value === undefined) return undefined;
    const warnings = (v: MeasurementValues) => checkMeasurements(v, unit, checkAs, form, { weight }).filter((c) => c.level === 'warning');
    const now = warnings(values);
    const without = { ...values };
    delete without[id];
    const before = new Set(warnings(without).map((c) => `${c.id} ${c.message}`));
    return now.find((c) => c.id === id) ?? now.find((c) => !before.has(`${c.id} ${c.message}`));
  })();
  const note = shownError ?? (tried && value === undefined ? { level: 'error', message: `Enter ${helper ? 'their' : 'your'} ${fieldLabel.toLowerCase()} to carry on.` } : undefined);

  const feetInches = id === 'height' && unit === 'in';
  const [ftIn, setFtIn] = useState<[string, string] | null>(null);
  const feetText = ftIn?.[0] ?? (value === undefined ? '' : ftOf(value));
  const inchText = ftIn?.[1] ?? (value === undefined ? '' : inOf(value));
  const typeFtIn = (ft: string, inch: string) => {
    setFtIn([ft, inch]);
    const f = parseFloat(ft.replace(',', '.')), i = parseFloat(inch.replace(',', '.'));
    const v = { ...values };
    if (Number.isNaN(f) && Number.isNaN(i)) delete v[id];
    // Nobody is 9 feet tall: a number that big in the feet box is the whole height in inches. "64" there was kept as
    // 64 feet, and the list showed a height of 768 in (pretend tester, Nov 17).
    else v[id] = Math.round(((Number.isNaN(f) ? 0 : f > 8 ? f / 12 : f) * 12 + (Number.isNaN(i) ? 0 : i)) * 2.54 * 10) / 10;
    onValues(v);
  };
  const type = (t: string) => {
    setText(t);
    setEstimated(false);
    const n = typedLength(t, unit);
    const v = { ...values };
    if (Number.isNaN(n)) delete v[id];
    else v[id] = Math.round(n * 10) / 10;
    onValues(v);
  };

  return (
    <Shell
      eyebrow={eyebrow}
      title={titleOf(id, helper, form)}
      dots={dots}
      skip={skip}
      later={later}
      top={who}
      hero={
        <>
          <TapeDemo id={id} kind={form} />
        </>
      }
      aside={ids && <StepList title={listTitle ?? 'Your measurements'} ids={ids} at={dots[1]} values={values} unit={unit} form={form} />}
      labels={ids && ids.length <= 8 && ids.every((i) => labelLevel(i, form) !== undefined) && <FormLabels ids={ids} at={dots[1]} values={values} unit={unit} form={form} />}
    >
      <p className="muted step-tip">
        {tapeFirst ? withTape(tipOf(id, helper, form)) : tipOf(id, helper, form)}
        {/* On the tip's own line, so the page still fits a phone without scrolling. */}
        {stringOf(id, helper, form) && <span className="string-tip"> {stringOf(id, helper, form)}</span>}
      </p>
      {onFriend && !friend && fieldOf(id).helper && <p className="muted small friend-nudge">This one is much easier with a friend holding the tape.</p>}
      <p className="how-row">
        <button type="button" className="later go how-link" aria-expanded={how} onClick={() => setHow(true)}>
          How to do it <span aria-hidden="true">›</span>
        </button>
        {onFriend && (
          <button type="button" className="later how-link friend-link" aria-pressed={!!friend} aria-label={friend ? 'I am measuring myself' : 'A friend is measuring me'} onClick={() => onFriend(!friend)}>
            {friend ? 'I measure myself' : 'A friend measures'}
          </button>
        )}
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
              // Each number sits right against its own FT or IN, each box exactly as wide as what is typed in it, and tapping
              // the letters picks their box (Cat, 2026-11-07: the IN label sat far from its number).
              <span className="ft-in">
                <label className="ft-in-part">
                  <span className="ft-in-size" data-value={feetText}>
                    <input
                      id="step-value"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`${fieldLabel}, feet`}
                      value={feetText}
                      aria-invalid={note ? true : undefined}
                      aria-describedby={note ? 'step-msg' : undefined}
                      onBlur={() => setTyping(false)}
                      onChange={(e) => {
                        setTyping(true);
                        typeFtIn(e.target.value, inchText);
                      }}
                    />
                  </span>
                  <span aria-hidden="true">ft</span>
                </label>
                <label className="ft-in-part">
                  <span className="ft-in-size" data-value={inchText}>
                    <input
                      id="step-inches"
                      inputMode="decimal"
                      autoComplete="off"
                      enterKeyHint="next"
                      aria-label={`${fieldLabel}, inches`}
                      value={inchText}
                      aria-invalid={note ? true : undefined}
                      onBlur={() => setTyping(false)}
                      onChange={(e) => {
                        setTyping(true);
                        typeFtIn(feetText, e.target.value);
                      }}
                    />
                  </span>
                  <span aria-hidden="true">in</span>
                </label>
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
                onBlur={() => setTyping(false)}
                onChange={(e) => {
                  setTyping(true);
                  type(e.target.value);
                }}
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
                  {/* CM / IN on every page, height too: its boxes already say FT and IN (Cat, 2026-11-07). */}
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
        {estimated && value !== undefined ? (
          <p className="muted small estimate-note">Estimated from your other measurements. Swap in your own when you can, for a closer fit.</p>
        ) : (
          guess !== undefined &&
          value === undefined && (
            <button
              type="button"
              className="later go estimate-link"
              onClick={() => {
                setText(null);
                setTried(false);
                setEstimated(true);
                onValues({ ...values, [id]: guess }, true);
              }}
            >
              Estimate it for me ›
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
            {form !== 'menswear' && <HowClip id={id} />}
            <p id="how-title" className="eyebrow">
              How to measure {helper ? 'their' : 'your'} {(titleOf(id, false, form).replace(/^Your /, '') || fieldLabel).toLowerCase()}
            </p>
            <ol>
              {stepsOf(id, helper, form).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="eyebrow how-mistakes-title">Common mistakes</p>
            <ul className="how-mistakes">
              {mistakesOf(id, helper, form).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {!helper && seatedOf(id, form) && (
              <>
                <p className="eyebrow how-mistakes-title">Seated, or on your own</p>
                <p className="how-seated">{seatedOf(id, form)}</p>
              </>
            )}
            <button type="button" className="primary" autoFocus onClick={() => setHow(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
      {whoWindow}
    </Shell>
  );
}
