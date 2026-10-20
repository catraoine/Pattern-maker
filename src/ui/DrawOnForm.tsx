// Draw on your form: a dress form built from your measurements, in fine contour lines, with the
// garment's neckline, seams, drape, side and hem drawn on it like a draper's style tape. Turn it to
// the back, draw a new line with a finger, and the pattern follows it (see formLines.ts for how each
// line is read). What a line will become shows while it is drawn; each line can be undone and redone.
// One way out each way (Cat's pick D1 Steady Top, 2026-10-18): Done keeps the lines, and the header's ←
// (or the phone's back) leaves without them, asking first once any line is drawn.
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';
import { spline } from './bodyOutline';
import { legsFor } from '../engine/form';
import { FormLine, FormSide, Reading, landmarks } from './formLines';
import { TestingTag } from './TestingTag';

type Measures = { full_bust?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number; crotch_depth?: number };

/** The form's outline: half its width at each height, from its top to where it ends above the stand or legs. */
export interface FormBody {
  width: (y: number) => number;
  top: number;
  bottom: number;
  waistY: number;
}

/** An arm hanging beside the form, as on the bodice sketch: from the shoulder tip, rounding over to
 * hang just clear of the underarm, `width` across at the top, `elbowWidth` at the elbow and `wristWidth`
 * at the wrist, each from its own round (see armFor). */
export interface FormArm {
  tip: P;
  under: P;
  elbowY: number;
  wristY: number;
  width: number;
  elbowWidth: number;
  wristWidth: number;
}

/** An arm from your measurements: your arm length from the shoulder tip down to the wrist, the elbow a
 * little past halfway, and widths from your upper arm, elbow and wrist rounds, drawn true to size. The
 * elbow, which isn't measured, sits between the upper arm and the wrist. */
export function armFor(tip: P, under: P, m: { arm_length: number; upper_arm: number; wrist?: number }): FormArm {
  const wrist = m.wrist ?? m.upper_arm * 0.55;
  const elbow = (m.upper_arm + wrist) / 2 + 1.5;
  return {
    tip,
    under,
    elbowY: tip.y + m.arm_length * 0.56,
    wristY: tip.y + m.arm_length,
    width: m.upper_arm / Math.PI,
    elbowWidth: elbow / Math.PI,
    wristWidth: wrist / Math.PI,
  };
}

/** Where the arm's inner and outer edges sit at the height y (the right arm; the left mirrors it). */
export function armAt(arm: FormArm, y: number): { inner: number; outer: number } {
  const { tip, under, elbowY, wristY, width, elbowWidth, wristWidth } = arm;
  // The arm hangs a little away from the body, more so towards the hand.
  const inner = under.x + 0.6 + 0.04 * Math.max(0, y - under.y);
  if (y < under.y) {
    // Over the top of the arm, like a shoulder cap: rounding out from the shoulder tip to the arm's own
    // width, beside the body as it widens from the shoulder down to the underarm.
    const t = Math.min(1, Math.max(0, (y - tip.y) / Math.max(1, under.y - tip.y)));
    const side = tip.x + (under.x - tip.x) * Math.sin((t * Math.PI) / 2);
    return { inner, outer: side + (0.6 + width) * Math.sin((t * Math.PI) / 2) };
  }
  // Fullest just under the arm, narrowing to the elbow, then to the wrist.
  const across =
    y <= elbowY
      ? width + (elbowWidth - width) * Math.sin(((y - under.y) / Math.max(1, elbowY - under.y)) * (Math.PI / 2)) ** 2
      : elbowWidth + (wristWidth - elbowWidth) * Math.min(1, (y - elbowY) / Math.max(1, wristY - elbowY));
  return { inner, outer: inner + across };
}

interface Props<C> {
  body: FormBody;
  m: Measures;
  /** Legs below the form (a dress, skirt or coat), drawn to your lengths down to the floor; otherwise the form stands on its pole. */
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
  /** What to draw for each kind, where this garment reads a line its own way. */
  help?: Partial<Record<FormLine, string>>;
  /** Whether any line goes on the back; without, the form shows its front only. */
  backs?: boolean;
  /** Arms beside the form, for a sleeve line. */
  arms?: FormArm;
  onDone: () => void;
  onCancel: () => void;
}

