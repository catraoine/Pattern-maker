import { useState } from 'react';
import { ME, addPerson, updatePerson, withPeople, type Account, type Person } from '../account';
import type { Garment } from '../measurements';
import { GARMENT_NAME, GARMENTS } from '../measureFlow';
import { askIds, askLink, minutesFor, newAskId, readPasted, rememberAsk, type MeasureReply } from '../measureLink';
import { firstName, shareLink } from './shareLink';
import { CopyBox } from '../screens/MeasureLinkScreen';

interface Props {
  account: Account;
  /** Whose book this is. In your own book, the link goes to a new client, named here. */
  person: Person;
  garment: Garment;
  onAccount: (a: Account) => void;
  /** A reply link pasted in, for when it opened outside the home-screen app. */
  onReply: (reply: MeasureReply) => void;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Ask a client to measure themselves (Cat's pick L1 Reply Link with L4 studio branding, 2026-10-18): pick the
 * garment, and the link asks only what it needs. The studio name and note show on the client's first page.
 */
export function AskToMeasure({ account, person, garment: start, onAccount, onReply }: Props) {
  const own = person.id === ME;
  const [garment, setGarment] = useState<Garment>(start);
  const [client, setClient] = useState('');
  const [studioOpen, setStudioOpen] = useState(!account.name.trim());
  const [sent, setSent] = useState<{ result: string; url: string; to: string } | null>(null);
  const [pasted, setPasted] = useState('');
  const [pasteNote, setPasteNote] = useState('');
  const studio = account.studio ?? { name: '', note: '' };
  const count = askIds({ garment }).length;
  const to = own ? client.trim() : person.name.trim();
  const from = account.name.trim();

  const send = async () => {
    let next = withPeople(account);
    let who = person;
    if (own) {
      next = withPeople(addPerson(next, to));
      who = next.people.find((p) => p.id === next.active)!;
      // Asking doesn't switch whose measurements are in use.
      next = { ...next, active: account.active ?? ME };
    }
    const ask = { id: newAskId(), from, studio: studio.name.trim() || undefined, note: studio.note.trim() || undefined, client: to, garment };
    onAccount(updatePerson(next, who.id, rememberAsk(who, ask, new Date().toISOString().slice(0, 10))));
    const url = askLink(window.location.origin, ask);
    const result = await shareLink(`Hi ${firstName(to)}, could you measure yourself for your ${GARMENT_NAME[garment]}? It takes about ${minutesFor(count)} minutes, with a how-to for each one.`, url);
    setSent({ result, url, to: firstName(to) });
    if (own) setClient('');
  };

  return (
    <section className="card ask-measure" aria-labelledby="askt">
      <h2 id="askt">{own ? 'Ask a client to measure' : `Ask ${firstName(person.name) || 'them'} to measure`}</h2>
      <p className="muted small">They measure at home with the how-to guides and send the numbers back in a link. Nothing is stored online.</p>
      {own && (
        <div className="field plain ready">
          <label htmlFor="ask-client">Client's name</label>
          <input id="ask-client" autoComplete="off" value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
      )}
      <div className="chips" role="radiogroup" aria-label="For">
        {GARMENTS.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={garment === g} className={garment === g ? 'chip on' : 'chip'} onClick={() => setGarment(g)}>
            {cap(GARMENT_NAME[g])}
          </button>
        ))}
      </div>
      <p className="muted small">
        {count} measurements, about {minutesFor(count)} minutes.
      </p>

      <button type="button" className="link quiet" aria-expanded={studioOpen} onClick={() => setStudioOpen(!studioOpen)}>
        {studio.name.trim() ? `How clients see you: ${studio.name.trim()}` : 'How clients see you'}
      </button>
      {studioOpen && (
        <div className="stack studio-setup">
          <div className="field plain ready">
            <label htmlFor="ask-from">Your name</label>
            <input id="ask-from" autoComplete="name" value={account.name} onChange={(e) => onAccount({ ...account, name: e.target.value })} />
          </div>
          <div className="field plain ready">
            <label htmlFor="ask-studio">Studio name, shown big on their first page</label>
            <input id="ask-studio" autoComplete="organization" value={studio.name} onChange={(e) => onAccount({ ...account, studio: { ...studio, name: e.target.value } })} />
          </div>
          <label className="field plain ready">
            <span className="small">A note on every link</span>
            <textarea id="ask-note" rows={2} maxLength={400} placeholder="Wear something close-fitting, and ask someone to help with the back." value={studio.note} onChange={(e) => onAccount({ ...account, studio: { ...studio, note: e.target.value } })} />
          </label>
        </div>
      )}

      <button type="button" className="primary" disabled={!to || !from} onClick={send}>
        Send link
      </button>
      {!from && <p className="muted small">Add your name first, so they know who's asking.</p>}
      {sent?.result === 'copied' && (
        <p className="msg" role="status">
          Link copied. Paste it into a message to {sent.to}.
        </p>
      )}
      {sent?.result === 'failed' && <CopyBox url={sent.url} why={`Copy this link and send it to ${sent.to}.`} />}

      <form
        className="paste-reply"
        onSubmit={(e) => {
          e.preventDefault();
          const got = readPasted(pasted);
          if (got?.kind === 'reply') {
            setPasted('');
            setPasteNote('');
            onReply(got.reply);
          } else setPasteNote(got?.kind === 'ask' ? "That's a link for a client to measure with, not their reply." : "That doesn't look like a whole reply link. Ask them to send it again.");
        }}
      >
        <div className="field plain ready">
          <label htmlFor="paste-reply">Got a reply link? Paste it here</label>
          <input id="paste-reply" autoComplete="off" value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </div>
        {pasteNote && <p className="msg error">{pasteNote}</p>}
        <button type="submit" className="secondary" disabled={!pasted.trim()}>
          Add their numbers
        </button>
      </form>
    </section>
  );
}
