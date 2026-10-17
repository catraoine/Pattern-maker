// The bodice sketch, shaped by hand: front or back as worn, with the darts closed. Drag the hem to
// change the length, drag the side to change the fit, or draw a new neckline with a finger.
import { PointerEvent, useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import {
  BODICE_FIT_EASE,
  BodiceDraft,
  BodiceFit,
  BodiceMeasurements,
  BUST_EASE_RANGE,
  DROP_MIN,
  DrawnNeck,
  NECKLINES,
  Neckline,
  bodiceEase,
  blockOf,
  dropRange,
} from '../engine/bodice';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT } from '../garments';
import { COWL_DEPTH } from '../engine/drape';
import type { Side } from './ShapeSketch';
import { bodiceBodyOutline } from './bodyOutline';

interface Worn {
  /** One half from the centre neck round the shoulder and armhole, down the side to the centre hem. */
  pts: P[];
  /** The widest point of the half, and the hem at the centre. */
  widest: P;
  hemCentre: P;
  /** Dart fold lines, already mirrored, as an SVG path given the centre x. */
  darts: (cx: number) => string;
  /** The piece's own outline, for placing the body round it. */
  top: { pts: P[]; tags: (string | undefined)[] };
  /** How many points of `pts` are the top edge, from the centre neck to the underarm. */
  topCount: number;
}

const f = (q: P) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`;

/** One half of the bodice as worn: the piece's top edge, then a straight side down to a level waist. */
export function worn(draft: BodiceDraft, side: Side): Worn {
  const pc = blockOf(draft)[side === 'front' ? 0 : 1];
  const land = side === 'front' ? draft.front : draft.back;
  const { pts, tags } = pc.outline.taggedPoints(16);
  // The top edge runs to the end of the armhole, or on a top cut below the shoulders, to the side seam.
  const lastArm = tags.includes('armhole') ? tags.lastIndexOf('armhole') : tags.lastIndexOf('neck');
  const top = pts.slice(0, lastArm + 2);
  const waist = { x: land.waistSide.x, y: land.waistCentre.y };
  const hem = { x: land.hemSide.x, y: land.hemCentre.y };
  const below = land.hemCentre.y - land.waistCentre.y > 0.5;
  const out = [...top, waist];
  if (below) {
    // The same hip curve the pattern uses, drawn as points so the outline is one polyline.
    const dy = hem.y - waist.y;
    const c1 = { x: waist.x + (hem.x - waist.x) * 0.5, y: waist.y + dy * 0.3 };
    const c2 = { x: hem.x, y: hem.y - dy * 0.4 };
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const u = 1 - t;
      out.push({
        x: u ** 3 * waist.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * hem.x,
        y: u ** 3 * waist.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * hem.y,
      });
    }
  }
  out.push(land.hemCentre);
  const under = top[top.length - 1];
  const widest = top.reduce((a, b) => (b.x > a.x ? b : a));
  // Each dart as its fold line: tip to the middle of its mouth, or point to point for a fish-eye dart.
  const folds = pc.lines
    .filter((ln) => ln.segs.length === 2 || ln.segs.length === 4)
    .map((ln) => {
      const q = ln.points();
      const [a, b] = ln.segs.length === 4 ? [q[0], q[2]] : [q[1], { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 }];
      // Waist darts end on the level waist; a bust dart ends on the straight side seam drawn here.
      const sideX = (y: number) => under.x + ((waist.x - under.x) * (y - under.y)) / (waist.y - under.y);
      const end = ln.segs.length !== 2 ? b : b.y > land.waistCentre.y - 0.5 ? { x: b.x, y: land.waistCentre.y } : { x: Math.min(b.x, sideX(b.y)), y: b.y };
      return [a, end];
    });
  const darts = (cx: number) =>
    folds.flatMap(([a, b]) => ([1, -1] as const).map((s) => `M${f({ x: cx + s * a.x, y: a.y })} L${f({ x: cx + s * b.x, y: b.y })}`)).join(' ');
  return { pts: out, widest, hemCentre: land.hemCentre, darts, top: { pts, tags }, topCount: top.length };
}

/**
 * A draped bodice as worn, as an SVG path given the centre x, or undefined for the block's own: the
 * one-shoulder's covered half, its bare half from under the arm and the top edge as drafted between;
 * the cowl front's neckline hanging in a soft curve between the neck points.
 */
export function drapedOutline(draft: BodiceDraft, side: Side, w: Worn, cx: number): string | undefined {
  const path = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q)}`).join(' ') + ' Z';
  const near = (q: P) => w.pts.slice(0, w.topCount).reduce((b, r, i) => (Math.hypot(r.x - q.x, r.y - q.y) < Math.hypot(w.pts[b].x - q.x, w.pts[b].y - q.y) ? i : b), 0);
  if (draft.drape?.kind === 'one_shoulder') {
    // As worn, the wearer's left is on the right of the front and the left of the back, as each piece lies.
    const k = side === 'front' ? 1 : -1;
    const pc = draft.pieces[side === 'front' ? 0 : 1];
    const { pts, tags } = pc.outline.taggedPoints(16);
    const N = pts[0];
    const edge = [...pts.filter((_, i) => tags[i] === 'neck' || (i > 0 && tags[i - 1] === 'neck')), N].map((q) => ({ x: cx + q.x, y: q.y }));
    const covered = w.pts.slice(near({ x: Math.abs(N.x), y: N.y })).map((q) => ({ x: cx + k * q.x, y: q.y }));
    const bare = w.pts.slice(w.topCount, -1).map((q) => ({ x: cx - k * q.x, y: q.y })).reverse();
    return path([...covered, ...bare, ...edge.slice(0, -1)]);
  }
  if (draft.drape?.kind === 'cowl' && side === 'front') {
    const pc = blockOf(draft)[0];
    const { pts, tags } = pc.outline.taggedPoints(16);
    const N = pts[tags.indexOf('shoulder')];
    const Y = draft.neckBlock.front.neckY + (draft.drape.depthCm ?? COWL_DEPTH);
    const hang = Array.from({ length: 15 }, (_, i) => {
      const t = i / 14;
      const c = { x: N.x * 0.55, y: Y };
      return { x: 2 * t * (1 - t) * c.x + t * t * N.x, y: (1 - t) ** 2 * Y + 2 * t * (1 - t) * c.y + t * t * N.y };
    });
    const half = [...hang, ...w.pts.slice(near(N) + 1)];
    return path([...half.map((q) => ({ x: cx + q.x, y: q.y })), ...half.map((q) => ({ x: cx - q.x, y: q.y })).reverse()]);
  }
  return undefined;
}

