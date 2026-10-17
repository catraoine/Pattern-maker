import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { NECKBAND_CM, STRETCH_TEST, TeeDraft, pctWords } from '../engine/tee';
import { teeFlat } from '../engine/flat';
import { TEE_GROUPS, TeeChoices, describeTee } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { FREE_SAVED_LIMIT } from '../account';
import type { MyFabric } from '../engine/fabrics';
import { teeFabrics } from '../engine/knits';
import { FabricCard } from '../ui/FabricCard';

interface Props {
  choices: TeeChoices;
  onChoices: (c: TeeChoices) => void;
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: TeeDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
}

/** Knit on 150 cm wide fabric, from the cutting layout. */
export const teeFabricMetres = (draft: TeeDraft) => layPlan(draft.pieces, 150)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

const FIT_NOTES: Record<TeeChoices['fit'], string> = {
  fitted: 'Cut smaller than you, so the knit stretches on and skims the body.',
  regular: 'About your own size: close but easy.',
  relaxed: 'Room to move, with the shoulder a little dropped.',
};

/** The engine's warnings are written for the pattern cutter; this turns them into a nudge. */
function friendly(w: string) {
  if (w.startsWith('bust widened')) return 'Your shoulders are broad next to your bust, so the tee is cut a little roomier at the bust for the armholes to fit.';
  if (w.startsWith('sleeve')) return 'Your armhole is large next to your upper arm, so the sleeve is cut a little wider to fit it. Please check both measurements.';
  if (w.startsWith('armhole')) return 'Your armhole measurement is large for the rest of you, so the armhole is drafted as close to it as the block allows. Please re-measure it.';
  return 'Something in your measurements looks unusual. Please double-check them.';
}

export function TeeStyleScreen({ choices, onChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern'>('sketch');
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => (draft ? teeFlat(draft) : undefined), [draft]);
  const title = describeTee(choices);
  const hemLabel = choices.length === 'cropped' ? 'Hem' : 'Hip';
  const hemBody = choices.length === 'cropped' ? values.waist : values.full_hip;

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <div className="row between wrap">
          <h1 id="opts">Style your T-shirt</h1>
          <GarmentSwitch onChoose={onChooseGarment} />
        </div>
        <p className="muted small">Drafted for knit fabric: no darts, the stretch shapes it to you.</p>
        {TEE_GROUPS.map((g) => (
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
            {g.id === 'stretch' && <p className="muted small">How to test: {STRETCH_TEST}</p>}
            {g.id === 'fit' && <p className="muted small">{FIT_NOTES[choices.fit]}</p>}
          </fieldset>
        ))}
        <p className="muted small">
          Seam allowances are 1 cm, the usual for knits, with 2.5 cm at the hem. The neckband is cut shorter than the neckline so it
          lies flat.
        </p>
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
          {flat && view === 'sketch' && <TechFlatView flat={flat} title={title} />}
          {draft && sheet && view === 'pattern' && <PatternPreview sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} />}
        </div>
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {friendly(w)}
          </p>
        ))}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">You</span>
          <span className="muted">T-shirt</span>
          <span>Bust</span>
          <span>{values.full_bust} cm</span>
          <strong>{draft ? draft.finishedBust : '–'} cm</strong>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>{hemLabel}</span>
          <span>{hemBody} cm</span>
          <strong>{draft ? draft.finishedHem : '–'} cm</strong>
          <span>Back length</span>
          <span />
          <strong>{draft ? draft.backLength : '–'} cm</strong>
          <span>Sleeve</span>
          <span />
          <strong>{draft ? draft.sleeve.lengthCm : '–'} cm</strong>
        </div>
        {draft && (
          <p className="muted small">
            Ease at the bust: {pctWords(draft.easePct)} ({Math.round((draft.finishedBust - (values.full_bust ?? 0)) * 10) / 10} cm)
            {draft.easePct < 0 ? ', so the knit stretches a little to fit' : ''}. Neckband {draft.neckband.length} cm, {Math.round(draft.neckband.ratio * 100)}% of the{' '}
            {draft.necklineCm} cm neckline, {NECKBAND_CM} cm wide.
          </p>
        )}
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
        {draft && <FabricCard metres={teeFabricMetres(draft)} advice={teeFabrics(choices)} fabric={fabric} knit />}
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
