import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FilmBar, useFilm } from './FilmControls';
import { openingAt, paintOpening } from './filmOpening';

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

export function TourPlayer({ onClose, from }: { onClose: () => void; from?: HTMLCanvasElement | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const standIn = useRef<HTMLCanvasElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  // Chosen once, as the tour opens, so turning a tablet doesn't restart it.
  const [shape] = useState<'tall' | 'wide'>(() => (matchMedia(WIDE_SCREEN).matches ? 'wide' : 'tall'));
  const film = useFilm(video);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [arriving, setArriving] = useState(() => !!from && !reduced);
  // Read once: the film's frame keeps easing back after the player is in (arriving is false by then).
  const laying = useRef(arriving);
  const handed = useRef(false);

  // The opening, drawn from the tap on the stand-in canvas, on a clock started by the tap, until the film is playing
  // (then it fades away over it); the film, when it comes, is sent to the same moment. Both are laid over the page on
  // their own clocks: the film's form on the page's form, easing back to the full frame as the push comes in.
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
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const g = c.getContext('2d');
    let raf = 0;
    // The stand-in's own clock: real time from the tap, nudged (a touch faster or slower, never seen) onto the film's
    // once the film is playing, so the film takes over on the very frame the stand-in shows.
    let t = 0;
    let last = performance.now();
    let gone = Infinity;
    let sent = false;
    let caught = 0;
    const step = () => {
      const at = performance.now();
      const dt = Math.min(0.1, (at - last) / 1000);
      last = at;
      const ready = !v.paused && !v.seeking && v.readyState >= 3;
      if (!handed.current && ready && !sent && v.currentTime < t - 0.25) {
        // Sent on once, to just ahead of now (a seek takes a moment).
        sent = true;
        v.currentTime = t + 0.2;
      }
      const err = !handed.current && ready ? v.currentTime - t : 0;
      t += dt * (1 + Math.max(-0.3, Math.min(0.3, 2 * err)));
      if (!handed.current && ready) {
        // In step for a few frames running, or still apart after a good while: the film takes over.
        caught = Math.abs(v.currentTime - t) < 0.03 ? caught + 1 : 0;
        if (caught >= 3 || now() > 9) {
          handed.current = true;
          gone = now() + 0.5;
          setArriving(false);
        }
      }
      const shown = handed.current && ready ? v.currentTime : t;
      if (g && now() < gone) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(dpr * fit.k, 0, 0, dpr * fit.k, dpr * (fit.x - box.left), dpr * (fit.y - box.top));
        paintOpening(g, f.r, f.vw, f.vh, shown);
        lay(c, shown);
      }
      const moving = handed.current ? lay(v, v.currentTime) : (lay(v, t), true);
      if (moving || now() < gone) raf = requestAnimationFrame(step);
    };
    step();
    // Never left on the stand-in: if the film can't start (say it is blocked), the player comes in anyway.
    const late = setTimeout(() => {
      if (handed.current) return;
      handed.current = true;
      gone = now() + 0.5;
      setArriving(false);
    }, 10000);
    return () => {
      cancelAnimationFrame(raf);
      v.style.transform = '';
      from.style.visibility = formWas;
      clearTimeout(late);
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
