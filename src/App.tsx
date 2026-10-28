import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { showInInches } from './units';
import { canGoBack, goBack, pushFresh, useViewHistory } from './nav';
import { DraftError, SkirtMeasurements } from './engine/skirt';
import { BodiceDraft } from './engine/bodice';
import { withAllowances } from './engine/allowances';
import { Fitting, carriedFitting, describeCarried, describeFitting, saveVersion, alterationSheet } from './engine/fitting';
import { layPlans } from './engine/layplan';
import { clothFor } from './engine/fabrics';
import { needsNap, withSpecialAllowances } from './engine/specialFabrics';
import { printNap, printOf } from './engine/prints';
import { layAmount } from './engine/layplan';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY, FormKind, Garment, MeasurementId, MeasurementValues, Unit, checkMeasurements, isComplete, isLowerBody, isOuterwear } from './measurements';
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
type Backup,
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
import { validDetails, PatternChoices } from './garments';
import type { Printable } from './screens/ExportScreen';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { CODE_MESSAGE, checkCode, hasAccess, rememberAccess, testerFromLink, withoutTester } from './access';
import { keepOffline } from './swUpdate';
import { preloadScreens, screen } from './screens/load';
import { FABRIC, openTabNext } from './ui/StyleLayout';
import { KeptCount } from './ui/SaveControl';
import { GARMENT_NAME } from './measureFlow';
import type { StepsStart } from './screens/MeasureStepsScreen';
import { useCloud } from './cloud/useCloud';
import { signinShown } from './cloud/flag';
import { LegalScreen } from './screens/LegalScreen';
import { PhotoAllowance, UnlockGarment } from './ui/PlanPrompts';
import { BILLING_ON, canPhotoDraft, countPhotoDraft, hasGarment, plansShown, savedLimit } from './plans';
import { countStep, setReportView } from './report/report';
import { PRIVACY, TERMS } from './legal';
import { readLink, type MeasureReply } from './measureLink';
import { isMoveLink, moveLink, readMoveLink } from './moveLink';
import { coverGuide, coverMissing, coverPieces, padMap } from './engine/formCover';
import { labelCode, savedCopy } from './labels';
import { fitSummary } from './fit';
import { ImportedPattern, importedGuide } from './engine/importDxf';
import { lookPatch } from './collection';
import { archiveCut } from './archive';
import { CollectionLink, ExampleTag, GarmentPick } from './ui/GarmentSwitch';
import { LoadingScreen } from './ui/LoadingScreen';
import type { FormStart } from './ui/ContourForm';
import type { Piece } from './engine/piece';
import { garmentEase } from './engine/easeMap';
import { PointEdit, applyPointEdits } from './engine/pointEdit';
import { PointEditContext } from './ui/PointEditor';

// The logo (Cat's pick F1 Loading Block): the loading screen's bodice block, drawn inside the header's square.
import { Mode, finishFor, keepFinish, modeOf } from './mode';

import { printableFor } from './printable';
import { GARMENT_DRAFTING, dressOf, lingerieChoicesOf, outerChoicesOf, skirtStyleOf, teeChoicesOf, trousersChoicesOf, type DraftInputs, type Drafts } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, choicesPatch, type Finish, type Saved } from './savedWork';
import { PhotoCheck } from './ui/PhotoCheck';
import type { PhotoSource } from './photo/check';
import { testerHeaders } from './ui/TesterCode';
import { NEEDS_MEASUREMENTS, PARENT, SIDE, STEPS, STEP_OF, ladder, type Step, type View } from './navigation';


