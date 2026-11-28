import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { showInInches } from './units';
import { canGoBack, goBack, pushFresh, useViewHistory } from './nav';
import { noSeamAllowed } from './engine/dress';
import { DraftError, SkirtMeasurements } from './engine/skirt';
import { BodiceDraft } from './engine/bodice';
import { withAllowances } from './engine/allowances';
import { pickBody } from './engine/body';
import { Fitting, carriedFitting, describeCarried, describeFitting, saveVersion, alterationSheet } from './engine/fitting';
import { layPlans } from './engine/layplan';
import { FabricStyle, clothFor } from './engine/fabrics';
import { FabricStyleOf } from './ui/FabricHeadsUp';
import { needsNap, withSpecialAllowances } from './engine/specialFabrics';
import { printNap, printOf } from './engine/prints';
import { layAmount } from './engine/layplan';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY, FormKind, Garment, MeasurementId, MeasurementValues, Unit, checkMeasurements, isComplete, isLowerBody, isOuterwear } from './measurements';
import { fillMissing, usePersistent } from './store';
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
import { MENSWEAR_JACKET_CHOICES, MENSWEAR_TROUSERS_CHOICES, validDetails, PatternChoices, outerWord, unusedFor } from './garments';
import type { Printable } from './screens/ExportScreen';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { CODE_MESSAGE, checkCode, hasAccess, rememberAccess, testerFromLink, withoutTester } from './access';
import { cleanCode } from './photo/limit';
import { atNewScreen, keepOffline } from './swUpdate';
import { preloadScreens, screen } from './screens/load';
import { FABRIC, StartOver, openLookNext, openTabNext } from './ui/StyleLayout';
import { fabricReturning, leavePrintForFabric, openCutNext } from './ui/printReturn';
import { KeptCount } from './ui/SaveControl';
import { GARMENT_NAME, baseDone, forgetMeasuringFor, leftPartway } from './measureFlow';
import { namesToHide } from './help/pin';
import type { AfterMeasuring, PageKind, StepsStart } from './screens/MeasureStepsScreen';
import { mergeBackups } from './cloud/merge';
import { useCloud } from './cloud/useCloud';
import { useFounding } from './cloud/useFounding';
import { EARLY_ACCESS_FROM, earlyAccessOpen } from './founding';
import { signinShown } from './cloud/flag';
import { LegalScreen } from './screens/LegalScreen';
import { PhotoAllowance, UnlockGarment } from './ui/PlanPrompts';
import { BILLING_ON, GARMENT_NAMES, canPhotoDraft, countPhotoDraft, hasGarment, plansShown, savedLimit } from './plans';
import { countStep, reportCrash, setReportView } from './report/report';
import { PRIVACY, TERMS, legalPath } from './legal';
import { readLink, type MeasureReply } from './measureLink';
import { isMoveLink, moveLink, readMoveLink } from './moveLink';
import { coverGuide, coverMissing, coverPieces, padMap } from './engine/formCover';
import { labelCode, savedCopy } from './labels';
import { fitSummary } from './fit';
import { ImportedPattern, importedGuide } from './engine/importDxf';
import { COLLECTION, HouseLook, TESTER_LOOK, lookArmsMissing, lookDropsLength, lookPatchKeeping, lookFabric, lookHipMissing, lookNameOf, lookPatch, lookResized, lookValues } from './collection';
import { archiveCut } from './archive';
import { CollectionLink, ExampleTag, GarmentPick, LookName, TesterLook } from './ui/GarmentSwitch';
import { UnitNow } from './ui/LengthEntry';
import { LoadingScreen } from './ui/LoadingScreen';
import type { FormStart } from './ui/ContourForm';
import type { Piece } from './engine/piece';
import { garmentEase } from './engine/easeMap';
import { PatternEdit, applyPatternEdits } from './engine/pieceEdit';
import { PointEditContext } from './ui/PointEditor';
import { DemoGarment } from './ui/demoKinds';

// The logo (Cat's pick F1 Loading Block): the loading screen's bodice block, drawn inside the header's square.
import { Mode, finishFor, keepFinish, modeOf } from './mode';

import { printableFor } from './printable';
import { GARMENT_DRAFTING, dressOf, hoodieChoicesOf, jumpsuitChoicesOf, knitDressChoicesOf, lingerieChoicesOf, outerChoicesOf, skirtStyleOf, teeChoicesOf, trousersChoicesOf, trousersStyleOf, type DraftInputs, type Drafts } from './garmentDrafts';
import { isRangeGarment, rangeSlot, teeFitOf } from './garmentRange';
import { DEFAULT_FINISH, INITIAL, choicesPatch, type Finish, type Saved } from './savedWork';
import { PhotoCheck } from './ui/PhotoCheck';
import type { PhotoSource } from './photo/check';
import type { PhotoBody } from './photo/garments';
import { testerHeaders } from './ui/TesterCode';
import { NEEDS_MEASUREMENTS, PARENT, PLACE_KEY, STEPS, STEP_OF, UNDER_ACCOUNT, ladder, type Step, type View } from './navigation';


/** The screens a reload may open again. */
/** The chapter a finished pattern was last on, for Carry on. */
const CHAPTER_KEY = 'maison-trace-chapter';
const lastChapter = (): View => {
  try {
    return localStorage.getItem(CHAPTER_KEY) === 'sew' ? 'sew' : 'export';
  } catch {
    return 'export';
  }
};
const RESTORABLE: View[] = ['measure', 'steps', 'style', 'export', 'sew', 'account', 'collection'];

const MeasureScreen = screen(() => import('./screens/MeasureScreen').then((m) => m.MeasureScreen));
const StyleScreen = screen(() => import('./screens/StyleScreen').then((m) => m.StyleScreen));
const BodiceStyleScreen = screen(() => import('./screens/BodiceStyleScreen').then((m) => m.BodiceStyleScreen));
const DressStyleScreen = screen(() => import('./screens/DressStyleScreen').then((m) => m.DressStyleScreen));
const TrousersStyleScreen = screen(() => import('./screens/TrousersStyleScreen').then((m) => m.TrousersStyleScreen));
const TeeStyleScreen = screen(() => import('./screens/TeeStyleScreen').then((m) => m.TeeStyleScreen));
const RangeStyleScreen = screen(() => import('./screens/RangeStyleScreen').then((m) => m.RangeStyleScreen));
const LingerieStyleScreen = screen(() => import('./screens/LingerieStyleScreen').then((m) => m.LingerieStyleScreen));
const OuterStyleScreen = screen(() => import('./screens/OuterStyleScreen').then((m) => m.OuterStyleScreen));
const SewScreen = screen(() => import('./screens/SewScreen').then((m) => m.SewScreen));
const CutPart = screen(() => import('./screens/CutPart').then((m) => m.CutPart));
const WrittenSteps = screen(() => import('./ui/WrittenSteps').then((m) => m.WrittenSteps));
const AccountScreen = screen(() => import('./screens/AccountScreen').then((m) => m.AccountScreen));
const PhotoScreen = screen(() => import('./screens/PhotoScreen').then((m) => m.PhotoScreen));
const SignupScreen = screen(() => import('./screens/SignupScreen').then((m) => m.SignupScreen));
const BrandsScreen = screen(() => import('./screens/BrandsScreen').then((m) => m.BrandsScreen));
const NightsScreen = screen(() => import('./screens/NightsScreen').then((m) => m.NightsScreen));
const MadeScreen = screen(() => import('./screens/MadeScreen').then((m) => m.MadeScreen));
const HelpScreen = screen(() => import('./screens/HelpScreen').then((m) => m.HelpScreen));
const PinNotes = screen(() => import('./ui/PinNotes').then((m) => m.PinNotes));
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

/** Where each garment past the skirt, bodice and dress keeps its choices in the saved work. */
const SLOT: Partial<Record<Garment, keyof Saved>> = { trousers: 'trousers', tee: 'tee', knit_dress: 'knitDress', hoodie: 'hoodie', jumpsuit: 'jumpsuit', lingerie: 'lingerie', jacket: 'jacket', coat: 'coat' };

