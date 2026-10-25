import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ContourForm, type FormStart } from '../ui/ContourForm';
import type { FormKind } from '../measurements';
import { TOUR_LABEL, TourPlayer } from '../ui/TourPlayer';
import { Title } from '../ui/Title';
import { tapeRested } from '../ui/tapeHandoff';
import { WaitlistForm } from '../ui/Waitlist';

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
  /** Until launch, someone without a tester link gets the waitlist where Begin was (Cat's W1, 2026-10-21). */
  waitlist?: { onCode: (code: string) => void; checking?: boolean; linkMessage?: string };
}

// The welcome has one button (Cat, 2026-10-17): Begin. The tour plays from the dress form, a close crop of the
// form with no head (Cat went back to this from C1 Light Pass, 2026-10-20). Trying an example is the quiet Skip
// link on the measuring pages.
// The name is asked only when measuring someone else, on the first measuring page.
// Coming back with measurements already taken, the button carries on with the garment you were on, straight
// to its style screen, with a quiet way to your saved patterns or something new under it.
/** How long Begin's tape takes to unroll across the form while the welcome fades. The first measuring page then fades
 *  up under it as it rises to its place, so there's no moment of the tape alone on black (Cat, 2026-10-22). */
const LEAVE_MS = 1750;
/** On a computer, when the form starts sliding from the middle of the window to its place (as the loading screen
 *  fades, so its lines drop as it goes), how long the slide takes, and when the play button comes in, last of all
 *  (Cat, 2026-10-21). */
const SLIDE_AT = 300;
const SLIDE_MS = 1400;
const PLAY_AT = SLIDE_AT + SLIDE_MS + 500;
const MARKS = Array.from({ length: 30 }, (_, i) => i + 41);

export function WelcomeScreen({ onFinish, formStart, form, onLegal, resume, waitlist }: Props) {
  const [touring, setTouring] = useState(false);
  // Back from the newsletter's confirm email (Kit sends people to /?joined): straight to "You're on the list".
  const [joined, setJoined] = useState(() => new URLSearchParams(window.location.search).has('joined'));
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('joined')) return;
    url.searchParams.delete('joined');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
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

  // On a computer the loading screen's piece becomes the form in the middle of the window, then slides across to its
  // place beside the title while its lines drop; the words come in as it arrives, the play button last (Cat, 2026-10-21).
  useLayoutEffect(() => {
    const el = hero.current;
    if (formStart !== 'drawn' || !el || !matchMedia('(min-width: 960px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const dx = window.innerWidth / 2 - (r.left + r.width / 2);
    if (Math.abs(dx) < 8) return;
    const timing = { duration: SLIDE_AT + SLIDE_MS, easing: 'linear', fill: 'backwards' as const };
    const at = SLIDE_AT / (SLIDE_AT + SLIDE_MS);
    const slide = el.animate(
      [
        { transform: `translateX(${dx}px)` },
        { transform: `translateX(${dx}px)`, offset: at, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
        { transform: 'none' },
      ],
      timing,
    );
    const words = [...(el.parentElement?.children ?? [])].filter((c) => c !== el) as HTMLElement[];
    const fades = words.map((c) => c.animate([{ opacity: 0 }, { opacity: 0, offset: at + (1 - at) * 0.7 }, { opacity: 1 }], { ...timing, duration: timing.duration + 300 }));
    const plays = [...el.querySelectorAll('.tour-play, .tour-play-label')];
    const last = plays.map((p) => p.animate([{ opacity: 0 }, { opacity: 0, offset: PLAY_AT / (PLAY_AT + 500) }, { opacity: 1 }], { duration: PLAY_AT + 500, fill: 'backwards' }));
    return () => [slide, ...fades, ...last].forEach((a) => a.cancel());
  }, [formStart]);

  const tape = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      if (tape.current) tapeRested(tape.current);
      done.current();
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  // Begin pulls the tape out of the tip at the form's corner (Cat, 2026-10-20: brought back after Release 10).
  const begin = () => {
    if (leaving) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) onFinish();
    else setLeaving(true);
  };

  return (
    <div className={['welcome', formStart !== 'wait' && 'go', leaving && 'leaving', waitlist && 'waitlist-page'].filter(Boolean).join(' ')}>
      <section className="card welcome-card" aria-labelledby="wtitle">
        <div className="welcome-hero" ref={hero}>
          <ContourForm start={formStart} kind={form} />
          <button type="button" className="tour-play" onClick={() => setTouring(true)} aria-label={`Watch how it works, ${TOUR_LABEL}`}>
            <span className="tour-play-ring" aria-hidden="true" />
          </button>
          {/* The label sits under the form, off its waist lines (Cat, 2026-10-25: calmer front page) */}
          <button type="button" className="tour-play-label" tabIndex={-1} aria-hidden="true" onClick={() => setTouring(true)}>
            How it works · {TOUR_LABEL}
          </button>
          {/* The tip is where Begin pulls the tape from, so the waitlist, with no Begin, leaves it out */}
          {!resume && !waitlist && <span className="tape-tip" aria-hidden="true" />}
          {leaving && (
            <div ref={tape} className="tape-band unrolling" aria-hidden="true">
              <div className="tape-marks">
                {MARKS.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {waitlist && joined ? (
          <Title id="wtitle" big="You're on the list" label="We'll write when it opens" />
        ) : (
          <Title id="wtitle" big="Sewing patterns" label={resume ? 'Welcome back' : 'drafted to your body'} />
        )}
        {waitlist ? (
          joined ? (
            <div className="stack waitlist">
              <p className="waitlist-line" role="status">
                One email when your invitation is ready, and the odd note before. Nothing else.
              </p>
            </div>
          ) : waitlist.checking ? (
            <div className="stack waitlist">
              <p className="waitlist-line" role="status">
                Checking your tester link…
              </p>
            </div>
          ) : (
            <WaitlistForm onJoined={() => setJoined(true)} onCode={waitlist.onCode} linkMessage={waitlist.linkMessage} />
          )
        ) : resume ? (
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
        {/* The agreement shows once, hushed, on a first visit; coming back you've already agreed, and the links
            stay in Your account (Cat's L5 First Visit Only, 2026-10-20). */}
        {waitlist ? (
          <p className="fineprint">
            Only Maison Tracé news, deleted if you ask.{' '}
            <button type="button" className="inline-link" onClick={() => onLegal('privacy')}>
              Privacy Policy
            </button>
          </p>
        ) : !resume && (
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
