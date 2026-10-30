import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilmWords, type FilmPart } from './TourPlayer';

// Watch demo (Cat's pick L1 Whisper, 2026-10-20): small deep champagne caps with the play mark after the words,
// in the bottom-right corner of a tool's box. A light runs across it once when it arrives, so it is noticed without
// shouting. It opens that tool's clip full screen, like the tour. Clips are recorded from the app by
// scripts/record-demos.mjs (npm run record:demos); re-record them with the tour once the app is final.

type Demo = {
  /** What the clip shows, for the dialog and the button's label. */
  title: string;
  base: string;
  /** Where each part starts, in seconds, and what its caption says. Update with the clip (record-demos.mjs). */
  parts: FilmPart[];
  length: string;
};

const DEMOS = {
  style: {
    title: 'How Style works',
    base: '/demos/style',
    parts: [
      { name: 'Steps', from: 0, says: 'Choices come in five steps under the drawing. Your picks show beside it.' },
      { name: 'Shape', from: 6.7, says: 'Tap a shape. The pattern redraws to your body.' },
      { name: 'Length & hem', from: 17.0, says: 'Drag the hem on the sketch for length. Pick its shape here.' },
      { name: 'Details', from: 21.6, says: 'Pockets, waistband or elastic.' },
      { name: 'Undo', from: 25.9, says: 'Changed your mind? Undo is always at the bottom.' },
      { name: 'Pattern', from: 28.7, says: 'Pattern shows the pieces you will cut.' },
      { name: 'Review', from: 34.2, says: 'Happy with it? Review, then print.' },
    ],
    length: '0:39',
  },
  draw: {
    title: 'How drawing on your form works',
    base: '/demos/draw',
    parts: [
      { name: 'Open it', from: 0, says: 'Tap the pencil by the drawing, then Draw on your form. This is a dress form built from your measurements.' },
      { name: 'Draw', from: 11.3, says: 'Pick Hem, then draw where you want it with your finger. The pattern follows your line. Try the back too.' },
      { name: 'Undo', from: 23.7, says: 'Undo takes the last line back. Redo puts it back.' },
      { name: 'Done', from: 29.3, says: 'Done keeps your lines and shows the pattern.' },
    ],
    length: '0:35',
  },
  photo: {
    title: 'How starting from a photo works',
    base: '/demos/photo',
    parts: [
      { name: 'Start', from: 0, says: 'Seen something you love? Start from a look, then a photo.' },
      { name: 'Photo', from: 9.1, says: 'Take one, or choose one. Worn or laid flat. We read the shape, the length and the fit.' },
      { name: 'Check', from: 14.8, says: 'Anything wrong? Change it. Here, a midi instead.' },
      { name: 'Draft', from: 18.9, says: 'Then draft it, to your measurements. Your pattern, matched to the photo. Style it from here.' },
    ],
    length: '0:26',
  },
  fabric: {
    title: 'How fabric and the lay plan work',
    base: '/demos/fabric',
    parts: [
      { name: 'Fabric', from: 0, says: 'On Style, the Fabric tab: pick what you will sew it in.' },
      { name: 'Print', from: 9.6, says: 'Tell us the print, so pieces line up on checks or motifs.' },
      { name: 'Lay plan', from: 14.1, says: 'On Print, the lay plan shows every piece on your cloth.' },
      { name: 'Width', from: 21.4, says: 'Change the fabric width, and the metres to buy change too.' },
    ],
    length: '0:31',
  },
  print: {
    title: 'How printing works',
    base: '/demos/print',
    parts: [
      { name: 'Paper', from: 0, says: 'Review, then Print my pattern. Pick your paper size.' },
      { name: 'Pages', from: 16.3, says: 'Each page is numbered on the drawing, so you know where it goes.' },
      { name: 'Tape', from: 20.6, says: 'Trim, match the half diamonds, and tape the pages together.' },
      { name: 'Download', from: 24.4, says: 'Download the PDF and print it at 100%, not fit to page.' },
    ],
    length: '0:29',
  },
  projector: {
    title: 'How projector mode works',
    base: '/demos/projector',
    parts: [
      { name: 'Paper', from: 0, says: 'On Print, pick Projector as your paper.' },
      { name: 'Open', from: 12.7, says: 'Projector plugged in and pointing at your mat? Open projector mode.' },
      { name: 'Line up', from: 15.4, says: 'Drag each corner onto a corner of your cutting mat’s grid.' },
      { name: 'Check', from: 22.0, says: 'Lay a ruler across the square. Is each side 10 cm?' },
      { name: 'Project', from: 28.0, says: 'Each piece shows at true size. Drag it where you want it on the cloth.' },
      { name: 'Turn', from: 31.6, says: 'Turn it, flip it, or make the lines thicker for dark cloth.' },
      { name: 'Pieces', from: 36.1, says: 'Cut it, then go on to the next piece.' },
    ],
    length: '0:41',
  },
  scale: {
    title: 'How the true size check works',
    base: '/demos/scale',
    parts: [
      { name: 'Open it', from: 0, says: 'On Print, under Fit it in a toile first: See a piece at true size.' },
      { name: 'Card', from: 12.4, says: 'Hold a bank card on the screen and match the shape to it.' },
      { name: 'Measure', from: 21.6, says: 'Now the piece is at its real size. Tap two points to measure.' },
      { name: 'Seam', from: 27.4, says: 'Walk a seam: tap an edge to see its length.' },
    ],
    length: '0:35',
  },
  fitting: {
    title: 'How fitting after your toile works',
    base: '/demos/fitting',
    parts: [
      { name: 'Open it', from: 0, says: 'Sewn a toile and tried it on? On Print: I’ve tried on a toile.' },
      { name: 'Tick', from: 12.5, says: 'Tick what you see, like pulling across the hips.' },
      { name: 'Amount', from: 14.9, says: 'Set how much. The pattern is corrected the way a cutter would.' },
      { name: 'Correction', from: 18.5, says: 'Dashed line: the pattern now. Solid: corrected, in millimetres.' },
      { name: 'Save', from: 21.7, says: 'Save it as version 2, and print the corrected pattern.' },
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
        <span className="tour-acts">
          <FilmWords
            id="demo-words"
            parts={parts}
            onPart={(from) => {
              if (video.current) video.current.currentTime = from;
            }}
          />
          <button ref={close} type="button" className="tour-skip" onClick={onClose}>
            Close ✕
          </button>
        </span>
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
        aria-describedby="demo-words"
        // It stays open at the end, the focus on Close (the accessibility review, 2026-10-30).
        onEnded={() => close.current?.focus()}
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
