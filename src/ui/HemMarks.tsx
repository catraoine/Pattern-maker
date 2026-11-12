// Length on the drawing (Cat's L1 and the hem dot on every garment, 2026-10-24): a dot on the hem drags between the
// named lengths and says which one it is on. It replaces the Length buttons, so the drawing shows where each length
// falls on you; the arrow keys step through them. The named lengths no longer stand as lines beside the body on the
// dress, T-shirt and trousers: the dot's own name says it, with less clutter (Cat, 2026-11-06).
import { PointerEvent, RefObject, useState } from 'react';
import type { P } from '../engine/geometry';

export interface HemChoice {
  /** What the dot sets, read out, such as "Dress length". */
  name: string;
  /** Each named length and where its hem falls, in the drawing's coordinates, shortest first. */
  marks: { id: string; label: string; y: number }[];
  value: string;
  onPick: (id: string) => void;
  /** The dot glides to any length between the named ones (Cat, 2026-11-06), pausing at each named one as it passes:
   *  `zero` is where a length of 0 cm sits on the drawing, `min` and `max` how far the length goes, `cm` a length
   *  set between the named ones (left out on a named one), and `onCm` sets one. Without it the dot only steps. */
  free?: { zero: number; min: number; max: number; cm?: number; onCm: (cm: number) => void };
}

/** How near a named length the gliding dot catches on it and holds still, in handle sizes (a finger's few millimetres
 *  on the screen, whatever the drawing's scale), and at most this share of the gap to the next one. */
export const CATCH = 3.5;
export const CATCH_SHARE = 0.35;

interface Props extends HemChoice {
  svg: RefObject<SVGSVGElement | null>;
  /** The centre line's x. */
  cx: number;
  /** Handle and label size, in proportion to the drawing. */
  k: number;
  /** Where the hem is drawn at the centre, when the cloth has one there (not between trouser legs). */
  hemAt?: number;
  /** Framed close to the garment (off the length step, or enlarged): the dot's name goes under it, not beside it. */
  bare?: boolean;
}

/** Room beside the skirt's drawing for its handles' names, in handle sizes, on each side so it stays centred. */
export const MARGIN = 19;

/** The mark nearest a height on the drawing. */
const nearest = (marks: HemChoice['marks'], y: number) => marks.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));

export function HemMarks({ name, marks, value, onPick, svg, cx, k, hemAt, bare, free }: Props) {
  // While dragging, the dot glides (or, without `free`, rides the marks), and catches on each named length it passes,
  // its name popping up on the handle; the garment is redrafted once, where it is let go.
  const [held, setHeld] = useState<{ y: number; on?: string }>();
  const named = marks.find((m) => m.id === value) ?? marks[marks.length - 1];
  if (!named) return null;
  const between = free?.cm !== undefined ? free.zero + free.cm : undefined;
  const on = held ? held.on : between === undefined ? named.id : undefined;
  const at = marks.find((m) => m.id === on);
  const y = held ? held.y : hemAt ?? between ?? named.y;
  const cmAt = (yy: number) => Math.round((yy - free!.zero) * 2) / 2;
  const label = at ? at.label : `${Math.round(cmAt(y))} cm`;
  const toY = (e: PointerEvent) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()).y;
  const follow = (yy: number) => {
    const near = nearest(marks, yy);
    if (!free) return setHeld({ y: near.y, on: near.id });
    const v = Math.min(free.zero + free.max, Math.max(free.zero + free.min, yy));
    const gap = Math.min(...marks.filter((m) => m !== near).map((m) => Math.abs(m.y - near.y)), Infinity);
    setHeld(Math.abs(near.y - v) < Math.min(CATCH * k, CATCH_SHARE * gap) ? { y: near.y, on: near.id } : { y: v });
  };
  const end = () => {
    if (held?.on) {
      if (held.on !== value || between !== undefined) onPick(held.on);
    } else if (held && free) free.onCm(cmAt(held.y));
    setHeld(undefined);
  };
  const r = 2.4 * k;
  const c = 1.1 * k;
  const tip = r + 1.2 * k;
  const arrows = `M${cx - c} ${y - tip + c} L${cx} ${y - tip} L${cx + c} ${y - tip + c} M${cx - c} ${y + tip - c} L${cx} ${y + tip} L${cx + c} ${y + tip - c}`;
  const dot: P = { x: cx, y };
  return (
    <g className="hem-marks">
      <g className={held ? 'handle on' : 'handle'}>
        <circle cx={dot.x} cy={dot.y} r={r} strokeWidth={0.22} />
        <circle cx={dot.x} cy={dot.y} r={0.45 * k} className="dot" />
        <path d={arrows} strokeWidth={0.22} fill="none" />
        {/* Bare, the drawing is framed close to the garment: the name goes to the left of the dot, on the hem, not under
            it across the legs (Cat, Nov 11: "move words"). */}
        {/* Caught on a named length, its name pops (a new key starts the pop again for each one). A clear gap from the
            disc so it never sits on a letter (Cat, Nov 11 sweep: "NEE", "FULL LENG"). */}
        <text key={held?.on ?? ''} className={held?.on ? 'caught' : undefined} x={bare ? dot.x - r - 3.2 * k : dot.x + r + 3.2 * k} y={dot.y + 0.9 * k} fontSize={2.6 * k} textAnchor={bare ? 'end' : undefined}>
          {label.toUpperCase()}
        </text>
        <circle
          cx={dot.x}
          cy={dot.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={name}
          aria-valuetext={label}
          aria-valuemin={1}
          aria-valuemax={marks.length}
          aria-valuenow={at ? marks.indexOf(at) + 1 : marks.indexOf(nearest(marks, y)) + 1}
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setHeld({ y, on });
          }}
          onPointerMove={(e) => held && follow(toY(e))}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => {
            const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            // The arrow keys step from named length to named length; from between two, to the next one along.
            const ahead = step > 0 ? marks.find((m) => m.y > y) ?? marks[marks.length - 1] : [...marks].reverse().find((m) => m.y < y) ?? marks[0];
            const next = at ? marks[Math.min(marks.length - 1, Math.max(0, marks.indexOf(at) + step))] : ahead;
            if (next.id !== value || between !== undefined) onPick(next.id);
          }}
        />
      </g>
    </g>
  );
}
