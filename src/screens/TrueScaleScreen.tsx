import { useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import { Piece, cutLine } from '../engine/piece';
import type { Run } from '../engine/compare';
import { edgeWords } from '../engine/compare';
import { CARD_MM, Calibration, distanceCm, edgeAt, loadCalibration, pxPerMmOf, saveCalibration, screenKey, snap } from '../engine/scale';

interface Props {
  pieces: Piece[];
}

type Tool = 'measure' | 'seam';

const thisScreen = () => screenKey(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight, window.devicePixelRatio || 1);

/**
 * A piece on screen at its real size, to check against the body or a tape measure, or to hold a piece of
 * fabric up to. The screen is calibrated once against a bank card.
 */
export function TrueScaleScreen({ pieces }: Props) {
  const screen = useMemo(thisScreen, []);
  const [cal, setCal] = useState<Calibration | undefined>(() => loadCalibration(screen));
  const [calibrating, setCalibrating] = useState(!cal);
  if (calibrating || !cal)
    return (
      <CardCalibration
        start={cal?.pxPerMm}
        onDone={(pxPerMm) => {
          const c = { pxPerMm, screen };
          saveCalibration(c);
          setCal(c);
          setCalibrating(false);
        }}
        onCancel={cal ? () => setCalibrating(false) : undefined}
      />
    );
  return <PieceAtScale pieces={pieces} pxPerMm={cal.pxPerMm} onRecalibrate={() => setCalibrating(true)} />;
}

function CardCalibration({ start, onDone, onCancel }: { start?: number; onDone: (pxPerMm: number) => void; onCancel?: () => void }) {
  // A CSS inch is 96 px, so 3.78 px to the mm is where most screens start.
  const [px, setPx] = useState(() => Math.round((start ?? 96 / 25.4) * CARD_MM.w));
  const nudge = (d: number) => setPx((v) => Math.min(800, Math.max(120, v + d)));
  return (
    <section className="card" aria-labelledby="caltitle">
      <p className="eyebrow">True size · once for this screen</p>
      <h1 id="caltitle">Match a bank card</h1>
      <p className="muted">
        Hold any bank or loyalty card flat against the screen, over the shape below, and make the shape the same size as the card. Every
        card of this kind is 85.60 by 53.98 mm, so the screen then knows its own scale.
      </p>
      <div className="calcard-wrap">
        <div className="calcard" style={{ width: `${px}px`, height: `${(px * CARD_MM.h) / CARD_MM.w}px`, borderRadius: `${(px * 3.18) / CARD_MM.w}px` }} aria-label="A card-sized shape to match">
          <span className="small">85.60 × 53.98 mm</span>
        </div>
      </div>
      <div className="row wrap">
        <div className="stepper" role="group" aria-label="Card size">
          <button type="button" aria-label="Smaller" onClick={() => nudge(-1)}>
            −
          </button>
          <span aria-live="polite">{pxPerMmOf(px).toFixed(2)} px/mm</span>
          <button type="button" aria-label="Larger" onClick={() => nudge(1)}>
            +
          </button>
        </div>
        <input type="range" min={120} max={800} value={px} aria-label="Card size" onChange={(e) => setPx(Number(e.target.value))} className="grow" />
      </div>
      <div className="row wrap">
        <button type="button" className="primary" onClick={() => onDone(pxPerMmOf(px))}>
          It matches the card
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Keep the old match
          </button>
        )}
      </div>
    </section>
  );
}

