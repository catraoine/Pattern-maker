import { useState } from 'react';
import type { Garment, Unit } from '../measurements';
import { ContourForm, type FormStart } from '../ui/ContourForm';

interface Props {
  unit: Unit;
  garment: Garment;
  onFinish: (r: { unit: Unit; start: 'measure' | 'example' | 'photo' }) => void;
  /** How the dress form starts: it waits for the loading screen, which may hand it over already outlined. */
  formStart?: FormStart;
}

const STEPS = 2;

// The name is asked later, once there are measurements to put it on (see WhoseScreen).
export function WelcomeScreen({ unit: initialUnit, garment, onFinish, formStart }: Props) {
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const finish = (start: 'measure' | 'example' | 'photo') => onFinish({ unit, start });

  return (
    <div className="welcome">
      <section className="card welcome-card" aria-labelledby="wtitle">
        <div className="dots" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i <= step ? 'dot on' : 'dot'} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="welcome-hero">
              <ContourForm start={formStart} />
            </div>
            <p className="eyebrow">Measured, not sized</p>
            <h1 id="wtitle">Sewing patterns drafted to your body.</h1>
            <ol className="how" aria-label="How it works">
              <li>
                <span className="num">01</span>
                <strong>Measure</strong>
              </li>
              <li>
                <span className="num">02</span>
                <strong>Style</strong>
              </li>
              <li>
                <span className="num">03</span>
                <strong>Print</strong>
              </li>
            </ol>
            <button type="button" className="primary" onClick={() => setStep(1)}>
              Begin
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 id="wtitle">Ready when you are</h1>
            <p>
              Measuring a {garment} takes about {garment === 'skirt' ? 'five' : garment === 'trousers' ? 'ten' : 'fifteen'} minutes. You'll need a soft tape measure, close-fitting
              clothes and, if you can, a helper for the lengths.
            </p>
            <fieldset className="group">
              <legend>Your tape measure</legend>
              <div className="seg" role="group" aria-label="Units">
                {(['cm', 'in'] as Unit[]).map((u) => (
                  <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
                    {u === 'cm' ? 'Centimetres' : 'Inches'}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="stack">
              <button type="button" className="primary" onClick={() => finish('measure')}>
                Start measuring
              </button>
              {garment === 'skirt' && (
                <button type="button" className="secondary" onClick={() => finish('photo')}>
                  Start from a photo of a skirt
                </button>
              )}
              <button type="button" className="link" onClick={() => finish('example')}>
                Just looking? Use example measurements
              </button>
            </div>
            <p className="muted small">
              {garment === 'skirt' ? 'You start with a skirt. A bodice is one tap away when you measure.' : 'You start with a bodice. A skirt is one tap away when you measure.'} Your
              measurements stay on this device.
            </p>
            <button type="button" className="link" onClick={() => setStep(0)}>
              Back
            </button>
          </>
        )}
      </section>
    </div>
  );
}
