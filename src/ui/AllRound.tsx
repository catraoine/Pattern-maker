// All the way round: the garment on the dress form, turning, so you can see what the flat sketch can't:
// every seam and dart meeting where they join, the neck and the hem all the way round, the sleeves and trouser legs, and stripes meeting at the side seams when
// the fabric has them. Drag anywhere to turn it. It is a shape preview drawn from the draft, not a cloth
// simulation. Seams are trued as each garment is drafted, so nothing here is ever flagged as a problem:
// when a change is trued, the seams glow softly, and that is the only sign. With a fabric chosen, the garment is
// drawn in it, print and colour wrapped round as it turns (Cat, 2026-10-26); with none, in plain calico, and the checks
// fold into one quiet line under it (Cat's Q2 Quiet in Calico, 2026-10-31: the view read like engineering).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MyFabric } from '../engine/fabrics';
import { FabricPaint, fabricPaint } from './FabricFill';
import { ClothQuad, ClothTiles, clothLayers, clothTiles, lightOf, paintCloth } from './allRoundCloth';
import { RoundGarment, RoundPt, RoundSeam, stripesMeet } from '../engine/allRound';
import { bodyHalf as formHalfWidth, reach as bodyReach, shapeAt } from '../engine/body';
import { FORM_CROTCH, FORM_DEPTH, FORM_FLOOR, FORM_LEG, FORM_LEG_X, paintFigure } from './ContourForm';
import { BUST_Y, FORM_HIP, NECK_Y, RoundMeasurements, WAIST, roundShape } from './allRoundShape';
import type { Pick, PickPart, RoundView } from './allRoundMesh';

// Matching --gild, --gild-glow, --guide, --muted and --ok in styles.css.
const GILD = '#d9c49b';
const GLOW = '#f3e6c8';
const MUTED = '#9a8e78';
const OK = '#a9c49b';

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** With no fabric picked, the Form view's calico (18-calm-style.css --calico), lifted so the studio lamps keep it pale. */
const CALICO: FabricPaint = { size: 16, tone: '#f2eadb', ground: '#f2eadb', half: '#f2eadb', plain: '#f2eadb', lift: 0.4 };

type Pt = [number, number, number];

/** A point of a line drawn on the turning garment (Cat's A Draw on it, 2026-10-28), read for the draw tool: what it
 *  is on, its height in cm below the waist (above is negative), and where it sits across the flat drawing in the
 *  pattern's cm (the view's own guess; on a sleeve or a leg the tool places it round the arm or leg from `a`). */
export interface RoundPick {
  part: PickPart;
  /** The side of a sleeve or a leg, -1 or 1. */
  e: number;
  /** The angle round the body from the centre front, or round a sleeve or leg from its front (outward past 0). */
  a: number;
  cm: number;
  xCm: number;
}

