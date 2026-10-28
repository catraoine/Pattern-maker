import { SendToDevice } from '../ui/SendToDevice';
import { fmtMeasure } from '../units';
import { TesterCode } from '../ui/TesterCode';
import { CloudAccount } from '../ui/CloudAccount';
import type { Cloud } from '../cloud/useCloud';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { countStep } from '../report/report';
import { deletePhoto } from '../photoStore';
import { garmentKind } from '../fit';
import { Account, ME, Person, SavedPattern, activePerson, personName } from '../account';
import { choicesFlat } from '../collection';
import { Envelope } from '../ui/Envelope';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { BODICE_FIELDS, SKIRT_FIELDS, TROUSERS_FIELDS, Unit } from '../measurements';
import { describePattern } from './describe';
import { FitForm } from '../ui/FitForm';
import { FitFeedback, fitReport, fitSummary, sendFitReport } from '../fit';
import type { MeasurementId, MeasurementValues } from '../measurements';
import { Mode, shows } from '../mode';
import { stillInTesting } from '../launch';
import { GARMENTS, GARMENT_NAME } from '../measureFlow';
import { InterestCard } from '../ui/InterestCard';
import { YourPlan } from '../ui/PlanPrompts';
import { savedLimit } from '../plans';
import { findByCode, readCode } from '../labels';

// Skirt and bodice share a few measurements (waist, hip); list each once.
const ALL_FIELDS = [...SKIRT_FIELDS, ...TROUSERS_FIELDS.filter((t) => !SKIRT_FIELDS.some((f) => f.id === t.id)), ...BODICE_FIELDS.filter((b) => !SKIRT_FIELDS.some((f) => f.id === b.id))];

interface Props {
  account: Account & { people: Person[]; active: string };
  unit: Unit;
  onName: (name: string) => void;
  onUnit: (u: Unit) => void;
  onEditMeasurements: () => void;
  onSwitchPerson: (id: string) => void;
  /** Open the person's client book: measurement history, fittings, notes, toile photos and patterns. */
  onClientBook?: () => void;
  /** Open a pattern file from elsewhere and walk its seams. */
  onCheckFile?: () => void;
  /** Open Body Double: a store form padded to the person, with a cover drafted to them. */
  onBodyDouble?: () => void;
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
  onOpen: (p: SavedPattern) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onFit: (id: string, fit: FitFeedback | undefined) => void;
  /** A saved pattern whose "How did it fit?" opens straight away (from the print screen's prompt). */
  openFit?: string;
  onReset: () => void;
  /** Opens the Privacy Policy or the Terms of Use. */
  onLegal: (page: 'privacy' | 'terms' | 'tester' | 'news' | 'brands' | 'nights' | 'made') => void;
  onBackup: () => void;
  /** The link that carries everything on this device to another one; see moveLink.ts. */
  sendLink: () => Promise<string>;
  /** Keep or clear a fit tester's code. */
  onTesterCode: (code: string | undefined) => void;
  onRestore: (file: File) => Promise<boolean>;
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
  /** Opens the plans; only given while the plan screens are shown (see plansShown). */
  onPlans?: () => void;
  /** Sign-in, once it's shown (see cloud/flag.ts). */
  cloud?: Cloud;
}

const show = (id: string, cm: number | undefined, unit: Unit) => (cm === undefined ? '–' : fmtMeasure(id, cm, unit));

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// The six most asked-for measurements show first; the rest wait behind "See all".
const KEY_FIELDS = ['waist', 'full_hip', 'full_bust', 'high_bust', 'waist_to_knee', 'arm_length'];

/** One folded row: a heading with a short summary on the right, and its contents underneath. */
function Fold({ id, title, summary, open, children }: { id: string; title: string; summary?: string; open?: boolean; children: ReactNode }) {
  return (
    <section className="fold" aria-labelledby={id}>
      <details open={open}>
        <summary>
          <h2 id={id}>{title}</h2>
          {summary && <span className="fold-sum">{summary}</span>}
        </summary>
        <div className="fold-in">{children}</div>
      </details>
    </section>
  );
}

