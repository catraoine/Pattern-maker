import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ContourForm, type FormStart } from '../ui/ContourForm';
import type { FormKind } from '../measurements';
import { TapeBand } from '../ui/TapeBand';
import { TOUR_LABEL, TourPlayer } from '../ui/TourPlayer';
import { Title } from '../ui/Title';

interface Props {
  onFinish: () => void;
  /** How the dress form starts: it waits for the loading screen, which may hand it over already outlined. */
  formStart?: FormStart;
  /** The form the person's patterns are drafted on, so the welcome shows the same body as measuring. */
  form?: FormKind;
  /** Opens the Terms of Use or the Privacy Policy. */
  onLegal: (page: 'terms' | 'privacy') => void;
  /** Someone coming back with their measurements taken: the garment they were on, and the ways back in. */
  resume?: { garment: string; onResume: () => void; onSaved: () => void; onNew: () => void };
}

/** How long Begin's tape takes to unroll, clear the form and rise to the top of the measuring page. */
const LEAVE_MS = 1700;

// The welcome has one button (Cat, 2026-10-17): Begin. The tour plays from the dress form; trying an example
// is the Skip on the measuring pages' tape. The end of a tape measure peeks in at the form's bottom corner
// (Cat's U2 Tape Tip, 2026-10-18); Begin pulls the tape out of that corner across the form (E5 Out of the
// Corner), the form fades, and the tape rises to where the measuring page's tape sits, so the next page
// carries straight on from it.
// The name is asked only when measuring someone else, on the first measuring page.
// Coming back with measurements already taken, the button carries on with the garment you were on, straight
// to its style screen, with a quiet way to your saved patterns or something new under it.
export function WelcomeScreen({ onFinish, formStart, form, onLegal, resume }: Props) {
  const [touring, setTouring] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onFinish);
  done.current = onFinish;
  // The form grows into the room Begin leaves; the measuring pages draw it at this same height, so it stays put.
  const hero = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = hero.current;
    if (!el) return;
    const keep = () => el.clientHeight && document.documentElement.style.setProperty('--welcome-hero-h', `${el.clientHeight}px`);
    keep();
    const ro = new ResizeObserver(keep);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => done.current(), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const begin = () => {
    if (leaving) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) onFinish();
    else setLeaving(true);
  };

  return (
    <div className={['welcome', formStart !== 'wait' && 'go', leaving && 'leaving'].filter(Boolean).join(' ')}>
      <section className="card welcome-card" aria-labelledby="wtitle">
        <div className="welcome-hero" ref={hero}>
          <ContourForm start={formStart} kind={form} />
          <button type="button" className="tour-play" onClick={() => setTouring(true)} aria-label={`Watch how it works, ${TOUR_LABEL}`}>
            <span className="tour-play-ring" aria-hidden="true" />
            <span className="tour-play-label">How it works · {TOUR_LABEL}</span>
          </button>
          <span className="tape-tip" aria-hidden="true" />
          {leaving && <TapeBand className="unrolling" />}
        </div>
        <Title id="wtitle" big="Sewing patterns" label={resume ? 'Welcome back' : 'drafted to your body'} />
        {resume ? (
          <div className="stack">
            <button type="button" className="primary" onClick={resume.onResume}>
              Carry on with your {resume.garment}
            </button>
            <p className="resume-more">
              <button type="button" className="link quiet" onClick={resume.onSaved}>
                Saved patterns
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="link quiet" onClick={resume.onNew}>
                Start something new
              </button>
            </p>
          </div>
        ) : (
          <div className="stack">
            <button type="button" className="primary" onClick={begin}>
              Begin
            </button>
          </div>
        )}
        <p className="fineprint">
          By continuing you agree to our{' '}
          <button type="button" className="inline-link" onClick={() => onLegal('terms')}>
            Terms
          </button>{' '}
          and{' '}
          <button type="button" className="inline-link" onClick={() => onLegal('privacy')}>
            Privacy Policy
          </button>
          .
        </p>
      </section>
      {touring && <TourPlayer onClose={() => setTouring(false)} />}
    </div>
  );
}
