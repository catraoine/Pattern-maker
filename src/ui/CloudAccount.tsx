import { useEffect, useState } from 'react';
import type { Cloud } from '../cloud/useCloud';

const STATUS: Record<string, string> = {
  checking: 'Checking…',
  syncing: 'Saving to your account…',
  saved: 'Saved to your account.',
  offline: "Couldn't reach your account. Your work is safe on this device and will save when you're back online.",
};

/**
 * Your account > Your data, once sign-in is shown: sign in with an emailed link (or the 6-digit code in the same
 * email, for when the link opens in another browser), then the work is kept in the account as well as here.
 */
export function CloudAccount({ cloud }: { cloud: Cloud }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
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
      <p className="small">Sign in to keep your measurements and patterns in an account, and carry on from any device. What you've made here comes with you. No password: we email you a link.</p>
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
