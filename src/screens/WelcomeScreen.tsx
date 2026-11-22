import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ShareLink } from '../ui/ShareLink';
import { OWNER } from '../legal';
import { ContourForm, type FormStart } from '../ui/ContourForm';
import type { FormKind } from '../measurements';
import { TOUR_LABEL, TourPlayer } from '../ui/TourPlayer';
import { Title } from '../ui/Title';
import { filmTape } from '../ui/filmTape';
import { WaitlistForm, type FoundingSignIn } from '../ui/Waitlist';
import { FOUNDING_LINE } from '../founding';
import { myRef } from '../report/report';
import { signinSent } from '../cloud/sent';
import { onPhone } from '../ui/device';

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
  waitlist?: { onCode: (code: string) => void; /** From Feb 9, a way in for founding members (src/founding.ts). */ founding?: FoundingSignIn; checking?: boolean; linkMessage?: string; onRetry?: () => void };
  /** In the home-screen app with nothing here yet: bring work across from Safari with a pasted "Send to another
   *  device" link, since the home-screen app keeps its own storage (journey review, Nov 10). False when the link
   *  isn't one. */
  onBringLink?: (link: string) => Promise<boolean>;
  /** A fit tester with nothing here yet: on a computer they are pointed to the work on their phone rather than starting
   *  again (testers, Nov 18: the emails say print from a computer, and the tester link opened an empty app there). */
  tester?: boolean;
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
const MARKS = Array.from({ length: 30 }, (_, i) => i + 1);
/** As many as the first measuring page's tape, which takes over from it where it stops. */
const WIDE_MARKS = Array.from({ length: 100 }, (_, i) => i + 1);
/** On a phone the waitlist opens on the form at Begin's full size, then, once its lines are drawn, the waitlist slides
 *  up over its lower half, the way the measuring pages crop it (Cat's O2 Curtain Up, 2026-10-25). When it starts after
 *  the form begins (the form's own drawing takes 1.6s handed over drawn, 2.6s from fresh), and how long it takes. */
const CURTAIN_AT = { drawn: 1900, fresh: 2900 };
const CURTAIN_MS = 1100;
/** When the welcome puts the form beside the words, as in styles/13-wide-and-tape.css: a wide window, not an upright
 *  iPad Pro, which gets the phone's picture with the words under it (the iPad check, 2026-10-30). */
const SIDE_BY_SIDE = '(min-width: 960px) and (min-aspect-ratio: 1/1)';

const standalone = typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;

/** The steps to move work across, by where it is: in the browser on the same phone, or on the tester's phone. */
const BRING = {
  browser: {
    ask: 'Started in your browser? Bring your work here',
    lead: 'The app on your home screen keeps its own copy of your work. To move what you started in your browser:',
    steps: ['Open Maison Tracé in your browser.', 'Tap the person icon at the top, then Your data.', 'Tap Send to another device, then Copy.', 'Come back here and paste the link below.'],
    wrong: "That isn't a Send to another device link. Copy it again in your browser.",
    field: 'Link you copied',
  },
  phone: {
    ask: 'Measured on your phone? Bring your work here',
    lead: 'Your measurements stay on the phone you took them on. To print from this computer:',
    steps: [
      'On your phone, open your tester link and tap Print.',
      'Under Other ways, tap Send to my computer. (Not there? Tap the person icon, then Your data, then Send to another device.)',
      'Send the link to yourself, by email or message.',
      'Open it on this computer, or paste it below.',
    ],
    wrong: "That isn't a Send to my computer link. Send it again from your phone.",
    field: 'Link you sent yourself',
  },
};

/** Bringing work kept on another copy of the app, in a sheet over the page: opened in place, it squashed the form to half
 *  its size and named only Safari in one long sentence (Cat, Nov 15).
 *  `browser`: "Started in your browser?", on the app added to the home screen only, which keeps its own copy of
 *  everything, apart from the browser's (an iPhone does this whatever the browser).
 *  `phone`: "Measured on your phone?", for a tester on a computer with nothing here yet. */
