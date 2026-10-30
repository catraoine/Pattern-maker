import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { P } from '../engine/geometry';
import { Piece, bounds, cutLine } from '../engine/piece';
import { screenKey } from '../engine/scale';
import {
  INKS,
  LAYERS,
  LINE_MM,
  Layer,
  LineUp,
  Look,
  PAPER,
  Placement,
  Ref,
  apply,
  convex,
  invert,
  lensAt,
  loadLineUp,
  loadLook,
  localMatrix,
  matToScreen,
  onScreenArea,
  paperSize,
  placePoint,
  pxPerCm,
  saveLineUp,
  saveLook,
  startCorners,
} from '../engine/projector';
import type { Unit } from '../measurements';
import { TestingTag } from './TestingTag';

// Projector mode (Cat applied, 2026-10-28), modelled on the free Pattern Projector web app: line the
// projector up once against a cutting mat, check a 10 cm square, then show one piece at a time at true size,
// in thick white lines on black, to move and turn on the cloth.

interface Props {
  pieces: Piece[];
  unit: Unit;
  onClose: () => void;
}

type Stage = 'corners' | 'check' | 'project';

const IN = 2.54;
// On-screen nudges for touch screens, which have no arrow keys: a pixel at a time.
const NUDGES: [string, [number, number]][] = [
  ['left', [-1, 0]],
  ['up', [0, -1]],
  ['down', [0, 1]],
  ['right', [1, 0]],
];
const ARROWS: Record<string, string> = { left: '←', up: '↑', down: '↓', right: '→' };
// Mats are sold by their marked grid: 60 × 45 cm, or 24 × 18 in.
const START_MAT = { cm: { w: 60, h: 45 }, in: { w: 24 * IN, h: 18 * IN } };
// A first line-up is on printer paper (Cat, 2026-10-30: no mat needed): A4 for centimetres, Letter for inches.
const START_REF: Record<Unit, Ref> = { cm: 'a4', in: 'letter' };
const REFS: [Ref, string][] = [
  ['a4', 'A4 paper'],
  ['letter', 'Letter paper'],
  ['mat', 'Cutting mat'],
];
const LAYER_NAMES: Record<Layer, string> = {
  cut: 'Cutting line',
  stitch: 'Stitching line',
  inner: 'Darts and inner lines',
  notches: 'Notches',
  grain: 'Grain and fold',
  labels: 'Names and labels',
};
// The loupe magnifies three times.
const ZOOM = 3;

/** The size to line up on: the mat's grid as typed (or a standard mat), or the paper upright or the way the corners lie. */
function refSize(ref: Ref, l: LineUp, unit: Unit, upright: boolean) {
  if (ref !== 'mat') return upright ? PAPER[ref] : paperSize(ref, l.corners);
  return (l.ref ?? 'mat') === 'mat' ? l.mat : START_MAT[unit];
}

const thisScreen = () => screenKey(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight, window.devicePixelRatio || 1);

