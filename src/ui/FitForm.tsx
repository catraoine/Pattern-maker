import { useEffect, useState } from 'react';
import { deletePhoto, getPhoto, putPhoto, shrink } from '../photoStore';
import type { PatternChoices } from '../garments';
import { AreaFit, FitFeedback, NOTES_MAX, VERDICTS, cleanFit, emptyFit, fitAreas } from '../fit';
import './FitForm.css';

interface Props {
  choices: PatternChoices;
  initial?: FitFeedback;
  /** `share` is true when the sewist ticked the box to send these notes to Maison Tracé. */
  onSave: (fit: FitFeedback, share: boolean) => void;
  onCancel: () => void;
  onClear?: () => void;
  /** Fit testers' notes start ticked to send (the tester walk, 2026-10-27): their round is what the notes are for. */
  shareByDefault?: boolean;
}

/** "How did it fit?" for one saved pattern: an overall verdict, each area tight / right / loose, and notes. */
export function FitForm({ choices, initial, onSave, onCancel, onClear, shareByDefault }: Props) {
  const [fit, setFit] = useState<FitFeedback>(() => initial ?? emptyFit());
  const [share, setShare] = useState(!!shareByDefault);
  const set = (change: Partial<FitFeedback>) => setFit({ ...fit, ...change });
  const setArea = (id: string, v: AreaFit) => {
    const areas = { ...fit.areas };
    // Tapping the chosen answer again clears it, so an area can be left unanswered.
    if (areas[id as keyof typeof areas] === v) delete areas[id as keyof typeof areas];
    else areas[id as keyof typeof areas] = v;
    set({ areas });
  };

  return (
    <form
      className="fitform"
      aria-label="How did it fit?"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(cleanFit({ ...fit, at: new Date().toISOString() }, choices), share);
      }}
    >
      <p className="eyebrow">How did it fit?</p>

      <fieldset className="group">
        <legend>What did you sew?</legend>
        <div className="seg" role="group" aria-label="What did you sew?">
          {(
            [
              ['toile', 'A toile'],
              ['garment', 'The garment'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={fit.made === m} className={fit.made === m ? 'on' : ''} onClick={() => set({ made: m })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Overall</legend>
        <div className="chips">
          {VERDICTS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={fit.verdict === v} className={fit.verdict === v ? 'chip on' : 'chip'} onClick={() => set({ verdict: v })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Area by area</legend>
        <p className="muted small">Skip any you didn't check.</p>
        <div className="fitareas">
          {fitAreas(choices).map((a) => (
            <div key={a.id} className="fitarea" role="group" aria-label={a.label}>
              <span className="fitarea-name">{a.label}</span>
              <div className="fitarea-opts">
                {(
                  [
                    [-1, a.words[0]],
                    [0, 'Right'],
                    [1, a.words[1]],
                  ] as [AreaFit, string][]
                ).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={fit.areas[a.id] === v} className={fit.areas[a.id] === v ? 'on' : ''} onClick={() => setArea(a.id, v)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <FitPhoto id={fit.photo} onChange={(photo) => set({ photo })} />

      <div className="field plain">
        <label htmlFor="fitnotes">Notes</label>
        <textarea
          id="fitnotes"
          rows={3}
          maxLength={NOTES_MAX}
          value={fit.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>

      <label className="fitshare">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <span>
          <strong>{initial?.sentAt ? 'Send these changes to Maison Tracé' : 'Send these notes to Maison Tracé'}</strong>
          <span className="muted small">
            Helps us improve the fit for everyone. We receive the pattern style, your answers and notes, and the measurements it was drafted from, with no
            name attached. Please leave names out of your notes.{shareByDefault ? ' Ticked for you as a fit tester.' : ''}
          </span>
        </span>
      </label>

      <div className="row wrap">
        <button type="submit" className="primary">
          Save fit notes
        </button>
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
        {onClear && (
          <button type="button" className="link" onClick={onClear}>
            Remove fit notes
          </button>
        )}
      </div>
    </form>
  );
}

/** One photo of the toile on, kept on this device only, so the next fit round can see what the notes mean. */
function FitPhoto({ id, onChange }: { id?: string; onChange: (id: string | undefined) => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let revoke: string | undefined;
    if (!id) setUrl(undefined);
    else
      getPhoto(id)
        .then((b) => {
          if (!b) return setUrl(undefined);
          revoke = URL.createObjectURL(b);
          setUrl(revoke);
        })
        .catch(() => setUrl(undefined));
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const next = `fit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      if (await putPhoto(next, await shrink(file, 1000))) {
        if (id) void deletePhoto(id).catch(() => {});
        onChange(next);
      }
    } catch {
      // Without a photo store (private windows) the notes still save; the photo is just not kept.
    }
  };

  return (
    <div className="fitphoto">
      {url && <img src={url} alt="Your toile" />}
      <label className="link">
        {url ? 'Change photo' : 'Add a photo of the toile on'}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {url && id && (
        <button
          type="button"
          className="link"
          onClick={() => {
            void deletePhoto(id).catch(() => {});
            onChange(undefined);
          }}
        >
          Remove photo
        </button>
      )}
      <span className="muted small">Stays on this device. It isn't sent with your notes.</span>
    </div>
  );
}
