import { useLayoutEffect, useRef, useState } from 'react';
import { ContourForm, type FormStart } from '../ui/ContourForm';
import type { FormKind } from '../measurements';
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

// The welcome has one button (Cat, 2026-10-17): Begin. The tour plays from the dress form, a close crop of the
// form with no head (Cat went back to this from C1 Light Pass, 2026-10-20). Trying an example is the quiet Skip
// link on the measuring pages.
// The name is asked only when measuring someone else, on the first measuring page.
// Coming back with measurements already taken, the button carries on with the garment you were on, straight
// to its style screen, with a quiet way to your saved patterns or something new under it.
export function WelcomeScreen({ onFinish, formStart, form, onLegal, resume }: Props) {
  const [touring, setTouring] = useState(false);
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

  return (
    <div className={['welcome', formStart !== 'wait' && 'go'].filter(Boolean).join(' ')}>
      <section className="card welcome-card" aria-labelledby="wtitle">
        <div className="welcome-hero" ref={hero}>
          <ContourForm start={formStart} kind={form} />
          <button type="button" className="tour-play" onClick={() => setTouring(true)} aria-label={`Watch how it works, ${TOUR_LABEL}`}>
            <span className="tour-play-ring" aria-hidden="true" />
            <span className="tour-play-label">How it works · {TOUR_LABEL}</span>
          </button>
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
            <button type="button" className="primary" onClick={onFinish}>
              Begin
            </button>
          </div>
        )}
        {/* The agreement shows once, hushed, on a first visit; coming back you've already agreed, and the links
            stay in Your account (Cat's L5 First Visit Only, 2026-10-20). */}
        {!resume && (
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
        )}
      </section>
      {touring && <TourPlayer onClose={() => setTouring(false)} />}
    </div>
  );
}
