// Move points on the flat pattern (Cat's pick D7 Walk + Ghost + Tape, 2026-10-18): drag any corner, a
// point where curves join, or a dart point; tap an edge to add a point there and pull it into a curve.
// The seam it sews to on the other piece walks with it and darts stay trued (engine/pointEdit.ts). A
// dashed ghost shows the pattern as drafted once anything has moved, and pressing and holding a point
// brings up a tape measure to set what it measures exactly. Anything a move would put out of true is
// trued by the engine, so the editor shows no warnings (Cat's rule, 2026-10-18).
// Draw a line (Design: Pattern tools, Cat's pick P2, 2026-11-07): a line drawn across a piece, started away from its
// points, asks what it should do: spread the piece open (flare), add fullness (gathers or pleats) or make a new piece
// (engine/pieceEdit.ts). A spread or fullness opens by dragging the handle at its far end, or with the slider.
import { PointerEvent, ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestingTag } from './TestingTag';
import { DemoButton } from './DemoButton';
import { InCorner } from './StyleLayout';
import { P, add, len, mul, sub } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import { CutEdit, CutKind, DartEdit, PatternEdit, START_BY, applyPatternEdits, cutEnds, cutMark, dartMoveTo, isCut, isDartMove, openHandle, pointsOn } from '../engine/pieceEdit';
import { Handle, PointEdit, handlesOf, measureAt, pointOnEdge } from '../engine/pointEdit';
import { pairs } from '../engine/qc';

interface PointEditing {
  /** The garment's own pieces as drafted, before any point is moved. */
  base: Piece[];
  edits: PatternEdit[];
  setEdits: (e: PatternEdit[]) => void;
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
/** The most a spread or fullness opens, in cm. */
const MAX_OPEN = 40;

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
  // Move points is one of the drawing's corner tools, a plain word like Enlarge (Cat, Nov 8: the Draw word, the long
  // how-to line and the boxed button were confusing together). Its how-to line shows once it is open.
  return (
    <div className="pattern-pane">
      {on ? (
        <InCorner>
          <button type="button" className="link small pe-open-tool on" aria-pressed="true" onClick={() => setOn(false)}>
            <span className="tool-word">Back to pieces</span>
          </button>
        </InCorner>
      ) : (
        <>
          <InCorner>
            <button type="button" className="link small pe-open-tool" aria-pressed="false" onClick={() => setOn(true)}>
              <span className="tool-word">Move points</span>
            </button>
          </InCorner>
          {ctx.edits.length > 0 && (
            <div className="row between wrap point-switch">
              <p className="muted small pe-edited">
                Edited by you <TestingTag tool="pattern_tools" />
              </p>
            </div>
          )}
        </>
      )}
      {on ? <PointEditor {...ctx} /> : children}
      {/* Its own Watch demo while the tools are open (Cat, 2026-11-07), with the how-to line beside it, small, under the
          pieces (Cat, Nov 8: tidy the open tool's top). */}
      {on && (
        <div className="demo-inline">
          <p className="muted small pe-howto">Drag a point, draw a line across a piece to cut it, or tap a cut to change it.</p>
          <DemoButton demo="patterns" />
        </div>
      )}
      {watch}
    </div>
  );
}

