// The bodice on a dress form built from your measurements, drawn in contour lines like the skirt's
// figure. Swipe to turn it, pinch to zoom in, double-tap to reset.
import { useMemo } from 'react';
import type { BodiceDraft, BodiceMeasurements } from '../engine/bodice';
import type { P } from '../engine/geometry';
import { BODY_DEPTH, Paint, TILT, TurnCanvas, perim, spline } from './TurnFigure';

type Pt = [number, number];

interface Model {
  top: number; // top of the neck
  base: number; // bottom of the form
  body: (y: number) => number; // half-width of the form
  garment: (y: number) => number; // half-width of the bodice
  edge: (a: number) => number; // height of the bodice's top edge at angle a from centre front (0 to pi)
  hem: (a: number) => number; // height of the hem at angle a
  /** Darts and the zip as lines round the bodice: [angle, height] points. */
  darts: [number, number][][];
  zip: [number, number][];
}

/** Linear interpolation over [x, y] samples sorted by x. */
function table(samples: [number, number][]) {
  return (x: number) => {
    if (x <= samples[0][0]) return samples[0][1];
    for (let i = 1; i < samples.length; i++) {
      const [x1, y1] = samples[i];
      if (x <= x1) {
        const [x0, y0] = samples[i - 1];
        return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return samples[samples.length - 1][1];
  };
}

function buildModel(draft: BodiceDraft, m: BodiceMeasurements): Model {
  const NW = m.nape_to_waist;
  const r = (c: number) => c / perim(BODY_DEPTH);
  const HB = m.high_bust ?? m.full_bust - 4;
  const WH = m.waist_to_hip ?? 20;
  const H = m.full_hip ?? m.waist * 1.25;
  const HH = m.high_hip ?? m.waist + 0.65 * (H - m.waist);
  const scye = draft.armholeDepth;
  const ua = scye - NW; // underarm height

  // The front piece is longer than the back over the bust. On the form its neck point, underarm and
  // waist line up with the back's, stretched in between.
  const wf = draft.front.waistCentre.y;
  const fy = (y: number) =>
    y <= scye ? y - NW : y <= wf ? ua + ((y - scye) * -ua) / (wf - scye) : y - wf;
  const by = (y: number) => y - draft.back.waistCentre.y;
  const bust = fy(draft.front.apex.y);
  const sh = -NW + 3;

  const body = spline([
    [-NW - 9, 0.95 * r(m.neck)],
    [-NW, r(m.neck)],
    [-NW + 1.5, (r(m.neck) + m.shoulder_width / 2) / 2],
    [sh + 1, 0.97 * (m.shoulder_width / 2)],
    [ua - 2, Math.max(r(HB) * 1.02, 0.9 * (m.shoulder_width / 2))],
    [bust, r(m.full_bust)],
    [(bust + 0) / 2 + 2, (r(m.full_bust) + r(m.waist)) / 2],
    [0, r(m.waist)],
    [WH / 2, r(HH)],
    [WH, r(H)],
    [WH + 7, 0.96 * r(H)],
  ]);

  // The bodice is the form plus its ease: the bust's share above the bust, the waist's at the waist and
  // the hem's at the hem, blended in between.
  const hemBody = draft.drop > 0 ? body(draft.drop) * perim(BODY_DEPTH) : m.waist;
  const ratio = table([
    [sh, 1.03],
    [ua, draft.finishedBust / m.full_bust],
    [bust, draft.finishedBust / m.full_bust],
    [0, draft.finishedWaist / m.waist],
    ...(draft.drop > 0 ? ([[draft.drop, (draft.finishedHem ?? hemBody) / hemBody]] as [number, number][]) : []),
  ]);
  const garment = (y: number) => body(y) * ratio(y) + 0.25;

  // The top edge, from each piece's neckline, shoulder and armhole, laid round the form: the neck by how
  // far each point is from the centre, the shoulder and armhole spread evenly to the side.
  const gs = garment(sh);
  const side = (pc: number, map: (y: number) => number) => {
    const { pts, tags } = draft.pieces[pc].outline.taggedPoints(12);
    const run = (tag: string) => pts.filter((_, i) => tags[i] === tag || tags[i - 1] === tag);
    const neck = run('neck');
    const shoulder = run('shoulder');
    const arm = run('armhole');
    const asinOf = (x: number) => Math.asin(Math.min(0.97, Math.abs(x) / gs));
    const nx = Math.max(...neck.map((q) => q.x));
    const aN = asinOf(nx);
    const aS = Math.min(1.2, Math.max(aN + 0.2, asinOf(shoulder[shoulder.length - 1].x)));
    const out: [number, number][] = neck.map((q) => [asinOf(q.x), map(q.y)]);
    shoulder.forEach((q, i) => out.push([aN + ((aS - aN) * i) / Math.max(1, shoulder.length - 1), map(q.y)]));
    // Armhole by distance along it, from the shoulder to the side seam.
    const along = arm.map((_, i) => (i ? Math.hypot(arm[i].x - arm[i - 1].x, arm[i].y - arm[i - 1].y) : 0));
    let total = 0;
    const cum = along.map((d) => (total += d));
    arm.forEach((q, i) => out.push([aS + ((Math.PI / 2 - aS) * cum[i]) / (total || 1), map(q.y)]));
    return out;
  };
  const front = side(0, fy);
  const back = side(1, by).map(([a, y]) => [Math.PI - a, y] as [number, number]);
  const samples = [...front, ...back].sort((a, b) => a[0] - b[0]);
  const edge = table(samples);

  const frontHem = fy(draft.front.hemCentre.y);
  const backHem = by(draft.back.hemCentre.y);
  const hem = (a: number) => frontHem + ((backHem - frontHem) * a) / Math.PI;

  // Darts: each fold line, from its tip to its mouth, placed round the form by its distance from the centre.
  const fold = (pc: number, map: (y: number) => number, flip: boolean) =>
    draft.pieces[pc].lines
      .filter((ln) => ln.segs.length === 2 || ln.segs.length === 4)
      .map((ln) => {
        const q = ln.points();
        const [a, b]: P[] = ln.segs.length === 4 ? [q[0], q[2]] : [q[1], { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 }];
        return Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          const y = map(a.y + (b.y - a.y) * t);
          const x = a.x + (b.x - a.x) * t;
          const ang = Math.asin(Math.min(0.99, x / garment(y)));
          return [flip ? Math.PI - ang : ang, y] as [number, number];
        });
      });
  const darts = [...fold(0, fy, false), ...fold(1, by, true)];
  const zip: [number, number][] = [
    [Math.PI, by(draft.back.neckCentre.y)],
    [Math.PI, by(draft.back.zipEnd.y)],
  ];

  return { top: -NW - 9, base: WH + 7, body, garment, edge, hem, darts, zip };
}