const HELP: Record<FormLine, string> = {
  neckline: 'Draw the neckline from the shoulder down to where you want it. Both sides match. From one shoulder across to under the other arm makes it one-shoulder.',
  seam: 'Draw from the shoulder or armhole through the bust to the waist for princess seams, or from any edge to the bust for a dart. They start where you draw them.',
  drape: 'Draw how the cloth hangs: dipping across the neck from shoulder to shoulder for a cowl, or flaring out from the waist for a peplum (wavy for gathers).',
  fit: 'Draw down the side, closer to the body for a closer fit or further out for more room.',
  hem: 'Draw across where you want the hem. Curve it to shape it, or turn to the back and draw it lower for a high-low hem.',
  sleeve: 'Draw across the arm where you want the sleeve to end.',
  front: 'Draw down the front where its edge should sit: just past the centre for one row of buttons, further across for two.',
  collar: 'Draw from the shoulder down the front: down to the bust for lapels, round to the centre for a collarless neck.',
};
const BACK_HELP: Partial<Record<FormLine, string>> = {
  neckline: 'Draw down the back to set how low the back neckline goes.',
  seam: 'Draw a princess seam from the shoulder or armhole down to the waist.',
  hem: 'Draw the back hem. Lower than the front makes a high-low hem.',
};
/** Kinds that are drawn on the front only. */
const FRONT_ONLY: FormLine[] = ['drape', 'fit'];

/** Marks the drawing's own entry in the browser's history. */
const DRAWING = 'drawing';

const f = (n: number) => n.toFixed(2);
const path = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** The bodice form: the neck, a rounded shoulder, then bust, waist and hip, from the drafted block. */
export function formWidth(draft: BodiceDraft, m: Measures & { full_bust: number }): FormBody {
  return torsoForm(landmarks(draft), m);
}

