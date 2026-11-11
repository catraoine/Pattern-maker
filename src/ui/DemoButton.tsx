import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilmBar, useFilm } from './FilmControls';
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
      { name: 'Shape', from: 0, says: 'Pick a shape. The pattern redraws to your body.' },
      { name: 'Length', from: 9.7, says: 'Drag the hem to the length you want.' },
      { name: 'Hem', from: 21.8, says: 'Pick the shape of the hem. Here, high-low.' },
      { name: 'Details', from: 26.8, says: 'Add details. Here, pleats and a tie sash.' },
      { name: 'Undo', from: 32.2, says: 'Changed your mind? Undo takes off the last change.' },
      { name: 'Pattern', from: 37.3, says: 'Switch to Pattern to see the pieces you will cut.' },
    ],
    length: '0:46',
  },
  draw: {
    title: 'How drawing on your form works',
    base: '/demos/draw',
    parts: [
      { name: 'Draw', from: 0, says: 'Draw where you want the hem. The skirt follows your line.' },
      { name: 'Back', from: 13.9, says: 'Turn to the back. Draw it lower for a high-low hem. Longer at the back.' },
    ],
    length: '0:28',
  },
  photo: {
    title: 'How starting from a photo works',
    base: '/demos/photo',
    parts: [
      { name: 'Photo', from: 0, says: 'Seen something you love? Take a photo, or choose one.' },
      { name: 'Read', from: 13.4, says: 'We read the shape, the length and the fit.' },
      { name: 'Check', from: 18.5, says: 'Did we read anything wrong? Change it. Here, midi instead of maxi.' },
      { name: 'Draft', from: 24.5, says: 'Your pattern is drafted to your measurements. Style it from here.' },
    ],
    length: '0:34',
  },
  fabric: {
    title: 'How fabric and the lay plan work',
    base: '/demos/fabric',
    parts: [
      { name: 'Fabric', from: 0, says: 'Pick the fabric you will sew it in. The drawing shows it.' },
      { name: 'Print', from: 10.7, says: 'Checks or stripes? Tell us, and the pieces are placed to match them.' },
      { name: 'Lay plan', from: 17.0, says: 'On Print, the lay plan shows where every piece goes on your fabric.' },
      { name: 'Width', from: 23.3, says: 'Set your fabric’s width. The plan rearranges to fit it.' },
    ],
    length: '0:34',
  },
  print: {
    title: 'How printing works',
    base: '/demos/print',
    parts: [
      { name: 'Paper', from: 0, says: 'Pick your paper size. The pattern is split into pages to fit it.' },
      { name: 'Pages', from: 17.6, says: 'Each page is numbered on the drawing, so you know where it goes.' },
      { name: 'Tape', from: 23.9, says: 'Once printed, trim each page, match the half diamonds and tape them together.' },
      { name: 'Download', from: 30.2, says: 'Download the PDF. Print it at 100%, not fit to page.' },
    ],
    length: '0:39',
  },
  projector: {
    title: 'How projector mode works',
    base: '/demos/projector',
    parts: [
      { name: 'Line up', from: 0, says: 'Point your projector at your cutting mat. Drag each corner onto a corner of the mat’s grid.' },
      { name: 'Check', from: 16.4, says: 'Lay a ruler across the square. Is each side 10 cm?' },
      { name: 'Project', from: 22.1, says: 'Each piece shows at true size. Drag it where you want it on your fabric.' },
      { name: 'Turn', from: 29.0, says: 'Turn it or flip it to fit your fabric.' },
      { name: 'Pieces', from: 34.1, says: 'Cut it, then go on to the next piece.' },
    ],
    length: '0:42',
  },
  scale: {
    title: 'How the true size check works',
    base: '/demos/scale',
    parts: [
      { name: 'Card', from: 0, says: 'Hold a bank card on the screen. Make the box the same size as the card.' },
      { name: 'Measure', from: 15.8, says: 'Now the piece is at its real size. Tap two points to measure.' },
      { name: 'Seam', from: 23.3, says: 'Or tap along a seam to see its length.' },
    ],
    length: '0:31',
  },
  fitting: {
    title: 'How fitting after your toile works',
    base: '/demos/fitting',
    parts: [
      { name: 'Tick', from: 0, says: 'Tried on your toile? Tick what you see, like pulling across the hips.' },
      { name: 'Amount', from: 14.7, says: 'Then set how much to fix it.' },
      { name: 'Correction', from: 19.7, says: 'The pattern is corrected the way a pattern cutter would. Dashed line: before. Solid line: after.' },
      { name: 'Save', from: 26.9, says: 'Save it as version 2, and print the corrected pattern.' },
    ],
    length: '0:35',
  },
  patterns: {
    title: 'How drawing a line on your pattern works',
    base: '/demos/patterns',
    parts: [
      { name: 'Pattern', from: 0, says: 'Your pattern pieces. Draw a line across one to change its shape.' },
      { name: 'Spread', from: 10.8, says: 'Choose what the line does. Here, spread it open. Drag the round handle to open it more. The hem gets fuller.' },
      { name: 'New piece', from: 21.9, says: 'Or draw across the hip, and cut it off as a new piece. Here, a yoke.' },
      { name: 'Edited', from: 30.0, says: 'Notched to match, ready to print. Back to drafted undoes it all.' },
    ],
    length: '0:39',
  },
  shop: {
    title: 'How shopping the fabric works',
    base: '/demos/shop',
    parts: [],
    length: '0:00',
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

// How long the player takes to ease back to the page as it closes; 34-chalk-windows.css has the same length.
const LEAVE_MS = 1100;

function DemoPlayer({ demo, onClose: done }: { demo: Demo; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(0);
  const film = useFilm(video);
  // A soft fade to black as it opens and back to the stone window as it closes (Cat, Nov 11).
  const [leaving, setLeaving] = useState(false);
  const onClose = useCallback(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    setLeaving(true);
    window.setTimeout(done, LEAVE_MS);
  }, [done]);

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
    <div className={leaving ? 'tour demo-fade demo-leaving' : 'tour demo-fade'} role="dialog" aria-modal="true" aria-label={demo.title}>
      <div className="tour-top">
        <span className="tour-tag">
          {demo.title} · {parts[part].name}
        </span>
        <span className="tour-acts">
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
        preload="auto"
        // Our own controls, not the phone's (FilmControls): a tap on the clip pauses or plays it.
        onClick={film.toggle}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        aria-describedby="demo-words"
        // It stays open at the end, the focus on Close (the accessibility review, 2026-10-30).
        onEnded={() => close.current?.focus()}
      >
        <source src={`${demo.base}.mp4`} type='video/mp4; codecs="avc1.640032"' />
        <source src={`${demo.base}.webm`} type='video/webm; codecs="vp9"' />
      </video>
      <FilmBar film={film} />
      <FilmWords id="demo-words" parts={parts} />
    </div>
  );
}
