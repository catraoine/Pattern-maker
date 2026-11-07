import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { BOXY_EASE, NECKBAND_CM, STRETCH_TEST, TEE_NECKS, TeeDraft, TeeMeasurements, pctWords } from '../engine/tee';
import { teeSpec } from '../engine/spec';
import { FinishedTable, finishedLines } from '../ui/FinishedTable';

import { teeFlat, wornLines, wornShapes } from '../engine/flat';
import { TEE_GROUPS, TeeChoices, describeTee, teeOptionAllowed } from '../garments';
import { TestingTag } from '../ui/TestingTag';
import { TechFlatView } from '../ui/TechFlatView';
import { GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import { AllRound } from '../ui/AllRound';
import { roundTee } from '../engine/allRound';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { UndoToast, useUndo } from '../ui/useUndo';
import type { MyFabric } from '../engine/fabrics';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import type { Finish } from '../savedWork';
import { teeFabrics } from '../engine/knits';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { Mode } from '../mode';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { DrawOnForm } from '../ui/DrawOnForm';
import { FormSketch } from '../ui/FormSketch';
import { TeeFormMeasurements, readTeeFit, readTeeHem, readTeeNeckline, readTeeSleeve, teeForm, teeLines } from '../ui/formTops';
import { FABRIC, Group, InCorner, LOOKS, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { FabricDetails } from '../ui/FabricDetails';
import { PiecesList, SummaryActions, formViews } from '../ui/StyleSummary';

import { teeFabricMetres } from '../fabricAmounts';

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
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
  /** The fabric, told on the Fabric tab. */
  fabric?: MyFabric;
  onFabric?: (f: MyFabric) => void;
  /** The knit swatches on the Fabric step pick the cloth the drawings are shown in. */
  finish?: Finish;
  onFinish?: (f: Finish) => void;
  /** The T-shirt has no tucked-away choices of its own, but the link is here like every other garment, for the print screen's tools. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

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
  return `One of your measurements looks unusual (${w}). Please double-check it.`;
}

export function TeeStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric, onFabric, finish, onFinish, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const [view, setView] = useState<'sketch' | 'flat' | 'round' | 'pattern'>('sketch');
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<TeeChoices>();
  const m = values as TeeFormMeasurements;
  const form = useMemo(() => (draft ? teeForm(m, choices, draft) : undefined), [draft, m, choices]);
  const formLines = useMemo(() => (draft && form ? teeLines(draft, form) : {}), [draft, form]);
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => (draft ? teeFlat(draft) : undefined), [draft]);
  const clothShapes = useMemo(() => (flat ? wornShapes(flat) : undefined), [flat]);
  const flatLines = useMemo(() => (flat ? wornLines(flat) : undefined), [flat]);
  const title = describeTee(choices);
  // All round isn't usable for a sleeveless tank yet (cloth stands out over the shoulders), so the tank shows Front and
  // Flat only until the sewn T-shirt lands (All round quality, Nov 7).
  const sleeveless = choices.sleeve === 'none';
  const round = useMemo(() => (draft && !sleeveless ? roundTee(draft, values) : undefined), [draft, values, sleeveless]);
  const shownView = view === 'round' && !round ? 'sketch' : view;

  if (onForm && draft && form) {
    return (
      <GarmentFabric fabric={fabric}>
      <DrawOnForm<TeeChoices>
        allRound={round ? { round, m: values, fabric, striped: fabric?.checks ? (fabric.checks.stripes ? 'stripes' : 'checks') : false } : undefined}
        cloth={clothShapes}
        flatLines={flatLines}
        backCloth={flat ? wornShapes(flat, 1) : undefined}
        backFlatLines={flat ? wornLines(flat, 1) : undefined}
        sleeve={draft.sleeve}
        body={form.body}
        m={m}
        legs={false}
        bottom={form.hems.tunic + 6}
        arms={form.arm}
        backKinds={['hem']}
        kinds={[
          ['neckline', 'Neckline'],
          ['fit', 'Side'],
          ['hem', 'Hem'],
          ['sleeve', 'Sleeve'],
        ]}
        help={{
          neckline: 'Draw the neckline from the shoulder down to the centre front: close to the neck for a crew, lower and round for a scoop, straight down to a point for a V.',
          hem: 'Draw across where you want the hem: just below the waist, at the hip, or lower for a tunic. Curve it up at the sides for a shirttail, or turn to the back and draw it lower for a high-low hem.',
          sleeve: 'Draw across the arm where you want the sleeve to end.',
        }}
        lines={() => teeLines(draft, form)}
        choices={choices}
        onChoices={setChoices}
        read={(kind, side, stroke) =>
          kind === 'neckline'
            ? readTeeNeckline(stroke, form, choices)
            : kind === 'fit'
              ? readTeeFit(stroke, form, m, choices)
              : kind === 'sleeve'
                ? readTeeSleeve(stroke, form, choices)
                : readTeeHem(stroke, form, choices, side)
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
      fabric={fabric}
      onEditMeasurements={onEditMeasurements}
      onPrint={onNext}
      flat={flat}
      undo={undo}
      label="your T-shirt"
      garment="tee"
      name={title}
      metres={draft ? teeFabricMetres(draft) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
      finished={
        draft && <FinishedTable lines={finishedLines(teeSpec(values as TeeMeasurements, draft), { knit: true })} noun="T-shirt" />
      }
    >
      <section className="card numbered" aria-labelledby="opts">
        <TabPanel tab={LOOKS}>
          <p className="muted small">Drafted for knit fabric: no darts, the stretch shapes it to you.</p>
        </TabPanel>
        {TEE_GROUPS.filter((g) => g.id !== 'length' && (g.id !== 'shoulder' || choices.sleeve !== 'none')).map((g) => {
          // Older saves have no shoulder choice: set in.
          const pick = g.id === 'shoulder' ? (choices.shoulder ?? 'set_in') : choices[g.id];
          return (
          <Group key={g.id} label={g.label}>
            <div className={chipsClass('tee', g.id)}>
              {g.options.filter(([id]) => teeOptionAllowed(choices, g.id, id)).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={pick === id ? 'chip on' : 'chip'}
                  aria-pressed={pick === id}
                  onClick={() => onChoices({ ...choices, [g.id]: id, ...(g.id === 'length' ? { lengthCm: undefined } : {}) })}
                >
                  <ChoicePic set="tee" group={g.id} id={id} />
                  {label}
                  {g.id === 'sleeve' && id === 'none' && <TestingTag tool="tank_tee" />}
                  {g.id === 'shoulder' && id === 'dropped' && <TestingTag tool="boxy_tee" />}
                </button>
              ))}
            </div>
            <Explain set="tee" group={g.id} options={g.options} pick={pick} />
            {g.id === 'stretch' && (
              <details className="how-to-test muted small">
                <summary>How to test</summary>
                <p>{STRETCH_TEST}</p>
              </details>
            )}
            {g.id === 'fit' && <p className="muted small">{FIT_NOTES[choices.fit]}</p>}
            {g.id === 'shoulder' && pick === 'dropped' && <p className="muted small">Boxy whatever the fit: the body is cut with at least {Math.round(BOXY_EASE[choices.stretch] * 100)}% room at the bust and hangs straight.</p>}
          </Group>
          );
        })}
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={teeFabricMetres(draft)} advice={teeFabrics(choices)} fabric={fabric} knit>
              {finish && onFinish ? (
                <FabricSwatches finish={finish} onFinish={onFinish} garment="tee" details />
              ) : (
                onFabric && <FabricDetails fabric={fabric} garment="tee" onFabric={onFabric} />
              )}
            </FabricCard>
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch look={view === 'pattern' ? 'pattern' : 'garment'} onLook={(l) => setView(l === 'pattern' ? 'pattern' : 'sketch')} />
        <div className="row between wrap">
          {view !== 'pattern' ? (
            <GarmentViews<'sketch' | 'flat' | 'round'>
              views={formViews(round)}
              view={view === 'round' && !round ? 'sketch' : view}
              onView={setView}
            />
          ) : (
            <span />
          )}
          <InCorner>
            {draft && (
              <button type="button" className="link small" aria-label="Draw on your form" onClick={() => setOnForm(choices)}>
                <span className="tool-word">Draw</span>
              </button>
            )}
          </InCorner>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {form && draft && shownView === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <FormSketch
                body={form.body}
                m={m}
                legs={false}
                bottom={form.hems.tunic + 16}
                arms={form.arm}
                lines={formLines}
                cloth={clothShapes} flatLines={flatLines}
                sleeve={draft.sleeve}
                hem={{
                  name: 'T-shirt length',
                  marks: TEE_GROUPS.find((g) => g.id === 'length')!.options.map(([id, label]) => ({ id, label, y: form.hems[id as TeeChoices['length']] })),
                  value: choices.length,
                  onPick: (length) => onChoices({ ...choices, length: length as TeeChoices['length'], lengthCm: undefined }),
                  // The hem glides to any length between the named ones, as the centre back length (Cat, 2026-11-06);
                  // the nearest named length goes with it.
                  free: {
                    zero: TEE_NECKS[choices.neckline].backDepth + (draft.hemShape?.back ?? 0),
                    min: m.nape_to_waist + 1 - TEE_NECKS[choices.neckline].backDepth,
                    max: m.nape_to_waist + m.waist_to_hip + 25 - TEE_NECKS[choices.neckline].backDepth,
                    cm: choices.lengthCm,
                    onCm: (cm) => {
                      const y = TEE_NECKS[choices.neckline].backDepth + (draft.hemShape?.back ?? 0) + cm;
                      const length = (['cropped', 'hip', 'tunic'] as const).reduce((a, b) => (Math.abs(form.hems[b] - y) < Math.abs(form.hems[a] - y) ? b : a));
                      onChoices({ ...choices, length, lengthCm: cm });
                    },
                  },
                }}
                label={`The ${title.toLowerCase()} on your form`}
              />
            </GarmentFabric>
          )}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {round && view === 'round' && <AllRound round={round} m={values} fabric={fabric} striped={fabric?.checks ? (fabric.checks.stripes ? 'stripes' : 'checks') : false} label={`The ${title.toLowerCase()} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
          {draft && sheet && view === 'pattern' && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for ${title.toLowerCase()}`} /></PatternPane>}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">
          Drafted to your measurements as you choose.
        </p>
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {friendly(w)}
          </p>
        ))}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        {draft && (
          <p className="muted small">
            Ease at the bust: {pctWords(draft.easePct)} ({Math.round((draft.finishedBust - (values.full_bust ?? 0)) * 10) / 10} cm)
            {draft.easePct < 0 ? ', so the knit stretches a little to fit' : ''}. Neckband {draft.neckband.length} cm, {Math.round(draft.neckband.ratio * 100)}% of the{' '}
            {draft.necklineCm} cm neckline, {NECKBAND_CM} cm wide.
          </p>
        )}
        <PiecesList pieces={pieces} />
        {draft && <FabricSummary metres={teeFabricMetres(draft)} fabric={fabric} />}
        <p className="muted small">
          Seam allowances are 1 cm, the usual for knits, with 2.5 cm at the hem. The neckband is cut shorter than the neckline so it
          lies flat.
        </p>
        <SummaryActions ready={!!draft} onNext={onNext} saveState={saveState} onSave={onSave} onAccount={onAccount} onEditMeasurements={onEditMeasurements} />
      </aside>
    </StyleLayout>
  );
}
