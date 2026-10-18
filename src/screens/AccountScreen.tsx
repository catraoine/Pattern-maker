import { useState } from 'react';
import { Account, ME, Person, SavedPattern, activePerson, personName } from '../account';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { BODICE_FIELDS, SKIRT_FIELDS, TROUSERS_FIELDS, Unit } from '../measurements';
import { describePattern } from './describe';
import { FitForm } from '../ui/FitForm';
import { FitFeedback, fitReport, fitSummary, sendFitReport } from '../fit';
import type { MeasurementValues } from '../measurements';
import { Mode, shows } from '../mode';
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
  onReset: () => void;
  /** Opens the Privacy Policy or the Terms of Use. */
  onLegal: (page: 'privacy' | 'terms' | 'tester' | 'news') => void;
  onBackup: () => void;
  onRestore: (file: File) => Promise<boolean>;
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
  /** Opens the plans; only given while the plan screens are shown (see plansShown). */
  onPlans?: () => void;
}

const show = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '–' : unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`;

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function AccountScreen({ account, unit, onName, onUnit, onEditMeasurements, onSwitchPerson, onAddPerson, onRemovePerson, onClientBook, onCheckFile, onBodyDouble, onOpen, onRename, onRemove, onFit, onReset, onLegal, onBackup, onRestore, mode = 'all', onMode, onPlans }: Props) {
  const limit = savedLimit(account);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const display = account.name.trim() || 'Me';
  const person = activePerson(account);
  const { values } = person;
  const measured = ALL_FIELDS.filter((f) => values[f.id] !== undefined);
  // Sent fit notes carry the measurements of whoever the pattern was saved for.
  const valuesFor = (p: SavedPattern) => (account.people.find((x) => x.id === (p.personId ?? ME)) ?? person).values;
  const whoFor = (p: SavedPattern) => {
    const who = p.personId && p.personId !== ME ? account.people.find((x) => x.id === p.personId) : undefined;
    return who ? personName(account, who) : undefined;
  };

  return (
    <div className="split">
      <section className="card help" aria-labelledby="ptitle">
        <div className="row">
          <span className="avatar big" aria-hidden="true">
            {display[0].toUpperCase()}
          </span>
          <div>
            <p className="eyebrow">Your details</p>
            <h1 id="ptitle">{display}</h1>
          </div>
        </div>

        <div className="field plain">
          <label htmlFor="aname">Name</label>
          <input id="aname" autoComplete="given-name" value={account.name} onChange={(e) => onName(e.target.value)} />
        </div>

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

        <div className="backup">
          <p className="eyebrow">Back up</p>
          <p className="small">Everything is kept on this device. Download a backup to keep a copy, or to move it to another phone or computer.</p>
          <div className="row wrap">
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
        </div>

        <div className="footer">
          {confirmReset ? (
            <div className="stack">
              <p className="small">This deletes your name, everyone's measurements and saved patterns from this device. It can't be undone.</p>
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
          <p className="fineprint">
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
          </p>
        </div>
      </section>

      <div className="col grow">
        <section className="card" aria-labelledby="mtitle">
          <div className="row between wrap">
            <h2 id="mtitle">{person.id === ME ? 'My measurements' : `${personName(account, person)}'s measurements`}</h2>
            <div className="row wrap">
              <button type="button" className="link" onClick={onEditMeasurements}>
                Edit
              </button>
              {onClientBook && shows(mode, 'clientBook') && (
                <button type="button" className="link" onClick={onClientBook}>
                  Client book
                </button>
              )}
              {person.id !== ME && (
                <button type="button" className="link" onClick={() => onRemovePerson(person.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
          <PeopleSwitch account={account} onSwitch={onSwitchPerson} onAdd={onAddPerson} />
          {measured.length === 0 && <p className="muted">Nothing measured yet.</p>}
          <dl className="mlist">
            {measured.map((f) => (
              <div key={f.id}>
                <dt>{f.label}</dt>
                <dd>{show(values[f.id], unit)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {onCheckFile && shows(mode, 'checkFile') && (
          <section className="card" aria-labelledby="cftitle2">
            <h2 id="cftitle2">Check any pattern</h2>
            <p className="muted small">Open a DXF or SVG from pattern software or a tracing, and its seams are walked to the millimetre. A DXF from CLO, Gerber, Lectra, Optitex or Seamly2D can then be printed and sent like your own patterns.</p>
            <button type="button" className="secondary" onClick={onCheckFile}>
              Check a pattern file
            </button>
          </section>
        )}

        {onBodyDouble && (
          <section className="card" aria-labelledby="bdtitle">
            <p className="eyebrow">Body Double</p>
            <h2 id="bdtitle">A dress form in your shape</h2>
            <p className="muted small">Pad a store form to your measurements and cover it with a pattern drafted to your body, so you can fit on yourself.</p>
            <button type="button" className="secondary" onClick={onBodyDouble}>
              Make my form
            </button>
          </section>
        )}

        <OpenByCode account={account} onOpen={onOpen} />

        {onPlans && <YourPlan account={account} onPlans={onPlans} />}

        <section className="card" aria-labelledby="stitle">
          <div className="row between wrap">
            <h2 id="stitle">Saved patterns</h2>
            {account.patterns.length >= limit - 1 && limit !== Infinity && (
              <span className="muted small">
                {account.patterns.length} of {limit} saved
              </span>
            )}
          </div>
          {account.patterns.length === 0 ? (
            <p className="muted">Nothing saved yet. Style a skirt, bodice or dress and tap "Save pattern" to keep it here. Once you've sewn it, note how it fitted here.</p>
          ) : (
            <ul className="saved">
              {account.patterns.map((p) => (
                <PatternRow key={p.id} pattern={p} values={valuesFor(p)} whoFor={whoFor(p)} onOpen={() => onOpen(p)} onRename={(n) => onRename(p.id, n)} onRemove={() => onRemove(p.id)} onFit={(f) => onFit(p.id, f)} />
              ))}
            </ul>
          )}
          {account.patterns.length >= limit && (
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
        </section>

        <InterestCard offer="founding" />

        <details className="card more">
          <summary>
            <span className="eyebrow">Coming to Maison Tracé</span>
            <h2>Sew-alongs, designers and gifts</h2>
          </summary>
          <p className="muted small">None of these are open yet. Leave your email on any you'd like and we'll tell you when it opens.</p>
          <InterestCard offer="sewalong" inset />
          <InterestCard offer="designers" inset />
          <InterestCard offer="gift" inset />
          <InterestCard offer="classroom" inset />
          <InterestCard offer="designer-partner" inset />
          <InterestCard offer="sponsor" inset />
        </details>
      </div>
    </div>
  );
}

function PatternRow({
  pattern,
  values,
  whoFor,
  onOpen,
  onRename,
  onRemove,
  onFit,
}: {
  pattern: SavedPattern;
  values: MeasurementValues;
  whoFor?: string;
  onOpen: () => void;
  onRename: (n: string) => void;
  onRemove: () => void;
  onFit: (fit: FitFeedback | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const saveFit = async (fit: FitFeedback, share: boolean) => {
    setFitting(false);
    const kept = { ...fit, sentAt: pattern.fit?.sentAt };
    onFit(kept);
    if (!share) return setSendMsg('');
    setSendMsg('Sending…');
    const sent = await sendFitReport(fitReport(fit, pattern.choices, values));
    if (sent) onFit({ ...kept, sentAt: new Date().toISOString() });
    setSendMsg(sent ? 'Sent to Maison Tracé. Thank you.' : "Couldn't send just now. Your notes are saved on this device; try again later.");
  };
  const [name, setName] = useState(pattern.name);
  const commit = () => {
    onRename(name.trim() || pattern.name);
    setEditing(false);
  };
  const detail = describePattern(pattern.choices);

  return (
    <li>
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
          {pattern.choices.fit[0].toUpperCase() + pattern.choices.fit.slice(1)} fit · saved {dateFmt.format(new Date(pattern.savedAt))}
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
        <button type="button" className="link" onClick={() => setEditing(true)}>
          Rename
        </button>
        <button type="button" className="link" aria-expanded={fitting} onClick={() => setFitting(!fitting)}>
          {pattern.fit ? 'Fit notes' : 'How did it fit?'}
        </button>
        <button type="button" className="link" onClick={onRemove}>
          Delete
        </button>
      </div>
      {fitting && (
        <>
        <FitForm
          choices={pattern.choices}
          initial={pattern.fit}
          onSave={saveFit}
          onCancel={() => setFitting(false)}
          onClear={
            pattern.fit
              ? () => {
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