const FITS = Object.keys(BODICE_FIT_EASE) as BodiceFit[];
const fitName = (id: BodiceFit) => BODICE_GROUPS[0].options.find((o) => o[0] === id)![1];
const lengthName = (id: BodiceChoices['length']) => BODICE_GROUPS[2].options.find((o) => o[0] === id)![1];

/** Keeps the darts to what the fit allows, the way picking a fit chip does. */
const withDarts = (c: BodiceChoices): BodiceChoices => (DARTS_FOR_FIT[c.fit].includes(c.darts) ? c : { ...c, darts: 'bust_waist' });

/** A dragged hem: on the waist, or snapping to the high hip or hip within 1.5 cm, otherwise kept to
 * the half centimetre. */
export function dragDrop(m: BodiceMeasurements, c: BodiceChoices, cm: number): BodiceChoices {
  const { dropCm: _d, ...rest } = c;
  if (cm < DROP_MIN / 2) return { ...rest, length: 'waist' };
  const range = dropRange(m);
  const v = Math.min(range.max, Math.max(range.min, cm));
  const WH = m.waist_to_hip ?? 0;
  if (Math.abs(v - WH / 2) < 1.5) return { ...rest, length: 'high_hip' };
  if (Math.abs(v - WH) < 1.5) return { ...rest, length: 'hip' };
  return { ...rest, length: v < WH * 0.75 ? 'high_hip' : 'hip', dropCm: Math.round(v * 2) / 2 };
}

/** A dragged fit: bust ease moves between the fits, snapping to each one's own ease within 1 cm. */
export function dragEase(c: BodiceChoices, ease: number): BodiceChoices {
  const { bustEase: _e, ...rest } = c;
  const v = Math.min(BUST_EASE_RANGE.max, Math.max(BUST_EASE_RANGE.min, ease));
  const nearest = [...FITS].sort((a, b) => Math.abs(BODICE_FIT_EASE[a].bust - v) - Math.abs(BODICE_FIT_EASE[b].bust - v))[0];
  if (Math.abs(BODICE_FIT_EASE[nearest].bust - v) < 1) return withDarts({ ...rest, fit: nearest });
  return withDarts({ ...rest, fit: nearest, bustEase: Math.round(v * 2) / 2 });
}

/** How full each named neckline's curve is, so drawing only the back keeps the front's shape. */
const FULLNESS: Record<Neckline, number> = { crew: 0.75, scoop: 0.6, v: 0, square: 1, boat: 0.6, one_shoulder: 0.75, cowl: 0.6, strapless: 1, sweetheart: 0.6, cami: 0 };

