import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FilmBar, useFilm } from './FilmControls';

// The tour: the walkthrough video, full screen, opened from the play button on the welcome's dress form.
// Skip tour is always showing; the bar along the bottom marks Measure, Choose, Style and Print as the video reaches them.
// Re-record the video (npm run record:tour) whenever the app changes enough that the tour looks out of date.

/** H.264 for Safari and Chrome; WebM for browsers without it. A tall film for phones, and a wide one, recorded in the
 * computer layout, for wide screens (Cat, 2026-10-22); the same moments at the same times, so PARTS fits both. */
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
  { name: 'Measure', from: 0, says: 'Just a few measurements, taken once. The dress form takes your shape as you go.' },
  { name: 'Choose', from: 15.0, says: 'Then what to make: pick a garment, start from a look in the collection, or upload a photo of a piece you love.' },
  { name: 'Style', from: 33.0, says: 'Make it yours: its shape, length, hem and details, step by step on the drawing. Your pattern is drafted as you go, and you can shop the fabric for it.' },
  { name: 'Print', from: 66.0, says: 'Print it at home on ordinary paper, full size at a copy shop, or project it true size onto your fabric. Drafted to your body.' },
];
export const TOUR_LABEL = '1:25';

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

/** The pull in on play (Cat, 2026-11-07: "a jump when you press the play button, rather than a smooth pull in").
 *  The film opens on the form alone, part way into its push in (edit-tour's W intro, 1.9 s into the welcome take).
 *  So the page the play button was on (the waitlist, the welcome or Carry on) pulls its own form in to where the
 *  film's form is, its words fading, while the film starts unseen behind it; then the film dissolves in over it.
 *  FILM_FORM is where the welcome take drew the form: its middle and its scale (ContourForm's welcomeLayout, S) on
 *  the page it was recorded from, in that page's pixels. Re-measure if the welcome's layout changes. */
const FILM_FORM = {
  // Drawn as an iPhone's welcome form: the canvas 408 wide and 408 x 481.5 / 366 tall, from 86 down.
  tall: { vw: 432, vh: 768, x: 216, y: 354.38, s: 246.91 },
  wide: { vw: 1440, vh: 810, x: 501.34, y: 427, s: 302.68 },
};
/** The welcome take's push (record-tour-shots.mjs): eased in from 1 s to 4 s, 1.35 times, drawn to the middle. */
const TAKE_FROM = 1.9;
const PULL_MS = 600;
const easeStep = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
/** Where the film's form is on screen, a film time t in, for a video drawn in the box r. */
function filmForm(shape: 'tall' | 'wide', r: { left: number; top: number; width: number; height: number }, t: number) {
  const f = FILM_FORM[shape];
  const p = easeStep((TAKE_FROM + t - 1) / 3);
  const z = 1 + 0.35 * p;
  // The film keeps its shape inside the video box (object-fit: contain).
  const k = Math.min(r.width / f.vw, r.height / f.vh);
  const left = r.left + (r.width - f.vw * k) / 2;
  const top = r.top + (r.height - f.vh * k) / 2;
  return { x: left + (f.x + (f.vw / 2 - f.x) * p) * k, y: top + (f.y + (f.vh / 2 - f.y) * p) * k, s: f.s * z * k };
}

export function TourPlayer({ onClose, from }: { onClose: () => void; from?: HTMLCanvasElement | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  // Chosen once, as the tour opens, so turning a tablet doesn't restart it.
  const [shape] = useState<'tall' | 'wide'>(() => (matchMedia(WIDE_SCREEN).matches ? 'wide' : 'tall'));
  const film = useFilm(video);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [arriving, setArriving] = useState(() => !!from && !reduced);
  // Read once: the pull in keeps following the film after the player is in (arriving is false by then).
  const pulling = useRef(arriving);

  // The pull in: the page's form glides and grows onto the film's own push in while the film starts, hidden, and the
  // player dissolves in over it once the film has caught up with it. It never stops (Cat, 2026-11-07: "a jarring stall
  // on the zoom in"; the glide used to end and wait for the film to load): the form follows the film's path on a
  // clock of its own that slows smoothly while the film is still loading, and once the film is playing and has caught
  // up, it follows the film's own time, so the two are in the same place as one dissolves into the other.
  useLayoutEffect(() => {
    const v = video.current;
    if (!pulling.current || !from || !v) return;
    const c = from.getBoundingClientRect();
    const s0 = Math.min(c.width * 0.82, c.height * 0.46);
    const [cx, cy] = [c.left + c.width / 2, c.top + c.height / 2];
    const box = v.getBoundingClientRect();
    const t0 = performance.now();
    let last = t0;
    let t = 0;
    let caught = 0;
    let raf = 0;
    const step = (now: number) => {
      const e = (now - t0) / 1000;
      const dt = (now - last) / 1000;
      last = now;
      const playing = !v.paused && v.currentTime > 0;
      if (caught) t = v.currentTime;
      else if ((playing && v.currentTime >= t) || e > 4) {
        caught = now;
        t = Math.max(t, v.currentTime);
        setArriving(false);
      } else t += dt * Math.exp(-e / 0.8);
      // From the page's own place onto the film's path, eased in over the first PULL_MS.
      const w = easeStep(e / (PULL_MS / 1000));
      const g = filmForm(shape, box, t);
      from.style.transform = `translate(${(g.x - cx) * w}px, ${(g.y - cy) * w}px) scale(${1 + (g.s / s0 - 1) * w})`;
      // On until the player has fully faded in over it; the page's form then stays there, under the player.
      if (!caught || now - caught < 600) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, shape]);
  // Closing the tour puts the page's form back where it was.
  useEffect(
    () => () => {
      if (from) from.style.transform = '';
    },
    [from],
  );

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
      <div className="tour-top">
        {/* Just the house name (Cat, 2026-10-22). No Measure / Choose / Style / Print bar under the film (Cat,
            2026-11-02: it cluttered the demo). */}
        <span className="tour-tag">Maison Tracé</span>
        <span className="tour-acts">
          <button ref={close} type="button" className="tour-skip" onClick={onClose}>
            Skip tour ✕
          </button>
        </span>
      </div>
      <video
        ref={video}
        className="tour-video"
        playsInline
        preload="auto"
        aria-describedby="tour-words"
        // Our own controls, not the phone's (FilmControls): a tap on the film pauses or plays it.
        onClick={film.toggle}
        // It stays open at the end (the accessibility review, 2026-10-30), so nothing vanishes from under a viewer;
        // the focus goes to Skip tour, to close it.
        onEnded={() => close.current?.focus()}
      >
        {SOURCES[shape].map((v) => (
          <source key={v.src} src={v.src} type={v.type} />
        ))}
      </video>
      <FilmBar film={film} />
      <FilmWords id="tour-words" parts={PARTS} />
    </div>
  );
}
