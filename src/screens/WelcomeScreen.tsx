import { ContourForm, type FormStart } from '../ui/ContourForm';

interface Props {
  onFinish: (r: { start: 'measure' | 'example' }) => void;
  /** How the dress form starts: it waits for the loading screen, which may hand it over already outlined. */
  formStart?: FormStart;
}

// The name is asked later, once there are measurements to put it on (see WhoseScreen).
// Units are chosen on the measuring pages, by the box you type into.
export function WelcomeScreen({ onFinish, formStart }: Props) {
  return (
    <div className="welcome">
      <section className="card welcome-card" aria-labelledby="wtitle">
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
        <div className="stack">
          <button type="button" className="primary" onClick={() => onFinish({ start: 'measure' })}>
            Begin
          </button>
          <button type="button" className="link quiet-link" onClick={() => onFinish({ start: 'example' })}>
            Just looking? Try an example
          </button>
        </div>
      </section>
    </div>
  );
}
