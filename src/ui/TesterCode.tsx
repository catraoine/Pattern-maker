import { TesterReport } from './TesterReport';
import { BodyScan } from './BodyScan';
import type { Unit } from '../measurements';
import { useState } from 'react';
import { TESTER_CAPS, cleanCode } from '../photo/limit';
import { CODE_MESSAGE, checkCode } from '../access';

/** The header that tells the photo and idea readers this is a fit tester, when a code is kept. */
export const testerHeaders = (code: string | undefined): Record<string, string> => (code ? { 'x-tester-code': code } : {});

/**
 * Your account > Fit testing: type the code from the tester email. It's checked once, then kept on this device
 * and sent with each photo, so testers get more readings a day than everyone else.
 */
export function TesterCode({ code, unit, onCode }: { code?: string; unit: Unit; onCode: (code: string | undefined) => void }) {
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState('');
  const [checking, setChecking] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanCode(typed)) return;
    setChecking(true);
    setMsg('');
    const result = await checkCode(typed);
    if (result === 'tester') {
      onCode(cleanCode(typed));
      setTyped('');
    } else setMsg(CODE_MESSAGE[result]);
    setChecking(false);
  };

  if (code)
    return (
      <div className="stack">
        <p className="small">You're in as a fit tester. Thank you. You can start from a photo {TESTER_CAPS.visitor} times a day.</p>
        <TesterReport lead="Sewn your toile?" />
        <BodyScan code={code} unit={unit} />
        <button type="button" className="link" onClick={() => onCode(undefined)}>
          Remove the code
        </button>
      </div>
    );
  return (
    <form className="stack" onSubmit={check}>
      <p className="muted small">Came in without your tester link? Type the code from your tester email.</p>
      <div className="field plain">
        <label htmlFor="tester-code">Tester code</label>
        {/* In capitals as it is typed, like the code box on the welcome page (Cat, Nov 15); the check ignores case. */}
        <input id="tester-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} />
      </div>
      <button type="submit" className="secondary sm" disabled={checking || !cleanCode(typed)}>
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