/** A torso form through the body's own landmarks: the neck point, the shoulder tip, the bust's height and the waist's. */
export function torsoForm({ neckPoint, shoulderTip, apex, waistY }: { neckPoint: P; shoulderTip: P; apex: P; waistY: number }, m: Measures & { full_bust: number }): FormBody {
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

export function DrawOnForm<C>({ body, m, legs, bottom, kinds, lines, choices, onChoices, read, help: helpFor, backs = true, arms, onDone, onCancel }: Props<C>) {
  const svg = useRef<SVGSVGElement>(null);
  const [kind, setKind] = useState<FormLine>(kinds[0][0]);
  const [side, setSide] = useState<FormSide>('front');
  const [stroke, setStroke] = useState<P[]>();
  const [said, setSaid] = useState<string>();
  const [live, setLive] = useState<string>();
  /** The choices before each line, newest last, for undoing one line at a time; and the lines undone, to redo. */
  const [steps, setSteps] = useState<C[]>([]);
  const [undone, setUndone] = useState<C[]>([]);
  /** Asking whether to leave without the lines, after ← or the phone's back. */
  const [asking, setAsking] = useState(false);
  const drawn = useRef(0);
  drawn.current = steps.length;
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const leaving = useRef(false);

  // Drawing is its own entry in the history, so ← and the phone's back come here first instead of
  // leaving the style screen with the lines still on it.
  useEffect(() => {
    const entry = () => {
      const now = (window.history.state ?? {}) as { sub?: unknown; depth?: number };
      return { ...now, sub: DRAWING, depth: (now.depth ?? 0) + 1 };
    };
    if ((window.history.state as { sub?: unknown } | null)?.sub !== DRAWING) window.history.pushState(entry(), '');
    const on = () => {
      if (leaving.current) return;
      if (drawn.current > 0) {
        // Stay, and ask: the lines go only when you say so.
        window.history.pushState(entry(), '');
        setAsking(true);
      } else {
        leaving.current = true;
        cancel.current();
      }
    };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  /** Leave by Done or "Leave without them": take the drawing's entry off the history, then go. */
  const leave = (then: () => void) => {
    leaving.current = true;
    if ((window.history.state as { sub?: unknown } | null)?.sub === DRAWING) window.history.back();
    then();
  };
  const onBack = side === 'back' && FRONT_ONLY.includes(kind) ? false : side === 'back';

  // The legs to your measurements, from where they part down to the floor (cm below the waist).
  const legLines = useMemo(() => {
    if (!legs || !m.full_hip || !m.waist_to_hip || !m.waist_to_knee || !m.waist_to_floor) return undefined;
    const lg = legsFor(m as Parameters<typeof legsFor>[0]);
    const y0 = body.waistY;
    return { ...lg, crotch: y0 + lg.crotch, floor: y0 + lg.floor, at: (y: number) => lg.half(y - y0) };
  }, [legs, m, body]);
  // With legs, the body runs on down to where they part.
  const torsoBottom = legLines ? Math.max(body.bottom, legLines.crotch) : body.bottom;

  const frame = useMemo(() => {
    const half = Math.max(Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 7, arms ? armAt(arms, arms.wristY).outer + 2 : 0);
    return { half, top: body.top - 2, bottom: Math.max(torsoBottom + 12, bottom, legLines ? legLines.floor + 1 : 0) };
  }, [m, body, bottom, arms, torsoBottom, legLines]);
  const cx = frame.half;

  // The form in contour lines, as on the welcome screen: each line a fixed fraction of the way round.
  const contours = useMemo(() => {
    const n = 15;
    const ys = Array.from({ length: 121 }, (_, i) => body.top + ((torsoBottom - body.top) * i) / 120);
    return Array.from({ length: n }, (_, i) => {
      const u = Math.sin(-Math.PI / 2 + (Math.PI * i) / (n - 1));
      return { d: path(ys.map((y) => ({ x: cx + u * body.width(y), y }))), edge: Math.abs(u) > 0.98, u };
    });
  }, [body, cx, torsoBottom]);

  // Each leg its outline, from where the legs part down to the floor, and lines down it as on the measuring pages.
  const legPaths = useMemo(() => {
    if (!legLines) return [];
    const { crotch, floor, apart, at: halfAt } = legLines;
    const ys = Array.from({ length: 81 }, (_, i) => crotch + ((floor - crotch) * i) / 80);
    return [1, -1].flatMap((s) =>
      [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1].map((k) => ({
        d: path(ys.map((y) => ({ x: cx + s * (apart + k * halfAt(y)), y }))),
        edge: Math.abs(k) === 1,
      })),
    );
  }, [legLines, cx]);

  // The arms, each its outline round from the shoulder to the wrist and three lines down it.
  const armLines = useMemo(() => {
    if (!arms) return [];
    const ys = (a: number, b: number) => Array.from({ length: 41 }, (_, i) => a + ((b - a) * i) / 40);
    const outer = ys(arms.tip.y, arms.wristY).map((y) => ({ x: armAt(arms, y).outer, y }));
    const inner = ys(arms.under.y, arms.wristY).map((y) => ({ x: armAt(arms, y).inner, y }));
    const down = [0.25, 0.5, 0.75].map((k) =>
      ys(arms.under.y + 2, arms.wristY).map((y) => {
        const a = armAt(arms, y);
        return { x: a.inner + (a.outer - a.inner) * k, y };
      }),
    );
    // Up the inside from the wrist, over the shoulder and down the outside, closed across the wrist.
    const outline = [...[...inner].reverse(), ...outer, inner[inner.length - 1]];
    return [1, -1].flatMap((s) => [outline, ...down].map((pts, i) => ({ d: path(pts.map((q) => ({ x: cx + s * q.x, y: q.y }))), edge: i === 0 })));
  }, [arms, cx]);

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
        setUndone([]);
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
    setUndone([...undone, choices]);
    onChoices(prev);
    setSaid('Last line undone.');
  };
  const redoLine = () => {
    const next = undone[undone.length - 1];
    if (next === undefined) return;
    setUndone(undone.slice(0, -1));
    setSteps([...steps, choices]);
    onChoices(next);
    setSaid('Line put back.');
  };
  const pick = (k: FormLine) => {
    setKind(k);
    setSaid(undefined);
    if (FRONT_ONLY.includes(k)) setSide('front');
  };
  const help = helpFor?.[kind] ?? ((onBack && BACK_HELP[kind]) || HELP[kind]);

  return (
    <div className="form-draw">
      <div className="screen-head">
        <div>
          <p className="eyebrow">Drape · Your form <TestingTag /></p>
          <h1>Draw your lines</h1>
        </div>
        <button type="button" className="primary done" onClick={() => leave(onDone)}>
          Done
        </button>
      </div>
      <section className="card" aria-label="Your dress form">
        <div className={backs ? 'row between wrap' : 'row end wrap'}>
          {backs && (
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
          )}
          <div className="form-undo">
            <button type="button" onClick={undoLine} disabled={!steps.length} aria-label="Undo the last line">
              ↶ Undo
            </button>
            <button type="button" onClick={redoLine} disabled={!undone.length} aria-label="Redo the line you undid">
              ↷ Redo
            </button>
          </div>
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
            {legPaths.map((l, i) => (
              <path key={`leg${i}`} d={l.d} className="form-line" fill="none" strokeWidth={l.edge ? 0.22 : 0.12} opacity={l.edge ? 0.9 : 0.35} />
            ))}
            {legLines && (
              <path d={`M${f(cx - legLines.apart * 3)} ${f(legLines.floor)} L${f(cx + legLines.apart * 3)} ${f(legLines.floor)}`} className="form-stand" fill="none" strokeWidth={0.15} opacity={0.6} />
            )}
            {!legLines && (
              <path
                d={`M${f(cx)} ${f(body.bottom)} L${f(cx)} ${f(frame.bottom - 2)} M${f(cx - 8)} ${f(frame.bottom - 2)} L${f(cx + 8)} ${f(frame.bottom - 2)}`}
                className="form-stand"
                fill="none"
                strokeWidth={0.2}
              />
            )}
            {armLines.map((a, i) => (
              <path key={`arm${i}`} d={a.d} className="form-line" fill="none" strokeWidth={a.edge ? 0.22 : 0.12} opacity={a.edge ? 0.9 : 0.35} />
            ))}
            {contours.map((c, i) => (
              <path key={i} d={c.d} className="form-line" fill="none" strokeWidth={c.edge ? 0.22 : 0.12} opacity={c.edge ? 0.9 : 0.25 + 0.2 * (1 - Math.abs(c.u))} />
            ))}
            {kinds.map(([id]) =>
              (current[id] ?? []).map((pts, i) => (
                <path key={`${id}${i}`} d={at(pts)} className={id === kind ? 'tape on' : 'tape'} fill="none" strokeWidth={id === kind ? 0.42 : 0.22} strokeLinecap="round" />
              )),
            )}
            {side === 'back' && (
              // In the corner, clear of the neck.
              <text x={2} y={frame.top + 3} fontSize={1.8} textAnchor="start" className="hint">
                BACK
              </text>
            )}
            {stroke && <polyline points={stroke.map((q) => `${f(q.x)},${f(q.y)}`).join(' ')} className="stroke" strokeWidth={0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
        <p className="muted small form-said" role="status">
          {live ?? said ?? help}
        </p>
        <div className="chips form-kinds" role="group" aria-label="What you are drawing">
          {kinds.map(([id, label]) => (
            <button key={id} type="button" className={kind === id ? 'chip on' : 'chip'} aria-pressed={kind === id} onClick={() => pick(id)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      {asking && (
        <div className="form-leave" role="dialog" aria-modal="true" aria-labelledby="form-leave-title">
          <div className="form-leave-box">
            <h2 id="form-leave-title">Leave your lines?</h2>
            <p>You drew {steps.length === 1 ? '1 line' : `${steps.length} lines`}. Leaving now keeps your pattern as it was.</p>
            <button type="button" className="primary done" onClick={() => setAsking(false)} autoFocus>
              Keep drawing
            </button>
            <button type="button" className="secondary" onClick={() => leave(onCancel)}>
              Leave without them
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
