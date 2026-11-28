import { lazy, Suspense, useState } from 'react';
import type { SewingGuide } from '../engine/instructions';
import type { Printable } from '../screens/ExportScreen';
import { TechFlatView } from './TechFlatView';
import { DIAGRAMS } from '../engine/diagrams';
import { stepFrames } from '../engine/stepFrames';
import { stepLines } from '../engine/stepLines';
import { inCm } from '../units';
import { DiagramKey, StepDiagram } from './StepDiagram';

// Sewing mode loads only when it is opened.
const SewingMode = lazy(() => import('./SewingMode').then((m) => ({ default: m.SewingMode })));

// Every step written out, with its drawings, folded on Sew under the picture list. It was on Print's Sew it part
// until Print, Cut and Sew became chapters of their own (Cat, Nov 28: "it should fully move to the Sew chapter").

/** The written steps, in order, each with its close-ups or its one drawing. A pattern read from a file, or the form
 *  cover, has no Sew tab, so `sew` puts Sewing mode's Start sewing above the list there. */
export function WrittenSteps({ guide, sew }: { guide: SewingGuide; sew?: { made: Printable; title: string } }) {
  const [sewing, setSewing] = useState(false);
  return (
    <>
    {sew && (
      <section className="card" aria-label="Sew it">
        <p className="small">{guide.steps.length} steps, one at a time, each drawn from your own pieces. Keep it open by your machine.</p>
        <button type="button" className="secondary" onClick={() => setSewing(true)}>
          Start sewing <span aria-hidden="true">›</span>
        </button>
      </section>
    )}
    {sew && sewing && (
      <Suspense fallback={null}>
        <SewingMode
          steps={guide.steps}
          pieces={sew.made.pieces}
          lays={sew.made.lays}
          flat={sew.made.flat ? <TechFlatView flat={sew.made.flat} title={sew.title} /> : null}
          title={sew.title}
          keep={sew.title}
          inCm={inCm}
          onClose={() => setSewing(false)}
        />
      </Suspense>
    )}
    <details className="card sew">
      <summary className="sew-summary">
        <h3 className="sew-list-head">Every step as a list</h3>
      </summary>
      <div className="sewgrid">
      <ol className="sewsteps">
        {guide.steps.map((st) => {
          // The trickier steps' close-ups, in the order the step's sentences come (Nov 27), in place of
          // the step's one small drawing.
          const frames = stepFrames(st.title, stepLines(st.text));
          return (
            <li key={st.title}>
              <strong>{st.title}</strong>
              <p>{inCm(st.text)}</p>
              {frames.length > 0 ? (
                <>
                  <ol className="sewframes-row" aria-label={`Drawings for ${st.title}`}>
                    {frames.map((d, k) => (
                      <li key={k}>
                        <StepDiagram dg={d} />
                      </li>
                    ))}
                  </ol>
                  <DiagramKey dgs={frames} />
                </>
              ) : (
                st.diagram && (
                  <>
                    <StepDiagram id={st.diagram} />
                    <DiagramKey dgs={[DIAGRAMS[st.diagram]]} />
                  </>
                )
              )}
            </li>
          );
        })}
      </ol>
        <p className="muted small">These steps are also in the instructions booklet.</p>
      </div>
    </details>
    </>
  );
}
