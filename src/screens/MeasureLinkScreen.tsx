import { useState } from 'react';
import type { MeasurementValues, Unit } from '../measurements';
import { fieldOf, GARMENT_NAME, titleOf } from '../measureFlow';
import { askIds, minutesFor, replyLink, type MeasureAsk } from '../measureLink';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { usePersistent } from '../store';
import { Title } from '../ui/Title';
import { TapeDemo } from '../ui/ContourForm';
import { firstName, shareLink } from '../ui/shareLink';
import { MeasurePage, Shell } from './MeasureStepsScreen';

interface Props {
  ask: MeasureAsk;
  unit: Unit;
  onUnit: (u: Unit) => void;
  /** "Keep a copy on this phone": the client's own measurements in the app, for their own patterns. */
  onKeep: (values: MeasurementValues) => void;
}

type Page = { kind: 'intro' } | { kind: 'measure'; at: number; back?: 'done' } | { kind: 'done' };

const show = (cm: number | undefined, unit: Unit) => (cm === undefined ? '–' : `${unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10} ${unit}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * A client measuring for their dressmaker from a measure-me link (Cat's pick L1 + L5 + L4, 2026-10-18).
 * The dressmaker's studio comes first, then one measurement a page with the usual how-to, then the numbers go
 * back in a reply link. Progress is kept on this phone so a reload or a break doesn't lose it.
 */
export function MeasureLinkScreen({ ask, unit, onUnit, onKeep }: Props) {
  const ids = askIds(ask);
  const [stored, setStored] = usePersistent<{ id: string; values: MeasurementValues }>('measure-link', { id: '', values: {} });
  const values = stored.id === ask.id ? stored.values : {};
  const setValues = (v: MeasurementValues) => setStored({ id: ask.id, values: v });
  const [page, setPage] = usePageHistory<Page>(() => ({ kind: 'intro' }));
  const [sent, setSent] = useState<'shared' | 'copied' | 'cancelled' | 'failed' | null>(null);
  const [kept, setKept] = useState(false);
  const from = ask.from || 'your dressmaker';
  const studio = ask.studio || ask.from || 'Your dressmaker';
  const garment = GARMENT_NAME[ask.garment];
  const name = firstName(ask.client);
  const done = ids.filter((id) => values[id] !== undefined).length;

  if (page.kind === 'intro') {
    const first = ids.findIndex((id) => values[id] === undefined);
    return (
      <div className="welcome link-measure">
        <section className="card welcome-card measure-step" aria-labelledby="stitle">
          <p className="eyebrow">{ask.redo ? `${cap(from)} asks` : 'Measuring for'}</p>
          {ask.redo ? <Title id="stitle" big="Once more" label={`${ids.length === 1 ? 'one measurement' : `${ids.length} measurements`} to redo`} /> : <h1 id="stitle" className="studio-name">{studio}</h1>}
          <p className="muted">{ask.redo ? ids.map((id) => fieldOf(id).label).join(', ') : `Your ${garment}${ask.client ? `, for ${ask.client}` : ''}`}</p>
          {ask.note && !ask.redo && (
            <blockquote className="studio-note">
              <p>{ask.note}</p>
              {ask.from && <footer>{ask.from}</footer>}
            </blockquote>
          )}
          <dl className="need">
            <div>
              <dt>You'll need</dt>
              <dd>A soft tape measure</dd>
            </div>
            <div>
              <dt>Takes</dt>
              <dd>
                {ids.length} {ids.length === 1 ? 'measurement' : 'measurements'}, about {minutesFor(ids.length)} minutes
              </dd>
            </div>
          </dl>
          <p className="muted small">Each one has a short how-to. Ask someone to help with the back if you can.</p>
          <button type="button" className="primary" onClick={() => setPage(first < 0 ? { kind: 'done' } : { kind: 'measure', at: first })}>
            {done && first >= 0 ? 'Carry on' : first < 0 ? 'See my numbers' : 'Start'}
          </button>
          <p className="link-by small muted">With Maison Tracé</p>
        </section>
      </div>
    );
  }

  if (page.kind === 'done') {
    const reply = () => replyLink(window.location.origin, { id: ask.id, client: ask.client, garment: ask.garment, date: new Date().toISOString().slice(0, 10), values: Object.fromEntries(ids.filter((id) => values[id] !== undefined).map((id) => [id, values[id]!])), redo: !!ask.redo });
    const send = async () => setSent(await shareLink(`${ask.redo ? 'Measured again' : `My measurements for the ${garment}`}${name ? `, from ${name}` : ''}:`, reply()));
    return (
      <Shell eyebrow={`${done} of ${ids.length}`} title={name ? `All done, ${name}.` : 'All done.'} hero={<TapeDemo id="waist" name="" mode="all" />}>
        <ul className="check-list" aria-label="Tap one to change it">
          {ids.map((id, at) => (
            <li key={id}>
              <button type="button" onClick={() => setPage({ kind: 'measure', at, back: 'done' })}>
                <span>{cap(titleOf(id, false).replace(/^Your /, ''))}</span>
                <span>{show(values[id], unit)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Your numbers travel inside the reply link, straight to {from}. Nothing is saved online.</p>
        <button type="button" className="primary" disabled={done < ids.length} onClick={send}>
          Send to {from}
        </button>
        {sent === 'copied' && (
          <p className="msg" role="status">
            Link copied. Paste it into a message to {from}.
          </p>
        )}
        {sent === 'failed' && <CopyBox url={reply()} why={`Copy this link and send it to ${from}.`} />}
        {!ask.redo &&
          (kept ? (
            <p className="muted small" role="status">
              Saved on this phone too.
            </p>
          ) : (
            <button
              type="button"
              className="link quiet"
              onClick={() => {
                onKeep(values);
                setKept(true);
              }}
            >
              Keep a copy on this phone
            </button>
          ))}
      </Shell>
    );
  }

  const at = page.at;
  const last = at === ids.length - 1;
  return (
    <MeasurePage
      key={ids[at]}
      id={ids[at]}
      eyebrow={`${at + 1} of ${ids.length}`}
      dots={[ids.length, at]}
      helper={false}
      form="womenswear"
      unit={unit}
      values={values}
      garment={ask.garment}
      onUnit={onUnit}
      onValues={(v) => setValues(v)}
      onNext={() => (page.back && canGoBack() ? goBack() : setPage(page.back || last ? { kind: 'done' } : { kind: 'measure', at: at + 1 }))}
      label={page.back ? 'Save' : last ? 'Done' : 'Next'}
    />
  );
}

/** A link shown to copy by hand, for phones that won't share or copy it. */
export function CopyBox({ url, why }: { url: string; why: string }) {
  return (
    <div className="field plain ready">
      <label htmlFor="copy-link">{why}</label>
      <input id="copy-link" readOnly value={url} onFocus={(e) => e.target.select()} />
    </div>
  );
}