const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export function ProjectorMode({ pieces, unit, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const screen = useMemo(thisScreen, []);
  const view = useViewport();
  const [lineUp, setLineUp] = useState<LineUp>(() => {
    const saved = loadLineUp(screen);
    if (saved) return saved;
    const ref = START_REF[unit];
    const mat = PAPER[ref as 'a4' | 'letter'];
    return { mat, ref, corners: startCorners(window.innerWidth, window.innerHeight, mat, undefined, 0.35), screen };
  });
  const [stage, setStage] = useState<Stage>(() => (loadLineUp(screen) ? 'project' : 'corners'));
  // A first line-up, not yet touched: its corners may still be re-seated clear of the panel.
  const [fresh, setFresh] = useState(() => !loadLineUp(screen));

  // Full screen hides the browser's bars, which would otherwise shine onto the cloth.
  useEffect(() => {
    const el = root.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => undefined);
      else el?.webkitRequestFullscreen?.();
    } catch {
      // Not every browser allows it; the black layer still covers the page.
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);

  const keep = (l: LineUp) => {
    setLineUp(l);
    saveLineUp(l);
  };

  // On the page's body, so no card around it can trap or clip the full-screen layer.
  return createPortal(
    <div ref={root} className="projector" role="dialog" aria-modal="true" aria-label="Projector mode">
      {stage === 'corners' && (
        <Corners
          lineUp={lineUp}
          unit={unit}
          view={view}
          fresh={fresh}
          onChange={(l) => {
            setFresh(false);
            setLineUp(l);
          }}
          onSeat={setLineUp}
          onNext={() => {
            // Paper can lie either way round on the table: its size follows the corners as they were dragged.
            const ref = lineUp.ref ?? 'mat';
            const l = ref === 'mat' ? lineUp : { ...lineUp, mat: paperSize(ref, lineUp.corners) };
            setLineUp(l);
            keep(l);
            setStage('check');
          }}
          onClose={onClose}
        />
      )}
      {stage === 'check' && <Check lineUp={lineUp} unit={unit} view={view} onBack={() => setStage('corners')} onOk={() => setStage('project')} />}
      {stage === 'project' && <Project pieces={pieces} lineUp={lineUp} unit={unit} view={view} onLineUp={() => setStage('corners')} onClose={onClose} />}
    </div>,
    document.body,
  );
}

/** Step 1: drag the four corners onto the mat's grid. */
function Corners({ lineUp, unit, view, fresh, onChange, onSeat, onNext, onClose }: { lineUp: LineUp; unit: Unit; view: { w: number; h: number }; fresh: boolean; onChange: (l: LineUp) => void; onSeat: (l: LineUp) => void; onNext: () => void; onClose: () => void }) {
  const [held, setHeld] = useState<number>();
  const [picked, setPicked] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  // On a phone the panel takes the bottom (held upright) or the left (turned sideways) (Cat, 2026-10-30): a first line-up
  // starts in the space beside it, so no corner lands on the words or buttons.
  // A sheet of paper starts small, beside the panel on a computer, as a sheet would lie on the table.
  const ref = lineUp.ref ?? 'mat';
  const paper = ref !== 'mat';
  useLayoutEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    if (!fresh || !box) return;
    const atBottom = box.bottom >= view.h - 2 && box.top > view.h * 0.3;
    const atLeft = box.left < 40 && box.right < view.w * 0.6;
    const beside = paper && view.w - box.right > 220;
    if (!atBottom && !atLeft && !beside) return;
    const free = atBottom
      ? { left: 0, top: 0, right: view.w, bottom: box.top }
      : atLeft
        ? { left: box.right + 24, top: 0, right: view.w, bottom: view.h }
        : { left: box.right + 16, top: 0, right: view.w, bottom: view.h };
    onSeat({ ...lineUp, corners: startCorners(view.w, view.h, lineUp.mat, free, paper ? (beside && !atLeft ? 0.6 : 0.45) : 0.7) });
    // Only when the screen, the paper or the mat size changes, not on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, ref, view.w, view.h, lineUp.mat.w, lineUp.mat.h]);
  const { corners, mat } = lineUp;
  const pickRef = (r: Ref) => {
    const size = refSize(r, lineUp, unit, fresh);
    // Still untouched, the corners start again at the new size; once dragged, they stay where they were put.
    const l = { ...lineUp, ref: r, mat: size };
    if (fresh) onSeat({ ...l, corners: startCorners(view.w, view.h, size, undefined, r === 'mat' ? 0.7 : 0.35) });
    else onChange(l);
  };
  const ok = convex(corners);
  const h = ok ? matToScreen(lineUp) : undefined;
  const step = unit === 'in' ? IN : 5;
  const move = (i: number, q: P) => onChange({ ...lineUp, corners: corners.map((c, j) => (j === i ? { x: Math.min(view.w, Math.max(0, q.x)), y: Math.min(view.h, Math.max(0, q.y)) } : c)) });

  // Arrow keys nudge the picked corner a pixel at a time (ten with shift), for the last millimetre.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      const k = e.shiftKey ? 10 : 1;
      move(picked, { x: corners[picked].x + d[0] * k, y: corners[picked].y + d[1] * k });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const size = (v: number) => Math.round((unit === 'in' ? v / IN : v) * 10) / 10;
  const setSize = (k: 'w' | 'h', v: string) => {
    const n = Number(v);
    if (n > 0) onChange({ ...lineUp, mat: { ...mat, [k]: unit === 'in' ? n * IN : n } });
  };

  const grid: [P, P][] = [];
  if (h && !paper) {
    for (let x = step; x < mat.w - 0.01; x += step) grid.push([apply(h, { x, y: 0 }), apply(h, { x, y: mat.h })]);
    for (let y = step; y < mat.h - 0.01; y += step) grid.push([apply(h, { x: 0, y }), apply(h, { x: mat.w, y })]);
  }

  return (
    <>
      <svg className="projector-stage" width={view.w} height={view.h}>
        <g className="pj-grid">
          {grid.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>
        <polygon points={pts(corners)} className="pj-quad" />
      </svg>
      <div ref={panel} className="projector-panel pj-lineup">
        <p className="eyebrow">
          Projector mode · line up · 1 of 2 <TestingTag tool="projector" />
        </p>
        <h2>{paper ? 'Drag each corner onto a corner of the paper' : 'Drag each corner onto a corner of your cutting mat'}</h2>
        <p className="muted small">
          {paper
            ? 'Lay one sheet of printer paper flat in the middle of where you will cut. Tap a corner, then nudge it with the arrows below (or your arrow keys) for the last millimetre.'
            : 'Use the grid lines printed on the mat, not its edge. Tap a corner, then nudge it with the arrows below (or your arrow keys) for the last millimetre.'}{' '}
          It is kept for next time on this screen.
        </p>
        <div className="row wrap pj-ref" role="group" aria-label="Line up on">
          {REFS.map(([r, name]) => (
            <button key={r} type="button" aria-pressed={ref === r} className={ref === r ? 'on' : ''} onClick={() => pickRef(r)}>
              {name}
            </button>
          ))}
        </div>
        {!paper && (
          <div className="row wrap pj-mat">
            <span>Mat grid</span>
            <input type="number" inputMode="decimal" aria-label="Mat grid width" value={size(mat.w)} onChange={(e) => setSize('w', e.target.value)} />
            <span>×</span>
            <input type="number" inputMode="decimal" aria-label="Mat grid height" value={size(mat.h)} onChange={(e) => setSize('h', e.target.value)} />
            <span>{unit}</span>
          </div>
        )}
        <div className="row pj-nudge" role="group" aria-label={`Nudge corner ${picked + 1}`}>
          <span className="small muted">Corner {picked + 1}</span>
          {NUDGES.map(([label, d]) => (
            <button key={label} type="button" aria-label={`Nudge ${label}`} onClick={() => move(picked, { x: corners[picked].x + d[0], y: corners[picked].y + d[1] })}>
              {ARROWS[label]}
            </button>
          ))}
        </div>
        {!ok && <p className="small pj-warn">Two corners have crossed over: drag them back so the shape goes round 1, 2, 3, 4.</p>}
        <div className="row wrap">
          <button type="button" className="primary" disabled={!ok} onClick={onNext}>
            Next: check the grid
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {/* The corners sit above the panel, so on a short screen (a phone turned sideways) none is ever hidden under it. */}
      <svg className="projector-stage pj-handles" width={view.w} height={view.h}>
        {corners.map((c, i) => (
          <g
            key={i}
            className={`pj-corner${picked === i ? ' on' : ''}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setHeld(i);
              setPicked(i);
            }}
            onPointerMove={(e) => held === i && move(i, { x: e.clientX, y: e.clientY })}
            onPointerUp={() => setHeld(undefined)}
            onPointerCancel={() => setHeld(undefined)}
          >
            <circle cx={c.x} cy={c.y} r={28} className="pj-hit" />
            <circle cx={c.x} cy={c.y} r={22} className="pj-ring" />
            <circle cx={c.x} cy={c.y} r={4} className="pj-dot" />
            <text x={c.x + (i === 0 || i === 3 ? -38 : 30)} y={c.y + (i < 2 ? -26 : 40)}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}

/** The layer every true-size drawing sits on: the whole screen, drawn in screen pixels from points mapped off the mat. */
function ScreenLayer({ children }: { children: React.ReactNode }) {
  return (
    <svg className="pj-layer" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Step 2: a grid over the whole table (C2, Cat applied 2026-10-30), with a bold 10 cm square (4 in) to check with a ruler. */
function Check({ lineUp, unit, view, onBack, onOk }: { lineUp: LineUp; unit: Unit; view: { w: number; h: number }; onBack: () => void; onOk: () => void }) {
  const h = matToScreen(lineUp);
  if (!h) return null;
  const map = (q: P) => apply(h, q);
  const side = unit === 'in' ? 4 * IN : 10;
  const { w, h: mh } = lineUp.mat;
  const paper = (lineUp.ref ?? 'mat') !== 'mat';
  // Grid lines every 5 cm (2 in) from the mat's corner, so on a mat they land on its own printed lines.
  const step = unit === 'in' ? 2 * IN : 5;
  const area = onScreenArea(h, view.w, view.h, lineUp.mat);
  const grid: [P, P][] = [];
  for (let x = Math.ceil(area.x0 / step) * step; x <= area.x1 + 0.01; x += step) grid.push([map({ x, y: area.y0 }), map({ x, y: area.y1 })]);
  for (let y = Math.ceil(area.y0 / step) * step; y <= area.y1 + 0.01; y += step) grid.push([map({ x: area.x0, y }), map({ x: area.x1, y })]);
  // The square sits on the grid, near the middle.
  const x0 = Math.round((w / 2 - side / 2) / step) * step, y0 = Math.round((mh / 2 - side / 2) / step) * step;
  const tick = unit === 'in' ? IN / 4 : 1;
  const ticks = Math.round(side / tick);
  const k = pxPerCm(map, { x: w / 2, y: mh / 2 });
  const seg = (a: P, b: P, cm: number, key?: number) => {
    const [p, q] = [map(a), map(b)];
    return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="pj-ink" strokeWidth={cm * k} />;
  };
  const box = (x: number, y: number, bw: number, bh: number) =>
    pts(
      [
        { x, y },
        { x: x + bw, y },
        { x: x + bw, y: y + bh },
        { x, y: y + bh },
      ].map(map),
    );
  return (
    <>
      <div className="projector-stage">
        <ScreenLayer>
          {grid.map(([a, b], i) => (
            <line key={`g${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="pj-ink pj-check" strokeWidth={1.5} />
          ))}
          <polygon points={box(0, 0, w, mh)} className="pj-faint" strokeWidth={1} />
          <polygon points={box(x0, y0, side, side)} className="pj-ink" strokeWidth={0.25 * k} />
          {Array.from({ length: ticks + 1 }, (_, i) => seg({ x: x0 + i * tick, y: y0 + side }, { x: x0 + i * tick, y: y0 + side + (i % (ticks / 2) === 0 ? 1.2 : 0.6) }, 0.1, i))}
          <text transform={localMatrix(map, { x: x0 + side / 2, y: y0 - 1 })} className="pj-text" fontSize={1.4} textAnchor="middle">
            {unit === 'in' ? '4 IN' : '10 CM'}
          </text>
        </ScreenLayer>
      </div>
      <div className="projector-panel bottom pj-checking">
        <p className="eyebrow">Line up · 2 of 2</p>
        <h2>
          {paper
            ? `Lay a ruler across the bold square, then along the grid at the far end of the table. Is each square ${unit === 'in' ? '2 in' : '5 cm'}?`
            : "Does every grid line sit on your mat's lines?"}
        </h2>
        <p className="muted small">
          {paper
            ? 'Small errors grow far from the paper. More than a couple of millimetres out? Lay the paper there and line up again.'
            : `Look all over the table, not only the middle, and lay a ruler across the bold ${unit === 'in' ? '4 in' : '10 cm'} square. If one area drifts, go back and nudge the corner nearest to it.`}
        </p>
        <div className="row wrap">
          <button type="button" className="primary" onClick={onOk}>
            Yes: start projecting
          </button>
          <button type="button" className="secondary" onClick={onBack}>
            Not quite: nudge the corners
          </button>
        </div>
      </div>
    </>
  );
}

/** Step 3: one piece at a time at true size, to move and turn on the cloth. */
function Project({ pieces, lineUp, unit, view, onLineUp, onClose }: { pieces: Piece[]; lineUp: LineUp; unit: Unit; view: { w: number; h: number }; onLineUp: () => void; onClose: () => void }) {
  const [which, setWhich] = useState(0);
  const [look, setLookState] = useState<Look>(loadLook);
  const [lines, setLines] = useState(false);
  // The loupe's target: the spot on the screen it magnifies, or none when the loupe is off.
  const [loupe, setLoupe] = useState<P>();
  const [tools, setTools] = useState(true);
  const [places, setPlaces] = useState<Record<number, Placement>>({});
  const drag = useRef<{ mode: 'move' | 'turn' | 'loupe'; from: P; start: Placement; spot?: P } | undefined>(undefined);
  // The tools wrap to several rows on an upright phone: the Lines panel and the loupe keep clear of however tall they are.
  const bar = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(64);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!tools || !el) return setBarH(0);
    const on = () => setBarH(Math.round(el.getBoundingClientRect().height));
    on();
    const watch = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(on);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, [tools]);
  const setLook = (l: Look) => {
    setLookState(l);
    saveLook(l);
  };
  const h = useMemo(() => matToScreen(lineUp), [lineUp]);
  const back = useMemo(() => (h ? invert(h) : undefined), [h]);
  const pc = pieces[which];
  const shape = useMemo(() => {
    if (!pc) return undefined;
    const [x0, y0, x1, y1] = bounds(pc);
    return {
      cut: cutLine(pc),
      stitch: pc.outline.points(),
      lines: pc.lines.map((l) => l.points()),
      mid: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      half: { x: (x1 - x0) / 2, y: (y1 - y0) / 2 },
    };
  }, [pc]);
  if (!pc || !shape || !h || !back) return null;
  const place: Placement = places[which] ?? { at: { x: lineUp.mat.w / 2, y: lineUp.mat.h / 2 }, turn: 0, flip: false };
  const set = (p: Placement) => setPlaces((all) => ({ ...all, [which]: p }));
  // Every point of the piece goes onto the mat, then onto the screen: drawn in screen pixels, so lines stay sharp.
  const onMat = (q: P) => apply(h, q);
  const toScreen = (q: P) => onMat(placePoint(q, shape.mid, place));
  const k = pxPerCm(onMat, place.at);
  const w = (look.mm / 10) * k;
  const show = look.show;
  const line = (ps: P[]) => pts(ps.map(toScreen));
  const dash = (a: number, b: number) => `${(a * k).toFixed(1)} ${(b * k).toFixed(1)}`;

  // The turning dot sits just off the piece's top right corner, and turns with it.
  const r = (place.turn * Math.PI) / 180;
  const off = { x: shape.half.x + 2, y: -shape.half.y - 2 };
  const dot = { x: place.at.x + off.x * Math.cos(r) - off.y * Math.sin(r), y: place.at.y + off.x * Math.sin(r) + off.y * Math.cos(r) };
  const dotOnScreen = onMat(dot);
  const toMatCm = (e: React.PointerEvent) => apply(back, { x: e.clientX, y: e.clientY });
  const angle = (q: P) => (Math.atan2(q.y - place.at.y, q.x - place.at.x) * 180) / Math.PI;

  // The loupe: a round lens beside the spot, three times bigger; the piece itself stays at true size.
  const lensR = Math.max(60, Math.min(150, Math.min(view.w, view.h) * 0.2));
  const lens = loupe && lensAt(loupe, lensR, ZOOM, view.w, view.h, barH);
  const firstNotch = () => {
    const n = pc.notches[0];
    if (n) return toScreen(n[0]);
    const c = shape.cut.map(toScreen);
    return c.reduce((a, b) => (b.x - b.y > a.x - a.y ? b : a), c[0]);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.projector-tools, .projector-show, .pj-pop')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (loupe && Math.hypot(e.clientX - loupe.x, e.clientY - loupe.y) < Math.max(36, lensR / ZOOM + 8)) {
      drag.current = { mode: 'loupe', from: { x: e.clientX, y: e.clientY }, start: place, spot: loupe };
      return;
    }
    const turning = tools && Math.hypot(e.clientX - dotOnScreen.x, e.clientY - dotOnScreen.y) < 36;
    drag.current = { mode: turning ? 'turn' : 'move', from: toMatCm(e), start: place };
  };
  const moveTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'loupe') {
      const x = Math.min(view.w, Math.max(0, d.spot!.x + e.clientX - d.from.x));
      const y = Math.min(view.h, Math.max(0, d.spot!.y + e.clientY - d.from.y));
      setLoupe({ x, y });
      return;
    }
    const q = toMatCm(e);
    if (d.mode === 'move') set({ ...d.start, at: { x: d.start.at.x + q.x - d.from.x, y: d.start.at.y + q.y - d.from.y } });
    else {
      let turn = d.start.turn + angle(q) - angle(d.from);
      turn = ((turn % 360) + 360) % 360;
      // Square to the grain within 2°, so a piece put back straight is exactly straight.
      const square = Math.round(turn / 90) * 90;
      if (Math.abs(turn - square) < 2) turn = square % 360;
      set({ ...d.start, turn: Math.round(turn * 10) / 10 });
    }
  };
  const pick = (i: number) => setWhich((i + pieces.length) % pieces.length);
  const turnText = place.turn ? `Turned ${Math.round(place.turn)}°${place.flip ? ', flipped' : ''}` : place.flip ? 'Flipped' : '';
  // Lines keep their width inside the loupe, so a notch reads sharp at three times the size.
  const keep = 'non-scaling-stroke';

  return (
    <div
      className={`projector-stage${look.dim ? ' pj-dim' : ''}`}
      style={{ '--pj-ink': look.ink } as React.CSSProperties}
      onPointerDown={down}
      onPointerMove={moveTo}
      onPointerUp={() => (drag.current = undefined)}
      onPointerCancel={() => (drag.current = undefined)}
    >
      <ScreenLayer>
        <g id="pj-piece">
          {show.cut && <polygon points={line(shape.cut)} className="pj-ink" strokeWidth={w} strokeLinejoin="round" vectorEffect={keep} />}
          {show.stitch && <polygon points={line(shape.stitch)} className="pj-ink pj-stitch" strokeWidth={Math.max(1, 0.06 * k)} strokeDasharray={dash(0.7, 0.6)} vectorEffect={keep} />}
          {show.inner &&
            shape.lines.map((l, i) => <polyline key={i} points={line(l)} className="pj-ink" strokeWidth={w * 0.7} strokeLinejoin="round" vectorEffect={keep} />)}
          {show.inner &&
            pc.balance?.map((b, i) => <polyline key={`b${i}`} points={line(b.pts)} className="pj-ink pj-stitch" strokeWidth={Math.max(1, 0.05 * k)} strokeDasharray={dash(0.3, 0.3)} vectorEffect={keep} />)}
          {show.grain && pc.grain && <polyline points={line(arrow(pc.grain[0], pc.grain[1]))} className="pj-ink" strokeWidth={w * 0.6} strokeLinejoin="round" vectorEffect={keep} />}
          {show.grain && pc.fold && <polyline points={line(pc.fold)} className="pj-ink" strokeWidth={w * 0.6} strokeDasharray={dash(1.4, 0.8)} vectorEffect={keep} />}
          {show.notches &&
            pc.notches.map(([n, d], i) => (
              <polyline key={`n${i}`} points={line([n, { x: n.x + d.x * (pc.seamAllowance + 0.4), y: n.y + d.y * (pc.seamAllowance + 0.4) }])} className="pj-ink" strokeWidth={w} vectorEffect={keep} />
            ))}
          {show.labels &&
            pc.labels.map((l, i) => (
              <text key={`l${i}`} transform={`${localMatrix(toScreen, l.at)}${l.rotate ? ` rotate(${l.rotate})` : ''}`} fontSize={l.size} className="pj-text" textAnchor="middle">
                {l.text}
              </text>
            ))}
        </g>
        {tools && <circle cx={dotOnScreen.x} cy={dotOnScreen.y} r={0.9 * k} className="pj-turn" strokeWidth={0.2 * k} />}
        {loupe && lens && (
          <g className="pj-loupe">
            <defs>
              <clipPath id="pj-lens">
                <circle cx={lens.x} cy={lens.y} r={lensR} />
              </clipPath>
            </defs>
            <g clipPath="url(#pj-lens)">
              <rect x={lens.x - lensR} y={lens.y - lensR} width={lensR * 2} height={lensR * 2} className="pj-lens-ground" />
              <g transform={`translate(${lens.x} ${lens.y}) scale(${ZOOM}) translate(${-loupe.x} ${-loupe.y})`}>
                <use href="#pj-piece" />
              </g>
            </g>
            <circle cx={lens.x} cy={lens.y} r={lensR} className="pj-lens" strokeWidth={4} />
            <circle cx={loupe.x} cy={loupe.y} r={lensR / ZOOM} className="pj-lens pj-spot" strokeWidth={2.5} />
            <text x={lens.x} y={lens.y + lensR + 24} className="pj-lens-note" textAnchor="middle">
              {ZOOM}× · drag the small ring
            </text>
          </g>
        )}
      </ScreenLayer>
      {tools ? (
        <>
          <p className="eyebrow pj-top">
            Projector mode · true size <TestingTag tool="projector" />
          </p>
          <p className="muted small pj-hint">
            {loupe ? 'Drag the small ring over a notch' : 'Drag to move · drag the dot to turn'}
            {turnText && <span className="pj-turned"> · {turnText}</span>}
          </p>
          {lines && (
            <div
              className="pj-pop"
              role="group"
              aria-label="Lines on the cloth"
              style={{ bottom: barH + 10, maxHeight: `calc(100% - ${barH + 20}px)` }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="eyebrow">Show on the cloth</p>
              {LAYERS.map((l) => (
                <label key={l} className="pj-switch">
                  <input type="checkbox" checked={show[l]} onChange={(e) => setLook({ ...look, show: { ...show, [l]: e.target.checked } })} />
                  <span>{LAYER_NAMES[l]}</span>
                </label>
              ))}
              <p className="eyebrow">Line thickness</p>
              <label className="row pj-thick">
                <input
                  type="range"
                  min={LINE_MM.min}
                  max={LINE_MM.max}
                  step={0.5}
                  value={look.mm}
                  aria-label="Line thickness in millimetres"
                  onChange={(e) => setLook({ ...look, mm: Number(e.target.value) })}
                />
                <span className="pj-turned">{unit === 'in' ? `${(look.mm / 25.4).toFixed(2)} in` : `${look.mm} mm`}</span>
              </label>
              <p className="eyebrow">Line colour</p>
              <div className="row pj-inks">
                {INKS.map((i) => (
                  <button
                    key={i.hex}
                    type="button"
                    aria-label={i.name}
                    aria-pressed={look.ink === i.hex}
                    className={look.ink === i.hex ? 'on' : ''}
                    style={{ background: i.hex }}
                    onClick={() => setLook({ ...look, ink: i.hex })}
                  />
                ))}
              </div>
              <p className="muted small">Pick the colour that shows best on your cloth. Yellow and green read clearest on prints.</p>
              <p className="eyebrow">Background</p>
              <div className="row">
                <button type="button" aria-pressed={!look.dim} className={look.dim ? '' : 'on'} onClick={() => setLook({ ...look, dim: false })}>
                  Black
                </button>
                <button type="button" aria-pressed={look.dim} className={look.dim ? 'on' : ''} onClick={() => setLook({ ...look, dim: true })}>
                  Dim grey
                </button>
                <span className="pj-gap grow" />
                <button type="button" className="on" onClick={() => setLines(false)}>
                  Done
                </button>
              </div>
            </div>
          )}
          <div ref={bar} className="projector-tools" role="toolbar" aria-label="Projector tools">
            <button type="button" aria-label="Previous piece" onClick={() => pick(which - 1)} disabled={pieces.length < 2}>
              ‹
            </button>
            <span className="pj-name">
              {pc.name} <span className="muted">· {which + 1} of {pieces.length}</span>
            </span>
            <button type="button" aria-label="Next piece" onClick={() => pick(which + 1)} disabled={pieces.length < 2}>
              ›
            </button>
            <span className="pj-gap" />
            <button type="button" onClick={() => set({ ...place, turn: (Math.round(place.turn / 90) * 90 + 90) % 360 })}>
              Turn 90°
            </button>
            <button type="button" aria-pressed={place.flip} className={place.flip ? 'on' : ''} onClick={() => set({ ...place, flip: !place.flip })}>
              Flip
            </button>
            <button type="button" aria-expanded={lines} className={lines ? 'on' : ''} onClick={() => setLines(!lines)}>
              Lines
            </button>
            <button type="button" aria-pressed={!!loupe} className={loupe ? 'on' : ''} onClick={() => setLoupe(loupe ? undefined : firstNotch())}>
              Loupe
            </button>
            <span className="pj-gap grow" />
            <button type="button" onClick={onLineUp}>
              Line up again
            </button>
            <button type="button" onClick={() => setTools(false)}>
              Hide tools
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="projector-show" onClick={() => setTools(true)} onPointerDown={(e) => e.stopPropagation()}>
          Show tools
        </button>
      )}
    </div>
  );
}

/** A grain line with a head at each end, as one line to draw: head, shaft, head. */
function arrow(a: P, b: P): P[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  const side = (tip: P, s: number, n: number) => ({ x: tip.x - u.x * s * 1.2 + -u.y * s * 0.5 * n, y: tip.y - u.y * s * 1.2 + u.x * s * 0.5 * n });
  return [side(a, -1.2, 1), a, side(a, -1.2, -1), a, b, side(b, 1.2, 1), b, side(b, 1.2, -1)];
}
