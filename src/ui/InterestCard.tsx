import { ReactNode, useState } from 'react';
import { NightCity, OFFERS, OfferId } from '../offers';

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
  /** The city an Atelier Nights sign-up is for. */
  city?: NightCity;
  /** No card of its own: sits inside another card under a rule. */
  inset?: boolean;
  /** Shown under the offer's text, such as the cloth and length for this pattern. */
  children?: ReactNode;
  /** A tick box sent with the sign-up as `cut`, such as "Cut it for me too". */
  choice?: { label: string; hint: string };
}

/** A paid extra that isn't open yet, with an email sign-up to hear when it opens. */
export function InterestCard({ offer, pattern, city, inset, children, choice }: Props) {
  const o = OFFERS[offer];
  const [email, setEmail] = useState('');
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  const [picked, setPicked] = useState(false);
  const id = `offer-${offer}${city ? `-${city}` : ''}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setState(await send({ kind: 'interest', offer, email, pattern: pattern || undefined, cut: choice ? picked : undefined, city, website }));
  };

  const body = (
    <>
      <p className="eyebrow">{o.eyebrow}</p>
      <h2 id={id}>{o.title}</h2>
      <p className="muted">{o.text}</p>
      {children}
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
          {choice && (
            <label className="check">
              <input type="checkbox" checked={picked} onChange={(e) => setPicked(e.target.checked)} />
              <span>
                {choice.label} <span className="muted small">{choice.hint}</span>
              </span>
            </label>
          )}
          <form className="row" onSubmit={submit}>
            <input type="email" required autoComplete="email" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <button type="submit" className="secondary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : o.button}
            </button>
          </form>
          {o.prices && <p className="muted small">Planned price. Nothing is charged today.</p>}
          {o.fine && <p className="muted small">{o.fine}</p>}
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
