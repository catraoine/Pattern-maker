import { useState } from 'react';
import { OFFERS, OfferId } from '../offers';

type Sent = 'idle' | 'sending' | 'sent' | 'failed' | 'busy';

/** Posts an "I'd like this" sign-up to the signup function, which keeps it in Netlify Blobs. */
async function send(body: object): Promise<Sent> {
  try {
    const res = await fetch('/.netlify/functions/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok ? 'sent' : res.status === 429 ? 'busy' : 'failed';
  } catch {
    return 'failed';
  }
}

interface Props {
  offer: OfferId;
  /** The pattern on screen, if any, so we know which garment people asked about. */
  pattern?: string;
  /** No card of its own: sits inside another card under a rule. */
  inset?: boolean;
}

/** A paid extra that isn't open yet, with an email sign-up to hear when it opens. */
export function InterestCard({ offer, pattern, inset }: Props) {
  const o = OFFERS[offer];
  const [email, setEmail] = useState('');
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  const id = `offer-${offer}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setState(await send({ kind: 'interest', offer, email, pattern: pattern || undefined, website }));
  };

  const body = (
    <>
      <p className="eyebrow">{o.eyebrow}</p>
      <h2 id={id}>{o.title}</h2>
      <p className="muted">{o.text}</p>
      {o.prices && (
        <dl className="offerprices">
          {o.prices.map(([label, price]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{price}</dd>
            </div>
          ))}
        </dl>
      )}
      {state === 'sent' ? (
        <p className="msg">{o.thanks}</p>
      ) : (
        <>
          <form className="row" onSubmit={submit}>
            <input type="email" required autoComplete="email" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <button type="submit" className="secondary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : o.button}
            </button>
          </form>
          {o.prices && <p className="muted small">Planned price. Nothing is charged today.</p>}
          {state === 'failed' && <p className="msg small">That didn't go through. Please try again in a moment.</p>}
          {state === 'busy' && <p className="msg small">Too many sign-ups right now. Please try again tomorrow.</p>}
        </>
      )}
    </>
  );

  return inset ? (
    <div className="offer inset" aria-labelledby={id}>
      <hr />
      {body}
    </div>
  ) : (
    <section className="card offer" aria-labelledby={id}>
      {body}
    </section>
  );
}
