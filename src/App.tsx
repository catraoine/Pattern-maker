import { useEffect, useMemo, useState } from 'react';
import { canGoBack, goBack, useViewHistory } from './nav';
import type { HemShape } from './engine/hem';
import type { AsymHem } from './engine/asymHem';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, SkirtMeasurements, SkirtShape, WaistStyle, draftSkirt } from './engine/skirt';
import { BodiceDraft, BodiceMeasurements, blockOf, draftBodice } from './engine/bodice';
import { BodiceEdges, SewingGuide, bodiceGuide, dressGuide, hasSlit, sewingGuide } from './engine/instructions';
import { bodiceFlat, dressFlat, outerFlat, skirtFlat, teeFlat, trousersFlat } from './engine/flat';
import { DressDraft, DressMeasurements, draftDress } from './engine/dress';
import { TrousersDraft, TrousersMeasurements, draftTrousers, trousersWaistband } from './engine/trousers';
import { trousersGuide } from './engine/trousersGuide';
import { TeeDraft, TeeMeasurements, draftTee } from './engine/tee';
import { teeGuide } from './engine/teeGuide';
import { LingerieDraft, LingerieMeasurements, draftLingerie } from './engine/lingerie';
import { lingerieGuide } from './engine/lingerieGuide';
import { withKnitFabric } from './engine/knits';
import { OuterDraft, OuterMeasurements, draftOuter } from './engine/outerwear';
import { outerGuide } from './engine/outerGuide';
import { Cloth, Route, toCouture } from './engine/couture';
import { AllowanceStyle, SEAM_WIDTHS, withAllowances } from './engine/allowances';
import { bodiceFacings, liningPieces, waistPieces } from './engine/finishing';
import { edgesFor, topNotes } from './engine/corsetGuide';
import { drapeFacings, drapeLined, drapeNote, zipSide } from './engine/drape';
import { bodiceSpec, dressSpec, outerSpec, skirtSpec, sleeveSpec, teeSpec, trousersSpec, lingerieSpec } from './engine/spec';
import { SleeveDraft, SleeveMeasurements, draftSleeve, needsArms } from './engine/sleeve';
import { Fitting, carriedFitting, describeCarried, describeFitting, saveVersion, toFitting, alterationSheet } from './engine/fitting';
import { FabricWidth, layPlans } from './engine/layplan';
import { MyFabric, clothFor, withFabric, withFabricEase } from './engine/fabrics';
import { SPECIALS, needsNap, withCheckMarks, withSpecialAllowances } from './engine/specialFabrics';
import { layAmount } from './engine/layplan';
import { withEstimates } from './estimate';
import { EXAMPLE_VALUES, FormKind, Garment, MeasurementId, MeasurementValues, Unit, checkMeasurements, isComplete } from './measurements';
import { usePersistent } from './store';
import {
  Account,
  ME,
  NEW_ACCOUNT,
  activePerson,
  formOf,
  addPerson,
  isSavedFor,
  makeBackup,
  personName,
  readBackup,
  profileName,
  removePattern,
  removePerson,
  renamePattern,
  setPatternFit,
  savePattern,
  updatePerson,
  recordMeasurements,
  withPeople,
} from './account';
import { LingerieChoices, DEFAULT_LINGERIE_CHOICES, describeLingerie } from './garments';
import { BodiceChoices, COLLAR_WORDS, DEFAULT_BODICE, DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES, OuterChoices, TeeChoices, TrousersChoices, validDetails, DressChoices, PatternChoices, describeBodice, describeOuter, describeTee, describeTrousers, isBodice, isDress, isLingerie, isOuter, isTee, isTrousers, sleeveOf } from './garments';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen, describe, fabricMetres } from './screens/StyleScreen';
import { BodiceStyleScreen, bindingMetres, bodiceFabricMetres } from './screens/BodiceStyleScreen';
import { DressStyleScreen } from './screens/DressStyleScreen';
import { TrousersStyleScreen, trousersFabricMetres } from './screens/TrousersStyleScreen';
import { TeeStyleScreen, teeFabricMetres } from './screens/TeeStyleScreen';
import { LingerieStyleScreen, lingerieFabricMetres } from './screens/LingerieStyleScreen';
import { OuterStyleScreen, outerFabricMetres } from './screens/OuterStyleScreen';
import { ExportScreen, Printable } from './screens/ExportScreen';
import { ChapterBand } from './ui/ChapterBand';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { MeasureStepsScreen, type StepsStart } from './screens/MeasureStepsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PhotoScreen } from './screens/PhotoScreen';
import { LegalScreen } from './screens/LegalScreen';
import { SignupScreen } from './screens/SignupScreen';
import { BrandsScreen } from './screens/BrandsScreen';
import { NightsScreen } from './screens/NightsScreen';
import { PlansScreen } from './screens/PlansScreen';
import { PhotoAllowance, UnlockGarment } from './ui/PlanPrompts';
import { BILLING_ON, canPhotoDraft, countPhotoDraft, hasGarment, plansShown, savedLimit } from './plans';
import { countStep, setReportView } from './report/report';
import { PRIVACY, TERMS } from './legal';
import { FittingScreen } from './screens/FittingScreen';
import { TrueScaleScreen } from './screens/TrueScaleScreen';
import { ClientBookScreen } from './screens/ClientBookScreen';
import { MeasureLinkScreen } from './screens/MeasureLinkScreen';
import { MeasureArrivalScreen } from './screens/MeasureArrivalScreen';
import { readLink, type MeasureReply } from './measureLink';
import { CheckFileScreen } from './screens/CheckFileScreen';
import { FormScreen } from './screens/FormScreen';
import { coverGuide, coverMissing, coverPieces, padMap } from './engine/formCover';
import { labelCode, savedCopy } from './labels';
import { ImportedPattern, importedGuide } from './engine/importDxf';
import { CollectionScreen } from './screens/CollectionScreen';
import { lookPatch } from './collection';
import { archiveCut } from './archive';
import { CollectionLink } from './ui/GarmentSwitch';
import { LoadingScreen, BODICE } from './ui/LoadingScreen';
import type { FormStart } from './ui/ContourForm';
import type { Piece } from './engine/piece';
import type { PocketStyle } from './engine/pockets';
import { garmentEase } from './engine/easeMap';
import { PointEdit, applyPointEdits } from './engine/pointEdit';
import { PointEditContext } from './ui/PointEditor';
import { Flounce, GodetCount, Pleats, layoutExtras } from './engine/skirtVolume';

// The logo (Cat's pick F1 Loading Block): the loading screen's bodice block, drawn inside the header's square.
const BRAND_BLOCK = 'M' + BODICE.map(([x, y]) => `${(9 + x * 14).toFixed(2)} ${(8 + y * 16).toFixed(2)}`).join(' L') + ' Z';
import { Mode, finishFor, keepFinish, modeOf } from './mode';

export type Step = 'measure' | 'style' | 'export';
type View = Step | 'plans' | 'welcome' | 'steps' | 'account' | 'photo' | 'fitting' | 'scale' | 'client' | 'check' | 'imported' | 'privacy' | 'terms' | 'tester' | 'news' | 'collection' | 'link' | 'arrive' | 'form' | 'formprint' | 'brands' | 'nights';

export interface Choices {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
  /** An era look the choices came from, kept while the shape and length still match it. */
  look?: string;
  /** Exact proportions matched from a photo, kept while the shape and length chips are left alone. */
  shape?: SkirtShape;
  /** Set by dragging the hem on the sketch: a length in cm between the named ones. */
  lengthCm?: number;
  /** Set by dragging the side seam on the sketch: the flare at the hem in cm. */
  flareCm?: number;
  /** Drawn on the sketch: a shaped hem. */
  hem?: HemShape;
  /** Pleats, godets, or a hem flounce or tiers, one at a time. Older saves have none. */
  pleats?: Pleats;
  godets?: GodetCount;
  flounce?: Flounce;
  /** A high-low or diagonal hem, in place of a drawn one. Older saves have none. */
  asymHem?: AsymHem;
  /** In-seam pockets. Older saves have none. */
  pockets?: 'none' | 'inseam';
  /** A waistband with a zip (older saves), or a pull-on elastic waist. */
  waist?: WaistStyle;
}

// Saved under the original "skirt" key so measurements from before bodices still load; older saves
// have no garment and open as a skirt. Measurements now live with each person in the account; `values`
// is only read to move an older save's measurements across (see withPeople).
interface Saved {
  unit: Unit;
  values: MeasurementValues;
  choices: Choices;
  garment: Garment;
  bodice: BodiceChoices;
  /** The dress's choices; until it is styled, it starts from the bodice and the skirt. */
  dress?: DressChoices;
  /** The trousers' choices. */
  trousers?: TrousersChoices;
  /** The T-shirt's choices. Older saves have none. */
  tee?: TeeChoices;
  /** Lingerie's choices, while it's previewed (lingerieFlag.ts). */
  lingerie?: LingerieChoices;
  /** The jacket's and the coat's choices. */
  jacket?: OuterChoices;
  coat?: OuterChoices;
  /** How the pattern is finished and printed, chosen on the print screen. Older saves have none. */
  finish?: Finish;
  /** The Archive cut this pattern was made from, for its credit line while the garment is unchanged. */
  archive?: string;
}

