import { useState } from 'react';
import { countStep, flushReports, keepMyRef, signupRef, signupSource } from '../report/report';
import { CODE_MESSAGE, checkCode } from '../access';
import { SEW_LANGS, SEW_LANG_NAME, type SewLang } from '../langs';
import type { Cloud } from '../cloud/useCloud';
import type { Founding } from '../cloud/useFounding';
import { CloudAccount } from './CloudAccount';

/** Founding members' way in, from Feb 9: sign in with the email on the founding list. */
export interface FoundingSignIn {
  cloud: Cloud;
  founding: Founding;
}

/** What the founding sign-in says once someone has signed in (a member is simply let in). */
const FOUNDING_MESSAGE: Partial<Record<Founding['state'], string>> = {
  checking: 'Checking your founding place…',
  'not-listed': "That email isn't on the founding list. Sign out and sign in with the email you joined the waitlist with.",
  failed: "Your place couldn't be checked just now. Try again in a moment.",
};

type Sent = 'idle' | 'sending' | 'failed' | 'busy';

/**
 * The welcome's Begin, while the app is in testing (Cat's W1 Begin Becomes Join, 2026-10-21): a line to write your
 * email on and Join the waitlist, with a quiet way in for testers. A sign-up goes to the same list as "Get news",
 * and counts (with no email) against where the visitor first came from, so bio links like ?src=ig keep counting.
 * It also asks which language they sew in (Cat's L5 Ask First, 2026-10-24), as a tag on the email line (L1, 2026-10-25).
 */
export function WaitlistForm({ onJoined, onCode, linkMessage, onRetry, founding }: { onJoined: () => void; onCode: (code: string) => void; linkMessage?: string; /** Checks the tester link's code again, offered when the check couldn't reach the server. */ onRetry?: () => void; founding?: FoundingSignIn }) {
  const [email, setEmail] = useState('');
  // Left empty by people; bots fill in every box.
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<Sent>('idle');
  const [lang, setLang] = useState<SewLang>('en');
  const [coding, setCoding] = useState(!!linkMessage);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState(linkMessage ?? '');
  const [checking, setChecking] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/.netlify/functions/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'news', email, src: signupSource(), lang, ref: signupRef(), website }) });
      if (!res.ok) return setState(res.status === 429 ? 'busy' : 'failed');
      // Their own referral code, for the share link on "You're on the list".
      keepMyRef(((await res.json().catch(() => null)) as { ref?: unknown } | null)?.ref);
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

  // A founding member signing in sees only the sign-in, so there's one email box on the page, not two.
  if (founding && (signingIn || founding.cloud.user))
    return (
      <div className="stack waitlist waitlist-founding">
        <p className="waitlist-line">Founding members come in from Feb 9. Sign in with the email you joined the waitlist with.</p>
        {FOUNDING_MESSAGE[founding.founding.state] && (
          <p className="msg small" role="status">
            {FOUNDING_MESSAGE[founding.founding.state]}
          </p>
        )}
        <CloudAccount cloud={founding.cloud} />
        {!founding.cloud.user && (
          <p className="waitlist-tester">
            <button type="button" className="inline-link" onClick={() => setSigningIn(false)}>
              Back to the waitlist
            </button>
          </p>
        )}
      </div>
    );

  return (
    <div className="stack waitlist">
      {/* Why to join, naming only what is decided: no prices (Cat's B1, 2026-11-10) */}
      <p className="waitlist-line">Opening 2027. The waitlist gets first claim on 250 numbered Founding places.</p>
      <form className="stack" onSubmit={join}>
        {/* The language is a small tag at the end of the email line, not a line of its own (Cat's L1, 2026-10-25): it
            shows the language's short name and opens the full list. */}
        <div className="field plain waitlist-email">
          <label htmlFor="wl-email" className="visually-hidden">
            Your email
          </label>
          <input id="wl-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="waitlist-lang">
            <span aria-hidden="true">{lang.toUpperCase()}</span>
            <label htmlFor="wl-lang" className="visually-hidden">
              I sew in
            </label>
            <select id="wl-lang" name="language" value={lang} onChange={(e) => setLang(e.target.value as SewLang)}>
              {SEW_LANGS.map((id) => (
                <option key={id} value={id}>
                  {SEW_LANG_NAME[id]}
                </option>
              ))}
            </select>
          </span>
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
              {onRetry && codeMsg === linkMessage && (
                <>
                  {' '}
                  <button type="button" className="inline-link" onClick={onRetry}>
                    Try again
                  </button>
                </>
              )}
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
      {founding && (
        <p className="waitlist-tester">
          Founding member?{' '}
          <button type="button" className="inline-link" onClick={() => setSigningIn(true)}>
            Sign in to come in early
          </button>
        </p>
      )}
    </div>
  );
}
