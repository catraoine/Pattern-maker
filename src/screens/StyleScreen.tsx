import { useMemo, useState } from 'react';
import type { Choices } from '../App';
import { layout } from '../engine/export';
import { bounds } from '../engine/piece';
import { FIT_EASE, SkirtDraft } from '../engine/skirt';
import type { MeasurementValues } from '../measurements';
import { PatternPreview, SketchPreview } from '../ui/Preview';
import { FREE_SAVED_LIMIT } from '../account';

interface Props {
  choices: Choices;
  onChoices: (c: Choices) => void;
  values: MeasurementValues;
  draft?: SkirtDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
}

type Group<K extends keyof Choices> = { id: K; label: string; options: [Choices[K], string][] };

const GROUPS: [Group<'fit'>, Group<'silhouette'>, Group<'length'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  { id: 'silhouette', label: 'Silhouette', options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line']] },
  {
    id: 'length',
    label: 'Length',
    options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']],
  },
];

export function describe(c: Choices) {
  const len = GROUPS[2].options.find((o) => o[0] === c.length)![1];
  const sil = GROUPS[1].options.find((o) => o[0] === c.silhouette)![1];
  return `${len} ${sil.toLowerCase()} skirt`;
}

/** Rough fabric need on 140 cm wide fabric: one or two skirt lengths plus a waistband. */
export function fabricMetres(draft: SkirtDraft): number {
  const widths = draft.pieces.map((pc) => {
    const [x0, , x1] = bounds(pc);
    return x1 - x0;
  });
  const [front, back] = widths;
  const across = front * 2 + back * 2; // front cut on the fold opens to twice its width; back is a pair
  const lengths = across <= 136 ? 1 : 2;
  const pieceLength = Math.max(...draft.pieces.map((pc) => bounds(pc)[3] - bounds(pc)[1]));
  return Math.ceil(((lengths * pieceLength + 15) / 100) * 10) / 10;
}

export function StyleScreen({ choices, onChoices, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern'>('sketch');
  const sheet = useMemo(() => (draft ? layout(draft.pieces, '', []) : undefined), [draft]);
  const ease = FIT_EASE[choices.fit];
  const title = describe(choices);

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <h1 id="opts">Style your skirt</h1>
        {GROUPS.map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={choices[g.id] === id ? 'chip on' : 'chip'}
                  aria-pressed={choices[g.id] === id}
                  onClick={() => onChoices({ ...choices, [g.id]: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="muted small">More silhouettes, waist finishes and pockets are coming.</p>
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            <button type="button" aria-pressed={view === 'sketch'} className={view === 'sketch' ? 'on' : ''} onClick={() => setView('sketch')}>
              Sketch
            </button>
            <button type="button" aria-pressed={view === 'pattern'} className={view === 'pattern' ? 'on' : ''} onClick={() => setView('pattern')}>
              Pattern pieces
            </button>
          </div>
          <p className="muted small">Drafted to your measurements as you choose.</p>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {draft && sheet && view === 'sketch' && <SketchPreview front={draft.pieces[0]} label={`${title}, front view`} />}
          {draft && sheet && view === 'pattern' && <PatternPreview sheet={sheet} label={`Front and back pattern pieces for a ${title}`} />}
        </div>
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">Body</span>
          <span className="muted">Skirt</span>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>Hip</span>
          <span>{values.full_hip} cm</span>
          <strong>{draft ? draft.finishedHip : '–'} cm</strong>
          <span>Length</span>
          <span />
          <strong>{draft ? draft.lengthCm : '–'} cm</strong>
        </div>
        <p className="muted small">
          Ease added: {ease.waist} cm at the waist, {ease.hip} cm at the hip.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            <li>Skirt front: cut 1 on fold</li>
            <li>Skirt back: cut 2</li>
          </ul>
        </div>
        {draft && (
          <div className="fabric">
            <p className="eyebrow">Fabric</p>
            <p className="big">{fabricMetres(draft).toFixed(1)} m</p>
            <p className="muted small">of 140 cm wide woven fabric, rough estimate</p>
          </div>
        )}
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        {saveState === 'can' && (
          <button type="button" className="secondary" disabled={!draft} onClick={onSave}>
            Save pattern
          </button>
        )}
        {saveState === 'saved' && (
          <p className="msg small" role="status">
            Saved to <button type="button" className="link inline-link" onClick={onAccount}>your account</button>.
          </p>
        )}
        {saveState === 'full' && (
          <p className="muted small">
            You've saved {FREE_SAVED_LIMIT} patterns, the free limit.{' '}
            <button type="button" className="link inline-link" onClick={onAccount}>Manage saved patterns</button>
          </p>
        )}
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </div>
  );
}
