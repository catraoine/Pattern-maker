import { useMemo, useState } from 'react';
import type { Account } from '../account';
import type { MeasurementId, Unit } from '../measurements';
import { fieldOf, GARMENT_NAME } from '../measureFlow';
import { addReply, askIds, askLink, newAskId, redoFlags, rememberAsk, replyPerson, type MeasureReply } from '../measureLink';
import { Title } from '../ui/Title';
import { firstName, shareLink } from '../ui/shareLink';
import { CopyBox } from './MeasureLinkScreen';

interface Props {
  reply: MeasureReply;
  account: Account;
  unit: Unit;
  /** Save the account with the client's numbers in, and open their book unless a redo is going out. */
  onSave: (account: Account, personId: string, open: boolean) => void;
  /** The dressmaker's own name, asked for here when a redo is the first link they send. */
  onName: (name: string) => void;
}

const show = (cm: number | undefined, unit: Unit) => (cm === undefined ? '–' : `${unit === 'cm' ? cm : Math.round((cm / 2.54) * 10) / 10}`);

/**
 * A client's reply link, opened by their dressmaker: the numbers, any worth a second look (Cat's pick L5),
 * then add them to the client book, or send a redo link for the ticked ones.
 */
export function MeasureArrivalScreen({ reply, account, unit, onSave, onName }: Props) {
  const match = useMemo(() => replyPerson(account, reply), [account, reply]);
  const preview = useMemo(() => addReply(account, reply), [account, reply]);
  const was = new Map(preview.changed.map((c) => [c.id, c.was]));
  const order = askIds({ garment: reply.garment });
  const ids = (Object.keys(reply.values) as MeasurementId[]).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const merged = { ...(match?.values ?? {}), ...reply.values };
  const flags = redoFlags(merged, reply.garment).filter((f) => ids.includes(f.id));
  const [redo, setRedo] = useState<Set<MeasurementId>>(() => new Set(flags.map((f) => f.id)));
  const [sent, setSent] = useState<'shared' | 'copied' | 'cancelled' | 'failed' | null>(null);
  const [redoUrl, setRedoUrl] = useState('');
  const name = match?.name || reply.client || 'Your client';
  const first = firstName(name) || name;
  const already = match && !preview.changed.length;
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  const toggle = (id: MeasurementId) => {
    const next = new Set(redo);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRedo(next);
  };

  const askRedo = async () => {
    const ask = { id: newAskId(), from: account.name.trim(), studio: account.studio?.name, client: name, garment: reply.garment, redo: [...redo] };
    const url = askLink(window.location.origin, ask);
    const added = preview.account;
    const people = added.people!.map((p) => (p.id === preview.personId ? rememberAsk(p, ask, new Date().toISOString().slice(0, 10)) : p));
    onSave({ ...added, people }, preview.personId, false);
    setRedoUrl(url);
    const what = [...redo].map((id) => fieldOf(id).label.toLowerCase()).join(' and ');
    setSent(await shareLink(`Hi ${first}, thank you! Could you measure your ${what} once more? It only takes a minute.`, url));
  };

  return (
    <div className="stack wide arrival">
      <section className="card" aria-labelledby="artitle">
        <p className="eyebrow">{reply.redo ? 'Measured again' : `For the ${GARMENT_NAME[reply.garment]}`}</p>
        <Title id="artitle" big={first} label={reply.redo ? 'measured again' : 'numbers arrived'} />
        <p className="muted small">
          {ids.length} {ids.length === 1 ? 'measurement' : 'measurements'}, taken {new Date(`${reply.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.{' '}
          {match ? (already ? `Already in ${first}'s book.` : `Goes into ${match.name}'s book.`) : `${name} isn't in your client book yet, so they'll be added.`}
        </p>
      </section>

      <section className="card" aria-labelledby="arnums">
        <h2 id="arnums">Check the numbers</h2>
        <ul className="arrival-list">
          {ids.map((id) => {
            const flag = flags.find((f) => f.id === id);
            const before = was.get(id);
            return (
              <li key={id} className={flag ? 'flagged' : undefined}>
                <label>
                  <input type="checkbox" checked={redo.has(id)} onChange={() => toggle(id)} aria-label={`Ask ${first} to redo ${fieldOf(id).label}`} />
                  <span className="ar-name">{fieldOf(id).label}</span>
                  <span className="ar-value">
                    {show(reply.values[id], unit)} {unit}
                    {before !== undefined && match && <small> (was {show(before, unit)})</small>}
                  </span>
                </label>
                {flag && <p className="ar-flag small">{flag.message}</p>}
              </li>
            );
          })}
        </ul>
        <p className="muted small">Tick any you'd like {first} to measure again.</p>
        {!already && (
          <button type="button" className="primary" onClick={() => onSave({ ...preview.account }, preview.personId, true)}>
            Add to {first}'s book
          </button>
        )}
        {redo.size > 0 && !account.name.trim() && (
          <div className="field plain ready">
            <label htmlFor="ar-from">Your name, so {first} knows who's asking</label>
            <input id="ar-from" autoComplete="name" value={account.name} onChange={(e) => onName(e.target.value)} />
          </div>
        )}
        <button type="button" className={already ? 'primary' : 'secondary'} disabled={!redo.size || !account.name.trim()} onClick={askRedo}>
          {redo.size ? `Ask ${first} to redo ${redo.size}` : 'Tick one to ask for a redo'}
        </button>
        {already && (
          <button type="button" className="link quiet" onClick={() => onSave(account, match!.id, true)}>
            Open {first}'s book
          </button>
        )}
        {sent === 'copied' && (
          <p className="msg" role="status">
            Redo link copied. Paste it into a message to {first}. Their numbers so far are saved.
          </p>
        )}
        {sent === 'shared' && (
          <p className="msg" role="status">
            Redo link on its way. Their numbers so far are saved.
          </p>
        )}
        {sent === 'failed' && <CopyBox url={redoUrl} why={`Copy this link and send it to ${first}.`} />}
      </section>

      {!standalone && !match && (
        <p className="muted small">
          Keep your client book in the app on your home screen? Copy this page's link and paste it under Client book there, so the numbers land in the right book.
        </p>
      )}
    </div>
  );
}
