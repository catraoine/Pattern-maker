// Draw on your form: a dress form built from your measurements, in fine contour lines, with the
// garment's neckline, seams, drape, side and hem drawn on it like a draper's style tape. Turn it to
// the back, draw a new line with a finger, and the pattern follows it (see formLines.ts for how each
// line is read). What a line will become shows while it is drawn; each line can be undone.
import { PointerEvent, useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';
import { bodyOutline, spline } from './bodyOutline';
import { FormLine, FormSide, Reading, landmarks } from './formLines';
import type { SkirtMeasurements } from '../engine/skirt';

type Measures = { full_bust?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number };

/** The form's outline: half its width at each height, from its top to where it ends above the stand or legs. */
export interface FormBody {
  width: (y: number) => number;
  top: number;
  bottom: number;
  waistY: number;
}

interface Props<C> {
  body: FormBody;
  m: Measures;
  /** Legs below the form (a dress or skirt), down to `bottom`; otherwise the form stands on its pole. */
  legs: boolean;
  /** How far down the drawing goes, in the form's coordinates. */
  bottom: number;
  /** The kinds of line this garment takes, with their names. */
  kinds: [FormLine, string][];
  /** The garment's lines as they stand, front or back, in cm with the centre at x = 0. */
  lines: (side: FormSide) => Partial<Record<FormLine, P[][]>>;
  choices: C;
  /** Applies new choices as each line is drawn (the screen keeps one undo step for the whole drawing). */
  onChoices: (c: C) => void;
  /** Reads a line: what it would become, and in words. */
  read: (kind: FormLine, side: FormSide, stroke: P[]) => Reading<C>;
  onDone: () => void;
  onCancel: () => void;
}

const HELP: Record<FormLine, string> = {
  neckline: 'Draw the neckline from the shoulder down to where you want it. Both sides match. From one shoulder across to under the other arm makes it one-shoulder.',
  seam: 'Draw from the shoulder or armhole through the bust to the waist for princess seams, or from any edge to the bust for a dart. They start where you draw them.',
  drape: 'Draw how the cloth hangs: dipping across the neck from shoulder to shoulder for a cowl, or flaring out from the waist for a peplum (wavy for gathers).',
  fit: 'Draw down the side, closer to the body for a closer fit or further out for more room.',
  hem: 'Draw across where you want the hem. Curve it to shape it, or turn to the back and draw it lower for a high-low hem.',
};
const BACK_HELP: Partial<Record<FormLine, string>> = {
  neckline: 'Draw down the back to set how low the back neckline goes.',
  seam: 'Draw a princess seam from the shoulder or armhole down to the waist.',
  hem: 'Draw the back hem. Lower than the front makes a high-low hem.',
};
/** Kinds that are drawn on the front only. */
const FRONT_ONLY: FormLine[] = ['drape', 'fit'];

const f = (n: number) => n.toFixed(2);
const path = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** The bodice form: the neck, a rounded shoulder, then bust, waist and hip, from the drafted block. */
export function formWidth(draft: BodiceDraft, m: Measures & { full_bust: number }): FormBody {
  const { neckPoint, shoulderTip, apex, waistY } = landmarks(draft);
  const neck = neckPoint.x * 0.85;
  const bust = m.full_bust / 4;
  const hip = m.full_hip && m.waist_to_hip ? { at: waistY + m.waist_to_hip, half: m.full_hip / 4 } : undefined;
  const body = spline([
    [shoulderTip.y, shoulderTip.x],
    [(shoulderTip.y + apex.y) / 2, bust * 0.96],
    [apex.y, bust],
    [waistY, m.waist / 4],
    ...(hip
      ? ([[waistY + (hip.at - waistY) / 2, (m.waist / 4 + hip.half) / 2 + 0.4], [hip.at, hip.half], [hip.at + 8, hip.half * 0.97]] as [number, number][])
      : ([[waistY + 8, (m.waist / 4) * 1.08]] as [number, number][])),
  ]);
  const bottom = hip ? hip.at + 8 : waistY + 8;
  const width = (y: number) => {
    if (y <= neckPoint.y) return neck;
    if (y <= shoulderTip.y) {
      const t = (y - neckPoint.y) / Math.max(0.1, shoulderTip.y - neckPoint.y);
      return neck + (shoulderTip.x - neck) * (1 - (1 - t) ** 2);
    }
    return body(Math.min(y, bottom));
  };
  return { width, top: neckPoint.y - 7, bottom, waistY };
}

/** The skirt form: a lower torso from a little above the waist to below the hip, the waist at y = 0. */
export function skirtForm(m: { waist: number; full_hip: number; waist_to_hip: number }): FormBody {
  const w = m.waist / 4;
  const h = m.full_hip / 4;
  const body = spline([
    [-12, w * 1.1],
    [0, w],
    [m.waist_to_hip / 2, (w + h) / 2 + 0.4],
    [m.waist_to_hip, h],
    [m.waist_to_hip + 8, h * 0.97],
  ]);
  return { width: body, top: -12, bottom: m.waist_to_hip + 8, waistY: 0 };
}

export function DrawOnForm<C>({ body, m, legs, bottom, kinds, lines, choices, onChoices, read, onDone, onCancel }: Props<C>) {
  const svg = useRef<SVGSVGElement>(null);
  const [kind, setKind] = useState<FormLine>(kinds[0][0]);
  const [side, setSide] = useState<FormSide>('front');
  const [stroke, setStroke] = useState<P[]>();
  const [said, setSaid] = useState<string>();
  const [live, setLive] = useState<string>();
  /** The choices before each line, newest last, for undoing one line at a time. */
  const [steps, setSteps] = useState<C[]>([]);
  const onBack = side === 'back' && FRONT_ONLY.includes(kind) ? false : side === 'back';

  const frame = useMemo(() => {
    const half = Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 7;
    return { half, top: body.top - 2, bottom: Math.max(body.bottom + 12, bottom) };
  }, [m, body, bottom]);
  const cx = frame.half;

  // The form in contour lines, as on the welcome screen: each line a fixed fraction of the way round.
  const contours = useMemo(() => {
    const n = 15;
    const ys = Array.from({ length: 121 }, (_, i) => body.top + ((body.bottom - body.top) * i) / 120);
    return Array.from({ length: n }, (_, i) => {
      const u = Math.sin(-Math.PI / 2 + (Math.PI * i) / (n - 1));
      return { d: path(ys.map((y) => ({ x: cx + u * body.width(y), y }))), edge: Math.abs(u) > 0.98, u };
    });
  }, [body, cx]);

  const current = lines(side);
  const at = (pts: P[]) => path(pts.map((q) => ({ x: cx + q.x, y: q.y })));

  const toSvg = (e: PointerEvent): P => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };
  const centred = (s: P[]) => s.map((q) => ({ x: q.x - cx, y: q.y }));
  const move = (e: PointerEvent) => {
    if (!stroke) return;
    const next = [...stroke, toSvg(e)];
    setStroke(next);
    // What the line will become, as it is drawn.
    if (next.length > 4 && next.length % 4 === 0) setLive(read(kind, side, centred(next)).said);
  };
  const end = () => {
    if (!stroke) return;
    if (stroke.length > 2) {
      const r = read(kind, side, centred(stroke));
      if (r.choices) {
        setSteps([...steps, choices]);
        onChoices(r.choices);
      }
      setSaid(r.said);
    }
    setStroke(undefined);
    setLive(undefined);
  };
  const undoLine = () => {
    const prev = steps[steps.length - 1];
    if (prev === undefined) return;
    setSteps(steps.slice(0, -1));
    onChoices(prev);
    setSaid('Last line undone.');
  };
  const pick = (k: FormLine) => {
    setKind(k);
    setSaid(undefined);
    if (FRONT_ONLY.includes(k)) setSide('front');
  };
  const help = (onBack && BACK_HELP[kind]) || HELP[kind];

  return (
    <div className="form-draw">
      <div className="screen-head">
        <div>
          <p className="eyebrow">Drape · Your form</p>
          <h1>Draw your lines</h1>
        </div>
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <section className="card" aria-label="Your dress form">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Side of the form">
            {(['front', 'back'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={side === s}
                className={side === s ? 'on' : ''}
                disabled={s === 'back' && FRONT_ONLY.includes(kind)}
                onClick={() => {
                  setSide(s);
                  setSaid(undefined);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={undoLine} disabled={!steps.length} aria-label="Undo the last line">
            Undo line
          </button>
        </div>
        <div className="preview">
          <svg
            ref={svg}
            viewBox={`0 ${f(frame.top)} ${f(2 * cx)} ${f(frame.bottom - frame.top)}`}
            role="img"
            aria-label={`Your dress form from the ${side}, built from your measurements. ${help}`}
            className="preview-svg sketch shape drawing form-svg"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setStroke([toSvg(e)]);
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => {
              setStroke(undefined);
              setLive(undefined);
            }}
          >
            {legs && m.full_hip && m.waist_to_hip && m.waist_to_knee && m.waist_to_floor && (
              <g transform={`translate(0 ${f(body.waistY)})`}>
                <path d={bodyOutline(m as SkirtMeasurements, cx)} className="form-legs" fill="none" strokeWidth={0.18} />
              </g>
            )}
            {!legs && (
              <path
                d={`M${f(cx)} ${f(body.bottom)} L${f(cx)} ${f(frame.bottom - 2)} M${f(cx - 8)} ${f(frame.bottom - 2)} L${f(cx + 8)} ${f(frame.bottom - 2)}`}
                className="form-stand"
                fill="none"
                strokeWidth={0.2}
              />
            )}
            {contours.map((c, i) => (
              <path key={i} d={c.d} className="form-line" fill="none" strokeWidth={c.edge ? 0.22 : 0.12} opacity={c.edge ? 0.9 : 0.25 + 0.2 * (1 - Math.abs(c.u))} />
            ))}
            {kinds.map(([id]) =>
              (current[id] ?? []).map((pts, i) => (
                <path key={`${id}${i}`} d={at(pts)} className={id === kind ? 'tape on' : 'tape'} fill="none" strokeWidth={id === kind ? 0.42 : 0.22} strokeLinecap="round" />
              )),
            )}
            {side === 'back' && (
              <text x={cx} y={frame.top + 3} fontSize={1.8} textAnchor="middle" className="hint">
                BACK
              </text>
            )}
            {stroke && <polyline points={stroke.map((q) => `${f(q.x)},${f(q.y)}`).join(' ')} className="stroke" strokeWidth={0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
        <div className="chips" role="group" aria-label="What you are drawing">
          {kinds.map(([id, label]) => (
            <button key={id} type="button" className={kind === id ? 'chip on' : 'chip'} aria-pressed={kind === id} onClick={() => pick(id)}>
              {label}
            </button>
          ))}
        </div>
        <p className="muted small form-said" role="status">
          {live ?? said ?? help}
        </p>
        <button type="button" className="primary" onClick={onDone}>
          Make the pattern
        </button>
      </section>
    </div>
  );
}
