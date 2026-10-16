import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { TROUSER_EASE, TrousersDraft } from '../engine/trousers';
import { trousersFlat } from '../engine/flat';
import { TROUSER_GROUPS, TrousersChoices, describeTrousers } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { Garment, MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { FREE_SAVED_LIMIT } from '../account';

import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';

import { MyFabric, fabricEase, trousersFabrics } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';

interface Props {
  choices: TrousersChoices;
  onChoices: (c: TrousersChoices) => void;
  onGarment: (g: Garment) => void;
  values: MeasurementValues;
  draft?: TrousersDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
  finish: Finish;
  onFinish: (f: Finish) => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
}

/** Fabric needed on 140 cm wide fabric, from the cutting layout. */
export const trousersFabricMetres = (draft: TrousersDraft) => layPlan(draft.pieces, 140)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

export function TrousersStyleScreen({ choices, onChoices, onGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const title = describeTrousers(choices);
  const ease = TROUSER_EASE[choices.fit];
  const extra = fabricEase(fabric, 'trousers');
  const flat = useMemo(
    () => (draft && values.waist_to_hip && values.crotch_depth ? trousersFlat(draft, { waist_to_hip: values.waist_to_hip, crotch_depth: values.crotch_depth }) : undefined),
    [draft, values.waist_to_hip, values.crotch_depth],
  );
  const shown = (id: string) => id !== 'length' || choices.leg !== 'culotte';

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <div className="row between wrap">
          <h1 id="opts">Style your trousers</h1>
          <GarmentSwitch garment="trousers" onGarment={onGarment} />
        </div>
        {TROUSER_GROUPS.filter((g) => shown(g.id)).map((g) => (
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
            {g.id === 'leg' && choices.leg === 'culotte' && <p className="muted small">Culottes are cut to mid-calf, wide from the hip.</p>}
          </fieldset>
        ))}
        <p className="eyebrow">Inside the trousers</p>
        <FinishChoices garment="trousers" finish={finish} onFinish={onFinish} />
        <p className="muted small">
          The crotch is drafted to your own crotch depth and length, front and back curves together, so the trousers sit without pulling or
          bagging. {choices.closure === 'fly' ? 'A fly front with its facing and shield.' : 'An invisible zip in the left side seam.'}
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
            {easeMap && easeMap.length > 0 && (
              <button type="button" aria-pressed={view === 'ease'} className={view === 'ease' ? 'on' : ''} onClick={() => setView('ease')}>
                Ease
              </button>
            )}
          </div>
          <p className="muted small">Drafted to your measurements as you choose.</p>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && <TechFlatView flat={flat} title={title} />}
          {draft && sheet && view === 'pattern' && <PatternPreview sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} />}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title.toLowerCase()}`} />}
        </div>
        {draft?.crotchCapped && (
          <p className="msg small">
            Your crotch length is unusual next to your hip, so the crotch is drafted as near to it as the block allows. Please re-measure it,
            snug between the legs from the front waist to the back waist.
          </p>
        )}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">Body</span>
          <span className="muted">Trousers</span>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>Hip</span>
          <span>{values.full_hip} cm</span>
          <strong>{draft ? draft.finishedHip : '–'} cm</strong>
          <span>Crotch length</span>
          <span>{values.crotch_length} cm</span>
          <strong>{draft ? Math.round((draft.crotch.front + draft.crotch.back) * 10) / 10 : '–'} cm</strong>
          <span>Knee</span>
          <span />
          <strong>{draft ? draft.kneeCm : '–'} cm</strong>
          <span>Hem</span>
          <span />
          <strong>{draft ? draft.hemCm : '–'} cm</strong>
          <span>Outside leg</span>
          <span />
          <strong>{draft ? draft.lengthCm : '–'} cm</strong>
        </div>
        <p className="muted small">
          Ease added: {ease.waist + extra.waist} cm at the waist, {ease.hip + extra.hip} cm at the hip{extra.hip ? ` (${extra.waist} cm and ${extra.hip} cm of it for your heavy fabric)` : ''}, {ease.depth} cm below the crotch and {ease.crotch} cm along it.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            <li>Waistband: cut 1</li>
          </ul>
        </div>
        {draft && (
          <FabricCard metres={trousersFabricMetres(draft)} advice={trousersFabrics(choices)} fabric={fabric} />
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
