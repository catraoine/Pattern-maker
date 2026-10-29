// Draw on your form: a dress form built from your measurements, in fine contour lines, with the
// garment's neckline, seams, drape, side and hem drawn on it like a draper's style tape. Turn it to
// the back, draw a new line with a finger, and the pattern follows it (see formLines.ts for how each
// line is read). What a line will become shows while it is drawn; each line can be undone and redone.
// One way out each way (Cat's pick D1 Steady Top, 2026-10-18): Done keeps the lines, and the header's ←
// (or the phone's back) leaves without them, asking first once any line is drawn.
import { PointerEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';

import { legsFor } from '../engine/form';
import { bodyHalf } from '../engine/body';

import { FormLine, FormSide, Reading, landmarks } from './formLines';
import { BELOW_HEM, CLOTH_EDGES, FormHead, FormLayers, FormSatin, HEAD_CM, SQUEEZE, SewnLevel, WornSleeve, formHead, wornCloth } from './FormSketch';
import { TestingTag } from './TestingTag';
import { DemoButton } from './DemoButton';
import { AllRound, RoundPick } from './AllRound';
import type { RoundGarment } from '../engine/allRound';
import type { RoundMeasurements } from './allRoundShape';
import type { MyFabric } from '../engine/fabrics';
import { tookEnlarged } from './EnlargeSketch';
import { isLadderStep } from '../nav';

type Measures = { full_bust?: number; neck?: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number; crotch_depth?: number };

/** The form's outline: half its width at each height, from its top to where it ends above the stand or legs. */
export interface FormBody {
  width: (y: number) => number;
  top: number;
  bottom: number;
  waistY: number;
  /** A bodice form has a neck, so the head sits on it. */
  head?: boolean;
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
  // The arm hangs close by the body, as it does standing at ease, a touch further from it towards the hand.
  const inner = under.x + 0.25 + 0.012 * Math.max(0, y - under.y);
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
  /** The only kinds drawn on the back, where a garment takes just a few there; the rest are front only. */
  backKinds?: FormLine[];
  /** Arms beside the form, for a sleeve line. */
  arms?: FormArm;
  /** The garment as cloth from the front (its flat's front view), worn on the form as on the Style page, so you
   *  draw on the garment itself and see it change as each line lands (Cat's D1 Draw on the Dress, 2026-10-24). */
  cloth?: P[][];
  /** The drafted sleeve, to hang on the arms with the cloth. */
  sleeve?: WornSleeve;
  /** Where the underarm is: below it a fitted piece's sides follow the form. */
  underarmY?: number;
  /** The pattern's finished widths at the bust, waist and hip, so the cloth is never drawn narrower than it is sewn. */
  sewn?: SewnLevel[];
  /** The garment as All round shows it, to draw on while it turns (Cat's A Draw on it, 2026-10-28). */
  allRound?: { round: RoundGarment; m: RoundMeasurements; fabric?: MyFabric; striped?: boolean | 'checks' | 'stripes' };
  onDone: () => void;
  onCancel: () => void;
}

const HELP: Record<FormLine, string> = {
  neckline: 'Draw the neckline from the shoulder down to where you want it. Both sides match. From one shoulder across to under the other arm makes it one-shoulder.',
  seam: 'Draw from the shoulder or armhole through the bust to the waist for princess seams, or from any edge to the bust for a dart. They start where you draw them.',
  drape: 'Draw how the cloth hangs: dipping across the neck from shoulder to shoulder for a cowl, or flaring out from the waist for a peplum (wavy for gathers).',
  fit: 'Draw down the side, closer to the body for a closer fit or further out for more room.',
  hem: 'Draw across where you want the hem. Curve it to shape it, or turn to the back and draw it lower for a high-low hem.',
  sleeve: 'Draw across the arm where the sleeve should end. Draw down the outside of the arm for its shape: close for fitted, puffed at the top, full at the wrist for bishop, flaring for flutter. From the neck to under the arm makes raglan sleeves; across the top of the arm, a dropped shoulder.',
  front: 'Draw down the front where its edge should sit: just past the centre for one row of buttons, further across for two.',
  collar: 'Draw from the shoulder down the front: down to the bust for lapels, round to the centre for a collarless neck.',
  waist: 'Draw across the body where the bodice meets the skirt: just under the bust for an empire line, at the waist, or low on the hip for a drop waist.',
  slit: 'Draw up from the hem where you want the slit: at the centre front, the side, or turn to the back. It opens as high as you draw.',
  fullness: 'Draw short marks down from the waist for pleats, a wavy line along the waist for gathers, points up from the hem for godets, or a wavy line across low down for a flounce.',
  pocket: 'Draw where the pocket goes: a slant from the waist to the side, or a short line down the side seam.',
  vent: 'Turn to the back and draw up from the hem at the centre for a vent.',
};
const BACK_HELP: Partial<Record<FormLine, string>> = {
  neckline: 'Draw down the back to set how low the back neckline goes.',
  seam: 'Draw a princess seam from the shoulder or armhole down to the waist.',
  hem: 'Draw the back hem. Lower than the front makes a high-low hem.',
};
/** Kinds that are drawn on the front only. */
const FRONT_ONLY: FormLine[] = ['drape', 'fit', 'waist', 'collar', 'sleeve'];

/** Marks the drawing's own entry in the browser's history. */
const DRAWING = 'drawing';

const f = (n: number) => n.toFixed(2);
const path = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** The bodice form: the neck, a rounded shoulder, then bust, waist and hip, from the drafted block. */
export function formWidth(draft: BodiceDraft, m: Measures & { full_bust: number }): FormBody {
  return torsoForm(landmarks(draft), m);
}

/** The real body's side (engine/body.ts) run through the drawing's own landmarks: between one landmark and the next
 *  the body's own profile carries, scaled so it meets each landmark's width exactly. `marks` pairs the drawing's
 *  heights (cm) and half-widths with the body's heights (the form's units). */
function realSide(marks: { y: number; by: number; half: number }[]): (y: number) => number {
  const ks = marks.map((m) => ({ ...m, k: m.half / bodyHalf(m.by) }));
  return (y: number) => {
    if (y <= ks[0].y) return bodyHalf(ks[0].by + (y - ks[0].y) * ((ks[1].by - ks[0].by) / (ks[1].y - ks[0].y))) * ks[0].k;
    const last = ks[ks.length - 1];
    if (y >= last.y) {
      const prev = ks[ks.length - 2];
      return bodyHalf(last.by + (y - last.y) * ((last.by - prev.by) / (last.y - prev.y))) * last.k;
    }
    let i = 0;
    while (y > ks[i + 1].y) i++;
    const a = ks[i], b = ks[i + 1];
    const u = (y - a.y) / (b.y - a.y);
    const by = a.by + (b.by - a.by) * u;
    const s = u * u * (3 - 2 * u);
    return bodyHalf(by) * (a.k + (b.k - a.k) * s);
  };
}

/** A torso form through the body's own landmarks: the neck point, the shoulder tip, the bust's height and the waist's.
 *  Its outline is the real body's (Cat, 2026-10-27): the neck rising out of the trapezius, the shoulder sloping to its
 *  tip, the chest, the waist and the hip, each landmark at the measured width. */
export function torsoForm({ neckPoint, shoulderTip, apex, waistY }: { neckPoint: P; shoulderTip: P; apex: P; waistY: number }, m: Measures & { full_bust: number }): FormBody {
  // The neck from the neck measurement, not the garment's neckline (a boat neck's points sit far out), as slim
  // beside the head as on the welcome form: drawn, after the squeeze, about 0.45 of the head's width.
  const neck = Math.min(neckPoint.x, ((m.neck ?? 34) / (2 * Math.PI)) * 0.95);
  const bust = m.full_bust / 4;
  const hip = m.full_hip && m.waist_to_hip ? { at: waistY + m.waist_to_hip, half: m.full_hip / 4 } : undefined;
  const bottom = hip ? hip.at + 8 : waistY + 8;
  const side = realSide([
    { y: neckPoint.y - 6, by: -1.62, half: neck },
    { y: shoulderTip.y, by: -1.34, half: Math.max(shoulderTip.x, neck + 2) },
    { y: apex.y, by: -0.58, half: bust },
    { y: waistY, by: 0.1, half: m.waist / 4 },
    ...(hip ? [{ y: hip.at, by: 0.82, half: hip.half }] : [{ y: waistY + 8, by: 0.4, half: (m.waist / 4) * 1.08 }]),
  ]);
  const width = (y: number) => side(Math.min(y, bottom));
  return { width, top: neckPoint.y - 7, bottom, waistY, head: true };
}

/** The skirt form: a lower torso from a little above the waist to below the hip, the waist at y = 0. */
export function skirtForm(m: { waist: number; full_hip: number; waist_to_hip: number }): FormBody {
  const side = realSide([
    { y: 0, by: 0.1, half: m.waist / 4 },
    { y: m.waist_to_hip, by: 0.82, half: m.full_hip / 4 },
  ]);
  return { width: side, top: -12, bottom: m.waist_to_hip + 8, waistY: 0 };
}

export function DrawOnForm<C>({ body, m, legs, bottom, kinds, lines, choices, onChoices, read, help: helpFor, backs = true, backKinds, arms, cloth, sleeve, underarmY, sewn, allRound, onDone, onCancel }: Props<C>) {
  const svg = useRef<SVGSVGElement>(null);
  const [kind, setKind] = useState<FormLine>(kinds[0][0]);
  const [side, setSide] = useState<FormSide>('front');
  /** Drawing on the turning garment (All round) rather than the flat form. */
  const [onRound, setOnRound] = useState(false);
  const [stroke, setStroke] = useState<P[]>();
  const [said, setSaid] = useState<string>();
  const [live, setLive] = useState<string>();
  /** The choices before each line, newest last, for undoing one line at a time; and the lines undone, to redo. */
  const [steps, setSteps] = useState<C[]>([]);
  const [undone, setUndone] = useState<C[]>([]);
  /** Asking whether to leave without the lines, after ← or the phone's back. */
  const [asking, setAsking] = useState(false);
  /** The form enlarged to fill the screen, for a roomier place to draw. */
  // Opened from the enlarged preview, it opens enlarged too.
  const [big, setBig] = useState(tookEnlarged);
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    window.addEventListener('keydown', key);
    // The page underneath stays put while the form fills the screen.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
    };
  }, [big]);
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
    const on = (e: PopStateEvent) => {
      if (leaving.current || isLadderStep(e)) return;
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
  const frontOnly = (k: FormLine) => FRONT_ONLY.includes(k) || (!!backKinds && !backKinds.includes(k));
  const onBack = side === 'back' && frontOnly(kind) ? false : side === 'back';

  // The legs to your measurements, from where they part down to the floor (cm below the waist).
  const legLines = useMemo(() => {
    if (!legs || !m.full_hip || !m.waist_to_hip || !m.waist_to_knee || !m.waist_to_floor) return undefined;
    const lg = legsFor(m as Parameters<typeof legsFor>[0]);
    const y0 = body.waistY;
    return { ...lg, crotch: y0 + lg.crotch, floor: y0 + lg.floor, at: (y: number) => lg.half(y - y0) };
  }, [legs, m, body]);
  // With legs, the body runs on down to where they part.
  const torsoBottom = legLines ? Math.max(body.bottom, legLines.crotch) : body.bottom;

  // The figure fills the drawing (Cat's D5, 2026-10-26): just wider than the arms and the garment, down to a little
  // below the hem (room to draw it longer) rather than always to the floor.
  // The frame holds still while you draw (Cat, 2026-10-27: the body jumped as the hem moved): set when the tool opens,
  // its centre never moves and it only grows downward, when a hem is drawn near its foot.
  const heldFrame = useRef<{ half: number; top: number; bottom: number } | null>(null);
  const frame = useMemo(() => {
    const all = (cloth ?? []).flat();
    const wide = Math.max(0, ...all.map((q) => Math.abs(q.x) + 1.5));
    const half = SQUEEZE * Math.max(Math.max(m.full_bust ?? 0, m.full_hip ?? 0, m.waist) / 4 + 3, arms ? armAt(arms, arms.wristY).outer + 1.5 : 0, wide);
    const floor = Math.max(torsoBottom + 12, bottom, legLines ? legLines.floor + 1 : 0);
    const hem = all.length ? Math.max(...all.map((q) => q.y)) : undefined;
    const low = hem !== undefined ? hem + BELOW_HEM + 2 : floor;
    const fresh = { half, top: body.top - (body.head ? HEAD_CM + 1 : 2), bottom: Math.max(torsoBottom + 12, Math.min(low, legLines ? legLines.floor + 1 : low)) };
    const was = heldFrame.current;
    if (!was) return (heldFrame.current = fresh);
    const grown = {
      half: was.half,
      top: Math.min(was.top, fresh.top),
      bottom: hem !== undefined && hem + 4 > was.bottom ? Math.max(was.bottom, fresh.bottom) : was.bottom,
    };
    return (heldFrame.current = grown);
  }, [m, body, bottom, arms, torsoBottom, legLines, cloth]);
  const cx = frame.half;

  // The head, as on every other screen (Cat's body rule): the same faceless mannequin head, at the same scale to
  // the body, on top of the neck.
  const head = useMemo(() => formHead(body, cx), [body, cx]);
  const satinId = useId().replace(/[^a-zA-Z0-9]/g, '');

  // Each leg its outline, from where the legs part down to the floor, and lines down it as on the measuring pages.
  const legPaths = useMemo(() => {
    if (!legLines) return [];
    const { crotch, floor, apart, at: halfAt } = legLines;
    const ys = Array.from({ length: 81 }, (_, i) => crotch + ((floor - crotch) * i) / 80);
    return [1, -1].flatMap((s) =>
      [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1].map((k) => ({
        d: path(ys.map((y) => ({ x: cx + SQUEEZE * s * (apart + k * halfAt(y)), y }))),
        edge: Math.abs(k) === 1,
      })),
    );
  }, [legLines, cx]);

  // The garment on the form, front on (the back shows the form and its lines only).
  const worn = useMemo(() => (cloth ? wornCloth(cloth, body, underarmY ?? arms?.under.y, sewn) : undefined), [cloth, body, underarmY, arms, sewn]);
  const clothOn = side === 'front' ? worn : undefined;
  // Enlarged, the garment fills the screen as on the Style page (Cat, 2026-10-25: Draw inside Enlarge too): from just
  // above it to well past its hem, so there's room to draw the hem longer, and only a little wider than it, both sides
  // alike so the back matches the front.
  // Enlarged, the garment fills the screen as on the Style page (Cat, 2026-10-25: Draw inside Enlarge too): from just
  // above it to the frame's foot, and only a little wider than it, both sides alike so the back matches the front. The
  // width holds with the frame, so the view stays still while you draw.
  const heldView = useRef<{ wide: number; top: number } | null>(null);
  const view = useMemo(() => {
    const all = (worn ?? []).flat();
    if (!big || !all.length) {
      heldView.current = null;
      return { left: 0, width: 2 * cx, top: frame.top, bottom: frame.bottom };
    }
    // Room at the sides for a flare or more ease to be drawn without the view moving.
    const wide = SQUEEZE * (Math.max(...all.map((q) => Math.abs(q.x))) + 9);
    const top = Math.max(frame.top, Math.min(...all.map((q) => q.y)) - 8);
    const was = heldView.current;
    const held = (heldView.current = { wide: was && wide <= was.wide + 1 ? was.wide : wide, top: was ? Math.min(was.top, top) : top });
    return { left: cx - held.wide, width: 2 * held.wide, top: held.top, bottom: frame.bottom };
  }, [big, worn, cx, frame]);

  const current = lines(side);
  const at = (pts: P[]) => path(pts.map((q) => ({ x: cx + SQUEEZE * q.x, y: q.y })));

  const toSvg = (e: PointerEvent): P => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };
  // Drawn where the finger went, read in the pattern's own cm: the form is drawn narrower than that.
  const centred = (s: P[]) => s.map((q) => ({ x: (q.x - cx) / SQUEEZE, y: q.y }));
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
    if (frontOnly(k)) setSide('front');
  };
  const help = helpFor?.[kind] ?? ((onBack && BACK_HELP[kind]) || HELP[kind]);

  // A line drawn on the turning garment, read as if drawn on the flat form: each point at its height, and across by
  // where it sits round the body (on a sleeve, round the arm; on a leg, round the leg), on the front or the back by
  // which way most of it faces. Then it is read exactly as a flat line is.
  const fromRound = (picks: RoundPick[]): { s: FormSide; pts: P[] } => {
    const facing = picks.filter((q) => q.part === 'sleeve' || Math.cos(q.a) >= 0).length * 2 >= picks.length;
    const s: FormSide = facing || frontOnly(kind) ? 'front' : 'back';
    const pts = picks.map((q) => {
      const y = body.waistY + q.cm;
      let x = q.xCm;
      if (q.part === 'sleeve' && arms) {
        const { inner, outer } = armAt(arms, y);
        x = q.e * ((inner + outer) / 2 + (Math.sin(q.a) * (outer - inner)) / 2);
      } else if (q.part === 'leg' && legLines) x = q.e * (legLines.apart + Math.sin(q.a) * legLines.at(y));
      return { x: s === 'back' ? -x : x, y };
    });
    return { s, pts };
  };
  const roundStroke = (picks: RoundPick[], done: boolean) => {
    const { s, pts } = fromRound(picks);
    if (!done) {
      setLive(read(kind, s, pts).said);
      return;
    }
    const r = read(kind, s, pts);
    if (r.choices) {
      setSteps([...steps, choices]);
      setUndone([]);
      onChoices(r.choices);
    }
    setSaid(r.said);
    setLive(undefined);
  };
  const roundOn = onRound && !!allRound;
  // Enlarged, the flat form's held frame is the drawing's; All round lays itself out.

  // Enlarged, Smaller sits up top across from Done, and every other tool waits in the tray under the form (Cat's B Tray
  // Below, 2026-10-27).
  const enlarge = (
    <button type="button" className="enlarge" aria-pressed={big} onClick={() => setBig(!big)}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d={big ? 'M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14' : 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9'} />
      </svg>
      {big ? 'Smaller' : 'Enlarge'}
    </button>
  );
  // While a hem is drawn, a level line shows where it will sit, with its length on it, so the wobble of a finger
  // reads as a sketch rather than as the hem itself.
  const ghost = useMemo(() => {
    if (!stroke || kind !== 'hem' || stroke.length < 5) return undefined;
    const ys = stroke.map((q) => q.y).sort((a, b) => a - b);
    // Only a level line sets a length; a curved one shapes the hem along it, so it has no level line to show.
    if (ys[ys.length - 1] - ys[0] >= 3) return undefined;
    const xs = stroke.map((q) => q.x);
    const tag = live?.replace(/\.$/, '').replace(/ (length|skirt)$/, '');
    return { y: ys[Math.floor(ys.length / 2)], x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, tag: tag && tag.length <= 26 ? tag : undefined };
  }, [stroke, kind, live]);

  // It opens at its top, title and all, not partway down where the style page had been scrolled to.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={big ? 'form-draw big' : 'form-draw'}>
      <div className="screen-head">
        <div>
          <p className="eyebrow">Drape · Your form <TestingTag tool="draw_lines" /></p>
          <h1>Draw your lines</h1>
        </div>
        {big && enlarge}
        <button type="button" className="primary done" onClick={() => leave(onDone)}>
          Done
        </button>
      </div>
      <section className="card" aria-label="Your dress form">
        <div className={roundOn ? 'preview round-draw' : 'preview'}>
          <DemoButton demo="draw" />
          {!big && enlarge}
          {roundOn && <TestingTag tool="draw_round" />}
          {roundOn && allRound ? (
            <AllRound
              round={allRound.round}
              m={allRound.m}
              fabric={allRound.fabric}
              striped={allRound.striped}
              label={`Your garment turning on your form. Draw on it with one finger; turn it with two. ${help}`}
              draw={{ onStroke: roundStroke }}
            />
          ) : (
          <svg
            ref={svg}
            viewBox={`${f(view.left)} ${f(view.top)} ${f(view.width)} ${f(view.bottom - view.top)}`}
            role="img"
            aria-label={`Your dress form from the ${side}, built from your measurements. ${help}`}
            className={`preview-svg sketch shape drawing form-svg${clothOn ? ' clothed' : ''}`}
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
            {clothOn ? (
              // The garment on the form exactly as on the Style page, to draw on.
              <FormLayers body={body} m={m} legs={legs} cx={cx} top={frame.top} bottom={frame.bottom} arms={arms} lines={{}} worn={clothOn} sleeve={sleeve} />
            ) : (
              <>
              {legPaths.filter((l) => l.edge).map((l, i) => (
                <path key={`leg${i}`} d={l.d} className="form-line" fill="none" strokeWidth={0.2} opacity={0.85} />
              ))}
              {legLines && (
                <path d={`M${f(cx - SQUEEZE * legLines.apart * 3)} ${f(legLines.floor)} L${f(cx + SQUEEZE * legLines.apart * 3)} ${f(legLines.floor)}`} className="form-stand" fill="none" strokeWidth={0.15} opacity={0.6} />
              )}
              {!legLines && (
                <path
                  d={`M${f(cx)} ${f(body.bottom)} L${f(cx)} ${f(frame.bottom - 2)} M${f(cx - 8)} ${f(frame.bottom - 2)} L${f(cx + 8)} ${f(frame.bottom - 2)}`}
                  className="form-stand"
                  fill="none"
                  strokeWidth={0.2}
                />
              )}
              {/* The form as a satin mannequin, as on the Style page (Cat's F5 Satin and Light). */}
              <FormSatin body={body} cx={cx} arms={arms} uid={satinId} bottom={torsoBottom} edge={0.2} />
              </>
            )}
            {head && !clothOn && <FormHead head={head} cx={cx} />}
            {/* On the dress, the cloth's own edges are the neckline, side, hem and sleeve, so only the pen shows. */}
            {clothOn && (
              <defs>
                <clipPath id={`drawclip${satinId}`}>
                  {clothOn.map((s, i) => (
                    <path key={i} d={`${at(s)} Z`} />
                  ))}
                </clipPath>
                <filter id={`drawsoft${satinId}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.5" />
                </filter>
              </defs>
            )}
            {/* On the dress the lines are clipped to it, and all but the kind being drawn sit in the cloth as pressed
                seams rather than drawn on it (Cat's D4, 2026-10-26); the kind being drawn stays lit. */}
            <g clipPath={clothOn ? `url(#drawclip${satinId})` : undefined}>
            {kinds.filter(([id]) => !(clothOn && CLOTH_EDGES.includes(id))).map(([id]) =>
              (current[id] ?? []).map((pts, i) =>
                clothOn && id !== kind ? (
                  <g key={`${id}${i}`}>
                    <path d={at(pts)} fill="none" stroke="#000" opacity={0.5} strokeWidth={0.55} filter={`url(#drawsoft${satinId})`} strokeLinecap="round" />
                    <path d={at(pts)} className="tape" fill="none" strokeWidth={0.1} opacity={0.4} strokeLinecap="round" />
                  </g>
                ) : (
                  <path key={`${id}${i}`} d={at(pts)} className={id === kind ? 'tape on' : 'tape'} fill="none" strokeWidth={id === kind ? 0.42 : 0.22} strokeLinecap="round" />
                ),
              ),
            )}
            </g>
            {side === 'back' && (
              // In the corner, clear of the neck.
              <text x={view.left + 2} y={view.top + 3} fontSize={1.8} textAnchor="start" className="hint">
                BACK
              </text>
            )}
            {ghost && (
              <g className="hem-ghost">
                <path d={`M${f(ghost.x0)} ${f(ghost.y)} L${f(ghost.x1)} ${f(ghost.y)} M${f(ghost.x0)} ${f(ghost.y - 0.8)} V${f(ghost.y + 0.8)} M${f(ghost.x1)} ${f(ghost.y - 0.8)} V${f(ghost.y + 0.8)}`} />
                {ghost.tag && (
                  <text x={(ghost.x0 + ghost.x1) / 2} y={ghost.y - 1.3} fontSize={1.7} textAnchor="middle">
                    {ghost.tag.toUpperCase()}
                  </text>
                )}
              </g>
            )}
            {stroke && <polyline points={stroke.map((q) => `${f(q.x)},${f(q.y)}`).join(' ')} className="stroke chalk" strokeWidth={0.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          )}
        </div>
        <p className="muted small form-said" role="status">
          {live ?? said ?? (roundOn ? `${help} One finger draws on it; two fingers turn it.` : help)}
        </p>
        <div className="chips form-kinds" role="group" aria-label="What you are drawing">
          {kinds.map(([id, label]) => (
            <button key={id} type="button" className={kind === id ? 'chip on' : 'chip'} aria-pressed={kind === id} onClick={() => pick(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className={backs || allRound ? 'row between wrap form-sides' : 'row end wrap form-sides'}>
          {(backs || allRound) && (
          // The sides of the form, and (with All round) the garment turning as a third way to see it, to draw on.
          <div className="seg" role="group" aria-label="Side of the form">
            {(backs ? (['front', 'back'] as const) : (['front'] as const)).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={!roundOn && side === s}
                className={!roundOn && side === s ? 'on' : ''}
                disabled={s === 'back' && frontOnly(kind)}
                onClick={() => {
                  setOnRound(false);
                  setSide(s);
                  setSaid(undefined);
                }}
              >
                {s}
              </button>
            ))}
            {allRound && (
              <button type="button" aria-pressed={roundOn} className={roundOn ? 'on' : ''} onClick={() => setOnRound(true)}>
                all round
              </button>
            )}
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
