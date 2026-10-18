import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { TROUSER_EASE, TrousersDraft } from '../engine/trousers';
import { trousersFlat } from '../engine/flat';
import { TROUSER_GROUPS, TrousersChoices, describeTrousers, trouserAllowed, trouserChoice, validTrousers } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { PhotoEntry } from '../ui/PhotoEntry';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, UndoTools, useUndo } from '../ui/useUndo';

import { Mode, ProTool, shows } from '../mode';
import { ModeLink } from '../ui/ModeLink';
import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';

import { MyFabric, fabricEase, trousersFabrics } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';
import { Title } from '../ui/Title';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
  choices: TrousersChoices;
  onChoices: (c: TrousersChoices) => void;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
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
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

/** Fabric needed on 140 cm wide fabric, from the cutting layout. */
export const trousersFabricMetres = (draft: TrousersDraft) => layPlan(draft.pieces, 140)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

export function TrousersStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const can = (t: ProTool) => shows(mode, t);
  const [picked, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const view = picked === 'ease' && !can('easeMap') ? 'sketch' : picked;
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
  const elastic = choices.waist === 'elastic';
  const pockets = choices.pockets ?? 'none';

  return (
    <div className="split three">
      <section className="card numbered" aria-labelledby="opts">
        <div className="row between wrap">
          <Title id="opts" big="Style" label="your trousers" />
          <GarmentSwitch onChoose={onChooseGarment} />
        </div>
        <PhotoEntry onPhoto={onPhoto} photo={photo} />
        {TROUSER_GROUPS.filter((g) => shown(g.id)).map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className={chipsClass('trousers', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={trouserChoice(choices, g.id) === id && trouserAllowed(choices, g.id, id) ? 'chip on' : 'chip'}
                  aria-pressed={trouserChoice(choices, g.id) === id && trouserAllowed(choices, g.id, id)}
                  disabled={!trouserAllowed(choices, g.id, id)}
                  onClick={() => onChoices(validTrousers({ ...choices, [g.id]: id }))}
                >
                  <ChoicePic set="trousers" group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            {g.id === 'leg' && choices.leg === 'culotte' && <p className="muted small">Culottes are cut to mid-calf, wide from the hip.</p>}
            {g.id === 'waist' && elastic && (
              <p className="muted small">
                Pulls on over your hips, so there is no zip and no darts: the waist is cut
                {draft ? ` ${draft.finishedWaist} cm round` : ' as wide as your hips'} and gathered onto
                {draft?.elastic ? ` ${draft.elastic.finishedCm} cm of elastic` : ' elastic'}, your waist less 6 cm.
              </p>
            )}
            {g.id === 'closure' && elastic && <p className="muted small">An elastic waist pulls on, so it needs no opening.</p>}
            {g.id === 'pockets' && !elastic && choices.closure === 'side_zip' && (
              <p className="muted small">
                Slant pockets need the fly front or an elastic waist: the side zip runs where the left one would sit.
                {pockets === 'inseam' ? ' With the side zip, the in-seam pocket goes in the right side only.' : ''}
              </p>
            )}
          </fieldset>
        ))}
        {can('insideFinish') && (
          <>
            <p className="eyebrow">Inside the trousers</p>
            <FinishChoices garment="trousers" finish={finish} onFinish={onFinish} />
          </>
        )}
        <p className="muted small">
          The crotch is drafted to your own crotch depth and length, front and back curves together, so the trousers sit without pulling or
          bagging. {elastic ? 'A pull-on elastic waist, with no zip.' : choices.closure === 'fly' ? 'A fly front with its facing and shield.' : 'An invisible zip in the left side seam.'}
        </p>
        <ModeLink mode={mode} onMode={onMode} />
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            <button type="button" aria-pressed={view === 'sketch'} className={view === 'sketch' ? 'on' : ''} onClick={() => setView('sketch')}>
              Sketch
            </button>
            <button type="button" aria-pressed={view === 'pattern'} className={view === 'pattern' ? 'on' : ''} onClick={() => setView('pattern')}>
              Pieces
            </button>
            {easeMap && easeMap.length > 0 && can('easeMap') && (
              <button type="button" aria-pressed={view === 'ease'} className={view === 'ease' ? 'on' : ''} onClick={() => setView('ease')}>
                Ease
              </button>
            )}
          </div>
          <UndoTools undo={undo} />
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {draft && sheet && view === 'pattern' && <PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} />}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title.toLowerCase()}`} />}
          <UndoToast undo={undo} />
        </div>
        {flat && view === 'sketch' && <FabricSwatches finish={finish} onFinish={onFinish} />}
        <p className="muted small">
          Drafted to your measurements as you choose.{undo.shake.state === 'on' ? ' Shake your phone to undo.' : ''}
        </p>
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
          {draft?.elastic
            ? `The waist is cut to pass over your hips and gathered onto ${draft.elastic.finishedCm} cm of elastic. Ease added: `
            : `Ease added: ${ease.waist + extra.waist} cm at the waist, `}
          {ease.hip + extra.hip} cm at the hip{extra.hip ? ` (${extra.waist} cm and ${extra.hip} cm of it for your heavy fabric)` : ''}, {ease.depth} cm below the crotch and {ease.crotch} cm along it.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            <li>Waistband{draft?.elastic ? ' (elastic casing)' : ''}: cut 1</li>
            {draft?.elastic && (
              <li>
                Elastic, {draft.elastic.widthCm} cm wide: cut {draft.elastic.cutCm} cm
              </li>
            )}
          </ul>
        </div>
        {draft && (
          <FabricCard metres={trousersFabricMetres(draft)} advice={trousersFabrics(choices)} fabric={fabric} />
        )}
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </div>
  );
}