interface Props {
  round: RoundGarment;
  m: RoundMeasurements;
  /** The fabric has checks or stripes to match: which, so the note names the right one. */
  striped?: boolean | 'checks' | 'stripes';
  /** The maker's fabric: the garment is drawn in it. Left out, or with none chosen, the garment stays in lines. */
  fabric?: MyFabric;
  label: string;
  /** The draw tool inside the view: one finger draws a line on the garment (sent as it grows, then once more with
   *  `done`), two fingers turn it. The rows under the view are left out, so the view is the drawing alone. */
  draw?: { onStroke: (pts: RoundPick[], done: boolean) => void };
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

/** The checks as one quiet line: "Seams and hem checked", and stripes or checks "matched". */
export function checked(rows: Row[]): string {
  const names = rows.filter((r) => r.id !== 'stripes').map((r, i) => (i ? r.name.toLowerCase() : r.name));
  const match = rows.find((r) => r.id === 'stripes');
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${list} checked${match ? `, ${match.name.toLowerCase()} matched` : ''}`;
}

export function AllRound({ round, m, striped = false, fabric, label, draw }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const drawing = !!draw;
  // The cloth's tiles, once its swatch has loaded; until then (and with no fabric) the garment is in lines.
  // The How it works film keeps its lines with no fabric (scripts/record-tour-shots.mjs).
  const film = !!(window as Window & { __tourFilm?: string | boolean }).__tourFilm;
  const paint = useMemo(() => fabricPaint(fabric, import.meta.env.BASE_URL) ?? (film ? undefined : CALICO), [fabric, film]);
  const paintKey = JSON.stringify(paint ?? null);
  const [tiles, setTiles] = useState<ClothTiles | undefined>();
  useEffect(() => {
    let live = true;
    if (!paint) setTiles(undefined);
    else clothTiles(paint).then((t) => live && setTiles(t), () => live && setTiles(undefined));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the paint's contents, not the rebuilt object
  }, [paintKey]);
  const layers = useMemo(clothLayers, []);
  // The figure drawn by the graphics chip (allRoundMesh.ts), once its code has loaded; until then, and in a browser
  // without WebGL, the canvas painter below draws it. ?round=2d asks for the canvas painter.
  const v3ref = useRef<RoundView | undefined>(undefined);
  const [v3ready, setV3ready] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('round') === '2d' || (window as Window & { __round2d?: boolean }).__round2d) return;
    let live = true;
    import('./allRoundMesh').then(({ createRoundView }) => {
      if (!live) return;
      v3ref.current = createRoundView();
      setV3ready(true);
    });
    return () => {
      live = false;
      v3ref.current?.dispose();
      v3ref.current = undefined;
    };
  }, []);
  const turn = useRef({ phi: 0.6, target: null as number | null, dragging: false, idle: 0, probe: false, stroke: null as [number, number][] | null, picks: [] as RoundPick[] });
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
    const flag = (window as Window & { __tourFilm?: string | boolean }).__tourFilm;
    const film = !!flag;
    // The film's 'old look': the form's lines run on through the whole garment, as the released film had it.
    const through = flag === 'old';
    const isTop = round.kind === 'top' || round.kind === 'dress';
    // In the maker's fabric, unless the film wants its old look.
    const cloth = through ? undefined : tiles;

    const sh = roundShape(round, m, { film, through });
    const v3 = through ? undefined : v3ref.current;
    if (v3) v3.build({ round, sh, cloth, film, striped: !!striped });
    const { hemY, topY, wh, yAt, yOf, kY, N, krB, krW, krH, longest, highest, bandTop, arm, yS, yU, sl, ra, rh, neckOnly, radius, foldTilt, depthAt, shell, zAcross, clothDown, yE, yCap, axisX, capDepth, sleeveR, lg, yC, yH, legHemR, legR, legAxis, rAt, reach } = sh;
    /** The last frame's layout, for reading where a finger is. */
    let frame = { S: 1, cx: 0, top: 0, lw: 1, fig: 1 };

    // A point of the view read for the draw tool: the form's units back into the pattern's cm. Across, the form's
    // units are the body's radius scaled, and the flat drawing is in the pattern's cm (a quarter of the round, so
    // pi/2 times the radius); down, the garment's own placing on the form (placeOnForm), undone by halving.
    const kr = (y: number) => (y <= BUST_Y ? krB : y <= WAIST ? krB + ((krW - krB) * (y - BUST_Y)) / (WAIST - BUST_Y) : y <= FORM_HIP ? krW + ((krH - krW) * (y - WAIST)) / (FORM_HIP - WAIST) : krH);
    const cmAt = (a: number, y: number) => {
      let lo = -N - 40;
      let hi = 220;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (yAt(a, mid) < y) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const toPick = (p: Pick, phi: number): RoundPick => {
      // The view looks from a touch above (FORM_DEPTH), so a level line across the cloth would read higher at the
      // front than at the sides; it is read as the flat tool reads it, straight on, so a level line is level.
      const [x, yHit, z] = p.p;
      const y = yHit + (z * Math.cos(phi) - x * Math.sin(phi)) * FORM_DEPTH;
      const xCm = (x / kr(y)) * HALF;
      if (p.part === 'sleeve') return { part: p.part, e: p.e, a: Math.atan2((x - p.e * axisX(y)) * p.e, z), cm: cmAt(0, y), xCm };
      if (p.part === 'leg') return { part: p.part, e: p.e, a: Math.atan2((x - p.e * (lg ? legAxis(y) : FORM_LEG_X)) * p.e, z), cm: cmAt(Math.PI, y), xCm };
      const a = Math.atan2(x, z);
      return { part: p.part, e: p.e, a, cm: cmAt(a, y), xCm };
    };
    /** What is under the finger at (px, py) on the canvas: the graphics chip's view asked, or (without it) the plane
     *  through the form's axis facing you. */
    const pickAt = (px: number, py: number): RoundPick => {
      const { S, cx, top, lw, fig } = frame;
      const phi = st.phi;
      if (v3) {
        const hit = v3.pick({ phi, w, h: fig, dpr, S, cx, top, lw }, px, py);
        if (hit) return toPick(hit, phi);
      }
      const xw = (px - cx) / S;
      return toPick({ part: 'air', e: 0, p: [xw * Math.cos(phi), top + (py - 8) / S, xw * Math.sin(phi)] }, phi);
    };

    const draw = (now: number) => {
      const top = film ? Math.min(-2, yOf(highest) - 0.3) : Math.min(-0.45, yOf(highest) - 0.3);
      const bottom = trousers ? FORM_FLOOR + 0.1 : Math.min(FORM_FLOOR + 0.1, Math.max(yOf(longest), sl ? yE : -9) + 0.45);
      const fig = h;
      const S = Math.min((fig - 16) / (bottom - top), (w / 2 - 14) / (reach * 1.04));
      const cx = w / 2;
      const Y = (y: number) => 8 + (y - top) * S;
      const lw = Math.max(0.7, S / 252) * 1.2;
      frame = { S, cx, top, lw, fig };
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
      const line = (pts: Pt[], colour: string, width: number, back = 0.2, alpha = 1, graze = 0) => {
        g.strokeStyle = colour;
        g.lineWidth = width;
        for (let i = 1; i < pts.length; i++) {
          const f = (pts[i][2] + pts[i - 1][2]) / 2;
          // A groove in the cloth fades out as it turns away toward the edge, rather than showing past it.
          g.globalAlpha = alpha * (f > 0 ? (0.55 + 0.45 * Math.min(1, f)) * clamp((f - graze) * 4, 0, 1) : back);
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
      const legX = (leg: number, y: number) => leg * legAxis(y);
      /** A point on the garment, on the body or down a trouser leg. */
      // On an oval a line faces you by the cloth's own slope, not by its angle round the body alone, or a seam on the far
      // side near the edge shows past the cloth.
      const onCloth = (a: number, r: number, y: number): Pt => {
        const q = P(a, r, y);
        const W = radius(y);
        const D = depthAt(a, y);
        const nx = Math.sin(a) / (W * W);
        const nz = Math.cos(a) / (D * D);
        q[2] = (nz * Math.cos(phi) - nx * Math.sin(phi)) / Math.hypot(nx, nz);
        return q;
      };
      const spot = (p: RoundPt, leg?: number): Pt => {
        const y = leg ? yOf(p.cm) : yAt(p.phi, p.cm);
        return leg ? T(legX(leg, y), p.phi, legR(y), y) : onCloth(p.phi, rAt(p.phi, y), y);
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
      /** How far out the body itself reaches across the view at height y (its edge as you see it). */
      const bodyEdge = (y: number) => {
        let best = 0;
        for (let i = 0; i < 48; i++) {
          const a = -Math.PI + (TAU * i) / 48;
          best = Math.max(best, Math.abs(Math.sin(a + phi)) * bodyReach(formHalfWidth(Math.min(y, 1.3)), a, y));
        }
        return best;
      };
      const ring = (yAt: (a: number) => number, rAt: (a: number, y: number) => number, colour: string, width: number, back = 0.25, alpha = 1, overBody = false, groove = false) => {
        let pts: Pt[] = [];
        // A sewn seam round the garment (a dress's waist seam) is a shadow in the cloth, as the side seams are, not a
        // bright edge like a hem or a neckline (Cat, 2026-10-27).
        const draw = (run: Pt[]) => {
          if (groove) {
            line(run, '#000', width * 1.8, 0, 0.45, 0.3);
            line(run, GLOW, width * 0.5, 0, 0.5, 0.3);
          } else line(run, colour, width, back, alpha);
        };
        for (let i = 0; i <= 144; i++) {
          const a = -Math.PI + (TAU * i) / 144;
          const y = yAt(a);
          const q = onCloth(a, rAt(a, y), y);
          // On the satin form the far side of an edge is hidden wherever the body stands between you and it (it showed
          // as a line across the neck); it still shows past the body's sides.
          if (overBody && q[2] <= 0 && Math.abs(q[0] - cx) < bodyEdge(y) * S - 1) {
            if (pts.length > 1) draw(pts);
            pts = [];
            continue;
          }
          pts.push(q);
        }
        if (pts.length > 1) draw(pts);
      };
      const tubeRing = (X: number, r: number, y: number, colour: string, width: number, alpha = 1, back = 0.25) => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 48; i++) pts.push(T(X, -Math.PI + (TAU * i) / 48, r, y));
        line(pts, colour, width, back, alpha);
      };
      const dot = (q: Pt, colour: string, r = 3.4) => {
        // In the fabric the seam-check rings are left out, so the cloth reads; the lines view keeps them.
        if (cloth) return;
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
      // For the all-round check, the backdrop and the hollow inside the garment are painted in colours of their own
      // (red and magenta) so a picture can tell them from the form's own black; nobody else ever sees them.
      const backdrop = st.probe ? '#f00' : '#000';
      const hollow = st.probe ? '#f0f' : '#000';
      g.globalAlpha = 1;
      g.fillStyle = backdrop;
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const drawn = (sm: RoundSeam) => sm.kind !== 'sleeve';
      if (v3) {
        // Below the arms, the space between a sleeve and the waist is a window onto the background, as on a person whose
        // hands hang by their hips, not a hole in the garment: the check is shown it as neither.
        if (st.probe && cloth && sl && yU) {
          g.fillStyle = '#ff0';
          const ys = Array.from({ length: 41 }, (_, i) => yU + 0.1 + ((yOf(longest) - yU - 0.1) * i) / 40);
          const side = (y: number, e: number) => Math.max(...Array.from({ length: 48 }, (_, i) => e * (P((TAU * i) / 48, shell((TAU * i) / 48, y), y)[0] - cx)));
          for (const e of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + e * w, Y(ys[0]));
            ys.forEach((y) => g.lineTo(cx + e * (side(y, e) - 2), Y(y)));
            g.lineTo(cx + e * w, Y(ys[ys.length - 1]));
            g.fill();
          }
        }
        // The figure, drawn by the graphics chip, stops above the hem line.
        g.save();
        g.beginPath();
        g.rect(0, 0, w, fig);
        g.clip();
        g.drawImage(v3.render({ phi, w, h: fig, dpr, S, cx, top, lw, probe: st.probe }), 0, 0, w, fig);
        g.restore();
      } else {
      // The figure stops above the hem line, so its legs don't run through it. Under trousers its legs
      // turn with the garment.
      g.save();
      g.beginPath();
      // Under trousers the form's round torso is left out below the waist: the trousers are oval and close in round the
      // legs, and its lines would show past them in front and behind (Cat, 2026-10-26: "trousers look weird").
      g.rect(0, 0, w, trousers ? Y(WAIST + 0.02) : fig);
      g.clip();
      g.globalAlpha = 0.6;
      g.strokeStyle = GILD;
      paintFigure(g, S, cx, Y, lw, trousers ? 0 : 1, false, phi, { half: formHalfWidth, shape: shapeAt, satin: !through, head: false });
      // The cloth covers the form: under the garment the body is not drawn, so the garment is what reads.
      if (!trousers && !through && !cloth?.sheer) {
        // The shoulders and the neck still show through a top's yoke: the cloth is held to the body there.
        // In cloth the garment covers the shoulders too, so nothing of the form shows between the bodice and a sleeve's cap.
        const from = isTop && arm && !cloth ? yU : yOf(highest);
        g.globalAlpha = 1;
        g.fillStyle = hollow;
        g.fillRect(0, Y(from) - 1, w, Y(longest) - Y(from) + 2);
        // Below the arms, the space between a sleeve and the waist is a window onto the background, as on a person whose
        // hands hang by their hips, not a hole in the garment: the check is shown it as neither.
        if (st.probe && sl && yU) {
          g.fillStyle = '#ff0';
          const ys = Array.from({ length: 41 }, (_, i) => yU + 0.1 + ((yOf(longest) - yU - 0.1) * i) / 40);
          const side = (y: number, e: number) => Math.max(...Array.from({ length: 48 }, (_, i) => e * (P((TAU * i) / 48, shell((TAU * i) / 48, y), y)[0] - cx)));
          for (const e of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + e * w, Y(ys[0]));
            ys.forEach((y) => g.lineTo(cx + e * (side(y, e) - 2), Y(y)));
            g.lineTo(cx + e * w, Y(ys[ys.length - 1]));
            g.fill();
          }
          g.fillStyle = hollow;
        }
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
            g.fillStyle = '#000';
            g.fillRect(0, 0, w, h);
            g.globalAlpha = 0.6;
            paintFigure(g, S, cx, Y, lw, 1, false, phi, { half: formHalfWidth, shape: shapeAt, satin: !through, head: false });
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
          }, (y) => Math.min(formHalfWidth(y), neckOnly));
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
                const o = centre(legX(leg, y), y);
                return [o.x + e * FORM_LEG(y) * S, o.y];
              }),
              GILD,
              lw * 0.9,
              0.5,
            );
          }
          for (const a of [-0.9, 0, 0.9]) line(ys.map((y) => T(leg * FORM_LEG_X, a, FORM_LEG(y), y)), GILD, lw * 0.45, 0, 0.45);
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
          const steep = (v[2].r + v[3].r - v[0].r - v[1].r) / 2 / ((v[2].yy + v[3].yy - v[0].yy - v[1].yy) / 2 || 1e-6);
          // Where the seat closes in round the legs, it is lit nearly as the legs below it are, so no dark band runs
          // across the trousers at the crotch.
          const slope = lg && (v[0].yy + v[2].yy) / 2 > yC - 0.35 ? steep * 0.3 : steep;
          const tt = th + foldTilt(am, (v[0].yy + v[2].yy) / 2);
          const { lit, shine } = lightOf(Math.sin(tt), -clamp(slope, -3, 3), Math.cos(tt), cloth.sheen);
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
        // How far a patch of the body faces you, by the cloth's own slope round the body: where the cloth is broad and
        // shallow (over the shoulders, the hips), its edge as you see it is not where it faces straight sideways, so the
        // angle round the body alone would leave out a strip of the edge, which then flickers in as the form turns.
        const facing = (a0: number, a1: number, y: number) => {
          const r0 = rAt(a0, y);
          const r1 = rAt(a1, y);
          const tx = Math.sin(a1) * r1 - Math.sin(a0) * r0;
          const tz = Math.cos(a1) * r1 - Math.cos(a0) * r0;
          return (tx * c + tz * s) / (Math.hypot(tx, tz) || 1);
        };
        // The inside of the far side shows only through the neck, the armholes or a low top edge: no lower than the
        // lowest point of the top edge (seen a little from above), so the rest of it, always hidden, is not laid at all.
        // Kept to well past the edge: the real body has flat stretches (the belly, the upper back, the seat) where a
        // patch a good way round from the edge still reaches as far out as the edge does, and cut it would snap the
        // garment's side in and out as the form turns.
        const AWAY = -0.5;
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
            if (facing(a0, a1, v[0].yy) < AWAY && Math.min(v[0].yy, v[1].yy) > open + 2 * FORM_DEPTH * radius(open) + 0.05) break;
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
          const NB = 48;
          const NBY = 24;
          const y0 = -2.0;
          const y1 = neckLow + 0.1;
          // The opening in front of you: inside the near top edge, up past the neck. Only there can the body be seen
          // at all, and the cloth over the far shoulder, showing past the near neckline over the shoulder's slope, lies
          // on the body rather than behind it, so outside the opening nothing is cut.
          const opening: [number, number][] = [];
          for (let i = 0; i <= 96; i++) {
            const a = -HALF - phi + (Math.PI * i) / 96;
            const q = P(a, shell(a, topY(a)), topY(a));
            opening.push([q[0], q[1]]);
          }
          opening.push([opening[opening.length - 1][0], -2], [opening[0][0], -2]);
          // The body itself, its real shape, seen from where you stand: what it hides of the back is cut away.
          const bv = (a: number, y: number): [number, number] => {
            const yy = Math.max(y, -1.75);
            const q = P(a, bodyReach(formHalfWidth(yy), a, yy) + 0.004, y);
            return [q[0], q[1]];
          };
          for (let i = 0; i < NB; i++) {
            const a0 = -Math.PI + (TAU * i) / NB;
            const a1 = a0 + TAU / NB;
            const th = (a0 + a1) / 2 + phi;
            if (Math.cos(th) < 0.05) continue;
            for (let j = 0; j < NBY; j++) {
              const ya = y0 + ((y1 - y0) * j) / NBY;
              const yb = y0 + ((y1 - y0) * (j + 1)) / NBY;
              // Laid after everything facing away and before anything facing you: the body is inside all the cloth that faces you.
              quads.push({ q: [bv(a0, ya), bv(a1, ya), bv(a1, yb), bv(a0, yb)], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], z: -1e-6, lit: 0, shine: 0, cut: true, clip: opening });
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
              if (inBody && [ya, yb].every((y) => [a0, a1].every((a) => Math.abs(Math.cos(a) * R(y) * Z(y)) < zAcross(X(y) + Math.sin(a) * R(y), y, Math.cos(a) > 0) * 0.98))) continue;
              // The inside of a cap (facing away) is laid well behind everything: its top rows, tiny and at the shoulder
              // tip, otherwise sorted in front of the bodice's own side and showed as a dark stroke at the tip.
              const behind = inBody && Math.cos(th) < 0 ? 0.5 : 0;
              patch([tv(a0, j), tv(a1, j), tv(a1, j + 1), tv(a0, j + 1)], c, zz * Math.cos(phi) - x * s - behind, th);
            }
          }
        };
        if (sl && arm) {
          for (const e of [1, -1]) {
            tube((y) => e * axisX(y), sleeveR, yCap, yE, false, true, capDepth);
          }
        }
        if (lg) for (const leg of [-1, 1]) tube((y) => legX(leg, y), legR, yC, yH, true);
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
      ring(topY, (a, y) => shell(a, y), GLOW, lw * 1.1, 0.25, edge, !!cloth);
      for (const r of round.rings) ring((a) => yAt(a, r(a)), (a, y) => shell(a, y), GLOW, lw * 0.9, cloth ? 0 : 0.25, edge, false, !!cloth);
      if (!trousers) ring(hemY, (a, y) => shell(a, y), GLOW, lw * 1.3, cloth ? 0 : 0.3, edge);
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
                const o = centre(legX(leg, y), y);
                return [o.x + e * legR(y) * S, o.y];
              }),
              GLOW,
              lw * 1.2,
            );
          }
          tubeRing(legX(leg, yH), legHemR, yH, GLOW, lw * 1.3, edge, cloth ? 0 : 0.25);
        }
      }

      // Darts, seams and the vent.
      if (cloth) {
        // In cloth, seams and darts are grooves: a shadow line with a fine light edge, as on the style drawing.
        for (const dt of round.darts) {
          const pts = along([dt.base, dt.tip]);
          line(pts, '#000', lw * 1.8, 0, 0.4, 0.3);
          line(pts, GLOW, lw * 0.5, 0, 0.45, 0.3);
        }
        for (const sm of round.seams.filter(drawn)) {
          const pts = along(sm.pts, sm.leg);
          line(pts, '#000', lw * 2, 0, 0.45, 0.3);
          line(pts, GLOW, lw * 0.55, 0, 0.5, 0.3);
        }
      } else {
        for (const dt of round.darts) line(along([dt.base, dt.tip]), GILD, lw * 0.8, 0.2, film ? 0.5 : 1);
        for (const sm of round.seams.filter(drawn)) line(along(sm.pts, sm.leg), GLOW, lw * 1.1);
      }
      }
      // The zip, buttons and where things meet.
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

      if (!film && !drawing) text('Drag to turn', 8, fig - 4);
      // The line being drawn, a fine chalk line over the garment.
      if (st.stroke && st.stroke.length > 1) {
        g.save();
        g.setLineDash([5, 3]);
        polyline(st.stroke, GLOW, 1.8, 0.95);
        g.restore();
      }
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
        } else if (!still && !drawing && now - st.idle > 2500) st.phi += dt * 0.3;
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let x0 = 0;
    let phi0 = 0;
    // Drawing (Cat's A Draw on it): one finger draws on the garment, a second finger turns it instead.
    const fingers = new Map<number, number>();
    // Where the finger is on the canvas, from where the canvas was when the line began: the page can shift under
    // it as the hint changes while the line is drawn.
    let rect = cv.getBoundingClientRect();
    const at = (e: PointerEvent): [number, number] => [e.clientX - rect.left, e.clientY - rect.top];
    const meanX = () => [...fingers.values()].reduce((t, v) => t + v, 0) / (fingers.size || 1);
    const downEv = (e: PointerEvent) => {
      fingers.set(e.pointerId, e.clientX);
      st.target = null;
      cv.setPointerCapture(e.pointerId);
      if (drawing && fingers.size === 1) {
        rect = cv.getBoundingClientRect();
        const q = at(e);
        st.stroke = [q];
        st.picks = [pickAt(q[0], q[1])];
        st.dragging = false;
        return;
      }
      st.stroke = null;
      st.picks = [];
      st.dragging = true;
      x0 = meanX();
      phi0 = st.phi;
    };
    const move = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, e.clientX);
      if (st.stroke) {
        const q = at(e);
        st.stroke.push(q);
        st.picks.push(pickAt(q[0], q[1]));
        if (st.picks.length > 4 && st.picks.length % 4 === 0) drawRef.current?.onStroke(st.picks, false);
        return;
      }
      if (st.dragging) st.phi = phi0 + ((meanX() - x0) / (cv.clientWidth || 1)) * Math.PI * 1.6;
    };
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (st.stroke) {
        const picks = st.picks;
        st.stroke = null;
        st.picks = [];
        if (e.type === 'pointerup' && picks.length > 2) drawRef.current?.onStroke(picks, true);
      }
      if (!fingers.size) st.dragging = false;
      else {
        x0 = meanX();
        phi0 = st.phi;
      }
      st.idle = performance.now();
    };
    cv.style.touchAction = drawing ? 'none' : '';
    // The all-round check (e2e/all-round-check.spec.ts) turns the form to an exact angle with this event.
    const turnEv = (e: Event) => {
      const { at, probe } = (e as CustomEvent<{ at: number; probe: boolean }>).detail;
      st.phi = at;
      st.probe = probe;
      st.target = null;
      st.idle = performance.now();
    };
    cv.addEventListener('allround-turn', turnEv);
    cv.addEventListener('pointerdown', downEv);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointerdown', downEv);
      cv.removeEventListener('allround-turn', turnEv);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, [round, m, striped, tiles, layers, v3ready, drawing]);

  return (
    <div className="all-round">
      <canvas ref={ref} className={`all-round-canvas${round.legs ? ' all-round-tall' : ''}${drawing ? ' drawing' : ''}`} role="img" aria-label={label} />
      {!drawing && (
        <div className="all-round-quiet">
          <p className="all-round-checked">
            <span className="all-round-mark" aria-hidden="true" />
            {checked(rows)}
          </p>
          <p className="all-round-note">A shape preview, not a cloth simulation.</p>
        </div>
      )}
    </div>
  );
}
