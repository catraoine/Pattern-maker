import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { Printable } from './ExportScreen';
import { stepPicture } from '../engine/stepPictures';
import { SewPicture } from '../ui/SewPicture';
import { TechFlatView } from '../ui/TechFlatView';
import { readAt, readDone } from '../ui/sewPlace';
import { TesterReport } from '../ui/TesterReport';
import { inCm } from '../units';
import { WrittenSteps } from '../ui/WrittenSteps';
import { CutPart, type CutProps } from './CutPart';
import { cutReturning, dropCutReturn, dropFabricReturn, fabricReturning } from '../ui/printReturn';
import { usePageHistory } from '../nav';

// Sew, the fourth step after Print (Cat, Nov 21), in two pages since Nov 28: Cut it first (the fabric, the cutting
// layout, what you'll need and the toile), then Sew it, with Sewing mode's start, where you left off, and every step as a
// picture to jump straight to, then the written list.

/** A short mark of the step titles, so a changed list of steps keeps its own place. */
const stepsMark = (steps: { title: string }[]) => {
  let h = 0;
  for (const ch of steps.map((st) => st.title).join('|')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `${steps.length}.${(h >>> 0).toString(36)}`;
};

const SewingMode = lazy(() => import('../ui/SewingMode').then((m) => ({ default: m.SewingMode })));

interface Props {
  made?: Printable;
  title: string;
  /** What to call it in the line under the heading: the look's name, or the garment's. */
  name?: string;
  /** Where this pattern's place is kept between visits. */
  keep: string;
  /** Cut it, the chapter's first page: the fabric, its layout, what you'll need and a toile. */
  cut?: Omit<CutProps, 'made' | 'title' | 'onNext' | 'head'>;
  /** To Style, when the pattern can't be drafted. */
  onStyle: () => void;
  /** Back to Print, the chapter before Cut it. */
  onPrint?: () => void;
  /** A fit tester: sewn to the end, the finished state points to the tester form. */
  tester?: boolean;
}

export function SewScreen({ made, title, name = title, keep: owner, cut, onStyle, onPrint, tester }: Props) {
  // Sewing mode, open on the kept step (undefined) or on one picked from the list.
  const [open, setOpen] = useState<{ from?: number }>();
  const steps = useMemo(() => made?.guide.steps ?? [], [made]);
  // The place is kept for these very steps: a style change that adds or drops a step starts afresh, so ticks never
  // land on the wrong step and a garment with new steps isn't called finished.
  const keep = useMemo(() => `${owner}#${stepsMark(steps)}`, [owner, steps]);
  // Cut it first, then Sew it (Cat, Nov 28: "Doesn't the cut step make more sense for the sew chapter?"). Opened from
  // Print's Next, or back from choosing the fabric, it's Cut it; opened from the tab once sewing has begun, Sew it.
  const [fabricBack] = useState(fabricReturning);
  const [cutNext] = useState(cutReturning);
  useEffect(() => {
    dropFabricReturn();
    dropCutReturn();
  }, []);
  // Each page is its own entry, so the phone's Back from Sew it returns to Cut it (code review, Nov 28).
  const [part, goPart] = usePageHistory<'cut' | 'sew'>(
    () => (!cut ? 'sew' : fabricBack || cutNext ? 'cut' : readAt(keep, steps.length) > 0 || readDone(keep) ? 'sew' : 'cut'),
    (sub) => sub === 'cut' || sub === 'sew',
    fabricBack || cutNext,
  );
  // ‹ Cut it steps back to the Cut it already behind Sew it, rather than stacking a new one on top.
  const wentOn = useRef(false);
  const toSew = () => {
    wentOn.current = true;
    goPart('sew');
  };
  const toCut = () => {
    if (wentOn.current && window.history.state?.sub === 'sew') window.history.back();
    else goPart('cut');
  };
  useEffect(() => {
    // Back from choosing the fabric: open on the fabric, where they left (Cat, Nov 21), clear of the top bar.
    if (!fabricBack) {
      window.scrollTo(0, 0);
      return;
    }
    requestAnimationFrame(() => {
      const fabric = document.querySelector('.yourfabric');
      if (!fabric) return;
      const bar = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
      window.scrollTo(0, fabric.getBoundingClientRect().top + window.scrollY - bar - 16);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as Sew opens
  }, []);
  // Between Cut it and Sew it, each opens at its top: the browser's Back put "‹ Cut it" at the foot of Cut it, mid-way
  // through a paragraph with no heading in view (EM walk, Nov 28).
  const shownPart = useRef(part);
  useEffect(() => {
    if (shownPart.current === part) return;
    shownPart.current = part;
    window.scrollTo(0, 0);
  }, [part]);
  const pictures = useMemo(() => (made ? steps.map((st) => stepPicture(st, made.pieces)) : []), [made, steps]);
  // Read again each time Sewing mode closes, so "Carry on" names the step you stopped at.
  const at = useMemo(() => (open ? 0 : readAt(keep, steps.length)), [open, keep, steps.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- read again each time Sewing mode closes, like `at`
  const done = useMemo(() => readDone(keep), [open, keep]);
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
  // Cut it goes back to Print as Sew it goes back to Cut it, by name, so neither needs the tabs (EM walk, Nov 28).
  const toPrint = onPrint && (
    <button type="button" className="step-back-arrow named sew-back" aria-label="Back to Print" onClick={onPrint}>
      <span aria-hidden="true">‹</span> Print
    </button>
  );
  if (part === 'cut' && cut) return <CutPart {...cut} made={made} title={title} onNext={toSew} head={toPrint} />;
  const flat = made.flat ? <TechFlatView flat={made.flat} title={title} /> : null;
  // Printing and cutting are done on Cut it, the page before, so Sew it starts at the first sewing step, with that step's
  // picture, not the cutting layout again (EM walk, Nov 28). The list below still has every step.
  const sewFrom = cut ? Math.max(0, pictures.findIndex((pic) => pic.kind !== 'prep' && pic.kind !== 'print' && pic.kind !== 'cut')) : 0;
  return (
    <>
      {/* Back to Cut it, the page before, as Style's steps go back (Cat, Nov 28). */}
      {cut && (
        <button type="button" className="step-back-arrow named sew-back" aria-label="Back to Cut it" onClick={toCut}>
          <span aria-hidden="true">‹</span> Cut it
        </button>
      )}
      <section className="card sew-card sewscreen" aria-labelledby="sewhead">
        {/* A modest heading and one guiding line, like Print's (Cat, Nov 3: big capitals for a whole choice jar). */}
        <h1 id="sewhead">Sew it</h1>
        {/* By name: the whole description read "Your Low-rise barrel-leg trousers with ..., one step at a time" (cold
            read EJ, Nov 27). */}
        <p className="sew-guide">Your {name}, one step at a time.</p>
        {done ? (
          // Sewn to the end (DZ pretend-tester walk, Nov 21: it said "You stopped at step 17 of 17").
          <div className="sew-start sew-finished">
            <div className="sewmode-pic">
              <SewPicture picture={{ kind: 'flat' }} pieces={made.pieces} lays={made.lays} flat={flat} />
            </div>
            {/* Just the fact: the last step already says to try it on (Cat, Nov 21: "over explaining"). Any step's
                picture below opens it again. */}
            <p className="small">All {steps.length} steps sewn.</p>
            {tester && <TesterReport lead="Tried it on?" />}
          </div>
        ) : (
        <div className="sew-start">
          <div className="sewmode-pic">
            <SewPicture picture={pictures[at || sewFrom]} pieces={made.pieces} lays={made.lays} flat={flat} />
          </div>
          <p className="small">
            {at
              ? `You stopped at step ${at + 1} of ${steps.length}: ${steps[at].title}.`
              : sewFrom
                ? `Starts at step ${sewFrom + 1}, ${steps[sewFrom].title}, once it's cut. Each step is drawn from your own pieces. Keep it open by your machine.`
                : `${steps.length} steps, one at a time, each drawn from your own pieces. Keep it open by your machine.`}
          </p>
          <div className="sew-start-go">
            <button type="button" className="primary" onClick={() => setOpen(at ? {} : { from: sewFrom })}>
              {at ? 'Carry on sewing' : 'Start sewing'} <span aria-hidden="true">›</span>
            </button>
            {at > 0 && (
              <button type="button" className="ghost" onClick={() => setOpen({ from: 0 })}>
                From the start
              </button>
            )}
          </div>
        </div>
        )}
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
                <span className="sew-index-title">
                  <span className="sew-num">{i + 1}</span>
                  <span className="sew-title-words">{st.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <WrittenSteps guide={made.guide} />
      {open && (
        <Suspense fallback={null}>
          <SewingMode steps={steps} pieces={made.pieces} lays={made.lays} flat={flat} title={title} keep={keep} inCm={inCm} from={open.from} muslin={tester ? made.guide.fabric?.find((l) => l.startsWith('Sewing in muslin')) : undefined} onClose={() => setOpen(undefined)} />
        </Suspense>
      )}
    </>
  );
}
