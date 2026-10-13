import { useMemo, useState } from 'react';
import { DraftError, Fit, Length, Silhouette, SkirtDraft, draftSkirt } from './engine/skirt';
import { EXAMPLE_VALUES, MeasurementValues, Unit, checkMeasurements, isComplete } from './measurements';
import { usePersistent } from './store';
import { MeasureScreen } from './screens/MeasureScreen';
import { StyleScreen } from './screens/StyleScreen';
import { ExportScreen } from './screens/ExportScreen';

export type Step = 'measure' | 'style' | 'export';

export interface Choices {
  fit: Fit;
  silhouette: Silhouette;
  length: Length;
}

interface Saved {
  unit: Unit;
  values: MeasurementValues;
  choices: Choices;
}

const INITIAL: Saved = {
  unit: 'cm',
  values: {},
  choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' },
};

const STEPS: { id: Step; label: string }[] = [
  { id: 'measure', label: 'Measure' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Print' },
];

export default function App() {
  const [saved, setSaved] = usePersistent<Saved>('skirt', INITIAL);
  const measuredBefore = isComplete(saved.values);
  const [step, setStep] = useState<Step>(measuredBefore ? 'style' : 'measure');

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" fill="#111" />
            <path d="M9 22 L16 9 L23 22 M12 17 H20" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>pattern_maker</span>
        </div>
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
      </header>

      <main className="main">
        {step === 'measure' && (
          <MeasureScreen
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
          />
        )}
        {step === 'export' && (
          <ExportScreen choices={saved.choices} draft={result.draft} error={result.error} onBack={() => setStep('style')} />
        )}
      </main>
    </div>
  );
}
