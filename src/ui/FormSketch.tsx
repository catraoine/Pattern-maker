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
  // The crown sits at the garment's shoulder point. Worn, the sleeve falls close to the arm: its ease hangs
  // in soft folds rather than standing out flat, and from a shoulder set out past the arm it drops to the arm.
  const crown = { x: Math.max(head.x, arm.tip.x), y: Math.min(head.y, arm.tip.y) };
  const outer = ys(crown.y, end).map((y) => {
    const t = Math.min(1, Math.max(0.35, (y - arm.tip.y) / Math.max(1, arm.under.y - arm.tip.y)));
    const onArm = armAt(arm, Math.max(y, arm.tip.y)).outer + 0.5 + SLEEVE_EASE * extra(y) * t;
    return { x: Math.max(onArm, crown.x - 0.25 * (y - crown.y)), y };
  });
  const inner = ys(arm.under.y, end).map((y) => ({ x: armAt(arm, y).inner - 0.3 - SLEEVE_EASE * extra(y), y })).reverse();
  // Back inside the armhole, under the body's cloth.
  return [...outer, ...inner, { x: arm.under.x, y: arm.under.y }, { x: arm.under.x - 4, y: arm.under.y }, { x: crown.x - 4, y: crown.y + 1.2 }];
}

/** How much of a sleeve's ease shows in its width when worn; the rest hangs in folds. */
const SLEEVE_EASE = 0.35;

/** How much of the garment's ease shows in its width when worn: the rest falls into the drape round the body. */
const WORN_EASE = 0.4;
/** Per quarter, how much wider than the form a fitted piece can be before its width is read as volume (gathers,
 *  a straight cut) rather than as darts and ease that close on the body when worn. */
const FITTED_UP_TO = 4;
const VOLUME_FROM = 7;
/** How far the hem of a piece falls at its centre, seen a little from above, as a share of the hem's half width. */
const HEM_FALL = 0.07;
/** How far below a seam a gathered or eased piece takes to bell out to its own width. */
const BELL = 14;

/** The cloth as it hangs on the form rather than laid out flat. A flat piece spreads its full half-girth; worn,
 *  a fitted piece closes its darts on the body and shows only part of its ease, so below the underarm its sides
 *  follow the form plus that share of the ease. Where a piece is much wider than the form (gathers, a straight
 *  cut) that width is volume: it hangs from the widest point of the form above it (shoulders, bust, hip), never
 *  dipping to the waist, with the same share of the extra showing. From the hip the drawing-in fades out over
 *  25 cm so a skirt keeps its flare, and each hem falls a little at its centre, as a hem does seen from a touch
 *  above. The pattern itself is untouched. */
export function wornCloth(cloth: P[][], body: FormBody, underarmY = body.top): P[][] {
  // The widest the form has been from the top down to each height, at 0.5 cm steps.
  const steps = Math.max(1, Math.ceil((body.bottom - body.top) / 0.5));
  const hang: number[] = [];
  for (let i = 0; i <= steps; i++) hang.push(Math.max(hang[i - 1] ?? 0, body.width(body.top + ((body.bottom - body.top) * i) / steps)));
  const hangAt = (y: number) => hang[Math.min(steps, Math.max(0, Math.round(((y - body.top) / (body.bottom - body.top)) * steps)))];
  return cloth.map((s) => {
    const hemY = Math.max(...s.map((q) => q.y));
    const hemHalf = Math.max(1, ...s.filter((q) => q.y > hemY - 1).map((q) => Math.abs(q.x)));
    // A piece hanging from a seam on the body (a skirt from a waist seam) is sewn to the body's width there,
    // gathers and all, and bells out below it.
    const topY = Math.min(...s.map((q) => q.y));
    const seamTop = topY > underarmY + 2 ? topY : undefined;
    return s.map((q) => {
      const below = Math.max(0, q.y - body.bottom);
      const share = WORN_EASE + (1 - WORN_EASE) * Math.min(1, below / 25);
      const w = body.width(Math.min(q.y, body.bottom));
      const h = hangAt(q.y);
      let x = q.x;
      const out = Math.abs(q.x) - h;
      if (out > 0) x = Math.sign(q.x) * (h + out * share);
      // Fitted: follow the form itself, not its widest point, between the underarm and the hip.
      const over = Math.abs(q.x) - w;
      if (over > 0 && q.y > underarmY && below === 0) {
        const fitted = Math.min(1, Math.max(0, (VOLUME_FROM - over) / (VOLUME_FROM - FITTED_UP_TO)));
        const hug = Math.sign(q.x) * (w + Math.min(over, FITTED_UP_TO) * WORN_EASE);
        x = hug * fitted + x * (1 - fitted);
      }
      if (seamTop !== undefined && q.y < seamTop + BELL && Math.abs(q.x) > w) {
        const t = Math.min(1, (q.y - seamTop) / BELL);
        const ease = t * t * (3 - 2 * t);
        const sewn = Math.sign(q.x) * (w + Math.min(Math.abs(q.x) - w, FITTED_UP_TO) * WORN_EASE);
        x = sewn * (1 - ease) + x * ease;
      }
      // The hem falls at its centre, seen a little from above.
      const y = q.y > hemY - 0.8 && q.y > underarmY + 4 ? q.y + HEM_FALL * hemHalf * (1 - Math.min(1, (q.x / hemHalf) ** 2)) : q.y;
      return { x, y };
    });
  });
}

/** A piece's hem corner on its right: the furthest-out point of its last few centimetres, where a flare handle sits. */
export function hemCorner(piece: P[]): P | undefined {
  if (!piece.length) return undefined;
  const hemY = Math.max(...piece.map((q) => q.y));
  const foot = piece.filter((q) => q.x > 0 && q.y > hemY - 6);
  return foot.length ? foot.reduce((a, b) => (b.x > a.x ? b : a)) : undefined;
}