/** Each piece's place on the editor: side by side, in rows, tops level. */
function arrange(pieces: Piece[], rowWidth?: number) {
  const boxes = pieces.map((pc) => {
    const pts = pc.outline.points(12);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
  const total = boxes.reduce((t, b) => t + b.w + GAP, 0);
  const rowMax = rowWidth ?? Math.max(Math.max(...boxes.map((b) => b.w)), total / Math.ceil(total / 70));
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

/** A point's move, not a cut or a dart moved. */
const isPoint = (e: PatternEdit): e is PointEdit => !isCut(e) && !isDartMove(e);

/** Set one point's move, adding to any it already had. */
function withMove(edits: PatternEdit[], piece: string, at: string, by: P): PatternEdit[] {
  const i = edits.findIndex((e) => isPoint(e) && e.piece === piece && e.at === at);
  if (i < 0) return [...edits, { piece, at, by }];
  return edits.map((e, k) => (k === i && isPoint(e) ? { ...e, by } : e));
}

/** How near the edge a line from a dart point must end to move the dart there, in cm. */
const DART_EDGE = 2;

function PointEditor({ base, edits: saved, setEdits: save }: PointEditing) {
  // While a finger is down the moves stay here, drawn once a frame, and are kept (saved, and passed to the rest of the
  // app) when it lifts: saving on every move redrew the whole app each time, so the point lagged behind the finger.
  const [live, setLive] = useState<PatternEdit[]>();
  const edits = live ?? saved;
  const frame = useRef<number>();
  const pending = useRef<PatternEdit[]>();
  const setEdits = (e: PatternEdit[]) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    pending.current = undefined;
    setLive(undefined);
    save(e);
  };
  const liveMove = (e: PatternEdit[]) => {
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
  const pieces = useMemo(() => applyPatternEdits(base, edits), [base, edits]);
  const handles = useMemo(() => handlesOf(pieces), [pieces]);
  // Laid out from the pattern as drafted with its cuts kept so far (not its moved points), so the pieces hold still
  // under a finger and the view doesn't rescale as a point moves; a spread piece or a new one makes room.
  const cutsKept = JSON.stringify(saved.filter((e) => isCut(e) || isDartMove(e)));
  const kept = useMemo(() => applyPatternEdits(base, JSON.parse(cutsKept) as PatternEdit[]), [base, cutsKept]);
  // The rows are as wide as the drafted pieces' rows, with room for a spread piece to widen in its row.
  const { at: place, width, height } = useMemo(() => arrange([...kept.filter((pc) => !pc.meta.newPiece), ...kept.filter((pc) => pc.meta.newPiece)], arrange(base).width * 1.6), [kept, base]);
  const m = 3;
  const vb = { x: -m, y: -m, w: width + 2 * m, h: height + 2 * m };
  const r = vb.w / 110;
  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<{ piece: string; at: string }>();
  const [tape, setTape] = useState(false);
  const drag = useRef<{ start: P; edits: PatternEdit[]; before: PatternEdit[]; by: P; piece: string; at: string; timer?: number; moved: boolean; slop: number; path: P[]; shapes: Piece[] }>();
  const tapeDrag = useRef<{ x: number; value: number; edits: PatternEdit[] }>();
  // Draw a line: the line as it is drawn (on the editor, in cm), the line waiting for its choice, and the cut being set.
  const [stroke, setStroke] = useState<P[]>();
  const strokeRef = useRef<P[]>();
  const [asking, setAsking] = useState<{ piece: string; line: P[]; dart?: DartEdit }>();
  /** A line being drawn that was started on a dart point: the dart, to offer moving it where the line ends (round 4). */
  const strokeDart = useRef<{ piece: string; k: number; tip: P }>();
  const [active, setActive] = useState<number>();
  const openDrag = useRef<{ start: P; by: number; opens: P; edits: PatternEdit[]; i: number }>();
  const cutAt = active !== undefined && isCut(edits[active]) ? (edits[active] as CutEdit) : undefined;
  /** The pieces as they were just before the cut being set, where its handle is worked out. */
  const beforeCut = useMemo(() => (active !== undefined ? applyPatternEdits(base, edits.slice(0, active)) : undefined), [base, edits, active]);
  const handle = cutAt && beforeCut && openHandle(beforeCut, cutAt);
  const handleAt = handle && place[cutAt!.piece] && add(handle.at, place[cutAt!.piece]);
  const withCut = (from: PatternEdit[], i: number, change: Partial<CutEdit>) => from.map((e, k) => (k === i && isCut(e) ? { ...e, ...change } : e));
  // Every cut kept so far has a mark on its line, to tap to change it or take it out (round 3): where it is, on the
  // pieces as they were just before that cut.
  const marks = useMemo(
    () =>
      edits.flatMap((e, i) => {
        if (!isCut(e) || !place[e.piece]) return [];
        const m = cutMark(applyPatternEdits(base, edits.slice(0, i)), e);
        return m ? [{ i, at: add(m.at, place[e.piece]), ends: m.ends.map((q) => add(q, place[e.piece])) as [P, P], line: m.line.map((q) => add(q, place[e.piece])) }] : [];
      }),
    [base, edits, place],
  );
  const activeMark = active !== undefined ? marks.find((mk) => mk.i === active) : undefined;
  const endDrag = useRef<{ start: P; k: 0 | 1; line: P[]; edits: PatternEdit[]; i: number }>();
  // A dart just moved (round 4): its place in the edits, to put it back.
  const [dartMoved, setDartMoved] = useState<number>();

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

  /** Whether a finger's path is a line across a piece: most of it lies on one piece, and it reaches at least half way
   *  across that piece along the line it draws. Dragging a point off the piece, or a dart point a little way, isn't. */
  const lineAcross = (path: P[], shapes: Piece[]) => {
    if (path.length < 3) return false;
    const drawn = len(sub(path[path.length - 1], path[0]));
    if (drawn < 3) return false;
    // (Read on the pieces as they were when the finger went down: the point being dragged pulls its piece along.)
    for (const pc of shapes) {
      const o = place[pc.name];
      if (!o) continue;
      const own = path.map((q) => ({ x: q.x - o.x, y: q.y - o.y }));
      if (pointsOn(pc, own) * 3 < own.length * 2) continue;
      const ends = cutEnds(pc, own);
      if (ends && drawn >= len(sub(ends.far, ends.hinge)) * 0.5) return true;
    }
    return false;
  };

  /** The dart move a line from a dart point offers: where it ends is on (or by) the piece's edge, outside the dart. */
  const dartOffer = (shapes: Piece[], piece: string, k: number, tip: P, end: P): DartEdit | undefined => {
    const pc = shapes.find((x) => x.name === piece);
    const o = place[piece];
    if (!pc || !o) return undefined;
    const own = sub(end, o);
    const pts = pc.outline.points(16);
    const near = Math.min(
      ...pts.map((v, i) => {
        const dd = sub(pts[(i + 1) % pts.length], v);
        const t = Math.max(0, Math.min(1, ((own.x - v.x) * dd.x + (own.y - v.y) * dd.y) / (dd.x * dd.x + dd.y * dd.y || 1)));
        return len(sub(own, add(v, mul(dd, t))));
      }),
    );
    if (near > Math.max(DART_EDGE, EDGE_PX * cmPerPx()) || !dartMoveTo(pc, k, own)) return undefined;
    const r2 = (q: P) => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 });
    return { moveDart: k, piece, from: r2(sub(tip, o)), to: r2(own) };
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    setDartMoved(undefined);
    strokeDart.current = undefined;
    const q = toCm(e);
    const px = cmPerPx();
    // The handle at the far end of a spread or fullness being set: dragging it opens the cut.
    if (handle && handleAt && cutAt && active !== undefined && len(sub(handleAt, q)) < Math.max(r * 5, HIT_PX * px)) {
      openDrag.current = { start: q, by: cutAt.by, opens: handle.opens, edits, i: active };
      svg.current?.setPointerCapture(e.pointerId);
      return;
    }
    // The ends of the cut being changed: dragging one moves the line.
    if (activeMark && cutAt && active !== undefined) {
      const k = activeMark.ends.findIndex((end) => len(sub(end, q)) < Math.max(r * 4, HIT_PX * px));
      if (k === 0 || k === 1) {
        const own = cutAt.line.map((q) => ({ ...q }));
        // The end taken is set on the edge it meets, so the line starts where its handle is.
        own[k === 0 ? 0 : own.length - 1] = sub(activeMark.ends[k], place[cutAt.piece]);
        endDrag.current = { start: q, k, line: own, edits, i: active };
        svg.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    // A cut's mark tapped: that cut opens to change it or take it out.
    const hitMark = marks.find((mk) => len(sub(mk.at, q)) < Math.max(r * 3.5, HIT_PX * px));
    if (hitMark) {
      setSel(undefined);
      setTape(false);
      setAsking(undefined);
      setActive(hitMark.i);
      return;
    }
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
      // Away from every point and edge: a line is drawn.
      setSel(undefined);
      setTape(false);
      setAsking(undefined);
      strokeRef.current = [q];
      setStroke([q]);
      svg.current?.setPointerCapture(e.pointerId);
      return;
    }
    const prev = (edits.find((x) => isPoint(x) && x.piece === target!.piece && x.at === target!.at) as PointEdit | undefined)?.by ?? { x: 0, y: 0 };
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
    drag.current = { start: q, edits: start, before: edits, by: prev, ...target, timer, moved: false, slop: SLOP_PX * px, path: [q], shapes: pieces };
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const ed = endDrag.current;
    if (ed) {
      const q = toCm(e);
      const d = sub(q, ed.start);
      const n = ed.line.length - 1 || 1;
      // The end taken moves with the finger; a drawn line bends along with it, less toward its other end.
      const line = ed.line.map((pt, j) => add(pt, mul(d, ed.k === 0 ? 1 - j / n : j / n))).map((pt) => ({ x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 }));
      liveMove(withCut(ed.edits, ed.i, { line }));
      return;
    }
    const o = openDrag.current;
    if (o) {
      const q = toCm(e);
      const by = Math.max(0, Math.min(MAX_OPEN, o.by + (q.x - o.start.x) * o.opens.x + (q.y - o.start.y) * o.opens.y));
      liveMove(withCut(o.edits, o.i, { by: Math.round(by * 10) / 10 }));
      return;
    }
    const line = strokeRef.current;
    if (line) {
      const q = toCm(e);
      if (len(sub(q, line[line.length - 1])) > cmPerPx() * 3) {
        strokeRef.current = [...line, q];
        setStroke(strokeRef.current);
      }
      return;
    }
    const g = drag.current;
    if (!g) return;
    const q = toCm(e);
    const d = { x: q.x - g.start.x, y: q.y - g.start.y };
    if (!g.moved && Math.hypot(d.x, d.y) < g.slop) return;
    g.moved = true;
    window.clearTimeout(g.timer);
    g.path.push(q);
    // A press that landed on or by a point but carries on across the piece is a line, not a move (Cat: starting a line
    // near a point moved the point): once the finger has drawn most of the way across a piece, the point goes back and
    // the line is drawn from where the finger went down.
    if (lineAcross(g.path, g.shapes)) {
      drag.current = undefined;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = undefined;
      pending.current = undefined;
      setLive(g.before === saved ? undefined : g.before);
      if (g.at.startsWith('dart')) strokeDart.current = { piece: g.piece, k: Number(g.at.slice(4)), tip: g.path[0] };
      strokeRef.current = g.path;
      setStroke(g.path);
      setSel(undefined);
      return;
    }
    // A dart point dragged: the line from it shows, as a line drawn to an edge moves the dart there (round 4).
    if (g.at.startsWith('dart')) setStroke([g.path[0], q]);
    liveMove(withMove(g.edits, g.piece, g.at, add(g.by, d)));
  };

  const up = () => {
    if (endDrag.current) {
      endDrag.current = undefined;
      keep();
      return;
    }
    if (openDrag.current) {
      openDrag.current = undefined;
      keep();
      return;
    }
    const line = strokeRef.current;
    if (line) {
      strokeRef.current = undefined;
      setStroke(undefined);
      // The piece the line cuts: the one most of the drawn line lies on (carried on to its edges, the line would also
      // cross a piece beside it), on that piece's own centimetres.
      let best: { piece: string; line: P[]; on: number } | undefined;
      for (const pc of pieces) {
        const o = place[pc.name];
        if (!o) continue;
        const own = line.map((q) => ({ x: q.x - o.x, y: q.y - o.y }));
        const on = pointsOn(pc, own);
        if (on && cutEnds(pc, own, false) && (!best || on > best.on)) best = { piece: pc.name, line: own, on };
      }
      const drawn = line.slice(1).reduce((t, q, i) => t + len(sub(q, line[i])), 0);
      const sd = strokeDart.current;
      strokeDart.current = undefined;
      const dart = sd && dartOffer(pieces, sd.piece, sd.k, sd.tip, line[line.length - 1]);
      if (best && drawn > 2) {
        setActive(undefined);
        setAsking({ piece: best.piece, line: best.line.map((q) => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 })), ...(dart && dart.piece === best.piece ? { dart } : {}) });
      }
      return;
    }
    if (drag.current) window.clearTimeout(drag.current.timer);
    const g = drag.current;
    drag.current = undefined;
    // A dart point dragged out to the edge, away from the dart: the line asks what it should do, moving the dart there
    // first (round 4), as a cutter pivots it.
    if (g && g.moved && g.at.startsWith('dart')) {
      setStroke(undefined);
      const dart = dartOffer(g.shapes, g.piece, Number(g.at.slice(4)), g.path[0], g.path[g.path.length - 1]);
      if (dart) {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = undefined;
        pending.current = undefined;
        setLive(g.before === saved ? undefined : g.before);
        setSel(undefined);
        setActive(undefined);
        setAsking({ piece: g.piece, line: [dart.from, dart.to], dart });
        return;
      }
    }
    if (g) keep();
  };

  // The tape: what the selected point measures, set by sliding the tape under a fixed needle.
  const measure = selected && measureAt(pieces, selected);
  const setMeasure = (from: PatternEdit[], value: number, sliding = false) => {
    if (!sel) return;
    let next = from;
    // Two passes, as a curve's length is not quite proportional to the move.
    for (let k = 0; k < 2; k++) {
      const now = applyPatternEdits(base, next);
      const h = handlesOf(now).find((x) => x.piece === sel.piece && x.at === sel.at);
      const mm = h && measureAt(now, h);
      if (!mm) break;
      const by = (next.find((x) => isPoint(x) && x.piece === sel.piece && x.at === sel.at) as PointEdit | undefined)?.by ?? { x: 0, y: 0 };
      next = withMove(next, sel.piece, sel.at, add(by, mul(mm.dir, value - mm.value)));
    }
    if (sliding) liveMove(next);
    else setEdits(next);
  };

  const changed = edits.some((e) => !isPoint(e) || e.at.startsWith('+') || Math.hypot(e.by.x, e.by.y) > 0.01);

  /** The line's choice made: the cut is kept, and a spread or fullness stays open to set how far. */
  const choose = (cut: CutKind) => {
    if (!asking) return;
    const e: CutEdit = { cut, piece: asking.piece, line: asking.line, by: cut === 'piece' ? 0 : START_BY[cut], ...(cut === 'piece' ? {} : { finish: 'gathers' as const }) };
    const next = [...edits, e];
    setAsking(undefined);
    setEdits(next);
    setActive(next.length - 1);
  };
  /** The line's dart move chosen: the dart moves where the line ends. */
  const chooseDart = () => {
    if (!asking?.dart) return;
    const next = [...edits, asking.dart];
    setAsking(undefined);
    setEdits(next);
    setDartMoved(next.length - 1);
  };
  /** Whether the dart just moved closed into a hem (flare) rather than opening again. */
  const dartGone = useMemo(() => {
    if (dartMoved === undefined || !isDartMove(edits[dartMoved])) return false;
    const name = (edits[dartMoved] as DartEdit).piece;
    const count = (pcs: Piece[]) => pcs.find((pc) => pc.name === name)?.lines.filter((ln) => ln.segs.length === 2).length ?? 0;
    return count(applyPatternEdits(base, edits.slice(0, dartMoved + 1))) < count(applyPatternEdits(base, edits.slice(0, dartMoved)));
  }, [base, edits, dartMoved]);
  /** The new piece a cut made: the piece in the pattern that came off this cut's piece last. */
  const madePiece = cutAt?.cut === 'piece' ? pieces.filter((pc) => pc.meta.cutFrom === cutAt.piece && !(beforeCut ?? []).some((x) => x.name === pc.name)).pop() : undefined;
  const offset = measure && measure.value * TAPE_PX;

  return (
    <div className="point-editor">
      <svg
        ref={svg}
        className="preview-svg point-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="application"
        aria-label="Pattern pieces with points to drag. Tap an edge to add a point, or draw a line across a piece to cut it."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {pieces.filter((pc) => place[pc.name]).map((pc) => (
          <g key={pc.name}>
            <path d={pathD(pc, place[pc.name])} className="pe-piece" data-piece={pc.name} vectorEffect="non-scaling-stroke" />
            {pc.lines.map((ln, i) => (
              <polyline key={i} points={ln.points(8).map((q) => `${q.x + place[pc.name].x},${q.y + place[pc.name].y}`).join(' ')} className="pe-line" vectorEffect="non-scaling-stroke" />
            ))}
            <text x={place[pc.name].x + (pc.labels[0]?.at.x ?? 0)} y={place[pc.name].y + (pc.labels[0]?.at.y ?? 0)} fontSize={vb.w / 45} textAnchor="middle" className="pe-name">
              {pc.name.toUpperCase()}
            </text>
          </g>
        ))}
        {changed && base.map((pc) => place[pc.name] && <path key={pc.name} d={pathD(pc, place[pc.name])} className="pe-ghost" vectorEffect="non-scaling-stroke" />)}
        {stroke && stroke.length > 1 && <polyline points={stroke.map((q) => `${q.x},${q.y}`).join(' ')} className="pe-stroke" vectorEffect="non-scaling-stroke" />}
        {asking && <polyline points={asking.line.map((q) => `${q.x + place[asking.piece].x},${q.y + place[asking.piece].y}`).join(' ')} className="pe-stroke" vectorEffect="non-scaling-stroke" />}
        {activeMark && <polyline points={activeMark.line.map((q) => `${q.x},${q.y}`).join(' ')} className="pe-cutline" vectorEffect="non-scaling-stroke" />}
        {marks.map((mk) => (
          <rect key={mk.i} data-cut={mk.i} x={mk.at.x - r * 1.3} y={mk.at.y - r * 1.3} width={r * 2.6} height={r * 2.6} transform={`rotate(45 ${mk.at.x} ${mk.at.y})`} className={`pe-cut${mk.i === active ? ' on' : ''}`} vectorEffect="non-scaling-stroke" />
        ))}
        {activeMark && activeMark.ends.map((q, k) => <circle key={k} cx={q.x} cy={q.y} r={r * 1.4} className="pe-end" data-end={k} vectorEffect="non-scaling-stroke" />)}
        {handleAt && <circle cx={handleAt.x} cy={handleAt.y} r={r * 1.8} className="pe-open" data-open="far" vectorEffect="non-scaling-stroke" />}
        {handles.filter((h) => place[h.piece]).map((h) => {
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

      {asking && (
        <div className="pe-sheet pe-ask" role="group" aria-label="What should this line do?">
          <span className="pe-label">What should this line do?</span>
          {asking.dart && (
            <button type="button" className="ghost" onClick={chooseDart}>
              Move the dart here
            </button>
          )}
          <button type="button" className="ghost" onClick={() => choose('spread')}>
            Spread it open · flare
          </button>
          <button type="button" className="ghost" onClick={() => choose('fullness')}>
            Add fullness · gathers or pleats
          </button>
          <button type="button" className="ghost" onClick={() => choose('piece')}>
            Make a new piece
          </button>
          <button type="button" className="link small" onClick={() => setAsking(undefined)}>
            Cancel
          </button>
        </div>
      )}

      {cutAt && active !== undefined && cutAt.cut !== 'piece' && (
        <div className="pe-sheet" role="group" aria-label={cutAt.cut === 'spread' ? 'Spread it open' : 'Add fullness'}>
          <div className="row between">
            <span className="pe-label">{cutAt.cut === 'spread' ? 'Opens by' : 'Adds'}</span>
            <strong className="pe-value" role="status">
              {cutAt.by.toFixed(1)} cm
            </strong>
          </div>
          <input
            id="pe-open"
            type="range"
            min={0}
            max={MAX_OPEN}
            step={0.5}
            value={cutAt.by}
            aria-label={cutAt.cut === 'spread' ? 'How far it opens, in cm' : 'How much fullness it adds, in cm'}
            onChange={(e) => liveMove(withCut(edits, active, { by: Number(e.target.value) }))}
            onPointerUp={keep}
            onKeyUp={keep}
          />
          <p className="muted small">Drag the round handle on the piece, or slide. Drag either end of the line to move it.</p>
          <div className="row wrap">
            {(['gathers', 'pleats'] as const).map((f) => (
              <button key={f} type="button" className={(cutAt.finish ?? 'gathers') === f ? 'ghost on' : 'ghost'} aria-pressed={(cutAt.finish ?? 'gathers') === f} onClick={() => setEdits(withCut(edits, active, { finish: f }))}>
                {f === 'gathers' ? 'Gathers' : 'Pleats'}
              </button>
            ))}
          </div>
          <div className="row wrap pe-kind" role="group" aria-label="What this cut does">
            {(['spread', 'fullness', 'piece'] as const).map((k) => (
              <button key={k} type="button" className={cutAt.cut === k ? 'ghost on' : 'ghost'} aria-pressed={cutAt.cut === k} onClick={() => cutAt.cut !== k && setEdits(withCut(edits, active, { cut: k, by: k === 'piece' ? 0 : cutAt.by || START_BY[k], finish: k === 'piece' ? undefined : (cutAt.finish ?? 'gathers') }))}>
                {k === 'spread' ? 'Spread' : k === 'fullness' ? 'Fullness' : 'New piece'}
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="ghost" onClick={() => {
              setEdits(edits.filter((_, k) => k !== active));
              setActive(undefined);
            }}>
              Take this cut out
            </button>
            <button type="button" className="ghost pe-done" onClick={() => setActive(undefined)}>
              Done
            </button>
          </div>
        </div>
      )}

      {cutAt && active !== undefined && cutAt.cut === 'piece' && (
        <div className="pe-sheet" role="group" aria-label="New piece">
          <label className="pe-label" htmlFor="pe-name">
            New piece: its name
          </label>
          <input id="pe-name" type="text" maxLength={40} placeholder={madePiece?.name ?? 'New piece'} defaultValue={cutAt.name ?? ''} onBlur={(e) => e.target.value.trim() !== (cutAt.name ?? '') && setEdits(withCut(edits, active, { name: e.target.value.trim() || undefined }))} />
          <p className="muted small">Sewn to the piece it came off, notch to notch{madePiece?.meta.dartsClosed ? '; its darts are closed into it' : ''}. Drag either end of the line to move it.</p>
          <div className="row wrap pe-kind" role="group" aria-label="What this cut does">
            {(['spread', 'fullness', 'piece'] as const).map((k) => (
              <button key={k} type="button" className={cutAt.cut === k ? 'ghost on' : 'ghost'} aria-pressed={cutAt.cut === k} onClick={() => cutAt.cut !== k && setEdits(withCut(edits, active, { cut: k, by: k === 'piece' ? 0 : cutAt.by || START_BY[k], finish: k === 'piece' ? undefined : (cutAt.finish ?? 'gathers') }))}>
                {k === 'spread' ? 'Spread' : k === 'fullness' ? 'Fullness' : 'New piece'}
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="ghost" onClick={() => {
              setEdits(edits.filter((_, k) => k !== active));
              setActive(undefined);
            }}>
              Take this cut out
            </button>
            <button type="button" className="ghost pe-done" onClick={() => setActive(undefined)}>
              Done
            </button>
          </div>
        </div>
      )}

      {dartMoved !== undefined && isDartMove(edits[dartMoved]) && (
        <div className="pe-sheet" role="group" aria-label="Dart moved">
          <span className="pe-label">Dart moved</span>
          <p className="muted small">{dartGone ? 'Closed, and the hem flares where you drew instead.' : 'It opens where you drew to. Drag from its point to another edge to move it again.'}</p>
          <div className="row">
            <button type="button" className="ghost" onClick={() => {
              setEdits(edits.filter((_, k) => k !== dartMoved));
              setDartMoved(undefined);
            }}>
              Put it back
            </button>
            <button type="button" className="ghost pe-done" onClick={() => setDartMoved(undefined)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Always laid out, shown once something has changed: appearing under a finger mid-stroke, it grew the page and
          the pinned drawing eased under the finger, so a line being drawn jumped (round 3). */}
      {(
        <button
          type="button"
          className="ghost"
          hidden={!changed}
          style={changed ? undefined : { display: 'block', visibility: 'hidden' }}
          aria-hidden={!changed || undefined}
          tabIndex={changed ? undefined : -1}
          onClick={() => {
            setEdits([]);
            setSel(undefined);
            setTape(false);
            setAsking(undefined);
            setActive(undefined);
            setDartMoved(undefined);
          }}
        >
          Back to drafted
        </button>
      )}
    </div>
  );
}