const MeasureScreen = screen(() => import('./screens/MeasureScreen').then((m) => m.MeasureScreen));
const StyleScreen = screen(() => import('./screens/StyleScreen').then((m) => m.StyleScreen));
const BodiceStyleScreen = screen(() => import('./screens/BodiceStyleScreen').then((m) => m.BodiceStyleScreen));
const DressStyleScreen = screen(() => import('./screens/DressStyleScreen').then((m) => m.DressStyleScreen));
const TrousersStyleScreen = screen(() => import('./screens/TrousersStyleScreen').then((m) => m.TrousersStyleScreen));
const TeeStyleScreen = screen(() => import('./screens/TeeStyleScreen').then((m) => m.TeeStyleScreen));
const LingerieStyleScreen = screen(() => import('./screens/LingerieStyleScreen').then((m) => m.LingerieStyleScreen));
const OuterStyleScreen = screen(() => import('./screens/OuterStyleScreen').then((m) => m.OuterStyleScreen));
const AccountScreen = screen(() => import('./screens/AccountScreen').then((m) => m.AccountScreen));
const PhotoScreen = screen(() => import('./screens/PhotoScreen').then((m) => m.PhotoScreen));
const SignupScreen = screen(() => import('./screens/SignupScreen').then((m) => m.SignupScreen));
const BrandsScreen = screen(() => import('./screens/BrandsScreen').then((m) => m.BrandsScreen));
const NightsScreen = screen(() => import('./screens/NightsScreen').then((m) => m.NightsScreen));
const PlansScreen = screen(() => import('./screens/PlansScreen').then((m) => m.PlansScreen));
const FittingScreen = screen(() => import('./screens/FittingScreen').then((m) => m.FittingScreen));
const TrueScaleScreen = screen(() => import('./screens/TrueScaleScreen').then((m) => m.TrueScaleScreen));
const ClientBookScreen = screen(() => import('./screens/ClientBookScreen').then((m) => m.ClientBookScreen));
const MeasureLinkScreen = screen(() => import('./screens/MeasureLinkScreen').then((m) => m.MeasureLinkScreen));
const MeasureArrivalScreen = screen(() => import('./screens/MeasureArrivalScreen').then((m) => m.MeasureArrivalScreen));
const MoveArrivalScreen = screen(() => import('./screens/MoveArrivalScreen').then((m) => m.MoveArrivalScreen));
const CheckFileScreen = screen(() => import('./screens/CheckFileScreen').then((m) => m.CheckFileScreen));
const FormScreen = screen(() => import('./screens/FormScreen').then((m) => m.FormScreen));
const CollectionScreen = screen(() => import('./screens/CollectionScreen').then((m) => m.CollectionScreen));
const ExportScreen = screen(() => import('./screens/ExportScreen').then((m) => m.ExportScreen));
const MeasureStepsScreen = screen(() => import('./screens/MeasureStepsScreen').then((m) => m.MeasureStepsScreen));

