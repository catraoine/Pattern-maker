import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Piece } from '../engine/piece';
import type { Lay } from '../engine/layplan';
import type { SewStep } from '../engine/instructions';
import { stepPicture } from '../engine/stepPictures';
import { SewPicture } from './SewPicture';
import { readAt, readTicks, saveAt, saveDone, saveTicks } from './sewPlace';
import { isNote, stepLines } from '../engine/stepLines';
import { framesFor } from '../engine/stepFrames';
import { StepDiagram } from './StepDiagram';

// Sewing mode (Cat's C, Nov 21): the steps one at a time, each with a drawing of the garment's own pieces where the
// edges being sewn draw themselves in, so it reads at arm's length beside the machine. The words are the steps' own.

interface Props {
  steps: SewStep[];
  pieces: Piece[];
  lays: Lay[];
  /** The finished garment, front and back, for the steps that finish it. */
  flat: ReactNode;
  title: string;
  /** Where this pattern's place is kept, so coming back opens on the step you were on. */
  keep: string;
  inCm: (s: string) => string;
  /** Open on this step instead of the one you were on (a step picked from the Sew tab's list). */
  from?: number;
  /** For a fit tester, what changes in muslin, shown on the first step: its words are written for the look's own cloth
   *  ("Do not wash it" for wool) while testers sew a toile (EA pretend-tester walk, Nov 21). */
  muslin?: string;
  onClose: () => void;
}

