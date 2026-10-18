import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { OUTER_EASE, OuterDraft } from '../engine/outerwear';
import { outerFlat } from '../engine/flat';
import { OuterChoices, describeOuter, outerAllowed, outerGroups } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, UndoTools, useUndo } from '../ui/useUndo';
import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import { Mode, ProTool, shows } from '../mode';
import { ModeLink } from '../ui/ModeLink';
import type { Finish } from '../App';
import { MyFabric, fabricEase, outerFabrics } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';
import { Title } from '../ui/Title';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';

interface Props {
  choices: OuterChoices;
  onChoices: (c: OuterChoices) => void;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: OuterDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  easeMap?: EaseView[];
  finish: Finish;
  onFinish: (f: Finish) => void;
  fabric?: MyFabric;
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

/** Self fabric needed on 140 cm wide fabric, from the cutting layout of the shell pieces. */
export const outerFabricMetres = (draft: OuterDraft) => {
  const self = draft.pieces.filter((pc) => pc.kind !== 'lining');
  return layPlan(self, 140)?.metres ?? toMetres(piecesLengthCm(self) + 10);
};

export function OuterStyleScreen({ choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const can = (t: ProTool) => shows(mode, t);
  const [picked, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const view = picked === 'ease' && !can('easeMap') ? 'sketch' : picked;
  const kind = choices.garment;
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => (draft ? outerFlat(draft) : undefined), [draft]);
  const title = describeOuter(choices);
  const extra = fabricEase(fabric, kind);

  return (
    <div className="split three">
      <section className="card numbered" aria-labelledby="opts">
        <div className="row between wrap">
          <Title id="opts" big="Style" label={`your ${kind}`} />
          <GarmentSwitch onChoose={onChooseGarment} />
        </div>
        {outerGroups(kind).map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className={chipsClass(kind, g.id)}>
              {g.options.map(([id, label]) => {
                const allowed = outerAllowed(choices, g.id, id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={choices[g.id] === id ? 'chip on' : 'chip'}
                    aria-pressed={choices[g.id] === id}
                    disabled={!allowed}
                    onClick={() => {
                      const next = { ...choices, [g.id]: id } as OuterChoices;
                      // A fitted cut keeps its waist darts.
                      if (next.fit === 'fitted' && next.shaping === 'boxy') next.shaping = 'darts';
                      // A cropped jacket is too short for a vent.
                      if (next.length === 'cropped') next.vent = 'none';
                      onChoices(next);
                    }}
                  >
                    <ChoicePic set={kind} group={g.id} id={id} />
                    {label}
                  </button>
                );
              })}
            </div>
            {g.id === 'shaping' && choices.fit === 'fitted' && <p className="muted small">A fitted {kind} keeps its waist shaping, so boxy needs a regular or relaxed fit.</p>}
          </fieldset>
        ))}
        {can('insideFinish') && (
          <>
            <p className="eyebrow">Inside the {kind}</p>
            <FinishChoices garment={kind} finish={finish} onFinish={onFinish} />
          </>
        )}
        <p className="muted small">
          Fully lined, with interfaced front facings{choices.collar === 'notched' ? ' and an upper and under collar rolled at the lapel' : ''}. The sleeves are drafted to
          your own armhole with room for what you wear underneath{choices.pads !== 'none' ? ', and the shoulders and sleeve heads are raised to take the shoulder pads' : ''}.
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
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <p>{title}</p>
        <div className="sumgrid">
          <span />
          <span className="muted">Body</span>
          <span className="muted">{kind === 'coat' ? 'Coat' : 'Jacket'}</span>
          <span>Bust</span>
          <span>{values.full_bust} cm</span>
          <strong>{draft ? draft.finishedBust : '–'} cm</strong>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>Hem</span>
          <span />
          <strong>{draft ? draft.finishedHem : '–'} cm</strong>
          <span>Back length</span>
          <span />
          <strong>{draft ? draft.lengthCm : '–'} cm</strong>
          <span>Sleeve</span>
          <span>{values.arm_length} cm</span>
          <strong>{draft ? draft.sleeve.lengthCm : '–'} cm</strong>
        </div>
        <p className="muted small">
          Ease added: {OUTER_EASE[kind][choices.fit] + extra.bust} cm at the bust{extra.bust ? `, ${extra.bust} cm of it for your heavy fabric` : ''}, enough to wear {kind === 'coat' ? 'over a jacket or a thick jumper' : 'over a blouse or a fine knit'}.
        </p>
        {draft && draft.warnings.length > 0 && <p className="msg small">Please check: {draft.warnings.join('; ')}.</p>}
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
                {pc.kind === 'lining' ? ' in lining' : ''}
              </li>
            ))}
          </ul>
        </div>
        {draft && <FabricCard metres={outerFabricMetres(draft)} advice={outerFabrics({ garment: kind, fit: choices.fit })} fabric={fabric} lined />}
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