const ready = (values: MeasurementValues, unit: Unit, garment: Garment, form?: FormKind) =>
  isComplete(values, garment, form) && !checkMeasurements(values, unit, garment, form).some((c) => c.level === 'error');

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the numbers (measuredKey), not the rebuilt object
  const values = useMemo(() => withEstimates(measured, form), [measuredKey, form]);
  // The last photo matched to a skirt, shown beside "Matched to your photo" while the app is open. Never saved.
  const [photoPreview, setPhotoPreview] = useState<string>();
  // The garment the photo was drafted as, so only that garment's style screen shows it.
  const [photoFor, setPhotoFor] = useState<Garment>();
  // The photo and its reading, for the self-check on the style screen just after drafting. Never saved.
  const [photoSource, setPhotoSource] = useState<PhotoSource>();
  // A measurement taken (changed from the example body's) is no longer the example's.
  const setValues = (v: MeasurementValues, helped?: MeasurementId[]) =>
    setAccount(updatePerson(account, person.id, { values: v, example: person.example?.filter((id) => v[id] === measured[id]), ...(helped ? { helped } : {}) }));
  const { garment } = saved;
  // Every visit opens on the welcome screen (Cat's pick, 2026-10-16). Saved measurements and
  // patterns are kept, and once measured the welcome's button carries straight on with the garment.
  // Screens live in the browser's history, so phone and browser back step back through the app. Landing back
  // on a pattern screen whose measurements have since gone sends you to Measure instead.
  // A measure-me link opened here: a client's ask to measure, or a client's numbers coming back to their dressmaker.
  const [incoming] = useState(() => readLink(window.location.hash));
  const [arriving, setArriving] = useState<MeasureReply | undefined>(incoming?.kind === 'reply' ? incoming.reply : undefined);
  // A link opened while the app is already showing (a pasted address, a second tap) starts over from it.
  useEffect(() => {
    const on = () => {
      if (readLink(window.location.hash) || isMoveLink(window.location.hash)) window.location.reload();
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // Working in inches: every length written on screen is rewritten as it appears (see units.ts).
  useEffect(() => {
    if (saved.unit !== 'in') return;
    return showInInches(document.body);
  }, [saved.unit]);
  // A "Send to my computer" link: everything from the sewist's other device, read once the page is up.
  const [moving, setMoving] = useState<Backup<Saved> | 'broken'>();
  useEffect(() => {
    readMoveLink<Saved>(window.location.hash).then((b) => b && setMoving(b));
  }, []);
  const dropHash = () => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  };
  /** Everything here, put back from a backup, a move link or the signed-in account. */
  const applyBackup = (b: Backup<Saved>) => {
    setSaved({ ...INITIAL, ...b.skirt });
    setAccount({ ...NEW_ACCOUNT, ...b.account, onboarded: true });
    if (b.pointEdits) setPointEdits(b.pointEdits as Record<string, PointEdit[]>);
  };
  // Sign-in (Cat's plan, 2026-10-23): held behind ?signin=preview until the December fix week.
  const cloud = useCloud(makeBackup(saved, account, pointEdits), applyBackup, signinShown);
  /** The link that carries everything on this device to another one. */
  const sendLink = () => moveLink(window.location.origin, makeBackup(saved, account, pointEdits));
  const [startView] = useState<View>(incoming?.kind === 'ask' ? 'link' : incoming?.kind === 'reply' ? 'arrive' : isMoveLink(window.location.hash) ? 'move' : 'welcome');
  const [step, setStep] = useViewHistory<View>(startView, (to) => (NEEDS_MEASUREMENTS.includes(to) && !canLeaveMeasure ? 'measure' : to), ladder);
  const openLegal = (page: 'privacy' | 'terms' | 'tester' | 'news' | 'brands' | 'nights') => setStep(page);
  // The waitlist (Cat's W1, 2026-10-21): until launch, a visitor without a tester link sees the welcome with a waitlist
  // where Begin was, and the Privacy and Terms pages, nothing else. Measure-me and move links still open, as they
  // come from someone already using the app.
  const [access, setAccess] = useState(() => hasAccess(storedAccount.testerCode));
  const gated = !access && !storedAccount.testerCode && startView === 'welcome';
  // "Checking your tester link…" from the first frame when a link carries a code, so the welcome never sits bare.
  const [linkCheck, setLinkCheck] = useState<{ checking?: boolean; message?: string }>(() => (testerFromLink(window.location.search) && !hasAccess(storedAccount.testerCode) ? { checking: true } : {}));
  const linkCode = useRef<string>();
  /** Checks the link's code; a check that couldn't reach the server is tried once more by itself, then offers Try again. */
  const checkLink = async (code: string) => {
    setLinkCheck({ checking: true });
    let r = await checkCode(code);
    if (r === 'failed') {
      await new Promise((done) => setTimeout(done, 1500));
      r = await checkCode(code);
    }
    if (r === 'tester') {
      letIn(code);
      setLinkCheck({});
    } else setLinkCheck({ message: r === 'wrong' ? "That tester link isn't working. Check the email it came in, or type the code here." : CODE_MESSAGE[r] });
  };
  const letIn = (code: string) => {
    rememberAccess();
    setAccess(true);
    if (!storedAccount.testerCode) setAccount({ ...storedAccount, testerCode: code });
  };
  useEffect(() => {
    if (gated && step !== 'welcome' && step !== 'privacy' && step !== 'terms') setStep('welcome');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setStep is rebuilt each render; the effect only follows gated and step
  }, [gated, step]);
  useEffect(() => {
    if (gated) return;
    keepOffline();
    preloadScreens();
  }, [gated]);
  // A tester link (?tester=TOILE-ONE): checked once, then the code leaves the address bar.
  useEffect(() => {
    const code = testerFromLink(window.location.search);
    if (!code) return;
    window.history.replaceState(window.history.state, '', withoutTester(window.location.pathname, window.location.search, window.location.hash));
    if (access) return;
    linkCode.current = code;
    void checkLink(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const checks = checkMeasurements(measured, saved.unit, garment, form, { weight: person.weight });
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
  const fabric = finish.fabric;
  // What every garment drafts from (see garmentDrafts.ts), and the open garment's entry in the catalogue.
  const inputs = useMemo(
    (): DraftInputs => ({
      saved: { choices: saved.choices, bodice: saved.bodice, dress: saved.dress, trousers: saved.trousers, tee: saved.tee, lingerie: saved.lingerie, jacket: saved.jacket, coat: saved.coat },
      form,
      fabric,
    }),
    [saved.choices, saved.bodice, saved.dress, saved.trousers, saved.tee, saved.lingerie, saved.jacket, saved.coat, form, fabric],
  );
  const drafting = GARMENT_DRAFTING[garment];
  const skirtStyle = useMemo(() => skirtStyleOf(inputs, fitting), [inputs, fitting]);
  const dress = useMemo(() => dressOf(inputs.saved), [inputs]);
  const trousersChoices = trousersChoicesOf(saved);
  const teeChoices = teeChoicesOf(saved);
  const lingerieChoices = lingerieChoicesOf(saved);
  const isOuterGarment = isOuterwear(garment);
  const outerChoices = useMemo(() => outerChoicesOf(inputs.saved, garment === 'coat' ? 'coat' : 'jacket'), [inputs, garment]);

  const drafts = useMemo((): Drafts & { error?: string; crash?: boolean } => {
    if (!canLeaveMeasure) return {};
    try {
      return drafting.draft(values, inputs, fitting);
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.', crash: !(e instanceof DraftError) };
    }
  }, [values, inputs, fitting, drafting, canLeaveMeasure]);

  // A draft that crashes (not a DraftError, which is a message for the maker) is a saved choice the engine no longer
  // knows, from an older release or a mistyped value: those choices go back to the garment's defaults, and the app
  // carries on, rather than every screen showing "Something went wrong".
  useEffect(() => {
    if (!drafts.crash) return;
    if (Object.keys(drafting.reset).length) setSaved({ ...saved, ...drafting.reset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

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
          return drafting.piecesWith(values, inputs, f);
        } catch {
          return undefined;
        }
      },
    [drafting, values, inputs],
  );

  /** The pattern's main pieces with allowances, drafted to any measurements: for grading a size run. */
  const draftAt = useMemo(
    () =>
      (m: MeasurementValues): Piece[] => {
        const allowance = (saved.finish ?? DEFAULT_FINISH).allowances;
        const special = (saved.finish ?? DEFAULT_FINISH).fabric?.special;
        return drafting.graded(m, inputs, fitting, (pcs) => pcs.map((pc) => withSpecialAllowances(withAllowances(pc, allowance), special)));
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the two finish fields the grading reads
    [drafting, inputs, fitting, saved.finish?.allowances, saved.finish?.fabric?.special],
  );

  const current = drafting.choices(inputs.saved);
  const title = drafting.title(inputs.saved);

  const drafted = useMemo(
    () => printableFor({ result, values, finish, fabric, garment, ownFitting, carriedNotes, saved, dress, skirtStyle, trousersChoices }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, saved.choices, saved.bodice, dress, skirtStyle, values, finish.allowances, finish.skirtLined, finish.bodiceEdges, finish.fabricWidth, finish.nap, finish.route, finish.cloth, fabric, fitting, ownFitting, carriedNotes, garment],
  );
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
      lays: layPlans(pieces, finish.fabricWidth, finish.nap || needsNap(finish.fabric?.special) || printNap(printOf(finish.fabric)), false, false, printOf(finish.fabric) === 'border'),
    };
  }, [imported, finish.fabricWidth, finish.nap, finish.fabric]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the numbers (measuredKey), not the rebuilt object
  }, [step, values, measuredKey, finish.fabricWidth]);
  const importedTitle = imported ? imported.pattern.style || imported.fileName.replace(/\.dxf$/i, '') : '';

  const isSaved = isSavedFor(account, current, person.id);
  // The saved copy's label code, printed on signature labels; typing it on Account opens the pattern again.
  const savedNow = savedCopy(account, current, person.id);
  const labelFor = savedNow && labelCode(savedNow.id);
  const saveState = isSaved ? 'saved' : account.patterns.length >= savedLimit(account) ? 'full' : 'can';

  // "How did it fit?" from the print screen: the pattern is kept (if it can be) and its fit notes open on Your account.
  const [fitFocus, setFitFocus] = useState<string>();
  const openFitNotes = () => {
    const next = saveState === 'can' ? savePattern(account, current, describePattern(current), person.id) : account;
    const kept = savedNow ?? (saveState === 'can' ? next.patterns[0] : undefined);
    if (!kept) return;
    if (next !== account) setAccount(next);
    setFitFocus(kept.id);
    setStep('account');
  };
  useEffect(() => {
    if (step !== 'account') setFitFocus(undefined);
  }, [step]);

  // Where the guided measuring opens: the list of what to make, the next measurement a garment needs, or one to redo.
  const [stepsStart, setStepsStart] = useState<{ at: number; start?: StepsStart }>({ at: 0 });
  const openSteps = (start?: StepsStart) => {
    setStepsStart({ at: stepsStart.at + 1, start });
    // Opened again from one of its own pages (a described idea, say): a fresh start on top, so back returns to that page.
    if (step === 'steps') pushFresh();
    else setStep('steps');
  };
  /** Measure me, from the example tag or the print question: drops the example's numbers and opens measuring from
   *  the start. */
  const measureMe = () => {
    const own = Object.fromEntries(Object.entries(measured).filter(([id]) => !person.example?.includes(id as MeasurementId)));
    setAccount(updatePerson(account, person.id, { values: own, example: [] }));
    openSteps();
  };
  // Skipped measuring: say so on Style and Print (Cat's K1 Example Tag, 2026-10-18). Measure me drops the
  // example's numbers and opens measuring from the start.
  const exampleTag = !!person.example?.length && (
    <button type="button" className="example-tag" onClick={measureMe}>
      <span>Drafted to an example body</span>
      <span className="example-tag-go">Measure me ›</span>
    </button>
  );
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
  const styleChoices = (c: PatternChoices, using: MeasurementValues = measured, extra: Partial<Saved> = {}) => {
    const [g, patch] = choicesPatch(c);
    switchGarment(g, { ...patch, ...extra }, 'style', using);
  };

  const reset = async () => {
    // Signed in, the account keeps its copy: sign out before clearing, or the empty device would be saved over it.
    if (cloud.user) await cloud.signOut().catch(() => undefined);
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
      // A line, not a box over the headline, and no garment named (none may be chosen yet) (look and feel review, 2026-10-24).
      const why = 'Style and Print open once your measurements are in.';
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
        <header className={step === 'welcome' || step === 'link' || gated ? 'topbar' : 'topbar steady'}>
          {gated && step !== 'welcome' ? (
            <div className="brand">
              <button type="button" className="steady-back" aria-label="Back" onClick={back}>
                ←
              </button>
              <span>Maison Tracé</span>
            </div>
          ) : step === 'welcome' || step === 'link' || gated ? (
            <div className="brand">
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

        <main className="main">
          <Suspense fallback={null}>
          <KeptCount.Provider value={{ kept: account.patterns.length, limit: savedLimit(account) }}>
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
          {step === 'move' && moving && (
            <MoveArrivalScreen
              backup={moving}
              here={account}
              hereMeasured={Object.keys(measured).length}
              onBring={(b) => {
                // Brought in, so a reload shouldn't offer it again.
                dropHash();
                setSaved({ ...INITIAL, ...(b.skirt as Partial<Saved>) });
                setAccount({ ...NEW_ACCOUNT, ...b.account, onboarded: true });
                if (b.pointEdits) setPointEdits(b.pointEdits as Record<string, PointEdit[]>);
              }}
              onCarryOn={() => setStep(canLeaveMeasure ? 'export' : 'measure')}
              onNotNow={() => {
                dropHash();
                setStep('welcome');
              }}
            />
          )}
          {step === 'welcome' && (
            <WelcomeScreen
              formStart={formStart}
              form={form}
              onLegal={openLegal}
              waitlist={gated ? { onCode: letIn, checking: linkCheck.checking, linkMessage: linkCheck.message, onRetry: linkCode.current && linkCheck.message === CODE_MESSAGE.failed ? () => void checkLink(linkCode.current!) : undefined } : undefined}
              onFinish={() => {
                setAccount({ ...account, onboarded: true, mode });
                setStep('steps');
              }}
              resume={
                account.onboarded && canLeaveMeasure
                  ? { garment: GARMENT_NAME[garment], onResume: () => setStep('style'), onSaved: () => setStep('account'), onNew: chooseGarment }
                  : undefined
              }
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
              testerCode={account.testerCode}
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
              helped={person.helped}
              weight={person.weight}
              onWeight={(weight) => setAccount(updatePerson(account, person.id, { weight }))}
              onDone={(g) => {
                countStep('measured', g);
                switchGarment(g, {}, 'style');
              }}
              onIdea={(c) => styleChoices(c)}
              onPhoto={() => setStep('photo')}
              onNews={() => openLegal('news')}
              onLater={() => setStep('welcome')}
              onSkip={(g?: Garment) => {
                // Skip on the tape: try the app with the example measurements, under any already taken.
                const example = (Object.keys(EXAMPLE_BODY) as MeasurementId[]).filter((id) => measured[id] === undefined);
                setAccount(updatePerson({ ...account, onboarded: true, mode }, person.id, { values: { ...EXAMPLE_BODY, ...values }, example }));
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
              testerCode={account.testerCode}
              measured={canLeaveMeasure}
              body={canLeaveMeasure ? (values as SkirtMeasurements & { arm_length?: number }) : undefined}
              unit={saved.unit}
              onByHand={() => switchGarment('skirt', {}, 'style')}
              onApply={(choices, preview, fabric, source) => {
                setPhotoSource(source);
                if (BILLING_ON) setAccount(countPhotoDraft(account));
                const g = choicesPatch(choices)[0];
                countStep('photo', g);
                setPhotoPreview(preview);
                setPhotoFor(g);
                // The cloth the photo showed goes with the style, so the drawing opens in it.
                styleChoices(choices, measured, fabric ? { finish: keepFinish(storedFinish, { ...finish, fabric, cloth: clothFor(fabric, finish.cloth) }, mode) } : {});
              }}
            />
          )}
          {step === 'plans' && <PlansScreen account={account} onBack={() => setStep(beforePlans)} />}
          {step === 'account' && (
            <AccountScreen
              onPlans={plansShown() ? openPlans : undefined}
              cloud={cloud.usable ? cloud : undefined}
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
              openFit={fitFocus}
              onReset={reset}
              sendLink={sendLink}
              onTesterCode={(testerCode) => setAccount({ ...account, testerCode })}
              onBackup={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(makeBackup(saved, account, pointEdits), null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `pattern-maker-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
              }}
              onRestore={async (file) => {
                const b = readBackup<Saved>(await file.text());
                if (!b) return false;
                applyBackup(b);
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
          {/* On Style it sits under the garment's name (Cat's K3, 2026-10-28), so StyleLayout draws it. */}
          {step === 'export' && exampleTag}
          <ExampleTag.Provider value={step === 'style' ? exampleTag : undefined}>
          <CollectionLink.Provider value={step === 'style' ? () => { setStep('collection'); window.scrollTo(0, 0); } : undefined}>
          {/* Switched in place from the title's drop-down: no new step in history, so ← still leaves the style screen. */}
          <GarmentPick.Provider value={step === 'style' ? { garment, onSwitch: (g) => (ready(measured, saved.unit, g, form) ? setSaved({ ...saved, garment: g }) : switchGarment(g, {}, 'style')) } : undefined}>
          {step === 'style' && photoSource && photoFor === garment && (
            <PhotoCheck
              source={photoSource}
              current={current}
              body={values as { waist_to_floor?: number; arm_length?: number }}
              headers={testerHeaders(account.testerCode)}
              onChoices={(c) => setSaved({ ...saved, ...choicesPatch(c)[1] })}
            />
          )}
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
              onFabric={(f) => setFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })}
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
              onFabric={(f) => setFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })}
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
          </GarmentPick.Provider>
          </CollectionLink.Provider>
          </ExampleTag.Provider>
          {step === 'export' && !hasGarment(account, garment) && <UnlockGarment garment={garment} onPlans={openPlans} onBack={() => setStep('style')} />}
          {step === 'export' && hasGarment(account, garment) && (
            <ExportScreen
              example={!!person.example?.length}
              onMeasureMe={measureMe}
              unit={saved.unit}
              paper={saved.paper}
              onPaper={(paper) => setSaved({ ...saved, paper })}
              sendLink={sendLink}
              mode={mode}
              onMode={setMode}
              onEditFabric={() => {
                openTabNext(FABRIC);
                setStep('style');
              }}
              onKeep={saveState === 'can' ? () => setAccount(savePattern(account, current, describePattern(current), person.id)) : undefined}
              onFitNotes={saveState === 'full' && !savedNow ? undefined : openFitNotes}
              fitNote={savedNow?.fit ? fitSummary(savedNow.fit, savedNow.choices) : undefined}
              garment={garment}
              profile={profile}
              title={title}
              fit={'fit' in current ? current.fit : 'close'}
              finish={finish}
              onFinish={setFinish}
              style={
                isOuterGarment
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
              unit={saved.unit}
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
              unit={saved.unit}
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
              hasBustDart={isLowerBody(garment) || isOuterGarment || (garment === 'dress' ? dress.bodice : saved.bodice).darts !== 'none'}
              onSave={(f, shown) => {
                const next = saveVersion(ownFitting, f, new Date().toISOString().slice(0, 10), shown);
                setAccount(updatePerson(account, person.id, { fittings: { ...person.fittings, [garment]: next } }));
                // Saved: back to the pattern it was opened from.
                if (canGoBack()) goBack();
                else setStep('export');
              }}
            />
          )}
        </KeptCount.Provider>
          </Suspense>
        </main>
      </div>
      </PointEditContext.Provider>
    </>
  );
}