/** The neckline as it stands, as a drawn one, so a stroke can change part of it. */
export const currentNeck = (c: BodiceChoices): DrawnNeck => c.neck ?? { ...NECKLINES[c.neckline], fullness: FULLNESS[c.neckline] };

/**
 * Turn a finger stroke over the neck into a neckline. Both halves count, mirrored about the centre.
 * On the front, the lowest point sets the depth, the highest the width along the shoulder, and how far
 * out the stroke is halfway down sets how full the curve is. On the back, only the depth is taken.
 */
export function strokeToNeck(stroke: P[], side: Side, draft: BodiceDraft, current: DrawnNeck): DrawnNeck | undefined {
  const pts = stroke.map((q) => ({ x: Math.abs(q.x), y: q.y }));
  const block = draft.neckBlock[side];
  const low = pts.reduce((a, b) => (b.y > a.y ? b : a));
  const high = pts.reduce((a, b) => (b.y < a.y ? b : a));
  if (low.y - high.y < 1) return undefined;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  if (side === 'back') return { ...current, backDepth: round1(Math.min(12, Math.max(0, low.y - block.neckY))) };
  const neckX = Math.max(high.x, block.neckX);
  const mid = (low.y + high.y) / 2;
  const near = pts.filter((q) => Math.abs(q.y - mid) < (low.y - high.y) * 0.12);
  const u = near.length ? near.reduce((s, q) => s + q.x, 0) / near.length / neckX : 0.75;
  return {
    ...current,
    frontDepth: round1(Math.max(0, low.y - block.neckY)),
    width: round1(Math.max(0, high.x - block.neckX)),
    fullness: Math.round(Math.min(1, Math.max(0, (u - 0.5) / 0.45)) * 100) / 100,
  };
}

interface Props {
  draft: BodiceDraft;
  m: BodiceMeasurements;
  choices: BodiceChoices;
  side: Side;
  drawing: boolean;
  label: string;
  /** Called as a drag moves, to redraft live. */
  onLive: (c: BodiceChoices) => void;
  /** Called when a drag or a drawn stroke finishes, with the choices from before it, for undo. */
  onDone: (before: BodiceChoices, after: BodiceChoices) => void;
}

type Drag = { kind: 'hem' | 'side'; start: P; before: BodiceChoices; drop: number; ease: number };