/** The garment's shoulder point on its right: the furthest-out point of its cloth above the underarm. */
export function shoulderPoint(cloth: P[][], arm: FormArm): P | undefined {
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
  /** Where the underarm is: below it a fitted piece's sides follow the form. Shoulders and armholes stay as drafted. */
  underarmY?: number;
  label: string;
}

/** The light on the cloth: lit from the left, falling into shade on the right, so a print reads and black cloth has form.
 *  Each stop is where along the piece it sits, its colour and how strong. The technical flat uses the same light. */
export const SHADE_STOPS: [number, string, number][] = [
  [0, '#fff8e6', 0.16],
  [0.3, '#fff8e6', 0.04],
  [0.55, '#000', 0.08],
  [1, '#000', 0.5],
];

/** Which of the garment's lines the cloth's own edges already show. */
/** The lines the cloth's own edges show, so no tape is drawn over them. */
export const CLOTH_EDGES: FormLine[] = ['neckline', 'fit', 'hem', 'sleeve'];

/** The garment drawn on the dress form, front on. */
export function FormSketch({ body, m, legs, bottom, arms, lines, outline = [], cloth, sleeve, underarmY, label }: Props) {
  const worn = useMemo(() => (cloth ? wornCloth(cloth, body, underarmY ?? arms?.under.y) : undefined), [cloth, body, underarmY, arms]);
  const frame = useMemo(() => formFrame(m, body, bottom, arms, worn), [m, body, bottom, arms, worn]);
  const cx = frame.half;
  return (
    <svg viewBox={`0 ${f(frame.top)} ${f(2 * cx)} ${f(frame.bottom - frame.top)}`} role="img" aria-label={label} className="preview-svg sketch shape form-still">
      <FormLayers body={body} m={m} legs={legs} cx={cx} bottom={frame.bottom} arms={arms} lines={lines} outline={outline} worn={worn} sleeve={sleeve} />
    </svg>
  );
}

interface LayerProps extends Omit<Props, 'cloth' | 'underarmY' | 'label' | 'outline'> {
  /** The centre line's x, in the drawing. */
  cx: number;
  /** The drawing's bottom, for the form's stand. */
  bottom: number;
  outline?: P[][];
  /** The garment as cloth, already laid on the form by `wornCloth`. */
  worn?: P[][];
}

/**
 * The form and the garment on it, as layers inside an SVG whose centre line is at `cx`: the legs or the stand,
 * the arms, the form's contours, the cloth with its sleeves, and the garment's lines over it. The still Form
 * view and the skirt's and top's draggable sketches all draw the garment this way, so it looks the same everywhere.
 */
export function FormLayers({ body, m, legs, cx, bottom, arms, lines, outline = [], worn, sleeve }: LayerProps) {
  const contours = useMemo(() => formContours(body, cx), [body, cx]);
  const armLines = useMemo(() => formArmLines(arms, cx), [arms, cx]);
  const at = (pts: P[]) => formPath(pts.map((q) => ({ x: cx + q.x, y: q.y })));
  const showLegs = legs && m.full_hip && m.waist_to_hip && m.waist_to_knee && m.waist_to_floor;
  const cloth = !!worn;
  // The cloth: sleeves first, then the body over their heads, then collars and lapels over that. Each piece is
  // its own path: pieces overlap (a lapel on its front, a sleeve on the body) and one path would punch holes there.
  const sleeves = useMemo(() => (arms && sleeve && worn ? [sleeveShape(arms, sleeve, shoulderPoint(worn, arms))].flatMap((s) => [s, s.map((q) => ({ x: -q.x, y: q.y }))]) : []), [arms, sleeve, worn]);
  const pieces = worn ? [...sleeves, ...worn].map((s) => `${at(s)} Z`) : [];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shade = `shade${uid}`;
  const clip = `clip${uid}`;
  const drawn = cloth ? Object.fromEntries(Object.entries(lines).filter(([id]) => !CLOTH_EDGES.includes(id as FormLine))) : lines;
  return (
    <>
      {cloth && (
        <defs>
          <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={f(cx * 0.2)} x2={f(cx * 1.8)} y1="0" y2="0">
            {SHADE_STOPS.map(([offset, color, opacity]) => (
              <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
          </linearGradient>
          <clipPath id={clip}>
            {pieces.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </clipPath>
        </defs>
      )}
      {showLegs ? (
        <g transform={`translate(0 ${f(body.waistY)})`}>
          <path d={bodyOutline(m as SkirtMeasurements, cx)} className="form-legs" fill="none" strokeWidth={0.18} />
        </g>
      ) : (
        !legs && (
          <path
            d={`M${f(cx)} ${f(body.bottom)} L${f(cx)} ${f(bottom - 2)} M${f(cx - 8)} ${f(bottom - 2)} L${f(cx + 8)} ${f(bottom - 2)}`}
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
      {cloth && arms && !sleeve && armLines.filter((a) => a.edge).map((a, i) => <path key={`armover${i}`} d={a.d} className="form-arm-over" strokeWidth={0.24} />)}
      {cloth && arms && !sleeve && armLines.filter((a) => !a.edge).map((a, i) => <path key={`armin${i}`} d={a.d} className="form-line" fill="none" strokeWidth={0.14} opacity={0.55} />)}
      {outline.map((pts, i) => (
        <path key={`o${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g clipPath={cloth ? `url(#${clip})` : undefined}>
        {Object.entries(drawn).flatMap(([id, runs]) => (runs ?? []).map((pts, i) => <path key={`${id}${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" />))}
      </g>
    </>
  );
}