/** The measurement checks, less "is needed" for what this design doesn't use (`skip`: a vest's arms). */
const checksFor = (values: MeasurementValues, unit: Unit, garment: Garment, form?: FormKind, skip: readonly MeasurementId[] = [], body?: Parameters<typeof checkMeasurements>[4]) =>
  checkMeasurements(values, unit, garment, form, body).filter((c) => !(skip.includes(c.id) && values[c.id] === undefined));
const ready = (values: MeasurementValues, unit: Unit, garment: Garment, form?: FormKind, skip: readonly MeasurementId[] = []) =>
  isComplete(values, garment, form, skip) && !checksFor(values, unit, garment, form, skip).some((c) => c.level === 'error');

/** A vest (a jacket without sleeves) isn't drafted from the arms, so they're neither asked nor needed: the Black Vest
 *  asked arm length and upper arm (fit-test walk, Nov 15). Saved jackets without a sleeve setting have sleeves. */
const vestOf = (g: Garment, s: Pick<Saved, 'jacket'>) => g === 'jacket' && !!s.jacket && outerWord(s.jacket) === 'vest';
const skipFor = (g: Garment, s: Pick<Saved, 'jacket' | 'dress'>): MeasurementId[] => (g === 'jacket' ? unusedFor(s.jacket) : g === 'dress' ? unusedFor(s.dress) : []);

