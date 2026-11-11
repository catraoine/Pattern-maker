// The measuring tutorial on the 3D form (Cat, Nov 10: "3D form yes"): the same black satin form as All round, with an
// ivory tape laid on its surface exactly where each measurement is taken, played on and turned so it reads. Each
// clip is recorded from this scene, one per measurement. The form's shape is the body's own (engine/body.ts), so a
// tape round it follows the true cross-section, bridging hollows as a real tape does.
import * as THREE from 'three';
import { bodyHalf, bodyLandmarks, reach } from '../engine/body';
import { FORM_FLOOR, FORM_LEG, FORM_LEG_X } from './ContourForm';
import { cap, material, sweep } from './allRoundMesh';
import { GILD, GROUND, hex } from './palette';
import LIMBS from './measureLimbs.json';

type V3 = [number, number, number];
const TAU = Math.PI * 2;
const NECK_TOP = -1.75;
const LEG_TOP = 1.2;
const BODY_BOTTOM = 1.3;
/** Centimetres to a form unit (ContourForm.tsx CM_PER_UNIT). */
const CM = 22.5;
/** A real tape is about 1.6 cm wide. */
/** The tape lies just off the satin, so the surface never shows through it. */
const LIFT = 0.006;
const TAPE = '#e3d3ad';
const TAPE_INK = '#2b2418';
const TAPE_END = '#b8a274';

/** How much the form is drawn in at its sides at height y, set by fitBody: the form's rings hull over the shoulder
 *  caps and armpits (they are what the drafting reads), which with real arms hanging beside them reads as broad, square
 *  shoulders and a boxy upper body. 1 everywhere until a whole body is fitted. */
