import { useState } from 'react';
import { countStep, flushReports, signupSource } from '../report/report';
import { CODE_MESSAGE, checkCode } from '../access';
import { SEW_LANGS, SEW_LANG_NAME, type SewLang } from '../langs';

type Sent = 'idle' | 'sending' | 'failed' | 'busy';

/**
 * The welcome's Begin, while the app is in testing (Cat's W1 Begin Becomes Join, 2026-10-21): a line to write your
 * email on and Join the waitlist, with a quiet way in for testers. A sign-up goes to the same list as "Get news",
 * and counts (with no email) against where the visitor first came from, so bio links like ?src=ig keep counting.
 * It also asks which language they sew in, on one line with a drop-down (Cat's L5 Ask First, 2026-10-24).
 */
export function WaitlistForm({ onJoined, onCode, linkMessage }: { onJoined: () => void; onCode: (code: string) => void; linkMessage?: string }) {
  const [email, setEmail] = useState('');
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  const [lang, setLang] = useState<SewLang>('en');
  const [coding, setCoding] = useState(!!linkMessage);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState(linkMessage ?? '');
  const [checking, setChecking] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/.netlify/functions/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'news', email, src: signupSource(), lang, website }) });
      if (!res.ok) return setState(res.status === 429 ? 'busy' : 'failed');
    } catch {
      return setState('failed');
    }
    countStep('signup', signupSource());
    flushReports();
    onJoined();
  };

  const useCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setCodeMsg('');
    const result = await checkCode(code);
    setChecking(false);
    if (result === 'tester') onCode(code.trim());
    else setCodeMsg(CODE_MESSAGE[result]);
  };

  return (
    <div className="stack waitlist">
      <p className="waitlist-line">Opening in 2027. Join the list to get in first.</p>
      <form className="stack" onSubmit={join}>
        <div className="field plain">
          <label htmlFor="wl-email" className="visually-hidden">
            Your email
          </label>
          <input id="wl-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="waitlist-lang">
          <label htmlFor="wl-lang">I sew in</label>
          <select id="wl-lang" name="language" value={lang} onChange={(e) => setLang(e.target.value as SewLang)}>
            {SEW_LANGS.map((id) => (
              <option key={id} value={id}>
                {SEW_LANG_NAME[id]}
              </option>
            ))}
          </select>
        </div>
        {lang !== 'en' && <p className="waitlist-lang-note">We'll tell you when Maison Tracé speaks it.</p>}
        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="mt-hp" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <button type="submit" className="primary" disabled={state === 'sending'}>
          {state === 'sending' ? 'Joining…' : 'Join the waitlist'}
        </button>
        {state === 'failed' && (
          <p className="msg small" role="status">
            That didn't go through. Please try again in a moment.
          </p>
        )}
        {state === 'busy' && (
          <p className="msg small" role="status">
            We've had a lot of sign-ups today. Please try again tomorrow.
          </p>
        )}
      </form>
      {coding ? (
        <form className="waitlist-code" onSubmit={useCode}>
          <div className="field plain">
            <label htmlFor="wl-code" className="visually-hidden">
              Tester code
            </label>
            <input id="wl-code" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Tester code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button type="submit" className="secondary sm" disabled={checking || !code.trim()}>
            {checking ? 'Checking…' : 'Use code'}
          </button>
          {codeMsg && (
            <p className="msg small" role="status">
              {codeMsg}
            </p>
          )}
        </form>
      ) : (
        <p className="waitlist-tester">
          Testing for us?{' '}
          <button type="button" className="inline-link" onClick={() => setCoding(true)}>
            Use your code
          </button>
        </p>
      )}
    </div>
  );
}
