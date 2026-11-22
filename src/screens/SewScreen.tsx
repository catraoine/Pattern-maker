import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Printable } from './ExportScreen';
import { stepPicture } from '../engine/stepPictures';
import { SewPicture } from '../ui/SewPicture';
import { TechFlatView } from '../ui/TechFlatView';
import { readAt } from '../ui/sewPlace';
import { inCm } from '../units';

// Sew, the fourth step after Print (Cat, Nov 21): Sewing mode's start, where you left off, and every step as a picture to
// jump straight to. The written list, with what you'll need and the couture route, stays on Print where testers know it.

const SewingMode = lazy(() => import('../ui/SewingMode').then((m) => ({ default: m.SewingMode })));

interface Props {
  made?: Printable;
  title: string;
  /** Where this pattern's place is kept between visits. */
  keep: string;
  /** To Print, for the written steps and what you'll need. */
  onPrint: () => void;
  /** To Style, when the pattern can't be drafted. */
  onStyle: () => void;
}

export function SewScreen({ made, title, keep, onPrint, onStyle }: Props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  // Sewing mode, open on the kept step (undefined) or on one picked from the list.
  const [open, setOpen] = useState<{ from?: number }>();
  const steps = useMemo(() => made?.guide.steps ?? [], [made]);
  const pictures = useMemo(() => (made ? steps.map((st) => stepPicture(st, made.pieces)) : []), [made, steps]);
  // Read again each time Sewing mode closes, so "Carry on" names the step you stopped at.
  const at = useMemo(() => (open ? 0 : readAt(keep, steps.length)), [open, keep, steps.length]);
  if (!made || !steps.length) {
    return (
      <section className="card" aria-labelledby="sewhead">
        <h1 id="sewhead">Sew</h1>
        <p>Your pattern isn't drafted yet. Finish your style and the steps to sew it appear here.</p>
        <button type="button" className="primary" onClick={onStyle}>
          Back to Style <span aria-hidden="true">›</span>
        </button>
      </section>
    );
  }
  const flat = made.flat ? <TechFlatView flat={made.flat} title={title} /> : null;
  const first = pictures.find((pic) => pic.kind === 'cut') ?? pictures[0];
  return (
    <>
      <section className="card sew-card sewscreen" aria-labelledby="sewhead">
        {/* A modest heading and one guiding line, like Print's (Cat, Nov 3: big capitals for a whole choice jar). */}
        <h1 id="sewhead">Sew it</h1>
        <p className="sew-guide">Your {title}, one step at a time.</p>
        <div className="sew-start">
          <div className="sewmode-pic">
            <SewPicture picture={at ? pictures[at] : first} pieces={made.pieces} lays={made.lays} flat={flat} />
          </div>
          <p className="small">
            {at ? `You stopped at step ${at + 1} of ${steps.length}: ${steps[at].title}.` : `${steps.length} steps, one at a time, each drawn from your own pieces. Keep it open by your machine.`}
          </p>
          <div className="sew-start-go">
            <button type="button" className="primary" onClick={() => setOpen({})}>
              {at ? 'Carry on sewing' : 'Start sewing'} <span aria-hidden="true">›</span>
            </button>
            {at > 0 && (
              <button type="button" className="ghost" onClick={() => setOpen({ from: 0 })}>
                From the start
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="card sew-index" aria-labelledby="sewall">
        <h2 id="sewall">Every step</h2>
        <ol className="sew-index-list">
          {steps.map((st, i) => (
            <li key={st.title + i}>
              <button type="button" className={i === at ? 'on' : undefined} onClick={() => setOpen({ from: i })}>
                <span className="sew-index-pic">
                  <SewPicture picture={pictures[i]} pieces={made.pieces} lays={made.lays} flat={flat} still />
                </span>
                <span className="eyebrow">Step {i + 1}</span>
                <span className="sew-index-title">{st.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="muted small">
          The written steps, with your fabric and everything you'll need, are on{' '}
          <button type="button" className="link inline-link" onClick={onPrint}>
            Print
          </button>
          .
        </p>
      </section>
      {open && (
        <Suspense fallback={null}>
          <SewingMode steps={steps} pieces={made.pieces} lays={made.lays} flat={flat} title={title} keep={keep} inCm={inCm} from={open.from} onClose={() => setOpen(undefined)} />
        </Suspense>
      )}
    </>
  );
}