let sideIn: (y: number) => number = () => 1;
/** The form's radius at angle a and height y, as drawn. */
function formR(a: number, y: number) {
  const yy = Math.min(Math.max(y, NECK_TOP), BODY_BOTTOM);
  const s = Math.sin(a);
  return reach(bodyHalf(yy), a, yy) * (1 - (1 - sideIn(yy)) * s * s);
}
/** A point of the form's surface at angle a round it (0 straight ahead, toward the viewer) and height y. */
function bodyAt(a: number, y: number, out = 0): V3 {
  const r = formR(a, y) + out;
  return [Math.sin(a) * r, y, Math.cos(a) * r];
}
/** Which way is out from the surface there. */
function normalAt(a: number, y: number): V3 {
  const d = 0.004;
  const pa = bodyAt(a + d, y), ma = bodyAt(a - d, y), py = bodyAt(a, y + d), my = bodyAt(a, y - d);
  const A = sub(pa, ma), B = sub(py, my);
  let n = cross(B, A);
  const p = bodyAt(a, y);
  if (dot(n, [p[0], 0, p[2]]) < 0) n = scale(n, -1);
  return norm(n);
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => scale(a, 1 / (Math.hypot(...a) || 1));

/** A point the tape passes through, with the surface's outward normal there. */
export type TapePt = { p: V3; n: V3 };

/** A girth: level round the body at height y, starting and ending at the centre front with a little overlap, the
 *  far end lying over the zero end where it is read. */
export function girthPath(y: number, overlap = 3 / CM, past: (a: number) => number = () => 0): TapePt[] {
  const pts: TapePt[] = [];
  const N = 240;
  // Round from the centre front, across the wearer's right, behind and back to the front.
  const at = (a: number, out: number) => ({ p: bodyAt(a, y, LIFT + out + past(a)), n: normalAt(a, y) });
  for (let i = 0; i <= N; i++) pts.push(at((TAU * i) / N, 0));
  // On past the zero end, lying over it.
  const r = reach(bodyHalf(y), 0, y);
  for (let i = 1; i <= 12; i++) pts.push(at((overlap / r) * (i / 12), 0.004));
  return pts;
}

/** A length down the body at angle a from y0 to y1, as a tape held snug at both ends lies: on the body where it
 *  stands out, straight across any hollow between (the outer hull of the body's profile there). */
export function lengthPath(a: number, y0: number, y1: number): TapePt[] {
  const N = 160;
  const raw = Array.from({ length: N + 1 }, (_, i) => {
    const y = y0 + ((y1 - y0) * i) / N;
    return { y, r: formR(a, y) };
  });
  // The outer hull in (y, r): a point stays only where it is not under the straight line between its neighbours.
  const hull: typeof raw = [];
  for (const q of raw) {
    while (hull.length >= 2) {
      const [p0, p1] = [hull[hull.length - 2], hull[hull.length - 1]];
      const cr = (p1.y - p0.y) * (q.r - p0.r) - (p1.r - p0.r) * (q.y - p0.y);
      if ((y1 > y0 ? cr : -cr) < 0) break;
      hull.pop();
    }
    hull.push(q);
  }
  const rAt = (y: number) => {
    for (let i = 1; i < hull.length; i++) {
      const [h0, h1] = [hull[i - 1], hull[i]];
      if ((y - h0.y) * (y - h1.y) <= 0) return h0.r + ((h1.r - h0.r) * (y - h0.y)) / (h1.y - h0.y || 1);
    }
    return hull[hull.length - 1].r;
  };
  return raw.map(({ y }) => {
    const r = rAt(y) + LIFT;
    return { p: [Math.sin(a) * r, y, Math.cos(a) * r] as V3, n: normalAt(a, y) };
  });
}

/** The tape's face: ivory, a long mark each centimetre and a short one every 2 mm, all from its top edge; no numbers
 *  (Cat, 2026-10-28). One tile is 10 cm. */
function tapeTexture(maxAniso: number, dark = false, colours?: { face: string; ink: string }) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 128;
  const g = c.getContext('2d')!;
  // On a light finish the tape is dark with ivory marks, so it still stands out.
  g.fillStyle = colours?.face ?? (dark ? '#1d1a16' : TAPE);
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = colours?.ink ?? (dark ? TAPE : TAPE_INK);
  const perMm = c.width / 100;
  for (let mm = 0; mm < 100; mm += 2) {
    const long = mm % 10 === 0;
    const x = mm * perMm;
    g.fillRect(x - (long ? 2.5 : 1.5), 0, long ? 5 : 3, c.height * (long ? 0.5 : 0.28));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** The tape as a ribbon along the path, flat to the body: its width across the path, lying in the surface. Built
 *  segment by segment, so drawing the first k segments plays it on. */
function ribbon(path: TapePt[], width: number) {
  const n = path.length;
  const pos = new Float32Array(n * 2 * 3);
  const nor = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  let len = 0;
  const lens: number[] = [0];
  for (let i = 1; i < n; i++) lens.push((len += Math.hypot(...sub(path[i].p, path[i - 1].p))));
  for (let i = 0; i < n; i++) {
    const t = norm(sub(path[Math.min(n - 1, i + 1)].p, path[Math.max(0, i - 1)].p));
    const across = norm(cross(path[i].n, t));
    for (const [k, s] of [[0, -0.5], [1, 0.5]] as const) {
      const q = add(path[i].p, scale(across, s * width));
      pos.set(q, (i * 2 + k) * 3);
      nor.set(path[i].n, (i * 2 + k) * 3);
      uv.set([(lens[i] * CM) / 10, 1 - k], (i * 2 + k) * 2);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geo: g, lens, total: len };
}

/** The string tied round the waist, which the lengths start or end at (Cat's D, 2026-10-24). */
function waistString(y: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 200; i++) pts.push(new THREE.Vector3(...bodyAt((TAU * i) / 200, y, LIFT * 0.6)));
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, 300, 0.0045, 6, true);
}

export interface MeasureShot {
  /** The tape's path. */
  path: TapePt[];
  /** For a girth, its height: laid again over the body where it stands out past the ring. */
  girthY?: number;
  /** With the string round the waist. */
  string?: boolean;
}

/** The height of the fullest part of the seat. */
function seatLevel() {
  let at = 0.4;
  for (let y = 0.4; y <= BODY_BOTTOM; y += 0.005) if (reach(bodyHalf(y), Math.PI, y) > reach(bodyHalf(at), Math.PI, at)) at = y;
  return at;
}

/** The measurements on the 3D form, by id. */
export function shotFor(id: string): MeasureShot | undefined {
  const L = bodyLandmarks();
  switch (id) {
    case 'waist':
      return { path: girthPath(L.waist), girthY: L.waist };
    case 'full_hip':
      // Round the fullest part of the seat: where the body stands furthest out behind. (bodyLandmarks' widest level
      // below the waist is where the torso meets the legs, which is not where a tape goes.)
      return { path: girthPath(seatLevel()), girthY: seatLevel() };
    case 'full_bust':
      return { path: girthPath(L.full_bust), girthY: L.full_bust };
    case 'nape_to_waist':
      // From the bone where the neck meets the shoulders, down the centre back to the string at the waist.
      return { path: lengthPath(Math.PI, -1.47, L.waist), string: true };
    default:
      return undefined;
  }
}

/** One frame: how far the tape has played (0 to 1), the form's turn, and the camera's height, distance and aim. */
export interface MeasureFrame {
  play: number;
  turn: number;
  lookY: number;
  dist: number;
  /** How far above the aim the camera stands (form units). */
  rise?: number;
}

/** How the form is lifted off the black ground (mock-ups for Cat, Nov 10: "the black on black is hard to see"):
 *  A a fine champagne edge round the form, B a charcoal satin, C a soft pool of light behind it. */
export type Lift = 'none' | 'A' | 'B' | 'C' | 'D';

/** A fine edge round a surface: its back faces pushed out a touch and drawn flat in champagne, so only a thin line
 *  shows past the form's own edge. */
function edgeOf(geo: THREE.BufferGeometry, width: number) {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * width, pos.getY(i) + nor.getY(i) * width, pos.getZ(i) + nor.getZ(i) * width);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hex(GILD), side: THREE.BackSide, transparent: true, opacity: 0.85 }));
}

