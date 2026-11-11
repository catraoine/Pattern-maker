import { useEffect, useState } from 'react';
import { signinFailed } from '../cloud/flag';
import type { Cloud } from '../cloud/useCloud';

const STATUS: Record<string, string> = {
  checking: 'Checking…',
  syncing: 'Saving to your account…',
  saved: 'Saved to your account.',
  offline: "Couldn't reach your account. Your work is safe on this device and will save when you're back online.",
  fault: "Your work is safe on this device, but it couldn't be saved to your account. We've been told, and it will try again when you next make a change.",
};

/** Google's own four-colour G, which its sign-in button rules ask for. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Your account > Your data, once sign-in is shown: sign in with Google (once it's switched on), or an emailed link (or the 6-digit code in the same
 * email, for when the link opens in another browser), then the work is kept in the account as well as here.
 */
export function CloudAccount({ cloud }: { cloud: Cloud }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Back from Google (or an old email link) refused: say so, rather than sitting there signed out.
  const [msg, setMsg] = useState(signinFailed ? "Couldn't sign you in. Try again, or use your email below." : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Signing in or out starts the section over.
  useEffect(() => {
    setSentTo('');
    setCode('');
    setConfirmDelete(false);
  }, [cloud.user?.id]);

  const run = async (fn: () => Promise<void>, failed: string) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch {
      setMsg(failed);
    }
    setBusy(false);
  };

  if (cloud.user)
    return (
      <div className="stack cloud" data-testid="cloud-in">
        <p className="small">
          Signed in as <b>{cloud.user.email}</b>. Your measurements and patterns are kept in your account, so they're there on any device you sign in on.
        </p>
        {cloud.status === 'ask' && (
          <div className="stack" data-testid="cloud-ask">
            <p className="small">
              <b>Someone else was signed in on this device before you.</b> Their patterns and measurements are still here. Nothing has been saved to your account yet.
            </p>
            <div className="stack">
              <button type="button" className="primary" onClick={() => cloud.answerDevice('account')}>
                Use only my account
              </button>
              <p className="muted small">Their work is removed from this device. It stays in their own account.</p>
            </div>
            <div className="stack">
              <button type="button" className="secondary sm" onClick={() => cloud.answerDevice('add')}>
                Copy their work into my account
              </button>
              <p className="muted small">Their patterns are added to yours. Their measurements are kept as a separate person, never mixed with yours.</p>
            </div>
          </div>
        )}
        {STATUS[cloud.status] && (
          <p className="muted small" role="status">
            {STATUS[cloud.status]}
          </p>
        )}
        <div className="row wrap">
          <button type="button" className="secondary sm" disabled={busy} onClick={() => run(cloud.signOut, "Couldn't sign out. Try again.")}>
            Sign out
          </button>
          {!confirmDelete && (
            <button type="button" className="link" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </button>
          )}
        </div>
        <p className="muted small">Signing out keeps everything on this device.</p>
        {confirmDelete && (
          <div className="stack">
            <p className="small">This deletes your account and everything kept in it. What's on this device stays. It can't be undone.</p>
            <div className="row wrap">
              <button type="button" className="primary" disabled={busy} onClick={() => run(cloud.deleteAccount, "Couldn't delete your account. Try again, or email hello@maisontrace.co.")}>
                Delete my account
              </button>
              <button type="button" className="link" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
        {msg && (
          <p className="msg small" role="status">
            {msg}
          </p>
        )}
      </div>
    );

  if (cloud.status === 'checking')
    return (
      <p className="muted small" role="status">
        Checking…
      </p>
    );

  if (sentTo)
    return (
      <form
        className="stack cloud"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => cloud.verifyCode(sentTo, code.trim()), "That code didn't work. Check the newest email, or send a new one.");
        }}
      >
        <p className="small">
          Check your email. We sent a link to <b>{sentTo}</b>. Tap it, or type the 6-digit code from the same email here.
        </p>
        <div className="field plain">
          <label htmlFor="signin-code">Code from the email</label>
          <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="row wrap">
          <button type="submit" className="secondary sm" disabled={busy || code.trim().length !== 6}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setSentTo('');
              setCode('');
              setMsg('');
            }}
          >
            Use another email
          </button>
        </div>
        {msg && (
          <p className="msg small" role="status">
            {msg}
          </p>
        )}
      </form>
    );

  return (
    <form
      className="stack cloud"
      onSubmit={(e) => {
        e.preventDefault();
        const to = email.trim();
        run(async () => {
          await cloud.sendLink(to);
          setSentTo(to);
        }, "Couldn't send the email. Check the address and try again.");
      }}
    >
      <p className="small">Sign in to keep your measurements and patterns in an account, and carry on from any device. No password needed.</p>
      <p className="small" data-testid="signin-copied">
        Anything already on this phone or computer is copied into your account the first time you sign in.
      </p>
      {cloud.googleOn && (
        <>
          <button type="button" className="secondary sm google" disabled={busy} onClick={() => run(cloud.google, "Couldn't reach Google. Try again, or use your email below.")}>
            <GoogleMark />
            Continue with Google
          </button>
          <p className="muted small">Or we email you a link.</p>
        </>
      )}
      <div className="field plain">
        <label htmlFor="signin-email">Email</label>
        <input id="signin-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" className="secondary sm" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {msg && (
        <p className="msg small" role="status">
          {msg}
        </p>
      )}
    </form>
  );
}
