// The skirt sketch, shaped by hand: the skirt as cloth on your form, the same drawing as every other
// garment's Form view. Drag the hem to change the length, drag the side seam to change the flare, or
// draw a new hemline across the bottom with a finger.
import { skirtBelt } from '../engine/belt';
import { PointerEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEnlarged } from './EnlargeSketch';
import type { Choices } from '../savedWork';
import { skirtFlat, wornLines, wornShapes } from '../engine/flat';
import type { P } from '../engine/geometry';
import { HEM_SAMPLES, HemShape, flatHem, isShaped, offsetAt } from '../engine/hem';
import { LengthTap, useSaid } from './LengthEntry';
import { LENGTHS, Length, Silhouette, SkirtDraft, SkirtMeasurements, flareRange, isCircle, draftedMeasures, lengthRange, presetFlare } from '../engine/skirt';
import { GROUPS } from '../skirtChoices';
import { skirtForm } from './DrawOnForm';
import { FormLayers, SQUEEZE, formFrame, hemCorner, wornCloth, wornFolds, wornMapper } from './FormSketch';
import { CATCH, CATCH_SHARE, MARGIN, fingerTravel } from './HemMarks';
import { useLengthStep, useNarrow } from './StyleLayout';

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
  // Pleats, godets or a flounce: the skirt as it hangs, before they were drafted in. Pieces cut whole
  // are sketched from the halves they were drafted from.
  const pc = (draft.block ?? draft.halves ?? draft.closed ?? draft.pieces)[side === 'front' ? 0 : 1];
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

/** A dragged (or typed) length. A drag is kept to the half cm; a typed length passes `exact`, so it is kept as typed:
 *  rounded to the half cm, a typed 21 3/4 in came back as 21⅞ on the skirt alone (pretend tester, Nov 18). */
export function dragLength(m: SkirtMeasurements, c: Choices, cm: number, catchCm = 1.5, exact = false): Choices {
  const v = lengthRange(m).clamp(cm);
  const named = LENGTH_IDS.map((id) => ({ id, at: LENGTHS[id](m) })).sort((a, b) => Math.abs(a.at - v) - Math.abs(b.at - v))[0];
  const { look: _look, lengthCm: _l, kneeShare: _k, floorClear: _f, ...rest } = c;
  return Math.abs(named.at - v) < catchCm ? { ...rest, length: named.id } : { ...rest, length: named.id, lengthCm: exact ? Math.round(v * 100) / 100 : Math.round(v * 2) / 2 };
}

