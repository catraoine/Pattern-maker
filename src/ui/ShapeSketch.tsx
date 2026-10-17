// The skirt sketch, shaped by hand: drag the hem to change the length, drag the side seam to change
// the flare, or draw a new hemline across the bottom with a finger.
import { PointerEvent, useMemo, useRef, useState } from 'react';
import type { Choices } from '../App';
import type { P } from '../engine/geometry';
import { HEM_SAMPLES, HemShape, flatHem, isShaped, offsetAt } from '../engine/hem';
import { LENGTHS, Length, Silhouette, SkirtDraft, SkirtMeasurements, flareRange, isCircle, lengthRange, presetFlare } from '../engine/skirt';
import { GROUPS } from '../screens/StyleScreen';

export type Side = 'front' | 'back';

interface Worn {
  /** Outline of one half, centre waist round to centre hem. */
  pts: P[];
  /** The hem, from the side seam to the centre. */
  hem: P[];
  sideWaist: P;
}

/**
 * One half of the skirt as it looks worn. Block skirts hang much like their flat pieces; circle skirts
 * fall into folds, so they get a drawn bell shape, with any drawn hem shape applied to it.
 */
function worn(draft: SkirtDraft, side: Side): Worn {
  // Pleats, godets or a flounce: the skirt as it hangs, before they were drafted in.
  const pc = (draft.block ?? draft.pieces)[side === 'front' ? 0 : 1];
  if (draft.circleShare) {
    const offs = draft.hem?.[side] ?? flatHem();
    const wh = draft.finishedWaist / 4;
    const L = draft.lengthCm;
    const hh = wh + L * (0.25 + 0.4 * draft.circleShare);
    const pts: P[] = [{ x: 0, y: 0 }, { x: wh, y: 0 }];
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      pts.push({ x: wh + (hh - wh) * t ** 1.6, y: L * t + offsetAt(offs, 1) * t ** 2 });
    }
    const folds = 2 + Math.round(2 * draft.circleShare);
    const hem: P[] = [pts[pts.length - 1]];
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const x = hh * (1 - t);
      hem.push({ x, y: L + offsetAt(offs, x / hh) + 1.6 * Math.sin(t * folds * Math.PI) ** 2 - 0.8 });
    }
    return { pts: [...pts, ...hem.slice(1)], hem, sideWaist: { x: wh, y: 0 } };
  }
  const { pts, tags } = pc.outline.taggedPoints(16);
  const first = tags.indexOf('hem');
  const last = tags.lastIndexOf('hem');
  // Leave off the closing run up the centre, which would show as a line down the middle.
  return { pts: pts.slice(0, -1), hem: pts.slice(first, last + 2), sideWaist: pts[tags.lastIndexOf('waist') + 1] };
}

