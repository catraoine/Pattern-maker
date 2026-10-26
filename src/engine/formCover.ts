// Body Double (Cat's picks B1, B2 and B5, 2026-10-18): a padded cover that turns a store-bought dress form
// into the person's own shape. The cover is cut from the app's 3D body (body3d.ts), so it has exactly the
// shape the welcome and measuring screens show. The store form is chosen a little smaller than the person
// everywhere, padded out to their girths, and the cover goes on over the padding.
import type { MeasurementId, MeasurementValues } from '../measurements';
import type { SewingGuide } from './instructions';
import { buildBody, section, SEGMENTS, type Body, type BodyMark, type BodyRing } from './body3d';
import { Path, p, type P } from './geometry';
import type { Piece } from './piece';

type V3 = [number, number, number];

/** Where the seams sit round the half body, as points of the cross-section loop (24 is centre front, 72 centre back). */
const SEAMS = [24, 13, 0, -11, -24];
const PANELS = ['Centre front', 'Side front', 'Side back', 'Centre back'];
/** Rings the pieces are drawn through; every third ring of the body is smooth enough and keeps the files small. */
const STEP = 3;

const COVER_SEAM = 1;
const COVER_HEM = 2.5;

const loop = (k: number) => ((k % SEGMENTS) + SEGMENTS) % SEGMENTS;
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function ringPoints(r: BodyRing): V3[] {
  return section(r).map(([x, z]): V3 => [x, r.h, z]);
}

/** Length round the loop from point a to point b, going the way the seams are numbered (down). */
function arc(pts: V3[], a: number, b: number) {
  let sum = 0;
  for (let k = a; k > b; k--) sum += dist(pts[loop(k)], pts[loop(k - 1)]);
  return sum;
}

interface CoverRow {
  /** How far down the piece each seam has come, from the neck, along the seam itself on the form. */
  yFront: number;
  yBack: number;
  /** Out from the grain line to the seam towards centre front, and towards centre back. */
  toFront: number;
  toBack: number;
}

/** One piece's widths, ring by ring, and how long each of its seams runs on the form. */
interface CoverPanel {
  name: string;
  rows: CoverRow[];
  /** The seam lines on the 3D form, front edge and back edge, for checking the flat piece against. */
  seam3d: { front: number; back: number };
  /** Rows where the bust, waist and hip fall, for the notches and the waist line. */
  marks: { id: BodyMark['id']; row: number }[];
}

/** The cover's rings: from the base of the neck down to the bottom of the form. */
function coverRings(body: Body): { rings: BodyRing[]; marks: { id: BodyMark['id']; row: number }[] } {
  const neckH = body.marks.find((m) => m.id === 'neck')!.h;
  const all = body.rings.filter((r) => r.h <= neckH + 1e-6);
  const keep = new Set<number>();
  all.forEach((_, i) => (i % STEP === 0 || i === all.length - 1) && keep.add(i));
  // The landmark rings are kept exactly, so the girths on the cover are the measured ones.
  for (const m of body.marks) {
    const i = all.findIndex((r) => Math.abs(r.h - m.h) < 1e-6);
    if (i >= 0) keep.add(i);
  }
  const rings = [...keep].sort((a, b) => a - b).map((i) => all[i]);
  const marks = body.marks
    .filter((m) => m.id === 'full_bust' || m.id === 'waist' || m.id === 'full_hip')
    .map((m) => ({ id: m.id, row: rings.findIndex((r) => Math.abs(r.h - m.h) < 1e-6) }))
    .filter((m) => m.row >= 0);
  return { rings, marks };
}

/**
 * Unroll the half body into four strips, each about its own grain line. Every ring keeps its width round the
 * form, and each seam edge steps down by exactly as much as the seam does on the form, so two edges that sew
 * together are the same length and the cover keeps the form's shape.
 */
