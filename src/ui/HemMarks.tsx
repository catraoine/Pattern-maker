// Length on the drawing (Cat's L1 and the hem dot on every garment, 2026-10-24): the named lengths sit as marks
// beside the body, and a dot on the hem drags between them. It replaces the Length buttons, so the drawing shows
// where each length falls on you. Tap a name to jump to it; the arrow keys step through them.
import { PointerEvent, RefObject, useState } from 'react';
import type { P } from '../engine/geometry';

export interface HemChoice {
  /** What the dot sets, read out, such as "Dress length". */
  name: string;
  /** Each named length and where its hem falls, in the drawing's coordinates, shortest first. */
  marks: { id: string; label: string; y: number }[];
  value: string;
  onPick: (id: string) => void;
}

interface Props extends HemChoice {
  svg: RefObject<SVGSVGElement | null>;
  /** The centre line's x. */
  cx: number;
  /** Handle and label size, in proportion to the drawing. */
  k: number;
  /** Where the hem is drawn at the centre, when the cloth has one there (not between trouser legs). */
  hemAt?: number;
  /** Just the dot, without the named lengths beside the body: when the drawing is enlarged to the garment. */
  bare?: boolean;
}

/** Room the marks take beside the drawing, in handle sizes: the drawing widens by this on each side so it stays centred. */
export const MARGIN = 19;

/** The named lengths beside the body, each a short line at its hem with its name under it; tap one to pick it. */
export function LengthMarks({ marks, on, k, onPick }: { marks: HemChoice['marks']; on?: string; k: number; onPick: (id: string) => void }) {
  const x = -MARGIN * k;
  return (
    <>
      {marks.map((m) => (
        <g key={m.id} className={m.id === on ? 'hem-mark on' : 'hem-mark'} aria-hidden="true" onClick={() => onPick(m.id)}>
          <line x1={x + 0.6 * k} x2={x + MARGIN * k - k} y1={m.y} y2={m.y} strokeWidth={m.id === on ? 0.24 : 0.15} />
          <text x={x + 0.6 * k} y={m.y + 2.8 * k} fontSize={2.3 * k}>
            {m.label.toUpperCase()}
          </text>
          <rect x={x} y={m.y - 1.5 * k} width={MARGIN * k} height={5 * k} className="hit" />
        </g>
      ))}
    </>
  );
}

/** The mark nearest a height on the drawing. */
const nearest = (marks: HemChoice['marks'], y: number) => marks.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));

export function HemMarks({ name, marks, value, onPick, svg, cx, k, hemAt, bare }: Props) {
  // While dragging the dot rides the marks; the garment is redrafted once, where it is let go.
  const [held, setHeld] = useState<string>();
  const shown = held ?? value;
  const at = marks.find((m) => m.id === shown) ?? marks[marks.length - 1];
  if (!at) return null;
  const y = held || hemAt === undefined ? at.y : hemAt;
  const toY = (e: PointerEvent) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()).y;
  const end = () => {
    if (held && held !== value) onPick(held);
    setHeld(undefined);
  };
  const r = 2.4 * k;
  const c = 1.1 * k;
  const tip = r + 1.2 * k;
  const arrows = `M${cx - c} ${y - tip + c} L${cx} ${y - tip} L${cx + c} ${y - tip + c} M${cx - c} ${y + tip - c} L${cx} ${y + tip} L${cx + c} ${y + tip - c}`;
  const dot: P = { x: cx, y };
  return (
    <g className="hem-marks">
      {!bare && <LengthMarks marks={marks} on={shown} k={k} onPick={(id) => id !== value && onPick(id)} />}
      <g className={held ? 'handle on' : 'handle'}>
        <circle cx={dot.x} cy={dot.y} r={r} strokeWidth={0.22} />
        <circle cx={dot.x} cy={dot.y} r={0.45 * k} className="dot" />
        <path d={arrows} strokeWidth={0.22} fill="none" />
        {/* Bare, the drawing is framed close to the garment: the name goes under the dot, where there's room. */}
        <text x={bare ? dot.x : dot.x + r + 1.5 * k} y={bare ? dot.y + tip + 3.2 * k : dot.y + 0.9 * k} fontSize={2.6 * k} textAnchor={bare ? 'middle' : undefined}>
          {at.label.toUpperCase()}
        </text>
        <circle
          cx={dot.x}
          cy={dot.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={name}
          aria-valuetext={at.label}
          aria-valuemin={1}
          aria-valuemax={marks.length}
          aria-valuenow={marks.indexOf(at) + 1}
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setHeld(shown);
          }}
          onPointerMove={(e) => held && setHeld(nearest(marks, toY(e)).id)}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => {
            const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            const next = marks[Math.min(marks.length - 1, Math.max(0, marks.indexOf(at) + step))];
            if (next.id !== value) onPick(next.id);
          }}
        />
      </g>
    </g>
  );
}
