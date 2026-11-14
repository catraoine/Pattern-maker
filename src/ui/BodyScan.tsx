import { useState } from 'react';
import { OWNER } from '../legal';
import type { Unit } from '../measurements';
import { testerHeaders } from './TesterCode';

type ScanError = 'limit_reached' | 'busy' | 'failed';

const SCAN_MESSAGE: Record<ScanError, string> = {
  limit_reached: "That's all the scans for today. Try again tomorrow.",
  busy: `The body scan is full for now. Email ${OWNER.email} and we'll sort it out.`,
  failed: "The scan couldn't start just now. Check you're online and try again.",
};

/**
 * Your account > Fit testing, for the testers who asked to try a body scan (Cat, Nov 14). Our server gets a pass for
 * one scan; the scan itself runs on Bodygram's site in a new tab, so the photos go to Bodygram and never to us. The
 * pass is fetched first and then shown as a plain link, because phones block a new tab that opens after a wait.
 */
export function BodyScan({ code, unit }: { code: string; unit: Unit }) {
  const [url, setUrl] = useState<string>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/.netlify/functions/body-scan', { method: 'POST', headers: { 'Content-Type': 'application/json', ...testerHeaders(code) }, body: JSON.stringify({ unit }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (data.ok && data.url) setUrl(data.url);
      else setMsg(SCAN_MESSAGE[data.error === 'limit_reached' || data.error === 'busy' ? data.error : 'failed']);
    } catch {
      setMsg(SCAN_MESSAGE.failed);
    }
    setBusy(false);
  };

  return (
    <div className="stack body-scan">
      <p className="small">
        <b>Body scan.</b> Only if you said yes to trying it. It takes about 5 minutes on your phone, with a helper or the phone propped up. Your photos go to Bodygram, the scan company, and never come to us.
      </p>
      {url ? (
        <>
          <a className="link" href={url} target="_blank" rel="noopener noreferrer">
            Open the scanner ›
          </a>
          <p className="muted small">
            When it's done, screenshot your measurements and email just the numbers to {OWNER.email}.
          </p>
        </>
      ) : (
        <button type="button" className="secondary sm" disabled={busy} onClick={start}>
          {busy ? 'Getting your scan ready…' : 'Start a body scan'}
        </button>
      )}
      {msg && (
        <p className="msg small" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