export function AccountScreen({ account, unit, onName, onUnit, onEditMeasurements, onSwitchPerson, onAddPerson, onRemovePerson, onClientBook, onCheckFile, onBodyDouble, onOpen, onRename, onRemove, onFit, openFit, onReset, onLegal, onBackup, sendLink, onTesterCode, onRestore, mode = 'all', onMode, onPlans, cloud }: Props) {
  const limit = savedLimit(account);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [naming, setNaming] = useState(false);
  const [allMeasured, setAllMeasured] = useState(false);
  const display = account.name.trim() || 'Me';
  const person = activePerson(account);
  const { values } = person;
  const measured = ALL_FIELDS.filter((f) => values[f.id] !== undefined);
  const key = measured.filter((f) => KEY_FIELDS.includes(f.id));
  const shown = allMeasured ? measured : key.length ? key : measured.slice(0, KEY_FIELDS.length);
  const saved = account.patterns.length;
  const left = stillInTesting((g) => GARMENT_NAME[g], GARMENTS);
  // Sent fit notes carry the measurements of whoever the pattern was saved for.
  const personFor = (p: SavedPattern) => account.people.find((x) => x.id === (p.personId ?? ME)) ?? person;
  const valuesFor = (p: SavedPattern) => personFor(p).values;
  const whoFor = (p: SavedPattern) => {
    const who = p.personId && p.personId !== ME ? account.people.find((x) => x.id === p.personId) : undefined;
    return who ? personName(account, who) : undefined;
  };

  return (
    <div className="account">
      <div className="account-who">
        <span className="avatar big" aria-hidden="true">
          {display[0].toUpperCase()}
        </span>
        <div className="grow">
          <p className="eyebrow">Your account</p>
          <h1 id="ptitle">{display}</h1>
          {naming ? (
            <form
              className="row account-name"
              onSubmit={(e) => {
                e.preventDefault();
                setNaming(false);
              }}
            >
              <label htmlFor="aname" className="small">
                Name
              </label>
              <input id="aname" className="inline" autoComplete="given-name" value={account.name} autoFocus onChange={(e) => onName(e.target.value)} />
              <button type="submit" className="secondary sm">
                Done
              </button>
            </form>
          ) : (
            <button type="button" className="later name-edit" onClick={() => setNaming(true)}>
              {account.name.trim() ? 'Change name' : 'Add your name'}
            </button>
          )}
        </div>
      </div>

      <div className="folds">
        <Fold id="stitle" title="Saved patterns" summary={limit === Infinity ? `${saved} saved` : `${saved} of ${limit}`} open>
          {saved === 0 ? (
            <p className="muted">Nothing saved yet. Style a garment and tap "Keep in my patterns" on Review to keep it here. Once you've sewn it, note how it fitted here.</p>
          ) : (
            <ul className="saved">
              {account.patterns.map((p) => (
                <PatternRow key={p.id} pattern={p} values={valuesFor(p)} helped={personFor(p).helped} whoFor={whoFor(p)} startFitting={openFit === p.id} tester={!!account.testerCode} onOpen={() => onOpen(p)} onRename={(n) => onRename(p.id, n)} onRemove={() => onRemove(p.id)} onFit={(f) => onFit(p.id, f)} />
              ))}
            </ul>
          )}
          {saved > 0 && cloud?.usable && !cloud.user && (
            <p className="small keep-safe">
              Keep your patterns safe: sign in and they're there on any device.{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  const fold = document.getElementById('datatitle')?.closest('details');
                  if (fold) fold.open = true;
                  const email = document.getElementById('signin-email');
                  email?.scrollIntoView({ block: 'center' });
                  email?.focus();
                }}
              >
                Sign in
              </button>
            </p>
          )}
          {saved >= limit && (
            <p className="muted small">
              That's the free limit. Delete one to save another. <span className="badge">Premium</span> will save as many as you like.
              {onPlans && (
                <>
                  {' '}
                  <button type="button" className="link" onClick={onPlans}>
                    See plans
                  </button>
                </>
              )}
            </p>
          )}
          {onCheckFile && shows(mode, 'checkFile') && (
            <div className="fold-extra">
              <p className="muted small">Have a DXF or SVG from pattern software or a tracing? Its seams are walked to the millimetre.</p>
              <button type="button" className="secondary sm" onClick={onCheckFile}>
                Check a pattern file
              </button>
            </div>
          )}
        </Fold>

        <OpenByCode account={account} onOpen={onOpen} />

        <Fold id="mtitle" title={person.id === ME ? 'My measurements' : `${personName(account, person)}'s measurements`} summary={measured.length ? `${measured.length} taken` : 'None yet'}>
          <PeopleSwitch account={account} onSwitch={onSwitchPerson} onAdd={onAddPerson} />
          {measured.length === 0 && <p className="muted">Nothing measured yet.</p>}
          <dl className="mlist">
            {shown.map((f) => (
              <div key={f.id}>
                <dt>{f.label}</dt>
                <dd>{show(f.id, values[f.id], unit)}</dd>
              </div>
            ))}
          </dl>
          <div className="row wrap fold-actions">
            {measured.length > shown.length && (
              <button type="button" className="link" onClick={() => setAllMeasured(true)}>
                See all {measured.length}
              </button>
            )}
            {allMeasured && measured.length > KEY_FIELDS.length && (
              <button type="button" className="link" onClick={() => setAllMeasured(false)}>
                Show fewer
              </button>
            )}
            <button type="button" className="secondary sm" onClick={onEditMeasurements}>
              Edit measurements
            </button>
            {onClientBook && shows(mode, 'clientBook') && (
              <button type="button" className="link" onClick={onClientBook}>
                Client book
              </button>
            )}
            {person.id !== ME && (
              <button type="button" className="link" onClick={() => onRemovePerson(person.id)}>
                Delete {personName(account, person)}
              </button>
            )}
          </div>
        </Fold>

        <Fold id="settitle" title="Settings" summary={[unit, onMode ? (mode === 'simple' ? 'Simple' : 'All tools') : ''].filter(Boolean).join(' · ')}>
          <fieldset className="group">
            <legend>Units</legend>
            <div className="seg" role="group" aria-label="Units">
              {(['cm', 'in'] as Unit[]).map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => onUnit(u)}>
                  {u === 'cm' ? 'Centimetres' : 'Inches'}
                </button>
              ))}
            </div>
          </fieldset>
          {onMode && (
            <fieldset className="group">
              <legend>Tools</legend>
              <div className="seg" role="group" aria-label="Tools">
                {(['simple', 'all'] as Mode[]).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? 'on' : ''} onClick={() => onMode(m)}>
                    {m === 'simple' ? 'Simple' : 'All tools'}
                  </button>
                ))}
              </div>
              <p className="muted small">
                {mode === 'simple'
                  ? 'Just what you need for a first pattern: style it, print it at home and sew it, step by step.'
                  : 'Everything, for dressmakers and pattern cutters: fitting toiles, couture finishes, size runs, client books and files for a maker.'}
              </p>
            </fieldset>
          )}
        </Fold>

        <Fold id="datatitle" title="Your data" summary={cloud?.user ? 'In your account' : 'On this device'} open={!!cloud?.usable}>
          {cloud?.usable && <CloudAccount cloud={cloud} />}
          <p className="small">
            {cloud?.user ? 'A copy is also kept on this device.' : 'Everything is kept on this device.'} Send it to your computer to carry on there, or download a backup to keep a copy.
          </p>
          <div className="row wrap">
            <SendToDevice link={sendLink} label="Send to another device" className="secondary sm" />
            <button type="button" className="secondary sm" onClick={onBackup}>
              Download a backup
            </button>
            <label className="secondary sm filebtn">
              Restore
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setRestoreMsg((await onRestore(file)) ? 'Restored from your backup.' : "That file isn't a Maison Tracé backup.");
                }}
              />
            </label>
          </div>
          {restoreMsg && (
            <p className="msg small" role="status">
              {restoreMsg}
            </p>
          )}
          {confirmReset ? (
            <div className="stack">
              <p className="small">
                This deletes your name, everyone's measurements and saved patterns from this device. It can't be undone.
                {cloud?.user && ' You\'ll be signed out first, so your account keeps its copy.'}
              </p>
              <div className="row wrap">
                <button type="button" className="primary" onClick={onReset}>
                  Delete everything
                </button>
                <button type="button" className="link" onClick={() => setConfirmReset(false)}>
                  Keep my data
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="link" onClick={() => setConfirmReset(true)}>
              Delete my data and start over
            </button>
          )}
        </Fold>

        <Fold id="testtitle" title="Fit testing" summary={account.testerCode ? 'Tester code on' : 'For testers'}>
          <TesterCode code={account.testerCode} onCode={onTesterCode} />
        </Fold>

        <Fold id="intesttitle" title="Still in testing" summary={`${left.length} to pass`}>
          <p className="muted small">Usable now, labelled In testing until each passes its test at the fit gate. A label comes off by hand once its test is passed, never by itself.</p>
          <ul className="muted small testing-list">
            {left.map((t) => (
              <li key={t.name}>
                <b>{t.name}</b> · comes off when {t.proof}
              </li>
            ))}
          </ul>
        </Fold>

        <Fold id="memtitle" title="Membership" summary={onPlans ? undefined : 'Founding places'}>
          {onPlans && <YourPlan account={account} onPlans={onPlans} />}
          <InterestCard offer="founding" inset />
        </Fold>

        {onBodyDouble && (
          <Fold id="bdtitle" title="Body Double" summary="A dress form in your shape">
            <p className="muted small">Pad a store form to your measurements and cover it with a pattern drafted to your body, so you can fit on yourself.</p>
            <button type="button" className="secondary" onClick={onBodyDouble}>
              Make my form
            </button>
          </Fold>
        )}

        <Fold id="soontitle" title="Coming soon" summary="Sew-alongs, designers, gifts">
          <p className="muted small">None of these are open yet. Leave your email on any you'd like and we'll tell you when it opens.</p>
          <InterestCard offer="sewalong" inset />
          <InterestCard offer="designers" inset />
          <InterestCard offer="gift" inset />
          <InterestCard offer="classroom" inset />
          <InterestCard offer="designer-partner" inset />
          <InterestCard offer="sponsor" inset />
        </Fold>
      </div>

      <p className="fineprint plain">
        <button type="button" className="inline-link" onClick={() => onLegal('made')}>
          How your pattern is made
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('privacy')}>
          Privacy Policy
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('terms')}>
          Terms of Use
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('tester')}>
          Be a fit tester
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('news')}>
          News
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('nights')}>
          Atelier Nights
        </button>
        {' · '}
        <button type="button" className="inline-link" onClick={() => onLegal('brands')}>
          For brands
        </button>
      </p>
    </div>
  );
}

