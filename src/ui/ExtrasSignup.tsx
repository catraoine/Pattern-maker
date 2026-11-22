import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { OFFERS, OfferId } from '../offers';

export type Sent = 'idle' | 'sending' | 'sent' | 'failed' | 'busy';

/** Posts an "I'd like this" sign-up to the signup function, which keeps it in Netlify Blobs. */
export async function sendSignup(body: object): Promise<Sent> {
  try {
    const res = await fetch('/.netlify/functions/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok ? 'sent' : res.status === 429 ? 'busy' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Inside Print's Extras, the offers share one email box (declutter, Cat's E, Nov 21): four boxes, each with its own
 *  email and button, read as four forms. A card in here leaves out its own box, and a card's tick box (deadstock's
 *  "Cut it for me too") reports here, so it is sent with that offer. */
const OneEmail = createContext<{ setCut: (offer: OfferId, cut: boolean) => void; cut: Partial<Record<OfferId, boolean>> } | undefined>(undefined);

/** A card's own tick box, kept by the shared box when there is one. */
export function useSharedCut(offer: OfferId, hasChoice: boolean) {
  const one = useContext(OneEmail);
  const set = one?.setCut;
  // Registered unticked, so the offer is sent with `cut: false` as the card's own form sent it.
  useEffect(() => {
    if (hasChoice && set) set(offer, false);
  }, [hasChoice, set, offer]);
  return one;
}

/** The cards, then one box: a tick for each offer, one email, one button. Nothing is ticked until the sewist ticks it. */
export function ExtrasSignup({ offers, pattern, children }: { offers: OfferId[]; pattern?: string; children: ReactNode }) {
  const [cut, setCuts] = useState<Partial<Record<OfferId, boolean>>>({});
  const [wanted, setWanted] = useState<OfferId[]>([]);
  // Ticking a card's choice (Cut it for me too) also ticks its offer below, so the wish is never dropped unsent.
  const [setCut] = useState(() => (offer: OfferId, v: boolean) => {
    setCuts((c) => (c[offer] === v ? c : { ...c, [offer]: v }));
    if (v) setWanted((w) => (w.includes(offer) ? w : [...w, offer]));
  });
  const [email, setEmail] = useState('');
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  const [sentFor, setSentFor] = useState<OfferId[]>([]);
  const picked = offers.filter((o) => wanted.includes(o));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked.length) return;
    setState('sending');
    // One sign-up per offer, as each card sent its own: the read-out counts them by offer.
    const results = await Promise.all(picked.map((offer) => sendSignup({ kind: 'interest', offer, email, pattern: pattern || undefined, cut: cut[offer], website })));
    const went = picked.filter((_, i) => results[i] === 'sent');
    // Offers that went through are unticked, so trying again sends only the rest (each send counts against the day's cap).
    setSentFor((s) => [...s, ...went]);
    if (went.length < picked.length) setWanted((w) => w.filter((o) => !went.includes(o)));
    setState(results.includes('busy') ? 'busy' : results.includes('failed') ? 'failed' : 'sent');
  };

  return (
    <OneEmail.Provider value={{ setCut, cut }}>
      {children}
      <section className="card offer extras-signup" aria-labelledby="extras-signup">
        <p className="eyebrow" id="extras-signup">
          Hear when these open
        </p>
        {state === 'sent' ? (
          <p className="msg">{sentFor.length === 1 ? OFFERS[sentFor[0]].thanks : "Thank you. We'll email you as each one opens. Nothing is charged today."}</p>
        ) : (
          <>
            <div className="extras-ticks" role="group" aria-labelledby="extras-signup">
              {offers.map((o) => (
                <label key={o} className="check">
                  <input type="checkbox" checked={wanted.includes(o)} onChange={(e) => setWanted((w) => (e.target.checked ? [...w, o] : w.filter((x) => x !== o)))} />
                  <span>{OFFERS[o].title}</span>
                </label>
              ))}
            </div>
            <label className="email-label" htmlFor="extras-signup-email">
              Your email
            </label>
            <form className="row" onSubmit={submit}>
              <input id="extras-signup-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
              <button type="submit" className="secondary" disabled={state === 'sending' || !picked.length}>
                {state === 'sending' ? 'Sending…' : 'Tell me'}
              </button>
            </form>
            <p className="muted small">Planned prices. Nothing is charged today.</p>
            {sentFor.length > 0 && <p className="msg small">Sent for {sentFor.map((o) => OFFERS[o].title).join(', ')}.</p>}
            {state === 'failed' && <p className="msg small">{sentFor.length ? 'The rest' : 'That'} didn't go through. Please try again in a moment.</p>}
            {state === 'busy' && <p className="msg small">Too many sign-ups right now. Please try again tomorrow.</p>}
          </>
        )}
      </section>
    </OneEmail.Provider>
  );
}
