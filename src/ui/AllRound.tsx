// All the way round: the garment on the dress form, turning, so you can see what the flat sketch can't:
// every seam and dart meeting where they join, the neck and the hem all the way round (the hem unrolled
// into one line under the form), the sleeves and trouser legs, and stripes meeting at the side seams when
// the fabric has them. Drag anywhere to turn it. It is a shape preview drawn from the draft, not a cloth
// simulation. Seams are trued as each garment is drafted, so nothing here is ever flagged as a problem:
// when a change is trued, the seams glow softly, and that is the only sign. With a fabric chosen, the garment is
// drawn in it, print and colour wrapped round as it turns (Cat, 2026-10-26); the form stays in its long lines.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MyFabric } from '../engine/fabrics';
import { fabricPaint } from './FabricFill';
import { ClothQuad, ClothTiles, clothLayers, clothTiles, lightOf, paintCloth } from './allRoundCloth';
import { RoundGarment, RoundPt, RoundSeam, stripesMeet } from '../engine/allRound';
import { R as formHalfWidth } from '../engine/form';
import { FORM_CROTCH, FORM_DEPTH, FORM_FLOOR, FORM_HIP, FORM_KNEE, FORM_LEG, FORM_LEG_X, paintFigure } from './ContourForm';

// Matching --gild, --gild-glow, --guide, --muted and --ok in styles.css.
const GILD = '#d9c49b';
const GLOW = '#f3e6c8';
const GUIDE = '#4a4338';
const MUTED = '#9a8e78';
const OK = '#a9c49b';

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
const WAIST = 0.1;
/** Where the nape and the bust sit on the form. */
const NAPE_Y = -1.45;
/** The base of the form's neck, and its shoulder tips, where the shoulders reach their full width. */
export const NECK_Y = -1.47;
export const SHOULDER_Y = -1.33;
const BUST_Y = -0.58;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const STRIP = 96; // the unrolled hem line under the figure, in px

type Pt = [number, number, number];

/** The measurements the view places the garment by; any it lacks fall back to the form's own. */
export interface RoundMeasurements {
  waist?: number;
  full_bust?: number;
  full_hip?: number;
  waist_to_hip?: number;
  waist_to_knee?: number;
  waist_to_floor?: number;
  nape_to_waist?: number;
  crotch_depth?: number;
}

interface Props {
  round: RoundGarment;
  m: RoundMeasurements;
  /** The fabric has checks or stripes to match: which, so the note names the right one. */
  striped?: boolean | 'checks' | 'stripes';
  /** The maker's fabric: the garment is drawn in it. Left out, or with none chosen, the garment stays in lines. */
  fabric?: MyFabric;
  label: string;
}

interface Row {
  id: string;
  name: string;
  text: string;
  /** Where to turn the form to when the row is tapped. */
  turn: number;
}

/** Lengths in cm from the waist, onto the form: the nape, waist, hip, crotch, knee and floor each at their own line
 * on the figure. A top's shoulder tip goes on the form's shoulder tip, where its shoulders are full width, and the
 * neck point at the base of the form's neck: drawn from the nape alone, the shoulders sat up on the neck and the
 * sleeves hung low off the side, like dropped shoulders (Cat, 2026-10-26: "the shoulders are too low"). */
export function placeOnForm(round: Pick<RoundGarment, 'armhole'>, m: RoundMeasurements): (cm: number) => number {
  const N = m.nape_to_waist ?? 41;
  const wh = m.waist_to_hip ?? 20.5;
  const tip = round.armhole?.shoulderCm;
  const knots: [number, number][] = [
    ...(tip !== undefined && tip > -N + 0.3 && tip < -N / 2
      ? ([
          [-N - 4, NECK_Y],
          [-N, NAPE_Y],
          [tip, SHOULDER_Y],
        ] as [number, number][])
      : ([[-N, NAPE_Y]] as [number, number][])),
    [0, WAIST],
    [wh, FORM_HIP],
  ];
  const add = (cm: number | undefined, y: number) => {
    if (cm !== undefined && cm > knots[knots.length - 1][0] + 1) knots.push([cm, y]);
  };
  add(m.crotch_depth ?? wh * 1.3, FORM_CROTCH);
  add(m.waist_to_knee, FORM_KNEE);
  add(Math.max(m.waist_to_floor ?? 104, wh + 2), FORM_FLOOR);
  return (cm: number) => {
    let i = 1;
    while (i < knots.length - 1 && cm > knots[i][0]) i++;
    const [c0, y0] = knots[i - 1];
    const [c1, y1] = knots[i];
    return y0 + ((cm - c0) / (c1 - c0)) * (y1 - y0);
  };
}

/** Where a top's hem falls, in words. */
const fromWaist = (v: number) => (v < 0 ? `${-v} cm above the waist` : v === 0 ? 'at the waist' : `${v} cm below the waist`);

/** The rows under the view: plain facts about the garment, never problems. */
export function roundRows(r: RoundGarment, striped: boolean | 'checks' | 'stripes'): Row[] {
  const rows: Row[] = [];
  const n = r.seams.filter((s) => !s.cont).length;
  const d = r.darts.length;
  const where = r.kind === 'skirt' ? 'at the waist and the hem' : r.kind === 'trousers' ? 'from the waist to the hems' : 'from the neck to the hem';
  if (r.seamsMeet) {
    rows.push({ id: 'seams', name: 'Seams', text: `All ${n} seams${d ? ` and ${d} darts` : ''} meet ${where}.`, turn: HALF });
  }
  const { front, back, left, right } = r.readings;
  const sides = Math.round((left + right) / 2);
  let text: string;
  if (r.legs) text = `${front} cm from the waist to the hem, ${Math.round(r.legs.hemCm)} cm round each leg.`;
  else if (r.kind === 'top')
    text =
      // Within a centimetre all the way round reads as level.
      Math.max(front, back, sides) - Math.min(front, back, sides) <= 1
        ? `Ends ${fromWaist(Math.abs(sides) <= 1 ? 0 : sides)} all the way round.`
        : `Ends ${fromWaist(front)} at the front, ${fromWaist(sides)} at the sides and ${fromWaist(back)} at the back.`;
  else
    text =
      Math.abs(left - right) >= 1
        ? `From the waist: ${left} cm on your left, ${right} cm on your right, ${front} at the front and ${back} at the back.`
        : front === back && front === left
          ? `${front} cm from the waist all the way round.`
          : `${front} cm at the front, ${sides} at the sides, ${back} at the back.`;
  rows.push({ id: 'hem', name: 'Hem', text, turn: back > front ? Math.PI : 0 });
  if (r.sleeve) {
    rows.push({ id: 'sleeves', name: 'Sleeves', text: `${Math.round(r.sleeve.lengthCm)} cm from the shoulder, ${Math.round(r.sleeve.hemCm)} cm round the hem.`, turn: HALF });
  }
  if (striped && stripesMeet(r)) {
    rows.push({ id: 'stripes', name: striped === 'checks' ? 'Checks' : 'Stripes', text: 'Meet at both side seams. Line them up at the notches when you cut.', turn: -HALF });
  }
  return rows;
}

