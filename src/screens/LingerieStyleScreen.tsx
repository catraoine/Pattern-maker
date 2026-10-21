import { useMemo } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { LingerieDraft, LingerieFit, LingerieMeasurements, isSwim, lingerieMissing } from '../engine/lingerie';
import { STRETCH_TEST } from '../engine/tee';
import { LINGERIE_GROUPS, LingerieChoices, describeLingerie, lingerieGroupShown, lingeriePick } from '../garments';
import { MeasurementValues } from '../measurements';
import { labelOf } from '../measureFlow';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, UndoTools, useUndo } from '../ui/useUndo';
import type { MyFabric } from '../engine/fabrics';
import { lingerieFabrics } from '../engine/knits';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { Mode } from '../mode';
import { FABRIC, Group, LOOKS, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { FabricDetails } from '../ui/FabricDetails';

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
  onFabric?: (f: MyFabric) => void;
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

/** Knit on 150 cm wide fabric, from the cutting layout; swimwear needs the same again in lining. */
export const lingerieFabricMetres = (draft: LingerieDraft) => layPlan(draft.pieces, 150)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

const PIECE_NOTES: Record<LingerieChoices['piece'], string> = {
  brief: 'A brief with a lined gusset and elastic at the waist and legs.',
  bralette: 'A soft, wire-free bralette: two cups on an elastic band, with adjustable straps and a hook-and-eye back.',
  bodysuit: 'A scoop-neck bodysuit with narrow straps, cut for a close, smooth fit.',
  swimsuit: 'A one-piece with a scoop neck and a low back, fully lined.',
  bikini: 'A triangle or longline top with a matching brief, fully lined.',
};

/** The questions after trying one on, and which pieces each applies to. */
const FIT_QUESTIONS: { id: keyof LingerieFit; label: string; options: [string | undefined, string][]; for: (piece: LingerieChoices['piece']) => boolean }[] = [
  { id: 'size', label: 'All round', options: [['snug', 'Too snug'], [undefined, 'Right'], ['loose', 'Too loose']], for: () => true },
  { id: 'leg', label: 'Leg openings', options: [['gapes', 'Gape'], [undefined, 'Right'], ['digs', 'Dig in']], for: (p) => p !== 'bralette' },
  { id: 'back', label: 'The back', options: [['rides', 'Rides up'], [undefined, 'Stays put']], for: (p) => p !== 'bralette' },
  { id: 'cup', label: 'Cups', options: [['full', 'Spill over'], [undefined, 'Right'], ['empty', 'Wrinkle']], for: (p) => p === 'bralette' || p === 'bikini' },
  { id: 'straps', label: 'Straps', options: [['slip', 'Slip off'], [undefined, 'Right'], ['dig', 'Dig in']], for: (p) => p !== 'brief' },
  { id: 'torso', label: 'Body length', options: [['short', 'Pulls down at the shoulders'], [undefined, 'Right'], ['long', 'Bags at the tummy']], for: (p) => p === 'bodysuit' || p === 'swimsuit' },
];

/** The engine's warnings, as a nudge for the maker. */
const WARNINGS: Record<string, string> = {
  'soft cup': 'Your bust is fuller than a soft cup supports well, so this one gives light support. A wired bra is coming in a later drop.',
  'torso loop': 'Your torso loop is far from what your other measurements suggest, so the body is only partly lengthened to match it. Please measure it again with someone holding the tape.',
};

export function LingerieStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric, onFabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const title = describeLingerie(choices);
  const swim = isSwim(choices.piece);
  const missing = lingerieMissing(values as Partial<LingerieMeasurements>, choices.piece);
  const tried = choices.tried ?? {};
  const answer = (id: keyof LingerieFit, v: string | undefined) => {
    const next = { ...tried, [id]: v } as LingerieFit;
    if (v === undefined) delete next[id];
    onChoices({ ...choices, tried: next });
  };
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
                  className={lingeriePick(choices, g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={lingeriePick(choices, g.id) === id}
                  onClick={() => onChoices({ ...choices, [g.id]: id })}
                >
                  {label}
                </button>
              ))}
            </div>
            {g.id === 'piece' && <p className="muted small">{PIECE_NOTES[choices.piece]}</p>}
            {g.id === 'piece' && swim && <p className="muted small">Swimwear is always cut for high-stretch swim Lycra.</p>}
            {g.id === 'piece' && draft?.seamedCup && <p className="muted small">The cups are cut in two pieces with a seam, which shapes a fuller bust better than a dart.</p>}
            {g.id === 'way' && <p className="muted small">Pull it lengthwise too. If it barely gives, choose Across only and the pattern isn&rsquo;t shortened for stretch.</p>}
            {g.id === 'stretch' && <p className="muted small">How to test: {STRETCH_TEST}</p>}
            {g.id === 'closure' && lingeriePick(choices, 'closure') === 'snaps' && <p className="muted small">The gusset is cut in two halves that overlap, with snap tape.</p>}
          </Group>
        ))}
        <Group label="How did it fit?">
          <p className="muted small">Made one? Tell us what you saw and the pattern is redrawn for the next.</p>
          {FIT_QUESTIONS.filter((q) => q.for(choices.piece)).map((q) => (
            <div key={q.id} className="fitq">
              <p className="small">{q.label}</p>
              <div className="chips" role="group" aria-label={q.label}>
                {q.options.map(([v, label]) => (
                  <button key={label} type="button" className={tried[q.id] === v ? 'chip on' : 'chip'} aria-pressed={tried[q.id] === v} onClick={() => answer(q.id, v)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {draft && draft.fitNotes.length > 0 && <p className="msg small">Redrawn: {draft.fitNotes.join('; ')}.</p>}
        </Group>
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={lingerieFabricMetres(draft)} advice={lingerieFabrics(draft.style)} fabric={fabric} knit>
              {onFabric && <FabricDetails fabric={fabric} garment="lingerie" onFabric={onFabric} />}
            </FabricCard>
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
          {missing.length > 0 ? (
            <div className="msg">
              <p className="small">
                The {choices.piece} needs {missing.length === 1 ? 'one more measurement' : 'a few more measurements'}: {missing.map((id) => labelOf(id).toLowerCase()).join(', ')}.
              </p>
              <button type="button" className="secondary" onClick={onEditMeasurements}>
                Add them
              </button>
            </div>
          ) : (
            error && <p className="msg error">{error}</p>
          )}
          {draft && sheet && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} /></PatternPane>}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">Drafted to your measurements as you choose.</p>
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {WARNINGS[w]}
          </p>
        ))}
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
                  {e.edge}: {e.length} cm, {e.width} cm wide{e.count > 1 ? ` (cut ${e.count})` : ''}
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
        <p className="muted small">Seams are 1 cm. Each elastic edge has an allowance as wide as its elastic, so it turns once over it.</p>
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