export function SewingMode({ steps, pieces, lays, flat, title, keep, inCm, from, muslin, onClose }: Props) {
  const [at, setAt] = useState(() => {
    if (from === undefined) return readAt(keep, steps.length);
    saveAt(keep, from);
    return from;
  });
  // The lines ticked off so far, by step (Cat's A Tick list, Nov 21): each one fades back once done, so after looking
  // down at the machine your eye lands on the next.
  const [ticks, setTicks] = useState(() => readTicks(keep));
  const tick = (line: number) => {
    const these = ticks[at] ?? [];
    const next = { ...ticks, [at]: these.includes(line) ? these.filter((l) => l !== line) : [...these, line] };
    setTicks(next);
    saveTicks(keep, next);
  };
  const finish = () => {
    saveDone(keep);
    onClose();
  };
  const go = (n: number) => {
    const to = Math.max(0, Math.min(steps.length - 1, n));
    setAt(to);
    saveAt(keep, to);
    // Each step opens at its picture, not part way down the last one's words.
    box.current?.scrollTo(0, 0);
  };
  const box = useRef<HTMLDivElement>(null);
  // Focus starts inside once, on opening, for keyboards and screen readers (not on every step, which would pull it off
  // the Next button just pressed).
  useEffect(() => {
    box.current?.focus();
  }, []);
  // The keys a computer has: arrows step, Escape closes.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(at + 1);
      if (e.key === 'ArrowLeft') go(at - 1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  // The screen stays on while you sew, where the browser allows it.
  // The phone lets go of it whenever the page is hidden, so it is asked for again on coming back; one granted after
  // closing is let go at once.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    let open = true;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const ask = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock?.request('screen').then(
        (l) => (open ? (lock = l) : void l.release().catch(() => undefined)),
        () => undefined,
      );
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      open = false;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  // The page underneath doesn't scroll while this is open.
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = was;
    };
  }, []);
  const pictures = useMemo(() => steps.map((st) => stepPicture(st, pieces)), [steps, pieces]);
  const step = steps[at];
  const last = at === steps.length - 1;
  const lines = stepLines(inCm(step.text));
  // A trickier step has a close-up for each of its sentences: the picture shows the one for the first line not yet
  // ticked, so it moves on as you tick, and the last once all are done.
  const frames = framesFor(step.title, lines);
  const todo = lines.findIndex((ln, i) => !isNote(ln) && !(ticks[at] ?? []).includes(i));
  const now = todo >= 0 ? todo : lines.length - 1;
  const variant = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('frames') ?? 'a' : 'a';
  const firstOf = (i: number) => !!frames && (i === 0 || frames[i] !== frames[i - 1]);
  const distinct = frames ? [...new Set(frames)] : [];
  return createPortal(
    <div className="sewmode" role="dialog" aria-modal="true" aria-label={`Sewing your ${title}`} ref={box} tabIndex={-1}>
      <div className="sewmode-top">
        {/* The number sits with the title now (Cat's A, Nov 21); the count stays for screen readers, and the bar shows it. */}
        <span className="eyebrow visually-hidden">
          Step {at + 1} of {steps.length}
        </span>
        <button type="button" className="later sewmode-close" onClick={onClose}>
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="sewmode-bar" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s.title + i} className={i < at ? 'done' : i === at ? 'on' : undefined} />
        ))}
      </div>
      <div className="sewmode-body">
        {/* Keyed by step, so each picture starts its drawing afresh. */}
        {frames && variant === 'b' ? (
          <div className="sewmode-pic sewframes-strip" key={at}>
            {distinct.map((d, k) => (
              <figure key={k} className={d === frames[now] ? 'on' : undefined}>
                <span className="sew-num">{k + 1}</span>
                <StepDiagram dg={d} />
              </figure>
            ))}
          </div>
        ) : frames && variant === 'c' ? null : (
          <div className="sewmode-pic" key={frames ? `${at}-${now}` : at}>
            {frames ? (
              <div className="sewpic sewpic-diagram sewframe">
                <StepDiagram dg={frames[now]} />
              </div>
            ) : (
              <SewPicture picture={pictures[at]} pieces={pieces} lays={lays} flat={flat} label={step.title} />
            )}
          </div>
        )}
        <div className="sewmode-words">
          {/* Step and title on one line in the heading capitals, the number in champagne (Cat's A, Nov 21). */}
          <h2 className="sewmode-title" aria-live="polite">
            <span className="sew-num">{at + 1}</span>
            <span className="sew-title-words">{step.title}</span>
          </h2>
          {/* One action per line, split at each full stop: the step's own words, nothing reworded (Cat's A, Nov 21). */}
          <ul className="sew-lines" aria-label="Tick each one as you do it">
            {lines.map((line, i) => {
              const on = (ticks[at] ?? []).includes(i);
              const tag = frames && variant === 'b' && firstOf(i) ? <span className="sewframe-tag">{distinct.indexOf(frames[i]) + 1}</span> : null;
              const pic = frames && variant === 'c' && firstOf(i) ? <div className="sewframe-beside"><StepDiagram dg={frames[i]} /></div> : null;
              if (isNote(line)) return <li key={`${at}-${i}`} className="note">{line}</li>;
              return (
                <li key={`${at}-${i}`} className={on ? 'done' : undefined}>
                  {pic}
                  <label>
                    <input type="checkbox" checked={on} onChange={() => tick(i)} />
                    <span>{tag}{line}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {at === 0 && muslin && <p className="sew-muslin">{inCm(muslin)}</p>}
          <div className="sewmode-go">
            <button type="button" className="ghost" disabled={at === 0} onClick={() => go(at - 1)}>
              <span aria-hidden="true">‹</span> Back
            </button>
            {last ? (
              <button type="button" className="primary" onClick={finish}>
                Done
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => go(at + 1)}>
                Next step <span aria-hidden="true">›</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Every step as a small picture along the foot on a computer: tap one to go straight there. */}
      <ol className="sewmode-strip">
        {steps.map((s, i) => (
          <li key={s.title + i}>
            <button type="button" className={i === at ? 'on' : i < at ? 'done' : undefined} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === at ? 'step' : undefined} onClick={() => go(i)}>
              <SewPicture picture={pictures[i]} pieces={pieces} lays={lays} flat={flat} still />
            </button>
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  );
}