function PieceAtScale({ pieces, pxPerMm, onRecalibrate }: { pieces: Piece[]; pxPerMm: number; onRecalibrate: () => void }) {
  const [which, setWhich] = useState(0);
  const [tool, setTool] = useState<Tool>('measure');
  const [taps, setTaps] = useState<P[]>([]);
  const [edge, setEdge] = useState<Run | undefined>();
  const svg = useRef<SVGSVGElement>(null);
  const pc = pieces[Math.min(which, pieces.length - 1)];
  const view = useMemo(() => {
    if (!pc) return undefined;
    const stitch = pc.outline.points();
    const cut = cutLine(pc);
    const all = [...stitch, ...cut];
    const x0 = Math.min(...all.map((q) => q.x)) - 1;
    const y0 = Math.min(...all.map((q) => q.y)) - 1;
    const w = Math.max(...all.map((q) => q.x)) + 1 - x0;
    const h = Math.max(...all.map((q) => q.y)) + 1 - y0;
    return { stitch, cut, x0, y0, w, h };
  }, [pc]);
  if (!pc || !view) return null;
  const pxPerCm = pxPerMm * 10;
  const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');

  const tap = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect();
    const q = { x: view.x0 + (e.clientX - r.left) / pxPerCm, y: view.y0 + (e.clientY - r.top) / pxPerCm };
    if (tool === 'seam') {
      setEdge(edgeAt(pc, q, 1));
      return;
    }
    const s = snap(q, [...view.stitch, ...pc.notches.map((n) => n[0])], 0.4);
    setTaps((t) => (t.length >= 2 ? [s] : [...t, s]));
  };
  const pick = (i: number) => {
    setWhich(i);
    setTaps([]);
    setEdge(undefined);
  };
  const reading =
    tool === 'measure'
      ? taps.length === 2
        ? `${distanceCm(taps[0], taps[1])} cm between the two points`
        : taps.length === 1
          ? 'Tap a second point'
          : 'Tap two points to measure between them'
      : edge
        ? `${edgeWords(edge.tag)[0].toUpperCase()}${edgeWords(edge.tag).slice(1)}: ${(Math.round(edge.length * 10) / 10).toFixed(1)} cm along the stitching line`
        : 'Tap an edge to walk it';
  const sw = 1 / pxPerCm;

  return (
    <section className="card truescale" aria-labelledby="tstitle">
      <p className="eyebrow">True size · {pc.cut}</p>
      <h1 id="tstitle">{pc.name}</h1>
      <div className="seg wrap" role="group" aria-label="Piece">
        {pieces.map((p, i) => (
          <button key={`${p.name}${i}`} type="button" className={i === which ? 'on' : ''} aria-pressed={i === which} onClick={() => pick(i)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <div className="seg" role="group" aria-label="Tool">
          <button type="button" className={tool === 'measure' ? 'on' : ''} aria-pressed={tool === 'measure'} onClick={() => (setTool('measure'), setEdge(undefined))}>
            Measure
          </button>
          <button type="button" className={tool === 'seam' ? 'on' : ''} aria-pressed={tool === 'seam'} onClick={() => (setTool('seam'), setTaps([]))}>
            Walk a seam
          </button>
        </div>
        <p className="reading" aria-live="polite">
          {reading}
        </p>
      </div>
      <p className="muted small">
        At its real size: {Math.round(view.w)} by {Math.round(view.h)} cm with seam allowances. Scroll to see all of it. Solid line: stitching
        line. Fine line: cutting line.
      </p>
      <div className="truescale-pan">
        <svg
          ref={svg}
          width={view.w * pxPerCm}
          height={view.h * pxPerCm}
          viewBox={`${view.x0} ${view.y0} ${view.w} ${view.h}`}
          onPointerUp={tap}
          role="img"
          aria-label={`${pc.name} at true size`}
        >
          <g className="ts-grid">
            {Array.from({ length: Math.floor(view.w) + 1 }, (_, i) => Math.ceil(view.x0) + i).map((x) => (
              <line key={`x${x}`} x1={x} x2={x} y1={view.y0} y2={view.y0 + view.h} strokeWidth={x % 5 ? sw * 0.5 : sw} />
            ))}
            {Array.from({ length: Math.floor(view.h) + 1 }, (_, i) => Math.ceil(view.y0) + i).map((y) => (
              <line key={`y${y}`} y1={y} y2={y} x1={view.x0} x2={view.x0 + view.w} strokeWidth={y % 5 ? sw * 0.5 : sw} />
            ))}
          </g>
          <polygon points={pts(view.cut)} className="ts-cut" strokeWidth={sw} />
          <polygon points={pts(view.stitch)} className="ts-stitch" strokeWidth={sw * 1.5} />
          {pc.lines.map((l, i) => (
            <polyline key={i} points={pts(l.points())} className="ts-line" strokeWidth={sw} />
          ))}
          {pc.grain && <line x1={pc.grain[0].x} y1={pc.grain[0].y} x2={pc.grain[1].x} y2={pc.grain[1].y} className="ts-line" strokeWidth={sw} />}
          {edge && <polyline points={pts(edge.pts)} className="ts-edge" strokeWidth={sw * 5} />}
          {taps.map((q, i) => (
            <circle key={i} cx={q.x} cy={q.y} r={sw * 5} className="ts-tap" />
          ))}
          {taps.length === 2 && <line x1={taps[0].x} y1={taps[0].y} x2={taps[1].x} y2={taps[1].y} className="ts-tapline" strokeWidth={sw * 2} />}
        </svg>
      </div>
      <p className="muted small">Grid squares are 1 cm, with a heavier line every 5 cm: lay a ruler on the screen to check it.</p>
      <div className="row wrap">
        <button type="button" className="link" onClick={onRecalibrate}>
          Match the card again
        </button>
      </div>
    </section>
  );
}
