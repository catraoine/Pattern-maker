import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { NECKBAND_CM, STRETCH_TEST, TeeDraft, pctWords } from '../engine/tee';
import { teeFlat } from '../engine/flat';
import { TEE_GROUPS, TeeChoices, describeTee } from '../garments';
import { TechFlatView } from '../ui/TechFlatView';
import { GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import { AllRound } from '../ui/AllRound';
import { roundTee } from '../engine/allRound';
import { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, useUndo } from '../ui/useUndo';
import type { MyFabric } from '../engine/fabrics';
import { teeFabrics } from '../engine/knits';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { Mode } from '../mode';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { DrawOnForm } from '../ui/DrawOnForm';
import { TeeFormMeasurements, readTeeFit, readTeeHem, readTeeNeckline, readTeeSleeve, teeForm, teeLines } from '../ui/formTops';
import { FABRIC, Group, LOOKS, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { FabricDetails } from '../ui/FabricDetails';

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
  /** The T-shirt has no tucked-away choices of its own, but the link is here like every other garment, for the print screen's tools. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
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

export function TeeStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric, onFabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const [view, setView] = useState<'sketch' | 'round' | 'pattern'>('sketch');
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<TeeChoices>();
  const m = values as TeeFormMeasurements;
  const form = useMemo(() => (onForm && draft ? teeForm(m, choices, draft) : undefined), [onForm, draft, m, choices]);
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => (draft ? teeFlat(draft) : undefined), [draft]);
  const title = describeTee(choices);
  const round = useMemo(() => (draft ? roundTee(draft, values) : undefined), [draft, values]);
  const hemLabel = choices.length === 'cropped' ? 'Hem' : 'Hip';
  const hemBody = choices.length === 'cropped' ? values.waist : values.full_hip;

  if (onForm && draft && form) {
    return (
      <DrawOnForm<TeeChoices>
        body={form.body}
        m={m}
        legs={false}
        bottom={form.hems.tunic + 6}
        arms={form.arm}
        backs={false}
        kinds={[
          ['neckline', 'Neckline'],
          ['fit', 'Side'],
          ['hem', 'Hem'],
          ['sleeve', 'Sleeve'],
        ]}
        help={{
          neckline: 'Draw the neckline from the shoulder down to the centre front: close to the neck for a crew, lower and round for a scoop, straight down to a point for a V.',
          hem: 'Draw across where you want the hem: just below the waist, at the hip, or lower for a tunic. A T-shirt hem is cut level.',
        }}
        lines={() => teeLines(draft, form)}
        choices={choices}
        onChoices={setChoices}
        read={(kind, _side, stroke) =>
          kind === 'neckline'
            ? readTeeNeckline(stroke, form, choices)
            : kind === 'fit'
              ? readTeeFit(stroke, form, m, choices)
              : kind === 'sleeve'
                ? readTeeSleeve(stroke, form, choices)
                : readTeeHem(stroke, form, choices)
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
    );
  }

  return (
    <StyleLayout
      onEditMeasurements={onEditMeasurements}
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
    >
      <section className="card numbered" aria-labelledby="opts">
        <TabPanel tab={LOOKS}>
          <p className="muted small">Drafted for knit fabric: no darts, the stretch shapes it to you.</p>
        </TabPanel>
        {TEE_GROUPS.map((g) => (
          <Group key={g.id} label={g.label}>
            <div className={chipsClass('tee', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={choices[g.id] === id ? 'chip on' : 'chip'}
                  aria-pressed={choices[g.id] === id}
                  onClick={() => onChoices({ ...choices, [g.id]: id })}
                >
                  <ChoicePic set="tee" group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            <Explain set="tee" group={g.id} options={g.options} pick={choices[g.id]} />
            {g.id === 'stretch' && <p className="muted small">How to test: {STRETCH_TEST}</p>}
            {g.id === 'fit' && <p className="muted small">{FIT_NOTES[choices.fit]}</p>}
          </Group>
        ))}
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={teeFabricMetres(draft)} advice={teeFabrics(choices)} fabric={fabric} knit>
              {onFabric && <FabricDetails fabric={fabric} garment="tee" onFabric={onFabric} />}
            </FabricCard>
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch look={view === 'pattern' ? 'pattern' : 'garment'} onLook={(l) => setView(l === 'pattern' ? 'pattern' : 'sketch')} />
        <div className="row between wrap">
          {view !== 'pattern' ? (
            <GarmentViews<'sketch' | 'round'>
              views={[['sketch', 'Drawing'], ...(round ? ([['round', 'All round']] as ['round', string][]) : [])]}
              view={view}
              onView={setView}
            />
          ) : (
            <span />
          )}
          <div className="row tools">
            {draft && (
              <button type="button" className="link small" onClick={() => setOnForm(choices)}>
                Draw on your form
              </button>
            )}
          </div>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && <TechFlatView flat={flat} title={title} />}
          {round && view === 'round' && <AllRound round={round} m={values} striped={!!fabric?.checks} label={`The ${title.toLowerCase()} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
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
        {draft && <FabricSummary metres={teeFabricMetres(draft)} fabric={fabric} />}
        <p className="muted small">
          Seam allowances are 1 cm, the usual for knits, with 2.5 cm at the hem. The neckband is cut shorter than the neckline so it
          lies flat.
        </p>
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link edit-measure" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </StyleLayout>
  );
}
