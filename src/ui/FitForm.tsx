import { useState } from 'react';
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
}

/** "How did it fit?" for one saved pattern: an overall verdict, each area tight / right / loose, and notes. */
export function FitForm({ choices, initial, onSave, onCancel, onClear }: Props) {
  const [fit, setFit] = useState<FitFeedback>(() => initial ?? emptyFit());
  const [share, setShare] = useState(false);
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

      <div className="field plain">
        <label htmlFor="fitnotes">Notes</label>
        <textarea
          id="fitnotes"
          rows={3}
          maxLength={NOTES_MAX}
          value={fit.notes}
          placeholder="e.g. pinned out 1 cm at the back waist; dropped the hem 2 cm"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>

      <label className="fitshare">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <span>
          <strong>{initial?.sentAt ? 'Send these changes to Maison Tracé' : 'Send these notes to Maison Tracé'}</strong>
          <span className="muted small">
            Helps us improve the fit for everyone. We receive the pattern style, your answers and notes, and the measurements it was drafted from, with no
            name attached. Please leave names out of your notes.
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
