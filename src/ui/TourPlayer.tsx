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
const PARTS: { name: string; from: number }[] = [
  { name: 'Measure', from: 0 },
  { name: 'Choose', from: 17.3 },
  { name: 'Style', from: 35.2 },
  { name: 'Print', from: 65.4 },
];
const TOUR_LENGTH = 89;
export const TOUR_LABEL = '1:29';

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
        <button ref={close} type="button" className="tour-skip" onClick={onClose}>
          Skip tour ✕
        </button>
      </div>
      <video
        ref={video}
        className="tour-video"
        playsInline
        controls
        preload="auto"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onEnded={onClose}
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
                0{i + 1} {p.name}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
