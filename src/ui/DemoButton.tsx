import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilmBar, useFilm } from './FilmControls';
import { FilmWords, type FilmPart } from './TourPlayer';
import { DemoGarment, KIND_FILMS, kindOf } from './demoKinds';

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
      { name: 'Shape', from: 0, says: 'Pick a shape. Your pattern redraws to fit you.' },
      { name: 'Length', from: 9.9, says: 'Drag the hem up or down to set the length.' },
      { name: 'Hem', from: 22.0, says: 'Pick a hem shape. Here, high-low.' },
      { name: 'Details', from: 27.0, says: 'Add details. Here, pleats and a tie sash.' },
      { name: 'Undo', from: 32.7, says: 'Changed your mind? Tap Undo.' },
      { name: 'Pattern', from: 37.6, says: 'Tap Pattern to see the pieces you will cut.' },
    ],
    length: '0:47',
  },
  draw: {
    title: 'How drawing on your form works',
    base: '/demos/draw',
    parts: [
      { name: 'Draw', from: 0, says: 'Draw a line across the skirt where you want the hem. The skirt follows your line.' },
      { name: 'Back', from: 14.9, says: 'Tap Back to turn the form. Draw lower for a high-low hem. Now it is longer at the back.' },
    ],
    length: '0:29',
  },
  photo: {
    title: 'How starting from a photo works',
    base: '/demos/photo',
    parts: [
      { name: 'Photo', from: 0, says: 'Seen something you love? Take a photo or choose one.' },
      { name: 'Read', from: 12.6, says: 'The app reads its shape, length and fit.' },
      { name: 'Check', from: 17.6, says: 'Anything read wrong? Tap Change. Here, midi instead of maxi.' },
      { name: 'Draft', from: 23.0, says: 'Your pattern is drafted to your measurements. Then style it your way.' },
    ],
    length: '0:32',
  },
  fabric: {
    title: 'How fabric and the lay plan work',
    base: '/demos/fabric',
    parts: [
      { name: 'Fabric', from: 0, says: 'Pick the fabric you will sew with. The drawing shows it.' },
      { name: 'Print', from: 10.7, says: 'Checks or stripes? Pick one, and the pieces are placed so they match.' },
      { name: 'Lay plan', from: 17.0, says: 'On Print, the lay plan shows where each piece goes on your fabric.' },
      { name: 'Width', from: 23.6, says: 'Set your fabric’s width. The plan moves the pieces to fit.' },
    ],
    length: '0:35',
  },
  print: {
    title: 'How printing works',
    base: '/demos/print',
    parts: [
      { name: 'Paper', from: 0, says: 'Pick your paper size. The pattern splits into pages to fit.' },
      { name: 'Pages', from: 17.9, says: 'Each page is numbered, so you know where it goes.' },
      { name: 'Tape', from: 23.9, says: 'Trim each page. Line up the half diamonds and tape the pages together.' },
      { name: 'Download', from: 30.2, says: 'Download the PDF. Print it at 100%, not “fit to page”.' },
    ],
    length: '0:39',
  },
  projector: {
    title: 'How projector mode works',
    base: '/demos/projector',
    parts: [
      { name: 'Line up', from: 0, says: 'Point your projector at your cutting mat. Drag each corner onto a corner of the mat’s grid.' },
      { name: 'Check', from: 16.4, says: 'Lay a ruler across the square. Each side should be 10 cm.' },
      { name: 'Project', from: 22.4, says: 'Each piece shows at its real size. Drag it into place on your fabric.' },
      { name: 'Turn', from: 28.9, says: 'Turn or flip it to fit your fabric.' },
      { name: 'Pieces', from: 33.9, says: 'Cut it out, then tap Next piece.' },
    ],
    length: '0:42',
  },
  scale: {
    title: 'How the true size check works',
    base: '/demos/scale',
    parts: [
      { name: 'Card', from: 0, says: 'Hold a bank card on the screen. Make the box match the card.' },
      { name: 'Measure', from: 14.8, says: 'Now the piece shows at its real size. Tap two points to measure.' },
      { name: 'Seam', from: 22.4, says: 'Or tap along a seam to see how long it is.' },
    ],
    length: '0:31',
  },
  fitting: {
    title: 'How fitting after your toile works',
    base: '/demos/fitting',
    parts: [
      { name: 'Tick', from: 0, says: 'Tried on your toile? Tick what you see, like pulling across the hips.' },
      { name: 'Amount', from: 14.9, says: 'Then set how much to fix it.' },
      { name: 'Correction', from: 19.9, says: 'Your pattern is corrected the way a pattern cutter would. Dashed line: before. Solid line: after.' },
      { name: 'Save', from: 27.1, says: 'Save it as version 2, then print the new pattern.' },
    ],
    length: '0:35',
  },
  patterns: {
    title: 'How drawing a line on your pattern works',
    base: '/demos/patterns',
    parts: [
      { name: 'Pattern', from: 0, says: 'These are your pattern pieces. Draw a line across one to change it.' },
      { name: 'Spread', from: 11.2, says: 'Choose what the line does. Here, spread it open. Drag the round handle to open it more. The hem gets fuller.' },
      { name: 'New piece', from: 22.3, says: 'Or draw across the hip and cut it off as a new piece. Here, a yoke.' },
      { name: 'Edited', from: 30.4, says: 'Notches are added so the pieces match. To start again, tap Back to drafted.' },
    ],
    length: '0:40',
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
  // The clip made on the garment open, where there is one (the testers' own garments); the skirt's otherwise.
  const kind = kindOf(useContext(DemoGarment));
  const own = kind && demo in KIND_FILMS ? KIND_FILMS[demo as keyof typeof KIND_FILMS]?.[kind] : undefined;
  const d: Demo = own ? { ...DEMOS[demo], ...own } : DEMOS[demo];
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
