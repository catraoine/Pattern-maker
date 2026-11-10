// All round drawn by the phone's graphics chip (Cat, 2026-10-28: option B): the body, the garment's cloth, its sleeves
// and trouser legs are real surfaces, lit and depth-sorted by the chip, so nothing is painted by hand in the wrong
// order, the far side of an edge never shows through the cloth, and the turn is smooth. The shape is the same one the
// canvas painter drew (allRoundShape.ts), the light the same as the style drawing's (allRoundCloth.ts lightOf) and the
// form the same black satin (ContourForm.tsx satinColour), so the two painters agree where they overlap. Drawn into a
// canvas of its own, over a clear backdrop; AllRound.tsx lays it on its own canvas and draws the marks over it.
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { RoundGarment, RoundPt } from '../engine/allRound';
import { bodyHalf, reach as bodyReach } from '../engine/body';
import { FORM_DEPTH, FORM_FLOOR, FORM_LEG, FORM_LEG_X } from './ContourForm';
import type { DrapedLite } from '../engine/drape/run';
import type { ClothTiles } from './allRoundCloth';
import { RoundShape, WAIST } from './allRoundShape';
import { hex, GILD as GILD_HEX, GLOW as GLOW_HEX, GROUND as GROUND_HEX, SHADOW as SHADOW_HEX } from './palette';

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Where a dress form's neck ends (ContourForm.tsx NECK_TOP). */
const NECK_TOP = -1.75;
/** The form's legs start a little above where its torso's rings end, so the two overlap. */
const LEG_TOP = 1.2;

type V3 = [number, number, number];

// Matching --gild, --gild-glow in styles.css.
const GILD = hex(GILD_HEX);
const GLOW = hex(GLOW_HEX);
const SHADOW = hex(SHADOW_HEX);

/** How a surface is drawn: in its cloth (matte, with a gloss or a pile), as the black satin form, or plain black. */
type Mode = 'matte' | 'gloss' | 'pile' | 'satin' | 'black';

// Lit as in a studio (the look pass, 2026-10-28): the chip's own physically based shading, with a soft room of light
// all round (so satin reflects and cloth has a sheen), a key high on the left, a fill low on the right and a rim from
// behind that lifts the figure's edges off the black. Each surface also carries, from its own geometry, how far it
// lies in its own shadow (the valley of a fold, the cloth under an arm) and may be cut off above or below a height.
interface RoundUniforms {
  hideAbove: { value: number };
  hideBelow: { value: number };
  shadeY: { value: number };
  shadeDepth: { value: number };
}
type RoundMaterial = THREE.MeshStandardMaterial & { uniforms: RoundUniforms };

/** Each cloth's own finish in the light (Cat's A Clean cloth, 2026-11-05): how rough it is, the soft glow a pile or a
 * brushed cloth gives where it turns away (sheen), and the thin coat on leather. */
const FINISH: Record<string, { rough: number; sheen?: number; sheenRough?: number; coat?: number }> = {
  satin: { rough: 0.5 },
  silk: { rough: 0.55 },
  viscose: { rough: 0.6 },
  modal: { rough: 0.65 },
  polyester: { rough: 0.62 },
  velvet: { rough: 1, sheen: 0.7, sheenRough: 0.5 },
  corduroy: { rough: 0.95, sheen: 0.6, sheenRough: 0.5 },
  wool: { rough: 0.97, sheen: 0.45, sheenRough: 0.75 },
  terry: { rough: 1, sheen: 0.45, sheenRough: 0.8 },
  denim: { rough: 0.92 },
  linen: { rough: 0.96 },
  cotton: { rough: 0.9 },
  leather: { rough: 0.55, coat: 0.35 },
};

/** The material for a garment's cloth: its swatch, its opacity, and the finish its kind of cloth has. */
/** A lace's tile is already a net, so it is laid nearly solid; a plain sheer fades to 0.6. */
function opacityOf(cloth: ClothTiles): number {
  return cloth.lace ? 0.95 : cloth.sheer ? 0.6 : 1;
}

function clothFinish(mode: Mode, cloth: ClothTiles, map: THREE.Texture, scale: number): RoundMaterial {
  const f = cloth.kind ? FINISH[cloth.kind] : undefined;
  const mat = material(mode, map, scale, opacityOf(cloth), !!(f?.sheen || f?.coat));
  if (!f) return mat;
  mat.roughness = f.rough;
  const pm = mat as unknown as THREE.MeshPhysicalMaterial;
  if (f.sheen) {
    const [r, g, b] = cloth.avg ?? [0.6, 0.6, 0.6];
    const up = (v: number) => Math.min(1, v * 1.3 + 0.06);
    pm.sheen = f.sheen;
    pm.sheenRoughness = f.sheenRough ?? 0.5;
    pm.sheenColor = new THREE.Color(up(r), up(g), up(b)).convertSRGBToLinear();
  }
  if (f.coat) {
    pm.clearcoat = f.coat;
    pm.clearcoatRoughness = 0.35;
  }
  return mat;
}

/** The fit map's colours (Cat's D, 2026-11-07): CLO's heat scale, by the room the garment leaves the body in cm round
 *  (fitMap.ts): red where it is tight (it would have to stretch), yellow snug, green easy, blue loose. Cloth the map
 *  doesn't read (a collar) is a quiet grey. */
const FIT_STOPS: [number, number][] = [[-3, 0xc81e32], [0, 0xe0452c], [1.5, 0xf2c23a], [4, 0x49a85a], [12, 0x5aa9d6], [30, 0x2f5bbf]];
function fitColour(v: number): [number, number, number] {
  if (!Number.isFinite(v)) return [0.75, 0.75, 0.75];
  let k = 0;
  while (k < FIT_STOPS.length - 2 && v > FIT_STOPS[k + 1][0]) k++;
  const [v0, c0] = FIT_STOPS[k];
  const [v1, c1] = FIT_STOPS[k + 1];
  const t = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
  const a = new THREE.Color(c0);
  const b = new THREE.Color(c1);
  return [a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t];
}