/** MakeHuman's own legs and arms (CC0, the same young female average the torso is read from), mapped onto the form's
 *  units by scripts/body-table/limbs.py: real limbs in place of the plain tube legs (Cat, Nov 10: "the legs look
 *  terrible"), and arms for the arm measurements. */
function limbMesh(part: { pos: number[]; idx: number[] }, mat: THREE.Material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((part.pos.length / 3) * 2).fill(0), 2));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(new Array(part.pos.length / 3).fill(0), 1));
  // Mapped onto the form (y turned to run down), the triangles wind the other way: turned back, so their fronts
  // face out and they are lit as the torso is.
  const idx = part.idx.slice();
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** The form's surface (mock-ups for Cat, Nov 10: "this black shiny body looks weird"): F1 matte black crepe, F2
 *  ivory plaster, F3 natural linen like a tailor's form, F4 champagne satin. 'satin' is All round's black satin. */
export type Finish = 'satin' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
function linenTexture(bold = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cdbfa5';
  g.fillRect(0, 0, 256, 256);
  // A fine plain weave: warp and weft threads, each a little lighter or darker than the last.
  for (let i = 0; i < 256; i += 2) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,240' : '90,75,55'},${(bold ? 0.12 : 0.05) + Math.random() * (bold ? 0.16 : 0.08)})`;
    g.fillRect(i, 0, 1, 256);
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,240' : '90,75,55'},${(bold ? 0.12 : 0.05) + Math.random() * (bold ? 0.16 : 0.08)})`;
    g.fillRect(0, i, 256, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function applyFinish(m: THREE.MeshStandardMaterial, finish: Finish) {
  switch (finish) {
    case 'F1':
      m.color.set(0x1a1816);
      m.emissive.set(0x000000);
      m.roughness = 0.92;
      m.metalness = 0;
      break;
    case 'F2':
      m.color.set(0xe6ddcd);
      m.emissive.set(0x000000);
      m.roughness = 0.88;
      m.metalness = 0;
      break;
    case 'F3':
      m.color.set(0xffffff);
      m.map = linenTexture();
      m.map.repeat.set(40, 40);
      m.emissive.set(0x000000);
      m.roughness = 1;
      m.metalness = 0;
      break;
    case 'F5':
      // Champagne linen (Cat, Nov 10): the linen's weave in the brand champagne, matte.
      // Kept pale and greyed: a warmer champagne read as bare skin.
      m.color.set(0xe9dcc2);
      m.map = linenTexture(true);
      m.map.repeat.set(24, 24);
      m.emissive.set(0x000000);
      m.roughness = 1;
      m.metalness = 0;
      break;
    case 'F4':
      m.color.set(0xcdb68a);
      m.emissive.set(0x000000);
      m.roughness = 0.38;
      m.metalness = 0.15;
      break;
  }
}

/** The whole form from MakeHuman's one body (torso, arms and legs in a single surface), each height of its torso
 *  drawn out or in, angle by angle round the body, to lie on the form's own ring there (the rings the tapes are laid
 *  on and the app drafts from); below the torso the legs ease back to their own shape by mid-thigh. The arms are
 *  carried out with the shoulders, by how much each point moves with an arm. */
export interface WholeBody { pos: number[]; idx: number[]; arm: number[] }
const SHOULDER_Y = -1.34;
function fitBody(body: WholeBody) {
  const { pos, arm } = body;
  const n = pos.length / 3;
  // How wide the real body is at the sides around height y (its torso and legs, not its arms), read over a band of
  // heights because the mesh's points are spread out down the body.
  const sideWidth = (y: number, band: number) => {
    let w = 0;
    for (let i = 0; i < n; i++) if (arm[i] <= 0.3 && Math.abs(pos[i * 3 + 1] - y) <= band) w = Math.max(w, Math.abs(pos[i * 3]));
    return w;
  };
  // From the shoulders down to the bust, draw the form's sides in to the real body's width (never by more than a
  // quarter), so the shoulders and upper body keep a woman's proportions beside the arms. Read on a grid and smoothed.
  const IN_TOP = -1.45, IN_BOT = -0.5, STEP = 0.05;
  const grid = Array.from({ length: Math.round((IN_BOT - IN_TOP) / STEP) + 1 }, (_, k) => {
    const y = IN_TOP + k * STEP;
    return Math.max(0.75, Math.min(1, sideWidth(y, 0.08) / reach(bodyHalf(y), Math.PI / 2, y)));
  });
  const smooth = grid.map((_, k) => (grid[Math.max(0, k - 1)] + 2 * grid[k] + grid[Math.min(grid.length - 1, k + 1)]) / 4);
  sideIn = (y: number) => {
    if (y <= IN_TOP || y >= IN_BOT) return 1;
    const t = (y - IN_TOP) / STEP, k = Math.floor(t), u = t - k;
    const v = smooth[k] * (1 - u) + smooth[Math.min(smooth.length - 1, k + 1)] * u;
    // Eased in from the neck and out into the bust, so the drawing-in leaves no step.
    const e = Math.min(1, (y - IN_TOP) / 0.12, (IN_BOT - y) / 0.15);
    return 1 - (1 - v) * e * e * (3 - 2 * e);
  };
  const ringSide = (y: number) => formR(Math.PI / 2, y);
  // How far the shoulder's side moved: both arms go out (or in) by as much.
  const shift = ringSide(SHOULDER_Y) - sideWidth(SHOULDER_Y, 0.06);
  const MID_THIGH = 1.95;
  // Above the hips each point lies on the form's own ring (a smooth dress-form surface, no anatomy); from the hips
  // down it hands over to the real legs, drawn out by the hip ring's own width at the sides and easing back to their
  // own shape by mid-thigh.
  const HAND_FROM = 0.97, HAND_TO = 1.18;
  // The legs are drawn out by what it takes, at the end of the hand-over, for their sides to meet the ring there.
  const sideFac = Math.max(1, ringSide(HAND_TO) / (sideWidth(HAND_TO, 0.1) || 1));
  const out = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    const y = Math.max(pos[i * 3 + 1], NECK_TOP);
    const a = Math.atan2(x, z);
    const ring = formR(a, y);
    const rr = Math.hypot(x, z) || 1;
    const u = Math.max(0, Math.min(1, (y - HAND_FROM) / (HAND_TO - HAND_FROM)));
    const toLeg = u * u * (3 - 2 * u);
    const v = Math.max(0, Math.min(1, (y - HAND_TO) / (MID_THIGH - HAND_TO)));
    const kLeg = 1 + (sideFac - 1) * (1 - v * v * (3 - 2 * v));
    const tx = (x / rr) * ring * (1 - toLeg) + x * kLeg * toLeg;
    const tz = (z / rr) * ring * (1 - toLeg) + z * kLeg * toLeg;
    const ax = x + shift * Math.sign(x || 1), az = z;
    const w = arm[i];
    out[i * 3] = tx * (1 - w) + ax * w;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = tz * (1 - w) + az * w;
  }
  return out;
}

export function createMeasureScene(canvas: HTMLCanvasElement, shot: MeasureShot, lift: Lift = 'none', limbs = true, finish: Finish = 'satin', limbData: typeof LIMBS = LIMBS, darkTape = false, shade?: string, tapeColours?: { face: string; ink: string }, tapeShadow = false, whole?: WholeBody, tapeCm = 1.6) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.9;
  renderer.setClearColor(hex(GROUND), 1);
  const scene = new THREE.Scene();
  // All round's studio (allRoundMesh.ts): y runs down, z toward the viewer.
  const key = new THREE.DirectionalLight(0xfff4e6, 2.8);
  key.position.set(-0.5, -0.42, 0.76);
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.6);
  fill.position.set(0.8, 0.3, 0.45);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(0.3, -0.3, -1);
  const sky = new THREE.HemisphereLight(0xe4ecff, 0x5a4a3a, 0.8);
  sky.position.set(0.35, -1, 0.3);
  // Brighter than All round, with a rim from each side behind: a clip is watched small, on a phone, and the form's
  // edge must read against the black for the tape's path round it to.
  const rim2 = new THREE.DirectionalLight(0xfff0dc, 1.6);
  rim2.position.set(-0.8, -0.2, -0.6);
  rim.intensity = 2.4;
  scene.add(key, fill, rim, rim2, sky);
  const turning = new THREE.Group();
  scene.add(turning);

  const satins: THREE.MeshStandardMaterial[] = [];
  const formMeshes: THREE.Mesh[] = [];
  const satin = material('satin');
  satins.push(satin);
  formMeshes.push(new THREE.Mesh(sweep({ at: (a, t) => bodyAt(a, NECK_TOP + (BODY_BOTTOM - NECK_TOP) * t), out: (a) => [Math.sin(a), 0, Math.cos(a)] }, -Math.PI, Math.PI, 160, 200), satin));
  if (whole) formMeshes[0].visible = false;
  turning.add(formMeshes[0]);
  if (whole) {
    const m = material('satin');
    satins.push(m);
    const g = new THREE.BufferGeometry();
    const fitted = fitBody(whole);
    g.setAttribute('position', new THREE.BufferAttribute(fitted, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((fitted.length / 3) * 2).fill(0), 2));
    g.setAttribute('shade', new THREE.Float32BufferAttribute(new Array(fitted.length / 3).fill(0), 1));
    const idx = whole.idx.slice();
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    formMeshes.push(mesh);
    turning.add(mesh);
    // A girth lies on whichever stands further out at each angle: the ring, or the body itself.
    const gy = shot.girthY;
    if (gy !== undefined) {
      // Cut the body's triangles at several heights across the tape's width, and keep, per angle, how far the
      // body stands out past the ring at that height. Cutting triangles (not just reading corners) catches a
      // bulge that falls between corners, which otherwise pokes through the tape's edge.
      const NB = 360;
      const out = new Float32Array(NB);
      const half = tapeCm / CM / 2 + 0.012;
      const levels = Array.from({ length: 9 }, (_, k) => gy - half + (2 * half * k) / 8);
      const idx = whole.idx;
      const P = (i: number): V3 => [fitted[i * 3], fitted[i * 3 + 1], fitted[i * 3 + 2]];
      for (let t = 0; t < idx.length; t += 3) {
        const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
        if (whole.arm[i0] > 0.3 || whole.arm[i1] > 0.3 || whole.arm[i2] > 0.3) continue;
        const tri = [P(i0), P(i1), P(i2)];
        const lo = Math.min(tri[0][1], tri[1][1], tri[2][1]), hi = Math.max(tri[0][1], tri[1][1], tri[2][1]);
        if (hi < levels[0] || lo > levels[8]) continue;
        for (const l of levels) {
          if (l < lo || l > hi) continue;
          for (let e = 0; e < 3; e++) {
            const A = tri[e], B = tri[(e + 1) % 3];
            if ((A[1] - l) * (B[1] - l) > 0 || A[1] === B[1]) continue;
            const u = (l - A[1]) / (B[1] - A[1]);
            const x = A[0] + (B[0] - A[0]) * u, z = A[2] + (B[2] - A[2]) * u;
            const a = Math.atan2(x, z);
            const b = ((Math.round((a / TAU) * NB) % NB) + NB) % NB;
            out[b] = Math.max(out[b], Math.hypot(x, z) - formR(a, l));
          }
        }
      }
      // Smooth it, so the tape runs in an even line rather than stepping over each triangle.
      const spread = Array.from({ length: NB }, (_, b) => { let r = 0; for (let d = -5; d <= 5; d++) r = Math.max(r, out[(b + d + NB) % NB]); return r; });
      const even = spread.map((_, b) => { let s = 0; for (let d = -4; d <= 4; d++) s += spread[(b + d + NB) % NB]; return s / 9; });
      const past = (a: number) => {
        const f = ((((a / TAU) * NB) % NB) + NB) % NB, b = Math.floor(f), u = f - b;
        return Math.max(0, even[b] * (1 - u) + even[(b + 1) % NB] * u) + 0.003;
      };
      shot = { ...shot, path: girthPath(gy, undefined, past) };
    }
  }
  const neck = material('satin');
  neck.color.set(0x0e0c0a);
  turning.add(new THREE.Mesh(cap((a) => bodyAt(a, NECK_TOP), [0, -1, 0]), neck));
  for (const leg of limbs || whole ? [] : [-1, 1]) {
    const T = (a: number, t: number): V3 => {
      const y = LEG_TOP + (FORM_FLOOR - LEG_TOP) * t;
      const r = FORM_LEG(y);
      return [leg * FORM_LEG_X + Math.sin(a) * r, y, Math.cos(a) * r];
    };
    const m = material('satin');
    satins.push(m);
    const legMesh = new THREE.Mesh(sweep({ at: T, out: (a) => [Math.sin(a), 0, Math.cos(a)] }, -Math.PI, Math.PI, 64, 80), m);
    formMeshes.push(legMesh);
    turning.add(legMesh);
  }
  if (limbs && !whole) {
    for (const part of [limbData.legs, limbData.arms]) {
      const m = material('satin');
      satins.push(m);
      const mesh = limbMesh(part, m);
      formMeshes.push(mesh);
      turning.add(mesh);
    }
  }
  // A matte crepe in any shade (Cat, Nov 10: "the matte black was better. Can we try more shades of charcoal").
  if (shade) {
    applyFinish(satin, 'F1');
    for (const m of [...satins, neck]) {
      applyFinish(m, 'F1');
      m.color.set(shade);
    }
  }
  if (finish !== 'satin' && !shade) {
    for (const m of [...satins, neck]) applyFinish(m, finish);
    // The linen's weave laid on by position (the surfaces carry no cloth coordinates of their own).
    if (finish === 'F3' || finish === 'F5') {
      for (const mesh of formMeshes) {
        const pos = mesh.geometry.getAttribute('position');
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.6;
          uv[i * 2 + 1] = pos.getY(i) * 0.6;
        }
        mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
    }
  }
  // The floor: a faint champagne ring where the form stands.
  const floor = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.635, 128), new THREE.MeshBasicMaterial({ color: hex(GILD), transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  floor.rotation.x = Math.PI / 2;
  floor.position.y = FORM_FLOOR;
  scene.add(floor);

  if (lift === 'A') for (const m of formMeshes) turning.add(edgeOf(m.geometry, 0.012));
  if (lift === 'B') for (const m of satins) {
    m.color.set(0x4a4540);
    m.emissive.set(0x121110);
    m.roughness = 0.32;
  }
  // D: a light chalk ground (the fresh-look chalk, #e9e4da) behind the black form.
  if (lift === 'D') {
    scene.background = new THREE.Color('#e9e4da').convertSRGBToLinear();
    floor.material.color.set(0x8a7f6c);
  }
  if (lift === 'C') {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(256, 230, 10, 256, 256, 300);
    r.addColorStop(0, '#3a3128');
    r.addColorStop(0.55, '#1a1612');
    r.addColorStop(1, '#000000');
    g.fillStyle = r;
    g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }

  if (shot.string) {
    const m = new THREE.MeshStandardMaterial({ color: hex(GILD), roughness: 0.6 });
    turning.add(new THREE.Mesh(waistString(bodyLandmarks().waist), m));
  }

  const tex = tapeTexture(renderer.capabilities.getMaxAnisotropy(), darkTape, tapeColours);
  const tapeMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const rib = ribbon(shot.path, tapeCm / CM);
  const tapeMesh = new THREE.Mesh(rib.geo, tapeMat);
  turning.add(tapeMesh);
  // A soft shadow just past the tape's edges, so it reads as a band lying on the body rather than a gap in it
  // (Cat, Nov 10: "the ivory tape looks like a gap in the torso").
  const shadowRib = ribbon(shot.path, (tapeCm / CM) * 1.35);
  const shadowMesh = new THREE.Mesh(shadowRib.geo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  shadowMesh.visible = tapeShadow;
  if (tapeShadow) turning.add(shadowMesh);
  // The flush metal end (Cat's E2, 2026-10-27) at the tape's zero.
  const endMat = new THREE.MeshStandardMaterial({ color: hex(TAPE_END), metalness: 0.7, roughness: 0.35 });
  const end = new THREE.Mesh(new THREE.BoxGeometry((tapeCm / CM) * 1.04, 0.9 / CM, 0.003), endMat);
  turning.add(end);
  const place = (m: THREE.Mesh, i: number, dir: 1 | -1) => {
    const p = shot.path;
    const j = Math.max(0, Math.min(p.length - 1, i));
    const t = norm(sub(p[Math.min(p.length - 1, j + 1)].p, p[Math.max(0, j - 1)].p));
    const n = p[j].n;
    const across = norm(cross(n, t));
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(...across), new THREE.Vector3(...scale(t, dir)), new THREE.Vector3(...n));
    m.quaternion.setFromRotationMatrix(basis);
    m.position.set(...add(p[j].p, add(scale(n, 0.002), scale(t, (dir * -0.45) / CM))));
  };

  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  camera.up.set(0, -1, 0);

  const render = (f: MeasureFrame, w: number, h: number) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.set(0, f.lookY - (f.rise ?? 0.25), f.dist);
    camera.lookAt(0, f.lookY, 0);
    turning.rotation.y = f.turn;
    // Played on from its zero end, the metal end held at the start: the first k segments.
    const n = shot.path.length - 1;
    const k = Math.round(n * Math.max(0, Math.min(1, f.play)));
    rib.geo.setDrawRange(0, k * 6);
    shadowRib.geo.setDrawRange(0, k * 6);
    tapeMesh.visible = k > 0;
    end.visible = k > 0;
    place(end, 0, 1);
    renderer.render(scene, camera);
  };
  return { render, total: rib.total * CM };
}
