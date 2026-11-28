// Length on the drawing (Cat's L1 and the hem dot on every garment, 2026-10-24): a dot on the hem drags between the
// named lengths and says which one it is on. It replaces the Length buttons, so the drawing shows where each length
// falls on you; the arrow keys step through them. The named lengths no longer stand as lines beside the body on the
// dress, T-shirt and trousers: the dot's own name says it, with less clutter (Cat, 2026-11-06).
import { PointerEvent, RefObject, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import { LengthTap, useSaid } from './LengthEntry';

export interface HemChoice {
  /** What the dot sets, read out, such as "Dress length". */
  name: string;
  /** Each named length and where its hem falls, in the drawing's coordinates, shortest first. */
  marks: { id: string; label: string; y: number }[];
  value: string;
  onPick: (id: string) => void;
  /** The dot glides to any length between the named ones (Cat, 2026-11-06), pausing at each named one as it passes:
   *  `zero` is where a length of 0 cm sits on the drawing, `min` and `max` how far the length goes, `cm` a length
   *  set between the named ones (left out on a named one), and `onCm` sets one. Without it the dot only steps. `from`
   *  says where the length is measured from, over the box a tapped label opens ("from the waist" if left out). */
  free?: { zero: number; min: number; max: number; cm?: number; onCm: (cm: number) => void; from?: string };
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
  /** Where the cloth's left edge is at a height, so a bare name starts clear of it: between trouser legs, the name
   *  printed over the left leg (pretend tester, Nov 18). */
  clearLeft?: (y: number) => number | undefined;
}

/** Room beside the skirt's drawing for its handles' names, in handle sizes, on each side so it stays centred. */
export const MARGIN = 19;

/** How far a hem moves for a finger's travel, in the drawing's units. On a phone the drawing is small, and a finger's
 *  30 px moved a hem 7 in (pretend tester, Nov 18): a finger's first 40 px move it half as far, for fine setting, and
 *  past them it moves as far as the finger, so one drag still runs from the shortest length to the longest. */
export function fingerTravel(d: number, touch: boolean, svg: SVGSVGElement | null): number {
  if (!touch) return d;
  const fine = 40 / (svg?.getScreenCTM()?.d || 1);
  const a = Math.abs(d);
  return Math.sign(d) * (a <= fine ? a / 2 : fine / 2 + (a - fine));
}

/** The mark nearest a height on the drawing. */
const nearest = (marks: HemChoice['marks'], y: number) => marks.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));

