import { useMemo } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { LingerieDraft, isSwim } from '../engine/lingerie';
import { LINGERIE_GROUPS, LingerieChoices, describeLingerie, lingerieGroupShown } from '../garments';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, UndoTools, useUndo } from '../ui/useUndo';
import type { MyFabric } from '../engine/fabrics';
import { lingerieFabrics } from '../engine/knits';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { Mode } from '../mode';
import { FABRIC, Group, LOOKS, StyleLayout, TabPanel } from '../ui/StyleLayout';

interface Props {
  onPhoto?: () => void;
  photo?: string;
  choices: LingerieChoices;
  onChoices: (c: LingerieChoices) => void;
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: LingerieDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  fabric?: MyFabric;
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

/** Knit on 150 cm wide fabric, from the cutting layout; swimwear needs the same again in lining. */
export const lingerieFabricMetres = (draft: LingerieDraft) => layPlan(draft.pieces, 150)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

const PIECE_NOTES: Record<LingerieChoices['piece'], string> = {
  brief: 'A brief with a lined gusset and elastic at the waist and legs.',
  bralette: 'A soft, wire-free bralette: two darted cups on an elastic band, with adjustable straps.',
  bodysuit: 'A scoop-neck bodysuit with narrow straps, cut for a close, smooth fit.',
  swimsuit: 'A one-piece with a scoop neck and a low back, fully lined.',
  bikini: 'A triangle or longline top with a matching brief, fully lined.',
};

export function LingerieStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const title = describeLingerie(choices);
  const swim = isSwim(choices.piece);
  const rows: [string, number | undefined, number | undefined][] = draft
    ? [
        ['Bust', values.full_bust, draft.finishedBust],
        ['Underbust', values.underbust, draft.finishedBand],
        ['Waist', values.waist, draft.finishedWaist],
        ['Hip', values.full_hip, choices.piece === 'bralette' ? undefined : draft.finishedHip],
      ]
    : [];

  return (
    <StyleLayout
      label={`your ${choices.piece}`}
      name={title}
      metres={draft ? lingerieFabricMetres(draft) : undefined}
      width={150}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
    >
      <section className="card numbered" aria-labelledby="opts">
        <TabPanel tab={LOOKS}>
          <p className="muted small">Drafted for four-way stretch: cut smaller than you, so it holds close without darts or wires.</p>
        </TabPanel>
        {LINGERIE_GROUPS.filter((g) => lingerieGroupShown(choices, g.id)).map((g) => (
          <Group key={g.id} label={g.label}>
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
            {g.id === 'piece' && <p className="muted small">{PIECE_NOTES[choices.piece]}</p>}
            {g.id === 'piece' && swim && <p className="muted small">Swimwear is always cut for high-stretch swim Lycra.</p>}
          </Group>
        ))}
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={lingerieFabricMetres(draft)} advice={lingerieFabrics(draft.style)} fabric={fabric} knit />
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <p className="eyebrow">Pieces</p>
          <div className="row tools">
            <UndoTools undo={undo} />
          </div>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {draft && sheet && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} /></PatternPane>}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">Drafted to your measurements as you choose.</p>
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">You</span>
          <span className="muted">Cut</span>
          {rows
            .filter(([, , cut]) => cut !== undefined)
            .map(([label, body, cut]) => [
              <span key={`${label}l`}>{label}</span>,
              <span key={`${label}b`}>{body} cm</span>,
              <strong key={`${label}c`}>{cut} cm</strong>,
            ])}
        </div>
        {draft && (
          <p className="muted small">
            Cut {Math.abs(Math.round(draft.easePct * 100))}% smaller than you round the body and {Math.round(draft.lengthReduction * 100)}% shorter, so the stretch holds it close.
          </p>
        )}
        {draft && (
          <div>
            <p className="eyebrow">Elastic</p>
            <ul className="pieces">
              {draft.elastic.map((e) => (
                <li key={e.edge}>
                  {e.edge}: {e.length} cm, {e.width} cm wide
                </li>
              ))}
            </ul>
          </div>
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
        {draft && <FabricSummary metres={lingerieFabricMetres(draft)} fabric={fabric} />}
        <p className="muted small">Seam allowances are 1 cm, and each elastic edge is turned once over its elastic.</p>
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </StyleLayout>
  );
}
