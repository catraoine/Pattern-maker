import { useEffect, useRef, useState } from 'react';
import type { Choices } from '../App';
import { photoToJpeg } from '../photo/image';
import type { Confidence, PhotoError, PhotoReading, PhotoResponse } from '../photo/types';
import { GROUPS } from './StyleScreen';

interface Props {
  measured: boolean;
  onApply: (c: Choices) => void;
  onCancel: () => void;
}

const SURE: Record<Confidence, string> = { high: 'Clear in the photo', medium: 'Fairly sure', low: 'Best guess, please check' };

const ERRORS: Record<PhotoError | 'network', string> = {
  not_configured: "Photo drafting isn't switched on yet. You can still style your skirt by hand.",
  too_large: 'That photo is too large. Try another one, or a screenshot of it.',
  bad_image: "We couldn't open that photo. Try a JPEG or PNG.",
  declined: "We couldn't read the style from that photo. Try a different one.",
  failed: 'Something went wrong reading the photo. Please try again.',
  network: "We couldn't reach the server. Check your connection and try again.",
};

const OTHER: Partial<Record<PhotoReading['garment'], string>> = {
  dress: 'This looks like a dress. We can only draft skirts so far, so here is the closest skirt to its lower half.',
  trousers: 'This looks like trousers. We can only draft skirts so far, so here is our best skirt match.',
  top: 'This looks like a top. We can only draft skirts so far, so these are just starting points.',
  other: "This doesn't look like a skirt. We can only draft skirts so far, so these are just starting points.",
};

export function PhotoScreen({ measured, onApply, onCancel }: Props) {
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState<PhotoReading>();
  const [choices, setChoices] = useState<Choices>();
  const results = useRef<HTMLElement>(null);

  // On a phone the results sit below the photo, so bring them into view when they arrive.
  useEffect(() => {
    if (reading || error) results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reading, error]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    setReading(undefined);
    let img;
    try {
      img = await photoToJpeg(file);
    } catch {
      setError(ERRORS.bad_image);
      return;
    }
    setPreview(img.preview);
    setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img.image, mediaType: img.mediaType }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: 'failed' }))) as PhotoResponse;
      if (!data.ok) {
        setError(ERRORS[data.error] ?? ERRORS.failed);
      } else if (data.reading.garment === 'none') {
        setError("We couldn't find any clothing in that photo. Try one with the whole skirt in view.");
      } else {
        setReading(data.reading);
        setChoices({ fit: data.reading.fit.value, silhouette: data.reading.silhouette.value, length: data.reading.length.value });
      }
    } catch {
      setError(ERRORS.network);
    } finally {
      setBusy(false);
    }
  };

  const chooser = (label: string, className: string) => (
    <label className={`${className} filebtn big`} aria-disabled={busy || undefined}>
      {label}
      <input type="file" accept="image/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </label>
  );

  return (
    <div className="split">
      <section className="card help" aria-labelledby="phtitle">
        <p className="eyebrow">Start from a photo</p>
        <h1 id="phtitle">Love a skirt? Snap it.</h1>
        {preview ? (
          <img src={preview} alt="Your photo" className="photo" />
        ) : (
          <>
            <p>We'll read its shape, length and fit, then draft it to your measurements. The photo sets the style, never the size.</p>
            <ul className="checklist small">
              <li>Get the whole skirt in the frame</li>
              <li>Front view, on a plain background</li>
              <li>Worn is best; on a hanger or laid flat works too</li>
            </ul>
          </>
        )}
        {chooser(preview ? 'Try another photo' : 'Take or choose a photo', preview ? 'secondary' : 'primary')}
        <p className="muted small">Your photo is sent to Claude to read the style. Pattern Maker doesn't keep it.</p>
        <button type="button" className="link" onClick={onCancel}>
          Back to styling by hand
        </button>
      </section>

      <section ref={results} className="card grow" aria-labelledby="seetitle" aria-busy={busy}>
        <h2 id="seetitle">Here's what we see</h2>
        {busy && (
          <p className="msg" role="status">
            Reading your photo…
          </p>
        )}
        {error && (
          <p className="msg error" role="alert">
            {error}
          </p>
        )}
        {!busy && !error && !reading && <p className="muted">Your skirt's style will show up here.</p>}
        {reading && choices && (
          <>
            {OTHER[reading.garment] && <p className="msg">{OTHER[reading.garment]}</p>}
            {GROUPS.map((g) => {
              const conf = reading[g.id].confidence;
              return (
                <fieldset key={g.id} className="group">
                  <legend>
                    {g.label} <span className={conf === 'low' ? 'badge' : 'muted small'}>{SURE[conf]}</span>
                  </legend>
                  <div className="chips">
                    {g.options.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={choices[g.id] === id ? 'chip on' : 'chip'}
                        aria-pressed={choices[g.id] === id}
                        onClick={() => setChoices({ ...choices, [g.id]: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {reading.details && <p className="small">{reading.details}</p>}
            <p className="muted small">Inspired by your photo, not an exact copy. Change anything that doesn't look right.</p>
            <button type="button" className="primary" onClick={() => onApply(choices)}>
              {measured ? 'Draft my skirt' : 'Next: add my measurements'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
