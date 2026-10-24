// The garment on your form, standing still: the dress form in contour lines that "Draw on your form"
// uses, with the garment on it as cloth (Cat's G5 "In its fabric", 2026-10-23): the garment's shapes
// from its technical flat, filled with the fabric chosen on the Fabric tab (plain black cloth until one
// is), lit from the left and shaded to the right, with its seams and darts drawn over. The cloth covers the
// form's lines, so the neck, shoulders, arms and legs still show it is on a body. Sleeves hang on the arms,
// drawn from your arm measurements. Every garment's Style page opens on this, so the body looks the same
// on the welcome screen, while measuring and while styling.
import { useId, useMemo } from 'react';
import type { P } from '../engine/geometry';
import type { SkirtMeasurements } from '../engine/skirt';
import { bodyOutline } from './bodyOutline';
import { FormArm, FormBody, armAt } from './DrawOnForm';
import type { FormLine } from './formLines';

type Measures = { full_bust?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number };

const f = (n: number) => n.toFixed(2);
export const formPath = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** The drawing's frame: half its width (the centre line's x) and its top and bottom. */
export function formFrame(m: Measures, body: FormBody, bottom: number, arms?: FormArm, cloth: P[][] = []) {
  const wide = Math.max(0, ...cloth.flat().map((q) => Math.abs(q.x) + 3));
  const half = Math.max(Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 7, arms ? armAt(arms, arms.wristY).outer + 2 : 0, wide);
  return { half, top: body.top - 2, bottom: Math.max(body.bottom + 12, bottom) };
}

/** What a sleeve on the form needs to know of the drafted sleeve: its length, and how wide it is sewn. */
export interface WornSleeve {
  /** Centre of the crown to the hem, in cm. */
  lengthCm: number;
  /** Round the bicep, finished. */
  bicep: number;
  /** Round the hem, finished. */
  hemCm: number;
}

/** A sleeve as it hangs on the arm: from the shoulder tip down to its hem, as wide as the sleeve is sewn
 *  where that is wider than the arm, and closed back inside the armhole (where the body's cloth covers it).
 *  `head` is the garment's own shoulder point, which the sleeve's crown reaches up to. The right sleeve; the
 *  left mirrors it. */
export function sleeveShape(arm: FormArm, sleeve: WornSleeve, head: P = arm.tip): P[] {
  const end = Math.min(Math.max(arm.tip.y + sleeve.lengthCm, arm.under.y + 2), arm.wristY + 2);
  const ys = (a: number, b: number) => Array.from({ length: 25 }, (_, i) => a + ((b - a) * i) / 24);
  // Half of what the sewn sleeve is wider than the arm, bicep to hem.
  const extra = (y: number) => {
    const t = Math.min(1, Math.max(0, (y - arm.under.y) / Math.max(1, end - arm.under.y)));
    const sewn = (sleeve.bicep + (sleeve.hemCm - sleeve.bicep) * t) / Math.PI;
    const { inner, outer } = armAt(arm, Math.max(y, arm.under.y));
    return Math.max(0, sewn - (outer - inner)) / 2;
  };
  const outer = ys(arm.tip.y, end).map((y) => ({ x: armAt(arm, y).outer + 0.8 + extra(y) * Math.min(1, Math.max(0.35, (y - arm.tip.y) / Math.max(1, arm.under.y - arm.tip.y))), y }));
  const inner = ys(arm.under.y, end).map((y) => ({ x: armAt(arm, y).inner - 0.6 - extra(y), y })).reverse();
  const crown = { x: Math.max(head.x, arm.tip.x), y: Math.min(head.y, arm.tip.y) };
  // Back inside the armhole, under the body's cloth.
  const under = { x: arm.under.x - 4, y: arm.under.y };
  return [crown, { x: arm.tip.x, y: arm.tip.y }, ...outer, ...inner, { x: arm.under.x, y: arm.under.y }, under, { x: crown.x - 4, y: crown.y + 1.2 }];
}

/** The garment's shoulder point on its right: the furthest-out point of its cloth above the underarm. */
function shoulderPoint(cloth: P[][], arm: FormArm): P | undefined {
  const top = cloth.flat().filter((q) => q.x > 0 && q.y <= arm.under.y - 2);
  return top.length ? top.reduce((a, b) => (b.x > a.x ? b : a)) : undefined;
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
  /** The garment as cloth: closed shapes in the pieces' coordinates (from the flat's front view), filled with
   *  the chosen fabric and laid over the form. With cloth, the neckline, side and hem lines are its edges. */
  cloth?: P[][];
  /** Where the sleeves end, down the arms (needs `arms`): sleeves are drawn hanging on them, in the cloth. */
  /** The drafted sleeve, to hang on the arms; none for a sleeveless garment. */
  sleeve?: WornSleeve;
  label: string;
}

/** Which of the garment's lines the cloth's own edges already show. */
const CLOTH_EDGES: FormLine[] = ['neckline', 'fit', 'hem', 'sleeve'];

/** The garment drawn on the dress form, front on. */
export function FormSketch({ body, m, legs, bottom, arms, lines, outline = [], cloth, sleeve, label }: Props) {
  const frame = useMemo(() => formFrame(m, body, bottom, arms, cloth), [m, body, bottom, arms, cloth]);
  const cx = frame.half;
  const contours = useMemo(() => formContours(body, cx), [body, cx]);
  const armLines = useMemo(() => formArmLines(arms, cx), [arms, cx]);
  const at = (pts: P[]) => formPath(pts.map((q) => ({ x: cx + q.x, y: q.y })));
  const showLegs = legs && m.full_hip && m.waist_to_hip && m.waist_to_knee && m.waist_to_floor;
  // The cloth: sleeves first, then the body over their heads, then collars and lapels over that. Each piece is
  // its own path: pieces overlap (a lapel on its front, a sleeve on the body) and one path would punch holes there.
  const sleeves = useMemo(() => (arms && sleeve && cloth ? [sleeveShape(arms, sleeve, shoulderPoint(cloth, arms))].flatMap((s) => [s, s.map((q) => ({ x: -q.x, y: q.y }))]) : []), [arms, sleeve, cloth]);
  const pieces = cloth ? [...sleeves, ...cloth].map((s) => `${at(s)} Z`) : [];
  const shade = `shade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const drawn = cloth ? Object.fromEntries(Object.entries(lines).filter(([id]) => !CLOTH_EDGES.includes(id as FormLine))) : lines;
  return (
    <svg viewBox={`0 ${f(frame.top)} ${f(2 * cx)} ${f(frame.bottom - frame.top)}`} role="img" aria-label={label} className="preview-svg sketch shape form-still">
      {cloth && (
        <defs>
          <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={f(cx - frame.half * 0.8)} x2={f(cx + frame.half * 0.8)} y1="0" y2="0">
            <stop offset="0" stopColor="#fff8e6" stopOpacity="0.1" />
            <stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.38" />
          </linearGradient>
        </defs>
      )}
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
      {cloth && (
        <g className="cloth">
          {pieces.map((d, i) => (
            <g key={`c${i}`}>
              <path d={d} className="cloth-fill" strokeWidth={0.3} strokeLinejoin="round" />
              <path d={d} fill={`url(#${shade})`} stroke="none" />
              <path d={d} className="cloth-edge" fill="none" strokeWidth={0.3} strokeLinejoin="round" />
            </g>
          ))}
        </g>
      )}
      {outline.map((pts, i) => (
        <path key={`o${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {Object.entries(drawn).flatMap(([id, runs]) => (runs ?? []).map((pts, i) => <path key={`${id}${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" />))}
    </svg>
  );
}