/** A dragged flare: moves between pencil, straight and A-line, snapping to each one's own shape. */
export function dragFlare(m: SkirtMeasurements, c: Choices, length: number, cm: number): Choices {
  const { look: _look, flareCm: _f, ...rest } = c;
  const range = flareRange(m, length, c.silhouette);
  const v = Math.min(range.max, Math.max(range.min, cm));
  // A trumpet or a slip keeps its own shape, flaring more or less.
  const own = c.silhouette === 'trumpet' || c.silhouette === 'slip';
  const options: Silhouette[] = own ? [c.silhouette] : ['pencil', 'straight', 'a_line'];
  for (const s of options) {
    if (Math.abs(presetFlare(m, length, s) - v) < 0.8) return { ...rest, silhouette: s };
  }
  const silhouette = own ? c.silhouette : v < -0.75 ? 'pencil' : v <= 0.75 ? 'straight' : 'a_line';
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

type Drag = { kind: 'hem' | 'side'; start: P; before: Choices; base: Choices; length: number; flare: number; touch: boolean; loose?: number };

/** A shape matched from a photo is pinned to proportions; dragging lets go of it, keeping the length
 * and flare it had so the skirt doesn't jump. */
function unpin(c: Choices, draft: SkirtDraft): Choices {
  if (!c.shape) return c;
  const { shape: _shape, ...rest } = c;
  return { ...rest, lengthCm: draft.lengthCm, ...(draft.flareCm !== undefined ? { flareCm: draft.flareCm } : {}) };
}

export function ShapeSketch({ draft, m, choices, side, drawing, label, onLive, onDone }: Props) {
  const said = useSaid();
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const [stroke, setStroke] = useState<P[]>();
  const live = useRef<Choices>(choices);
  live.current = choices;

  const circle = isCircle(choices.silhouette);
  // The hem as it hangs, for reading a drawn hem against.
  const w = useMemo(() => worn(draft, side), [draft, side]);
  const body = useMemo(() => skirtForm(m), [m]);
  // Lengths count from the skirt's top: below the waist on a low-rise skirt (the draft's own measurements).
  const dm = useMemo(() => draftedMeasures(m, choices), [m, choices]);
  // The skirt as cloth on the form: its technical flat's shapes for this side, laid on the form as worn.
  const flat = useMemo(() => skirtFlat(draft, skirtBelt(choices.belt, draft)), [draft, choices.belt]);
  const view = side === 'front' ? 0 : 1;
  const flatCloth = useMemo(() => wornShapes(flat, view), [flat, view]);
  const cloth = useMemo(() => wornCloth(flatCloth, body), [flatCloth, body]);
  const folds = useMemo(() => wornFolds(flatCloth, cloth), [flatCloth, cloth]);
  const lines = useMemo(() => {
    const map = wornMapper(flatCloth, body);
    return { seam: wornLines(flat, view).map((run) => run.map(map)) };
  }, [flat, view, flatCloth, body]);

  // The frame stays put while dragging, sized for the longest and widest the skirt can go, so the
  // handle stays under the finger. Knee and floor lines show where the hem falls on the body.
  const frame = useMemo(() => {
    const hipQ = draft.finishedHip / 4;
    const longest = lengthRange(m).max;
    const block = hipQ + Math.max(10, (longest - m.waist_to_hip) * 0.45) * 0.8;
    const bell = draft.circleShare ? draft.finishedWaist / 4 + longest * (0.25 + 0.4 * draft.circleShare) : 0;
    const base = formFrame(m, body, m.waist_to_floor + 6, undefined, cloth);
    return { half: Math.max(base.half, SQUEEZE * (block + 4), SQUEEZE * (bell + 4)), top: base.top, bottom: base.bottom };
  }, [draft.finishedHip, draft.finishedWaist, draft.circleShare, m, body, cloth]);

  const cx = frame.half;
  // Enlarged, the skirt fills the screen (Cat's E2, 2026-10-25): from just above the waist to a little past the hem,
  // as wide as the skirt. It holds still while a handle is dragged, and reframes once it's let go.
  const big = useEnlarged();
  // On a phone the skirt is framed like the enlarged view, from just above the waist to past the hem, so it fills its
  // window instead of a quarter of it (clarity review C8, Nov 22). The length step keeps the whole figure to the floor,
  // so the hem can be dragged to every length.
  const lengthStep = useLengthStep();
  const narrow = useNarrow();
  const crop = big || (narrow && !lengthStep);
  const held = useRef(frame);
  if (!drag) {
    const pts = cloth.flat();
    const wide = SQUEEZE * Math.max(...pts.map((q) => Math.abs(q.x)), m.waist / 4) + 6;
    const low = Math.max(...pts.map((q) => q.y), m.waist_to_hip ?? 20);
    // On a phone's length step the figure still reaches the floor, so every length can be dragged to, but starts just
    // above the waist: with the head in, its labels were about 6 px and the drawing ran into Draw (pretend tester, Nov 22).
    held.current = crop ? { half: frame.half, left: cx - wide, width: 2 * wide, top: -16, bottom: Math.min(frame.bottom, low + 9) } as typeof frame : narrow && !big ? { ...frame, top: -32 } : frame;
  }
  const shown = held.current as typeof frame & { left?: number; width?: number };
  // Handle and label size, in proportion to the sketch. Cropped on a phone the sketch is shorter, so they are scaled
  // back up to the size they had beside the whole figure, or the names under the dots were too small to read.
  // Never under 11 px on the screen, whatever the window's size: on a 360 phone the length and width words came out
  // about 6 px, sitting on the leg (pretend tester EF walk, Nov 24). The screen's pixels per drawing unit are measured.
  const [ppu, setPpu] = useState(0);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => {
      const a = el.getScreenCTM()?.a ?? 0;
      // (Only a real change: the drawing's frame can shift by a hair as the words grow.)
      setPpu((was) => (a > 0 && Math.abs(a - was) > was * 0.05 ? a : was));
    };
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const k = Math.max((shown.bottom - shown.top) / (narrow && !big ? 75 : 110), ppu ? 11 / (2.6 * ppu) : 0);
  // The handles sit on the skirt as drawn: its hem at the centre, and the hem's outer corner.
  const skirt = cloth[0] ?? [];
  const hemCentre = skirt.length ? skirt.reduce((a, b) => (b.y > a.y ? b : a)) : { x: 0, y: draft.lengthCm };
  const hemSide = hemCorner(skirt) ?? { x: w.hem[0].x, y: w.hem[0].y };

  // Dragged, the hem catches on each named length as on every garment: a finger's few millimetres either side of it.
  const marksAt = LENGTH_IDS.map((id) => LENGTHS[id](dm)).sort((a, b) => a - b);
  const catchCm = Math.min(CATCH * k, CATCH_SHARE * Math.min(...marksAt.slice(1).map((y, i) => y - marksAt[i])));
  const toSvg = (e: PointerEvent): P => {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: pt.x, y: pt.y };
  };

  const startDrag = (kind: Drag['kind']) => (e: PointerEvent) => {
    if (drawing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    // A length set close to a named one, not on it, doesn't catch on it until the drag has left it: a typed 49.3 cm
    // jumped to the knee's 53 cm at a 6 px nudge (pretend tester DJ walk, Nov 19). `loose` is that named length.
    const near = marksAt.reduce((a, b) => (Math.abs(b - draft.lengthCm) < Math.abs(a - draft.lengthCm) ? b : a));
    const loose = kind === 'hem' && (choices.lengthCm || choices.kneeShare || choices.floorClear) && Math.abs(near - draft.lengthCm) < catchCm ? near : undefined;
    setDrag({ kind, start: toSvg(e), before: choices, base: unpin(choices, draft), length: draft.lengthCm, flare: draft.flareCm ?? 0, touch: e.pointerType === 'touch', loose });
  };

  const move = (e: PointerEvent) => {
    if (drag) {
      const at = toSvg(e);
      const cm = drag.length + fingerTravel(at.y - drag.start.y, drag.touch, svg.current);
      if (drag.loose !== undefined && Math.abs(cm - drag.loose) >= catchCm) drag.loose = undefined;
      const next =
        drag.kind === 'hem'
          ? // Finer for a finger, as on the other drawings (see fingerTravel).
            dragLength(dm, drag.base, cm, drag.loose === undefined ? catchCm : 0)
          : dragFlare(dm, drag.base, draft.lengthCm, drag.flare + ((at.x - drag.start.x) * (drag.start.x >= cx ? 1 : -1)) / SQUEEZE);
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
        const pts = stroke.map((q) => ({ x: (q.x - cx) / SQUEEZE, y: q.y }));
        const hem = { ...current, [side]: strokeToHem(pts, w.hem, current[side]) };
        // A drawn hem replaces a high-low or diagonal one.
        const { look: _look, asymHem: _asym, ...rest } = choices;
        onDone(choices, isShaped(hem) ? { ...rest, hem } : { ...rest, hem: undefined });
      }
      setStroke(undefined);
    }
  };

  // A named length says its length too, as the dress's and trousers' do ("Knee · 59 cm"): the skirt's "Knee" alone
  // read as a 9 cm jump with no number to check it by (pretend tester DI walk, Nov 19).
  const lengthLabel = choices.lengthCm || choices.kneeShare || choices.floorClear ? `${Math.round(draft.lengthCm * 10) / 10} cm` : `${lengthName(choices.length)} · ${Math.round(draft.lengthCm * 10) / 10} cm`;
  const flareLabel = choices.flareCm !== undefined ? `${choices.flareCm > 0 ? '+' : ''}${choices.flareCm} cm` : silName(choices.silhouette);
  const guide = (y: number, text: string) => (
    <g className="guide">
      <line x1={0} x2={2 * cx} y1={y} y2={y} strokeWidth={0.15} strokeDasharray={`${k} ${k}`} />
      <text x={1} y={y - 0.8} fontSize={2.4 * k}>
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
    // A named length is its own word for what the dot sets ("↕ Knee · 56.6 cm"), and short enough on a phone.
    const words = kind === 'hem' ? (text.includes(' · ') ? `↕ ${text}` : `↕ Length · ${text}`) : `↔ Width · ${text}`;
    // Cropped close on a phone, "Width · A-line" ran off the drawing's right edge ("A-LIN", Nov 23): when it won't fit
    // beside the disc it sits just above it instead, ending at the edge.
    const right = shown.width ? shown.left! + shown.width : 2 * cx + MARGIN * k;
    const above = kind === 'side' && at.x + r + 3.2 * k + words.length * 2.6 * k * 0.85 > right;
    return (
      <g className={active ? 'handle on' : 'handle'}>
        <circle cx={at.x} cy={at.y} r={r} strokeWidth={0.22} />
        <circle cx={at.x} cy={at.y} r={0.45 * k} className="dot" />
        <path d={arrows} strokeWidth={0.22} fill="none" />
        {/* Each handle says what it does (Cat's H, 2026-11-02): Length to the left of the hem's (beside it, not under it
            across the legs: Cat, Nov 11), Width to the right of the side's, so the two never run into each other. */}
        {/* Caught on a named length while dragging (dragLength holds it there), its name pops, as on every garment. */}
        <text
          key={active && kind === 'hem' && !choices.lengthCm ? choices.length : ''}
          className={[active && kind === 'hem' && !choices.lengthCm ? 'caught' : '', kind === 'hem' && !drawing ? 'typeable' : ''].filter(Boolean).join(' ') || undefined}
          // A clear gap from the disc (Cat, Nov 11 sweep: the disc sat on the last letter, "KNE").
          x={kind === 'hem' ? at.x - r - 3.2 * k : above ? right - k : at.x + r + 3.2 * k}
          y={above ? at.y - r - 2.4 * k : at.y + 0.9 * k}
          fontSize={2.6 * k}
          textAnchor={kind === 'hem' || above ? 'end' : 'start'}
        >
          {words.toUpperCase()}
        </text>
        {/* Tapped, the length's words open a box to type it (testers, Nov 17). Under the disc's own hit area, so a drag
            still starts wherever it did. */}
        {kind === 'hem' && !drawing && (
          <LengthTap
            x={at.x - r - 3.2 * k - words.length * 2.6 * k * 0.85}
            y={at.y - 3 * k}
            width={words.length * 2.6 * k * 0.85}
            height={5 * k}
            ask={{
              name: 'Skirt length',
              // Where the top sits, too: a tester typed her waist-to-knee and got a skirt about 5 cm long (pretend tester DM
              // walk, Nov 19).
              from: choices.rise === 'low' && draft.lowRise ? `from the top of the skirt, ${Math.round(draft.lowRise * 10) / 10} cm below your waist` : choices.rise === 'low' ? 'from the top of the skirt' : 'from the waist',
              cm: draft.lengthCm,
              min: lengthRange(dm).min,
              max: lengthRange(dm).max,
              onCm: (cm) => onDone(choices, dragLength(dm, unpin(choices, draft), cm, 0, true)),
            }}
          />
        )}
        <circle
          cx={at.x}
          cy={at.y}
          r={6.5 * k}
          className="hit"
          role="slider"
          aria-label={kind === 'hem' ? 'Skirt length' : 'Flare at the hem'}
          aria-valuetext={said(text)}
          aria-valuenow={kind === 'hem' ? draft.lengthCm : draft.flareCm ?? 0}
          tabIndex={0}
          onPointerDown={startDrag(kind)}
          onKeyDown={(e) => {
            const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            const base = unpin(choices, draft);
            const next = kind === 'hem' ? dragLength(dm, base, draft.lengthCm + step * 2) : dragFlare(dm, base, draft.lengthCm, (draft.flareCm ?? 0) + step);
            onDone(choices, next);
          }}
        />
      </g>
    );
  };

  return (
    <svg
      ref={svg}
      // Room either side for the handles' names, keeping the form centred.
      viewBox={shown.width ? `${shown.left} ${shown.top} ${shown.width} ${shown.bottom - shown.top}` : `${-MARGIN * k} ${shown.top} ${2 * cx + 2 * MARGIN * k} ${shown.bottom - shown.top}`}
      // A group, not an image: an image hides the length and flare handles inside it from screen readers.
      role="group"
      aria-label={label}
      className={drawing ? 'preview-svg sketch shape form-still drawing' : 'preview-svg sketch shape form-still'}
      onPointerDown={(e) => {
        if (!drawing) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setStroke([toSvg(e)]);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <FormLayers body={body} m={m} legs cx={cx} top={frame.top} bottom={frame.bottom} lines={lines} worn={cloth} folds={folds} />
      {/* Its word steps aside when the length's own label comes down beside it (cold read EE, Nov 24: "96 CM" on "FLOOR"). */}
      {guide(m.waist_to_floor, !drawing && Math.abs(m.waist_to_floor - hemCentre.y) < 6 * k ? '' : 'FLOOR')}
      {!drawing && handle({ x: cx + SQUEEZE * hemCentre.x, y: hemCentre.y }, 'hem', lengthLabel)}
      {!drawing && !circle && choices.silhouette !== 'gathered' && handle({ x: cx + SQUEEZE * hemSide.x, y: hemSide.y }, 'side', flareLabel)}
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
