// A 3D body built from a person's measurements: the app's real body (engine/body.ts, read off MakeHuman's base
// body) ring by ring, each ring stretched so the neck, high bust, bust, waist, high hip and hip measure exactly what
// the person measured, at the heights they measured them. It is exported as an OBJ that CLO 3D and Browzwear load
// as an avatar, and it is the body the All round view and the Body Double cover are built on.
import { EXAMPLE_VALUES, type MeasurementId, type MeasurementValues } from '../measurements';
import { BODY_BOTTOM, BODY_TOP, bodyHalf as R, bodyLandmarks as formLandmarks, shapeAt } from './body';

/** Points round each cross-section. Girths are measured round this same loop, so they are exact. */
export const SEGMENTS = 96;
/** Rings from the top of the neck to below the hip, before the landmark rings are added. */
const RINGS = 150;

/** One cross-section of the body. Heights and sizes are in cm; y is the form's own profile unit. */
export interface BodyRing {
  y: number;
  /** Height above the floor. */
  h: number;
  /** Half the width, side to side. */
  half: number;
  /** How far the front and back reach from the centre line. */
  front: number;
  back: number;
}

/** A measured girth and where it sits on the form. */
export interface BodyMark {
  id: 'neck' | 'high_bust' | 'full_bust' | 'waist' | 'high_hip' | 'full_hip';
  label: string;
  h: number;
  girth: number;
  /** Not measured, so filled in from a typical body. */
  estimated: boolean;
}

export interface Body {
  rings: BodyRing[];
  marks: BodyMark[];
  /** Shoulder tip to shoulder tip, straight across, in cm. */
  shoulders: number;
}

/** The loop round one cross-section, as [x, z] in cm: x to the side, z forward. The real body's own ring at that
 *  height, as wide as `half`, its front and back drawn out (or in) to `front` and `back`. */
export function section(r: Pick<BodyRing, 'y' | 'half' | 'front' | 'back'>, segments = SEGMENTS): [number, number][] {
  const out: [number, number][] = [];
  const f0 = shapeAt(0, r.y) * r.half;
  const b0 = shapeAt(Math.PI, r.y) * r.half;
  for (let i = 0; i < segments; i++) {
    const th = (2 * Math.PI * i) / segments;
    // th runs from the right side (x) round the front (z): the angle from straight ahead is its complement.
    const a = Math.atan2(Math.cos(th), Math.sin(th));
    const reach = r.half * shapeAt(a, r.y);
    const z = reach * Math.cos(a);
    out.push([reach * Math.sin(a), z * (z >= 0 ? r.front / f0 : r.back / b0)]);
  }
  return out;
}

/** The tape measurement round a cross-section. */
export function girth(r: Pick<BodyRing, 'y' | 'half' | 'front' | 'back'>, segments = SEGMENTS) {
  const pts = section(r, segments);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
    sum += Math.hypot(x1 - x0, z1 - z0);
  }
  return sum;
}

interface Knot {
  y: number;
  /** cm of half-width per unit of the form's profile. */
  scale: number;
  /** Front and back reach, as a share of the body's own there (1 = as the body is). */
  front: number;
  back: number;
}

