import { useMemo, useState } from 'react';
import type { Choices } from '../App';
import { layout } from '../engine/export';
import { bounds } from '../engine/piece';
import { FIT_EASE, SkirtDraft } from '../engine/skirt';
import type { MeasurementValues } from '../measurements';
import { PatternPreview, SketchPreview } from '../ui/Preview';
import { FREE_SAVED_LIMIT } from '../account';
import { BAND_ACROSS_MAX } from '../engine/instructions';
import { ERAS, findLook } from '../engine/eras';

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
  {
    id: 'silhouette',
    label: 'Silhouette',
    options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line'], ['trumpet', 'Trumpet'], ['half_circle', 'Half circle'], ['circle', 'Full circle']],
  },
  {
    id: 'length',
    label: 'Length',
    options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']],
  },
];

/** The era look the choices came from, if they still have its shape and length. */
export function currentLook(c: Choices) {
  const look = findLook(c.look);
  return look && look.silhouette === c.silhouette && look.length === c.length ? look : undefined;
}

export function describe(c: Choices) {
  const look = currentLook(c);
  if (look) return look.name;
  const len = GROUPS[2].options.find((o) => o[0] === c.length)![1];
  const sil = GROUPS[1].options.find((o) => o[0] === c.silhouette)![1];
  return `${len} ${sil.toLowerCase()} skirt`;
}

/** Rough fabric need on 140 cm wide fabric: the pieces laid out in rows across the width, plus a strip
 * for the waistband, which is cut across the fabric. A piece on the fold opens to twice its width; a
 * pair is two pieces. */
export function fabricMetres(draft: SkirtDraft): number {
  const items = draft.pieces.flatMap((pc) => {
    const [x0, y0, x1, y1] = bounds(pc);
    const w = x1 - x0;
    const h = y1 - y0;
    return pc.fold ? [{ w: 2 * w, h }] : [{ w, h }, { w, h }];
  });
  items.sort((a, b) => b.h - a.h);
  let total = 0;
  let rowW = Infinity;
  for (const it of items) {
    if (rowW + it.w > 136) {
      total += it.h; // tallest first, so the first piece in a row sets its height
      rowW = 0;
    }
    rowW += it.w;
  }
  const { cutLength, cutWidth } = draft.waistband;
  const band = cutLength <= BAND_ACROSS_MAX ? cutWidth : cutLength;
  return Math.ceil(((total + band + 15) / 100) * 10) / 10;
}

export function StyleScreen({ choices, onChoices, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern'>('sketch');
  const sheet = useMemo(() => (draft ? layout(draft.pieces, '', []) : undefined), [draft]);
  const ease = FIT_EASE[choices.fit];
  const title = describe(choices);
  const look = currentLook(choices);
  const [eraId, setEraId] = useState<string | undefined>(() => ERAS.find((e) => e.looks.includes(look!))?.id);
  const era = ERAS.find((e) => e.id === eraId);
  // Changing the shape or length by hand leaves the era look behind; changing the fit keeps it.
  const choose = (c: Choices) => onChoices(currentLook(c) ? c : { fit: c.fit, silhouette: c.silhouette, length: c.length });

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <h1 id="opts">Style your skirt</h1>
        <fieldset className="group">
          <legend>Era</legend>
          <div className="chips">
            {ERAS.map((e) => (
              <button
                key={e.id}
                type="button"
                className={eraId === e.id ? 'chip on' : 'chip'}
                aria-pressed={eraId === e.id}
                onClick={() => setEraId(eraId === e.id ? undefined : e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          {era && (
            <div className="looks">
              <p className="muted small">
                {era.years}. {era.about}
              </p>
              {era.looks.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={look?.id === l.id ? 'look on' : 'look'}
                  aria-pressed={look?.id === l.id}
                  onClick={() => onChoices({ fit: l.fit, silhouette: l.silhouette, length: l.length, look: l.id })}
                >
                  <strong>{l.name}</strong>
                  <span>{l.about}</span>
                  <span className="muted">Try: {l.fabric}</span>
                </button>
              ))}
            </div>
          )}
        </fieldset>
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
                  onClick={() => choose({ ...choices, [g.id]: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="muted small">Every look is drafted to your measurements. Waist finishes and pockets are coming.</p>
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
          {draft && sheet && view === 'sketch' && <SketchPreview draft={draft} label={`${title}, front view`} />}
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
          <span>Hem</span>
          <span />
          <strong>{draft ? draft.hemCm : '–'} cm</strong>
        </div>
        <p className="muted small">
          Ease added: {ease.waist} cm at the waist, {ease.hip} cm at the hip.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {(draft?.pieces ?? []).map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            {draft && (
              <li>
                Waistband: a {draft.waistband.cutLength} × {draft.waistband.cutWidth} cm strip, marked straight on the fabric
              </li>
            )}
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
