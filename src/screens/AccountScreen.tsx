import { useState } from 'react';
import { Account, FREE_SAVED_LIMIT, ME, Person, SavedPattern, activePerson, personName } from '../account';
import { PeopleSwitch } from '../ui/PeopleSwitch';
import { BODICE_FIELDS, SKIRT_FIELDS, TROUSERS_FIELDS, Unit } from '../measurements';
import { describePattern } from './describe';
import { FitForm } from '../ui/FitForm';
import { FitFeedback, fitReport, fitSummary, sendFitReport } from '../fit';
import type { MeasurementValues } from '../measurements';

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
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
  onOpen: (p: SavedPattern) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onFit: (id: string, fit: FitFeedback | undefined) => void;
  onReset: () => void;
  /** Opens the Privacy Policy or the Terms of Use. */
  onLegal: (page: 'privacy' | 'terms') => void;
  onBackup: () => void;
  onRestore: (file: File) => Promise<boolean>;
}

const show = (cm: number | undefined, unit: Unit) =>
  cm === undefined ? '–' : unit === 'cm' ? `${cm} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`;

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function AccountScreen({ account, unit, onName, onUnit, onEditMeasurements, onSwitchPerson, onAddPerson, onRemovePerson, onClientBook, onCheckFile, onOpen, onRename, onRemove, onFit, onReset, onLegal, onBackup, onRestore }: Props) {
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
          <label htmlFor="aname">Your name</label>
          <input id="aname" autoComplete="given-name" value={account.name} placeholder="Me" onChange={(e) => onName(e.target.value)} />
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
              {onClientBook && (
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

        {onCheckFile && (
          <section className="card" aria-labelledby="cftitle2">
            <h2 id="cftitle2">Check any pattern</h2>
            <p className="muted small">Open a DXF or SVG from pattern software or a tracing, and its seams are walked to the millimetre.</p>
            <button type="button" className="secondary" onClick={onCheckFile}>
              Check a pattern file
            </button>
          </section>
        )}

        <section className="card" aria-labelledby="stitle">
          <div className="row between wrap">
            <h2 id="stitle">Saved patterns</h2>
            {account.patterns.length >= FREE_SAVED_LIMIT - 1 && (
              <span className="muted small">
                {account.patterns.length} of {FREE_SAVED_LIMIT} saved
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
          {account.patterns.length >= FREE_SAVED_LIMIT && (
            <p className="muted small">
              That's the free limit. Delete one to save another. <span className="badge">Premium</span> will save as many as you like.
            </p>
          )}
        </section>
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
      )}
    </li>
  );
}
