import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { TROUSER_EASE, TROUSER_LENGTHS, TrousersDraft, TrousersMeasurements, trouserLength } from '../engine/trousers';
import { trousersFlat, trousersView } from '../engine/flat';
import { DrawOnForm, skirtForm } from '../ui/DrawOnForm';
import { TROUSER_HELP, readTrouserHem, readTrouserPocket, readTrouserRise, readTrouserSide, trouserLines } from '../ui/formTrousers';
import { FormSketch } from '../ui/FormSketch';
import { TROUSER_GROUPS, TrousersChoices, describeTrousers, trouserAllowed, trouserChoice, validTrousers } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { AllRound } from '../ui/AllRound';
import { roundTrousers } from '../engine/allRound';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, useUndo } from '../ui/useUndo';
import { FABRIC, Group, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';

import { Mode, ProTool, shows } from '../mode';
import { EaseMapView } from '../ui/EaseMapView';
import { FitSwitch, GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';

import { MyFabric, fabricEase, trousersFabrics } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { DemoButton } from '../ui/DemoButton';

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
  const [view, setView] = useState<'sketch' | 'flat' | 'round' | 'pattern'>('sketch');
  const [fit, setFit] = useState(false);
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [drawing, setDrawing] = useState<TrousersChoices>();
  const canFit = !!easeMap?.length && can('easeMap');
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const title = describeTrousers(choices);
  const round = useMemo(() => (draft ? roundTrousers(draft, values) : undefined), [draft, values]);
  const ease = TROUSER_EASE[choices.fit];
  const extra = fabricEase(fabric, 'trousers');
  const flat = useMemo(
    () => (draft && values.waist_to_hip && values.crotch_depth ? trousersFlat(draft, { waist_to_hip: values.waist_to_hip, crotch_depth: values.crotch_depth }) : undefined),
    [draft, values.waist_to_hip, values.crotch_depth],
  );
  const formBody = useMemo(() => (values.waist && values.full_hip && values.waist_to_hip ? skirtForm({ waist: values.waist, full_hip: values.full_hip, waist_to_hip: values.waist_to_hip }) : undefined), [values.waist, values.full_hip, values.waist_to_hip]);
  const onForm = useMemo(() => {
    if (!draft || !values.waist_to_hip || !values.crotch_depth) return { cloth: [], lines: [] };
    const v = trousersView(draft, { waist_to_hip: values.waist_to_hip, crotch_depth: values.crotch_depth });
    return { cloth: v.shapes, lines: v.lines.map((l) => l.pts) };
  }, [draft, values.waist_to_hip, values.crotch_depth]);
  // The length is set on the drawing, with the hem dot (Cat, 2026-10-24); culottes keep their own.
  const shown = (id: string) => id !== 'length';
  const lengthGroup = TROUSER_GROUPS.find((g) => g.id === 'length')!;
  const full = trouserLength(values as unknown as TrousersMeasurements, { leg: 'straight', length: 'full' });
  const hem =
    choices.leg === 'culotte' || !values.waist_to_floor || !values.waist_to_knee || !values.crotch_depth
      ? undefined
      : {
          name: 'Trouser length',
          marks: TROUSER_LENGTHS.map((id) => ({ id, label: lengthGroup.options.find((o) => o[0] === id)![1], y: trouserLength(values as unknown as TrousersMeasurements, { leg: choices.leg, length: id }) })),
          value: choices.length,
          onPick: (length: string) => onChoices(validTrousers({ ...choices, length: length as TrousersChoices['length'], lengthCm: undefined })),
        };
  const elastic = choices.waist === 'elastic';
  const pockets = choices.pockets ?? 'none';
  // A leg or length picked from the chips replaces one drawn on the form.
  const pickFrom = (id: string, opt: string): TrousersChoices =>
    validTrousers({ ...choices, [id]: opt, ...(id === 'leg' ? { legCm: undefined } : {}), ...(id === 'length' ? { lengthCm: undefined } : {}) });
  const m = values as unknown as TrousersMeasurements;

  if (drawing && draft && formBody) {
    return (
      <GarmentFabric fabric={fabric}>
        <DrawOnForm<TrousersChoices>
          cloth={onForm.cloth}
          body={formBody}
          m={values as { waist: number }}
          legs
          bottom={(values.waist_to_floor ? full : draft.lengthCm) + 6}
          backs={false}
          kinds={[
            ['fit', 'Side'],
            ['hem', 'Hem'],
            ['waist', 'Waist'],
            ['pocket', 'Pocket'],
          ]}
          help={TROUSER_HELP}
          lines={() => trouserLines(draft, m)}
          choices={choices}
          onChoices={setChoices}
          read={(kind, _side, stroke) =>
            kind === 'fit'
              ? readTrouserSide(stroke, draft, m, choices)
              : kind === 'hem'
                ? readTrouserHem(stroke, m, choices)
                : kind === 'waist'
                  ? readTrouserRise(stroke, m, choices)
                  : readTrouserPocket(stroke, draft, m, choices)
          }
          onDone={() => {
            undo.change(choices, drawing);
            setDrawing(undefined);
            setView('pattern');
          }}
          onCancel={() => {
            setChoices(drawing);
            setDrawing(undefined);
          }}
        />
      </GarmentFabric>
    );
  }

  return (
    <StyleLayout
      onEditMeasurements={onEditMeasurements}
      onPrint={onNext}
      flat={flat}
      undo={undo}
      label="your trousers"
      garment="trousers"
      name={title}
      metres={draft ? trousersFabricMetres(draft) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
    >
      <section className="card numbered" aria-labelledby="opts">
        {TROUSER_GROUPS.filter((g) => shown(g.id)).map((g) => (
          <Group key={g.id} label={g.label}>
            <div className={chipsClass('trousers', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={trouserChoice(choices, g.id) === id && trouserAllowed(choices, g.id, id) ? 'chip on' : 'chip'}
                  aria-pressed={trouserChoice(choices, g.id) === id && trouserAllowed(choices, g.id, id)}
                  disabled={!trouserAllowed(choices, g.id, id)}
                  onClick={() => onChoices(pickFrom(g.id, id))}
                >
                  <ChoicePic set="trousers" group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            <Explain set="trousers" group={g.id} options={g.options} pick={trouserAllowed(choices, g.id, trouserChoice(choices, g.id)) ? trouserChoice(choices, g.id) : undefined} />
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
          </Group>
        ))}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the trousers</p>
            <FinishChoices garment="trousers" finish={finish} onFinish={onFinish} />
          </TabPanel>
        )}
        {(flat || draft) && (
          <TabPanel tab={FABRIC}>
            {draft ? (
              <FabricCard metres={trousersFabricMetres(draft)} advice={trousersFabrics(choices)} fabric={fabric}>
                {flat && <FabricSwatches finish={finish} onFinish={onFinish} garment="trousers" details />}
              </FabricCard>
            ) : (
              <FabricSwatches finish={finish} onFinish={onFinish} garment="trousers" details />
            )}
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch look={view === 'pattern' ? 'pattern' : 'garment'} onLook={(l) => setView(l === 'pattern' ? 'pattern' : 'sketch')} />
        <div className="row between wrap">
          {view !== 'pattern' ? (
            <GarmentViews<'sketch' | 'flat' | 'round'>
              views={[['sketch', 'Form'], ['flat', 'Drawing'], ...(round ? ([['round', 'All round']] as ['round', string][]) : [])]}
              view={view}
              onView={setView}
            />
          ) : canFit ? (
            <FitSwitch on={fit} onChange={setFit} />
          ) : (
            <span />
          )}
          <div className="row tools">
            {draft && formBody && values.waist_to_floor && (
              <button type="button" className="link small" onClick={() => setDrawing(choices)}>
                Draw on your form
              </button>
            )}
          </div>
        </div>
        <div className="preview">
          <DemoButton demo="style" />
          {error && <p className="msg error">{error}</p>}
          {formBody && draft && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <FormSketch body={formBody} m={values as { waist: number }} legs bottom={(values.waist_to_floor ? full : draft.lengthCm) + 6} lines={{}} cloth={onForm.cloth} outline={onForm.lines} hem={hem} label={`The ${title.toLowerCase()} on your form`} />
            </GarmentFabric>
          )}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {round && view === 'round' && <AllRound round={round} m={values} label={`The ${title.toLowerCase()} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
          {draft && sheet && view === 'pattern' && !(fit && canFit) && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} /></PatternPane>}
          {view === 'pattern' && fit && canFit && <EaseMapView views={easeMap!} label={`The fit of the ${title.toLowerCase()}, on its pattern pieces`} />}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">
          Drafted to your measurements as you choose.
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
          {!draft?.shorts && (
            <>
              <span>Knee</span>
              <span />
              <strong>{draft ? draft.kneeCm : '–'} cm</strong>
            </>
          )}
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
        {draft && <FabricSummary metres={trousersFabricMetres(draft)} fabric={fabric} />}
        <p className="muted small">
          The crotch is drafted to your own crotch depth and length, front and back curves together, so the trousers sit without pulling or
          bagging. {elastic ? 'A pull-on elastic waist, with no zip.' : choices.closure === 'fly' ? 'A fly front with its facing and shield.' : 'An invisible zip in the left side seam.'}
        </p>
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="later edit-measure" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </StyleLayout>
  );
}