export function HemMarks({ name, marks, value, onPick, svg, cx, k, hemAt, bare, free, clearLeft }: Props) {
  const said = useSaid();
  // While dragging, the dot glides (or, without `free`, rides the marks), and catches on each named length it passes,
  // its name popping up on the handle; the garment is redrafted once, where it is let go.
  // `end` says the drag has reached the shortest or the longest length: dragged on past it, the trouser dot just stopped,
  // with nothing to say why (pretend tester DJ walk, Nov 19).
  const [held, setHeld] = useState<{ y: number; on?: string; end?: 'Shortest' | 'Longest' }>();
  // Where a drag began, finger and dot, and whether it is a finger (see fingerTravel). `loose` names a length the drag
  // began close to but not on: it doesn't catch until the dot has left it, or a typed 49.3 cm jumped to the knee's
  // 53 cm at a 6 px nudge (pretend tester DJ walk, Nov 19).
  const grip = useRef<{ from: number; dot: number; touch: boolean; loose?: string }>();
  const named = marks.find((m) => m.id === value) ?? marks[marks.length - 1];
  if (!named) return null;
  const between = free?.cm !== undefined ? free.zero + free.cm : undefined;
  const on = held ? held.on : between === undefined ? named.id : undefined;
  const at = marks.find((m) => m.id === on);
  const y = held ? held.y : hemAt ?? between ?? named.y;
  const cmAt = (yy: number) => Math.round((yy - free!.zero) * 2) / 2;
  // A length set between the named ones reads as set: the dot sits on the hem as drawn, which on a shift's curved hem
  // fell a cm or two lower, so the label said 52 cm for a typed 50 (pretend tester, Nov 17).
  const setAt = held ? y : between ?? named.y;
  // Set, to the millimetre as typed: rounded to the half cm and then the cm, a typed 36 in read 36¼ (pretend tester, Nov 18).
  // A named length says how long it is too, so the number is there before any drag: the shift read just "MINI" (pretend
  // tester, Nov 18). Caught while dragging, the name pops on its own. Spoken, it's one line: "Mini · 41 cm".
  // The box opens on the length as set, not rounded to the half cm as a drag is: a typed 20 in (50.8 cm) reopened as
  // 51 cm, read back as 20⅛ (pretend tester DN walk, Nov 20).
  const typedAt = free ? (held ? cmAt(setAt) : Math.round((setAt - free.zero) * 100) / 100) : 0;
  const cmNow = free ? `${held ? cmAt(setAt) : Math.round((setAt - free.zero) * 10) / 10} cm` : '';
  const spoken = `${at ? (free && !held ? `${at.label}, ${cmNow}` : at.label) : cmNow}${held?.end ? `, ${held.end}` : ''}`;
  const toY = (e: PointerEvent) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()).y;
  const follow = (yy: number) => {
    const near = nearest(marks, yy);
    if (!free) return setHeld({ y: near.y, on: near.id });
    const v = Math.min(free.zero + free.max, Math.max(free.zero + free.min, yy));
    const end = yy > free.zero + free.max ? 'Longest' : yy < free.zero + free.min ? 'Shortest' : undefined;
    const catches = (m: HemChoice['marks'][number]) => Math.abs(m.y - v) < Math.min(CATCH * k, CATCH_SHARE * Math.min(...marks.filter((o) => o !== m).map((o) => Math.abs(o.y - m.y)), Infinity));
    if (grip.current?.loose === near.id && catches(near)) return setHeld({ y: v, end });
    if (grip.current) grip.current.loose = undefined;
    setHeld(catches(near) ? { y: near.y, on: near.id, end } : { y: v, end });
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
  // A bare name ends a clear gap left of the disc, or of the cloth there if it reaches further out.
  const edge = bare ? clearLeft?.(y) : undefined;
  // (The drawing shows past its own frame either side, where the name then sits.)
  const nameEnd = Math.min(dot.x - r - 3.2 * k, edge === undefined ? Infinity : edge - 1.5 * k);
  // A named length says how long it is on a second line, so the number is there before any drag (see `spoken`).
  const label = at ? at.label : cmNow;
  const under = held?.end ?? (at && free && !held ? cmNow : undefined);
  const wordsW = Math.max(label.length, under ? under.length * 0.8 : 0) * 2.6 * k * 0.85;
  // Two lines are lifted so the number ends level with the dot: at full length the dot sits at the window's foot, and
  // "108 CM" under it was cut in half (pretend tester EE walk, Nov 24). Lifted whenever a second line can show, so the
  // name doesn't jump under the finger as the drag starts and the number goes.
  const lift = free ? 3 * k : 0;
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
        <text key={held?.on ?? ''} className={[held?.on ? 'caught' : '', free ? 'typeable' : ''].filter(Boolean).join(' ') || undefined} x={bare ? nameEnd : dot.x + r + 3.2 * k} y={dot.y + 0.9 * k - lift} fontSize={2.6 * k} textAnchor={bare ? 'end' : undefined}>
          {label.toUpperCase()}
          {under && (
            <tspan x={bare ? nameEnd : dot.x + r + 3.2 * k} dy={3 * k} fontSize={2.1 * k}>
              {under.toUpperCase()}
            </tspan>
          )}
        </text>
        {/* Tapped, the length's name opens a box to type it (testers, Nov 17). Under the disc's own hit area, so a drag
            still starts wherever it did. */}
        {free && (
          <LengthTap
            x={bare ? nameEnd - wordsW : dot.x + r + 3.2 * k}
            y={dot.y - 3 * k - lift}
            width={wordsW}
            height={under ? 8 * k : 5 * k}
            ask={{ name, from: free.from ?? 'from the waist', cm: typedAt, min: free.min, max: free.max, onCm: free.onCm }}
          />
        )}
        <circle
          cx={dot.x}
          cy={dot.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={name}
          aria-valuetext={said(spoken)}
          aria-valuemin={1}
          aria-valuemax={marks.length}
          aria-valuenow={at ? marks.indexOf(at) + 1 : marks.indexOf(nearest(marks, y)) + 1}
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            // From the length as set, not the drawn hem below it, so a tap without a drag leaves the length alone.
            setHeld({ y: setAt, on });
            grip.current = { from: toY(e), dot: setAt, touch: e.pointerType === 'touch', loose: on ? undefined : nearest(marks, setAt).id };
          }}
          onPointerMove={(e) => held && grip.current && follow(grip.current.dot + fingerTravel(toY(e) - grip.current.from, grip.current.touch, svg.current))}
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
