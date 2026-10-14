import { useState } from 'react';
import type { Unit } from '../measurements';
import { SKIRT_FIELDS } from '../measurements';

interface Props {
  name: string;
  unit: Unit;
  onFinish: (r: { name: string; unit: Unit; start: 'measure' | 'example' | 'photo' }) => void;
}

const STEPS = 3;

export function WelcomeScreen({ name: initialName, unit: initialUnit, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const finish = (start: 'measure' | 'example' | 'photo') => onFinish({ name: name.trim(), unit, start });

  return (
    <div className="welcome">
      <section className="card welcome-card" aria-labelledby="wtitle">
        <div className="row between">
          <p className="eyebrow" aria-live="polite">
            Step {step + 1} of {STEPS}
          </p>
          <div className="dots" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={i <= step ? 'dot on' : 'dot'} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <>
            <h1 id="wtitle">Sewing patterns drafted to your body.</h1>
            <p>No more grading between sizes or guessing at alterations. Pattern Maker draws a skirt pattern from your own measurements.</p>
            <ol className="how">
              <li>
                <span className="num">1</span>
                <div>
                  <strong>Measure</strong>
                  <p className="muted small">Five measurements, with a picture showing where the tape goes.</p>
                </div>
              </li>
              <li>
                <span className="num">2</span>
                <div>
                  <strong>Style</strong>
                  <p className="muted small">Pick the fit, shape and length. The pattern redraws as you choose.</p>
                </div>
              </li>
              <li>
                <span className="num">3</span>
                <div>
                  <strong>Print</strong>
                  <p className="muted small">Download a PDF for A4 or Letter paper, tape the pages together and cut.</p>
                </div>
              </li>
            </ol>
            <button type="button" className="primary" onClick={() => setStep(1)}>
              Get started
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 id="wtitle">A little about you</h1>
            <div className="field plain">
              <label htmlFor="wname">What should we call you?</label>
              <input id="wname" autoComplete="given-name" value={name} placeholder="Optional" onChange={(e) => setName(e.target.value)} />
            </div>
            <fieldset className="group">
              <legend>Which units does your tape measure use?</legend>
              <div className="seg" role="group" aria-label="Units">
                {(['cm', 'in'] as Unit[]).map((u) => (
                  <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
                    {u === 'cm' ? 'Centimetres' : 'Inches'}
                  </button>
                ))}
              </div>
              <p className="muted small">You can switch at any time.</p>
            </fieldset>
            <div className="row between wrap footer">
              <button type="button" className="link" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="primary" onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="wtitle">{name.trim() ? `Ready when you are, ${name.trim()}` : 'Ready when you are'}</h1>
            <p>Measuring takes about five minutes. You'll need:</p>
            <ul className="checklist">
              <li>A soft tape measure</li>
              <li>Close-fitting clothes, or just underwear</li>
              <li>A helper if you have one, as it makes the lengths easier</li>
            </ul>
            <p className="muted small">We'll ask for {SKIRT_FIELDS.map((f) => f.label.toLowerCase()).join(', ')}.</p>
            <p className="muted small">Everything stays on this device. Nothing is sent anywhere.</p>
            <div className="stack">
              <button type="button" className="primary" onClick={() => finish('measure')}>
                Start measuring
              </button>
              <button type="button" className="secondary" onClick={() => finish('photo')}>
                Have a skirt you love? Start from a photo
              </button>
              <button type="button" className="secondary" onClick={() => finish('example')}>
                Just looking? Try example measurements
              </button>
              <button type="button" className="link" onClick={() => setStep(1)}>
                Back
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
