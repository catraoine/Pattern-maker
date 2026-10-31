// Move points on the flat pattern (Cat's pick D7 Walk + Ghost + Tape, 2026-10-18): drag any corner, a
// point where curves join, or a dart point; tap an edge to add a point there and pull it into a curve.
// The seam it sews to on the other piece walks with it and darts stay trued (engine/pointEdit.ts). A
// dashed ghost shows the pattern as drafted once anything has moved, and pressing and holding a point
// brings up a tape measure to set what it measures exactly. Anything a move would put out of true is
// trued by the engine, so the editor shows no warnings (Cat's rule, 2026-10-18).
import { PointerEvent, ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { P, add, mul } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import { Handle, PointEdit, applyPointEdits, handlesOf, measureAt, pointOnEdge } from '../engine/pointEdit';
import { pairs } from '../engine/qc';

interface PointEditing {
  /** The garment's own pieces as drafted, before any point is moved. */
  base: Piece[];
  edits: PointEdit[];
  setEdits: (e: PointEdit[]) => void;
}

export const PointEditContext = createContext<PointEditing | null>(null);

/** Pixels per centimetre on the tape, as on the measuring pages' tape. */
const TAPE_PX = 39;
const HOLD_MS = 450;
const GAP = 3;
/** How near a finger has to land to take a point, in screen pixels: about a fingertip (a 44 pt target). */
const HIT_PX = 22;
/** How near an edge a tap adds a point there, in screen pixels. */
const EDGE_PX = 14;
/** How far a finger moves before a press becomes a drag, in screen pixels. */
const SLOP_PX = 3;

/**
 * Watch it draft, under the pattern inside the drawing's own box: as a row of its own under the drawing it spilled out
 * of the pinned drawing on a phone, over the undo arrows and Next (Cat, 2026-10-31).
 */
function WatchDraft({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="watch-draft">
      <button type="button" className="link small" onClick={onPlay}>
        Watch it draft <span aria-hidden="true">▶</span>
      </button>
    </div>
  );
}

/** The pattern view with a Move points switch: the pattern preview, or the editor in its place. */
export function PatternPane({ children, onPlay }: { children: ReactNode; onPlay?: () => void }) {
  const ctx = useContext(PointEditContext);
  const [on, setOn] = useState(false);
  const watch = onPlay && !on && <WatchDraft onPlay={onPlay} />;
  if (!ctx || !ctx.base.length)
    return (
      <>
        {children}
        {watch}
      </>
    );
  return (
    <div className="pattern-pane">
      <div className="row between wrap point-switch">
        <p className="muted small">{on ? 'Drag a point. Press and hold to measure it.' : ctx.edits.length ? 'Points moved on this pattern.' : 'Reshape any piece by moving its points.'}</p>
        <button type="button" className={on ? 'ghost on' : 'ghost'} aria-pressed={on} onClick={() => setOn(!on)}>
          {on ? 'Back to pieces' : 'Move points'}
        </button>
      </div>
      {on ? <PointEditor {...ctx} /> : children}
      {watch}
    </div>
  );
}

/** Each piece's place on the editor: side by side, in rows, tops level. */
function arrange(pieces: Piece[]) {
  const boxes = pieces.map((pc) => {
    const pts = pc.outline.points(12);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
  const total = boxes.reduce((t, b) => t + b.w + GAP, 0);
  const rowMax = Math.max(Math.max(...boxes.map((b) => b.w)), total / Math.ceil(total / 70));
  const at: Record<string, P> = {};
  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  pieces.forEach((pc, i) => {
    const b = boxes[i];
    if (x > 0 && x + b.w > rowMax + 0.01) {
      x = 0;
      y += rowH + GAP * 2;
      rowH = 0;
    }
    at[pc.name] = { x: x - b.x0, y: y - b.y0 };
    x += b.w + GAP;
    rowH = Math.max(rowH, b.h);
    width = Math.max(width, x - GAP);
  });
  return { at, width, height: y + rowH };
}

const pathD = (pc: Piece, o: P) => {
  const pts = pc.outline.points(16);
  return pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x + o.x).toFixed(2)} ${(q.y + o.y).toFixed(2)}`).join('') + 'Z';
};

/** Set one point's move, adding to any it already had. */
function withMove(edits: PointEdit[], piece: string, at: string, by: P): PointEdit[] {
  const i = edits.findIndex((e) => e.piece === piece && e.at === at);
  if (i < 0) return [...edits, { piece, at, by }];
  return edits.map((e, k) => (k === i ? { ...e, by } : e));
}

function PointEditor({ base, edits: saved, setEdits: save }: PointEditing) {
  // While a finger is down the moves stay here, drawn once a frame, and are kept (saved, and passed to the rest of the
  // app) when it lifts: saving on every move redrew the whole app each time, so the point lagged behind the finger.
  const [live, setLive] = useState<PointEdit[]>();
  const edits = live ?? saved;
  const frame = useRef<number>();
  const pending = useRef<PointEdit[]>();
  const setEdits = (e: PointEdit[]) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    pending.current = undefined;
    setLive(undefined);
    save(e);
  };
  const liveMove = (e: PointEdit[]) => {
    pending.current = e;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (pending.current) setLive(pending.current);
    });
  };
  const keep = () => {
    const last = pending.current ?? live;
    if (last) setEdits(last);
  };
  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);
  const pieces = useMemo(() => applyPointEdits(base, edits), [base, edits]);
  const handles = useMemo(() => handlesOf(pieces), [pieces]);
  const { at: place, width, height } = useMemo(() => arrange(base), [base]);
  const m = 3;
  const vb = { x: -m, y: -m, w: width + 2 * m, h: height + 2 * m };
  const r = vb.w / 110;
  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<{ piece: string; at: string }>();
  const [tape, setTape] = useState(false);
  const drag = useRef<{ start: P; edits: PointEdit[]; by: P; piece: string; at: string; timer?: number; moved: boolean; slop: number }>();
  const tapeDrag = useRef<{ x: number; value: number; edits: PointEdit[] }>();

  const partnerOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of pairs(pieces)) {
      map.set(g.front.name, g.back.name);
      map.set(g.back.name, g.front.name);
    }
    return map;
  }, [pieces]);

  /** Centimetres on the pattern per screen pixel, as drawn now. */
  const cmPerPx = () => {
    const m = svg.current?.getScreenCTM();
    return m ? 1 / Math.hypot(m.a, m.b) : r;
  };
  const toCm = (e: PointerEvent): P => {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: q.x, y: q.y };
  };
  const posOf = (h: Handle) => add(h.pos, place[h.piece]);
  const selected = sel && handles.find((h) => h.piece === sel.piece && h.at === sel.at);
  const partner = selected && handles.find((h) => h.piece === partnerOf.get(selected.piece) && h.at === selected.at && h.tags.some((t) => ['side', 'shoulder', 'inseam'].includes(t)));

  const down = (e: PointerEvent<SVGSVGElement>) => {
    const q = toCm(e);
    const px = cmPerPx();
    let best: Handle | undefined;
    let bd = Math.max(r * 4.5, HIT_PX * px);
    for (const h of handles) {
      const d = Math.hypot(posOf(h).x - q.x, posOf(h).y - q.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    let target = best && { piece: best.piece, at: best.at };
    if (!target) {
      // An edge tapped: a new point there.
      for (const pc of pieces) {
        const o = place[pc.name];
        const at = pointOnEdge(pc, { x: q.x - o.x, y: q.y - o.y }, Math.max(r * 2.5, EDGE_PX * px));
        if (at) {
          target = { piece: pc.name, at };
          break;
        }
      }
    }
    if (!target) {
      setSel(undefined);
      setTape(false);
      return;
    }
    const prev = edits.find((x) => x.piece === target!.piece && x.at === target!.at)?.by ?? { x: 0, y: 0 };
    // A new point is kept at once, so it shows; a corner only once it moves.
    const start = target.at.startsWith('+') ? withMove(edits, target.piece, target.at, prev) : edits;
    if (start !== edits) {
      pending.current = start;
      setLive(start);
    }
    setSel(target);
    svg.current?.setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => {
      if (drag.current && !drag.current.moved) {
        drag.current = undefined;
        keep();
        setTape(true);
      }
    }, HOLD_MS);
    drag.current = { start: q, edits: start, by: prev, ...target, timer, moved: false, slop: SLOP_PX * px };
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const g = drag.current;
    if (!g) return;
    const q = toCm(e);
    const d = { x: q.x - g.start.x, y: q.y - g.start.y };
    if (!g.moved && Math.hypot(d.x, d.y) < g.slop) return;
    g.moved = true;
    window.clearTimeout(g.timer);
    liveMove(withMove(g.edits, g.piece, g.at, add(g.by, d)));
  };

  const up = () => {
    if (drag.current) window.clearTimeout(drag.current.timer);
    if (drag.current) keep();
    drag.current = undefined;
  };

  // The tape: what the selected point measures, set by sliding the tape under a fixed needle.
  const measure = selected && measureAt(pieces, selected);
  const setMeasure = (from: PointEdit[], value: number, sliding = false) => {
    if (!sel) return;
    let next = from;
    // Two passes, as a curve's length is not quite proportional to the move.
    for (let k = 0; k < 2; k++) {
      const now = applyPointEdits(base, next);
      const h = handlesOf(now).find((x) => x.piece === sel.piece && x.at === sel.at);
      const mm = h && measureAt(now, h);
      if (!mm) break;
      const by = next.find((x) => x.piece === sel.piece && x.at === sel.at)?.by ?? { x: 0, y: 0 };
      next = withMove(next, sel.piece, sel.at, add(by, mul(mm.dir, value - mm.value)));
    }
    if (sliding) liveMove(next);
    else setEdits(next);
  };

  const changed = edits.some((e) => e.at.startsWith('+') || Math.hypot(e.by.x, e.by.y) > 0.01);
  const offset = measure && measure.value * TAPE_PX;

  return (
    <div className="point-editor">
      <svg
        ref={svg}
        className="preview-svg point-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="application"
        aria-label="Pattern pieces with points to drag. Tap an edge to add a point."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {pieces.map((pc) => (
          <g key={pc.name}>
            <path d={pathD(pc, place[pc.name])} className="pe-piece" vectorEffect="non-scaling-stroke" />
            {pc.lines.map((ln, i) => (
              <polyline key={i} points={ln.points(8).map((q) => `${q.x + place[pc.name].x},${q.y + place[pc.name].y}`).join(' ')} className="pe-line" vectorEffect="non-scaling-stroke" />
            ))}
            <text x={place[pc.name].x + (pc.labels[0]?.at.x ?? 0)} y={place[pc.name].y + (pc.labels[0]?.at.y ?? 0)} fontSize={vb.w / 45} textAnchor="middle" className="pe-name">
              {pc.name.toUpperCase()}
            </text>
          </g>
        ))}
        {changed && base.map((pc) => <path key={pc.name} d={pathD(pc, place[pc.name])} className="pe-ghost" vectorEffect="non-scaling-stroke" />)}
        {handles.map((h) => {
          const at = posOf(h);
          const isSel = selected === h;
          const isPartner = partner === h;
          return <circle key={`${h.piece}/${h.at}`} data-piece={h.piece} data-at={h.at} cx={at.x} cy={at.y} r={isSel ? r * 1.5 : r} className={`pe-point${isSel ? ' on' : ''}${isPartner ? ' partner' : ''}${h.kind === 'dart' ? ' dart' : ''}`} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>

      {tape && measure && (
        <div className="pe-sheet">
          <div className="row between">
            <span className="pe-label">{measure.label}</span>
            <strong className="pe-value" role="status">
              {measure.value.toFixed(1)} cm
            </strong>
          </div>
          <div
            className="pe-tape"
            role="slider"
            aria-label={`${measure.label}, slide the tape to change it`}
            aria-valuenow={Math.round(measure.value * 10) / 10}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setMeasure(edits, measure.value + 0.1);
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setMeasure(edits, measure.value - 0.1);
            }}
            onPointerDown={(e) => {
              tapeDrag.current = { x: e.clientX, value: measure.value, edits };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const t = tapeDrag.current;
              if (t) setMeasure(t.edits, Math.max(0.5, t.value - (e.clientX - t.x) / TAPE_PX), true);
            }}
            onPointerUp={() => {
              if (tapeDrag.current) keep();
              tapeDrag.current = undefined;
            }}
            onPointerCancel={() => {
              if (tapeDrag.current) keep();
              tapeDrag.current = undefined;
            }}
          >
            <div className="pe-tape-marks" style={{ transform: `translateX(${-(offset ?? 0)}px)` }} aria-hidden="true">
              {Array.from({ length: Math.ceil(measure.value) + 12 }, (_, c) => (
                <span key={c} style={{ left: c * TAPE_PX }}>
                  {c}
                </span>
              ))}
            </div>
            <div className="pe-needle" aria-hidden="true" />
          </div>
          <div className="row">
            <button type="button" className="ghost" onClick={() => setMeasure(edits, measure.value - 0.1)}>
              − 1 mm
            </button>
            <button type="button" className="ghost" onClick={() => setMeasure(edits, measure.value + 0.1)}>
              + 1 mm
            </button>
            <button type="button" className="ghost pe-done" onClick={() => setTape(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {changed && (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setEdits([]);
            setSel(undefined);
            setTape(false);
          }}
        >
          Back to original
        </button>
      )}
    </div>
  );
}