export function coverPanels(body: Body): CoverPanel[] {
  const { rings, marks } = coverRings(body);
  const loops = rings.map(ringPoints);
  return PANELS.map((name, i) => {
    const a = SEAMS[i], b = SEAMS[i + 1], mid = Math.round((a + b) / 2);
    const rows: CoverRow[] = [];
    const seam3d = { front: 0, back: 0 };
    loops.forEach((pts, r) => {
      const toFront = arc(pts, a, mid), toBack = arc(pts, mid, b);
      if (r === 0) return rows.push({ yFront: 0, yBack: 0, toFront, toBack });
      const prev = loops[r - 1], last = rows[r - 1];
      const segF = dist(prev[loop(a)], pts[loop(a)]), segB = dist(prev[loop(b)], pts[loop(b)]);
      seam3d.front += segF;
      seam3d.back += segB;
      const down = (seg: number, dx: number) => Math.sqrt(Math.max(seg * seg - dx * dx, 0));
      rows.push({ yFront: last.yFront + down(segF, toFront - last.toFront), yBack: last.yBack + down(segB, toBack - last.toBack), toFront, toBack });
    });
    return { name, rows, seam3d, marks };
  });
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The flat edge of a piece, for checking it against the seam it sews to on the form. */
export function edgeLength(rows: CoverRow[], side: 'toFront' | 'toBack') {
  const y = side === 'toFront' ? 'yFront' : 'yBack';
  let sum = 0;
  for (let i = 1; i < rows.length; i++) sum += Math.hypot(rows[i][y] - rows[i - 1][y], rows[i][side] - rows[i - 1][side]);
  return sum;
}

/** The cover pattern: four pieces, each cut as a pair, the front edge on the left. */
export function coverPieces(values: MeasurementValues): Piece[] {
  const body = buildBody(values);
  return coverPanels(body).map((panel, i): Piece => {
    const { rows } = panel;
    const last = rows[rows.length - 1];
    const left = rows.map((r): P => p(-r.toFront, r.yFront));
    const right = rows.map((r): P => p(r.toBack, r.yBack)).reverse();
    const outline = new Path(left[0]);
    left.slice(1).forEach((q) => outline.line(q, 'seam'));
    outline.line(right[0], 'hem');
    right.slice(1).forEach((q) => outline.line(q, 'seam'));
    outline.line(left[0], 'neck');
    outline.closed = true;
    const isBack = i === PANELS.length - 1;
    const notches: [P, P][] = [];
    for (const m of panel.marks) {
      const r = rows[m.row];
      // One notch at the bust, two at the waist, one at the hip, so pieces can't be sewn upside down.
      const twice = m.id === 'waist' ? [-0.5, 0.5] : [0];
      for (const d of twice) {
        if (i > 0) notches.push([p(-r.toFront, r.yFront + d), p(-1, 0)]);
        if (!isBack) notches.push([p(r.toBack, r.yBack + d), p(1, 0)]);
      }
    }
    const waist = panel.marks.find((m) => m.id === 'waist');
    const w = waist ? rows[waist.row] : undefined;
    const mid = rows[Math.round(rows.length * 0.42)];
    const midY = (mid.yFront + mid.yBack) / 2;
    const lastY = Math.min(last.yFront, last.yBack);
    const cut = 'Cut 2 (a pair)';
    return {
      name: `Form cover ${panel.name.toLowerCase()}`,
      outline,
      lines: [],
      grain: [p(0, 6), p(0, lastY - 6)],
      balance: w ? [{ pts: [p(-w.toFront, w.yFront), p(w.toBack, w.yBack)], label: 'WAIST' }] : [],
      notches,
      labels: [
        { at: p(0, midY - 4), text: panel.name.toUpperCase(), size: 0.9, rotate: 90 },
        { at: p(0, midY + 10), text: cut, size: 0.6, rotate: 90 },
      ],
      cut,
      seamAllowance: COVER_SEAM,
      allowances: { seam: COVER_SEAM, neck: COVER_SEAM, hem: COVER_HEM },
      meta: { cover: true, seam3d: { front: r1(panel.seam3d.front), back: r1(panel.seam3d.back) } },
    };
  });
}

/** What the form is built from. Anything else is filled in from a typical body, which the cover can live with. */
const COVER_NEEDS: MeasurementId[] = ['full_bust', 'waist', 'full_hip', 'waist_to_hip', 'nape_to_waist', 'shoulder_width'];

/** Measurements still to take before the cover can be drafted to this person rather than a typical body. */
export function coverMissing(values: MeasurementValues): MeasurementId[] {
  const missing = COVER_NEEDS.filter((id) => typeof values[id] !== 'number');
  if (typeof values.waist_to_floor !== 'number' && typeof values.waist_to_knee !== 'number') missing.push('waist_to_knee');
  return missing;
}

/** How to pad the form, sew the cover and put it on. */
export function coverGuide(map: PadMap, fabricM?: string): SewingGuide {
  const padded = map.pads.filter((pd) => pd.layers > 0);
  const padText = padded.length
    ? padded.map((pd) => `${pd.label}: ${pd.layers === 1 ? 'one layer' : `${pd.layers} layers`}, about ${pd.thick} cm.`).join(' ')
    : 'The form already measures what you do, so it needs no padding.';
  return {
    notions: [
      map.size ? `A store dress form, size ${map.size} (or any form no bigger than you at bust, waist and hip)` : 'A store dress form no bigger than you at bust, waist and hip',
      `Cover fabric: firm woven canvas, calico or linen${fabricM ? `, ${fabricM}` : ''}`,
      'Thin (2 oz) polyester wadding, about 1 m',
      'An open-ended 50 cm zip, or safety pins',
      '1.5 m of narrow cord or tape for the hem channel',
      'Tape measure and a fine marker',
    ],
    steps: [
      {
        title: 'Pad the form',
        text: `Wrap thin wadding round the form where it is smaller than you, layer by layer, and catch each layer with a few hand stitches or a wrap of stretch film. ${padText} Feather each band off above and below so there are no steps.`,
      },
      {
        title: 'Cut the cover',
        text: 'Cut each of the four pieces twice, as a pair, with the grain line straight along the fabric. Snip the notches: one at the bust, two at the waist, one at the hip.',
      },
      {
        title: 'Sew the side panels',
        text: 'Sew centre front to side front, side front to side back, and side back to centre back on each side, 1 cm seams, matching the notches and the waist line. Press the seams open and clip the curves.',
      },
      {
        title: 'Join the halves',
        text: 'Sew the two centre fronts together. Sew the centre backs together from the hem up to the hip notch, and put the zip in above it, or leave it open to pin closed.',
      },
      {
        title: 'Neck and hem',
        text: 'Turn the neck edge under 1 cm and stitch. Turn the hem up 2.5 cm to make a channel and thread the cord through it.',
      },
      {
        title: 'Put it on and check it',
        text: 'Pull the cover over the padded form, close the back and draw up the hem cord. The seams should run straight down the form. Then measure bust, waist and hip and check them in the app.',
      },
    ],
  };
}

// ——— B2 Pad Map ———

/** A typical store dress form chart, in cm. Forms vary by maker, so the screen asks people to check the label. */
export const FORM_SIZES: { size: string; full_bust: number; waist: number; full_hip: number }[] = [
  { size: '4', full_bust: 84, waist: 64, full_hip: 90 },
  { size: '6', full_bust: 86.5, waist: 66.5, full_hip: 92.5 },
  { size: '8', full_bust: 89, waist: 69, full_hip: 95 },
  { size: '10', full_bust: 91.5, waist: 71.5, full_hip: 97.5 },
  { size: '12', full_bust: 95, waist: 75, full_hip: 101 },
  { size: '14', full_bust: 99, waist: 79, full_hip: 105 },
  { size: '16', full_bust: 103, waist: 83, full_hip: 109 },
  { size: '18', full_bust: 108, waist: 89, full_hip: 114 },
  { size: '20', full_bust: 113, waist: 94, full_hip: 119 },
  { size: '22', full_bust: 118, waist: 99, full_hip: 124 },
];

export type PadId = 'full_bust' | 'waist' | 'full_hip';
/** One layer of thin (2 oz) polyester wadding, pressed on a form, in cm. */
const LAYER = 0.3;

interface Pad {
  id: PadId;
  label: string;
  /** The person's girth, and the store form's. */
  you: number;
  form: number;
  /** Padding to add all round, in cm thick. */
  thick: number;
  layers: number;
  /** Height above the floor, for drawing on the form. */
  h: number;
}

interface PadMap {
  /** The form size to buy, or undefined when even the smallest is bigger than the person somewhere. */
  size?: string;
  pads: Pad[];
}

const LABELS: Record<PadId, string> = { full_bust: 'Bust', waist: 'Waist', full_hip: 'Hip' };

/** Wadding wrapped round a girth adds 2π for every cm of thickness. */
const thickFor = (extra: number) => Math.max(0, extra) / (2 * Math.PI);
const layersFor = (thick: number) => Math.round(thick / LAYER);

/**
 * The largest store form that is no bigger than the person at bust, waist and hip, and the padding that
 * takes it out to their own girths. Padding can only add, so the form must fit inside them everywhere.
 */
export function padMap(values: MeasurementValues): PadMap {
  const body = buildBody(values);
  const girth = (id: PadId) => body.marks.find((m) => m.id === id)!;
  const ids: PadId[] = ['full_bust', 'waist', 'full_hip'];
  const fits = FORM_SIZES.filter((f) => ids.every((id) => f[id] <= girth(id).girth + 0.25));
  const form = fits[fits.length - 1];
  const pads = ids.map((id): Pad => {
    const m = girth(id);
    const formG = form ? form[id] : m.girth;
    const thick = thickFor(m.girth - formG);
    return { id, label: LABELS[id], you: r1(m.girth), form: formG, thick: r1(thick), layers: layersFor(thick), h: m.h };
  });
  return { size: form?.size, pads };
}

// ——— B5 Form Check ———

interface CheckRow {
  id: PadId;
  label: string;
  target: number;
  measured: number;
  /** Positive: the padded form is too small there. */
  short: number;
  /** What to do, or undefined when it is right. */
  fix?: string;
}

/** Within this, the padded form measures right: about one layer of wadding. */
export const CHECK_TOLERANCE = 0.6;

/**
 * The padded form, measured with the cover on, against the person. Each girth that is off says how many
 * layers of wadding to add or take out, and how deep a band, so nothing needs working out.
 */
export function formCheck(values: MeasurementValues, measured: Partial<Record<PadId, number>>): CheckRow[] {
  const body = buildBody(values);
  const out: CheckRow[] = [];
  for (const id of ['full_bust', 'waist', 'full_hip'] as PadId[]) {
    const got = measured[id];
    if (got === undefined || !Number.isFinite(got) || got <= 0) continue;
    const target = r1(body.marks.find((m) => m.id === id)!.girth);
    const short = r1(target - got);
    let fix: string | undefined;
    if (Math.abs(short) > CHECK_TOLERANCE) {
      const layers = Math.max(1, layersFor(thickFor(Math.abs(short))));
      const band = id === 'waist' ? 6 : 10;
      fix =
        short > 0
          ? `Add ${layers === 1 ? 'one layer' : `${layers} layers`} of wadding round the ${LABELS[id].toLowerCase()}, a band about ${band} cm deep.`
          : `Take out ${layers === 1 ? 'one layer' : `${layers} layers`} of wadding round the ${LABELS[id].toLowerCase()}.`;
    }
    out.push({ id, label: LABELS[id], target, measured: got, short, fix });
  }
  return out;
}
