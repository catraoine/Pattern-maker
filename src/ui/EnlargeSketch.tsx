import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isLadderStep, onOverlay, pushOverlay } from '../nav';
import { createPortal } from 'react-dom';

// Cat's A1 Tap to Enlarge (2026-10-20): an Enlarge button on the style page's preview. It opens the live preview
// itself full screen, its views and tools working there as on the page: drawing on the form, dragging a hem,
// moving points, the pattern (Cat, 2026-10-24: enlarge is for using the tools with a larger view).

/** The drawing in the preview to enlarge: the sketch or the pattern, not the turning form (a canvas). */
// The drawing in the preview: not the fabric's own defs, and not the Enlarge button's icon, which sits in the preview too.
const sketchIn = (preview: Element) =>
  preview.querySelector('.all-round') ? null : Array.from(preview.querySelectorAll<SVGSVGElement>('svg:not(.fabric-defs)')).find((svg) => !svg.closest('.enlarge, .preview-corner')) ?? null;

// When the enlarged preview gives way to the drawing tool (Draw on your form), the tool opens enlarged too. The tool
// is drawn while the preview is still up, so it asks whether the preview is enlarged now, or was a moment ago.
let bigNow = false;
let leftBig = 0;
/** Whether the enlarged preview is up, or has just given way to another screen. */
export const tookEnlarged = () => {
  const now = bigNow || Date.now() - leftBig < 1000;
  leftBig = 0;
  return now;
};

// Drawings that frame themselves closer while enlarged (Cat's E2 Garment fills, 2026-10-25) listen for it.
const watchers = new Set<() => void>();
let shownBig = false;
const showBig = (now: boolean) => {
  if (now === shownBig) return;
  shownBig = now;
  watchers.forEach((w) => w());
};
/** Whether the preview is enlarged now, for a drawing to frame itself closer. */
export const useEnlarged = () =>
  useSyncExternalStore(
    (w) => {
      watchers.add(w);
      return () => watchers.delete(w);
    },
    () => shownBig,
    () => false,
  );

/** Marks the enlarged preview's entry in the browser's history. */
const ENLARGED = 'enlarged';

/** The Enlarge button, placed on the preview of the style page (in the drawing's corner, first of its tools, where
 *  there is one), and the full-screen preview it opens. */
export function EnlargeSketch({ host, corner, name }: { host: HTMLElement | null; corner?: HTMLElement | null; name: string }) {
  const [big, setBig] = useState(false);
  const isBig = useRef(big);
  isBig.current = big;
  bigNow = big;
  useEffect(
    () => () => {
      if (isBig.current) leftBig = Date.now();
      bigNow = false;
      showBig(false);
    },
    [],
  );
  useLayoutEffect(() => showBig(big), [big]);
  // Where the button goes: over the drawing's corner, or in the pattern's own row beside Move points.
  const [spot, setSpot] = useState<HTMLElement | null>(null);
  // Only while there's a drawing to show: not on the turning form, not while drawing a hem.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    const svg = host && sketchIn(host);
    const now = svg && (big || !svg.classList.contains('drawing')) ? host.querySelector<HTMLElement>('.point-switch') ?? host : null;
    if (now !== spot) setSpot(now);
  });
  // The whole preview card goes full screen: its view switches, its tools and the drawing.
  const card = host?.closest<HTMLElement>('section[aria-label="Preview"]') ?? host;
  useLayoutEffect(() => {
    if (!card || !big) return;
    card.classList.add('live-big');
    return () => card.classList.remove('live-big');
  }, [card, big]);
  // Gone from the page (another garment, the drawing tool opened), it closes.
  useEffect(() => {
    if (big && !card) {
      leftBig = Date.now();
      setBig(false);
    }
  }, [big, card]);
  // Its own entry in the history, so back (the phone's swipe too) makes it smaller instead of leaving Style.
  useEffect(() => {
    if (!big) return;
    const on = (e: PopStateEvent) => {
      if (!isLadderStep(e) && !onOverlay(ENLARGED)) setBig(false);
    };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, [big]);
  const open = () => {
    setBig(true);
    pushOverlay(ENLARGED);
  };
  const shrink = () => (onOverlay(ENLARGED) ? window.history.back() : setBig(false));
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && shrink();
    window.addEventListener('keydown', key);
    // The page underneath stays put while it's open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
    };
  }, [big]);
  if (!host || !spot) return null;

  return createPortal(
    <button
      type="button"
      className={spot === host ? 'enlarge' : 'enlarge in-row'}
      aria-pressed={big}
      onClick={big ? shrink : open}
      aria-label={big ? `Make the drawing of the ${name.toLowerCase()} smaller` : `Enlarge the drawing of the ${name.toLowerCase()}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d={big ? 'M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14' : 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9'} />
      </svg>
      {big ? 'Smaller' : 'Enlarge'}
    </button>,
    spot === host && corner ? corner : spot,
  );
}