/** A smooth curve through the knots that never overshoots them (monotone cubic), held flat past the ends. */
function monotone(xs: number[], ys: number[]) {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = xs.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    if (d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = xs[i + 1] - xs[i] + 2 * (xs[i] - xs[i - 1]);
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < x) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Each value goes smoothly from knot to knot. */
function between(knots: Knot[]) {
  const ys = knots.map((k) => k.y);
  const scale = monotone(ys, knots.map((k) => k.scale));
  const front = monotone(ys, knots.map((k) => k.front));
  const back = monotone(ys, knots.map((k) => k.back));
  return (y: number) => ({ scale: scale(y), front: front(y), back: back(y) });
}

/** A straight line through the height knots, carried on past the ends. */
function heights(knots: [number, number][]) {
  return (y: number) => {
    let i = 0;
    while (i < knots.length - 2 && knots[i + 1][0] < y) i++;
    const [y0, h0] = knots[i], [y1, h1] = knots[i + 1];
    return h0 + ((y - y0) * (h1 - h0)) / (y1 - y0);
  };
}

/** The form built for these measurements (in cm). Anything missing comes from the app's example body. */
export function buildBody(values: MeasurementValues): Body {
  const has = (id: MeasurementId) => typeof values[id] === 'number' && Number.isFinite(values[id]);
  const m = (id: MeasurementId, fallback?: number) => (has(id) ? (values[id] as number) : fallback ?? (EXAMPLE_VALUES[id] as number));
  const bust = m('full_bust');
  const highBust = m('high_bust', bust - 6);
  const waist = m('waist');
  const hip = m('full_hip');
  const waistToHip = m('waist_to_hip');
  const napeToWaist = m('nape_to_waist');
  const waistH = m('waist_to_floor', has('waist_to_knee') ? m('waist_to_knee') / 0.56 : undefined);
  const hipH = waistH - waistToHip;
  // Front length runs over the bust, so what is left after the bust depth is roughly the bust's height above the waist.
  const bustAbove = Math.min(napeToWaist - 8, Math.max(8, (m('front_hps_to_waist') - m('bust_depth')) * 0.95));
  const napeH = waistH + napeToWaist * 0.98;
  const shoulders = m('shoulder_width') * 0.94;

  const lm = formLandmarks();
  const Y = { neck: -1.6, nape: -1.45, shoulder: -1.34, highBust: -0.95, bust: lm.full_bust, waist: lm.waist, hip: lm.full_hip };
  const height = heights([
    [Y.nape, napeH],
    [Y.bust, waistH + bustAbove],
    [Y.waist, waistH],
    [Y.hip, hipH],
  ]);
  // High hip is taken about 10 cm below the waist; find where that falls on the form.
  const highHipY = Y.waist + ((Y.hip - Y.waist) * Math.min(10, waistToHip * 0.6)) / waistToHip;

  // A fuller bust than high bust brings the front forward of the body's own; otherwise each ring keeps its real shape.
  const bustFront = 1 + Math.max(-0.1, Math.min(0.3, (bust - highBust - 6) * 0.025));
  const girths: { id: BodyMark['id']; label: string; y: number; girth: number; front: number; back: number; estimated: boolean }[] = [
    { id: 'neck', label: 'Neck', y: Y.neck, girth: m('neck'), front: 1, back: 1, estimated: !has('neck') },
    { id: 'high_bust', label: 'High bust', y: Y.highBust, girth: highBust, front: 1, back: 1, estimated: !has('high_bust') },
    { id: 'full_bust', label: 'Bust', y: Y.bust, girth: bust, front: bustFront, back: 1, estimated: !has('full_bust') },
    { id: 'waist', label: 'Waist', y: Y.waist, girth: waist, front: 1, back: 1, estimated: !has('waist') },
    ...(has('high_hip')
      ? [{ id: 'high_hip' as const, label: 'High hip', y: highHipY, girth: m('high_hip'), front: 1, back: 1, estimated: false }]
      : []),
    { id: 'full_hip', label: 'Hip', y: Y.hip, girth: hip, front: 1, back: 1, estimated: !has('full_hip') },
  ];
  const unitGirth = (y: number, front: number, back: number) => girth({ y, half: 1, front: shapeAt(0, y) * front, back: shapeAt(Math.PI, y) * back });
  const knots: Knot[] = girths.map((g) => ({ y: g.y, scale: g.girth / unitGirth(g.y, g.front, g.back) / R(g.y), front: g.front, back: g.back }));
  // The shoulders are set by their width across, at the shoulder tip.
  knots.push({ y: Y.shoulder, scale: shoulders / 2 / R(Y.shoulder), front: 1, back: 1 });
  knots.sort((a, b) => a.y - b.y);

  const ys = Array.from({ length: RINGS + 1 }, (_, i) => BODY_TOP + ((BODY_BOTTOM - BODY_TOP) * i) / RINGS);
  for (const g of girths) {
    const near = ys.findIndex((y) => Math.abs(y - g.y) < (BODY_BOTTOM - BODY_TOP) / RINGS / 2);
    if (near >= 0) ys[near] = g.y;
    else ys.push(g.y);
  }
  ys.sort((a, b) => a - b);

  const at = between(knots);
  const rings = ys.map((y): BodyRing => {
    const k = at(y);
    const half = R(y) * k.scale;
    return { y, h: height(y), half, front: half * shapeAt(0, y) * k.front, back: half * shapeAt(Math.PI, y) * k.back };
  });
  const marks = girths.map((g): BodyMark => ({ id: g.id, label: g.label, h: height(g.y), girth: g.girth, estimated: g.estimated }));
  return { rings, marks, shoulders };
}

interface BodyMesh {
  /** x, y (up), z (forward) for each vertex, in cm, with the floor at y = 0. */
  vertices: [number, number, number][];
  normals: [number, number, number][];
  /** Triangles, counter-clockwise seen from outside. */
  faces: [number, number, number][];
}

/** The form as a closed surface: the rings joined into a tube, capped at the neck and the bottom. */
export function bodyMesh(body: Body, segments = SEGMENTS): BodyMesh {
  const vertices: [number, number, number][] = [];
  const faces: [number, number, number][] = [];
  for (const r of body.rings) for (const [x, z] of section(r, segments)) vertices.push([x, r.h, z]);
  const at = (ring: number, i: number) => ring * segments + (i % segments);
  // Ring 0 is the top of the neck; each next ring is lower. Going round, x turns towards z (anticlockwise from above).
  for (let r = 0; r + 1 < body.rings.length; r++)
    for (let i = 0; i < segments; i++) {
      faces.push([at(r, i), at(r, i + 1), at(r + 1, i + 1)]);
      faces.push([at(r, i), at(r + 1, i + 1), at(r + 1, i)]);
    }
  const top = vertices.push([0, body.rings[0].h, 0]) - 1;
  const last = body.rings.length - 1;
  const bottom = vertices.push([0, body.rings[last].h, 0]) - 1;
  for (let i = 0; i < segments; i++) {
    faces.push([top, at(0, i + 1), at(0, i)]);
    faces.push([bottom, at(last, i), at(last, i + 1)]);
  }

  const normals = vertices.map((): [number, number, number] => [0, 0, 0]);
  for (const [a, b, c] of faces) {
    const [ax, ay, az] = vertices[a], [bx, by, bz] = vertices[b], [cx, cy, cz] = vertices[c];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const n: [number, number, number] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const k of [a, b, c]) for (let d = 0; d < 3; d++) normals[k][d] += n[d];
  }
  for (const n of normals) {
    const l = Math.hypot(...n) || 1;
    for (let d = 0; d < 3; d++) n[d] /= l;
  }
  return { vertices, normals, faces };
}

