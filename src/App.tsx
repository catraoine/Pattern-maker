import { useMemo, useState } from 'react';
import type { HemShape } from './engine/hem';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, SkirtMeasurements, SkirtShape, draftSkirt } from './engine/skirt';
import { BodiceDraft, BodiceMeasurements, draftBodice } from './engine/bodice';
import { BodiceEdges, bodiceGuide, sewingGuide } from './engine/instructions';
import { AllowanceStyle, SEAM_WIDTHS, withAllowances } from './engine/allowances';
import { bodiceFacings, liningPieces, waistbandPiece } from './engine/finishing';
import { bodiceSpec, skirtSpec } from './engine/spec';
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
  withPeople,
  FREE_SAVED_LIMIT,
} from './account';
import { BodiceChoices, DEFAULT_BODICE, describeBodice, isBodice } from './garments';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen, describe, fabricMetres } from './screens/StyleScreen';
import { BodiceStyleScreen, bindingMetres, bodiceFabricMetres } from './screens/BodiceStyleScreen';
import { ExportScreen, Printable } from './screens/ExportScreen';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PhotoScreen } from './screens/PhotoScreen';
import { WhoseScreen } from './screens/WhoseScreen';

export type Step = 'measure' | 'style' | 'export';
type View = Step | 'welcome' | 'account' | 'photo' | 'whose';

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
  /** How the pattern is finished and printed, chosen on the print screen. Older saves have none. */
  finish?: Finish;
}

/** Seam allowances, lining and facings, and whether the draft itself is shown. */
export interface Finish {
  allowances: AllowanceStyle;
  skirtLined: boolean;
  bodiceEdges: BodiceEdges;
  atelier: boolean;
}

export const DEFAULT_FINISH: Finish = { allowances: 'home', skirtLined: false, bodiceEdges: 'binding', atelier: false };

const fmtCm = (v: number) => `${v} cm`;