export function BodiceShape({ draft, m, choices, side, drawing, label, onLive, onDone }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const [stroke, setStroke] = useState<P[]>();
  const live = useRef<BodiceChoices>(choices);
  live.current = choices;
  const hip = Boolean(m.full_hip && m.waist_to_hip);

  const w = useMemo(() => worn(draft, side), [draft, side]);
  const waistY = (side === 'front' ? draft.front : draft.back).waistCentre.y;

  // The frame stays put while dragging, sized for the roomiest fit and the longest hem, so the handle
  // stays under the finger.
  const frame = useMemo(() => {
    // Room at the sides for the arms.
    const half = (m.full_bust + BUST_EASE_RANGE.max) / 4 + 6 + 0.2 * (m.armscye ?? 0.43 * m.full_bust);
    const deepest = Math.max(draft.front.waistCentre.y, draft.back.waistCentre.y) + (hip ? dropRange(m).max : 0);
    return { half, top: -8, bottom: deepest + 7 };
  }, [m, hip, draft.front.waistCentre.y, draft.back.waistCentre.y]);

  const cx = frame.half;
  const k = (frame.bottom - frame.top) / 80; // handle and label size, in proportion to the sketch
  const right = w.pts.map((q) => ({ x: cx + q.x, y: q.y }));
  const left = w.pts.map((q) => ({ x: cx - q.x, y: q.y })).reverse();
  const outline = drapedOutline(draft, side, w, cx) ?? [...right, ...left].map((q, i) => `${i ? 'L' : 'M'}${f(q)}`).join(' ') + ' Z';

  const toSvg = (e: PointerEvent): P => {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: pt.x, y: pt.y };
  };

  const startDrag = (kind: Drag['kind']) => (e: PointerEvent) => {
    if (drawing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ kind, start: toSvg(e), before: choices, drop: draft.drop, ease: bodiceEase(choices).bust });
  };

  const move = (e: PointerEvent) => {
    if (drag) {
      const at = toSvg(e);
      // Moving one side out by a centimetre widens all four quarters of the bodice by as much.
      const next =
        drag.kind === 'hem'
          ? dragDrop(m, drag.before, drag.drop + at.y - drag.start.y)
          : dragEase(drag.before, drag.ease + 4 * (at.x - drag.start.x) * (drag.start.x >= cx ? 1 : -1));
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
      const neck = stroke.length > 2 ? strokeToNeck(stroke.map((q) => ({ x: q.x - cx, y: q.y })), side, draft, currentNeck(choices)) : undefined;
      if (neck) onDone(choices, { ...choices, neck });
      setStroke(undefined);
    }
  };

  const lengthLabel = choices.dropCm !== undefined ? `${Math.round(draft.drop)} cm below` : lengthName(choices.length);
  const easeLabel = choices.bustEase !== undefined ? `${choices.bustEase} cm ease` : fitName(choices.fit);
  const guide = (y: number, text: string) => (
    <g className="guide">
      <line x1={0} x2={2 * cx} y1={y} y2={y} strokeWidth={0.12} strokeDasharray={`${k} ${k}`} />
      <text x={1} y={y - 0.8} fontSize={2 * k}>
        {text}
      </text>
    </g>
  );
  const handle = (at: P, kind: Drag['kind'], text: string) => {
    const r = 2.4 * k;
    const c = 1.1 * k;
    const o = r + 1.2 * k;
    const arrows =
      kind === 'hem'
        ? `M${at.x - c} ${at.y - o + c} L${at.x} ${at.y - o} L${at.x + c} ${at.y - o + c} M${at.x - c} ${at.y + o - c} L${at.x} ${at.y + o} L${at.x + c} ${at.y + o - c}`
        : `M${at.x + o - c} ${at.y - c} L${at.x + o} ${at.y} L${at.x + o - c} ${at.y + c} M${at.x - o + c} ${at.y - c} L${at.x - o} ${at.y} L${at.x - o + c} ${at.y + c}`;
    return (
      <g className={drag?.kind === kind ? 'handle on' : 'handle'}>
        <circle cx={at.x} cy={at.y} r={r} strokeWidth={0.22} />
        <circle cx={at.x} cy={at.y} r={0.45 * k} className="dot" />
        <path d={arrows} strokeWidth={0.22} fill="none" />
        <text
          x={kind === 'hem' ? at.x + r + 1.5 * k : at.x + r}
          y={kind === 'hem' ? at.y + 0.9 * k : at.y + r + 4.6 * k}
          fontSize={2.6 * k}
          textAnchor={kind === 'hem' ? 'start' : 'end'}
        >
          {text.toUpperCase()}
        </text>
        <circle
          cx={at.x}
          cy={at.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={kind === 'hem' ? 'Bodice length below the waist' : 'Ease at the bust'}
          aria-valuetext={text}
          aria-valuenow={kind === 'hem' ? draft.drop : bodiceEase(choices).bust}
          tabIndex={0}
          onPointerDown={startDrag(kind)}
          onKeyDown={(e) => {
            const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            const next = kind === 'hem' ? dragDrop(m, choices, draft.drop + step * 2) : dragEase(choices, bodiceEase(choices).bust + step);
            onDone(choices, next);
          }}
        />
      </g>
    );
  };

  const zip = side === 'back' && draft.drape?.kind !== 'one_shoulder' ? `M${f({ x: cx, y: draft.back.neckCentre.y })} L${f({ x: cx, y: draft.back.zipEnd.y })}` : '';

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
      <path d={bodiceBodyOutline(m, w.top, waistY, frame.bottom, cx)} className="body-outline" fill="none" strokeWidth={0.2} strokeLinecap="round" />
      {guide(waistY, 'WAIST')}
      {hip && guide(waistY + m.waist_to_hip!, 'HIP')}
      <path d={outline} style={{ fill: 'var(--fill)', stroke: 'var(--ink)' }} strokeWidth={0.25} strokeLinejoin="round" />
      <path d={w.darts(cx)} style={{ fill: 'none', stroke: 'var(--muted)' }} strokeWidth={0.15} />
      {zip && <path d={zip} style={{ fill: 'none', stroke: 'var(--muted)' }} strokeWidth={0.2} strokeDasharray="0.8 0.6" />}
      {zip && (
        <text x={cx + 1.2 * k} y={(draft.back.neckCentre.y + draft.back.zipEnd.y) / 2} fontSize={2 * k} className="hint" textAnchor="start">
          ZIP
        </text>
      )}
      {!drawing && hip && handle({ x: cx, y: w.hemCentre.y }, 'hem', lengthLabel)}
      {!drawing && handle({ x: cx + w.widest.x, y: w.widest.y }, 'side', easeLabel)}
      {drawing && !stroke && (
        <text x={cx} y={frame.bottom - 3 * k} fontSize={2.1 * k} textAnchor="middle" className="hint">
          {side === 'front' ? 'DRAW THE NECKLINE YOU WANT' : 'DRAW THE BACK NECKLINE'}
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
