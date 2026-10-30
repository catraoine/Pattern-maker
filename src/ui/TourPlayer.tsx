import { useEffect, useRef, useState } from 'react';

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
  { name: 'Choose', from: 17.3, says: 'Then what to make: pick a garment, start from a look in the collection, or upload a photo of a piece you love.' },
  { name: 'Style', from: 35.2, says: 'Make it yours: its shape, length, hem and details, step by step on the drawing. Your pattern is drafted as you go.' },
  { name: 'Print', from: 65.4, says: 'Print it at home on ordinary paper, full size at a copy shop, or project it true size onto your fabric. Drafted to your body.' },
];
const TOUR_LENGTH = 89;
export const TOUR_LABEL = '1:29';

export type FilmPart = { name: string; from: number; says: string };

/** The film in words: a Read it switch in the film's top bar opens what each part shows, and a screen reader is
 *  given the words with the film. Tapping a part's name plays the film from there. */
export function FilmWords({ id, parts, onPart }: { id: string; parts: FilmPart[]; onPart: (from: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="tour-skip film-read" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Read it'}
      </button>
      <div id={id} className={open ? 'film-words open' : 'film-words visually-hidden'}>
        <ol>
          {parts.map((p) => (
            <li key={p.name}>
              <button type="button" className="film-part" onClick={() => onPart(p.from)}>
                {p.name}
              </button>
              <p>{p.says}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

export function TourPlayer({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(TOUR_LENGTH);
  // Chosen once, as the tour opens, so turning a tablet doesn't restart it.
  const [shape] = useState<'tall' | 'wide'>(() => (matchMedia(WIDE_SCREEN).matches ? 'wide' : 'tall'));

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
  // blocks it, the tour plays muted and the video's own controls turn the sound on.
  useEffect(() => {
    const v = video.current;
    v?.play().catch(() => {
      if (!v) return;
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  const part = PARTS.reduce((p, x, i) => (at >= x.from ? i : p), 0);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="How it works">
      <div className="tour-top">
        {/* Just the house name (Cat, 2026-10-22); the bar along the bottom already marks the part. The film itself
            doesn't say it again. */}
        <span className="tour-tag">Maison Tracé</span>
        <span className="tour-acts">
          <FilmWords
            id="tour-words"
            parts={PARTS}
            onPart={(from) => {
              if (video.current) video.current.currentTime = from;
            }}
          />
          <button ref={close} type="button" className="tour-skip" onClick={onClose}>
            Skip tour ✕
          </button>
        </span>
      </div>
      <video
        ref={video}
        className="tour-video"
        playsInline
        controls
        preload="auto"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        aria-describedby="tour-words"
        // It stays open at the end (the accessibility review, 2026-10-30), so nothing vanishes from under a viewer;
        // the focus goes to Skip tour, to close it.
        onEnded={() => close.current?.focus()}
      >
        {SOURCES[shape].map((v) => (
          <source key={v.src} src={v.src} type={v.type} />
        ))}
      </video>
      <ol className="tour-parts" aria-label="Parts of the tour">
        {PARTS.map((p, i) => {
          const end = PARTS[i + 1]?.from ?? length;
          const fill = Math.max(0, Math.min(1, (at - p.from) / (end - p.from)));
          return (
            <li key={p.name} className={i === part ? 'on' : ''}>
              <button
                type="button"
                onClick={() => {
                  if (video.current) video.current.currentTime = p.from;
                }}
              >
                <span className="tour-track">
                  <span style={{ transform: `scaleX(${fill})` }} />
                </span>
                <span className="tour-num">0{i + 1} </span>
                {p.name}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
