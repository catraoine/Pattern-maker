import { matchKind } from '../engine/prints';
import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { outerSpec } from '../engine/spec';
import { FinishedTable, finishedLines } from '../ui/FinishedTable';
import { OuterDraft, OuterMeasurements, outerDrop } from '../engine/outerwear';
import { outerFlat, wornLines, wornShapes } from '../engine/flat';
import { OuterChoices, describeOuter, outerAllowed, outerGroups, oversizeOuter } from '../garments';
import { TestingTag } from '../ui/TestingTag';
import { TechFlatView } from '../ui/TechFlatView';
import { AllRound } from '../ui/AllRound';
import { roundOuter } from '../engine/allRound';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { UndoToast, useUndo } from '../ui/useUndo';
import { EaseMapView } from '../ui/EaseMapView';
import { FitSwitch, GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import { Mode, ProTool, shows } from '../mode';
import type { Finish } from '../savedWork';
import { MyFabric, fabricEase, outerFabrics } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { OUTER_SLEEVE_HELP, readOuterSleeve } from '../ui/formSleeves';
import { outerPocketLines, readOuterPocket, readOuterVent } from '../ui/formOuter';
import { DrawOnForm, armFor, formWidth } from '../ui/DrawOnForm';
import { FormSketch } from '../ui/FormSketch';
import { FormLine, landmarks } from '../ui/formLines';
import { outerLines, readOuterCollar, readOuterFit, readOuterFront, readOuterHem, readOuterShaping } from '../ui/formTops';
import { FABRIC, Group, InCorner, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { PiecesList, SummaryActions, formViews } from '../ui/StyleSummary';

import { outerFabricMetres } from '../fabricAmounts';

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
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

export function OuterStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const can = (t: ProTool) => shows(mode, t);
  const [view, setView] = useState<'sketch' | 'flat' | 'round' | 'pattern'>('sketch');
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<OuterChoices>();
  const [fit, setFit] = useState(false);
  const canFit = !!easeMap?.length && can('easeMap');
  const kind = choices.garment;
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => (draft ? outerFlat(draft) : undefined), [draft]);
  const title = describeOuter(choices);
  const round = useMemo(() => (draft ? roundOuter(draft, values) : undefined), [draft, values]);
  const extra = fabricEase(fabric, kind);

  const m = values as OuterMeasurements;
  const waistY = draft ? landmarks(draft.base).waistY : 0;
  const longest = kind === 'coat' ? 'midi' : 'long';
  const formBody = useMemo(() => (draft ? formWidth(draft.base, m) : undefined), [draft, m]);
  const formLines = useMemo(() => (draft ? outerLines(draft) : {}), [draft]);
  const clothShapes = useMemo(() => (flat ? wornShapes(flat) : undefined), [flat]);
  const flatLines = useMemo(() => (flat ? wornLines(flat) : undefined), [flat]);
  const formArm = useMemo(() => {
    if (!draft || !m.arm_length || !m.upper_arm) return undefined;
    const { shoulderTip, underarm } = landmarks(draft.base);
    return armFor(shoulderTip, underarm, { arm_length: m.arm_length, upper_arm: m.upper_arm, wrist: m.wrist });
  }, [draft, m]);

  if (onForm && draft) {
    return (
      <GarmentFabric fabric={fabric}>
      <DrawOnForm<OuterChoices>
        allRound={round ? { round, m: values, fabric, striped: matchKind(fabric) } : undefined}
        cloth={clothShapes}
        arms={formArm}
        sleeve={formArm ? draft.sleeve : undefined}
        underarmY={landmarks(draft.base).underarm.y}
        body={formWidth(draft.base, m)}
        m={m}
        legs={kind === 'coat'}
        bottom={waistY + outerDrop(m, longest) + 6}
        backs={false}
        kinds={[
          ['hem', 'Hem'],
          ['fit', 'Side'],
          ['front', 'Front edge'],
          ['collar', 'Collar'],
          ['seam', 'Shaping'],
          ...(formArm ? ([['sleeve', 'Sleeve']] as [FormLine, string][]) : []),
          ['pocket', 'Pocket'],
          ['vent', 'Vent'],
        ]}
        help={{
          hem: `Draw across where you want the hem: it takes the nearest of the ${kind}’s lengths. Curve it up to the front edge at the centre for a cutaway front.`,
          fit: `Draw down the side: closer to the body for a closer fit${kind === 'coat' ? ', and out from the hip to the hem for an A-line coat' : ''}.`,
          seam: 'Draw from the armhole through the bust down to the waist for princess seams. Any other line keeps the darts.',
          sleeve: OUTER_SLEEVE_HELP,
          pocket: 'Draw a box on the front for a patch pocket, or a short level line for a welt pocket, where it should go.',
          vent: 'Draw straight up from the hem at the centre for a back vent, as long as you want it. Across the hem there closes it.',
        }}
        lines={() => ({ ...outerLines(draft), ...outerPocketLines(draft) })}
        choices={choices}
        onChoices={setChoices}
        read={(line, _side, stroke) =>
          line === 'hem'
            ? readOuterHem(stroke, draft, m, choices)
            : line === 'fit'
              ? readOuterFit(stroke, draft, m, choices)
              : line === 'front'
                ? readOuterFront(stroke, draft, choices)
                : line === 'collar'
                  ? readOuterCollar(stroke, draft, choices)
                  : line === 'sleeve' && formArm
                    ? readOuterSleeve(stroke, formArm, landmarks(draft.base).neckPoint, choices)
                    : line === 'pocket'
                      ? readOuterPocket(stroke, choices)
                      : line === 'vent'
                        ? readOuterVent(stroke, draft, choices)
                        : readOuterShaping(stroke, draft, choices)
        }
        onDone={() => {
          undo.change(choices, onForm);
          setOnForm(undefined);
          setView('pattern');
        }}
        onCancel={() => {
          setChoices(onForm);
          setOnForm(undefined);
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
      label={`your ${kind}`}
      garment={kind}
      name={title}
      metres={draft ? outerFabricMetres(draft) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
      finished={
        draft && (
          <FinishedTable lines={finishedLines(outerSpec(values as OuterMeasurements, draft))} noun={kind === 'coat' ? 'Coat' : 'Jacket'}>
            <p className="muted small">
              Room to wear it {kind === 'coat' ? 'over a jacket or a thick jumper' : 'over a blouse or a fine knit'}
              {extra.bust ? `, ${extra.bust} cm of the bust ease for your heavy fabric` : ''}.
            </p>
          </FinishedTable>
        )
      }
    >
      <section className="card numbered" aria-labelledby="opts">
        {outerGroups(kind).map((g) => (
          <Group key={g.id} label={g.label}>
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
                      // An oversized cut goes boxy, with no pads and a plain sleeve.
                      let next = { ...choices, [g.id]: id } as OuterChoices;
                      if (g.id === 'fit') next = oversizeOuter(next);
                      // A fitted cut keeps its waist darts.
                      if (next.fit === 'fitted' && next.shaping === 'boxy') next.shaping = 'darts';
                      // A cropped jacket is too short for a vent; rib bands at the hem leave no room for one.
                      if (next.length === 'cropped' || next.trim === 'rib') next.vent = 'none';
                      // A notched lapel needs a shoulder seam and a buttoned front: a zip or raglan sleeves switch it to a stand collar.
                      if (next.collar === 'notched' && (next.front === 'zip' || next.sleeve === 'raglan')) next.collar = 'stand';
                      // A raglan sleeve is cut off a one-piece front and back: princess seams give way to darts.
                      if (next.sleeve === 'raglan' && next.shaping === 'princess') next.shaping = 'darts';
                      onChoices(next);
                    }}
                  >
                    <ChoicePic set={kind} group={g.id} id={id} />
                    {label}
                    {g.id === 'fit' && id === 'oversized' && <TestingTag tool="oversized_outer" />}
                  </button>
                );
              })}
            </div>
            <Explain set="outer" group={g.id} options={g.options} pick={choices[g.id]} />
            {g.id === 'shaping' && choices.fit === 'fitted' && <p className="muted small">A fitted {kind} keeps its waist shaping, so boxy needs a regular or relaxed fit.</p>}
          </Group>
        ))}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the {kind}</p>
            <FinishChoices garment={kind} finish={finish} onFinish={onFinish} />
          </TabPanel>
        )}
        {(flat || draft) && (
          <TabPanel tab={FABRIC}>
            {draft ? (
              <FabricCard metres={outerFabricMetres(draft)} advice={outerFabrics({ garment: kind, fit: choices.fit })} fabric={fabric} lined>
                {flat && <FabricSwatches finish={finish} onFinish={onFinish} garment={kind} details />}
              </FabricCard>
            ) : (
              <FabricSwatches finish={finish} onFinish={onFinish} garment={kind} details />
            )}
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch look={view === 'pattern' ? 'pattern' : 'garment'} onLook={(l) => setView(l === 'pattern' ? 'pattern' : 'sketch')} />
        <div className="row between wrap">
          {view !== 'pattern' ? (
            <GarmentViews<'sketch' | 'flat' | 'round'>
              views={formViews(round)}
              view={view}
              onView={setView}
            />
          ) : canFit ? (
            <FitSwitch on={fit} onChange={setFit} />
          ) : (
            <span />
          )}
          <InCorner>
            {draft && (
              <button type="button" className="link small" onClick={() => setOnForm(choices)}>
                Draw on your form
              </button>
            )}
          </InCorner>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {formBody && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <FormSketch body={formBody} m={m} legs={kind === 'coat'} bottom={waistY + outerDrop(m, longest) + 6} lines={formLines} cloth={clothShapes} flatLines={flatLines} arms={formArm} sleeve={formArm ? draft?.sleeve : undefined} underarmY={draft ? landmarks(draft.base).underarm.y : undefined} label={`The ${title.toLowerCase()} on your form`} />
            </GarmentFabric>
          )}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {round && view === 'round' && <AllRound round={round} m={values} fabric={fabric} striped={matchKind(fabric)} label={`The ${title.toLowerCase()} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
          {draft && sheet && view === 'pattern' && !(fit && canFit) && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} /></PatternPane>}
          {view === 'pattern' && fit && canFit && <EaseMapView views={easeMap!} label={`The fit of the ${title.toLowerCase()}, on its pattern pieces`} />}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">
          Drafted to your measurements as you choose.
        </p>
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <p>{title}</p>
        {draft && draft.warnings.length > 0 && <p className="msg small">Please check: {draft.warnings.join('; ')}.</p>}
        <PiecesList pieces={pieces} lining />
        {draft && <FabricSummary metres={outerFabricMetres(draft)} fabric={fabric} />}
        <p className="muted small">
          Fully lined, with interfaced front facings{choices.collar === 'notched' ? ' and an upper and under collar rolled at the lapel' : ''}. The sleeves are drafted to
          your own armhole with room for what you wear underneath{choices.pads !== 'none' ? ', and the shoulders and sleeve heads are raised to take the shoulder pads' : ''}.
        </p>
        <SummaryActions ready={!!draft} onNext={onNext} saveState={saveState} onSave={onSave} onAccount={onAccount} onEditMeasurements={onEditMeasurements} />
      </aside>
    </StyleLayout>
  );
}