const mm = (cm: number) => (Math.round(cm * 100) / 10).toFixed(1);

/** The form as a Wavefront OBJ in millimetres, Y up, facing +Z, standing at its real height above the floor. */
export function toObj(values: MeasurementValues, name: string): string {
  const body = buildBody(values);
  const mesh = bodyMesh(body);
  const lines = [
    `# ${name}: dress form from your measurements, made by Maison Tracé`,
    '# Units: millimetres. Y is up, the form faces +Z, and the floor is at Y = 0.',
    '# Girths built into the form (cm):',
    ...body.marks.map((k) => `#   ${k.label}: ${k.girth.toFixed(1)} at ${k.h.toFixed(1)} above the floor${k.estimated ? ' (estimated, not measured)' : ''}`),
    `#   Shoulders: ${body.shoulders.toFixed(1)} straight across`,
    `o ${name.replace(/\s+/g, '_')}`,
    ...mesh.vertices.map(([x, y, z]) => `v ${mm(x)} ${mm(y)} ${mm(z)}`),
    ...mesh.normals.map(([x, y, z]) => `vn ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`),
    's 1',
    ...mesh.faces.map((f) => 'f ' + f.map((i) => `${i + 1}//${i + 1}`).join(' ')),
  ];
  return lines.join('\n') + '\n';
}