export default function App() {
  const [saved, setSaved] = usePersistent<Saved>('skirt', INITIAL);
  /** The saved work as it is now, for an Undo tapped after other changes (Back to the original style's). */
  const latestSaved = useRef(saved);
  latestSaved.current = saved;
  const [storedAccount, setAccount] = usePersistent<Account>('account', NEW_ACCOUNT);
  // The account as it is now, for a change that lands after a wait (a tester link checked on a device already in).
  const latestAccount = useRef(storedAccount);
  latestAccount.current = storedAccount;
  // Points moved on the flat pattern, per garment (see engine/pointEdit.ts).
  const [pointEdits, setPointEdits] = usePersistent<Record<string, PatternEdit[]>>('point-edits', {});
  const account = withPeople(storedAccount, saved.values);
  const person = activePerson(account);
  // What was measured, for the measuring screens and the checks; patterns are drafted from `values`, which
  // fills in any upper-body measurement not taken yet with an estimate (see estimate.ts).
  const measured = person.values;
  const measuredKey = JSON.stringify(measured);
  // The dress form their patterns are drafted on: the menswear form drafts with no bust shaping.
  const form = formOf(person);
  // Every 3D view draws their form's body (body.ts): on the menswear form, a man's. Picked as the app draws, before
  // any view below reads it.
  pickBody(form);
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
  // A "Print from my computer" link (Send to my computer until Nov 28): everything from the sewist's other device, read once the page is up.
  const [moving, setMoving] = useState<Backup<Saved> | 'broken'>();
  useEffect(() => {
    readMoveLink<Saved>(window.location.hash).then((b) => b && arrive(b));
  }, []);
  /** A move link from a device that was let in carries its tester code: once the code checks out, this one is let in
   *  too, brought or not, so the computer doesn't show the waitlist next time (pretend tester, Nov 18). A link is only
   *  packed text, so the code is checked like a typed one, and one that can't be checked lets nothing in. */
  const arrive = (b: Backup<Saved> | 'broken') => {
    const code = b !== 'broken' ? b.account.testerCode : undefined;
    if (code)
      void checkCode(code).then((r) => {
        if (r !== 'tester') return;
        rememberAccess();
        setAccess(true);
      });
    setMoving(b);
  };
  const dropHash = () => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  };
  /** Everything here, put back from a backup, a move link or the signed-in account. */
  const applyBackup = (b: Backup<Saved>) => {
    setSaved(fillMissing(INITIAL, b.skirt));
    setAccount({ ...NEW_ACCOUNT, ...b.account, onboarded: true });
    // Every moved point is replaced, none kept: a copy with none moved means none (the review, Nov 10: removing every
    // moved point on one device left them on the other).
    setPointEdits((b.pointEdits ?? {}) as Record<string, PatternEdit[]>);
  };
  // Sign-in (Cat's plan, 2026-10-23): held behind ?signin=preview until the December fix week.
  const cloud = useCloud(makeBackup(saved, account, pointEdits), applyBackup, signinShown, () => makeBackup(INITIAL, NEW_ACCOUNT));
  const [founding, retryFounding] = useFounding(cloud.user);
  // Early access opens at midnight on Mar 16: a page left open across it lets a signed-in member in without a reload.
  const [earlyOpen, setEarlyOpen] = useState(earlyAccessOpen);
  useEffect(() => {
    const wait = EARLY_ACCESS_FROM.getTime() - Date.now();
    if (earlyOpen || wait > 2 * 86_400_000) return;
    const t = setTimeout(() => setEarlyOpen(true), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [earlyOpen]);
  /** The link that carries everything on this device to another one. */
  const sendLink = () => moveLink(window.location.origin, makeBackup(saved, account, pointEdits));
  // maisontrace.co/privacy and /terms open those pages straight away: Google's sign-in setup needs a web address for
  // each, and so will anyone who links to them.
  // Where the sewist was, for this tab only: a reload, or the phone dropping the page in the background while the tape
  // is fetched, opens there again instead of the welcome (journey review, Nov 10). A new visit still starts at the welcome.
  const [restore] = useState<View | undefined>(() => {
    try {
      // Only a reload (or Back into the page) reopens the place: typing the address again or a fresh link is a new visit.
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.type !== 'reload' && nav.type !== 'back_forward') return undefined;
      const v = sessionStorage.getItem(PLACE_KEY) as View | null;
      return v && RESTORABLE.includes(v) && !window.location.hash && !legalPath(window.location.pathname) && !new URLSearchParams(window.location.search).has('go') ? v : undefined;
    } catch {
      return undefined;
    }
  });
  const [startView] = useState<View>(incoming?.kind === 'ask' ? 'link' : incoming?.kind === 'reply' ? 'arrive' : isMoveLink(window.location.hash) ? 'move' : legalPath(window.location.pathname) ?? 'welcome');
  const [step, setStep] = useViewHistory<View>(startView, (to) => (NEEDS_MEASUREMENTS.includes(to) && !canLeaveMeasure ? 'measure' : to), ladder, (to) => to === 'account');
  // A look just made opens on itself on Style, after any measurements it asks for first; gone anywhere else, it doesn't
  // carry over to the next garment's Style.
  useEffect(() => {
    if (step !== 'style' && step !== 'steps' && step !== 'collection') openLookNext(false);
  }, [step]);
  // A piece being measured for is done with, or left for another, once a garment's Style, Print or Sew opens.
  useEffect(() => {
    if (step === 'style' || step === 'export' || step === 'sew') forgetMeasuringFor();
  }, [step]);
  // Signing in on a device another account used asks a question in Your account: open it there, wherever the sign-in
  // came back to (Google's page returns to the start).
  useEffect(() => {
    if (cloud.status === 'ask') setStep('account');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the question comes up, not on every step change
  }, [cloud.status]);
  const openLegal = (page: 'privacy' | 'terms' | 'tester' | 'news' | 'brands' | 'nights' | 'made' | 'help') => setStep(page);
  // The waitlist (Cat's W1, 2026-10-21): until launch, a visitor without a tester link sees the welcome with a waitlist
  // where Begin was, and the Privacy and Terms pages, nothing else. Measure-me and move links still open, as they
  // come from someone already using the app.
  const [access, setAccess] = useState(() => hasAccess(storedAccount.testerCode));
  const gated = !access && !storedAccount.testerCode && (startView === 'welcome' || startView === 'privacy' || startView === 'terms');
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
    } else {
      if (r === 'wrong') window.history.replaceState(window.history.state, '', withoutTester(window.location.pathname, window.location.search, window.location.hash));
      setLinkCheck({ message: r === 'wrong' ? "That tester link isn't working. Check the email it came in, or type the code here." : CODE_MESSAGE[r] });
    }
  };
  const letIn = (code: string) => {
    rememberAccess();
    setAccess(true);
    if (!storedAccount.testerCode) setAccount({ ...storedAccount, testerCode: code });
  };
  // Founding members come past the waitlist from Mar 16, two days before launch, by signing in with the email on the
  // founding list (Nov 12 promise; src/founding.ts).
  useEffect(() => {
    if (!gated || founding.state !== 'member' || !earlyOpen) return;
    rememberAccess();
    setAccess(true);
  }, [gated, founding, earlyOpen]);
  useEffect(() => {
    if (gated && step !== 'welcome' && step !== 'privacy' && step !== 'terms' && step !== 'made') setStep('welcome');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setStep is rebuilt each render; the effect only follows gated and step
  }, [gated, step]);
  useEffect(() => {
    if (gated) return;
    keepOffline();
    preloadScreens();
  }, [gated]);
  // A tester link (?tester=TOILE-ONE): checked once. The code stays in the address while it lets this device in (see
  // below); one that doesn't is taken out.
  useEffect(() => {
    const code = testerFromLink(window.location.search);
    if (!code) return;
    if (access) {
      // A device let in earlier can hold an old code that no longer works (Cat's phone, Nov 14: the body scan turned
      // it away while the Tester fold still said "Tester code on"). A newer link's code replaces it, once it's checked.
      // Compared as codes are matched (case and stray characters aside), so a typed code kept in capitals isn't
      // checked again on every visit by a link in small letters (code review, Nov 15).
      if (cleanCode(code).toLowerCase() !== cleanCode(storedAccount.testerCode ?? '').toLowerCase()) void checkCode(code).then((r) => r === 'tester' && setAccount({ ...latestAccount.current, testerCode: code }));
      return;
    }
    linkCode.current = code;
    void checkLink(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on opening: the tester link is read and then taken out of the address
  }, []);
  // The tester code stays in the address once this device is in (journey review, Nov 10): an iPhone's home-screen
  // icon opens the address it was added from, in storage of its own, so without the code it opened the waitlist.
  useEffect(() => {
    if (!access || !account.testerCode || testerFromLink(window.location.search) || window.location.hash) return;
    const params = new URLSearchParams(window.location.search);
    params.set('tester', account.testerCode);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}`);
  }, [access, account.testerCode, step]);
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
  // The screen a note from Help & feedback is about: the last screen of the making itself (Measure, Style, Print and
  // their side screens), not the account pages and fine print passed through on the way to Help.
  const [noteFrom, setNoteFrom] = useState<View>(step);
  useEffect(() => {
    if (STEP_OF[step]) setNoteFrom(step);
  }, [step]);
  // The loading screen plays when someone first opens the app, on the way into the welcome. People coming
  // back to their work go straight to it.
  // Strangers on the waitlist skip the loading screen: the Join box is there from the first second, not after about nine
  // (the waitlist review, Cat's A + B1, 2026-11-10). Testers and Cat still get the full opening.
  const [opening, setOpening] = useState(step === 'welcome' && !gated && !restore);
  useEffect(() => {
    if (restore && !gated) setStep(restore);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once on opening: back to the screen this tab was on
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(PLACE_KEY, step);
      // Which chapter a finished pattern was last on, kept past this tab: Carry on goes back to sewing, not to Print,
      // once you've reached Sew (EM walk, Nov 28).
      if (step === 'export' || step === 'sew') localStorage.setItem(CHAPTER_KEY, step);
      else if (step === 'style') localStorage.removeItem(CHAPTER_KEY);
    } catch {
      // Storage off (a private window): a reload starts at the welcome.
    }
  }, [step]);
  // After the place is saved, so a new release shown now opens on this screen.
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) firstScreen.current = false;
    else atNewScreen(RESTORABLE.includes(step));
  }, [step]);
  // The welcome's dress form waits under the loading screen, which wraps its bodice into the form's outline.
  const [formStart, setFormStart] = useState<FormStart>(opening ? 'wait' : 'fresh');
  const profile = profileName(account);
  const owner = personName(account, account.people.find((p) => p.id === ME)!);

  const checks = checksFor(measured, saved.unit, garment, form, skipFor(garment, saved), { weight: person.weight });
  const canLeaveMeasure = ready(measured, saved.unit, garment, form, skipFor(garment, saved));
  // The piece whose own measurements were left partway on this device, while there's still something to measure.
  const partwayPiece = !canLeaveMeasure && step === 'welcome' && baseDone(measured) ? leftPartway(measured, form, (g) => skipFor(g, saved)) : undefined;

  // Corrections from this person's toile fittings go into every pattern drafted for them: the garment's
  // own toile first, then what the person's other toiles found that this one hasn't looked at.
  const ownFitting = person.fittings?.[garment];
  const carried = useMemo(() => carriedFitting(person.fittings, garment), [person.fittings, garment]);
  const fitting = carried.fitting;
  const carriedNotes = useMemo(() => describeCarried(carried), [carried]);
  const alterations = useMemo(() => alterationSheet(carried.fitting, garment), [carried, garment]);
  // Simple or all tools: the simple view prints with home allowances and the quick route, and keeps the rest for later.
  const mode = modeOf(account);
  /** A new garment starts in plain calico, so a print picked for a shirt doesn't follow onto a skirt (Cat, Nov 12:
   *  "Fabric should go back to calico for new garment"). A look that brings its own fabric sets it after this. */
  const plainCloth = (g: Garment): Partial<Saved> => (g !== garment && saved.finish?.fabric ? { finish: { ...saved.finish, fabric: undefined } } : {});
  /** Measure later: try the app with the example measurements, under any already taken, and open Style. */
  const tryWithExample = (g?: Garment, to: 'style' | 'export' = 'style') => {
    const example = (Object.keys(EXAMPLE_BODY) as MeasurementId[]).filter((id) => measured[id] === undefined);
    setAccount(updatePerson({ ...account, onboarded: true, mode }, person.id, { values: { ...EXAMPLE_BODY, ...values }, example }));
    if (g && g !== garment) setSaved({ ...saved, ...plainCloth(g), garment: g });
    setStep(to);
  };
  // Review link (Cat, Nov 6: previews should open on the spot to review): ?go=style opens Style on the dress with the
  // example body, as Measure later would, so a preview link lands on the screen that changed. Pair it with ?fresh.
  // ?go=print does the same and opens Print my pattern instead.
  useEffect(() => {
    const go = new URLSearchParams(window.location.search).get('go');
    if (gated || (go !== 'style' && go !== 'print')) return;
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
    tryWithExample('dress', go === 'print' ? 'export' : 'style');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; the link decides, not later state
  }, [gated]);
  const setMode = (m: Mode) => setAccount({ ...account, mode: m });
  const storedFinish = { ...DEFAULT_FINISH, ...saved.finish };
  const finish = finishFor(storedFinish, mode, saved.house?.garment === garment ? saved.house.finish : undefined);
  const setFinish = (f: Finish) => setSaved({ ...saved, finish: keepFinish(storedFinish, f, mode) });
  const fabric = finish.fabric;
  // What every garment drafts from (see garmentDrafts.ts), and the open garment's entry in the catalogue. A jacket not
  // yet styled starts Long on the menswear form, and trousers with their pockets and belt loops (garments.ts).
  const inputs = useMemo(
    (): DraftInputs => ({
      saved: { choices: saved.choices, bodice: saved.bodice, dress: saved.dress, trousers: saved.trousers ?? (form === 'menswear' ? MENSWEAR_TROUSERS_CHOICES : undefined), tee: saved.tee, knitDress: saved.knitDress, hoodie: saved.hoodie, jumpsuit: saved.jumpsuit, lingerie: saved.lingerie, jacket: saved.jacket ?? (form === 'menswear' ? MENSWEAR_JACKET_CHOICES : undefined), coat: saved.coat },
      form,
      fabric,
    }),
    [saved.choices, saved.bodice, saved.dress, saved.trousers, saved.tee, saved.knitDress, saved.hoodie, saved.jumpsuit, saved.lingerie, saved.jacket, saved.coat, form, fabric],
  );
  const drafting = GARMENT_DRAFTING[garment];
  const skirtStyle = useMemo(() => skirtStyleOf(inputs, fitting), [inputs, fitting]);
  const dress = useMemo(() => dressOf(inputs.saved), [inputs]);
  const trousersChoices = trousersChoicesOf(inputs.saved);
  const teeChoices = teeChoicesOf(saved);
  const lingerieChoices = lingerieChoicesOf(saved);
  const rangeChoices = garment === 'knit_dress' ? knitDressChoicesOf(saved) : garment === 'hoodie' ? hoodieChoicesOf(saved) : jumpsuitChoicesOf(saved);
  const isOuterGarment = isOuterwear(garment);
  const outerChoices = useMemo(() => outerChoicesOf(inputs.saved, garment === 'coat' ? 'coat' : 'jacket'), [inputs, garment]);

  const drafts = useMemo((): Drafts & { error?: string; crash?: unknown } => {
    if (!canLeaveMeasure) return {};
    try {
      return drafting.draft(values, inputs, fitting);
    } catch (e) {
      return e instanceof DraftError ? { error: e.message } : { error: 'Something went wrong drafting this pattern.', crash: e ?? 'unknown' };
    }
  }, [values, inputs, fitting, drafting, canLeaveMeasure]);

  // A draft that crashes (not a DraftError, which is a message for the maker) is a saved choice the engine no longer
  // knows, from an older release or a mistyped value, or a mix of body and design the engine trips on: those choices
  // go back to the garment's defaults, and the app carries on, rather than every screen showing "Something went
  // wrong". The maker is told, so she checks her picks before she prints (a fit tester could otherwise sew the
  // standard design without noticing), and a crash report shows where in the code it tripped (code health check, Nov 11).
  // The note stays until her next pick (the saved choices it was shown for are kept, and any change ends it): it
  // shares the picture window, so the drawing sits small beside it while it shows.
  const [resetNote, setResetNote] = useState<{ after: Saved; text: string }>();
  useEffect(() => {
    if (!drafts.crash) return;
    reportCrash(drafts.crash, 'draft');
    if (!Object.keys(drafting.reset).length) return;
    const after = { ...saved, ...drafting.reset };
    setSaved(after);
    setResetNote({ after, text: `Your ${GARMENT_NAME[garment]} couldn't be drawn with the choices it had, so they went back to the standard design. Check your choices before you print. We've been sent a note so we can fix it.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new draft comes back, so resetting the saved choices never loops
  }, [drafts]);
  const styleError = drafts.error ?? (resetNote?.after === saved ? resetNote.text : undefined);

  // The drafts with any points moved or pieces cut on the flat pattern, so the preview, print and files all follow.
  const moved = pointEdits[garment];
  const result = useMemo(() => {
    if (!moved?.length) return drafts;
    const edit = <T extends { pieces: Piece[] }>(d: T | undefined): T | undefined => d && { ...d, pieces: applyPatternEdits(d.pieces, moved) };
    const { dress: d } = drafts;
    return { ...drafts, skirt: edit(drafts.skirt), bodice: edit(drafts.bodice), trousers: edit(drafts.trousers), tee: edit(drafts.tee), knitDress: edit(drafts.knitDress), hoodie: edit(drafts.hoodie), jumpsuit: edit(drafts.jumpsuit), lingerie: edit(drafts.lingerie), outer: edit(drafts.outer), dress: d && { ...edit(d)!, skirt: edit(d.skirt)! } };
  }, [drafts, moved]);
  const pointEditing = useMemo(() => {
    const { skirt, bodice, dress: d, trousers, tee, knitDress, hoodie, jumpsuit, lingerie, outer } = drafts;
    const all = (bodice ?? d ?? trousers ?? tee ?? knitDress ?? hoodie ?? jumpsuit ?? lingerie ?? outer ?? skirt)?.pieces ?? [];
    const base = all.filter((pc) => !pc.kind);
    // Named in Move points, which shows only the garment's own block: the rest still print, as drafted.
    const fixed = [...new Set([...(drafts.sleeve?.pieces ?? []), ...all.filter((pc) => pc.kind)].map((pc) => pc.name))];
    return { base, fixed, edits: moved ?? [], setEdits: (e: PatternEdit[]) => setPointEdits({ ...pointEdits, [garment]: e }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPointEdits is the saved-work setter, the same on every render
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
  // The collection look these choices still are, for Style's title and the print's title card.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- current is made fresh from inputs.saved on every render
  const lookName = useMemo(() => lookNameOf(garment, current, values), [garment, inputs.saved, values]);
  // A look made before the garment's measurements were all in was sized to the sample body: once they are, it is sized
  // to the maker's own (see lookResized).
  useEffect(() => {
    if (step !== 'style' && step !== 'export' && step !== 'sew') return;
    const resized = lookResized(garment, current, values);
    if (!resized) return;
    const { garment: _g, ...next } = resized;
    setSaved({ ...saved, ...next });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- current is made fresh from inputs.saved on every render
  }, [step, garment, inputs.saved, values]);

  // The trousers' full style (toile corrections and all), so a lining is drafted to the same legs.
  const trousersStyle = useMemo(() => (garment === 'trousers' ? trousersStyleOf(inputs, fitting) : undefined), [garment, inputs, fitting]);
  const drafted = useMemo(
    () => printableFor({ result, values, finish, fabric, garment, ownFitting, carriedNotes, saved, dress, skirtStyle, trousersChoices, trousersStyle, form }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the saved and finish fields the printable reads, so it is not rebuilt on every unrelated change
    [result, saved.choices, saved.bodice, dress, skirtStyle, values, finish.allowances, finish.skirtLined, finish.bodiceEdges, finish.fabricWidth, finish.nap, finish.route, finish.cloth, fabric, fitting, ownFitting, carriedNotes, garment, trousersStyle, form],
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

  // "Back to the original style" on Review: this garment's choices as a first visit has them, measurements untouched.
  // It hands back a way to put this garment's choices back as they were, for its Undo (Cat, Nov 12).
  const startOver = () => {
    const touched: (keyof Saved)[] = garment === 'skirt' ? ['choices', 'dress'] : garment === 'bodice' ? ['bodice', 'dress'] : garment === 'dress' ? ['dress'] : SLOT[garment] ? [SLOT[garment]!] : [];
    const before = Object.fromEntries(touched.map((k) => [k, saved[k]])) as Partial<Saved>;
    setSaved({ ...saved, ...firstVisit(garment) });
    return () => setSaved({ ...latestSaved.current, ...before });
  };
  /** Whether this garment's style differs from a first visit's, so "Back to the original style" has something to undo
   *  (clarity review A6, Nov 22: it was offered before anything had changed). */
  const styledSinceStart = () => {
    const first = firstVisit(garment);
    const key = garment === 'skirt' ? 'choices' : garment === 'bodice' ? 'bodice' : garment === 'dress' ? 'dress' : SLOT[garment];
    if (!key) return false;
    const now = key === 'dress' ? (saved.dress ?? dressOf(saved)) : saved[key];
    return !sameValue(now ?? null, first[key] ?? null);
  };
  /** A garment's choices as a first visit has them, as a patch to the saved work. */
  const firstVisit = (g: Garment): Partial<Saved> => {
    // A dress not yet styled on its own is drawn from the skirt and bodice picks: it keeps them when those start over,
    // and starts over itself from the first visit's skirt and bodice, not the sewist's.
    const ownDress = saved.dress ?? dressOf(saved);
    if (g === 'skirt') return { choices: INITIAL.choices, dress: ownDress };
    if (g === 'bodice') return { bodice: INITIAL.bodice, dress: ownDress };
    if (g === 'dress') return { dress: dressOf(INITIAL) };
    return SLOT[g] ? { [SLOT[g]!]: undefined } : {};
  };
  /** "Start something new" (Cat, Nov 12: pausing one skirt to start another lost the first): the garment's work so
   *  far goes into Saved patterns, and only then does it start over. Saved patterns full, it carries on as it was. */
  const [freshStart, setFreshStart] = useState(false);
  const startNew = () => {
    setAccount(keepThenFresh(garment).account);
    setFreshStart(true);
    chooseGarment();
  };
  const keepThenFresh = (g: Garment, acc: Account = account): { account: Account; patch: Partial<Saved> } => {
    const drafting = GARMENT_DRAFTING[g];
    const now = drafting.choices(saved);
    // (A dress never styled on its own is only drawn from the skirt and bodice: nothing of its own to keep.)
    const untouched = (g === 'dress' && !saved.dress) || JSON.stringify(drafting.choices({ ...saved, ...firstVisit(g) })) === JSON.stringify(now);
    if (untouched) return { account: acc, patch: {} };
    // A collection look is kept under its own name, as testers know it (Nov 19 bug hunt: Blush Shift was saved as
    // "Mini shift dress with a crew neck").
    const kept = savePattern(acc, now, lookNameOf(g, now, values) ?? describePattern(now), person.id);
    return isSavedFor(kept, now, person.id) ? { account: kept, patch: firstVisit(g) } : { account: acc, patch: {} };
  };
  // "How did it fit?" from the print screen: the pattern is kept (if it can be) and its fit notes open on Your account.
  const [fitFocus, setFitFocus] = useState<string>();
  const openFitNotes = () => {
    const next = saveState === 'can' ? savePattern(account, current, lookName ?? describePattern(current), person.id) : account;
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
  // Where the collection was opened from: Style, or the list of what to make (tester journey, Nov 11).
  const [lookFrom, setLookFrom] = useState<'style' | 'steps'>('style');
  // A reload while measuring opens on the page still to take (tester journey, Nov 11).
  const [stepsStart, setStepsStart] = useState<{ at: number; start?: StepsStart }>(() => ({ at: 0, start: restore === 'steps' ? { kind: 'resume' } : undefined }));
  // The opening of the guided pages last shown: one shown before is being stepped back into, and keeps its page.
  const stepsShown = useRef(-1);
  useEffect(() => {
    if (step === 'steps') stepsShown.current = stepsStart.at;
  }, [step, stepsStart.at]);
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
      {/* On a phone's Style the note shares the name's line, so it shows as "Example body" (Cat's B, 2026-11-08). */}
      <span>
        <span className="example-tag-lead">Drafted to an </span>
        <span className="example-tag-body">example body</span>
      </span>
      <span className="example-tag-go">Measure me</span>
    </button>
  );
  /** "Choose another garment": the same list as when measuring. */
  const chooseGarment = () => openSteps({ kind: 'choose' });
  /** Style's way on: to Print, or back to Sew's Cut it when Style was opened there to choose the fabric (Cat, Nov 28). */
  const toPrintOrSew = () => setStep(fabricReturning() ? 'sew' : 'export');

  /** Switch garment, going straight to the measurements the new one still needs, one page each. */
  /** Opens garment `g` on `to`; false when it went to take measurements first. */
  const switchGarment = (g: Garment, next: Partial<Saved> = {}, to: View = step, using: MeasurementValues = measured, also: MeasurementId[] = []): boolean => {
    const after = { ...saved, ...plainCloth(g), ...next, garment: g };
    setSaved(after);
    const stays = to === 'style' || to === 'export' || to === 'sew';
    if (stays && (!ready(using, saved.unit, g, form, skipFor(g, after)) || also.length)) {
      measureFor(g, using, form, also, after, to === 'style' ? undefined : to);
      return false;
    }
    setStep(to);
    return true;
  };

  /**
   * Not ready for this garment: take the measurements it still needs, one page each. When none are missing,
   * one of them fails a check, so open the list with the reason rather than going round the guided pages again.
   */
  const measureFor = (g: Garment, using: MeasurementValues, on: FormKind = form, also: MeasurementId[] = [], s: Pick<Saved, 'jacket' | 'dress'> = saved, then?: AfterMeasuring) => {
    const skip = skipFor(g, s);
    const wrong = isComplete(using, g, on, skip) && checksFor(using, saved.unit, g, on, skip).find((c) => c.level === 'error');
    if (wrong) sendToMeasure(`Check your ${g === 'tee' ? 'T-shirt' : vestOf(g, s) ? 'vest' : g} measurements: ${wrong.message}`);
    else openSteps({ kind: 'for', garment: g, ...(also.length ? { also } : {}), ...(then ? { then } : {}) });
  };

  // Why Style or Print didn't open while measuring, shown over the guided pages for a moment.
  // Kept with when it was asked for, so a second tap on Print shows it again for its full time: the same words twice
  // left the first tap's timer running, and the second tap seemed to do nothing (pretend tester, Nov 20).
  const [note, setNote] = useState<{ text: string; at: number }>();
  const stepsNote = note?.text;
  const setStepsNote = (text?: string) => setNote(text ? { text, at: Date.now() } : undefined);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(undefined), 4000);
    return () => clearTimeout(t);
  }, [note]);
  // The guided page showing, for the header's Style and Print.
  const [stepsPage, setStepsPage] = useState<PageKind>();

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

  // A top or dress with sleeves prints them only once the arms are measured. Measuring left with Finish later and
  // carried on from Welcome back printed the Ice Peplum without its sleeves, under a title still naming them (pretend
  // tester, Nov 17). So Print, however it is reached, asks for the arms first.
  const armsToAsk = lookArmsMissing({ choices: current }, measured);
  useEffect(() => {
    if ((step !== 'export' && step !== 'sew') || !armsToAsk.length) return;
    // Back to where they were going once the arms are in, not to styling (pretend-tester walk, Nov 24).
    openSteps({ kind: 'for', garment, also: armsToAsk, then: step });
    setStepsNote('Your sleeves are drafted from your arms: add them to print.');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asks once each time Print is opened without the arms
  }, [step, armsToAsk.length]);

  // What a piece's current design is drafted from beyond its own list: a top that goes below the waist needs the hips,
  // and one with sleeves the arms. Making the look asks for them, but a piece carried on after a reload or Welcome back
  // was measured from its own list alone, and Style then stopped at "Add your full hip and waist to hip" with no way on
  // (EI stills, Nov 26). So carrying on asks for them too.
  const designNeeds = (g: Garment, v: MeasurementValues = measured): MeasurementId[] => {
    const choices = GARMENT_DRAFTING[g].choices(saved) as never;
    return [...lookHipMissing({ choices }, v), ...lookArmsMissing({ choices }, v)];
  };
  // And Style, however it is reached without them, asks for the hips first, as Print does for the arms.
  const hipToAsk = lookHipMissing({ choices: current }, measured);
  useEffect(() => {
    if (step !== 'style' || !hipToAsk.length) return;
    openSteps({ kind: 'for', garment, also: hipToAsk });
    setStepsNote('Your top goes below the waist, so it is drafted from your hips too: add them to style it.');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asks once each time Style is opened without the hips
  }, [step, hipToAsk.length]);

  /** Switch whose measurements are in use, going back to measuring when theirs aren't done for this garment. */
  const switchPerson = (id: string, to: View = step) => {
    const who = account.people.find((p) => p.id === id) ?? person;
    setAccount({ ...account, active: who.id });
    if ((to === 'style' || to === 'export' || to === 'sew') && !ready(who.values, saved.unit, garment, formOf(who), skipFor(garment, saved))) measureFor(garment, who.values, formOf(who));
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
    // Forgotten too, what this device last agreed with the account: otherwise signing in again read the emptied device
    // as every pattern and person removed, and emptied the account (the review, Nov 10).
    cloud.forget();
    setSaved(INITIAL);
    setAccount(NEW_ACCOUNT);
    // And any copy of saved work an older version couldn't read (store.ts).
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('pattern-maker:unread-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // Storage blocked: nothing was kept.
    }
    setStep('welcome');
  };

  /** The header's ←: one step back through history, like the phone's back. */
  const back = () => (canGoBack() ? goBack() : setStep(PARENT[step] ?? 'welcome'));

  /** A step in the header. Style and Print wait for the measurements, and say so. */
  const openStep = (to: Step) => {
    // Still choosing what to make, on the collection opened from the list after measuring: nothing is picked, so the
    // garment is only the first-visit skirt. Measure showed a skirt's list without the bust or weight just given, and
    // Style and Print stayed shut on a skirt's waist to knee, with "Make something else" the only way out (pretend
    // tester walks, four times to DO, Nov 20). Measure goes back to the measurements given, the others to the choice.
    // The same on the guided pages' check and list ("Do these look right?", "What would you like to make?"): the
    // measurements are in, so "once your measurements are in" read as wrong, and Print seemed to do nothing (DP walk, Nov 20).
    const choosing = (step === 'collection' && lookFrom === 'steps') || (step === 'steps' && (stepsPage === 'check' || stepsPage === 'choose'));
    if (choosing && baseDone(measured)) {
      // On the list Style is lit (cold read EE, Nov 24), so Measure is a way back to the measurements, as from the collection.
      if (to === 'measure') return step === 'steps' && stepsPage === 'check' ? undefined : openSteps({ kind: 'check' });
      // Back after leaving partway through a piece's measurements: that piece's next page, not the garments again.
      const partway = !canLeaveMeasure && step === 'steps' && stepsPage === 'check' ? leftPartway(measured, form, (g) => skipFor(g, saved)) : undefined;
      if (partway) {
        measureFor(partway, measured, form, designNeeds(partway));
        setStepsNote('Style and Print open once your measurements are in.');
        return;
      }
      if (!canLeaveMeasure) {
        if (!(step === 'steps' && stepsPage === 'choose')) openSteps({ kind: 'choose' });
        setStepsNote('Choose what to make first: Style and Print open for it.');
        return;
      }
    }
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

  // The style the fabric is checked against: Print's fabric notes, and the heads up on Style's Fabric step.
  const fabricStyle: FabricStyle =
    isOuterGarment
      ? { garment, fit: outerChoices.fit, sleeve: outerChoices.sleeve }
      : garment === 'bodice'
      ? { garment, fit: saved.bodice.fit, neckline: saved.bodice.neckline, structure: validDetails(saved.bodice).structure }
      : garment === 'dress'
        ? { garment, fit: dress.fit, neckline: dress.bodice.neckline, silhouette: dress.skirt.silhouette, length: dress.skirt.length, lengthCm: dress.skirt.lengthCm, structure: validDetails(dress.bodice).structure, asymHem: dress.skirt.asymHem, pleats: dress.skirt.pleats, godets: dress.skirt.godets, flounce: dress.skirt.flounce, noSeam: noSeamAllowed(dress.bodice) ? dress.skirt.noSeam : undefined }
        : garment === 'trousers'
          ? { garment, fit: trousersChoices.fit, leg: trousersChoices.leg }
          : garment === 'tee'
            ? { garment, fit: teeChoices.fit, stretch: teeChoices.stretch, neckline: teeChoices.neckline }
          : rangeChoices.garment !== 'jumpsuit' && isRangeGarment(garment)
            ? { garment: 'tee', fit: teeFitOf(rangeChoices.fit), stretch: rangeChoices.stretch, neckline: 'neckline' in rangeChoices ? rangeChoices.neckline : 'crew' }
          : rangeChoices.garment === 'jumpsuit' && garment === 'jumpsuit'
            ? { garment: 'trousers', fit: rangeChoices.legFit, leg: rangeChoices.leg }
          : garment === 'lingerie'
            ? { garment, piece: lingerieChoices.piece, stretch: lingerieChoices.stretch }
          : { garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length, lengthCm: saved.choices.lengthCm, asymHem: saved.choices.asymHem, pleats: saved.choices.pleats, godets: saved.choices.godets, flounce: saved.choices.flounce };

  // A fit tester's own look keeps its style: the "You're in" email says the style is set and only the length is theirs.
  // A peplum tester changed the neckline and sleeves and took the peplum off, still believing she was sewing the Ice
  // Peplum Top (testers, Nov 18). So a change that would make it another piece is asked about first; a length isn't.
  // Every change of choices on Style comes through here, as the part of the saved work it changes. Kept as that part, so
  // "Change it anyway" applies it to the work as it is then, not to a copy from when it was asked.
  const [lookLeave, setLookLeave] = useState<Partial<Saved>>();
  const testerOwnLook = COLLECTION.find((l) => l.id === TESTER_LOOK[garment]);
  const onOwnLook = !!account.testerCode && !!lookName && testerOwnLook?.name === lookName;
  const styleTo = (patch: Partial<Saved>) => {
    if (onOwnLook && step === 'style' && lookNameOf(garment, GARMENT_DRAFTING[garment].choices({ ...saved, ...patch }), values) !== lookName) setLookLeave(patch);
    else setSaved({ ...saved, ...patch });
  };
  // Asked about on Style only: leaving it (Back, another garment) lets the question go.
  useEffect(() => setLookLeave(undefined), [step, garment]);
  // Makes a collection look: from the collection, and from a tester's link on Style to the look they sew. `keep`: the
  // garment's own work so far is kept in Saved patterns before the look takes its place. False when it went to take
  // measurements first.
  const makeLook = (look: HouseLook, keep = freshStart, ownLength = false) => {
    const sized = lookValues(look, values).values;
    // A dress never styled on its own is only drawn from the skirt and bodice: no length of its own to keep.
    const keepOwn = ownLength && look.garment === garment && !(garment === 'dress' && !saved.dress);
    const { garment: g, ...next } = keepOwn ? lookPatchKeeping(look, sized, current, GARMENT_DRAFTING[garment].choices({ ...saved, ...firstVisit(garment) })) : lookPatch(look, sized);
    if (keep) {
      const kept = keepThenFresh(g);
      setFreshStart(false);
      if (kept.account !== account) setAccount(kept.account);
    }
    // The look comes in the cloth it's named for, so the drawing and the Fabric step open in it.
    const cloth = lookFabric(look.fabric);
    const withCloth = keepFinish(storedFinish, { ...finish, ...look.finish, fabric: cloth, cloth: clothFor(cloth, finish.cloth) }, mode);
    // A look with sleeves asks for the arms first, or its pattern would print without them (bug hunt, Nov 12),
    // and a top below the waist the hip first, or Style can't draft it (testers, Nov 12).
    // It opens on itself, ready to print; Change a detail goes on to the questions.
    openLookNext();
    const here = switchGarment(g, { ...next, archive: archiveCut(look.id)?.id, finish: withCloth, house: look.finish && { garment: g, finish: look.finish } } as Partial<Saved>, 'style', measured, [...lookHipMissing(look, measured), ...lookArmsMissing(look, measured)]);
    // To the top once the look's page is up: scrolled at once, the collection's own top flashed up while
    // the look was drafted (testers' laptop walk, Nov 17).
    requestAnimationFrame(() => window.scrollTo(0, 0));
    return here;
  };
  // A tester on the plain garment their look is made from, offered the look itself (testers, Nov 18).
  // Whatever was styled here is kept in Saved patterns first, so a tap never loses work (code review, Nov 18).
  const testerLook = account.testerCode && step === 'style' && !lookName ? testerOwnLook : undefined;

  return (
    <>
      {opening && (
        <LoadingScreen
          onDone={() => setOpening(false)}
          findForm={step === 'welcome' ? findForm : undefined}
          onHandoff={(drawn) => setFormStart(drawn ? 'drawn' : 'fresh')}
        />
      )}
      <DemoGarment.Provider value={garment}>
      <FabricStyleOf.Provider value={fabricStyle}>
      <PointEditContext.Provider value={pointEditing}>
      {/* Not on a collection look just as it comes: the cold read EK (Nov 27) met it before changing anything, and it
          would turn the look into the garment's plain first style. */}
      <StartOver.Provider value={styledSinceStart() && !lookName ? startOver : undefined}>
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
                {/* No header back on the chapters (Cat, 2026-11-02: "this arrow causes confusion"): Measure, Style,
                    Print and Sew are tapped to move between them. Guided measuring, side screens, Draw and Review keep it
                    (Style's steps hide it in 25-step-back.css). */}
                {step !== 'measure' && step !== 'export' && step !== 'sew' && (
                  <button type="button" className="steady-back" aria-label="Back" onClick={back}>
                    ←
                  </button>
                )}
                <nav aria-label="Steps" className="steps">
                  {STEPS.map((s) => {
                    // Choosing what to make is the start of styling, so Style is lit there, not Measure (cold read EE, Nov 24).
                    const on = (step === 'steps' && stepsPage === 'choose' ? 'style' : STEP_OF[step]) === s.id;
                    const locked = s.id !== 'measure' && !canLeaveMeasure;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={on ? 'step on' : locked ? 'step locked' : 'step'}
                        aria-current={on ? 'step' : undefined}
                        title={locked && !on ? 'Measure first' : undefined}
                        onClick={() => openStep(s.id)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </nav>
                <button
                  type="button"
                  className={step === 'account' || UNDER_ACCOUNT.includes(step) ? 'avatar on' : 'avatar'}
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
            </>
          )}
        </header>

        <main className="main">
          <Suspense fallback={null}>
          {/* Hold to leave a note, on a device let in by a tester link only (Cat, Nov 26: "Hold to drop a pin"). */}
          {/* In its own Suspense, so its file arriving never blanks the screen under it. */}
          {access && !!account.testerCode && (
            <Suspense fallback={null}>
              <PinNotes view={step} garment={lookName ?? (vestOf(garment, saved) ? 'vest' : GARMENT_NAME[garment])} hide={namesToHide([account.name, account.studio?.name, ...(account.people ?? []).map((p) => p.name)])} />
            </Suspense>
          )}
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
              opened={(b) => {
                const s = { ...INITIAL, ...(b.skirt as Partial<Saved>) };
                const g = s.garment ?? 'skirt';
                // Called by its collection name where it still is one: "the skirt" read as some other skirt (pretend tester, Nov 18).
                let name: string | undefined;
                try {
                  const them = withPeople(b.account);
                  name = lookNameOf(g, GARMENT_DRAFTING[g].choices(s), them.people.find((p) => p.id === them.active)?.values ?? {});
                } catch {
                  name = undefined;
                }
                return `${name ? `The ${name}` : `The ${GARMENT_NAMES[g] ?? 'piece'}`} you had open, in ${s.unit === 'in' ? 'inches' : 'centimetres'}`;
              }}
              hereMeasured={Object.keys(measured).filter((k) => !person.example?.includes(k as MeasurementId)).length}
              onBring={(b) => {
                // Brought in, so a reload shouldn't offer it again.
                dropHash();
                // Joined with what's here, never replacing it: a link sent from a device with nothing on it, brought onto a
                // phone that held a tester's measurements, emptied the phone (tester, Nov 18). No measurement, person or
                // pattern from either side is dropped. Not changed here: the next join with the account keeps everything.
                cloud.forget();
                // Sent on purpose from one's own other device, it counts as the newer side wherever both hold the same
                // thing, and it's the same person's work: joined, unless both were measured and disagree, when this
                // device's measurements are kept beside the link's under their own name rather than mixed in.
                applyBackup(mergeBackups({ ...makeBackup(saved, account, pointEdits), savedAt: new Date(0).toISOString() }, b as Backup<Saved>, null, { sameOwner: true }));
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
              waitlist={gated ? { onCode: letIn, founding: cloud.usable && earlyOpen ? { cloud, founding, retry: retryFounding } : undefined, checking: linkCheck.checking, linkMessage: linkCheck.message, onRetry: linkCode.current && linkCheck.message === CODE_MESSAGE.failed ? () => void checkLink(linkCode.current!) : undefined } : undefined}
              onFinish={() => {
                setAccount({ ...account, onboarded: true, mode });
                setStep('steps');
              }}
              tester={!!account.testerCode && !account.onboarded}
              onBringLink={async (link) => {
                // The link may come with words around it (a message pasted whole): take the #move= part wherever it is.
                // Only the link's own characters (z. or p., then URL-safe base64), so a full stop or bracket after it in a
    // pasted message isn't read as part of it (code review, Nov 15).
    const found = link.match(/#move=[zp]\.[A-Za-z0-9_-]+/);
                const b = found ? await readMoveLink<Saved>(found[0]) : null;
                if (!b || b === 'broken') return false;
                arrive(b);
                setStep('move');
                return true;
              }}
              resume={
                account.onboarded && canLeaveMeasure
                  ? // Called by its look's name, and opened on the look, as when it was made: "Carry on with your skirt" led to
                    // the first question, not the Black Pleated Skirt (pretend tester, Nov 18).
                    {
                      garment: lookName ?? (vestOf(garment, saved) ? 'vest' : GARMENT_NAME[garment]),
                      onResume: () => {
                        // A saved pattern (printing keeps one too) is finished, so it opens on Print, ready to download:
                        // reopening the tester link after printing led back to the look (pretend tester DI walk, Nov 19).
                        if (isSaved) return setStep(lastChapter());
                        if (lookName) openLookNext();
                        setStep('style');
                      },
                      onSaved: () => setStep('account'),
                      onNew: startNew,
                    }
                  : partwayPiece
                    ? // Closed partway through a piece's own measurements: the landing page carries on with it, as Begin
                      // only led to a list of the first five, without the piece's ones already given (EJ walk, Nov 27).
                      {
                        // A look picked from the collection is called by its name here too, as once it's measured
                        // ("Carry on with your top" for the Ice Peplum, EL walk, Nov 27).
                        garment: (partwayPiece === garment && lookName) || (vestOf(partwayPiece, saved) ? 'vest' : GARMENT_NAME[partwayPiece]),
                        onResume: () => openSteps({ kind: 'resume' }),
                        onSaved: () => setStep('account'),
                        onNew: startNew,
                      }
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
              opening={stepsStart.at !== stepsShown.current}
              unused={(g) => skipFor(g, saved)}
              asks={(g) => designNeeds(g)}
              named={(g) => (vestOf(g, saved) ? 'vest' : GARMENT_NAME[g])}
              testerCode={account.testerCode}
              start={stepsStart.start}
              onSomeoneElse={(name, f) => {
                const added = addPerson(account, name);
                setAccount(updatePerson(added, added.active!, { form: f }));
              }}
              onAskThem={(name, f) => {
                const added = addPerson(account, name);
                setAccount(updatePerson(added, added.active!, { form: f }));
                setStep('client');
              }}
              onKeepSafe={cloud.usable && !cloud.user ? () => setStep('account') : undefined}
              theirs={person.id !== ME}
              theirName={person.id !== ME ? personName(account, person) : undefined}
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
              onDone={(g, then) => {
                countStep('measured', g);
                const fresh = freshStart ? keepThenFresh(g) : undefined;
                setFreshStart(false);
                if (fresh && fresh.account !== account) setAccount(fresh.account);
                switchGarment(g, fresh?.patch ?? {}, then ?? 'style');
              }}
              onIdea={(c) => styleChoices(c)}
              onPhoto={() => setStep('photo')}
              onLooks={() => {
                // Back from the collection lands on the list again.
                setStepsStart({ at: stepsStart.at + 1, start: { kind: 'choose' } });
                setLookFrom('steps');
                setStep('collection');
                window.scrollTo(0, 0);
              }}
              onMade={() => openLegal('made')}
              onNews={() => openLegal('news')}
              onPage={setStepsPage}
              onLater={() => setStep('welcome')}
              onSkip={tryWithExample}
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
          {step === 'made' && <MadeScreen onPrivacy={() => openLegal('privacy')} />}
          {step === 'help' && <HelpScreen from={noteFrom} tester={!!account.testerCode} onDone={back} />}
          {step === 'photo' && plansShown() && <PhotoAllowance account={account} onPlans={openPlans} />}
          {step === 'photo' && canPhotoDraft(account) && (
            <PhotoScreen
              testerCode={account.testerCode}
              measured={canLeaveMeasure}
              body={canLeaveMeasure ? (values as SkirtMeasurements & PhotoBody) : undefined}
              unit={saved.unit}
              onByHand={() => switchGarment('skirt', {}, 'style')}
              onMade={() => openLegal('made')}
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
              founding={founding.state === 'member' ? founding.place : undefined}
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
                // Replaced from a file, not changed here: the next join with the account keeps everything from both.
                cloud.forget();
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
              name={vestOf(garment, saved) ? 'vest' : undefined}
              unused={skipFor(garment, saved)}
              onMeasure={(ids) => openSteps({ kind: 'redo', garment, ids })}
              onChangeForm={() => openSteps({ kind: 'form' })}
              onNext={() => {
                countStep('measured', garment);
                setAccount(updatePerson(account, person.id, recordMeasurements(person, new Date().toISOString().slice(0, 10))));
                // Back to a tester's own look's page, ready to print, not its questions from the start: after Edit
                // measurements, a tester read "Style your top" as starting over (testers, Nov 18).
                if (onOwnLook) openLookNext();
                setStep('style');
              }}
            />
          )}
          {step === 'collection' && (
            <CollectionScreen
              values={values}
              onMake={(look) => makeLook(look)}
            />
          )}
          {/* On Style it sits under the garment's name (Cat's K3, 2026-10-28), so StyleLayout draws it. */}
          {step === 'export' && exampleTag}
          {lookLeave && lookName && step === 'style' && (
            <div className="form-leave" role="dialog" aria-modal="true" aria-labelledby="look-leave-title" onKeyDown={(e) => e.key === 'Escape' && setLookLeave(undefined)}>
              <div className="form-leave-box">
                <h2 id="look-leave-title">Change the {lookName}?</h2>
                <p>On your tester look, the style is set and only the length is yours. This change makes it a different {GARMENT_NAME[garment]}, so it would no longer be the {lookName} you're testing.</p>
                <button type="button" className="primary done" onClick={() => setLookLeave(undefined)} autoFocus>
                  Keep the {lookName}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSaved({ ...saved, ...lookLeave });
                    setLookLeave(undefined);
                  }}
                >
                  Change it anyway
                </button>
              </div>
            </div>
          )}
          <UnitNow.Provider value={saved.unit}>
          <ExampleTag.Provider value={step === 'style' ? exampleTag : undefined}>
          <LookName.Provider value={step === 'style' ? lookName : undefined}>
          <TesterLook.Provider value={testerLook && { name: testerLook.name, open: () => makeLook(testerLook, true, true), lengthStays: lookDropsLength(testerLook, current, GARMENT_DRAFTING[garment].choices({ ...saved, ...firstVisit(garment) })) }}>
          <CollectionLink.Provider value={step === 'style' ? () => { setLookFrom('style'); setStep('collection'); window.scrollTo(0, 0); } : undefined}>
          {/* Switched in place from the title's drop-down: no new step in history, so ← still leaves the style screen. */}
          <GarmentPick.Provider value={step === 'style' ? { garment, onNew: startNew, onSaved: () => setStep('account') } : undefined}>
          {step === 'style' && photoSource && photoFor === garment && (
            <PhotoCheck
              source={photoSource}
              current={current}
              body={values as PhotoBody}
              headers={testerHeaders(account.testerCode)}
              onChoices={(c) => styleTo(choicesPatch(c)[1])}
            />
          )}
          {step === 'style' && garment === 'skirt' && (
            <StyleScreen
              mode={mode}
              onMode={setMode}
              easeMap={ease}
              choices={saved.choices}
              onChoices={(choices) => styleTo({ choices })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.skirt}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(bodice) => styleTo({ bodice })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.bodice}
              sleeve={result.sleeve}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onAddHip={() => openSteps({ kind: 'for', garment, also: ['full_hip', 'waist_to_hip'] })}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(d) => styleTo({ dress: d })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.dress}
              sleeve={result.sleeve}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(t) => styleTo({ trousers: t })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.trousers}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(t) => styleTo({ tee: t })}
              finish={finish}
              onFinish={setFinish}
              fabric={fabric}
              onFabric={(f) => setFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.tee}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          {step === 'style' && isRangeGarment(garment) && (
            <RangeStyleScreen
              key={garment}
              onPhoto={() => setStep('photo')}
              photo={photoFor === garment ? photoPreview : undefined}
              mode={mode}
              onMode={setMode}
              choices={rangeChoices}
              onChoices={(c) => styleTo({ [rangeSlot(garment)]: c })}
              finish={finish}
              onFinish={setFinish}
              fabric={fabric}
              onFabric={(f) => setFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })}
              onChooseGarment={chooseGarment}
              values={values}
              draft={garment === 'knit_dress' ? result.knitDress : garment === 'hoodie' ? result.hoodie : result.jumpsuit}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(l) => styleTo({ lingerie: l })}
              fabric={fabric}
              onFabric={(f) => setFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.lingerie}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
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
              onChoices={(c) => styleTo({ [garment]: c })}
              fabric={fabric}
              onChooseGarment={chooseGarment}
              values={values}
              draft={result.outer}
              error={styleError}
              onEditMeasurements={() => setStep('measure')}
              onNext={toPrintOrSew}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id))}
              onAccount={() => setStep('account')}
            />
          )}
          </GarmentPick.Provider>
          </CollectionLink.Provider>
          </TesterLook.Provider>
          </LookName.Provider>
          </ExampleTag.Provider>
          </UnitNow.Provider>
          {step === 'export' && !hasGarment(account, garment) && <UnlockGarment garment={garment} onPlans={openPlans} onBack={() => setStep('style')} />}
          {step === 'export' && hasGarment(account, garment) && (
            <ExportScreen
              example={!!person.example?.length}
              onNextSew={() => {
                openCutNext();
                setStep('sew');
              }}
              onMeasureMe={measureMe}
              onEditMeasurements={() => setStep('measure')}
              unit={saved.unit}
              paper={saved.paper}
              onPaper={(paper) => setSaved({ ...saved, paper })}
              sendLink={sendLink}
              mode={mode}
              onMode={setMode}
              onKeep={saveState === 'can' ? () => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id)) : undefined}
              onFitNotes={saveState === 'full' && !savedNow ? undefined : openFitNotes}
              full={saveState === 'full'}
              tester={!!account.testerCode}
              emailTo={{ signedIn: cloud.user?.email, testerCode: account.testerCode }}
              fitNote={savedNow?.fit ? fitSummary(savedNow.fit, savedNow.choices) : undefined}
              garment={garment}
              profile={profile}
              title={title}
              lookName={lookName}
              fit={'fit' in current ? current.fit : 'close'}
              finish={finish}
              onFinish={setFinish}
              made={printable}
              error={styleError}
              alterations={alterations}
              values={values}
              draftAt={draftAt}
              credit={fromArchive?.credit}
            />
          )}
          {step === 'sew' && !hasGarment(account, garment) && <UnlockGarment garment={garment} onPlans={openPlans} onBack={() => setStep('style')} />}
          {step === 'sew' && hasGarment(account, garment) && (
            <SewScreen made={printable} title={title} name={lookName ?? (vestOf(garment, saved) ? 'vest' : GARMENT_NAME[garment])} keep={`${person.id}:${garment}`} onStyle={() => setStep('style')} onPrint={() => setStep('export')} tester={!!account.testerCode} cut={{
                garment,
                finish,
                onFinish: setFinish,
                tester: !!account.testerCode,
                mode,
                onKeep: saveState === 'can' ? () => setAccount(savePattern(account, current, lookName ?? describePattern(current), person.id)) : undefined,
                onEditFabric: () => {
                  openTabNext(FABRIC);
                  leavePrintForFabric();
                  setStep('style');
                },
                style: fabricStyle,
                fitting: ownFitting,
                fittingNotes: [...describeFitting(ownFitting, garment), ...carriedNotes],
                onFitting: () => setStep('fitting'),
                onTrueScale: () => setStep('scale'),
                label: { name: profile === 'Me' ? account.name : profile, code: labelFor },
              }} />
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
            <>
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
                made={importedPrintable}
                imported={{ source: imported.pattern.source, fileName: imported.fileName }}
              />
              <CutPart made={importedPrintable} title={importedTitle} garment={garment} finish={finish} onFinish={setFinish} style={{ garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length }} mode={mode} imported />
              {importedPrintable.guide.steps.length > 0 && <WrittenSteps guide={importedPrintable.guide} sew={{ made: importedPrintable, title: importedTitle }} />}
            </>
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
            <>
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
                made={coverPrintable}
                imported={{ fileName: `Drafted to ${profile === 'Me' ? 'you' : profile}` }}
              />
              <CutPart made={coverPrintable} title="Form cover" garment={garment} finish={finish} onFinish={setFinish} style={{ garment: 'skirt', silhouette: saved.choices.silhouette, length: saved.choices.length }} mode={mode} imported />
              {coverPrintable.guide.steps.length > 0 && <WrittenSteps guide={coverPrintable.guide} sew={{ made: coverPrintable, title: 'Form cover' }} />}
            </>
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
              simple={mode === 'simple'}
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
                // Saved: back to Cut it, which it was opened from.
                if (canGoBack()) goBack();
                else setStep('sew');
              }}
            />
          )}
        </KeptCount.Provider>
          </Suspense>
        </main>
      </div>
      </StartOver.Provider>
      </PointEditContext.Provider>
      </FabricStyleOf.Provider>
      </DemoGarment.Provider>
    </>
  );
}

/** Whether two saved values hold the same picks, whatever order their keys were written in: saved work filled in by
 *  fillMissing adds newer keys at the end, so comparing the JSON said a garment was styled when nothing had changed
 *  (code review, Nov 22). A key the first visit doesn't have counts only when it holds a value. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return Object.keys(y).every((k) => sameValue(x[k], y[k])) && Object.keys(x).every((k) => k in y || x[k] === undefined);
}