function material(mode: Mode, map?: THREE.Texture, scale = 1, opacity = 1, physical = false): RoundMaterial {
  const mat = new (physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }) as RoundMaterial;
  if (map) {
    map.repeat.set(scale, scale);
    mat.map = map;
  }
  switch (mode) {
    case 'matte':
      mat.roughness = 0.85;
      break;
    case 'gloss':
      mat.roughness = 0.3;
      break;
    case 'pile':
      // A velvet: no shine at all, its depth left to the folds.
      mat.roughness = 1;
      break;
    case 'satin':
      // The black satin form (ContourForm.tsx satinColour): deep, with a soft sheen rather than a mirror.
      mat.color.set(0x0b0a08);
      mat.emissive.set(SHADOW); // its deepest shade is the page's shadow
      mat.roughness = 0.26;
      mat.metalness = 0.05;
      break;
    case 'black':
      // The page's ground, lit by nothing, so bare cloth sinks into it whatever the lamps do.
      mat.color.set(0x000000);
      mat.emissive.set(hex(GROUND_HEX));
      mat.roughness = 1;
      mat.envMapIntensity = 0;
      break;
  }
  mat.uniforms = { hideAbove: { value: -1e9 }, hideBelow: { value: 1e9 }, shadeY: { value: 0 }, shadeDepth: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shade;\nvarying float vShade;\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;\nvY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float hideAbove;\nuniform float hideBelow;\nuniform float shadeY;\nuniform float shadeDepth;\nvarying float vShade;\nvarying float vY;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  if (vY < hideAbove || vY > hideBelow) discard;
  float own = 1.0 - clamp(vShade, 0.0, 1.0);
  if (shadeDepth > 0.0 && vY >= shadeY) own *= 0.42 + 0.58 * clamp((vY - shadeY) / shadeDepth, 0.0, 1.0);
  diffuseColor.rgb *= own;
  diffuseColor.rgb += (1.0 - diffuseColor.rgb) * 0.22 * clamp(-vShade, 0.0, 1.0);`,
      )
      // The far side of the cloth, seen from inside through a neck or an armhole, lies in shadow.
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.45;');
  };
  mat.customProgramCacheKey = () => `round-${mode}${physical ? '-physical' : ''}`;
  return mat;
}

/** A surface swept round: `at(a, t)` its point at angle a and fraction t down it, `out` which way is outside. */
interface Sweep {
  at: (a: number, t: number) => V3;
  uv?: (a: number, t: number) => [number, number];
  out: (a: number, t: number) => V3;
  /** Fraction down the surface for row j of NT: rows closer together at the top where the cloth turns over a shoulder. */
  rowT?: (j: number, NT: number) => number;
  /** How deep in shadow a point lies of its own accord (0 to 1): the valley of a fold, the cloth under an arm. */
  shade?: (a: number, t: number) => number;
}

/** The surface as a mesh: its points, their normals (from the surface's own slope) and the cloth's cm under them. */
function sweep(s: Sweep, a0: number, a1: number, NA: number, NT: number): THREE.BufferGeometry {
  const rowT = s.rowT ?? ((j, n) => j / n);
  const pos = new Float32Array((NA + 1) * (NT + 1) * 3);
  const nor = new Float32Array((NA + 1) * (NT + 1) * 3);
  const uv = new Float32Array((NA + 1) * (NT + 1) * 2);
  const shade = new Float32Array((NA + 1) * (NT + 1));
  const da = (a1 - a0) / NA / 2;
  let p = 0;
  let q = 0;
  for (let j = 0; j <= NT; j++) {
    const t = rowT(j, NT);
    const dt = Math.min(0.5 / NT, t, 1 - t) || 0.5 / NT;
    for (let i = 0; i <= NA; i++) {
      const a = a0 + ((a1 - a0) * i) / NA;
      const [x, y, z] = s.at(a, t);
      pos[p] = x;
      pos[p + 1] = y;
      pos[p + 2] = z;
      const pa = s.at(a + da, t);
      const ma = s.at(a - da, t);
      const pt = s.at(a, Math.min(1, t + dt));
      const mt = s.at(a, Math.max(0, t - dt));
      const ax = pa[0] - ma[0];
      const ay = pa[1] - ma[1];
      const az = pa[2] - ma[2];
      const tx = pt[0] - mt[0];
      const ty = pt[1] - mt[1];
      const tz = pt[2] - mt[2];
      let nx = ay * tz - az * ty;
      let ny = az * tx - ax * tz;
      let nz = ax * ty - ay * tx;
      const o = s.out(a, t);
      if (nx * o[0] + ny * o[1] + nz * o[2] < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[p] = nx / l;
      nor[p + 1] = ny / l;
      nor[p + 2] = nz / l;
      const [u, v] = s.uv ? s.uv(a, t) : [0, 0];
      uv[q] = u;
      uv[q + 1] = v;
      if (s.shade) shade[q / 2] = s.shade(a, t);
      p += 3;
      q += 2;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NT; j++) {
    for (let i = 0; i < NA; i++) {
      const k = j * (NA + 1) + i;
      idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  g.setIndex(idx);
  return g;
}

/** A flat face closing a surface (the top of the form's neck): the ring at `at(a)`, facing `normal`. */
function cap(at: (a: number) => V3, normal: V3, n = 72): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const centre = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = at(-Math.PI + (TAU * i) / n);
    centre[0] += x / n;
    centre[1] += y / n;
    centre[2] += z / n;
  }
  pos.push(...centre);
  nor.push(...normal);
  for (let i = 0; i <= n; i++) {
    pos.push(...at(-Math.PI + (TAU * i) / n));
    nor.push(...normal);
  }
  const idx: number[] = [];
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((n + 2) * 2).fill(0), 2));
  g.setIndex(idx);
  return g;
}

/** A line's style: its colour, width (times the view's line width), how much of it shows where it faces away (`back`),
 *  its strength, and whether it fades out as it turns toward the edge (`graze`, a groove in the cloth). */
interface Style {
  colour: number;
  width: number;
  back?: number;
  alpha?: number;
  graze?: number;
  /** Always on top: the garment's outline, drawn over everything as the canvas painter drew it. */
  onTop?: boolean;
}

/** The last stencil mark a line took (Lines.build). */
let stencilMark = 0;

/** A run of points along a surface, each with the surface's normal there (for how brightly it faces you). */
type Run = { p: V3; n: V3 }[];

/** Lines of one style, gathered into one drawing: a bright pass where they face you and are in view, and (with `back`)
 *  a faint one through everything for the far side, as the canvas painter faded them. */
class Lines {
  private readonly pts: number[] = [];
  private readonly nrm: number[] = [];
  readonly objects: LineSegments2[] = [];
  constructor(
    readonly style: Style,
    private readonly group: THREE.Group,
  ) {}
  add(run: Run) {
    for (let i = 1; i < run.length; i++) {
      this.pts.push(...run[i - 1].p, ...run[i].p);
      this.nrm.push(...run[i - 1].n, ...run[i].n);
    }
  }
  /** A line read from a function of a parameter, in `n` steps. */
  curve(n: number, at: (i: number) => { p: V3; n: V3 } | undefined) {
    let run: Run = [];
    for (let i = 0; i <= n; i++) {
      const q = at(i);
      if (!q) {
        if (run.length > 1) this.add(run);
        run = [];
      } else run.push(q);
    }
    if (run.length > 1) this.add(run);
  }
  /** Fresh points for lines already built (the outline, laid afresh each frame). */
  reset() {
    this.pts.length = 0;
    this.nrm.length = 0;
  }
  update() {
    for (const o of this.objects) {
      const geo = o.geometry as LineSegmentsGeometry;
      if (this.pts.length) {
        geo.setPositions(this.pts);
        geo.setColors(this.nrm);
      }
      o.visible = this.pts.length > 0;
    }
  }
  build(lw: number, res: THREE.Vector2) {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(this.pts.length ? this.pts : [0, 0, 0, 0, 0, 0]);
    geo.setColors(this.nrm.length ? this.nrm : [0, 0, 1, 0, 0, 1]);
    const { colour, width, back = 0, alpha = 1, graze = 0, onTop = false } = this.style;
    const make = (faint: boolean) => {
      const m = new LineMaterial({ color: colour, linewidth: width * lw, resolution: res, vertexColors: true, transparent: true, opacity: faint ? back : alpha, depthTest: !faint && !onTop, depthWrite: false });
      // Each pixel once per line: a faint line's segments overlap at their round ends, and drawn twice there it read as
      // a string of beads (Cat's Q2, 2026-10-31). The stencil is cleared each frame; each line takes its own mark.
      stencilMark = (stencilMark % 255) + 1;
      m.stencilWrite = true;
      m.stencilRef = stencilMark;
      m.stencilFunc = THREE.NotEqualStencilFunc;
      m.stencilZPass = THREE.ReplaceStencilOp;
      m.onBeforeCompile = (sh) => {
        // The 'colour' of each point is the surface's normal there: how far it faces you sets how bright the line is,
        // as the canvas painter faded a line toward the edge, and a groove fades out before the edge (graze).
        sh.vertexShader = sh.vertexShader.replace(
          'vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;',
          `vec3 nn = normalize( normalMatrix * ( ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd ) );
           float f = nn.z;
           float b = f > 0.0 ? ( 0.55 + 0.45 * min( 1.0, f ) ) * clamp( ( f - ${graze.toFixed(3)} ) * 4.0, 0.0, 1.0 ) : ${faint ? '1.0' : '0.0'};
           vColor = vec4( 1.0, 1.0, 1.0, b );`,
        );
        sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', 'gl_FragColor = vec4( diffuseColor.rgb, alpha * vColor.a );');
      };
      // Each style compiles its own program: the fade and the pass are written into the shader.
      m.customProgramCacheKey = () => `round-line-${graze}-${faint}`;
      const o = new LineSegments2(geo, m);
      o.visible = this.pts.length > 0;
      o.renderOrder = faint ? 3 : onTop ? 4 : 2;
      this.group.add(o);
      this.objects.push(o);
    };
    make(false);
    if (back > 0) make(true);
  }
}

/** The garment draped from its own pattern pieces (src/engine/drape), placed on the form: `toForm` takes a point in
 *  the drape's cm (x across, c down from the waist, z forward) to the form's units, at the level's own scale or, for a
 *  point hanging clear of the body, the scale it carries (DrapedLite.hang). */
export interface DrapedView {
  d: DrapedLite;
  toForm: (x: number, c: number, z: number, scale?: number) => V3;
}

/** What the mesh is built for. */
export interface BuildOptions {
  round: RoundGarment;
  sh: RoundShape;
  cloth?: ClothTiles;
  film: boolean;
  striped: boolean;
  /** The garment sewn from its pattern; 'pending' while it is still settling (the form stands alone meanwhile). */
  draped?: DrapedView | 'pending';
  /** The form drawn out at the shoulders to the wearer's width, as the cloth's body is (Space.widen, in form units). */
  formX?: (x: number, y: number, z: number) => number;
  /** The fit map: the sewn garment coloured by the room it leaves the body (fitMap.ts) instead of its cloth. */
  fit?: boolean;
}

/** What one frame is drawn with: the turn, the canvas (CSS px and device pixel ratio) and the view's own scale,
 *  centre, top (the form height at the top of the canvas) and line width, as AllRound.tsx lays it out. */
export interface Frame {
  phi: number;
  w: number;
  h: number;
  dpr: number;
  S: number;
  cx: number;
  top: number;
  lw: number;
  /** For the all-round check: lit flat and even, so what is cloth reads as cloth whatever the lamps would do. */
  probe?: boolean;
}

/** What a point of the view stands on: the garment's cloth, a sleeve, a leg (the form's own, or a trouser leg),
 *  the form's body, or the air beside it. `e` is the side of a sleeve or a leg (-1 or 1). */
export type PickPart = 'cloth' | 'sleeve' | 'leg' | 'body' | 'air';
export interface Pick {
  part: PickPart;
  e: number;
  /** The point in the form's own units, turned back to face the front. */
  p: V3;
}

export interface RoundView {
  build(o: BuildOptions): void;
  /** Draw the frame; the canvas returned is clear where there is nothing, to lay over the backdrop. */
  render(f: Frame): HTMLCanvasElement;
  /** What stands under the point (px, py) of the canvas, in CSS px, for the draw tool. In the air past everything,
   *  the point on the plane through the form's axis facing the view. */
  pick(f: Frame, px: number, py: number): Pick | undefined;
  /** Where a point of the form (its own units, facing front) is drawn on the canvas, in CSS px, and how far it faces
   *  the viewer (1 straight on, below 0 turned away): for the fit map's labels. */
  project(f: Frame, p: V3): { x: number; y: number; facing: number };
  dispose(): void;
}

/** The view's own projection, as the canvas painter laid it: x across by the scale, y down by the scale and a
 *  little by the depth (seen from a touch above), nothing shrinking with distance. */
function projection({ w, h, S, cx, top }: Frame) {
  return { A: (2 * S) / w, B: (2 * cx) / w - 1, C: (-2 * S) / h, D: (-2 * S * FORM_DEPTH) / h, E: 1 - (16 - 2 * top * S) / h };
}

/** The garment sewn from its pattern pieces: each panel as cut, the wearer's left as settled and its mirror, the print
 *  laid on each piece at its true size in cm, its seams and edges as fine lines, and its buttons. */
/**
 * Cloth drawn with its thickness (Cat, Nov 7: collars and folds read paper-thin). Under the drawn face, a second face a
 * cloth's thickness in, and round every free edge a rim turning from one to the other, its light rounding over, so an
 * edge or a fold reads as cloth with a body rather than a sheet of paper. `t` is in the scene's units.
 */
const knobs = () => (globalThis as unknown as { __drapeKnobs?: Record<string, number> }).__drapeKnobs ?? {};
function thickened(g: THREE.BufferGeometry, idx: number[], t: number, sewn: (i: number) => boolean, withBack = true): THREE.BufferGeometry[] {
  const pos = g.getAttribute('position').array as Float32Array;
  const nrm = g.getAttribute('normal').array as Float32Array;
  const uv = g.getAttribute('uv').array as Float32Array;
  const shade = g.getAttribute('shade').array as Float32Array;
  const col = g.getAttribute('color')?.array as Float32Array | undefined;
  const n = pos.length / 3;
  const out: THREE.BufferGeometry[] = [];
  // The face beneath: each point a thickness in along its normal, wound the other way so it faces in.
  const bp = new Float32Array(n * 3);
  const bn = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    // (The drawn normals point in toward the body, the scene's y running down: in is along them.)
    bp[i] = pos[i] + nrm[i] * t;
    bn[i] = -nrm[i];
  }
  const bi: number[] = [];
  for (let k = 0; k < idx.length; k += 3) bi.push(idx[k], idx[k + 2], idx[k + 1]);
  const back = new THREE.BufferGeometry();
  back.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  back.setAttribute('normal', new THREE.BufferAttribute(bn, 3));
  back.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  back.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  if (col) back.setAttribute('color', new THREE.BufferAttribute(col, 3));
  back.setIndex(bi);
  if (withBack && !knobs().__noBack) out.push(back);
  // The free edges: those of one triangle only.
  const seen = new Map<number, number>();
  const edges: [number, number, number][] = [];
  for (let k = 0; k < idx.length; k += 3) {
    for (let j = 0; j < 3; j++) {
      const a = idx[k + j], b = idx[k + ((j + 1) % 3)];
      const key = Math.min(a, b) * n + Math.max(a, b);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      edges.push([a, b, idx[k + ((j + 2) % 3)]]);
    }
  }
  // (Not along a seam, where the edge is sewn to the next piece and the cloth runs on: only an edge left free, a hem,
  // an opening, a lapel's or a collar's.)
  const free = edges.filter(([a, b]) => seen.get(Math.min(a, b) * n + Math.max(a, b)) === 1 && !(sewn(a) && sewn(b)));
  if (!free.length) return out;
  // Which way is off the cloth at each edge point, in its own plane: across the edge, away from its triangle.
  const offOf = new Map<number, [number, number, number]>();
  for (const [a, b, c] of free) {
    const ex = pos[b * 3] - pos[a * 3], ey = pos[b * 3 + 1] - pos[a * 3 + 1], ez = pos[b * 3 + 2] - pos[a * 3 + 2];
    const nx = (nrm[a * 3] + nrm[b * 3]) / 2, ny = (nrm[a * 3 + 1] + nrm[b * 3 + 1]) / 2, nz = (nrm[a * 3 + 2] + nrm[b * 3 + 2]) / 2;
    let ox = ey * nz - ez * ny, oy = ez * nx - ex * nz, oz = ex * ny - ey * nx;
    const mx = (pos[a * 3] + pos[b * 3]) / 2 - pos[c * 3], my = (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2 - pos[c * 3 + 1], mz = (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2 - pos[c * 3 + 2];
    if (ox * mx + oy * my + oz * mz < 0) [ox, oy, oz] = [-ox, -oy, -oz];
    const l = Math.hypot(ox, oy, oz) || 1;
    for (const v of [a, b]) {
      const o = offOf.get(v) ?? [0, 0, 0];
      offOf.set(v, [o[0] + ox / l, o[1] + oy / l, o[2] + oz / l]);
    }
  }
  // The rim: rows turning half round from the drawn face to the one beneath, bulging out by half the thickness.
  const R = 4;
  const ids = [...offOf.keys()];
  const at = new Map(ids.map((v, k) => [v, k]));
  const rp = new Float32Array(ids.length * (R + 1) * 3);
  const rn = new Float32Array(ids.length * (R + 1) * 3);
  const ru = new Float32Array(ids.length * (R + 1) * 2);
  const rs = new Float32Array(ids.length * (R + 1));
  const rc = col ? new Float32Array(ids.length * (R + 1) * 3) : undefined;
  ids.forEach((v, k) => {
    const o0 = offOf.get(v)!;
    const nv: [number, number, number] = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    // (Kept square to the normal, so the rim turns round the edge, not along the cloth.)
    const dn = o0[0] * nv[0] + o0[1] * nv[1] + o0[2] * nv[2];
    const o = [o0[0] - nv[0] * dn, o0[1] - nv[1] * dn, o0[2] - nv[2] * dn];
    const ol = Math.hypot(o[0], o[1], o[2]) || 1;
    for (let j = 0; j <= R; j++) {
      const th = (Math.PI * j) / R;
      const r = k * (R + 1) + j;
      for (let q = 0; q < 3; q++) {
        rp[r * 3 + q] = pos[v * 3 + q] + nv[q] * (t / 2) * (1 - Math.cos(th)) + (o[q] / ol) * (t / 2) * Math.sin(th);
        rn[r * 3 + q] = nv[q] * Math.cos(th) - (o[q] / ol) * Math.sin(th);
        if (rc) rc[r * 3 + q] = col![v * 3 + q];
      }
      ru[r * 2] = uv[v * 2];
      ru[r * 2 + 1] = uv[v * 2 + 1];
      rs[r] = shade[v];
    }
  });
  const ri: number[] = [];
  for (const [a, b] of free) {
    const A = at.get(a)! * (R + 1), B = at.get(b)! * (R + 1);
    for (let j = 0; j < R; j++) {
      const q = [A + j, B + j, B + j + 1, A + j + 1];
      // Wound to face the way its normals do.
      const P = (r: number) => [rp[r * 3], rp[r * 3 + 1], rp[r * 3 + 2]];
      const [p0, p1, p2] = [P(q[0]), P(q[1]), P(q[2])];
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const m = q[0] * 3;
      const agree = f[0] * rn[m] + f[1] * rn[m + 1] + f[2] * rn[m + 2] + f[0] * rn[q[2] * 3] + f[1] * rn[q[2] * 3 + 1] + f[2] * rn[q[2] * 3 + 2];
      if (agree >= 0) ri.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      else ri.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rim.setAttribute('normal', new THREE.BufferAttribute(rn, 3));
  rim.setAttribute('uv', new THREE.BufferAttribute(ru, 2));
  rim.setAttribute('shade', new THREE.BufferAttribute(rs, 1));
  if (rc) rim.setAttribute('color', new THREE.BufferAttribute(rc, 3));
  rim.setIndex(ri);
  out.push(rim);
  return out;
}

function buildDraped(
  { d, toForm }: DrapedView,
  cloth: ClothTiles | undefined,
  add: (geo: THREE.BufferGeometry, mat: RoundMaterial, order?: number, part?: PickPart, e?: number) => THREE.Mesh,
  lines: (style: Style) => Lines,
  maxAniso: number,
  disposables: { dispose: () => void }[],
  fit = false,
) {
  let tex: THREE.Texture | undefined;
  if (cloth) {
    tex = new THREE.CanvasTexture(cloth.body);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    disposables.push(tex);
  }
  const mode: Mode = cloth?.sheen === 'gloss' ? 'gloss' : cloth?.sheen === 'pile' ? 'pile' : 'matte';
  const contrast = d.contrastCollar === 'black' ? 0x161616 : d.contrastCollar === 'ivory' ? 0xefe8d6 : d.contrastCollar ? 0x3a3530 : undefined;
  // Drawn half a cm further out than it settled: the drawn form is not quite the body the cloth settled on, and over the
  // collarbones and shoulder blades it would poke through a cloth lying close.
  const LIFT = 0.5;
  // (The mirrored half is drawn from its own points where they differ: a slit up the left side seam parts on the left only.)
  // (A sleeve a little further out still: round the back of the armhole its cap settles close against the body, and
  // the drawn form showed through it as a dark hole beside the bust, the film's snakeskin dress, Nov 8.)
  const SLEEVE_LIFT = ((globalThis as unknown as { __drapeKnobs?: Record<string, number> }).__drapeKnobs ?? {}).__slvLift ?? 0.8;
  const inSleeve = new Uint8Array(d.pos.length / 3);
  for (const p of d.panels) if (p.role === 'sleeve') for (let i = 0; i < p.uv.length / 2; i++) inSleeve[p.base + i] = 1;
  // (A tailored collar's fall a cm further out still: laid close on the sim's body, it went in under the drawn form's
  // fuller neck and shoulders, so from the side only its stand showed, a wall with a ragged top, Cat Nov 8.)
  const FALL_LIFT = knobs().__fallLift ?? 1;
  if (FALL_LIFT) for (const p of d.panels) if (p.role === 'collar' && !p.hidden) for (let i = 0; i < p.uv.length / 2; i++) if (p.turned?.[i]) inSleeve[p.base + i] = 3;
  const P = (i: number, e: number, more = 0): V3 => {
    const pos = e < 0 && d.posMirror ? d.posMirror : d.pos;
    const x = pos[i * 3];
    const z = pos[i * 3 + 2];
    const k = 1 + (LIFT + more + (inSleeve[i] === 1 ? SLEEVE_LIFT : inSleeve[i] === 3 ? FALL_LIFT : 0)) / (Math.sqrt(x * x + z * z) || 1);
    return toForm(x * k * e, pos[i * 3 + 1], z * k, d.hang?.[i] || undefined);
  };
  // (A piece cut whole, a one-shoulder's front, holds both its halves: drawn once, not mirrored.)
  const wholeAt = (i: number) => d.panels.some((p) => p.whole && i >= p.base && i < p.base + p.uv.length / 2);
  // The points on a seam: an edge point of a piece with another piece's edge point (or its own mirrored half's, on the
  // centre line) within a few mm, as the cloth settled.
  // (Only an edge the eye sees, one of the garment's own edges as its lines name them: not a dart's legs, a facing's
  // inner edge under the front or a pocket's, which a rim would raise as a ridge.)
  const hasCollar = d.panels.some((p) => p.collar && !p.hidden);
  const EDGE = new Set(['hem', 'opening', 'lapel', 'collar', 'opening-hem', ...(hasCollar ? [] : ['neck'])]);
  const onEdge = new Set<number>();
  for (const l of d.lines) if (EDGE.has(l.kind)) for (const i of l.ids) onEdge.add(i);
  const onSeam = new Set<number>();
  {
    const edgeOf = (p: (typeof d.panels)[number]) => {
      const cnt = new Map<string, number>();
      for (const [a, b, c] of p.tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        cnt.set(k, (cnt.get(k) ?? 0) + 1);
      }
      const out = new Set<number>();
      for (const [k, c] of cnt) if (c === 1) for (const v of k.split(',')) out.add(p.base + Number(v));
      return out;
    };
    const pts: { i: number; panel: number; m: number }[] = [];
    const grid = new Map<string, number[]>();
    const cell = (x: number, y: number, z: number) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    d.panels.forEach((p, pi) => {
      if (p.hidden) return;
      for (const i of edgeOf(p)) for (const m of p.single || p.whole ? [1] : [1, -1]) {
        const k = pts.length;
        pts.push({ i, panel: pi, m });
        const c = cell(d.pos[i * 3] * m, d.pos[i * 3 + 1], d.pos[i * 3 + 2]);
        grid.set(c, [...(grid.get(c) ?? []), k]);
      }
    });
    const near = new Map<number, Set<number>>();
    for (const p of d.panels) for (const t of p.tris) for (const a of t) for (const b of t) if (a !== b) {
      const k = p.base + a;
      if (!near.has(k)) near.set(k, new Set());
      near.get(k)!.add(p.base + b);
    }
    const R2 = 0.5 * 0.5;
    for (const q of pts) {
      if (q.m < 0) continue;
      const x = d.pos[q.i * 3], y = d.pos[q.i * 3 + 1], z = d.pos[q.i * 3 + 2];
      search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const k of grid.get(cell(x + dx, y + dy, z + dz)) ?? []) {
          const o = pts[k];
          // (Its own piece only across a dart: not itself, nor a point it shares a triangle with along the edge.)
          if (o.panel === q.panel && o.m === q.m && (o.i === q.i || near.get(q.i)?.has(o.i))) continue;
          const ox = d.pos[o.i * 3] * o.m - x, oy = d.pos[o.i * 3 + 1] - y, oz = d.pos[o.i * 3 + 2] - z;
          if (ox * ox + oy * oy + oz * oz < R2) {
            onSeam.add(q.i);
            break search;
          }
        }
      }
    }
  }
  // A front's button extension, laid over the other front, is drawn just out from that front's cloth beneath it. Each
  // half settled on its own, the extension and the mirrored front under it at much the same depth, now one a little
  // further out, now the other, and drawn by turns the top front's edge read as a zigzag between the buttons of a
  // double-breasted front: Cat, Nov 8. (The under front's cloth at a place is its mirrored half's, read off the points
  // of the fronts on the far side of the centre line nearest that place's mirror. In cm, eased in over the first cm
  // past the centre line.)
  const overUnder = new Float32Array(d.pos.length / 3);
  // (And the under front's extension, drawn under the top front's cloth over it the same way: below 0.)
  const underIn = new Float32Array(d.pos.length / 3);
  if (!knobs().__noOverUnder) {
    const GAP = knobs().__overGap ?? 0.5;
    const fronts = d.panels.filter((p) => p.role === 'front' && !p.hidden && !p.single && !p.whole);
    // (The front's own cloth, not its extension nor its lapel, on the half drawn from `src`: its depth round the body
    // near a place, from its points within 2 cm.)
    const bodyOf = (src: ArrayLike<number>) => {
      const grid = new Map<string, number[]>();
      for (const p of fronts) for (let i = 0; i < p.uv.length / 2; i++) {
        const g = p.base + i;
        if (p.turned?.[i] || p.uv[i * 2] < 0 || src[g * 3] < 0) continue;
        const k = `${Math.floor(src[g * 3] / 2)},${Math.floor(src[g * 3 + 1] / 2)}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(g);
      }
      return (x: number, y: number) => {
        let s = 0, sw = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (const h of grid.get(`${Math.floor(x / 2) + dx},${Math.floor(y / 2) + dy}`) ?? []) {
            const dd = Math.hypot(src[h * 3] - x, src[h * 3 + 1] - y);
            if (dd > 2) continue;
            const w = 1 / (dd * dd + 0.05);
            s += w * Math.hypot(src[h * 3], src[h * 3 + 2]);
            sw += w;
          }
        }
        return sw ? s / sw : undefined;
      };
    };
    const top = d.pos, bottom = d.posMirror ?? d.pos;
    const underBody = bodyOf(bottom), topBody = bodyOf(top);
    for (const p of fronts) for (let i = 0; i < p.uv.length / 2; i++) {
      const g = p.base + i;
      const u = p.uv[i * 2];
      // (A double-breasted lapel, turned back, crosses the centre line too: the under front's goes on under the top
      // front, or the two lapels crossed in an X over the chest, Cat Nov 8. Eased in over its first cm past the centre.)
      const turned = !!p.turned?.[i];
      if (!turned && u >= 0) continue;
      const easeOf = (past: number) => {
        const b = Math.max(0, Math.min(1, past));
        return b * b * (3 - 2 * b);
      };
      // (Where the extension lies over the other front: its mirror place, past the centre line on the far side.)
      if (-top[g * 3] > 0 && !turned) {
        const r = underBody(-top[g * 3], top[g * 3 + 1]);
        if (r !== undefined) overUnder[g] = Math.max(0, r + GAP - Math.hypot(top[g * 3], top[g * 3 + 2])) * easeOf(-u);
      }
      // (And the top front's lapel, turned back over its extension where that crosses the centre: out from
      // the under front. Breaking low at the waist, a classic double-breasted lapel's lower end crosses well past the
      // centre, and the under front drawn over it hid its edge from the break up to mid-chest, Nov 10. A layer and a half,
      // not two: lifted further, its rim showed beside the edge below it as a second line at the break.)
      if (turned && -top[g * 3] > 0 && !knobs().__noLapOver) {
        const r = underBody(-top[g * 3], top[g * 3 + 1]);
        if (r !== undefined) overUnder[g] = Math.max(0, r + 1.5 * GAP - Math.hypot(top[g * 3], top[g * 3 + 2])) * easeOf(-top[g * 3]);
      }
      if (-bottom[g * 3] > 0) {
        const r = topBody(-bottom[g * 3], bottom[g * 3 + 1]);
        if (r !== undefined) underIn[g] = Math.min(0, r - GAP - Math.hypot(bottom[g * 3], bottom[g * 3 + 2])) * (turned ? easeOf(-bottom[g * 3]) : easeOf(-u));
      }
    }
  }
  // How much further out (or in, below 0) a point is drawn where two layers lap, in cm, on the half `e`: a front's
  // button extension (cut past the centre front) laps over the other side, the under one a little further in, or the
  // two mirrored halves cross at the front and leave a tab at the hem; the top one over the under one (above); and a
  // back vent's underlap (cut past the centre back) lies under the other side's cloth, on both sides. (The seams and
  // edges drawn on the cloth follow it, or the under front's edge showed through the top one.)
  const layerIn = new Float32Array(d.pos.length / 3);
  for (const p of d.panels) {
    if (p.hidden) continue;
    for (let i = 0; i < p.uv.length / 2; i++) {
      if (p.role === 'front' && p.turned?.[i]) layerIn[p.base + i] = underIn[p.base + i];
      if (p.uv[i * 2] >= -0.05) continue;
      if (p.role === 'front' && !p.turned?.[i]) layerIn[p.base + i] = Math.min(-0.9, underIn[p.base + i]);
      else if (p.role === 'back') layerIn[p.base + i] = -0.6;
    }
  }
  const isBack = new Uint8Array(d.pos.length / 3);
  for (const p of d.panels) if (p.role === 'back') isBack.fill(1, p.base, p.base + p.uv.length / 2);
  const layered = (i: number, e: number) => (e < 0 || isBack[i] ? layerIn[i] : 0) + (e > 0 ? overUnder[i] : 0);
  for (const p of d.panels) {
    if (p.hidden) continue;
    const n = p.uv.length / 2;
    for (const e of p.single || p.whole ? [1] : [1, -1]) {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set(P(p.base + i, e, layered(p.base + i, e)), i * 3);
      // Each triangle wound so its face looks out from the body (a back piece is laid the other way round from a front);
      // a sleeve's out from the middle of its own arm. The scene's y runs down, so out is the cross product's reverse.
      const ref = (() => {
        if (p.role !== 'sleeve') return undefined;
        const m: V3 = [0, 0, 0];
        let k = 0;
        for (const q of d.panels) {
          if (q.role !== 'sleeve') continue;
          for (let i = 0; i < q.uv.length / 2; i++) {
            const v = P(q.base + i, e);
            m[0] += v[0];
            m[1] += v[1];
            m[2] += v[2];
            k++;
          }
        }
        return m.map((v) => v / (k || 1)) as V3;
      })();
      // Cloth turned back over a fold (a lapel) lies the other way up from the rest of its piece.
      const flipped = (a: number, b: number, c: number) => (p.turned ? p.turned[a] + p.turned[b] + p.turned[c] >= 1 : false);
      let outward = 0;
      for (const [a, b, c] of p.tris) {
        if (flipped(a, b, c)) continue;
        const ux = pos[b * 3] - pos[a * 3];
        const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
        const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const vx = pos[c * 3] - pos[a * 3];
        const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
        const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3 - (ref ? ref[0] : 0);
        const cy = ref ? (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3 - ref[1] : 0;
        const cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3 - (ref ? ref[2] : 0);
        outward += nx * cx + ny * cy + nz * cz;
      }
      const idx: number[] = [];
      for (const [a, b, c] of p.tris) {
        if (outward > 0 !== flipped(a, b, c)) idx.push(a, c, b);
        else idx.push(a, b, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setAttribute('shade', new THREE.Float32BufferAttribute(d.shade ? d.shade.slice(p.base, p.base + n) : new Float32Array(n), 1));
      g.setIndex(idx);
      g.computeVertexNormals();
      // Soften the shading over a few cm: the mesh's own grain reads as dimples on a pale cloth.
      const nrm = g.getAttribute('normal').array as Float32Array;
      const nb: number[][] = Array.from({ length: n }, () => []);
      for (const [a, b, c] of p.tris) {
        nb[a].push(b, c);
        nb[b].push(a, c);
        nb[c].push(a, b);
      }
      // (Pressed pleats keep their faces' light and shadow: softened once only.)
      for (let pass = 0; pass < (p.pleated ? 1 : 4); pass++) {
        const nx = Float32Array.from(nrm);
        nb.forEach((list, i) => {
          if (!list.length) return;
          let x = nrm[i * 3];
          let y = nrm[i * 3 + 1];
          let z = nrm[i * 3 + 2];
          for (const j of list) {
            x += nrm[j * 3] / 2;
            y += nrm[j * 3 + 1] / 2;
            z += nrm[j * 3 + 2] / 2;
          }
          const l = Math.hypot(x, y, z) || 1;
          nx[i * 3] = x / l;
          nx[i * 3 + 1] = y / l;
          nx[i * 3 + 2] = z / l;
        });
        nrm.set(nx);
      }
      // On the centre line the two halves meet: their normals lie flat across it, or a crease shows down the middle.
      // (Not where the cloth laps over itself, a front's button extension or a back vent: there the halves don't meet
      // on the line, and flattened there the overlap shows a ripple. Eased back in over a few cm above it.)
      let lapTop = Infinity;
      for (let i = 0; i < n; i++) if (p.uv[i * 2] < -0.5) lapTop = Math.min(lapTop, -p.uv[i * 2 + 1]);
      for (let i = 0; i < n; i++) {
        if (Math.abs(d.pos[(p.base + i) * 3]) > 0.4) continue;
        const y = -p.uv[i * 2 + 1];
        if (y > lapTop - 1) continue;
        const w = Math.min(1, (lapTop - 1 - y) / 4);
        nrm[i * 3] *= 1 - w;
        const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
        nrm[i * 3] /= l;
        nrm[i * 3 + 1] /= l;
        nrm[i * 3 + 2] /= l;
      }
      // A contrast upper collar shows at the front; round the back its outside is the garment's own cloth.
      const front = p.collar && contrast !== undefined;
      const mat = fit && d.fit ? material('matte') : !cloth || !tex ? material('black') : clothFinish(mode, cloth, tex, 1 / cloth.bodySize);
      if (fit && d.fit) {
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set(fitColour(d.fit[p.base + i]), i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        mat.vertexColors = true;
      } else if (front && contrast !== undefined) {
        const col = new Float32Array(n * 3);
        const cc = new THREE.Color(contrast);
        for (let i = 0; i < n; i++) {
          const k = (p.base + i) * 3;
          if (d.pos[k + 2] > -3) col.set([cc.r, cc.g, cc.b], i * 3);
          else col.set([1, 1, 1], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        mat.vertexColors = true;
      }
      add(g, mat, 1, p.role === 'sleeve' ? 'sleeve' : 'cloth', p.role === 'sleeve' ? e : 0);
      // (The cloth's thickness, in cm: two layers at a hem or facing; a tailored collar and lapel, two layers and their
      // interfacing, stand thicker.)
      const kn = (globalThis as unknown as { __drapeKnobs?: Record<string, number> }).__drapeKnobs ?? {};
      const cm = kn.__thick ?? (p.collar || p.turned?.some((v) => v) ? 0.6 : 0.3);
      if (cm > 0 && !kn.__noThick) {
        // (The scene's units for a cm, from how far a point moves when drawn a cm further out.)
        const i0 = p.base;
        const a = P(i0, e), b = P(i0, e, 1);
        const unit = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        // (No face beneath a tailored collar: folded hard at its roll line, the face a thickness in from the fall came
        // out through the stand, and from beside the neck the collar read as crumpled, Nov 8. Its edges keep their rim.)
        for (const tg of thickened(g, idx, cm * unit, (i) => onSeam.has(p.base + i) || !onEdge.has(p.base + i), !(p.collar && !kn.__collarBack))) add(tg, mat, 1, p.role === 'sleeve' ? 'sleeve' : 'cloth', p.role === 'sleeve' ? e : 0);
      }
    }
  }
  // The seams and edges: bright fine lines in lines, faint ones in cloth (the cloth itself gives the shape).
  const SHOW = new Set(['shoulder', 'side', 'princess', 'armhole', 'neck', 'waist', 'hem', 'opening', 'lapel', 'gorge', 'collar', 'front-seam', 'back-seam', 'sleeve-front', 'opening-hem', 'centre', 'pleat', 'inseam', 'outseam', 'crotch', 'yoke', 'tier', 'face', 'loop', 'pocket']);
  const seam = lines({ colour: GLOW, width: cloth ? 0.7 : 1.1, back: cloth ? 0 : 0.25, alpha: cloth ? 0.55 : 1 });
  for (const l of d.lines) {
    if (!SHOW.has(l.kind)) continue;
    for (const e of l.ids.length && wholeAt(l.ids[0]) ? [1] : [1, -1]) {
      const run = l.ids.map((i) => {
        const q = P(i, e, layered(i, e));
        const r = Math.hypot(q[0], q[2]) || 1;
        const nrm: V3 = [q[0] / r, 0, q[2] / r];
        return { p: [q[0] + nrm[0] * 0.004, q[1], q[2] + nrm[2] * 0.004] as V3, n: nrm };
      });
      if (run.length > 1) seam.add(run);
    }
  }
  for (const b of d.buttons) {
    // (Carried as the cloth under it is, where that hangs clear of the body: placed at the level's own scale, the
    // button stood off the front in profile.)
    let near = -1;
    let nd = 9;
    if (d.hang && !knobs().__btnOld) for (let i = 0; i < d.pos.length / 3; i++) {
      const dd = Math.hypot(d.pos[i * 3] - b.at[0], d.pos[i * 3 + 1] - b.at[1], d.pos[i * 3 + 2] - b.at[2]);
      if (dd < nd) [nd, near] = [dd, i];
    }
    const q = toForm(b.at[0], b.at[1], b.at[2] + LIFT, near >= 0 ? d.hang?.[near] || undefined : undefined);
    // Small, self-coloured buttons: the cloth's own colour, a touch paler, with a little sheen (a quiet dark horn where
    // there is no plain colour to match).
    const g = new THREE.SphereGeometry(b.r / 30, 16, 8);
    g.setAttribute('shade', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count), 1));
    g.scale(1, 1, 0.35);
    g.translate(q[0], q[1], q[2]);
    const m = material('gloss');
    if (cloth?.plain) m.color.set(new THREE.Color(cloth.plain).lerp(new THREE.Color(0xffffff), 0.12));
    else m.color.set(0x2a2622);
    add(g, m, 2, 'cloth');
  }
}

/** The view, or nothing where the browser has no WebGL (the canvas painter draws then). */
export function createRoundView(): RoundView | undefined {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true, stencil: true });
  } catch {
    return undefined;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // The studio: a soft room of light all round, a key high on the left and in front, a fill low on the right, and a
  // rim from behind. In this scene y runs down and z toward the viewer, as on the canvas.
  // Lights only, no reflected room: sampling a room map is the dear part of the shading on a software chip (the
  // all-round check runs on one), and three lamps give the satin its highlights.
  const key = new THREE.DirectionalLight(0xfff4e6, 2.8);
  key.position.set(-0.5, -0.42, 0.76);
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.6);
  fill.position.set(0.8, 0.3, 0.45);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(0.3, -0.3, -1);
  // Sky above (y down: the sky is at -y), a dimmer warm ground below.
  const sky = new THREE.HemisphereLight(0xe4ecff, 0x5a4a3a, 0.8);
  sky.position.set(0.35, -1, 0.3);
  scene.add(key, fill, rim, sky);
  const lamps = [key, fill, rim, sky];
  const flat = new THREE.AmbientLight(0xffffff, 4.5);
  flat.visible = false;
  scene.add(flat);
  const camera = new THREE.Camera();
  /** Everything that turns with the form. */
  const turning = new THREE.Group();
  /** The garment's outline, which stays at the sides as the form turns. */
  const still = new THREE.Group();
  scene.add(turning, still);
  const res = new THREE.Vector2(1, 1);
  let disposables: { dispose: () => void }[] = [];
  let lineSets: Lines[] = [];
  let outline: ((f: Frame) => void) | undefined;
  let lwBuilt = 0;
  let built: BuildOptions | undefined;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const clear = () => {
    turning.clear();
    still.clear();
    for (const d of disposables) d.dispose();
    disposables = [];
    lineSets = [];
    outline = undefined;
  };

  const build = (o: BuildOptions) => {
    clear();
    built = o;
    const { round, sh, cloth, film } = o;
    const { trousers, isTop, yAt, yOf, kY, longest, highest, bandTop, arm, yS, yU, sl, rh, radius, shell, clothDown, yE, yCap, axisX, capDepth, sleeveR, lg, yC, yK, yH, legR, legAxis, rAt } = sh;
    const k = 1 / kY; // cm of cloth to a unit of the form
    const add = (geo: THREE.BufferGeometry, mat: RoundMaterial, order = 1, part: PickPart = 'cloth', e = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = order;
      mesh.userData = { part, e };
      turning.add(mesh);
      disposables.push(geo, mat);
      return mesh;
    };
    /** A point round the body at angle a and radius r. */
    const P = (a: number, r: number, y: number): V3 => [Math.sin(a) * r, y, Math.cos(a) * r];
    /** A point round a tube standing at x = X. */
    const T = (X: number, a: number, r: number, y: number, zr = r): V3 => [X + Math.sin(a) * r, y, Math.cos(a) * zr];
    const radial = (a: number): V3 => [Math.sin(a), 0, Math.cos(a)];

    // The body: the satin form from the top of its neck to below the hip, its neck cut flat across, and its legs.
    const bodyAt = (a: number, y: number): V3 => {
      const yy = Math.max(y, NECK_TOP);
      const q = P(a, bodyReach(bodyHalf(Math.min(yy, 1.3)), a, yy), y);
      if (o.formX) q[0] = o.formX(q[0], yy, q[2]);
      return q;
    };
    const satin = material('satin');
    /** Where the garment's hem is on average: the body or legs under it stand in its shadow. */
    const hemMean = (() => {
      let sum = 0;
      for (let i = 0; i < 36; i++) sum += yOf(round.lengthAt(-Math.PI + (TAU * i) / 36));
      return sum / 36;
    })();
    if (isTop) {
      satin.uniforms.shadeY.value = hemMean;
      satin.uniforms.shadeDepth.value = 0.22;
    }
    // Where the cloth lies on the body (over the shoulders, a shelf the cloth's thin ease barely clears) the two
    // surfaces are all but one, and the body's facets won the fight for the pixel in places, showing through the
    // cloth seen from behind: the body is pushed back a little in depth so the cloth always wins there.
    satin.polygonOffsetFactor = 8;
    satin.polygonOffsetUnits = 16;
    // Under trousers the body below the waist is left out: the trousers are oval and close in round the legs, and the
    // seat would stand out through them.
    if (trousers) satin.uniforms.hideBelow.value = WAIST + 0.02;
    // Rows close together over the neck and shoulders, where the body's profile turns sharply out from the neck to
    // the shoulder tip: laid in coarse rows, the straight runs between them cut outside the true shoulder at the base
    // of the neck, and the body showed through the cloth lying on it there, seen from behind.
    const BODY_BOTTOM = 1.3;
    const SHOULDER_BAND = (-1.0 - NECK_TOP) / (BODY_BOTTOM - NECK_TOP);
    const bodyRow = (j: number, n: number) => {
      const u = j / n;
      return u <= 0.5 ? (u / 0.5) * SHOULDER_BAND : SHOULDER_BAND + ((u - 0.5) / 0.5) * (1 - SHOULDER_BAND);
    };
    add(sweep({ at: (a, t) => bodyAt(a, NECK_TOP + (BODY_BOTTOM - NECK_TOP) * t), out: radial, rowT: bodyRow }, -Math.PI, Math.PI, 96, 120), satin, 0, 'body');
    const neck = material('satin');
    neck.color.set(0x0e0c0a);
    neck.roughness = 0.45;
    add(cap((a) => bodyAt(a, NECK_TOP), [0, -1, 0]), neck, 0, 'body');
    for (const leg of [-1, 1]) {
      const legs = material('satin');
      if (!isTop && !trousers) {
        legs.uniforms.shadeY.value = hemMean;
        legs.uniforms.shadeDepth.value = 0.3;
      }
      add(sweep({ at: (a, t) => T(leg * FORM_LEG_X, a, FORM_LEG(LEG_TOP + (FORM_FLOOR - LEG_TOP) * t), LEG_TOP + (FORM_FLOOR - LEG_TOP) * t), out: radial }, -Math.PI, Math.PI, 48, 60), legs, 0, 'leg', leg);
    }

    if (o.draped) {
      if (o.draped !== 'pending') buildDraped(o.draped, cloth, add, (style) => {
        const l = new Lines(style, turning);
        lineSets.push(l);
        return l;
      }, maxAniso, disposables, !!o.fit);
      lwBuilt = 0;
      return;
    }

    // The cloth: the garment's body from its top edge (or the armhole, under the arms) to its hem (the crotch on
    // trousers), front and back cut as their own panels so a print breaks at the side seams as cut cloth does.
    const clothMaterial = (tiles: HTMLCanvasElement, size: number) => {
      const tex = new THREE.CanvasTexture(tiles);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      disposables.push(tex);
      const mode: Mode = cloth?.sheen === 'gloss' ? 'gloss' : cloth?.sheen === 'pile' ? 'pile' : 'matte';
      // The border band is a print: only the body's swatch takes the cloth's finish.
      const mat = cloth && tiles === cloth.body ? clothFinish(mode, cloth, tex, 1 / size) : material(mode, tex, 1 / size, cloth ? opacityOf(cloth) : 1);
      if (cloth?.lift && cloth.plain) {
        mat.emissive.set(cloth.plain).convertSRGBToLinear();
        mat.emissiveIntensity = cloth.lift;
      }
      return mat;
    };
    const clothMat = () => {
      if (!cloth) return material('black');
      return clothMaterial(cloth.body, cloth.bodySize);
    };
    const mid = (yS + yU) / 2;
    const half = (yU - yS) / 2;
    const topY = sh.topY;
    const topOf = (a: number) => {
      let t = topY(a);
      // Sleeveless, the armhole is open; with a sleeve the bodice runs up to the shoulder and the sleeve stands on it.
      if (arm && !sl) {
        const d = Math.abs(Math.abs(wrap(a)) - HALF) / 0.32;
        if (d < 1) t = Math.max(t, mid + half * Math.sqrt(1 - d * d));
      }
      return t;
    };
    const hemY = (a: number) => yOf(round.lengthAt(wrap(a)));
    const botOf = (a: number) => (trousers && lg ? yC : hemY(a));
    const rows = (j: number, n: number) => (j / n) ** 1.6;
    for (const c of [0, Math.PI]) {
      const mat = clothMat();
      // In lines, the garment is black under its lines, and above the underarm the body shows through a top's yoke:
      // the cloth is held to the body there.
      if (!cloth && isTop && arm) mat.uniforms.hideAbove.value = yU;
      add(
        sweep(
          {
            at: (a, t) => {
              const aw = wrap(a);
              const y = topOf(aw) + (botOf(aw) - topOf(aw)) * t;
              return P(aw, rAt(aw, y), y);
            },
            uv: (a, t) => {
              const aw = wrap(a);
              const y = topOf(aw) + (botOf(aw) - topOf(aw)) * t;
              return [(a - c) * rAt(aw, y) * k, clothDown(aw, y) * k];
            },
            out: radial,
            rowT: isTop ? rows : undefined,
            shade: (a, t) => {
              const aw = wrap(a);
              const y = topOf(aw) + (botOf(aw) - topOf(aw)) * t;
              // The valleys of the folds, and the cloth in the shadow under a sleeve.
              const valley = 0.25 * Math.min(1, sh.foldAmp(y) / 0.03) * (0.5 - 0.5 * Math.cos(sh.FOLDS * aw + 0.6 * Math.sin(3 * aw)));
              const underArm = isTop && sl ? 0.32 * Math.exp(-(((Math.abs(aw) - HALF) / 0.33) ** 2)) * Math.exp(-(((y - yU - 0.1) / 0.28) ** 2)) : 0;
              return Math.max(valley, underArm);
            },
          },
          c - HALF,
          c + HALF,
          72,
          isTop ? 48 : 36,
        ),
        mat,
      );
    }
    // A border print along the hem, its foot on the hem line: only the swatch's band itself, its lower part.
    if (cloth?.border && cloth.borderSize && !trousers) {
      const B = cloth.borderSize;
      for (const c of [0, Math.PI]) {
        const mat = clothMaterial(cloth.border, B);
        mat.polygonOffsetFactor = 0;
        mat.polygonOffsetUnits = -2;
        add(
          sweep(
            {
              at: (a, t) => {
                const aw = wrap(a);
                const u0 = Math.max(topOf(aw), hemY(aw) - 0.4 * B * kY);
                const y = u0 + (hemY(aw) - u0) * t;
                return P(aw, rAt(aw, y) + 0.002, y);
              },
              uv: (a, t) => {
                const aw = wrap(a);
                const u0 = Math.max(topOf(aw), hemY(aw) - 0.4 * B * kY);
                const y = u0 + (hemY(aw) - u0) * t;
                return [(a - c) * rAt(aw, y) * k, B - (hemY(aw) - y) * k];
              },
              out: radial,
            },
            c - HALF,
            c + HALF,
            72,
            6,
          ),
          mat,
          2,
        );
      }
    }
    /** A tube round an axis at X(y): a sleeve or a trouser leg, in its cloth. */
    /**
     * How far, at height y, a trouser leg's cloth keeps the seat's depth rather than closing to its own round tube of
     * radius r: over the thigh on any leg, and the whole way down a leg with cloth enough to hang plumb from the seat
     * and the belly, as a straight tube leg does (closing to a round tube below the thigh, the seat read as a bump
     * over the leg from the side, Cat 2026-11-06). `seatD` is the seat's depth at the crotch.
     */
    const seatHold = (y: number, y0: number, r: number, seatD: number) => {
      const thigh = smooth(clamp(1 - (y - y0) / Math.max(0.45, (yK - y0) * 0.85), 0, 1));
      if (seatD <= r) return thigh;
      // The depth the cloth can give while staying as wide across as the leg inside it, as a share of the seat's
      // (held at that share, the leg's front and back lie at that depth: tube() blends them from the seat's own
      // line, not from a round tube). Wherever the thigh above pulled the cloth in, it hangs straight on down from
      // there, not out again as the leg thins (which notched each leg in below the seat and out again by the knee,
      // Cat 2026-11-06: "more of a bump now").
      let plumb = 1;
      for (let i = 0; i <= 6; i++) {
        const room = 2 * r - (FORM_LEG(y0 + ((y - y0) * i) / 6) + 0.012);
        plumb = Math.min(plumb, clamp(room / seatD, 0, 1));
      }
      // From the seat's own depth at the crotch the cloth eases down the thigh to the depth it can hold, over the
      // whole thigh (held, then let go, it stepped in under the seat).
      return plumb + (1 - plumb) * thigh;
    };
    const tube = (X: (y: number) => number, R: (y: number) => number, y0: number, y1: number, panels: boolean, Z: (y: number) => number = () => 1, seat?: (g: number) => number, part: PickPart = 'cloth') => {
      const e = Math.sign(X(y0)) || 1;
      const NY = 32;
      const rowY = (t: number) => y0 + (y1 - y0) * t ** 1.6;
      // Down the cloth by its length over the crown, not its height, counted up from the hem, so the print is not
      // smeared across the top of the cap where it runs out more than down.
      const down: number[] = [0];
      for (let j = 1; j <= NY; j++) {
        const ya = rowY((j - 1) / NY);
        const yb = rowY(j / NY);
        down.push(down[j - 1] + Math.hypot(yb - ya, R(yb) - R(ya)));
      }
      const downAt = (t: number) => {
        const f = t * NY;
        const j = Math.min(NY - 1, Math.floor(f));
        return y1 - (down[NY] - (down[j] + (down[j + 1] - down[j]) * (f - j)));
      };
      const geoAt = (a: number, t: number): V3 => {
        const y = rowY(t);
        const r = R(y);
        if (!seat) return T(X(y), a, r, y, r * Z(y));
        // A trouser leg grows out of the seat (Cat, 2026-10-28: "why are pants like this?"): at the crotch its
        // outer half is the seat's own side, from the centre front round to the centre back, and its inner half
        // the flat inseam down the middle where the two legs meet. Down the thigh that half-seat wraps on round
        // into the whole leg and the inseam closes to the line where the legs touch, so the seat runs into the
        // legs with no shelf and no crease between them.
        const e = Math.sign(X(y)) || 1;
        const sOf = e * wrap(a);
        const aw = sOf >= 0 ? e * (2 * sOf - HALF) : -e * HALF;
        const p = T(X(y), aw, r, y, r * Z(y));
        // Over the whole thigh, down to the knee: the cloth hangs from the seat and the belly and only closes
        // round the leg as the thigh narrows (over a hand's width it bulged at the seat, Cat 2026-10-28).
        const wOut = seatHold(y, y0, r, Math.max(seat(0), seat(Math.PI)));
        // The inseam side parts from the other leg straight below the crotch, so two legs show from the front.
        const wIn = smooth(clamp(1 - (y - y0) / 0.3, 0, 1));
        const w = wOut + (wIn - wOut) * smooth(clamp(-sOf / 0.6, 0, 1));
        if (w <= 0) return p;
        let qx = 0;
        let qz: number;
        if (sOf >= 0) {
          const g = e * sOf;
          const rs = seat(g);
          qx = Math.sin(g) * rs;
          qz = Math.cos(g) * rs;
        } else qz = Math.cos(sOf) * seat(Math.cos(sOf) >= 0 ? 0 : Math.PI);
        // Across the body each leg is on its own axis within a hand's width of the crotch; front to back it
        // keeps the seat's depth down the thigh.
        return [qx * wIn + p[0] * (1 - wIn), y, qz * w + p[2] * (1 - w)];
      };
      // The cloth's length round each row of the leg from the inseam at the crotch (where the seat's centre front is
      // laid, see `at`), read between the samples.
      const ARC_N = 96;
      const aRef = -e * HALF;
      const arc: Float64Array[] = [];
      const roundAt = (a: number, t: number) => {
        if (!seat) return 0;
        const j = Math.round(t * NY);
        if (!arc[j]) {
          const row = new Float64Array(ARC_N + 1);
          let prev = geoAt(aRef, t);
          for (let i = 1; i <= ARC_N; i++) {
            const q = geoAt(aRef + (TAU * i) / ARC_N, t);
            row[i] = row[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
            prev = q;
          }
          arc[j] = row;
        }
        const f = (((((a - aRef) / TAU) % 1) + 1) % 1) * ARC_N;
        const i = Math.min(ARC_N - 1, Math.floor(f));
        return arc[j][i] + (arc[j][i + 1] - arc[j][i]) * (f - i);
      };
      const geo = (c: number, a0: number, a1: number) =>
        sweep(
          {
            at: geoAt,
            uv: (a, t) => {
              const y = rowY(t);
              const r = R(y);
              // Over the crown the cloth is laid at the arm's own width, or the print squeezes into streaks at its top.
              if (!seat) return [(a - c) * Math.max(r, R(y1) * 0.8) * k, downAt(t) * k];
              // On a leg the print is laid by the length of cloth round it, row by row, from the inseam at the crotch
              // (the centre front of the seat, so it carries on from the body's print) round the outside: laid by the
              // leg's own angle and width it broke along the crotch in a line, and eased from the seat's lay it
              // smeared across the top of the thigh (Cat, 2026-11-06).
              return [roundAt(a, t) * k, (y0 + downAt(t) - downAt(0)) * k];
            },
            out: (a) => radial(a),
            shade: (a, t) => {
              // The side of a sleeve toward the body, or of a leg toward the other, in its shadow near the top.
              const e = Math.sign(X(rowY(t))) || 1;
              return 0.3 * Math.max(0, -e * Math.sin(wrap(a)) - 0.2) * (1 - t) ** 1.5;
            },
          },
          a0,
          a1,
          48,
          NY,
        );
      if (panels) {
        add(geo(0, -HALF, HALF), clothMat(), 1, part, e);
        add(geo(Math.PI, HALF, 3 * HALF), clothMat(), 1, part, e);
      } else add(geo(0, -Math.PI, Math.PI), clothMat(), 1, part, e);
    };
    // In lines the sleeves and trouser legs are lines alone, as the canvas painter drew them; in cloth they are cloth.
    if (cloth && sl && arm) for (const e of [1, -1]) tube((y) => e * axisX(y), sleeveR, yCap, yE, false, capDepth, undefined, 'sleeve');
    if (cloth && lg) for (const leg of [-1, 1]) tube((y) => leg * legAxis(y), legR, yC, yH, false, undefined, (g) => rAt(g, yC), 'leg');
    // A waistband is cloth too, standing on the garment's top edge, not a hoop in the air above it.
    // The band lies on the body above the waist, which widens again up from it.
    const bandR = (a: number, y = bandTop) => shell(a, Math.min(y, WAIST)) + 0.006;
    if (cloth && round.bandCm) {
      for (const c of [0, Math.PI]) {
        add(
          sweep(
            {
              at: (a, t) => P(wrap(a), bandR(wrap(a), bandTop + (WAIST + 0.01 - bandTop) * t), bandTop + (WAIST + 0.01 - bandTop) * t),
              uv: (a, t) => [(a - c) * bandR(wrap(a)) * k, (bandTop + (WAIST + 0.01 - bandTop) * t) * k],
              out: radial,
            },
            c - HALF,
            c + HALF,
            72,
            4,
          ),
          clothMat(),
        );
      }
    }

    // The lines: the garment's edges, its seams and darts, and in lines its cloth as lines down and round it.
    const lines = (style: Style) => {
      const l = new Lines(style, turning);
      lineSets.push(l);
      return l;
    };
    /** The cloth's normal at a point on the garment's body, from its own slope. */
    const clothN = (a: number, y: number, rOf: (a: number, y: number) => number): V3 => {
      const d = 0.01;
      const pa = P(a + d, rOf(a + d, y), y);
      const ma = P(a - d, rOf(a - d, y), y);
      const py = P(a, rOf(a, y + d), y + d);
      const my = P(a, rOf(a, y - d), y - d);
      const ax = pa[0] - ma[0];
      const az = pa[2] - ma[2];
      const tx = py[0] - my[0];
      const ty = py[1] - my[1];
      const tz = py[2] - my[2];
      let nx = -az * ty;
      let ny = az * tx - ax * tz;
      let nz = ax * ty;
      if (nx * Math.sin(a) + nz * Math.cos(a) < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    };
    /** A point on the cloth, lifted a hair off it so the line sits on the surface, not in it. */
    const onCloth = (a: number, y: number, rOf: (a: number, y: number) => number = shell) => {
      const n = clothN(a, y, rOf);
      const p = P(a, rOf(a, y), y);
      return { p: [p[0] + n[0] * 0.004, p[1] + n[1] * 0.004, p[2] + n[2] * 0.004] as V3, n };
    };
    const onTube = (X: number, a: number, r: number, y: number, slope = 0) => {
      const n: V3 = [Math.sin(a), -slope, Math.cos(a)];
      const l = Math.hypot(...n) || 1;
      n[0] /= l;
      n[1] /= l;
      n[2] /= l;
      const p = T(X, a, r + 0.004, y);
      return { p, n };
    };
    const ring = (l: Lines, yAtA: (a: number) => number, rOf: (a: number, y: number) => number = shell, n = 144) => l.curve(n, (i) => onCloth(-Math.PI + (TAU * i) / n, yAtA(-Math.PI + (TAU * i) / n), rOf));
    const legX = (leg: number, y: number) => leg * legAxis(y);
    /** A point on a trouser leg's cloth at angle `a` round it, as the leg's tube is laid (see `tube`): its outer
     *  side holds the seat's depth where the cloth does, so the lines drawn on it sit on the cloth. */
    const onLeg = (leg: number, a: number, y: number) => {
      const r = legR(y);
      const q = onTube(legX(leg, y), a, r, y);
      let v = leg * wrap(a);
      // The quarter toward the other leg is the flat inseam, its line left on the tube.
      if (v < -HALF + 1e-6) return q;
      if (v > 3 * HALF) v -= TAU;
      const g = leg * ((v + HALF) / 2);
      const w = seatHold(y, yC, r, Math.max(rAt(0, yC), rAt(Math.PI, yC)));
      // Across the body too the leg is the seat's own side within a hand's width of the crotch (as tube() lays it),
      // or a line drawn there sat inside the cloth and seemed to stop short of the crotch.
      const wIn = smooth(clamp(1 - (y - yC) / 0.3, 0, 1));
      q.p[0] = Math.sin(g) * rAt(g, yC) * wIn + q.p[0] * (1 - wIn);
      q.p[2] = Math.cos(g) * rAt(g, yC) * w + q.p[2] * (1 - w);
      return q;
    };
    const spot = (p: RoundPt, leg?: number) => {
      const y = leg ? yOf(p.cm) : yAt(p.phi, p.cm);
      return leg ? onLeg(leg, p.phi, y) : onCloth(p.phi, y, rAt);
    };
    /** A seam or dart through its points, in small steps so it follows the body. */
    const along = (l: Lines, pts: RoundPt[], leg?: number) => {
      const run: Run = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        for (let s = i === 1 ? 0 : 1; s <= 10; s++) run.push(spot({ phi: a.phi + ((b.phi - a.phi) * s) / 10, cm: a.cm + ((b.cm - a.cm) * s) / 10 }, leg));
      }
      l.add(run);
    };

    // In cloth, the edges are fine lines: the cloth itself gives the shape.
    const edge = cloth ? 0.55 : 1;
    const edges = lines({ colour: GLOW, width: 1.1, back: cloth ? 0 : 0.25, alpha: edge });
    ring(edges, topY);
    if (!trousers) {
      const hem = lines({ colour: GLOW, width: 1.3, back: cloth ? 0 : 0.3, alpha: edge });
      ring(hem, hemY);
    }
    // A sewn seam round the garment (a dress's waist seam) is a shadow in the cloth, as the side seams are, not a
    // bright edge like a hem or a neckline (Cat, 2026-10-27).
    const grooveDark = lines({ colour: SHADOW, width: 1.8, alpha: 0.45, graze: 0.3 });
    const grooveLight = lines({ colour: GLOW, width: 0.5, alpha: 0.5, graze: 0.3 });
    const seams = cloth ? undefined : lines({ colour: GLOW, width: 1.1, back: 0.25 });
    for (const r of round.rings) {
      if (cloth) {
        ring(grooveDark, (a) => yAt(a, r(a)));
        ring(grooveLight, (a) => yAt(a, r(a)));
      } else ring(lines({ colour: GLOW, width: 0.9, back: 0.25 }), (a) => yAt(a, r(a)));
    }
    if (round.bandCm) {
      // In cloth the band is cloth with a fine edge along its top; in lines it is drawn as a hoop with its sides.
      ring(lines({ colour: GLOW, width: cloth ? 0.7 : 0.8, back: cloth ? 0 : 0.2, alpha: edge }), () => bandTop, cloth ? (a) => bandR(a) : (_a, y) => radius(y));
      if (!cloth) {
        const sides = new Lines({ colour: GLOW, width: 1, onTop: true }, still);
        lineSets.push(sides);
        for (const e of [-1, 1]) sides.add([{ p: [e * radius(WAIST), bandTop, 0], n: [0, 0, 1] }, { p: [e * radius(WAIST), WAIST, 0], n: [0, 0, 1] }]);
      }
      // Belt loops: a strip of cloth 1.2 cm wide standing a little proud of the band at each, its long edges shaded
      // so it reads as a loop; in lines, two short strokes down the band.
      const loopEdges = lines(cloth ? { colour: SHADOW, width: 1.6, alpha: 0.5, graze: 0.3 } : { colour: GLOW, width: 0.8, back: 0.2, alpha: edge });
      for (const at of round.loops ?? []) {
        const dw = (0.6 * kY) / Math.max(0.05, bandR(at));
        const top = bandTop - 0.2 * kY;
        const foot = WAIST + 0.2 * kY;
        if (cloth)
          add(
            sweep({ at: (a, t) => P(wrap(a), bandR(wrap(a), top + (foot - top) * t) + 0.012, top + (foot - top) * t), uv: (a, t) => [(a - at) * bandR(wrap(a)) * k, (top + (foot - top) * t) * k], out: radial }, at - dw, at + dw, 3, 4),
            clothMat(),
          );
        for (const e of [-1, 1]) {
          const a = wrap(at + e * dw);
          loopEdges.curve(4, (i) => ({ p: P(a, bandR(a, top + ((foot - top) * i) / 4) + 0.014, top + ((foot - top) * i) / 4), n: [Math.sin(a), 0, Math.cos(a)] }));
        }
      }
    }
    const dartStyle: Style = cloth ? { colour: SHADOW, width: 1.8, alpha: 0.4, graze: 0.3 } : { colour: GILD, width: 0.8, back: 0.2, alpha: film ? 0.5 : 1 };
    const darts = lines(dartStyle);
    const dartsLight = cloth ? lines({ colour: GLOW, width: 0.5, alpha: 0.45, graze: 0.3 }) : undefined;
    for (const dt of round.darts) {
      along(darts, [dt.base, dt.tip]);
      if (dartsLight) along(dartsLight, [dt.base, dt.tip]);
    }
    // A pressed pleat: a strip of shadow in under its edge, and the edge itself catching the light along its length.
    if (round.pleats?.length) {
      const pleatShade = cloth ? lines({ colour: SHADOW, width: 3.2, alpha: 0.38, graze: 0.3 }) : undefined;
      const pleatEdge = lines(cloth ? { colour: GLOW, width: 0.9, alpha: 0.75, graze: 0.3 } : dartStyle);
      for (const pl of round.pleats) {
        if (pleatShade) along(pleatShade, pl.pts.map((q) => ({ phi: q.phi + pl.press * 0.045, cm: q.cm })), pl.leg);
        along(pleatEdge, pl.pts, pl.leg);
      }
    }
    const seamDark = cloth ? lines({ colour: SHADOW, width: 2, alpha: 0.45, graze: 0.3 }) : undefined;
    const seamLight = cloth ? lines({ colour: GLOW, width: 0.55, alpha: 0.5, graze: 0.3 }) : undefined;
    for (const sm of round.seams) {
      if (sm.kind === 'sleeve') continue;
      if (seamDark && seamLight) {
        along(seamDark, sm.pts, sm.leg);
        along(seamLight, sm.pts, sm.leg);
      } else if (seams) along(seams, sm.pts, sm.leg);
    }
    if (round.vent) {
      const vent = lines({ colour: GILD, width: 0.8, back: cloth ? 0 : 0.2 });
      along(vent, [{ phi: Math.PI + 0.05, cm: round.vent.fromCm }, { phi: Math.PI + 0.05, cm: round.lengthAt(Math.PI) }]);
    }

    // The cloth itself, as lines down the garment all the way round, so it reads over the form: hanging straight
    // where it has ease, and only pulled in where it is cut close.
    if (!trousers && !cloth) {
      const n = film ? 28 : 36;
      const down = lines({ colour: GLOW, width: 0.55, back: 0.08, alpha: film ? 0.75 : 0.6 });
      for (let j = 0; j < n; j++) {
        const a = wrap((TAU * (j + 0.5)) / n);
        const y0 = isTop && arm ? Math.max(topY(a), yU - 0.02) : topY(a);
        const y1 = hemY(a);
        down.curve(30, (i) => onCloth(a, y0 + ((y1 - y0) * i) / 30));
      }
      const across = lines({ colour: GLOW, width: 0.5, back: 0.08, alpha: 0.45 });
      for (let y = yOf(highest) + 0.12; !film && y < yOf(longest) - 0.04; y += 5 * kY) {
        const yy = y;
        ring(across, (a) => Math.max(yy, topY(a)));
      }
    }

    // Armholes, and the sleeves set into them.
    if (arm) {
      for (const e of [1, -1]) {
        if (!sl) {
          const loop = lines({ colour: GLOW, width: 1.05, back: 0.2, alpha: edge });
          loop.curve(48, (i) => {
            const t = (TAU * i) / 48;
            const y = mid - half * Math.cos(t);
            return onCloth(e * HALF + 0.32 * Math.sin(t), y, (_a, yy) => radius(yy) + 0.004);
          });
          continue;
        }
        const hemRing = lines({ colour: GLOW, width: 1.2, back: film || cloth ? 0 : 0.25, alpha: edge });
        hemRing.curve(48, (i) => onTube(e * axisX(yE), -Math.PI + (TAU * i) / 48, rh, yE));
        // The underarm seam, on the side of the sleeve toward the body.
        // Its faint through-the-cloth copy only in lines: in cloth it showed as a white sliver inside the near sleeve (film thread, 2026-10-28).
        const under = lines({ colour: GLOW, width: 1, back: cloth ? 0 : 0.2 });
        under.curve(40, (i) => {
          const y = yU + ((yE - yU) * i) / 40;
          return onTube(e * axisX(y), -e * HALF, sleeveR(y), y);
        });
        if (film && !cloth) {
          // The sleeve's cloth, in a few lines down the front of the arm.
          const few = lines({ colour: GLOW, width: 0.5, alpha: 0.6 });
          for (const a of [-0.9, -0.3, 0.3, 0.9]) {
            few.curve(40, (i) => {
              const y = yU - 0.02 + ((yE - yU + 0.02) * i) / 40;
              return onTube(e * axisX(y), a, sleeveR(y), y);
            });
          }
        }
      }
    }
    // Trouser leg hems.
    if (lg) {
      const hems = lines({ colour: GLOW, width: 1.3, back: cloth ? 0 : 0.25, alpha: edge });
      for (const leg of [-1, 1]) hems.curve(48, (i) => onLeg(leg, -Math.PI + (TAU * i) / 48, yH));
    }

    // The garment's outline, which stays at the sides as the form turns: its sides from the underarm (or the top
    // edge) to the hem, over the shoulder from the neck to the tip, and the sleeves' and trouser legs' own sides.
    // Drawn over everything, as the canvas painter drew them, and laid again each frame (they depend on the turn).
    const outlines = new Lines({ colour: GLOW, width: 1.2, onTop: true }, still);
    const shoulders = new Lines({ colour: GLOW, width: 1, onTop: true }, still);
    if (!cloth) {
      for (const e of [1, -1]) {
        const a = e * HALF;
        const y0 = isTop && arm ? yU : topY(a);
        const y1 = trousers && lg ? yC : hemY(a);
        outlines.curve(40, (i) => {
          const y = y0 + ((y1 - y0) * i) / 40;
          return { p: [e * radius(y), y, 0], n: [0, 0, 1] };
        });
        if (isTop && arm) {
          const n0 = topY(a);
          shoulders.curve(16, (i) => {
            const y = n0 + ((yS - n0) * i) / 16;
            return { p: [e * radius(y), y, 0], n: [0, 0, 1] };
          });
        }
      }
    }
    lineSets.push(outlines, shoulders);
    // The sleeves' and legs' sides turn with their axes: laid afresh each frame.
    if (!cloth && ((sl && arm) || lg)) {
      const turnLines = new Lines({ colour: GLOW, width: 1.1, onTop: true }, still);
      lineSets.push(turnLines);
      outline = (f) => {
        const t = turnLines;
        t.reset();
        const c = Math.cos(f.phi);
        const s = Math.sin(f.phi);
        if (sl && arm) {
          for (const e of [1, -1]) {
            const X = (y: number) => e * axisX(y);
            // The side toward the body shows only below the underarm; above it, it is inside the bodice.
            for (const side of [-1, 1]) {
              t.curve(40, (i) => {
                const y = yCap + ((yE - yCap) * i) / 40;
                if (side !== e && y < yU - 0.01) return undefined;
                return { p: [X(y) * c + side * sleeveR(y), y, -X(y) * s], n: [0, 0, 1] };
              });
            }
          }
        }
        if (lg) {
          for (const leg of [-1, 1]) {
            for (const e of [-1, 1]) {
              t.curve(60, (i) => {
                const y = yC + ((yH - yC) * i) / 60;
                return { p: [legX(leg, y) * c + e * legR(y), y, -legX(leg, y) * s], n: [0, 0, 1] };
              });
            }
          }
        }
        t.update();
      };
    }
    lwBuilt = 0;
  };

  const render = (f: Frame): HTMLCanvasElement => {
    const { phi, w, h, dpr, lw, probe } = f;
    for (const l of lamps) l.visible = !probe;
    flat.visible = !!probe;
    // The check reads what is cloth and what is form; the lines drawn on the cloth (seams, darts, edges) are neither,
    // and on a fold's crest a side seam can sit a few pixels inside the silhouette and read as the form seen through.
    for (const l of lineSets) for (const o of l.objects) o.visible = !probe;
    renderer.toneMapping = probe ? THREE.NoToneMapping : THREE.NeutralToneMapping;
    const W = Math.max(1, Math.round(w * dpr));
    const Hh = Math.max(1, Math.round(h * dpr));
    if (renderer.domElement.width !== W || renderer.domElement.height !== Hh) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
    }
    res.set(W, Hh);
    // The lines are built once the view's line width is known (it depends on the size), and again if it changes.
    if (Math.abs(lwBuilt - lw * dpr) > 0.05 && built) {
      for (const l of lineSets) {
        for (const o of l.objects) {
          o.parent?.remove(o);
          o.geometry.dispose();
          (o.material as LineMaterial).dispose();
        }
        l.objects.length = 0;
        l.build(lw * dpr, res);
      }
      lwBuilt = lw * dpr;
    }
    outline?.(f);
    const { A, B, C, D, E } = projection(f);
    camera.projectionMatrix.set(A, 0, 0, B, 0, C, D, E, 0, 0, -0.25, 0, 0, 0, 0, 1);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    turning.rotation.y = phi;
    renderer.render(scene, camera);
    return renderer.domElement;
  };

  // The draw tool inside All round (Cat's A Draw on it, 2026-10-28): what stands under a point of the canvas. The
  // view's projection is affine, so a point of the canvas is a line straight into the depth, tilted by the view's
  // slight look from above; the first surface it meets is the one the finger is on.
  const caster = new THREE.Raycaster();
  const pick = (f: Frame, px: number, py: number): Pick | undefined => {
    const { A, B, C, D, E } = projection(f);
    const nx = (px / f.w) * 2 - 1;
    const ny = 1 - (py / f.h) * 2;
    const x = (nx - B) / A;
    const yAt = (z: number) => (ny - E - D * z) / C;
    const origin = new THREE.Vector3(x, yAt(10), 10);
    const dir = new THREE.Vector3(0, yAt(0) - yAt(10), -10).normalize();
    caster.set(origin, dir);
    turning.rotation.y = f.phi;
    turning.updateMatrixWorld(true);
    // Only the surfaces themselves: the fat lines are meshes too, but take a camera to be cast at.
    const meshes = turning.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh && 'part' in o.userData);
    const hit = caster.intersectObjects(meshes, false).find((h) => {
      // What the shader leaves out (the body under trousers) is not there to touch.
      const u = (h.object as THREE.Mesh<THREE.BufferGeometry, RoundMaterial>).material.uniforms;
      const yy = turning.worldToLocal(h.point.clone()).y;
      return !u || (yy >= u.hideAbove.value && yy <= u.hideBelow.value);
    });
    const local = turning.worldToLocal((hit?.point ?? new THREE.Vector3(x, yAt(0), 0)).clone());
    const { part, e } = (hit?.object.userData ?? { part: 'air', e: 0 }) as { part: PickPart; e: number };
    return { part, e, p: [local.x, local.y, local.z] };
  };

  const project = (f: Frame, p: V3) => {
    const { A, B, C, D, E } = projection(f);
    const [c, sn] = [Math.cos(f.phi), Math.sin(f.phi)];
    // (Turned as the scene is: three's turn about y.)
    const X = p[0] * c + p[2] * sn;
    const Z = -p[0] * sn + p[2] * c;
    const nx = A * X + B;
    const ny = C * p[1] + D * Z + E;
    const r = Math.hypot(p[0], p[2]) || 1;
    return { x: ((nx + 1) / 2) * f.w, y: ((1 - ny) / 2) * f.h, facing: Z / r };
  };

  return {
    build,
    render,
    pick,
    project,
    dispose: () => {
      clear();
      renderer.dispose();
    },
  };
}
