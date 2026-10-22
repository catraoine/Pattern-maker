import { useEffect, useRef, useState } from 'react';

// The tour: the walkthrough video, full screen, opened from the play button on the welcome's dress form.
// Skip tour is always showing; the bar along the bottom marks Measure, Style and Print as the video reaches them.
// Re-record the video (scripts/record-demo.mjs) whenever the welcome changes, so the tour shows the app as it is.

/** H.264 for Safari and Chrome; WebM for browsers without it. */
const SOURCES = [
  { src: '/tour/walkthrough.mp4', type: 'video/mp4; codecs="avc1.640032"' },
  { src: '/tour/walkthrough.webm', type: 'video/webm; codecs="vp9"' },
];
/** Where each part starts in the video, in seconds, and how long it runs. Update with the video. */
const PARTS: { name: string; from: number }[] = [
  { name: 'Measure', from: 0 },
  { name: 'Style', from: 60.5 },
  { name: 'Print', from: 88.5 },
];
export const TOUR_LENGTH = 105;
export const TOUR_LABEL = '1:45';

export function TourPlayer({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(TOUR_LENGTH);

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

  const part = PARTS.reduce((p, x, i) => (at >= x.from ? i : p), 0);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="How it works">
      <div className="tour-top">
        <span className="tour-tag">The tour · 0{part + 1} {PARTS[part].name}</span>
        <button ref={close} type="button" className="tour-skip" onClick={onClose}>
          Skip tour ✕
        </button>
      </div>
      <video
        ref={video}
        className="tour-video"
        autoPlay
        muted
        playsInline
        controls
        preload="auto"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onEnded={onClose}
      >
        {SOURCES.map((v) => (
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
