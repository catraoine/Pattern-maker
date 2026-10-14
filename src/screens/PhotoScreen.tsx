import { useEffect, useRef, useState } from 'react';
import type { Choices } from '../App';
import { photoToJpeg } from '../photo/image';
import type { Confidence, PhotoError, PhotoReading, PhotoResponse } from '../photo/types';
import { GROUPS } from './StyleScreen';
import { shapeLine, shapeOf } from '../photo/shape';

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
  limit_reached: "You've used today's photo readings. You can still style your skirt by hand, or try again tomorrow.",
  busy: 'Photo reading is resting until tomorrow. You can still style your skirt by hand.',
  network: "We couldn't reach the server. Check your connection and try again.",
};

// What makes a photo easy to match exactly. The hem position and fullness are measured against the
// wearer's body, so the photo needs the body from waist to feet, seen straight on and standing still.
const TIPS: [string, string][] = [
  ['Show it being worn, waist to feet', 'We measure where the hem falls against the body, so we need to see the waist, knees and feet.'],
  ['Stand straight on, camera at hip height', 'Shooting from above or below makes a skirt look shorter or longer than it is.'],
  ['Stand still', 'Walking or twirling makes a skirt look fuller than it really is.'],
  ['Use good light and a plain background', 'So the hem edge and the folds are easy to see.'],
  ['Keep the whole skirt in the frame', 'If the hem is cropped off, we can only guess the length.'],
  ['One skirt per photo', 'Shop and catalogue photos and screenshots all work.'],
];

const TIP_FLAT = 'No one to wear it? Lay it flat and smooth, or hang it straight. We can read the shape, but the length will be a guess.';

function Tips() {
  return (
    <>
      <ol className="tips small">
        {TIPS.map(([tip, why]) => (
          <li key={tip}>
            <strong>{tip}.</strong> <span className="muted">{why}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">{TIP_FLAT}</p>
    </>
  );
}

const OTHER: Partial<Record<PhotoReading['garment'], string>> = {
  dress: 'This looks like a dress. Photos can only be read as skirts so far, so here is the closest skirt to its lower half.',
  trousers: 'This looks like trousers. Photos can only be read as skirts so far, so here is our best skirt match.',
  top: 'This looks like a top. Photos can only be read as skirts so far, so these are just starting points.',
  other: "This doesn't look like a skirt. Photos can only be read as skirts so far, so these are just starting points.",
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
        const r = data.reading;
        setChoices({ fit: r.fit.value, silhouette: r.silhouette.value, length: r.length.value, shape: shapeOf(r) });
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
            <p>We'll read its shape, length and fullness, then draft it to your measurements. The photo sets the style, never the size.</p>
            <p className="eyebrow">For the closest match</p>
            <Tips />
          </>
        )}
        {chooser(preview ? 'Try another photo' : 'Take or choose a photo', preview ? 'secondary' : 'primary')}
        {preview && (
          <details className="small">
            <summary>Tips for a closer match</summary>
            <Tips />
          </details>
        )}
        <p className="muted small">Your photo is sent to Claude to read the style. Maison Tracé doesn't keep it.</p>
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
                        onClick={() => setChoices({ ...choices, [g.id]: id, ...(g.id === 'fit' ? {} : { shape: undefined }) })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {(reading.shape?.confidence === 'low' || reading.length.confidence === 'low') && (
              <p className="msg small">
                This photo doesn't show the skirt clearly enough to match it exactly. For a closer match, try one of the skirt being worn,
                from the front, with the feet in view.
              </p>
            )}
            {reading.details && <p className="small">{reading.details}</p>}
            {choices.shape ? (
              <p className="small">
                {shapeLine(choices.shape)} Your pattern copies these proportions, scaled to your measurements. Tap a shape or length to use a standard one instead.
              </p>
            ) : (
              <p className="muted small">Change anything that doesn't look right.</p>
            )}
            <button type="button" className="primary" onClick={() => onApply(choices)}>
              {measured ? 'Draft my skirt' : 'Next: add my measurements'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
