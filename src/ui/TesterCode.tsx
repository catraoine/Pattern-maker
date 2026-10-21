import { useState } from 'react';
import { TESTER_CAPS } from '../photo/limit';
import { CODE_MESSAGE, checkCode } from '../access';

/** The header that tells the photo and idea readers this is a fit tester, when a code is kept. */
export const testerHeaders = (code: string | undefined): Record<string, string> => (code ? { 'x-tester-code': code } : {});

/**
 * Your account > Fit testing: type the code from the tester email. It's checked once, then kept on this device
 * and sent with each photo, so testers get more readings a day than everyone else.
 */
export function TesterCode({ code, onCode }: { code?: string; onCode: (code: string | undefined) => void }) {
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState('');
  const [checking, setChecking] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    setChecking(true);
    setMsg('');
    const result = await checkCode(typed);
    if (result === 'tester') {
      onCode(typed.trim());
      setTyped('');
    } else setMsg(CODE_MESSAGE[result]);
    setChecking(false);
  };

  if (code)
    return (
      <div className="stack">
        <p className="small">Tester code on. You can read {TESTER_CAPS.visitor} photos a day while testing. Thank you for testing.</p>
        <button type="button" className="link" onClick={() => onCode(undefined)}>
          Remove the code
        </button>
      </div>
    );
  return (
    <form className="stack" onSubmit={check}>
      <p className="muted small">Testing Maison Tracé? Type the code from your tester email for more photo readings a day.</p>
      <div className="field plain">
        <label htmlFor="tester-code">Tester code</label>
        <input id="tester-code" autoComplete="off" autoCapitalize="none" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <button type="submit" className="secondary sm" disabled={checking || !typed.trim()}>
        {checking ? 'Checking…' : 'Use code'}
      </button>
      {msg && (
        <p className="msg small" role="status">
          {msg}
        </p>
      )}
    </form>
  );
}