/** A pattern's choices, saved under their garment's key. Skirt choices predate the others and carry no garment. */
function choicesPatch(c: PatternChoices): [Garment, Partial<Saved>] {
  if (isOuter(c)) return [c.garment, { [c.garment]: c }];
  if (isTrousers(c)) return ['trousers', { trousers: c }];
  if (isTee(c)) return ['tee', { tee: c }];
  if (isLingerie(c)) return ['lingerie', { lingerie: c }];
  if (isDress(c)) return ['dress', { dress: c }];
  if (isBodice(c)) return ['bodice', { bodice: c }];
  return ['skirt', { choices: c }];
}

/** Seam allowances, lining and facings, and whether the draft itself is shown. */
export interface Finish {
  allowances: AllowanceStyle;
  skirtLined: boolean;
  bodiceEdges: BodiceEdges;
  atelier: boolean;
  /** Add the draft-it-by-hand guide to the PDF. Older saved settings have none. */
  byHand?: boolean;
  /** For the cutting layout: the fabric's width, and whether it has a nap. */
  fabricWidth: FabricWidth;
  nap: boolean;
  /** How to sew it: the quick route, or the couture one with hand techniques chosen for the cloth. */
  route: Route;
  cloth: Cloth;
  /** The fabric the maker has bought: named in the PDF and tech pack, checked against the style, and used to adjust the ease. */
  fabric?: MyFabric;
}

export const DEFAULT_FINISH: Finish = { allowances: 'home', skirtLined: false, bodiceEdges: 'binding', atelier: false, fabricWidth: 140, nap: false, route: 'quick', cloth: 'wool' };

const fmtCm = (v: number) => `${v} cm`;

/** Pockets, for the notes on the pattern's first page. */
const pocketWords = (style: PocketStyle, sides?: 'both' | 'right') =>
  style === 'slant' ? ', with slant pockets' : style === 'inseam' ? (sides === 'right' ? ', with an in-seam pocket on the right' : ', with in-seam pockets') : '';