function PatternRow({
  pattern,
  values,
  helped,
  whoFor,
  onOpen,
  onRename,
  onRemove,
  onFit,
  startFitting = false,
  tester = false,
}: {
  pattern: SavedPattern;
  values: MeasurementValues;
  /** The measurements a friend held the tape for, sent with fit notes. */
  helped?: MeasurementId[];
  whoFor?: string;
  startFitting?: boolean;
  /** A fit tester's device: fit notes start ticked to send. */
  tester?: boolean;
  onOpen: () => void;
  onRename: (n: string) => void;
  onRemove: () => void;
  onFit: (fit: FitFeedback | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fitting, setFitting] = useState(startFitting);
  const [more, setMore] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (startFitting) row.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [startFitting]);
  const saveFit = async (fit: FitFeedback, share: boolean) => {
    setFitting(false);
    const kept = { ...fit, sentAt: pattern.fit?.sentAt };
    onFit(kept);
    // One of the four weekly numbers: a fit reported, by garment. Only the count goes; the notes stay here.
    if (!pattern.fit) countStep('fit_reported', garmentKind(pattern.choices));
    if (!share) return setSendMsg('');
    setSendMsg('Sending…');
    const sent = await sendFitReport(fitReport(fit, pattern.choices, values, helped));
    if (sent) onFit({ ...kept, sentAt: new Date().toISOString() });
    setSendMsg(sent ? 'Sent to Maison Tracé. Thank you.' : "Couldn't send just now. Your notes are saved on this device; try again later.");
  };
  const [name, setName] = useState(pattern.name);
  const commit = () => {
    onRename(name.trim() || pattern.name);
    setEditing(false);
  };
  const detail = describePattern(pattern.choices);
  const flat = useMemo(() => choicesFlat(pattern.choices, values), [pattern.choices, values]);

  return (
    <li ref={row}>
      <Envelope size="small" name={pattern.name} flat={flat} />
      <div className="grow">
        {editing ? (
          <input
            aria-label="Pattern name"
            className="inline"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          <strong>{pattern.name}</strong>
        )}
        <p className="muted small">
          {whoFor ? `For ${whoFor} · ` : ''}
          {pattern.name.toLowerCase() === detail.toLowerCase() ? '' : `${detail[0].toUpperCase()}${detail.slice(1)} · `}
          {'fit' in pattern.choices ? `${pattern.choices.fit[0].toUpperCase() + pattern.choices.fit.slice(1)} fit · ` : ''}saved {dateFmt.format(new Date(pattern.savedAt))}
        </p>
        {pattern.fit && !fitting && (
          <p className="small fitnote">
            {pattern.fit.made === 'toile' ? 'Toile' : 'Sewn'} {dateFmt.format(new Date(pattern.fit.at))}: {fitSummary(pattern.fit, pattern.choices)}
            {pattern.fit.notes ? ` · “${pattern.fit.notes}”` : ''}
            {pattern.fit.sentAt ? ' · sent to Maison Tracé' : ''}
          </p>
        )}
        {sendMsg && !fitting && (
          <p className="msg small" role="status">
            {sendMsg}
          </p>
        )}
      </div>
      <div className="row wrap actions">
        <button type="button" className="secondary sm" onClick={onOpen}>
          Open
        </button>
        <button type="button" className="link" aria-expanded={fitting} onClick={() => setFitting(!fitting)}>
          {pattern.fit ? 'Fit notes' : 'How did it fit?'}
        </button>
        <button type="button" className="link more-btn" aria-label={`More for ${pattern.name}`} aria-expanded={more} onClick={() => setMore(!more)}>
          ···
        </button>
      </div>
      {more && (
        <div className="row wrap more-menu">
          <button
            type="button"
            className="link"
            onClick={() => {
              setMore(false);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button type="button" className="link" onClick={onRemove}>
            Delete
          </button>
        </div>
      )}
      {fitting && (
        <>
        <FitForm
          choices={pattern.choices}
          initial={pattern.fit}
          shareByDefault={tester}
          onSave={saveFit}
          onCancel={() => setFitting(false)}
          onClear={
            pattern.fit
              ? () => {
                  if (pattern.fit?.photo) void deletePhoto(pattern.fit.photo).catch(() => {});
                  onFit(undefined);
                  setFitting(false);
                }
              : undefined
          }
        />
        <InterestCard offer="fitcheck" inset pattern={pattern.name} />
        </>
      )}
    </li>
  );
}

/** Type the code from a signature label to open the pattern it was made from. */
function OpenByCode({ account, onOpen }: { account: Account; onOpen: (p: SavedPattern) => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  if (!account.patterns.length) return null;
  const open = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readCode(code)) return setMsg('A label code is MT and four letters or numbers, like MT-7K3Q.');
    const found = findByCode(account, code);
    if (found) onOpen(found);
    else setMsg('No saved pattern on this phone has that code. Patterns are kept on the phone they were saved on.');
  };
  return (
    <section className="card" aria-labelledby="codetitle">
      <h2 id="codetitle">Open from a label</h2>
      <p className="muted small">Type the code woven or printed on a label to open the pattern it was made from.</p>
      <form className="row" onSubmit={open}>
        <input
          id="label-code"
          aria-label="Label code"
          placeholder="MT-7K3Q"
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMsg('');
          }}
        />
        <button type="submit" className="secondary">
          Open
        </button>
      </form>
      {msg && <p className="msg small">{msg}</p>}
    </section>
  );
}