export function AllRound({ round, m, striped = false, fabric, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The cloth's tiles, once its swatch has loaded; until then (and with no fabric) the garment is in lines.
  const paint = useMemo(() => fabricPaint(fabric, import.meta.env.BASE_URL), [fabric]);
  const paintKey = JSON.stringify(paint ?? null);
  const [tiles, setTiles] = useState<ClothTiles | undefined>();
  useEffect(() => {
    let live = true;
    if (!paint) setTiles(undefined);
    else clothTiles(paint).then((t) => live && setTiles(t), () => live && setTiles(undefined));
    return () => {
      live = false;
    };
  }, [paintKey]);
  const layers = useMemo(clothLayers, []);
  const turn = useRef({ phi: 0.6, target: null as number | null, dragging: false, idle: 0 });
  const pulse = useRef(-1e9);
  const rows = useMemo(() => roundRows(round, striped), [round, striped]);

  // When the garment changes, it has been trued as it was drafted: the seams glow, softly, once.
  const key = JSON.stringify(round.readings) + round.flare.toFixed(3) + round.seams.length + (round.sleeve?.lengthCm ?? 0);
  const seen = useRef(key);
  useEffect(() => {
    if (seen.current !== key) pulse.current = performance.now();
    seen.current = key;
  }, [key]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = turn.current;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth || 320;
      h = cv.clientHeight || 420;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);

    const trousers = round.kind === 'trousers';
    // The How it works film's own cut of this view (scripts/record-tour-shots.mjs sets the flag): a gentler waist,
    // the cloth in long lines, no meeting dots. Nothing a maker sees changes.
    const film = !!(window as any).__tourFilm;
    // The film's 'old look': the form's lines run on through the whole garment, as the released film had it.
    const through = (window as any).__tourFilm === 'old';
    const isTop = round.kind === 'top' || round.kind === 'dress';
    const strip = trousers ? 0 : STRIP;
    // In the maker's fabric, unless the film wants its old look.
    const cloth = through ? undefined : tiles;

    const N = m.nape_to_waist ?? 41;
    const wh = m.waist_to_hip ?? 20.5;
    const yOfLevel = placeOnForm(round, m);
    // On a body the neck sits tilted: its base at the front is a good way below the neck point at the side, while the
    // form's neck base is level all round. So on the front, a neckline is measured from the front of the neck's base,
    // not from the side's, or every front neckline sits too deep on the form and a boat neck reads as a scoop (Cat,
    // 2026-10-26: "does the neckline look strange?"). The lift fades out by the bust, so nothing below it moves.
    const N0 = m.nape_to_waist ?? 41;
    const frontNeckCm = -N0 + 5;
    // A plain round neck, as drafted, follows the base of the neck: at the side neck point and some 9 cm lower at the
    // centre front, round in between. Where that natural neckline lies is placed at the form's neck base all round.
    const naturalNeck = (a: number) => -N0 - 4 + (frontNeckCm + N0 + 4) * Math.max(0, Math.cos(a)) ** 0.6;
    const yAt = (a: number, cm: number) => {
      if (!isTop || Math.cos(a) <= 0) return yOfLevel(cm);
      const lift = Math.max(0, yOfLevel(naturalNeck(a)) - NECK_Y);
      return yOfLevel(cm) - lift * clamp(1 - (cm - naturalNeck(a)) / 14, 0, 1);
    };
    const yOf = yOfLevel;
    const kY = (WAIST - NAPE_Y) / N;

    // The garment's ease over the body, as form units, at the bust, the waist and the hip.
    const krB = formHalfWidth(BUST_Y) / ((m.full_bust ?? 90) / TAU);
    const krW = formHalfWidth(WAIST) / ((m.waist ?? 72) / TAU);
    const krH = formHalfWidth(FORM_HIP) / ((m.full_hip ?? 98) / TAU);
    const easeOf = (fin: number | undefined, body: number | undefined, kr: number) => (fin && body ? clamp(((fin - body) / TAU) * kr, 0.012, 0.25) : undefined);
    const eW = easeOf(round.girth.waist, m.waist, krW) ?? 0.02;
    const eB = easeOf(round.girth.bust, m.full_bust, krB) ?? eW;
    const eH = easeOf(round.girth.hip, m.full_hip, krH) ?? eW;
    const easeAt = (y: number) =>
      y <= BUST_Y ? 0.01 + (eB - 0.01) * smooth(clamp((y - NAPE_Y) / (BUST_Y - NAPE_Y), 0, 1)) : y <= WAIST ? eB + (eW - eB) * ((y - BUST_Y) / (WAIST - BUST_Y)) : y <= FORM_HIP ? eW + (eH - eW) * ((y - WAIST) / (FORM_HIP - WAIST)) : eH;

    const lengths = Array.from({ length: 73 }, (_, i) => round.lengthAt((TAU * i) / 72));
    const tops = Array.from({ length: 73 }, (_, i) => round.topAt((TAU * i) / 72));
    const longest = Math.max(...lengths);
    const highest = Math.min(...tops);
    const meanY = yOf(lengths.reduce((t, v) => t + v, 0) / lengths.length);
    const flares = !trousers && meanY > FORM_HIP + 0.05;
    const bodyR = (y: number) => formHalfWidth(Math.min(y, 1.3)) + easeAt(y);
    // Worn, the cloth hangs from the widest point of the form above it (as wornCloth lays it on the form):
    // only a fitted garment, with little ease at the waist, follows the waist in; a relaxed one falls straight
    // from the bust to the hip, its ease hanging in folds.
    // From the shoulders to the bust the cloth is held to the body; from the bust down it hangs.
    const hangShare = round.girth.waist && m.waist ? clamp((round.girth.waist - m.waist - 4) / 3, 0, 1) * (through ? 0 : film ? 0.5 : 1) : 0;
    const hang: number[] = [];
    for (let i = 0; i <= 60; i++) hang.push(Math.max(hang[i - 1] ?? 0, bodyR(BUST_Y + ((FORM_HIP - BUST_Y) * i) / 60)));
    const wornR = (y: number) => {
      const r = bodyR(y);
      if (y <= BUST_Y || y > FORM_HIP || !hangShare) return r;
      return r + (hang[Math.round(((y - BUST_Y) / (FORM_HIP - BUST_Y)) * 60)] - r) * hangShare;
    };
    const hipR = wornR(FORM_HIP);
    const hemR = hipR * clamp(round.flare, 0.85, 2.3);
    const bodyRadius = (y: number) =>
      y <= FORM_HIP || !flares ? wornR(y) : hipR + (hemR - hipR) * clamp((y - FORM_HIP) / Math.max(0.05, meanY - FORM_HIP), 0, 1.3);
    const bandTop = WAIST - round.bandCm * kY;

    // Sleeves hang from the armhole: out from the shoulder tip, then down the arm.
    const arm = round.armhole;
    const yS = arm ? yOf(arm.shoulderCm) : 0;
    const yU = arm ? yOf(arm.underarmCm) : 0;
    const sl = round.sleeve;
    // With a sleeve, the shoulders are as broad as the body below them: from the base of the neck the cloth runs out
    // to the shoulder tip and rounds over it, rather than following the form's narrow, sloping dressmaker's shoulder
    // (Cat, 2026-10-26: "the shoulders still seem low or small").
    // Broad across, but no deeper front to back than the body itself: seen from above the shoulders are an oval, so the
    // top reads as shoulders sloping off the neck and not as a flat, round lid (the film thread, 2026-10-26: "a bucket").
    const neckR = bodyRadius(NECK_Y);
    const shoulderR = Math.max(bodyRadius(BUST_Y), formHalfWidth(yS));
    const radius = (y: number) => {
      const r = bodyRadius(y);
      if (!sl || y >= BUST_Y) return r;
      const t = clamp((y - NECK_Y) / (yS + 0.14 - NECK_Y), 0, 1);
      return Math.max(r, y < NECK_Y ? 0 : neckR + (shoulderR - neckR) * (1 - (1 - t) ** 2));
    };
    /** How far out the cloth lies at angle a round the body: the full width at the sides, the body's own depth front and back. */
    const shell = (a: number, y: number) => {
      const W = radius(y);
      const D = bodyRadius(y);
      return W <= D + 1e-6 ? W : 1 / Math.hypot(Math.sin(a) / W, Math.cos(a) / D);
    };
    // Over the shoulder the cloth runs out more than down: its print is laid by the length of cloth, not by the height
    // alone, or it smears into streaks across the top. Counted up from the bust, so below it nothing moves.
    const SHOULDER_TOP = BUST_Y;
    const clothDown = (a: number, y: number) => {
      if (!sl || y >= SHOULDER_TOP) return y;
      let extra = 0;
      const n = 16;
      const dy = (SHOULDER_TOP - y) / n;
      for (let i = 0; i < n; i++) {
        const ya = y + i * dy;
        extra += Math.hypot(dy, shell(a, ya + dy) - shell(a, ya)) - dy;
      }
      return y - extra;
    };
    // In the film the sleeve hugs the arm (Cat, 2026-10-24: "make it look chic"); in the app it keeps its wearing ease.
    const slim = film ? 0.9 : 1;
    const ra = sl ? Math.max(0.08, (sl.bicepCm / TAU) * krB * 0.95 * slim) : 0;
    const rh = sl ? Math.max(0.05, (sl.hemCm / TAU) * krB * 0.95 * slim) : 0;
    // The sleeve stands on the arm, outside the body at the underarm; even the shortest reaches a little below it.
    const yE = sl ? Math.max(yS + sl.lengthCm * kY, yU + (film ? 0.4 : 0.1)) : 0;
    // A short sleeve hangs straight down off the shoulder, rounding out from the top of the arm, so it reads as a
    // sleeve and not a wing or a cape (Cat, 2026-10-25); its cap sits up on the shoulder tip, fuller and a little
    // longer, not low and small on the arm (Cat applied the fix in the film, 2026-10-25; the app too, 2026-10-26).
    const yCap = yS - 0.01;
    // The cap starts at the shoulder tip, not out past it, and by the underarm the sleeve's inner side lies against
    // the bodice, so no gap opens between them as the form turns (Cat, 2026-10-26: still sitting low).
    const filmAxis = (y: number) => {
      // A little in from the bodice's edge, so the cap rounds over the shoulder tip and no corner of the bodice juts past it.
      const from = radius(yS) - ra * 0.3;
      const to = (yU ? radius(yU) : 0) + ra * 0.7;
      return from + (to - from) * Math.sqrt(clamp((y - yCap) / (yU - yCap || 1), 0, 1)) + Math.max(0, y - yU) * 0.02;
    };
    // The cap rounds over like the top of an arm: a quarter circle from the shoulder tip to the underarm.
    const filmR = (y: number) => {
      if (y >= yU) return ra + (rh - ra) * clamp((y - yU) / (yE - yU || 1), 0, 1);
      const t = clamp((y - yCap) / (yU - yCap || 1), 0, 1);
      return ra * Math.sqrt(1 - (1 - t) ** 2);
    };
    const axisX = filmAxis;
    // The crown is as deep, front to back, as the shoulder it is sewn to, so the shoulder runs straight into it and
    // the bodice does not round down past it; by the underarm it is round, as the arm is (Cat, 2026-10-26: "still low").
    const crownZ = sl ? Math.max(1, (bodyRadius(yS) * 0.95) / ra) : 1;
    const capDepth = (y: number) => (y >= yU ? 1 : 1 + (crownZ - 1) * (1 - clamp((y - yCap) / (yU - yCap || 1), 0, 1)) ** 1.5);
    const sleeveR = filmR;

    // Trouser legs, round the form's own legs: easy at the thigh, then to the knee and the hem.
    const lg = round.legs;
    const yC = lg ? yOf(lg.crotchCm) : 0;
    const yH = lg ? yOf(lg.lengthCm) : 0;
    const yK = lg ? Math.min(yOf(m.waist_to_knee ?? lg.crotchCm + 31), yH) : 0;
    const krL = krH * 0.85;
    const thighR = lg ? FORM_LEG(yC) + 0.045 : 0;
    const kneeR = lg ? Math.max(FORM_LEG(yK) + 0.02, (lg.kneeCm / TAU) * krL) : 0;
    const legHemR = lg ? Math.max(FORM_LEG(yH) + 0.012, (lg.hemCm / TAU) * krL) : 0;
    const legR = (y: number) =>
      y <= yK ? thighR + (kneeR - thighR) * clamp((y - yC) / (yK - yC || 1), 0, 1) : kneeR + (legHemR - kneeR) * clamp((y - yK) / (yH - yK || 1), 0, 1);

    // Trousers, below the hip, close in round the two legs, so the seat runs into the legs and not over them like shorts.
    const rAt = (a: number, y: number) => {
      if (!lg || y <= FORM_HIP) return shell(a, y);
      const legs = Math.hypot(Math.sin(a) * (FORM_LEG_X + thighR), Math.cos(a) * thighR);
      const r = radius(y);
      return r + (Math.min(r, legs) - r) * smooth(clamp((y - FORM_HIP) / (yC - FORM_HIP || 1), 0, 1));
    };

    const reach = Math.max(hemR, sl ? axisX(yE) + rh : 0, lg ? FORM_LEG_X + Math.max(thighR, kneeR, legHemR) : 0, formHalfWidth(-0.55) + eB);

    const draw = (now: number) => {
      const top = film ? Math.min(-2, yOf(highest) - 0.3) : Math.min(-0.45, yOf(highest) - 0.3);
      const bottom = trousers ? FORM_FLOOR + 0.1 : Math.min(FORM_FLOOR + 0.1, Math.max(yOf(longest), sl ? yE : -9) + 0.45);
      const fig = h - strip;
      const S = Math.min((fig - 16) / (bottom - top), (w / 2 - 14) / (reach * 1.04));
      const cx = w / 2;
      const Y = (y: number) => 8 + (y - top) * S;
      const lw = Math.max(0.7, S / 252) * 1.2;
      const phi = st.phi;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      /** A point round the body at angle a and radius r. */
      const P = (a: number, r: number, y: number): Pt => {
        const th = a + phi;
        return [cx + Math.sin(th) * r * S, Y(y) + Math.cos(th) * r * S * FORM_DEPTH, Math.cos(th)];
      };
      /** A point round a tube (a sleeve or a leg) standing at x = X, at angle a round it. */
      const T = (X: number, a: number, r: number, y: number, zr = r): Pt => {
        const x = X + Math.sin(a) * r;
        const z = Math.cos(a) * zr;
        return [cx + (x * c + z * s) * S, Y(y) + (z * c - x * s) * S * FORM_DEPTH, Math.cos(a + phi)];
      };
      /** Where a tube's centre comes on the screen, and how far in front of the body it stands. */
      const centre = (X: number, y: number) => ({ x: cx + X * c * S, y: Y(y) - X * s * S * FORM_DEPTH, z: -X * s });
      const seg = (a: Pt | [number, number], b: Pt | [number, number]) => {
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      };
      /** A line through points: bright where it faces you, faint behind. */
      const line = (pts: Pt[], colour: string, width: number, back = 0.2, alpha = 1) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        for (let i = 1; i < pts.length; i++) {
          const f = (pts[i][2] + pts[i - 1][2]) / 2;
          g.globalAlpha = alpha * (f > 0 ? 0.55 + 0.45 * Math.min(1, f) : back);
          seg(pts[i - 1], pts[i]);
        }
        g.globalAlpha = 1;
      };
      const polyline = (pts: [number, number][], colour: string, width: number, alpha = 1) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        g.globalAlpha = alpha;
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.stroke();
        g.globalAlpha = 1;
      };
      const legX = (leg: number) => leg * FORM_LEG_X;
      /** A point on the garment, on the body or down a trouser leg. */
      const spot = (p: RoundPt, leg?: number): Pt => {
        const y = leg ? yOf(p.cm) : yAt(p.phi, p.cm);
        return leg ? T(legX(leg), p.phi, legR(y), y) : P(p.phi, rAt(p.phi, y), y);
      };
      /** A seam or dart through its points, in small steps so it follows the body. */
      const along = (pts: RoundPt[], leg?: number): Pt[] => {
        const out: Pt[] = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          for (let k = i === 1 ? 0 : 1; k <= 10; k++) out.push(spot({ phi: a.phi + ((b.phi - a.phi) * k) / 10, cm: a.cm + ((b.cm - a.cm) * k) / 10 }, leg));
        }
        return out;
      };
      const ring = (yAt: (a: number) => number, rAt: (a: number, y: number) => number, colour: string, width: number, back = 0.25, alpha = 1) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 144; i++) {
          const a = -Math.PI + (TAU * i) / 144;
          const y = yAt(a);
          pts.push(P(a, rAt(a, y), y));
        }
        line(pts, colour, width, back, alpha);
      };
      const tubeRing = (X: number, r: number, y: number, colour: string, width: number, alpha = 1, back = 0.25) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 48; i++) pts.push(T(X, -Math.PI + (TAU * i) / 48, r, y));
        line(pts, colour, width, back, alpha);
      };
      const dot = (q: Pt, colour: string, r = 3.4) => {
        g.globalAlpha = q[2] > 0 ? 1 : 0.35;
        g.strokeStyle = colour;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(q[0], q[1], r, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      };
      const text = (str: string, x: number, y: number, align: CanvasTextAlign = 'left') => {
        g.font = '500 9px "Chakra Petch", ui-monospace, monospace';
        g.fillStyle = MUTED;
        g.textAlign = align;
        g.fillText(str.toUpperCase(), x, y);
      };
      const hemY = (a: number) => yOf(round.lengthAt(a));
      const topRaw = (a: number) => yAt(a, round.topAt(a));
      // Where the front neck meets the shoulder the edge is eased round, not left as a notch; the centre front (a V's
      // point) and the back stay exactly as drawn.
      const TOP_N = 360;
      const topTable = Array.from({ length: TOP_N + 1 }, (_, i) => {
        const a = -Math.PI + (TAU * i) / TOP_N;
        const w = isTop ? Math.sin(a) ** 2 * Math.max(0, Math.cos(a) + 0.3) : 0;
        if (w < 0.01) return topRaw(a);
        let sum = 0;
        for (let k = -6; k <= 6; k++) sum += topRaw(a + k * 0.03);
        return topRaw(a) + (sum / 13 - topRaw(a)) * Math.min(1, w * 2.5);
      });
      const topY = (a: number) => {
        const f = ((((a + Math.PI) / TAU) % 1) + 1) % 1 * TOP_N;
        const i = Math.floor(f);
        return topTable[i] + (topTable[i + 1] - topTable[i]) * (f - i);
      };

      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // The figure stops above the hem line, so its legs don't run through it. Under trousers its legs
      // turn with the garment.
      g.save();
      g.beginPath();
      g.rect(0, 0, w, fig);
      g.clip();
      g.globalAlpha = 0.6;
      g.strokeStyle = GILD;
      paintFigure(g, S, cx, Y, lw, trousers ? 0 : 1, false, phi);
      // The cloth covers the form: under the garment the body is not drawn, so the garment is what reads.
      if (!trousers && !through && !cloth?.sheer) {
        // The shoulders and the neck still show through a top's yoke: the cloth is held to the body there.
        // In cloth the garment covers the shoulders too, so nothing of the form shows between the bodice and a sleeve's cap.
        const from = isTop && arm && !cloth ? yU : yOf(highest);
        g.globalAlpha = 1;
        g.fillStyle = '#000';
        g.fillRect(0, Y(from) - 1, w, Y(longest) - Y(from) + 2);
        // In cloth, through the neck you see the form's chest, not a hollow inside the back: it is drawn again there.
        if (cloth && isTop) {
          const rim = (a: number) => P(a, shell(a, topY(a)), topY(a));
          // The form, drawn again over the black, within a clip, and only over the form itself (not the cloth's
          // armholes, nor past the body's sides).
          const redraw = (clip: () => void, halfWidth: (y: number) => number) => {
            g.save();
            clip();
            g.clip();
            g.beginPath();
            const ys = Array.from({ length: 41 }, (_, i) => NECK_Y - 0.4 + ((yOf(longest) - NECK_Y + 0.4) * i) / 40);
            ys.forEach((y, i) => (i ? g.lineTo(cx - halfWidth(y) * S, Y(y)) : g.moveTo(cx - halfWidth(y) * S, Y(y))));
            [...ys].reverse().forEach((y) => g.lineTo(cx + halfWidth(y) * S, Y(y)));
            g.clip();
            g.globalAlpha = 1;
            g.fillRect(0, 0, w, h);
            g.globalAlpha = 0.6;
            paintFigure(g, S, cx, Y, lw, 1, false, phi);
            g.restore();
          };
          // Through the neck: the chest, inside the top edge all round.
          redraw(() => {
            g.beginPath();
            for (let i = 0; i <= 144; i++) {
              const q = rim(-Math.PI + (TAU * i) / 144);
              if (i) g.lineTo(q[0], q[1]);
              else g.moveTo(q[0], q[1]);
            }
          }, formHalfWidth);
          // And the neck itself, down to the near side of the neckline (seen from behind, no black band between the
          // neck and the back neckline); only as wide as the neck, so the form's shoulders never show above the cloth's.
          redraw(() => {
            g.beginPath();
            for (let i = 0; i <= 72; i++) {
              const q = rim(-Math.PI / 2 - phi + (Math.PI * i) / 72);
              if (i) g.lineTo(q[0], q[1]);
              else g.moveTo(q[0], q[1]);
            }
            g.lineTo(rim(Math.PI / 2 - phi)[0], 0);
            g.lineTo(rim(-Math.PI / 2 - phi)[0], 0);
            g.closePath();
          }, (y) => Math.min(formHalfWidth(y), neckR));
          // Sleeveless, the form's shoulders show through the open armholes, not black; the cloth is laid over them.
          if (arm && !sl) {
            redraw(() => {
              g.beginPath();
              g.rect(0, 0, w, Y(yU + 0.05));
            }, formHalfWidth);
          }
        }
      }
      g.restore();
      if (trousers) {
        const ys = Array.from({ length: 71 }, (_, i) => FORM_CROTCH + ((FORM_FLOOR - 0.02 - FORM_CROTCH) * i) / 70);
        for (const leg of [-1, 1]) {
          for (const e of [-1, 1]) {
            polyline(
              ys.map((y) => {
                const o = centre(legX(leg), y);
                return [o.x + e * FORM_LEG(y) * S, o.y];
              }),
              GILD,
              lw * 0.9,
              0.5,
            );
          }
          for (const a of [-0.9, 0, 0.9]) line(ys.map((y) => T(legX(leg), a, FORM_LEG(y), y)), GILD, lw * 0.45, 0, 0.45);
        }
        g.globalAlpha = 0.6;
        g.lineWidth = 0.6;
        g.strokeStyle = MUTED;
        seg([cx - 0.9 * S, Y(FORM_FLOOR)], [cx + 0.9 * S, Y(FORM_FLOOR)]);
        g.globalAlpha = 1;
      }

      // In the maker's fabric: the cloth laid round the garment in small patches, far ones first.
      if (cloth) {
        const quads: ClothQuad[] = [];
        const k = 1 / kY; // cm of cloth to a unit of the form
        type V = { x: number; y: number; a: number; r: number; yy: number; v?: number; ur?: number };
        /** A patch from four corners (top left, top right, bottom right, bottom left), its panel centred at c. */
        const patch = (v: V[], c: number, z: number, th: number, border?: (q: V) => number) => {
          const am = (v[0].a + v[1].a) / 2;
          const off = wrap(am - c);
          const slope = (v[2].r + v[3].r - v[0].r - v[1].r) / 2 / ((v[2].yy + v[3].yy - v[0].yy - v[1].yy) / 2 || 1e-6);
          const { lit, shine } = lightOf(Math.sin(th), -clamp(slope, -3, 3), Math.cos(th), cloth.sheen);
          quads.push({
            q: v.map((p) => [p.x, p.y]),
            uv: v.map((p) => [(off + p.a - am) * (p.ur ?? p.r) * k, border ? border(p) : (p.v ?? p.yy) * k]),
            z,
            lit,
            shine,
            border: !!border,
          });
        };
        /** The garment's body: from its top edge (or the armhole, under the arms) to its hem, or the crotch on trousers. */
        const NA = 60;
        // Rows closer together at the top, where the cloth turns over the shoulder, so it rounds there and does not step.
        const NT = 18;
        const rowF = (j: number) => (j / NT) ** 1.6;
        const mid = (yS + yU) / 2;
        const half = (yU - yS) / 2;
        const topOf = (a: number) => {
          let t = topY(a);
          // Sleeveless, the armhole is open; with a sleeve the bodice runs up to the shoulder and the sleeve stands on it.
          if (arm && !sl) {
            const d = Math.abs(Math.abs(a) - HALF) / 0.32;
            if (d < 1) t = Math.max(t, mid + half * Math.sqrt(1 - d * d));
          }
          return t;
        };
        const botOf = (a: number) => (trousers && lg ? yC : hemY(a));
        const bodyV = (a: number, y: number): V => {
          const r = rAt(a, y);
          const q = P(a, r, y);
          return { x: q[0], y: q[1], a, r, yy: y, v: clothDown(a, y) };
        };
        // The inside of the far side shows only through the neck, the armholes or a low top edge: no lower than the
        // lowest point of the top edge (seen a little from above), so the rest of it, always hidden, is not laid at all.
        let open = -9;
        for (let i = 0; i < NA; i++) open = Math.max(open, topOf(-Math.PI + (TAU * i) / NA));
        for (let i = 0; i < NA; i++) {
          const a0 = -Math.PI + (TAU * i) / NA;
          const a1 = a0 + TAU / NA;
          const t0 = topOf(a0);
          const t1 = topOf(a1);
          const b0 = botOf(a0);
          const b1 = botOf(a1);
          const am = (a0 + a1) / 2;
          // Front and back are cut as their own panels: the print is centred on each, and breaks at the side seams.
          const c = Math.abs(am) <= HALF ? 0 : Math.PI;
          const th = am + phi;
          for (let j = 0; j < NT; j++) {
            const f0 = rowF(j);
            const f1 = rowF(j + 1);
            const v = [bodyV(a0, t0 + (b0 - t0) * f0), bodyV(a1, t1 + (b1 - t1) * f0), bodyV(a1, t1 + (b1 - t1) * f1), bodyV(a0, t0 + (b0 - t0) * f1)];
            if (Math.cos(th) < -0.15 && Math.min(v[0].yy, v[1].yy) > open + 2 * FORM_DEPTH * radius(open) + 0.05) break;
            patch(v, c, Math.cos(th) * rAt(am, (v[0].yy + v[2].yy) / 2), th);
          }
          // A border print along the hem, its foot on the hem line.
          if (cloth.border && cloth.borderSize && !trousers) {
            const B = cloth.borderSize;
            // Only the swatch's band itself, its lower part: above it is plain ground, as the cloth under it is.
            const u0 = Math.max(t0, b0 - 0.4 * B * kY);
            const u1 = Math.max(t1, b1 - 0.4 * B * kY);
            const along = (p: V) => B - (hemY(p.a) - p.yy) * k;
            for (let j = 0; j < 6; j++) {
              const f0 = j / 6;
              const f1 = (j + 1) / 6;
              const v = [bodyV(a0, u0 + (b0 - u0) * f0), bodyV(a1, u1 + (b1 - u1) * f0), bodyV(a1, u1 + (b1 - u1) * f1), bodyV(a0, u0 + (b0 - u0) * f1)];
              patch(v, c, Math.cos(th) * radius((v[0].yy + v[2].yy) / 2) + 1e-4, th, along);
            }
          }
        }
        // The body inside: through the neck you see the form's chest, not the inside of the back as a hollow bucket.
        let neckLow = -9;
        for (let i = 0; i < 72; i++) neckLow = Math.max(neckLow, topY(-Math.PI + (TAU * i) / 72));
        if (isTop && neckLow > NECK_Y) {
          const NB = 36;
          const NBY = 10;
          const y1 = neckLow + 0.1;
          const bv = (a: number, y: number): [number, number] => {
            const q = P(a, formHalfWidth(y) + 0.004, y);
            return [q[0], q[1]];
          };
          for (let i = 0; i < NB; i++) {
            const a0 = -Math.PI + (TAU * i) / NB;
            const a1 = a0 + TAU / NB;
            const th = (a0 + a1) / 2 + phi;
            if (Math.cos(th) < 0.05) continue;
            for (let j = 0; j < NBY; j++) {
              const ya = NECK_Y + ((y1 - NECK_Y) * j) / NBY;
              const yb = NECK_Y + ((y1 - NECK_Y) * (j + 1)) / NBY;
              // Laid after everything facing away and before anything facing you: the body is inside all the cloth that faces you.
              quads.push({ q: [bv(a0, ya), bv(a1, ya), bv(a1, yb), bv(a0, yb)], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], z: -1e-6, lit: 0, shine: 0, cut: true });
            }
          }
        }
        /** A tube round an axis at X(y): a sleeve or a trouser leg. */
        const tube = (X: (y: number) => number, R: (y: number) => number, y0: number, y1: number, panels: boolean, inBody = false, Z: (y: number) => number = () => 1) => {
          const NS = 32;
          const NY = 24;
          // Rows closer together at the top, so a sleeve's cap rounds over smoothly rather than in flat facets.
          const rowY = (j: number) => y0 + (y1 - y0) * (j / NY) ** 1.6;
          // Down the cloth by its length over the crown, not its height, counted up from the hem, so the print is not
          // smeared across the top of the cap where it runs out more than down.
          const down: number[] = [y1];
          for (let j = NY - 1; j >= 0; j--) {
            const ya = rowY(j);
            const yb = rowY(j + 1);
            down.unshift(down[0] - Math.hypot(yb - ya, R(yb) - R(ya)));
          }
          const tv = (a: number, j: number): V => {
            const y = rowY(j);
            const r = R(y);
            const q = T(X(y), a, r, y, r * Z(y));
            // Over the crown the cloth is laid at the arm's own width, or the print squeezes into streaks at its top.
            return { x: q[0], y: q[1], a, r, yy: y, v: down[j], ur: Math.max(r, R(y1) * 0.8) };
          };
          for (let i = 0; i < NS; i++) {
            const a0 = -Math.PI + (TAU * i) / NS;
            const a1 = a0 + TAU / NS;
            const am = (a0 + a1) / 2;
            const th = am + phi;
            // A sleeve's inside shows past its edge as it turns, so it is laid too (in shadow); a leg's never does.
            if (!inBody && Math.cos(th) < -0.2) continue;
            const c = panels && Math.abs(am) > HALF ? Math.PI : 0;
            for (let j = 0; j < NY; j++) {
              const ya = rowY(j);
              const yb = rowY(j + 1);
              const ym = (ya + yb) / 2;
              const x = X(ym) + Math.sin(am) * R(ym);
              const zz = Math.cos(am) * R(ym) * Z(ym);
              // A patch of the cap wholly inside the bodice is never seen, and drawn it would flicker over the bodice's edge as
              // the form turns; one only partly inside is kept, or a slit opens where it meets the bodice.
              if (inBody && [ya, yb].every((y) => [a0, a1].every((a) => Math.hypot((X(y) + Math.sin(a) * R(y)) / radius(y), (Math.cos(a) * R(y) * Z(y)) / bodyRadius(y)) < 0.98))) continue;
              patch([tv(a0, j), tv(a1, j), tv(a1, j + 1), tv(a0, j + 1)], c, zz * Math.cos(phi) - x * s, th);
            }
          }
        };
        if (sl && arm) {
          for (const e of [1, -1]) {
            tube((y) => e * axisX(y), sleeveR, yCap, yE, false, true, capDepth);
          }
        }
        if (lg) for (const leg of [-1, 1]) tube(() => legX(leg), legR, yC, yH, true);
        paintCloth(g, layers, cloth, quads, w, h, dpr);
      }

      // The cloth itself, as lines down the garment all the way round, so it reads over the form: hanging
      // straight where it has ease, and only pulled in where it is cut close.
      if (!trousers && !cloth) {
        const n = through ? 18 : film ? 28 : 36;
        for (let j = 0; j < n; j++) {
          const a = (TAU * (j + 0.5)) / n;
          const y0 = isTop && arm ? Math.max(topY(a), yU - 0.02) : topY(a);
          const y1 = hemY(a);
          const pts: Pt[] = [];
          for (let i = 0; i <= 30; i++) {
            const y = y0 + ((y1 - y0) * i) / 30;
            pts.push(P(a, shell(a, y), y));
          }
          line(pts, GLOW, lw * 0.55, 0.08, through ? 0.45 : film ? 0.75 : 0.6);
        }
        for (let y = yOf(highest) + 0.12; !film && y < yOf(longest) - 0.04; y += 5 * kY) {
          const yy = y;
          ring((a) => Math.max(yy, topY(a)), (a, v) => shell(a, v), GLOW, lw * 0.5, 0.08, 0.45);
        }
      }
      // The garment: its top edge and waistband, its hem and its outline.
      if (round.bandCm) {
        ring(() => bandTop, () => radius(WAIST), GLOW, lw * 0.8, 0.2);
        for (const e of [-1, 1]) seg([cx + e * radius(WAIST) * S, Y(bandTop)], [cx + e * radius(WAIST) * S, Y(WAIST)]);
      }
      // In cloth, the edges are fine lines: the cloth itself gives the shape.
      const edge = cloth ? 0.55 : 1;
      ring(topY, (a, y) => shell(a, y), GLOW, lw * 1.1, 0.25, edge);
      for (const r of round.rings) ring((a) => yAt(a, r(a)), (a, y) => shell(a, y), GLOW, lw * 0.9, 0.25, edge);
      if (!trousers) ring(hemY, (_, y) => radius(y), GLOW, lw * 1.3, cloth ? 0 : 0.3, edge);
      for (const e of cloth ? [] : [1, -1]) {
        const a = (e * Math.PI) / 2 - phi;
        const y0 = isTop && arm ? yU : topY(a);
        const y1 = trousers && lg ? yC : hemY(a);
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const y = y0 + ((y1 - y0) * i) / 40;
          pts.push([cx + e * radius(y) * S, Y(y)]);
        }
        polyline(pts, GLOW, lw * 1.2);
        // Over the shoulder, from the neck to the shoulder tip.
        if (isTop && arm) {
          const n0 = topY(a);
          const sh: [number, number][] = [];
          for (let i = 0; i <= 16; i++) {
            const y = n0 + ((yS - n0) * i) / 16;
            sh.push([cx + e * radius(y) * S, Y(y)]);
          }
          polyline(sh, GLOW, lw);
        }
      }
      // Gathers on an elastic waist.
      if (round.elastic) {
        for (let a = -Math.PI; a < Math.PI; a += 0.12) {
          const q0 = P(a, radius(WAIST), WAIST);
          const q1 = P(a, radius(WAIST + 0.08), WAIST + 0.08);
          if (q0[2] > 0) {
            g.strokeStyle = GILD;
            g.lineWidth = lw * 0.6;
            g.globalAlpha = 0.7 * q0[2];
            seg(q0, q1);
          }
        }
        g.globalAlpha = 1;
      }

      // Stripes, when the fabric has them: level at the centres, dipping toward the side seams by the
      // angle each side seam cuts across the grain.
      if (striped && !trousers && !cloth) {
        const step = 6;
        const sec = (dg: number) => 1 / Math.cos((dg * Math.PI) / 180);
        for (let d = Math.ceil(highest / step) * step + step; d < longest; d += step) {
          const yAt = (a: number) => {
            const ang = Math.abs(a) <= HALF ? round.sideAngle.front : round.sideAngle.back;
            const below = Math.max(0, d - wh * 0.6);
            return yOf(d + below * (sec(ang) - 1) * Math.sin(a) ** 2);
          };
          g.strokeStyle = GILD;
          g.lineWidth = lw * 0.75;
          let prev: Pt | null = null;
          let prevFront = true;
          for (let i = 0; i <= 144; i++) {
            const a = -Math.PI + (TAU * i) / 144;
            const y = yAt(a);
            const q = P(a, shell(a, y), y);
            const inside = y < hemY(a) - 0.01 && y > topY(a) + 0.01 && !(isTop && arm && y < yU && Math.abs(Math.abs(a) - HALF) < 0.35) && !(film && isTop && arm && y < yU + 0.02);
            // Each panel is drawn on its own, so stripes that don't meet would show as a break at the seam.
            const isFront = Math.abs(a) <= HALF;
            if (prev && inside && isFront === prevFront) {
              g.globalAlpha = (q[2] + prev[2]) / 2 > 0 ? 0.75 : 0.12;
              seg(prev, q);
            }
            prevFront = isFront;
            prev = inside ? q : null;
          }
          g.globalAlpha = 1;
        }
      }

      // Armholes, and the sleeves set into them.
      if (arm) {
        for (const e of [1, -1]) {
          const mid = (yS + yU) / 2;
          const half = (yU - yS) / 2;
          const loop: Pt[] = [];
          for (let i = 0; i <= 48; i++) {
            const t = (TAU * i) / 48;
            const y = mid - half * Math.cos(t);
            loop.push(P(e * HALF + 0.32 * Math.sin(t), radius(y) + 0.004, y));
          }
          // With a sleeve, the sleeve's own edge is the armhole seam.
          if (!sl) line(loop, GLOW, lw * 1.05, 0.2, edge);
          if (!sl) continue;
          const y0 = yCap;
          const ys = Array.from({ length: 41 }, (_, i) => y0 + ((yE - y0) * i) / 40);
          const o = centre(e * axisX(yU), yU);
          const alpha = film ? clamp(0.7 + o.z / (formHalfWidth(yU) + ra), 0.35, 1) : clamp(0.55 + o.z / (formHalfWidth(yU) + ra), 0.22, 1);
          for (const side of cloth ? [] : [-1, 1]) {
            // The side toward the body shows only below the underarm; above it, it is inside the bodice.
            polyline(
              ys.filter((y) => through || side === e || y >= yU - 0.01).map((y) => {
                const q = centre(e * axisX(y), y);
                return [q.x + side * sleeveR(y) * S, q.y];
              }),
              GLOW,
              lw * (film ? 1.4 : 1.1),
              alpha,
            );
          }
          // In the film only the hem's near half is drawn: the whole ring, edge-on as the form turns, read as a coat
          // hanger, and with no hem at all the sleeve read as a wing off the shoulder (Cat, 2026-10-25).
          tubeRing(e * axisX(yE), rh, yE, GLOW, lw * 1.2, alpha * edge, film || cloth ? 0 : 0.25);
          if (film && !cloth) {
            // The sleeve's cloth, in a few lines down the front of the arm.
            for (const a of [-0.9, -0.3, 0.3, 0.9]) {
              line(ys.filter((y) => y >= yU - 0.02).map((y) => T(e * axisX(y), a, sleeveR(y), y)), GLOW, lw * 0.5, 0, alpha * 0.6);
            }
          }
          // The underarm seam, on the side of the sleeve toward the body.
          line(
            ys.filter((y) => y >= yU).map((y) => T(e * axisX(y), -e * HALF, sleeveR(y), y)),
            GLOW,
            lw,
            0.2,
            alpha,
          );
        }
      }

      // Trouser legs.
      if (lg) {
        const ys = Array.from({ length: 61 }, (_, i) => yC + ((yH - yC) * i) / 60);
        for (const leg of [-1, 1]) {
          for (const e of cloth ? [] : [-1, 1]) {
            polyline(
              ys.map((y) => {
                const o = centre(legX(leg), y);
                return [o.x + e * legR(y) * S, o.y];
              }),
              GLOW,
              lw * 1.2,
            );
          }
          tubeRing(legX(leg), legHemR, yH, GLOW, lw * 1.3, edge, cloth ? 0 : 0.25);
        }
      }

      // Darts, seams, the zip, buttons and the vent.
      const drawn = (sm: RoundSeam) => sm.kind !== 'sleeve';
      if (cloth) {
        // In cloth, seams and darts are grooves: a shadow line with a fine light edge, as on the style drawing.
        for (const dt of round.darts) {
          const pts = along([dt.base, dt.tip]);
          line(pts, '#000', lw * 1.8, 0, 0.4);
          line(pts, GLOW, lw * 0.5, 0, 0.45);
        }
        for (const sm of round.seams.filter(drawn)) {
          const pts = along(sm.pts, sm.leg);
          line(pts, '#000', lw * 2, 0, 0.45);
          line(pts, GLOW, lw * 0.55, 0, 0.5);
        }
      } else {
        for (const dt of round.darts) line(along([dt.base, dt.tip]), GILD, lw * 0.8, 0.2, film ? 0.5 : 1);
        for (const sm of round.seams.filter(drawn)) line(along(sm.pts, sm.leg), GLOW, lw * 1.1);
      }
      if (round.zip) {
        const z = round.zip;
        g.strokeStyle = GILD;
        g.lineWidth = 0.8;
        for (let cm = z.fromCm + 1; cm < z.toCm; cm += 1.6) {
          const q = spot({ phi: z.phi, cm });
          if (q[2] <= 0) continue;
          g.globalAlpha = q[2];
          seg([q[0] - 2.5, q[1]], [q[0] + 2.5, q[1]]);
        }
        g.globalAlpha = 1;
      }
      for (const b of round.opening?.buttons ?? []) {
        const y = yAt(0.05, b);
        dot(P(0.05, shell(0.05, y) + 0.005, y), GILD, 2.2);
      }
      if (round.vent) line(along([{ phi: Math.PI + 0.05, cm: round.vent.fromCm }, { phi: Math.PI + 0.05, cm: round.lengthAt(Math.PI) }]), GILD, lw * 0.8);

      // Where they meet: every seam at both ends, every dart point, stripes at the sides.
      const glow = clamp(1 - (now - pulse.current) / 1600, 0, 1);
      const meet = (q: Pt) => {
        if (film) return;
        dot(q, OK, 2.4);
        if (glow > 0 && q[2] > -0.2) {
          g.save();
          g.globalAlpha = glow * (q[2] > 0 ? 0.9 : 0.35);
          g.strokeStyle = GLOW;
          g.shadowColor = 'rgba(243,230,200,.9)';
          g.shadowBlur = 10;
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(q[0], q[1], 4 + (1 - glow) * 10, 0, TAU);
          g.stroke();
          g.restore();
        }
      };
      for (const sm of round.seams.filter(drawn)) {
        if (sm.pts.length < 2) continue;
        if (!sm.cont && !film) dot(spot(sm.pts[0], sm.leg), OK, 2.4);
        meet(spot(sm.pts[sm.pts.length - 1], sm.leg));
      }
      if (sl && arm) {
        for (const e of [1, -1]) {
          if (!film) dot(P(e * HALF, radius(yU), yU), OK);
          meet(T(e * axisX(yE), -e * HALF, rh, yE));
        }
      }
      if (!film) for (const dt of round.darts) dot(spot(dt.tip), OK, 2.4);
      if (striped && stripesMeet(round)) {
        for (const a of [HALF, -HALF]) {
          for (let d = Math.max(12, Math.ceil(highest / 12) * 12 + 12); d < round.lengthAt(a) - 2; d += 12) {
            const y = yOf(d + Math.max(0, d - wh * 0.6) * (1 / Math.cos((round.sideAngle.front * Math.PI) / 180) - 1));
            dot(P(a, shell(a, y), y), OK, 2.2);
          }
        }
      }

      if (!film) text('Drag to turn', 8, fig - 4);
      if (!strip) return;

      // The hem unrolled: centre front, round by the left side and the back, to the centre front again.
      const x0 = 14;
      const x1 = w - 12;
      const t0 = fig + 26;
      const b0 = h - 22;
      const lo = Math.min(...lengths);
      const hi = Math.max(...lengths);
      const span = Math.max(4, hi - lo);
      const ax = (a: number) => x0 + ((x1 - x0) * (((a % TAU) + TAU) % TAU)) / TAU;
      const ay = (cm: number) => t0 + ((cm - (lo - span * 0.15)) / (span * 1.3)) * (b0 - t0);
      text('Hem from the waist, all the way round', x0, t0 - 12);
      g.strokeStyle = GUIDE;
      g.lineWidth = 1;
      const marks: [number, string, CanvasTextAlign][] = [
        [0, 'CF', 'left'],
        [HALF, 'Left', 'center'],
        [Math.PI, 'CB', 'center'],
        [(3 * Math.PI) / 2, 'Right', 'center'],
        [TAU - 1e-4, 'CF', 'right'],
      ];
      for (const [a, name, align] of marks) {
        const x = ax(a);
        seg([x, t0 - 4], [x, b0 + 2]);
        text(name, x, b0 + 13, align);
      }
      g.strokeStyle = GLOW;
      g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const a = (TAU * i) / 240;
        const x = ax(Math.min(a, TAU - 1e-4));
        const y = ay(round.lengthAt(wrap(a)));
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      for (const sm of round.seams) {
        const end = sm.pts[sm.pts.length - 1];
        if (!end || sm.leg || Math.abs(end.cm - round.lengthAt(end.phi)) > 0.5) continue;
        dot([ax(((end.phi % TAU) + TAU) % TAU), ay(end.cm), 1], OK, 3);
      }
      const facing = ((-phi % TAU) + TAU) % TAU;
      g.strokeStyle = GILD;
      g.globalAlpha = 0.6;
      g.setLineDash([2, 3]);
      seg([ax(facing), t0 - 6], [ax(facing), b0]);
      g.setLineDash([]);
      g.globalAlpha = 1;
      const cmText = (v: number) => (v < 0 ? `${-v} cm above` : `${v} cm`);
      text(cmText(round.readings.front), x0 + 3, ay(round.readings.front) - 5);
      if (round.readings.back !== round.readings.front) text(cmText(round.readings.back), ax(Math.PI) + 4, ay(round.readings.back) - 5);
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!st.dragging) {
        if (st.target !== null) {
          const d = wrap(st.target - st.phi);
          st.phi += d * Math.min(1, dt * 4);
          if (Math.abs(d) < 0.002) st.target = null;
        } else if (!still && now - st.idle > 2500) st.phi += dt * 0.3;
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let x0 = 0;
    let phi0 = 0;
    const downEv = (e: PointerEvent) => {
      st.dragging = true;
      st.target = null;
      x0 = e.clientX;
      phi0 = st.phi;
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (st.dragging) st.phi = phi0 + ((e.clientX - x0) / (cv.clientWidth || 1)) * Math.PI * 1.6;
    };
    const up = () => {
      st.dragging = false;
      st.idle = performance.now();
    };
    cv.addEventListener('pointerdown', downEv);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointerdown', downEv);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, [round, m, striped, tiles, layers]);

  const turnTo = (a: number) => {
    turn.current.target = -a + 0.3;
    turn.current.idle = performance.now();
  };

  return (
    <div className="all-round">
      <canvas ref={ref} className={`all-round-canvas${round.legs ? ' all-round-tall' : ''}`} role="img" aria-label={label} />
      <div className="all-round-rows">
        {rows.map((r) => (
          <button key={r.id} type="button" className="all-round-row" onClick={() => turnTo(r.turn)}>
            <span className="all-round-mark" aria-hidden="true" />
            <span>
              <span className="all-round-name">{r.name}</span>
              <span>{r.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="all-round-note">Shape preview, not a cloth simulation</p>
    </div>
  );
}