function BringWork({ onBring, from = 'browser' }: { onBring: (link: string) => Promise<boolean>; from?: keyof typeof BRING }) {
  const say = BRING[from];
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [wrong, setWrong] = useState(false);
  return (
    <>
      <p className="resume-more">
        <button type="button" className="link quiet" onClick={() => setOpen(true)}>
          {say.ask}
        </button>
      </p>
      {open && (
        <div className="form-leave bring-sheet" role="dialog" aria-modal="true" aria-labelledby="bring-title">
          <form
            className="form-leave-box"
            onSubmit={async (e) => {
              e.preventDefault();
              setWrong(!(await onBring(link)));
            }}
          >
            <h2 id="bring-title">Bring your work here</h2>
            <p>{say.lead}</p>
            <ol className="bring-steps">
              {say.steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
            <label className="field">
              <span>{say.field}</span>
              <input type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} autoComplete="off" />
            </label>
            {wrong && (
              <p className="msg small" role="status">
                {say.wrong}
              </p>
            )}
            <button type="submit" className="primary done" disabled={!link.trim()}>
              Bring it here
            </button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Not now
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export function WelcomeScreen({ onFinish, formStart, form, onLegal, resume, waitlist, onBringLink, tester }: Props) {
  const [touring, setTouring] = useState(false);
  // Back from the newsletter's confirm email (Kit sends people to /?joined): straight to "You're on the list".
  const [joinedNow, setJoined] = useState(() => new URLSearchParams(window.location.search).has('joined'));
  // And back on a device that joined before (Dec 7 dress rehearsal, Nov 22): a reload used to show the empty form
  // again, as if they had never joined, and their link to bring friends was gone for good. One line under it leads
  // to the join page, for a tester code, another email, or (from Feb 9) the founding sign-in.
  const [returning, setReturning] = useState(() => !!myRef());
  // Not while a tester link is being checked or has just failed, and not part way through the founding sign-in:
  // those are said and finished on the join page.
  const [signingIn] = useState(() => !!signinSent());
  const busy = !!waitlist && (!!waitlist.checking || !!waitlist.linkMessage || (!!waitlist.founding && (signingIn || !!waitlist.founding.cloud.user)));
  const back = returning && !joinedNow && !busy;
  const joined = joinedNow || back;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('joined')) return;
    url.searchParams.delete('joined');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  // Begin's tape comes in from off the top right and pulls across the top of the window to where the first page's tape
  // sits (Cat, 2026-10-26 on a computer; 2026-10-27 on a phone too, with the tip at the form's corner gone).
  const [leaving, setLeaving] = useState<false | 'phone' | 'computer'>(false);
  // A computer already opens the waitlist on the full-size form, beside the words, so the curtain is for phones.
  const [curtain, setCurtain] = useState<'down' | 'up' | 'off'>(() =>
    waitlist && !matchMedia(SIDE_BY_SIDE).matches && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'down' : 'off',
  );
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
    if (formStart !== 'drawn' || !el || !matchMedia(SIDE_BY_SIDE).matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    const play = el.querySelector('.tour-play');
    const last = play?.animate([{ opacity: 0 }, { opacity: 0, offset: PLAY_AT / (PLAY_AT + 500) }, { opacity: 1 }], { duration: PLAY_AT + 500, fill: 'backwards' });
    return () => [slide, ...fades, last].forEach((a) => a?.cancel());
  }, [formStart]);

  // Down, the waitlist is out of the way and the form takes Begin's room. Up, the form's canvas keeps that full height
  // and the hero shrinks over it, cropping the form from the bottom while the waitlist rises into the room.
  const curtainFrom = useRef(0);
  // With no loading screen (strangers on the waitlist), the curtain is already up when the page first shows: the form
  // keeps Begin's full height, cropped from the bottom, and the Join box sits under the words at once (Cat's A,
  // 2026-11-10). Measured here, before the first paint, so the page never shows the curtain down.
  const [atOnce, setAtOnce] = useState(false);
  // No loading screen on the waitlist: the words are there from the start too, so nothing may move once shown.
  const waitlistNow = useRef(!!waitlist && formStart !== 'wait').current;
  useLayoutEffect(() => {
    if (curtain !== 'down' || formStart === 'wait') return;
    const el = hero.current;
    if (!el) return setCurtain('off');
    el.style.setProperty('--curtain-h', `${el.clientHeight}px`);
    setAtOnce(true);
    setCurtain('up');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first paint
  }, []);
  useEffect(() => {
    if (curtain !== 'down' || formStart === 'wait') return;
    const t = window.setTimeout(() => {
      const el = hero.current;
      if (!el) return setCurtain('off');
      curtainFrom.current = el.clientHeight;
      el.style.setProperty('--curtain-h', `${el.clientHeight}px`);
      setCurtain('up');
    }, CURTAIN_AT[formStart === 'drawn' ? 'drawn' : 'fresh']);
    return () => window.clearTimeout(t);
  }, [curtain, formStart]);
  useLayoutEffect(() => {
    const el = hero.current;
    if (curtain !== 'up' || !el || !curtainFrom.current) return;
    const from = `${curtainFrom.current}px`;
    const to = `${el.clientHeight}px`;
    curtainFrom.current = 0;
    el.animate([{ flexGrow: 0, flexBasis: from }, { flexGrow: 0, flexBasis: to }], { duration: CURTAIN_MS, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' });
  }, [curtain]);

  const tape = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      done.current();
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const begin = () => {
    if (leaving) return;
    // The tape Begin pulls across is the How it works film's only (Cat, Nov 14): in the app Begin goes straight on.
    if (!filmTape() || matchMedia('(prefers-reduced-motion: reduce)').matches) onFinish();
    else setLeaving(matchMedia('(min-width: 960px)').matches ? 'computer' : 'phone');
  };

  const pulled = (
    <div ref={tape} className={`tape-band unrolling ${leaving}`} aria-hidden="true">
      <div className="tape-marks">
        {(leaving === 'computer' ? WIDE_MARKS : MARKS).map((n) => (
          <span key={n} />
        ))}
      </div>
    </div>
  );

  return (
    <div className={['welcome', formStart !== 'wait' && 'go', leaving && 'leaving', touring && 'pulling', waitlist && 'waitlist-page', waitlist && curtain !== 'off' && `curtain-${curtain}`, atOnce && 'curtain-now', waitlistNow && 'waitlist-now'].filter(Boolean).join(' ')}>
      <section className={waitlist && joined ? 'card welcome-card joined' : 'card welcome-card'} aria-labelledby="wtitle">
        {leaving && pulled}
        <div className="welcome-hero" ref={hero}>
          <ContourForm start={formStart} kind={form} />
          <button type="button" className="tour-play" onClick={() => setTouring(true)} aria-label={`Watch how it works, ${TOUR_LABEL}`}>
            {/* The label above the ring, off the waist lines and without the running time (Cat, 2026-10-25) */}
            <span className="tour-play-label">How it works</span>
            <span className="tour-play-ring" aria-hidden="true" />
          </button>
        </div>
        {waitlist && joined ? (
          <Title id="wtitle" big="You're on the list" label="We'll write when it opens" />
        ) : (
          <Title
            id="wtitle"
            big="Drafted to you"
            label={resume ? 'Welcome back' : 'Sewing patterns for the piece you have in mind'}
          />
        )}
        {waitlist ? (
          joined ? (
            <div className="stack waitlist">
              {/* The "one email when your invitation is ready" line came out (Cat, Nov 11 2026): just the share link. */}
              {/* What joining gets them, said once more now they are on the list (Cat, Nov 16 2026). */}
              <p className="waitlist-line">{FOUNDING_LINE}</p>
              <ShareLink />
              {/* Nothing else is open to someone on the waitlist yet, so one way to ask (Cat's A, Nov 17 2026). */}
              <p className="waitlist-tester">
                Questions? <a href={`mailto:${OWNER.email}`}>{OWNER.email}</a>
              </p>
              {back && (
                <p className="waitlist-tester">
                  Testing for us, or joining with another email?{' '}
                  <button type="button" className="inline-link" onClick={() => setReturning(false)}>
                    Open the join page
                  </button>
                </p>
              )}
            </div>
          ) : waitlist.checking ? (
            <div className="stack waitlist">
              <p className="waitlist-line" role="status">
                Checking your tester link…
              </p>
            </div>
          ) : (
            <WaitlistForm onJoined={() => setJoined(true)} onCode={waitlist.onCode} linkMessage={waitlist.linkMessage} onRetry={waitlist.onRetry} founding={waitlist.founding} />
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
            {onBringLink && standalone && <BringWork onBring={onBringLink} />}
            {onBringLink && !standalone && tester && !onPhone() && <BringWork onBring={onBringLink} from="phone" />}
          </div>
        )}
        {/* The agreement shows once, hushed, on a first visit; coming back you've already agreed, and the links
            stay in Your account (Cat's L5 First Visit Only, 2026-10-20). */}
        {waitlist ? (
          <p className="fineprint">
            {/* One word, where emails are collected, so people can see how theirs is used (Cat's A, Nov 6: "How it's
                made" left the waitlist; it stays in the app, from the photo screen and Your account) */}
            <button type="button" className="inline-link" onClick={() => onLegal('privacy')}>
              Privacy
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
      {/* The page's own form pulls in to the film's first frames as it starts (TourPlayer), its words fading. */}
      {touring && <TourPlayer onClose={() => setTouring(false)} from={hero.current?.querySelector<HTMLCanvasElement>('canvas.contour')} />}
    </div>
  );
}
