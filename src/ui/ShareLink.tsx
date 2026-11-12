import { useState } from 'react';
import { myRef } from '../report/report';

/**
 * Under "You're on the list": the person's own link to bring sewing friends (Cat's "apply", Nov 11 2026). Two friends
 * who join through it get them their Founding invite first when claims open on Dec 7 (src/server/referral.ts). Shows
 * nothing when this device never joined (back from the confirm email on another device), since there's no code here.
 */
export function ShareLink() {
  const [code] = useState(myRef);
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const url = `${window.location.origin}/?ref=${code}`;
  const shown = url.replace(/^https?:\/\/(www\.)?/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  };
  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: 'Maison Tracé', text: 'Sewing patterns drafted to your own measurements. Join the waitlist:', url });
    } catch {
      // Closing the share sheet is fine.
    }
  };

  return (
    <div className="stack share-link">
      <p className="waitlist-line">Bring two sewing friends and you'll get your Founding invite before everyone else.</p>
      <div className="field plain">
        <label htmlFor="share-url" className="visually-hidden">
          Your link
        </label>
        <input id="share-url" readOnly value={shown} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="share-link-buttons">
        <button type="button" className="primary" onClick={share}>
          Share link
        </button>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {copied ? 'Link copied' : ''}
      </p>
    </div>
  );
}