/** Height of the hem at a distance x from the centre, read off the hem polyline. */
function hemY(hem: P[], x: number): number {
  for (let i = 1; i < hem.length; i++) {
    const a = hem[i - 1];
    const b = hem[i];
    if ((x <= a.x && x >= b.x) || (x >= a.x && x <= b.x)) {
      const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return x >= hem[0].x ? hem[0].y : hem[hem.length - 1].y;
}

const LENGTH_IDS = Object.keys(LENGTHS) as Length[];
const lengthName = (id: Length) => GROUPS[2].options.find((o) => o[0] === id)![1];
const silName = (id: Silhouette) => GROUPS[1].options.find((o) => o[0] === id)![1];

/** A dragged length: snaps to a named length within 1.5 cm, otherwise kept to the half centimetre. */
export function dragLength(m: SkirtMeasurements, c: Choices, cm: number): Choices {
  const v = lengthRange(m).clamp(cm);
  const named = LENGTH_IDS.map((id) => ({ id, at: LENGTHS[id](m) })).sort((a, b) => Math.abs(a.at - v) - Math.abs(b.at - v))[0];
  const { look: _look, lengthCm: _l, ...rest } = c;
  return Math.abs(named.at - v) < 1.5 ? { ...rest, length: named.id } : { ...rest, length: named.id, lengthCm: Math.round(v * 2) / 2 };
}

/** A dragged flare: moves between pencil, straight and A-line, snapping to each one's own shape. */
export function dragFlare(m: SkirtMeasurements, c: Choices, length: number, cm: number): Choices {
  const { look: _look, flareCm: _f, ...rest } = c;
  const range = flareRange(m, length, c.silhouette);
  const v = Math.min(range.max, Math.max(range.min, cm));
  const options: Silhouette[] = c.silhouette === 'trumpet' ? ['trumpet'] : ['pencil', 'straight', 'a_line'];
  for (const s of options) {
    if (Math.abs(presetFlare(m, length, s) - v) < 0.8) return { ...rest, silhouette: s };
  }
  const silhouette = c.silhouette === 'trumpet' ? 'trumpet' : v < -0.75 ? 'pencil' : v <= 0.75 ? 'straight' : 'a_line';
  return { ...rest, silhouette, flareCm: Math.round(v * 2) / 2 };
}

/** Turn a finger stroke into hem offsets: each point says where the hem should be at that distance
 * from the centre. Both halves count, so the hem stays even; parts the stroke didn't reach keep their shape. */
export function strokeToHem(stroke: P[], hem: P[], current: number[]): number[] {
  const half = Math.max(...hem.map((q) => q.x)) || 1;
  const sums = new Array(HEM_SAMPLES).fill(0);
  const counts = new Array(HEM_SAMPLES).fill(0);
  for (const q of stroke) {
    const x = Math.min(half, Math.abs(q.x));
    const k = Math.round((x / half) * (HEM_SAMPLES - 1));
    sums[k] += q.y - hemY(hem, x);
    counts[k]++;
  }
  const raw = current.map((v, k) => (counts[k] ? v + sums[k] / counts[k] : v));
  const smooth = raw.map((v, k) => (raw[Math.max(0, k - 1)] + 2 * v + raw[Math.min(HEM_SAMPLES - 1, k + 1)]) / 4);
  return smooth.map((v) => (Math.abs(v) < 0.5 ? 0 : Math.round(v * 10) / 10));
}

interface Props {
  draft: SkirtDraft;
  m: SkirtMeasurements;
  choices: Choices;
  side: Side;
  drawing: boolean;
  label: string;
  /** Called as a drag moves, to redraft live. */
  onLive: (c: Choices) => void;
  /** Called when a drag or a drawn stroke finishes, with the choices from before it, for undo. */
  onDone: (before: Choices, after: Choices) => void;
}

type Drag = { kind: 'hem' | 'side'; start: P; before: Choices; base: Choices; length: number; flare: number };

/** A shape matched from a photo is pinned to proportions; dragging lets go of it, keeping the length
 * and flare it had so the skirt doesn't jump. */
function unpin(c: Choices, draft: SkirtDraft): Choices {
  if (!c.shape) return c;
  const { shape: _shape, ...rest } = c;
  return { ...rest, lengthCm: draft.lengthCm, ...(draft.flareCm !== undefined ? { flareCm: draft.flareCm } : {}) };
}

export function ShapeSketch({ draft, m, choices, side, drawing, label, onLive, onDone }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const [stroke, setStroke] = useState<P[]>();
  const live = useRef<Choices>(choices);
  live.current = choices;

  const circle = isCircle(choices.silhouette);
  const w = useMemo(() => worn(draft, side), [draft, side]);

  // The frame stays put while dragging, sized for the longest and widest the skirt can go, so the
  // handle stays under the finger. Knee and floor lines show where the hem falls on the body.
  const frame = useMemo(() => {
    const hipQ = draft.finishedHip / 4;
    const longest = lengthRange(m).max;
    const block = hipQ + Math.max(10, (longest - m.waist_to_hip) * 0.45) * 0.8;
    const bell = draft.circleShare ? draft.finishedWaist / 4 + longest * (0.25 + 0.4 * draft.circleShare) : 0;
    const half = Math.max(block, bell, ...w.pts.map((q) => q.x)) + 4;
    return { half, top: -8, bottom: m.waist_to_floor + 6 };
  }, [draft.finishedHip, draft.finishedWaist, draft.circleShare, m, w]);

  const cx = frame.half;
  const k = (frame.bottom - frame.top) / 110; // handle and label size, in proportion to the sketch
  const right = w.pts.map((q) => ({ x: cx + q.x, y: q.y }));
  const left = w.pts.map((q) => ({ x: cx - q.x, y: q.y })).reverse();
  const path = [...right, ...left].map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ') + ' Z';
  const hemCentre = w.hem[w.hem.length - 1];
  const hemSide = w.hem[0];

  const toSvg = (e: PointerEvent): P => {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: pt.x, y: pt.y };
  };

  const startDrag = (kind: Drag['kind']) => (e: PointerEvent) => {
    if (drawing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ kind, start: toSvg(e), before: choices, base: unpin(choices, draft), length: draft.lengthCm, flare: draft.flareCm ?? 0 });
  };

  const move = (e: PointerEvent) => {
    if (drag) {
      const at = toSvg(e);
      const next =
        drag.kind === 'hem'
          ? dragLength(m, drag.base, drag.length + at.y - drag.start.y)
          : dragFlare(m, drag.base, draft.lengthCm, drag.flare + (at.x - drag.start.x) * (drag.start.x >= cx ? 1 : -1));
      onLive(next);
    } else if (stroke) {
      setStroke([...stroke, toSvg(e)]);
    }
  };

  const end = () => {
    if (drag) {
      onDone(drag.before, live.current);
      setDrag(undefined);
    } else if (stroke) {
      if (stroke.length > 2) {
        const current: HemShape = draft.hem ?? { front: flatHem(), back: flatHem() };
        const pts = stroke.map((q) => ({ x: q.x - cx, y: q.y }));
        const hem = { ...current, [side]: strokeToHem(pts, w.hem, current[side]) };
        const { look: _look, ...rest } = choices;
        onDone(choices, isShaped(hem) ? { ...rest, hem } : { ...rest, hem: undefined });
      }
      setStroke(undefined);
    }
  };

  const lengthLabel = choices.lengthCm ? `${Math.round(draft.lengthCm)} cm` : lengthName(choices.length);
  const flareLabel = choices.flareCm !== undefined ? `${choices.flareCm > 0 ? '+' : ''}${choices.flareCm} cm` : silName(choices.silhouette);
  const guide = (y: number, text: string) => (
    <g className="guide">
      <line x1={0} x2={2 * cx} y1={y} y2={y} strokeWidth={0.15} strokeDasharray={`${k} ${k}`} />
      <text x={1} y={y - 0.8} fontSize={2 * k}>
        {text}
      </text>
    </g>
  );
  const handle = (at: P, kind: Drag['kind'], text: string) => {
    const r = 2.4 * k;
    const c = 1.1 * k;
    const arrows =
      kind === 'hem'
        ? `M${at.x - c} ${at.y - r - 1.2 * k + c} L${at.x} ${at.y - r - 1.2 * k} L${at.x + c} ${at.y - r - 1.2 * k + c} M${at.x - c} ${at.y + r + 1.2 * k - c} L${at.x} ${at.y + r + 1.2 * k} L${at.x + c} ${at.y + r + 1.2 * k - c}`
        : `M${at.x + r + 1.2 * k - c} ${at.y - c} L${at.x + r + 1.2 * k} ${at.y} L${at.x + r + 1.2 * k - c} ${at.y + c} M${at.x - r - 1.2 * k + c} ${at.y - c} L${at.x - r - 1.2 * k} ${at.y} L${at.x - r - 1.2 * k + c} ${at.y + c}`;
    const active = drag?.kind === kind;
    return (
      <g className={active ? 'handle on' : 'handle'}>
        <circle cx={at.x} cy={at.y} r={r} strokeWidth={0.22} />
        <circle cx={at.x} cy={at.y} r={0.45 * k} className="dot" />
        <path d={arrows} strokeWidth={0.22} fill="none" />
        <text
          x={kind === 'hem' ? at.x + r + 1.5 * k : at.x}
          y={kind === 'hem' ? at.y + 0.9 * k : at.y + r + 4.6 * k}
          fontSize={2.6 * k}
          textAnchor={kind === 'hem' ? 'start' : 'middle'}
        >
          {text.toUpperCase()}
        </text>
        <circle
          cx={at.x}
          cy={at.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={kind === 'hem' ? 'Skirt length' : 'Flare at the hem'}
          aria-valuetext={text}
          aria-valuenow={kind === 'hem' ? draft.lengthCm : draft.flareCm ?? 0}
          tabIndex={0}
          onPointerDown={startDrag(kind)}
          onKeyDown={(e) => {
            const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            const base = unpin(choices, draft);
            const next = kind === 'hem' ? dragLength(m, base, draft.lengthCm + step * 2) : dragFlare(m, base, draft.lengthCm, (draft.flareCm ?? 0) + step);
            onDone(choices, next);
          }}
        />
      </g>
    );
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 ${frame.top} ${2 * cx} ${frame.bottom - frame.top}`}
      role="img"
      aria-label={label}
      className={drawing ? 'preview-svg sketch shape drawing' : 'preview-svg sketch shape'}
      onPointerDown={(e) => {
        if (!drawing) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setStroke([toSvg(e)]);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {guide(m.waist_to_knee, 'KNEE')}
      {guide(m.waist_to_floor, 'FLOOR')}
      <path d={path} style={{ fill: 'var(--fill)', stroke: 'var(--ink)' }} strokeWidth={0.25} strokeLinejoin="round" />
      <rect
        x={cx - w.sideWaist.x}
        y={w.sideWaist.y - 3}
        width={2 * w.sideWaist.x}
        height={3.5}
        style={{ fill: 'var(--paper)', stroke: 'var(--ink)' }}
        strokeWidth={0.25}
      />
      {!drawing && handle({ x: cx, y: hemCentre.y }, 'hem', lengthLabel)}
      {!drawing && !circle && handle({ x: cx + hemSide.x, y: hemSide.y }, 'side', flareLabel)}
      {drawing && !stroke && (
        <text x={cx} y={Math.min(frame.bottom - 4, hemCentre.y + 8 * k)} fontSize={2.1 * k} textAnchor="middle" className="hint">
          DRAW A NEW HEM ACROSS THE SKIRT
        </text>
      )}
      {stroke && (
        <polyline
          points={stroke.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}
          className="stroke"
          strokeWidth={0.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
