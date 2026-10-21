// The garment on your form, standing still: the dress form in contour lines that "Draw on your form"
// uses, with the garment's lines laid on it. Every garment's Style page opens on this, so the body
// looks the same on the welcome screen, while measuring and while styling.
import { useMemo } from 'react';
import type { P } from '../engine/geometry';
import type { SkirtMeasurements } from '../engine/skirt';
import { bodyOutline } from './bodyOutline';
import { FormArm, FormBody, armAt } from './DrawOnForm';
import type { FormLine } from './formLines';

type Measures = { full_bust?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number };

const f = (n: number) => n.toFixed(2);
export const formPath = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** The drawing's frame: half its width (the centre line's x) and its top and bottom. */
export function formFrame(m: Measures, body: FormBody, bottom: number, arms?: FormArm) {
  const half = Math.max(Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 7, arms ? armAt(arms, arms.wristY).outer + 2 : 0);
  return { half, top: body.top - 2, bottom: Math.max(body.bottom + 12, bottom) };
}

/** The form in contour lines, as on the welcome screen: each line a fixed fraction of the way round. */
export function formContours(body: FormBody, cx: number): { d: string; edge: boolean; u: number }[] {
  const n = 15;
  const ys = Array.from({ length: 121 }, (_, i) => body.top + ((body.bottom - body.top) * i) / 120);
  return Array.from({ length: n }, (_, i) => {
    const u = Math.sin(-Math.PI / 2 + (Math.PI * i) / (n - 1));
    return { d: formPath(ys.map((y) => ({ x: cx + u * body.width(y), y }))), edge: Math.abs(u) > 0.98, u };
  });
}

/** The arms, each its outline round from the shoulder to the wrist and three lines down it. */
export function formArmLines(arms: FormArm | undefined, cx: number): { d: string; edge: boolean }[] {
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
  return [1, -1].flatMap((s) => [outline, ...down].map((pts, i) => ({ d: formPath(pts.map((q) => ({ x: cx + s * q.x, y: q.y }))), edge: i === 0 })));
}

interface Props {
  body: FormBody;
  m: Measures;
  /** Legs below the form (a dress, skirt or trousers), otherwise the form stands on its pole. */
  legs: boolean;
  /** How far down the drawing goes, in the form's coordinates. */
  bottom: number;
  /** Arms beside the form, for a top with sleeves. */
  arms?: FormArm;
  /** The garment's lines from the front, in cm with the centre at x = 0. */
  lines: Partial<Record<FormLine, P[][]>>;
  /** Lines drawn as the garment's outline rather than a style line, such as a trouser leg. */
  outline?: P[][];
  label: string;
}

/** The garment drawn on the dress form, front on. */
export function FormSketch({ body, m, legs, bottom, arms, lines, outline = [], label }: Props) {
  const frame = useMemo(() => formFrame(m, body, bottom, arms), [m, body, bottom, arms]);
  const cx = frame.half;
  const contours = useMemo(() => formContours(body, cx), [body, cx]);
  const armLines = useMemo(() => formArmLines(arms, cx), [arms, cx]);
  const at = (pts: P[]) => formPath(pts.map((q) => ({ x: cx + q.x, y: q.y })));
  const showLegs = legs && m.full_hip && m.waist_to_hip && m.waist_to_knee && m.waist_to_floor;
  return (
    <svg viewBox={`0 ${f(frame.top)} ${f(2 * cx)} ${f(frame.bottom - frame.top)}`} role="img" aria-label={label} className="preview-svg sketch shape form-still">
      {showLegs ? (
        <g transform={`translate(0 ${f(body.waistY)})`}>
          <path d={bodyOutline(m as SkirtMeasurements, cx)} className="form-legs" fill="none" strokeWidth={0.18} />
        </g>
      ) : (
        !legs && (
          <path
            d={`M${f(cx)} ${f(body.bottom)} L${f(cx)} ${f(frame.bottom - 2)} M${f(cx - 8)} ${f(frame.bottom - 2)} L${f(cx + 8)} ${f(frame.bottom - 2)}`}
            className="form-stand"
            fill="none"
            strokeWidth={0.2}
          />
        )
      )}
      {armLines.map((a, i) => (
        <path key={`arm${i}`} d={a.d} className="form-line" fill="none" strokeWidth={a.edge ? 0.24 : 0.14} opacity={a.edge ? 1 : 0.55} />
      ))}
      {contours.map((c, i) => (
        <path key={i} d={c.d} className="form-line" fill="none" strokeWidth={c.edge ? 0.24 : 0.14} opacity={c.edge ? 1 : 0.45 + 0.3 * (1 - Math.abs(c.u))} />
      ))}
      {outline.map((pts, i) => (
        <path key={`o${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {Object.entries(lines).flatMap(([id, runs]) => (runs ?? []).map((pts, i) => <path key={`${id}${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" />))}
    </svg>
  );
}
