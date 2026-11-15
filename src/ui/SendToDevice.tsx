import { useState } from 'react';
import { CopyBox } from '../screens/MeasureLinkScreen';
import { shareLink } from './shareLink';

/**
 * "Send to my computer": packs everything on this device into a link and hands it to the share sheet, so the
 * sewist can email or AirDrop it to themselves and carry on there. Where there's no share sheet it's copied.
 */
export function SendToDevice({ link, label = 'Send to my computer', className = 'secondary' }: { link: () => Promise<string>; label?: string; className?: string }) {
  const [sent, setSent] = useState<'shared' | 'copied' | 'cancelled' | 'failed' | null>(null);
  const [url, setUrl] = useState('');
  const send = async () => {
    const u = await link();
    setUrl(u);
    setSent(await shareLink('My Maison Tracé measurements and patterns. Open this link on my computer to carry on there.', u));
  };
  return (
    <>
      <button type="button" className={className} onClick={send}>
        {label}
      </button>
      {sent === 'shared' && (
        <p className="msg small" role="status">
          Sent. Open the link on your computer and tap "Bring it here".
        </p>
      )}
      {sent === 'copied' && (
        <p className="msg small" role="status">
          Link copied. Paste it into an email to yourself, then open it on your computer.
        </p>
      )}
      {sent === 'failed' && <CopyBox url={url} why="Copy this link, email it to yourself and open it on your computer." />}
    </>
  );
}
