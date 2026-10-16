import { useMemo, useState } from 'react';
import type { HemShape } from './engine/hem';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, SkirtMeasurements, SkirtShape, draftSkirt } from './engine/skirt';
import { BodiceDraft, BodiceMeasurements, blockOf, draftBodice } from './engine/bodice';
import { BodiceEdges, SewingGuide, bodiceGuide, dressGuide, hasSlit, sewingGuide } from './engine/instructions';
import { bodiceFlat, dressFlat, skirtFlat, trousersFlat } from './engine/flat';
import { DressDraft, DressMeasurements, draftDress } from './engine/dress';
import { TrousersDraft, TrousersMeasurements, draftTrousers, trousersWaistband } from './engine/trousers';
import { trousersGuide } from './engine/trousersGuide';
import { Cloth, Route, toCouture } from './engine/couture';
import { AllowanceStyle, SEAM_WIDTHS, withAllowances } from './engine/allowances';
import { bodiceFacings, liningPieces, waistbandPiece } from './engine/finishing';
import { bodiceSpec, dressSpec, skirtSpec, sleeveSpec, trousersSpec } from './engine/spec';
import { SleeveDraft, SleeveMeasurements, draftSleeve, needsArms } from './engine/sleeve';
import { Fitting, carriedFitting, describeCarried, describeFitting, saveVersion, toFitting } from './engine/fitting';
import { FabricWidth, layPlans } from './engine/layplan';
import { EXAMPLE_VALUES, Garment, MeasurementValues, Unit, checkMeasurements, isComplete } from './measurements';
import { usePersistent } from './store';
import {
  Account,
  ME,
  NEW_ACCOUNT,
  activePerson,
  addPerson,
  claimMeasurements,
  isSavedFor,
  makeBackup,
  personName,
  readBackup,
  profileName,
  removePattern,
  removePerson,
  renamePattern,
  savePattern,
  updatePerson,
  recordMeasurements,
  withPeople,
  FREE_SAVED_LIMIT,
} from './account';
import { BodiceChoices, COLLAR_WORDS, DEFAULT_BODICE, DEFAULT_TROUSERS_CHOICES, TrousersChoices, validDetails, DressChoices, describeBodice, describeTrousers, isBodice, isDress, isTrousers, sleeveOf } from './garments';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen, describe, fabricMetres } from './screens/StyleScreen';
import { BodiceStyleScreen, bindingMetres, bodiceFabricMetres } from './screens/BodiceStyleScreen';
import { DressStyleScreen } from './screens/DressStyleScreen';
import { TrousersStyleScreen, trousersFabricMetres } from './screens/TrousersStyleScreen';
import { ExportScreen, Printable } from './screens/ExportScreen';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { MeasureStepsScreen } from './screens/MeasureStepsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PhotoScreen } from './screens/PhotoScreen';
import { WhoseScreen } from './screens/WhoseScreen';
import { FittingScreen } from './screens/FittingScreen';
import { TrueScaleScreen } from './screens/TrueScaleScreen';
import { ClientBookScreen } from './screens/ClientBookScreen';
import { CheckFileScreen } from './screens/CheckFileScreen';
import { LoadingScreen } from './ui/LoadingScreen';
import type { FormStart } from './ui/ContourForm';
import type { Piece } from './engine/piece';
import { garmentEase } from './engine/easeMap';

export type Step = 'measure' | 'style' | 'export';
type View = Step | 'welcome' | 'steps' | 'account' | 'photo' | 'whose' | 'fitting' | 'scale' | 'client' | 'check';

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
  /** How the pattern is finished and printed, chosen on the print screen. Older saves have none. */
  finish?: Finish;
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
}

export const DEFAULT_FINISH: Finish = { allowances: 'home', skirtLined: false, bodiceEdges: 'binding', atelier: false, fabricWidth: 140, nap: false, route: 'quick', cloth: 'wool' };

const fmtCm = (v: number) => `${v} cm`;

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

