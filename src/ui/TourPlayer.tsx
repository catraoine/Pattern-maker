import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FilmBar, useFilm } from './FilmControls';
import { OPENING_END, openingAt, paintOpening, paintTitle } from './filmOpening';

// The tour: the walkthrough video, full screen, opened from the play button on the welcome's dress form.
// Skip tour is always showing; the bar along the bottom marks Measure, Choose, Style and Print as the video reaches them.
// Re-record the video (npm run record:tour) whenever the app changes enough that the tour looks out of date.

/** H.264 for Safari and Chrome; WebM for browsers without it. A tall film for phones, and a wide one, recorded in the
 * computer layout, for wide screens (Cat, 2026-10-22); the same moments in the same order. PARTS gives the phone's times (the computer's are within about 2 s); the player
 * only reads their names and words, for the film in words, so one list fits both. */
const SOURCES = {
  tall: [
    { src: '/tour/walkthrough.mp4', type: 'video/mp4; codecs="avc1.640032, mp4a.40.2"' },
    { src: '/tour/walkthrough.webm', type: 'video/webm; codecs="vp9, opus"' },
  ],
  wide: [
    { src: '/tour/walkthrough-wide.mp4', type: 'video/mp4; codecs="avc1.640032, mp4a.40.2"' },
    { src: '/tour/walkthrough-wide.webm', type: 'video/webm; codecs="vp9, opus"' },
  ],
};
const WIDE_SCREEN = '(min-width: 900px) and (min-aspect-ratio: 1/1)';
/** Where each part starts in the video, in seconds, and how long it runs. Update with the video. */
/** says: what the part shows, in words, for anyone who can't see the film (the accessibility review, 2026-10-30). */
const PARTS: FilmPart[] = [
  { name: 'Measure', from: 0, says: 'Enter your measurements just once, taken with a soft tape: every pattern is drafted from your numbers.' },
  { name: 'Choose', from: 15.8, says: 'Then what to make: design your own garment by describing it, choose from a collection, or start with a photo of a piece you love.' },
  { name: 'Style', from: 37.8, says: 'Select your style details: its cut, darts, neckline and your own cloth, step by step on the drawing. Or design straight from your pattern, moving a dart or cutting off a new piece. All round turns the dress, drawing closer, to check the seams meet and the hem sits level before you cut.' },
  { name: 'Print', from: 65.8, says: 'Print your pattern at home on ordinary paper or full size at a copy shop, or project it true size onto your fabric. Then sew it, one step at a time, ticking off each line as you go. Drafted to your body.' },
];
export const TOUR_LABEL = '1:32';

export type FilmPart = { name: string; from: number; says: string };

/** The film in words, for anyone who can't see it: a screen reader is given what each part shows with the film. The
 *  Read it switch that showed them over the film is gone (Cat, 2026-11-06); the words stay, hidden from view. */