function draw(g: CanvasRenderingContext2D, w: number, h: number, md: Model, theta: number, zoom: number, pan: number) {
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9c49b'; // champagne, matching --gild
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const stand = md.base + 34; // the stand's foot
  const top = md.top - 4;
  let widest = 0;
  for (let y = md.top; y <= md.base; y += 2) widest = Math.max(widest, md.garment(y) * 1.1, md.body(y) * 1.1);
  const S0 = Math.min((h * 0.94) / (stand - top), (w * 0.9) / (2 * widest));
  const S = S0 * zoom;
  const cx = w / 2;
  const focus = (md.top + md.hem(0)) / 2;
  const atRest = Math.max(h * 0.03, (h - (stand - top) * S0) / 2) + (focus - top) * S0;
  const cy = atRest + (h / 2 - atRest) * Math.min(1, zoom - 1) - focus * S + pan;
  const Y = (y: number) => cy + y * S;
  const lw = Math.max(0.6, S / 5);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const at = (a: number, phi: number, y: number): [number, number, number] => {
    const X = a * Math.sin(phi);
    const Z = a * BODY_DEPTH * Math.cos(phi);
    const Xr = X * cos + Z * sin;
    const Zr = -X * sin + Z * cos;
    return [cx + Xr * S, Y(y) + Zr * S * TILT, Zr];
  };
  const line = (pts: Pt[]) => {
    if (pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
    g.stroke();
  };
  const xy = (q: [number, number, number]): Pt => [q[0], q[1]];
  const eR = Math.atan2(cos, BODY_DEPTH * sin);
  const ext = (a: number) => a * Math.hypot(cos, BODY_DEPTH * sin);
  // Angle round the bodice, folded to 0..pi from the centre front, for the edge and hem tables.
  const fold = (phi: number) => Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
  const edgeAt = (phi: number) => md.edge(fold(phi));
  const hemAt = (phi: number) => md.hem(fold(phi));

  // The stand: a pole and a foot
  g.globalAlpha = 0.4;
  g.lineWidth = lw * 0.7;
  line([[cx, Y(md.base)], [cx, Y(stand)]]);
  line(Array.from({ length: 49 }, (_, i) => xy(at(14, (i / 48) * 2 * Math.PI, stand))));

  // The form: outline, contour lines, the neck top and the form's base
  const fy = Array.from({ length: 60 }, (_, i) => md.top + ((md.base - md.top) * i) / 59);
  g.globalAlpha = 0.6;
  g.lineWidth = lw * 0.8;
  for (const s of [-1, 1]) line(fy.map((y) => [cx + s * ext(md.body(y)) * S, Y(y)] as Pt));
  g.globalAlpha = 0.25;
  g.lineWidth = lw * 0.5;
  for (let j = 1; j < 12; j++) {
    const phi = eR - Math.PI + (j * Math.PI) / 12;
    line(fy.map((y) => xy(at(md.body(y), phi, y))));
  }
  g.globalAlpha = 0.5;
  g.lineWidth = lw * 0.6;
  for (const y of [md.top, md.base]) line(Array.from({ length: 49 }, (_, i) => xy(at(md.body(y), (i / 48) * 2 * Math.PI, y))));

  // The bodice: a black silhouette over the form, then contour lines, seams, darts and edges
  const ring = (y: (phi: number) => number, from: number, to: number, n = 96) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const phi = from + ((to - from) * i) / n;
      return at(md.garment(y(phi)), phi, y(phi));
    });
  const down = (phi: number, n = 40) => {
    const a = edgeAt(phi);
    const b = hemAt(phi);
    return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n).map((y) => at(md.garment(y), phi, y));
  };
  const topRing = ring(edgeAt, eR - Math.PI, eR);
  const hemRing = ring(hemAt, eR, eR - Math.PI);
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.beginPath();
  [...topRing, ...down(eR), ...hemRing, ...down(eR - Math.PI).reverse()].forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  g.closePath();
  g.fill();

  // Back edges, seen faintly over the shoulders and below a turned hem
  g.globalAlpha = 0.28;
  g.lineWidth = lw * 0.6;
  g.setLineDash([lw * 2, lw * 2.5]);
  line(ring(edgeAt, eR, eR + Math.PI).map(xy));
  g.setLineDash([]);

  const N = 24;
  for (let j = 0; j < N; j++) {
    const phi = (2 * Math.PI * (j + 0.5)) / N;
    const pts = down(phi, 30);
    const z = pts[15][2];
    if (z <= 0) continue;
    const c = Math.min(1, z / (md.garment((edgeAt(phi) + hemAt(phi)) / 2) * BODY_DEPTH || 1));
    g.globalAlpha = 0.16 + 0.36 * c;
    g.lineWidth = lw * (0.4 + 0.25 * c);
    line(pts.map(xy));
  }
  // Side seams bright, centre front and back dashed
  for (const phi of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) {
    const pts = down(phi, 30);
    if (pts[15][2] <= 0) continue;
    const centre = phi === 0 || phi === Math.PI;
    g.globalAlpha = centre ? 0.35 : 0.8;
    g.lineWidth = lw * 0.7;
    if (centre) g.setLineDash([lw * 3, lw * 3]);
    line(pts.map(xy));
    g.setLineDash([]);
  }
  // Darts on both halves, and the zip
  g.lineWidth = lw * 0.6;
  for (const d of md.darts) {
    for (const s of [1, -1]) {
      const pts = d.map(([a, y]) => at(md.garment(y), s * a, y));
      if (pts[4][2] <= 0) continue;
      g.globalAlpha = 0.6;
      line(pts.map(xy));
    }
  }
  const zip = md.zip.map(([a, y]) => at(md.garment(y), a, y));
  if (zip[0][2] > 0) {
    g.globalAlpha = 0.9;
    g.lineWidth = lw * 0.9;
    line(zip.map(xy));
    g.beginPath();
    g.arc(zip[1][0], zip[1][1], lw * 1.2, 0, 2 * Math.PI);
    g.stroke();
  }

  // Outline: sides, neckline and armholes, hem
  g.globalAlpha = 1;
  g.lineWidth = lw * 1.1;
  line(down(eR).map(xy));
  line(down(eR - Math.PI).map(xy));
  line(topRing.map(xy));
  line(hemRing.map(xy));
}

export function BodiceFigure({ draft, m, label }: { draft: BodiceDraft; m: BodiceMeasurements; label: string }) {
  const paint = useMemo((): Paint => {
    const model = buildModel(draft, m);
    return (g, w, h, theta, zoom, pan) => draw(g, w, h, model, theta, zoom, pan);
  }, [draft, m]);
  return <TurnCanvas paint={paint} label={label} />;
}
