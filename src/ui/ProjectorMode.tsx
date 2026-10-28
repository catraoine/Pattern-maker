import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { P } from '../engine/geometry';
import { Piece, bounds, cutLine } from '../engine/piece';
import { screenKey } from '../engine/scale';
import {
  LINE_CM,
  LineUp,
  LineWeight,
  Placement,
  apply,
  convex,
  invert,
  localMatrix,
  loadLineUp,
  matToScreen,
  placePoint,
  pxPerCm,
  saveLineUp,
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
const WEIGHTS: LineWeight[] = ['thin', 'medium', 'thick'];
// Mats are sold by their marked grid: 60 × 45 cm, or 24 × 18 in.
const START_MAT = { cm: { w: 60, h: 45 }, in: { w: 24 * IN, h: 18 * IN } };

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
    const mat = START_MAT[unit];
    return { mat, corners: startCorners(window.innerWidth, window.innerHeight, mat), screen };
  });
  const [stage, setStage] = useState<Stage>(() => (loadLineUp(screen) ? 'project' : 'corners'));

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
          onChange={setLineUp}
          onNext={() => {
            keep(lineUp);
            setStage('check');
          }}
          onClose={onClose}
        />
      )}
      {stage === 'check' && <Check lineUp={lineUp} unit={unit} onBack={() => setStage('corners')} onOk={() => setStage('project')} />}
      {stage === 'project' && <Project pieces={pieces} lineUp={lineUp} onLineUp={() => setStage('corners')} onClose={onClose} />}
    </div>,
    document.body,
  );
}

