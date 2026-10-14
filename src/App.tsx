import { useMemo, useState } from 'react';
import type { HemShape } from './engine/hem';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, SkirtMeasurements, SkirtShape, draftSkirt } from './engine/skirt';
import { BodiceDraft, BodiceMeasurements, draftBodice } from './engine/bodice';
import { bodiceGuide, sewingGuide } from './engine/instructions';
import { EXAMPLE_VALUES, Garment, MeasurementValues, Unit, checkMeasurements, isComplete } from './measurements';
import { usePersistent } from './store';
import { Account, NEW_ACCOUNT, makeBackup, readBackup, profileName, removePattern, renamePattern, sameChoices, savePattern, FREE_SAVED_LIMIT } from './account';
import { BodiceChoices, DEFAULT_BODICE, describeBodice, isBodice } from './garments';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen, describe, fabricMetres } from './screens/StyleScreen';
import { BodiceStyleScreen, bindingMetres, bodiceFabricMetres } from './screens/BodiceStyleScreen';
import { ExportScreen, Printable } from './screens/ExportScreen';
import { describePattern } from './screens/describe';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PhotoScreen } from './screens/PhotoScreen';

export type Step = 'measure' | 'style' | 'export';
type View = Step | 'welcome' | 'account' | 'photo';

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
// have no garment and open as a skirt.
interface Saved {
  unit: Unit;
  values: MeasurementValues;
  choices: Choices;
  garment: Garment;
  bodice: BodiceChoices;
}

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
  const [account, setAccount] = usePersistent<Account>('account', NEW_ACCOUNT);
  const { garment } = saved;
  const measuredBefore = isComplete(saved.values, garment);
  // People who measured before onboarding existed have already met the app, so they skip the welcome.
  const [step, setStep] = useState<View>(measuredBefore ? 'style' : account.onboarded ? 'measure' : 'welcome');
  const profile = profileName(account);

  const checks = checkMeasurements(saved.values, saved.unit, garment);
  const canLeaveMeasure = ready(saved.values, saved.unit, garment);

  const result = useMemo((): { skirt?: SkirtDraft; bodice?: BodiceDraft; error?: string } => {
    if (!canLeaveMeasure) return {};
    try {
      if (garment === 'bodice') return { bodice: draftBodice(saved.values as BodiceMeasurements, saved.bodice) };
      return { skirt: draftSkirt(saved.values as SkirtMeasurements, saved.choices) };
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.' };
    }
  }, [saved.values, saved.choices, saved.bodice, garment, canLeaveMeasure]);

  const current = garment === 'bodice' ? saved.bodice : saved.choices;
  const title = garment === 'bodice' ? describeBodice(saved.bodice) : describe(saved.choices);

  const printable = useMemo((): Printable | undefined => {
    const { skirt, bodice } = result;
    if (skirt) {
      return {
        pieces: skirt.pieces,
        notes: [
          `Finished waist ${skirt.finishedWaist} cm, hip ${skirt.finishedHip} cm, length ${skirt.lengthCm} cm.`,
          'Seam allowance 1.5 cm included, 4 cm at the hem. Dashed line = stitching line.',
          `Waistband: mark a ${skirt.waistband.cutLength} x ${skirt.waistband.cutWidth} cm strip on the fabric. Sewing steps are on the last pages.`,
        ],
        guide: sewingGuide(skirt, saved.choices, fabricMetres(skirt)),
      };
    }
    if (bodice) {
      const below = bodice.finishedHem !== undefined;
      return {
        pieces: bodice.pieces,
        notes: [
          `Finished bust ${bodice.finishedBust} cm, waist ${bodice.finishedWaist} cm${below ? `, hem ${bodice.finishedHem} cm` : ''}, back length ${bodice.backLength} cm.`,
          `Seam allowance 1.5 cm included, 1 cm at the neck and armholes${below ? ', 2.5 cm at the hem' : ''}. Dashed line = stitching line.`,
          `Sleeveless, with a ${bodice.zipCm} cm centre back zip and bias-bound edges. Sewing steps are on the last pages.`,
        ],
        guide: bodiceGuide(bodice, saved.bodice, bodiceFabricMetres(bodice), bindingMetres(bodice)),
      };
    }
    return undefined;
  }, [result, saved.choices, saved.bodice]);

  const isSaved = account.patterns.some((p) => sameChoices(p.choices, current));
  const saveState = isSaved ? 'saved' : account.patterns.length >= FREE_SAVED_LIMIT ? 'full' : 'can';

  /** Switch garment, going back to measuring when the new one still needs measurements. */
  const switchGarment = (g: Garment, next: Partial<Saved> = {}, to: View = step) => {
    setSaved({ ...saved, ...next, garment: g });
    const stays = to === 'style' || to === 'export';
    setStep(stays && !ready(saved.values, saved.unit, g) ? 'measure' : to);
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
          <span>Pattern Maker</span>
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
              aria-label={`Your account (${profile})`}
              aria-current={step === 'account' ? 'page' : undefined}
              onClick={() => setStep('account')}
            >
              {profile[0].toUpperCase()}
            </button>
          </div>
        )}
      </header>

      <main className="main">
        {step === 'welcome' && (
          <WelcomeScreen
            name={account.name}
            unit={saved.unit}
            garment={garment}
            onFinish={({ name, unit, garment: g, start }) => {
              setAccount({ ...account, name, onboarded: true });
              setSaved({ ...saved, unit, garment: g, values: start === 'example' ? { ...EXAMPLE_VALUES, ...saved.values } : saved.values });
              setStep(start === 'example' ? 'style' : start);
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
            values={saved.values}
            onName={(name) => setAccount({ ...account, name })}
            onUnit={(unit) => setSaved({ ...saved, unit })}
            onEditMeasurements={() => setStep('measure')}
            onOpen={(p) =>
              isBodice(p.choices) ? switchGarment('bodice', { bodice: p.choices }, 'style') : switchGarment('skirt', { choices: p.choices }, 'style')
            }
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
            profile={profile}
            garment={garment}
            onGarment={(g) => switchGarment(g)}
            unit={saved.unit}
            values={saved.values}
            checks={checks}
            onUnit={(unit) => setSaved({ ...saved, unit })}
            onValues={(values) => setSaved({ ...saved, values })}
            onExample={() => setSaved({ ...saved, values: { ...EXAMPLE_VALUES, ...saved.values } })}
            canContinue={canLeaveMeasure}
            onNext={() => setStep('style')}
          />
        )}
        {step === 'style' && garment === 'skirt' && (
          <StyleScreen
            choices={saved.choices}
            onChoices={(choices) => setSaved({ ...saved, choices })}
            onGarment={(g) => switchGarment(g)}
            values={saved.values}
            draft={result.skirt}
            error={result.error}
            onEditMeasurements={() => setStep('measure')}
            onNext={() => setStep('export')}
            saveState={saveState}
            onSave={() => setAccount(savePattern(account, current, describePattern(current)))}
            onAccount={() => setStep('account')}
            onPhoto={() => setStep('photo')}
          />
        )}
        {step === 'style' && garment === 'bodice' && (
          <BodiceStyleScreen
            choices={saved.bodice}
            onChoices={(bodice) => setSaved({ ...saved, bodice })}
            onGarment={(g) => switchGarment(g)}
            values={saved.values}
            draft={result.bodice}
            error={result.error}
            onEditMeasurements={() => setStep('measure')}
            onNext={() => setStep('export')}
            saveState={saveState}
            onSave={() => setAccount(savePattern(account, current, describePattern(current)))}
            onAccount={() => setStep('account')}
          />
        )}
        {step === 'export' && (
          <ExportScreen profile={profile} title={title} fit={current.fit} made={printable} error={result.error} onBack={() => setStep('style')} />
        )}
      </main>
    </div>
  );
}