const ready = (values: MeasurementValues, unit: Unit, garment: Garment) =>
  isComplete(values, garment) && !checkMeasurements(values, unit, garment).some((c) => c.level === 'error');

const STEPS: { id: Step; label: string }[] = [
  { id: 'measure', label: 'Measure' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Print' },
];

export default function App() {
  const [saved, setSaved] = usePersistent<Saved>('skirt', INITIAL);
  const [storedAccount, setAccount] = usePersistent<Account>('account', NEW_ACCOUNT);
  const account = withPeople(storedAccount, saved.values);
  const person = activePerson(account);
  const { values } = person;
  const setValues = (v: MeasurementValues) => setAccount(updatePerson(account, person.id, { values: v }));
  const { garment } = saved;
  const measuredBefore = isComplete(values, garment);
  // People who measured before onboarding existed have already met the app, so they skip the welcome.
  const [step, setStep] = useState<View>(measuredBefore ? 'style' : account.onboarded ? 'measure' : 'welcome');
  // The loading screen plays once each time the app opens, before anything else is drawn.
  const [opening, setOpening] = useState(true);
  // The welcome's dress form waits under the loading screen, which wraps its bodice into the form's outline.
  const [formStart, setFormStart] = useState<FormStart>('wait');
  const profile = profileName(account);
  const owner = personName(account, account.people.find((p) => p.id === ME)!);

  const checks = checkMeasurements(values, saved.unit, garment);
  const canLeaveMeasure = ready(values, saved.unit, garment);

  // Corrections from this person's toile fittings go into every pattern drafted for them: the garment's
  // own toile first, then what the person's other toiles found that this one hasn't looked at.
  const ownFitting = person.fittings?.[garment];
  const carried = useMemo(() => carriedFitting(person.fittings, garment), [person.fittings, garment]);
  const fitting = carried.fitting;
  const carriedNotes = useMemo(() => describeCarried(carried), [carried]);
  const skirtStyle = useMemo(() => ({ ...saved.choices, fitting: toFitting(fitting, 'skirt') }), [saved.choices, fitting]);
  const bodiceStyle = useMemo(() => ({ ...validDetails(saved.bodice), fitting: toFitting(fitting, 'bodice') }), [saved.bodice, fitting]);
  const dress = useMemo(
    (): DressChoices => saved.dress ?? { garment: 'dress', fit: saved.bodice.fit, bodice: { ...saved.bodice, length: 'waist' }, skirt: saved.choices },
    [saved.dress, saved.bodice, saved.choices],
  );
  const trousersChoices = saved.trousers ?? DEFAULT_TROUSERS_CHOICES;
  const trousersStyle = useMemo(() => ({ ...trousersChoices, fitting: toFitting(fitting, 'skirt') }), [trousersChoices, fitting]);
  /** The dress in one fit: the bodice at the waist, the skirt below it, each with its toile corrections. */
  const dressStyles = (f: Fitting | undefined) => ({
    bodice: { ...dress.bodice, fit: dress.fit, length: 'waist' as const, fitting: toFitting(f, 'bodice') },
    skirt: { ...dress.skirt, fit: dress.fit, fitting: toFitting(f, 'skirt') },
  });

  const result = useMemo((): { skirt?: SkirtDraft; bodice?: BodiceDraft; dress?: DressDraft; trousers?: TrousersDraft; sleeve?: SleeveDraft; error?: string } => {
    if (!canLeaveMeasure) return {};
    try {
      if (garment === 'bodice') {
        const bodice = draftBodice(values as BodiceMeasurements, bodiceStyle);
        return { bodice, sleeve: sleeveFor(bodice, bodiceStyle, values) };
      }
      if (garment === 'trousers') return { trousers: draftTrousers(values as TrousersMeasurements, trousersStyle) };
      if (garment === 'dress') {
        const st = dressStyles(fitting);
        const d = draftDress(values as DressMeasurements, st.bodice, st.skirt);
        return { dress: d, sleeve: sleeveFor(d.bodice, st.bodice, values) };
      }
      return { skirt: draftSkirt(values as SkirtMeasurements, skirtStyle) };
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.' };
    }
  }, [values, skirtStyle, bodiceStyle, trousersStyle, dress, fitting, garment, canLeaveMeasure]);

  /** Room over the body at every level of the drafted pieces, for the ease map. */
  const ease = useMemo(() => {
    const { skirt, bodice, dress: d, trousers } = result;
    const lv = (b: BodiceDraft) => ({ bust: b.front.apex.y, waist: b.front.waistCentre.y });
    if (bodice) return garmentEase(bodice.pieces, values, lv(bodice));
    if (d) return garmentEase(d.pieces, values, lv(d.bodice));
    if (trousers) return garmentEase(trousers.pieces, values);
    if (skirt) return garmentEase(skirt.pieces, values);
    return undefined;
  }, [result, values]);

  /** The pattern's own pieces with a set of corrections, for the fitting screen's before and after. */
  const draftWith = useMemo(
    () =>
      (f: Fitting): Piece[] | undefined => {
        try {
          if (garment === 'bodice') return draftBodice(values as BodiceMeasurements, { ...saved.bodice, fitting: toFitting(f, 'bodice') }).pieces;
          if (garment === 'trousers') return draftTrousers(values as TrousersMeasurements, { ...trousersChoices, fitting: toFitting(f, 'skirt') }).pieces;
          if (garment === 'dress') {
            const st = dressStyles(f);
            return draftDress(values as DressMeasurements, st.bodice, st.skirt).pieces;
          }
          return draftSkirt(values as SkirtMeasurements, { ...saved.choices, fitting: toFitting(f, 'skirt') }).pieces;
        } catch {
          return undefined;
        }
      },
    [garment, values, saved.bodice, saved.choices, trousersChoices, dress],
  );

  /** The pattern's main pieces with allowances, drafted to any measurements: for grading a size run. */
  const draftAt = useMemo(
    () =>
      (m: MeasurementValues): Piece[] => {
        const allowance = (saved.finish ?? DEFAULT_FINISH).allowances;
        const allow = (pcs: Piece[]) => pcs.map((pc) => withAllowances(pc, allowance));
        if (garment === 'bodice') {
          const b = draftBodice(m as BodiceMeasurements, bodiceStyle);
          return allow([...b.pieces, ...(sleeveFor(b, bodiceStyle, m)?.pieces ?? [])]);
        }
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
        return allow([...k.pieces, waistbandPiece(k, 1.5)]);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [garment, bodiceStyle, trousersStyle, skirtStyle, dress, fitting, saved.finish?.allowances],
  );

  const current = garment === 'bodice' ? saved.bodice : garment === 'dress' ? dress : garment === 'trousers' ? trousersChoices : saved.choices;
  const title = garment === 'bodice' ? describeBodice(saved.bodice) : garment === 'dress' ? describePattern(dress) : garment === 'trousers' ? describeTrousers(trousersChoices) : describe(saved.choices);

  const finish = { ...DEFAULT_FINISH, ...saved.finish };
  const printable = useMemo((): Printable | undefined => {
    const { skirt, bodice, sleeve, dress: dressDraft, trousers } = result;
    const seams = SEAM_WIDTHS[finish.allowances];
    const allow = (pieces: Printable['pieces']) => pieces.map((pc) => withAllowances(pc, finish.allowances));
    const couture = finish.allowances === 'couture';
    const fittingNotes = [...fittingLines(ownFitting, garment), ...carriedNotes.map((l) => `${l}.`)];
    const route = (guide: SewingGuide, c: { garment: 'skirt' | 'bodice' | 'dress'; lined: boolean; zipCm: number }) =>
      finish.route === 'couture' ? toCouture(guide, { ...c, cloth: finish.cloth, traced: couture }) : guide;
    if (trousers) {
      const pieces = allow([...trousers.pieces, trousersWaistband(trousers, 1.5)]);
      const hem = pieces[0].allowances.hem;
      const lays = layPlans(pieces, finish.fabricWidth, finish.nap);
      const m = values as TrousersMeasurements;
      return {
        pieces,
        notes: [
          `Finished waist ${trousers.finishedWaist} cm, hip ${trousers.finishedHip} cm, outside leg ${trousers.lengthCm} cm, crotch seam ${Math.round((trousers.crotch.front + trousers.crotch.back) * 10) / 10} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `${trousers.closure === 'fly' ? `A ${trousers.zipCm} cm fly zip with its facing and shield` : `A ${trousers.zipCm} cm invisible zip in the left side seam`}, and the waistband. The crease line is the grain line. Sewing steps are on the last pages.`,
          ...fittingNotes,
        ],
        guide: trousersGuide(trousers, lays.find((l) => l.fabric === 'self')?.metres ?? trousersFabricMetres(trousers), { seams, width: finish.fabricWidth }),
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
          lining = draftSkirt(values as SkirtMeasurements, { ...skirtStyle, lengthCm: skirt.lengthCm - 2.5 });
        } catch {
          lining = undefined;
        }
      }
      const pieces = allow([...skirt.pieces, ...(lining ? liningPieces(lining) : []), waistbandPiece(skirt, 1.5)]);
      const hem = pieces[0].allowances.hem;
      const lays = layPlans(pieces, finish.fabricWidth, finish.nap);
      const metres = (f: 'self' | 'lining', fallback: () => number) => lays.find((l) => l.fabric === f)?.metres ?? fallback();
      return {
        pieces,
        notes: [
          `Finished waist ${skirt.finishedWaist} cm, hip ${skirt.finishedHip} cm, length ${skirt.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `Waistband${lining ? ' and lining' : ''} included. Sewing steps are on the last pages.`,
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
      const edges = finish.bodiceEdges;
      const bodicePcs = d.pieces.filter((pc) => /^Bodice/.test(pc.name));
      const top = edges === 'lined' ? bodicePcs.map((pc) => ({ ...pc, fabric: 'Self fabric and lining' })) : bodicePcs;
      // Facings are cut from the bodice as sewn, with any moved dart or princess seam closed.
      const [bf, bb] = blockOf(d.bodice);
      const facings = edges === 'facings' ? bodiceFacings(bf, bb, !sleeve, d.bodice.collar !== 'mandarin') : [];
      const pieces = allow([...top, ...(sleeve?.pieces ?? []), ...d.skirt.pieces, ...facings]);
      const lays = layPlans(pieces, finish.fabricWidth, finish.nap);
      const metres = (f: 'self' | 'lining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(d.bodice, sleeve) + fabricMetres(d.skirt);
      const edgeWords = sleeve
        ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
        : { binding: 'bias-bound neck and armholes', facings: 'a faced neck and armholes', lined: 'a lined bodice' }[edges];
      return {
        pieces,
        notes: [
          `Finished bust ${d.finishedBust} cm, waist ${d.finishedWaist} cm, hip ${d.finishedHip} cm, nape to hem ${d.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes, ${fmtCm(pieces.find((pc) => pc.name === 'Skirt front')?.allowances.hem ?? 4)} at the hem. Dashed line = stitching line.`,
          `The skirt is drafted to the bodice: waist seams the same length and darts in one line. A ${d.zipCm} cm centre back zip and ${edgeWords}. Sewing steps are on the last pages.`,
          ...(sleeve ? [`Sleeve: bicep ${sleeve.bicep} cm, ${sleeve.gathers?.crown !== undefined ? `${sleeve.gathers.crown} cm gathered into the crown` : `crown ease ${sleeve.crownEase.front} cm front, ${sleeve.crownEase.back} cm back`}.`] : []),
          ...fittingNotes,
        ],
        guide: route(
          dressGuide(d, dress.skirt, metres('self'), bindingMetres(d.bodice, { neck: edges === 'binding' && d.bodice.collar !== 'mandarin', armholes: sleeve ? edges === 'lined' : edges === 'binding' }), {
            seams,
            edges,
            width: finish.fabricWidth,
            liningM: metres('lining'),
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
      const edges = finish.bodiceEdges;
      const main = edges === 'lined' ? bodice.pieces.map((pc) => (pc.kind ? pc : { ...pc, fabric: 'Self fabric and lining' })) : bodice.pieces;
      // A button front's facings, or a band collar, finish the neck.
      const neckDone = bodice.closure === 'front_buttons' || bodice.collar === 'mandarin' || bodice.collar === 'shirt';
      const facings = edges === 'facings' ? bodiceFacings(...blockOf(bodice), !sleeve, !neckDone) : [];
      const pieces = allow([...main, ...(sleeve?.pieces ?? []), ...facings]);
      const edgeWords = sleeve
        ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
        : { binding: 'bias-bound edges', facings: 'faced neck and armholes', lined: 'a full lining' }[edges];
      const sleeveWords = sleeve ? `${describeBodice(saved.bodice).replace(/^.* with /, 'With ')}` : 'Sleeveless';
      const lays = layPlans(pieces, finish.fabricWidth, finish.nap);
      const metres = (f: 'self' | 'lining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(bodice);
      return {
        pieces,
        notes: [
          `Finished bust ${bodice.finishedBust} cm, waist ${bodice.finishedWaist} cm${below ? `, hem ${bodice.finishedHem} cm` : ''}, back length ${bodice.backLength} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes${below ? ', 2.5 cm at the hem' : ''}. Dashed line = stitching line.`,
          `${sleeveWords}, ${bodice.closure === 'front_buttons' ? `${bodice.buttons?.count ?? 5} buttons down the centre front` : `a ${bodice.zipCm} cm centre back zip`}${bodice.collar !== 'none' ? `, a ${COLLAR_WORDS[bodice.collar]}` : ''} and ${edgeWords}. Sewing steps are on the last pages.`,
          ...(sleeve ? [`Sleeve: bicep ${sleeve.bicep} cm, ${sleeve.gathers?.crown !== undefined ? `${sleeve.gathers.crown} cm gathered into the crown` : `crown ease ${sleeve.crownEase.front} cm front, ${sleeve.crownEase.back} cm back`}.`] : []),
          ...fittingNotes,
        ],
        guide: route(
          bodiceGuide(bodice, saved.bodice, metres('self'), bindingMetres(bodice, { neck: !neckDone && (!sleeve || edges === 'binding'), armholes: !sleeve || edges === 'lined' }), {
            seams,
            edges,
            width: finish.fabricWidth,
            liningM: metres('lining'),
            sleeve,
          }),
          { garment: 'bodice', lined: edges === 'lined', zipCm: bodice.zipCm },
        ),
        spec: [...bodiceSpec(values as BodiceMeasurements, bodice, saved.bodice.length), ...(sleeve ? sleeveSpec(values as SleeveMeasurements, sleeve) : [])],
        lays,
        flat: bodiceFlat(bodice, edges, sleeve),
      };
    }
    return undefined;
  }, [result, saved.choices, saved.bodice, dress, skirtStyle, values, finish.allowances, finish.skirtLined, finish.bodiceEdges, finish.fabricWidth, finish.nap, finish.route, finish.cloth, fitting, ownFitting, carriedNotes, garment]);

  const isSaved = isSavedFor(account, current, person.id);
  const saveState = isSaved ? 'saved' : account.patterns.length >= FREE_SAVED_LIMIT ? 'full' : 'can';

  /** Switch garment, going back to measuring when the new one still needs measurements. */
  const switchGarment = (g: Garment, next: Partial<Saved> = {}, to: View = step, using: MeasurementValues = values) => {
    setSaved({ ...saved, ...next, garment: g });
    const stays = to === 'style' || to === 'export';
    setStep(stays && !ready(using, saved.unit, g) ? 'measure' : to);
  };

  /** Switch whose measurements are in use, going back to measuring when theirs aren't done for this garment. */
  const switchPerson = (id: string, to: View = step) => {
    const who = account.people.find((p) => p.id === id) ?? person;
    setAccount({ ...account, active: who.id });
    setStep((to === 'style' || to === 'export') && !ready(who.values, saved.unit, garment) ? 'measure' : to);
  };

  /** Open a saved pattern: one saved for someone opens with their measurements. */
  const openPattern = (p: Account['patterns'][number]) => {
    const who = account.people.find((x) => x.id === p.personId) ?? person;
    setAccount({ ...account, active: who.id });
    if (isTrousers(p.choices)) switchGarment('trousers', { trousers: p.choices }, 'style', who.values);
    else if (isDress(p.choices)) switchGarment('dress', { dress: p.choices }, 'style', who.values);
    else if (isBodice(p.choices)) switchGarment('bodice', { bodice: p.choices }, 'style', who.values);
    else switchGarment('skirt', { choices: p.choices }, 'style', who.values);
  };

  const reset = () => {
    setSaved(INITIAL);
    setAccount(NEW_ACCOUNT);
    setStep('welcome');
  };

  const findForm = () => {
    const r = document.querySelector('.welcome-hero canvas')?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
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
      <div className="app" {...{ inert: opening ? '' : undefined }}>
        <header className="topbar">
          <div className="brand">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="2.5" y="2.5" width="27" height="27" fill="none" style={{ stroke: 'var(--ink)' }} strokeWidth="1" />
              <path d="M10 22 L16 10 L22 22 M12.5 17 H19.5" style={{ stroke: 'var(--ink)' }} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Maison Tracé</span>
          </div>
          {step !== 'welcome' && step !== 'steps' && (
            <div className="row nav">
          <nav aria-label="Steps" className="steps">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={s.id === step ? 'step on' : 'step'}
                aria-current={s.id === step ? 'step' : undefined}
                disabled={s.id !== 'measure' && !canLeaveMeasure}
                onClick={() => setStep(s.id)}
              >
                <span className="num">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </nav>
              <button
                type="button"
                className={step === 'account' ? 'avatar on' : 'avatar'}
                aria-label={`Your account (${owner})`}
                aria-current={step === 'account' ? 'page' : undefined}
                onClick={() => setStep('account')}
              >
                {owner[0].toUpperCase()}
              </button>
            </div>
          )}
        </header>

        <main className="main">
          {step === 'welcome' && (
            <WelcomeScreen
              formStart={formStart}
              onFinish={({ start }) => {
                const onboarded = { ...account, onboarded: true };
                setAccount(start === 'example' ? updatePerson(onboarded, person.id, { values: { ...EXAMPLE_VALUES, ...values } }) : onboarded);
                setStep(start === 'example' ? 'style' : 'steps');
              }}
            />
          )}
          {step === 'steps' && (
            <MeasureStepsScreen
              garment={garment}
              unit={saved.unit}
              values={values}
              onUnit={(unit) => setSaved({ ...saved, unit })}
              onValues={setValues}
              onBack={() => setStep('welcome')}
              onDone={() => setStep(person.id === ME && !person.named ? 'whose' : 'style')}
            />
          )}
          {step === 'whose' && (
            <WhoseScreen
              garment={garment}
              unit={saved.unit}
              values={values}
              ownerName={account.name}
              onDone={(whose, name) => {
                setAccount(claimMeasurements(account, whose, name));
                setStep('style');
              }}
            />
          )}
          {step === 'photo' && (
            <PhotoScreen
              measured={canLeaveMeasure}
              onApply={(choices) => switchGarment('skirt', { choices }, 'style')}
              onCancel={() => setStep(canLeaveMeasure ? 'style' : 'measure')}
            />
          )}
          {step === 'account' && (
            <AccountScreen
              account={account}
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
              onClientBook={() => {
                setAccount(updatePerson(account, person.id, recordMeasurements(person, new Date().toISOString().slice(0, 10))));
                setStep('client');
              }}
              onRename={(id, name) => setAccount(renamePattern(account, id, name))}
              onRemove={(id) => setAccount(removePattern(account, id))}
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
              onGarment={(g) => switchGarment(g)}
              unit={saved.unit}
              values={values}
              checks={checks}
              onUnit={(unit) => setSaved({ ...saved, unit })}
              onValues={setValues}
              onExample={() => setValues({ ...EXAMPLE_VALUES, ...values })}
              canContinue={canLeaveMeasure}
              onNext={() => {
                setAccount(updatePerson(account, person.id, recordMeasurements(person, new Date().toISOString().slice(0, 10))));
                setStep(person.id === ME && !person.named ? 'whose' : 'style');
              }}
            />
          )}
          {step === 'style' && garment === 'skirt' && (
            <StyleScreen
              easeMap={ease}
              choices={saved.choices}
              onChoices={(choices) => setSaved({ ...saved, choices })}
              onGarment={(g) => switchGarment(g)}
              values={values}
              draft={result.skirt}
              error={result.error}
              onEditMeasurements={() => setStep('measure')}
              onNext={() => setStep('export')}
              saveState={saveState}
              onSave={() => setAccount(savePattern(account, current, describePattern(current), person.id))}
              onAccount={() => setStep('account')}
              onPhoto={() => setStep('photo')}
            />
          )}
          {step === 'style' && garment === 'bodice' && (
            <BodiceStyleScreen
              easeMap={ease}
              choices={saved.bodice}
              onChoices={(bodice) => setSaved({ ...saved, bodice })}
              onGarment={(g) => switchGarment(g)}
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
              easeMap={ease}
              choices={dress}
              onChoices={(d) => setSaved({ ...saved, dress: d })}
              onGarment={(g) => switchGarment(g)}
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
              easeMap={ease}
              choices={trousersChoices}
              onChoices={(t) => setSaved({ ...saved, trousers: t })}
              onGarment={(g) => switchGarment(g)}
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
          {step === 'export' && (
            <ExportScreen
              profile={profile}
              title={title}
              fit={current.fit}
              garment={garment}
              finish={finish}
              onFinish={(f) => setSaved({ ...saved, finish: f })}
              made={printable}
              error={result.error}
              onBack={() => setStep('style')}
              fitting={ownFitting}
              fittingNotes={[...describeFitting(ownFitting, garment), ...carriedNotes]}
              onFitting={() => setStep('fitting')}
              onTrueScale={() => setStep('scale')}
              values={values}
              draftAt={draftAt}
            />
          )}
          {step === 'check' && <CheckFileScreen onBack={() => setStep('account')} />}
          {step === 'client' && (
            <ClientBookScreen
              account={account}
              person={person}
              unit={saved.unit}
              onChange={(p) => setAccount(updatePerson(account, person.id, p))}
              onOpen={openPattern}
              onBack={() => setStep('account')}
            />
          )}
          {step === 'scale' && printable && <TrueScaleScreen pieces={printable.pieces} onBack={() => setStep('export')} />}
          {step === 'fitting' && (
            <FittingScreen
              key={`${person.id}-${garment}`}
              garment={garment}
              fitting={fitting}
              own={ownFitting}
              carried={carried.from}
              draftWith={draftWith}
              hasBustDart={garment === 'skirt' || garment === 'trousers' || (garment === 'dress' ? dress.bodice : saved.bodice).darts !== 'none'}
              onSave={(f, shown) => {
                const next = saveVersion(ownFitting, f, new Date().toISOString().slice(0, 10), shown);
                setAccount(updatePerson(account, person.id, { fittings: { ...person.fittings, [garment]: next } }));
                setStep('export');
              }}
              onCancel={() => setStep('export')}
            />
          )}
        </main>
      </div>
    </>
  );
}