/** The pattern's version and its toile corrections, for the title block, in lines that fit it. */
function fittingLines(f: Fitting | undefined, garment: Garment): string[] {
  const changes = describeFitting(f, garment);
  if (!f || !changes.length) return [];
  const date = f.date ? new Date(`${f.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const lines = [`Version ${f.round + 1}, corrected after the toile${date ? ` on ${date}` : ''}:`];
  for (const c of changes) {
    const last = lines.length - 1;
    if (last > 0 && lines[last].length + c.length < 96) lines[last] += `; ${c}`;
    else lines.push(c[0].toUpperCase() + c.slice(1));
  }
  return lines.map((l, i) => (i && i === lines.length - 1 ? `${l}.` : l));
}

const INITIAL: Saved = {
  unit: 'cm',
  values: {},
  choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' } as Choices,
  garment: 'skirt',
  bodice: DEFAULT_BODICE,
};

/** The sleeve for a bodice, drafted to its armhole with its allowances, when one is chosen and the arms are measured. */
function sleeveFor(bodice: BodiceDraft, choices: BodiceChoices, values: MeasurementValues): SleeveDraft | undefined {
  const { length, shape } = sleeveOf(choices);
  if (length === 'none' || needsArms(values as SleeveMeasurements)) return undefined;
  return draftSleeve(bodice, values as SleeveMeasurements, {
    length,
    shape,
    fit: choices.fit,
    seamAllowance: bodice.pieces[0].seamAllowance,
    armholeAllowance: bodice.pieces[0].allowances.armhole ?? 1,
    hemAllowance: 2.5,
  });
}

const ready = (values: MeasurementValues, unit: Unit, garment: Garment, form?: FormKind) =>
  isComplete(values, garment, form) && !checkMeasurements(values, unit, garment, form).some((c) => c.level === 'error');

const STEPS: { id: Step; label: string }[] = [
  { id: 'measure', label: 'Measure' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Print' },
];

/** Which of the three steps each screen belongs to, lit in the header. Account and the legal pages belong to none. */
const STEP_OF: Partial<Record<View, Step>> = { steps: 'measure', measure: 'measure', style: 'style', photo: 'style', export: 'export', fitting: 'export', scale: 'export' };

/** Side screens name where they hang off, under the header, so you can see where you are. */
const SIDE: Partial<Record<View, [string, string]>> = {
  photo: ['Style', 'From a photo'],
  fitting: ['Print', 'Fitting'],
  scale: ['Print', 'True size'],
  client: ['Account', 'Client book'],
  arrive: ['Account', 'Client book'],
  check: ['Account', 'Check a file'],
  form: ['Account', 'Body Double'],
  formprint: ['Body Double', 'Cover pattern'],
  brands: ['Account', 'For brands'],
  nights: ['Account', 'Atelier Nights'],
};

/** Screens that draw a pattern, so they need the measurements first. */
const NEEDS_MEASUREMENTS: View[] = ['style', 'export', 'fitting', 'scale'];

/** Where the header's back goes when there's nothing behind in history, such as after a reload. */
const PARENT: Partial<Record<View, View>> = { measure: 'welcome', steps: 'welcome', style: 'measure', photo: 'style', export: 'style', fitting: 'export', scale: 'export', account: 'style', client: 'account', arrive: 'client', link: 'welcome', check: 'account', imported: 'check', form: 'account', formprint: 'form', privacy: 'welcome', terms: 'welcome', tester: 'account', news: 'account', brands: 'account', nights: 'account' };

export default function App() {
  const [saved, setSaved] = usePersistent<Saved>('skirt', INITIAL);
  const [storedAccount, setAccount] = usePersistent<Account>('account', NEW_ACCOUNT);
  // Points moved on the flat pattern, per garment (see engine/pointEdit.ts).
  const [pointEdits, setPointEdits] = usePersistent<Record<string, PointEdit[]>>('point-edits', {});
  const account = withPeople(storedAccount, saved.values);
  const person = activePerson(account);
  // What was measured, for the measuring screens and the checks; patterns are drafted from `values`, which
  // fills in any upper-body measurement not taken yet with an estimate (see estimate.ts).
  const measured = person.values;
  const measuredKey = JSON.stringify(measured);
  // The dress form their patterns are drafted on: the menswear form drafts with no bust shaping.
  const form = formOf(person);
  // Keyed on the numbers, as the account (and so the person) is rebuilt on every render.
  const values = useMemo(() => withEstimates(measured, form), [measuredKey, form]);
  // The last photo matched to a skirt, shown beside "Matched to your photo" while the app is open. Never saved.
  const [photoPreview, setPhotoPreview] = useState<string>();
  // The garment the photo was drafted as, so only that garment's style screen shows it.
  const [photoFor, setPhotoFor] = useState<Garment>();
  // A measurement taken (changed from the example body's) is no longer the example's.
  const setValues = (v: MeasurementValues) => setAccount(updatePerson(account, person.id, { values: v, example: person.example?.filter((id) => v[id] === measured[id]) }));
  const { garment } = saved;
  // Every visit opens on the welcome screen (Cat's pick, 2026-10-16). Saved measurements and
  // patterns are kept, so a returning sewist taps through and carries on.
  // Screens live in the browser's history, so phone and browser back step back through the app. Landing back
  // on a pattern screen whose measurements have since gone sends you to Measure instead.
  // A measure-me link opened here: a client's ask to measure, or a client's numbers coming back to their dressmaker.
  const [incoming] = useState(() => readLink(window.location.hash));
  const [arriving, setArriving] = useState<MeasureReply | undefined>(incoming?.kind === 'reply' ? incoming.reply : undefined);
  // A link opened while the app is already showing (a pasted address, a second tap) starts over from it.
  useEffect(() => {
    const on = () => {
      if (readLink(window.location.hash)) window.location.reload();
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [startView] = useState<View>(incoming?.kind === 'ask' ? 'link' : incoming?.kind === 'reply' ? 'arrive' : 'welcome');
  const [step, setStep] = useViewHistory<View>(startView, (to) => (NEEDS_MEASUREMENTS.includes(to) && !canLeaveMeasure ? 'measure' : to));
  const openLegal = (page: 'privacy' | 'terms' | 'tester' | 'news' | 'brands' | 'nights') => setStep(page);
  // Where Plans goes back to: the screen it was opened from.
  const [beforePlans, setBeforePlans] = useState<View>('account');
  const openPlans = () => {
    if (step !== 'plans') setBeforePlans(step);
    setStep('plans');
  };
  // Crash reports name the screen; reaching the print screen counts (once a visit) as having styled a pattern.
  useEffect(() => {
    setReportView(step);
    if (step === 'export') countStep('styled', garment);
  }, [step, garment]);
  // The loading screen plays when someone first opens the app, on the way into the welcome. People coming
  // back to their work go straight to it.
  const [opening, setOpening] = useState(step === 'welcome');
  // The welcome's dress form waits under the loading screen, which wraps its bodice into the form's outline.
  const [formStart, setFormStart] = useState<FormStart>(opening ? 'wait' : 'fresh');
  const profile = profileName(account);
  const owner = personName(account, account.people.find((p) => p.id === ME)!);

  const checks = checkMeasurements(measured, saved.unit, garment, form);
  const canLeaveMeasure = ready(measured, saved.unit, garment, form);

  // Corrections from this person's toile fittings go into every pattern drafted for them: the garment's
  // own toile first, then what the person's other toiles found that this one hasn't looked at.
  const ownFitting = person.fittings?.[garment];
  const carried = useMemo(() => carriedFitting(person.fittings, garment), [person.fittings, garment]);
  const fitting = carried.fitting;
  const carriedNotes = useMemo(() => describeCarried(carried), [carried]);
  const alterations = useMemo(() => alterationSheet(carried.fitting, garment), [carried, garment]);
  // Simple or all tools: the simple view prints with home allowances and the quick route, and keeps the rest for later.
  const mode = modeOf(account);
  const setMode = (m: Mode) => setAccount({ ...account, mode: m });
  const storedFinish = { ...DEFAULT_FINISH, ...saved.finish };
  const finish = finishFor(storedFinish, mode);
  const setFinish = (f: Finish) => setSaved({ ...saved, finish: keepFinish(storedFinish, f, mode) });
  // Heavy cloth gets a little more ease, on top of the toile's corrections.
  const fabric = finish.fabric;
  /** The bodice block's corrections: the toile's, a little ease for heavy cloth, and the menswear form's flat front. */
  const bodiceFitting = (f: Fitting | undefined) => ({ ...withFabricEase(toFitting(f, 'bodice'), fabric, 'bodice'), ...(form === 'menswear' ? { flatFront: true } : {}) });
  const skirtStyle = useMemo(() => ({ ...saved.choices, fitting: withFabricEase(toFitting(fitting, 'skirt'), fabric, 'skirt') }), [saved.choices, fitting, fabric]);
  const bodiceStyle = useMemo(() => ({ ...validDetails(saved.bodice), fitting: bodiceFitting(fitting) }), [saved.bodice, fitting, fabric, form]);
  const dress = useMemo(
    (): DressChoices => saved.dress ?? { garment: 'dress', fit: saved.bodice.fit, bodice: { ...saved.bodice, length: 'waist' }, skirt: saved.choices },
    [saved.dress, saved.bodice, saved.choices],
  );
  const trousersChoices = saved.trousers ?? DEFAULT_TROUSERS_CHOICES;
  const teeChoices = saved.tee ?? DEFAULT_TEE_CHOICES;
  const lingerieChoices = saved.lingerie ?? DEFAULT_LINGERIE_CHOICES;
  const isOuterGarment = garment === 'jacket' || garment === 'coat';
  const outerChoices: OuterChoices = useMemo(() => (garment === 'coat' ? { ...DEFAULT_COAT_CHOICES, ...saved.coat } : { ...DEFAULT_JACKET_CHOICES, ...saved.jacket }), [garment, saved.coat, saved.jacket]);
  // Jackets and coats are drafted on the bodice block, so they take the bodice's toile corrections.
  const outerStyleFor = (c: OuterChoices, f: Fitting | undefined) => ({ ...c, kind: c.garment, fitting: bodiceFitting(f) });
  const trousersCut = form === 'menswear' ? { cut: 'menswear' as const } : {};
  const trousersStyle = useMemo(() => ({ ...trousersChoices, ...trousersCut, fitting: withFabricEase(toFitting(fitting, 'skirt'), fabric, 'skirt') }), [trousersChoices, fitting, fabric, form]);
  /** The dress in one fit: the bodice at the waist, the skirt below it, each with its toile corrections. */
  const dressStyles = (f: Fitting | undefined) => ({
    bodice: { ...validDetails({ ...dress.bodice, length: 'waist' }, 'dress'), fit: dress.fit, length: 'waist' as const, fitting: bodiceFitting(f) },
    skirt: { ...dress.skirt, fit: dress.fit, fitting: withFabricEase(toFitting(f, 'skirt'), fabric, 'skirt') },
  });

  const drafts = useMemo((): { skirt?: SkirtDraft; bodice?: BodiceDraft; dress?: DressDraft; trousers?: TrousersDraft; tee?: TeeDraft; lingerie?: LingerieDraft; outer?: OuterDraft; sleeve?: SleeveDraft; error?: string } => {
    if (!canLeaveMeasure) return {};
    try {
      if (isOuterGarment) return { outer: draftOuter(values as OuterMeasurements, outerStyleFor(outerChoices, fitting)) };
      if (garment === 'bodice') {
        const bodice = draftBodice(values as BodiceMeasurements, bodiceStyle);
        return { bodice, sleeve: sleeveFor(bodice, bodiceStyle, values) };
      }
      if (garment === 'trousers') return { trousers: draftTrousers(values as TrousersMeasurements, trousersStyle) };
      // A knit block fits by stretch, so no woven toile corrections or heavy-cloth ease go into it.
      if (garment === 'tee') return { tee: draftTee(values as TeeMeasurements, teeChoices) };
      if (garment === 'lingerie') return { lingerie: draftLingerie(values as LingerieMeasurements, lingerieChoices) };
      if (garment === 'dress') {
        const st = dressStyles(fitting);
        const d = draftDress(values as DressMeasurements, st.bodice, st.skirt);
        return { dress: d, sleeve: sleeveFor(d.bodice, st.bodice, values) };
      }
      return { skirt: draftSkirt(values as SkirtMeasurements, skirtStyle) };
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.' };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, skirtStyle, bodiceStyle, trousersStyle, teeChoices, lingerieChoices, dress, outerChoices, fabric, fitting, garment, canLeaveMeasure]);

  // The drafts with any points moved on the flat pattern, so the preview, print and files all follow.
  const moved = pointEdits[garment];
  const result = useMemo(() => {
    if (!moved?.length) return drafts;
    const edit = <T extends { pieces: Piece[] }>(d: T | undefined): T | undefined => d && { ...d, pieces: applyPointEdits(d.pieces, moved) };
    const { dress: d } = drafts;
    return { ...drafts, skirt: edit(drafts.skirt), bodice: edit(drafts.bodice), trousers: edit(drafts.trousers), tee: edit(drafts.tee), lingerie: edit(drafts.lingerie), outer: edit(drafts.outer), dress: d && { ...edit(d)!, skirt: edit(d.skirt)! } };
  }, [drafts, moved]);
  const pointEditing = useMemo(() => {
    const { skirt, bodice, dress: d, trousers, tee, lingerie, outer } = drafts;
    const base = (bodice ?? d ?? trousers ?? tee ?? lingerie ?? outer ?? skirt)?.pieces.filter((pc) => !pc.kind) ?? [];
    return { base, edits: moved ?? [], setEdits: (e: PointEdit[]) => setPointEdits({ ...pointEdits, [garment]: e }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, moved, garment, pointEdits]);

  /** Room over the body at every level of the drafted pieces, for the ease map. */
  const ease = useMemo(() => {
    const { skirt, bodice, dress: d, trousers, outer } = result;
    const lv = (b: BodiceDraft) => ({ bust: b.front.apex.y, waist: b.front.waistCentre.y, block: b.block });
    // The jacket's front and back as sewn, read as a long bodice.
    if (outer) return garmentEase(outer.block.map((pc) => ({ ...pc, name: pc.name.replace(/^(Jacket|Coat)/, 'Bodice') })), values, { bust: outer.base.front.apex.y, waist: outer.base.front.waistCentre.y });
    if (bodice) return garmentEase(bodice.pieces, values, lv(bodice));
    // Pleats spread flat, or a flounce cut away, read from the skirt as it hangs.
    if (d) return garmentEase(d.skirt.block ? [...d.pieces.filter((pc) => /^Bodice/.test(pc.name)), ...d.skirt.block] : d.pieces, values, lv(d.bodice));
    // Read before a slant pocket is cut from the front, which would look like a gap at the waist.
    if (trousers) return garmentEase(trousers.block, values);
    if (skirt) return garmentEase(skirt.block ?? skirt.pieces, values);
    return undefined;
  }, [result, values]);

  /** The pattern's own pieces with a set of corrections, for the fitting screen's before and after. */
  const draftWith = useMemo(
    () =>
      (f: Fitting): Piece[] | undefined => {
        try {
          if (garment === 'bodice') return draftBodice(values as BodiceMeasurements, { ...saved.bodice, fitting: bodiceFitting(f) }).pieces;
          // The garment's own pieces: pocket bags don't change with a fitting.
          const own = (pcs: Piece[]) => pcs.filter((pc) => pc.kind !== 'pocket');
          if (isOuterGarment) return draftOuter(values as OuterMeasurements, outerStyleFor(outerChoices, f)).pieces.filter((pc) => !pc.kind);
          if (garment === 'trousers') return draftTrousers(values as TrousersMeasurements, { ...trousersChoices, ...trousersCut, fitting: withFabricEase(toFitting(f, 'skirt'), fabric, 'skirt') }).block;
          if (garment === 'tee') return draftTee(values as TeeMeasurements, teeChoices).pieces;
          if (garment === 'lingerie') return draftLingerie(values as LingerieMeasurements, lingerieChoices).pieces;
          if (garment === 'dress') {
            const st = dressStyles(f);
            return own(draftDress(values as DressMeasurements, st.bodice, st.skirt).pieces);
          }
          return own(draftSkirt(values as SkirtMeasurements, { ...saved.choices, fitting: withFabricEase(toFitting(f, 'skirt'), fabric, 'skirt') }).pieces);
        } catch {
          return undefined;
        }
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [garment, values, saved.bodice, saved.choices, trousersChoices, teeChoices, lingerieChoices, dress, outerChoices, fabric],
  );

  /** The pattern's main pieces with allowances, drafted to any measurements: for grading a size run. */
  const draftAt = useMemo(
    () =>
      (m: MeasurementValues): Piece[] => {
        const allowance = (saved.finish ?? DEFAULT_FINISH).allowances;
        const special = (saved.finish ?? DEFAULT_FINISH).fabric?.special;
        const allow = (pcs: Piece[]) => pcs.map((pc) => withSpecialAllowances(withAllowances(pc, allowance), special));
        if (garment === 'bodice') {
          const b = draftBodice(m as BodiceMeasurements, bodiceStyle);
          return allow([...b.pieces, ...(sleeveFor(b, bodiceStyle, m)?.pieces ?? [])]);
        }
        // Knit pieces keep their 1 cm allowances whatever the style.
        if (garment === 'tee') return draftTee(m as TeeMeasurements, teeChoices).pieces;
        if (garment === 'lingerie') return draftLingerie(m as LingerieMeasurements, lingerieChoices).pieces;
        if (isOuterGarment) return allow(draftOuter(m as OuterMeasurements, outerStyleFor(outerChoices, fitting)).pieces);
        if (garment === 'trousers') {
          const t = draftTrousers(m as TrousersMeasurements, trousersStyle);
          return allow([...t.pieces, trousersWaistband(t, 1.5)]);
        }
        if (garment === 'dress') {
          const st = dressStyles(fitting);
          const d = draftDress(m as DressMeasurements, st.bodice, st.skirt);
          return allow([...d.pieces, ...(sleeveFor(d.bodice, st.bodice, m)?.pieces ?? [])]);
        }
        const k = draftSkirt(m as SkirtMeasurements, skirtStyle);
        return allow([...k.pieces, ...waistPieces(k, 1.5)]);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [garment, bodiceStyle, trousersStyle, teeChoices, lingerieChoices, skirtStyle, dress, outerChoices, fitting, saved.finish?.allowances, saved.finish?.fabric?.special],
  );

  const current = isOuterGarment ? outerChoices : garment === 'bodice' ? saved.bodice : garment === 'dress' ? dress : garment === 'trousers' ? trousersChoices : garment === 'tee' ? teeChoices : garment === 'lingerie' ? lingerieChoices : saved.choices;
  const title = isOuterGarment ? describeOuter(outerChoices) : garment === 'bodice' ? describeBodice(saved.bodice) : garment === 'dress' ? describePattern(dress) : garment === 'trousers' ? describeTrousers(trousersChoices) : garment === 'tee' ? describeTee(teeChoices) : garment === 'lingerie' ? describeLingerie(lingerieChoices) : describe(saved.choices);

  const drafted = useMemo((): Printable | undefined => {
    const { skirt, bodice, sleeve, dress: dressDraft, trousers, tee, lingerie, outer } = result;
    // A special cloth (leather) can need its own seam allowances, whatever the style.
    const special = fabric?.special;
    const own = special && SPECIALS[special].seam;
    const seams = own ? { seam: own, waist: own, curve: own } : SEAM_WIDTHS[finish.allowances];
    const checks = !!fabric?.checks;
    const allow = (pieces: Printable['pieces']) =>
      pieces.map((pc) => {
        const cut = withSpecialAllowances(withAllowances(pc, finish.allowances), special);
        return checks ? withCheckMarks(cut) : cut;
      });
    const nap = finish.nap || needsNap(special);
    const hide = special === 'leather';
    const couture = finish.allowances === 'couture';
    const fittingNotes = [...fittingLines(ownFitting, garment), ...carriedNotes.map((l) => `${l}.`)];
    // The couture route's cloth follows the recorded fibre; either route opens with preparing the fabric.
    const route = (guide: SewingGuide, c: { garment: 'skirt' | 'bodice' | 'dress'; lined: boolean; zipCm: number }) =>
      withFabric(finish.route === 'couture' ? toCouture(guide, { ...c, cloth: clothFor(fabric, finish.cloth), traced: couture }) : guide, fabric, c.garment);
    if (tee) {
      // Knit allowances (1 cm, 2.5 cm at the hem) whatever the allowance style, and a knit lay.
      const pieces = tee.pieces;
      const lays = layPlans(pieces, finish.fabricWidth, nap, false, true);
      return {
        pieces,
        notes: [
          `For knit fabric with ${tee.stretch} stretch. Finished bust ${tee.finishedBust} cm, ${tee.length === 'cropped' ? 'hem' : 'hem at the hip'} ${tee.finishedHem} cm, back length ${tee.backLength} cm.`,
          `Seam allowance 1 cm included, 2.5 cm at the hem, 2 cm at the sleeve hem. Dashed line = stitching line. Grain lines run along the ribs.`,
          `Neckband ${tee.neckband.length} cm long, ${Math.round(tee.neckband.ratio * 100)}% of the ${tee.necklineCm} cm neckline, cut with the stretch along it. Sleeve: bicep ${tee.sleeve.bicep} cm. Sewing steps are on the last pages.`,
        ],
        guide: withKnitFabric(teeGuide(tee, lays.find((l) => l.fabric === 'self')?.metres ?? teeFabricMetres(tee), { width: finish.fabricWidth }), fabric),
        spec: teeSpec(values as TeeMeasurements, tee),
        lays,
        flat: teeFlat(tee),
      };
    }
    if (lingerie) {
      // Knit allowances whatever the allowance style, and a knit lay.
      const pieces = lingerie.pieces;
      const lays = layPlans(pieces, finish.fabricWidth, nap, false, true);
      const { piece } = lingerie.style;
      const cut = [
        lingerie.finishedBust !== undefined && `bust ${lingerie.finishedBust} cm`,
        lingerie.finishedBand !== undefined && `band ${lingerie.finishedBand} cm`,
        lingerie.finishedWaist !== undefined && `waist ${lingerie.finishedWaist} cm`,
        piece !== 'bralette' && `hip ${lingerie.finishedHip} cm`,
      ].filter(Boolean);
      return {
        pieces,
        notes: [
          `For ${lingerie.style.way === 'two' ? 'knit that stretches across' : `four-way stretch ${piece === 'swimsuit' || piece === 'bikini' ? 'swim Lycra' : 'knit'}`} with ${lingerie.style.stretch} stretch. Cut ${cut.join(', ')}, ${lingerie.lengthReduction ? `${Math.round(lingerie.lengthReduction * 100)}% shorter than the body` : 'full length'}.`,
          `Seams 1 cm, and each elastic edge as wide as its elastic, all included. Dashed line = stitching line. Grain lines run down the fabric, with the most stretch going round the body.`,
          `Elastic: ${lingerie.elastic.map((e) => `${e.edge.toLowerCase()} ${e.length} cm${e.count > 1 ? ` (cut ${e.count})` : ''}`).join(', ')}. Sewing steps are on the last pages.`,
        ],
        guide: withKnitFabric(lingerieGuide(lingerie, lays.find((l) => l.fabric === 'self')?.metres ?? lingerieFabricMetres(lingerie), { width: finish.fabricWidth }), fabric),
        spec: lingerieSpec(values as LingerieMeasurements, lingerie),
        lays,
      };
    }
    if (outer) {
      const pieces = allow(outer.pieces);
      const lays = layPlans(pieces, finish.fabricWidth, nap, hide);
      const metres = (f: 'self' | 'lining') => lays.find((l) => l.fabric === f)?.metres;
      const hem = outer.pieces[0].allowances['opening-hem'] ?? 4;
      const kind = outer.kind;
      return {
        pieces,
        notes: [
          `Finished bust ${outer.finishedBust} cm, waist ${outer.finishedWaist} cm, hem ${outer.finishedHem} cm, back length ${outer.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, 1 cm at the neck, armholes, collar and front edges, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `Fully lined, with front facings${outer.lapel ? ' and a notched collar' : ''}. ${outer.buttons.at.length * outer.buttons.columns.length} buttons, ${outer.buttons.sizeCm} cm. Sewing steps are on the last pages.`,
          `Sleeve: bicep ${outer.sleeve.bicep} cm, crown ease ${outer.sleeve.crownEase.front} cm front, ${outer.sleeve.crownEase.back} cm back.`,
          ...fittingNotes,
        ],
        guide: withFabric(
          outerGuide(outer, metres('self') ?? outerFabricMetres(outer), { seams, width: finish.fabricWidth, liningM: metres('lining') }),
          fabric,
          kind,
        ),
        spec: outerSpec(values as OuterMeasurements, outer),
        lays,
        flat: outerFlat(outer),
      };
    }
    if (trousers) {
      const pieces = allow([...trousers.pieces, trousersWaistband(trousers, 1.5)]);
      const hem = pieces[0].allowances.hem;
      const lays = layPlans(pieces, finish.fabricWidth, nap, hide);
      const m = values as TrousersMeasurements;
      return {
        pieces,
        notes: [
          `Finished waist ${trousers.finishedWaist} cm, hip ${trousers.finishedHip} cm, outside leg ${trousers.lengthCm} cm, crotch seam ${Math.round((trousers.crotch.front + trousers.crotch.back) * 10) / 10} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `${
            trousers.elastic
              ? `A pull-on elastic waist, with no zip: ${trousers.elastic.cutCm} cm of ${trousers.elastic.widthCm} cm elastic in the waistband casing`
              : trousers.closure === 'fly'
                ? `A ${trousers.zipCm} cm fly zip with its facing and shield, and the waistband`
                : `A ${trousers.zipCm} cm invisible zip in the left side seam, and the waistband`
          }${pocketWords(trousers.pockets, trousers.pocketSides)}. The crease line is the grain line. Sewing steps are on the last pages.`,
          ...fittingNotes,
        ],
        guide: withFabric(trousersGuide(trousers, lays.find((l) => l.fabric === 'self')?.metres ?? trousersFabricMetres(trousers), { seams, width: finish.fabricWidth }), fabric, 'trousers'),
        spec: trousersSpec(m, trousers),
        lays,
        flat: trousersFlat(trousers, m),
      };
    }
    if (skirt) {
      // The lining is drafted 2.5 cm shorter than the skirt, from the same measurements and style.
      let lining: SkirtDraft | undefined;
      if (finish.skirtLined) {
        try {
          // A plain lining under pleats, godets or a flounce: they need no second layer. Nor pockets.
          lining = draftSkirt(values as SkirtMeasurements, { ...skirtStyle, pleats: undefined, godets: undefined, flounce: undefined, lengthCm: skirt.lengthCm - 2.5, pockets: 'none' });
        } catch {
          lining = undefined;
        }
      }
      const pieces = allow([...skirt.pieces, ...(lining ? liningPieces(lining) : []), ...waistPieces(skirt, 1.5)]);
      // The hem is on the flounce below a flounced skirt, and on the bottom tier (2 cm) of a tiered one.
      const hem = pieces.find((pc) => !pc.kind && pc.allowances.hem !== undefined)?.allowances.hem ?? 2;
      // Tiers and the extra godets are cut but not printed.
      const lays = layPlans([...pieces, ...allow(layoutExtras(skirt))], finish.fabricWidth, nap, hide);
      const metres = (f: 'self' | 'lining', fallback: () => number) => lays.find((l) => l.fabric === f)?.metres ?? fallback();
      return {
        pieces,
        notes: [
          `Finished waist ${skirt.finishedWaist} cm${skirt.elastic ? `, gathered onto ${skirt.elastic.finishedCm} cm of elastic` : ''}, hip ${skirt.finishedHip} cm, length ${skirt.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `${skirt.elastic ? `A pull-on elastic waist, with no zip: ${skirt.elastic.cutCm} cm of ${skirt.elastic.widthCm} cm elastic in the waistband casing` : skirt.faced ? 'Waist facings' : 'Waistband'}${lining ? ' and lining' : ''}${pocketWords(skirt.pocket ? 'inseam' : 'none')} included.${skirt.bias ? ' Cut on the bias: every piece single layer, grain at 45 degrees.' : ''}${skirt.volume?.tiers ? ' The tiers are rectangles: their measurements are in the sewing steps.' : ''} Sewing steps are on the last pages.`,
          ...fittingNotes,
        ],
        guide: route(
          sewingGuide(skirt, saved.choices, metres('self', () => fabricMetres(skirt)), {
            seams,
            width: finish.fabricWidth,
            liningM: lining ? metres('lining', () => fabricMetres(lining!)) : undefined,
            hem: skirt.pieces[0].allowances.hem >= 4 ? hem : undefined,
          }),
          { garment: 'skirt', lined: !!lining, zipCm: skirt.zipCm },
        ),
        spec: skirtSpec(values as SkirtMeasurements, skirt),
        lays,
        flat: skirtFlat(skirt, { slit: hasSlit(saved.choices) }),
      };
    }
    if (dressDraft) {
      const d = dressDraft;
      const edges = edgesFor(d.bodice, finish.bodiceEdges);
      const bodicePcs = d.pieces.filter((pc) => /^Bodice/.test(pc.name));
      const top =
        edges === 'lined'
          ? d.bodice.drape
            ? drapeLined(bodicePcs, d.bodice)
            : bodicePcs.map((pc) => (/coutil/.test(pc.fabric ?? '') ? pc : { ...pc, fabric: 'Self fabric and lining' }))
          : bodicePcs;
      // Facings are cut from the bodice as sewn, with any moved dart or princess seam closed.
      const [bf, bb] = blockOf(d.bodice);
      const facings = edges === 'facings' ? (d.bodice.drape ? drapeFacings(d.bodice, !sleeve) : bodiceFacings(bf, bb, !sleeve, d.bodice.collar !== 'mandarin')) : [];
      const pieces = allow([...top, ...(sleeve?.pieces ?? []), ...d.skirt.pieces, ...facings]);
      const lays = layPlans([...pieces, ...allow(layoutExtras(d.skirt))], finish.fabricWidth, nap, hide);
      const metres = (f: 'self' | 'lining' | 'interlining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(d.bodice, sleeve) + fabricMetres(d.skirt);
      const edgeWords = sleeve
        ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
        : { binding: 'bias-bound neck and armholes', facings: 'a faced neck and armholes', lined: 'a lined bodice' }[edges];
      return {
        pieces,
        notes: [
          `Finished bust ${d.finishedBust} cm, waist ${d.finishedWaist} cm, hip ${d.finishedHip} cm, nape to hem ${d.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes, ${fmtCm(pieces.find((pc) => /^(Skirt|Flounce) front/.test(pc.name) && pc.allowances.hem !== undefined)?.allowances.hem ?? (d.skirt.volume?.tiers ? 2 : 4))} at the hem. Dashed line = stitching line.`,
          `The skirt is drafted to the bodice: waist seams the same length and darts in one line. A ${d.zipCm} cm ${d.zipSide ? `zip in the ${zipSide(d.bodice)} side seam` : 'centre back zip'} and ${edgeWords}${pocketWords(d.skirt.pocket ? 'inseam' : 'none')}. Sewing steps are on the last pages.`,
          ...(drapeNote(d.bodice) ? [drapeNote(d.bodice)!] : []),
          ...(sleeve ? [`Sleeve: bicep ${sleeve.bicep} cm, ${sleeve.gathers?.crown !== undefined ? `${sleeve.gathers.crown} cm gathered into the crown` : `crown ease ${sleeve.crownEase.front} cm front, ${sleeve.crownEase.back} cm back`}.`] : []),
          ...topNotes(d.bodice),
          ...fittingNotes,
        ],
        guide: route(
          dressGuide(d, dress.skirt, metres('self'), bindingMetres(d.bodice, { neck: edges === 'binding' && d.bodice.collar !== 'mandarin', armholes: sleeve ? edges === 'lined' : edges === 'binding' }), {
            seams,
            edges,
            width: finish.fabricWidth,
            liningM: metres('lining'),
            coutilM: d.bodice.top?.boned ? metres('interlining') : undefined,
            sleeve,
          }),
          { garment: 'dress', lined: edges === 'lined', zipCm: d.zipCm },
        ),
        spec: dressSpec(values as DressMeasurements, d, sleeve),
        lays,
        flat: dressFlat(d, edges, { sleeve, slit: hasSlit(dress.skirt) }),
      };
    }
    if (bodice) {
      const below = bodice.finishedHem !== undefined;
      const edges = edgesFor(bodice, finish.bodiceEdges);
      const main =
        edges === 'lined'
          ? bodice.drape || bodice.peplum
            ? drapeLined(bodice.pieces, bodice)
            : bodice.pieces.map((pc) => (pc.kind || /coutil/.test(pc.fabric ?? '') ? pc : { ...pc, fabric: 'Self fabric and lining' }))
          : bodice.pieces;
      // A button front's facings, or a band collar, finish the neck.
      const neckDone = bodice.closure === 'front_buttons' || bodice.collar === 'mandarin' || bodice.collar === 'shirt';
      const facings = edges === 'facings' ? (bodice.drape ? drapeFacings(bodice, !sleeve, !neckDone) : bodiceFacings(...blockOf(bodice), !sleeve, !neckDone)) : [];
      const pieces = allow([...main, ...(sleeve?.pieces ?? []), ...facings]);
      const edgeWords = sleeve
        ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
        : { binding: 'bias-bound edges', facings: 'faced neck and armholes', lined: 'a full lining' }[edges];
      const sleeveWords = sleeve ? `${describeBodice(saved.bodice).replace(/^.* with /, 'With ')}` : 'Sleeveless';
      const lays = layPlans(pieces, finish.fabricWidth, nap, hide);
      const metres = (f: 'self' | 'lining' | 'interlining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(bodice);
      return {
        pieces,
        notes: [
          `Finished bust ${bodice.finishedBust} cm, waist ${bodice.finishedWaist} cm${below ? `, hem ${bodice.finishedHem} cm` : ''}, back length ${bodice.backLength} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes${below ? ', 2.5 cm at the hem' : ''}. Dashed line = stitching line.`,
          `${sleeveWords}, ${bodice.closure === 'front_buttons' ? `${bodice.buttons?.count ?? 5} buttons down the centre front` : `a ${bodice.zipCm} cm ${bodice.drape?.kind === 'one_shoulder' ? `zip in the ${zipSide(bodice)} side seam` : 'centre back zip'}`}${bodice.collar !== 'none' ? `, a ${COLLAR_WORDS[bodice.collar]}` : ''} and ${edgeWords}. Sewing steps are on the last pages.`,
          ...(drapeNote(bodice) ? [drapeNote(bodice)!] : []),
          ...(bodice.peplum ? [`A ${bodice.peplum.kind} peplum, ${bodice.peplum.depthCm} cm deep, ${bodice.peplum.hemCm} cm round the hem.`] : []),
          ...(sleeve ? [`Sleeve: bicep ${sleeve.bicep} cm, ${sleeve.gathers?.crown !== undefined ? `${sleeve.gathers.crown} cm gathered into the crown` : `crown ease ${sleeve.crownEase.front} cm front, ${sleeve.crownEase.back} cm back`}.`] : []),
          ...topNotes(bodice),
          ...fittingNotes,
        ],
        guide: route(
          bodiceGuide(bodice, saved.bodice, metres('self'), bindingMetres(bodice, { neck: !neckDone && (!sleeve || edges === 'binding'), armholes: !sleeve || edges === 'lined' }), {
            seams,
            edges,
            width: finish.fabricWidth,
            liningM: metres('lining'),
            coutilM: bodice.top?.boned ? metres('interlining') : undefined,
            sleeve,
          }),
          { garment: 'bodice', lined: edges === 'lined', zipCm: bodice.zipCm },
        ),
        spec: [...bodiceSpec(values as BodiceMeasurements, bodice, saved.bodice.length, saved.bodice.dropCm), ...(sleeve ? sleeveSpec(values as SleeveMeasurements, sleeve) : [])],
        lays,
        flat: bodiceFlat(bodice, edges, sleeve),
      };
    }
    return undefined;
  }, [result, saved.choices, saved.bodice, dress, skirtStyle, values, finish.allowances, finish.skirtLined, finish.bodiceEdges, finish.fabricWidth, finish.nap, finish.route, finish.cloth, fabric, fitting, ownFitting, carriedNotes, garment]);
  // An Archive cut keeps its credit while it's the same garment; its details can still be changed.
  const fromArchive = [archiveCut(saved.archive)].find((c) => c?.garment === garment);
  // Leather is bought by the hide: say how much on the pattern and in the tech pack.
  const printable = useMemo((): Printable | undefined => {
    const hideLay = drafted?.lays.find((l) => l.hide);
    return drafted && hideLay ? { ...drafted, guide: { ...drafted.guide, fabric: [...(drafted.guide.fabric ?? []), `Leather to buy: ${layAmount(hideLay)}.`] } } : drafted;
  }, [drafted]);

  // A pattern read from another program's DXF on Check any pattern, printed and sent like one drafted here.
  // Kept for this visit only: the file stays on the device it was opened on.
  const [imported, setImported] = useState<{ pattern: ImportedPattern; fileName: string }>();
  const importedPrintable = useMemo((): Printable | undefined => {
    if (!imported) return undefined;
    const { pieces, source, notes } = imported.pattern;
    return {
      pieces,
      notes: [`Read from ${imported.fileName}${source ? `, made in ${source}` : ''}.`, ...notes],
      guide: importedGuide(pieces),
      spec: [],
      lays: layPlans(pieces, finish.fabricWidth, finish.nap || needsNap(finish.fabric?.special)),
    };
  }, [imported, finish.fabricWidth, finish.nap, finish.fabric?.special]);
  // Body Double: the padded form cover, drafted from the same 3D body as every form in the app.
  const coverPrintable = useMemo((): Printable | undefined => {
    if ((step !== 'form' && step !== 'formprint') || coverMissing(measured).length) return undefined;
    const pieces = coverPieces(values);
    const lays = layPlans(pieces, finish.fabricWidth, false);
    return {
      pieces,
      notes: ['Form cover: zero ease, so the cover is the shape. 1 cm seams, 2.5 cm hem channel.'],
      guide: coverGuide(padMap(values), lays[0] && layAmount(lays[0])),
      spec: [],
      lays,
    };
  }, [step, values, measuredKey, finish.fabricWidth]);
  const importedTitle = imported ? imported.pattern.style || imported.fileName.replace(/\.dxf$/i, '') : '';

  const isSaved = isSavedFor(account, current, person.id);
  // The saved copy's label code, printed on signature labels; typing it on Account opens the pattern again.
  const savedNow = savedCopy(account, current, person.id);
  const labelFor = savedNow && labelCode(savedNow.id);
  const saveState = isSaved ? 'saved' : account.patterns.length >= savedLimit(account) ? 'full' : 'can';

  // Where the guided measuring opens: the list of what to make, the next measurement a garment needs, or one to redo.
  const [stepsStart, setStepsStart] = useState<{ at: number; start?: StepsStart }>({ at: 0 });
  const openSteps = (start?: StepsStart) => {
    setStepsStart({ at: stepsStart.at + 1, start });
    setStep('steps');
  };
  /** "Choose another garment": the same list as when measuring. */
  const chooseGarment = () => openSteps({ kind: 'choose' });

  /** Switch garment, going straight to the measurements the new one still needs, one page each. */
  const switchGarment = (g: Garment, next: Partial<Saved> = {}, to: View = step, using: MeasurementValues = measured) => {
    setSaved({ ...saved, ...next, garment: g });
    const stays = to === 'style' || to === 'export';
    if (stays && !ready(using, saved.unit, g, form)) measureFor(g, using, form);
    else setStep(to);
  };

  /**
   * Not ready for this garment: take the measurements it still needs, one page each. When none are missing,
   * one of them fails a check, so open the list with the reason rather than going round the guided pages again.
   */
  const measureFor = (g: Garment, using: MeasurementValues, on: FormKind = form) => {
    const wrong = isComplete(using, g, on) && checkMeasurements(using, saved.unit, g, on).find((c) => c.level === 'error');
    if (wrong) sendToMeasure(`Check your ${g === 'tee' ? 'T-shirt' : g} measurements: ${wrong.message}`);
    else openSteps({ kind: 'for', garment: g });
  };

  // Why Style or Print didn't open while measuring, shown over the guided pages for a moment.
  const [stepsNote, setStepsNote] = useState<string>();
  useEffect(() => {
    if (!stepsNote) return;
    const t = setTimeout(() => setStepsNote(undefined), 4000);
    return () => clearTimeout(t);
  }, [stepsNote]);

  // Why someone landed on Measure when they asked for another screen; cleared once they move on.
  const [measureNote, setMeasureNote] = useState<string>();
  const sendToMeasure = (note: string) => {
    setMeasureNote(note);
    setStep('measure');
  };
  useEffect(() => {
    if (step !== 'measure') setMeasureNote(undefined);
    if (step !== 'steps') setStepsNote(undefined);
  }, [step]);

  /** Switch whose measurements are in use, going back to measuring when theirs aren't done for this garment. */
  const switchPerson = (id: string, to: View = step) => {
    const who = account.people.find((p) => p.id === id) ?? person;
    setAccount({ ...account, active: who.id });
    if ((to === 'style' || to === 'export') && !ready(who.values, saved.unit, garment, formOf(who))) measureFor(garment, who.values, formOf(who));
    else setStep(to);
  };

  /** Open a saved pattern: one saved for someone opens with their measurements. */
  const openPattern = (p: Account['patterns'][number]) => {
    const who = account.people.find((x) => x.id === p.personId) ?? person;
    setAccount({ ...account, active: who.id });
    setPhotoFor(undefined);
    styleChoices(p.choices, who.values);
  };

  /** Open the style screen with these choices, saved under their garment. */
  const styleChoices = (c: PatternChoices, using: MeasurementValues = measured) => {
    const [g, patch] = choicesPatch(c);
    switchGarment(g, patch, 'style', using);
  };

  const reset = () => {
    setSaved(INITIAL);
    setAccount(NEW_ACCOUNT);
    setStep('welcome');
  };

  /** The header's ←: one step back through history, like the phone's back. */
  const back = () => (canGoBack() ? goBack() : setStep(PARENT[step] ?? 'welcome'));

  /** A step in the header. Style and Print wait for the measurements, and say so. */
  const openStep = (to: Step) => {
    if (STEP_OF[step] === to && step !== 'photo' && step !== 'fitting' && step !== 'scale') return;
    if (to !== 'measure' && !canLeaveMeasure) {
      const why = `Measure first: the ${garment === 'tee' ? 'T-shirt' : garment} needs a few more measurements before it can be ${to === 'style' ? 'styled' : 'printed'}.`;
      if (step !== 'steps') sendToMeasure(why);
      else setStepsNote(why);
      return;
    }
    setStep(to);
  };

  const findForm = () => {
    const r = document.querySelector('.welcome-hero canvas')?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height, kind: form } : null;
  };

  return (
    <>
      {opening && (
        <LoadingScreen
          onDone={() => setOpening(false)}
          findForm={step === 'welcome' ? findForm : undefined}
          onHandoff={(drawn) => setFormStart(drawn ? 'drawn' : 'fresh')}
        />
      )}
      <PointEditContext.Provider value={pointEditing}>
      <div className="app" {...{ inert: opening ? '' : undefined }}>
        <header className={step === 'welcome' || step === 'link' ? 'topbar' : 'topbar steady'}>
          {step === 'welcome' || step === 'link' ? (
            <div className="brand">
              <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
                <rect x="2.5" y="2.5" width="27" height="27" fill="none" style={{ stroke: 'var(--gild)' }} strokeWidth="1" />
                <path d={BRAND_BLOCK} style={{ stroke: 'var(--gild)' }} strokeWidth="1" fill="none" strokeLinejoin="round" />
              </svg>
              <span>Maison Tracé</span>
            </div>
          ) : (
            <>
              <div className="steady-row">
                <button type="button" className="steady-back" aria-label="Back" onClick={back}>
                  ←
                </button>
                <nav aria-label="Steps" className="steps">
                  {STEPS.map((s) => {
                    const on = STEP_OF[step] === s.id;
                    const locked = s.id !== 'measure' && !canLeaveMeasure;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={on ? 'step on' : locked ? 'step locked' : 'step'}
                        aria-current={on ? 'step' : undefined}
                        title={locked ? 'Measure first' : undefined}
                        onClick={() => openStep(s.id)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </nav>
                <button
                  type="button"
                  className={step === 'account' ? 'avatar on' : 'avatar'}
                  aria-label={`Your account (${owner})`}
                  aria-current={step === 'account' ? 'page' : undefined}
                  onClick={() => setStep('account')}
                >
                  {/* Until you give your name, a figure rather than the "M" of "Me", which reads as someone else's initial. */}
                  {account.name.trim() ? (
                    owner[0].toUpperCase()
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                      <circle cx="9" cy="6" r="3.2" />
                      <path d="M2.5 16.5 C3.5 12.5 6 11 9 11 C12 11 14.5 12.5 15.5 16.5" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
              {SIDE[step] && (
                <p className="crumb">
                  {SIDE[step]![0]} › <span>{SIDE[step]![1]}</span>
                </p>
              )}
            </>
          )}
        </header>
        {(step === 'style' || step === 'collection') && <ChapterBand key="style" kind="selvedge" />}
        {(step === 'export' || step === 'imported' || step === 'formprint') && <ChapterBand key="print" kind="mat" />}

        <main className="main">
          {incoming?.kind === 'broken' && step === 'welcome' && (
            <p className="msg error" role="status">
              That measure link is incomplete. Ask for it to be sent again.
            </p>
          )}
          {step === 'link' && incoming?.kind === 'ask' && (
            <MeasureLinkScreen
              ask={incoming.ask}
              unit={saved.unit}
              onUnit={(unit) => setSaved({ ...saved, unit })}
              onKeep={(v) => setAccount(updatePerson(account, ME, { values: { ...account.people.find((p) => p.id === ME)!.values, ...v } }))}
            />
          )}
          {step === 'arrive' && arriving && (
            <MeasureArrivalScreen
              reply={arriving}
              account={account}
              unit={saved.unit}
              onName={(name) => setAccount({ ...account, name })}
              onSave={(a, id, open) => {
                // The numbers are in the book now, so a reload shouldn't offer them again.
                if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
                setAccount(open ? { ...a, active: id } : a);
                if (open) setStep('client');
              }}
            />
          )}
          {step === 'welcome' && (
            <WelcomeScreen
              formStart={formStart}
              form={form}
              onLegal={openLegal}
              onFinish={() => {
                setAccount({ ...account, onboarded: true, mode });
                setStep('steps');
              }}
            />
          )}
          {step === 'steps' && stepsNote && (
            <p className="msg steps-note" role="status">
              {stepsNote}
            </p>
          )}
          {step === 'steps' && (
            <MeasureStepsScreen
              key={stepsStart.at}
              start={stepsStart.start}
              onSomeoneElse={(name) => setAccount(addPerson(account, name))}
              theirs={person.id !== ME}
              form={form}
              onForm={(f) => setAccount(updatePerson(account, person.id, { form: f }))}
              garment={garment}
              unit={saved.unit}
              values={measured}
              onUnit={(unit) => setSaved({ ...saved, unit })}
              onValues={setValues}
              onDone={(g) => {
                countStep('measured', g);
                switchGarment(g, {}, 'style');
              }}
              onIdea={(c) => styleChoices(c)}
              onPhoto={() => setStep('photo')}
              onNews={() => openLegal('news')}
              onSkip={(g?: Garment) => {
                // Skip on the tape: try the app with the example measurements, under any already taken.
                const example = (Object.keys(EXAMPLE_VALUES) as MeasurementId[]).filter((id) => measured[id] === undefined);
                setAccount(updatePerson({ ...account, onboarded: true, mode }, person.id, { values: { ...EXAMPLE_VALUES, ...values }, example }));
                if (g && g !== garment) setSaved({ ...saved, garment: g });
                setStep('style');
              }}
            />
          )}
          {(step === 'privacy' || step === 'terms') && (
            <LegalScreen
              doc={step === 'privacy' ? PRIVACY : TERMS}
              otherLabel={step === 'privacy' ? TERMS.title : PRIVACY.title}
              onOther={() => openLegal(step === 'privacy' ? 'terms' : 'privacy')}
            />
          )}
          {(step === 'tester' || step === 'news') && (
            <SignupScreen kind={step} onOther={() => openLegal(step === 'tester' ? 'news' : 'tester')} onPrivacy={() => openLegal('privacy')} />
          )}
          {step === 'brands' && <BrandsScreen onPrivacy={() => openLegal('privacy')} />}
          {step === 'nights' && <NightsScreen onPrivacy={() => openLegal('privacy')} />}
          {step === 'photo' && plansShown() && <PhotoAllowance account={account} onPlans={openPlans} />}
          {step === 'photo' && canPhotoDraft(account) && (
            <PhotoScreen
              measured={canLeaveMeasure}
              body={canLeaveMeasure ? (values as SkirtMeasurements) : undefined}
              unit={saved.unit}
              onByHand={() => switchGarment('skirt', {}, 'style')}
              onApply={(choices, preview) => {
                if (BILLING_ON) setAccount(countPhotoDraft(account));
                const g = choicesPatch(choices)[0];
                countStep('photo', g);
                setPhotoPreview(preview);
                setPhotoFor(g);
                styleChoices(choices);
              }}
            />
          )}
          {step === 'plans' && <PlansScreen account={account} onBack={() => setStep(beforePlans)} />}
          {step === 'account' && (
            <AccountScreen
              onPlans={plansShown() ? openPlans : undefined}
              mode={mode}
              onMode={setMode}
              account={account}
              onLegal={openLegal}
              unit={saved.unit}
              onName={(name) => setAccount({ ...account, name })}
              onUnit={(unit) => setSaved({ ...saved, unit })}
              onEditMeasurements={() => setStep('measure')}
              onSwitchPerson={(id) => setAccount({ ...account, active: id })}
              onAddPerson={(name) => {
                setAccount(addPerson(account, name));
                setStep('measure');
              }}
              onRemovePerson={(id) => setAccount(removePerson(account, id))}
              onOpen={openPattern}
              onCheckFile={() => setStep('check')}
              onBodyDouble={() => setStep('form')}
              onClientBook={() => {
                setAccount(updatePerson(account, person.id, recordMeasurements(person, new Date().toISOString().slice(0, 10))));
                setStep('client');
              }}
              onRename={(id, name) => setAccount(renamePattern(account, id, name))}
              onRemove={(id) => setAccount(removePattern(account, id))}
              onFit={(id, fit) => setAccount(setPatternFit(account, id, fit))}
              onReset={reset}
              onBackup={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(makeBackup(saved, account), null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `pattern-maker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
              }}
              onRestore={async (file) => {
                const b = readBackup<Saved>(await file.text());
                if (!b) return false;
                setSaved({ ...INITIAL, ...b.skirt });
                setAccount({ ...NEW_ACCOUNT, ...b.account, onboarded: true });
                return true;
              }}
            />
          )}
          {step === 'measure' && (
            <MeasureScreen
              key={person.id}
              account={account}
              onSwitchPerson={(id) => switchPerson(id)}
              onAddPerson={(name) => setAccount(addPerson(account, name))}
              profile={profile}
              garment={garment}
              onChooseGarment={chooseGarment}
              unit={saved.unit}
              values={measured}
              checks={checks}
              canContinue={canLeaveMeasure}
              notice={measureNote}
              onMeasure={(ids) => openSteps({ kind: 'redo', garment, ids })}
              onChangeForm={() => openSteps({ kind: 'form' })}
              onNext={() => {
                countStep('measured', garment);
                setAccount(updatePerson(account, person.id, recordMeasurements(person, new Date().toISOString().slice(0, 10))));
                setStep('style');
              }}
            />
          )}
          {step === 'collection' && (
            <CollectionScreen
              values={values}
              onBack={() => setStep('style')}
              onMake={(look) => {
                const { garment: g, ...next } = lookPatch(look);
                switchGarment(g, { ...next, archive: archiveCut(look.id)?.id } as Partial<Saved>, 'style');
                window.scrollTo(0, 0);
              }}
            />
          )}
          {(step === 'style' || step === 'export') && !!person.example?.length && (
            // Skipped measuring: say so on Style and Print (Cat's K1 Example Tag, 2026-10-18). Measure me drops the
            // example's numbers and opens measuring from the start.
            <button
              type="button"
              className="example-tag"
              onClick={() => {
                const own = Object.fromEntries(Object.entries(measured).filter(([id]) => !person.example!.includes(id as MeasurementId)));
                setAccount(updatePerson(account, person.id, { values: own, example: [] }));
                openSteps();
              }}
            >
              <span>Drafted to an example body</span>
              <span className="example-tag-go">Measure me ›</span>
            </button>
          )}
          <CollectionLink.Provider value={step === 'style' ? () => { setStep('collection'); window.scrollTo(0, 0); } : undefined}>
          {step === 'style' && garment === 'skirt' && (
            <StyleScreen
              mode={mode}
              onMode={setMode}
              easeMap={ease}
              choices={saved.choices}
              onChoices={(choices) => setSaved({ ...saved, choices })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.skirt}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
              finish={finish}
              onFinish={setFinish}
              onPhoto={() => setStep('photo')}
              photo={photoPreview}
            />
          )}
          {step === 'style' && garment === 'bodice' && (
            <BodiceStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              finish={finish}
              onFinish={setFinish}
              easeMap={ease}
              choices={saved.bodice}
              onChoices={(bodice) => setSaved({ ...saved, bodice })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.bodice}
              sleeve={result.sleeve}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && garment === 'dress' && (
            <DressStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              finish={finish}
              onFinish={setFinish}
              easeMap={ease}
              choices={dress}
              onChoices={(d) => setSaved({ ...saved, dress: d })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.dress}
              sleeve={result.sleeve}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && garment === 'trousers' && (
            <TrousersStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              finish={finish}
              onFinish={setFinish}
              easeMap={ease}
              choices={trousersChoices}
              onChoices={(t) => setSaved({ ...saved, trousers: t })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.trousers}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && garment === 'tee' && (
            <TeeStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              choices={teeChoices}
              onChoices={(t) => setSaved({ ...saved, tee: t })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.tee}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && garment === 'lingerie' && (
            <LingerieStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              choices={lingerieChoices}
              onChoices={(l) => setSaved({ ...saved, lingerie: l })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.lingerie}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && isOuterGarment && (
            <OuterStyleScreen
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              key={garment}
              mode={mode}
              onMode={setMode}
              finish={finish}
              onFinish={(f) => setSaved({ ...saved, finish: f })}
              easeMap={ease}
              choices={outerChoices}
              onChoices={(c) => setSaved({ ...saved, [garment]: c })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.outer}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          </CollectionLink.Provider>
          {step === 'export' && !hasGarment(account, garment) && <UnlockGarment garment={garment} onPlans={openPlans} onBack={() => setStep('style')} />}
          {step === 'export' && hasGarment(account, garment) && (
            <ExportScreen
              mode={mode}
              onMode={setMode}
              garment={garment}
              profile={profile}
              title={title}
              fit={'fit' in current ? current.fit : 'close'}
              finish={finish}
              onFinish={setFinish}
              style={
                garment === 'jacket' || garment === 'coat'
                  ? { garment, fit: outerChoices.fit }
                  : garment === 'bodice'
                  ? { garment, fit: saved.bodice.fit, neckline: saved.bodice.neckline, structure: validDetails(saved.bodice).structure }
                  : garment === 'dress'
                    ? { garment, fit: dress.fit, neckline: dress.bodice.neckline, silhouette: dress.skirt.silhouette, length: dress.skirt.length, structure: validDetails(dress.bodice).structure, asymHem: dress.skirt.asymHem, pleats: dress.skirt.pleats, godets: dress.skirt.godets, flounce: dress.skirt.flounce }
                    : garment === 'trousers'
                      ? { garment, fit: trousersChoices.fit, leg: trousersChoices.leg }
                      : garment === 'tee'
                        ? { garment, fit: teeChoices.fit, stretch: teeChoices.stretch, neckline: teeChoices.neckline }
                      : garment === 'lingerie'
                        ? { garment, piece: lingerieChoices.piece, stretch: lingerieChoices.stretch }
                      : { garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length, asymHem: saved.choices.asymHem, pleats: saved.choices.pleats, godets: saved.choices.godets, flounce: saved.choices.flounce }
              }
              made={printable}
              error={result.error}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
              fitting={ownFitting}
              fittingNotes={[...describeFitting(ownFitting, garment), ...carriedNotes]}
              alterations={alterations}
              onFitting={() => setStep('fitting')}
              onTrueScale={() => setStep('scale')}
              values={values}
              draftAt={draftAt}
              credit={fromArchive?.credit}
              label={{ name: profile === 'Me' ? account.name : profile, code: labelFor }}
            />
          )}
          {step === 'check' && (
            <CheckFileScreen
              onUse={(pattern, fileName) => {
                setImported({ pattern, fileName });
                setStep('imported');
              }}
            />
          )}
          {step === 'imported' && !importedPrintable && <CheckFileScreen onUse={(pattern, fileName) => setImported({ pattern, fileName })} />}
          {step === 'imported' && importedPrintable && imported && (
            <ExportScreen
              mode={mode}
              onMode={setMode}
              garment={garment}
              profile={profile}
              title={importedTitle}
              fit="as drafted"
              finish={finish}
              onFinish={setFinish}
              style={{ garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length }}
              made={importedPrintable}
              saveState="can"
              onSave={() => undefined}
              onAccount={() => setStep('account')}
              fittingNotes={[]}
              onFitting={() => undefined}
              imported={{ source: imported.pattern.source, fileName: imported.fileName }}
            />
          )}
          {step === 'form' && (
            <FormScreen
              values={values}
              measured={measured}
              unit={saved.unit}
              profile={profile}
              onPrint={() => setStep('formprint')}
              onMeasure={() => openSteps({ kind: 'for', garment: 'dress' })}
            />
          )}
          {step === 'formprint' && coverPrintable && (
            // Printed like a pattern read from a file: no style, fabric check or toile of its own.
            <ExportScreen
              mode={mode}
              onMode={setMode}
              garment={garment}
              profile={profile}
              title="Form cover"
              fit="zero ease"
              finish={finish}
              onFinish={setFinish}
              style={{ garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length }}
              made={coverPrintable}
              saveState="can"
              onSave={() => undefined}
              onAccount={() => setStep('account')}
              fittingNotes={[]}
              onFitting={() => undefined}
              imported={{ fileName: `Drafted to ${profile === 'Me' ? 'you' : profile}` }}
            />
          )}
          {step === 'formprint' && !coverPrintable && (
            <FormScreen values={values} measured={measured} unit={saved.unit} profile={profile} onPrint={() => undefined} onMeasure={() => openSteps({ kind: 'for', garment: 'dress' })} />
          )}
          {step === 'client' && (
            <ClientBookScreen
              account={account}
              person={person}
              unit={saved.unit}
              onChange={(p) => setAccount(updatePerson(account, person.id, p))}
              onOpen={openPattern}
              garment={garment}
              onAccount={setAccount}
              onReply={(r) => {
                setArriving(r);
                setStep('arrive');
              }}
            />
          )}
          {step === 'scale' && printable && <TrueScaleScreen pieces={printable.pieces} />}
          {step === 'fitting' && (
            <FittingScreen
              key={`${person.id}-${garment}`}
              garment={garment}
              fitting={fitting}
              own={ownFitting}
              carried={carried.from}
              draftWith={draftWith}
              hasBustDart={garment === 'skirt' || garment === 'trousers' || isOuterGarment || (garment === 'dress' ? dress.bodice : saved.bodice).darts !== 'none'}
              onSave={(f, shown) => {
                const next = saveVersion(ownFitting, f, new Date().toISOString().slice(0, 10), shown);
                setAccount(updatePerson(account, person.id, { fittings: { ...person.fittings, [garment]: next } }));
                // Saved: back to the pattern it was opened from.
                if (canGoBack()) goBack();
                else setStep('export');
              }}
            />
          )}
        </main>
      </div>
      </PointEditContext.Provider>
    </>
  );
}