const INITIAL: Saved = {
  unit: 'cm',
  values: {},
  choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' } as Choices,
  garment: 'skirt',
  bodice: DEFAULT_BODICE,
};

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
  const profile = profileName(account);
  const owner = personName(account, account.people.find((p) => p.id === ME)!);

  const checks = checkMeasurements(values, saved.unit, garment);
  const canLeaveMeasure = ready(values, saved.unit, garment);

  const result = useMemo((): { skirt?: SkirtDraft; bodice?: BodiceDraft; error?: string } => {
    if (!canLeaveMeasure) return {};
    try {
      if (garment === 'bodice') return { bodice: draftBodice(values as BodiceMeasurements, saved.bodice) };
      return { skirt: draftSkirt(values as SkirtMeasurements, saved.choices) };
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.' };
    }
  }, [values, saved.choices, saved.bodice, garment, canLeaveMeasure]);

  const current = garment === 'bodice' ? saved.bodice : saved.choices;
  const title = garment === 'bodice' ? describeBodice(saved.bodice) : describe(saved.choices);

  const finish = { ...DEFAULT_FINISH, ...saved.finish };
  const printable = useMemo((): Printable | undefined => {
    const { skirt, bodice } = result;
    const seams = SEAM_WIDTHS[finish.allowances];
    const allow = (pieces: Printable['pieces']) => pieces.map((pc) => withAllowances(pc, finish.allowances));
    const couture = finish.allowances === 'couture';
    if (skirt) {
      // The lining is drafted 2.5 cm shorter than the skirt, from the same measurements and style.
      let lining: SkirtDraft | undefined;
      if (finish.skirtLined) {
        try {
          lining = draftSkirt(values as SkirtMeasurements, { ...saved.choices, lengthCm: skirt.lengthCm - 2.5 });
        } catch {
          lining = undefined;
        }
      }
      const pieces = allow([...skirt.pieces, ...(lining ? liningPieces(lining) : []), waistbandPiece(skirt, 1.5)]);
      const hem = pieces[0].allowances.hem;
      return {
        pieces,
        notes: [
          `Finished waist ${skirt.finishedWaist} cm, hip ${skirt.finishedHip} cm, length ${skirt.lengthCm} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
          `Waistband${lining ? ' and lining' : ''} included. Sewing steps are on the last pages.`,
        ],
        guide: sewingGuide(skirt, saved.choices, fabricMetres(skirt), {
          seams,
          liningM: lining ? fabricMetres(lining) : undefined,
          hem: skirt.pieces[0].allowances.hem >= 4 ? hem : undefined,
        }),
        spec: skirtSpec(values as SkirtMeasurements, skirt),
      };
    }
    if (bodice) {
      const below = bodice.finishedHem !== undefined;
      const edges = finish.bodiceEdges;
      const main = edges === 'lined' ? bodice.pieces.map((pc) => ({ ...pc, fabric: 'Self fabric and lining' })) : bodice.pieces;
      const pieces = allow([...main, ...(edges === 'facings' ? bodiceFacings(bodice.pieces[0], bodice.pieces[1]) : [])]);
      const edgeWords = { binding: 'bias-bound edges', facings: 'faced neck and armholes', lined: 'a full lining' }[edges];
      return {
        pieces,
        notes: [
          `Finished bust ${bodice.finishedBust} cm, waist ${bodice.finishedWaist} cm${below ? `, hem ${bodice.finishedHem} cm` : ''}, back length ${bodice.backLength} cm.`,
          couture
            ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
            : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes${below ? ', 2.5 cm at the hem' : ''}. Dashed line = stitching line.`,
          `Sleeveless, with a ${bodice.zipCm} cm centre back zip and ${edgeWords}. Sewing steps are on the last pages.`,
        ],
        guide: bodiceGuide(bodice, saved.bodice, bodiceFabricMetres(bodice), bindingMetres(bodice), {
          seams,
          edges,
          liningM: bodiceFabricMetres(bodice),
        }),
        spec: bodiceSpec(values as BodiceMeasurements, bodice, saved.bodice.length),
      };
    }
    return undefined;
  }, [result, saved.choices, saved.bodice, values, finish.allowances, finish.skirtLined, finish.bodiceEdges]);

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

  const reset = () => {
    setSaved(INITIAL);
    setAccount(NEW_ACCOUNT);
    setStep('welcome');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2.5" y="2.5" width="27" height="27" fill="none" style={{ stroke: 'var(--ink)' }} strokeWidth="1" />
            <path d="M10 22 L16 10 L22 22 M12.5 17 H19.5" style={{ stroke: 'var(--ink)' }} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Maison Tracé</span>
        </div>
        {step !== 'welcome' && (
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
            unit={saved.unit}
            garment={garment}
            onFinish={({ unit, start }) => {
              const onboarded = { ...account, onboarded: true };
              setAccount(start === 'example' ? updatePerson(onboarded, person.id, { values: { ...EXAMPLE_VALUES, ...values } }) : onboarded);
              setSaved({ ...saved, unit });
              setStep(start === 'example' ? 'style' : start);
            }}
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
            onOpen={(p) => {
              // A pattern saved for someone opens with their measurements.
              const who = account.people.find((x) => x.id === p.personId) ?? person;
              setAccount({ ...account, active: who.id });
              if (isBodice(p.choices)) switchGarment('bodice', { bodice: p.choices }, 'style', who.values);
              else switchGarment('skirt', { choices: p.choices }, 'style', who.values);
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
            onNext={() => setStep(person.id === ME && !person.named ? 'whose' : 'style')}
          />
        )}
        {step === 'style' && garment === 'skirt' && (
          <StyleScreen
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
            choices={saved.bodice}
            onChoices={(bodice) => setSaved({ ...saved, bodice })}
            onGarment={(g) => switchGarment(g)}
            values={values}
            draft={result.bodice}
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
          />
        )}
      </main>
    </div>
  );
}
