import { useEffect, useState } from 'react';
import { InterestCard } from './InterestCard';
import { canShareFiles, download } from './download';
import { labelName } from '../labels';

interface Props {
  /** Whose name goes on the label. */
  name: string;
  /** The saved pattern's code, or undefined until the pattern is saved. */
  code?: string;
  /** The pattern on screen, for the sign-up. */
  pattern: string;
  /** Keeps the pattern in your patterns, which gives it its code; undefined when it can't be kept (the limit). */
  onKeep?: () => void;
}

/**
 * Signature labels (Cat's picks L1 Woven Signature and L4 Print at Home): how the label reads, a free sheet
 * to print at home, and a sign-up for woven labels by post, which aren't open yet.
 */
export function LabelCard({ name, code, pattern, onKeep }: Props) {
  const who = labelName(name) || 'YOU';
  const [mirror, setMirror] = useState(false);
  const [pdf, setPdf] = useState<{ key: string; bytes: Uint8Array } | null>(null);
  const key = `${who}|${code}|${mirror}`;

  // Built ahead, so share runs straight from the tap (phones require that).
  useEffect(() => {
    if (!code) return;
    let live = true;
    import('../engine/pdf')
      .then(({ toLabelSheetPdf }) => toLabelSheetPdf(who, code, { mirror }))
      .then((bytes) => live && setPdf({ key, bytes }));
    return () => {
      live = false;
    };
  }, [who, code, mirror, key]);

  const ready = pdf?.key === key ? pdf.bytes : null;
  const fileName = `labels-${(code ?? '').toLowerCase()}${mirror ? '-mirrored' : ''}.pdf`;
  const get = async () => {
    if (!ready) return;
    if (canShareFiles) {
      try {
        await navigator.share({ files: [new File([ready], fileName, { type: 'application/pdf' })], title: 'Maison Tracé labels' });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    download(ready, 'application/pdf', fileName);
  };

  return (
    <section className="card labelcard" aria-labelledby="labeltitle">
      <p className="eyebrow">Signature label</p>
      <h2 id="labeltitle">Sign what you made</h2>
      <div className="woven" aria-label={`Label reading Drafted for ${who}, Maison Tracé${code ? `, ${code}` : ''}`}>
        <span className="woven-name">DRAFTED FOR {who}</span>
        <span className="woven-house">MAISON TRACÉ{code ? ` · ${code}` : ''}</span>
      </div>
      {code ? (
        <>
          <p className="muted small">Type {code} into the app to open this pattern again. Labels never show your measurements.</p>
          <label className="check">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            <span>
              Mirror it <span className="muted small">for iron-on transfer paper that asks for a mirrored print</span>
            </span>
          </label>
          <button type="button" className="secondary" onClick={get} disabled={!ready}>
            {ready ? 'Print labels at home' : 'Making the labels…'}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">Keep this pattern in your patterns to give it its code, then print labels at home.</p>
          {onKeep && (
            <button type="button" className="secondary" onClick={onKeep}>
              Keep in my patterns
            </button>
          )}
        </>
      )}
      <InterestCard offer="labels" pattern={pattern} inset />
    </section>
  );
}
