import { lazy, Suspense, useMemo, useState } from 'react';
import type { SewingGuide } from '../engine/instructions';
import type { Printable } from '../screens/ExportScreen';
import { TechFlatView } from './TechFlatView';
import { guideDrawings, stepFrames } from '../engine/stepFrames';
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
  const key = useMemo(() => guideDrawings(guide.steps), [guide]);
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
      {/* One key for every drawing on the list, before the first of them: a key under each step came twice on one
          laptop screen and only after the lines it explained (EL cold read, Nov 27). */}
      {key.length > 0 && (
        <div className="sew-key">
          <p className="eyebrow">Reading the drawings</p>
          <DiagramKey dgs={key} />
        </div>
      )}
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
                <ol className="sewframes-row" aria-label={`Drawings for ${st.title}`}>
                  {frames.map((d, k) => (
                    <li key={k}>
                      <StepDiagram dg={d} />
                    </li>
                  ))}
                </ol>
              ) : (
                st.diagram && <StepDiagram id={st.diagram} />
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
