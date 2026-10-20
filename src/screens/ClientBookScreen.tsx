import { useEffect, useMemo, useState } from 'react';
import { Account, Person, addNote, addPhoto, newId, personName, removeNote, removePhoto, SavedPattern } from '../account';
import { BODICE_FIELDS, SKIRT_FIELDS, TROUSERS_FIELDS, Unit } from '../measurements';
import { describeFitting, versionsOf } from '../engine/fitting';
import { describePattern } from './describe';
import { deletePhoto, getPhoto, putPhoto, shrink } from '../photoStore';
import type { Garment } from '../measurements';
import type { MeasureReply } from '../measureLink';
import { AskToMeasure } from '../ui/AskToMeasure';
import { TestingTag } from '../ui/TestingTag';

interface Props {
  account: Account & { people: Person[] };
  person: Person;
  unit: Unit;
  onChange: (p: Person) => void;
  onOpen: (p: SavedPattern) => void;
  /** The garment in hand, picked first when asking a client to measure. */
  garment: Garment;
  onAccount: (a: Account) => void;
  onReply: (reply: MeasureReply) => void;
}

const FIELDS = [...SKIRT_FIELDS, ...TROUSERS_FIELDS, ...BODICE_FIELDS].filter((f, i, all) => all.findIndex((g) => g.id === f.id) === i);
const today = () => new Date().toISOString().slice(0, 10);
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const show = (v: number | undefined, unit: Unit) => (v === undefined ? '–' : unit === 'cm' ? `${v}` : `${Math.round((v / 2.54) * 10) / 10}`);

/**
 * One client's record, the way a dressmaker keeps a client book: their measurements over time, every
 * toile fitting and what it changed, fitting notes, toile photos and the patterns made for them.
 */
