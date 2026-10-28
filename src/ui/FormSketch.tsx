// The garment on your form, standing still: the dress form as a black satin mannequin, with the garment on it
// as cloth (Cat's G5 "In its fabric", 2026-10-23, drawn in light since her F5 Satin and Light, 2026-10-25): the
// garment's shapes from its technical flat, filled with the fabric chosen on the Fabric tab (plain black cloth
// until one is), shaped by the light, brightest down the front and turning into shadow at the sides, with its
// seams pressed in. The cloth covers the
// form's lines, so the neck, shoulders, arms and legs still show it is on a body. Sleeves hang on the arms,
// drawn from your arm measurements. Every garment's Style page opens on this, so the body looks the same
// on the welcome screen, while measuring and while styling.
import { useId, useMemo, useRef } from 'react';
import type { P } from '../engine/geometry';
import type { SkirtMeasurements } from '../engine/skirt';
import { bodyOutline } from './bodyOutline';
import { CM_PER_UNIT, HEAD_CHIN, HEAD_TOP, headLines } from './ContourForm';
import { FormArm, FormBody, armAt } from './DrawOnForm';
import type { FormLine } from './formLines';
import { HemChoice, HemMarks, MARGIN } from './HemMarks';
import { useEnlarged } from './EnlargeSketch';
import { useLengthStep } from './StyleLayout';
import { ClothDefs, ClothOverlay, SHEER_OPACITY, borderHems, useFabricLook } from './ClothLook';

type Measures = { full_bust?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number };

const f = (n: number) => n.toFixed(2);

/** How much narrower the form is drawn than the pattern's half girths. A quarter of a round measurement each side
 *  of the centre is the width laid flat; from the front a body shows about two thirds of that, which is how the
 *  welcome and measuring form are drawn beside the same head (Cat, 2026-10-24: the body read wide, the head tiny).
 *  Only the drawing narrows: the garment's lines and the lines drawn on it are read back in the pattern's own cm. */
export const SQUEEZE = 0.68;
const formPath = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** How tall the head stands above the top of the neck, in cm. */
export const HEAD_CM = (HEAD_CHIN - HEAD_TOP) * CM_PER_UNIT - 1.5;
/** How far the neck's lines run on up behind the head, so the neck goes into the jaw as on the welcome form
 *  rather than stopping in a flat cut under it (Cat, 2026-10-24: "a thick tree trunk"). */
const INTO_HEAD = 3;

/** The head on a form with a neck, as on every other screen (Cat's body rule): the same faceless mannequin head,
 *  at the same scale to the body, its chin a little below the top of the neck. */
export function formHead(body: FormBody, cx: number): { outline: string; lines: string[] } | undefined {
  if (!body.head) return undefined;
  const chin = body.top + 1.5;
  const { outline, lines: inner } = headLines(9);
  const at = ([x, y]: [number, number]): P => ({ x: cx + x * CM_PER_UNIT, y: chin + (y - HEAD_CHIN) * CM_PER_UNIT });
  return { outline: formPath(outline.map(at)) + ' Z', lines: inner.map((l) => formPath(l.map(at))) };
}

/** The head drawn over the neck, in the form's satin, so the neck runs into the jaw. `cx` is the form's centre
 *  line, which the satin's light is laid across. */
