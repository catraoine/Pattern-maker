import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Cat's A1 Tap to Enlarge (2026-10-20): an Enlarge button on the pinned sketch opens it full screen, one view
// at a time where the drawing has a front and a back, with a swipe between them and pinch or double tap to zoom.
// The full-screen copy is a still copy of whatever the preview is drawing, so it works the same for every
// garment, its fabric and its pattern pieces.

/** The drawing in the preview to enlarge: the sketch or the pattern, not the turning form (a canvas). */
// The drawing in the preview: not the fabric's own defs, and not the Enlarge button's icon, which sits in the preview too.
const sketchIn = (preview: Element) =>
  preview.querySelector('.all-round, .point-svg') ? null : Array.from(preview.querySelectorAll<SVGSVGElement>('svg:not(.fabric-defs)')).find((svg) => !svg.closest('.enlarge')) ?? null;

interface View {
  label?: string;
  /** The group drawing this view, by its place among the drawing's groups; the others are hidden. */
  group?: number;
  box: string;
}

/** A drawing's views: the technical flat's front and back each on their own, anything else whole. */
function viewsOf(svg: SVGSVGElement): View[] {
  const whole = [{ box: svg.getAttribute('viewBox') ?? '' }];
  if (!svg.classList.contains('techflat')) return whole;
  const groups = Array.from(svg.children).filter((g): g is SVGGElement => g instanceof SVGGElement);
  if (groups.length < 2) return whole;
  try {
    return groups.map((g, group) => {
      const b = g.getBBox();
      const pad = Math.max(b.width, b.height) * 0.04;
      return {
        group,
        label: g.querySelector('.flat-label')?.textContent ?? undefined,
        box: `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`,
      };
    });
  } catch {
    return whole;
  }
}

const MAX = 5;

/** The Enlarge button, placed on the preview of the style page, and the full-screen view it opens. */
export function EnlargeSketch({ host, name }: { host: HTMLElement | null; name: string }) {
  const [open, setOpen] = useState<{ html: string; views: View[]; style: CSSProperties } | null>(null);
  // Where the button goes: over the drawing's corner, or in the pattern's own row beside Move points.
  const [spot, setSpot] = useState<HTMLElement | null>(null);
  // Only while there's a still drawing to show: not on the turning form, not while drawing a hem or moving points.
  useLayoutEffect(() => {
    const svg = host && sketchIn(host);
    const now = svg && !svg.classList.contains('drawing') ? host.querySelector<HTMLElement>('.point-switch') ?? host : null;
    if (now !== spot) setSpot(now);
  });
  if (!host) return null;

  const enlarge = () => {
    const svg = sketchIn(host);
    if (!svg) return;
    // The fabric is drawn from the preview's own pattern, named on the wrapper round the sketch.
    const fabric = svg.closest<HTMLElement>('.garment-fabric');
    const style = fabric ? ({ '--garment': fabric.style.getPropertyValue('--garment'), '--garment-band': fabric.style.getPropertyValue('--garment-band') } as CSSProperties) : {};
    setOpen({ html: svg.outerHTML, views: viewsOf(svg), style });
  };

  return (
    <>
      {spot &&
        createPortal(
          <button type="button" className={spot === host ? 'enlarge' : 'enlarge in-row'} onClick={enlarge} aria-label={`Enlarge the drawing of the ${name.toLowerCase()}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
            </svg>
            Enlarge
          </button>,
          spot,
        )}
      {open && <BigSketch name={name} {...open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BigSketch({ name, html, views, style, onClose }: { name: string; html: string; views: View[]; style: CSSProperties; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist?: number; k: number; x: number; y: number; sx: number; sy: number; moved: boolean }>();
  const lastTap = useRef(0);

  useEffect(() => close.current?.focus(), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    // The page underneath stays put while this is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
    };
  });

  // The drawing, cut to the view showing, without the handles for dragging it on the page.
  useLayoutEffect(() => {
    const svg = stage.current?.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('style');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    if (views[at].box) svg.setAttribute('viewBox', views[at].box);
    // A wide screen shows past the view's box, so the other side is hidden rather than only framed out.
    if (views[at].group !== undefined)
      Array.from(svg.children)
        .filter((g): g is SVGGElement => g instanceof SVGGElement)
        .forEach((g, i) => g.style.setProperty('display', i === views[at].group ? '' : 'none'));
    svg.setAttribute('aria-label', `${name}${views[at].label ? `, ${views[at].label.toLowerCase()}` : ''}`);
  }, [at, html, views, name]);

  const go = (by: number) => {
    const to = at + by;
    if (to < 0 || to >= views.length) return;
    setAt(to);
    setZoom({ k: 1, x: 0, y: 0 });
  };

  /** Zoom by `by` about a point on screen, keeping that point where it is. */
  const zoomAbout = (k: number, cx: number, cy: number, from = zoom) => {
    const r = stage.current!.getBoundingClientRect();
    const nk = Math.min(MAX, Math.max(1, k));
    if (nk === 1) return { k: 1, x: 0, y: 0 };
    const px = cx - r.left - r.width / 2;
    const py = cy - r.top - r.height / 2;
    return { k: nk, x: px - ((px - from.x) * nk) / from.k, y: py - ((py - from.y) * nk) / from.k };
  };

  const down = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      k: zoom.k,
      x: zoom.x,
      y: zoom.y,
      sx: e.clientX,
      sy: e.clientY,
      moved: pts.length > 1,
      dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };
  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length > 1 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setZoom(zoomAbout((g.k * d) / g.dist, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, g));
      return;
    }
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (Math.hypot(dx, dy) > 8) g.moved = true;
    if (g.k > 1) setZoom({ k: g.k, x: g.x + dx, y: g.y + dy });
  };
  const up = (e: ReactPointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) {
      // One finger stays down after a pinch: carry on from here as a drag.
      const [p] = [...pointers.current.values()];
      gesture.current = { k: zoom.k, x: zoom.x, y: zoom.y, sx: p.x, sy: p.y, moved: true };
      return;
    }
    gesture.current = undefined;
    if (!g) return;
    const dx = e.clientX - g.sx;
    // Not zoomed in: a swipe sideways turns to the other view.
    if (g.k === 1 && !g.dist && Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(e.clientY - g.sy)) return go(dx < 0 ? 1 : -1);
    if (g.moved) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      setZoom(zoom.k > 1 ? { k: 1, x: 0, y: 0 } : zoomAbout(2.5, e.clientX, e.clientY));
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  return createPortal(
    <div className="big-sketch" role="dialog" aria-modal="true" aria-label={`${name}, enlarged`}>
      <div className="big-sketch-top">
        <p>{name}</p>
        <button type="button" className="big-sketch-x" onClick={onClose} aria-label="Close full screen">
          ✕
        </button>
      </div>
      <div
        className="big-sketch-stage"
        ref={stage}
        style={style}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => setZoom(zoomAbout(zoom.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY))}
      >
        <div className="big-sketch-draw" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.k})` }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {views.length > 1 && (
        <div className="big-sketch-views" role="group" aria-label="View">
          {views.map((v, i) => (
            <button key={i} type="button" aria-pressed={i === at} onClick={() => go(i - at)}>
              {v.label ?? `View ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <p className="big-sketch-hint">{views.length > 1 ? 'Swipe for the other side. Pinch or double tap to zoom in.' : 'Pinch or double tap to zoom in.'}</p>
      <button type="button" className="ghost" ref={close} onClick={onClose}>
        Close
      </button>
    </div>,
    document.body,
  );
}