export function ClientBookScreen({ account, person, unit, onChange, onOpen, garment, onAccount, onReply }: Props) {
  const name = personName(account, person);
  const history = person.history ?? [];
  const recent = history.slice(-4);
  const rows = FIELDS.filter((f) => recent.some((h) => h.values[f.id] !== undefined));
  const patterns = account.patterns.filter((p) => (p.personId ?? 'me') === person.id);
  const [note, setNote] = useState('');
  const [caption, setCaption] = useState('');
  const fittings = Object.entries(person.fittings ?? {}).filter(([, f]) => f && f.round > 0);

  const addPicture = async (file: File | undefined) => {
    if (!file) return;
    const id = newId();
    if (await putPhoto(id, await shrink(file))) {
      onChange(addPhoto(person, id, caption.trim(), today()));
      setCaption('');
    }
  };

  return (
    <div className="stack wide">
      <section className="card" aria-labelledby="cbtitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Client book <TestingTag /></p>
            <h1 id="cbtitle">{name}</h1>
          </div>
        </div>
        <p className="muted small">Kept on this device only, with the photos.</p>
      </section>

      <AskToMeasure account={account} person={person} garment={garment} onAccount={onAccount} onReply={onReply} />

      <section className="card" aria-labelledby="cbm">
        <h2 id="cbm">Measurements over time</h2>
        {recent.length ? (
          <div className="tablewrap">
            <table className="history">
              <thead>
                <tr>
                  <th>{unit}</th>
                  {recent.map((h) => (
                    <th key={h.date}>{day(h.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <th>{f.label}</th>
                    {recent.map((h, i) => {
                      const v = h.values[f.id];
                      const was = i ? recent[i - 1].values[f.id] : undefined;
                      const moved = i > 0 && v !== undefined && was !== undefined && v !== was;
                      return (
                        <td key={h.date} className={moved ? 'moved' : ''}>
                          {show(v, unit)}
                          {moved && <span className="small"> ({v! > was! ? '+' : '−'}{show(Math.abs(Math.round((v! - was!) * 10) / 10), unit)})</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Each time the measurements are taken again, they're kept here with the date.</p>
        )}
        {Object.keys(person.values).length > 0 && (
          <div className="row wrap">
            <button type="button" className="secondary" onClick={() => void saveMeasurements('vit', person.values, name)}>
              Seamly2D (.vit)
            </button>
            <button type="button" className="secondary" onClick={() => void saveMeasurements('csv', person.values, name)}>
              Spreadsheet (.csv)
            </button>
          </div>
        )}
        {Object.keys(person.values).length > 0 && <p className="muted small">The DXF and tech pack are on the Print screen, once a style is picked.</p>}
      </section>

      <section className="card" aria-labelledby="cbf">
        <h2 id="cbf">Fittings</h2>
        {fittings.length ? (
          fittings.map(([g, f]) => (
            <div key={g}>
              <p className="eyebrow">{g}</p>
              <ol className="fitlist">
                {versionsOf(f)
                  .slice(1)
                  .map((v) => (
                    <li key={v.version}>
                      Version {v.version}
                      {v.fitting.date ? `, ${day(v.fitting.date)}` : ''}: {describeFitting(v.fitting, g as never).join('; ') || 'no corrections'}
                    </li>
                  ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="muted">No toile fittings yet. After a toile, tick what you see on the print screen and it's kept here.</p>
        )}
      </section>

      <section className="card" aria-labelledby="cbn">
        <h2 id="cbn">Fitting notes</h2>
        <ul className="notes">
          {(person.notes ?? []).map((n) => (
            <li key={n.id}>
              <span className="muted small">{day(n.date)}</span> {n.text}{' '}
              <button type="button" className="link inline-link" onClick={() => onChange(removeNote(person, n.id))}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <label className="field">
          <span className="small">New note</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={!note.trim()}
          onClick={() => {
            onChange(addNote(person, note.trim(), today()));
            setNote('');
          }}
        >
          Add note
        </button>
      </section>

      <section className="card" aria-labelledby="cbp">
        <h2 id="cbp">Toile photos</h2>
        <div className="photos">
          {(person.photos ?? []).map((ph) => (
            <Photo
              key={ph.id}
              id={ph.id}
              caption={ph.caption}
              date={day(ph.date)}
              onRemove={() => {
                void deletePhoto(ph.id);
                onChange(removePhoto(person, ph.id));
              }}
            />
          ))}
        </div>
        <div className="row wrap">
          <label htmlFor="photo-caption" className="small">Caption</label>
          <input id="photo-caption" type="text" className="inline" style={{ width: 'auto', flex: '1 1 220px' }} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <label className="secondary filebtn">
            Add a photo
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addPicture(e.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section className="card" aria-labelledby="cbpat">
        <h2 id="cbpat">Patterns</h2>
        {patterns.length ? (
          <ul className="saved">
            {patterns.map((p) => (
              <li key={p.id} className="row between wrap">
                <span>
                  {p.name} <span className="muted small">{describePattern(p.choices)}</span>
                </span>
                <button type="button" className="link" onClick={() => onOpen(p)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Patterns saved for {name} show up here.</p>
        )}
      </section>
    </div>
  );
}

async function saveMeasurements(kind: 'vit' | 'csv', values: Person['values'], name: string) {
  const { toVit, toMeasurementsCsv } = await import('../measureExport');
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
  const blob = kind === 'vit' ? new Blob([toVit(values, name)], { type: 'application/xml' }) : new Blob([toMeasurementsCsv(values)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}-measurements.${kind}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Photo({ id, caption, date, onRemove }: { id: string; caption: string; date: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let u: string | undefined;
    let live = true;
    void getPhoto(id).then((b) => {
      if (b && live) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  const alt = useMemo(() => caption || `Toile photo, ${date}`, [caption, date]);
  return (
    <figure className="photo">
      {url ? <img src={url} alt={alt} /> : <div className="photo-missing small muted">Photo not on this device</div>}
      <figcaption className="small">
        {caption || 'Toile'} <span className="muted">{date}</span>{' '}
        <button type="button" className="link inline-link" onClick={onRemove}>
          Delete
        </button>
      </figcaption>
    </figure>
  );
}
