import { useMemo, useState } from 'react';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, draftSkirt } from './engine/skirt';
import { EXAMPLE_VALUES, MeasurementValues, Unit, checkMeasurements, isComplete } from './measurements';
import { usePersistent } from './store';
import { Account, NEW_ACCOUNT, makeBackup, readBackup, profileName, removePattern, renamePattern, sameChoices, savePattern, FREE_SAVED_LIMIT } from './account';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen, describe } from './screens/StyleScreen';
import { ExportScreen } from './screens/ExportScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { AccountScreen } from './screens/AccountScreen';

export type Step = 'measure' | 'style' | 'export';
type View = Step | 'welcome' | 'account';

export interface Choices {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
  /** An era look the choices came from, kept while the shape and length still match it. */
  look?: string;
}

interface Saved {
  unit: Unit;
  values: MeasurementValues;
  choices: Choices;
}

const INITIAL: Saved = {
  unit: 'cm',
  values: {},
  choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' } as Choices,
};

const STEPS: { id: Step; label: string }[] = [
  { id: 'measure', label: 'Measure' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Print' },
];

export default function App() {
  const [saved, setSaved] = usePersistent<Saved>('skirt', INITIAL);
  const [account, setAccount] = usePersistent<Account>('account', NEW_ACCOUNT);
  const measuredBefore = isComplete(saved.values);
  // People who measured before onboarding existed have already met the app, so they skip the welcome.
  const [step, setStep] = useState<View>(measuredBefore ? 'style' : account.onboarded ? 'measure' : 'welcome');
  const profile = profileName(account);

  const checks = checkMeasurements(saved.values, saved.unit);
  const blocked = checks.some((c) => c.level === 'error');

  const result = useMemo((): { draft?: SkirtDraft; error?: string } => {
    if (!isComplete(saved.values) || blocked) return {};
    try {
      return { draft: draftSkirt(saved.values, saved.choices) };
    } catch (e) {
      return { error: e instanceof DraftError ? e.message : 'Something went wrong drafting this pattern.' };
    }
  }, [saved.values, saved.choices, blocked]);

  const canLeaveMeasure = isComplete(saved.values) && !blocked;

  const isSaved = account.patterns.some((p) => sameChoices(p.choices, saved.choices));
  const saveState = isSaved ? 'saved' : account.patterns.length >= FREE_SAVED_LIMIT ? 'full' : 'can';

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
            onFinish={({ name, unit, example }) => {
              setAccount({ ...account, name, onboarded: true });
              setSaved({ ...saved, unit, values: example ? EXAMPLE_VALUES : saved.values });
              setStep(example ? 'style' : 'measure');
            }}
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
            onOpen={(p) => {
              setSaved({ ...saved, choices: p.choices });
              setStep(canLeaveMeasure ? 'style' : 'measure');
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
            profile={profile}
            unit={saved.unit}
            values={saved.values}
            checks={checks}
            onUnit={(unit) => setSaved({ ...saved, unit })}
            onValues={(values) => setSaved({ ...saved, values })}
            onExample={() => setSaved({ ...saved, values: EXAMPLE_VALUES })}
            canContinue={canLeaveMeasure}
            onNext={() => setStep('style')}
          />
        )}
        {step === 'style' && (
          <StyleScreen
            choices={saved.choices}
            onChoices={(choices) => setSaved({ ...saved, choices })}
            values={saved.values}
            draft={result.draft}
            error={result.error}
            onEditMeasurements={() => setStep('measure')}
            onNext={() => setStep('export')}
            saveState={saveState}
            onSave={() => setAccount(savePattern(account, saved.choices, describe(saved.choices)))}
            onAccount={() => setStep('account')}
          />
        )}
        {step === 'export' && (
          <ExportScreen profile={profile} choices={saved.choices} draft={result.draft} error={result.error} onBack={() => setStep('style')} />
        )}
      </main>
    </div>
  );
}