export function FormHead({ head, cx }: { head: { outline: string; lines: string[] }; cx: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // The highlight runs down the head where it runs down the body, a little left of centre.
  const lit = head.lines[Math.floor(head.lines.length * 0.25)];
  return (
    <g className="form-head">
      <SatinDefs id={`headsatin${uid}`} cx={cx} />
      <path d={head.outline} fill={`url(#headsatin${uid})`} stroke="none" />
      {lit && <path d={lit} className="form-line" fill="none" strokeWidth={0.12} opacity={0.3} />}
      <path d={head.outline} className="form-line" fill="none" strokeWidth={0.18} opacity={0.85} />
    </g>
  );
}

/** The form's black satin (Cat's F5 Satin and Light, 2026-10-25): lit from the upper left, a soft sheen a third of
 *  the way across, falling into black on the right. The same light as the cloth's, and the welcome's canvas form. */
const SATIN_STOPS: [number, string][] = [
  [0, '#14120e'],
  [0.3, '#3b352a'],
  [0.5, '#1c1915'],
  [1, '#050505'],
];
/** The satin across a drawing whose centre line is at `cx`. With arms, each arm gets the same light across its own
 *  width (`${id}0` the right arm, `${id}1` the left), so it rounds like the body instead of sitting in the body's
 *  shadow as a flat dark slab. */
function SatinDefs({ id, cx, arms }: { id: string; cx: number; arms?: FormArm }) {
  const at = arms ? armAt(arms, arms.under.y + 4) : undefined;
  return (
    <defs>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={f(cx * 0.1)} x2={f(cx * 1.9)} y1="0" y2="0">
        {SATIN_STOPS.map(([offset, color]) => (
          <stop key={offset} offset={offset} stopColor={color} />
        ))}
      </linearGradient>
      {at &&
        [1, -1].map((s, i) => {
          const xs = [cx + SQUEEZE * s * at.inner, cx + SQUEEZE * s * at.outer];
          const left = Math.min(...xs) - 0.3;
          const right = Math.max(...xs) + 0.3;
          return (
            <linearGradient key={s} id={`${id}${i}`} gradientUnits="userSpaceOnUse" x1={f(left)} x2={f(right)} y1="0" y2="0">
              {SATIN_STOPS.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
          );
        })}
    </defs>
  );
}

/** Where the form's one highlight runs, as a share of the way out from the centre to the left side. */
const SATIN_HIGHLIGHT = -0.5;

/** The form as a satin mannequin: its body (and arms, when it has them) filled with the satin, a fine champagne
 *  edge round each and one soft highlight down the lit side. Drawing on your form and the Style page's drawings
 *  all draw the form this way. */
export function FormSatin({ body, cx, arms, uid, bottom = body.bottom, edge = 0.18, legsTo }: { body: FormBody; cx: number; arms?: FormArm; uid: string; bottom?: number; edge?: number; legsTo?: { y: number; half: number } }) {
  const armLines = useMemo(() => formArmLines(arms, cx), [arms, cx]);
  const { silhouette, sides, highlight, from } = useMemo(() => {
    const top = body.head ? body.top - INTO_HEAD : body.top;
    // With legs below, the torso runs on down into them rather than ending in a flat cut at the hip.
    const low = legsTo ? Math.max(bottom, legsTo.y) : bottom;
    const ys = Array.from({ length: 121 }, (_, i) => top + ((low - top) * i) / 120);
    const widthAt = (y: number) => {
      const w = body.width(Math.min(y, body.bottom));
      if (!legsTo || y <= body.bottom) return w;
      const t = Math.min(1, (y - body.bottom) / Math.max(1, legsTo.y - body.bottom));
      return w + (legsTo.half - w) * t * t;
    };
    const at = (u: number) => ys.map((y) => ({ x: cx + SQUEEZE * u * widthAt(y), y }));
    const right = at(1);
    const left = at(-1);
    return {
      silhouette: `${formPath([...right, ...[...left].reverse()])} Z`,
      sides: [formPath(left), formPath(right)],
      highlight: formPath(at(SATIN_HIGHLIGHT).filter((q) => q.y >= body.top)),
      from: body.top,
    };
  }, [body, cx, bottom, legsTo]);
  const id = `satin${uid}`;
  // No gold outline round the mannequin, just a faint edge, so it reads as a lit body rather than a drawing of one
  // (Cat's D6, 2026-10-26).
  const edgeOn = 0.35;
  const edgeW = Math.min(edge, 0.12);
  return (
    <>
      <SatinDefs id={id} cx={cx} arms={arms} />
      {/* The highlight comes in below the neck, where the shoulders round off, so it doesn't cut across them. */}
      <defs>
        <linearGradient id={`sheen${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={f(from + 3)} y2={f(from + 12)}>
          <stop offset="0" stopColor="#d9c49b" stopOpacity="0" />
          <stop offset="1" stopColor="#d9c49b" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {armLines.map((a, i) => (
        <path key={`armfill${i}`} d={`${a.d} Z`} fill={`url(#${id}${i})`} stroke="none" />
      ))}
      <path d={silhouette} fill={`url(#${id})`} stroke="none" />
      {armLines.map((a, i) => (
        <path key={`arm${i}`} d={a.d} className="form-line" fill="none" strokeWidth={edgeW} opacity={edgeOn} />
      ))}
      {sides.map((d, i) => (
        <path key={`side${i}`} d={d} className="form-line" fill="none" strokeWidth={edgeW} opacity={edgeOn} />
      ))}
      <path d={highlight} fill="none" stroke={`url(#sheen${uid})`} strokeWidth={0.14} />
    </>
  );
}

/** The drawing's frame: half its width (the centre line's x) and its top and bottom. The figure fills its width
 *  (Cat's D5, 2026-10-26): just wider than the arms and the garment. The bottom stays where the caller puts it (the
 *  skirt and top sketches keep their length marks in reach); the form sketch and the draw tool crop below the hem. */
export function formFrame(m: Measures, body: FormBody, bottom: number, arms?: FormArm, cloth: P[][] = []) {
  const wide = Math.max(0, ...cloth.flat().map((q) => Math.abs(q.x) + 1.5));
  const half = SQUEEZE * Math.max(Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 3, arms ? armAt(arms, arms.wristY).outer + 1.5 : 0, wide);
  return { half, top: body.top - (body.head ? HEAD_CM + 1 : 2), bottom: Math.max(body.bottom + 12, bottom) };
}
/** How far below the garment's hem the draw tool's drawing goes, in cm: room for the legs to fade out and for the hem
 *  to be drawn longer. */
export const BELOW_HEM = 16;

/** What a sleeve on the form needs to know of the drafted sleeve: its length, and how wide it is sewn. */
export interface WornSleeve {
  /** Centre of the crown to the hem, in cm. */
  lengthCm: number;
  /** Round the bicep, finished. */
  bicep: number;
  /** Round the hem, finished: round the band, on a sleeve gathered into one. */
  hemCm: number;
  /** Gathered sleeves: how much is gathered into the armhole (a puff) and into the band or cuff. */
  gathers?: { crown?: number; hem: number };
  /** The cuff, when it has one. */
  cuff?: { depth: number };
}

/** How the sleeve hangs, read from the draft: where its band starts, and how its width runs. */
function sleeveRun(arm: FormArm, sleeve: WornSleeve) {
  const end = Math.min(Math.max(arm.tip.y + sleeve.lengthCm, arm.under.y + 2), arm.wristY + 2);
  const g = sleeve.gathers;
  const puff = (g?.crown ?? 0) > 0;
  const band = g?.hem ? (sleeve.cuff?.depth ?? BAND_ON_FORM) : 0;
  const bandTop = end - band;
  // The hem before it is gathered into its band; a flared hem (a flutter or bell) shows more of its width.
  const fullHem = sleeve.hemCm + (g?.hem ?? 0);
  const flared = !g && sleeve.hemCm > sleeve.bicep * 1.2;
  const share = g ? GATHERED_EASE : flared ? FLARED_EASE : SLEEVE_EASE;
  // Half of what the sewn sleeve is wider than the arm at y, bicep to hem (or to the top of the band).
  const extra = (y: number) => {
    const t = Math.min(1, Math.max(0, (y - arm.under.y) / Math.max(1, bandTop - arm.under.y)));
    const sewn = (y >= bandTop && band ? sleeve.hemCm : sleeve.bicep + (fullHem - sleeve.bicep) * t) / Math.PI;
    const { inner, outer } = armAt(arm, Math.max(y, arm.under.y));
    return Math.max(0, sewn - (outer - inner)) / 2;
  };
  // Over the band the width drops to the band's in a short step: the gathers.
  const bandShare = (y: number) => (band && y >= bandTop ? SLEEVE_EASE : share);
  return { end, puff, band, bandTop, extra, bandShare, crownGathers: g?.crown ?? 0 };
}

/** The band a gathered sleeve ends in when it has no cuff of its own, as drawn on the form, in cm. */
const BAND_ON_FORM = 3;

/** A sleeve as it hangs on the arm: from the shoulder tip down to its hem, as wide as the sleeve is sewn
 *  where that is wider than the arm, and closed back inside the armhole (where the body's cloth covers it).
 *  A puff sleeve's crown balloons over the shoulder; a sleeve gathered into a band or cuff stays full and
 *  then draws in sharply above it; a flutter or bell flares. `head` is the garment's own shoulder point,
 *  which the sleeve's crown reaches up to. The right sleeve; the left mirrors it. */
function sleeveShape(arm: FormArm, sleeve: WornSleeve, head: P = arm.tip, cloth?: P[][], body?: FormBody): P[] {
  const { end, puff, bandTop, extra, bandShare, crownGathers } = sleeveRun(arm, sleeve);
  const ys = (a: number, b: number) => Array.from({ length: 33 }, (_, i) => a + ((b - a) * i) / 32);
  // The crown sits at the garment's shoulder point. Worn, the sleeve falls close to the arm: its ease hangs
  // in soft folds rather than standing out flat, and from a shoulder set out past the arm it drops to the arm.
  const crown = { x: Math.max(head.x, arm.tip.x), y: Math.min(head.y, arm.tip.y) - (puff ? PUFF_RISE : 0) };
  // A puff's crown stands out from the shoulder, most at the top of the arm, fading out below the underarm.
  const puffEnd = Math.min(end, arm.under.y + 5);
  const swell = Math.min(6, 2 + crownGathers / 4);
  const bulge = (y: number) => (puff ? swell * Math.sin(Math.PI * Math.min(1, Math.max(0, (y - crown.y) / Math.max(1, puffEnd - crown.y)))) : 0);
  // Into the band: the width steps down over a centimetre, the gathers' edge.
  const step = (y: number, wide: number, narrow: number) => (bandTop < end && y > bandTop - 1 && y < bandTop ? narrow + (wide - narrow) * (bandTop - y) : y >= bandTop ? narrow : wide);
  // Below the underarm the ease hangs in toward the hem: a sleeve that falls, not a tube that stands.
  const hang = (y: number) => 1 - 0.4 * Math.min(1, Math.max(0, y - arm.under.y) / Math.max(1, end - arm.under.y));
  const onArm = (y: number) => {
    const t = Math.min(1, Math.max(0.35, (y - arm.tip.y) / Math.max(1, arm.under.y - arm.tip.y)));
    const base = armAt(arm, Math.max(y, arm.tip.y)).outer + 0.5;
    const wide = base + bandShare(Math.min(y, bandTop - 1.01)) * extra(Math.min(y, bandTop - 1.01)) * t * hang(y) + bulge(y);
    const narrow = base + SLEEVE_EASE * extra(Math.max(y, bandTop));
    return step(y, wide, narrow);
  };
  // The cap rounds over the top of the arm from the crown (no hanger corner): out and down in a soft curve to where
  // the sleeve hangs, and from a shoulder set out past the arm it falls to the arm in the same curve.
  const capLen = Math.max(CAP_CM, 2 * (crown.x - onArm(crown.y + CAP_CM)));
  const outer = ys(crown.y, end).map((y) => {
    const on = onArm(y);
    const c = Math.min(1, (y - crown.y) / capLen);
    return { x: on + Math.max(0, crown.x - on) * Math.cos((c * Math.PI) / 2), y };
  });
  // Just under the arm the sleeve's underarm seam meets the body's side seam: no form shows between them there.
  const side = cloth ? clothEdge(cloth) : undefined;
  const inner = ys(arm.under.y, end)
    .map((y) => {
      const base = armAt(arm, y).inner - 0.3;
      const wide = base - bandShare(Math.min(y, bandTop - 1.01)) * extra(Math.min(y, bandTop - 1.01)) - 0.5 * bulge(y);
      const narrow = base - SLEEVE_EASE * extra(Math.max(y, bandTop));
      const x = step(y, wide, narrow);
      const at = side?.(y) ?? -Infinity;
      if (!Number.isFinite(at)) return { x, y };
      const t = Math.min(1, Math.max(0, (y - arm.under.y) / 6));
      return { x: Math.min(x, at - 1.5 + (x - at + 1.5) * t), y };
    })
    .reverse();
  // Back inside the armhole, under the body's cloth.
  const back = cloth && body ? tuckedUnder(arm, crown, cloth, body) : [{ x: arm.under.x - 4, y: arm.under.y }, { x: crown.x - 4, y: crown.y + 1.2 }];
  // The hem falls a little at its middle, seen a touch from above, like every hem on the form: not a flat cut.
  const o = outer[outer.length - 1];
  const n = inner[0];
  const hem = Array.from({ length: 9 }, (_, i) => {
    const u = (i + 1) / 10;
    return { x: o.x + (n.x - o.x) * u, y: end + SLEEVE_HEM_FALL * Math.abs(o.x - n.x) * Math.sin(u * Math.PI) };
  });
  return [...outer, ...hem, ...inner, { x: arm.under.x, y: arm.under.y }, ...back];
}

/** How far down the arm a sleeve set out past the arm takes to fall to it, in cm, at the least. */
const CAP_CM = 5;
/** How far a sleeve's hem falls at its middle, as a share of its width. */
const SLEEVE_HEM_FALL = 0.1;

/** Where a sleeve tucks back under the body's cloth: up its armhole a little inside it, so no form shows between
 *  the sleeve and the bodice however deep the armhole is cut, then over the top of the shoulder along the form
 *  itself to the crown, so none shows above the sleeve's head either (Cat, 2026-10-26). */
/** How far out the body's cloth reaches at y, on the right (-Infinity where there is none). */
function clothEdge(cloth: P[][]): (y: number) => number {
  return (y) => {
    let x = -Infinity;
    for (const s of cloth) {
      for (let i = 0; i < s.length; i++) {
        const a = s[i];
        const b = s[(i + 1) % s.length];
        if (a.y === b.y || (a.y - y) * (b.y - y) > 0) continue;
        const xx = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
        if (xx > 0) x = Math.max(x, xx);
      }
    }
    return x;
  };
}

function tuckedUnder(arm: FormArm, crown: P, cloth: P[][], body: FormBody): P[] {
  const edgeAt = clothEdge(cloth);
  // Straight up inside the armhole, wherever it curves in deepest.
  let xIn = Infinity;
  for (let y = arm.under.y - 0.5; y > crown.y; y -= 0.5) {
    const x = edgeAt(y);
    if (Number.isFinite(x)) xIn = Math.min(xIn, x - 1.5);
  }
  // The body's own piece, the one reaching out to the armhole and up to the shoulder: a collar or stand standing up
  // the neck is not it, nor a skirt hanging from a waist seam, however wide it flares.
  const reaching = cloth.filter((b) => Math.max(...b.map((q) => q.x)) >= arm.tip.x - 6);
  const piece = (reaching.length ? reaching : cloth).reduce((a, b) => (Math.min(...b.map((q) => q.y)) < Math.min(...a.map((q) => q.y)) ? b : a));
  const right = piece.filter((q) => q.x > 0.5);
  if (!Number.isFinite(xIn) || !right.length) return [{ x: arm.under.x - 4, y: arm.under.y }, { x: crown.x - 4, y: crown.y + 1.2 }];
  xIn = Math.max(xIn, arm.under.x - 12);
  // The cloth's top at x (its shoulder seam), and the form's own top: its body, or the cap of its arm.
  const clothTop = (x: number) => {
    let top = Infinity;
    for (let i = 0; i < piece.length; i++) {
      const a = piece[i];
      const b = piece[(i + 1) % piece.length];
      if (a.x === b.x || (a.x - x) * (b.x - x) > 0) continue;
      top = Math.min(top, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
    }
    return top;
  };
  const formTop = (x: number) => {
    for (let y = body.top; y < arm.under.y; y += 0.2) {
      if (body.width(y) >= x || (y >= arm.tip.y && armAt(arm, y).outer >= x)) return y;
    }
    return arm.under.y;
  };
  // In along the shoulder seam, just under it, to the neck point (inside it the neckline is open), then back out over
  // the top of the shoulder along the form.
  const neck = right.reduce((a, b) => (b.y < a.y ? b : a));
  const inTo = Math.min(xIn, Math.max(neck.x + 0.3, crown.x - 14));
  const xs = (a: number, b: number) => Array.from({ length: 13 }, (_, i) => a + ((b - a) * i) / 12);
  const seam = xs(xIn, inTo).map((x) => ({ x, y: clothTop(x) + 0.6 }));
  const over = xs(inTo, crown.x).map((x) => ({ x, y: Math.min(formTop(x), clothTop(x)) }));
  return [{ x: xIn, y: arm.under.y }, ...seam.filter((q) => Number.isFinite(q.y)), ...over.filter((q) => Number.isFinite(q.y))];
}

/** How far a puff sleeve's crown stands up above the shoulder point. */
const PUFF_RISE = 1.4;
/** How much of a gathered sleeve's fullness and a flared sleeve's flare shows in its width when worn. */
const GATHERED_EASE = 0.6;
const FLARED_EASE = 0.7;

/** The gathers on a sleeve on the form: short strokes fanning into its band or cuff, and over a puff's crown.
 *  For the right sleeve; mirror for the left. Drawn as folds, over the cloth. */
function sleeveMarks(arm: FormArm, sleeve: WornSleeve, head: P = arm.tip): P[][] {
  const { puff, band, bandTop, extra, bandShare } = sleeveRun(arm, sleeve);
  const out: P[][] = [];
  if (band) {
    const y = bandTop - 1.2;
    const a = armAt(arm, y);
    const left = a.inner - 0.3 - bandShare(y) * extra(y) + 0.5;
    const right = a.outer + 0.5 + bandShare(y) * extra(y) - 0.5;
    const n = Math.max(3, Math.round((right - left) / 1.4));
    for (let i = 0; i < n; i++) {
      const x = left + ((right - left) * (i + 0.5)) / n;
      out.push([{ x: x + ((i + 0.5) / n - 0.5) * 0.8, y: y - 2.4 }, { x, y: y + 0.9 }]);
    }
  }
  if (puff) {
    const crown = { x: Math.max(head.x, arm.tip.x), y: Math.min(head.y, arm.tip.y) - PUFF_RISE };
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const y = crown.y + (arm.under.y + 1 - crown.y) * t;
      const x0 = crown.x - 1.6 + 0.6 * t;
      out.push([{ x: x0, y: y + 0.2 }, { x: x0 + 1.4 + 1.2 * Math.sin(Math.PI * t), y: y - 0.9 - 1.2 * (1 - t) }]);
    }
  }
  return out;
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
const HEM_FALL = 0.13;
/** How much of the ease a piece shows where it is held carries down a fitted piece to the hip. */
const HELD_EASE = 0.3;
/** How far below a seam a gathered or eased piece takes to bell out to its own width. */
const BELL = 14;

/** The cloth as it hangs on the form rather than laid out flat. A flat piece spreads its full half-girth; worn,
 *  a fitted piece closes its darts on the body and shows only part of its ease, so below the underarm its sides
 *  follow the form plus that share of the ease. Where a piece is much wider than the form (gathers, a straight
 *  cut) that width is volume: it hangs from the widest point of the form above it (shoulders, bust, hip), never
 *  dipping to the waist, with the same share of the extra showing. From the hip the drawing-in fades out over
 *  25 cm so a skirt keeps its flare, and each hem falls a little at its centre, as a hem does seen from a touch
 *  above. The pattern itself is untouched. */
export function wornCloth(cloth: P[][], body: FormBody, underarmY = body.top, sewn?: SewnLevel[]): P[][] {
  const pieces = cloth.map(dense);
  const worn = pieces.map((s) => s.map(pieceOnForm(s, body, underarmY, undefined, sewn)));
  // A piece hanging from a seam (a skirt from a waist seam) is sewn to the piece above it: at the seam it is as wide
  // as that piece hangs there, then bells out to its own width, so the seam is a line and never a ledge.
  return pieces.map((s, i) => {
    const topY = Math.min(...s.map((q) => q.y));
    if (topY <= underarmY + 2) return worn[i];
    const above = worn.filter((_, j) => j !== i).flatMap((w) => w.filter((q) => Math.abs(q.y - topY) < 1.5 && Math.abs(q.x) > 1));
    return above.length ? s.map(pieceOnForm(s, body, underarmY, Math.max(...above.map((q) => Math.abs(q.x))), sewn)) : worn[i];
  });
}

/** The pattern's finished width at one level of the body, as drafted: a quarter of the finished girth (what the
 *  flat front view shows as half its width), at that level's height in the pieces' coordinates. */
export interface SewnLevel {
  y: number;
  half: number;
}

/** The pattern's finished half-width at any height, between its levels (held at the ends). */
function sewnAt(levels: SewnLevel[]): (y: number) => number | undefined {
  const ls = [...levels].sort((a, b) => a.y - b.y);
  if (!ls.length) return () => undefined;
  return (y) => {
    if (y <= ls[0].y) return ls[0].half;
    for (let i = 1; i < ls.length; i++) {
      if (y <= ls[i].y) {
        const t = (y - ls[i - 1].y) / Math.max(0.01, ls[i].y - ls[i - 1].y);
        return ls[i - 1].half + (ls[i].half - ls[i - 1].half) * t;
      }
    }
    return ls[ls.length - 1].half;
  };
}

/** A piece's outline with no edge longer than 2 cm, so a hem, a shoulder or a side can curve on the form instead of
 *  running straight between two corners. */
function dense(s: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = s[(i + 1) % s.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Where a point of the flat garment lands on the form: by the piece it lies in (the first whose box holds it, else
 *  the nearest), moved as `wornCloth` moves that piece. For the garment's lines (buttons, pockets, pleats, darts),
 *  so they sit on the cloth as drawn rather than where the flat had them. */
export function wornMapper(cloth: P[][], body: FormBody, underarmY = body.top, sewn?: SewnLevel[]): (q: P) => P {
  const boxes = cloth.map((s) => ({
    left: Math.min(...s.map((q) => q.x)),
    right: Math.max(...s.map((q) => q.x)),
    top: Math.min(...s.map((q) => q.y)),
    bottom: Math.max(...s.map((q) => q.y)),
    map: pieceOnForm(s, body, underarmY, undefined, sewn),
  }));
  if (!boxes.length) return (q) => q;
  return (q) => {
    const inBox = boxes.find((b) => q.x >= b.left - 0.5 && q.x <= b.right + 0.5 && q.y >= b.top - 0.5 && q.y <= b.bottom + 0.5);
    const b = inBox ?? boxes.reduce((best, c) => (Math.max(0, c.top - q.y, q.y - c.bottom) < Math.max(0, best.top - q.y, q.y - best.bottom) ? c : best), boxes[0]);
    return b.map(q);
  };
}

/** How `wornCloth` moves each point of one piece. */
function pieceOnForm(s: P[], body: FormBody, underarmY: number, sewnHalf?: number, sewn?: SewnLevel[]): (q: P) => P {
  // The pattern's own finished width at each height (Cat, 2026-10-27: the drawing cinches only as much as the pattern
  // does): the cloth is never drawn narrower than the pattern is sewn there.
  // Each level's width is capped at this piece's own flat width there (a front piece is narrower than a quarter of the
  // girth where the back takes more), and a level the piece does not reach is left out.
  const ownAt = (y: number) => Math.max(0, ...s.filter((q) => Math.abs(q.y - y) < 1).map((q) => Math.abs(q.x)));
  const levels = (sewn ?? []).filter((l) => ownAt(l.y) > 0);
  // Between the levels the sewn width runs smoothly from one to the next, and beyond them it holds the nearest one's.
  // (Not the flat outline's own width: that still holds the darts' take, and read point by point it jumped in and
  // out, so a loose dress showed spikes at the bust, waist and hip, Cat 2026-10-28.)
  const sewnWidth = sewnAt(levels.map((l) => ({ y: l.y, half: Math.min(l.half, ownAt(l.y)) })));
  // The widest the form has been from the top down to each height, at 0.5 cm steps.
  const steps = Math.max(1, Math.ceil((body.bottom - body.top) / 0.5));
  const hang: number[] = [];
  for (let i = 0; i <= steps; i++) hang.push(Math.max(hang[i - 1] ?? 0, body.width(body.top + ((body.bottom - body.top) * i) / steps)));
  const hangAt = (y: number) => hang[Math.min(steps, Math.max(0, Math.round(((y - body.top) / (body.bottom - body.top)) * steps)))];
  {
    const hemY = Math.max(...s.map((q) => q.y));
    const hemHalf = Math.max(1, ...s.filter((q) => q.y > hemY - 1).map((q) => Math.abs(q.x)));
    // A piece hanging from a seam on the body (a skirt from a waist seam) is sewn to the body's width there,
    // gathers and all, and bells out below it.
    const topY = Math.min(...s.map((q) => q.y));
    const seamTop = topY > underarmY + 2 ? topY : undefined;
    // True waist (Cat's D1, 2026-10-26): a piece is judged fitted where it is held, just under the armhole (or at the
    // seam it hangs from): its darts close the rest on the body, so its flat width at the waist is not ease to show. A
    // bodice fitted at the bust follows the form in to the waist; only a cut that is loose at the top hangs straight.
    const heldY = seamTop !== undefined ? seamTop + 1 : underarmY + 1.5;
    const heldHalf = Math.max(0, ...s.filter((q) => Math.abs(q.y - heldY) < 2.5).map((q) => Math.abs(q.x)));
    const overHeld = heldHalf ? heldHalf - body.width(Math.min(heldY, body.bottom)) : 0;
    const fittedHeld = Math.min(1, Math.max(0, (VOLUME_FROM - overHeld) / (VOLUME_FROM - FITTED_UP_TO)));
    const hemHalfFlat = hemHalf;
    const hipY = body.bottom;
    return (q) => {
      const below = Math.max(0, q.y - body.bottom);
      const share = WORN_EASE + (1 - WORN_EASE) * Math.min(1, below / 25);
      const w = body.width(Math.min(q.y, body.bottom));
      const h = hangAt(q.y);
      let x = q.x;
      const out = Math.abs(q.x) - h;
      if (out > 0) x = Math.sign(q.x) * (h + Math.min(out, FLARE_TRUE) + Math.max(0, out - FLARE_TRUE) * share);
      // Fitted: follow the form itself, not its widest point, between the underarm and the hip.
      const over = Math.abs(q.x) - w;
      if (over > 0 && q.y > underarmY && below === 0) {
        const fitted = Math.min(1, Math.max(0, (VOLUME_FROM - over) / (VOLUME_FROM - FITTED_UP_TO)));
        const hug = Math.sign(q.x) * (w + Math.min(over, FITTED_UP_TO) * WORN_EASE);
        x = hug * fitted + x * (1 - fitted);
        if (heldHalf && q.y > heldY - 1) {
          // Held fitted above: close in to the body plus the ease it showed there, down to the hip, letting go over the
          // last stretch above the hip so a flare from the hip still flares.
          const carried = fittedHeld * Math.min(1, Math.max(0, (hipY - q.y) / 8));
          const held = Math.sign(q.x) * (w + Math.min(Math.max(0, overHeld), FITTED_UP_TO) * HELD_EASE);
          if (Math.abs(held) < Math.abs(x)) x = held * carried + x * (1 - carried);
        }
      }
      if (q.y > hipY - 2 && hemY > hipY + 8 && hemHalfFlat > body.width(body.bottom) + 1.5) {
        // Soft fall: below the hip the sides sway in a touch before the hem, so the skirt falls instead of standing out
        // as a stiff cone.
        const t = Math.min(1, (q.y - (hipY - 2)) / Math.max(1, hemY - (hipY - 2)));
        const flare = Math.max(0, Math.abs(x) - body.width(body.bottom));
        x -= Math.sign(x) * Math.min(1.2, 0.12 * flare) * Math.sin((Math.PI / 2) * t) * Math.min(1, Math.abs(q.x) / Math.max(1, hemHalfFlat));
      } else if (q.y > hipY + 2 && hemY > hipY + 10 && Math.abs(x) > body.width(body.bottom) - 1) {
        // A straight cut hangs in a touch from the hip to its hem: a tube that falls, not a box that stands.
        const t = Math.min(1, (q.y - hipY - 2) / Math.max(1, hemY - hipY - 2));
        x -= Math.sign(x) * 0.5 * t * Math.min(1, Math.abs(q.x) / Math.max(1, hemHalfFlat));
      }
      // Never narrower than the pattern is sewn at this height: its finished width, darts closed, ease and all.
      // A point inside the outline is held only to its own flat place, so the floor rises with the edge, never in a step.
      const floor = sewnWidth(q.y);
      if (floor !== undefined && Math.abs(x) < Math.min(floor, Math.abs(q.x))) x = Math.sign(q.x) * Math.min(floor, Math.abs(q.x));
      // Sewn to the piece above at the seam, then out to its own width: the floor joins in over the same stretch.
      if (seamTop !== undefined && q.y < seamTop + BELL && Math.abs(q.x) > w) {
        const t = Math.min(1, (q.y - seamTop) / BELL);
        const ease = t * t * (3 - 2 * t);
        const sewn = Math.sign(q.x) * (sewnHalf ?? w + Math.min(Math.abs(q.x) - w, FITTED_UP_TO) * WORN_EASE);
        x = sewn * (1 - ease) + x * ease;
      }
      // The hem falls at its centre, seen a little from above.
      const y = q.y > hemY - 0.8 && q.y > underarmY + 4 ? q.y + HEM_FALL * hemHalf * (1 - Math.min(1, (q.x / hemHalf) ** 2)) : q.y;
      return { x, y };
    };
  }
}

/** How far beyond the form's widest point a piece shows at its full pattern width (a drawn flare lands where it was
 *  drawn, Cat 2026-10-27); only fullness past that hangs in, in folds. */
const FLARE_TRUE = 16;

/** How much wider than it shows on the form a piece's hem has to be before its fullness is drawn as folds. */
const FOLDS_FROM = 5;

/**
 * Where a piece is far fuller than it shows on the form (a gathered or circle skirt, a loose shift), its
 * extra width hangs in folds: a few soft lines falling from just under where the piece is held to its hem,
 * one or two more the fuller it is. Drawn over the cloth, clipped to it. Fitted pieces get none.
 */
export function wornFolds(cloth: P[][], worn: P[][]): P[][] {
  const out: P[][] = [];
  cloth.forEach((flat, i) => {
    const w = worn[i];
    if (!w || flat.length < 4) return;
    const hemY = Math.max(...flat.map((q) => q.y));
    const topY = Math.min(...flat.map((q) => q.y));
    if (hemY - topY < 14) return;
    const half = (s: P[], y: number) => Math.max(0, ...s.filter((q) => Math.abs(q.y - y) < 1.5).map((q) => Math.abs(q.x)));
    const extra = half(flat, hemY) - half(w, Math.max(...w.map((q) => q.y)));
    if (extra < FOLDS_FROM) return;
    const n = Math.max(1, Math.min(4, Math.round(extra / 6)));
    const wornHemY = Math.max(...w.map((q) => q.y));
    const wornHem = half(w, wornHemY);
    const held = Math.max(0.5, half(w, topY));
    for (const s of [1, -1]) {
      for (let k = 1; k <= n; k++) {
        const u = k / (n + 1);
        const a = { x: s * held * (0.15 + 0.75 * u), y: topY + 2.5 };
        const b = { x: s * wornHem * (0.12 + 0.8 * u), y: wornHemY - 0.6 };
        const c = { x: (a.x + b.x) / 2 + s * 1.2, y: (a.y + b.y) / 2 };
        out.push(Array.from({ length: 11 }, (_, j) => {
          const t = j / 10;
          return { x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * c.y + t * t * b.y };
        }));
      }
    }
  });
  return out;
}

/** A piece's hem corner on its right: the furthest-out point of its last few centimetres, where a flare handle sits. */
export function hemCorner(piece: P[]): P | undefined {
  if (!piece.length) return undefined;
  const hemY = Math.max(...piece.map((q) => q.y));
  const foot = piece.filter((q) => q.x > 0 && q.y > hemY - 6);
  return foot.length ? foot.reduce((a, b) => (b.x > a.x ? b : a)) : undefined;
}

/** The garment's shoulder point on its right: the furthest-out point of its cloth above the underarm. */
function shoulderPoint(cloth: P[][], arm: FormArm): P | undefined {
  const top = cloth.flat().filter((q) => q.x > 0 && q.y <= arm.under.y - 2);
  if (!top.length) return undefined;
  // The highest of the outermost points: the shoulder corner, not a point of the armhole just under it.
  const wide = Math.max(...top.map((q) => q.x));
  return top.filter((q) => q.x > wide - 0.8).reduce((a, b) => (b.y < a.y ? b : a));
}

/** The arms, each its outline round from the shoulder to the wrist and on into a hand, like a mannequin's
 *  (Cat's F5, 2026-10-25: no stripes down them, no flat cut ends; D2, 2026-10-26: hands). */
function formArmLines(arms: FormArm | undefined, cx: number): { d: string; edge: boolean }[] {
  if (!arms) return [];
  const ys = (a: number, b: number) => Array.from({ length: 41 }, (_, i) => a + ((b - a) * i) / 40);
  const outer = ys(arms.tip.y, arms.wristY).map((y) => ({ x: armAt(arms, y).outer, y }));
  const inner = ys(arms.under.y, arms.wristY).map((y) => ({ x: armAt(arms, y).inner, y }));
  const wrist = armAt(arms, arms.wristY);
  const mid = (wrist.inner + wrist.outer) / 2;
  // A hand, as a mannequin's (Cat's D2, 2026-10-26): the wrist runs on into a slim hand, a little fuller at the palm,
  // tapering to rounded fingertips.
  const cap = Array.from({ length: 25 }, (_, i) => {
    const a = (Math.PI * i) / 24;
    const t = Math.sin(a);
    const r = ((wrist.outer - wrist.inner) / 2) * (1 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.3)) - 0.3 * Math.max(0, t - 0.8) ** 1.2);
    return { x: mid + r * Math.cos(a) + 0.3 * t, y: arms.wristY + HAND_CM * Math.sin(a) ** 0.85 };
  });
  // Up the inside from the wrist, over the shoulder, down the outside and round the end of the wrist.
  const outline = [...[...inner].reverse(), ...outer, ...cap];
  return [1, -1].map((s) => ({ d: formPath(outline.map((q) => ({ x: cx + SQUEEZE * s * q.x, y: q.y }))), edge: true }));
}

/** How long the hand is below the wrist, in cm. */
const HAND_CM = 6.5;

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
  /** The length, set with a dot on the hem and named marks beside the body. */
  hem?: HemChoice;
  /** The pattern's finished widths at the bust, waist and hip, so the cloth is never drawn narrower than it is sewn. */
  sewn?: SewnLevel[];
  /** The garment's own lines from its flat (buttons, pockets, pleats, darts, seams), in the pieces' coordinates:
   *  laid on the cloth where `wornCloth` puts each piece. */
  flatLines?: P[][];
  label: string;
}

/** The light on the cloth on the form (Cat's F5 Satin and Light, deepened in her D3, 2026-10-26): round like a body,
 *  brightest a third of the way across from the left, turning into shadow at both sides and deepest on the right
 *  where the cloth turns away, so a print reads and black cloth has form without an outline. Each stop is where
 *  across the drawing it sits, its colour and how strong. */
const ROUND_STOPS: [number, string, number][] = [
  [0, '#000', 0.72],
  [0.1, '#000', 0.34],
  [0.3, '#fff8e6', 0.22],
  [0.46, '#fff8e6', 0.05],
  [0.68, '#000', 0.26],
  [0.86, '#000', 0.55],
  [1, '#000', 0.78],
];
/** The light down the body (Cat's D3), by height in the form's cm: a lift over the bust, shade under it that draws
 *  the waist in, a shadow under the waist seam, and the skirt coming back into the light. The bust is taken as
 *  15 cm above the waist. */
function downLight(body: FormBody, bottom: number): [number, string, number][] {
  const w = body.waistY;
  return [
    [body.top, '#000', 0],
    [w - 7, '#000', 0],
    [w - 3, '#000', 0.14],
    [w, '#000', 0.22],
    [w + 0.6, '#000', 0.3],
    [w + 5, '#000', 0.1],
    [w + 16, '#000', 0],
    [bottom, '#fff8e6', 0.03],
  ];
}
/** How far above the waist the bust sits, in cm, for the light on it. */
const BUST_ABOVE_WAIST = 15;
/** Soft bands of shade across the skirt below the hip, the folds its fullness falls in. */
const FOLD_BANDS: [string, string, number][] = [
  ['0', '#000', 0.1],
  ['0.12', '#000', 0],
  ['0.24', '#000', 0.11],
  ['0.38', '#000', 0],
  ['0.52', '#000', 0.09],
  ['0.66', '#000', 0],
  ['0.8', '#000', 0.12],
  ['0.92', '#000', 0.02],
  ['1', '#000', 0.1],
];

/** The light on the flat drawing: lit from the left, falling into shade on the right. Each stop is where along
 *  the piece it sits, its colour and how strong. */
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
export function FormSketch({ body, m, legs, bottom, arms, lines, outline = [], cloth, sleeve, underarmY, hem, flatLines, label, sewn }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const worn = useMemo(() => (cloth ? wornCloth(cloth, body, underarmY ?? arms?.under.y, sewn) : undefined), [cloth, body, underarmY, arms, sewn]);
  const onCloth = useMemo(() => {
    if (!cloth || !flatLines?.length) return lines;
    const map = wornMapper(cloth, body, underarmY ?? arms?.under.y, sewn);
    return { ...lines, seam: [...(lines.seam ?? []), ...flatLines.map((run) => run.map(map))] };
  }, [cloth, flatLines, lines, body, underarmY, arms, sewn]);
  const folds = useMemo(() => (cloth && worn ? wornFolds(cloth, worn) : undefined), [cloth, worn]);
  const frame = useMemo(() => formFrame(m, body, bottom, arms, worn), [m, body, bottom, arms, worn]);
  const cx = frame.half;
  // The dot sits on the hem as drawn at the centre, where the cloth has one there near the length picked.
  const picked = hem?.marks.find((k) => k.id === hem.value)?.y;
  const centre = (worn ?? []).flat().filter((q) => Math.abs(q.x) < 2);
  const low = centre.length ? Math.max(...centre.map((q) => q.y)) : undefined;
  const hemAt = picked !== undefined && low !== undefined && Math.abs(low - picked) < 6 ? low : undefined;
  // Enlarged, the garment fills the screen (Cat's E2, 2026-10-25): from a little above it (the neck at most) to a
  // little past its hem. The hem dot still drags past the bottom; let go, the drawing reframes to the new length.
  const big = useEnlarged();
  const lowest = Math.max(...(worn ?? []).flat().map((q) => q.y), body.top + 20);
  const highest = Math.min(...(worn ?? []).flat().map((q) => q.y), body.top + 20);
  // The figure fills the frame (Cat's D5, 2026-10-26): the drawing stops a little below the hem, where the legs fade
  // out, as in the draw tool. The named lengths show only on the length step, and there the frame reaches down to
  // the lowest of them so every one stays in reach.
  const ladder = useLengthStep() && !big && !!hem;
  const reach = ladder ? Math.max(...hem!.marks.map((q) => q.y)) + 6 : 0;
  const cropped = worn?.length ? Math.min(frame.bottom, Math.max(lowest + BELOW_HEM, reach)) : frame.bottom;
  const view = big ? { top: Math.max(body.top + 2, highest - 10), bottom: Math.min(frame.bottom + 6, lowest + 12) } : { top: frame.top, bottom: cropped };
  const k = (view.bottom - view.top) / 110;
  // Room for the length marks on the left, and as much on the right to keep the form centred. Without them the dot
  // still drags, and names the length it's on under itself.
  const side = hem ? (ladder ? MARGIN : 3) * k : 0;
  return (
    // With a hem dot it is a group, not an image: an image hides the dot inside it from screen readers.
    <svg ref={svg} viewBox={`${f(-side)} ${f(view.top)} ${f(2 * cx + 2 * side)} ${f(view.bottom - view.top)}`} role={hem ? 'group' : 'img'} aria-label={label} className="preview-svg sketch shape form-still">
      <FormLayers body={body} m={m} legs={legs} cx={cx} top={frame.top} bottom={big ? frame.bottom : cropped} arms={arms} lines={onCloth} outline={outline} worn={worn} folds={folds} sleeve={sleeve} />
      {hem && <HemMarks {...hem} svg={svg} cx={cx} k={k} hemAt={hemAt} bare={!ladder} />}
    </svg>
  );
}

interface LayerProps extends Omit<Props, 'cloth' | 'underarmY' | 'label' | 'outline'> {
  /** The centre line's x, in the drawing. */
  cx: number;
  /** The drawing's bottom, for the form's stand. */
  bottom: number;
  /** The drawing's top, where it crops the form at the neck: the form's lines fade in below it instead of ending
   *  in a row of bristles (look and feel review, 2026-10-24). Left out, nothing fades. */
  top?: number;
  outline?: P[][];
  /** The garment as cloth, already laid on the form by `wornCloth`. */
  worn?: P[][];
  /** The folds its fullness falls in, from `wornFolds`. */
  folds?: P[][];
}

/**
 * The form and the garment on it, as layers inside an SVG whose centre line is at `cx`: the legs or the stand,
 * the arms, the form's contours, the cloth with its sleeves, and the garment's lines over it. The still Form
 * view and the skirt's and top's draggable sketches all draw the garment this way, so it looks the same everywhere.
 */
export function FormLayers({ body, m, legs, cx, top, bottom, arms, lines, outline = [], worn, folds = [], sleeve }: LayerProps) {
  const head = useMemo(() => formHead(body, cx), [body, cx]);
  const armLines = useMemo(() => formArmLines(arms, cx), [arms, cx]);
  const at = (pts: P[]) => formPath(pts.map((q) => ({ x: cx + SQUEEZE * q.x, y: q.y })));
  const showLegs = legs && m.full_hip && m.waist_to_hip && m.waist_to_knee && m.waist_to_floor;
  const cloth = !!worn;
  // The cloth: sleeves first, then the body over their heads, then collars and lapels over that. Each piece is
  // its own path: pieces overlap (a lapel on its front, a sleeve on the body) and one path would punch holes there.
  const sleeves = useMemo(() => (arms && sleeve && worn ? [sleeveShape(arms, sleeve, shoulderPoint(worn, arms), worn, body)].flatMap((s) => [s, s.map((q) => ({ x: -q.x, y: q.y }))]) : []), [arms, sleeve, worn, body]);
  const marks = useMemo(() => (arms && sleeve && worn ? sleeveMarks(arms, sleeve, shoulderPoint(worn, arms)).flatMap((s) => [s, s.map((q) => ({ x: -q.x, y: q.y }))]) : []), [arms, sleeve, worn]);
  const onForm = worn ? [...sleeves, ...worn] : [];
  const pieces = onForm.map((s) => `${at(s)} Z`);
  const look = useFabricLook();
  const hems = look?.border ? borderHems(onForm) : [];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shade = `shade${uid}`;
  const clip = `clip${uid}`;
  const fade = `fade${uid}`;
  const neck = `neck${uid}`;
  const soft = `soft${uid}`;
  const cast = `cast${uid}`;
  /** The form's lines start at `body.top`, 2 cm below the drawing's top (`formFrame`): they fade in from there. */
  const FADE_FROM = (top ?? 0) + 2;
  /** How far below that the form's lines take to come in fully. */
  const FADE_CM = 5;
  const drawn = cloth ? Object.fromEntries(Object.entries(lines).filter(([id]) => !CLOTH_EDGES.includes(id as FormLine))) : lines;
  return (
    <>
      {top !== undefined && (
        <defs>
          <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={f(FADE_FROM)} y2={f(FADE_FROM + FADE_CM)}>
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id={neck} maskUnits="userSpaceOnUse" x={f(-cx)} y={f(top - 1)} width={f(4 * cx)} height={f(bottom - top + 2)}>
            <rect x={f(-cx)} y={f(top - 1)} width={f(4 * cx)} height={f(bottom - top + 2)} fill={`url(#${fade})`} />
          </mask>
        </defs>
      )}
      {cloth && (
        <defs>
          <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={f(cx * 0.15)} x2={f(cx * 1.85)} y1="0" y2="0">
            {ROUND_STOPS.map(([offset, color, opacity]) => (
              <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
          </linearGradient>
          <clipPath id={clip}>
            {pieces.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </clipPath>
          {
            // The light falls down the body too: a lift over the bust, shade under it and in at the waist, a shadow
            // under the waist seam, and the skirt's fullness falling in soft bands of shade.
            <>
              <linearGradient id={`down${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={f(body.top)} y2={f(bottom)}>
                {downLight(body, bottom).map(([at, color, opacity], i) => (
                  <stop key={i} offset={f((at - body.top) / (bottom - body.top))} stopColor={color} stopOpacity={opacity} />
                ))}
              </linearGradient>
              {/* The lift over the bust and the shade under it are the shape of the bust, not bands across the garment
                  (a tee or jacket is wider than the body there). */}
              <radialGradient id={`bust${uid}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform={`translate(${f(cx * 0.93)} ${f(body.waistY - BUST_ABOVE_WAIST)}) scale(${f(SQUEEZE * body.width(body.waistY - BUST_ABOVE_WAIST) * 1.5)} 5.5)`}>
                <stop offset="0" stopColor="#fff8e6" stopOpacity="0.07" />
                <stop offset="0.6" stopColor="#fff8e6" stopOpacity="0.025" />
                <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`underbust${uid}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform={`translate(${f(cx)} ${f(body.waistY - BUST_ABOVE_WAIST + 9)}) scale(${f(SQUEEZE * body.width(body.waistY - BUST_ABOVE_WAIST) * 1.5)} 6)`}>
                <stop offset="0" stopColor="#000" stopOpacity="0.12" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`bands${uid}`} gradientUnits="userSpaceOnUse" x1={f(cx * 0.25)} x2={f(cx * 1.75)} y1="0" y2="0">
                {FOLD_BANDS.map(([at, color, opacity], i) => (
                  <stop key={i} offset={at} stopColor={color} stopOpacity={opacity} />
                ))}
              </linearGradient>
              <linearGradient id={`bandfade${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={f(body.bottom - 4)} y2={f(body.bottom + 14)}>
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity="1" />
              </linearGradient>
              <mask id={`bandmask${uid}`} maskUnits="userSpaceOnUse" x={f(-cx)} y={f(body.top)} width={f(4 * cx)} height={f(bottom - body.top + 2)}>
                <rect x={f(-cx)} y={f(body.top)} width={f(4 * cx)} height={f(bottom - body.top + 2)} fill={`url(#bandfade${uid})`} />
              </mask>
            </>
          }
          {/* The cloth's edges turn away from the light: a soft shadow just inside them, and one on the form under them. */}
          <filter id={soft} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <filter id={cast} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0.5" dy="0.9" stdDeviation="0.9" floodColor="#000" floodOpacity="0.85" />
          </filter>
        </defs>
      )}
      {cloth && <ClothDefs uid={uid} x1={cx * 0.2} x2={cx * 1.8} look={look} />}
      {
        // The legs fade out toward the drawing's bottom rather than being cut off at it.
        <defs>
          <linearGradient id={`legfade${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={f(bottom - 9)} y2={f(bottom - 1)}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`legmask${uid}`} maskUnits="userSpaceOnUse" x={f(-cx)} y={f(body.top)} width={f(4 * cx)} height={f(bottom - body.top + 2)}>
            <rect x={f(-cx)} y={f(body.top)} width={f(4 * cx)} height={f(bottom - body.top + 2)} fill={`url(#legfade${uid})`} />
          </mask>
        </defs>
      }
      {showLegs ? (
        <g transform={`translate(${f(cx * (1 - SQUEEZE))} ${f(body.waistY)}) scale(${SQUEEZE} 1)`} mask={`url(#legmask${uid})`}>
          {/* The legs in the same satin as the torso and arms: one mannequin from head to heel (Cat's D2). */}
          <SatinDefs id={`legsatin${uid}`} cx={cx} />
          <path d={bodyOutline(m as SkirtMeasurements, cx)} fill={`url(#legsatin${uid})`} stroke="none" />
          <path d={bodyOutline(m as SkirtMeasurements, cx)} className="form-line" fill="none" strokeWidth={0.12} opacity={0.35} />
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
      {/* With a head the neck runs into the jaw (FormHead); without one its lines fade in at the top. */}
      <g mask={top !== undefined && !head ? `url(#${neck})` : undefined}>
        <FormSatin body={body} cx={cx} arms={arms} uid={uid} legsTo={showLegs ? { y: body.waistY + (m.waist_to_hip! + 7), half: (m.full_hip! / 4) * 0.74 } : undefined} />
      </g>
      {head && <FormHead head={head} cx={cx} />}
      {cloth && (
        <g className="cloth" filter={`url(#${cast})`}>
          {pieces.map((d, i) => (
            <g key={`c${i}`}>
              <path d={d} className="cloth-fill" strokeWidth={0.3} strokeLinejoin="round" fillOpacity={look?.sheer ? SHEER_OPACITY : undefined} />
              <ClothOverlay d={d} uid={uid} k={`p${i}`} look={look} hemY={hems[i]} />
              <path d={d} fill={`url(#${shade})`} stroke="none" opacity={look?.sheer ? 0.6 : undefined} />
              <path d={d} fill={`url(#down${uid})`} stroke="none" />
              {body.head && (
                <>
                  <path d={d} fill={`url(#bust${uid})`} stroke="none" />
                  <path d={d} fill={`url(#underbust${uid})`} stroke="none" />
                </>
              )}
              <path d={d} fill={`url(#bands${uid})`} stroke="none" mask={`url(#bandmask${uid})`} />
              <g clipPath={`url(#${clip})`}>
                <path d={d} className="cloth-turn" fill="none" strokeWidth={1.3} filter={`url(#${soft})`} />
              </g>
              <path d={d} className="cloth-edge" fill="none" strokeWidth={0.07} strokeLinejoin="round" opacity={0.45} />
            </g>
          ))}
        </g>
      )}
      {cloth && arms && !sleeve && (
        <g mask={top !== undefined ? `url(#${neck})` : undefined}>
          <SatinDefs id={`armsatin${uid}`} cx={cx} arms={arms} />
          {armLines.map((a, i) => <path key={`armover${i}`} d={`${a.d} Z`} fill={`url(#armsatin${uid}${i})`} stroke="none" />)}
          {armLines.map((a, i) => <path key={`armedge${i}`} d={a.d} className="form-line" fill="none" strokeWidth={0.12} opacity={0.35} />)}
        </g>
      )}
      {outline.map((pts, i) => (
        <path key={`o${i}`} d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g clipPath={cloth ? `url(#${clip})` : undefined}>
        {[...folds, ...marks].map((pts, i) => (
          <path key={`fold${i}`} d={at(pts)} className="cloth-fold" fill="none" strokeWidth={0.16} strokeLinecap="round" />
        ))}
        {Object.entries(drawn).flatMap(([id, runs]) =>
          (runs ?? []).map((pts, i) => (
            <g key={`${id}${i}`}>
              {cloth ? (
                // On the cloth a seam is only a soft pressed groove (Cat's D4, 2026-10-26): no fold line, no thread of
                // light, no drafting marks on the dress.
                <path d={at(pts)} className="seam-groove" fill="none" strokeWidth={0.55} opacity={0.5} filter={`url(#${soft})`} strokeLinecap="round" />
              ) : (
                <path d={at(pts)} className="tape" fill="none" strokeWidth={0.3} strokeLinecap="round" />
              )}
            </g>
          )),
        )}
      </g>
    </>
  );
}