export function FilmWords({ id, parts }: { id: string; parts: FilmPart[] }) {
  return (
    <div id={id} className="film-words visually-hidden">
      <ol>
        {parts.map((p) => (
          <li key={p.name}>
            {p.name}: {p.says}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The opening on play. Cat, 2026-11-07: "start from the exact size of the welcome screen and zoom into view
 *  consistently and smooth". Cat, 2026-11-08: it sat still while the film loaded, then jumped forward and turned
 *  ("creepy"); she picked O1 Gentle Glide (filmOpening.ts): the form moves from the tap, the push and the turn as one.
 *  So the player draws the film's opening itself from the tap, on a canvas laid where the film will be, with its form
 *  on the page's own form (the page's words fading), and the film takes over, from the same moment, once it is
 *  playing. Both are laid over the page the same way: the film's frame eases from the page's place back to the full
 *  screen as the push comes in. One image throughout, so nothing waits, jumps, or changes size as one hands over.
 *  FILM_RECT is the page the welcome take was drawn from (record-tour-shots.mjs): its size, and its form canvas, in that
 *  page's pixels. Re-measure if the welcome's layout changes. */
const FILM_RECT = {
  // Drawn as an iPhone's welcome form: the canvas 408 wide and 408 x 481.5 / 366 tall, from 86 down.
  tall: { vw: 432, vh: 768, r: { x: 12, y: 86, w: 408, h: 408 * (481.5 / 366) } },
  wide: { vw: 1440, vh: 810, r: { x: 290.75, y: 98, w: 421.1875, h: 658 } },
};
type Box = { left: number; top: number; width: number; height: number };
/** The film drawn in the box b (object-fit: contain): its scale, from the take's page pixels, and its corner. */
function filmFit(shape: 'tall' | 'wide', b: Box) {
  const f = FILM_RECT[shape];
  const k = Math.min(b.width / f.vw, b.height / f.vh);
  return { k, x: b.left + (b.width - f.vw * k) / 2, y: b.top + (b.height - f.vh * k) / 2 };
}

// How long the last frame holds before the film closes by itself.
const END_HOLD_MS = 1800;

export function TourPlayer({ onClose, from }: { onClose: () => void; from?: HTMLCanvasElement | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const standIn = useRef<HTMLCanvasElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  // Chosen once, as the tour opens, so turning a tablet doesn't restart it.
  const [shape] = useState<'tall' | 'wide'>(() => (matchMedia(WIDE_SCREEN).matches ? 'wide' : 'tall'));
  const film = useFilm(video);
  const ending = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(ending.current), []);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [arriving, setArriving] = useState(() => !!from && !reduced);
  // Read once: the film's frame keeps easing back after the player is in (arriving is false by then).
  const laying = useRef(arriving);
  const handed = useRef(false);
  // The film handed over before it could play (a slow connection): kept out of sight until it plays, so its first
  // frame (the welcome page) never shows, with the controls and the loading ring up meanwhile (the release walk,
  // Nov 18: eight seconds of black with no controls, then what looked like the page again).
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // Shown once it is truly playing (a seek on the black may end without a fresh 'playing').
    const on = () => {
      if (!v.paused && v.readyState >= 3) setWaiting(false);
    };
    const events = ['playing', 'seeked', 'timeupdate'];
    events.forEach((e) => v.addEventListener(e, on));
    return () => events.forEach((e) => v.removeEventListener(e, on));
  }, []);

  // The opening, drawn from the tap on the stand-in canvas, on a clock started by the tap, to its fade to black; the
  // film then comes in over it from that moment. Both are laid over the page: the film's form on the page's form,
  // easing back to the full frame as the push comes in.
  useLayoutEffect(() => {
    const v = video.current;
    const c = standIn.current;
    if (!laying.current || !from || !v || !c) return;
    const t0 = performance.now();
    // The page's own form gives way to the stand-in, which starts exactly on it (on a wide screen the push draws the
    // form away from it, to the middle, so it would show behind).
    const formWas = from.style.visibility;
    from.style.visibility = 'hidden';
    const now = () => (performance.now() - t0) / 1000;
    const page = from.getBoundingClientRect();
    // The page's form: its middle and scale, as ContourForm's welcomeLayout draws it.
    const s0 = Math.min(page.width * 0.82, page.height * 0.46);
    const [px, py] = [page.left + page.width / 2, page.top + page.height / 2];
    // Measured untransformed (the effect can run again, as React's checks do in development).
    v.style.transform = '';
    const box = v.getBoundingClientRect();
    const host = v.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const fit = filmFit(shape, box);
    const f = FILM_RECT[shape];
    // Where the film's form is on screen at its first frame, and how much smaller or larger than the page's.
    const g0 = { x: fit.x + (f.r.x + f.r.w / 2) * fit.k, y: fit.y + (f.r.y + f.r.h / 2) * fit.k, s: Math.min(f.r.w * 0.82, f.r.h * 0.46) * fit.k };
    const k = s0 / g0.s;
    const origin = `${g0.x - box.left}px ${g0.y - box.top}px`;
    const lay = (el: HTMLElement, t: number) => {
      const w = 1 - openingAt(t).p;
      el.style.transform = w > 0 ? `translate(${(px - g0.x) * w}px, ${(py - g0.y) * w}px) scale(${1 + (k - 1) * w})` : '';
      return w > 0;
    };
    v.style.transformOrigin = origin;
    Object.assign(c.style, { left: `${box.left - host.left}px`, top: `${box.top - host.top}px`, width: `${box.width}px`, height: `${box.height}px`, transformOrigin: origin });
    // Drawn at the page's own pixels, not the screen's (Cat, Nov 21: the start was still choppy on her phone). At an
    // iPhone's 3x the phone repainted nine times the pixels every frame and dropped most of them when busy or in Low
    // Power Mode (55 dropped frames in the four seconds at phone speed; 2 at 1x). A soft moving line drawing that
    // fades to black loses almost nothing.
    const dpr = 1;
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const g = c.getContext('2d');
    let raf = 0;
    // The stand-in draws the whole opening on its own clock, real time from the tap, never nudged: the film plays
    // from the tap too (its music with it) but stays out of sight until the opening has faded to black, then comes
    // in on the black, sent to that moment if it has fallen behind or run ahead. Nothing is matched frame to frame,
    // so nothing jumps or speeds up and slows down to catch up (Cat, Nov 18: the start was still choppy on her
    // phone, where the film's clock is too coarse to match against).
    let t = 0;
    let gone = Infinity;
    const step = () => {
      t = now();
      if (!handed.current && t >= OPENING_END) {
        handed.current = true;
        gone = now() + 0.5;
        if (Math.abs(v.currentTime - OPENING_END) > 0.5) v.currentTime = OPENING_END;
        if (v.paused || v.readyState < 3) setWaiting(true);
        setArriving(false);
      }
      const shown = t;
      if (g && now() < gone) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(dpr * fit.k, 0, 0, dpr * fit.k, dpr * (fit.x - box.left), dpr * (fit.y - box.top));
        paintOpening(g, f.r, f.vw, f.vh, shown);
        paintTitle(g, f.vw, f.vh, shown, shape === 'wide' ? 62 : 52);
        lay(c, shown);
      }
      lay(v, t);
      if (!handed.current || now() < gone) raf = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(raf);
      v.style.transform = '';
      from.style.visibility = formWas;
    };
  }, [from, shape]);

  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = body;
    };
  }, [onClose]);

  // With its lofi track (Cat, 2026-10-22). The play button's tap usually lets sound start; where a browser still
  // blocks it, the tour plays muted (no sound switch: Cat, 2026-11-07, less clutter).
  useEffect(() => {
    const v = video.current;
    v?.play().catch(() => {
      if (!v) return;
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  return (
    <div className={arriving ? 'tour tour-arriving' : from && !reduced ? 'tour tour-arrived' : 'tour'} role="dialog" aria-modal="true" aria-label="How it works">
      {/* Under the film, so the film dissolves in over it at full strength, never through a dimmer mix of the two. */}
      {laying.current && <canvas ref={standIn} className="tour-standin" aria-hidden="true" />}
      <div className="tour-top">
        {/* What the film is, as the Watch demo films say (Cat, Nov 13: no house name everywhere; the welcome above
            already carries it). No Measure / Choose / Style / Print bar under the film (Cat, 2026-11-02: it cluttered
            the demo). */}
        <span className="tour-tag">How it works</span>
        <span className="tour-acts">
          <button ref={close} type="button" className="tour-skip" onClick={onClose}>
            Skip tour ✕
          </button>
        </span>
      </div>
      <video
        ref={video}
        className={waiting ? 'tour-video tour-video-waiting' : 'tour-video'}
        playsInline
        preload="auto"
        aria-describedby="tour-words"
        // Our own controls, not the phone's (FilmControls): a tap on the film pauses or plays it.
        onClick={film.toggle}
        // At the end it holds the wordmark a moment, then closes on its own, as the demos do (the EC tester walk,
        // Nov 22: it sat on near black with only Skip tour as the way out). Playing it again stops the close.
        onEnded={() => { ending.current = window.setTimeout(onClose, END_HOLD_MS); }}
        onPlay={() => window.clearTimeout(ending.current)}
      >
        {SOURCES[shape].map((v) => (
          <source key={v.src} src={v.src} type={v.type} />
        ))}
      </video>
      <FilmBar film={waiting ? { ...film, loading: true } : film} />
      <FilmWords id="tour-words" parts={PARTS} />
    </div>
  );
}
