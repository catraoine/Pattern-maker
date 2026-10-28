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
import type { ClothTiles } from './allRoundCloth';
import { RoundShape, WAIST } from './allRoundShape';

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Where a dress form's neck ends (ContourForm.tsx NECK_TOP). */
const NECK_TOP = -1.75;
/** The form's legs start a little above where its torso's rings end, so the two overlap. */
const LEG_TOP = 1.2;

type V3 = [number, number, number];

// Matching --gild, --gild-glow in styles.css.
const GILD = 0xd9c49b;
const GLOW = 0xf3e6c8;

/** How a surface is drawn: in its cloth (matte, with a gloss or a pile), as the black satin form, or plain black. */
type Mode = 'matte' | 'gloss' | 'pile' | 'satin' | 'black';
const MODE: Record<Mode, number> = { matte: 0, gloss: 1, pile: 2, satin: 3, black: 4 };

// The light of the style drawing (allRoundCloth.ts lightOf): from the front, high on the left, in the view's own frame
// (x right, y down, z toward you), and the satin's colours (ContourForm.tsx satinColour).
const VERT = /* glsl */ `
varying vec3 vN;
varying vec2 vUv;
varying float vY;
void main() {
  vN = normalize(normalMatrix * normal);
  vUv = uv;
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform float scale;
uniform int mode;
uniform float opacity;
uniform float dimLit;
uniform float dimShine;
uniform float hideAbove;
uniform float hideBelow;
varying vec3 vN;
varying vec2 vUv;
varying float vY;
const vec3 L = normalize(vec3(-0.5, -0.42, 0.76));
const vec3 H = normalize(vec3(-0.5, -0.42, 1.76));
void main() {
  if (vY < hideAbove || vY > hideBelow) discard;
  vec3 n = normalize(vN);
  float lit;
  float shine;
  if (n.z < 0.0) {
    // Seen from inside (the back of the garment through its neck): in shadow.
    lit = 0.42;
    shine = 0.0;
  } else {
    float d = max(0.0, dot(n, L));
    if (mode == 2) {
      lit = 0.22 + 0.7 * d * (0.4 + 0.6 * n.z);
      shine = 0.18 * pow(1.0 - n.z, 3.0);
    } else {
      lit = (0.3 + 0.75 * pow(d, 1.15)) * (0.72 + 0.28 * n.z);
      shine = (mode == 1 || mode == 3) ? pow(max(0.0, dot(n, H)), 18.0) * 0.75 : 0.0;
    }
  }
  vec3 c;
  if (mode == 3) {
    float t = clamp((lit * dimLit - 0.25) / 0.8, 0.0, 1.0);
    float k = min(1.0, shine * dimShine * 1.4);
    vec3 base = mix(vec3(5.0, 5.0, 5.0), vec3(62.0, 55.0, 42.0), t) / 255.0;
    c = base + (vec3(95.0 / 255.0) - base) * k;
  } else if (mode == 4) {
    c = vec3(0.0);
  } else {
    vec3 tex = texture2D(map, vUv * scale).rgb;
    c = tex * min(lit, 1.0);
    c = c + shine - c * shine;
  }
  gl_FragColor = vec4(c, opacity);
}`;

function material(mode: Mode, map?: THREE.Texture, scale = 1, opacity = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      map: { value: map ?? null },
      scale: { value: scale },
      mode: { value: MODE[mode] },
      opacity: { value: opacity },
      dimLit: { value: 1 },
      dimShine: { value: 1 },
      hideAbove: { value: -1e9 },
      hideBelow: { value: 1e9 },
    },
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

/** A surface swept round: `at(a, t)` its point at angle a and fraction t down it, `out` which way is outside. */
interface Sweep {
  at: (a: number, t: number) => V3;
  uv?: (a: number, t: number) => [number, number];
  out: (a: number, t: number) => V3;
  /** Fraction down the surface for row j of NT: rows closer together at the top where the cloth turns over a shoulder. */
  rowT?: (j: number, NT: number) => number;
}

