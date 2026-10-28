import { matchKind } from '../engine/prints';
import { BELTS, Belt, beltAllowed, beltPieces, dressBelt } from '../engine/belt';
import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { isTop } from '../engine/corset';
import { BUTTONS_STOP_ABOVE_HEM, buttonsOnSkirt, fromSeam, noSeamAllowed } from '../engine/dress';
import type { DressDraft, DressMeasurements, WaistSeam } from '../engine/dress';
import { wrapSkirtAllowed } from '../engine/wrapSkirt';
import { SLIT_PLACES, SlitPlace, slitAllowed } from '../engine/slit';
import { NO_SLIT, SlitSlider } from '../ui/SlitSlider';
import { dressFlat, wornLines, wornShapes } from '../engine/flat';
import { SHAPES_FOR_LENGTH, SleeveDraft, SleeveMeasurements, needsArms } from '../engine/sleeve';
import { readBodiceSleeve, sleeveRange } from '../ui/formSleeves';
import { readCollar, readFront } from '../ui/formCollar';
import { readFullness, readSkirtPocket, readSlit, skirtHalf, slitLines } from '../ui/formSkirt';
import { SleeveSlider } from '../ui/SleeveSlider';
import { SLEEVE_CUTS, sleeveCutBlocked } from '../engine/sleeveCut';
import { Cuff, cuffAllowed, cuffShown } from '../engine/cuffs';
import { BODICE_GROUPS, BodiceChoices, DRESS_CUTS, WAIST_SEAM_GROUP, DARTS_FOR_FIT, DressChoices, detailAllowed, sleeveOf, topAllowed, validDetails } from '../garments';
import type { MeasurementValues } from '../measurements';
import { UndoToast, useUndo } from '../ui/useUndo';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { TechFlatView } from '../ui/TechFlatView';
import { AllRound } from '../ui/AllRound';
import { roundDress } from '../engine/allRound';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { DETAIL_GROUPS, GROUPS, pocketsAllowed } from '../skirtChoices';
import { cutAllowed, validCut } from '../engine/slip';
import { describePattern } from './describe';
import { FABRIC, Group, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';

import { Mode, ProTool, shows } from '../mode';
import { EaseMapView } from '../ui/EaseMapView';
import { FitSwitch, GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import { MyFabric, dressFabrics, fabricEase } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../savedWork';
import { GODET_OPTIONS, VOLUME_OPTIONS, layoutExtras, setVolume, volumeAllowed, volumeOf } from '../engine/skirtVolume';
import { isDraped, zipSide } from '../engine/drape';
import { LENGTHS, Length, NoSeam, lengthRange } from '../engine/skirt';
import type { BodiceMeasurements } from '../engine/bodice';
import type { SkirtMeasurements } from '../engine/skirt';
import { DrawOnForm, formWidth } from '../ui/DrawOnForm';
import { FormSketch } from '../ui/FormSketch';
import { armFor } from '../ui/DrawOnForm';
import { orSeam, readSeamLine } from '../ui/formSeams';
import { orNeckline, readUnevenNeckline, unevenNecklineLines } from '../ui/formBodice';
import { REPLACES } from './BodiceStyleScreen';
import { FormLine, bodiceLines, landmarks, readDrape, readDressSide, readFit, readNeckline, readSeam, readSkirtHem, readWaistSeam, seamWords, skirtLines, standingBand } from '../ui/formLines';
import { BANDS, isBandCollar } from '../engine/collar';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { DemoButton } from '../ui/DemoButton';
import { PiecesList, SummaryActions, formViews } from '../ui/StyleSummary';

/** Moving the shaping is a pro tool, so these groups sit on the Pro tab. */
const PRO_GROUPS: string[] = ['princess', 'bustDart'];

import { dressFabricMetres } from '../fabricAmounts';
import { dressSpec } from '../engine/spec';
import { FinishedTable, finishedLines } from '../ui/FinishedTable';

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
  choices: DressChoices;
  onChoices: (c: DressChoices) => void;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: DressDraft;
  sleeve?: SleeveDraft;
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

type Option = { id: string; label: string; options: [string, string][] };

/** A dress cut in one: its hem, and its side seams on from the waist, out over the hip, to the hem. */
const noSeamLines = (draft: DressDraft, side: 'front' | 'back') => {
  const { waistSide, hemSide, hemCentre } = side === 'front' ? draft.bodice.front : draft.bodice.back;
  const edges = landmarks(draft.bodice, side).edges.filter((e) => e.tag === 'side' && e.b.y > waistSide.y - 0.5);
  const seam = edges.length ? [edges[0].a, ...edges.map((e) => e.b)] : [waistSide, hemSide];
  return {
    hem: [[{ x: -hemSide.x, y: hemCentre.y }, { x: hemSide.x, y: hemCentre.y }]],
    fit: [seam, seam.map((q) => ({ x: -q.x, y: q.y }))],
  };
};

/**
 * Style the dress: one fit for the whole dress, the bodice's neckline, darts and sleeves, and the
 * skirt's shape and length. The preview is the technical flat, so the skirt is seen hanging from the
 * bodice with its darts running on through the waist seam.
 */
/** The dress's skirt choices on one tab of their own. */
const DRESS_SECTIONS: Record<string, string> = { Cut: 'Skirt & length', Skirt: 'Skirt & length', Length: 'Skirt & length', Hem: 'Skirt & length', Slit: 'Skirt & length', 'Skirt details': 'Skirt & length', Pockets: 'Skirt & length', Belt: 'Skirt & length' };

export function DressStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const can = (t: ProTool) => shows(mode, t);
  const [view, setView] = useState<'sketch' | 'flat' | 'round' | 'pattern'>('sketch');
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<DressChoices>();
  const [fit, setFit] = useState(false);
  const canFit = !!easeMap?.length && can('easeMap');
  // The bodice's pieces (with its collar and any button facings), the sleeves, then the skirt's.
  const pieces = useMemo(() => {
    if (!draft) return [];
    const skirt = new Set(draft.skirt.pieces.map((pc) => pc.name));
    return [...draft.pieces.filter((pc) => !skirt.has(pc.name)), ...(sleeve?.pieces ?? []), ...draft.pieces.filter((pc) => skirt.has(pc.name)), ...beltPieces(dressBelt(choices.skirt.belt, draft), 1.5)];
  }, [draft, sleeve, choices.skirt.belt]);
  const sheet = useMemo(() => (pieces.length ? layout(pieces, '', []) : undefined), [pieces]);
  const flat = useMemo(() => (draft ? dressFlat(draft, 'binding', { sleeve, belt: dressBelt(choices.skirt.belt, draft) }) : undefined), [draft, sleeve, choices.skirt]);
  const title = describePattern(choices);
  const round = useMemo(() => (draft ? roundDress(draft, values, sleeve) : undefined), [draft, values, sleeve]);
  const arms = !needsArms(values);
  const chosen = sleeveOf(choices.bodice);
  // A shirt dress: the buttons run on down the skirt, so it needs a skirt that can carry them.
  // A sheath or a shift is cut in one from shoulder to hem, so it has no skirt shape of its own.
  const cutOk = noSeamAllowed(choices.bodice);
  const noSeam: NoSeam | undefined = cutOk ? choices.skirt.noSeam : undefined;
  const buttonsOk = !noSeam && buttonsOnSkirt(choices.skirt);
  // A wrap dress: its skirt wraps too, so it needs a skirt that can (straight or A-line, nothing added).
  const wrapOk = !noSeam && wrapSkirtAllowed(choices.skirt);
  const closure: BodiceChoices['closure'] =
    choices.bodice.closure === 'front_buttons' && buttonsOk ? 'front_buttons' : choices.bodice.closure === 'wrap' && wrapOk ? 'wrap' : 'back_zip';
  const buttoned = closure === 'front_buttons';
  const wrapped = closure === 'wrap';
  const valid = validDetails({ ...choices.bodice, fit: choices.fit, length: 'waist', closure }, 'dress');
  const boned = valid.structure === 'boned';
  const top = isTop(choices.bodice.neckline);
  const extra = fabricEase(fabric, 'dress');
  // A draped neckline is its own shaping: no princess seams, moved dart or collar.
  const draped = isDraped(choices.bodice);

  // A boned or draped bodice is drafted to the natural waist, so it keeps its waist seam there.
  // A shirt dress or a wrap buttons or ties at the waist, so its seam stays there.
  const canDrop = !boned && !draped;
  // Raising the seam cuts a plain front and back across: the engine says how high this bodice can go.
  const canRaise = canDrop && (draft?.seamRange.min ?? 0) < 0;
  const ownSeam = canDrop && choices.waistSeamCm !== undefined;
  const seam = !canDrop ? 'natural' : ownSeam ? '' : (choices.waistSeam ?? 'natural');

  const groups: Option[] = [
    { id: 'fit', label: 'Fit', options: GROUPS[0].options },
    ...(noSeam ? [] : [WAIST_SEAM_GROUP]),
    ...BODICE_GROUPS.filter(
      (g) =>
        g.id === 'neckline' ||
        g.id === 'darts' ||
        (g.id === 'princess' && !boned && !draped && (can('dartMoves') || (choices.bodice.princess ?? 'none') !== 'none')) ||
        (g.id === 'bustDart' &&
          choices.bodice.darts !== 'none' &&
          (choices.bodice.princess ?? 'none') === 'none' &&
          !boned &&
          !draped &&
          (can('dartMoves') || (choices.bodice.bustDart ?? 'side') !== 'side')) ||
        (g.id === 'closure' && !top && !draped) ||
        (g.id === 'collar' && !top && !draped) ||
        (g.id === 'back' && !top && !draped) ||
        (g.id === 'structure' && !draped) ||
        g.id === 'sleeve' ||
        // A kimono sleeve is cut on at its named length, with no shape or cuff of its own.
        (g.id === 'sleeveShape' && chosen.length !== 'none' && chosen.cut !== 'kimono') ||
        (g.id === 'sleeveCut' && chosen.length !== 'none') ||
        (g.id === 'sleeveCuff' && cuffShown(chosen) && chosen.cut !== 'kimono'),
    ).map((g) => ({
      id: g.id,
      label: g.label,
      options: g.options as [string, string][],
    })),
    { id: 'noSeam', label: 'Cut', options: DRESS_CUTS },
    ...(noSeam
      ? []
      : [
          { id: 'silhouette', label: 'Skirt', options: GROUPS[1].options },
        ]),
    ...(noSeam || wrapped
      ? []
      : [
          // The dress's zip runs down the centre back, so its skirt can't be cut whole for a diagonal hem.
          { id: 'asymHem', label: 'Hem', options: GROUPS[3].options.filter(([id]) => id !== 'diagonal') as [string, string][] },
          { id: 'slit', label: 'Slit', options: SLIT_PLACES },
          { id: 'volume', label: 'Skirt details', options: VOLUME_OPTIONS },
          { id: 'pockets', label: 'Pockets', options: DETAIL_GROUPS[1].options },
        ]),
    // A wrap ties already, so it takes no sash.
    ...(wrapped ? [] : [{ id: 'belt', label: 'Belt', options: BELTS as [string, string][] }]),
  ];

  const value = (id: string) =>
    id === 'noSeam'
      ? noSeam ?? 'seam'
      : id === 'slit'
      ? draft?.skirt.slit?.at ?? 'none'
      : id === 'volume'
      ? volumeOf(choices.skirt)
      : id === 'fit'
      ? choices.fit
      : id === 'waistSeam'
      ? seam
      : id === 'asymHem'
        ? choices.skirt.asymHem ?? 'none'
      : id === 'silhouette' || id === 'length'
        ? choices.skirt[id]
        : id === 'pockets'
          ? (choices.skirt.pockets ?? 'none')
          : id === 'belt'
            ? (choices.skirt.belt ?? 'none')
          : id === 'sleeve'
            ? // Set on the slider, no named length is picked, as with the bodice.
              chosen.cm !== undefined ? '' : chosen.length
            : id === 'sleeveShape'
              ? chosen.shape
              : id === 'sleeveCut'
                ? (chosen.cut ?? 'set_in')
              : id === 'sleeveCuff'
                ? (chosen.cuff ?? 'none')
              : id === 'bustDart'
                ? choices.bodice.bustDart ?? 'side'
                : id === 'princess'
                  ? choices.bodice.princess ?? 'none'
                  : id === 'collar'
                    ? choices.bodice.collar ?? 'none'
                  : id === 'back'
                    ? valid.back ?? 'plain'
                  : id === 'closure'
                    ? closure
                    : id === 'structure'
                      ? valid.structure ?? 'none'
                      : choices.bodice[id as keyof BodiceChoices];

  // The dress's fit also sets the skirt's ease, so it stays free; a boned bodice keeps its own close fit.
  const allowed = (id: string, opt: string) => (id === 'fit' || topAllowed(choices.bodice, id, opt)) && baseAllowed(id, opt) && cutAllows(id, opt);
  // Cut in one, the dress takes no princess seams, boning, strapless or draped neckline, or buttons.
  const cutAllows = (id: string, opt: string) =>
    id === 'noSeam'
      ? opt === 'seam' || (cutOk && !buttoned && !wrapped)
      : !noSeam || noSeamAllowed({ ...choices.bodice, [id]: opt }) && (id !== 'closure' || opt === 'back_zip');
  const baseAllowed = (id: string, opt: string) =>
    id === 'waistSeam'
      ? opt === 'natural' || (opt === 'empire' || opt === 'raised' ? canRaise : canDrop)
      : id === 'slit'
      ? // A shirt dress opens down the front and its back is cut whole: only the side can take a slit.
        opt === 'none' || (slitAllowed(choices.skirt) && (!buttoned || opt === 'side'))
      : id === 'belt'
      ? beltAllowed(opt as Belt, { wrap: wrapped })
      : id === 'volume'
      ? volumeAllowed(choices.skirt, opt as Parameters<typeof volumeAllowed>[1]) && (!buttoned || opt === 'none')
      : id === 'darts'
      ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts'])
      : id === 'sleeve'
        ? (opt === 'none' || arms) && detailAllowed(choices.bodice, 'sleeve', opt, 'dress')
        : id === 'sleeveShape'
          ? SHAPES_FOR_LENGTH[chosen.length].includes(opt as NonNullable<BodiceChoices['sleeveShape']>)
          : id === 'sleeveCuff'
            ? cuffAllowed(opt as Cuff, chosen.length, chosen.shape)
          : id === 'sleeveCut'
            ? detailAllowed({ ...choices.bodice, length: 'waist', closure }, 'sleeveCut', opt, 'dress')
          : id === 'princess' || id === 'bustDart' || id === 'collar' || id === 'back' || id === 'structure' || id === 'closure'
            ? detailAllowed({ ...choices.bodice, length: 'waist', closure }, id, opt, 'dress') && (id !== 'closure' || (opt === 'front_buttons' ? buttonsOk : opt === 'wrap' ? wrapOk : true))
            : id === 'silhouette' || id === 'length' || id === 'asymHem'
              ? cutAllowed(choices.skirt, id, opt, 'dress') && (!buttoned || buttonsOnSkirt({ ...choices.skirt, [id]: opt })) && (!wrapped || wrapSkirtAllowed({ ...choices.skirt, [id]: opt }))
              : true;

  const choose = (id: string, opt: string) => {
    if (id === 'waistSeam') {
      const { waistSeam: _w, waistSeamCm: _c, ...rest } = choices;
      onChoices(opt === 'natural' ? rest : { ...rest, waistSeam: opt as WaistSeam });
      return;
    }
    if (id === 'noSeam') {
      const { noSeam: _n, ...skirt } = choices.skirt;
      onChoices({ ...choices, skirt: opt === 'seam' ? skirt : { ...skirt, noSeam: opt as NoSeam } });
      return;
    }
    if (id === 'slit') {
      onChoices({ ...choices, skirt: { ...choices.skirt, slit: opt as SlitPlace, slitCm: undefined } });
      return;
    }
    if (id === 'silhouette' || id === 'length' || id === 'asymHem' || id === 'pockets') {
      // The dress skirt is styled by its chips: no era look, photo shape or hand-drawn changes.
      // Pleats, godets or a flounce stay; one the new shape, length or hem doesn't take falls back to none.
      const { fit, silhouette, length, asymHem, pleats, godets, flounce, pockets, slit, slitCm, belt } = choices.skirt;
      onChoices({ ...choices, skirt: validCut({ fit, silhouette, length, ...(asymHem ? { asymHem } : {}), ...(pockets ? { pockets } : {}), ...(belt ? { belt } : {}), ...(slit ? { slit } : {}), ...(slitCm !== undefined ? { slitCm } : {}), pleats, godets, flounce, [id]: opt }) });
      return;
    }
    if (id === 'belt') {
      const { belt: _b, ...skirt } = choices.skirt;
      onChoices({ ...choices, skirt: opt === 'none' ? skirt : { ...skirt, belt: opt as Belt } });
      return;
    }
    if (id === 'volume') {
      onChoices({ ...choices, skirt: setVolume(choices.skirt, opt as Parameters<typeof setVolume>[1]) });
      return;
    }
    const fit = id === 'fit' ? (opt as DressChoices['fit']) : choices.fit;
    const bodice = { ...choices.bodice, fit, ...(id === 'fit' ? {} : { [id]: opt }) } as BodiceChoices;
    // A chip lets go of what was drawn on the form for it.
    for (const k of REPLACES[id] ?? []) delete bodice[k];
    // A tighter fit needs more shaping, and each sleeve length allows only some shapes.
    const darts = DARTS_FOR_FIT[fit].includes(bodice.darts) ? bodice.darts : 'bust_waist';
    // A boned or draped bodice, a button front or a wrap takes the waist seam back to the natural waist.
    const next = validDetails({ ...bodice, darts, length: 'waist', closure: bodice.closure ?? 'back_zip', sleeveShape: sleeveOf(bodice).shape }, 'dress');
    const { waistSeam: _w, waistSeamCm: _c, ...plain } = choices;
    const keepsDrop = next.structure !== 'boned' && !isDraped(next) && (next.closure ?? 'back_zip') === 'back_zip';
    onChoices({ ...(keepsDrop ? choices : plain), fit, bodice: next, skirt: { ...choices.skirt, fit } });
  };

  const mv = values as BodiceMeasurements & SkirtMeasurements;
  // The length is set on the drawing, with the hem dot and the lengths named beside the legs (Cat, 2026-10-24).
  const hem = {
    name: 'Dress length',
    marks: GROUPS[2].options.filter(([id]) => allowed('length', id)).map(([id, label]) => ({ id, label, y: (draft ? landmarks(draft.bodice).waistY : 0) + LENGTHS[id as Length](mv) })),
    value: choices.skirt.length,
    onPick: (id: string) => choose('length', id),
  };
  const waistY = draft ? landmarks(draft.bodice).waistY : 0;
  // The pattern's finished widths at the bust, waist and hip: the drawing cinches only as much as the pattern does
  // (Cat, 2026-10-27).
  const sewn = useMemo(
    () => (draft ? [{ y: landmarks(draft.bodice).apex.y, half: draft.finishedBust / 4 }, { y: waistY, half: draft.finishedWaist / 4 }, { y: waistY + (mv.waist_to_hip ?? 20), half: draft.finishedHip / 4 }] : undefined),
    [draft, waistY, mv.waist_to_hip],
  );
  // A dropped waist: the skirt's lines and lengths are read from the seam at the high hip.
  const seamY = waistY + (draft?.seamDrop ?? 0);
  const sm = useMemo(() => fromSeam(mv, draft?.seamDrop ?? 0), [mv, draft?.seamDrop]);
  const formBody = useMemo(() => (draft ? formWidth(draft.bodice, mv) : undefined), [draft, mv]);
  const clothShapes = useMemo(() => (flat ? wornShapes(flat) : undefined), [flat]);
  const flatLines = useMemo(() => (flat ? wornLines(flat) : undefined), [flat]);
  // The arms, for the sleeves to hang on: from the arm measurements, once they are given.
  const formArm = useMemo(() => {
    if (!draft || !sleeve || needsArms(values)) return undefined;
    const { shoulderTip, underarm } = landmarks(draft.bodice);
    return armFor(shoulderTip, underarm, { arm_length: values.arm_length!, upper_arm: values.upper_arm!, wrist: values.wrist });
  }, [draft, sleeve, values]);
  // On the form to draw on, the arms show once they are measured, so a sleeve can be drawn on a sleeveless dress too.
  const drawArm = useMemo(() => {
    if (!draft || needsArms(values)) return undefined;
    const { shoulderTip, underarm } = landmarks(draft.bodice);
    return armFor(shoulderTip, underarm, { arm_length: values.arm_length!, upper_arm: values.upper_arm!, wrist: values.wrist });
  }, [draft, values]);
  const sleeves = useMemo(() => (draft && onForm ? sleeveRange(draft.bodice, mv as unknown as BodiceMeasurements & SleeveMeasurements, choices.fit) : undefined), [draft, onForm, mv, choices.fit]);
  const formLines = useMemo(() => {
    if (!draft) return {};
    const uneven = unevenNecklineLines(draft.bodice);
    const bodice = bodiceLines(draft.bodice, 'front');
    // A mock or funnel neck, or a mandarin, stands up from the neckline.
    const band = draft.bodice.collar;
    const collar = isBandCollar(band) && bodice.neckline[0] ? standingBand(bodice.neckline[0], BANDS[band].height, band === 'funnel' ? 1.12 : band === 'mock' ? 0.96 : 1) : [];
    const extras = { ...(uneven.length ? { neckline: uneven } : {}), ...(collar.length ? { collar } : {}) };
    // Cut in one, the dress's own hem and side seams run on from the bodice's.
    if (draft.noSeam) {
      const skirt = noSeamLines(draft, 'front');
      return { ...bodice, hem: skirt.hem, fit: [...(bodice.fit ?? []), ...(skirt.fit ?? [])], ...extras };
    }
    const skirt = skirtLines(draft.skirt, choices.skirt, sm, 'front', seamY);
    // The side runs from the underarm to the end of the waist seam, wherever it is, and on to the skirt.
    const seamEnds = bodice.hem[0] ?? [];
    const end = (x: number) => seamEnds.find((q) => Math.sign(q.x) === Math.sign(x));
    const sides = (bodice.fit ?? []).map((run) => {
      const at = end(run[0].x);
      const hip = skirt.fit?.find((r) => Math.sign(r[0].x) === Math.sign(run[0].x));
      return at ? [run[0], at, ...(hip ?? [])] : run;
    });
    return { ...bodice, waist: bodice.hem, hem: skirt.hem, fit: sides, ...extras };
  }, [draft, choices.skirt, sm, seamY]);

  if (onForm && draft) {
    // The bodice's lines are read at the dress's own fit and length; the hem is the skirt's.
    const asBodice: BodiceChoices = { ...choices.bodice, fit: choices.fit, length: 'waist', closure };
    return (
      <GarmentFabric fabric={fabric}>
      <DrawOnForm<DressChoices>
        allRound={round ? { round, m: values, fabric, striped: matchKind(fabric) } : undefined}
        body={formWidth(draft.bodice, mv)}
        m={mv}
        legs
        cloth={clothShapes}
        arms={drawArm}
        sleeve={formArm ? sleeve : undefined}
        underarmY={landmarks(draft.bodice).underarm.y}
        sewn={sewn}
        bottom={waistY + lengthRange(mv).max + 4}
        kinds={[
          ['neckline', 'Neckline'],
          ['seam', 'Seam'],
          ['drape', 'Drape'],
          ...(drawArm && sleeves ? ([['sleeve', 'Sleeve']] as [FormLine, string][]) : []),
          ['collar', 'Collar'],
          ['front', 'Front'],
          ['fit', 'Side'],
          ['hem', 'Hem'],
          ...(canDrop ? ([['waist', 'Waist seam']] as [FormLine, string][]) : []),
          ...(draft.noSeam ? [] : ([['slit', 'Slit'], ['fullness', 'Fullness'], ['pocket', 'Pocket']] as [FormLine, string][])),
        ]}
        help={{
          ...(draft.noSeam ? {} : { fit: 'Draw down the side: closer beside the bust for a closer fit, and out at the hem to flare the skirt.' }),
          pocket: 'Draw a short line down the side seam of the skirt, below the waist, for in-seam pockets.',
          collar: 'Draw the collar round the neck: standing up above the neckline for a band, lying flat and rounded for a Peter Pan, coming to points for a shirt collar, hanging down at the centre for a bow.',
          front: 'Draw down the front: straight down the centre for a shirt dress buttoned to the hem, or from the neck crossing to the side at the waist for a wrap. On the back, down the centre for the zip.',
        }}
        lines={(side) => {
          const uneven = side === 'front' ? unevenNecklineLines(draft.bodice) : [];
          const top = bodiceLines(draft.bodice, side);
          if (draft.noSeam) return { ...top, hem: noSeamLines(draft, side).hem, ...(uneven.length ? { neckline: uneven } : {}) };
          return { ...top, waist: top.hem, hem: skirtLines(draft.skirt, choices.skirt, sm, side, seamY).hem, ...slitLines(draft.skirt, choices.skirt, sm, seamY, side), ...(uneven.length ? { neckline: uneven } : {}) };
        }}
        choices={choices}
        onChoices={setChoices}
        read={(kind, side, stroke) => {
          if (kind === 'waist') {
            const r = readWaistSeam(stroke, waistY, draft.seamRange);
            if (r.choices === undefined) return { said: r.said };
            const { waistSeam: _w, ...rest } = choices;
            return { said: r.said, choices: { ...rest, waistSeamCm: r.choices } };
          }
          if (kind === 'hem') {
            const r = readSkirtHem(stroke, seamY, draft.skirt, sm, choices.skirt, side, 'dress');
            return { said: r.said, choices: r.choices && { ...choices, skirt: r.choices } };
          }
          if (kind === 'slit' || kind === 'fullness' || kind === 'pocket') {
            const half = skirtHalf(draft.skirt, choices.skirt, sm, seamY);
            const r =
              kind === 'slit'
                ? readSlit(stroke, seamY, draft.skirt.lengthCm, sm, choices.skirt, side, half, (at) => !buttoned || at === 'side')
                : kind === 'fullness'
                  ? buttoned
                    ? { said: 'A dress buttoned down the front keeps a plain skirt, so the buttons run straight to the hem.' }
                    : readFullness(stroke, seamY, draft.skirt.lengthCm, choices.skirt)
                  : readSkirtPocket(stroke, seamY, sm, choices.skirt, half, pocketsAllowed(choices.skirt));
            return { said: r.said, choices: r.choices && { ...choices, skirt: validCut(r.choices) } };
          }
          if (kind === 'collar' || kind === 'front') {
            const r =
              kind === 'collar'
                ? readCollar(stroke, draft.bodice, asBodice, 'dress')
                : readFront(stroke, draft.bodice, asBodice, 'dress', side, (cl) => (cl === 'front_buttons' ? buttonsOk : cl === 'wrap' ? wrapOk : true));
            return { said: r.said, choices: r.choices && { ...choices, bodice: r.choices } };
          }
          if (kind === 'sleeve' && drawArm && sleeves) {
            const r = readBodiceSleeve(stroke, draft.bodice, drawArm, sleeves, asBodice, 'dress');
            return { said: r.said, choices: r.choices && { ...choices, bodice: r.choices } };
          }
          if (kind === 'fit') {
            if (draft.noSeam) {
              const r = readFit(stroke, draft.bodice, mv, asBodice);
              return { said: r.said, choices: r.choices && { ...choices, fit: r.choices.fit, bodice: r.choices, skirt: { ...choices.skirt, fit: r.choices.fit } } };
            }
            // Out at the hem the side line flares the skirt, as on a skirt.
            const r = readDressSide(stroke, draft.bodice, mv, asBodice, seamY, draft.skirt, sm, choices.skirt);
            return { said: r.said, choices: r.choices && { ...choices, fit: r.choices.bodice.fit, bodice: r.choices.bodice, skirt: r.choices.skirt } };
          }
          const r =
            kind === 'neckline'
              ? orNeckline(readUnevenNeckline(stroke, draft.bodice, asBodice, 'dress', side), () => readNeckline(stroke, draft.bodice, asBodice, 'dress', side))
              : kind === 'seam'
                ? orSeam(readSeamLine(stroke, draft.bodice, asBodice, 'dress', side), () => readSeam(stroke, draft.bodice, asBodice, 'dress', side))
                : readDrape(stroke, draft.bodice, asBodice, 'dress');
          return { said: r.said, choices: r.choices && { ...choices, bodice: r.choices } };
        }}
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
      sections={DRESS_SECTIONS}
      label="your dress"
      garment="dress"
      name={title}
      metres={draft ? dressFabricMetres([...pieces, ...layoutExtras(draft.skirt)]) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
      finished={
        draft && (
          <FinishedTable lines={finishedLines(dressSpec(values as DressMeasurements, draft, sleeve))} noun="Dress">
            {(boned || extra.bust > 0) && (
              <p className="muted small">
                {boned ? 'Held in: the boned bodice is cut smaller than you on purpose, so the boning holds you. ' : ''}
                {extra.bust ? `The ease includes ${extra.bust} cm at the bust and ${extra.waist} cm at the waist for your heavy fabric.` : ''}
              </p>
            )}
          </FinishedTable>
        )
      }
    >
      <section className="card numbered" aria-labelledby="opts">
        {groups.map((g) => (
          <Group key={g.id} label={g.label} tab={PRO_GROUPS.includes(g.id) ? PRO : undefined}>
            <div className={chipsClass((['noSeam', 'silhouette', 'length', 'asymHem', 'slit'].includes(g.id) ? 'skirt' : 'bodice'), g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={value(g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={value(g.id) === id}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose(g.id, id)}
                >
                  <ChoicePic set={(['noSeam', 'silhouette', 'length', 'asymHem', 'slit'].includes(g.id) ? 'skirt' : 'bodice')} group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            <Explain set={['noSeam', 'silhouette', 'length', 'asymHem', 'slit', 'volume', 'pockets', 'belt'].includes(g.id) ? 'skirt' : 'bodice'} group={g.id} options={g.options} pick={value(g.id)} />
            {g.id === 'sleeve' && !arms && (
              <p className="muted small">
                For sleeves, add your arm length, upper arm and wrist.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'sleeveCut' && SLEEVE_CUTS.map(([c]) => sleeveCutBlocked({ ...choices.bodice, closure }, c)).find(Boolean) && (
              <p className="muted small">{SLEEVE_CUTS.map(([c]) => sleeveCutBlocked({ ...choices.bodice, closure }, c)).find(Boolean)}</p>
            )}
            {g.id === 'sleeve' && arms && chosen.cut !== 'kimono' && (
              <SleeveSlider sleeve={sleeve} choices={choices.bodice} onChoices={(c) => onChoices({ ...choices, bodice: validDetails({ ...c, length: 'waist', closure: c.closure ?? 'back_zip' }, 'dress') })} />
            )}
            {g.id === 'slit' && <SlitSlider slit={draft?.skirt.slit} onCm={(slitCm) => onChoices({ ...choices, skirt: { ...choices.skirt, slitCm } })} />}
            {g.id === 'slit' && !slitAllowed(choices.skirt) && <p className="muted small">{NO_SLIT}</p>}
            {g.id === 'volume' && volumeOf(choices.skirt) === 'godets' && (
              <div className="chips">
                {GODET_OPTIONS.map(([n, label]) => (
                  <button key={n} type="button" className={choices.skirt.godets === n ? 'chip on' : 'chip'} aria-pressed={choices.skirt.godets === n} onClick={() => onChoices({ ...choices, skirt: setVolume(choices.skirt, 'godets', n) })}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {g.id === 'volume' &&
              (choices.skirt.silhouette === 'slip' ? (
                <p className="muted small">A bias slip hangs from the hip without pleats, godets, flounces or tiers.</p>
              ) : !volumeAllowed({ ...choices.skirt, asymHem: 'none' }, 'knife') ? (
                <p className="muted small">Pleats, godets, flounces and tiers go on a pencil, straight or A-line skirt.</p>
              ) : choices.skirt.asymHem === 'high_low' ? (
                <p className="muted small">A high-low hem takes godets. Pleats, flounces and tiers need a level hem.</p>
              ) : null)}
            {g.id === 'neckline' && draped && (
              <p className="muted small">
                {choices.bodice.neckline === 'cowl'
                  ? 'The bodice front is cut on the bias and falls in soft folds. It needs a fluid fabric.'
                  : (
                    <>
                    <span className="seg" role="group" aria-label="Which shoulder">
                      {(['left', 'right'] as const).map((sh) => (
                        <button key={sh} type="button" aria-pressed={(choices.bodice.shoulder ?? 'left') === sh} className={(choices.bodice.shoulder ?? 'left') === sh ? 'on' : ''} onClick={() => onChoices({ ...choices, bodice: sh === 'right' ? { ...choices.bodice, shoulder: sh } : (({ shoulder: _s, ...rest }) => rest)(choices.bodice) })}>
                          {sh}
                        </button>
                      ))}
                    </span>{' '}
                      Over your {choices.bodice.shoulder ?? 'left'} shoulder. The dress is sleeveless, with a zip in the {choices.bodice.shoulder === 'right' ? 'left' : 'right'} side seam.
                    </>
                  )}
              </p>
            )}
            {g.id === 'waistSeam' && !canDrop && <p className="muted small">{`A ${boned ? 'boned' : 'draped'} bodice is shaped to the natural waist, so its seam stays there.`}</p>}
            {g.id === 'waistSeam' && canDrop && draft && (
              <div className="seam-height">
                <input
                  type="range"
                  min={Math.floor(draft.seamRange.min)}
                  max={Math.floor(draft.seamRange.max)}
                  step={1}
                  value={Math.round(draft.seamDrop)}
                  aria-label="Waist seam height, in cm below the waist"
                  onChange={(e) => {
                    const { waistSeam: _w, ...rest } = choices;
                    onChoices({ ...rest, waistSeamCm: Number(e.target.value) });
                  }}
                />
                <p className="muted small" aria-live="polite">
                  {seamWords(Math.round(draft.seamDrop), draft.seamRange)}
                  {!canRaise && ' Princess seams or panels keep it at the waist or below.'}
                </p>
              </div>
            )}
            {g.id === 'structure' && !top && <p className="muted small">Boning needs a strapless, sweetheart or cami top.</p>}
            {g.id === 'structure' && choices.bodice.neckline === 'strapless' && <p className="muted small">A strapless dress is always boned: the boning holds it up.</p>}
            {g.id === 'darts' && !boned && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted dress needs bust and waist darts.' : 'Choose a relaxed fit to go without waist darts.'}</p>
            )}
          </Group>
        ))}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the dress</p>
            <FinishChoices
              garment="dress"
              finish={finish}
              onFinish={onFinish}
              sleeved={sleeveOf(choices.bodice).length !== 'none'}
              edgeIds={boned ? ['lined'] : top ? ['binding', 'lined'] : undefined}
              edgeLegend={top ? 'Top edge' : undefined}
            />
          </TabPanel>
        )}
        {(flat || draft) && (
          <TabPanel tab={FABRIC}>
            {draft ? (
              <FabricCard
            metres={dressFabricMetres([...pieces, ...(draft ? layoutExtras(draft.skirt) : [])])}
            advice={dressFabrics({ fit: choices.fit, neckline: choices.bodice.neckline, silhouette: choices.skirt.silhouette, length: choices.skirt.length, structure: valid.structure, asymHem: choices.skirt.asymHem, pleats: choices.skirt.pleats, godets: choices.skirt.godets, flounce: choices.skirt.flounce })}
            fabric={fabric}>
                {flat && <FabricSwatches finish={finish} onFinish={onFinish} garment="dress" details />}
              </FabricCard>
            ) : (
              <FabricSwatches finish={finish} onFinish={onFinish} garment="dress" details />
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
          <div className="row tools">
            <button type="button" className="link small" onClick={() => setOnForm(choices)}>
              Draw on your form
            </button>
          </div>
        </div>
        <div className="preview">
          <DemoButton demo="style" />
          {error && <p className="msg error">{error}</p>}
          {formBody && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <FormSketch body={formBody} m={mv} legs bottom={waistY + lengthRange(mv).max + 4} lines={formLines} cloth={clothShapes} flatLines={flatLines} arms={formArm} sleeve={formArm ? sleeve : undefined} underarmY={draft ? landmarks(draft.bodice).underarm.y : undefined} sewn={sewn} hem={draft ? hem : undefined} label={`The ${title} on your form`} />
            </GarmentFabric>
          )}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {round && view === 'round' && <AllRound round={round} m={values} fabric={fabric} striped={matchKind(fabric)} label={`The ${title} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`} />}
          {sheet && view === 'pattern' && !(fit && canFit) && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for a ${title}`} /></PatternPane>}
          {view === 'pattern' && fit && canFit && <EaseMapView views={easeMap!} label={`The fit of the ${title}, on its pattern pieces`} />}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">
          Drafted to your measurements as you choose.
        </p>
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <PiecesList pieces={pieces}>
          {draft?.skirt.volume?.tiers?.bands.map((b) => (
            <li key={b.name}>
              {b.name}: cut {b.panels}, {b.cutLength} × {b.cutWidth} cm
            </li>
          ))}
        </PiecesList>
        {draft && <FabricSummary metres={dressFabricMetres([...pieces, ...(draft ? layoutExtras(draft.skirt) : [])])} fabric={fabric} />}
        <p className="muted small">
          {draft?.noSeam
            ? `Cut in one with no waist seam: front and back each one piece from the shoulder to the hem${draft.noSeam === 'sheath' ? `, shaped at the waist by darts pointed at both ends${draft.pieces.some((pc) => pc.meta.slitCm) ? ', with a walking slit at the back' : ''}` : ', hanging straight from the bust'}.`
            : choices.skirt.silhouette === 'slip'
            ? 'The skirt is cut on the bias, for a slip dress: it has no darts, its waist seam is drafted to the bodice, and the cloth moulds to the hip.'
            : choices.skirt.silhouette === 'gathered'
              ? `The skirt is cut as straight panels and gathered to the bodice’s ${draft?.seamDrop ? 'seam' : 'waist seam'}, so it needs no darts.`
              : draft?.seamDrop
                ? 'The skirt is drafted to the bodice: the seams are the same length.'
                : 'The skirt is drafted to the bodice: the waist seams are the same length, and the darts meet at the seam in one line.'}{' '}
          {draft?.seamDrop ? 'The waist seam is dropped to the high hip: the bodice skims past your waist and the skirt falls from lower down. ' : ''}
          {wrapped
            ? 'It crosses over at the front and ties at the waist, with no zip: each front is a pair, bodice and skirt, and the back is cut whole.'
            : draft?.skirtButtons
            ? `It buttons down the centre front from the neck, through the waist, to ${BUTTONS_STOP_ABOVE_HEM} cm above the hem, and the back is cut whole.`
            : draft?.zipSide
              ? `One zip opens the ${zipSide(draft.bodice)} side seam from under the arm to below the waist.`
              : `One zip opens the centre back from the ${top ? 'top edge' : 'neck'} to below the ${draft?.seamDrop ? 'seam' : 'waist'}.`}
          {boned ? ' The bodice is boned like a corset, cut again from coutil and lining, with a grosgrain waist stay that carries the skirt.' : ''}
        </p>
        <SummaryActions ready={!!draft} onNext={onNext} saveState={saveState} onSave={onSave} onAccount={onAccount} onEditMeasurements={onEditMeasurements} />
      </aside>
    </StyleLayout>
  );
}
