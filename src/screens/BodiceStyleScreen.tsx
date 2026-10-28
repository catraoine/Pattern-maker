import { TestingTag } from '../ui/TestingTag';
import { matchKind } from '../engine/prints';
import { optionInTesting } from '../launch';
import { BackNeck, backBlocked } from '../engine/backNeck';
import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { bodiceSpec, sleeveSpec } from '../engine/spec';
import { FinishedTable, finishedLines } from '../ui/FinishedTable';
import { BodiceDraft, BodiceMeasurements, bodiceEase, dropRange, needsHip } from '../engine/bodice';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, describeBodice, detailAllowed, sleeveOf, topAllowed, validDetails } from '../garments';
import { isStrapless, isTop } from '../engine/corset';
import { SHIRR } from '../engine/shirred';
import { bodiceFlat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { AllRound } from '../ui/AllRound';
import { roundBodice } from '../engine/allRound';
import { SHAPES_FOR_LENGTH, SleeveDraft, SleeveMeasurements, needsArms } from '../engine/sleeve';
import { readBodiceSleeve, sleeveEndLines, sleeveRange } from '../ui/formSleeves';
import { readCollar, readFront } from '../ui/formCollar';
import { SleeveSlider } from '../ui/SleeveSlider';
import { SLEEVE_CUTS, sleeveCutBlocked } from '../engine/sleeveCut';
import { Cuff, cuffAllowed, cuffShown } from '../engine/cuffs';
import { MeasurementValues, hasHip } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { FinishChoices } from '../ui/FinishChoices';
import { BodiceShape } from '../ui/BodiceShape';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import type { Side } from '../ui/ShapeSketch';
import { UndoToast, useUndo } from '../ui/useUndo';
import { DrawMenu } from '../ui/DrawMenu';
import type { Finish } from '../savedWork';
import { MyFabric, bodiceFabrics, fabricEase } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import { isDraped, zipSide } from '../engine/drape';
import { DrawOnForm, armFor, formWidth } from '../ui/DrawOnForm';
import { orSeam, readSeamLine } from '../ui/formSeams';
import { bodiceHemLine, orNeckline, readBodiceHemShape, readUnevenNeckline, unevenNecklineLines } from '../ui/formBodice';
import { FormLine, bodiceLines, landmarks, readDrape, readFit, readNeckline, readSeam } from '../ui/formLines';
import { FABRIC, Group, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';

import { Mode, ProTool, shows } from '../mode';
import { EaseMapView } from '../ui/EaseMapView';
import { FitSwitch, GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import type { EaseView } from '../engine/easeMap';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { DemoButton } from '../ui/DemoButton';
import { PiecesList, SummaryActions } from '../ui/StyleSummary';

/** Moving the shaping is a pro tool, so these groups sit on the Pro tab. */
const PRO_GROUPS: string[] = ['princess', 'bustDart'];

import { bodiceFabricMetres } from '../fabricAmounts';

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
  finish: Finish;
  onFinish: (f: Finish) => void;
  choices: BodiceChoices;
  onChoices: (c: BodiceChoices) => void;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: BodiceDraft;
  /** The set-in sleeve, drafted to the bodice's armhole, when one is chosen. */
  sleeve?: SleeveDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

/** The engine's warnings are written for the pattern cutter; this turns the common ones into a nudge. */
function friendly(w: string) {
  if (w.startsWith('shoulder width')) return 'Your shoulder width and shoulder length don’t quite agree. The pattern still drafts, but re-measuring both will make the shoulders fit better.';
  if (w.startsWith('front length')) return 'Your front length came out shorter than your back length, which usually means a tape slip. It’s drafted with a little extra; please re-measure it.';
  return 'Something in your measurements looks unusual. Please double-check them.';
}

const NECK_NAMES: Record<BodiceChoices['neckline'], string> = {
  crew: 'crew neck',
  scoop: 'scoop neck',
  v: 'V-neck',
  square: 'square neck',
  boat: 'boat neck',
  one_shoulder: 'one-shoulder neckline',
  cowl: 'cowl neck',
  strapless: 'strapless top',
  sweetheart: 'sweetheart top',
  cami: 'cami top',
  halter: 'halter top',
};

/** Which hand-shaped value a chip group replaces: picking a named choice lets go of the dragged or drawn one. */
export const REPLACES: Record<string, (keyof BodiceChoices)[]> = {
  fit: ['bustEase'],
  length: ['dropCm'],
  sleeve: ['sleeveCm'],
  neckline: ['neck', 'cowlDepth', 'unevenNeck'],
  princess: ['lineAt'],
  bustDart: ['lineAt'],
};
const handShaped = (c: BodiceChoices, id: string) => (REPLACES[id] ?? []).some((k) => c[k] !== undefined);

type View = 'sketch' | 'round' | 'flat' | 'pattern';

export function BodiceStyleScreen({ onPhoto, photo, choices, onChoices, onChooseGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const can = (t: ProTool) => shows(mode, t);
  const [view, setView] = useState<View>('sketch');
  const [fit, setFit] = useState(false);
  const canFit = !!easeMap?.length && can('easeMap');
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const undoer = useUndo(choices, onChoices);
  const change = undoer.change;
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<BodiceChoices>();
  const m = values as BodiceMeasurements;
  const pieces = useMemo(() => (draft ? [...draft.pieces, ...(sleeve?.pieces ?? [])] : []), [draft, sleeve]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const valid = validDetails(choices);
  const ease = bodiceEase(valid);
  const top = isTop(choices.neckline);
  const boned = valid.structure === 'boned';
  const extra = fabricEase(fabric, 'bodice');
  const title = describeBodice(choices);
  const hip = hasHip(values);
  const arms = !needsArms(values);
  const chosen = sleeveOf(choices);
  const flat = useMemo(() => (draft ? bodiceFlat(draft, 'binding', sleeve) : undefined), [draft, sleeve]);
  // The arms, for the sleeves to hang on: from the arm measurements, once they are given.
  const formArm = useMemo(() => {
    if (!draft || !sleeve || !arms) return undefined;
    const { shoulderTip, underarm } = landmarks(draft);
    return armFor(shoulderTip, underarm, { arm_length: values.arm_length!, upper_arm: values.upper_arm!, wrist: values.wrist });
  }, [draft, sleeve, arms, values]);
  // On the form to draw on, the arms show once they are measured, so a sleeve can be drawn on a sleeveless bodice too.
  const drawArm = useMemo(() => {
    if (!draft || !arms) return undefined;
    const { shoulderTip, underarm } = landmarks(draft);
    return armFor(shoulderTip, underarm, { arm_length: values.arm_length!, upper_arm: values.upper_arm!, wrist: values.wrist });
  }, [draft, arms, values]);
  const sleeves = useMemo(() => (draft && onForm ? sleeveRange(draft, values as BodiceMeasurements & SleeveMeasurements, choices.fit) : undefined), [draft, onForm, values, choices.fit]);
  const round = useMemo(() => (draft ? roundBodice(draft, values, sleeve) : undefined), [draft, values, sleeve]);
  const detail = { bustDart: choices.bustDart ?? 'side', princess: choices.princess ?? 'none', closure: choices.closure ?? 'back_zip', collar: choices.collar ?? 'none', back: valid.back ?? 'plain', structure: valid.structure ?? 'none', peplum: choices.peplum ?? 'none' };
  // A draped neckline is its own shaping: the dart, seam, opening, collar and boning choices step aside.
  const draped = isDraped(choices);
  const valueOf = (id: (typeof BODICE_GROUPS)[number]['id']) =>
    id === 'sleeveShape' ? chosen.shape : id === 'sleeveCut' ? (chosen.cut ?? 'set_in') : id === 'sleeveCuff' ? (chosen.cuff ?? 'none') : id === 'sleeve' ? chosen.length : id in detail ? detail[id as keyof typeof detail] : choices[id];
  // The simple view leaves moving the shaping to the pattern cutter's tools, unless it has been moved already.
  const moved = (id: string) => (id === 'bustDart' && detail.bustDart !== 'side') || (id === 'princess' && detail.princess !== 'none');
  const shown = (id: string) =>
    // A kimono sleeve is cut on at its named length, with no shape or cuff of its own.
    (id !== 'sleeveShape' || (chosen.length !== 'none' && chosen.cut !== 'kimono')) &&
    (id !== 'sleeveCut' || chosen.length !== 'none') &&
    (id !== 'sleeveCuff' || (cuffShown(chosen) && chosen.cut !== 'kimono')) &&
    (id !== 'bustDart' || (choices.darts !== 'none' && detail.princess === 'none' && !boned)) &&
    ((id !== 'bustDart' && id !== 'princess') || can('dartMoves') || moved(id)) &&
    // A top below the shoulders always opens at the back and has no collar; a boned one is cut in panels.
    !(top && (id === 'closure' || id === 'collar' || id === 'back')) &&
    !(boned && id === 'princess') &&
    !(draped && (id === 'princess' || id === 'bustDart' || id === 'closure' || id === 'collar' || id === 'back' || id === 'structure'));

  const allowed = (id: string, opt: string) => topAllowed(choices, id, opt) && baseAllowed(id, opt);
  const baseAllowed = (id: string, opt: string) =>
    id === 'darts'
      ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts'])
      : id === 'length'
        ? hip || !needsHip(opt as BodiceChoices['length'])
        : id === 'sleeve'
          ? (opt === 'none' || arms) && detailAllowed(choices, 'sleeve', opt)
          : id === 'sleeveShape'
            ? SHAPES_FOR_LENGTH[chosen.length].includes(opt as NonNullable<BodiceChoices['sleeveShape']>)
            : id === 'sleeveCuff'
              ? cuffAllowed(opt as Cuff, chosen.length, chosen.shape)
            : id === 'sleeveCut'
              ? detailAllowed(choices, 'sleeveCut', opt)
            : id === 'princess' || id === 'bustDart' || id === 'closure' || id === 'collar' || id === 'back' || id === 'structure' || id === 'peplum'
              ? detailAllowed(choices, id, opt)
              : true;


  const choose = (c: BodiceChoices, group?: string) => {
    // A tighter fit needs more shaping, so moving to it brings the darts back.
    const darts = DARTS_FOR_FIT[c.fit].includes(c.darts) ? c.darts : 'bust_waist';
    const next = { ...c, darts };
    // Picking a named fit, length or neckline lets go of the dragged or drawn one.
    for (const k of (group && REPLACES[group]) || []) delete next[k];
    // Each sleeve length allows only some shapes; keep the chosen one when it still fits.
    // Details the other choices no longer allow (a collar on a V-neck, say) fall back to the plain ones.
    change(validDetails({ ...next, sleeveShape: sleeveOf(next).shape }));
  };

  // The garment's own views: the sketch's two sides, the flat drawing, all round on the form.
  const garmentViews: [Side | 'flat' | 'round', string][] = [
    ['front', 'Front'],
    ['back', 'Back'],
    ['flat', 'Drawing'],
    ['round', 'All round'],
  ];

  if (onForm && draft) {
    return (
      <DrawOnForm<BodiceChoices>
        body={formWidth(draft, m)}
        m={m}
        legs={false}
        bottom={Math.max(landmarks(draft).waistY + (hip ? dropRange(m).max : 0) + 6, drawArm ? drawArm.wristY + 3 : 0)}
        arms={drawArm}
        kinds={[
          ['neckline', 'Neckline'],
          ['seam', 'Seam'],
          ['drape', 'Drape'],
          ...(drawArm && sleeves ? ([['sleeve', 'Sleeve']] as [FormLine, string][]) : []),
          ['collar', 'Collar'],
          ['front', 'Front'],
          ['fit', 'Side'],
          ['hem', 'Hem'],
        ]}
        help={{
          collar: 'Draw the collar round the neck: standing up above the neckline for a band, lying flat and rounded for a Peter Pan, coming to points for a shirt collar, hanging down at the centre for a bow.',
          front: 'Draw down the front: straight down the centre for buttons, or from the neck crossing to the side at the waist for a wrap. On the back, down the centre for the zip.',
        }}
        lines={(side) => {
          const uneven = side === 'front' ? unevenNecklineLines(draft) : [];
          return { ...bodiceLines(draft, side), hem: [bodiceHemLine(draft, side)], ...(uneven.length ? { neckline: uneven } : {}), ...(drawArm ? sleeveEndLines(drawArm, sleeve) : {}) };
        }}
        choices={choices}
        onChoices={onChoices}
        read={(kind, side, stroke) =>
          kind === 'neckline'
            ? orNeckline(readUnevenNeckline(stroke, draft, choices, 'bodice', side), () => readNeckline(stroke, draft, choices, 'bodice', side))
            : kind === 'seam'
              ? orSeam(readSeamLine(stroke, draft, choices, 'bodice', side), () => readSeam(stroke, draft, choices, 'bodice', side))
              : kind === 'drape'
                ? readDrape(stroke, draft, choices, 'bodice')
                : kind === 'fit'
                  ? readFit(stroke, draft, m, choices)
                  : kind === 'sleeve' && drawArm && sleeves
                    ? readBodiceSleeve(stroke, draft, drawArm, sleeves, choices, 'bodice')
                    : kind === 'collar'
                      ? readCollar(stroke, draft, choices, 'bodice')
                      : kind === 'front'
                        ? readFront(stroke, draft, choices, 'bodice', side)
                    : readBodiceHemShape(stroke, draft, m, choices, side)
        }
        onDone={() => {
          change(choices, onForm);
          setOnForm(undefined);
          setView('pattern');
        }}
        onCancel={() => {
          onChoices(onForm);
          setOnForm(undefined);
        }}
      />
    );
  }

  return (
    <StyleLayout
      onEditMeasurements={onEditMeasurements}
      onPrint={onNext}
      flat={flat}
      undo={undoer}
      label="your bodice"
      garment="bodice"
      name={title}
      metres={draft ? bodiceFabricMetres(draft, sleeve) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
      finished={
        draft && (
          <FinishedTable
            lines={finishedLines([
              ...bodiceSpec(values as BodiceMeasurements, draft, choices.length, choices.dropCm),
              ...(sleeve ? sleeveSpec(values as SleeveMeasurements, sleeve) : []),
            ])}
            noun="Bodice"
          >
            {(ease.waist + extra.waist < 0 || extra.bust > 0) && (
              <p className="muted small">
                {ease.waist + extra.waist < 0 ? 'Held in at the waist on purpose, so it holds you like a corset. ' : ''}
                {extra.bust ? `The ease includes ${extra.bust} cm at the bust and ${extra.waist} cm at the waist for your heavy fabric.` : ''}
              </p>
            )}
          </FinishedTable>
        )
      }
    >
      <section className="card numbered" aria-labelledby="opts">
        {BODICE_GROUPS.filter((g) => shown(g.id)).map((g) => (
          <Group key={g.id} label={g.label} tab={PRO_GROUPS.includes(g.id) ? PRO : undefined}>
            <div className={chipsClass('bodice', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={valueOf(g.id) === id && !handShaped(choices, g.id) ? 'chip on' : 'chip'}
                  aria-pressed={valueOf(g.id) === id && !handShaped(choices, g.id)}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose({ ...choices, [g.id]: id }, g.id)}
                >
                  <ChoicePic set="bodice" group={g.id} id={id} />
                  {label}
                  {optionInTesting(g.id, id) && <TestingTag tool="new_details" />}
                </button>
              ))}
            </div>
            <Explain set="bodice" group={g.id} options={g.options} pick={handShaped(choices, g.id) ? undefined : valueOf(g.id)} />
            {g.id === 'neckline' && choices.neck && (
              <p className="muted small">
                Drawn by hand.{' '}
                <button type="button" className="link inline-link" onClick={() => choose({ ...choices }, 'neckline')}>
                  Use the {NECK_NAMES[choices.neckline]} instead
                </button>
              </p>
            )}
            {g.id === 'length' && !hip && (
              <p className="muted small">
                For hip lengths, add your full hip and waist to hip.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'sleeve' && !arms && (
              <p className="muted small">
                For sleeves, add your arm length, upper arm and wrist.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'sleeveCut' && SLEEVE_CUTS.map(([c]) => sleeveCutBlocked(choices, c)).find(Boolean) && <p className="muted small">{SLEEVE_CUTS.map(([c]) => sleeveCutBlocked(choices, c)).find(Boolean)}</p>}
            {g.id === 'sleeve' && arms && chosen.cut !== 'kimono' && <SleeveSlider sleeve={sleeve} choices={choices} onChoices={(c) => change(validDetails(c))} />}
            {g.id === 'neckline' && draped && (
              <p className="muted small">
                {choices.neckline === 'cowl'
                  ? 'The front is cut on the bias and falls in soft folds. It needs a fluid fabric. No collar or princess seams.'
                  : (
                    <>
                    <span className="seg" role="group" aria-label="Which shoulder">
                      {(['left', 'right'] as const).map((sh) => (
                        <button key={sh} type="button" aria-pressed={(choices.shoulder ?? 'left') === sh} className={(choices.shoulder ?? 'left') === sh ? 'on' : ''} onClick={() => change(sh === 'right' ? { ...choices, shoulder: sh } : (({ shoulder: _s, ...rest }) => rest)(choices))}>
                          {sh}
                        </button>
                      ))}
                    </span>{' '}
                      Over your {choices.shoulder ?? 'left'} shoulder, with a zip in the {choices.shoulder === 'right' ? 'left' : 'right'} side seam. No collar or princess seams.
                    </>
                  )}
              </p>
            )}
            {g.id === 'sleeve' && !choices.neck && choices.neckline === 'one_shoulder' && <p className="muted small">A one-shoulder bodice is sleeveless.</p>}
            {g.id === 'peplum' && (choices.length !== 'waist' || (choices.dropCm !== undefined && choices.dropCm >= 3)) && <p className="muted small">A peplum sits on a waist-length bodice.</p>}
            {g.id === 'structure' && !top && <p className="muted small">Boning and a shirred back need a strapless, sweetheart or cami top.</p>}
            {g.id === 'structure' && isStrapless(choices.neckline) && <p className="muted small">A strapless bodice needs something to hold it up: boning, or a shirred back.</p>}
            {g.id === 'structure' && valid.structure === 'shirred' && (
              <p className="muted small">The back is cut {SHIRR.ratio} times as wide as it sits and shirred with rows of elastic thread, so the top pulls on with no zip. The front stays smooth, lined to itself.</p>
            )}
            {g.id === 'structure' && boned && <p className="muted small">Boned bodices are fitted and waist length, with the shaping in princess panels.</p>}
            {g.id === 'sleeve' && top && <p className="muted small">Sleeves need shoulders, so they go with the higher necklines.</p>}
            {g.id === 'princess' && choices.darts !== 'bust_waist' && <p className="muted small">Princess seams carry the bust and waist darts, so they need both.</p>}
            {g.id === 'collar' && choices.neck && <p className="muted small">Collars sit on the named necklines, not a drawn one.</p>}
            {g.id === 'collar' && !choices.neck && choices.neckline !== 'crew' && <p className="muted small">Collars sit on a crew neck (a Peter Pan on a scoop neck too, a pussy bow on a V).</p>}
            {g.id === 'collar' && detail.back !== 'plain' && <p className="muted small">A collar goes round the back neck, so it needs a plain back.</p>}
            {g.id === 'back' && ['scoop', 'v', 'keyhole'].map((b) => backBlocked(choices, b as BackNeck)).find(Boolean) && (
              <p className="muted small">{['scoop', 'v', 'keyhole'].map((b) => backBlocked(choices, b as BackNeck)).find(Boolean)}</p>
            )}
            {g.id === 'collar' && !choices.neck && choices.neckline === 'crew' && detail.closure !== 'front_buttons' && <p className="muted small">A shirt collar needs the front buttons.</p>}
            {g.id === 'darts' && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted bodice needs bust and waist darts.' : 'Choose a relaxed fit to go without darts.'}</p>
            )}
          </Group>
        ))}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the bodice</p>
            <FinishChoices
              garment="bodice"
              finish={finish}
              onFinish={onFinish}
              sleeved={chosen.length !== 'none'}
              edgeIds={boned ? ['lined'] : top ? ['binding', 'lined'] : undefined}
              edgeLegend={top ? 'Top edge' : undefined}
            />
          </TabPanel>
        )}
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={bodiceFabricMetres(draft, sleeve)} advice={bodiceFabrics(valid)} fabric={fabric}>
              <FabricSwatches finish={finish} onFinish={onFinish} garment="bodice" details />
            </FabricCard>
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch
          look={view === 'pattern' ? 'pattern' : 'garment'}
          onLook={(l) => {
            setView(l === 'pattern' ? 'pattern' : 'sketch');
            setDrawing(false);
          }}
        />
        <div className="row between wrap">
          {view !== 'pattern' && draft ? (
            <GarmentViews
              views={garmentViews.filter(([id]) => (id === 'round' ? !!round : id === 'flat' ? !!flat : true))}
              view={view === 'sketch' ? side : view}
              onView={(v) => {
                if (v === 'round' || v === 'flat') setView(v);
                else {
                  setSide(v);
                  setView('sketch');
                }
                setDrawing(false);
              }}
            />
          ) : canFit ? (
            <FitSwitch on={fit} onChange={setFit} />
          ) : (
            <span />
          )}
          {view === 'sketch' && draft &&
            (drawing ? (
              <button type="button" className="ghost on" aria-pressed="true" onClick={() => setDrawing(false)}>
                Done
              </button>
            ) : top ? (
              <button type="button" className="link small" onClick={() => setOnForm(choices)}>
                Draw on your form
              </button>
            ) : (
              <DrawMenu>
                <button type="button" onClick={() => setOnForm(choices)}>
                  Draw on your form
                </button>
                <button type="button" onClick={() => setDrawing(true)}>
                  Draw neck
                </button>
              </DrawMenu>
            ))}
        </div>
        <div className="preview">
          <DemoButton demo="style" />
          {error && <p className="msg error">{error}</p>}
          {draft && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
            <BodiceShape
              draft={draft}
              m={m}
              choices={choices}
              side={side}
              drawing={drawing}
              sleeve={sleeve}
              arms={formArm}
              label={`${title}, ${side} view. Drag the hem to change the length, or the side to change the fit.`}
              onLive={onChoices}
              onDone={(before, after) => change(after, before)}
            />
            </GarmentFabric>
          )}
          {round && view === 'round' && <AllRound round={round} m={values} fabric={fabric} striped={matchKind(fabric)} label={`The ${title} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {draft && sheet && view === 'pattern' && !(fit && canFit) && (
            <PatternPane><PatternPreview paper sheet={sheet} play={play} names={pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} /></PatternPane>
          )}
          {view === 'pattern' && fit && canFit && <EaseMapView views={easeMap!} label={`The fit of the ${title}, on its pattern pieces`} />}
          <UndoToast undo={undoer} />
        </div>
        {view === 'sketch' && (
          <p className={drawing ? 'muted small keep' : 'muted small'}>
            {drawing
              ? side === 'front'
                ? 'Draw the neckline across the front, from the shoulder down to where you want it. Both sides match, and it’s smoothed into a curve that sews.'
                : 'Draw down the back to set how low the back neckline goes.'
              : hip
                ? 'Drag the hem up or down for length, or the side out and in for a looser or closer fit.'
                : 'Drag the side out and in for a looser or closer fit.'}
            {chosen.length !== 'none' ? ' Sleeves show on the flat.' : ''}
          </p>
        )}
        {view === 'flat' && <p className="muted small">The technical flat, front and back, drawn to scale.</p>}
        {view === 'pattern' && draft && (
          <div className="row between wrap">
            {!(fit && canFit) && (
              <button type="button" className="ghost" onClick={() => setPlay(play + 1)}>
                Watch it draft
              </button>
            )}
          </div>
        )}
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {friendly(w)}
          </p>
        ))}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <PiecesList pieces={pieces} />
        {draft && <FabricSummary metres={bodiceFabricMetres(draft, sleeve)} fabric={fabric} />}
        <p className="muted small">
          {detail.closure === 'front_buttons'
            ? `Buttons down the centre front${draft?.buttons ? ` (${draft.buttons.count})` : ''}, with front facings.`
            : draft?.wrap
              ? `The fronts cross over and tie at the waist, with no zip: the two fronts are one piece cut as a pair, and the back is cut on the fold. Ties ${draft.wrap.ties.outer} cm and ${draft.wrap.ties.inner} cm.`
            : draft?.drape?.kind === 'one_shoulder'
              ? `With a zip in the ${zipSide(draft)} side seam.`
              : 'With a centre back zip.'}{' '}
          {chosen.length === 'none'
            ? 'Sleeveless.'
            : 'The sleeves are drafted to fit your armholes, with their ease set where a tailor sets it.'}
          {draft?.peplum ? ` A ${draft.peplum.kind} peplum, ${draft.peplum.depthCm} cm deep.` : ''}
          {boned ? ' Boned like a corset: each panel is cut again from coutil and from lining, with boning over every seam and a grosgrain waist stay inside.' : ''}
          {choices.neckline === 'cami' ? ' The rouleau straps are given as measurements on the pattern.' : ''}
          {!boned && !draped && (detail.princess !== 'none' || detail.bustDart !== 'side') ? ' The shaping is moved the way a pattern cutter does it: the garment sews up to exactly the same fit.' : ''}
        </p>
        <SummaryActions ready={!!draft} onNext={onNext} saveState={saveState} onSave={onSave} onAccount={onAccount} onEditMeasurements={onEditMeasurements} />
      </aside>
    </StyleLayout>
  );
}