/** Step 1: drag the four corners onto the mat's grid. */
function Corners({ lineUp, unit, view, onChange, onNext, onClose }: { lineUp: LineUp; unit: Unit; view: { w: number; h: number }; onChange: (l: LineUp) => void; onNext: () => void; onClose: () => void }) {
  const [held, setHeld] = useState<number>();
  const [picked, setPicked] = useState(0);
  const { corners, mat } = lineUp;
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
  if (h) {
    for (let x = step; x < mat.w - 0.01; x += step) grid.push([apply(h, { x, y: 0 }), apply(h, { x, y: mat.h })]);
    for (let y = step; y < mat.h - 0.01; y += step) grid.push([apply(h, { x: 0, y }), apply(h, { x: mat.w, y })]);
  }

  return (
    <>
      <svg
        className="projector-stage"
        width={view.w}
        height={view.h}
        onPointerMove={(e) => held !== undefined && move(held, { x: e.clientX, y: e.clientY })}
        onPointerUp={() => setHeld(undefined)}
        onPointerCancel={() => setHeld(undefined)}
      >
        <g className="pj-grid">
          {grid.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>
        <polygon points={pts(corners)} className="pj-quad" />
        {corners.map((c, i) => (
          <g
            key={i}
            className={`pj-corner${picked === i ? ' on' : ''}`}
            onPointerDown={(e) => {
              (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
              setHeld(i);
              setPicked(i);
            }}
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
      <div className="projector-panel">
        <p className="eyebrow">
          Projector mode · line up · 1 of 2 <TestingTag tool="projector" />
        </p>
        <h2>Drag each corner onto a corner of your cutting mat</h2>
        <p className="muted small">
          Use the grid lines printed on the mat, not its edge. Tap a corner, then use the arrow keys for the last millimetre. It is kept for
          next time on this screen.
        </p>
        <div className="row wrap pj-mat">
          <span>Mat grid</span>
          <input type="number" inputMode="decimal" aria-label="Mat grid width" value={size(mat.w)} onChange={(e) => setSize('w', e.target.value)} />
          <span>×</span>
          <input type="number" inputMode="decimal" aria-label="Mat grid height" value={size(mat.h)} onChange={(e) => setSize('h', e.target.value)} />
          <span>{unit}</span>
        </div>
        {!ok && <p className="small pj-warn">Two corners have crossed over: drag them back so the shape goes round 1, 2, 3, 4.</p>}
        <div className="row wrap">
          <button type="button" className="primary" disabled={!ok} onClick={onNext}>
            Next: check the {unit === 'in' ? '4 in' : '10 cm'} square
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
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

/** Step 2: a 10 cm square (4 in for inches) to check with a ruler. */
function Check({ lineUp, unit, onBack, onOk }: { lineUp: LineUp; unit: Unit; onBack: () => void; onOk: () => void }) {
  const h = matToScreen(lineUp);
  if (!h) return null;
  const map = (q: P) => apply(h, q);
  const side = unit === 'in' ? 4 * IN : 10;
  const { w, h: mh } = lineUp.mat;
  const x0 = w / 2 - side / 2, y0 = mh / 2 - side / 2;
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
          <polygon points={box(0, 0, w, mh)} className="pj-faint" strokeWidth={1} />
          <polygon points={box(x0, y0, side, side)} className="pj-ink" strokeWidth={0.25 * k} />
          {Array.from({ length: ticks + 1 }, (_, i) => seg({ x: x0 + i * tick, y: y0 + side }, { x: x0 + i * tick, y: y0 + side + (i % (ticks / 2) === 0 ? 1.2 : 0.6) }, 0.1, i))}
          {seg({ x: w / 2, y: y0 + 1.5 }, { x: w / 2, y: y0 + side - 1.5 }, 0.06)}
          {seg({ x: x0 + 1.5, y: mh / 2 }, { x: x0 + side - 1.5, y: mh / 2 }, 0.06)}
          <text transform={localMatrix(map, { x: w / 2, y: y0 - 1 })} className="pj-text" fontSize={1.4} textAnchor="middle">
            {unit === 'in' ? '4 IN' : '10 CM'}
          </text>
        </ScreenLayer>
      </div>
      <div className="projector-panel bottom">
        <p className="eyebrow">Line up · 2 of 2</p>
        <h2>Lay a ruler across the square. Is each side {unit === 'in' ? '4 in' : '10 cm'}?</h2>
        <p className="muted small">Check it both ways. A few millimetres out? Go back and nudge the nearest corner.</p>
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
function Project({ pieces, lineUp, onLineUp, onClose }: { pieces: Piece[]; lineUp: LineUp; onLineUp: () => void; onClose: () => void }) {
  const [which, setWhich] = useState(0);
  const [weight, setWeight] = useState<LineWeight>('thick');
  const [stitch, setStitch] = useState(true);
  const [tools, setTools] = useState(true);
  const [places, setPlaces] = useState<Record<number, Placement>>({});
  const drag = useRef<{ mode: 'move' | 'turn'; from: P; start: Placement } | undefined>(undefined);
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
  const w = LINE_CM[weight] * k;
  const line = (ps: P[]) => pts(ps.map(toScreen));
  const dash = (a: number, b: number) => `${(a * k).toFixed(1)} ${(b * k).toFixed(1)}`;

  // The turning dot sits just off the piece's top right corner, and turns with it.
  const r = (place.turn * Math.PI) / 180;
  const off = { x: shape.half.x + 2, y: -shape.half.y - 2 };
  const dot = { x: place.at.x + off.x * Math.cos(r) - off.y * Math.sin(r), y: place.at.y + off.x * Math.sin(r) + off.y * Math.cos(r) };
  const dotOnScreen = onMat(dot);
  const toMatCm = (e: React.PointerEvent) => apply(back, { x: e.clientX, y: e.clientY });
  const angle = (q: P) => (Math.atan2(q.y - place.at.y, q.x - place.at.x) * 180) / Math.PI;

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.projector-tools, .projector-show')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const turning = tools && Math.hypot(e.clientX - dotOnScreen.x, e.clientY - dotOnScreen.y) < 36;
    drag.current = { mode: turning ? 'turn' : 'move', from: toMatCm(e), start: place };
  };
  const moveTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
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

  return (
    <div className="projector-stage" onPointerDown={down} onPointerMove={moveTo} onPointerUp={() => (drag.current = undefined)} onPointerCancel={() => (drag.current = undefined)}>
      <ScreenLayer>
        <polygon points={line(shape.cut)} className="pj-ink" strokeWidth={w} strokeLinejoin="round" />
        {stitch && <polygon points={line(shape.stitch)} className="pj-ink pj-stitch" strokeWidth={Math.max(1, 0.06 * k)} strokeDasharray={dash(0.7, 0.6)} />}
        {shape.lines.map((l, i) => (
          <polyline key={i} points={line(l)} className="pj-ink" strokeWidth={w * 0.7} strokeLinejoin="round" />
        ))}
        {pc.balance?.map((b, i) => <polyline key={`b${i}`} points={line(b.pts)} className="pj-ink pj-stitch" strokeWidth={Math.max(1, 0.05 * k)} strokeDasharray={dash(0.3, 0.3)} />)}
        {pc.grain && <polyline points={line(arrow(pc.grain[0], pc.grain[1]))} className="pj-ink" strokeWidth={w * 0.6} strokeLinejoin="round" />}
        {pc.fold && <polyline points={line(pc.fold)} className="pj-ink" strokeWidth={w * 0.6} strokeDasharray={dash(1.4, 0.8)} />}
        {pc.notches.map(([n, d], i) => (
          <polyline key={`n${i}`} points={line([n, { x: n.x + d.x * (pc.seamAllowance + 0.4), y: n.y + d.y * (pc.seamAllowance + 0.4) }])} className="pj-ink" strokeWidth={w} />
        ))}
        {pc.labels.map((l, i) => (
          <text key={`l${i}`} transform={`${localMatrix(toScreen, l.at)}${l.rotate ? ` rotate(${l.rotate})` : ''}`} fontSize={l.size} className="pj-text" textAnchor="middle">
            {l.text}
          </text>
        ))}
        {tools && <circle cx={dotOnScreen.x} cy={dotOnScreen.y} r={0.9 * k} className="pj-turn" strokeWidth={0.2 * k} />}
      </ScreenLayer>
      {tools ? (
        <>
          <p className="eyebrow pj-top">
            Projector mode · true size <TestingTag tool="projector" />
          </p>
          <p className="muted small pj-hint">
            Drag to move · drag the dot to turn{turnText && <span className="pj-turned"> · {turnText}</span>}
          </p>
          <div className="projector-tools" role="toolbar" aria-label="Projector tools">
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
            <button type="button" onClick={() => setWeight(WEIGHTS[(WEIGHTS.indexOf(weight) + 1) % WEIGHTS.length])}>
              Lines: {weight}
            </button>
            <button type="button" aria-pressed={stitch} className={stitch ? 'on' : ''} onClick={() => setStitch(!stitch)}>
              Stitching line
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
