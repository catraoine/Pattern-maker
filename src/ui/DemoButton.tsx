import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Watch demo (Cat's pick L1 Whisper, 2026-10-20): small deep champagne caps with the play mark after the words,
// in the bottom-right corner of a tool's box. A light runs across it once when it arrives, so it is noticed without
// shouting. It opens that tool's clip full screen, like the tour. Clips are recorded from the app by
// scripts/record-demos.mjs (npm run record:demos); re-record them with the tour once the app is final.

type Demo = {
  /** What the clip shows, for the dialog and the button's label. */
  title: string;
  base: string;
  /** Where each part starts, in seconds. Update with the clip. */
  parts: { name: string; from: number }[];
  length: string;
};

const DEMOS = {
  style: {
    title: 'How Style works',
    base: '/demos/style',
    parts: [
      { name: 'Steps', from: 0 },
      { name: 'Shape', from: 6.7 },
      { name: 'Length & hem', from: 17.0 },
      { name: 'Details', from: 21.6 },
      { name: 'Undo', from: 25.9 },
      { name: 'Pattern', from: 28.7 },
      { name: 'Review', from: 34.2 },
    ],
    length: '0:39',
  },
  draw: {
    title: 'How drawing on your form works',
    base: '/demos/draw',
    parts: [
      { name: 'Open it', from: 0 },
      { name: 'Draw', from: 11.3 },
      { name: 'Undo', from: 23.7 },
      { name: 'Done', from: 29.3 },
    ],
    length: '0:35',
  },
  photo: {
    title: 'How starting from a photo works',
    base: '/demos/photo',
    parts: [
      { name: 'Start', from: 0 },
      { name: 'Photo', from: 9.1 },
      { name: 'Check', from: 14.8 },
      { name: 'Draft', from: 18.9 },
    ],
    length: '0:26',
  },
  fabric: {
    title: 'How fabric and the lay plan work',
    base: '/demos/fabric',
    parts: [
      { name: 'Fabric', from: 0 },
      { name: 'Print', from: 9.6 },
      { name: 'Lay plan', from: 14.1 },
      { name: 'Width', from: 21.4 },
    ],
    length: '0:31',
  },
  print: {
    title: 'How printing works',
    base: '/demos/print',
    parts: [
      { name: 'Paper', from: 0 },
      { name: 'Pages', from: 16.3 },
      { name: 'Tape', from: 20.6 },
      { name: 'Download', from: 24.4 },
    ],
    length: '0:29',
  },
  projector: {
    title: 'How projector mode works',
    base: '/demos/projector',
    parts: [
      { name: 'Paper', from: 0 },
      { name: 'Open', from: 12.7 },
      { name: 'Line up', from: 15.4 },
      { name: 'Check', from: 22.0 },
      { name: 'Project', from: 28.0 },
      { name: 'Turn', from: 31.6 },
      { name: 'Pieces', from: 36.1 },
    ],
    length: '0:41',
  },
  scale: {
    title: 'How the true size check works',
    base: '/demos/scale',
    parts: [
      { name: 'Open it', from: 0 },
      { name: 'Card', from: 12.4 },
      { name: 'Measure', from: 21.6 },
      { name: 'Seam', from: 27.4 },
    ],
    length: '0:35',
  },
  fitting: {
    title: 'How fitting after your toile works',
    base: '/demos/fitting',
    parts: [
      { name: 'Open it', from: 0 },
      { name: 'Tick', from: 12.5 },
      { name: 'Amount', from: 14.9 },
      { name: 'Correction', from: 18.5 },
      { name: 'Save', from: 21.7 },
    ],
    length: '0:27',
  },
} satisfies Record<string, Demo>;

type DemoName = keyof typeof DEMOS;

export function DemoButton({ demo }: { demo: DemoName }) {
  const [open, setOpen] = useState(false);
  const d: Demo = DEMOS[demo];
  return (
    <>
      <button type="button" className="demo-play" onClick={() => setOpen(true)} aria-label={`Watch demo: ${d.title}, ${d.length}`}>
        <span className="demo-play-words">
          Watch demo<span className="demo-play-mark">{'▶︎'}</span>
        </span>
      </button>
      {/* On the body, so the steady header and the bottom bar cannot sit over it. */}
      {open && createPortal(<DemoPlayer demo={d} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function DemoPlayer({ demo, onClose }: { demo: Demo; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(0);

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

  const { parts } = demo;
  const part = parts.reduce((p, x, i) => (at >= x.from ? i : p), 0);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={demo.title}>
      <div className="tour-top">
        <span className="tour-tag">
          {demo.title} · {parts[part].name}
        </span>
        <button ref={close} type="button" className="tour-skip" onClick={onClose}>
          Close ✕
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
        <source src={`${demo.base}.mp4`} type='video/mp4; codecs="avc1.640032"' />
        <source src={`${demo.base}.webm`} type='video/webm; codecs="vp9"' />
      </video>
      <ol className="tour-parts demo-parts" aria-label="Parts of the demo">
        {parts.map((p, i) => {
          const end = parts[i + 1]?.from ?? (length || p.from + 5);
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
                <span className="demo-part-name">{p.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