/** The surface as a mesh: its points, their normals (from the surface's own slope) and the cloth's cm under them. */
function sweep(s: Sweep, a0: number, a1: number, NA: number, NT: number): THREE.BufferGeometry {
  const rowT = s.rowT ?? ((j, n) => j / n);
  const pos = new Float32Array((NA + 1) * (NT + 1) * 3);
  const nor = new Float32Array((NA + 1) * (NT + 1) * 3);
  const uv = new Float32Array((NA + 1) * (NT + 1) * 2);
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

/** What the mesh is built for. */
export interface BuildOptions {
  round: RoundGarment;
  sh: RoundShape;
  cloth?: ClothTiles;
  film: boolean;
  striped: boolean;
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
}

export interface RoundView {
  build(o: BuildOptions): void;
  /** Draw the frame; the canvas returned is clear where there is nothing, to lay over the backdrop. */
  render(f: Frame): HTMLCanvasElement;
  dispose(): void;
}

/** The view, or nothing where the browser has no WebGL (the canvas painter draws then). */
export function createRoundView(): RoundView | undefined {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
  } catch {
    return undefined;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
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
    const { trousers, isTop, yAt, yOf, kY, longest, highest, bandTop, arm, yS, yU, sl, rh, radius, shell, clothDown, yE, yCap, axisX, capDepth, sleeveR, lg, yC, yH, legHemR, legR, rAt } = sh;
    const k = 1 / kY; // cm of cloth to a unit of the form
    const add = (geo: THREE.BufferGeometry, mat: THREE.ShaderMaterial, order = 1) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = order;
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
      return P(a, bodyReach(bodyHalf(Math.min(yy, 1.3)), a, yy), y);
    };
    const satin = material('satin');
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
    add(sweep({ at: (a, t) => bodyAt(a, NECK_TOP + (BODY_BOTTOM - NECK_TOP) * t), out: radial, rowT: bodyRow }, -Math.PI, Math.PI, 96, 120), satin, 0);
    const neck = material('satin');
    neck.uniforms.dimLit.value = 0.85;
    neck.uniforms.dimShine.value = 0.5;
    add(cap((a) => bodyAt(a, NECK_TOP), [0, -1, 0]), neck, 0);
    for (const leg of [-1, 1]) {
      const legs = material('satin');
      add(sweep({ at: (a, t) => T(leg * FORM_LEG_X, a, FORM_LEG(LEG_TOP + (FORM_FLOOR - LEG_TOP) * t), LEG_TOP + (FORM_FLOOR - LEG_TOP) * t), out: radial }, -Math.PI, Math.PI, 48, 60), legs, 0);
    }

    // The cloth: the garment's body from its top edge (or the armhole, under the arms) to its hem (the crotch on
    // trousers), front and back cut as their own panels so a print breaks at the side seams as cut cloth does.
    const clothMaterial = (tiles: HTMLCanvasElement, size: number) => {
      const tex = new THREE.CanvasTexture(tiles);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = maxAniso;
      disposables.push(tex);
      return material(cloth?.sheen === 'gloss' ? 'gloss' : cloth?.sheen === 'pile' ? 'pile' : 'matte', tex, 1 / size, cloth?.sheer ? 0.6 : 1);
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
    const tube = (X: (y: number) => number, R: (y: number) => number, y0: number, y1: number, panels: boolean, Z: (y: number) => number = () => 1) => {
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
      const geo = (c: number, a0: number, a1: number) =>
        sweep(
          {
            at: (a, t) => {
              const y = rowY(t);
              const r = R(y);
              return T(X(y), a, r, y, r * Z(y));
            },
            uv: (a, t) => {
              const y = rowY(t);
              const r = R(y);
              // Over the crown the cloth is laid at the arm's own width, or the print squeezes into streaks at its top.
              return [(a - c) * Math.max(r, R(y1) * 0.8) * k, downAt(t) * k];
            },
            out: (a) => radial(a),
          },
          a0,
          a1,
          48,
          NY,
        );
      if (panels) {
        add(geo(0, -HALF, HALF), clothMat());
        add(geo(Math.PI, HALF, 3 * HALF), clothMat());
      } else add(geo(0, -Math.PI, Math.PI), clothMat());
    };
    // In lines the sleeves and trouser legs are lines alone, as the canvas painter drew them; in cloth they are cloth.
    if (cloth && sl && arm) for (const e of [1, -1]) tube((y) => e * axisX(y), sleeveR, yCap, yE, false, capDepth);
    if (cloth && lg) for (const leg of [-1, 1]) tube(() => leg * FORM_LEG_X, legR, yC, yH, true);

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
    const legX = (leg: number) => leg * FORM_LEG_X;
    const spot = (p: RoundPt, leg?: number) => {
      const y = leg ? yOf(p.cm) : yAt(p.phi, p.cm);
      return leg ? onTube(legX(leg), p.phi, legR(y), y) : onCloth(p.phi, y, rAt);
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
    const grooveDark = lines({ colour: 0x000000, width: 1.8, alpha: 0.45, graze: 0.3 });
    const grooveLight = lines({ colour: GLOW, width: 0.5, alpha: 0.5, graze: 0.3 });
    const seams = cloth ? undefined : lines({ colour: GLOW, width: 1.1, back: 0.25 });
    for (const r of round.rings) {
      if (cloth) {
        ring(grooveDark, (a) => yAt(a, r(a)));
        ring(grooveLight, (a) => yAt(a, r(a)));
      } else ring(lines({ colour: GLOW, width: 0.9, back: 0.25 }), (a) => yAt(a, r(a)));
    }
    if (round.bandCm) {
      ring(lines({ colour: GLOW, width: 0.8, back: 0.2 }), () => bandTop, (_a, y) => radius(y));
      // The band's sides, down from its top to the waist, at the garment's edge.
      const sides = new Lines({ colour: GLOW, width: 1, onTop: true }, still);
      lineSets.push(sides);
      for (const e of [-1, 1]) sides.add([{ p: [e * radius(WAIST), bandTop, 0], n: [0, 0, 1] }, { p: [e * radius(WAIST), WAIST, 0], n: [0, 0, 1] }]);
    }
    const dartStyle: Style = cloth ? { colour: 0x000000, width: 1.8, alpha: 0.4, graze: 0.3 } : { colour: GILD, width: 0.8, back: 0.2, alpha: film ? 0.5 : 1 };
    const darts = lines(dartStyle);
    const dartsLight = cloth ? lines({ colour: GLOW, width: 0.5, alpha: 0.45, graze: 0.3 }) : undefined;
    for (const dt of round.darts) {
      along(darts, [dt.base, dt.tip]);
      if (dartsLight) along(dartsLight, [dt.base, dt.tip]);
    }
    const seamDark = cloth ? lines({ colour: 0x000000, width: 2, alpha: 0.45, graze: 0.3 }) : undefined;
    const seamLight = cloth ? lines({ colour: GLOW, width: 0.55, alpha: 0.5, graze: 0.3 }) : undefined;
    for (const sm of round.seams) {
      if (sm.kind === 'sleeve') continue;
      if (seamDark && seamLight) {
        along(seamDark, sm.pts, sm.leg);
        along(seamLight, sm.pts, sm.leg);
      } else if (seams) along(seams, sm.pts, sm.leg);
    }
    if (round.vent) {
      const vent = lines({ colour: GILD, width: 0.8, back: 0.2 });
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
        const under = lines({ colour: GLOW, width: 1, back: 0.2 });
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
      for (const leg of [-1, 1]) hems.curve(48, (i) => onTube(legX(leg), -Math.PI + (TAU * i) / 48, legHemR, yH));
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
                return { p: [legX(leg) * c + e * legR(y), y, -legX(leg) * s], n: [0, 0, 1] };
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
    const { phi, w, h, dpr, S, cx, top, lw } = f;
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
    // The view's own projection, as the canvas painter laid it: x across by the scale, y down by the scale and a
    // little by the depth (seen from a touch above), nothing shrinking with distance.
    const A = (2 * S) / w;
    const B = (2 * cx) / w - 1;
    const C = (-2 * S) / h;
    const D = (-2 * S * FORM_DEPTH) / h;
    const E = 1 - (16 - 2 * top * S) / h;
    camera.projectionMatrix.set(A, 0, 0, B, 0, C, D, E, 0, 0, -0.25, 0, 0, 0, 0, 1);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    turning.rotation.y = phi;
    renderer.render(scene, camera);
    return renderer.domElement;
  };

  return {
    build,
    render,
    dispose: () => {
      clear();
      renderer.dispose();
    },
  };
}
