import { useEffect, useState } from 'react';
import { countStep, flushReports, signupSource } from '../report/report';

interface Props {
  kind: 'tester' | 'news';
  /** Opens the other sign-up. */
  onOther: () => void;
  onPrivacy: () => void;
}

type Sent = 'idle' | 'sending' | 'sent' | 'failed' | 'busy';

/** Posts a sign-up to the signup function, which keeps it in Netlify Blobs. */
async function send(body: object): Promise<Sent> {
  try {
    const res = await fetch('/.netlify/functions/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok ? 'sent' : res.status === 429 ? 'busy' : 'failed';
  } catch {
    return 'failed';
  }
}

/** "Be a fit tester" and "Get news" sign-ups, opened from Your account. */
export function SignupScreen({ kind, onOther, onPrivacy }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sews, setSews] = useState('');
  const [size, setSize] = useState('');
  const [consent, setConsent] = useState(false);
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  useEffect(() => {
    window.scrollTo(0, 0);
    setState('idle');
  }, [kind]);

  const tester = kind === 'tester';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const result = await send(tester ? { kind, name, email, sews, size: size || undefined, consent, website } : { kind, email, src: signupSource(), website });
    setState(result);
    if (result === 'sent') {
      // One of the four weekly numbers: a sign-up, against where the visitor first came from. No email goes with it.
      countStep('signup', signupSource());
      flushReports();
    }
  };

  return (
    <article className="card legal signup" aria-labelledby="stitle">
      <p className="eyebrow">Maison Tracé</p>
      <h1 id="stitle">{tester ? 'Be a fit tester' : 'Get news'}</h1>
      {state === 'sent' ? (
        <p className="msg">{tester ? "Thank you. We'll email you when there's a pattern to test." : "Thank you. We'll email you when there's news."}</p>
      ) : (
        <>
          <p className="lead">
            {tester
              ? 'Sew a toile from a new pattern before everyone else, and tell us how it fitted. Leave your details and we’ll email you when there’s one to try.'
              : 'New garments, the paid plan when it comes, and the odd sewing tip. A few emails a year at most.'}
          </p>
          <form className="stack" onSubmit={submit}>
            {tester && (
              <div className="field plain">
                <label htmlFor="sname">Name</label>
                <input id="sname" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field plain">
              <label htmlFor="semail">Email</label>
              <input id="semail" name="email" type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {tester && (
              <>
                <div className="field plain">
                  <label htmlFor="ssews">What would you sew?</label>
                  <textarea id="ssews" required rows={3} maxLength={500} value={sews} onChange={(e) => setSews(e.target.value)} />
                </div>
                <div className="field plain">
                  <label htmlFor="ssize">
                    Rough size range <span className="muted">(optional)</span>
                  </label>
                  <input id="ssize" maxLength={80} value={size} onChange={(e) => setSize(e.target.value)} />
                </div>
              </>
            )}
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="mt-hp" value={website} onChange={(e) => setWebsite(e.target.value)} />
            {tester ? (
              <label className="check">
                <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  It’s fine to email me about fit testing. We keep your name, email and what you wrote only to run fit tests, and delete them if you ask.
                </span>
              </label>
            ) : (
              <p className="muted small">We use your email only for Maison Tracé news, and delete it if you ask. Every email has a way to stop them.</p>
            )}
            <div className="row wrap">
              <button type="submit" className="primary" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : tester ? 'Sign me up' : 'Keep me posted'}
              </button>
              <button type="button" className="link" onClick={onPrivacy}>
                Privacy
              </button>
            </div>
            {state === 'failed' && <p className="msg small">That didn't go through. Please try again in a moment.</p>}
            {state === 'busy' && <p className="msg small">We've had a lot of sign-ups today. Please try again tomorrow.</p>}
          </form>
        </>
      )}
      <hr />
      <button type="button" className="link" onClick={onOther}>
        {tester ? 'Just want news? Join the list' : 'Want to test new patterns? Be a fit tester'}
      </button>
    </article>
  );
}
