// A garment's pieces laid round the body and sewn: each piece as cloth (mesh2d.ts), placed near where it is worn, its
// seams, darts, collar and sleeves joined by the outline's own tags, then settled on the body (sim.ts). What comes back
// is the cloth as the pattern cuts it, so whatever the pattern has (a peplum, a collar, a lapel turned back) is there.
import { P, Path, p as pt, sub } from '../geometry';
import type { TierBand } from '../skirtVolume';
import { Piece } from '../piece';
import type { BodiceDraft } from '../bodice';
import type { OuterDraft } from '../outerwear';
import type { SleeveDraft } from '../sleeve';
import type { DressDraft } from '../dress';
import type { SkirtDraft } from '../skirt';
import type { TrousersDraft } from '../trousers';
import { Mesh2D, Wedge, meshPiece } from './mesh2d';
import { BODY_BOTTOM, BODY_TOP, bodyHalf, shapeAt } from '../body';
import { dartsOf } from '../marks';
import { yokesJoined } from '../seams';
import { SimInput, simulate } from './sim';
import { trouserDetails } from './trouserLines';
import { levelSkirtHem } from './levelHem';
import { closeHemCorners } from './hemCorners';
import { Space, boxed } from './space';
import { knob, setKnob } from './knob';
import { frontPins, tapeRollLines } from './rollLine';
import { fairFrontCentre } from './fairFront';
import { pressCollar, standStiff } from './structured';
import { CollarOnFront, collarOnFront } from './collarEnd';
import { cropHold } from './cropHold';
import { flutterPlace } from './flutter';
import { closeBalloonHem } from './balloonHem';
import { capeForDrape } from './cape';
import { heavyChainK } from './heavyHold';
import { wholeSkirt } from './wholeSkirt';
import { fullHemLevel } from './hemWidth';
import { droppedFlareCut, selfGap } from './skirtApart';
import { madeUpSkirt } from '../skirtPockets';

type V3 = [number, number, number];
const TAU = Math.PI * 2;

export interface Panel {
  pc: Piece;
  mesh: Mesh2D;
  /** Where on the body each point starts, and how far off the body it lies. */
  start: V3[];
  thick: number[];
  /** First point's index among all the garment's points. */
  base: number;
  role: 'front' | 'back' | 'sleeve' | 'collar' | 'peplum-front' | 'peplum-back';
  /** Points that are the turned-back side of the cloth (a lapel, a collar's fall). */
  turned: boolean[];
  /** The roll lines this piece turns back at. */
  folds?: [P, P][];
  /** Sewn in for the hang, not drawn: a layer the cloth over it hides (a balloon's underskirt). */
  hidden?: boolean;
  /** A raglan sleeve's shoulder piece: the points of it that lie on the body's shoulder, not round the arm. */
  yoke?: boolean[];
}

export interface Draped {
  panels: Panel[];
  pos: Float64Array;
  /** Seams to draw: runs of points, by kind. */
  lines: { kind: string; ids: number[] }[];
  buttons: { at: V3; r: number }[];
  /** How much each point lies in shadow its mesh is too coarse to cast (inside a pressed pleat), 0 to 1. */
  shade?: Float32Array;
  /** The seams as sewn: point i on the line between j and k, a share t along it (for the quality check). */
  seams?: SimInput['seams'];
  /** The settled points before a side slit was parted: what the mirrored half (the wearer's right, with no slit) is drawn
   *  from, so a slit up the left side seam shows on the left alone (the All round eye check, 2026-11-02). */
  posMirror?: Float64Array;
}

interface Chain {
  ids: number[];
  s: number[];
}

/** The ring of the body at level c, out by `off` cm: the point `arc` cm round from the centre front (or back), toward the wearer's left. */
/** Half the body's ring at a level, from the centre back round to the centre front. */
function halfRing(sp: Space, c: number): number {
  return arcFromBack(sp, 0, c) || 1;
}

/** How far round the body's ring at a level a point at this angle lies, from the centre back (the inverse of ringAt). */
function arcFromBack(sp: Space, angle: number, c: number, rOf: (a: number, c: number) => number = (a, c) => sp.bodyR(a, c)): number {
  const a1 = Math.abs(angle);
  let t = 0;
  let [px, pz] = [0, -rOf(Math.PI, c)];
  const n = Math.max(1, Math.ceil((Math.PI - a1) / 0.01));
  for (let k = 1; k <= n; k++) {
    const a = Math.PI - ((Math.PI - a1) * k) / n;
    const r = rOf(a, c);
    const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
    t += Math.hypot(x - px, z - pz);
    [px, pz] = [x, z];
  }
  return t;
}

function ringAt(sp: Space, arc: number, c: number, back: boolean, off: number, rOf: (a: number, c: number) => number = (a, c) => sp.bodyR(a, c)): V3 {
  const sign = arc < 0 ? -1 : 1;
  let left = Math.abs(arc);
  const da = 0.01;
  let a = back ? Math.PI : 0;
  const dir = back ? -1 : 1;
  const pt = (aa: number): [number, number] => {
    const r = rOf(aa, c) + off;
    return [Math.sin(aa) * r, Math.cos(aa) * r];
  };
  let [px, pz] = pt(a);
  for (let k = 0; k < 800 && left > 0; k++) {
    const na = a + dir * da;
    const [nx, nz] = pt(na);
    const step = Math.hypot(nx - px, nz - pz);
    if (step >= left) {
      const u = left / step;
      px += (nx - px) * u;
      pz += (nz - pz) * u;
      left = 0;
      break;
    }
    left -= step;
    a = na;
    px = nx;
    pz = nz;
  }
  // Past half way round, carry on round the far side.
  return [px * sign, c, pz];
}

/** How far a point lies from the line through a and b. */
function distLine(q: P, l: [P, P]): number {
  const [a, b] = l;
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  return Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / L;
}

function reflect(q: P, a: P, b: P): P {
  const d = sub(b, a);
  const l2 = d.x * d.x + d.y * d.y;
  const t = ((q.x - a.x) * d.x + (q.y - a.y) * d.y) / l2;
  const fx = a.x + d.x * t;
  const fy = a.y + d.y * t;
  return { x: 2 * fx - q.x, y: 2 * fy - q.y };
}

class Builder {
  panels: Panel[] = [];
  n = 0;
  constructor(public sp: Space) {}

  add(pc: Piece, role: Panel['role'], place: (q: P, turned: boolean) => V3, thick: number, folds: [P, P][] = [], h = 1.6, creases: [P, P][] = []): Panel {
    const wedges = dartsOf(pc).map(({ near, tip, far }) => [near, tip, far] as Wedge);
    // A fish-eye dart (top, side, bottom, side, back to the top) is two darts point to point across the waist.
    for (const ln of pc.lines) {
      const q = ln.points();
      if (q.length === 5 && Math.hypot(q[0].x - q[4].x, q[0].y - q[4].y) < 1e-6 && Math.abs(q[0].x - q[2].x) < 0.6 && Math.abs(q[1].y - q[3].y) < 0.6 && Math.abs(q[1].x - q[0].x) > 0.1) wedges.push([q[1], q[0], q[3]], [q[1], q[2], q[3]]);
    }
    const mesh = meshPiece(pc, h, folds, wedges, creases);
    const turned = mesh.pts.map((_, i) => mesh.side.some((s) => s[i] === 1));
    const start = mesh.pts.map((q, i) => place(q, turned[i]));
    const p: Panel = { pc, mesh, start, thick: mesh.pts.map((_, i) => thick + (turned[i] ? 0.8 : 0)), base: this.n, role, turned, folds };
    this.n += mesh.pts.length;
    this.panels.push(p);
    return p;
  }

  /** A tag's runs on these panels, oriented and ordered by `key` (smallest first), joined into one chain. */
  chain(panels: Panel[], tag: string, key: (q: P) => number, keep?: (q: P) => boolean): Chain {
    const runs: { ids: number[]; pts: P[]; k: number }[] = [];
    for (const p of panels) {
      for (const r0 of p.mesh.runs[tag] ?? []) {
        // (Only the points kept: one side of a piece cut whole.)
        const r = keep ? r0.filter((i) => keep(p.mesh.pts[i])) : r0;
        if (r.length < 2) continue;
        let pts = r.map((i) => p.mesh.pts[i]);
        let ids = r.map((i) => i + p.base);
        if (key(pts[0]) > key(pts[pts.length - 1])) {
          pts = [...pts].reverse();
          ids = [...ids].reverse();
        }
        runs.push({ ids, pts, k: key(pts[0]) });
      }
    }
    runs.sort((a, b) => a.k - b.k);
    const ids: number[] = [];
    const s: number[] = [];
    let total = 0;
    for (const r of runs) {
      r.pts.forEach((q, i) => {
        if (i) total += Math.hypot(q.x - r.pts[i - 1].x, q.y - r.pts[i - 1].y);
        ids.push(r.ids[i]);
        s.push(total);
      });
    }
    return { ids, s };
  }
}

/** Each point of one chain sewn to the same share of the way along the other, both ways. */
function sew(seams: SimInput["seams"], A: Chain, B: Chain) {
  if (knob("__dbg")) console.log("sew", A.ids.length, (A.s[A.s.length - 1] ?? 0).toFixed(1), B.ids.length, (B.s[B.s.length - 1] ?? 0).toFixed(1));
  if (A.ids.length < 2 || B.ids.length < 2) return;
  const one = (X: Chain, Y: Chain) => {
    const LX = X.s[X.s.length - 1] || 1;
    const LY = Y.s[Y.s.length - 1] || 1;
    X.ids.forEach((i, n) => {
      const target = (X.s[n] / LX) * LY;
      let k = 1;
      while (k < Y.s.length - 1 && Y.s[k] < target) k++;
      const d = Y.s[k] - Y.s[k - 1];
      const t = d > 1e-9 ? Math.max(0, Math.min(1, (target - Y.s[k - 1]) / d)) : 0;
      seams.push({ i, j: Y.ids[k - 1], k: Y.ids[k], t });
    });
  };
  one(A, B);
  one(B, A);
}

/** Each dart's two legs, from its point. */
function dartLegs(p: Panel): [Chain, Chain][] {
  const leg = (idx: number[]): Chain => {
    const s: number[] = [];
    let t = 0;
    idx.forEach((i, n) => {
      if (n) t += Math.hypot(p.mesh.pts[i].x - p.mesh.pts[idx[n - 1]].x, p.mesh.pts[i].y - p.mesh.pts[idx[n - 1]].y);
      s.push(t);
    });
    return { ids: idx.map((i) => i + p.base), s };
  };
  return p.mesh.darts.map(([a, b]) => [leg(a), leg(b)]);
}

// (A hood is drafted as a shell piece; the drape hangs it from the neck as it does a collar.)
export const isShell = (pc: Piece) => !pc.kind && !pc.meta.hood;

interface TorsoPiece {
  pc: Piece;
  back: boolean;
  waistY: number;
  folds?: [P, P][];
  /** Lines the cloth's mesh runs along without turning there: a seam drawn across a piece draped whole. */
  creases?: [P, P][];
}

export interface DrapeOptions {
  /** A shirt worn open above a button: the roll line (break at the front edge, to just inside the neck point) the
   *  fronts above it turn back along, as a soft lapel. */
  rollFront?: [P, P];
  /** A skirt's side slit drawn open (the drape is of one half, mirrored: a slit on one side only is drawn by draping
   *  the skirt both ways and showing each side from its own). */
  openSlit?: boolean;
  thick?: number;
  bendK?: number;
  /** Buttons at these levels (cm in the front's own frame), at the centre front. */
  buttons?: { y: number[]; r: number; waistY: number; /** A double-breasted front's two columns, across from the centre. */ x?: number[]; /** Its pair for show, above. */ show?: { y: number; x: number[] } };
  pad?: number;
  /** A front closed all the way down (buttons, a shirt): its centre front held on the centre plane. */
  closedFront?: boolean;
  /** Hold the centre front on the centre plane at these heights (the buttoned front of an open jacket). */
  pinFront?: { y: number; span: number }[];
  /** Buttoned only above this level (the front's own pattern y): below it the fronts hang open, as a cardigan worn
   *  with its lower buttons undone. */
  openBelowY?: number;
  /** Buttoned only below this level: above it the top buttons are undone and the fronts fall open. */
  openAboveY?: number;
  /** Below this level (the front's own pattern y) the fronts hang parted: each centre front edge held off the centre
   *  line by `cm` at the level `to` (its hem), in proportion between (a shirt worn with one button done up). */
  partBelow?: { y: number; cm: number; to: number };
  /** A jacket or coat's buttoned extension laid over the other front (see the drape's passes). */
  layExtension?: boolean;
  /** How much harder than the light pull a skirt's cloth hangs (clothCard.ts: a fluid or heavy cloth). */
  fall?: number;
  /** Which cloth the fall pulls: a skirt's every panel, or a dress's skirt (left off a top: see drape()). */
  fallOn?: 'all' | 'skirt';
  /** How the cloth the fall pulls bends against the rest (clothCard.ts: a fluid cloth pours in its skirt, a denim
   *  stands out; a bodice and sleeves bent as the skirt folded into fins). */
  skirtBend?: number;
  /** How much of its hold a woven skirt's cloth loses on the bias, at 45 degrees to its grain (clothCard.ts, B). */
  bias?: number;
  /** How far the cloth gives along its length (a knit), 0 to about 0.4. */
  stretch?: number;
  /** Crisp cloth (organza, taffeta): a peplum this many times stiffer, so it stands out rather than hangs. */
  crisp?: number;
  /** A jacket or coat in a stiff cloth (denim, leather), not crisp: bent this hard, held its own shape as a crisp one is
   *  (STIFF_BEND at most), Fabric behaviour round 6. */
  stiffBend?: number;
  /** An unshaped top: hangs from the bust and shoulder blades as a curtain, in a few long folds. */
  curtain?: boolean;
  /** A dress: its bodice carries the skirt's weight. */
  heavySkirt?: boolean;
  /** Cut boxy: the cloth falls straight from the bust to the hip rather than in under the bust. */
  boxy?: boolean;
  /** A jacket or coat in a crisp cloth: it stands away from the body below the underarm (structured.ts). */
  stiff?: boolean;
  /** A stiff jacket or coat cut with no waist shaping (boxy, oversized): held straight down past the waist (structured.ts). */
  boxCut?: boolean;
  /** How hard a stiff jacket's body bends, at most (STIFF_BEND; a hooded one's HOOD_BEND). */
  stiffMax?: number;
  /** Lapels and collar falls held pressed onto the cloth they turn over (a lapel breaking well above the waist). */
  lieLapel?: boolean;
  /** The skirt's hem is cut unlevel on purpose (a high-low, a diagonal, a shaped hem): it is not let down to level. */
  shapedHem?: boolean;
  /** The sleeve's crown is cut flat to a dropped shoulder (a knit tee's): it has next to nothing to ease, so none is
   *  shrunk away. */
  flatCrown?: boolean;
}

interface CollarPart {
  pc: Piece;
  roll?: [P, P];
  /** A tailored collar's roll line where it bends down toward the gorge, past the neck point (see bentRoll). */
  roll2?: [P, P];
  /** Sewn to the top of a collar stand, not to the neck. */
  onStand?: boolean;
}

/** How much stiffer a coat's faced front edge bends than its cloth: about 1.4 times plain wool's stiffness, which
 *  the sim holds steady (much past that it blows up). */
const FACED = (o: { bendK?: number }) => Math.min(12, 1.4 / (o.bendK ?? 0.05));
/** The most a stiff jacket's bend is pulled back toward its rest in one pass: past 2 the sim overshoots and the cloth
 *  flies apart (2026-11-07). */
const STIFF_BEND_MAX = 1.4;
/** A jacket or coat in a crisp cloth holds its own shape: a boxy vest stands off the body, its seams straight, not
 *  draped onto it (Cat, 2026-11-07); 1.4 since Cat's "stiffer" (2026-11-08), every option passing. Past that a vest's
 *  shoulders flared out like wings and its armholes gaped. */
const STIFF_BEND = 1.4;
/** A stiff jacket's hood bends no harder than this: at STIFF_BEND it stretched round the face (2026-11-08). */
const HOOD_BEND = 1;
const stiffBendNow = () => knob('__stiffBend') ?? STIFF_BEND;
/** How far off the body a stiff jacket's cloth lies, at most, in cm: a leather's 0.6 left a high lapel's laid collar
 *  rippled along its edges (2026-11-08), where at a wool's 0.5 it lies flat and straight. */
const STIFF_THICK = 0.5;

/** A full circle skirt (more than a half circle round its waist): its hem's fullness starts in flutes clear of the
 *  body, and a fluid cloth's softer bend and harder fall folded them through each other into fins (39 times the limit
 *  on a silk circle dress, Fabric behaviour 2026-11-07), so it hangs as before. (Each piece here is a half piece: a
 *  half circle's front and back cover 90 degrees between them, a full circle's 180.) */
const fullCircle = (skirt: Piece[] | undefined) => (skirt ?? []).filter((pc) => pc.meta.waistRadius).reduce((t, pc) => t + ((pc.meta.angleDeg as number) ?? 0), 0) > 135;

/** A heavily gathered panel, drawn in across its width for the sim: cloth this full folds over itself, which the sim
 *  (no cloth-on-cloth contact) shows as tears. It hangs as a panel of SIM_GATHER fullness, and its folds are laid on
 *  for drawing at the real fullness. */
const SIM_GATHER = 1.8;
function narrowed(pc: Piece): Piece {
  const g = (pc.meta.gathered as number | undefined) ?? 1;
  if (g <= SIM_GATHER || pc.meta.waistRadius || knob("__noNarrow")) return pc;
  const sx = SIM_GATHER / g;
  const o = pc.outline;
  const f = (q: P) => pt(q.x * sx, q.y);
  const m = new Path(f(o.start));
  o.segs.forEach((sg, i: number) => (sg.kind === 'L' ? m.line(f(sg.to), o.tags[i]) : m.curve(f(sg.c1), f(sg.c2), f(sg.to), o.tags[i])));
  m.closed = true;
  return { ...pc, outline: m, lines: [], meta: { ...pc.meta, gathered: SIM_GATHER, gatherShown: g, simScale: sx } };
}

/** Where a closed outline crosses the level y: its leftmost and rightmost x there. */
function spanOf(pts: P[], y: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
    const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return [lo, hi];
}

type PleatFold = { top: P; hip: P; hem: P };
/** How wide the shadow under a knife pleat's fold edge is, on cloth pleated s cm apart. */
const shadowW = (s: number) => Math.min(1, s * 0.19);
// (Wider than the mesh drops as a duplicate point, h × 0.3, so the strip keeps its own edge points.)
const SHADOW_CORE = 0.45;
/** How wide the light caught along a pressed fold edge is, on the face just past it. */
const FOLD_SHINE = 0.45;
/** Where a pleated piece's mesh is cut so its edges run straight down each fold (and, on a knife pleat, down the
 *  edge of the shadow under it), so the fold's step and its shadow are crisp lines, not the mesh's stagger. */
function creasesOf(pc: Piece): [P, P][] {
  const folds = pc.meta.pleatFolds as PleatFold[] | undefined;
  if (!folds || folds.length < 2) return [];
  // (An inverted pleat: only the fold edge down the V; its first fold is the centre line itself.)
  if (pc.meta.pleatKind === 'inverted') return [[folds[1].hip, folds[1].hem]];
  const out: [P, P][] = folds.map((f) => [f.hip, f.hem]);
  if (pc.meta.pleatKind !== 'box') {
    const w = shadowW(folds[1].hip.x - folds[0].hip.x);
    // (Two lines: the shadow deepens from the outer one to the inner, and is darkest from there to the fold.)
    for (const f of folds) for (const v of [w, SHADOW_CORE, -FOLD_SHINE]) out.push([pt(f.hip.x - v, f.hip.y), pt(f.hem.x - v, f.hem.y)]);
  }
  return out;
}
/** Where pleat fold k lies across the worn skirt at the level y (straight from the hip down, in to the waist above). */
function foldAt(f: PleatFold, y: number): number {
  if (y <= f.hip.y) return f.top.x + ((f.hip.x - f.top.x) * (y - f.top.y)) / (f.hip.y - f.top.y || 1);
  return f.hip.x + ((f.hem.x - f.hip.x) * (y - f.hip.y)) / (f.hem.y - f.hip.y || 1);
}

/** A pleated skirt piece as it is worn: its pleats pressed closed, so the underlay each is spread by folds away
 *  under the face. The sim hangs the piece at that width (the spread piece would stand out round the body as one
 *  open sheet); the folds are laid on for drawing. */
function pleatClosed(pc: Piece, folds: PleatFold[], kind: string): Piece {
  if (folds.length < 2) return pc;
  const { pts } = pc.outline.taggedPoints(12);
  const last = folds[folds.length - 1];
  const prev = folds[folds.length - 2];
  const wornAt = (y: number) => foldAt(last, y) + (foldAt(last, y) - foldAt(prev, y)) / 2;
  const f = (q: P) => {
    const [, hi] = spanOf(pts, Math.min(Math.max(q.y, folds[0].top.y + 0.2), folds[0].hem.y - 0.2));
    return pt(q.x * Math.min(1, wornAt(q.y) / (hi > 0 ? hi : 1)), q.y);
  };
  const o = pc.outline;
  const m = new Path(f(o.start));
  o.segs.forEach((sg, i) => (sg.kind === 'L' ? m.line(f(sg.to), o.tags[i]) : m.curve(f(sg.c1), f(sg.c2), f(sg.to), o.tags[i])));
  m.closed = true;
  return { ...pc, outline: m, lines: [], meta: { ...pc.meta, pleatFolds: folds, pleatKind: kind } };
}

/** An inverted pleat's piece as worn: its two folds meet at the centre, stitched closed to the hip (the back's from
 *  where its pleat starts, below the zip), and part below it into a narrow V to the hem with the underlay in shadow.
 *  The extension behind the pleat is left off (it lies hidden behind the face, and sewn open it hung as a wide open
 *  sheet with a gaping V down the centre, All round quality 2026-11-04): the face is draped as cut, and the pleat
 *  drawn on it as a crisp fold edge down the V with the cloth inside it set in and darkened. */
function invertedClosed(pc: Piece, inv: { depth: number; backFrom?: number }): Piece {
  const { pts, tags } = pc.outline.taggedPoints(12);
  const top = Math.min(...pts.map((q) => q.y));
  const hem = Math.max(...pts.map((q) => q.y));
  const hipY = /back/i.test(pc.name) && inv.backFrom !== undefined ? top + inv.backFrom : pc.balance?.find((b) => b.label === 'HIP LINE')?.pts[0].y ?? top + 20;
  const out: P[] = [];
  const outTags: string[] = [];
  pts.forEach((q, i) => {
    const r = pt(Math.max(0, q.x), q.y);
    if (out.length && Math.abs(out[out.length - 1].x - r.x) < 1e-6 && Math.abs(out[out.length - 1].y - r.y) < 1e-6) return;
    out.push(r);
    outTags.push(q.x < -1e-6 || pts[(i + 1) % pts.length].x < -1e-6 ? 'fold' : tags[i]);
  });
  const path = new Path(out[0]);
  for (let i = 1; i < out.length; i++) path.line(out[i], outTags[i - 1]);
  path.line(out[0], outTags[out.length - 1]);
  path.closed = true;
  const open = Math.min(inv.depth, knob('__invOpen') ?? 2.5);
  const folds: PleatFold[] = [
    { top: pt(0, top), hip: pt(0, hipY), hem: pt(0, hem) },
    { top: pt(0, top), hip: pt(0, hipY), hem: pt(open, hem) },
  ];
  return { ...pc, outline: path, lines: [], meta: { ...pc.meta, pleatFolds: folds, pleatKind: 'inverted' } };
}

/** A pleated skirt too wide for one width of cloth is cut in two each side, a side panel seamed on inside a pleat
 *  where it never shows. Hung, each side is joined back into the one piece it was drafted as, so its pleats close up as
 *  one (closed and hung apart, the side panels closed against their own width alone and hung as loose flaps at the
 *  sides; Cat's SS27 vest set's pleated skirt, 2026-11-07). */
function joinPanels(pieces: Piece[]): Piece[] {
  if (knob('__splitPanels')) return pieces;
  const out: Piece[] = [];
  const used = new Set<Piece>();
  for (const pc of pieces) {
    if (used.has(pc)) continue;
    const side = /side/i.test(pc.name) ? undefined : pieces.find((o) => o !== pc && !used.has(o) && /side/i.test(o.name) && /back/i.test(o.name) === /back/i.test(pc.name) && o.outline.tags.includes('panel'));
    if (!side || !pc.outline.tags.includes('panel')) {
      out.push(pc);
      continue;
    }
    // (Each outline walked from the end of its panel seam round to its start, the two walks laid end to end.)
    const walk = (p: Piece) => {
      const { pts, tags } = p.outline.taggedPoints(12);
      const n = pts.length;
      const on = (i: number) => tags[((i % n) + n) % n] === 'panel';
      let end = 0;
      while (end < n && !(on(end - 1) && !on(end))) end++;
      const path: { q: P; tag: string }[] = [];
      for (let k = 0; k < n; k++) {
        const i = (end + k) % n;
        path.push({ q: pts[i], tag: tags[i] });
        if (on(i)) break;
      }
      return path;
    };
    const a = walk(pc);
    const b = walk(side);
    const all = [...a, ...b];
    const m = new Path(all[0].q);
    for (let i = 1; i < all.length; i++) m.line(all[i].q, all[i - 1].tag === 'panel' ? 'pleat' : all[i - 1].tag);
    m.line(all[0].q, all[all.length - 1].tag === 'panel' ? 'pleat' : all[all.length - 1].tag);
    m.closed = true;
    used.add(side);
    out.push({ ...pc, outline: m });
  }
  return out;
}

/** The skirt pieces to hang: pleated ones closed as worn. */
function hungSkirt(pieces: Piece[], vol?: { kind?: string; folds?: PleatFold[][]; godets?: { hemWidth: number; inSeams: boolean }; inverted?: { depth: number; backFrom?: number } }, size?: { hip?: number; hem?: number }): Piece[] {
  if (vol?.kind === 'godets' && vol.godets && !knob('__looseGodets')) return pieces.filter((pc) => !pc.meta.godet).map((pc) => godetsOpened(pc, vol.godets!));
  if (vol?.kind === 'inverted' && vol.inverted && !knob('__openPleats')) return pieces.map((pc) => (pc.meta.pleats === 'inverted' && pc.outline.taggedPoints(4).pts.some((q) => q.x < -1e-6) ? invertedClosed(pc, vol.inverted!) : pc));
  if (!vol?.folds?.length || (vol.kind !== 'knife' && vol.kind !== 'box') || knob('__openPleats')) return pieces;
  return joinPanels(pieces).map((pc) => (pc.meta.pleats ? pleatClosed(pc, wornFolds(vol.folds![/back/i.test(pc.name) ? 1 : 0] ?? vol.folds![0], size), vol.kind!) : pc));
}

/** A flared skirt's folds as worn, spread round the hip and out to the hem as its own finished hip and hem need:
 *  pressed closed as drafted, an A-line's pleats lie round less than its hip and hem, and hang straight down from the
 *  hip; worn, they open out below it, more toward the hem. Each fold is moved out in proportion. */
function wornFolds(folds: PleatFold[], size?: { hip?: number; hem?: number }): PleatFold[] {
  // (Only a flared skirt's: a straight one's pleats hang from the hip as drafted.)
  if (folds.length < 2 || !size?.hip || !((size.hem ?? 0) > size.hip * 1.05) || knob('__oldPleatWorn')) return folds;
  const n = folds.length;
  const reach = (k: 'top' | 'hip' | 'hem') => folds[n - 1][k].x + (folds[n - 1][k].x - folds[n - 2][k].x) / 2;
  const need = { hip: size.hip / 4, hem: Math.max(size.hip, size.hem ?? 0) / 4 };
  const sHip = Math.max(1, need.hip / (reach('hip') || 1));
  const sHem = Math.max(sHip, need.hem / (reach('hem') || 1));
  return folds.map((f) => ({ top: f.top, hip: pt(f.hip.x * sHip, f.hip.y), hem: pt(f.hem.x * sHem, f.hem.y) }));
}

/** A godet skirt's panel as the drape sews it: the godets' fullness is given to the panel itself. Each godet is a
 *  sector set into a slash from its point to the hem; here the panel's cloth beyond each slash is drawn out sideways
 *  by the godet's hem width, by nothing at the point and all of it at the hem, so the hem gains what the godets add
 *  and the skirt flares from the godets' height down, as it does worn. (Sewn as its own triangle, a godet hung loose
 *  below the hem, since its two edges are sewn to one line of the panel the mesh does not cut; All round quality,
 *  2026-11-04.) A side-seam godet gives half its width to each panel it sits between. */
function godetsOpened(pc: Piece, g: { hemWidth: number; inSeams: boolean }): Piece {
  const slashes = pc.meta.slashes as [P, P][] | undefined;
  if (!slashes?.length) return pc;
  const n = slashes.length;
  const shear = (q: P): P => {
    let out = q;
    slashes.forEach(([top, foot], k) => {
      const seam = g.inSeams && k === n - 1;
      const cross = (foot.x - top.x) * (q.y - top.y) - (foot.y - top.y) * (q.x - top.x);
      if (cross > 1e-6) return;
      const t = Math.max(0, Math.min(1, (q.y - top.y) / (foot.y - top.y || 1)));
      if (!t) return;
      // (Drawn out sideways, then kept as far from the godet's point as it was cut, as a sector's hem is from its
      // point: drawn out alone, the cloth beyond the slash was longer from the point to the hem and hung 9 cm lower
      // at the side than at the centre.)
      const R = Math.hypot(out.x - top.x, out.y - top.y);
      const moved = pt(out.x + (seam ? g.hemWidth / 2 : g.hemWidth) * t, out.y);
      const R2 = Math.hypot(moved.x - top.x, moved.y - top.y) || 1;
      out = knob('__godetNoRadius') ? moved : pt(top.x + ((moved.x - top.x) * R) / R2, top.y + ((moved.y - top.y) * R) / R2);
    });
    return out;
  };
  const { pts, tags } = pc.outline.taggedPoints(12);
  const path = new Path(shear(pts[0]));
  for (let i = 0; i < pts.length; i++) path.line(shear(pts[(i + 1) % pts.length]), tags[i]);
  path.closed = true;
  const lines = pc.lines.map((l) => {
    const ps = l.points(12).map(shear);
    const out = new Path(ps[0]);
    for (let i = 1; i < ps.length; i++) out.line(ps[i]);
    return out;
  });
  return { ...pc, outline: path, lines };
}

/** A wrap front's own half (x >= 0) as the half the drape sews, cut down the centre line (tagged as a fold): the far
 *  half, which laps over the other front, lies where the other front's mirror is drawn, so the drawing needs only
 *  this half and its mirror. (Sewn whole, both halves and their mirrors lay four deep over the chest and the form
 *  showed through the fighting layers; All round quality, 2026-11-03.) */
function ownHalf(pc: Piece): Piece {
  // (With a little of the far half kept past the centre, lapping over the other front as a buttoned front's extension
  // does: cut on the centre line itself, the front edge met the cut at a hair's angle below the cross and the mesh
  // left a keyhole there.)
  const X0 = -(knob('__wrapOver') ?? 2.5);
  const { pts, tags } = pc.outline.taggedPoints(12);
  const n = tags.length;
  const out: P[] = [];
  const outTags: string[] = [];
  const hit = (a: P, b: P): P => pt(X0, a.y + ((b.y - a.y) * (X0 - a.x)) / (b.x - a.x));
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ia = a.x >= X0;
    const ib = b.x >= X0;
    if (ia) {
      out.push(a);
      outTags.push(tags[i]);
      if (!ib) {
        out.push(hit(a, b));
        outTags.push('wrap');
      }
    } else if (ib) {
      out.push(hit(a, b));
      outTags.push(tags[i]);
    }
  }
  // (Points within a hair of each other are one point.)
  const ring: { pts: P[]; tags: string[] } = { pts: [], tags: [] };
  out.forEach((q, i) => {
    const last = ring.pts[ring.pts.length - 1];
    if (last && Math.hypot(last.x - q.x, last.y - q.y) < 1e-6) {
      ring.tags[ring.tags.length - 1] = outTags[i];
      return;
    }
    ring.pts.push(q);
    ring.tags.push(outTags[i]);
  });
  if (ring.pts.length > 1 && Math.hypot(ring.pts[0].x - ring.pts[ring.pts.length - 1].x, ring.pts[0].y - ring.pts[ring.pts.length - 1].y) < 1e-6) {
    ring.pts.pop();
    ring.tags.pop();
  }
  const path = new Path(ring.pts[0]);
  for (let i = 0; i < ring.pts.length; i++) path.line(ring.pts[(i + 1) % ring.pts.length], ring.tags[i]);
  path.closed = true;
  return { ...pc, outline: path, lines: pc.lines.filter((l) => l.points(2).every((q) => q.x >= X0 - 0.01)), meta: { ...pc.meta, whole: false } };
}

/** A piece cut whole (a bias slip) as the half the drape sews: its first half, closed down the centre line. */
function halfPiece(pc: Piece): Piece {
  if (!pc.meta.whole) return pc;
  const o = pc.outline;
  const n = o.segs.length / 2;
  if (!Number.isInteger(n)) return pc;
  const out = new Path(o.start);
  for (let i = 0; i < n; i++) {
    out.segs.push({ ...o.segs[i] });
    out.tags.push(o.tags[i]);
  }
  out.line(o.start, 'fold');
  out.closed = true;
  const right = out.taggedPoints(4).pts.reduce((t, q) => t + q.x, 0) >= 0;
  if (!right) {
    // The half drawn first lies left of the centre: turn it over.
    const m = new Path(pt(-o.start.x, o.start.y));
    for (let i = 0; i < out.segs.length; i++) {
      const sg = out.segs[i] as { kind: string; to: P; c1: P; c2: P };
      if (sg.kind === 'L') m.line(pt(-sg.to.x, sg.to.y), out.tags[i]);
      else m.curve(pt(-sg.c1.x, sg.c1.y), pt(-sg.c2.x, sg.c2.y), pt(-sg.to.x, sg.to.y), out.tags[i]);
    }
    m.closed = true;
    return { ...pc, outline: m, lines: [], meta: { ...pc.meta, whole: false } };
  }
  return { ...pc, outline: out, lines: pc.lines.filter((l) => l.points(2).every((q) => q.x >= -0.01)), meta: { ...pc.meta, whole: false } };
}

/** A piece turned over (x for -x). A back cut whole lies right side up with the wearer's left at x < 0, seen from
 *  behind; the drape places every piece with the wearer's left at x > 0, so a whole back is turned over first. */
export function mirrorPiece(pc: Piece): Piece {
  const o = pc.outline;
  const m = new Path(pt(-o.start.x, o.start.y));
  for (let i = 0; i < o.segs.length; i++) {
    const sg = o.segs[i] as { kind: string; to: P; c1: P; c2: P };
    if (sg.kind === 'L') m.line(pt(-sg.to.x, sg.to.y), o.tags[i]);
    else m.curve(pt(-sg.c1.x, sg.c1.y), pt(-sg.c2.x, sg.c2.y), pt(-sg.to.x, sg.to.y), o.tags[i]);
  }
  m.closed = o.closed;
  const ml = (l: Path) => {
    const q = new Path(pt(-l.start.x, l.start.y));
    for (let i = 0; i < l.segs.length; i++) {
      const sg = l.segs[i] as { kind: string; to: P; c1: P; c2: P };
      if (sg.kind === 'L') q.line(pt(-sg.to.x, sg.to.y), l.tags[i]);
      else q.curve(pt(-sg.c1.x, sg.c1.y), pt(-sg.c2.x, sg.c2.y), pt(-sg.to.x, sg.to.y), l.tags[i]);
    }
    q.closed = l.closed;
    return q;
  };
  return { ...pc, outline: m, lines: pc.lines.map(ml) };
}

/** A cowl front (cut whole on the bias, its grown-on facing above the fold) as the half the drape sews: its right half,
 *  cut off at the fold line, so the top edge is the cowl's fold from the centre front out to the neck point. The
 *  cloth above the bust is wider than the body by the spread the cowl was opened with: `meta.cowl` says how wide the
 *  top is (L, the neck point's distance from the centre), where the fold is (top) and where the body's lie begins
 *  (bustY), and the drape hangs that spare width in the cowl's own fall (see the placing in drape()). (Sewn whole,
 *  both halves lay four deep over the chest and hung as a rag, All round quality 2026-11-04.) */
function cowlFront(pc: Piece, bustY: number): Piece {
  const half = halfPiece(pc);
  const { pts, tags } = half.outline.taggedPoints(12);
  const iN = tags.indexOf('shoulder');
  if (iN < 0) return half;
  const N = pts[iN];
  const Y0 = N.y;
  const n = pts.length;
  const out: P[] = [];
  const outTags: string[] = [];
  const hit = (a: P, b: P): P => pt(a.x + ((b.x - a.x) * (Y0 - a.y)) / (b.y - a.y), Y0);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const ia = a.y >= Y0 - 1e-6;
    const ib = b.y >= Y0 - 1e-6;
    if (ia) {
      out.push(a);
      outTags.push(tags[i]);
      if (!ib) {
        out.push(hit(a, b));
        outTags.push('neck');
      }
    } else if (ib) {
      out.push(hit(a, b));
      outTags.push(tags[i]);
    }
  }
  const ring: { pts: P[]; tags: string[] } = { pts: [], tags: [] };
  out.forEach((q, i) => {
    const last = ring.pts[ring.pts.length - 1];
    if (last && Math.hypot(last.x - q.x, last.y - q.y) < 1e-6) {
      ring.tags[ring.tags.length - 1] = outTags[i];
      return;
    }
    ring.pts.push(q);
    ring.tags.push(outTags[i]);
  });
  if (ring.pts.length > 1 && Math.hypot(ring.pts[0].x - ring.pts[ring.pts.length - 1].x, ring.pts[0].y - ring.pts[ring.pts.length - 1].y) < 1e-6) {
    ring.pts.pop();
    ring.tags.pop();
  }
  // (The edge along the fold itself, from the shoulder's neck end in to the centre, is the cowl's top edge.)
  ring.tags = ring.tags.map((t, i) => (Math.abs(ring.pts[i].y - Y0) < 1e-6 && Math.abs(ring.pts[(i + 1) % ring.pts.length].y - Y0) < 1e-6 ? 'neck' : t));
  const path = new Path(ring.pts[0]);
  for (let i = 0; i < ring.pts.length; i++) path.line(ring.pts[(i + 1) % ring.pts.length], ring.tags[i]);
  path.closed = true;
  return { ...half, outline: path, lines: half.lines.filter((l) => l.points(2).every((q) => q.y >= Y0 - 0.01)), meta: { ...half.meta, cowl: { L: N.x, top: Y0, bustY } } };
}

export function drape(sp: Space, torso: TorsoPiece[], extra: { skirt?: Piece[]; drop?: number; cropped?: boolean; slitCm?: number; sleeve?: Piece[]; collars?: CollarPart[]; trousers?: TrousersDraft; tiers?: TierBand[]; under?: Piece[]; puff?: number; cuff?: number; cuffBand?: Piece; cuffRuffle?: Piece }, o: DrapeOptions): Draped {
  if (o.boxy) sp = boxed(sp);
  // (Not a skirt to be sewn whole, a diagonal hem's: wholeSkirt.ts.)
  if (extra.skirt) extra = { ...extra, skirt: extra.skirt.map((pc) => (pc.meta.sewWhole ? pc : halfPiece(pc))).map(narrowed) };
  const B = new Builder(sp);
  // A side slit's open edges (each point's distance up the seam from the hem), for the parting drawn after the sim.
  const slitEdges: { p: Panel; ids: number[]; toHem: Map<number, number>; sign: number }[] = [];
  const poppedPanels: Panel[] = [];
  const stiffPanels: { p: Panel; by: string; roll?: [P, P]; key: (q: P) => number; target?: Chain; on?: { panel: Panel; key: (q: P) => number }; carry?: (q: P) => boolean; hang?: (q: P, c0: number, fracNeck: number, cSeam: number) => V3 }[] = [];
  let legs: SimInput['legs'];
  const thick = o.thick ?? 0.35;
  const front: Panel[] = [];
  const back: Panel[] = [];
  const tipC = sp.tip.c;
  // A jacket or coat flared below the waist starts as the cone its cloth makes there (each level as wide round as
  // the pieces are across), so it settles with the flare held out from the hip rather than crushed in folds onto it.
  let widthAt: ((c: number) => number) | undefined;
  const coneOf = (() => {
    if (!o.pinFront?.length) return undefined;
    const outlines = torso.map((t) => ({ pts: t.pc.outline.taggedPoints(12).pts, waistY: t.waistY }));
    const spanAt = (pts: P[], y: number) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
        const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      return hi > lo ? hi - lo : 0;
    };
    // (Below a piece's own hem, as settled cloth can fall a few cm past where it is cut, the piece keeps its hem's width:
    // a long flared coat's last rows were given no width there, so its hem was left 4 cm inside the rows above it.)
    // (Read where the piece is still as wide as its hem, not at its lowest corner: hemWidth.ts.)
    const hemOf = outlines.map((o) => fullHemLevel(o.pts, (y) => spanAt(o.pts, y)));
    widthAt = (c: number) => 2 * outlines.reduce((t, o, i) => t + spanAt(o.pts, Math.min(c + o.waistY, hemOf[i])), 0);
    const cache = new Map<number, number>();
    return (c: number) => {
      if (c <= 0) return 1;
      const k = Math.round(c);
      if (!cache.has(k)) {
        const W = 2 * outlines.reduce((t, o) => t + spanAt(o.pts, k + o.waistY), 0);
        let G = 0;
        for (let i = 0; i < 72; i++) G += ((sp.bodyR((i / 72) * TAU - Math.PI, k) + thick + 1.5) * TAU) / 72;
        cache.set(k, Math.max(1, (W * (knob('__cone') ?? 0.9)) / G));
      }
      return cache.get(k)!;
    };
  })();
  // (Where the back's shoulder meets the neck: the arc round from the centre the front's neck point is sewn to.)
  const neckArc = (() => {
    const b = torso.find((t) => t.back);
    if (!b) return 6.5;
    const { pts, tags } = b.pc.outline.taggedPoints(4);
    const xs = pts.filter((_, i) => tags[i] === 'shoulder' || tags[(i - 1 + tags.length) % tags.length] === 'shoulder').map((q) => Math.abs(q.x));
    return xs.length ? Math.min(...xs) : 6.5;
  })();
  for (const t of torso) {
    const fold = t.folds?.[0];
    const cw = t.pc.meta.cowl as { L: number; top: number; bustY: number } | undefined;
    const p = B.add(
      t.pc,
      t.back ? 'back' : 'front',
      (q, turned) => {
        const r = turned && fold ? reflect(q, fold[0], fold[1]) : q;
        const c = r.y - t.waistY;
        // A cowl front: above the bust each row is cut wider than the body by the spread the cowl was opened with, most
        // at the fold, nothing at the bust point. The spare width hangs from the neck point as the cowl's fall: the
        // row's cloth from the centre out to where it reaches the neck point lies on a line from the neck point down
        // to the centre front, as deep below the row as that length reaches (the cowl's depth as drafted), and the
        // rest lies on the body from the neck point out, as cut.
        if (cw && r.y < cw.bustY && !turned) {
          const f = (cw.bustY - r.y) / Math.max(1, cw.bustY - cw.top);
          const ex = Math.max(0, cw.L - neckArc) * f;
          const Lr = neckArc + ex;
          if (r.x >= Lr || ex < 0.05) {
            const at = ringAt(sp, r.x - ex, Math.max(c, tipC + 2), false, 1.5);
            return [at[0], c, at[2]];
          }
          // (As a U, not a V: a parabola from the centre front up to the neck point, as deep as its arc is long.)
          const curve = (d: number, v: number): [number, number] => [neckArc * v, d * (1 - v * v)];
          const arcLen = (d: number, upTo = 1) => {
            let acc = 0;
            let last = curve(d, 0);
            for (let k = 1; k <= 40; k++) {
              const q = curve(d, (k / 40) * upTo);
              acc += Math.hypot(q[0] - last[0], q[1] - last[1]);
              last = q;
            }
            return acc;
          };
          let lo = 0;
          let hi = Lr;
          for (let k = 0; k < 24; k++) {
            const mid = (lo + hi) / 2;
            if (arcLen(mid) < Lr) lo = mid;
            else hi = mid;
          }
          const d = ((lo + hi) / 2) * (knob('__cowlSag') ?? 1);
          // (Its place along the curve by cut length from the centre.)
          let v = 0;
          let acc = 0;
          let last = curve(d, 0);
          for (let k = 1; k <= 40 && acc < r.x; k++) {
            const q = curve(d, k / 40);
            const seg = Math.hypot(q[0] - last[0], q[1] - last[1]);
            if (acc + seg >= r.x) {
              v = (k - 1) / 40 + (1 / 40) * ((r.x - acc) / (seg || 1));
              acc = r.x;
              break;
            }
            acc += seg;
            last = q;
            v = k / 40;
          }
          const cy = c + d * (1 - v * v);
          const at = ringAt(sp, neckArc * v, Math.max(cy, tipC + 2), false, 1.5 + (knob('__cowlOff') ?? 2) * (1 - v));
          return [at[0], cy, at[2]];
        }
        const s = knob('__noCone') ? 1 : coneOf?.(c) ?? 1;
        const at = ringAt(sp, r.x / s, Math.max(c, tipC + 2), t.back, 1.5 + (turned ? 1 : 0));
        return [at[0] * s, c, at[2] * s];
      },
      thick,
      t.folds ?? [],
      undefined,
      t.creases ?? [],
    );
    (t.back ? back : front).push(p);
  }
  const seams: SimInput['seams'] = [];
  const down = (q: P) => q.y;
  if (extra.trousers) legs = trouserPanels(sp, B, seams, extra.trousers, o.thick ?? 0.35);
  const out = (q: P) => q.x;
  sew(seams, B.chain(front, 'shoulder', out), B.chain(back, 'shoulder', out));
  // (A piece cut whole, a one-shoulder's front and back, has a side seam each side: the wearer's left sewn to the left
  // and the right to the right, not all four runs strung into one chain.)
  if ([...front, ...back].some((p) => p.pc.meta.whole))
    for (const sign of [1, -1]) {
      const onSide = (q: P) => q.x * sign > 0;
      sew(seams, B.chain(front, 'side', down, onSide), B.chain(back, 'side', down, onSide));
    }
  else sew(seams, B.chain(front, 'side', down), B.chain(back, 'side', down));
  // Panel seams within the front and within the back (princess lines): each pair of panels sharing the tag.
  for (const group of [front, back]) {
    const withP = group.filter((p) => p.mesh.runs.princess);
    for (let i = 0; i + 1 < withP.length; i += 2) sew(seams, B.chain([withP[i]], 'princess', down), B.chain([withP[i + 1]], 'princess', down));
  }
  for (const p of [...front, ...back]) for (const [a, b] of dartLegs(p)) sew(seams, a, b);

  // What hangs from the waist (a skirt, a peplum): placed down from its waist edge, sewn to the bodice's waist if there is one.
  if (extra.skirt?.length && !knob("__noPep")) {
    // A peplum sewn to a bodice's hem (a top cut below the waist) starts where that hem is worn.
    const hemDrop = (() => {
      const t = torso.find((t) => !t.back);
      const f = front.find((p) => p.role === 'front');
      if (!t || !f || !f.mesh.runs.hem) return 0;
      const ys = f.mesh.runs.hem.flat().map((i) => f.mesh.pts[i].y);
      return ys.reduce((a, b) => a + b, 0) / ys.length - t.waistY;
    })();
    const levelOf = new Map<Panel, (q: P) => number>();
    // (A gathered skirt's front and back on the same mesh: with its fullness shown just over 2 on one piece and just
    // under on the other, one was meshed fine and one coarse, and the finer piece hung 3 to 5 cm shorter, so the hem
    // ran unlevel round the body, All round quality 2026-11-04.)
    const fineGathers = !knob('__gathersApart') && extra.skirt.some((pc) => (((pc.meta.gatherShown as number | undefined) ?? 1) > 2) && !pc.meta.tier);
    for (const pc of extra.skirt) {
      const isBack = /back/i.test(pc.name);
      const toHem = pc.meta.sewnTo === 'hem';
      const drop = toHem ? hemDrop : extra.drop ?? 0;
      const R = pc.meta.waistRadius as number | undefined;
      const gather = (pc.meta.gathered as number | undefined) ?? 1;
      let level: (q: P) => number;
      let arcOf: (q: P) => number;
      /** The piece's waist edge as worn, centre to side seam, in cm (gathered folds are fitted to it whole). */
      let worn = 0;
      if (R) {
        level = (q) => Math.hypot(q.x, q.y + R) - R;
        arcOf = (q) => Math.atan2(q.x, q.y + R) * R;
      } else {
        // The waist edge as drawn, read at any point across.
        const { pts, tags } = pc.outline.taggedPoints(12);
        const w = pts.filter((_, i) => tags[i] === 'waist' || tags[i - 1] === 'waist').sort((u, v) => u.x - v.x);
        const waistAt = (x: number) => {
          if (!w.length) return 0;
          if (x <= w[0].x) return w[0].y;
          for (let i = 1; i < w.length; i++) if (x <= w[i].x) return w[i - 1].y + ((w[i].y - w[i - 1].y) * (x - w[i - 1].x)) / (w[i].x - w[i - 1].x || 1);
          return w[w.length - 1].y;
        };
        level = (q) => q.y - waistAt(q.x);
        arcOf = (q) => q.x / gather;
        // The folds meet the side seam whole: a fold cut off part way there, sewn to the next piece's part fold, folded
        // over on itself as a fin (the cropped balloon top's peplum, 2026-11-06, read as crumpled under the bust).
        if (w.length > 1 && !knob('__foldsCut')) worn = Math.abs(w[w.length - 1].x - w[0].x) / gather;
      }
      // A circle skirt starts as the cone its pieces make when their side seams meet, so its hem's fullness is laid
      // out evenly round it and falls into folds, rather than crushed onto the body.
      const span = extra.skirt
        .filter((o) => o.meta.waistRadius === R)
        .reduce((t, o) => t + (((o.meta.angleDeg as number) ?? 0) * Math.PI) / 180, 0);
      const p = B.add(
        pc,
        isBack ? 'peplum-back' : 'peplum-front',
        (q) => {
          // (A high-waisted skirt rises past the waist, its top edge that far above it: there the level runs on up.)
          const lv = pc.meta.rise ? level(q) : Math.max(0, level(q));
          const c = lv + drop;
          if (R && span > 0) {
            const phi = (Math.atan2(q.x, q.y + R) * Math.PI) / span;
            const a = isBack ? Math.PI - phi : phi;
            // The cone holds up to a half circle's hem. Past that (a full circle) the cut round at this level is more
            // than any cone the cloth could fall in: it starts as the half-circle cone, clear of the body, and the rest
            // of the round hangs in even flutes, as it does on the wearer, rather than as a tutu's stiff disc the sim
            // then tears pulling in (All round quality 2026-11-04).
            const b = Math.max(sp.bodyR(a, c) + 1.5, (R + lv) * Math.min(span / Math.PI, 0.5));
            const need = ((R + lv) * span) / Math.PI;
            const n = knob('__flutes') ?? 8;
            const k = 1 + (n * n) / 2;
            const A = need > b && !knob('__noFlutes') ? (-2 * b + Math.sqrt(4 * b * b - 4 * k * (b * b - need * need))) / (2 * k) : 0;
            const rr = b + A * (1 + Math.cos(n * a));
            return [Math.sin(a) * rr, c, Math.cos(a) * rr];
          }
          // Gathered cloth starts in even folds round the waist (as the gathering thread draws it up), so it settles
          // into soft gathers down the skirt rather than one crushed bulge.
          if (!R && gather > 1.05 && !knob("__noFolds")) {
            const lam0 = knob("__lam") ?? 12;
            const lam = worn > 0 ? worn / Math.max(1, Math.round(worn / lam0)) : lam0;
            const k = TAU / lam;
            // (A balloon peplum's outer is gathered at both ends, its hem onto the underskirt as well as its waist, so it starts
            // in gentler folds: seeded as deep as a plain gathered peplum's, a cropped top's big balloon crumpled into
            // fins above the fin check's count, 2026-11-06.)
            const af = knob("__af") ?? (extra.under?.length && /peplum/i.test(pc.name) ? 2 : 3);
            const A = Math.min(knob("__acap") ?? 5, af * Math.sqrt(gather - 1) / k);
            const ph = (k * q.x) / gather;
            return ringAt(sp, arcOf(q), c, isBack, 1 + A * (1 + Math.sin(ph)) + lv * 0.12);
          }
          return ringAt(sp, arcOf(q), c, isBack, 2 + lv * 0.15);
        },
        thick,
        [],
        // (Pressed pleats on a finer mesh cut along each fold, so the fold's step and the shadow under it are crisp.)
        // (A heavily gathered skirt on a finer one too: its many folds need more than a point or two across each.)
        pc.meta.pleatFolds ? 1.2 : ((pc.meta.gatherShown as number | undefined) ?? 1) > 2 || (fineGathers && ((pc.meta.gatherShown as number | undefined) ?? 1) > 1.05 && !pc.meta.tier) ? (knob('__gh') ?? 0.8) : 1.6,
        creasesOf(pc),
      );
      levelOf.set(p, level);
      const top = (isBack ? back : front).filter((t) => t.role === 'front' || t.role === 'back');
      // (A bodice cut whole: its waist's right half, which is the half the skirt is drafted to; the skirt's mirror lies
      // under the bodice's other half.)
      if (top.length) sew(seams, B.chain(top, toHem ? 'hem' : 'waist', out, top.some((t) => t.pc.meta.whole) ? (q) => q.x >= -1e-6 : undefined), B.chain([p], 'waist', out));
      (isBack ? back : front).push(p);
    }
    const pf = B.panels.filter((p) => p.role === 'peplum-front');
    const pb = B.panels.filter((p) => p.role === 'peplum-back');
    if (pf.length && pb.length) {
      const before = seams.length;
      // (A skirt sewn whole has a side seam each side: the wearer's left sewn to the left and the right to the right.)
      if ([...pf, ...pb].some((p) => p.pc.meta.whole))
        for (const sign of [1, -1]) {
          const onSide = (q: P) => q.x * sign > 0;
          sew(seams, B.chain(pf, 'side', levelOf.get(pf[0])!, onSide), B.chain(pb, 'side', levelOf.get(pb[0])!, onSide));
        }
      else sew(seams, B.chain(pf, 'side', levelOf.get(pf[0])!), B.chain(pb, 'side', levelOf.get(pb[0])!));
      // A side slit: the seam left open from the hem up to the slit's end (measured up the seam from the hem).
      if (extra.slitCm) {
        const open = new Set<number>();
        const openTo = new Map<number, number>();
        for (const p of [...pf, ...pb]) {
          const byY = [...new Set((p.mesh.runs.side ?? []).flat())].sort((a, b) => p.mesh.pts[b].y - p.mesh.pts[a].y);
          let dist = 0;
          byY.forEach((i, k) => {
            if (k) dist += Math.hypot(p.mesh.pts[i].x - p.mesh.pts[byY[k - 1]].x, p.mesh.pts[i].y - p.mesh.pts[byY[k - 1]].y);
            if (dist < extra.slitCm!) {
              open.add(p.base + i);
              openTo.set(p.base + i, dist);
            }
          });
        }
        for (const p of pf) slitEdges.push({ p, ids: [...open].filter((g) => g >= p.base && g < p.base + p.mesh.pts.length), toHem: openTo, sign: -1 });
        for (const p of pb) slitEdges.push({ p, ids: [...open].filter((g) => g >= p.base && g < p.base + p.mesh.pts.length), toHem: openTo, sign: 1 });
        const kept = seams.slice(before).filter((q) => !open.has(q.i) || (!open.has(q.j) && !open.has(q.k)));
        seams.length = before;
        seams.push(...kept);
      }
    }
    // Gathered tiers below the yoke: each a rectangle, a quarter of its round each side of the body, gathered onto
    // the edge above and hanging from it.
    if (extra.tiers?.length) {
      let above = { f: { panels: pf, tag: 'tier' }, b: { panels: pb, tag: 'tier' } };
      const edgeC = (panels: Panel[], tag: string) => {
        const ids = panels.flatMap((p) => (p.mesh.runs[tag] ?? []).flat().map((i) => p.start[i][1]));
        return ids.length ? ids.reduce((a, b) => a + b, 0) / ids.length : 0;
      };
      let c0 = (edgeC(pf, 'tier') + edgeC(pb, 'tier')) / 2;
      for (const band of extra.tiers) {
        const pair: Record<'f' | 'b', Panel> = {} as never;
        for (const side of ['f', 'b'] as const) {
          const isBack = side === 'b';
          const w = band.round / 4;
          const h = band.depth;
          const outline = new Path(pt(0, 0)).line(pt(w, 0), 'waist').line(pt(w, h), 'side').line(pt(0, h), 'hem').line(pt(0, 0), 'fold');
          outline.closed = true;
          const pc = { name: `${band.name} ${isBack ? 'back' : 'front'}`, outline, lines: [], grain: [pt(w / 2, 1), pt(w / 2, h - 1)], notches: [], labels: [], cut: '', seamAllowance: 1, allowances: {}, meta: { gathered: band.ratio, tier: true } } as unknown as Piece;
          const g = band.ratio;
          const lam = 6;
          const k = TAU / lam;
          const A = Math.min(3, (2 * Math.sqrt(Math.max(0, g - 1))) / k);
          const top = c0;
          const p = B.add(
            pc,
            isBack ? 'peplum-back' : 'peplum-front',
            (q) => ringAt(sp, q.x / g, top + q.y, isBack, 2.5 + A * (1 + Math.sin((k * q.x) / g)) + (top + q.y) * 0.02),
            thick,
          );
          const ab = isBack ? above.b : above.f;
          sew(seams, B.chain(ab.panels, ab.tag, out), B.chain([p], 'waist', out));
          (isBack ? back : front).push(p);
          pair[side] = p;
        }
        sew(seams, B.chain([pair.f], 'side', down), B.chain([pair.b], 'side', down));
        above = { f: { panels: [pair.f], tag: 'hem' }, b: { panels: [pair.b], tag: 'hem' } };
        c0 += band.depth;
      }
    }
    // A balloon hem: the shorter underskirt hangs inside, and the longer, fuller outer skirt is gathered onto its hem,
    // so the outer puffs out and turns under.
    if (extra.under?.length && pf.length && pb.length) {
      for (const p of [...pf, ...pb]) p.thick.forEach((_, i) => (p.thick[i] += 1.2));
      const uf: Panel[] = [];
      const ub: Panel[] = [];
      for (const pc of extra.under) {
        const isBack = /back/i.test(pc.name);
        const { pts, tags } = pc.outline.taggedPoints(12);
        const w = pts.filter((_, i) => tags[i] === 'waist' || tags[i - 1] === 'waist');
        const wy = w.length ? w.reduce((t, q) => t + q.y, 0) / w.length : 0;
        // (Hung from where its outer hangs: a lowered peplum's from the bodice's hem, else the waist seam.)
        const uDrop = pc.meta.sewnTo === 'hem' ? hemDrop : extra.drop ?? 0;
        const p = B.add(pc, isBack ? 'peplum-back' : 'peplum-front', (q) => ringAt(sp, q.x, q.y - wy + uDrop, isBack, 1 + (q.y - wy) * 0.08), thick * 0.6);
        p.hidden = true;
        (isBack ? ub : uf).push(p);
        (isBack ? back : front).push(p);
      }
      for (const [o, u] of [[pf, uf], [pb, ub]] as const) {
        sew(seams, B.chain([...o], 'waist', out), B.chain(u, 'waist', out));
        sew(seams, B.chain([...o], 'balloon', out), B.chain(u, 'balloon', out));
      }
      sew(seams, B.chain(uf, 'side', down), B.chain(ub, 'side', down));
    }
  }

  // Collars: each stands up from the neck (or from its stand), and turns down at its roll line if it has one.
  if (extra.collars?.length && !knob("__noCol")) {
    const neckC = sp.cOf(-1.47);
    const fromFold = (pc: Piece) => {
      const f = pc.outline.taggedPoints(4);
      const fx = f.pts.filter((_, i) => f.tags[i] === 'fold' || f.tags[i - 1] === 'fold');
      // A fold down the centre back; a collar drawn with its centre back on x = 0 and only a stub tagged fold has it there.
      // (A band closed by a back zip is cut on the fold at the centre front: its centre back is the edge on x = 0.)
      const tall = pc.meta.foldAt !== 'centre front' && fx.length > 1 && Math.max(...fx.map((q) => q.y)) - Math.min(...fx.map((q) => q.y)) > 1;
      const at = tall ? fx.reduce((t, q) => t + q.x, 0) / fx.length : Math.min(...f.pts.map((q) => q.x));
      return (q: P) => Math.abs(q.x - at);
    };
    const bodyNeck = B.chain(back.filter((t) => t.role === 'back'), 'neck', out);
    const frontNeck = B.chain(front.filter((t) => t.role === 'front'), 'neck', (q) => q.y);
    const ext = B.chain(front.filter((t) => t.role === 'front'), 'opening-neck', (q) => -q.x);
    const joinChains = (...cs: Chain[]): Chain => {
      const ids: number[] = [];
      const ss: number[] = [];
      let off = 0;
      for (const c of cs) {
        if (!c.ids.length) continue;
        c.ids.forEach((i, n) => {
          ids.push(i);
          ss.push(c.s[n] + off);
        });
        off = ss[ss.length - 1];
      }
      return { ids, s: ss };
    };
    let standTop: { panel: Panel; key: (q: P) => number } | undefined;
    for (const c of extra.collars) {
      const pc = c.pc;
      const roll = c.roll;
      const lift = c.onStand ? 3 : 0;
      // A popped collar (a tailored collar with no roll) stands up round the neck: from its neck edge up to its fall.
      const popped = !roll && pc.outline.tags.includes('gorge');
      // A flat collar (a peter pan): drafted lying on the bodice's own neckline, it lies out from the neck seam over the
      // shoulders and chest, each point as far out along the body's surface as it is cut from the neck edge. (Placed as
      // the others are, by its height above the neck edge, it stood up round the neck as a band and flapped.)
      const flat = !roll && !popped && !c.onStand && !!pc.meta.flat && !knob('__noFlatCollar');
      const tp = pc.outline.taggedPoints(2);
      const nk = tp.pts.filter((_, i) => tp.tags[i] === 'neck');
      // (Its neck edge curves round from the centre back to the centre front, so a point's place along it is its
      // distance along the edge, not across the piece: measured across, the front half of the edge read as the back
      // half again, and the collar was sewn on doubled back over its own shoulder.)
      const alongNeck = (): ((q: P) => number) => {
        const run = [...nk];
        let cut = 0;
        let worst = 0;
        for (let k = 1; k < run.length; k++) {
          const d = Math.hypot(run[k].x - run[k - 1].x, run[k].y - run[k - 1].y);
          if (d > worst) {
            worst = d;
            cut = k;
          }
        }
        // (The tag may run on round the outline's start: joined back up at the one long step.)
        const med = run.length > 2 ? [...run.slice(1).map((q, k) => Math.hypot(q.x - run[k].x, q.y - run[k].y))].sort((a, b) => a - b)[Math.floor((run.length - 1) / 2)] : worst;
        const pts = cut && worst > 3 * med ? [...run.slice(cut), ...run.slice(0, cut)] : run;
        const byFold = fromFold(pc);
        if (byFold(pts[0]) > byFold(pts[pts.length - 1])) pts.reverse();
        const s = [0];
        for (let k = 1; k < pts.length; k++) s.push(s[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
        return (q: P) => {
          let b = 0;
          let bd = Infinity;
          pts.forEach((n, k) => {
            const d = Math.hypot(n.x - q.x, n.y - q.y);
            if (d < bd) {
              bd = d;
              b = k;
            }
          });
          return s[b];
        };
      };
      // A hood (two pieces, seamed down the centre back and over the crown, worn down): it hangs from the neck seam
      // down the back as a pouch, its centre seam down the spine, its face edge the pouch's side and bottom, and the
      // front ends of its neck edge round on the chest. (Placed as a collar it was wrapped round the neck 10x stretched.)
      const hood = !!pc.meta.hood && !knob('__noHood');
      const hoodNeck = (() => {
        // Its neck edge from the centre back end (the piece's far x) round to the centre front end (x = 0): one curve,
        // so the tagged points are its two ends; a point's place along it is its share of the way across.
        // (A tagged point starts its segment: the edge's far end is the point after its last segment.)
        const ends = tp.pts.filter((_, i) => tp.tags[i] === 'neck' || tp.tags[(i + tp.pts.length - 1) % tp.pts.length] === 'neck');
        const xs = ends.map((q) => q.x);
        const [cf, cb] = [Math.min(...xs), Math.max(...xs)];
        const span = cb - cf || 1;
        const yOf = (x: number) => {
          const a = ends.find((q) => q.x === cb) ?? ends[0];
          const b = ends.find((q) => q.x === cf) ?? ends[0];
          return a.y + ((b.y - a.y) * (cb - x)) / span;
        };
        return { key: (q: P) => Math.min(span, Math.max(0, cb - q.x)), total: span, yAt: (q: P) => yOf(q.x) };
      })();
      const key = hood ? hoodNeck.key : flat && nk.length > 1 ? alongNeck() : fromFold(pc);
      const hoodBox = hood ? { x0: Math.min(...tp.pts.map((q) => q.x)), D: Math.max(...tp.pts.map((q) => q.x)) - Math.min(...tp.pts.map((q) => q.x)), top: Math.min(...tp.pts.map((q) => q.y)), bottom: Math.max(...tp.pts.map((q) => q.y)) } : undefined;
      // The hood's centre seam as the piece's far edge: its x at a height up its side (it curves in to the nape), and
      // its height across the top (the crown's curve), so a point's way across is measured from the seam itself.
      const hoodSeam = (() => {
        if (!hood || !hoodBox) return undefined;
        const cp = pc.outline.taggedPoints(1);
        const on = cp.pts.filter((_, i) => cp.tags[i] === 'centre' || cp.tags[(i + cp.pts.length - 1) % cp.pts.length] === 'centre');
        const xMax = hoodBox.x0 + hoodBox.D;
        // The crown: the seam's highest point; below it the seam is the side, above it the top.
        const crown = on.reduce((b, q) => (q.x > b.x ? q : b), on[0]);
        const side = on.filter((q) => q.y >= crown.y - 0.01).sort((a, b) => a.y - b.y);
        const top = on.filter((q) => q.y <= crown.y + 0.01).sort((a, b) => a.x - b.x);
        const lerp = (pts: P[], v: number, by: 'x' | 'y', out: 'x' | 'y') => {
          if (!pts.length) return by === 'y' ? xMax : hoodBox.top;
          if (v <= pts[0][by]) return pts[0][out];
          for (let k = 1; k < pts.length; k++)
            if (v <= pts[k][by]) {
              const f = (v - pts[k - 1][by]) / (pts[k][by] - pts[k - 1][by] || 1);
              return pts[k - 1][out] + (pts[k][out] - pts[k - 1][out]) * f;
            }
          return pts[pts.length - 1][out];
        };
        return { xAt: (y: number) => (y >= crown.y ? lerp(side, y, 'y', 'x') : xMax), yTop: (x: number) => (x <= crown.x ? lerp(top, x, 'x', 'y') : crown.y) };
      })();
      // The hood hung from its neck seam: from the level c0 the seam point below q settled at, and the arc round from
      // the centre back that point lies at.
      const hoodHang = hood && hoodBox
        ? (q: P, c0: number, fracNeck: number, cSeam: number): V3 => {
            // The piece as a square: p across from its centre seam (0) to its face edge (1), u up from its neck edge (0)
            // to its top (1). Hung down the back, the centre seam (up the piece's far edge and back across its top)
            // is the pouch's spine, down = u (1 + p), and the face edge runs from the neck round the shoulder's side
            // down to the spine's foot, across = p (1 - u): a map with no fold in it. The cloth's spare length along
            // the spine folds inside the pouch (not drawn); nothing is stretched.
            const H0 = hoodBox.bottom - hoodBox.top || 1;
            const xC = hoodSeam ? hoodSeam.xAt(q.y) - hoodBox.x0 : hoodBox.D;
            const pp = Math.min(1, Math.max(0, (hoodBox.x0 + xC - q.x) / (xC || 1)));
            const u = Math.min(1, Math.max(0, (hoodBox.bottom - q.y) / H0));
            // (The top at this x: the crown's curve, which is the centre seam too, so the pouch closes on its spine
            // all along it.)
            const uTop = Math.min(1, Math.max(u, (hoodBox.bottom - (hoodSeam ? hoodSeam.yTop(q.x) : hoodBox.top)) / H0));
            const Ld = H0 * (knob('__hoodLen') ?? 0.6);
            // (The pouch hangs as wide as the shoulders for most of its length, then rounds in to its foot: the face
            // edge runs straight down the side before it curves in to meet the spine.)
            const u0 = Math.min(knob('__hoodRound') ?? 0.4, uTop - 0.01);
            const th = u <= u0 ? 0 : (Math.PI / 2) * Math.min(1, (u - u0) / (uTop - u0));
            const across = pp * Math.cos(th);
            // Which way round the body it lies: along the neck seam at the seam (its share of the way from the centre
            // back to the centre front), across the pouch below it. (All from the one level, the nape's: hung each
            // from the level its own bit of seam settled at, two neighbours on the sloping front neckline walked
            // down to places 10 cm apart.)
            const half = halfAt(c0);
            const arcNeck = fracNeck * half;
            const arcPouch = across * quarterAt(c0) * (knob('__hoodW') ?? 0.65);
            // The cloth above the front of the seam first goes back over the shoulder's top to the pouch's side, a
            // centimetre round for each centimetre cut, and only then hangs down. (Swept round as it went down, it
            // passed over the shoulder's point and was stretched 3x between the neck and the shoulder.)
            const arcSide = quarterAt(c0) * (knob('__hoodW') ?? 0.65);
            const sweep = Math.max(0, arcNeck - arcSide);
            const s0 = u * H0;
            const t = Math.min(1, s0 / Math.max(sweep, 1e-6));
            const arcTop = arcNeck + (Math.min(arcNeck, arcSide) - arcNeck) * t;
            const down = (sN: number) => ((Math.max(0, sN - sweep) * (1 + pp)) / 2) * (Ld / H0);
            // (Round the foot the cloth comes down as a quarter circle, not a straight slant to the spine.)
            const d = th > 0 ? down(u0 * H0) + (down(uTop * H0) - down(u0 * H0)) * Math.sin(th) : down(s0);
            // (Down the pouch the cloth drifts from where it hangs to its own place across it: the face edge straight
            // down the side, then round in to the spine's foot. The spine itself stays on the centre, wherever the
            // seam's nape end settled.)
            const g = Math.max(Math.min(1, d / (Ld * (knob('__hoodDrift') ?? 0.5))), 1 - Math.min(1, across / 0.1));
            const at = ringAt(sp, arcTop + (arcPouch - arcTop) * g, c0, true, 0);
            const a = Math.atan2(at[0], at[2]);
            // Straight down from the seam, lying on the body wherever the body below is wider than the neck it hangs
            // from (the shoulders, the back). (Walked out along the body's surface instead, as a flat collar is, the
            // cloth went out level over the shoulders and the back's slope and hung only 11 cm below the nape.)
            // Hanging cloth bridges straight from the seam to where it first meets the body (the shoulders' top from
            // the side of the neck), so it lies on the body's profile's outer hull, not on each level's own width.
            // (The cloth sweeping back over the shoulder runs along its own bit of seam, which on the front sits lower
            // than the nape: swept round at the nape's level it sat 6 cm above the front neck seam, and the seat
            // blend below tore it. By the end of the sweep it is at the nape's level.)
            const cI = c0 + d + (cSeam - c0) * (1 - t);
            const rI = Math.max(hoodHull(a, c0, d), sp.bodyR(a, cI));
            // (The pouch rounds out from the back in its middle and comes back in at its foot.)
            const bulge = (knob('__hoodOff') ?? 4) * Math.sin(Math.PI * Math.min(1, d / Ld)) * (1 - 0.5 * across);
            const R = rI + 1 + bulge;
            return [Math.sin(a) * R, cI, Math.cos(a) * R];
          }
        : undefined;
      // The body's profile down from a level at an angle, as a hung cloth lies on it: the outer hull of its widths,
      // every half centimetre down, at angles 5 degrees apart (read off between them: the body's table is uneven round
      // the shoulder, and two points a degree apart hung 6 cm apart).
      const hoodHulls = new Map<string, number[]>();
      const hoodHull = (a: number, c0: number, d: number): number => {
        const STEP = Math.PI / 36;
        const DS = 0.5;
        const N = 80;
        const hull = (ak: number, ck: number): number[] => {
          const key = `${ak},${ck}`;
          const hit = hoodHulls.get(key);
          if (hit) return hit;
          const r = Array.from({ length: N + 1 }, (_, k) => sp.bodyR(ak, ck + k * DS));
          // The upper hull from the top down: a point under the line between its neighbours on the hull is lifted to it.
          const hv: number[] = [0];
          for (let k = 1; k <= N; k++) {
            while (hv.length > 1) {
              const [i, j] = [hv[hv.length - 2], hv[hv.length - 1]];
              if ((r[j] - r[i]) * (k - i) >= (r[k] - r[i]) * (j - i)) break;
              hv.pop();
            }
            hv.push(k);
          }
          const out = new Array<number>(N + 1);
          for (let h = 1; h < hv.length; h++) {
            const [i, j] = [hv[h - 1], hv[h]];
            for (let k = i; k <= j; k++) out[k] = r[i] + ((r[j] - r[i]) * (k - i)) / (j - i);
          }
          hoodHulls.set(key, out);
          return out;
        };
        const ai = Math.abs(a) / STEP;
        const k0 = Math.min(35, Math.floor(ai));
        const fa = ai - k0;
        const ck = Math.round(c0 * 2) / 2;
        const di = Math.min(N - 1e-6, d / DS);
        const n0 = Math.floor(di);
        const fd = di - n0;
        const at = (ak: number) => {
          const h = hull(ak, ck);
          return h[n0] * (1 - fd) + h[n0 + 1] * fd;
        };
        return at(k0 * STEP) * (1 - fa) + at((k0 + 1) * STEP) * fa;
      };
      const quarterCache = new Map<string, number>();
      const ringTo = (c: number, steps: number) => {
        const ck = `${Math.round(c * 4) / 4},${steps}`;
        const hit = quarterCache.get(ck);
        if (hit !== undefined) return hit;
        const rOf = (a: number, c: number) => sp.bodyR(a, c);
        let t = 0;
        let [px, pz] = [0, -rOf(Math.PI, c)];
        for (let k = 1; k <= steps; k++) {
          const a = Math.PI * (1 - k / 180);
          const r = rOf(a, c);
          const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
          t += Math.hypot(x - px, z - pz);
          [px, pz] = [x, z];
        }
        quarterCache.set(ck, t);
        return t;
      };
      const quarterAt = (c: number) => ringTo(c, 90);
      const halfAt = (c: number) => ringTo(c, 180);
      // A pussy bow: a bias strip folded along its length, standing as a band round the neck, running on past the
      // centre front into a tie that hangs down the front (worn untied). A neck ruffle: a strip folded along its
      // length and gathered into the neck seam, standing up round the neck in soft waves, deeper towards its edge.
      // (Both placed round the neck by the length they were cut, they wrapped round the body again: the tie went on
      // round the back and the ruffle twice round.)
      const bow = !!pc.meta.bow && !roll && !knob('__noBow');
      const gather = typeof pc.meta.ruffle === 'number' && !roll && !knob('__noRuf') ? (pc.meta.ruffle as number) : 0;
      const ys = tp.pts.map((q) => q.y);
      const H = Math.max(...ys) - Math.min(...ys);
      // (The strip's neck edge is one straight run: its length, corner to corner.)
      const neckRun = tp.tags.reduce((t, g, i) => (g === 'neck' ? t + Math.hypot(tp.pts[(i + 1) % tp.pts.length].x - tp.pts[i].x, tp.pts[(i + 1) % tp.pts.length].y - tp.pts[i].y) : t), 0) || 1;
      // (Half way round the neck ring, from the centre back to the centre front: the strip's neck edge is spread over
      // it however long it was cut, so its centre front comes to the body's.)
      const ringHalf = (() => {
        let t = 0;
        const c0 = neckC - 1;
        let [px, pz] = [0, -sp.bodyR(Math.PI, c0)];
        for (let k = 1; k <= 180; k++) {
          const a = Math.PI * (1 - k / 180);
          const r = sp.bodyR(a, c0);
          const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
          t += Math.hypot(x - px, z - pz);
          [px, pz] = [x, z];
        }
        return t;
      })();
      const neckY = nk.length ? nk.reduce((t, q) => t + q.y, 0) / nk.length : 0;
      const neckLen = nk.length ? Math.max(...nk.map((q) => key(q))) : 1;
      const p = B.add(
        pc,
        'collar',
        (q, turned) => {
          const r = turned && roll ? reflectRoll(q, roll, c.roll2) : q;
          if (popped) {
            // Round the neck as a cone: each point at the angle of the neck point below it (centre back to the
            // gorge), rising by its height above the neck edge and leaning out a little as it rises.
            let n = nk[0];
            let bd = Infinity;
            for (const k of nk) {
              const d = Math.hypot(k.x - q.x, k.y - q.y);
              if (d < bd) {
                bd = d;
                n = k;
              }
            }
            const up = Math.abs(q.y - neckY);
            const a = Math.PI * (1 - 0.9 * Math.min(1, key(n) / (neckLen || 1)));
            const R = sp.bodyR(a, neckC) + 1 + up * (knob("__popOut") ?? 0.25);
            return [Math.sin(a) * R, neckC - 1 - up * 0.9, Math.cos(a) * R];
          }
          if (bow || gather) {
            const s0 = key(q);
            const arc = Math.min(1, s0 / neckRun) * ringHalf;
            const d = Math.min(H, Math.abs(q.y - neckY));
            // Folded along its middle: both layers stand together, the outer a little outside the inner.
            const up = Math.min(d, H - d);
            const outer = d > H / 2 ? 1 : 0;
            const c0 = neckC - 1;
            const wave = gather ? Math.sin((s0 / (knob('__rufLam') ?? 6)) * TAU) * (knob('__rufAmp') ?? 0.8) * (up / (H / 2)) : 0;
            const band = ringAt(sp, arc, c0 - up * 0.95, true, 1 + up * (gather ? 0.25 : 0.1) + outer * 0.4 + wave);
            if (!bow || s0 < neckRun - 3) return band;
            // The tie: from the centre front down the front of the body, the strip's width across, turned down over
            // the last few centimetres of the band.
            const tie = ringAt(sp, 0.6 + up, c0 + Math.max(0, s0 - neckRun), false, 1.5 + outer * 0.4);
            const t = Math.max(0, Math.min(1, (s0 - (neckRun - 3)) / 6));
            return [0, 1, 2].map((k) => band[k] * (1 - t) + tie[k] * t) as V3;
          }
          if (hood && hoodHang) return hoodHang(q, neckC - 1, hoodNeck.key(q) / hoodNeck.total, neckC - 1);
          if (flat) {
            let n = nk[0];
            let w = Infinity;
            for (const k of nk) {
              const d = Math.hypot(k.x - q.x, k.y - q.y);
              if (d < w) {
                w = d;
                n = k;
              }
            }
            const c0 = neckC - 1;
            const at = ringAt(sp, key(n), c0, true, 0);
            const a = Math.atan2(at[0], at[2]);
            // Out along the surface from the neck seam: nearly level over the shoulder's top, down over the chest and back.
            // (The body table steps out at the shoulder's ridge: where the body just below is wider than the point has
            // reached, the point goes out level to meet it before it goes down.)
            let cI = c0;
            let rI = sp.bodyR(a, cI);
            for (let left = w; left > 0; left -= 0.25) {
              const step = Math.min(0.25, left);
              const below = sp.bodyR(a, cI + 0.25);
              if (rI + 1e-6 < below) {
                rI = Math.min(below, rI + step);
                continue;
              }
              const slope = (below - rI) / 0.25;
              cI += step / Math.sqrt(1 + slope * slope);
              rI = sp.bodyR(a, cI);
            }
            const R = Math.max(rI, sp.bodyR(a, cI)) + 1 + (knob('__flatOff') ?? 0.4);
            return [Math.sin(a) * R, cI, Math.cos(a) * R];
          }
          const cc = neckC - 1 - lift + r.y;
          // The fall lies out over the stand and spreads as it goes down onto the shoulders: its longer outer edge
          // takes a wider ring, so it starts smooth rather than ruffled.
          const beyond = turned && roll ? Math.max(0, cc - (neckC - 1 - lift + Math.max(roll[0].y, roll[1].y))) : 0;
          // (A shirt's fall, turned down over its stand, flares out from the roll as its longer outer edge lets it: the
          // further from the fold, the further out from the neck.)
          const flare = turned && roll && !pc.outline.tags.includes('gorge') ? Math.hypot(q.x - r.x, q.y - r.y) / 2 : 0;
          // (A funnel stands away from the neck as it rises: its top edge is cut longer than its neck edge. Set on the
          // neck's own ring it overran the ring's length, and the two halves' front ends crossed at the centre front.)
          const funnel = pc.meta.band === 'funnel' && !knob('__noFunnel') ? Math.max(0, neckY - r.y) * (knob('__funOut') ?? 0.3) : 0;
          return ringAt(sp, key(q) * (knob("__ck") ?? 1), cc, true, 1 + funnel + (turned ? 1.2 + beyond * 0.25 + flare * (knob('__fallOut') ?? 0.7) : 0));
        },
        thick,
        roll ? (c.roll2 ? [roll, c.roll2] : [roll]) : [],
        1.2,
      );
      if (popped) poppedPanels.push(p);
      // A shirt's collar and stand (no lapel: no gorge) are interfaced: they keep the shape they were set in round the
      // neck, moved only as the seam each is sewn by moves.
      // (A flat collar is soft cloth lying on the shoulders: it settles with the body under it, not re-set stiff.)
      else if (!p.mesh.runs.gorge && !knob('__softCollar') && !(flat && !knob('__flatStiff')) && !(hood && knob('__hoodSoft')) && !pc.meta.knit)
        // (A bow, a ruffle and a hood keep the shape they were set in, carried by the seam. A knit band is not interfaced:
        // it settles with the neck under it; kept stiff on a T-shirt's lower dropped-shoulder neck, its front flipped out.)
        stiffPanels.push({ p, by: c.onStand ? 'stand' : 'neck', roll: roll ?? undefined, key, carry: bow || gather || hood ? () => true : undefined, hang: hoodHang });
      const stiff = stiffPanels.find((x) => x.p === p);
      if (c.onStand && standTop) {
        sew(seams, B.chain([p], 'stand', key), B.chain([standTop.panel], 'stand', standTop.key));
        if (stiff) stiff.on = standTop;
      } else {
        const target = pc.meta.collarTo === 'extension' ? joinChains(bodyNeck, frontNeck, ext) : joinChains(bodyNeck, frontNeck);
        // A tailored collar's neck edge runs on along the lapel's gorge: sewn as one seam, so the short gorge end of the
        // collar isn't made to gather the whole gorge line up into a point.
        if (p.mesh.runs.gorge && !knob("__oldGorge")) sew(seams, joinChains(B.chain([p], 'neck', key), B.chain([p], 'gorge', key)), joinChains(target, B.chain(front, 'gorge', (q) => -q.x)));
        // (A shirt worn open: its stiff collar is laid on the neckline after, as it settles with the fronts turned back,
        // not sewn to it while it settles, which would hold the turned neckline up round the neck.)
        else if (!(o.rollFront && stiff)) sew(seams, B.chain([p], 'neck', key), target);
        if (stiff) stiff.target = target;
        if (p.mesh.runs.stand) standTop = { panel: p, key };
      }
      if (p.mesh.runs.gorge && knob("__oldGorge")) sew(seams, B.chain([p], 'gorge', (q) => q.y * -1), B.chain(front, 'gorge', (q) => -q.x));
    }
  }

  let capRatio = 1;
  let cuffPanel: Panel | undefined;
  let cuffRuffleP: Panel | undefined;
  // Sleeves round the arm, sewn into the armhole.
  if (extra.sleeve?.length && !knob("__noSl")) {
    // A raglan: the sleeve in two halves, front and back, each with its shoulder piece on it. The halves lie either
    // side of the seam down the top of the arm, as cut; the shoulder pieces lie on the body's shoulders, turned back
    // to where they were cut from the bodice.
    const rag = extra.sleeve.length === 2 && extra.sleeve.every((pc) => pc.meta.raglan) && !knob('__noRaglan');
    const top = rag ? extra.sleeve.find((pc) => pc.meta.raglan === 'front')! : extra.sleeve.find((pc) => pc.meta.tailored !== 'under')!;
    const under = rag ? extra.sleeve.find((pc) => pc.meta.raglan === 'back') : extra.sleeve.find((pc) => pc.meta.tailored === 'under');
    const runTop = (pc: Piece, tag: string) => {
      const { pts, tags } = pc.outline.taggedPoints(12);
      const on = pts.filter((_, i) => tags[i] === tag || tags[i - 1] === tag);
      return on.reduce((a, b) => (b.y < a.y ? b : a), on[0]);
    };
    let period: number;
    if (under && !rag) period = runTop(top, 'front-seam').x - runTop(under, 'front-seam').x;
    else {
      const xs = (rag ? extra.sleeve : [top]).flatMap((pc) => pc.outline.points().map((q) => q.x));
      period = Math.max(...xs) - Math.min(...xs);
    }
    // (A raglan's crown is cut away: the seam down the top of the arm ends at the middle of the hem, in its place.)
    const capTop = rag
      ? (() => {
          const on = extra.sleeve.flatMap((pc) => {
            const { pts, tags } = pc.outline.taggedPoints(12);
            return pts.filter((_, i) => tags[i] === 'overarm' || tags[i - 1] === 'overarm');
          });
          return { x: on.reduce((a, b) => (b.y > a.y ? b : a), on[0]).x, y: 0 };
        })()
      : top.outline.points().reduce((a, b) => (b.y < a.y ? b : a));
    const uOf = (pc: Piece, q: P) => (pc === under && !rag ? q.x + period : q.x);
    const spOf = (pc: Piece) => {
      const { pts, tags } = pc.outline.taggedPoints(12);
      const i = tags.findIndex((t, k) => t === 'overarm' && tags[(k - 1 + tags.length) % tags.length] !== 'overarm');
      return pts[Math.max(0, i)];
    };
    // A raglan's shoulder piece: inside the outline it was turned on with; each such point turned back to where it
    // was on the bodice and placed as the bodice places it.
    const yokeOf = (pc: Piece) => {
      const ring = (pc.meta.raglanYoke as P[] | undefined) ?? [];
      const turn = pc.meta.raglanTurn as { notch: P; at: P; a: number; flip: boolean } | undefined;
      if (!rag || ring.length < 3 || !turn) return undefined;
      // (Its own edge points count as on it: the raglan line and the neck are the outline itself.)
      const inside = (q: P) => {
        let w = false;
        let near = Infinity;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [u, v] = [ring[i], ring[j]];
          if (u.y > q.y !== v.y > q.y && q.x < ((v.x - u.x) * (q.y - u.y)) / (v.y - u.y) + u.x) w = !w;
          const L2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1e-9;
          const t = Math.max(0, Math.min(1, ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / L2));
          near = Math.min(near, Math.hypot(q.x - u.x - (v.x - u.x) * t, q.y - u.y - (v.y - u.y) * t));
        }
        return w || near < 0.6;
      };
      const back = pc.meta.raglan === 'back';
      const t = torso.find((t) => t.back === back) ?? torso[0];
      const place = (q: P): V3 => {
        const dx = q.x - turn.notch.x;
        const dy = q.y - turn.notch.y;
        const [c, sn] = [Math.cos(-turn.a), Math.sin(-turn.a)];
        const bx = dx * c - dy * sn + turn.at.x;
        const by = dx * sn + dy * c + turn.at.y;
        const x = Math.abs(turn.flip ? -bx : bx);
        const cc = by - t.waistY;
        const s = knob('__noCone') ? 1 : coneOf?.(cc) ?? 1;
        const at = ringAt(sp, x / s, Math.max(cc, tipC + 2), back, 1.5);
        return [at[0] * s, cc, at[2] * s];
      };
      // The edge where the shoulder piece meets the sleeve, from the shoulder point round to the raglan notch (the
      // armhole it was cut at): the sleeve's cloth next to it hangs from it, down the arm, and only further down lies
      // round the arm as a set-in sleeve does. (Placed round the arm right up to the piece, its top sat 8 cm above
      // the piece's edge on the body, and the cloth between dragged the piece off its raglan seam.)
      const sp0 = spOf(pc);
      const nearIdx = (q: P) => ring.reduce((b, r, i) => (Math.hypot(r.x - q.x, r.y - q.y) < Math.hypot(ring[b].x - q.x, ring[b].y - q.y) ? i : b), 0);
      const i0 = nearIdx(sp0);
      const i1 = nearIdx(turn.notch);
      const edge = i0 <= i1 ? ring.slice(i0, i1 + 1) : [...ring.slice(i0), ...ring.slice(0, i1 + 1)];
      const nearEdge = (q: P): { at: P; d: number } => {
        let best = { at: edge[0], d: Infinity };
        for (let k = 0; k + 1 < edge.length; k++) {
          const [u, v] = [edge[k], edge[k + 1]];
          const L2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1e-9;
          const t = Math.max(0, Math.min(1, ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / L2));
          const at = { x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t };
          const d = Math.hypot(q.x - at.x, q.y - at.y);
          if (d < best.d) best = { at, d };
        }
        return best;
      };
      return { inside, place, nearEdge };
    };
    const { a, b, r0 } = sp.arm;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...d);
    const dn = d.map((v) => v / L);
    // Out from the arm (the wearer's left) and forward, square to it.
    const outv = [1 - dn[0] * dn[0], -dn[0] * dn[1], -dn[0] * dn[2]];
    const ol = Math.hypot(...outv);
    const ov = outv.map((v) => v / ol);
    const fv = [dn[1] * ov[2] - dn[2] * ov[1], dn[2] * ov[0] - dn[0] * ov[2], dn[0] * ov[1] - dn[1] * ov[0]];
    if (fv[2] < 0) fv.forEach((_, i) => (fv[i] = -fv[i]));
    const capH = (top.meta.capHeight as number) ?? 15;
    const panels: Panel[] = [];
    // (A raglan's sleeve hangs from where its shoulder pieces meet it, at the armhole: placed round the arm from the
    // crown's height, as a set-in sleeve is, its top sat 5 or 6 cm above the pieces on the body and dragged them off
    // the raglan seam. Dropped so the raglan notch round the arm meets the notch on the body.)
    const ragDrop = (() => {
      if (!rag) return 0;
      const ds = extra.sleeve.flatMap((pc) => {
        const yk = yokeOf(pc);
        const turn = pc.meta.raglanTurn as { notch: P } | undefined;
        if (!yk || !turn) return [];
        // (By the shoulder point, where the seam down the arm starts: it starts at the shoulder's tip, not above it.)
        const ref = knob('__ragByNotch') ? turn.notch : spOf(pc);
        const X = yk.place(ref);
        const u = (X[0] - a[0]) * dn[0] + (X[1] - a[1]) * dn[1] + (X[2] - a[2]) * dn[2];
        return [u - (ref.y - capH * 0.6)];
      });
      return ds.length ? ds.reduce((t, v) => t + v, 0) / ds.length : 0;
    })();
    const flutter = flutterPlace(top, under, rag, capH, r0);
    for (const pc of [top, ...(under ? [under] : [])]) {
      const yk = yokeOf(pc);
      const p = B.add(
        pc,
        'sleeve',
        (q) => {
          if (yk?.inside(q)) return yk.place(q);
          if (flutter) {
            const { th, along, rr } = flutter(q);
            return [0, 1, 2].map((k) => a[k] + dn[k] * along + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k])) as V3;
          }
          const th = (TAU * (uOf(pc, q) - capTop.x)) / period;
          const along = q.y - capH * 0.6 + ragDrop;
          const rr = r0 + 1.5;
          const round = [0, 1, 2].map((k) => a[k] + dn[k] * along + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k])) as V3;
          if (!yk) return round;
          const D = knob('__ragHang') ?? 8;
          const ne = yk.nearEdge(q);
          if (ne.d >= D) return round;
          const E = yk.place(ne.at);
          const t = (ne.d / D) * (ne.d / D) * (3 - 2 * (ne.d / D));
          return [0, 1, 2].map((k) => (E[k] + dn[k] * ne.d) * (1 - t) + round[k] * t) as V3;
        },
        thick,
      );
      if (yk) p.yoke = p.mesh.pts.map((q) => yk.inside(q));
      panels.push(p);
    }
    if (rag && under) {
      sew(seams, B.chain([panels[0]], 'overarm', down), B.chain([panels[1]], 'overarm', down));
      sew(seams, B.chain([panels[0]], 'underarm', down), B.chain([panels[1]], 'underarm', down));
      // The raglan lines: each half's to the bodice's, from the neck down to the armhole. And the shoulder seam, now
      // between the two shoulder pieces: from the neck out to the shoulder point, where the seam down the arm starts.
      // (On the sleeve piece the line lies whichever way its shoulder piece was turned: from its neck end, the end
      // away from the raglan notch.)
      const fromNeckEnd = (pc: Piece) => {
        const n = (pc.meta.raglanTurn as { notch: P }).notch;
        return (q: P) => -Math.hypot(q.x - n.x, q.y - n.y);
      };
      sew(seams, B.chain([panels[0]], 'raglan', fromNeckEnd(top)), B.chain(front.filter((p) => p.role === 'front'), 'raglan', down));
      sew(seams, B.chain([panels[1]], 'raglan', fromNeckEnd(under)), B.chain(back.filter((p) => p.role === 'back'), 'raglan', down));
      const fromSp = (pc: Piece) => {
        const sp0 = spOf(pc);
        return (q: P) => -Math.hypot(q.x - sp0.x, q.y - sp0.y);
      };
      sew(seams, B.chain([panels[0]], 'shoulder', fromSp(top)), B.chain([panels[1]], 'shoulder', fromSp(under)));
    } else if (under) {
      sew(seams, B.chain([panels[0]], 'front-seam', down), B.chain([panels[1]], 'front-seam', down));
      sew(seams, B.chain([panels[0]], 'back-seam', down), B.chain([panels[1]], 'back-seam', down));
    } else sew(seams, B.chain(panels, 'sleeve-front', down), B.chain(panels, 'sleeve-back', down));
    // (A raglan's halves keep only the lower cap, each sewn to its own side's armhole below the raglan line.)
    if (rag && under) {
      sew(seams, B.chain([panels[0]], 'armhole', down), B.chain(front.filter((p) => p.role === 'front'), 'armhole', down));
      sew(seams, B.chain([panels[1]], 'armhole', down), B.chain(back.filter((p) => p.role === 'back'), 'armhole', down));
    } else {
    // The cap, round from its top: forward to the underarm, and back.
    const cap: { id: number; th: number; q: P }[] = [];
    for (const p of panels) {
      for (const r of p.mesh.runs.armhole ?? []) {
        for (const i of r) {
          const q = p.mesh.pts[i];
          const th = ((((TAU * (uOf(p.pc, q) - capTop.x)) / period) % TAU) + TAU) % TAU;
          cap.push({ id: i + p.base, th, q: { x: uOf(p.pc, q), y: q.y } });
        }
      }
    }
    // (Round the arm, by angle; the two underarm ends of the cap, at the same angle, are one point of the seam.)
    cap.sort((x, y) => x.th - y.th || x.q.x - y.q.x);
    // Along the cap edge, as it runs round the arm: measured by the angle round and the height, not across the flat
    // piece, where the step from one underarm end to the other was counted as the sleeve's whole width. That made the
    // cap read two or three times as long as the armhole, so a third of the cloth below it was drawn in as "ease", and
    // (the two ends falling in either order) the back half of the cap was sewn into the top of the back armhole, which
    // dragged a dress's underarm up its own armhole (All round quality, 2026-11-03).
    const capS: number[] = [0];
    for (let i = 1; i < cap.length; i++) capS.push(capS[i - 1] + Math.hypot(((cap[i].th - cap[i - 1].th) * period) / TAU, cap[i].q.y - cap[i - 1].q.y));
    const fArm = B.chain(front.filter((p) => p.role === 'front'), 'armhole', down);
    const bArm = B.chain(back.filter((p) => p.role === 'back'), 'armhole', down);
    const Lf = fArm.s[fArm.s.length - 1];
    const Lb = bArm.s[bArm.s.length - 1];
    // (The loop closes from the last point back round to the first, at the cap's top.)
    const last = cap[cap.length - 1];
    const total = cap.length > 1 ? capS[capS.length - 1] + Math.hypot(((TAU - last.th + cap[0].th) * period) / TAU, cap[0].q.y - last.q.y) : 0;
    const split = (total * Lf) / (Lf + Lb);
    const capF: Chain = { ids: [], s: [] };
    const capB: Chain = { ids: [], s: [] };
    cap.forEach((c, i) => {
      if (capS[i] <= split) {
        capF.ids.push(c.id);
        capF.s.push(capS[i]);
      }
      if (capS[i] >= split) {
        capB.ids.unshift(c.id);
        capB.s.unshift(total - capS[i]);
      }
    });
    sew(seams, capF, fArm);
    sew(seams, capB, bArm);
    capRatio = Math.min(1, (Lf + Lb) / total);
    }
    // A shirt cuff: its band, folded in half along its length, round the wrist below the sleeve's hem, the hem
    // gathered onto both its edges.
    if (extra.cuffBand) {
      const band = extra.cuffBand;
      const bp = band.outline.points();
      const W = Math.max(...bp.map((q) => q.x)) - Math.min(...bp.map((q) => q.x));
      const Lb2 = Math.max(...bp.map((q) => q.y)) - Math.min(...bp.map((q) => q.y));
      const hemAlong = Math.max(...top.outline.points().map((q) => q.y)) - capH * 0.6;
      // (A tie cuff: its band is the middle of the strip, between the ties.)
      const { round: bandRound, tie: bandTie, wrap: bandWrap } = bandGeom(band, Lb2);
      const rc = bandRound / TAU + 0.3;
      const bandP = B.add(
        band,
        'sleeve',
        (q) => {
          const v = Math.min(q.x, W - q.x);
          const th = (TAU * Math.min(bandWrap, Math.max(0, q.y - bandTie))) / bandWrap;
          const rr = rc + (q.x > W / 2 ? 0.25 : 0);
          // (Kept clear of the sleeve while it settles: the cuff is laid on after.)
          return [0, 1, 2].map((k) => a[k] + dn[k] * (hemAlong + v + 60) + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k])) as V3;
        },
        thick,
      );
      cuffPanel = bandP;
    }
    // A sleeve ruffle: one strip gathered onto the sleeve's hem, laid round it after the sleeve has hung.
    if (extra.cuffRuffle) {
      const hemAlong = Math.max(...top.outline.points().map((q) => q.y));
      cuffRuffleP = B.add(extra.cuffRuffle, 'sleeve', (q) => [0, 1, 2].map((k) => a[k] + dn[k] * (hemAlong + q.x + 80) + 8 * (Math.cos((TAU * q.y) / 40) * ov[k] + Math.sin((TAU * q.y) / 40) * fv[k])) as V3, thick, [], knob('__rufMesh') ?? 0.8);
    }
  }

  // All the points, edges and bends.
  // (Every other piece's darts, sleeves' elbow darts among them, once all the pieces are in.)
  for (const p of B.panels) if (p.role !== 'front' && p.role !== 'back') for (const [a, b] of dartLegs(p)) sew(seams, a, b);
  const n = B.n;
  const pos = new Float64Array(n * 3);
  const thickA = new Float64Array(n);
  const sideA = new Uint8Array(n);
  const armA = new Uint8Array(n);
  const bendW: number[] = [];
  const centre: number[] = [];
  const centreX = new Map<number, number>();
  // (The cut-on-fold and centre-seam lines alone: not a buttoned front's overlap, which only rests near the centre.)
  const foldLine: number[] = [];
  const edges: number[] = [];
  const rest: number[] = [];
  /** Each edge's hold where it is less than full (a woven skirt's bias), by edge. */
  const edgeW = new Map<number, number>();
  const bends: number[] = [];
  const chain: [number, number, number, number][] = [];
  const hold: [number, number, number][] = [];
  // (Except round the bust: there the cloth eases over the curve, a few per cent, as a dart's shaping lets it.)
  const apexOf = new Map<Panel, P[]>();
  const nearApex = (p: Panel, x: number, y: number) => {
    if (p.role !== 'front') return false;
    if (!apexOf.has(p)) apexOf.set(p, dartsOf(p.pc).map((d) => d.tip));
    const R = knob('__bustFree') ?? 9;
    return apexOf.get(p)!.some((t) => Math.hypot(t.x - x, t.y - y) < R);
  };
  const bendRest: number[] = [];
  for (const p of B.panels) {
    const { pts, tris } = p.mesh;
    p.start.forEach((v, i) => {
      pos.set(v, (p.base + i) * 3);
      thickA[p.base + i] = p.thick[i];
      // (A raglan's shoulder piece is body cloth, not arm cloth.)
      const onArm = p.role === 'sleeve' && !p.yoke?.[i];
      sideA[p.base + i] = onArm || pts[i].x < (knob('__sideX') ?? 0.5) ? 0 : 1;
      armA[p.base + i] = onArm ? 1 : 0;
    });
    // An open polo's slit falls open in a V under its collar: down the slit, the front's centre is held out from the
    // centre plane, by most at the neck and by nothing at the slit's foot.
    const slit = p.role === 'front' && !knob('__noSlitOpen') ? (p.pc.meta.slitCm as number | undefined) : undefined;
    const slitTop = slit ? Math.min(...pts.filter((q) => q.x < 0.5).map((q) => q.y)) : 0;
    for (const tag of ['fold', 'centre', 'crotch']) for (const r of p.mesh.runs[tag] ?? []) for (const i of r) if (p.role !== 'collar') {
      centre.push(i + p.base);
      const t = slit ? (pts[i].y - slitTop) / slit : 1;
      if (t < 1) centreX.set(centre.length - 1, (knob('__slitOpen') ?? 2.2) * (1 - Math.max(0, t)));
      else foldLine.push(i + p.base);
    }
    // A vent: its underlap is cut past the centre back and laps under the other side, so the centre line itself is
    // what stays on the centre plane down the vent, not the underlap's edge.
    if (p.mesh.runs.vent && !knob('__oldVent')) {
      const top = Math.min(...p.mesh.runs.vent.flat().map((i) => pts[i].y));
      pts.forEach((q, i) => {
        if (q.y >= top && Math.abs(q.x) < 0.6) centre.push(i + p.base);
      });
    } else for (const r of p.mesh.runs.vent ?? []) for (const i of r) centre.push(i + p.base);
    if (p.role === 'collar') {
      // (A band's fold and its zipped centre edge both meet their mirror: one at the front, one at the back.)
      // (Not an open polo's front ends: they part with the slit they are sewn to.)
      for (const r of [...(p.mesh.runs.fold ?? []), ...(p.pc.meta.polo ? [] : p.mesh.runs.centre ?? [])]) for (const i of r) centre.push(i + p.base);
      // The collar's centre back edge (x = 0 as drafted) lies on the centre plane, closed against its mirror.
      // (Not a hood's: its x = 0 edge is its face edge, out at the pouch's side; its centre seam is tagged.)
      const x0 = Math.min(...pts.map((q) => q.x));
      if (!p.pc.meta.hood)
        pts.forEach((q, i) => {
          if (q.x - x0 < 0.05) centre.push(i + p.base);
        });
    }
    if (p.role === 'front' && o.partBelow && p.mesh.runs.opening) {
      const { y: y0, cm, to } = o.partBelow;
      pts.forEach((q, i) => {
        if (Math.abs(q.x) < 0.6 && !p.turned[i] && q.y > y0) {
          centre.push(i + p.base);
          centreX.set(centre.length - 1, (cm * Math.min(1, (q.y - y0) / Math.max(1, to - y0))) as number);
        }
      });
    }
    if ((p.role === 'front' || p.role === 'peplum-front') && o.closedFront && p.mesh.runs.opening) {
      pts.forEach((q, i) => {
        if (Math.abs(q.x) < 0.6 && !p.turned[i] && (o.openBelowY === undefined || q.y < o.openBelowY) && (o.openAboveY === undefined || q.y > o.openAboveY)) centre.push(i + p.base);
      });
    }
    if (p.role === 'front' && o.pinFront) {
      pts.forEach((q, i) => {
        if (Math.abs(q.x) < 0.9 && o.pinFront!.some((f) => Math.abs(q.y - f.y) < f.span) && !p.turned[i]) centre.push(i + p.base);
      });
    }
    // A wrap front's own half, cut a little past the centre (ownHalf): the centre line itself stays on the centre
    // plane, and the strip past it laps over the other front, as a buttoned front's extension does.
    // (Where the wrap front meets the waist, sewn into a dress's waist seam or tied, the strip past the centre is held
    // there too: left free, a deeper bust dart, at least 3.8 cm from Rodica's review of Nov 9, rumpled its end into a
    // sawtooth.)
    if (p.role === 'front' && p.mesh.runs.wrap) {
      const waist = new Set((p.mesh.runs.waist ?? []).flat());
      pts.forEach((q, i) => {
        if ((Math.abs(q.x) < 0.6 || (q.x < 0 && waist.has(i))) && !p.turned[i]) centre.push(i + p.base);
      });
    }
    const edgeSet = new Map<string, number[]>();
    for (const [a, b, c] of tris) {
      for (const [u, v, w] of [
        [a, b, c],
        [b, c, a],
        [c, a, b],
      ]) {
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        const list = edgeSet.get(k);
        if (list) list.push(w);
        else edgeSet.set(k, [w]);
      }
    }
    // A woven skirt's cloth gives on the bias and holds on its grain (Cat's B, 2026-11-07): each edge holds its cut
    // length less the further it runs from the grain, least at 45 degrees. (A skirt's cloth only, where the fall pulls:
    // see skirtBend.)
    // (A circle's piece gives half as much: its grain swings round it, and at the full give its back folded into a fin
    // in a silk or satin half circle at the knee.)
    // (A piece cut on the bias, a slip, gives up to 0.3: along its length the cloth is all bias, and pulled down it
    // narrows round the hip and thigh, as a bias slip clings. Fabric behaviour round 2; at 0.6 a silk slip gown's back
    // folded through itself once the skirt was kept from passing through itself, release M.)
    const biasOf = o.bias && (o.fallOn === 'all' || (o.fallOn === 'skirt' && p.role.startsWith('peplum'))) && !knob('__noBias') ? knob('__bias') ?? (p.pc.meta.bias ? Math.min(0.3, o.bias * 3) : p.pc.meta.waistRadius ? o.bias * (knob('__circleBias') ?? 0.5) : o.bias) : 0;
    const holdHere = !!extra.trousers && !!o.fall && o.fall > 1 && o.fallOn === 'all' && !knob('__noHold');
    const gr = p.pc.grain ? [p.pc.grain[1].x - p.pc.grain[0].x, p.pc.grain[1].y - p.pc.grain[0].y] : [0, 1];
    const grL = Math.hypot(gr[0], gr[1]) || 1;
    for (const [k, opp] of edgeSet) {
      const [u, v] = k.split(',').map(Number);
      edges.push(u + p.base, v + p.base);
      rest.push(Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y));
      if (biasOf) {
        const c = ((pts[v].x - pts[u].x) * gr[0] + (pts[v].y - pts[u].y) * gr[1]) / grL / (rest[rest.length - 1] || 1);
        edgeW.set(edges.length / 2 - 1, 1 - biasOf * 4 * c * c * (1 - c * c));
      }
      // (Down a trouser leg that falls harder than the light pull: held to its cut length too, so its weight drops it
      // straight off the hip rather than stretching it 3 times its cut, Fabric behaviour round 4. Not a skirt: held so,
      // a silk circle skirt and a satin tier folded into fins.)
      if (holdHere && Math.abs(pts[u].y - pts[v].y) > (knob('__holdDy') ?? 0.85) * rest[rest.length - 1]) hold.push(pos[(u + p.base) * 3 + 1] < pos[(v + p.base) * 3 + 1] ? [u + p.base, v + p.base, rest[rest.length - 1]] : [v + p.base, u + p.base, rest[rest.length - 1]]);
      // (Running down the cloth, on a bodice: held to near its cut length in the sim, top first.)
      if ((p.role === 'front' || p.role === 'back') && !p.turned[u] && !p.turned[v] && Math.abs(pts[u].y - pts[v].y) > 0.5 * rest[rest.length - 1] && !nearApex(p, (pts[u].x + pts[v].x) / 2, (pts[u].y + pts[v].y) / 2))
        chain.push(pts[u].y < pts[v].y ? [u + p.base, v + p.base, rest[rest.length - 1], pts[u].y] : [v + p.base, u + p.base, rest[rest.length - 1], pts[v].y]);
      if (opp.length === 2 && p.turned[opp[0]] === p.turned[opp[1]]) {
        bends.push(opp[0] + p.base, opp[1] + p.base);
        bendRest.push(Math.hypot(pts[opp[0]].x - pts[opp[1]].x, pts[opp[0]].y - pts[opp[1]].y));
        // Below its last button a coat front is faced: the facing stiffens its edge, so the corners hang flat, not curl.
        const faced = p.role === 'front' && !!o.pinFront?.length && [opp[0], opp[1]].every((j) => pts[j].x < 7 && pts[j].y > Math.max(...o.pinFront!.map((f) => f.y)) + 4);
        // (A full sleeve's gathered bulk holds its cloth in rounded folds whatever the fibre: left as soft as a silk is, the
        // sim crumpled a full bishop into 56 sharp pleats down the arm, where in cotton it hung round, 2026-11-06. Its
        // bends are stiffened to a cotton's.)
        const fullSleeve = p.role === 'sleeve' && !!p.pc.meta.full;
        // (The rest of the garment, a bodice and its sleeves, takes the square root of the cloth's own stiffness against
        // its fibre's: a silk or a denim top shows its cloth, and none folded into fins that didn't before, Fabric
        // behaviour round 2. All of it, as a skirt does, and tops folded into fins.)
        const hungHere = o.fallOn === 'all' || (o.fallOn === 'skirt' && p.role.startsWith('peplum'));
        const pours = o.skirtBend !== undefined && !(o.skirtBend < 1 && fullCircle(extra.skirt)) && hungHere ? o.skirtBend : !hungHere && o.skirtBend !== undefined ? o.skirtBend ** (knob('__topBendPow') ?? 0.5) : 1;
        const w = p.role === 'collar' || p.turned[opp[0]] ? 4 : faced ? FACED(o) : o.crisp && /peplum/i.test(p.pc.name) ? o.crisp : fullSleeve ? Math.max(1, 0.06 / (o.bendK ?? 0.05)) : pours;
        // (A stiff jacket's cloth is firm already: its collar's and facings' extra stiffness is held to what the sim can
        // take in one pass, or a bend pulled past its rest more than its own length over overshoots and the cloth flies
        // apart, 2026-11-07; and its body to its own stiffness, whatever its cloth's fall, or a double-breasted front's
        // wide overlap stretched.)
        bendW.push(o.stiff ? Math.min(w, (w === pours ? o.stiffMax ?? stiffBendNow() : STIFF_BEND_MAX) / (o.bendK ?? 0.05)) : w);
      }
    }
  }
  // A sleeve cap is longer than its armhole by its ease, which a tailor shrinks away with steam before setting it in:
  // the cloth along the cap is drawn in by that much, fading out a few cm into the sleeve, so it sets smooth.
  // (Half of it: shrunk away entirely, the cap's edge draws in tighter than the armhole it is sewn to and a slit of the
  // seam opens; a little left, the head still rounds over the shoulder rather than standing up in a peak.)
  const capEase = knob('__capEase') ?? 0.5;
  if (capRatio < 1 && capEase !== 0 && !o.flatCrown) {
    for (const p of B.panels) {
      if (p.role !== 'sleeve') continue;
      const cap = (p.mesh.runs.armhole ?? []).flat().map((i) => p.mesh.pts[i]);
      if (!cap.length) continue;
      const lo = p.base;
      const hi = p.base + p.mesh.pts.length;
      for (let e = 0; e < rest.length; e++) {
        const u = edges[2 * e];
        const v = edges[2 * e + 1];
        if (u < lo || u >= hi || v < lo || v >= hi) continue;
        const a = p.mesh.pts[u - lo];
        const b = p.mesh.pts[v - lo];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        let d = Infinity;
        for (const q of cap) d = Math.min(d, Math.hypot(q.x - mid.x, q.y - mid.y));
        const w = Math.max(0, 1 - d / (knob("__capW") ?? (o.boxy ? 10 : 9)));
        rest[e] *= 1 - (1 - capRatio) * w * capEase;
      }
    }
  }
  // A fitted sleeve's cap, cut for an arm lifted a little, gives on the bias over the top of the arm as it hangs at
  // the side: the cloth down the cap lengthens by that give, so the sleeve's underarm reaches the armhole and the
  // bodice under it isn't drawn up to meet it.
  const capGive = knob('__capGive') ?? 0;
  if (capGive > 0 && !extra.puff && !o.boxy) {
    for (const p of B.panels) {
      if (p.role !== 'sleeve' || p === cuffPanel) continue;
      const capH = (p.pc.meta.capHeight as number) ?? 15;
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const lo = p.base;
      const hi = p.base + p.mesh.pts.length;
      for (let e = 0; e < rest.length; e++) {
        const u = edges[2 * e];
        const v = edges[2 * e + 1];
        if (u < lo || u >= hi || v < lo || v >= hi) continue;
        const a = p.mesh.pts[u - lo];
        const b = p.mesh.pts[v - lo];
        const t = ((a.y + b.y) / 2 - y0) / capH;
        if (t > 1.15) continue;
        const w = t < 1 ? 1 : 1 - (t - 1) / 0.15;
        const dy = Math.abs(a.y - b.y);
        const L = rest[e] || 1e-9;
        rest[e] = Math.hypot(Math.abs(a.x - b.x), dy * (1 + capGive * w));
        if (!(rest[e] > 0)) rest[e] = L;
      }
    }
  }
  // A long sleeve hangs from a cap that sits higher in the sim than on an arm (the sim can't let its underarm drop below
  // the bodice's): the drop the cap can't take is given to the upper arm just below it, so the cuff reaches the wrist
  // without the cap peaking over the shoulder.
  const armGive = knob('__armGive') ?? 2.4;
  if (armGive > 0 && !extra.puff && !o.boxy) {
    for (const p of B.panels) {
      if (p.role !== 'sleeve' || p === cuffPanel) continue;
      const capH = (p.pc.meta.capHeight as number) ?? 15;
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      // (Only a sleeve long enough to reach the forearm.)
      if (Math.max(...ys) - y0 < capH + 25) continue;
      const span = 20;
      const lo = p.base;
      const hi = p.base + p.mesh.pts.length;
      for (let e = 0; e < rest.length; e++) {
        const u = edges[2 * e];
        const v = edges[2 * e + 1];
        if (u < lo || u >= hi || v < lo || v >= hi) continue;
        const a = p.mesh.pts[u - lo];
        const b = p.mesh.pts[v - lo];
        const y = (a.y + b.y) / 2 - y0;
        const from = capH + (knob('__armGiveFrom') ?? 8);
        if (y < from || y > from + span) continue;
        const L = rest[e] || 1e-9;
        rest[e] = Math.hypot(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * (1 + armGive / span));
        if (!(rest[e] > 0)) rest[e] = L;
      }
    }
  }
  // Nothing over the shoulders (a skirt, a strapless or cami bodice): its top edge is held at the height it is worn,
  // as a waistband or boning holds it on the body.
  const hangOf = () => {
    const tp = B.panels.filter((p) => p.role === 'front' || p.role === 'back');
    if (tp.some((p) => p.mesh.runs.shoulder)) {
      // A sleeve hangs from its armhole, and the armhole is a sewn, stayed seam: it keeps its depth under the sleeve's
      // weight (a short top's gave 2 to 3 cm, the hem dipping at the sides with it, once the cap was sewn in at its true
      // length, All round quality 2026-11-03). Each armhole point is held from dropping below where it is cut to sit.
      const stayArm = B.panels.some((p) => p.role === 'sleeve' && !p.hidden) && !knob('__noArmholeStay');
      // A cropped top's seam under the bust is held too (cropHold.ts).
      const crop = extra.cropped && !knob('__noCropHold') ? cropHold(tp) : undefined;
      if (!stayArm && !crop) return undefined;
      const ids: number[] = crop?.ids ?? [];
      const c: number[] = crop?.c ?? [];
      const slack = knob('__armholeSlack') ?? 0.5;
      if (stayArm) {
        // (Not its top few cm at the shoulder, which the shoulder seam itself holds: stayed there too, the tip floated
        // above the shoulder.)
        for (const p of tp) {
          const run = [...new Set((p.mesh.runs.armhole ?? []).flat())];
          const top = Math.min(...run.map((i) => p.mesh.pts[i].y));
          for (const i of run) if (p.mesh.pts[i].y - top > (knob('__stayFrom') ?? 4)) {
            ids.push(i + p.base);
            c.push(p.start[i][1] + slack);
          }
        }
      }
      return ids.length ? { ids: Int32Array.from(ids), c: Float64Array.from(c) } : undefined;
    }
    const held = tp.length ? tp : B.panels.filter((p) => p.role === 'peplum-front' || p.role === 'peplum-back');
    const tag = tp.length ? 'neck' : 'waist';
    // (A high-waisted skirt hangs from its top edge, above the waist.)
    const ids = held.flatMap((p) => (p.mesh.runs[tag] ?? (tag === 'waist' ? p.mesh.runs.top : undefined) ?? []).flat().map((i) => i + p.base));
    const c = ids.map((i) => pos[i * 3 + 1]);
    // (A pleated skirt's side seam, down to the hip where its pleats are stitched: held at its own level too. Closed up
    // for the sim, the narrow strip between the last fold and the seam otherwise lets the seam slide down the hip,
    // the cloth beside it folding under, which draws as a hole at the side.)
    if (!tp.length)
      for (const p of held) {
        const folds = p.pc.meta.pleatFolds as PleatFold[] | undefined;
        if (!folds?.length) continue;
        const slack = 0.5;
        for (const i of new Set((p.mesh.runs.side ?? []).flat())) {
          if (p.mesh.pts[i].y > folds[0].hip.y) continue;
          ids.push(i + p.base);
          c.push(pos[(i + p.base) * 3 + 1] + slack);
        }
      }
    return { ids: Int32Array.from(ids), c: Float64Array.from(c) };
  };
  // A sleeve keeps its tube round the arm: the radius at each height is its own girth there (top and under sleeve
  // together), less the cloth's give, so a wide coat sleeve stands round as wool does rather than folding flat.
  const roundOf = () => {
    const sl = B.panels.filter((p) => p.role === 'sleeve' && p !== cuffPanel);
    if (!sl.length || knob("__noRound")) return undefined;
    // (Not a flutter: it is cut as a fan, so a row across the flat piece is no girth of it, and held to the fan's
    // width it stood off the arm as a stiff cone. It falls in the flutes it is laid in, see flutterPlace.)
    if (sl.some((p) => p.pc.meta.flutter) && !knob('__noFlutter')) return undefined;
    const capH = (sl[0].pc.meta.capHeight as number) ?? 15;
    const widthAt = (y: number) =>
      sl.reduce((sum, p) => {
        const xs = p.mesh.pts.filter((q) => Math.abs(q.y - y) < 1.2).map((q) => q.x);
        return sum + (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
      }, 0);
    const ids: number[] = [];
    const R: number[] = [];
    // Gathered into a cuff, the sleeve's fullness falls in folds just above it rather than standing out round the arm
    // as a tube: over the last stretch above the cuff the tube draws in to a little more than the cuff.
    // (A cuff band is cut its round long, down the pattern.)
    const cuffR = cuffPanel ? bandGeom(cuffPanel.pc, Math.max(...cuffPanel.mesh.pts.map((q) => q.y)) - Math.min(...cuffPanel.mesh.pts.map((q) => q.y))).round / TAU : 0;
    const zone = knob('__cuffZone') ?? 18;
    for (const p of sl) {
      const yHem = Math.max(...p.mesh.pts.map((q) => q.y));
      p.mesh.pts.forEach((q, i) => {
        if (q.y < capH + 2) return;
        ids.push(p.base + i);
        // (Soft cloth, a silk, doesn't stand round: its fullness falls in folds close round the arm. Not a full sleeve's:
        // its gathered bulk stands it round whatever the fibre, and laid close a full silk bishop crumpled into 15 to 29
        // sharp folds down the arm, 2026-11-06. Nor a puff's: its crown is gathered to stand out, and drawn in to the
        // silk's tube a short puff in silk or viscose tore at the sleeve and failed the drawing check, 2026-11-07. Nor a knit
        // tee's: jersey holds its round, and drawn in a relaxed silk tee's sleeve bunched at its hem, 2026-11-07. Drawn in to 0.72 of
        // its round, an elbow cap sleeve went jagged and a three-quarter one folded into fins in silk; 0.85 still lets it
        // fall close, 2026-11-07.)
        let r = (widthAt(q.y) / TAU) * 0.92 * ((o.bendK ?? 0.05) < 0.04 && !p.pc.meta.full && !p.pc.meta.gatheredCrown && !p.pc.meta.knit ? knob('__silkR') ?? 0.85 : 1);
        if (cuffR && !knob('__noCuffDraw')) {
          const t = Math.min(1, Math.max(0, (yHem - q.y) / zone));
          const s2 = t * t * (3 - 2 * t);
          const lo = cuffR * (knob('__cuffEase') ?? 1.15);
          if (r > lo) r = lo + (r - lo) * s2;
        }
        R.push(r);
      });
    }
    return { ids: Int32Array.from(ids), R: Float64Array.from(R), k: knob("__rk") ?? 0.15 };
  };
  // Turned cloth (a lapel, a collar's fall) lies on the cloth it was turned over: each point rests on the point of
  // the same piece that it covers when folded at the roll line, one cloth's thickness out, as pressing sets it.
  const lieOnOf = () => {
    const lapels = (knob("__lieLapel") ?? o.lieLapel);
    if (!knob("__lie") && !lapels) return undefined;
    const I: number[] = [];
    const J: number[] = [];
    const G: number[] = [];
    for (const p of B.panels) {
      // Only a collar's fall for now: a lapel resting this way drags a long plunge front down (not yet understood).
      if (!p.folds?.length || (p.role !== 'collar' && !lapels)) continue;
      // (On a front, only onto the body of the front: not the button extension, which lies over the other side.)
      const flat = p.mesh.pts.map((q, i) => ({ q, i })).filter(({ q, i }) => !p.turned[i] && (p.role === 'collar' || q.x > 1));
      p.mesh.pts.forEach((q, i) => {
        if (!p.turned[i]) return;
        const r = reflect(q, p.folds![0][0], p.folds![0][1]);
        let best = -1;
        let bd = 1.2;
        for (const f of flat) {
          const d = Math.hypot(f.q.x - r.x, f.q.y - r.y);
          if (d < bd) {
            bd = d;
            best = f.i;
          }
        }
        if (best < 0) return;
        I.push(p.base + i);
        J.push(p.base + best);
        G.push(p.thick[best] - (o.thick ?? 0.35) + (o.thick ?? 0.35) * 1.5);
      });
    }
    return I.length ? { i: Int32Array.from(I), j: Int32Array.from(J), gap: Float64Array.from(G) } : undefined;
  };
  // (Each shoulder point's distance out, as cut on the front: the back's shoulder, eased onto it, by its share along.)
  const strapHold = (): Float64Array => {
    // (In step with `shoulder` below: a raglan's shoulder pieces too, each point by where it was placed, since its
    // own x is the sleeve piece's.)
    const tp = B.panels.filter((p) => p.role === 'front' || p.role === 'back' || (p.yoke && !knob('__noYokeSh')));
    const fr = tp.filter((p) => p.role === 'front').flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i].x));
    const f0 = Math.min(...fr);
    const f1 = Math.max(...fr);
    return Float64Array.from(
      tp.flatMap((p) => {
        const xs = (p.mesh.runs.shoulder ?? []).flat().map((i) => (p.yoke ? Math.abs(p.start[i][0]) : p.mesh.pts[i].x));
        const a = Math.min(...xs);
        const b = Math.max(...xs);
        return xs.map((x) => (fr.length ? f0 + ((x - a) / (b - a || 1)) * (f1 - f0) : x) + (knob('__strapSlack') ?? 0.5));
      }),
    );
  };
  const sleeved = B.panels.some((p) => p.role === 'sleeve' && !p.hidden);
  const shortTop =
    !extra.skirt?.length && !extra.trousers && !extra.tiers?.length && !!torso.length &&
    torso.every((t) => Math.max(...t.pc.outline.taggedPoints(12).pts.map((q) => q.y)) <= t.waistY + (knob("__shortBelow") ?? 8));
  // (Cut with full shoulders, a shell's, rather than straps: the shoulder seam's cut length, as widensForm reads it.
  // From 7 cm, not 9, since 2026-11-03: a square neck's 8.8 cm shoulder, left to settle as a strap, slid behind the
  // side and stood its corners up as wings; held as a full shoulder it lies on the shoulder.)
  const fullShoulders = B.panels.some((p) => {
    if (p.role !== 'front') return false;
    const sh = (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i]);
    return sh.length > 1 && Math.hypot(sh[0].x - sh[sh.length - 1].x, sh[0].y - sh[sh.length - 1].y) >= (knob('__fullSh') ?? 7);
  });
  // (A sleeveless front cut down to a plunge, hung from straps: left to settle, a top's straps slid 8 cm behind the
  // shoulder and took the whole V edge round to the side of the body, where the stay-tape pass then had to drag it
  // 10 cm back to the front and tore the cloth beside it 5x, All round quality 2026-11-04. Its straps are held on the
  // shoulder's top as a sleeved seam is, as the plunge dress's already were under its skirt's weight.)
  const deepFront = B.panels.some((p) => {
    if (p.role !== 'front' || p.hidden) return false;
    const neck = (p.mesh.runs.neck ?? []).flat();
    if (!neck.length) return false;
    const ny = neck.map((i) => p.mesh.pts[i].y);
    const deep = Math.max(...ny);
    return deep - Math.min(...ny) >= (knob('__stayDeep') ?? 15) && Math.abs(p.mesh.pts[neck[ny.indexOf(deep)]].x) <= 2;
  });
  const deepTop = deepFront && !sleeved && !extra.skirt?.length;
  const input: SimInput = {
    pos,
    edges: Int32Array.from(edges),
    rest: Float64Array.from(rest),
    bends: Int32Array.from(bends),
    bendRest: Float64Array.from(bendRest),
    seams,
    centre: Int32Array.from(centre),
    ...(centreX.size ? { centreX: Float64Array.from(centre.map((_, k) => centreX.get(k) ?? 0)) } : {}),
    thick: thickA,
    side: sideA,
    onArm: armA,
    pressed: Uint8Array.from(B.panels.flatMap((p) => p.turned.map((t) => (t ? 1 : 0)))),
    chain: (() => {
      const c = [...chain].sort((m, n) => m[3] - n[3]);
      // (Hard under a long skirt's weight, which would otherwise draw the bodice down, less over a full bust:
      // heavyHold.ts; a top that carries only itself is held gently, or the hold ratchets it up over the bust.)
      const k = o.heavySkirt ? heavyChainK(sp) : knob('__lightK') ?? 0.3;
      return { up: Int32Array.from(c.map((q) => q[0])), lo: Int32Array.from(c.map((q) => q[1])), rest: Float64Array.from(c.map((q) => q[2])), k };
    })(),
    // (Settled from the top: each held by the one above it, sorted by where the upper point starts.)
    ...(hold.length ? { hold: (() => {
      const h = [...hold].sort((m, n) => pos[m[0] * 3 + 1] - pos[n[0] * 3 + 1]);
      return { up: Int32Array.from(h.map((q) => q[0])), lo: Int32Array.from(h.map((q) => q[1])), rest: Float64Array.from(h.map((q) => q[2])) };
    })() } : {}),
    lieOn: lieOnOf(),
    bendW: Float64Array.from(bendW),
    ...(edgeW.size ? { edgeW: Float64Array.from({ length: edges.length / 2 }, (_, e) => edgeW.get(e) ?? 1) } : {}),
    bendK: o.bendK ?? 0.05,
    pad: o.pad,
    // A top that ends at the waist, nothing hung below it, hangs by more than the light pull: too light to draw its
    // spare length down off the chest, it folded that length into a ledge across the front at the underarm.
    // (Not a plunge top: with no cloth under its neck but the V's edge, the extra pull dragged that edge 4 cm out and
    // down the chest, All round quality 2026-11-04.)
    // Trousers hang by the heavier pull too: under the light one the crotch of a short leg (shorts, a knee length, a
    // tapered knee with pleats) stayed caught at the front and back of the body instead of drawing in between the
    // legs, and tore the cloth just below it (All round quality, 2026-11-07: 51 of 51 test trousers pass with it).
    ...(extra.trousers && !knob('__noTrouserG') ? { gK: 3 } : {}),
    ...(shortTop && !knob('__noShortG') && !deepFront ? { gK: 3, gFromY: (() => {
      // (From a little below the shoulder seams down: above that, the neck and shoulders hang by the light pull, or the
      // back of the neck drew down off the front's at the shoulder seam and showed its inside in a notch. Only in toward
      // the neck: out at the armholes, held lighter than the sleeves, the seam there tore.)
      const sh = B.panels.filter((p) => p.role === 'front' || p.role === 'back' || p.yoke).flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => pos[(i + p.base) * 3 + 1]));
      return (sh.length ? Math.max(...sh) : 0) + (knob('__gBelowSh') ?? 8);
    })(), gFromX: knob('__gNeckX') ?? 6 } : {}),
    hang: (() => {
      const h = hangOf();
      // (A cowl's fold: hung as the U it is set in, each point held from dropping below it. Left to the pull alone, the
      // fold sagged to the V its length allows, a point at the centre front, All round quality 2026-11-04.)
      const cw = B.panels.filter((p) => p.pc.meta.cowl && !p.hidden);
      if (!cw.length || knob('__noCowlHang')) return h;
      const ids = cw.flatMap((p) => [...new Set((p.mesh.runs.neck ?? []).flat())].map((i) => i + p.base));
      const c = ids.map((i) => pos[i * 3 + 1] + (knob('__cowlSlack') ?? 0.3));
      return { ids: Int32Array.from([...(h?.ids ?? []), ...ids]), c: Float64Array.from([...(h?.c ?? []), ...c]) };
    })(),
    round: roundOf(),
    ...(!sleeved && !knob('__armRest') ? { armFree: true } : {}),
    legs,
    // (A raglan's shoulder seam is on its shoulder pieces: held on the shoulder the same, the sleeve hangs from it.)
    shoulder: Int32Array.from(B.panels.filter((p) => p.role === 'front' || p.role === 'back' || (p.yoke && !knob('__noYokeSh'))).flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => i + p.base))),
    // Sleeveless, each shoulder point is held no further out than it is cut (a set-in strap stays over the shoulder).
    // The shoulder seam is sewn along the top of the shoulder, as cut: the cloth hangs from it there and can't slide out
    // along the shoulder or round to the front or back under a heavy skirt's weight.
    ...(!knob('__noStrapHold') ? { shoulderX: strapHold() } : {}),
    // (A sleeveless top cut with straps, nothing hung from it, is left to settle its seam where the shoulder carries
    // it: held forward, it dragged the neck point out and down and left a crew neck sitting low.)
    // (A sleeveless dress, or a sleeveless top with a peplum, cut with full shoulders hangs its skirt from them: the seam is held where
    // a top without one settles it, a little behind the side, and left to sit up on the neck's base. Held forward and
    // pinned down onto the shoulder's top, the back neck rode up the neck like a stand collar.)
    // (A sleeveless top cut with full shoulders is held the same way, since 2026-11-03: left to settle, its seam slid
    // 6 to 7 cm behind the side, and the front armhole's top ran forward from there level over the arm's top as a
    // square shelf. Held a little behind the side it sits on the shoulder as the dress's does; held nearer the side,
    // the crew neck dropped at the front.)
    ...(!knob('__noHoldZ') && (sleeved || extra.skirt?.length || o.pinFront?.length || extra.trousers || fullShoulders || (deepFront && !knob('__noDeepHold')) || knob('__holdZ') !== undefined)
      ? !sleeved && fullShoulders && !o.pinFront?.length && !extra.trousers && !knob('__oldHoldZ')
        ? // (A sleeveless top with a peplum is held 1.5 cm behind the side, not the 3 cm back that suits a dress: held
          // back under a peplum's light weight, its shoulders sank inside the form's and the form showed through both
          // shoulder tops; held half a centimetre forward as a plain sleeveless top is, a big peplum's weight drew the
          // back 2.3 cm inside the form and stretched a big flared one's back 3 times, All round 2026-11-06. A dress's
          // skirt is heavy and keeps the -3.)
          { shoulderZ: knob('__holdZ') ?? (extra.skirt?.length && !o.heavySkirt ? -1.5 : -3), shoulderZFree: true }
        : // (A short top's sleeved shoulder seam is held only from the neck to 4 cm short of the shoulder's tip: held out
          // to the tip, the sleeve pulled the side of a waist-length top up into the armhole and tore the underarm.)
          // (A plunge top's straps: held a little behind the side, as a full shoulder is, and left to settle their height;
          // pinned down to the shoulder's top at their cut distance out, they lay level past the shoulder as tabs. Not
          // the full 3 cm behind: that stretched the top's front and put the dress's inside the form. A plunge dress's
          // straps are not left to settle at all: its skirt's weight already holds them, and settled 1.5 cm back the
          // bias slip gown's front went 2 cm inside the form.)
          // (A waistcoat, a jacket cut without sleeves, is held just behind the side, a little as a sleeveless top is:
          // held half a centimetre forward, a long boxy shoulder's tips poked up as points and a soft collar's neck seam
          // was stretched twice its length, Look 02 vest 2026-11-08. Held further back, its front stretched.)
          { shoulderZ: knob('__holdZ') ?? (deepTop ? knob('__deepZ') ?? -1.5 : !sleeved && o.pinFront?.length ? -0.5 : 0.5), ...(sleeved && shortTop ? { shoulderZIn: 4 } : {}), ...(deepTop ? { shoulderZFree: true } : {}) }
      : {}),
  };
  // A flared peplum (or a hem's flounce) cut on the fold: the cloth beside the fold bends on round it rather than folding back flat
  // against its other half (which left a knife-edge keel down the centre front).
  if (!knob('__noMirror')) {
    const ids: number[] = [];
    const mr: number[] = [];
    for (const p of B.panels) {
      if (p.hidden || !(/^Peplum/.test(p.pc.name) || (/peplum/.test(p.role) && /ruffle|flounce/i.test(p.pc.name))) || !p.mesh.runs.fold?.length || p.mesh.runs.opening?.length) continue;
      p.mesh.pts.forEach((q, i) => {
        if (q.x > 0.05 && q.x < 3 && !p.turned[i]) {
          ids.push(p.base + i);
          mr.push(2 * q.x);
        }
      });
    }
    if (ids.length) input.mirror = { ids: Int32Array.from(ids), rest: Float64Array.from(mr), k: knob('__mk') ?? 0.5 };
  }
  // A skirt's cloth is kept from passing through itself (sim.ts `self`).
  if (!knob('__noSelf')) {
    const ids: number[] = [];
    const u: number[] = [];
    const v: number[] = [];
    const piece: number[] = [];
    const sewnAt = new Set<number>();
    for (const { i, j, k } of seams) sewnAt.add(i).add(j).add(k);
    let flare = 0;
    B.panels.forEach((p, n) => {
      // (Not a pleated skirt's, whose pressed folds lie on each other, nor a balloon's, gathered onto its underskirt.)
      if (p.hidden || !/^Skirt/.test(p.pc.name) || !/peplum/.test(p.role) || p.mesh.runs.pleat?.length || p.pc.meta.pleatFolds || p.mesh.runs.balloon?.length) return;
      // (Only a skirt that flares out from its waist, a circle's or a trumpet's: its hem a quarter as long again as its waist
      // or more; or a gathered one, whose fullness is in its waist. A straighter skirt's cloth hangs apart on its own. At
      // half as long again, trumpet and gathered skirts were left out and folded through themselves, 2026-11-07.)
      const runLen = (tag: string) => (p.mesh.runs[tag] ?? []).reduce((sum, r) => sum + r.slice(1).reduce((a, m, k) => a + Math.hypot(p.mesh.pts[m].x - p.mesh.pts[r[k]].x, p.mesh.pts[m].y - p.mesh.pts[r[k]].y), 0), 0);
      const gathered = ((p.pc.meta.gathered as number | undefined) ?? 1) > 1.05 && !knob('__noSelfGather');
      // (Under a waist seam dropped onto the hip, a higher bar: skirtApart.ts.)
      if (!gathered && runLen('hem') < (knob('__selfFlare') ?? ((extra.drop ?? 0) > 1 ? droppedFlareCut(o.bendK ?? 0.05) : 1.25)) * runLen('waist')) return;
      // (Only a panel cut with its own waist: one sewn to a yoke has none, and read as a huge flare, 2026-11-08.)
      if (runLen('waist') > 5) flare = Math.max(flare, runLen('hem') / runLen('waist'));
      p.mesh.pts.forEach((q, i) => {
        ids.push(p.base + i);
        u.push(q.x);
        v.push(q.y);
        piece.push(n);
      });
    });
    if (ids.length) input.self = { ids: Int32Array.from(ids), u: Float64Array.from(u), v: Float64Array.from(v), piece: Int32Array.from(piece), sewn: Uint8Array.from(ids, (g) => (sewnAt.has(g) ? 1 : 0)), d: selfGap(flare) };
  }
  // Trousers settle in fewer steps: laid on their legs they are near where they hang, and left to run the full count the
  // cloth below the crotch kept drifting into folds and opened the inside leg (All round quality, 2026-11-07: of 51
  // trousers in three cloths, 35 passed at 260 steps and 44 at 60 to 100).
  // The cloth's own behaviour (clothCard.ts): a fluid or heavy cloth falls harder into its folds; a knit gives along
  // its length.
  // (Only a skirt's cloth, or a dress's skirt (at most 1.4 times: a silk cowl's bodice folded into fins under more), and
  // never a yoke: pulled harder, the cloth a skirt hangs from (a bodice, a
  // yoke) stretched to 4 to 10 times its cut, and a big peplum or a cowl folded into fins, Fabric behaviour 2026-11-07.
  // A skirt with a yoke keeps the light pull: its yoke carries the whole skirt.)
  if (o.fall && o.fall > 1 && o.fallOn && !knob('__noFall')) {
    const hung = B.panels.filter((p) => (o.fallOn === 'all' || p.role.startsWith('peplum')) && !p.hidden);
    // (Nor a full circle: see fullCircle.)
    if (hung.length && !fullCircle(extra.skirt) && !B.panels.some((p) => /yoke/i.test(p.pc.name))) {
      const sc = new Float32Array(pos.length / 3).fill(1);
      const fall = knob('__fall') ?? (o.fallOn === 'skirt' ? Math.min(o.fall, knob('__dressFall') ?? 1.4) : extra.trousers ? Math.min(3, o.fall * (knob('__trouserFallX') ?? 5 / 3)) : o.fall);
      // (A bias-cut piece in a fluid cloth hangs twice as hard, up to 3: its weight is what draws it in to cling. In a
      // cotton, pulled harder, the slip's back was drawn 2.5 times its cut.)
      for (const p of hung) for (let i = 0; i < p.mesh.pts.length; i++) sc[p.base + i] = p.pc.meta.bias ? Math.min(3, fall * 2) : fall;
      input.gScale = sc;
    }
  }
  if (o.stretch) input.edgeK = 1 - o.stretch;
  // A soft cloth starts in gentle waves round its hang, deepening to the hem, so it settles into the soft folds a silk
  // falls in: laid smooth, the sim hung it smoother (Cat's "seed folds", Fabric behaviour round 5). By where each point
  // lies, so the points of a seam move together. (Not a full circle: it is laid in its own flutes. Not under a tier or ruffle: their seams pulled apart. Nor a bias slip, laid in its own folds. Not trousers: seeded,
  // a silk leg settled back to the same smooth tube; that waits on the sim itself.)
  const seedAmp = knob('__seedAmp') ?? 2;
  if (o.skirtBend !== undefined && o.skirtBend < 1 && o.fallOn && !extra.trousers && seedAmp > 0 && !fullCircle(extra.skirt) && !B.panels.some((p) => /tier|ruffle/i.test(p.pc.name)) && !knob('__noSeed')) {
    const hung = B.panels.filter((p) => (o.fallOn === 'all' || p.role.startsWith('peplum')) && !p.hidden && !p.pc.meta.bias);
    const lam = knob('__seedLam') ?? 9;
    const top = sp.cOf(0.82);
    let bot = top + 1;
    for (const p of hung) for (let i = 0; i < p.mesh.pts.length; i++) bot = Math.max(bot, pos[(p.base + i) * 3 + 1]);
    const soft = Math.min(1, (1 - o.skirtBend) / 0.4);
    for (const p of hung)
      for (let i = 0; i < p.mesh.pts.length; i++) {
        const I = (p.base + i) * 3;
        const t = Math.min(1, Math.max(0, (pos[I + 1] - top) / (bot - top)));
        if (!t) continue;
        const dx = pos[I];
        const dz = pos[I + 2];
        const r = Math.hypot(dx, dz) || 1;
        const a = Math.atan2(dx, dz) * r;
        const k = 1 + (seedAmp * soft * t * Math.sin((a / lam) * TAU)) / r;
        pos[I] = dx * k;
        pos[I + 2] = dz * k;
      }
  }
  const res = simulate(sp, input, extra.trousers ? (knob('__trouserSteps') ?? 100) : undefined);
  // A popped collar is held up by its interfacing and its roll, which the cloth here does not have: it keeps the shape
  // it was set in, standing round the neck, and only moves as the neck it is sewn to moves.
  for (const p of poppedPanels) {
    const neck = (p.mesh.runs.neck ?? []).flat();
    if (!neck.length) continue;
    p.mesh.pts.forEach((q, i) => {
      let j = neck[0];
      let bd = Infinity;
      for (const n of neck) {
        const d = Math.hypot(p.mesh.pts[n].x - q.x, p.mesh.pts[n].y - q.y);
        if (d < bd) {
          bd = d;
          j = n;
        }
      }
      const I = (p.base + i) * 3;
      const J = (p.base + j) * 3;
      for (let k = 0; k < 3; k++) res[I + k] = p.start[i][k] + (res[J + k] - p.start[j][k]);
    });
  }
  // (Each point carried by the move of the nearest point of the seam it hangs from, so the whole piece keeps its set shape.)
  // A shirt worn open: its collar is laid on the neckline as it settled, the seam that turned back with the fronts
  // and lies down the chest. (Sewn to that turn, the stiff stand buckles in the cloth here: it is laid instead.)
  // Its neck edge on the neckline at the same share of the way along; the stand rising from it, round the neck at the
  // back and lying flat out from the opening where the neckline has turned; the collar on the stand's top edge.
  const open = (p: Panel, key: (q: P) => number, run: string, along: (f: number) => V3 | undefined) => {
    const ids = [...new Set((p.mesh.runs[run] ?? []).flat())];
    if (ids.length < 2) return;
    const k0 = Math.min(...ids.map((j) => key(p.mesh.pts[j])));
    const k1 = Math.max(...ids.map((j) => key(p.mesh.pts[j])));
    for (const j of ids) {
      const X = along((key(p.mesh.pts[j]) - k0) / (k1 - k0 || 1));
      if (X) for (let k = 0; k < 3; k++) res[(p.base + j) * 3 + k] = X[k];
    }
  };
  const alongChain = (c0: Chain) => (f: number): V3 | undefined => {
    if (c0.ids.length < 2) return undefined;
    // (By its length as it lies, not as it is cut, so a stretch of neckline drawn long doesn't draw the collar long.)
    const s3: number[] = [0];
    for (let k = 1; k < c0.ids.length; k++) {
      const [a, b] = [c0.ids[k - 1] * 3, c0.ids[k] * 3];
      s3.push(s3[k - 1] + Math.hypot(res[b] - res[a], res[b + 1] - res[a + 1], res[b + 2] - res[a + 2]));
    }
    const c = knob('__cutAlong') ? c0 : { ids: c0.ids, s: s3 };
    const L = c.s[c.s.length - 1] || 1;
    const t0 = f * L;
    let k = 1;
    while (k < c.s.length - 1 && c.s[k] < t0) k++;
    const d = c.s[k] - c.s[k - 1];
    const t = d > 1e-9 ? Math.max(0, Math.min(1, (t0 - c.s[k - 1]) / d)) : 0;
    return [0, 1, 2].map((q) => res[c.ids[k - 1] * 3 + q] * (1 - t) + res[c.ids[k] * 3 + q] * t) as V3;
  };
  const panelChain = (p: Panel, run: string, key: (q: P) => number): Chain => {
    const ids = [...new Set((p.mesh.runs[run] ?? []).flat())].sort((a, b) => key(p.mesh.pts[a]) - key(p.mesh.pts[b]));
    return { ids: ids.map((j) => j + p.base), s: ids.map((j) => key(p.mesh.pts[j])) };
  };
  // Which way a collar laid on an open neckline rises from its seam, all along it: straight up round the back of the
  // neck, and, where the seam has dropped down the chest with the turned-back fronts, along the chest away from it.
  // Taken at even steps down the seam, kept turning the same way from each step to the next (no flip where the seam
  // turns back on itself at the roll), and eased smooth.
  // Which way the shirt's cloth lies from each point of its neckline (into the shirt), as it settled.
  const awayPts: { X: V3; D: V3 }[] = [];
  if (o.rollFront) {
    const nbr = new Map<number, Set<number>>();
    for (const p of B.panels)
      if (p.role === 'front' || p.role === 'back')
        for (const t of p.mesh.tris)
          for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
            (nbr.get(p.base + u) ?? nbr.set(p.base + u, new Set()).get(p.base + u)!).add(p.base + v);
            (nbr.get(p.base + v) ?? nbr.set(p.base + v, new Set()).get(p.base + v)!).add(p.base + u);
          }
    for (const sp0 of stiffPanels)
      for (const g of sp0.target?.ids ?? []) {
        const ns = [...(nbr.get(g) ?? [])].filter((n) => !sp0.target!.ids.includes(n));
        if (!ns.length) continue;
        const X = [0, 1, 2].map((k) => res[g * 3 + k]) as V3;
        const D = [0, 1, 2].map((k) => ns.reduce((t, n) => t + res[n * 3 + k], 0) / ns.length - X[k]) as V3;
        const l = Math.hypot(...D) || 1;
        awayPts.push({ X, D: D.map((v) => v / l) as V3 });
      }
  }
  const awayAt = (X: V3): V3 | undefined => {
    let best: V3 | undefined;
    let bd = Infinity;
    for (const a of awayPts) {
      const d = Math.hypot(a.X[0] - X[0], a.X[1] - X[1], a.X[2] - X[2]);
      if (d < bd) {
        bd = d;
        best = a.D;
      }
    }
    return best;
  };
  const frameOf = (posAt: (s: number) => V3, s0: number, s1: number) => {
    const n = Math.max(2, Math.ceil((s1 - s0) / 0.5));
    const S = Array.from({ length: n + 1 }, (_, k) => s0 + ((s1 - s0) * k) / n);
    const X = S.map(posAt);
    const top = Math.min(...X.map((x) => x[1]));
    const W = X.map((x) => Math.max(0, Math.min(1, (x[1] - top - (knob('__lie0') ?? 3)) / (knob('__lie1') ?? 6))));
    // (Across the seam, along the body: kept pointing the same way from each step to the next.)
    let prevL: V3 | undefined;
    const Ls = X.map((x, k) => {
      const st = knob('__frameT') ?? 3;
      const a = X[Math.max(0, k - st)];
      const b = X[Math.min(n, k + st)];
      const T0: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const tl = Math.hypot(...T0) || 1;
      const T = T0.map((v) => v / tl) as V3;
      const rho = Math.hypot(x[0], x[2]) || 1;
      const N: V3 = [x[0] / rho, 0, x[2] / rho];
      let L: V3 = [N[1] * T[2] - N[2] * T[1], N[2] * T[0] - N[0] * T[2], N[0] * T[1] - N[1] * T[0]];
      if (prevL ? L[0] * prevL[0] + L[1] * prevL[1] + L[2] * prevL[2] < 0 : L[1] > 0) L = L.map((v) => -v) as V3;
      prevL = L;
      return L;
    });
    // (Lying, it lies away from the cloth of the shirt beside its seam, out over the shoulder, not back into the
    // opening: which way that is, taken over the whole of it that lies, so it doesn't flip from one step to the next.)
    let vote = 0;
    X.forEach((x, k) => {
      const into = awayAt(x);
      if (into && W[k] > (knob('__awayW') ?? 0.2)) vote += W[k] * Math.sign(Ls[k][0] * into[0] + Ls[k][1] * into[1] + Ls[k][2] * into[2]);
    });
    const sg = vote > 0 && !knob('__noAway') ? -1 : 1;
    const U = X.map((_, k) => {
      const w = W[k];
      const u: V3 = [sg * Ls[k][0] * w, -(1 - w) + sg * Ls[k][1] * w, sg * Ls[k][2] * w];
      const ul = Math.hypot(...u) || 1;
      return u.map((v) => v / ul) as V3;
    });
    for (let it = 0; it < (knob('__frameSm') ?? 80); it++)
      for (let k = 1; k < n; k++) {
        const m = [0, 1, 2].map((d) => (U[k - 1][d] + 2 * U[k][d] + U[k + 1][d]) / 4);
        const ml = Math.hypot(...m) || 1;
        U[k] = m.map((v) => v / ml) as V3;
      }
    return (s: number): { U: V3; w: number } => {
      const f = Math.max(0, Math.min(n, ((s - s0) / (s1 - s0 || 1)) * n));
      const k = Math.min(n - 1, Math.floor(f));
      const t = f - k;
      const u = [0, 1, 2].map((d) => U[k][d] * (1 - t) + U[k + 1][d] * t);
      const ul = Math.hypot(...u) || 1;
      return { U: u.map((v) => v / ul) as V3, w: W[k] * (1 - t) + W[k + 1] * t };
    };
  };
  // (Laid out by rule, a band turning from standing to lying is drawn longer along its outer edge than it is cut: its
  // cloth is eased back to its cut lengths, the seam it is sewn by held.)
  const toRelax: [Panel, number[], (() => void)?][] = [];
  // (The way the stand turns, all along it, for the collar on it to turn with.)
  const standFr = new Map<Panel, { fr: (s: number) => { U: V3; w: number }; k0: number; k1: number }>();
  // (How far each laid point lies rather than stands, and how far off the shirt it lies when it does.)
  const lieOf = new Map<number, [number, number]>();
  const relax = (p: Panel, held: number[]) => {
    const fixed = new Set(held);
    const E: [number, number, number][] = [];
    const seen = new Set<string>();
    for (const t of p.mesh.tris)
      for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        if (seen.has(k)) continue;
        seen.add(k);
        E.push([u, v, Math.hypot(p.mesh.pts[u].x - p.mesh.pts[v].x, p.mesh.pts[u].y - p.mesh.pts[v].y)]);
      }
    for (let it = 0; it < (knob('__relaxIt') ?? 300); it++)
      for (const [u, v, L] of E) {
        const U = (p.base + u) * 3;
        const V = (p.base + v) * 3;
        const d = [res[V] - res[U], res[V + 1] - res[U + 1], res[V + 2] - res[U + 2]];
        const l = Math.hypot(d[0], d[1], d[2]) || 1e-9;
        const over = l - L * (knob('__relaxTo') ?? 1.5);
        if (over <= 0) continue;
        const fu = fixed.has(u) ? 0 : fixed.has(v) ? 1 : 0.5;
        const fv = fixed.has(v) ? 0 : fixed.has(u) ? 1 : 0.5;
        for (let k = 0; k < 3; k++) {
          res[U + k] += (d[k] / l) * over * fu;
          res[V + k] -= (d[k] / l) * over * fv;
        }
      }
  };
  // (The shirt's outer surface, as settled: how far out from the body's axis it is at each angle round and height.)
  let topAt: (a: number, rho: number) => number | undefined = () => undefined;
  const shellOf = () => {
    const NA = 180;
    const binOf = (a: number, y: number) => Math.round(((a + Math.PI) / TAU) * NA) * 10000 + Math.round(y * 2);
    const shell = new Map<number, number>();
    const tops = new Map<number, number>();
    for (const p of B.panels) {
      if ((p.role !== 'front' && p.role !== 'back') || p.hidden) continue;
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        const k = binOf(Math.atan2(res[I], res[I + 2]), res[I + 1]);
        shell.set(k, Math.max(shell.get(k) ?? 0, Math.hypot(res[I], res[I + 2]) + (p.turned[i] ? p.thick[i] : 0)));
        const t = binOf(Math.atan2(res[I], res[I + 2]), Math.hypot(res[I], res[I + 2]));
        tops.set(t, Math.min(tops.get(t) ?? Infinity, res[I + 1] - (p.turned[i] ? p.thick[i] : 0)));
      });
    }
    // (And, over the shoulders, where it runs out more than down: how high it is at each angle and distance out.)
    topAt = (a: number, rho: number): number | undefined => {
      let best: number | undefined;
      for (let da = -2; da <= 2; da++)
        for (let dr = -2; dr <= 2; dr++) {
          const v = tops.get(binOf(a + (da * TAU) / NA, rho + dr / 2));
          if (v !== undefined) best = Math.min(best ?? Infinity, v);
        }
      return best;
    };
    return (a: number, y: number): number | undefined => {
      let best: number | undefined;
      for (let da = -2; da <= 2; da++)
        for (let dy = -2; dy <= 2; dy++) {
          const v = shell.get(binOf(a + (da * TAU) / NA, y + dy / 2));
          if (v !== undefined) best = Math.max(best ?? 0, v);
        }
      return best;
    };
  };
  const seamOf = new Map<number, { j: number; k: number; t: number }>();
  if (stiffPanels.some((x) => x.carry)) for (const sm of seams) if (!seamOf.has(sm.i)) seamOf.set(sm.i, sm);
  for (const { p, by, roll, key, target, on, carry, hang } of stiffPanels) {
    const anchor = (p.mesh.runs[by] ?? []).flat();
    if (!anchor.length) continue;
    if (o.rollFront && !knob('__noOpenCol')) {
      // (Where the turned-back neckline curls up again at the centre front, the collar runs on straight past its
      // lowest point instead, so it ends lying along the lapel rather than hooked back up.)
      const onNeck = target
        ? () => {
            const s3: number[] = [0];
            for (let k = 1; k < target.ids.length; k++) {
              const [u, v] = [target.ids[k - 1] * 3, target.ids[k] * 3];
              s3.push(s3[k - 1] + Math.hypot(res[v] - res[u], res[v + 1] - res[u + 1], res[v + 2] - res[u + 2]));
            }
            const L = s3[s3.length - 1] || 1;
            const lowest = target.ids.reduce((b, g, n) => (res[g * 3 + 1] > res[target.ids[b] * 3 + 1] ? n : b), 0);
            const base = alongChain(target);
            const fl = s3[lowest] / L;
            const pre = base(Math.max(0, fl - 1.5 / L))!;
            const at0 = base(fl)!;
            const dl = Math.hypot(at0[0] - pre[0], at0[1] - pre[1], at0[2] - pre[2]) || 1;
            open(p, key, by, (f) => (f <= fl || knob('__hook') ? base(f) : (at0.map((v, k) => v + ((at0[k] - pre[k]) / dl) * (f - fl) * L) as V3)));
          }
        : undefined;
      if (onNeck) onNeck();
      if (!onNeck && on) open(p, key, by, alongChain(panelChain(on.panel, 'stand', on.key)));
      if (!roll) {
        // (The stand: each point up from the neck seam point below it by its height above the neck edge.)
        const seam = panelChain(p, by, key);
        const ks = seam.s;
        const posAt = (s: number): V3 => {
          let k = 1;
          while (k < ks.length - 1 && ks[k] < s) k++;
          const d = ks[k] - ks[k - 1];
          const t = d > 1e-9 ? (s - ks[k - 1]) / d : 0;
          return [0, 1, 2].map((q) => res[seam.ids[k - 1] * 3 + q] * (1 - t) + res[seam.ids[k] * 3 + q] * t) as V3;
        };
        const nk = seam.ids.map((g) => p.mesh.pts[g - p.base]);
        const fr = frameOf(posAt, ks[0], ks[ks.length - 1]);
        standFr.set(p, { fr, k0: ks[0], k1: ks[ks.length - 1] });
        p.mesh.pts.forEach((q, i) => {
          if (anchor.includes(i) || (carry && !carry(q))) return;
          const s0 = key(q);
          const X = posAt(s0);
          let h = Infinity;
          for (const n of nk) h = Math.min(h, Math.hypot(n.x - q.x, n.y - q.y));
          const { U, w } = fr(s0);
          const rho = Math.hypot(X[0], X[2]) || 1;
          const N: V3 = [X[0] / rho, 0, X[2] / rho];
          const I = (p.base + i) * 3;
          // (Round the back, where it stands as it does buttoned, it keeps the shape it settled in, carried by its seam.)
          let j = anchor[0];
          let bd = Infinity;
          for (const a of anchor) {
            const dd = Math.hypot(p.mesh.pts[a].x - q.x, p.mesh.pts[a].y - q.y);
            if (dd < bd) {
              bd = dd;
              j = a;
            }
          }
          const J = (p.base + j) * 3;
          // (A flat collar keeps the shape it was laid out in over the shoulders, carried by its seam: stood up from the
          // seam like a stand, it was a band round the neck.)
          const v = carry ? 0 : knob('__standBlend') === 0 ? 1 : w;
          for (let k = 0; k < 3; k++) res[I + k] = (X[k] + U[k] * h + N[k] * (0.1 + 0.3 * w)) * v + (p.start[i][k] + (res[J + k] - p.start[j][k])) * (1 - v);
          if (w > 0) lieOf.set(p.base + i, [w, 0.1]);
        });
        if (!knob('__noRelax') && !carry) toRelax.push([p, anchor, onNeck]);
        continue;
      }
    }
    if (roll && !knob('__oldFall')) {
      // A collar with a fall: built on the line it is sewn by, as settled. Up from it to the fold (the collar's inner
      // layer standing round the neck), then the fall turned down from the fold, out and down over the stand onto the
      // shoulders: a stiff, interfaced piece, each point at its cut distance from the fold.
      const ring = [...new Set(anchor)].map((j) => ({ s: key(p.mesh.pts[j]), d: distLine(p.mesh.pts[j], roll), X: [0, 1, 2].map((k) => res[(p.base + j) * 3 + k]) as V3 })).sort((a, b) => a.s - b.s);
      // (Its height round the neck eased smooth, so the fold runs as one clean line: mirrored at the centre back.)
      for (let it = 0; it < (o.rollFront ? knob('__ringItOpen') ?? 0 : knob('__ringIt') ?? 8); it++) {
        const y = ring.map((r) => r.X[1]);
        const dd = ring.map((r) => r.d);
        for (let k = 0; k + 1 < ring.length; k++) {
          const lo = k === 0 ? 1 : k - 1;
          ring[k].X[1] = (y[lo] + 2 * y[k] + y[k + 1]) / 4;
          ring[k].d = (dd[lo] + 2 * dd[k] + dd[k + 1]) / 4;
        }
      }
      const at = (s: number): { X: V3; d: number } => {
        if (s <= ring[0].s) return ring[0];
        for (let k = 1; k < ring.length; k++)
          if (s <= ring[k].s) {
            const t = (s - ring[k - 1].s) / (ring[k].s - ring[k - 1].s || 1);
            return { X: [0, 1, 2].map((d) => ring[k - 1].X[d] * (1 - t) + ring[k].X[d] * t) as V3, d: ring[k - 1].d * (1 - t) + ring[k].d * t };
          }
        // (Past the end of the seam, the collar's point: carried on in the direction the seam was running.)
        const a = ring[ring.length - 2];
        const b = ring[ring.length - 1];
        const t = (s - b.s) / (b.s - a.s || 1);
        return { X: [0, 1, 2].map((d) => b.X[d] + (b.X[d] - a.X[d]) * t) as V3, d: b.d };
      };
      const phi = (knob('__fallAng') ?? 50) * (Math.PI / 180);
      // (The fold follows the curve of the seam, a set distance from it, not the straight line between its ends: the
      // fall is as deep at the centre back as either side of it, so its edge doesn't dip to a point there.)
      const seam = [...new Set(anchor)].map((j) => p.mesh.pts[j]).sort((u, v) => key(u) - key(v));
      const gap = Math.max(0.1, ring.reduce((t, r) => t + r.d, 0) / ring.length);
      const near = (q: P): { foot: P; dist: number } => {
        let best = { foot: seam[0], dist: Infinity };
        for (let k = 0; k + 1 < seam.length; k++) {
          const [u, v] = [seam[k], seam[k + 1]];
          const L2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1e-9;
          const t = Math.max(0, Math.min(1, ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / L2));
          const f = { x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t };
          const dist = Math.hypot(q.x - f.x, q.y - f.y);
          if (dist < best.dist) best = { foot: f, dist };
        }
        return best;
      };
      const curved = !knob('__straightRoll') && seam.length > 2;
      // A shirt worn open: where its neck seam has turned back with the fronts and lies down the chest, the collar
      // lies open with it rather than standing round the neck: its stand flat on the chest, away from the opening,
      // and its fall pressed nearly flat over that. (How far each part of the seam has dropped below the back neck
      // says how far it has turned.)
      const sf = on ? standFr.get(on.panel) : undefined;
      const r0 = ring[0].s;
      const r1 = ring[ring.length - 1].s;
      const lieFr = !o.rollFront ? undefined : sf && !knob('__ownFrame') ? (s: number) => sf.fr(sf.k0 + ((s - r0) / (r1 - r0 || 1)) * (sf.k1 - sf.k0)) : frameOf((s) => at(s).X, r0, r1);
      const lieAt = (s: number): { U: V3; w: number } => (lieFr ? lieFr(s) : { U: [0, -1, 0], w: 0 });
      const poloShell = p.pc.meta.polo && !o.rollFront && !knob('__noPoloLie') ? shellOf() : undefined;
      const poloFall: { s: number; I: number; T: number; h: number; back: boolean; need: (ph: number) => boolean; put: (ph: number) => void }[] = [];
      const clearOf = (I: number, T: number) => {
        const a = Math.atan2(res[I], res[I + 2]);
        const rho = Math.hypot(res[I], res[I + 2]);
        const R = poloShell!(a, res[I + 1]);
        if (R === undefined || rho >= R + T) return true;
        const top = topAt(a, rho);
        return top !== undefined && res[I + 1] <= top - T;
      };
      p.mesh.pts.forEach((q, i) => {
        const r = p.turned[i] ? reflect(q, roll[0], roll[1]) : q;
        const nq = curved ? near(q) : undefined;
        const foot = nq ? nq.foot : { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
        const s0 = key(p.turned[i] || nq ? foot : q);
        const base0 = at(s0);
        // (An open polo's roll line slants, from a stand's height at the centre back down to the neck edge at the
        // front: its fold is as far from the seam as that, place by place, not the one mean depth.)
        const gp = poloShell ? base0.d : gap;
        const base = nq ? { X: base0.X, d: gp } : base0;
        const rho = Math.hypot(base.X[0], base.X[2]) || 1e-9;
        const out = [base.X[0] / rho, 0, base.X[2] / rho];
        const I = (p.base + i) * 3;
        const lie = lieAt(s0);
        if (lie.w > 0) {
          const U = lie.U;
          const ph = phi * (1 - lie.w) + (knob('__lieAng') ?? 5) * (Math.PI / 180) * lie.w;
          const lift = 0.1 + lie.w * 0.3;
          if (!p.turned[i]) {
            const up = nq ? Math.min(gp, nq.dist) : Math.max(0, base.d - distLine(q, roll));
            for (let k = 0; k < 3; k++) res[I + k] = base.X[k] + out[k] * lift + U[k] * up;
            lieOf.set(p.base + i, [lie.w, knob("__lieIn") ?? 0.35]);
          } else {
            const h = nq ? Math.max(0, nq.dist - gp) : Math.hypot(q.x - r.x, q.y - r.y) / 2;
            const T = (Math.min(p.thick[i], 0.6) * 2 + 0.15) * (1 - lie.w) + (knob("__lieT") ?? 0.5) * lie.w;
            for (let k = 0; k < 3; k++) res[I + k] = base.X[k] + U[k] * (base.d - h * Math.cos(ph)) + out[k] * (lift + T + h * Math.sin(ph));
            lieOf.set(p.base + i, [lie.w, knob("__lieOut") ?? 0.7]);
          }
          return;
        }
        if (!p.turned[i]) {
          // (Inner layer: up from the seam by as far as it is cut from it, toward the fold.)
          const up = nq ? Math.min(gp, nq.dist) : Math.max(0, base.d - distLine(q, roll));
          res[I] = base.X[0] + out[0] * 0.1;
          res[I + 1] = base.X[1] - up;
          res[I + 2] = base.X[2] + out[2] * 0.1;
        } else {
          const h = nq ? Math.max(0, nq.dist - gp) : Math.hypot(q.x - r.x, q.y - r.y) / 2;
          const top = base.X[1] - base.d;
          // (Turned over its own inner layer, no further out than two layers' thickness: an open polo's fall held out by
          // the turned layer's whole made-up thickness stood a step off the fold at the side of the neck.)
          const T = (o.rollFront ? Math.min(p.thick[i], 0.6) : poloShell ? Math.min(p.thick[i], knob('__poloT') ?? 0.2) : p.thick[i]) * 2 + 0.15;
          const put = (ph: number) => {
            res[I] = base.X[0] + out[0] * (T + h * Math.sin(ph));
            res[I + 1] = top + h * Math.cos(ph);
            res[I + 2] = base.X[2] + out[2] * (T + h * Math.sin(ph));
          };
          // (An open polo's fall, with no stand under it, turns down onto the shoulders and chest: each point as
          // near straight down from the fold as the shirt under it lets it lie, not out on one cone from the neck,
          // which stood its front points off the chest.)
          put(phi);
          if (poloShell) poloFall.push({ s: s0, I, T, h, back: base.X[2] < (knob('__poloBackZ') ?? 0), need: (ph) => (put(ph), clearOf(I, T)), put });
        }
      });
      // (An open polo's fall, with no stand under it, turns down onto the shoulders and chest: at each place round the
      // neck, as near straight down from the fold as the shirt under it lets the whole depth of the fall lie, eased
      // smooth round the neck; not out on one cone from the neck, which stood its front points off the chest.)
      if (poloShell && poloFall.length) {
        const lo0 = (knob('__poloMin') ?? 5) * (Math.PI / 180);
        const NB = 48;
        const s0 = Math.min(...poloFall.map((f) => f.s));
        const s1 = Math.max(...poloFall.map((f) => f.s));
        const binS = (v: number) => Math.min(NB - 1, Math.max(0, Math.floor(((v - s0) / (s1 - s0 || 1)) * NB)));
        const want = new Array<number>(NB).fill(-1);
        // (By the fall's outer part: next to the fold it barely moves whichever way it turns, and the shirt's own
        // neckline rising there would stand the whole fall out level.)
        for (const f of poloFall) {
          if (f.h < (knob('__poloH') ?? 1.5)) continue;
          let lo = lo0;
          let hi = Math.PI / 2;
          if (f.need(lo)) hi = lo;
          else if (f.need(hi))
            for (let it = 0; it < 14; it++) {
              const mid = (lo + hi) / 2;
              if (f.need(mid)) hi = mid;
              else lo = mid;
            }
          const b = binS(f.s);
          want[b] = Math.max(want[b], hi);
        }
        for (let b = 0; b < NB; b++) if (want[b] < 0) want[b] = b ? want[b - 1] : phi;
        // (Behind, over the back of the shoulders, no flatter than this: laid out level there, its edge stood off them.)
        const cap = (knob('__poloMax') ?? 30) * (Math.PI / 180);
        const behind = new Array<boolean>(NB).fill(false);
        for (const f of poloFall) if (f.back) behind[binS(f.s)] = true;
        for (let b = 0; b < NB; b++) if (behind[b]) want[b] = Math.min(want[b], cap);
        for (let it = 0; it < (knob('__poloSm') ?? 6); it++) {
          const w0 = [...want];
          for (let b = 0; b < NB; b++) want[b] = Math.max(w0[b], (w0[Math.max(0, b - 1)] + 2 * w0[b] + w0[Math.min(NB - 1, b + 1)]) / 4);
        }
        for (const f of poloFall) f.put(want[binS(f.s)]);
        // (Where that leaves it standing off the shirt, over the shoulders or behind, it is laid down on it.)
        if (!knob('__noPoloDown'))
          for (const f of poloFall) {
            const I = f.I;
            const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
            const a = Math.atan2(res[I], res[I + 2]);
            // (Over the shoulders, down onto their top; behind, in onto the back.)
            const top = topAt(a, rho);
            if (top !== undefined && res[I + 1] < top - f.T - 0.3) {
              res[I + 1] = top - f.T;
              continue;
            }
            const R = poloShell(a, res[I + 1]);
            if (R === undefined || res[I + 2] > 0 || rho <= R + f.T + 0.2) continue;
            const k = (R + f.T) / rho;
            res[I] *= k;
            res[I + 2] *= k;
          }
        // (Laid down that far, its outer edge round more than it is cut there: eased back in to its cut lengths.)
        if (!knob('__noPoloRelax')) toRelax.push([p, anchor]);
      }
      if (o.rollFront && !knob('__noRelax')) toRelax.push([p, anchor, on ? () => open(p, key, by, alongChain(panelChain(on.panel, 'stand', on.key))) : undefined]);
      continue;
    }
    const moved = new Map<number, V3>();
    const settled = new Map<number, V3>();
    const arcOf = new Map<number, number>();
    for (const j of anchor) {
      const J = (p.base + j) * 3;
      let at: V3 = [res[J], res[J + 1], res[J + 2]];
      // (A strip cut longer than its seam, gathered or on the bias, buckles along it as it settles, its centre back
      // shoved out behind: carried instead from where its seam edge is sewn, on the neckline as it settled.)
      const sm = carry ? seamOf.get(p.base + j) : undefined;
      if (sm) at = [0, 1, 2].map((k) => res[sm.j * 3 + k] * (1 - sm.t) + res[sm.k * 3 + k] * sm.t) as V3;
      moved.set(j, [at[0] - p.start[j][0], at[1] - p.start[j][1], at[2] - p.start[j][2]]);
      settled.set(j, at);
    }
    const anchors = [...new Set(anchor)];
    p.mesh.pts.forEach((q, i) => {
      let j = anchor[0];
      let bd = Infinity;
      for (const n of anchor) {
        const d = Math.hypot(p.mesh.pts[n].x - q.x, p.mesh.pts[n].y - q.y);
        if (d < bd) {
          bd = d;
          j = n;
        }
      }
      let D = moved.get(j)!;
      // (A gathered or bias strip's seam edge settles in a zigzag along its seam: a point carried by the one nearest
      // seam point took that point's own jog, and the strip tore between neighbours. Carried by the seam's movement
      // averaged over the few centimetres of it nearest, it moves as one piece.)
      if (carry) {
        const sg = knob('__carrySigma') ?? 2;
        const acc: V3 = [0, 0, 0];
        let wt = 0;
        for (const n of anchors) {
          const d = Math.hypot(p.mesh.pts[n].x - q.x, p.mesh.pts[n].y - q.y) - bd;
          const w = Math.exp(-((d / sg) * (d / sg)));
          const m = moved.get(n)!;
          for (let k = 0; k < 3; k++) acc[k] += m[k] * w;
          wt += w;
        }
        if (wt > 0) D = acc.map((v) => v / wt) as V3;
      }
      const I = (p.base + i) * 3;
      for (let k = 0; k < 3; k++) res[I + k] = p.start[i][k] + D[k];
      // (A hood is hung afresh from where its neck seam settled: carried straight down with it, it was inside the
      // shoulders, and the push back out tore it.)
      if (hang) {
        let arc = 0;
        let wt = 0;
        let cs = 0;
        const seat: V3 = [0, 0, 0];
        // (The level the pouch hangs from: where the seam's centre back end, the nape, settled.)
        const nape = settled.get(anchors.reduce((b, n) => (key(p.mesh.pts[n]) < key(p.mesh.pts[b]) ? n : b), anchors[0]))![1];
        for (const n of anchors) {
          const d = Math.hypot(p.mesh.pts[n].x - q.x, p.mesh.pts[n].y - q.y) - bd;
          if (d > 6) continue;
          const w = Math.exp(-((d / 2) * (d / 2)));
          const at = settled.get(n)!;
          arc += (arcOf.get(n) ?? arcOf.set(n, arcFromBack(sp, Math.atan2(at[0], at[2]), at[1]) / halfRing(sp, at[1])).get(n)!) * w;
          cs += at[1] * w;
          for (let k = 0; k < 3; k++) seat[k] += at[k] * w;
          wt += w;
        }
        if (wt > 0) {
          const v = hang(q, nape, arc / wt, cs / wt);
          // (Its first few centimetres up from the seam run from where the seam itself settled, which can stand off
          // the body more than the hung cloth does.)
          const tt = Math.min(1, bd / (knob('__hoodSeamBlend') ?? 18));
          for (let k = 0; k < 3; k++) res[I + k] = (seat[k] / wt) * (1 - tt) + v[k] * tt;
        }
      }
    });
  }
  // Close what is left of each seam for drawing, so no slit of light shows along it.
  // (A bodice sewn to a gathered skirt can settle with its waist several cm off the skirt's, the gathers standing it
  // out and up. Closed by its edge alone, the bodice's last row of cloth was drawn up to twice its cut, torn along the
  // waist; its move is carried up into the bodice instead, fading out over a few cm.)
  const ownerOf = (i: number) => B.panels.find((p) => i >= p.base && i < p.base + p.mesh.pts.length);
  const gatheredOf = (p?: Panel) => !!p && !p.hidden && /peplum/.test(p.role) && (((p.pc.meta.gathered as number | undefined) ?? 1) > 1.05 || ((p.pc.meta.gatherShown as number | undefined) ?? 1) > 1.05);
  const carried = new Map<Panel, number[]>();
  if (!knob('__noCloseCarry')) for (const { i, j } of seams) {
    const pi = ownerOf(i);
    if (pi && /bodice/i.test(pi.pc.name) && gatheredOf(ownerOf(j))) carried.set(pi, [...(carried.get(pi) ?? []), i]);
  }
  const before = carried.size ? Float64Array.from(res) : undefined;
  for (let pass = 0; pass < 12; pass++) {
    for (const { i, j, k, t } of seams) {
      for (let d = 0; d < 3; d++) {
        const target = res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t;
        res[i * 3 + d] += (target - res[i * 3 + d]) * 0.5;
      }
    }
  }
  if (before) for (const [p, edge] of carried) {
    const R = knob('__carryR') ?? 6;
    const on = new Set(edge);
    for (let a = 0; a < p.mesh.pts.length; a++) {
      const I = p.base + a;
      if (on.has(I) || seamOf.has(I)) continue;
      const q = p.mesh.pts[a];
      let wSum = 0;
      const dv = [0, 0, 0];
      for (const e of edge) {
        const r = p.mesh.pts[e - p.base];
        const w = Math.max(0, 1 - Math.hypot(r.x - q.x, r.y - q.y) / R);
        if (w <= 0) continue;
        const w2 = w * w;
        wSum += w2;
        for (let d = 0; d < 3; d++) dv[d] += (res[e * 3 + d] - before[e * 3 + d]) * w2;
      }
      if (!wSum) continue;
      let near = 0;
      for (const e of edge) { const r = p.mesh.pts[e - p.base]; near = Math.max(near, 1 - Math.hypot(r.x - q.x, r.y - q.y) / R); }
      for (let d = 0; d < 3; d++) res[I * 3 + d] += (dv[d] / wSum) * near;
    }
  }
  // Smooth the cloth's finest ripples for drawing (a few cm of mesh noise reads as crumple on a shiny cloth); its
  // edges and seams stay where they settled.
  // Taubin's two-step smoothing: in, then back out, so the cloth loses its ripples but not its size.
  const passes = knob("__smooth") ?? 16;
  const sewn = new Uint8Array(B.n);
  for (const { i, j, k } of seams) sewn[i] = sewn[j] = sewn[k] = 1;
  for (const p of B.panels) {
    const np = p.mesh.pts.length;
    const nbr: number[][] = Array.from({ length: np }, () => []);
    for (const [a, b, c] of p.mesh.tris) {
      nbr[a].push(b, c);
      nbr[b].push(a, c);
      nbr[c].push(a, b);
    }
    const edge = new Uint8Array(np);
    for (const t of Object.keys(p.mesh.runs)) for (const r of p.mesh.runs[t]) for (const i of r) edge[i] = 1;
    for (let pass = 0; pass < passes; pass++) {
      const nx = new Float64Array(np * 3);
      for (let i = 0; i < np; i++) {
        const I = (p.base + i) * 3;
        // Above the underarm the form's arm stumps sit just under the cloth: leave it as settled there.
        if (edge[i] || sewn[p.base + i] || !nbr[i].length || (p.role !== 'sleeve' && res[I + 1] < sp.tip.c + 17)) {
          for (let d = 0; d < 3; d++) nx[i * 3 + d] = res[I + d];
          continue;
        }
        for (let d = 0; d < 3; d++) {
          let sum = 0;
          for (const j of nbr[i]) sum += res[(p.base + j) * 3 + d];
          nx[i * 3 + d] = res[I + d] + (sum / nbr[i].length - res[I + d]) * (pass % 2 ? -0.53 : 0.5);
        }
      }
      for (let i = 0; i < np; i++) {
        for (let d = 0; d < 3; d++) res[(p.base + i) * 3 + d] = nx[i * 3 + d];
        // Smoothing draws cloth in; none goes inside the body for it.
        if (p.role === 'sleeve' || legs) continue;
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const R = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i];
        if (rho < R) {
          res[I] *= R / rho;
          res[I + 2] *= R / rho;
        }
      }
    }
  }
  // Free edges (a lapel, a front opening, a collar's edge, a hem) drawn as smooth lines: each point eased toward its
  // neighbours along the edge, the ends held.
  const FREE = ['lapel', 'opening', 'opening-hem', 'collar', 'hem', 'gorge'];
  // (An end on the centre plane meets its own mirror there: eased with it, up and down and in and out, so the edge
  // runs straight across the centre instead of coming to a point.)
  const onCentre = new Set(centre);
  for (let pass = 0; pass < (knob("__edgeSm") ?? 6); pass++) {
    for (const p of B.panels) {
      for (const tag of FREE) {
        for (const run of p.mesh.runs[tag] ?? []) {
          const ids = run.map((i) => i + p.base);
          const nx = ids.map((i) => [res[i * 3], res[i * 3 + 1], res[i * 3 + 2]]);
          for (let k = 1; k + 1 < ids.length; k++) {
            if (sewn[ids[k]]) continue;
            for (let d = 0; d < 3; d++) nx[k][d] = res[ids[k] * 3 + d] * 0.5 + (res[ids[k - 1] * 3 + d] + res[ids[k + 1] * 3 + d]) * 0.25;
          }
          if (p.role === 'collar' && !knob('__noMirrorEnd'))
            for (const [k, n] of [
              [0, 1],
              [ids.length - 1, ids.length - 2],
            ])
              if (ids.length > 2 && onCentre.has(ids[k])) for (const d of [1, 2]) nx[k][d] = res[ids[k] * 3 + d] * 0.5 + res[ids[n] * 3 + d] * 0.5;
          ids.forEach((i, k) => {
            for (let d = 0; d < 3; d++) res[i * 3 + d] = nx[k][d];
          });
        }
      }
    }
  }
  // A skirt's dart pressed flat to its point, and its centre front cut on the fold: the coarse sim draws the cloth in
  // beside the fold (held on the centre, it stands as a ridge with a hollow either side) and where a dart's legs meet,
  // dents that read as marks on the front. There, a point drawn in from the cloth round it is put back out to it.
  if (!knob('__noDartFill'))
    for (const p of B.panels) {
      if (p.hidden || !/peplum/.test(p.role)) continue;
      const tips = dartsOf(p.pc).map((d) => d.tip);
      const fold = (p.mesh.runs.fold ?? []).flat().map((i) => p.mesh.pts[i]);
      if (!tips.length && !fold.length) continue;
      const R = knob('__dartFillR') ?? 5;
      const FR = p.pc.meta.pleatFolds || p.pc.meta.gathered ? 0 : knob('__foldFillR') ?? 5;
      const near = p.mesh.pts.map((q) => tips.some((t) => Math.hypot(q.x - t.x, q.y - t.y) < R) || (FR > 0 && fold.some((f) => Math.hypot(q.x - f.x, q.y - f.y) < FR)));
      // (Only the cloth itself: a point on an edge, or sewn (a dart's legs among them), stays where it is.)
      const edge = new Set(Object.entries(p.mesh.runs).filter(([t]) => t !== 'fold').flatMap(([, rs]) => rs.flat()));
      p.mesh.pts.forEach((_, i) => {
        if (sewn[p.base + i] || edge.has(i)) near[i] = false;
      });
      if (!near.some(Boolean)) continue;
      const nb = p.mesh.pts.map(() => new Set<number>());
      for (const t of p.mesh.tris)
        for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
          nb[u].add(v);
          nb[v].add(u);
        }
      for (let it = 0; it < (knob('__dartFillIt') ?? 8); it++) {
        const rho = p.mesh.pts.map((_, i) => Math.hypot(res[(p.base + i) * 3], res[(p.base + i) * 3 + 2]));
        p.mesh.pts.forEach((_, i) => {
          if (!near[i] || !nb[i].size) return;
          let m = 0;
          for (const j of nb[i]) m += rho[j];
          m /= nb[i].size;
          if (m <= rho[i]) return;
          const I = (p.base + i) * 3;
          const k = m / (rho[i] || 1e-9);
          res[I] *= k;
          res[I + 2] *= k;
        });
      }
    }
  // A roll line (the fold of a lapel) drawn as one clean crease: the points along it eased toward their neighbours.
  for (const p of B.panels) {
    // (Not an open polo's collar: its fold, laid a set depth from its curved neck seam, isn't the straight line it is
    // cut by, and easing the points near that line together pulled the fall in a step at the side of the neck.)
    if (p.pc.meta.polo && !o.rollFront && !knob('__noPoloLie')) continue;
    for (const [a, b] of p.folds ?? []) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const along = p.mesh.pts
        .map((q, i) => ({ i, t: ((q.x - a.x) * dx + (q.y - a.y) * dy) / L, d: Math.abs(((q.x - a.x) * dy - (q.y - a.y) * dx) / L) }))
        .filter((o) => o.d < 1.1 && o.t > -1 && o.t < L + 1 && !sewn[o.i + p.base])
        .sort((u, v) => u.t - v.t);
      const ids = along.map((o) => o.i + p.base);
      for (let pass = 0; pass < 8; pass++) {
        const nx = ids.map((i) => [res[i * 3], res[i * 3 + 1], res[i * 3 + 2]]);
        for (let k = 2; k + 2 < ids.length; k++)
          for (let d = 0; d < 3; d++) nx[k][d] = res[ids[k] * 3 + d] * 0.4 + (res[ids[k - 1] * 3 + d] + res[ids[k + 1] * 3 + d] + res[ids[k - 2] * 3 + d] + res[ids[k + 2] * 3 + d]) * 0.15;
        ids.forEach((i, k) => {
          for (let d = 0; d < 3; d++) res[i * 3 + d] = nx[k][d];
        });
      }
    }
  }
  // A jacket or coat flared below the waist: wool holds its flare out from the hip in soft flutes, where the sim's
  // coarse cloth crumples it close in. The cloth the sim couldn't show out (the pattern's width round each level less
  // the girth it settled at) is laid back on: part as a step out, the rest as flutes, growing from the waist down.
  // (A long coat too: it was left to hang its flare in the sim itself, which tucked the fullness of a flared coat's hem
  // into creases beside the side seams, 13 fins, All round quality 2026-11-04.)
  const hemC = Math.max(0, ...B.panels.filter((p) => p.role === 'front' || p.role === 'back').flatMap((p) => p.mesh.pts.map((_, i) => res[(p.base + i) * 3 + 1])));
  if (widthAt && !o.boxy && !knob('__noKick') && (hemC < 40 || !knob('__kickShortOnly'))) {
    const tors = B.panels.filter((p) => (p.role === 'front' || p.role === 'back') && !p.hidden);
    const NB = 72;
    const girth = new Map<number, number>();
    const rows = new Map<number, number[]>();
    for (const p of tors)
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        if (res[I + 1] <= 0) return;
        const k = Math.round(res[I + 1] / 2);
        const row = rows.get(k) ?? new Array(NB).fill(0);
        const a = Math.atan2(Math.abs(res[I]), res[I + 2]);
        const b = Math.min(NB / 2 - 1, Math.floor((a / Math.PI) * (NB / 2)));
        row[b] = Math.max(row[b], Math.hypot(res[I], res[I + 2]));
        rows.set(k, row);
      });
    for (const [k, row] of rows) {
      const filled = row.slice(0, NB / 2).filter((x) => x > 0);
      // (A row the cloth only partly rings, at a curved hem, says nothing of how far it stands out.)
      if (filled.length < NB * 0.4) continue;
      girth.set(k, 2 * filled.reduce((t, x) => t + (x * Math.PI) / (NB / 2), 0) * ((NB / 2) / filled.length));
    }
    const kStep = knob('__kick') ?? 0.45;
    const kFlute = knob('__flute') ?? 0.25;
    for (const p of tors) {
      const xs = p.mesh.pts.map((q) => q.x);
      const x0 = Math.min(...xs);
      const W = Math.max(...xs) - x0 || 1;
      p.mesh.pts.forEach((q, i) => {
        const I = (p.base + i) * 3;
        const c = res[I + 1];
        if (c <= 0 || p.turned[i]) return;
        // A row the cloth only partly rings takes the step of the nearest full row above it, so the hem goes with it.
        let k0 = Math.round(c / 2);
        while (k0 > 0 && !girth.has(k0)) k0--;
        const extra = Math.max(0, widthAt!(Math.min(Math.round(c), 2 * k0)) - (girth.get(k0) ?? Infinity));
        // Growing evenly from the waist to the hem, so it flares in a clean line from the cinch rather than ballooning
        // round the hip.
        const ramp = Math.min(1, c / hemC);
        // (At most a few cm: past that, cloth this full hangs down in its folds rather than out.)
        const step = Math.min(4, (kStep * extra) / TAU) * ramp;
        // One flute across each panel, crests between its seams, so the seams still meet.
        const flute = Math.min(2, (kFlute * extra) / TAU) * ramp * Math.sin((Math.PI * (q.x - x0)) / W);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const k = (rho + step + flute) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      });
    }
  }
  // A pressed pleated skirt hangs its own length: on its finer mesh the sim lets its weight draw it a few cm long, so
  // its hem fell well past where it is cut to land. Its cloth is drawn back up toward the waist, evenly, until the hem
  // sits where its pattern puts it.
  {
    const pl = B.panels.filter((p) => !p.hidden && p.pc.meta.pleatFolds && p.mesh.runs.waist && p.mesh.runs.hem);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    let num = 0;
    let den = 0;
    const waistC = new Map<Panel, number>();
    for (const p of pl) {
      const w = p.mesh.runs.waist!.flat();
      const h = p.mesh.runs.hem!.flat();
      const cw = mean(w.map((i) => res[(p.base + i) * 3 + 1]));
      waistC.set(p, cw);
      num += mean(h.map((i) => p.mesh.pts[i].y)) - mean(w.map((i) => p.mesh.pts[i].y));
      den += mean(h.map((i) => res[(p.base + i) * 3 + 1])) - cw;
    }
    const k = den > 0 ? num / den : 1;
    if (k < 1 && k > 0.8)
      for (const p of pl) {
        const cw = waistC.get(p)!;
        for (let i = 0; i < p.mesh.pts.length; i++) {
          const I = (p.base + i) * 3 + 1;
          if (res[I] > cw) res[I] = cw + (res[I] - cw) * k;
        }
      }
  }
  // Pressed pleats: below where they are stitched down (the hip), each fold edge stands a little proud of the cloth
  // it covers, a knife pleat stepping down to the next fold, a box pleat out to both of its folds. `shade` darkens
  // the cloth in under each fold and, below zero, lights the pressed edge itself (which is what shows on dark cloth).
  let shade: Float32Array | undefined;
  for (const p of B.panels) {
    const folds = p.pc.meta.pleatFolds as PleatFold[] | undefined;
    if (!folds || knob('__noPleatFolds')) continue;
    shade ??= new Float32Array(res.length / 3);
    const box = p.pc.meta.pleatKind === 'box';
    const hipY = folds[0].hip.y;
    // Each pressed fold hangs as a straight line: the points the mesh has down it are evened out along it, so the
    // fold doesn't wander from side to side with the mesh's stagger.
    for (const [a, b] of creasesOf(p.pc)) {
      // (On the line, which leans out toward the hem where the pleats open out below the hip.)
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const off = (q: P) => Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / L;
      const col = p.mesh.pts
        .map((q, i) => [q, i] as const)
        .filter(([q]) => off(q) < 0.05 && q.y > hipY - 4)
        .sort((u, v) => u[0].y - v[0].y)
        .map(([, i]) => (p.base + i) * 3);
      for (let pass = 0; pass < 6; pass++) {
        const was = col.map((I) => [res[I], res[I + 1], res[I + 2]]);
        for (let j = 1; j < col.length - 1; j++) for (let e = 0; e < 3; e += 2) res[col[j] + e] = (was[j - 1][e] + 2 * was[j][e] + was[j + 1][e]) / 4;
      }
    }
    const inverted = p.pc.meta.pleatKind === 'inverted';
    p.mesh.pts.forEach((q, i) => {
      if (q.y < hipY - 4) return;
      const xs = folds.map((f) => foldAt(f, q.y));
      const I = (p.base + i) * 3;
      if (inverted) {
        // In the V below the stitching the underlay shows, a cloth's thickness in and in the shadow of the fold edges.
        // (Deepest at the centre and out to nothing at the fold edge, a continuous profile: a flat step in at the
        // edge drew the edge as a sawtooth, since the mesh's points on either side of the crease share it.)
        const w = xs[1];
        if (q.y <= hipY || q.x > w + 0.03 || w < 0.1) return;
        const t = Math.min(1, q.x / w);
        const ramp = Math.min(1, (q.y - hipY) / 6);
        shade![p.base + i] = 0.8 * ramp * (1 - 0.6 * t);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        res[I] *= (rho - 0.5 * ramp * (1 - t)) / rho;
        res[I + 2] *= (rho - 0.5 * ramp * (1 - t)) / rho;
        return;
      }
      const s = xs[1] - xs[0];
      // (A point on a fold, to within the mesh's rounding, is on its edge, not under it.)
      let k = xs.findIndex((x) => x > q.x + 0.03) - 1;
      if (k === -2) k = xs.length - 1;
      const from = k < 0 ? xs[0] - s : xs[k];
      const t = Math.min(1, Math.max(0, (q.x - from) / s));
      // (Half the step it once stood out: pressed knife pleats lie nearly flush, the fold a crisp line, not a ledge.)
      const A = 0.5 * (1.3 + 0.7 * Math.min(1, (q.y - hipY) / 40)) * Math.min(1, (q.y - hipY + 4) / 8);
      const off = A * (box ? Math.abs(1 - 2 * t) : 1 - t);
      // In under the next fold's edge (a box pleat's: in its middle, where its two folds meet) the cloth is in shadow.
      const deep = box ? 1 - Math.abs(1 - 2 * t) : t;
      const ramp = Math.min(1, (q.y - hipY + 4) / 8);
      // (A knife pleat's shadow is a dark strip right under the fold edge; the face before it turns away a little.)
      shade![p.base + i] = box
        ? 0.8 * ramp * Math.pow(Math.max(0, (deep - 0.35) / 0.65), 1.2)
        : ramp * (s * (1 - t) < SHADOW_CORE + 0.02 ? 0.85 : s * t < 0.02 ? -0.7 : 0.25 * t * t);
      const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
      res[I] *= (rho + off) / rho;
      res[I + 2] *= (rho + off) / rho;
    });
    // (The shadow evened over the mesh's own uneven points, so it reads as a band down the pleat, not specks.)
    const nb: number[][] = p.mesh.pts.map(() => []);
    for (const [a, b, c] of p.mesh.tris) {
      nb[a].push(b, c);
      nb[b].push(a, c);
      nb[c].push(a, b);
    }
    for (let pass = 0; pass < (box ? 1 : 0); pass++) {
      const nx = p.mesh.pts.map((_, i) => (shade![p.base + i] * 2 + nb[i].reduce((a, j) => a + shade![p.base + j], 0) / (nb[i].length || 1)) / 3);
      nx.forEach((v, i) => (shade![p.base + i] = v));
    }
  }
  // A skirt's waist and hem are pressed edges: each runs level round the body, not up and down with the mesh.
  for (const p of B.panels) {
    if (!/peplum/.test(p.role)) continue;
    // (The top edge is waist and pleat intake by turns: it is evened as one edge, in order across the piece.)
    for (const tags of [['waist', 'pleat'], ['hem']]) {
      let at = [...new Set(tags.flatMap((t) => (p.mesh.runs[t] ?? []).flat()))]
        .filter((i) => tags[0] !== 'waist' || p.mesh.pts[i].y < 3)
        .sort((u, v) => p.mesh.pts[u].x - p.mesh.pts[v].x);
      // (A pleated hem is cut across by the narrow strips down each fold, whose bits of hem are too short to make a
      // run of their own: every point on the hem line is taken, so none hangs below as a tab.)
      if (tags[0] === 'hem' && p.pc.meta.pleatFolds && at.length > 1) {
        const hp = at.map((i) => p.mesh.pts[i]);
        const hemAt = (x: number) => {
          let k = 0;
          while (k < hp.length - 2 && hp[k + 1].x < x) k++;
          const [a, b] = [hp[k], hp[k + 1]];
          return a.y + ((b.y - a.y) * Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x || 1))));
        };
        const more = p.mesh.pts.map((q, i) => [q, i] as const).filter(([q, i]) => !at.includes(i) && q.y >= hemAt(q.x) - 0.08 && q.x >= hp[0].x && q.x <= hp[hp.length - 1].x).map(([, i]) => i);
        at = [...at, ...more].sort((u, v) => p.mesh.pts[u].x - p.mesh.pts[v].x);
      }
      const ids = at.map((i) => (p.base + i) * 3 + 1);
      // (A pressed pleat's hem as one level line all round: the sim leaves each pleat's face hanging lower at one
      // end, a sawtooth as wide as the pleat, which a few passes don't even out. The cloth above follows its hem.)
      const pressedHem = tags[0] === 'hem' && !!p.pc.meta.pleatFolds;
      const before = pressedHem ? ids.map((I) => res[I]) : [];
      for (let pass = 0; pass < (pressedHem ? 80 : 8); pass++) {
        const was = ids.map((I) => res[I]);
        for (let j = 1; j < ids.length - 1; j++) res[ids[j]] = (was[j - 1] + 2 * was[j] + was[j + 1]) / 4;
      }
      if (pressedHem && at.length) {
        // (Its ends too, at the side seams, which the evening above leaves where the sim put them: all at one level.)
        const lv = ids.reduce((t, I) => t + res[I], 0) / ids.length;
        for (const I of ids) res[I] = lv;
        const hemY = Math.max(...at.map((i) => p.mesh.pts[i].y));
        const reach = 10;
        for (let i = 0; i < p.mesh.pts.length; i++) {
          const q = p.mesh.pts[i];
          if (at.includes(i) || q.y < hemY - reach - 3) continue;
          let best = 0;
          let bd = Infinity;
          at.forEach((h, k) => {
            const dd = Math.abs(p.mesh.pts[h].x - q.x);
            if (dd < bd) {
              bd = dd;
              best = k;
            }
          });
          const up = p.mesh.pts[at[best]].y - q.y;
          const w = Math.max(0, 1 - up / reach);
          const I = (p.base + i) * 3 + 1;
          res[I] += (res[ids[best]] - before[best]) * w;
          // (Right by the hem, each point as far above it as it is cut: the sim leaves them ragged there.)
          const near = Math.max(0, 1 - up / 3);
          res[I] += (res[ids[best]] - up - res[I]) * near;
        }
      }
    }
  }
  // Gathered cloth: its fullness lies in soft folds round the skirt. The sim settles where the cloth hangs; the folds
  // its mesh is too coarse to form are laid on for drawing, as many as the cloth's width holds, each seam on a fold's
  // turn so the pieces still meet.
  const foldA = knob("__foldA") ?? 1;
  // (Past the hip the fullness carries on holding a long skirt out, half as fast, so it hangs as a bell to its hem
  // rather than turning back in above it.)
  const FLARE_ON = knob('__fl2') ?? 0.5;
  const soft = (o.bendK ?? 0.05) < 0.04;
  for (const p of B.panels) {
    const gather = ((p.pc.meta.gatherShown ?? p.pc.meta.gathered) as number | undefined) ?? 1;
    if (!/peplum/.test(p.role) || gather < 1.05 || !foldA) continue;
    const simScale = (p.pc.meta.simScale as number | undefined) ?? 1;
    const xs = p.mesh.pts.map((q) => q.x);
    const ys = p.mesh.pts.map((q) => q.y);
    const x0 = Math.min(...xs);
    const W = Math.max(...xs) - x0;
    const y0 = Math.min(...ys);
    // (Heavy gathers fall in narrower folds, which the finer mesh it is cut on can hold.)
    // (A long one in wider: down a maxi's length the narrow folds drew its hem in a sawtooth.)
    const lamCloth = (knob("__lamC") ?? (p.pc.meta.gatherShown && gather > 2 ? (Math.max(...ys) - y0 > 90 ? 4 : 3) : 6)) * gather;
    const n = Math.max(2, Math.round(W / simScale / (lamCloth / 2)));
    // A tier below a drop yoke hangs long from its seam: softer folds, and it falls more down than out.
    const tier = !!p.pc.meta.tier;
    const A = Math.min(3.5, (knob("__fk") ?? (tier ? 1 : 2)) * Math.sqrt(gather - 1)) * foldA;
    // The fullness holds the skirt out from the body a little more the further down it falls.
    const flare = (gather - 1) * (knob("__flare") ?? 0.15);
    p.mesh.pts.forEach((q, i) => {
      const I = (p.base + i) * 3;
      const lv = q.y - y0;
      const amp = A * (soft ? (knob('__fold0') ?? 0.12) + (1 - (knob('__fold0') ?? 0.12)) * Math.min(1, lv / (knob('__foldL') ?? 30)) : 0.35 + 0.65 * Math.min(1, lv / 18));
      // (Soft cloth falls close from the waist and swings out toward the hem, a bell; crisper cloth stands out from the
      // waist.)
      const bell = soft ? Math.min(1, lv / (knob('__bellL') ?? 70)) ** (knob('__bellP') ?? 1) : 1;
      const off = amp * Math.sin((Math.PI * n * (q.x - x0)) / W) + bell * (tier ? Math.min(flare * Math.min(lv, 45), 1) : flare * (Math.min(lv, 45) + FLARE_ON * Math.max(0, lv - 45)));
      const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
      const R = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i];
      const k = Math.max(rho + off, R) / rho;
      res[I] *= k;
      res[I + 2] *= k;
    });
  }
  // A flared skirt (a trumpet, an A-line, a flared peplum): the sim hangs its hem straight down and quietly takes the
  // flare's width in, so a trumpet reads as a tube. Below the hip, each level is drawn out as wide round as it is cut:
  // most of the extra width swings the cloth out, the rest falls in a few soft folds, a seam on each fold's crest.
  if (!knob('__noFlare')) {
    const hipC = sp.cOf(0.82);
    for (const p of B.panels) {
      const gather = ((p.pc.meta.gatherShown ?? p.pc.meta.gathered) as number | undefined) ?? 1;
      // (Nor a balloon's outer skirt: its hem is gathered onto the underskirt's, so its fullness is not width to draw out.)
      if (p.hidden || !/peplum/.test(p.role) || gather > 1.05 || p.pc.meta.bias || p.pc.meta.tier || /ruffle|flounce/i.test(p.pc.name) || p.mesh.runs.balloon) continue;
      const pts = p.mesh.pts;
      // (A circle skirt's levels are arcs round its waist's centre, not the piece's rows: its side seam is a radius, lying
      // along the fall. Binned by row, the row beside the seam ran from waist to hem, its drawn width across next to
      // nothing, and was flung out to the side as a wing, All round quality 2026-11-04.)
      const Rw = p.pc.meta.waistRadius as number | undefined;
      const lvl = (q: P) => (Rw ? Math.hypot(q.x, q.y + Rw) - Rw : q.y);
      const across = (q: P) => (Rw ? Math.atan2(q.x, q.y + Rw) : q.x);
      const ys = pts.map(lvl);
      const y0 = Math.min(...ys);
      const nb = Math.ceil(Math.max(...ys) - y0) + 1;
      const bins: number[][] = Array.from({ length: nb }, () => []);
      pts.forEach((q, i) => bins[Math.min(nb - 1, Math.round(lvl(q) - y0))].push(i));
      const ratio = bins.map((b) => {
        if (b.length < 3) return 1;
        const o2 = [...b].sort((u, v) => across(pts[u]) - across(pts[v]));
        const pw = (across(pts[o2[o2.length - 1]]) - across(pts[o2[0]])) * (Rw ? Rw + lvl(pts[o2[0]]) : 1);
        let dw = 0;
        for (let k = 1; k < o2.length; k++) {
          const I = (p.base + o2[k]) * 3;
          const J = (p.base + o2[k - 1]) * 3;
          dw += Math.hypot(res[I] - res[J], res[I + 2] - res[J + 2]);
        }
        return dw > 1 ? Math.max(1, pw / dw) : 1;
      });
      // (Not past the line of the levels above it at the hem: the hem's free edge draws in narrower in the sim than the
      // cloth above it, its ratio leapt there, and the hem was drawn turned out in a ring, Cat 2026-11-07 "why does the
      // edge turn out so much at the bottom".)
      const tail = knob('__hemTail') ?? 6;
      if (tail > 0 && nb > 3 * tail) {
        const a = nb - 1 - 2 * tail;
        const b = nb - 1 - tail;
        const slope = (ratio[b] - ratio[a]) / tail;
        for (let k = b + 1; k < nb; k++) ratio[k] = Math.min(ratio[k], ratio[b] + Math.max(0, slope) * (k - b));
      }
      // (Eased over its neighbours, so one level doesn't stand out from the next.)
      const sm = ratio.map((_, k) => {
        let a = 0;
        let n = 0;
        for (let j = Math.max(0, k - 4); j <= Math.min(nb - 1, k + 4); j++) {
          a += ratio[j];
          n++;
        }
        return a / n;
      });
      const xs = pts.map(across);
      const x0 = Math.min(...xs);
      const W = Math.max(...xs) - x0;
      const lam = knob('__flareLam') ?? 16;
      const n = 2 * Math.max(1, Math.round((W * (Rw ? Rw + Math.max(...ys) : 1)) / (2 * lam)));
      const OUT = knob('__flareOut') ?? 0.65;
      pts.forEach((q, i) => {
        const I = (p.base + i) * 3;
        const r = sm[Math.min(nb - 1, Math.round(lvl(q) - y0))];
        const below = Math.min(1, Math.max(0, (res[I + 1] - hipC) / 15));
        if (r <= 1.02 || !below) return;
        const sOut = 1 + (r - 1) * OUT * below;
        const rest = Math.max(0, r / sOut - 1);
        const A = (lam / Math.PI) * Math.sqrt(rest) * below * (knob('__flareFold') ?? 1);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const k = (rho * sOut + A * Math.cos((Math.PI * n * (across(q) - x0)) / W)) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      });
    }
  }
  // A flared skirt cut in two pieces (an A-line): the sim hangs its flare out at the side seams and the hem rides up
  // there. The hem is let down where it rode up, so it runs level round the body (the cloth above it eased down with
  // it, more nearer the hem). (Its stand-off can also be evened round the body, off by default: below the hip the
  // body's own flat front and wide sides already set it.)
  if (!knob('__noEven')) {
    const hipC = sp.cOf(0.82);
    const flared = B.panels.filter((p) => {
      const gather = ((p.pc.meta.gatherShown ?? p.pc.meta.gathered) as number | undefined) ?? 1;
      return !p.hidden && /peplum/.test(p.role) && gather <= 1.05 && !p.pc.meta.bias && !p.pc.meta.tier && !p.pc.meta.pleatFolds && !/ruffle|flounce|underskirt/i.test(p.pc.name) && !p.mesh.runs.balloon;
    });
    const hemIds = flared.flatMap((p) => (p.mesh.runs.hem ?? []).flat().map((i) => p.base + i));
    const hemC0 = hemIds.length ? Math.min(...hemIds.map((g) => res[g * 3 + 1])) : 0;
    const hemC1 = hemIds.length ? Math.max(...hemIds.map((g) => res[g * 3 + 1])) : 0;
    // (Only a skirt whose hem rose at the sides well clear of the mesh's own noise, and not a long one: a maxi's
    // weight hangs its own flare.)
    // (Not a hem cut unlevel on purpose: a diagonal's short side was let down to the long side's level, the cloth above
    // it stretched to 2.8 times its cut, All round quality 2026-11-04.)
    if (flared.length && !o.shapedHem && hemC1 - hemC0 > (knob('__evenMin') ?? 1.5) && hemC1 < (knob('__evenMax') ?? 70)) {
      const W = (o.crisp ? 1 : 0.6) * (knob('__even') ?? 0);
      const ids = flared.flatMap((p) => p.mesh.pts.map((_, i) => p.base + i)).filter((g) => res[g * 3 + 1] > hipC);
      const bins = new Map<number, { s: number; n: number }>();
      const off = (g: number) => Math.hypot(res[g * 3], res[g * 3 + 2]) - sp.bodyR(Math.atan2(res[g * 3], res[g * 3 + 2]), res[g * 3 + 1]);
      for (const g of ids) {
        const k = Math.round(res[g * 3 + 1]);
        const b = bins.get(k) ?? { s: 0, n: 0 };
        b.s += off(g);
        b.n++;
        bins.set(k, b);
      }
      for (const g of ids) {
        const b = bins.get(Math.round(res[g * 3 + 1]))!;
        const below = Math.min(1, (res[g * 3 + 1] - hipC) / 10);
        const o0 = off(g);
        const o1 = o0 + (b.s / b.n - o0) * W * below;
        const rho = Math.hypot(res[g * 3], res[g * 3 + 2]) || 1e-9;
        const k = (rho + o1 - o0) / rho;
        res[g * 3] *= k;
        res[g * 3 + 2] *= k;
      }
      // (The hem's drop by its direction round the body, from the hem points of both pieces.)
      const hem = hemIds.map((g) => [Math.abs(Math.atan2(res[g * 3], res[g * 3 + 2])), res[g * 3 + 1]] as [number, number]).sort((u, v) => u[0] - v[0]);
      const target = hem.reduce((a, q) => Math.max(a, q[1]), -Infinity) - (knob('__evenUp') ?? 0.2) * (hemC1 - hemC0);
      const dropAt = (a: number) => {
        let k = 0;
        while (k < hem.length - 1 && hem[k + 1][0] < a) k++;
        const [a0, c0] = hem[k];
        const [a1, c1] = hem[Math.min(hem.length - 1, k + 1)];
        const c = a1 > a0 ? c0 + ((c1 - c0) * Math.min(1, Math.max(0, (a - a0) / (a1 - a0)))) : c0;
        return Math.max(0, target - c);
      };
      for (const g of ids) {
        const t = Math.min(1, Math.max(0, (res[g * 3 + 1] - hipC) / Math.max(1, hemC0 - hipC)));
        res[g * 3 + 1] += dropAt(Math.abs(Math.atan2(res[g * 3], res[g * 3 + 2]))) * t * t;
      }
    }
  }
  // (A heavily gathered skirt is hung in the sim at less than its real fullness, so it lies closer on the body than it
  // does worn and rode up over the seat and the tummy, its hem rising toward the centres. Worn, all that fullness
  // stands it off them and it hangs near level: its hem let down most of the way there, the cloth above eased with it.)
  if (!knob('__noGatherLevel')) {
    const hipC = sp.cOf(0.82);
    const gp = B.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && !p.pc.meta.tier && ((p.pc.meta.gatherShown as number | undefined) ?? 1) > ((p.pc.meta.gathered as number | undefined) ?? 1) + 0.3 && !/ruffle|flounce|underskirt/i.test(p.pc.name));
    const hemIds = gp.flatMap((p) => (p.mesh.runs.hem ?? []).flat().map((i) => p.base + i));
    if (hemIds.length) {
      const low = Math.max(...hemIds.map((g) => res[g * 3 + 1]));
      const hem = hemIds.map((g) => [Math.abs(Math.atan2(res[g * 3], res[g * 3 + 2])), res[g * 3 + 1]] as [number, number]).sort((u, v) => u[0] - v[0]);
      const K = knob('__gatherLevel') ?? 0.6;
      const dropAt = (a: number) => {
        let k = 0;
        while (k < hem.length - 1 && hem[k + 1][0] < a) k++;
        const [a0, c0] = hem[k];
        const [a1, c1] = hem[Math.min(hem.length - 1, k + 1)];
        const c = a1 > a0 ? c0 + (c1 - c0) * Math.min(1, Math.max(0, (a - a0) / (a1 - a0))) : c0;
        return Math.max(0, low - c) * K;
      };
      const c0 = Math.min(...hemIds.map((g) => res[g * 3 + 1]));
      for (const p of gp)
        p.mesh.pts.forEach((_, i) => {
          const g = p.base + i;
          const t = Math.min(1, Math.max(0, (res[g * 3 + 1] - hipC) / Math.max(1, c0 - hipC)));
          res[g * 3 + 1] += dropAt(Math.abs(Math.atan2(res[g * 3], res[g * 3 + 2]))) * t * t;
        });
    }
  }
  // A bias slip: cut on the bias the cloth gives round the body, so it moulds to the hip and below it falls in a few
  // long soft folds, deepening to the hem, as its slight flare and the bias's swing let it. Each seam lies where a
  // fold turns, so the pieces still meet.
  if (!knob('__noBias')) {
    const hipC = sp.cOf(0.82);
    for (const p of B.panels) {
      if (p.hidden || !/peplum/.test(p.role) || !p.pc.meta.bias) continue;
      const xs = p.mesh.pts.map((q) => q.x);
      const x0 = Math.min(...xs);
      const W = Math.max(...xs) - x0;
      // (An even number of half waves: the centre line and the seam both lie flat across a fold's crest, so the
      // halves meet without a crease and the seams match.)
      // (At the centre line the sim gathers what flare there is into a narrow pinch either side of it, a few cm of cloth
      // in under a cm, which draws as a string of dimples down the centre below the hip: the cloth there is spread
      // out evenly from the centre line to a few cm across, lying flat across the centre as it turns there.)
      // (Out to the first fold's crest beside it: round the body from the centre line evenly, standing off it in a
      // smooth curve, flat across the centre.)
      const reach = knob('__biasBand') ?? 9;
      if (reach > 0) {
        const pts = p.mesh.pts;
        const near = pts.map((_, i) => i).filter((i) => pts[i].x - x0 < reach + 1);
        const P3 = (i: number) => [res[(p.base + i) * 3], res[(p.base + i) * 3 + 1], res[(p.base + i) * 3 + 2]];
        const ang = (v: number[]) => Math.atan2(v[0], v[2]);
        const rhoOf = (v: number[]) => Math.hypot(v[0], v[2]);
        const out = new Map<number, [number, number]>();
        for (const i of near) {
          const q = pts[i];
          const dx = q.x - x0;
          if (dx < 0.05 || P3(i)[1] < hipC) continue;
          const row = near.filter((j) => Math.abs(pts[j].y - q.y) < 1.0);
          const cbs = row.filter((j) => pts[j].x - x0 < 0.05);
          if (!cbs.length) continue;
          const c = P3(cbs[0]);
          // (The crest: the point of the row standing furthest out, past which the cloth turns back in.)
          let crest = -1;
          let best = -Infinity;
          for (const j of row) {
            const v = P3(j);
            const r = rhoOf(v) - sp.bodyR(ang(v), v[1]);
            if (pts[j].x - x0 > 1 && r > best) {
              best = r;
              crest = j;
            }
          }
          if (crest < 0) continue;
          const cx = pts[crest].x - x0;
          if (dx >= cx) continue;
          const f = P3(crest);
          const t = dx / cx;
          const s = t * t * (3 - 2 * t);
          const a0 = ang(c);
          let a1 = ang(f);
          if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
          if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
          const a = a0 + (a1 - a0) * t;
          const y = P3(i)[1];
          const off0 = rhoOf(c) - sp.bodyR(a0, c[1]);
          const off1 = rhoOf(f) - sp.bodyR(ang(f), f[1]);
          const r = Math.max(sp.bodyR(a, y) + p.thick[i], sp.bodyR(a, y) + off0 + (off1 - off0) * s);
          out.set(i, [Math.sin(a) * r, Math.cos(a) * r]);
        }
        for (const [i, [x, z]] of out) {
          res[(p.base + i) * 3] = x;
          res[(p.base + i) * 3 + 2] = z;
        }
      }
      const n = 2 * Math.max(1, Math.round(W / (2 * (knob('__biasLam') ?? 13))));
      const A = knob('__biasA') ?? 2;
      let hemC = -Infinity;
      p.mesh.pts.forEach((_, i) => (hemC = Math.max(hemC, res[(p.base + i) * 3 + 1])));
      p.mesh.pts.forEach((q, i) => {
        const I = (p.base + i) * 3;
        const u0 = Math.min(1, Math.max(0, (res[I + 1] - hipC) / Math.max(1, hemC - hipC)));
        if (!u0) return;
        const u = u0 * u0 * (3 - 2 * u0);
        // (A fold drifts a little as it falls: the bias never hangs ruler-straight.)
        const ph = (Math.PI * n * (q.x - x0)) / W + 0.6 * Math.sin((Math.PI * (q.x - x0)) / W) ** 2 * u;
        const off = A * u * Math.cos(ph);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const R = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i];
        const k = Math.max(rho + off, R) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      });
    }
  }
  // A flounce sewn on below a heavily gathered skirt: the sim, with the skirt drawn in across its width and the flounce
  // not, crushes it into pillows. It is laid on instead as the skirt's own folds carried on down from its hem, as a
  // ruffle gathered onto that hem falls, flaring out a little as it goes.
  if (!knob('__noFlounceLay')) {
    for (const side of ['peplum-front', 'peplum-back']) {
      const skirt = B.panels.filter((p) => !p.hidden && p.role === side && !p.pc.meta.tier && ((p.pc.meta.gatherShown as number | undefined) ?? 1) > 2 && p.mesh.runs.tier?.length);
      const fl = B.panels.filter((p) => !p.hidden && p.role === side && /ruffle|flounce/i.test(p.pc.name));
      if (!skirt.length || !fl.length) continue;
      // The hem, in order round from the centre: where each point of it ended up.
      const hem = skirt.flatMap((p) => p.mesh.runs.tier!.flat().map((i) => {
        const I = (p.base + i) * 3;
        return { x: p.mesh.pts[i].x, v: [res[I], res[I + 1], res[I + 2]] as V3 };
      }));
      hem.sort((u, v) => u.x - v.x);
      const x0 = hem[0].x;
      const x1 = hem[hem.length - 1].x;
      const at = (t: number): V3 => {
        const x = x0 + t * (x1 - x0);
        let k = 1;
        while (k < hem.length - 1 && hem[k].x < x) k++;
        const u = hem[k - 1];
        const w = hem[k];
        const f = w.x - u.x > 1e-9 ? Math.min(1, Math.max(0, (x - u.x) / (w.x - u.x))) : 0;
        return [u.v[0] + (w.v[0] - u.v[0]) * f, u.v[1] + (w.v[1] - u.v[1]) * f, u.v[2] + (w.v[2] - u.v[2]) * f];
      };
      for (const p of fl) {
        const xs = p.mesh.pts.map((q) => q.x);
        const ys = p.mesh.pts.map((q) => q.y);
        const fx0 = Math.min(...xs);
        const fx1 = Math.max(...xs);
        const fy0 = Math.min(...ys);
        p.mesh.pts.forEach((q, i) => {
          const I = (p.base + i) * 3;
          const top = at((q.x - fx0) / (fx1 - fx0 || 1));
          const down = q.y - fy0;
          const rho = Math.hypot(top[0], top[2]) || 1e-9;
          const k = (rho + down * (knob('__flOut') ?? 0.35)) / rho;
          res[I] = top[0] * k;
          res[I + 1] = top[1] + down * 0.94;
          res[I + 2] = top[2] * k;
        });
      }
    }
  }
  // A gathered band (a tier, a ruffled hem) hangs from the edge it is gathered to. The passes above move that edge (a
  // flared skirt's hem drawn out to its cut width, a tier's own folds laid on) and not the band, which was left hanging
  // 4 to 8 cm inside the hem above it, the seam torn. Each band is carried whole to meet its seam again, its top band
  // first, between the two seam points either side of each point so it keeps its own folds (All round quality
  // 2026-11-04).
  /** The panel's edge `tag` set back on the edge it is sewn to (by the seams' own targets), the rest of the panel
   *  carried with it: whole when `reach` is 0, else only the cloth within `reach` cm (up the piece) of the edge, easing
   *  out. Between the two seam points either side of each point, so the panel keeps its own folds. */
  // Every point on a side seam, found once: seatOn holds them where they are sewn.
  let sideSet: Set<number> | undefined;
  const onSide = () => (sideSet ??= new Set(B.panels.flatMap((x) => (x.mesh.runs.side ?? []).flat().map((i) => x.base + i))));
  const seatOn = (p: Panel, tag: string, reach = 0, smoothAbove = true) => {
    const edge = new Set((p.mesh.runs[tag] ?? []).flat().map((i) => p.base + i));
    const mine = (g: number) => g >= p.base && g < p.base + p.mesh.pts.length;
    // The edge it gathers onto is first smoothed along its length, in the order of its own piece's edge: the gathered
    // cloth, sewn to it point by point, had drawn it into a 1 cm zigzag and bunched its points out of order round the
    // body, where the gathering thread sews a straight line.
    const above = new Set<number>();
    for (const { i, j, k } of seams) if (edge.has(i) && !mine(j)) above.add(j).add(k);
    const xOf = (g: number) => {
      const q = B.panels.find((x) => g >= x.base && g < x.base + x.mesh.pts.length)!;
      return q.mesh.pts[g - q.base].x;
    };
    const ring = [...above].sort((u, v) => xOf(u) - xOf(v));
    for (let pass = 0; pass < (smoothAbove ? knob('__seamSmooth') ?? 3 : 0); pass++) {
      const was = ring.map((g) => [res[g * 3], res[g * 3 + 1], res[g * 3 + 2]]);
      for (let n = 1; n < ring.length - 1; n++) {
        // (Points on a side seam stay put, sewn to the other piece as they are: smoothed along with the rest, a balloon
        // peplum's ring (its underskirt's hem, and the side-seam points of the outer's other half that the hem corner
        // is sewn to) drew the side seams 1.6 to 2.3 cm open, 2026-11-06. Every option on its own still passes.)
        if (onSide().has(ring[n])) continue;
        const g = ring[n] * 3;
        for (let d = 0; d < 3; d++) res[g + d] = was[n][d] * 0.5 + (was[n - 1][d] + was[n + 1][d]) * 0.25;
      }
    }
    const shift = new Map<number, V3>();
    for (const { i, j, k, t } of seams) {
      if (!edge.has(i) || mine(j)) continue;
      const I = i * 3;
      const J = j * 3;
      const K = k * 3;
      shift.set(i, [res[J] * (1 - t) + res[K] * t - res[I], res[J + 1] * (1 - t) + res[K + 1] * t - res[I + 1], res[J + 2] * (1 - t) + res[K + 2] * t - res[I + 2]]);
    }
    if (!shift.size) return;
    const tops = [...shift.keys()].map((g) => ({ g, x: p.mesh.pts[g - p.base].x, y: p.mesh.pts[g - p.base].y })).sort((u, v) => u.x - v.x);
    // (The shifts eased along the edge, so neighbouring columns of the panel move alike: moved point by point to a
    // zigzagging seam, the band creased into fins down each step.)
    for (let pass = 0; pass < 2; pass++) {
      const was = tops.map((t) => shift.get(t.g)!);
      for (let n = 1; n < tops.length - 1; n++) shift.set(tops[n].g, [0, 1, 2].map((d) => was[n][d] * 0.5 + (was[n - 1][d] + was[n + 1][d]) * 0.25) as V3);
    }
    p.mesh.pts.forEach((q, i) => {
      let k = 0;
      while (k < tops.length - 1 && tops[k + 1].x < q.x) k++;
      const a = tops[k];
      const b = tops[Math.min(tops.length - 1, k + 1)];
      const f = b.x > a.x ? Math.min(1, Math.max(0, (q.x - a.x) / (b.x - a.x))) : 0;
      const w = reach ? Math.max(0, 1 - Math.abs(q.y - (a.y + (b.y - a.y) * f)) / reach) : 1;
      if (w <= 0) return;
      const sa = shift.get(a.g)!;
      const sb = shift.get(b.g)!;
      const I = (p.base + i) * 3;
      res[I] += (sa[0] + (sb[0] - sa[0]) * f) * w;
      res[I + 1] += (sa[1] + (sb[1] - sa[1]) * f) * w;
      res[I + 2] += (sa[2] + (sb[2] - sa[2]) * f) * w;
    });
  };
  if (!knob('__noBandSeat')) {
    const topC = (p: Panel) => Math.min(...p.mesh.runs.waist!.flat().map((i) => res[(p.base + i) * 3 + 1]));
    const bands = B.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && p.pc.meta.tier && p.mesh.runs.waist?.length).sort((a, b) => topC(a) - topC(b));
    for (const p of bands) seatOn(p, 'waist');
  }
  // Turned cloth (a lapel, a collar's fall) lies on the cloth it turns over: each turned point is laid at the radius
  // of the garment under it, a cloth's thickness out, so a pressed lapel or collar reads flat, not crumpled.
  // A tailored neckline sits close round the neck, held by its collar and the tape in its seam; the coarse sim leaves
  // it resting out on the slope of the shoulders. The neck edge is drawn in to the neck (a little ease off it), and the
  // cloth within a few cm of it eases in with it; the collar's stand comes with its seam.
  // A skirt's waist is held to the body by its waistband (and a pleated one by its stitched-down pleats): the coarse
  // sim lets it stand off over the small of the back. Its top edge is drawn in to the body, a cloth's thickness off,
  // and the cloth below eases in with it over the hip.
  if (!torso.length && !knob('__noWaistPull')) {
    for (const p of B.panels) {
      // (Not a tier's or a ruffle's top, which is gathered onto the edge above it, not held by a waistband: drawn in
      // to the body it left the band hanging 4 to 8 cm inside the hem it is sewn to, All round quality 2026-11-04.)
      if (p.hidden || !/peplum/.test(p.role) || /underskirt/i.test(p.pc.name) || p.pc.meta.tier) continue;
      const top = (p.mesh.runs.waist ?? []).flat();
      if (!top.length) continue;
      const pts = p.mesh.pts;
      const y0 = Math.min(...top.map((i) => pts[i].y));
      const pull = new Map<number, number>();
      for (const i of top) {
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]);
        pull.set(i, Math.max(0, rho - (sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i] + 0.2)));
      }
      pts.forEach((q, i) => {
        let best = top[0];
        let bd = Infinity;
        for (const t of top) {
          const dd = Math.abs(pts[t].x - q.x);
          if (dd < bd) {
            bd = dd;
            best = t;
          }
        }
        const w = Math.max(0, 1 - (q.y - y0) / 14);
        const dl = w * w * (pull.get(best) ?? 0);
        if (dl <= 0) return;
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const floor = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i];
        const want = Math.max(floor, rho - dl);
        if (want >= rho) return;
        res[I] *= want / rho;
        res[I + 2] *= want / rho;
      });
    }
  }
  if (o.pinFront?.length && !o.rollFront) {
    for (const p of B.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back' && p.role !== 'collar')) continue;
      const neck = (p.mesh.runs.neck ?? []).flat();
      if (!neck.length) continue;
      const pts = p.mesh.pts;
      const pull = neck.map((i) => {
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]);
        return Math.max(0, rho - (sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + thick + 0.4));
      });
      const moves: [number, number][] = [];
      pts.forEach((q, i) => {
        if (p.turned[i]) return;
        let best = 0;
        let bd = Infinity;
        neck.forEach((n, k) => {
          const dd = Math.hypot(pts[n].x - q.x, pts[n].y - q.y);
          if (dd < bd) {
            bd = dd;
            best = k;
          }
        });
        const w = Math.max(0, 1 - bd / 4);
        if (w > 0 && pull[best] > 0) moves.push([i, w * pull[best]]);
      });
      for (const [i, dl] of moves) {
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const floor = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + thick;
        const want = Math.max(floor, rho - dl);
        if (want >= rho) continue;
        res[I] *= want / rho;
        res[I + 2] *= want / rho;
      }
    }
  }
  // A point inside the body put back out onto it the shortest way: out, or (on the top of the shoulders) up.
  const ontoBody = (v: V3, off: number): V3 => {
    const a = Math.atan2(v[0], v[2]);
    const rho = Math.hypot(v[0], v[2]) || 1e-9;
    const lo = sp.bodyR(a, v[1]) + off;
    if (rho >= lo) return v;
    for (let up = 0.2; up < Math.min(3, lo - rho); up += 0.2) if (sp.bodyR(a, v[1] - up) + off <= rho) return [v[0], v[1] - up, v[2]];
    return [(v[0] * lo) / rho, v[1], (v[2] * lo) / rho];
  };
  // A jacket front's neckline runs from the shoulder down round the neck: the coarse sim can leave it slid out across
  // the top of the shoulder, longer than it is cut. It is drawn back along itself from the shoulder (never longer than
  // cut, a little give), onto the body, and the front within a few cm of it comes with it.
  // (Off since 2026-11-04: on a jacket or coat closed at the neck, a stand, funnel, hood or collarless one, it ran the
  // neckline the wrong way round the neck, down the chest in a drooping V, and tore the front; the collar's seam
  // then stood 9 to 23 cm off it. Left as the sim settles it, every one of those passes.)
  if (o.pinFront?.length && !o.rollFront && knob('__neckDev')) {
    for (const p of B.panels) {
      if (p.hidden || p.role !== 'front') continue;
      const pts = p.mesh.pts;
      const sh = new Set((p.mesh.runs.shoulder ?? []).flat());
      const delta = new Map<number, V3>();
      for (const run0 of p.mesh.runs.neck ?? []) {
        if (run0.length < 2) continue;
        const run = sh.has(run0[run0.length - 1]) ? [...run0].reverse() : sh.has(run0[0]) ? run0 : undefined;
        if (!run) continue;
        // Developed onto the body as cut: from the shoulder point, at the angle it is cut to the shoulder seam, each
        // step as long as cut and turning as the cut line turns, kept on the body.
        const shRun = (p.mesh.runs.shoulder ?? []).find((r2) => r2.includes(run[0]));
        if (!shRun || shRun.length < 2) continue;
        const sOrd = shRun[0] === run[0] ? shRun : [...shRun].reverse();
        const P3 = (j: number): V3 => [0, 1, 2].map((d) => res[(p.base + j) * 3 + d]) as V3;
        const nrmz = (u: V3): V3 => {
          const l = Math.hypot(u[0], u[1], u[2]) || 1e-9;
          return [u[0] / l, u[1] / l, u[2] / l];
        };
        const crs = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        // The cloth's own outward normal at each of its points, as it settled (its lie is right where its place may not be).
        const vn = pts.map((): V3 => [0, 0, 0]);
        for (const [a0, b0, c0] of p.mesh.tris) {
          const A = P3(a0), Bv = P3(b0), C = P3(c0);
          const n = crs([Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
          for (const j of [a0, b0, c0]) for (let d = 0; d < 3; d++) vn[j][d] += n[d];
        }
        const normalOf = (j: number): V3 => {
          const n = nrmz(vn[j]);
          const v = P3(j);
          return n[0] * v[0] + n[2] * v[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
        };
        const rot = (u: V3, n: V3, ang: number): V3 => {
          const c0 = Math.cos(ang), s0 = Math.sin(ang);
          const kx = crs(n, u);
          const kd = dot(n, u);
          return [0, 1, 2].map((d) => u[d] * c0 + kx[d] * s0 + n[d] * kd * (1 - c0)) as V3;
        };
        const ang2 = (u: P, v: P) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
        const seg2 = (i0: number, i1: number): P => ({ x: pts[i1].x - pts[i0].x, y: pts[i1].y - pts[i0].y });
        let prev = P3(run[0]);
        const n0 = normalOf(run[0]);
        let dsh = P3(sOrd[1]).map((v, d) => v - prev[d]) as V3;
        dsh = nrmz(dsh.map((v, d) => v - n0[d] * dot(dsh, n0)) as V3);
        const th = ang2(seg2(sOrd[0], sOrd[1]), seg2(run[0], run[1]));
        // (Which way round the cut turns on the body: the way that takes the neckline forward.)
        const dA = rot(dsh, n0, th);
        const dB = rot(dsh, n0, -th);
        const hand = dA[2] >= dB[2] ? 1 : -1;
        let dir = hand > 0 ? dA : dB;
        for (let k = 1; k < run.length; k++) {
          const I = (p.base + run[k]) * 3;
          const cur: V3 = [res[I], res[I + 1], res[I + 2]];
          if (k > 1) dir = rot(dir, normalOf(run[k - 1]), hand * ang2(seg2(run[k - 2], run[k - 1]), seg2(run[k - 1], run[k])));
          const L = Math.hypot(pts[run[k]].x - pts[run[k - 1]].x, pts[run[k]].y - pts[run[k - 1]].y);
          let nx: V3 = [prev[0] + dir[0] * L, prev[1] + dir[1] * L, prev[2] + dir[2] * L];
          nx = ontoBody(nx, thick + 0.4);
          const nn = normalOf(run[k]);
          const step = nx.map((v, d) => v - prev[d]) as V3;
          dir = nrmz(step.map((v, d) => v - nn[d] * dot(step, nn)) as V3);
          delta.set(run[k], [nx[0] - cur[0], nx[1] - cur[1], nx[2] - cur[2]]);
          prev = nx;
        }
      }
      if (!delta.size) continue;
      const moved = [...delta.keys()];
      const moves: [number, V3][] = [];
      pts.forEach((q, i) => {
        if (delta.has(i)) return moves.push([i, delta.get(i)!]);
        let bd = Infinity;
        let best = moved[0];
        for (const n of moved) {
          const dd = Math.hypot(pts[n].x - q.x, pts[n].y - q.y);
          if (dd < bd) {
            bd = dd;
            best = n;
          }
        }
        const w = Math.max(0, 1 - bd / 5);
        if (w > 0) moves.push([i, delta.get(best)!.map((v) => v * w) as V3]);
      });
      for (const [i, dv] of moves) {
        const I = (p.base + i) * 3;
        res[I] += dv[0];
        res[I + 1] += dv[1];
        res[I + 2] += dv[2];
        const v = ontoBody([res[I], res[I + 1], res[I + 2]], thick);
        res[I] = v[0];
        res[I + 1] = v[1];
        res[I + 2] = v[2];
      }
      // (The cloth beside the neckline eased back to its cut lengths, the neckline and shoulder held: drawn back 6 to
      // 8 cm, the neck's last point and the gorge point beside it, carried by a steeper share, were drawn 2.8 times
      // their cut apart, All round quality 2026-11-04.)
      // (Only the cloth near the neckline is free to ease, and only on a front with a gorge, where the tear was: the
      // whole front freed, a collarless coat's centre front folded into a fin lower down.)
      if (!knob('__noNeckEase') && p.mesh.runs.gorge?.length) {
        const near = (q: P) => moved.some((n) => Math.hypot(pts[n].x - q.x, pts[n].y - q.y) < (knob('__neckEaseCm') ?? 10));
        relax(p, [...delta.keys(), ...sh, ...pts.map((q, i) => (near(q) ? -1 : i)).filter((i) => i >= 0)]);
      }
    }
  }
  // A panel's settled surface at a point of its pattern: inside one of its triangles, or past its edge carried on
  // smoothly by the plane that best fits its nearest points. (Only the parts not turned back, unless asked.)
  const surfaceAt = (p: Panel, r: P, withTurned: boolean): V3 | undefined => {
    const pts = p.mesh.pts;
    const ok = (j: number) => withTurned || !p.turned[j];
    for (const [a, b, c] of p.mesh.tris) {
      if (!ok(a) || !ok(b) || !ok(c)) continue;
      const A = pts[a], Bp = pts[b], C = pts[c];
      const det = (Bp.y - C.y) * (A.x - C.x) + (C.x - Bp.x) * (A.y - C.y);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((Bp.y - C.y) * (r.x - C.x) + (C.x - Bp.x) * (r.y - C.y)) / det;
      const v = ((C.y - A.y) * (r.x - C.x) + (A.x - C.x) * (r.y - C.y)) / det;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const I = (p.base + a) * 3, J = (p.base + b) * 3, K = (p.base + c) * 3;
      return [0, 1, 2].map((d) => res[I + d] * u + res[J + d] * v + res[K + d] * w) as V3;
    }
    const near = pts
      .map((q, j) => [j, Math.hypot(q.x - r.x, q.y - r.y)] as const)
      .filter(([j]) => ok(j))
      .sort((m1, m2) => m1[1] - m2[1])
      .slice(0, 24);
    if (near.length < 3) return undefined;
    const R0 = near[near.length - 1][1] || 1;
    // Weighted least squares for X = c0 + c1·dx + c2·dy, each coordinate; c0 is the plane at r itself.
    const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const Y = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const [j, dist] of near) {
      const w = Math.exp(-((dist / R0) ** 2) * 2);
      const f = [1, pts[j].x - r.x, pts[j].y - r.y];
      const I = (p.base + j) * 3;
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) M[a * 3 + b] += w * f[a] * f[b];
        for (let d = 0; d < 3; d++) Y[d][a] += w * f[a] * res[I + d];
      }
    }
    const det3 = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    const D = det3(M);
    if (Math.abs(D) < 1e-9) return undefined;
    return [0, 1, 2].map((d) => det3([Y[d][0], M[1], M[2], Y[d][1], M[4], M[5], Y[d][2], M[7], M[8]]) / D) as V3;
  };
  // A pressed lapel lies flat on the front it is turned over: each turned point is laid on the point of the front it
  // covers when folded at the roll line (found in the front's own settled mesh), a cloth's thickness out. Done after
  // the sim, so the lapel can't drag the front about as it would held there during it.
  // A tailored front is interfaced: above the waist it lies smooth over the chest, not crumpled. Its own wrinkles are
  // eased out (each point drawn toward its neighbours' mean, seams held) and kept clear of the body, before the lapel
  // is pressed onto it.
  // (A shirt's front, buttoned but not canvassed, keeps the shape it settled in: smoothed, its collar is drawn in with it.)
  const lapelled = B.panels.some((p) => p.role === 'front' && p.turned.some(Boolean));
  const fsIt = knob('__fsIt') ?? (lapelled ? 30 : 0);
  if (o.pinFront?.length && fsIt > 0) {
    const nb = new Map<number, number[]>();
    for (let e = 0; e < edges.length; e += 2) {
      const [u, v] = [edges[e], edges[e + 1]];
      (nb.get(u) ?? nb.set(u, []).get(u)!).push(v);
      (nb.get(v) ?? nb.set(v, []).get(v)!).push(u);
    }
    const held = new Set<number>();
    for (const { i, j, k } of seams) held.add(i).add(j).add(k);
    for (const c of centre) held.add(c);
    // (Down to the top button: below it the front hangs free, and drawing it in there would open the fronts.)
    const pinY = B.panels
      .filter((p) => p.role === 'front' && !p.hidden)
      .flatMap((p) => p.mesh.pts.flatMap((q, i) => (!p.turned[i] && Math.abs(q.x) < 0.9 && o.pinFront!.some((f) => Math.abs(q.y - f.y) < f.span) ? [res[(p.base + i) * 3 + 1]] : [])));
    const yBot = knob('__fsY') ?? (pinY.length ? pinY.reduce((a, b) => a + b, 0) / pinY.length + (knob('__fsBelow') ?? 1) : -1e9);
    for (const p of B.panels) {
      if (p.role !== 'front' || p.hidden) continue;
      // (A shirt worn open: its edges, the fold its fronts turn back at and its neckline, are held where they hung, or
      // smoothing would draw them in off the opening and widen it.)
      const edge = new Set<number>();
      if (o.rollFront && !knob('__fsEdges')) {
        for (const run of Object.values(p.mesh.runs)) for (const r of run as number[][]) for (const i of r) edge.add(p.base + i);
        p.mesh.pts.forEach((_, i) => {
          if (!p.turned[i] && (nb.get(p.base + i) ?? []).some((n) => n >= p.base && n < p.base + p.mesh.pts.length && p.turned[n - p.base])) edge.add(p.base + i);
        });
      }
      const ids = p.mesh.pts.map((_, i) => p.base + i).filter((g, i) => !p.turned[i] && !held.has(g) && !edge.has(g) && res[g * 3 + 1] < yBot);
      const inP = (g: number) => g >= p.base && g < p.base + p.mesh.pts.length && !p.turned[g - p.base];
      // (The front edge eased along itself only: drawn toward the mean of all its neighbours, all of them on the cloth's
      // side, the edge was drawn in off the opening, the button extension taken in by two thirds between the break and
      // the top button, and the front edge there bowed in toward the centre: Cat saw it as a zigzag between a
      // double-breasted front's buttons, Nov 8.)
      const along = new Set<number>();
      if (!knob('__noFsAlong')) for (const run of p.mesh.runs.opening ?? []) for (const i of run) along.add(p.base + i);
      for (let it = 0; it < fsIt; it++)
        for (const g of ids) {
          const ns = (nb.get(g) ?? []).filter((n) => inP(n) && (!along.has(g) || along.has(n)));
          if (along.has(g) && ns.length === 2) {
            const I = g * 3;
            for (let d = 0; d < 3; d++) res[I + d] += ((res[ns[0] * 3 + d] + res[ns[1] * 3 + d]) / 2 - res[I + d]) * 0.5;
            continue;
          }
          if (ns.length < 3) continue;
          const I = g * 3;
          for (let d = 0; d < 3; d++) {
            const m = ns.reduce((a, n) => a + res[n * 3 + d], 0) / ns.length;
            res[I + d] += (m - res[I + d]) * 0.5;
          }
          const a = Math.atan2(res[I], res[I + 2]);
          const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
          const lo = sp.bodyR(a, res[I + 1]) + thick + 0.3;
          if (rho < lo) {
            res[I] *= lo / rho;
            res[I + 2] *= lo / rho;
          }
        }
      // Below it, the front edge hangs as one straight line (its facing and canvas hold it): eased along itself, not
      // across, so it doesn't ripple and isn't drawn in.
      for (const run of p.mesh.runs.opening ?? []) {
        const ids2 = run.map((i) => p.base + i).filter((g) => res[g * 3 + 1] > yBot);
        for (let it = 0; it < (knob('__feIt') ?? 20); it++)
          for (let k = 1; k + 1 < ids2.length; k++) {
            if (held.has(ids2[k])) continue;
            for (const d of [0, 2]) {
              const I = ids2[k] * 3;
              res[I + d] += ((res[ids2[k - 1] * 3 + d] + res[ids2[k + 1] * 3 + d]) / 2 - res[I + d]) * 0.5;
            }
          }
      }
    }
  }
  // A shirt's placket is interfaced too: the band along its buttoned edge is eased smooth down its length (seams and
  // the centre held), not the rest of the front, so the collar isn't drawn in with it.
  const plBand = knob('__plBand') ?? 4;
  if (o.closedFront && !lapelled && !o.pinFront?.length && plBand > 0) {
    const nb = new Map<number, number[]>();
    for (let e = 0; e < edges.length; e += 2) {
      const [u, v] = [edges[e], edges[e + 1]];
      (nb.get(u) ?? nb.set(u, []).get(u)!).push(v);
      (nb.get(v) ?? nb.set(v, []).get(v)!).push(u);
    }
    const held = new Set<number>();
    for (const { i, j, k } of seams) held.add(i).add(j).add(k);
    for (const p of B.panels) {
      if (p.role !== 'front' || p.hidden || !p.mesh.runs.opening) continue;
      const edge = p.mesh.runs.opening.flat().map((i) => p.mesh.pts[i]);
      const top = Math.min(...edge.map((e) => e.y)) + 2;
      const ids = p.mesh.pts.map((_, i) => p.base + i).filter((g, i) => {
        const q = p.mesh.pts[i];
        return !held.has(g) && q.y > top && edge.some((e) => Math.hypot(e.x - q.x, e.y - q.y) < plBand);
      });
      const inP = (g: number) => g >= p.base && g < p.base + p.mesh.pts.length;
      // (The edge itself is eased along itself only, so it stays where it is across.)
      const onEdge = new Set(p.mesh.runs.opening.flat().map((i) => p.base + i));
      for (let it = 0; it < (knob('__plIt') ?? 40); it++)
        for (const g of ids) {
          const ns = (nb.get(g) ?? []).filter((n) => inP(n) && (!onEdge.has(g) || onEdge.has(n)));
          if (ns.length < 2) continue;
          const I = g * 3;
          for (let d = 0; d < 3; d++) res[I + d] += (ns.reduce((a, n) => a + res[n * 3 + d], 0) / ns.length - res[I + d]) * 0.5;
          const a = Math.atan2(res[I], res[I + 2]);
          const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
          const lo = sp.bodyR(a, res[I + 1]) + thick + 0.3;
          if (rho < lo) {
            res[I] *= lo / rho;
            res[I + 2] *= lo / rho;
          }
        }
    }
  }
  // A buttoned front's extension lies over the other front: each point of it on the cloth of the other front it
  // covers (its mirror, as far the other side of the centre line as it is cut past it), a cloth's thickness out. Settled
  // on its own, it curled forward off the other front by a cm and more or was drawn in under the centre line, and the
  // front edge between the break and the top button bowed in or stood out: Cat saw it as a zigzag between a
  // double-breasted front's buttons, Nov 8. (Below the break, coming in over 2 cm there.)
  // (A jacket or coat's only: on a shirt worn open with one button done up, its turned neck counted as a lapel and the
  // front laid over the other stretched it at the button.)
  if (o.pinFront?.length && o.layExtension && !knob('__noFairFront')) fairFrontCentre(B.panels, res);
  if (o.pinFront?.length && o.layExtension && !knob('__noLayExt')) {
    // (Three times over: a point of the extension next to the centre line is laid on cloth whose triangles it shares.)
    for (let pass = 0; pass < 3; pass++) for (const p of B.panels) {
      if (p.role !== 'front' || p.hidden) continue;
      const pts = p.mesh.pts;
      const lapelY = pts.reduce((m, q, i) => (p.turned[i] ? Math.max(m, q.y) : m), -Infinity);
      // (A lapelled front only: on one buttoned to the neck, a stand or funnel collar's, laid so its front folded into
      // a fin at the centre and its collar was drawn long; checked over every jacket and coat option.)
      if (lapelY === -Infinity) continue;
      // (A double-breasted front's laid right up to the break, coming in over the 2 cm above it: eased in only below it,
      // its front edge leaned out at the top button, Cat Nov 10. A single-breasted one's narrow extension is not.)
      const wide = (p.folds?.[0]?.[0].x ?? 0) < -4;
      const from = lapelY - (wide ? 2 : 0);
      const moves: [number, V3][] = [];
      pts.forEach((q, i) => {
        if (p.turned[i] || q.x >= 0) return;
        const b = Math.min(1, Math.max(0, (q.y - from) / 2));
        const c = Math.min(1, -q.x);
        const w = b * b * (3 - 2 * b);
        if (!w) return;
        const u = surfaceAt(p, { x: -q.x, y: q.y }, false);
        if (!u) return;
        const rho = Math.hypot(u[0], u[2]) || 1e-9;
        const k = (rho + (p.thick[i] + 0.1) * c * c * (3 - 2 * c)) / rho;
        const I = (p.base + i) * 3;
        const t: V3 = [-u[0] * k, u[1], u[2] * k];
        moves.push([I, [res[I] + (t[0] - res[I]) * w, res[I + 1] + (t[1] - res[I + 1]) * w, res[I + 2] + (t[2] - res[I + 2]) * w]]);
      });
      for (const [I, v] of moves) for (let d = 0; d < 3; d++) res[I + d] = v[d];
    }
  }
  if (o.pinFront?.length && !knob('__noPress')) {
    for (const p of B.panels) {
      const fold = p.folds?.[0];
      if (p.role !== 'front' || !fold || !p.turned.some(Boolean)) continue;
      const pts = p.mesh.pts;
      const at = (r: P) => surfaceAt(p, r, false);
      pts.forEach((q, i) => {
        if (!p.turned[i]) return;
        const u = at(reflect(q, fold[0], fold[1]));
        if (!u) return;
        const rho = Math.hypot(u[0], u[2]) || 1e-9;
        const k = (rho + 0.6) / rho;
        const I = (p.base + i) * 3;
        res[I] = u[0] * k;
        res[I + 1] = u[1];
        res[I + 2] = u[2] * k;
      });
    }
  }
  // The passes above move each piece on its own; its seams are closed again after them (each side meets the other
  // halfway), so no gap shows at a shoulder.
  if (o.pinFront?.length) {
    const roleOf = new Map<number, string>();
    for (const p of B.panels) for (let i = 0; i < p.mesh.pts.length; i++) roleOf.set(p.base + i, p.role);
    // (A raglan sleeve runs up to the neck as part of the body's yoke: its seams to the front and back close too, or the
    // front's neckline, drawn in to the neck, leaves the sleeve's top standing 2 to 3 cm off it.)
    const raglan = new Set<number>();
    if (!knob('__noRaglanClose')) for (const p of B.panels) if (p.role === 'sleeve' && !p.hidden && /raglan/i.test(p.pc.name)) for (let i = 0; i < p.mesh.pts.length; i++) raglan.add(p.base + i);
    const body = (g: number) => roleOf.get(g) === 'front' || roleOf.get(g) === 'back' || raglan.has(g);
    for (let it = 0; it < 4; it++)
      for (const { i, j, k, t } of seams) {
        // A collar end sewn to a pressed lapel (a shawl's) follows the lapel; the body never follows the collar.
        if (!body(j) || !body(k) || !(body(i) || (roleOf.get(i) === 'collar' && !knob('__noCollarFollow')))) continue;
        for (let d = 0; d < 3; d++) {
          const target = res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t;
          res[i * 3 + d] += (target - res[i * 3 + d]) * 0.5;
        }
      }
  }
  // A buttoned jacket's roll line is taped and its lapels pressed (rollLine.ts), before its collar is laid on.
  if (o.pinFront?.length && !o.rollFront && !knob('__noBridle')) tapeRollLines(B.panels, res, sp);
  // Stiff cloth stands away from the body below the underarm (structured.ts): after the roll line is taped, which
  // otherwise carries the front edge back out below the break, where the two mirrored edges then crossed round the top
  // button in an eye shape (Cat, 2026-11-07).
  if ((o.stiff && !knob('__noStiff')) || knob('__stiff')) {
    standStiff(B.panels, res, seams, undefined, !!o.boxCut);
  }
  // A jacket's or coat's collar fall is pressed down onto the back it turns over (its stand alone can't hold it
  // there in the sim), so no gap opens between the collar and the back neck.
  const collarOnly = !knob("__lay") && !!o.pinFront?.length && !o.rollFront;
  if (knob("__lay") || collarOnly) {
    const NA = 90;
    const key = (a: number, c: number) => Math.round(((a + Math.PI) / TAU) * NA) * 1000 + Math.round(c * 2);
    const under = new Map<number, number>();
    for (const p of B.panels) {
      if (p.role === 'sleeve' || p.role === 'collar' || p.hidden) continue;
      p.mesh.pts.forEach((_, i) => {
        if (p.turned[i]) return;
        const I = (p.base + i) * 3;
        const k = key(Math.atan2(res[I], res[I + 2]), res[I + 1]);
        under.set(k, Math.max(under.get(k) ?? 0, Math.hypot(res[I], res[I + 2])));
      });
    }
    const gap = knob("__layGap") ?? 0.5;
    // A tailored collar's fall turns down over its stand at the roll line and lies on down over the back and shoulders
    // past it: each turned point goes to the stand point it covers, then on down the garment by however much further
    // out it is cut than the stand.
    const laidFall = new Set<number>();
    if (collarOnly && !knob("__oldFall"))
      for (const p of B.panels) {
        const fold = p.folds?.[0];
        if (p.role !== 'collar' || !fold || p.hidden) continue;
        const pts = p.mesh.pts;
        const moved: [number, V3][] = [];
        const x0 = Math.min(...pts.map((q) => q.x));
        // The seam it is sewn on by: the neck edge running on along the gorge (as one line, the way it is sewn).
        const neckRuns = (p.mesh.runs.neck ?? []).filter((run) => run.length > 1).map((run) => [...run]);
        if (!neckRuns.length) continue;
        for (const g of p.mesh.runs.gorge ?? []) {
          const run = neckRuns[neckRuns.length - 1];
          const end = pts[run[run.length - 1]];
          const d0 = Math.hypot(pts[g[0]].x - end.x, pts[g[0]].y - end.y);
          const d1 = Math.hypot(pts[g[g.length - 1]].x - end.x, pts[g[g.length - 1]].y - end.y);
          const gg = d1 < d0 ? [...g].reverse() : g;
          run.push(...gg.slice(gg[0] === run[run.length - 1] ? 1 : 0));
        }
        const onSeamPt = new Set(neckRuns.flat());
        // That seam first goes back onto what it is sewn to, as the lapels were pressed and the neckline drawn in after
        // the cloth settled.
        const lo3 = p.base;
        const hi3 = p.base + pts.length;
        const snapped = new Map<number, V3>();
        for (const { i, j, k, t } of seams) {
          if (i < lo3 || i >= hi3 || !onSeamPt.has(i - lo3) || (j >= lo3 && j < hi3)) continue;
          snapped.set(i - lo3, [0, 1, 2].map((d) => res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t) as V3);
        }
        // Where each seam point is sewn, in the pattern of the piece it is sewn to.
        const owner = (g: number) => B.panels.find((q) => g >= q.base && g < q.base + q.mesh.pts.length);
        const partner = new Map<number, { panel: Panel; at: P; turned: number }>();
        for (const { i, j, k, t } of seams) {
          if (i < lo3 || i >= hi3 || !onSeamPt.has(i - lo3) || (j >= lo3 && j < hi3)) continue;
          const pj = owner(j);
          if (!pj || owner(k) !== pj) continue;
          const A = pj.mesh.pts[j - pj.base];
          const Bq = pj.mesh.pts[k - pj.base];
          partner.set(i - lo3, { panel: pj, at: { x: A.x + (Bq.x - A.x) * t, y: A.y + (Bq.y - A.y) * t }, turned: pj.turned[j - pj.base] && pj.turned[k - pj.base] ? 1 : 0 });
        }
        for (const [i, v] of snapped) {
          const I = (p.base + i) * 3;
          res[I] = v[0];
          res[I + 1] = v[1];
          res[I + 2] = v[2];
          // (A seam point sewn to a turned lapel stays on it: not pushed out off the lapel with the fall below.)
          if (!knob('__pushSeam')) laidFall.add(p.base + i);
        }
        const at3 = (j: number): V3 => {
          const I = (p.base + j) * 3;
          return [res[I], res[I + 1], res[I + 2]];
        };
        const sub = (u: V3, v: V3): V3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
        const nrm = (u: V3): V3 => {
          const l = Math.hypot(u[0], u[1], u[2]) || 1e-9;
          return [u[0] / l, u[1] / l, u[2] / l];
        };
        const cross = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const radial = (u: V3): V3 => nrm([u[0], 0, u[2]]);
        // The seam's own "up the neck" at each of its points: square to the seam, along the garment's surface.
        const ups = neckRuns.map((run) =>
          run.map((j, k) => {
            const T = nrm(sub(at3(run[Math.min(run.length - 1, k + 1)]), at3(run[Math.max(0, k - 1)])));
            return nrm(cross(T, radial(at3(j))));
          }),
        );
        // (One way round for the whole collar: the way that rises at its centre back.)
        let cbUp = 0;
        let cbX = Infinity;
        neckRuns.forEach((run, r) => run.forEach((j, k) => pts[j].x < cbX && ((cbX = pts[j].x), (cbUp = ups[r][k][1]))));
        const sg = cbUp > 0 ? -1 : 1;
        // (Which side of the seam the collar itself lies: where its stand is.)
        let collarSide = 1;
        const onSeam = (r2: P) => {
          let bd = Infinity;
          let P0: V3 = [0, 0, 0];
          let U: V3 = [0, -1, 0];
          let side = 1;
          let seg: [number, number, number, number] = [0, 0, 0, 0];
          neckRuns.forEach((run, ri) => {
            for (let k = 0; k + 1 < run.length; k++) {
              const A = pts[run[k]];
              const Bq = pts[run[k + 1]];
              const dx = Bq.x - A.x;
              const dy = Bq.y - A.y;
              // (Carried straight on past the seam's two ends, so the collar's ends rise square from it, not fanned.)
              const t0 = ((r2.x - A.x) * dx + (r2.y - A.y) * dy) / (dx * dx + dy * dy || 1);
              const t = Math.min(k + 2 === run.length ? Infinity : 1, Math.max(k === 0 ? -Infinity : 0, t0));
              const dd = Math.hypot(A.x + dx * t - r2.x, A.y + dy * t - r2.y);
              if (dd < bd) {
                bd = dd;
                side = dx * (r2.y - A.y) - dy * (r2.x - A.x) >= 0 ? 1 : -1;
                seg = [ri, k, t, 0];
                const a3 = at3(run[k]);
                const b3 = at3(run[k + 1]);
                P0 = [0, 1, 2].map((d) => a3[d] * (1 - t) + b3[d] * t) as V3;
                const ua = ups[ri][k];
                const ub = ups[ri][k + 1];
                U = nrm([0, 1, 2].map((d) => sg * (ua[d] * (1 - t) + ub[d] * t)) as V3);
              }
            }
          });
          return { h: bd * side * collarSide, P0, U, seg };
        };
        {
          const st = pts.map((_, j) => j).filter((j) => !p.turned[j] && !onSeamPt.has(j));
          const cx = st.reduce((a2, j) => a2 + pts[j].x, 0) / (st.length || 1);
          const cy = st.reduce((a2, j) => a2 + pts[j].y, 0) / (st.length || 1);
          collarSide = onSeam({ x: cx, y: cy }).h >= 0 ? 1 : -1;
        }
        // Where a point past the seam lies on the piece the collar is sewn to: as far in from that piece's edge.
        const onBody = (seg: [number, number, number, number], h: number): V3 | undefined => {
          const [ri, k, t] = seg;
          const run = neckRuns[ri];
          const a2 = partner.get(run[k]);
          const b2 = partner.get(run[k + 1]);
          const pa = a2 && b2 && a2.panel === b2.panel ? a2 : t < 0.5 ? (a2 ?? b2) : (b2 ?? a2);
          if (!pa) return undefined;
          const pc2 = pa.panel;
          // The piece's edge there, and which way is in.
          let ex = 0;
          let ey = 0;
          let Q = pa.at;
          if (a2 && b2 && a2.panel === b2.panel) {
            ex = b2.at.x - a2.at.x;
            ey = b2.at.y - a2.at.y;
            Q = { x: a2.at.x + ex * t, y: a2.at.y + ey * t };
          } else {
            const nb = [run[k - 1], run[k + 2], run[k], run[k + 1]].map((j) => (j === undefined ? undefined : partner.get(j))).filter((x2) => x2 && x2.panel === pc2 && x2 !== pa)[0];
            if (nb) {
              ex = nb.at.x - pa.at.x;
              ey = nb.at.y - pa.at.y;
            }
          }
          const el = Math.hypot(ex, ey) || 1;
          let nx = -ey / el;
          let ny = ex / el;
          const cxp = pc2.mesh.pts.reduce((a3, q) => a3 + q.x, 0) / pc2.mesh.pts.length;
          const cyp = pc2.mesh.pts.reduce((a3, q) => a3 + q.y, 0) / pc2.mesh.pts.length;
          if ((cxp - Q.x) * nx + (cyp - Q.y) * ny < 0) {
            nx = -nx;
            ny = -ny;
          }
          return surfaceAt(pc2, { x: Q.x + nx * h, y: Q.y + ny * h }, true);
        };
        // The stand rises from the seam leaning a little in to the neck (never into it).
        const standAt = (r2: P, extraH = 0): { X: V3; U: V3; N: V3 } => {
          const { h, P0, U } = onSeam(r2);
          const N = radial(P0);
          const H = Math.max(0, h) + extraH;
          let X: V3 = [P0[0] + H * (U[0] - 0.2 * N[0]), P0[1] + H * U[1], P0[2] + H * (U[2] - 0.2 * N[2])];
          const a = Math.atan2(X[0], X[2]);
          const rho = Math.hypot(X[0], X[2]) || 1e-9;
          const lo = sp.bodyR(a, X[1]) + thick + 0.2;
          if (rho < lo) X = [X[0] * (lo / rho), X[1], X[2] * (lo / rho)];
          return { X, U, N };
        };
        const onFront = p.pc.meta.onFront as CollarOnFront | undefined;
        const lapelFront = B.panels.find((pp) => pp.role === 'front' && !pp.hidden && pp.turned.some(Boolean));
        const ff = p.pc.meta.fromFront as { E: P; tE: P; up: P; Q: P; d1: P; nF: P; hpsX: number } | undefined;
        const frontP = B.panels.find((f) => f.role === 'front' && !f.hidden && f.folds?.length && f.pc.meta.gorge);
        // (Not where a high lapel's long collar end is laid by collarEnd.ts below: that lay wins.)
        const wornLay = !knob('__noWornLay') && !!ff && !!frontP && !onFront;
        const wornOf = (q: P): { X: V3; w: number } | undefined => {
          if (!ff || !frontP) return undefined;
          const t = (q.x - ff.hpsX) / (ff.E.x - ff.hpsX || 1);
          const s0 = Math.max(0, Math.min(1, (t - (knob('__wornFrom') ?? 0.1)) / (knob('__wornSpan') ?? 0.5)));
          if (s0 <= 0) return undefined;
          const v = { x: q.x - ff.E.x, y: q.y - ff.E.y };
          const a = v.x * ff.tE.x + v.y * ff.tE.y;
          const b = v.x * ff.up.x + v.y * ff.up.y;
          const f = { x: ff.Q.x + ff.d1.x * a + ff.nF.x * b, y: ff.Q.y + ff.d1.y * a + ff.nF.y * b };
          const [ra, rb] = frontP.folds![0];
          // (Only what the pattern puts past the lapel's roll line, on the lapel: what falls short of it stands.)
          const sideOf = (r: P) => Math.sign((rb.x - ra.x) * (r.y - ra.y) - (rb.y - ra.y) * (r.x - ra.x));
          const ti = frontP.turned.findIndex(Boolean);
          if (ti < 0 || sideOf(f) !== sideOf(frontP.mesh.pts[ti])) return undefined;
          const X = surfaceAt(frontP, reflect(f, ra, rb), false);
          return X && { X, w: s0 * s0 * (3 - 2 * s0) };
        };
        pts.forEach((q, i) => {
          if (onSeamPt.has(i)) return;
          let X: V3;
          // Where it is sewn to a lapel (its gorge, the turned top of the front) the collar's end lies flat on with the
          // lapel, carried on from it; round the neck its stand rises. (Blended between the two along the seam.)
          const flatW = (seg: [number, number, number, number]) => {
            const run = neckRuns[seg[0]];
            const ta = partner.get(run[seg[1]])?.turned ?? 0;
            const tb = partner.get(run[seg[1] + 1])?.turned ?? 0;
            const tt = Math.max(0, Math.min(1, seg[2]));
            return ta * (1 - tt) + tb * tt;
          };
          const out = (v: V3, by: number): V3 => {
            const N = radial(v);
            return [v[0] + N[0] * by, v[1], v[2] + N[2] * by];
          };
          // (Lying flat on with the lapel: carried straight on across the seam in the cloth's own surface there, square
          // to the seam, as far as it is cut from it; not fitted to the lapel's settled shape, whose creases would twist it.)
          const flatOn = (s: { h: number; P0: V3; U: V3 }): V3 => [s.P0[0] + s.h * s.U[0], s.P0[1] + s.h * s.U[1], s.P0[2] + s.h * s.U[2]];
          const mix = (u: V3, v: V3 | undefined, w: number): V3 => (v && w > 0 ? [0, 1, 2].map((d) => u[d] * (1 - w) + v[d] * w) as V3 : u);
          if (!p.turned[i]) {
            const at0 = onSeam(q);
            const w = flatW(at0.seg);
            const flatV = w > 0 ? (knob('__oldEnds') ? onBody(at0.seg, -at0.h) : flatOn(at0)) : undefined;
            X = mix(standAt(q).X, flatV && out(flatV, 0.15), w);
            // (So does the stand, where the pattern puts it past the lapel's roll line: lying on the lapel with the fall.)
            const wl = wornLay ? wornOf(q) : undefined;
            if (wl) X = mix(X, out(wl.X, thick + 0.15), wl.w);
          } else {
            // Turned: laid over whatever its mirror at the roll line would be, the stand or (cut wider than the stand)
            // the piece below the seam, a cloth's thickness out.
            const r = reflectRoll(q, fold, p.folds?.[1]);
            const at0 = onSeam(r);
            const body = at0.h < 0 ? onBody(at0.seg, -at0.h) : undefined;
            const U0 = body ?? standAt(r).X;
            const w = flatW(at0.seg);
            const flatV = w > 0 ? (knob('__oldEnds') ? onBody(at0.seg, -at0.h) : flatOn(at0)) : undefined;
            X = mix(out(U0, thick + gap), flatV && out(flatV, 0.15 + thick + gap), w);
            // (Toward its front end the fall lies where the pattern puts it, on the lapel as worn: carried back onto the
            // front the way the collar was drafted from it, and turned over the lapel's roll line with it, so the collar
            // point lands on the draft's own. Laid from the sim's settling, it stood up beside the neck in a point.)
            const wl = wornLay ? wornOf(q) : undefined;
            if (wl) X = mix(X, out(wl.X, 2 * thick + gap), wl.w);
          }
          // A high lapel's long collar end lies where it falls when worn, over the lapel and on onto the chest (see
          // collarEnd.ts), two cloths' thickness out; its stand still rises round the neck.
          if (onFront && lapelFront && (p.turned[i] || q.x > onFront.neckC[onFront.neckC.length - 1].x - 1)) {
            const { at, w } = collarOnFront(q, onFront);
            const on = w > 0 ? surfaceAt(lapelFront, at, false) : undefined;
            if (on) X = mix(X, out(on, 2 * thick + gap), w);
          }
          // (Its centre back edge stays on the centre plane, closed against its mirror.)
          if (q.x - x0 < 0.3) X = [0, X[1], -Math.hypot(X[0], X[2])];
          moved.push([i, X]);
        });
        for (const [i, v] of moved) {
          const I = (p.base + i) * 3;
          res[I] = v[0];
          res[I + 1] = v[1];
          res[I + 2] = v[2];
          laidFall.add(p.base + i);
        }
        // (Placed point by point from the nearest stretch of its neck seam, the collar's end is torn where the nearest
        // stretch changes, from the neck's to the gorge's: one point stands up the neck, its neighbour lies flat on the
        // lapel, 4 to 5 cm apart. Eased back to its cut lengths from the seam, so the end rolls from the one into the
        // other, All round quality 2026-11-04. Every plain jacket and coat read as stretched there before.)
        if (!knob('__noCollarEase')) relax(p, [...onSeamPt]);
        // (Laid from the pattern, a fall can come to lie inside the form as it is drawn, whose shoulders stand out past
        // the sim's body: put out onto it now, before it is eased to its cut lengths, not pushed out after.)
        if (wornLay) {
          const cTop = sp.cOf(-1.45) + 2;
          const slope = (sp.yOf(cTop + 4) - sp.yOf(cTop)) / 4;
          for (const [i] of moved) {
            const I = (p.base + i) * 3;
            const yD = Math.max(BODY_TOP, Math.min(BODY_BOTTOM, res[I + 1] < cTop ? sp.yOf(cTop) + (res[I + 1] - cTop) * slope : sp.yOf(res[I + 1])));
            const drawn = bodyHalf(yD) * shapeAt(Math.abs(Math.atan2(res[I], res[I + 2])), yD) * sp.scale(yD) + thick;
            const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
            if (rho < drawn) {
              res[I] *= drawn / rho;
              res[I + 2] *= drawn / rho;
            }
            const v = ontoBody([res[I], res[I + 1], res[I + 2]], thick);
            res[I] = v[0];
            res[I + 1] = v[1];
            res[I + 2] = v[2];
          }
        }
        if (wornLay && !knob('__noCollarEase')) relax(p, [...onSeamPt]);
        // The fall smoothed where it lies: laid point by point from the nearest stretch of the roll and the neck, it
        // folded over itself in creases where the neck curves round the side to the shoulder, and read as crumpled
        // there from behind the shoulder (Cat, Nov 8). Each turned point drawn toward its neighbours, its edge only
        // along itself, the roll line and the back of the neck held (smoothed there, its centre back edge lifted in a nick); kept out on whatever it lies over.
        // (Not a crisp cloth's, pressed flat after: smoothed first, the pressing left a waistcoat's fall jagged.)
        const fsN = knob('__fallSmooth') ?? 12;
        if (fsN > 0 && !o.stiff) {
          const nbr = new Map<number, Set<number>>();
          const cnt = new Map<string, number>();
          for (const [a, b, c] of p.mesh.tris)
            for (const [u, v] of [[a, b], [b, c], [c, a]]) {
              (nbr.get(u) ?? nbr.set(u, new Set()).get(u)!).add(v);
              (nbr.get(v) ?? nbr.set(v, new Set()).get(v)!).add(u);
              const k = u < v ? `${u},${v}` : `${v},${u}`;
              cnt.set(k, (cnt.get(k) ?? 0) + 1);
            }
          const rim = (u: number, v: number) => cnt.get(u < v ? `${u},${v}` : `${v},${u}`) === 1;
          const free = pts.map((_, j) => j).filter((j) => p.turned[j] && !onSeamPt.has(j) && pts[j].x - x0 >= (knob("__fallFromCb") ?? 4) && [...(nbr.get(j) ?? [])].every((n) => p.turned[n]));
          const before = new Map(free.map((j) => [j, Math.hypot(res[(p.base + j) * 3], res[(p.base + j) * 3 + 2])]));
          for (let it = 0; it < fsN; it++)
            for (const j of free) {
              const all = [...(nbr.get(j) ?? [])];
              const onRim = all.some((n) => rim(j, n));
              const ns = onRim ? all.filter((n) => rim(j, n)) : all;
              if (ns.length < 2) continue;
              const I = (p.base + j) * 3;
              for (let d = 0; d < 3; d++) {
                const m = ns.reduce((a2, n) => a2 + res[(p.base + n) * 3 + d], 0) / ns.length;
                res[I + d] += (m - res[I + d]) * 0.5;
              }
              const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
              const lo = before.get(j)! - 0.3;
              if (rho < lo) {
                res[I] *= lo / rho;
                res[I + 2] *= lo / rho;
              }
            }
          // (Smoothed, an edge across a crease could come out long: eased back to its cut length.)
          if (!knob('__noCollarEase')) relax(p, [...onSeamPt]);
        }
      }
    for (const p of B.panels) {
      if (p.role === 'sleeve' || p.hidden || (collarOnly && p.role !== 'collar')) continue;
      p.mesh.pts.forEach((_, i) => {
        if (!p.turned[i] || laidFall.has(p.base + i)) return;
        const I = (p.base + i) * 3;
        const a = Math.atan2(res[I], res[I + 2]);
        let R = 0;
        for (const da of [-1, 0, 1]) for (const dc of [-1, 0, 1]) R = Math.max(R, under.get(key(a + (da * TAU) / NA, res[I + 1] + dc * 0.5)) ?? 0);
        if (!R) return;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const k = (R + gap) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      });
    }
  }
  // A stiff jacket's collar, or a low-rolled one, is pressed flat and crisp (structured.ts).
  if (collarOnly && (o.stiff || B.panels.some((p) => p.role === 'collar' && p.pc.meta.pressed)) && !knob('__noPressCollar')) pressCollar(B.panels, res, relax, !!o.stiff);
  // A shirt collar on a stand: the sim leaves its fall standing up round the neck like a second band. Worn, the fall
  // turns at its roll line and lies down over the stand, its points out onto the chest: each turned point goes from
  // the roll line it folds at down the outside of whatever is under it (the stand, then the shirt), by as far as it is
  // cut past the roll, a cloth's thickness out.
  const shirtFalls = (extra.collars ?? []).filter((c) => c.onStand && c.roll).map((c) => c.pc);
  if (shirtFalls.length && !collarOnly && !knob('__noShirtFall')) {
    const NA = 120;
    const bin = (a: number, c: number) => Math.round(((a + Math.PI) / TAU) * NA) * 1000 + Math.round(c * 2);
    const under = new Map<number, number>();
    for (const p of B.panels) {
      if (p.role === 'sleeve' || p.hidden || shirtFalls.includes(p.pc)) continue;
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        const k = bin(Math.atan2(res[I], res[I + 2]), res[I + 1]);
        under.set(k, Math.max(under.get(k) ?? 0, Math.hypot(res[I], res[I + 2])));
      });
    }
    const gap = knob('__sfGap') ?? 0.35;
    const coverR = (a: number, c: number) => {
      let R = sp.bodyR(a, c) + thick;
      for (const da of [-1, 0, 1]) for (const dc of [-1, 0, 1]) R = Math.max(R, under.get(bin(a + (da * TAU) / NA, c + dc * 0.5)) ?? 0);
      return R + thick + gap;
    };
    const spread = knob('__sfSpread') ?? 0.35;
    for (const p of B.panels) {
      if (p.hidden || !shirtFalls.includes(p.pc)) continue;
      const fold = p.folds?.[0];
      if (!fold) continue;
      const pts = p.mesh.pts;
      const fx = fold[1].x - fold[0].x;
      const fy = fold[1].y - fold[0].y;
      const fl = Math.hypot(fx, fy) || 1;
      const x0 = Math.min(...pts.map((q) => q.x));
      const xEnd = Math.max(...pts.map((q) => q.x));
      // The roll line in 3D: where the cloth lies at the foot of each turned point on it, from the unturned points
      // nearest that foot (weighted by how near).
      const along = (q: P) => ((q.x - fold[0].x) * fx + (q.y - fold[0].y) * fy) / fl;
      const off = (q: P) => Math.abs((q.x - fold[0].x) * fy - (q.y - fold[0].y) * fx) / fl;
      const flat = pts.map((q, i) => ({ q, i })).filter((e) => !p.turned[e.i]);
      if (flat.length < 3) continue;
      const P3 = (i: number): V3 => [res[(p.base + i) * 3], res[(p.base + i) * 3 + 1], res[(p.base + i) * 3 + 2]];
      const rollAt = (s: number): V3 => {
        const f = { x: fold[0].x + (fx / fl) * s, y: fold[0].y + (fy / fl) * s };
        const near = flat.map((e) => ({ e, d: Math.hypot(e.q.x - f.x, e.q.y - f.y) })).sort((u, v) => u.d - v.d).slice(0, 5);
        let w = 0;
        const X: V3 = [0, 0, 0];
        for (const { e, d } of near) {
          const k = 1 / (d + 0.3);
          const v = P3(e.i);
          for (let c = 0; c < 3; c++) X[c] += v[c] * k;
          w += k;
        }
        return [X[0] / w, X[1] / w, X[2] / w];
      };
      const moved: [number, V3][] = [];
      // Pressed: the fall is a stiff, interfaced piece. Its fold is one smooth line round the neck (the roll line where
      // it settled, eased smooth and mirrored at the centre back), and from it each point goes straight out and down
      // at one fixed angle by its cut distance past the fold: flat, straight-edged, its points lying on the chest.
      if (!knob('__oldShirtFall')) {
        // (Measured from the seam it is sewn to the stand by, along its curve: the fold a set height above it.)
        const seamIds = [...new Set((p.mesh.runs.stand ?? []).flat())].sort((u, v) => along(pts[u]) - along(pts[v]));
        const fGap = knob('__sfFold') ?? 0.6;
        const nearSeam = (q: P): { s: number; d: number } => {
          let best = { s: along(q), d: Infinity };
          for (let k = 0; k + 1 < seamIds.length; k++) {
            const [u, v] = [pts[seamIds[k]], pts[seamIds[k + 1]]];
            const L2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1e-9;
            const t = Math.max(0, Math.min(1, ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / L2));
            const f = { x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t };
            const d = Math.hypot(q.x - f.x, q.y - f.y);
            if (d < best.d) best = { s: along(f), d };
          }
          return best;
        };
        const curvedSeam = seamIds.length > 2;
        const seamAt = (s: number): V3 => {
          const ss = seamIds.map((j) => along(pts[j]));
          let k = 0;
          while (k + 2 < ss.length && ss[k + 1] < s) k++;
          const t = Math.max(0, Math.min(1, (s - ss[k]) / (ss[k + 1] - ss[k] || 1)));
          const A = P3(seamIds[k]);
          const B = P3(seamIds[k + 1]);
          return [A[0] * (1 - t) + B[0] * t, A[1] * (1 - t) + B[1] * t - fGap, A[2] * (1 - t) + B[2] * t];
        };
        const sMin = Math.min(...pts.map(along));
        const sMax = Math.max(...pts.map(along));
        const st = 0.5;
        const S: number[] = [];
        for (let s = sMin; s <= sMax + 1e-6; s += st) S.push(s);
        const ring = S.map((s) => (curvedSeam ? seamAt(s) : rollAt(s)));
        // (Which end is the centre back: the end nearer the centre plane.)
        const cbFirst = Math.abs(ring[0][0]) <= Math.abs(ring[ring.length - 1][0]);
        if (!cbFirst) ring.reverse();
        for (let it = 0; it < (knob('__sfRingIt') ?? 30); it++) {
          const old = ring.map((v) => [...v] as V3);
          for (let k = 0; k + 1 < ring.length; k++) {
            const lo = k === 0 ? 1 : k - 1;
            for (const d of [1, 2]) ring[k][d] = (old[lo][d] + 2 * old[k][d] + old[k + 1][d]) / 4;
            ring[k][0] = k === 0 ? 0 : (old[k - 1][0] + 2 * old[k][0] + old[k + 1][0]) / 4;
          }
          // (The far end carried on straight, so the collar's point isn't bent.)
          const n = ring.length - 1;
          if (n >= 2) for (let d = 0; d < 3; d++) ring[n][d] = 2 * ring[n - 1][d] - ring[n - 2][d];
        }
        if (!cbFirst) ring.reverse();
        const ringAtS = (s: number): V3 => {
          const u = Math.max(0, Math.min(ring.length - 1, (s - sMin) / st));
          const k = Math.min(ring.length - 2, Math.floor(u));
          const t = u - k;
          return [0, 1, 2].map((d) => ring[k][d] * (1 - t) + ring[k + 1][d] * t) as V3;
        };
        const T = thick * 2 + gap;
        // The angle it falls at, round the neck: as steep as it can lie without going into what is under it (the
        // stand, then the shoulders and chest), so it rests on them as a straight, flat plane from the fold down.
        // (Eased round the neck, mirrored at the centre back.)
        const hMax = Math.max(1, ...pts.map((q, i) => (p.turned[i] ? (curvedSeam ? nearSeam(q).d - fGap : off(q)) : 0)));
        const phiMin = (knob('__sfAngMin') ?? 22) * (Math.PI / 180);
        // (Only as deep as the fall is cut there: its points reach further down than its back.)
        const depth = S.map(() => 0);
        pts.forEach((q, i) => {
          if (!p.turned[i]) return;
          const n = curvedSeam ? nearSeam(q) : { s: along(q), d: off(q) + fGap };
          const k = Math.max(0, Math.min(S.length - 1, Math.round((n.s - sMin) / st)));
          depth[k] = Math.max(depth[k], n.d - fGap);
        });
        for (let k = 1; k < depth.length; k++) if (!depth[k]) depth[k] = depth[k - 1];
        // (Worn, a shirt's fall laps only just past its stand: drawn a little shallower than cut, the same amount
        // all round, so it hugs the neck at the back and its points lie in on the chest.)
        const shorter = knob('__sfShort') ?? (p.pc.meta.longPoint ? 0.3 : 1);
        // (Not at the points: they keep their full cut length, lying out on the chest.)
        const backness = ring.map((F) => Math.min(1, Math.max(0, 0.5 - F[2] / (Math.hypot(F[0], F[2]) || 1))));
        const fallH = (h: number, k: number) => Math.max(0, h - shorter * backness[k] * Math.min(1, h / Math.max(1, depth[k])));
        for (let k = 0; k < depth.length; k++) depth[k] = fallH(depth[k], k);
        const phis = ring.map((F, kk) => {
          const rho = Math.hypot(F[0], F[2]) || 1e-9;
          const a = Math.atan2(F[0], F[2]);
          let ph = phiMin;
          for (let y = 0.5; y <= Math.min(hMax, Math.max(1, depth[kk])) + 1e-6; y += 0.25) {
            const need = coverR(a, F[1] + y) - rho - T;
            if (need > 0) ph = Math.max(ph, Math.atan2(need, y));
          }
          return ph;
        });
        // (Never eased below what that spot needs; a little extra round it instead.)
        const raw = [...phis];
        for (let it = 0; it < (knob('__sfAngIt') ?? 10); it++) {
          const old = [...phis];
          const cb = cbFirst ? 0 : phis.length - 1;
          for (let k = 0; k < phis.length; k++) {
            const lo = k === 0 ? (cb === 0 ? 1 : 0) : k - 1;
            const hi = k === phis.length - 1 ? (cb === k ? k - 1 : k) : k + 1;
            phis[k] = Math.max(raw[k], (old[lo] + 2 * old[k] + old[hi]) / 4);
          }
        }
        const phiAt = (s: number) => {
          const u = Math.max(0, Math.min(phis.length - 1, (s - sMin) / st));
          const k = Math.min(phis.length - 2, Math.floor(u));
          return phis[k] * (1 - (u - k)) + phis[k + 1] * (u - k);
        };
        pts.forEach((q, i) => {
          if (!p.turned[i]) return;
          const ns = curvedSeam ? nearSeam(q) : undefined;
          const sq = ns ? ns.s : along(q);
          const F = ringAtS(sq);
          const phi = knob('__sfAng') !== undefined ? knob('__sfAng')! * (Math.PI / 180) : phiAt(sq);
          const kS = Math.max(0, Math.min(S.length - 1, Math.round((sq - sMin) / st)));
          const h = fallH(ns ? Math.max(0, ns.d - fGap) : off(q), kS);
          const rho = Math.hypot(F[0], F[2]) || 1e-9;
          const o = [F[0] / rho, F[2] / rho];
          // (At the front it also turns in a little toward the placket, so the points lie in on the chest.)
          const front = Math.max(0, F[2] / rho);
          const inX = -Math.sign(F[0]) * h * front * front * (knob('__sfIn') ?? (p.pc.meta.longPoint ? 0 : 0.3));
          // (Tight at the fold, a cloth's thickness round it, easing out to clear what it lies over.)
          const Th = thick * (knob('__sfFoldT') ?? 1.2) + (T - thick * (knob('__sfFoldT') ?? 1.2)) * Math.min(1, h / (knob('__sfRamp') ?? 0.3));
          let X: V3 = [F[0] + o[0] * (Th + h * Math.sin(phi)) + inX, F[1] + h * Math.cos(phi), F[2] + o[1] * (Th + h * Math.sin(phi))];
          // (Never inside what it lies over.)
          const a = Math.atan2(X[0], X[2]);
          const R = Math.hypot(X[0], X[2]);
          const lo = coverR(a, X[1]);
          if (R < lo) X = [Math.sin(a) * lo, X[1], Math.cos(a) * lo];
          if (q.x - x0 < 0.3) X = [0, X[1], -Math.hypot(X[0], X[2])];
          moved.push([i, X]);
        });
        // Then laid down onto what it covers (the stand, the shoulders, the chest): no air under it, a cloth's
        // thickness off, drawn in by how far each point stands off, eased over its neighbours so the edges stay clean.
        // (Not at the fold itself, which keeps its crease.)
        if (!knob('__sfFloat')) {
          const onto = thick * (knob('__sfOnto') ?? 1);
          const nbr: number[][] = pts.map(() => []);
          for (const [a, b, c] of p.mesh.tris) {
            nbr[a].push(b, c);
            nbr[b].push(a, c);
            nbr[c].push(a, b);
          }
          const idx = new Map(moved.map(([i], k) => [i, k]));
          let del = moved.map(([i, X]) => {
            const a = Math.atan2(X[0], X[2]);
            const R = Math.hypot(X[0], X[2]);
            const lie = coverR(a, X[1]) - thick - gap + onto;
            const ns = curvedSeam ? nearSeam(pts[i]) : undefined;
            const h = ns ? Math.max(0, ns.d - fGap) : off(pts[i]);
            return Math.min(0, lie - R) * Math.min(1, h / (knob('__sfLieFrom') ?? 0.8));
          });
          // (Never through it: a cloth's thickness out at the least, the easing kept above that.)
          let fl = moved.map(([, X]) => Math.min(0, coverR(Math.atan2(X[0], X[2]), X[1]) - gap - Math.hypot(X[0], X[2])));
          // (What it covers, read off coarse cloth, is lumpy: its floor eased smooth first.)
          for (let it = 0; it < (knob('__sfFloorIt') ?? 6); it++)
            fl = fl.map((v, k) => {
              const ks = nbr[moved[k][0]].map((j) => idx.get(j)).filter((x): x is number => x !== undefined);
              return ks.length ? v * 0.5 + (ks.reduce((t, j) => t + fl[j], 0) / ks.length) * 0.5 : v;
            });
          del = del.map((v, k) => Math.max(v, fl[k]));
          for (let it = 0; it < (knob('__sfLieIt') ?? 10); it++)
            del = del.map((v, k) => {
              const ks = nbr[moved[k][0]].map((j) => idx.get(j)).filter((x): x is number => x !== undefined);
              return Math.max(fl[k], ks.length ? v * 0.5 + (ks.reduce((t, j) => t + del[j], 0) / ks.length) * 0.5 : v);
            });
          moved.forEach(([, X], k) => {
            const R = Math.hypot(X[0], X[2]) || 1e-9;
            const f2 = (R + del[k]) / R;
            X[0] *= f2;
            X[2] *= f2;
          });
        }
        // Its inner layer, from the stand seam up to the same fold, so the two meet in one clean line.
        if (curvedSeam && !knob('__sfKeepInner'))
          pts.forEach((q, i) => {
            if (p.turned[i]) return;
            const ns = nearSeam(q);
            const F = ringAtS(ns.s);
            const I = (p.base + i) * 3;
            res[I] = q.x - x0 < 0.3 ? 0 : F[0];
            res[I + 1] = F[1] + Math.max(0, fGap - ns.d);
            res[I + 2] = F[2];
          });
      }
      else pts.forEach((q, i) => {
        if (!p.turned[i]) return;
        const s = along(q);
        const F = rollAt(s);
        let a = Math.atan2(F[0], F[2]);
        let c = F[1];
        let R = Math.max(Math.hypot(F[0], F[2]), coverR(a, c));
        // Down the outside of what is under it, step by step, by the length it is cut past the roll.
        let left = off(q);
        // (Towards its point the fall also spreads out sideways, the way a collar point lies open on the chest.)
        const toward = Math.max(0, (q.x - x0) / (xEnd - x0 || 1) - 0.5) * 2;
        const da = (Math.sign(F[0]) || 1) * spread * toward;
        while (left > 1e-6) {
          const st = Math.min(0.25, left);
          const c2 = c + st;
          const a2 = a + (da * st) / Math.max(4, R);
          const R2 = Math.max(coverR(a2, c2), R - st * 0.6);
          const ds = Math.hypot(st, R2 - R) || st;
          const f = Math.min(1, left / ds);
          c += st * f;
          a += (a2 - a) * f;
          R += (R2 - R) * f;
          left -= ds * f;
        }
        let X: V3 = [Math.sin(a) * R, c, Math.cos(a) * R];
        if (q.x - x0 < 0.3) X = [0, X[1], -Math.hypot(X[0], X[2])];
        moved.push([i, X]);
      });
      for (const [i, v] of moved) {
        const I = (p.base + i) * 3;
        res[I] = v[0];
        res[I + 1] = v[1];
        res[I + 2] = v[2];
      }
      // (Eased over its neighbours a few times, so the laid fall is smooth cloth.)
      const nb: number[][] = pts.map(() => []);
      for (const [a, b, c] of p.mesh.tris) {
        nb[a].push(b, c);
        nb[b].push(a, c);
        nb[c].push(a, b);
      }
      for (let pass = 0; pass < (knob('__sfSmooth') ?? (knob('__oldShirtFall') ? 3 : 0)); pass++) {
        const next = moved.map(([i]) => {
          const v = P3(i);
          const list = nb[i].filter((j) => p.turned[j]);
          if (!list.length) return [i, v] as [number, V3];
          const m: V3 = [0, 0, 0];
          for (const j of list) {
            const u = P3(j);
            for (let c = 0; c < 3; c++) m[c] += u[c] / list.length;
          }
          // (At the centre back it meets its mirror: eased up or down and in or out with it, kept on the centre plane,
          // so the fall's edge runs level across the back instead of dipping to a point.)
          if (pts[i].x - x0 < 0.3) {
            if (knob('__sfHoldCB')) return [i, v] as [number, V3];
            const R = (Math.hypot(v[0], v[2]) + Math.hypot(m[0], m[2])) / 2;
            return [i, [0, (v[1] + m[1]) / 2, -R] as V3] as [number, V3];
          }
          return [i, [0, 1, 2].map((c) => v[c] * 0.5 + m[c] * 0.5) as V3] as [number, V3];
        });
        for (const [i, v] of next) {
          const I = (p.base + i) * 3;
          res[I] = v[0];
          res[I + 1] = v[1];
          res[I + 2] = v[2];
        }
      }
    }
  }
  // Down a back cut on the fold the coarse sim leaves a ripple along the centre (the cloth either side pressing on its
  // mirror): there the back is eased over its neighbours a few times, fading out over the first few cm from the centre.
  if (!knob('__noCbEase')) {
    for (const p of B.panels) {
      if (p.hidden || p.role !== 'back') continue;
      const pts = p.mesh.pts;
      const W0 = knob('__cbEaseW') ?? 4;
      // (Its edges stay where they were sewn: a waist seam or hem eased toward the cloth inside it would rise off it.)
      const edge = new Set(Object.values(p.mesh.runs).flatMap((rs) => (rs ?? []).flat()));
      const near = pts.map((_, i) => i).filter((i) => Math.abs(pts[i].x) < W0 && !p.turned[i] && !edge.has(i));
      if (!near.length) continue;
      const nb: number[][] = pts.map(() => []);
      for (const [a, b, c] of p.mesh.tris) {
        nb[a].push(b, c);
        nb[b].push(a, c);
        nb[c].push(a, b);
      }
      for (let pass = 0; pass < (knob('__cbEase') ?? 6); pass++) {
        const next = near.map((i) => {
          const I = (p.base + i) * 3;
          const list = nb[i];
          const m: V3 = [0, 0, 0];
          for (const j of list) for (let c = 0; c < 3; c++) m[c] += res[(p.base + j) * 3 + c] / list.length;
          const w = 0.5 * (1 - Math.abs(pts[i].x) / W0);
          return [I, [0, 1, 2].map((c) => res[I + c] * (1 - w) + m[c] * w)] as [number, number[]];
        });
        for (const [I, v] of next) {
          // (Its centre stays on the centre plane.)
          res[I] = Math.abs(res[I]) < 0.05 ? res[I] : v[0];
          res[I + 1] = v[1];
          res[I + 2] = v[2];
        }
      }
    }
  }
  // A sleeveless bodice hung from straps set out at the shoulder (a plunge's, cut down past the bust front and back)
  // has no cloth across its middle to wrap it round the body: the coarse sim leaves its sides hanging straight down
  // from the strap, standing well off the ribs under the arm. On a body the cut's own shaping lays them in, so below
  // the strap the side is drawn in toward the body until it stands off no more than a sleeveless bodice's ease.
  if (!B.panels.some((p) => p.role === 'sleeve' && !p.hidden) && !extra.trousers && !knob('__noHug')) {
    const CAP = 1;
    for (const p of B.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back') || p.pc.meta.cowl) continue;
      const pts = p.mesh.pts;
      const sh = (p.mesh.runs.shoulder ?? []).flat();
      const waist = (p.mesh.runs.waist ?? []).flat();
      if (!sh.length || !waist.length) continue;
      // (By its height on the form, below the shoulder's tip, not by its place on the flat piece: the top of the front
      // armhole, cut just below the tip but hanging level with it past the form's narrow shoulder, was drawn in to
      // the body's narrow top and folded up over the shoulder as a wing, All round quality 2026-11-03.)
      const shY = Math.max(...sh.map((i) => res[(p.base + i) * 3 + 1]));
      const wY = Math.min(...waist.map((i) => pts[i].y));
      pts.forEach((q, i) => {
        if (q.y >= wY) return;
        const w = Math.min(1, Math.max(0, (res[(p.base + i) * 3 + 1] - shY) / 8));
        const s = w * w * (3 - 2 * w);
        if (!s) return;
        const I = (p.base + i) * 3;
        const a = Math.atan2(res[I], res[I + 2]);
        const R = sp.bodyR(a, res[I + 1]) + thick;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const off = rho - R;
        if (off <= CAP) return;
        const k = (R + CAP + (off - CAP) * (1 - 0.9 * s)) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      });
    }
  }
  // An unshaped shirt or top (cut as wide at the waist as the bust) hangs from the bust and shoulder blades in a few
  // long folds: below them it falls straight, not back in over the ribs or out over the belly in small ripples. The
  // cloth's own small ripples are eased out first (seams held), then each point down the front and back is kept at
  // least as far out as the cloth above it at that angle (from the bust down), so it falls as a curtain.
  if (o.curtain && !knob('__noCurtain')) {
    const nb = new Map<number, number[]>();
    for (let e = 0; e < edges.length; e += 2) {
      const [u, v] = [edges[e], edges[e + 1]];
      (nb.get(u) ?? nb.set(u, []).get(u)!).push(v);
      (nb.get(v) ?? nb.set(v, []).get(v)!).push(u);
    }
    const held = new Set<number>();
    for (const { i, j, k } of seams) held.add(i).add(j).add(k);
    for (const c of centre) held.add(c);
    let bustY = 0;
    let bR = 0;
    for (let y = -40; y <= 0; y += 0.5) {
      const r = sp.bodyR(0.3, y);
      if (r > bR) {
        bR = r;
        bustY = y;
      }
    }
    const smooth = (ids: number[], inP: (g: number) => boolean, n: number) => {
      for (let it = 0; it < n; it++)
        for (const g of ids) {
          const ns = (nb.get(g) ?? []).filter(inP);
          if (ns.length < 3) continue;
          for (let d = 0; d < 3; d++) {
            const m = ns.reduce((acc, q) => acc + res[q * 3 + d], 0) / ns.length;
            res[g * 3 + d] += (m - res[g * 3 + d]) * 0.5;
          }
        }
    };
    const NB = 72;
    for (const p of B.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      const inP = (g: number) => g >= p.base && g < p.base + p.mesh.pts.length && !p.turned[g - p.base];
      // (From the bust down, as the curtain is: smoothed to the top, the rows under the shoulder seam were drawn
      // across the shoulder's bend into the form, and the oversized top's last clamp then slid them 3 cm out along
      // the shoulder, All round quality 2026-11-04.)
      const ids = p.mesh.pts.map((_, i) => p.base + i).filter((g) => inP(g) && !held.has(g) && (knob('__curtainTop') || res[g * 3 + 1] >= bustY));
      smooth(ids, inP, knob('__curtainIt') ?? 12);
      const run = new Float64Array(NB);
      const bin = (a: number) => Math.min(NB - 1, Math.max(0, Math.floor(((a + Math.PI) / TAU) * NB)));
      const order = p.mesh.pts.map((_, i) => p.base + i).filter(inP).sort((g, h) => res[g * 3 + 1] - res[h * 3 + 1]);
      for (const g of order) {
        const I = g * 3;
        const a = Math.atan2(res[I], res[I + 2]);
        const fwd = p.role === 'front' ? Math.abs(a) : Math.PI - Math.abs(a);
        if (fwd > (knob('__curtainA') ?? 0.9) || res[I + 1] < bustY) continue;
        const b = bin(a);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        // (Fading out toward the sides, which follow the body's turn.)
        const w = Math.min(1, ((knob('__curtainA') ?? 0.9) - fwd) / 0.3);
        const want = Math.max(run[b], run[Math.max(0, b - 1)] * 0.5 + run[Math.min(NB - 1, b + 1)] * 0.5);
        if (rho < want) {
          const k = (rho + (want - rho) * w) / rho;
          res[I] *= k;
          res[I + 2] *= k;
        }
        run[b] = Math.max(run[b], Math.hypot(res[I], res[I + 2]));
      }
      smooth(ids, inP, 3);
    }
  }
  // A plunge's edge is stay-taped: it can't stretch or fall away from the body, so it lies where the pattern puts it,
  // as far round the body from the centre front as it is cut, on the body a cloth's thickness off. The cloth within a
  // few cm of it comes with it.
  if (!knob('__noStay'))
    for (const p of B.panels) {
      if (p.hidden || p.role !== 'front' || p.turned.some(Boolean)) continue;
      const pts = p.mesh.pts;
      const neck = (p.mesh.runs.neck ?? []).flat();
      if (!neck.length) continue;
      const ny = neck.map((i) => pts[i].y);
      if (Math.max(...ny) - Math.min(...ny) < (knob('__stayDeep') ?? 15)) continue;
      // (A neckline that plunges: its deepest point is at the centre front. A halter's top edge is tagged neck all the
      // way from the centre up round the neck and down its cut-in armhole to the side, as deep as a plunge: walked down
      // the body from its neck point by cut length, that armhole was drawn round toward the centre front, the upper
      // chest stretched twice its cut and the side seam's top dragged 4 cm, All round quality 2026-11-04.)
      if (Math.abs(pts[neck[ny.indexOf(Math.max(...ny))]].x) > 2) continue;
      // (A plunge to the waist is a narrow V between covered shoulders: settled, its edge lies 4 cm further round the
      // body than its cut distance from the centre, the front's cloth spread over the bust, and within 2.5 cm of the
      // body. Walked all the way back to its cut distance it tore the cloth beside it 2.6 times its cut, 2026-11-06,
      // so it was left to settle, and the V gaped open on the bust where Cat's picture has a narrow V (round 4). Its
      // tape brings the edge part of the way back, the cloth over a wider band beside it coming with it; a sleeveless
      // one only half way, since its narrow strap stretched twice its cut when pulled further.)
      const sleeved = B.panels.some((o) => o.role === 'sleeve' && !o.hidden);
      const narrow = p.pc.meta.narrowPlunge ? (knob('__narrowStay') ?? (sleeved ? 0.9 : 0.5)) : 1;
      const arcTo = (y: number, s: number) => {
        let a = 0;
        let acc = 0;
        const da = 0.004;
        while (acc < s && a < Math.PI) {
          acc += sp.bodyR(a + da / 2, y) * da;
          a += da;
        }
        return a;
      };
      const disp = new Map<number, V3>();
      // Walked down the body from the neck point along the edge, each step its cut length, at the distance round from
      // the centre front its pattern puts it: so the edge lies flat on the body, as long as it is cut, and the V's point
      // lands as deep as it is cut.
      const order = [...new Set(neck)].sort((a, b) => pts[a].y - pts[b].y);
      const surf = (s0: number, c: number): V3 => {
        const a = arcTo(c, Math.max(0, s0));
        const r = sp.bodyR(a, c) + p.thick[order[0]] + 0.1;
        return [Math.sin(a) * r, c, Math.cos(a) * r];
      };
      const I0 = (p.base + order[0]) * 3;
      let cur: V3 = [res[I0], res[I0 + 1], res[I0 + 2]];
      let c = res[I0 + 1];
      order.forEach((i, k) => {
        if (k > 0) {
          const L = Math.hypot(pts[i].x - pts[order[k - 1]].x, pts[i].y - pts[order[k - 1]].y);
          let nxt = surf(pts[i].x, c);
          for (let g = 0; g < 400 && Math.hypot(nxt[0] - cur[0], nxt[1] - cur[1], nxt[2] - cur[2]) < L; g++) {
            c += 0.1;
            nxt = surf(pts[i].x, c);
          }
          cur = nxt;
        }
        const I = (p.base + i) * 3;
        // (Eased in from the strap: up at the shoulder the strap's own hold governs.)
        const f = Math.min(1, Math.max(0, (pts[i].y - Math.min(...ny)) / (knob('__stayFade') ?? 10)));
        // (Only ever down: where the cloth already hangs lower over the bust, it stays.)
        if (cur[1] < res[I + 1]) {
          c = res[I + 1];
          cur = surf(pts[i].x, c);
        }
        disp.set(i, [(cur[0] - res[I]) * f * narrow, (cur[1] - res[I + 1]) * f * narrow, (cur[2] - res[I + 2]) * f * narrow]);
      });
      const W = knob('__stayW') ?? (narrow < 1 ? (knob('__narrowW') ?? 12) : 5);
      // (Below the V's point the cloth down to the waist eases down with it, over that whole length.)
      const yV = Math.max(...ny);
      const yW = Math.min(...(p.mesh.runs.waist ?? p.mesh.runs.hem ?? []).flat().map((i) => pts[i].y), yV + 20);
      const vBot = order[order.length - 1];
      pts.forEach((q, i) => {
        let best = -1;
        let bd = Infinity;
        for (const n of neck) {
          const d = Math.hypot(pts[n].x - q.x, pts[n].y - q.y);
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
        if (q.y > yV && q.x < W) {
          // Under the point: by how far down toward the waist.
          const t0 = 1 - (q.y - yV) / Math.max(1, yW - yV);
          if (t0 > 0 && (bd >= W || t0 > 1 - bd / W)) {
            best = vBot;
            bd = (1 - t0) * W;
          }
        }
        if (best < 0 || bd >= W) return;
        const t = 1 - bd / W;
        const w = t * t * (3 - 2 * t);
        const D = disp.get(best)!;
        const I = (p.base + i) * 3;
        res[I] += D[0] * w;
        res[I + 1] += D[1] * w;
        res[I + 2] += D[2] * w;
      });
    }
  // A bodice cut whole over a skirt drafted to one half: its waist is sewn to the skirt only on the half the skirt is
  // drafted to (the sim's seams know one skirt half); the other half is drawn over the skirt's mirror, so its waist is
  // set on that mirror's edge here, the cloth just above carried with it. (Left as it settled, it rode a centimetre
  // up off the skirt and the form showed through the gap, All round quality 2026-11-04.)
  if (!knob('__noMirrorWaist'))
    for (const p of B.panels) {
      if (p.hidden || !p.pc.meta.whole || (p.role !== 'front' && p.role !== 'back')) continue;
      const pts = p.mesh.pts;
      const waist = [...new Set((p.mesh.runs.waist ?? []).flat())].filter((i) => pts[i].x < -0.05);
      if (!waist.length) continue;
      const side = p.role === 'front' ? 'peplum-front' : 'peplum-back';
      const edge: V3[] = [];
      for (const q of B.panels) {
        if (q.hidden || q.role !== side || q.pc.meta.tier) continue;
        for (const i of new Set((q.mesh.runs.waist ?? []).flat())) {
          const I = (q.base + i) * 3;
          edge.push([res[I], res[I + 1], res[I + 2]]);
        }
      }
      if (!edge.length) continue;
      const disp = new Map<number, V3>();
      for (const i of waist) {
        const I = (p.base + i) * 3;
        const m: V3 = [-res[I], res[I + 1], res[I + 2]];
        let best = edge[0];
        let bd = Infinity;
        for (const e of edge) {
          const d = Math.hypot(e[0] - m[0], e[1] - m[1], e[2] - m[2]);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (bd > (knob('__mwFar') ?? 2)) continue;
        disp.set(i, [-best[0] - res[I], best[1] - res[I + 1], best[2] - res[I + 2]]);
      }
      const R = 4;
      pts.forEach((q, i) => {
        if (q.x >= -0.05) return;
        let best = -1;
        let bd = Infinity;
        for (const w of disp.keys()) {
          const d = Math.hypot(pts[w].x - q.x, pts[w].y - q.y);
          if (d < bd) {
            bd = d;
            best = w;
          }
        }
        if (best < 0 || bd >= R) return;
        const t = 1 - bd / R;
        const w = t * t * (3 - 2 * t);
        const D = disp.get(best)!;
        const I = (p.base + i) * 3;
        res[I] += D[0] * w;
        res[I + 1] += D[1] * w;
        res[I + 2] += D[2] * w;
      });
    }
  // (The centre line stays on the centre plane, whatever the passes above moved: a hair off it and the two halves part
  // in a slit down the front.)
  for (const i of foldLine) res[i * 3] = 0;
  // A skirt cut on the fold runs on smooth across its centre: each point on the fold sits as far out as the cloth either
  // side of it, not in a crease the mesh draws as a row of beads.
  if (!knob('__noFoldSmooth')) {
    const onC = new Set(centre);
    for (const p of B.panels) {
      // (A skirt cut on the fold, or a top's centre back seam: the same smoothing either way.)
      const skirtFold = (p.role === 'peplum-front' || p.role === 'peplum-back') && !!(p.mesh.runs.fold?.length || (p.mesh.runs.centre?.length && !knob('__noSkirtCentre')));
      const topCentre = (p.role === 'front' || p.role === 'back') && !p.mesh.runs.opening && !!(p.mesh.runs.fold?.length || p.mesh.runs.centre?.length) && !knob('__noTopFold');
      if (!skirtFold && !topCentre) continue;
      const nb: number[][] = p.mesh.pts.map(() => []);
      for (const [a, b, c] of p.mesh.tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        nb[u].push(v);
        nb[v].push(u);
      }
      const pts = p.mesh.pts;
      if (!pts.some((_, i) => onC.has(p.base + i))) continue;
      // (And the cloth just beside the fold, along itself, so the row either side runs as smooth as the fold.)
      // (Below the hip: above it the waist and whatever is tucked in under it stay as they settled.)
      const yTop = Math.min(...pts.map((q) => q.y)) + (knob('__foldFrom') ?? 18);
      // (Not down a vent: the cloth beside the centre there is the vent's overlap and underlap, two layers that lap, not
      // one fold to run smooth; smoothing them together drew the underlap 2.4 times its cut, All round quality 2026-11-04.)
      const ventTop = p.mesh.runs.vent?.length && !knob('__foldVent') ? Math.min(...p.mesh.runs.vent.flat().map((i) => pts[i].y)) : Infinity;
      const band = (i: number) => Math.abs(pts[i].x) < (knob('__foldBand') ?? 2.5) && !onC.has(p.base + i) && pts[i].y > yTop && pts[i].y < ventTop;
      for (let it = 0; it < (knob('__foldIt') ?? 6); it++)
        pts.forEach((_, i) => {
          if (!band(i)) return;
          const ns = nb[i].filter((j) => band(j));
          if (ns.length < 2) return;
          const I = (p.base + i) * 3;
          for (const d of [0, 2]) {
            let a = 0;
            for (const j of ns) a += res[(p.base + j) * 3 + d];
            res[I + d] += (a / ns.length - res[I + d]) * 0.5;
          }
        });
      for (let it = 0; it < (knob('__foldIt') ?? 6); it++)
        pts.forEach((_, i) => {
          const g = p.base + i;
          if (!onC.has(g) || pts[i].y <= yTop) return;
          const off = nb[i].filter((j) => !onC.has(p.base + j));
          if (!off.length) return;
          const I = g * 3;
          let y = 0;
          let z = 0;
          for (const j of off) {
            y += res[(p.base + j) * 3 + 1];
            z += res[(p.base + j) * 3 + 2];
          }
          // (Out to the cloth beside it, not along it: the hem and waist stay where they are.)
          res[I + 2] += (z / off.length - res[I + 2]) * 0.5;
        });
    }
  }
  // A skirt's side seams, from the waist down: the cloth runs on round the seam as one smooth curve, not out to a ridge along
  // it (the two pieces settle as separate halves and meet at an angle, which shows as a fin down the side). Within a
  // few cm of the seam each point is eased to the distance out of the cloth round it, across the seam as well as
  // along its own piece; its direction round the body is kept, so the hem's length and the seam's place don't move.
  // (A sleeveless top's side seams the same, from a little below the underarm: with no sleeve to hold it, the coarse
  // sim leaves the seam wavering in and out down the side.)
  // (Over the hip too, across a wider band: left from the hip down only, the seam stood out as a step over the hip.)
  const sideGroups = [
    ...[
      // (Over the hip a wider band, more times over, fading out by the hip's foot; below it, where a fluid skirt falls in
      // folds, a narrow one, so the folds by the seam aren't pressed flat into fins.)
      { from: knob('__hipFrom') ?? 0, to: knob('__hipTo') ?? 22, band: knob('__hipBand') ?? 5, its: knob('__hipIt') ?? 30 },
      { from: knob('__sideFrom') ?? 16, band: knob('__sideBand') ?? 3, its: knob('__sideIt') ?? 8 },
    ].map((g) => ({ ps: B.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && p.mesh.runs.side?.length && !(p.pc.meta as { pleatFolds?: unknown } | undefined)?.pleatFolds), ...g })),
    ...(!B.panels.some((p) => p.role === 'sleeve' && !p.hidden) && !extra.skirt?.length && !extra.trousers && !o.pinFront?.length && !knob('__noTopSide')
      ? [{ ps: B.panels.filter((p) => !p.hidden && (p.role === 'front' || p.role === 'back') && p.mesh.runs.side?.length), from: knob('__topSideFrom') ?? 4, to: undefined, band: knob('__sideBand') ?? 3, its: knob('__sideIt') ?? 8 }]
      : []),
  ];
  if (!knob('__noSideSmooth'))
  for (const { ps: skirtP, from, to, band, its } of sideGroups as { ps: Panel[]; from: number; to?: number; band: number; its: number }[]) {
    if (skirtP.length) {
      const nb = new Map<number, Set<number>>();
      const link = (u: number, v: number) => {
        (nb.get(u) ?? nb.set(u, new Set()).get(u)!).add(v);
        (nb.get(v) ?? nb.set(v, new Set()).get(v)!).add(u);
      };
      const own = new Set<number>();
      for (const p of skirtP) {
        for (let i = 0; i < p.mesh.pts.length; i++) own.add(p.base + i);
        for (const [a, b, c] of p.mesh.tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) link(p.base + u, p.base + v);
      }
      for (const { i, j, k } of seams) if (own.has(i) && own.has(j) && own.has(k)) {
        link(i, j);
        link(i, k);
      }
      const sideIds = skirtP.flatMap((p) => (p.mesh.runs.side ?? []).flat().map((i) => p.base + i));
      const W = band;
      const c0 = Math.min(...sideIds.map((g) => res[g * 3 + 1]));
      const top = c0 + from;
      const near = new Map<number, number>();
      for (const g of own) {
        if (res[g * 3 + 1] < top) continue;
        const fade = to === undefined ? 1 : Math.min(1, Math.max(0, (c0 + to - res[g * 3 + 1]) / 6));
        if (!fade) continue;
        let bd = Infinity;
        for (const s of sideIds) bd = Math.min(bd, Math.hypot(res[g * 3] - res[s * 3], res[g * 3 + 1] - res[s * 3 + 1], res[g * 3 + 2] - res[s * 3 + 2]));
        if (bd < W) near.set(g, (1 - bd / W) * fade);
      }
      const hem = new Set(skirtP.flatMap((p) => (p.mesh.runs.hem ?? []).flat().map((i) => p.base + i)));
      for (let it = 0; it < its; it++) {
        const next = new Map<number, number>();
        for (const [g, w] of near) {
          const ns = [...(nb.get(g) ?? [])].filter((h) => !hem.has(g) || hem.has(h));
          if (ns.length < 2) continue;
          let r = 0;
          for (const h of ns) r += Math.hypot(res[h * 3], res[h * 3 + 2]);
          const r0 = Math.hypot(res[g * 3], res[g * 3 + 2]) || 1e-9;
          next.set(g, r0 + (r / ns.length - r0) * 0.5 * Math.min(1, w * 2));
        }
        for (const [g, r] of next) {
          const r0 = Math.hypot(res[g * 3], res[g * 3 + 2]) || 1e-9;
          res[g * 3] *= r / r0;
          res[g * 3 + 2] *= r / r0;
        }
      }
    }
  }
  if (o.shapedHem && !knob('__noHemCorners')) closeHemCorners(B.panels, seams, res);
  // A side slit parts a little as she stands: its edges a little apart, more toward the hem, each turned round the
  // body away from the other (the front edge forward, the back edge back), the cloth within a few cm turning with it.
  // They hang straight: turned, not flared out.
  let posMirror: Float64Array | undefined;
  if (slitEdges.length && extra.slitCm && !knob('__noSlitPart')) {
    posMirror = Float64Array.from(res);
    const part = knob('__slitPart') ?? 4;
    const band = knob('__slitBand') ?? 6;
    for (const { p, ids, toHem, sign } of slitEdges) {
      if (!ids.length) continue;
      const turn = new Map<number, number>();
      p.mesh.pts.forEach((q, i) => {
        let best = Infinity;
        let at = 0;
        for (const g of ids) {
          const e = p.mesh.pts[g - p.base];
          const dd = Math.hypot(e.x - q.x, e.y - q.y);
          if (dd < best) {
            best = dd;
            at = g;
          }
        }
        if (best >= band) return;
        const t = Math.max(0, 1 - (toHem.get(at) ?? 0) / extra.slitCm!);
        const w = 1 - best / band;
        turn.set(p.base + i, (part / 2) * t ** (knob('__slitPow') ?? 1.2) * w * w * (3 - 2 * w));
      });
      for (const [g, gap] of turn) {
        const I = g * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const a = Math.atan2(res[I], res[I + 2]) + (sign * gap) / rho;
        res[I] = Math.sin(a) * rho;
        res[I + 2] = Math.cos(a) * rho;
      }
    }
  }
  // (Last, nothing a pass above moved is left inside the body: a jacket's shoulders held out on the form. The form is
  // drawn with its height carried on straight above the neck point, where its table flattens; so is this.)
  const cTopD = sp.cOf(-1.45) + 2;
  const slopeD = (sp.yOf(cTopD + 4) - sp.yOf(cTopD)) / 4;
  const drawnY = (c: number) => (c < cTopD ? sp.yOf(cTopD) + (c - cTopD) * slopeD : sp.yOf(c));
  // (Trousers too, down to the form's last row: the form is drawn down past the crotch, so between the legs at the
  // top the cloth lies over it, as it does on a dress form, rather than leaving it showing through.)
  if (o.pinFront?.length || extra.trousers || !knob('__noClampAll'))
    for (const p of B.panels) {
      if (p.hidden || p.role === 'sleeve') continue;
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        if (extra.trousers && drawnY(res[I + 1]) > BODY_BOTTOM) return;
        // (Eased off over the form's last few cm, so the cloth below carries on from it without a step.)
        const ease = extra.trousers ? Math.min(1, Math.max(0, (sp.cOf(BODY_BOTTOM) - res[I + 1]) / 0.3)) : 1;
        // (Against the form as drawn, whose shoulders the cloth's own body table holds in round the armholes.)
        const a = Math.atan2(res[I], res[I + 2]);
        const y = Math.max(BODY_TOP, Math.min(BODY_BOTTOM, drawnY(res[I + 1])));
        const drawn = bodyHalf(y) * shapeAt(Math.abs(a), y) * sp.scale(y) + thick;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        if (rho < drawn) {
          const k = 1 + (drawn / rho - 1) * ease;
          res[I] *= k;
          res[I + 2] *= k;
        }
        if (ease < 1) return;
        const v = ontoBody([res[I], res[I + 1], res[I + 2]], thick);
        res[I] = v[0];
        res[I + 1] = v[1];
        res[I + 2] = v[2];
      });
    }
  // A balloon hem: the outer skirt swells out below the hip and turns in to the underskirt's hem.
  const outerB = B.panels.filter((p) => /peplum/.test(p.role) && p.mesh.runs.balloon && !/underskirt/i.test(p.pc.name));
  const underB = B.panels.filter((p) => /underskirt/i.test(p.pc.name));
  if (outerB.length && underB.length) {
    // (The underskirt's side seam first closed, each pair of its points put on their place on the other piece: the sim
    // left a peplum's short underskirt up to 2 cm open at the side, and the outer's hem was then seated on a ring with a
    // step in it, 2026-11-06.)
    const uSide = new Set(underB.flatMap((p) => (p.mesh.runs.side ?? []).flat().map((i) => p.base + i)));
    for (let it = 0; it < 4; it++)
      for (const { i, j, k, t } of seams) {
        if (!uSide.has(i) || !uSide.has(j) || !uSide.has(k)) continue;
        for (let d = 0; d < 3; d++) res[i * 3 + d] += (res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t - res[i * 3 + d]) * 0.5;
      }
    const hOf = (ps: Panel[]) => Math.max(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y))) - Math.min(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y)));
    const puffCm = Math.max(3, hOf(outerB) - hOf(underB)) * (knob("__bal") ?? 1);
    for (const p of outerB) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      // (Each point's depth by the hem below it, which on an A-line piece rises toward the side: by the piece's full
      // height, the side hem was still 2 cm up the swell and stood off the underskirt's hem.)
      const hem = (p.mesh.runs.balloon ?? []).flat().map((i) => p.mesh.pts[i]);
      const hemAt = (x: number) => hem.reduce((b, h) => (Math.abs(h.x - x) < Math.abs(b.x - x) ? h : b), hem[0] ?? pt(x, Math.max(...ys))).y;
      p.mesh.pts.forEach((q, i) => {
        const H = Math.max(1, hemAt(q.x) - y0);
        const t = Math.max(0, Math.min(1, ((q.y - y0) / H - 0.3) / 0.7));
        // (To nothing at its hem, which is gathered onto the underskirt's hem and must meet it: short of that, the hem
        // stood 9 to 10 cm off the hem it is sewn to, All round quality 2026-11-04.)
        const off = puffCm * Math.sin(Math.PI * Math.pow(t, 0.8) * (knob('__balHem') ?? 1));
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        res[I] *= (rho + off) / rho;
        res[I + 2] *= (rho + off) / rho;
      });
      // (Its hem then set back on the underskirt's hem, the cloth within 8 cm of it eased with it: the coarse sim leaves
      // the seam 2 to 3 cm open at the sides, where the outer's fullness bunches.)
      seatOn(p, 'balloon', 8);
    }
  }
  // A set-in sleeve's cap: its ease is shrunk away, so the cap sits round the top of the arm no fuller than the sleeve
  // at its bicep, not standing off it in a ball. Its seam stays where it is sewn; the cloth a little way in settles.
  if (!extra.puff && !o.boxy && !knob('__noCapSettle')) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    for (const p of B.panels.filter((q) => q.role === 'sleeve' && q !== cuffPanel)) {
      const cap = (p.mesh.runs.armhole ?? []).flat().map((i) => p.mesh.pts[i]);
      if (!cap.length) continue;
      // (A raglan's half is half the sleeve round; its shoulder piece lies on the body, not round the arm.)
      const xs = (p.yoke ? B.panels.filter((q) => q.yoke) : [p]).flatMap((q) => q.mesh.pts.map((r) => r.x));
      const Rb = (Math.max(...xs) - Math.min(...xs)) / TAU + 0.4;
      p.mesh.pts.forEach((q, i) => {
        if (p.yoke?.[i]) return;
        let dc = Infinity;
        for (const c of cap) dc = Math.min(dc, Math.hypot(c.x - q.x, c.y - q.y));
        const t = Math.min(1, dc / 3);
        const w = t * t * (3 - 2 * t);
        if (w <= 0) return;
        const I = (p.base + i) * 3;
        const e = res[I] >= 0 ? 1 : -1;
        const r = [res[I] * e - arm.a[0], res[I + 1] - arm.a[1], res[I + 2] - arm.a[2]];
        const u = (r[0] * ab[0] + r[1] * ab[1] + r[2] * ab[2]) / L2;
        const d = [r[0] - ab[0] * u, r[1] - ab[1] * u, r[2] - ab[2] * u];
        const dl = Math.hypot(d[0], d[1], d[2]) || 1e-9;
        if (dl <= Rb) return;
        const k = (w * (dl - Rb) * 0.75) / dl;
        res[I] -= d[0] * k * e;
        res[I + 1] -= d[1] * k;
        res[I + 2] -= d[2] * k;
      });
    }
  }
  // A puff sleeve: the gathered crown stands out round the arm, fullest midway, drawn in to its band.
  if (extra.puff) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const P = Math.min(3.2, extra.puff * 0.22) * (knob("__puff") ?? 1);
    for (const p of B.panels.filter((q) => q.role === 'sleeve')) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const H = Math.max(...ys) - y0;
      // (The seam into the armhole stays where it is sewn: on a short puff the underarm is well down the sleeve, and
      // stood out with the crown it pulled 3 cm off the bodice's armhole, All round quality 2026-11-07.)
      const seam = knob('__puffSeam') === 0 ? [] : (p.mesh.runs.armhole ?? []).flat().map((i) => p.mesh.pts[i]);
      p.mesh.pts.forEach((q, i) => {
        const t = (q.y - y0) / H;
        let dc = Infinity;
        for (const c of seam) dc = Math.min(dc, Math.hypot(c.x - q.x, c.y - q.y));
        const ts = seam.length ? Math.min(1, dc / (knob('__puffRamp') ?? 12)) : 1;
        const off = P * Math.sin(Math.PI * Math.min(1, t * 1.05)) * ts * ts * (3 - 2 * ts);
        const I = (p.base + i) * 3;
        const e = res[I] >= 0 ? 1 : -1;
        const r = [res[I] * e - arm.a[0], res[I + 1] - arm.a[1], res[I + 2] - arm.a[2]];
        const u = Math.max(0, (r[0] * ab[0] + r[1] * ab[1] + r[2] * ab[2]) / L2);
        const d = [r[0] - ab[0] * u, r[1] - ab[1] * u, r[2] - ab[2] * u];
        const dl = Math.hypot(d[0], d[1], d[2]) || 1e-9;
        const k = off / dl;
        res[I] += d[0] * k * e;
        res[I + 1] += d[1] * k;
        res[I + 2] += d[2] * k;
      });
    }
  }
  // A bishop sleeve: its full hem is gathered onto a narrow band at the wrist, so the cloth above blouses out round
  // the arm and is drawn in hard at the band.
  // A shirt cuff, laid after the sim: the sleeve's last few cm gathered in to the cuff, and the cuff a firm tube round
  // the wrist below it (interfaced, it holds its shape), folded in half, its outer layer just over its inner.
  if (cuffPanel) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const Lab = Math.hypot(ab[0], ab[1], ab[2]);
    const dn = ab.map((v) => v / Lab);
    const bp = cuffPanel.mesh.pts;
    const W = Math.max(...bp.map((q) => q.x)) - Math.min(...bp.map((q) => q.x));
    const x0 = Math.min(...bp.map((q) => q.x));
    const y0b = Math.min(...bp.map((q) => q.y));
    const Lb2 = Math.max(...bp.map((q) => q.y)) - y0b;
    const { round: bandRound, tie: bandTie, wrap: bandWrap } = bandGeom(cuffPanel.pc, Lb2);
    const rc = bandRound / TAU + 0.3;
    let hemU = 0;
    let nH = 0;
    for (const p of B.panels.filter((q) => q.role === 'sleeve' && q !== cuffPanel)) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const H = Math.max(...ys) - y0;
      p.mesh.pts.forEach((q, i) => {
        const fromHem = y0 + H - q.y;
        const I = (p.base + i) * 3;
        const e = res[I] >= 0 ? 1 : -1;
        const r = [res[I] * e - arm.a[0], res[I + 1] - arm.a[1], res[I + 2] - arm.a[2]];
        const u = Math.max(0, r[0] * dn[0] + r[1] * dn[1] + r[2] * dn[2]);
        if (fromHem < 0.5) {
          hemU += u;
          nH++;
        }
        // (A plain shirt sleeve hangs straight to its cuff: drawn in over a longer stretch, to a little over the cuff.)
        const Z = knob('__cuffDraw') ?? 16;
        if (fromHem > Z) return;
        const d = [r[0] - dn[0] * u, r[1] - dn[1] * u, r[2] - dn[2] * u];
        const dl = Math.hypot(d[0], d[1], d[2]) || 1e-9;
        const w = Math.pow(1 - fromHem / Z, 1.5);
        const want = dl * (1 - w) + Math.min(dl, rc * (1 + (0.25 * fromHem) / Z) + 0.3) * w;
        const k = want / dl - 1;
        res[I] += d[0] * k * e;
        res[I + 1] += d[1] * k;
        res[I + 2] += d[2] * k;
      });
    }
    hemU /= nH || 1;
    const ov0 = [1 - dn[0] * dn[0], -dn[0] * dn[1], -dn[0] * dn[2]];
    const ol = Math.hypot(ov0[0], ov0[1], ov0[2]);
    const ov = ov0.map((v) => v / ol);
    const fv = [dn[1] * ov[2] - dn[2] * ov[1], dn[2] * ov[0] - dn[0] * ov[2], dn[0] * ov[1] - dn[1] * ov[0]];
    if (fv[2] < 0) fv.forEach((_, k) => (fv[k] = -fv[k]));
    bp.forEach((q, i) => {
      const x = q.x - x0;
      const side = x > W / 2 ? 1 : -1;
      // Its two layers a cloth apart. The mesh's last points either side of the fold (its lower edge) are stretched to
      // it, the outer layer's down to the edge and the inner's a little short of it: the edge then turns up and in,
      // under the outer layer, and reads as a clean folded edge rather than the inner layer's raw rim below.
      const v0 = Math.min(x, W - x);
      const reach = side > 0 ? 0.1 : 0.5;
      const t = Math.min(1, Math.max(0, (v0 - (W / 2 - 3)) / 3));
      const v = Math.min(W / 2 - reach, v0 + 1.7 * t);
      const along = q.y - y0b - bandTie;
      const th = (TAU * Math.min(bandWrap, Math.max(0, along))) / bandWrap;
      const off = side > 0 ? 0.2 : -0.1;
      const rr = rc + off;
      const I = (cuffPanel!.base + i) * 3;
      // (A tie cuff's ties: from where the band's ends meet, on the outside of the wrist, each hangs on down past the
      // hand, the two side by side, the strip's width across.)
      const past = along < 0 ? -along : Math.max(0, along - bandWrap);
      const tie = (along < 0 ? -1 : 1) * (0.4 + v0 + 0.2 * (side > 0 ? 1 : 0));
      // (Each turns down out of the band over its first few centimetres, not at a crease.)
      const tt = Math.min(1, past / (knob('__tieTurn') ?? 4));
      for (let k = 0; k < 3; k++) {
        const onBand = arm.a[k] + dn[k] * (hemU - 0.5 + v) + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k]);
        const hung = arm.a[k] + dn[k] * (hemU - 0.5 + W / 2 + past) + (rr + side * 0.15) * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k]) + tie * fv[k];
        res[I + k] = onBand * (1 - tt) + hung * tt;
      }
    });
  }
  if (cuffRuffleP) laySleeveRuffle(sp, B, res, cuffRuffleP, cuffPanel);
  // (A full bishop sewn into a cuff takes the second pass below too: the sim folded its fullness down the inner arm in
  // 56 sharp pleats, where the plain bishop's hem gathered onto its band had the pass to lay them smooth, 2026-11-06.)
  const fullCuffed = !!extra.cuffBand && B.panels.some((p) => p.role === 'sleeve' && !!p.pc.meta.full);
  if ((extra.cuff && !extra.cuffBand) || fullCuffed) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const rc = (extra.cuff ?? 0) / TAU + 0.4;
    if (extra.cuff && !extra.cuffBand) for (const p of B.panels.filter((q) => q.role === 'sleeve')) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const H = Math.max(...ys) - y0;
      // (A bishop sleeve blouses out above its band by as much as the fullness gathered into it: half again its width.)
      const hemW = (() => {
        const hx = (p.mesh.runs.hem ?? []).flat().map((i) => p.mesh.pts[i].x);
        return hx.length ? Math.max(...hx) - Math.min(...hx) : 0;
      })();
      const S = Math.max(1.6, (hemW / TAU - rc) * (knob('__bishopK') ?? 1));
      // (Drawn in over the last tenth of the sleeve, or over about one and a half times its swell when that is longer: a
      // full bishop, 2.3 times the arm at its hem, swells 8 cm and drawn in over 7 cm stretched the cloth above the band
      // to 2.9 times its cut, 2026-11-06.)
      // (Never from above three quarters down, where the swell is fullest: on a short sleeve that would damp it.)
      const w0 = knob('__bishopW0') ?? Math.max(0.75, Math.min(0.9, 1 - (1.5 * S + 2) / H));
      p.mesh.pts.forEach((q, i) => {
        const t = (q.y - y0) / H;
        if (t < 0.55) return;
        const I = (p.base + i) * 3;
        const e = res[I] >= 0 ? 1 : -1;
        const r = [res[I] * e - arm.a[0], res[I + 1] - arm.a[1], res[I + 2] - arm.a[2]];
        const u = Math.max(0, (r[0] * ab[0] + r[1] * ab[1] + r[2] * ab[2]) / L2);
        const d = [r[0] - ab[0] * u, r[1] - ab[1] * u, r[2] - ab[2] * u];
        const dl = Math.hypot(d[0], d[1], d[2]) || 1e-9;
        // Fullest a little above the band, then drawn in over the last few cm.
        // (Fullest just above the band, where the gathers drop the cloth.)
        const swell = S * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.55) / 0.41)) ** (knob('__bishopP') ?? 1.8));
        const w = Math.min(1, Math.max(0, (t - w0) / (1 - w0))) ** 1.5;
        // (Less on the side toward the body, where the arm hangs close and there is no room for it.)
        const inner = Math.max(0, -d[0] / dl);
        const want = (dl + Math.max(0, swell) * (1 - (knob('__bishopIn') ?? 0.7) * inner)) * (1 - w) + rc * w;
        const k = want / dl - 1;
        res[I] += d[0] * k * e;
        res[I + 1] += d[1] * k;
        res[I + 2] += d[2] * k;
      });
    }
    // (Toward the body, where the arm hangs close, the sim folded a bishop sleeve's fullness flat in small pleats that
    // drew as a jagged edge beside the waist. There each point is set round the arm by where it lies across the cut,
    // the underarm seam facing the body, so the cloth lies in one smooth sheet; the outer side keeps its drape.)
    if (!knob('__noSlvOpen'))
      for (const p of B.panels.filter((q) => q.role === 'sleeve' && q !== cuffPanel)) {
        const pts = p.mesh.pts;
        const ys = pts.map((q) => q.y);
        const y0 = Math.min(...ys);
        const H = Math.max(...ys) - y0;
        const sf = (p.mesh.runs['sleeve-front'] ?? []).flat(), sb = (p.mesh.runs['sleeve-back'] ?? []).flat();
        if (!sf.length || !sb.length) continue;
        const near = (q: { x: number; y: number }, run: number[]) => {
          let e = Infinity;
          for (const j of run) e = Math.min(e, Math.hypot(pts[j].x - q.x, pts[j].y - q.y));
          return e;
        };
        const L = Math.sqrt(L2);
        const ax = [ab[0] / L, ab[1] / L, ab[2] / L];
        // Each point in the arm's own terms: along it, round it (0 toward the body) and out from it.
        const cyl = pts.map((q, i) => {
          const I = (p.base + i) * 3;
          const e = res[I] >= 0 ? 1 : -1;
          const r = [res[I] * e - arm.a[0], res[I + 1] - arm.a[1], res[I + 2] - arm.a[2]];
          const u = r[0] * ax[0] + r[1] * ax[1] + r[2] * ax[2];
          const c = [arm.a[0] + ax[0] * u, arm.a[1] + ax[1] * u, arm.a[2] + ax[2] * u];
          const toBody = [-c[0], 0, -c[2]];
          const k = toBody[0] * ax[0] + toBody[2] * ax[2];
          const n0 = [toBody[0] - ax[0] * k, -ax[1] * k, toBody[2] - ax[2] * k];
          const l1 = Math.hypot(n0[0], n0[1], n0[2]) || 1;
          const n1 = n0.map((v) => v / l1);
          const n2 = [ax[1] * n1[2] - ax[2] * n1[1], ax[2] * n1[0] - ax[0] * n1[2], ax[0] * n1[1] - ax[1] * n1[0]];
          const d = [r[0] - ax[0] * u, r[1] - ax[1] * u, r[2] - ax[2] * u];
          const df = near(q, sf), db = near(q, sb);
          return { e, u, c, n1, n2, rho: Math.hypot(d[0], d[1], d[2]), th: Math.atan2(d[0] * n2[0] + d[1] * n2[1] + d[2] * n2[2], d[0] * n1[0] + d[1] * n1[1] + d[2] * n1[2]), s: df / (df + db || 1), t: (q.y - y0) / H };
        });
        // Which way round the cut runs.
        let dir = 0;
        for (const c of cyl) if (c.s > 0.15 && c.s < 0.35 && c.t > 0.4) dir += Math.sign(c.th);
        const sg = dir >= 0 ? 1 : -1;
        const T0 = knob('__soT0') ?? 0.15;
        // (Clear of the armhole, which is sewn to the bodice and stays where it hangs.)
        const ah = (p.mesh.runs.armhole ?? []).flat();
        const wOf = cyl.map((c, i) => {
          const off = Math.min(c.s, 1 - c.s) * TAU;
          return (
            Math.min(1, near(pts[i], ah) / (knob('__soAh') ?? 1.5)) *
            Math.min(1, Math.max(0, (c.t - T0) / 0.1)) *
            Math.min(1, Math.max(0, (0.97 - c.t) / 0.05)) *
            Math.min(1, Math.max(0, 1 - (off - (knob('__soA') ?? 1.3)) / (knob('__soF') ?? 0.4)))
          );
        });
        cyl.forEach((c, i) => {
          const w = wOf[i];
          if (!w) return;
          // Out from the arm as far as the cloth beside it, along the arm, on this side.
          let m = 0, n = 0;
          cyl.forEach((o, j) => {
            if (wOf[j] < 0.5 || Math.abs(o.u - c.u) > 1.5) return;
            m += o.rho;
            n++;
          });
          const rho = n ? m / n : c.rho;
          // Spread evenly round from where the sim's own drape takes over on one side, past the seam, to the other,
          // so the two meet.
          const off = Math.min(c.s, 1 - c.s) * TAU, front = c.s < 0.5;
          const ob = (knob('__soA') ?? 1.3) + (knob('__soF') ?? 0.4);
          const bnd = [0, 0, 0, 0];
          for (const o of cyl) {
            const oo = Math.min(o.s, 1 - o.s) * TAU;
            if (Math.abs(o.u - c.u) > 1.5 || Math.abs(oo - ob) > 0.25) continue;
            const f2 = o.s < 0.5 ? 0 : 2;
            bnd[f2] += o.th;
            bnd[f2 + 1]++;
          }
          if (!bnd[1] || !bnd[3]) return;
          const tF = bnd[0] / bnd[1];
          let tB = bnd[2] / bnd[3];
          // (The short way round, through the seam.)
          if (sg > 0 && tB > tF) tB -= TAU;
          if (sg < 0 && tB < tF) tB += TAU;
          let thp = tB + ((tF - tB) * (front ? ob + off : ob - off)) / (2 * ob);
          if (thp > Math.PI) thp -= TAU;
          if (thp < -Math.PI) thp += TAU;
          let dth = thp - c.th;
          if (dth > Math.PI) dth -= TAU;
          if (dth < -Math.PI) dth += TAU;
          const th = c.th + dth * w, R = c.rho + (rho - c.rho) * w;
          const I = (p.base + i) * 3;
          const v = [0, 1, 2].map((k) => c.c[k] + R * (Math.cos(th) * c.n1[k] + Math.sin(th) * c.n2[k]));
          res[I] = v[0] * c.e;
          res[I + 1] = v[1];
          res[I + 2] = v[2];
        });
      }
  }
  // (A dress's bodice seams and darts closed exactly at the end: the passes above leave a sewn point a hair off the
  // edge it is sewn to, and the gap showed as dark specks down the side seam and at the foot of the dart.)
  if (extra.skirt?.length && !knob('__noBodClose')) {
    const own = new Set<number>();
    for (const p of B.panels) if (!p.hidden && (p.role === 'front' || p.role === 'back')) p.mesh.pts.forEach((_, i) => own.add(p.base + i));
    for (let it = 0; it < 4; it++)
    for (const s of seams) {
      if (!own.has(s.i) || !own.has(s.j) || !own.has(s.k)) continue;
      for (let d = 0; d < 3; d++) {
        const e = res[s.j * 3 + d] + (res[s.k * 3 + d] - res[s.j * 3 + d]) * s.t;
        const m = (res[s.i * 3 + d] + e) / 2;
        const dd = m - e;
        res[s.i * 3 + d] = m;
        res[s.j * 3 + d] += dd * (1 - s.t);
        res[s.k * 3 + d] += dd * s.t;
      }
    }
  }
  // (A bodice's sleeve met to its armhole at the end: the sleeve passes above leave its cap up to a cm off the armhole
  // at the underarm and the shoulder, and the gap showed as a dark hole beside the bust from the side, the film's
  // snakeskin dress, Nov 8. Each point of the sleeve's armhole edge is laid on the nearest point of the bodice's
  // armhole, and its move carried into the sleeve, fading out over a few cm.)
  const bodArm = B.panels.filter((p) => !p.hidden && /bodice/i.test(p.pc.name) && p.mesh.runs.armhole?.length);
  if (bodArm.length && !knob('__noArmClose')) {
    const segs: [number, number][] = [];
    for (const p of bodArm) for (const r of p.mesh.runs.armhole) for (let k = 1; k < r.length; k++) segs.push([p.base + r[k - 1], p.base + r[k]]);
    const onArm = (X: number[]) => {
      let best = X, bd = Infinity;
      for (const [a, b] of segs) {
        const A = [res[a * 3], res[a * 3 + 1], res[a * 3 + 2]], Bv = [res[b * 3], res[b * 3 + 1], res[b * 3 + 2]];
        const ab = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]];
        const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1e-9;
        const t = Math.max(0, Math.min(1, ((X[0] - A[0]) * ab[0] + (X[1] - A[1]) * ab[1] + (X[2] - A[2]) * ab[2]) / L2));
        const Q = [A[0] + ab[0] * t, A[1] + ab[1] * t, A[2] + ab[2] * t];
        const d = Math.hypot(Q[0] - X[0], Q[1] - X[1], Q[2] - X[2]);
        if (d < bd) [bd, best] = [d, Q];
      }
      return { Q: best, d: bd };
    };
    const R = knob('__armR') ?? 4;
    for (const p of B.panels.filter((q) => !q.hidden && q.role === 'sleeve' && q.mesh.runs.armhole?.length)) {
      const edge = p.mesh.runs.armhole.flat();
      const moves = new Map<number, number[]>();
      for (const e of edge) {
        const I = (p.base + e) * 3;
        const { Q, d } = onArm([res[I], res[I + 1], res[I + 2]]);
        // (Only a gap: a point already on the armhole, or one far off it, a sleeve this pass does not know, is left.)
        if (d < 0.15 || d > 3) continue;
        moves.set(e, [Q[0] - res[I], Q[1] - res[I + 1], Q[2] - res[I + 2]]);
      }
      if (!moves.size) continue;
      const pts = p.mesh.pts;
      pts.forEach((q, i) => {
        let wS = 0;
        const dv = [0, 0, 0];
        let near = 0;
        for (const [e, m] of moves) {
          const w = Math.max(0, 1 - Math.hypot(pts[e].x - q.x, pts[e].y - q.y) / R);
          if (w <= 0) continue;
          wS += w * w;
          near = Math.max(near, w);
          for (let k = 0; k < 3; k++) dv[k] += m[k] * w * w;
        }
        if (!wS) return;
        const f = moves.has(i) ? 1 : near;
        for (let k = 0; k < 3; k++) res[(p.base + i) * 3 + k] += (dv[k] / wS) * f;
      });
    }
  }
  const lines: Draped['lines'] = [];
  for (const p of B.panels) {
    if (p.hidden) continue;
    for (const tag of Object.keys(p.mesh.runs)) for (const r of p.mesh.runs[tag]) lines.push({ kind: tag, ids: r.map((i) => i + p.base) });
    // A new seam drawn across a piece (Draw a line, a new piece sewn back in, round 3): the mesh point nearest each step
    // along it, drawn as a yoke seam.
    for (const ln of p.pc.lines) {
      if (ln.tags[0] !== 'newseam') continue;
      // (Every other step, about the mesh's own spacing, so the line runs on rather than zigzags between rows. A piece
      // cut on the fold and sewn whole has the seam on both halves: the mirrored line is drawn too where the cloth is.)
      const steps = ln.points(1).filter((_, k, all) => k % 2 === 0 || k === all.length - 1);
      for (const flip of [1, -1]) {
        const ids: number[] = [];
        let found = 0;
        for (const q of steps) {
          let best = -1;
          let bd = 1.6;
          p.mesh.pts.forEach((m, i) => {
            const d = Math.hypot(m.x - q.x * flip, m.y - q.y);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          if (best >= 0) found++;
          if (best >= 0 && ids[ids.length - 1] !== best + p.base) ids.push(best + p.base);
        }
        if (ids.length > 2 && found >= steps.length * 0.8) lines.push({ kind: 'yoke', ids });
      }
    }
    // A pressed pleat's fold edge, from where it is stitched down to the hem: the point nearest it in each row.
    const folds = p.pc.meta.pleatFolds as PleatFold[] | undefined;
    if (folds) {
      const rows = new Map<number, number[]>();
      p.mesh.pts.forEach((q, i) => {
        if (q.y < folds[0].hip.y - 4) return;
        const k = Math.round(q.y / 3);
        rows.set(k, [...(rows.get(k) ?? []), i]);
      });
      // (In bands 3 cm deep, the one point nearest the fold in each: the mesh is too fine for its rows to line up.)
      const ks = [...rows.keys()].sort((a, b) => a - b);
      for (const f of folds) {
        const ids: number[] = [];
        for (const k of ks) {
          const row = rows.get(k)!;
          // (On the fold's own side, where the cloth stands proudest, so the line shows rather than dips under.)
          const d = (v: number) => {
            const dx = p.mesh.pts[v].x - foldAt(f, p.mesh.pts[v].y);
            return (dx < -0.05 ? 9 : dx) + Math.abs(p.mesh.pts[v].y - k * 3) * 0.3;
          };
          const best = row.reduce((u, v) => (d(v) < d(u) ? v : u));
          const x = foldAt(f, p.mesh.pts[best].y);
          if (Math.abs(p.mesh.pts[best].x - x) < 1.2 && ids[ids.length - 1] !== best + p.base) ids.push(best + p.base);
        }
        if (ids.length > 2) lines.push({ kind: 'pleat', ids });
      }
    }
  }
  // (A collar laid open is eased to its cut lengths last, after the passes above have moved what it is laid on.)
  const settle = () => {
    for (const [p, held, reanchor] of toRelax) {
      // (A collar on a stand that has just eased: its seam edge put back on the stand's top edge first.)
      if (reanchor) {
        const before = held.map((j) => [0, 1, 2].map((k) => res[(p.base + j) * 3 + k]));
        reanchor();
        // (The rest of it moved with its seam edge: each point by the move of the nearest point of that edge.)
        const moved = held.map((j, n) => [0, 1, 2].map((k) => res[(p.base + j) * 3 + k] - before[n][k]));
        const hs = new Set(held);
        p.mesh.pts.forEach((q, i) => {
          if (hs.has(i)) return;
          let b = 0;
          let bd = Infinity;
          held.forEach((j, n) => {
            const dd = Math.hypot(p.mesh.pts[j].x - q.x, p.mesh.pts[j].y - q.y);
            if (dd < bd) {
              bd = dd;
              b = n;
            }
          });
          for (let k = 0; k < 3; k++) res[(p.base + i) * 3 + k] += moved[b][k];
        });
      }
      relax(p, held);
    }
  };
  settle();
  // (Where it lies, it lies on the shirt: each such point put out onto the shirt's own surface there, by as much as it
  // lies, then eased to its cut lengths again.)
  if (toRelax.length && lieOf.size && !knob('__noLieOn')) {
    const NA = 180;
    const binOf = (a: number, y: number) => Math.round(((a + Math.PI) / TAU) * NA) * 10000 + Math.round(y * 2);
    const shell = new Map<number, number>();
    for (const p of B.panels) {
      if ((p.role !== 'front' && p.role !== 'back') || p.hidden) continue;
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        const k = binOf(Math.atan2(res[I], res[I + 2]), res[I + 1]);
        shell.set(k, Math.max(shell.get(k) ?? 0, Math.hypot(res[I], res[I + 2]) + (p.turned[i] ? p.thick[i] : 0)));
      });
    }
    const shellAt = (a: number, y: number): number | undefined => {
      let best: number | undefined;
      for (let da = -2; da <= 2; da++)
        for (let dy = -2; dy <= 2; dy++) {
          const v = shell.get(binOf(a + (da * TAU) / NA, y + dy / 2));
          if (v !== undefined) best = Math.max(best ?? 0, v);
        }
      return best;
    };
    for (let round = 0; round < (knob('__lieRounds') ?? 8); round++) {
      for (const [g, [w, off]] of lieOf) {
        const I = g * 3;
        const a = Math.atan2(res[I], res[I + 2]);
        const R = shellAt(a, res[I + 1]);
        if (R === undefined) continue;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const want = R + off;
        const k = (rho + (want - rho) * Math.min(1, w * (knob('__lieK') ?? 1.5))) / rho;
        res[I] *= k;
        res[I + 2] *= k;
      }
      settle();
      // (Its free edge drawn as a smooth line, as pressed, not with the mesh's stagger.)
      for (const [p] of toRelax)
        for (const run of p.mesh.runs.collar ?? [])
          for (let it = 0; it < (knob('__lieEdge') ?? 20); it++)
            for (let k = 1; k + 1 < run.length; k++) {
              const [A, I, C] = [run[k - 1], run[k], run[k + 1]].map((j) => (p.base + j) * 3);
              for (let d = 0; d < 3; d++) res[I + d] += ((res[A + d] + res[C + d]) / 2 - res[I + d]) * 0.5;
            }
    }
  }
  // (Laid open, the stand and collar are each drawn as one smooth band, not rippled: every point eased toward the
  // middle of its neighbours (with a step back each other time, so the band keeps its depth), the seam each is sewn
  // by held; then its edges drawn smooth, and eased back to its cut lengths.)
  if (toRelax.length) {
    for (const [p, held] of toRelax) {
      // (Not an open polo's collar, laid flat on the shirt as cut: smoothed, its fall drew in to half its depth.)
      if (p.pc.meta.polo) continue;
      const hs = new Set(held);
      const nb = p.mesh.pts.map(() => new Set<number>());
      for (const t of p.mesh.tris)
        for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
          nb[u].add(v);
          nb[v].add(u);
        }
      for (let it = 0; it < (knob('__surfSm') ?? 60); it++) {
        const lam = it % 2 ? -0.53 : 0.5;
        const nx = Float64Array.from(res.subarray(p.base * 3, (p.base + p.mesh.pts.length) * 3));
        p.mesh.pts.forEach((_, i) => {
          if (hs.has(i) || !nb[i].size) return;
          for (let d = 0; d < 3; d++) {
            let m = 0;
            for (const j of nb[i]) m += res[(p.base + j) * 3 + d];
            nx[i * 3 + d] = res[(p.base + i) * 3 + d] + (m / nb[i].size - res[(p.base + i) * 3 + d]) * lam;
          }
        });
        res.set(nx, p.base * 3);
      }
    }
    settle();
    for (const [p] of toRelax.filter(([q]) => !q.pc.meta.polo))
      for (const run of [...(p.mesh.runs.collar ?? []), ...(p.mesh.runs.stand ?? [])])
        for (let it = 0; it < (knob('__lieEdge') ?? 20); it++)
          for (let k = 1; k + 1 < run.length; k++) {
            const [A, I, C] = [run[k - 1], run[k], run[k + 1]].map((j) => (p.base + j) * 3);
            for (let d = 0; d < 3; d++) res[I + d] += ((res[A + d] + res[C + d]) / 2 - res[I + d]) * 0.5;
          }
    settle();
  }
  // (An open polo's collar closes at the centre back over the zip: eased to its cut lengths, its fall drew a hair off
  // the centre plane and the two halves parted in a slot there. Its centre back edge is put back on it, and the cloth
  // beside it with it.)
  for (const p of B.panels) {
    if (p.role !== 'collar' || p.hidden || !p.pc.meta.polo || o.rollFront || knob('__noPoloCB')) continue;
    const pts = p.mesh.pts;
    const x0 = Math.min(...pts.map((q) => q.x));
    const cb = pts.map((q, i) => [q, i] as const).filter(([q]) => q.x - x0 < 0.05);
    if (!cb.length) continue;
    const off = cb.map(([q, i]) => [q.y, res[(p.base + i) * 3]] as const);
    pts.forEach((q, i) => {
      const u = q.x - x0;
      const W = knob('__cbW') ?? 5;
      if (u >= W) return;
      let best = off[0];
      for (const c of off) if (Math.abs(c[0] - q.y) < Math.abs(best[0] - q.y)) best = c;
      res[(p.base + i) * 3] -= best[1] * (1 - u / W);
    });
  }
  // (Behind, its outer edge, where it crosses the shoulder seam, stood a little off the shirt and showed the dark of its
  // underside: the cloth near that edge is put down onto the shirt under it, less so further in from the edge. In
  // front, where it already lies, left as it is.)
  if (!o.rollFront && !knob('__noPoloEdge'))
    for (const p of B.panels) {
      if (p.role !== 'collar' || p.hidden || !p.pc.meta.polo) continue;
      const pts = p.mesh.pts;
      const edge = (p.mesh.runs.collar ?? []).flat();
      if (!edge.length) continue;
      const shirt: number[] = [];
      for (const q of B.panels) if ((q.role === 'front' || q.role === 'back') && !q.hidden) q.mesh.pts.forEach((_, i) => shirt.push((q.base + i) * 3));
      const W = knob('__poloEdgeW') ?? 1.5;
      const gapMax = knob('__poloEdgeGap') ?? 0.2;
      // (Each edge point's move down onto the shirt, taken smooth along the edge, so the edge stays one clean line.)
      const mv = new Map<number, number[]>();
      for (const run of p.mesh.runs.collar ?? []) {
        const raw = run.map((j) => {
          const I = (p.base + j) * 3;
          let bd = Infinity;
          let bJ = -1;
          for (const J of shirt) {
            const d = Math.hypot(res[J] - res[I], res[J + 1] - res[I + 1], res[J + 2] - res[I + 2]);
            if (d < bd) [bd, bJ] = [d, J];
          }
          if (bJ < 0 || bd <= gapMax || bd > (knob('__poloEdgeR') ?? 2.5) || res[I + 2] > (knob('__poloEdgeZ') ?? 0)) return [0, 0, 0];
          const k = 1 - gapMax / bd;
          return [0, 1, 2].map((d) => (res[bJ + d] - res[I + d]) * k);
        });
        let sm = raw;
        for (let it = 0; it < (knob('__poloEdgeSm') ?? 12); it++)
          sm = sm.map((v, k) => v.map((x, d) => (sm[Math.max(0, k - 1)][d] + 2 * x + sm[Math.min(sm.length - 1, k + 1)][d]) / 4));
        run.forEach((j, k) => mv.set(j, sm[k]));
      }
      pts.forEach((q, i) => {
        let e = Infinity;
        let m: number[] | undefined;
        for (const [j, v] of mv) {
          const d = Math.hypot(pts[j].x - q.x, pts[j].y - q.y);
          if (d < e) [e, m] = [d, v];
        }
        if (!m || e >= W) return;
        const I = (p.base + i) * 3;
        for (let d = 0; d < 3; d++) res[I + d] += m[d] * (1 - e / W);
      });
    }
  // (Buttoned, the button stand past the centre front lies over the other front, as that front lies there: not folded
  // back on its own side in a keel down the buttons.)
  if (o.closedFront && !o.pinFront?.length && !o.rollFront && !knob('__noStandLie')) {
    for (const p of B.panels) {
      if (p.role !== 'front' || p.hidden || !p.mesh.runs.opening) continue;
      const pts = p.mesh.pts;
      // (Only where it has folded back: over onto its own side of the centre.)
      const top = Math.min(...p.mesh.runs.opening.flat().map((i) => pts[i].y)) + 2;
      pts.forEach((q, i) => {
        if (q.x > -0.6 || p.turned[i] || q.y < top) return;
        const I = (p.base + i) * 3;
        const u = surfaceAt(p, { x: -q.x, y: q.y }, false);
        if (!u) return;
        const rho = Math.hypot(u[0], u[2]) || 1e-9;
        const k = (rho + (knob('__standOff') ?? 0.15)) / rho;
        res[I] = -u[0] * k;
        res[I + 1] = u[1];
        res[I + 2] = u[2] * k;
      });
    }
  }
  // A skirt gathered onto a yoke hangs from the yoke's hem: its top drawn back onto the seam it is sewn to, the cloth
  // below coming with it over a hand's width (each pass above moved one side of that seam alone, and left it open).
  const gwD = knob('__gatherWeld') ?? 10;
  if (gwD > 0)
    for (const p of B.panels) {
      if (p.hidden || !/peplum/.test(p.role) || (((p.pc.meta.gatherShown ?? p.pc.meta.gathered) as number | undefined) ?? 1) <= 1.05) continue;
      const lo = p.base;
      const hi = p.base + p.mesh.pts.length;
      const disp = new Map<number, V3>();
      for (const { i, j, k, t } of seams) {
        if (i < lo || i >= hi || (j >= lo && j < hi)) continue;
        const own = B.panels.find((q) => j >= q.base && j < q.base + q.mesh.pts.length);
        if (!own || !/yoke/i.test(own.pc.name)) continue;
        disp.set(i - lo, [0, 1, 2].map((d) => res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t - res[i * 3 + d]) as V3);
      }
      if (!disp.size) continue;
      const pts = p.mesh.pts;
      const mv: [number, V3][] = [];
      pts.forEach((q, i) => {
        const own = disp.get(i);
        if (own) return mv.push([i, own]);
        let sw = 0;
        let dmin = Infinity;
        const acc: V3 = [0, 0, 0];
        for (const [j, v] of disp) {
          const dd = Math.hypot(pts[j].x - q.x, pts[j].y - q.y);
          dmin = Math.min(dmin, dd);
          const w = 1 / (dd * dd + 0.01);
          sw += w;
          for (let c = 0; c < 3; c++) acc[c] += w * v[c];
        }
        if (dmin >= gwD) return;
        const f = (1 - dmin / gwD) ** 2;
        mv.push([i, acc.map((v) => (v / sw) * f) as V3]);
      });
      for (const [i, v] of mv) {
        const I = (p.base + i) * 3;
        // (Its centre line stays on the centre, so the two halves never part.)
        const onCentre = Math.abs(res[I]) < 0.6;
        for (let c = 0; c < 3; c++) if (!(onCentre && c === 0)) res[I + c] += v[c];
      }
    }
  if (extra.trousers) layLegRuffle(B, res);
  // Buttons on the centre front, where the cloth lies there.
  const buttons: Draped['buttons'] = [];
  const f0 = front.find((p) => p.role === 'front');
  if (o.buttons && f0) {
    // (A double-breasted front's in its two columns, either side of the centre, where the pattern puts them: all down
    // the centre, it read as a single-breasted jacket with a lapel too wide for it.)
    const cols = o.buttons.x?.length && !knob('__btnCentre') ? o.buttons.x : [0];
    const nearest = (tx: number, ty: number) => {
      let best = -1;
      let bd = Infinity;
      f0.mesh.pts.forEach((q, i) => {
        if (f0.turned[i]) return;
        const dd = Math.hypot(q.x - tx, q.y - ty);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      return best;
    };
    for (const y of o.buttons.y) for (const cx of cols) {
      const i = nearest(cx, y);
      if (i < 0) continue;
      const I = (f0.base + i) * 3;
      // (Buttoned, its buttonhole lies closed under it, out of sight, so none is drawn.)
      if (cols.length < 2) {
        buttons.push({ at: [0, res[I + 1], res[I + 2] + 0.4], r: o.buttons.r });
        continue;
      }
      // (The column over the extension where the cloth lies as the other side of the centre does, a cloth's thickness
      // out: at the top button, just under the break, the extension rolls out a little with the lapel, and a button
      // placed on it stood out on the front edge, Nov 10.)
      const m = nearest(Math.abs(cx), y);
      const J = (f0.base + Math.max(0, m)) * 3;
      const sideOk = cx > 0 || m < 0 || Math.abs(Math.abs(res[I]) - Math.abs(res[J])) < 1.5;
      buttons.push({ at: sideOk ? [res[I], res[I + 1], res[I + 2] + 0.4] : [-Math.abs(res[J]), res[J + 1], res[J + 2] + f0.thick[m] + 0.5], r: o.buttons.r });
    }
    // (The pair for show above them: each on its own front's side, the one across the centre on the under front where
    // the top front's lapel has turned back off it, so placed as the other side of the centre lies.)
    if (o.buttons.show)
      for (const cx of o.buttons.show.x) {
        const m = nearest(Math.abs(cx), o.buttons.show.y);
        if (m < 0) continue;
        const J = (f0.base + m) * 3;
        buttons.push({ at: [Math.sign(cx) * Math.abs(res[J]), res[J + 1], res[J + 2] + 0.4], r: o.buttons.r });
      }
  }
  setKnob("__seams", seams);
  // (A gathered skirt's centre front and back, cut on the fold: the fullness either side crowded the centre line and
  // folded the cloth next to it back on itself in a keel down to the hem. The cloth near the centre is eased smooth, the
  // centre line kept on the centre.)
  // (Its side seams first closed: the folds laid on each piece left its edge standing a little off the other's there,
  // a step down the seam with a shadow behind it. Each pair of seam points is put on their middle.)
  if (!knob('__noCentreSmooth') && !knob('__noSideSnap')) {
    const gs = B.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && !p.pc.meta.tier && ((p.pc.meta.gathered as number | undefined) ?? 0) > 1.05);
    const ids = (role: RegExp) => gs.filter((p) => role.test(p.role)).flatMap((p) => (p.mesh.runs.side ?? []).flat().map((i) => p.base + i));
    const F = [...new Set(ids(/front/))];
    const Bk = [...new Set(ids(/back/))];
    // (Closed by the seam as sewn, each point to its place on the other piece's edge, both ways and halfway each time.
    // Pairing each front point with the nearest back point put two front points on one back point where the front's
    // mesh is the finer, and left the seam a sawtooth down a dress's gathered skirt: 47 teeth, All round quality
    // 2026-11-04. The skirt alone, its back the finer, passed by luck of which piece was meshed finer.)
    if (!knob('__oldSnap')) {
      const onF = new Set(F);
      const onB = new Set(Bk);
      const across = seams.filter(({ i, j, k }) => (onF.has(i) && onB.has(j) && onB.has(k)) || (onB.has(i) && onF.has(j) && onF.has(k)));
      for (let it = 0; it < 4; it++)
        for (const { i, j, k, t } of across)
          for (let d = 0; d < 3; d++) {
            const target = res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t;
            res[i * 3 + d] += (target - res[i * 3 + d]) * 0.5;
          }
    } else
      for (const f of F) {
        let best = -1;
        let bd = knob('__snapR') ?? 1.5;
        for (const b of Bk) {
          const d = Math.hypot(res[f * 3] - res[b * 3], res[f * 3 + 1] - res[b * 3 + 1], res[f * 3 + 2] - res[b * 3 + 2]);
          if (d < bd) [bd, best] = [d, b];
        }
        if (best < 0) continue;
        for (let d = 0; d < 3; d++) {
          const m = (res[f * 3 + d] + res[best * 3 + d]) / 2;
          res[f * 3 + d] = m;
          res[best * 3 + d] = m;
        }
      }
    // (Then the seam itself run smooth down its length: the two pieces' points along it, set at their own spacings,
    // were paired unevenly and left the seam in small bumps, drawn as a ragged edge down the side.)
    const all = [...F, ...Bk];
    const top = Math.min(...all.map((i) => res[i * 3 + 1]));
    const sig = knob('__sideSig') ?? 1.5;
    for (let it = 0; it < (knob('__sideIt') ?? 4); it++) {
      const nx = all.map((i) => {
        let w = 0;
        const m = [0, 0, 0];
        for (const j of all) {
          const dy = res[j * 3 + 1] - res[i * 3 + 1];
          if (Math.abs(dy) > 3 * sig) continue;
          const k = Math.exp(-(dy * dy) / (2 * sig * sig));
          w += k;
          for (let d = 0; d < 3; d++) m[d] += res[j * 3 + d] * k;
        }
        // (Not up by the waist, where it is sewn to the bodice; nor the hem's level.)
        const a = Math.min(1, Math.max(0, (res[i * 3 + 1] - top - 1) / 4));
        return [0, 2].map((d) => res[i * 3 + d] + (m[d] / w - res[i * 3 + d]) * a);
      });
      all.forEach((i, k) => {
        res[i * 3] = nx[k][0];
        res[i * 3 + 2] = nx[k][1];
      });
    }
  }
  if (!knob('__noCentreSmooth'))
    for (const p of B.panels) {
      if (p.hidden || !/peplum/.test(p.role) || !((p.pc.meta.gathered as number | undefined) ?? 0)) continue;
      const pts = p.mesh.pts;
      // (And either side of its side seams, which the folds there drew into a groove: the seam itself held, so the
      // pieces still meet.)
      const sideS = new Set(knob('__noCsSide') ? [] : (p.mesh.runs.side ?? []).flat());
      const cl = [...(p.mesh.runs.fold ?? []), ...(p.mesh.runs.centre ?? []), ...sideS].flat();
      if (!cl.length) continue;
      const onC = new Set(cl);
      const top = Math.min(...pts.map((q) => q.y));
      const W = knob('__csW') ?? 5;
      const wOf = pts.map((q) => {
        let e = Infinity;
        for (const j of cl) e = Math.min(e, Math.hypot(pts[j].x - q.x, pts[j].y - q.y));
        // (Not up by the waist, where the gathers are sewn.)
        return e < W ? (1 - e / W) * Math.min(1, Math.max(0, (q.y - top - (knob('__csTop') ?? 10)) / (knob('__csRamp') ?? 25))) : 0;
      });
      const waist = new Set((p.mesh.runs.waist ?? p.mesh.runs.top ?? []).flat());
      // (The hem keeps its level: eased only round, not up.)
      const hemS = new Set((p.mesh.runs.hem ?? []).flat());
      const nb = pts.map(() => new Set<number>());
      for (const t of p.mesh.tris)
        for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
          nb[u].add(v);
          nb[v].add(u);
        }
      for (let it = 0; it < (knob('__csIt') ?? 30); it++) {
        const nx = Float64Array.from(res.subarray(p.base * 3, (p.base + pts.length) * 3));
        const lam = knob('__csTaubin') && it % 2 ? -0.53 : 0.5;
        pts.forEach((_, i) => {
          if (!wOf[i] || waist.has(i) || sideS.has(i) || !nb[i].size) return;
          for (let d = 0; d < 3; d++) {
            if ((d === 0 && onC.has(i)) || (d === 1 && hemS.has(i))) continue;
            // (On the centre line its neighbours across the fold count too, the mirror of those this side, so the cloth
            // runs over the fold smoothly rather than meeting its mirror at an angle.)
            const mir = onC.has(i) && !sideS.has(i) && !knob('__noMirC');
            let m = 0, n = 0;
            for (const j of nb[i]) {
              const k = mir && !onC.has(j) ? 2 : 1;
              m += res[(p.base + j) * 3 + d] * k;
              n += k;
            }
            nx[i * 3 + d] = res[(p.base + i) * 3 + d] + (m / n - res[(p.base + i) * 3 + d]) * lam * wOf[i];
          }
        });
        res.set(nx, p.base * 3);
      }
      // (Down each fold, even: the sim left a gathered skirt's fold crests zigzagging from one row of the mesh to the
      // next, which drew as a serrated edge where a fold turns from the light. Each point is eased round toward its
      // neighbours above and below only, so the folds keep their depth and the hem its level.)
      if (!knob('__noFoldRun')) {
        // (Its nearest neighbour above and below in the cut, each as near straight up or down as the mesh has: the
        // point eased to their middle. Both are needed, or a point pulled one way only stood out as a bead.)
        const pair = pts.map((q, i) => {
          const A = new Map<number, number>(), Bw = new Map<number, number>();
          for (const t of p.mesh.tris) {
            if (!t.includes(i)) continue;
            for (const j of t) {
              if (j === i) continue;
              const dx = pts[j].x - q.x, dy = pts[j].y - q.y;
              const c = ((dy * dy) / (dx * dx + dy * dy || 1)) ** 2;
              if (c < 0.2) continue;
              (dy > 0 ? A : Bw).set(j, c);
            }
          }
          return A.size && Bw.size ? [[...A], [...Bw]] : null;
        });
        const side = (lst: [number, number][], d: number) => {
          let m = 0, w = 0;
          for (const [j, c] of lst) {
            m += res[(p.base + j) * 3 + d] * c;
            w += c;
          }
          return m / w;
        };
        for (let it = 0; it < (knob('__frIt') ?? 20); it++) {
          const nx = Float64Array.from(res.subarray(p.base * 3, (p.base + pts.length) * 3));
          pts.forEach((q, i) => {
            const pr = pair[i];
            if (!pr || waist.has(i) || sideS.has(i)) return;
            const w = Math.min(1, Math.max(0, (q.y - top - 2) / 8));
            if (!w) return;
            for (const d of [0, 2]) {
              if (d === 0 && onC.has(i)) continue;
              const m = (side(pr[0] as [number, number][], d) + side(pr[1] as [number, number][], d)) / 2;
              nx[i * 3 + d] = res[(p.base + i) * 3 + d] + (m - res[(p.base + i) * 3 + d]) * 0.5 * w;
            }
          });
          res.set(nx, p.base * 3);
        }
        // (Points where the mesh is not a plain lattice have no true above and below: those eased to all their
        // neighbours instead, so none is left standing out.)
        for (let it = 0; it < (knob('__frIrr') ?? 6); it++)
          pts.forEach((q, i) => {
            if (waist.has(i) || sideS.has(i) || onC.has(i) || hemS.has(i) || nb[i].size === 6 || !nb[i].size) return;
            if (q.y - top < 2) return;
            for (const d of [0, 2]) {
              let m = 0;
              for (const j of nb[i]) m += res[(p.base + j) * 3 + d];
              res[(p.base + i) * 3 + d] = m / nb[i].size;
            }
          });
      }
      // (And the centre line no further in than the cloth beside it: drawn in on the body, it showed as a cleft.)
      // (Only by the centre line: by a side seam the same push raised small beads down the seam.)
      const cOnly = [...(p.mesh.runs.fold ?? []), ...(p.mesh.runs.centre ?? [])].flat();
      const byC = pts.map((q) => {
        if (knob('__csFillSide')) return true;
        let e = Infinity;
        for (const j of cOnly) e = Math.min(e, Math.hypot(pts[j].x - q.x, pts[j].y - q.y));
        return e < W;
      });
      for (let it = 0; it < (knob('__csFill') ?? 20); it++) {
        const rho = pts.map((_, i) => Math.hypot(res[(p.base + i) * 3], res[(p.base + i) * 3 + 2]));
        pts.forEach((_, i) => {
          if (!wOf[i] || !byC[i] || waist.has(i) || sideS.has(i) || !nb[i].size) return;
          let m = 0;
          for (const j of nb[i]) m += rho[j];
          m /= nb[i].size;
          if (m <= rho[i]) return;
          const I = (p.base + i) * 3;
          res[I] *= m / (rho[i] || 1e-9);
          res[I + 2] *= m / (rho[i] || 1e-9);
        });
      }
    }
  // (A balloon peplum's outer is gathered at the waist, so the side and centre smoothing above ease it like any gathered
  // peplum, and took its hem up to 6 cm off the underskirt's hem it is sewn to, 2026-11-06: set back on it.)
  for (const p of outerB) if (underB.length) seatOn(p, 'balloon', 8);
  if (outerB.length && underB.length && !knob('__noBalloonClose')) closeBalloonHem(res, seams, outerB, underB);
  // (A dress's bodice under a full skirt: what the passes above leave stretched by the skirt's weight, eased back to
  // near its cut lengths, its seams held.)
  if (extra.skirt?.length && !knob('__noBodiceRelax'))
    for (const p of B.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      const held = [...new Set([...Object.values(p.mesh.runs).flatMap((rs) => rs.flat()), ...p.mesh.pts.map((_, i) => i).filter((i) => sewn[p.base + i])])];
      const g = globalThis as unknown as Record<string, number | undefined>;
      const keepIt = g.__relaxIt;
      const keepTo = g.__relaxTo;
      g.__relaxIt = knob('__brIt') ?? 200;
      g.__relaxTo = knob('__brTo') ?? 1.2;
      relax(p, held);
      g.__relaxIt = keepIt;
      g.__relaxTo = keepTo;
    }
  // (A dress's bodice edge at its waist seam stood a few mm out from the skirt sewn under it, and the gap under its
  // edge drew as dark slivers along the seam: the edge laid down onto the skirt.)
  // (Not under a gathered skirt: its waist edge stands in and out round the body with the gathers, by several cm, and
  // the bodice laid onto it was pulled in and out and down with them, torn along its edge; the gathers cover the seam.)
  const gatheredSkirt = B.panels.some((p) => !p.hidden && /peplum/.test(p.role) && (((p.pc.meta.gathered as number | undefined) ?? 1) > 1.05 || ((p.pc.meta.gatherShown as number | undefined) ?? 1) > 1.05));
  if (extra.skirt?.length && !knob('__noWaistLay') && !gatheredSkirt) {
    const sk = B.panels.filter((p) => !p.hidden && /peplum/.test(p.role) && !p.pc.meta.tier);
    const ring = sk
      .flatMap((p) => (p.mesh.runs.waist ?? []).flat().map((i) => (p.base + i) * 3))
      .map((I) => [Math.atan2(res[I], res[I + 2]), Math.hypot(res[I], res[I + 2]), res[I + 1]] as const);
    if (ring.length) {
      const near = (a: number) => {
        let best = ring[0];
        for (const r of ring) if (Math.abs(r[0] - a) < Math.abs(best[0] - a)) best = r;
        return best;
      };
      const gap = knob('__wlGap') ?? 0.1;
      const R = knob('__wlR') ?? 3;
      // (The skirt's top edge round the body, smooth: by angle, its sewn points' level.)
      const byA = [...ring].sort((u, v) => u[0] - v[0]);
      const yAt = (a: number) => {
        let k = 0;
        while (k < byA.length - 1 && byA[k + 1][0] < a) k++;
        const [a0, , c0] = byA[k];
        const [a1, , c1] = byA[Math.min(byA.length - 1, k + 1)];
        return a1 > a0 ? c0 + (c1 - c0) * Math.min(1, Math.max(0, (a - a0) / (a1 - a0))) : c0;
      };
      // (And its edge down to that, a little over it: where it rode up between the gathers sewn to it, the form showed
      // dark through the notch. The drop is taken smooth round the body, across both pieces and their darts, so the
      // edge stays one line; the cloth above eased down with it.)
      const dn = knob('__wlDown') ?? 0.3;
      const RD = knob('__wlDownR') ?? 4;
      const tp = B.panels.filter((p) => !p.hidden && (p.role === 'front' || p.role === 'back') && p.mesh.runs.waist?.length);
      const all = tp.flatMap((p) => [...new Set(p.mesh.runs.waist!.flat())].map((i) => ({ p, i, a: Math.atan2(res[(p.base + i) * 3], res[(p.base + i) * 3 + 2]) }))).sort((u, v) => u.a - v.a);
      let drop = all.map(({ p, i, a }) => Math.max(0, yAt(a) + dn - res[(p.base + i) * 3 + 1]));
      for (let it = 0; it < (knob('__wlSm') ?? 8); it++) drop = drop.map((v, k) => Math.max(v, (drop[Math.max(0, k - 2)] + drop[Math.max(0, k - 1)] + v + drop[Math.min(drop.length - 1, k + 1)] + drop[Math.min(drop.length - 1, k + 2)]) / 5));
      for (const p of tp) {
        const mine = all.map((u, k) => [u, drop[k]] as const).filter(([u]) => u.p === p);
        p.mesh.pts.forEach((q, i) => {
          let e = Infinity;
          let m = 0;
          for (const [u, v] of mine) {
            const d = Math.hypot(p.mesh.pts[u.i].x - q.x, p.mesh.pts[u.i].y - q.y);
            if (d < e) [e, m] = [d, v];
          }
          if (e < RD) res[(p.base + i) * 3 + 1] += m * (1 - e / RD);
        });
      }
      for (const p of B.panels) {
        if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
        const w = (p.mesh.runs.waist ?? []).flat().map((i) => p.mesh.pts[i]);
        if (!w.length) continue;
        p.mesh.pts.forEach((q, i) => {
          let e = Infinity;
          for (const u of w) e = Math.min(e, Math.hypot(u.x - q.x, u.y - q.y));
          if (e >= R) return;
          const I = (p.base + i) * 3;
          const a = Math.atan2(res[I], res[I + 2]);
          const [, r0, y0] = near(a);
          if (res[I + 1] < y0 - 1) return;
          const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
          // (Nor left under it: tucked inside, the skirt's own top edge stood out over the bodice as a lip, in steps
          // round the side. The bodice edge lies just over the skirt's, either way.)
          if (rho <= r0 + gap && knob('__wlInOnly')) return;
          const k = (rho + (r0 + gap - rho) * (1 - e / R)) / rho;
          res[I] *= k;
          res[I + 2] *= k;
        });
      }
    }
  }
  // A neck ruffle is carried to meet its seam again: the passes above move the neckline it is gathered onto (a V or
  // scoop drawn down to its cut depth) and not the ruffle, which was left standing round the neck 2 to 10 cm above a
  // low front neck (All round quality, 2026-11-07). (The neckline itself is left as it is.)
  if (!knob('__noRufSeat')) for (const p of B.panels) if (p.role === 'collar' && typeof p.pc.meta.ruffle === 'number' && !p.pc.meta.bow) seatOn(p, 'neck', 0, false);
  return { panels: B.panels, pos: res, lines, buttons, seams, ...(shade ? { shade } : {}), ...(posMirror ? { posMirror } : {}) };
}

/** A shirt collar, which rises from its stand and turns down a little above it. */
function shirtCollar(pc: Piece): [P, P] | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const st = pts.filter((_, i) => tags[i] === 'stand');
  if (st.length < 2) return undefined;
  const a = st.reduce((u, v) => (v.x < u.x ? v : u));
  const b = st.reduce((u, v) => (v.x > u.x ? v : u));
  return [
    { x: a.x, y: a.y - 0.6 },
    { x: b.x, y: b.y - 0.6 },
  ];
}

/** An open polo collar (no stand) rolls up off the neck and turns down: its roll line runs from a stand's height
 * above the neck edge at the centre back down to the neck edge at the front, where the slit opens. */
function poloRoll(pc: Piece): [P, P] | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const nk = pts.filter((_, i) => tags[i] === 'neck');
  if (nk.length < 2) return undefined;
  const cb = nk.reduce((u, v) => (v.x < u.x ? v : u));
  const cf = nk.reduce((u, v) => (v.x > u.x ? v : u));
  const stand = knob('__poloStand') ?? 2.5;
  const front = knob('__poloFront') ?? 0.6;
  return [
    { x: cb.x - 1, y: cb.y - stand - ((cf.y - front - (cb.y - stand)) / (cf.x - cb.x || 1)) * 1 },
    { x: cf.x + 1, y: cf.y - front + ((cf.y - front - (cb.y - stand)) / (cf.x - cb.x || 1)) * 1 },
  ];
}

/** A tailored collar's roll line, as worn, holds the stand's height round the back neck to just past the neck point,
 *  then bends down toward the gorge, where the lapel's roll line meets the neck seam: there its stand dies away to
 *  1.5 cm, as the lapel's does. (Run straight on as drafted, it stood 4 to 5 cm at the front end, up beside the neck in a
 *  point; run straight to the gorge, the stand was only 1.5 cm at the side of the neck.) The bend is a second fold line,
 *  from the drafted roll line past the neck point to the gorge end (Cat's "lay them from the pattern", 2026-11-07). */
function bentRoll(pc: Piece, roll: [P, P]): [P, P] {
  const f = pc.meta.fromFront as { E: P; hpsX: number };
  const x = f.hpsX + (f.E.x - f.hpsX) * (knob('__bendAt') ?? 0.25);
  const t = (x - roll[0].x) / (roll[1].x - roll[0].x || 1);
  return [{ x, y: roll[0].y + (roll[1].y - roll[0].y) * t }, { x: f.E.x, y: f.E.y - (knob('__wornStand') ?? 1.5) }];
}

/** A turned collar point's mirror at the roll line it is turned at: past the bend toward the gorge, the bent line. */
function reflectRoll(q: P, roll: [P, P], roll2?: [P, P]): P {
  if (roll2 && q.x > roll2[0].x && (roll2[1].x - roll2[0].x) * (q.y - roll2[0].y) - (roll2[1].y - roll2[0].y) * (q.x - roll2[0].x) < -1e-6) return reflect(q, roll2[0], roll2[1]);
  return reflect(q, roll[0], roll[1]);
}

export function collarsOf(pieces: Piece[], jacketRoll?: [P, P]): CollarPart[] {
  return pieces
    .filter((pc) => pc.kind === 'collar' || pc.meta.hood)
    .map((pc) => (knob('__noCapeSew') ? pc : capeForDrape(pc)))
    .map((pc) => {
      const cl = pc.lines[0]?.points();
      const hasStand = pc.outline.tags.includes('stand');
      const onStand = hasStand && !pc.outline.tags.includes('neck');
      // A neck ruffle is a strip folded along its middle, both edges sewn into the neck: it stands as the doubled
      // half, so the half past the fold turns back over the other.
      const ruffleFold = (): [P, P] | undefined => {
        if (!pc.meta.ruffle || !knob('__ruffleFold')) return undefined;
        const ys = pc.outline.points(2).map((q) => q.y);
        const y = (Math.min(...ys) + Math.max(...ys)) / 2;
        const xs = pc.outline.points(2).map((q) => q.x);
        return [pt(Math.min(...xs) - 1, y), pt(Math.max(...xs) + 1, y)];
      };
      const roll: [P, P] | undefined = pc.outline.tags.includes('gorge') && cl ? [cl[0], knob('__rollEnd') !== undefined ? { x: cl[cl.length - 1].x, y: -knob('__rollEnd')! } : cl[cl.length - 1]] : onStand ? shirtCollar(pc) : pc.meta.polo ? poloRoll(pc) : ruffleFold();
      void jacketRoll;
      const roll2 = roll && pc.meta.fromFront && !knob('__noWornLay') ? bentRoll(pc, roll) : undefined;
      return { pc, roll, onStand, ...(roll2 ? { roll2 } : {}) };
    })
    .sort((x, y) => Number(!!x.onStand) - Number(!!y.onStand));
}

/** Trousers: the hips round the body from the centre front and back, each leg round its own leg from the crease. */
function trouserPanels(sp: Space, B: Builder, seams: SimInput['seams'], d: TrousersDraft, thick: number): SimInput['legs'] {
  const legsM = d as unknown as { crotch?: unknown; kneeCm: number; hemCm: number; lengthCm: number; fullLengthCm?: number };
  // A low (or high) rise is drafted from the line its waistband sits on, that far below (above) the waist: the
  // trousers are hung from there, so the crotch still comes to the body's own.
  const drop = -((d as { riseCm?: number }).riseCm ?? 0);
  const crotchC = drop + Math.max(...d.pieces.filter(isShell).map((pc) => (pc.meta.fork as P | undefined)?.y ?? 26));
  const hipSide = sp.bodyR(Math.PI / 2, crotchC - 4);
  const legX = hipSide * 0.5;
  // Each leg the cloth lies on: a thigh a little over half the hip's half-width round (a thigh is fuller than half a
  // hip; laid on a thinner one the cloth fell in between the legs and creased into fins at a knee-length hem, and a
  // tapered or capri leg tore), tapering to the ankle at the leg's full length whatever the trousers' length. Shorts
  // and a knee length used to end their legs at the hem, tapered to an ankle there, so the cloth fell in on a stick of
  // a thigh.
  const thighR = hipSide * 0.55;
  const legs = { x: legX, c0: crotchC - 2, c1: (legsM.fullLengthCm ?? legsM.lengthCm) + drop, r0: thighR, r1: 3.6 };
  const panels: Panel[] = [];
  // The plain fronts and backs: a slant pocket's cut corner is filled by its facing in the garment, as in the block.
  const block = (d as unknown as { block?: Piece[] }).block;
  for (const pc of (block?.length ? block : d.pieces).filter(isShell)) {
    const back = /back/i.test(pc.name);
    const fork = pc.meta.fork as P;
    const crease = (pc.meta.creaseX as number) ?? fork.x / 2;
    const { pts, tags } = pc.outline.taggedPoints(12);
    const cr = pts.filter((_, i) => tags[i] === 'crotch' || tags[i - 1] === 'crotch').sort((a, b) => a.y - b.y);
    const cfAt = (y: number) => {
      if (!cr.length || y <= cr[0].y) return cr[0]?.x ?? fork.x;
      for (let i = 1; i < cr.length; i++) if (y <= cr[i].y) return cr[i - 1].x + ((cr[i].x - cr[i - 1].x) * (y - cr[i - 1].y)) / (cr[i].y - cr[i - 1].y || 1);
      return fork.x;
    };
    const R = legs.r0 + 2;
    const p = B.add(
      pc,
      back ? 'peplum-back' : 'peplum-front',
      (q) => {
        const c = q.y + drop;
        const hip = ringAt(sp, Math.max(0, cfAt(q.y) - q.x), c, back, 1.5);
        const phi = back ? Math.PI - (crease - q.x) / R : (crease - q.x) / R;
        const leg: V3 = [legX + Math.sin(phi) * R, c, Math.cos(phi) * R];
        const w = Math.max(0, Math.min(1, (q.y - (fork.y - 6)) / 8));
        return [hip[0] * (1 - w) + leg[0] * w, c, hip[2] * (1 - w) + leg[2] * w];
      },
      thick,
    );
    panels.push(p);
  }
  const [f, b] = [panels.filter((p) => p.role === 'peplum-front'), panels.filter((p) => p.role === 'peplum-back')];
  const down = (q: P) => q.y;
  sew(seams, B.chain(f, 'side', down), B.chain(b, 'side', down));
  sew(seams, B.chain(f, 'inseam', down), B.chain(b, 'inseam', down));
  for (const p of panels) for (const [x, y] of dartLegs(p)) sew(seams, x, y);
  // A hem ruffle: one strip round the leg's hem, laid on after the legs have hung (see layLegRuffle).
  const strip = d.pieces.find((pc) => pc.name === 'Hem ruffle');
  if (strip) {
    const xs = strip.outline.points(12).map((q) => q.x);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const r = (d.hemCm ?? 40) / TAU;
    B.add(strip, 'peplum-front', (q) => {
      const a = ((q.x - x0) / (x1 - x0 || 1)) * TAU;
      return [legX + Math.sin(a) * (r + 1), legs.c1 + q.y, Math.cos(a) * (r + 1)];
      // (Meshed finer than the rest, for its folds to be drawn round rather than faceted.)
    }, thick, [], knob('__rufMesh') ?? 0.8);
  }
  return legs;
}

/** A cuff band's round and, for a tie cuff, how far along the strip the band starts (the first tie's length). */
function bandGeom(band: Piece, L: number): { round: number; tie: number; wrap: number } {
  const round = (band.meta.roundCm as number | undefined) ?? L - 2.5;
  const tie = typeof band.meta.tieCm === 'number' ? (band.meta.tieCm as number) : 0;
  // (The length laid once round the wrist: a tie cuff's band between its ties; a buttoned cuff's whole strip, its
  // underlap spread round with the rest rather than piled on its start.)
  return { round, tie, wrap: tie > 0 ? round : L };
}

/** A sleeve ruffle, laid round the sleeve's hem as it hung: the strip's top edge gathered onto the hem all round,
 *  from the inside of the arm, and the rest falling from it, flaring a little and fluted by its gathers. */
function laySleeveRuffle(sp: Space, B: Builder, res: Float64Array, strip: Panel, cuff: Panel | undefined): void {
  const sleeves = B.panels.filter((p) => p !== strip && p !== cuff && !p.hidden && p.role === 'sleeve' && p.mesh.runs.hem?.length);
  const hem = sleeves.flatMap((p) => p.mesh.runs.hem!.flat().map((i) => { const I = (p.base + i) * 3; return [res[I], res[I + 1], res[I + 2]] as V3; })).filter((v) => v[0] >= 0);
  if (hem.length < 6) return;
  const arm = sp.arm;
  const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
  const Lab = Math.hypot(ab[0], ab[1], ab[2]);
  const dn = ab.map((v) => v / Lab);
  const ov0 = [1 - dn[0] * dn[0], -dn[0] * dn[1], -dn[0] * dn[2]];
  const ol = Math.hypot(ov0[0], ov0[1], ov0[2]);
  const ov = ov0.map((v) => v / ol);
  const fv = [dn[1] * ov[2] - dn[2] * ov[1], dn[2] * ov[0] - dn[0] * ov[2], dn[0] * ov[1] - dn[1] * ov[0]];
  if (fv[2] < 0) fv.forEach((_, k) => (fv[k] = -fv[k]));
  // Each hem point about the arm: how far down it, round it (from the inside, toward the body) and out from it.
  const about = (v: V3) => {
    const r = [v[0] - arm.a[0], v[1] - arm.a[1], v[2] - arm.a[2]];
    const u = r[0] * dn[0] + r[1] * dn[1] + r[2] * dn[2];
    const x = r[0] * ov[0] + r[1] * ov[1] + r[2] * ov[2];
    const z = r[0] * fv[0] + r[1] * fv[1] + r[2] * fv[2];
    let a = Math.atan2(z, x) - Math.PI;
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return { a, r: Math.hypot(x, z), u };
  };
  const ring = hem.map(about).sort((p, q) => p.a - q.a);
  const at = (a: number) => {
    const n = ring.length;
    let k = ring.findIndex((q) => q.a >= a);
    if (k < 0) k = n;
    const u = ring[(k - 1 + n) % n];
    const w = ring[k % n];
    const span = (w.a - u.a + TAU) % TAU || TAU;
    const f = Math.min(1, Math.max(0, ((a - u.a + TAU) % TAU) / span));
    return { r: u.r + (w.r - u.r) * f, u: u.u + (w.u - u.u) * f };
  };
  // (The strip is cut across: x across its depth, y along its gathered length.)
  const xs = strip.mesh.pts.map((q) => q.x);
  const ys = strip.mesh.pts.map((q) => q.y);
  const [x0, y0, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...ys)];
  const folds = Math.max(6, Math.round((y1 - y0) / (knob('__rufFold') ?? 9)));
  const flare = knob('__cuffRufFlare') ?? 0.3;
  strip.mesh.pts.forEach((q, i) => {
    const t = (q.y - y0) / (y1 - y0 || 1);
    const a = t * TAU;
    const down = q.x - x0;
    const h = at(a);
    const R = h.r + (knob('__rufTop') ?? 0.5) + down * flare + (0.25 + down * (knob('__rufAmp2') ?? 0.2)) * Math.sin(t * folds * TAU);
    const u = h.u + down * 0.96;
    const I = (strip.base + i) * 3;
    for (let k = 0; k < 3; k++) res[I + k] = arm.a[k] + dn[k] * u + R * (Math.cos(a + Math.PI) * ov[k] + Math.sin(a + Math.PI) * fv[k]);
  });
}

/** A trouser hem ruffle, laid round the leg's hem as it hung: the strip's top edge on the hem all round, from the
 *  inside leg, and the rest falling from it, flaring a little and fluted by its gathers, more toward its edge. */
function layLegRuffle(B: Builder, res: Float64Array): void {
  const strip = B.panels.find((p) => p.pc.name === 'Hem ruffle' && !p.hidden);
  if (!strip) return;
  const legs = B.panels.filter((p) => p !== strip && !p.hidden && /peplum/.test(p.role) && p.mesh.runs.hem?.length);
  const hem = legs.flatMap((p) => p.mesh.runs.hem!.flat().map((i) => { const I = (p.base + i) * 3; return [res[I], res[I + 1], res[I + 2]] as V3; }));
  if (hem.length < 6) return;
  const cx = hem.reduce((a, v) => a + v[0], 0) / hem.length;
  const cz = hem.reduce((a, v) => a + v[2], 0) / hem.length;
  // Round from the inside leg (toward the body's middle), through the front and back to it again.
  const ang = (v: V3) => { let a = Math.atan2(v[2] - cz, v[0] - cx) - Math.PI; while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; };
  const ring = hem.map((v) => ({ a: ang(v), r: Math.hypot(v[0] - cx, v[2] - cz), y: v[1] })).sort((u, v) => u.a - v.a);
  // (Wherever the leg stands out further just above its hem, the ruffle starts out over it, not tucked inside.)
  const NB = 36;
  const hy = hem.reduce((a, v) => a + v[1], 0) / hem.length;
  const binR = new Array<number>(NB).fill(0);
  for (const p of legs)
    p.mesh.pts.forEach((_, i) => {
      const I = (p.base + i) * 3;
      if (res[I + 1] < hy - 4) return;
      const v: V3 = [res[I], res[I + 1], res[I + 2]];
      const k = Math.floor((ang(v) / TAU) * NB) % NB;
      binR[k] = Math.max(binR[k], Math.hypot(v[0] - cx, v[2] - cz));
    });
  for (let it = 0; it < 2; it++) {
    const c = binR.slice();
    for (let k = 0; k < NB; k++) binR[k] = Math.max(c[k], (c[(k + NB - 1) % NB] + c[(k + 1) % NB]) / 2);
  }
  for (let it = 0; it < (knob('__rufBinSm') ?? 6); it++) {
    const c = binR.slice();
    for (let k = 0; k < NB; k++) binR[k] = (c[(k + NB - 1) % NB] + 2 * c[k] + c[(k + 1) % NB]) / 4;
  }
  const at = (a: number) => {
    const n = ring.length;
    let k = ring.findIndex((q) => q.a >= a);
    if (k < 0) k = n;
    const u = ring[(k - 1 + n) % n];
    const w = ring[k % n];
    const span = (w.a - u.a + TAU) % TAU || TAU;
    const f = Math.min(1, Math.max(0, ((a - u.a + TAU) % TAU) / span));
    const fb = (a / TAU) * NB - 0.5;
    const k0 = Math.floor(fb);
    const b = binR[((k0 % NB) + NB) % NB] * (1 - (fb - k0)) + binR[(((k0 + 1) % NB) + NB) % NB] * (fb - k0);
    return { r: Math.max(u.r + (w.r - u.r) * f, b), y: u.y + (w.y - u.y) * f };
  };
  const xs = strip.mesh.pts.map((q) => q.x);
  const ys = strip.mesh.pts.map((q) => q.y);
  const [x0, x1, y0] = [Math.min(...xs), Math.max(...xs), Math.min(...ys)];
  const folds = Math.max(6, Math.round((x1 - x0) / (knob('__rufFold') ?? 9)));
  const flare = knob('__rufFlare') ?? 0.45;
  strip.mesh.pts.forEach((q, i) => {
    const t = (q.x - x0) / (x1 - x0 || 1);
    const a = t * TAU;
    const down = q.y - y0;
    const h = at(a);
    // (Less toward the other leg, so the two don't meet.)
    const fl = flare * (0.7 - 0.3 * Math.cos(a));
    const R = h.r + (knob('__rufTop') ?? 0.5) + down * fl + (0.25 + down * (knob('__rufAmp') ?? 0.2)) * Math.sin(t * folds * TAU);
    const I = (strip.base + i) * 3;
    res[I] = cx + Math.cos(a + Math.PI) * R;
    res[I + 1] = h.y + down * 0.96;
    res[I + 2] = cz + Math.sin(a + Math.PI) * R;
  });
}

const isTorso = (pc: Piece) => !pc.kind && !/skirt|peplum|yoke|sleeve/i.test(pc.name);
const isUnder = (pc: Piece) => !pc.kind && /underskirt/i.test(pc.name);
const isSkirt = (pc: Piece) => !pc.kind && /skirt|peplum|yoke/i.test(pc.name) && !/underskirt/i.test(pc.name);

export function drapeBodice(sp: Space, d: BodiceDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}, extra: { skirt?: Piece[]; drop?: number; pieces?: Piece[]; tiers?: TierBand[]; under?: Piece[]; slitCm?: number } = {}): Draped {
  // (A yoke is sewn back onto its piece first: left as its own piece it has no place on the body and hung loose by
  // the knees, the house shirt's back yoke, 2026-11-10.)
  const pieces = yokesJoined(extra.pieces ?? d.pieces).map((pc) =>
    (pc.meta as { wrap?: boolean }).wrap ? ownHalf(pc)
    : pc.meta.whole && pc.meta.bias && isTorso(pc) && !/back/i.test(pc.name) && !knob('__noCowl') ? cowlFront(pc, d.front.apex.y)
    : pc.meta.whole && isTorso(pc) && /back/i.test(pc.name) && !knob('__noBackTurn') ? mirrorPiece(pc)
    : pc,
  );
  const torso = pieces.filter(isTorso).map((pc) => ({ pc, back: /back/i.test(pc.name), waistY: /back/i.test(pc.name) ? d.back.waistCentre.y : d.front.waistCentre.y, folds: o.rollFront && !/back|side/i.test(pc.name) ? [o.rollFront] : undefined }));
  const skirt = extra.skirt ?? pieces.filter(isSkirt);
  // A balloon peplum's underskirt hangs inside its outer, as a balloon hem's does under its skirt.
  const under = extra.under ?? pieces.filter(isUnder);
  // (A high-low peplum's hem is cut unlevel on purpose: not a hem that rode up at the sides, to be let down again.
  // The A-line evening let it down and drew the back peplum's side to 5 times its cut, All round quality 2026-11-04.)
  if ((d as { peplum?: { backCm?: number } }).peplum?.backCm && !o.shapedHem) o = { ...o, shapedHem: true };
  const buttons = d.closure === 'front_buttons' && d.buttons ? { y: d.buttons.at.filter((y) => (o.openBelowY === undefined || y < o.openBelowY) && (o.openAboveY === undefined || y > o.openAboveY)), r: d.buttons.sizeCm / 2, waistY: d.front.waistCentre.y } : undefined;
  // (A cropped top's peplum hangs from its edge under the bust, as a dress's skirt hangs from an empire seam.)
  return drape(sp, torso, { skirt: skirt.length ? skirt : undefined, drop: extra.drop ?? (d.raiseCm ? -d.raiseCm : undefined), cropped: !!d.raiseCm, tiers: extra.tiers, under: under.length ? under : undefined, ...(extra.slitCm ? { slitCm: extra.slitCm } : {}), puff: sleeve?.gathers?.crown, cuff: sleeve?.gathers?.hem ? (((pc) => (pc?.meta.roundCm ?? pc?.meta.lengthCm) as number | undefined)(sleeve.pieces.find((pc) => /band|cuff/i.test(pc.name)))) : undefined, cuffBand: sleeve?.pieces.find((pc) => pc.name === 'Cuff' || (pc.name === 'Tie cuff' && !knob('__noTieCuff'))), cuffRuffle: knob('__noCuffRuffle') ? undefined : sleeve?.pieces.find((pc) => pc.name === 'Sleeve ruffle'), sleeve: sleeve?.pieces.filter(isShell), collars: collarsOf(pieces) }, { buttons, closedFront: true, curtain: d.finishedWaist >= d.finishedBust - 2 && !extra.skirt?.length, ...o });
}

export function drapeDress(sp: Space, d: DressDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}): Draped {
  const slit = (d.skirt as { slit?: { at: string; cm: number } } | undefined)?.slit;
  const slitCm = o.openSlit && slit?.at === 'side' ? slit.cm : undefined;
  const sk = d.skirt as { asym?: unknown; hem?: unknown } | undefined;
  const out = drapeBodice(sp, d.bodice, sleeve, { heavySkirt: true, ...(sk?.asym || sk?.hem ? { shapedHem: true } : {}), ...o }, { pieces: d.pieces, skirt: hungSkirt(madeUpSkirt(d.pieces, d.skirt).filter(isSkirt), d.skirt?.volume as never, { hip: d.skirt?.finishedHip, hem: d.skirt?.hemCm }), drop: d.seamDrop ?? 0, tiers: d.skirt?.volume?.tiers?.bands, under: d.pieces.filter(isUnder), ...(slitCm ? { slitCm } : {}) });
  if (d.noSeam) levelHemSpikes(out);
  else if (!(sk?.asym || sk?.hem) && !knob('__noLevelSkirt')) levelSkirtHem(out);
  return out;
}

/** A shift or sheath's hem: the cloth settles with a single point hanging a cm or two below its neighbours at the
 *  centre fold and at the foot of the side seam, a notch in an otherwise level hem (the blush shift, 2026-11-04). Each
 *  such point is brought up level with its neighbours along the hem, and the cloth just above it eased with it. */
export function levelHemSpikes(out: Draped): void {
  const EASE = 8;
  const arrs = [out.pos, ...(out.posMirror ? [out.posMirror] : [])];
  const panels = out.panels.filter((p) => !p.hidden && (p.role === 'front' || p.role === 'back') && p.mesh.runs.hem?.length);
  for (const p of panels) {
    const pts = p.mesh.pts;
    const fix = new Map<number, number>();
    for (const run of p.mesh.runs.hem ?? []) {
      if (run.length < 3) continue;
      const y0 = run.map((i) => out.pos[(p.base + i) * 3 + 1]);
      const y = [...y0];
      for (let pass = 0; pass < 3; pass++)
        run.forEach((_, k) => {
          const nb = k === 0 ? y[1] : k === run.length - 1 ? y[k - 1] : Math.max(y[k - 1], y[k + 1]);
          y[k] = Math.min(y[k], nb + 0.3);
        });
      run.forEach((i, k) => {
        if (y0[k] - y[k] > 0.2) fix.set(i, y0[k] - y[k]);
      });
    }
    if (!fix.size) continue;
    const onHem = new Set((p.mesh.runs.hem ?? []).flat());
    pts.forEach((q, i) => {
      if (onHem.has(i)) {
        const l = fix.get(i);
        if (l) for (const a of arrs) a[(p.base + i) * 3 + 1] -= l;
        return;
      }
      let lift = 0;
      for (const [h, l] of fix) {
        const w = Math.max(0, 1 - Math.hypot(q.x - pts[h].x, q.y - pts[h].y) / EASE);
        lift = Math.max(lift, l * w * w);
      }
      if (lift > 0) for (const a of arrs) a[(p.base + i) * 3 + 1] -= lift;
    });
  }
  // And the hem is cut level and hangs level: the front's bust dart takes up what the bust needs, so the hem does not
  // ride up at the centre front as the settled cloth, its bust a little fuller than the draft's, has it. Each hem point
  // is brought to the hem's level, the cloth above eased with it.
  const LEVEL_EASE = 20;
  const hemY = panels.flatMap((p) => (p.mesh.runs.hem ?? []).flat().map((i) => out.pos[(p.base + i) * 3 + 1])).sort((a, b) => a - b);
  if (!hemY.length) return;
  const level = hemY[Math.floor(hemY.length / 2)];
  for (const p of panels) {
    const pts = p.mesh.pts;
    const hem = (p.mesh.runs.hem ?? []).flat();
    const off = new Map(hem.map((i) => [i, out.pos[(p.base + i) * 3 + 1] - level]));
    const hemTop = Math.min(...hem.map((i) => pts[i].y));
    pts.forEach((q, i) => {
      let best = -1;
      let bd = Infinity;
      for (const h of hem) {
        const d = Math.abs(q.x - pts[h].x);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      if (best < 0) return;
      const up = Math.max(0, hemTop - q.y);
      const w = Math.max(0, 1 - up / LEVEL_EASE);
      const dy = (off.get(best) ?? 0) * w * w;
      if (dy) for (const a of arrs) a[(p.base + i) * 3 + 1] -= dy;
    });
  }
}

export function drapeTrousers(sp: Space, d: TrousersDraft, o: DrapeOptions = {}): Draped {
  const out = drape(sp, [], { trousers: d }, o);
  trouserDetails(out, d);
  return out;
}

export function drapeSkirt(sp: Space, d: SkirtDraft, o: DrapeOptions = {}): Draped {
  // (A low-rise skirt hangs from its own waistband, that far below the waist.)
  const drop = (d as { lowRise?: number }).lowRise;
  const slit = (d as { slit?: { at: string; cm: number } }).slit;
  const slitCm = o.openSlit && slit?.at === 'side' ? slit.cm : undefined;
  const sk = d as { asym?: unknown; hem?: unknown };
  const out = drape(sp, [], { skirt: wholeSkirt(hungSkirt(madeUpSkirt(d.pieces, d).filter(isSkirt), d.volume as never, { hip: d.finishedHip, hem: d.hemCm }), sk.asym as never), tiers: d.volume?.tiers?.bands, under: d.pieces.filter(isUnder), ...(drop ? { drop } : {}), ...(slitCm ? { slitCm } : {}) }, { closedFront: true, ...(sk.asym || sk.hem ? { shapedHem: true } : {}), ...o });
  if (!(sk.asym || sk.hem) && !knob('__noLevelSkirt')) levelSkirtHem(out);
  return out;
}

export function drapeOuter(sp: Space, d: OuterDraft, o: DrapeOptions = {}): Draped {
  const base = d.base as unknown as { front: { waistCentre: P }; back: { waistCentre: P } };
  // (A front and back cut across by a chest seam drape whole, as sewn, the seam drawn across them.)
  const cs = d.chestSeam;
  const shell = cs ? [...cs.whole, ...d.pieces.filter((pc) => isShell(pc) && !pc.meta.chestPart)] : d.pieces.filter(isShell);
  const roll = d.lapel?.roll as [P, P] | undefined;
  const seamAt = (pc: Piece) => (cs ? (pc === cs.whole[0] ? cs.front : pc === cs.whole[1] ? cs.back : undefined) : undefined);
  const torso = shell
    .filter((pc) => !/sleeve/i.test(pc.name))
    .map((pc) => {
      const Y = seamAt(pc);
      return {
        pc,
        back: /back/i.test(pc.name),
        waistY: /back/i.test(pc.name) ? base.back.waistCentre.y : base.front.waistCentre.y,
        folds: roll && /front/i.test(pc.name) && !/side/i.test(pc.name) ? [roll] : undefined,
        ...(Y !== undefined ? { creases: [[{ x: -100, y: Y }, { x: 100, y: Y }]] as [P, P][] } : {}),
      };
    });
  const out = drape(
    sp,
    torso,
    // A popped collar is not rolled down: it stands up round the neck from its stand.
    { sleeve: shell.filter((pc) => /sleeve/i.test(pc.name)), collars: collarsOf(d.pieces).map((c) => ((d as { popped?: boolean }).popped ? { ...c, roll: undefined } : c)) },
    // A lapel that breaks high (a coat or jacket buttoned over the chest) is pressed onto the front; a plunging one,
    // breaking near the waist, is left to hang (pressing drags its long front down).
    { pad: d.pads, stiff: !!o.crisp || !!o.stiffBend, boxCut: d.base.waistDarts.front + d.base.waistDarts.back < 0.5, stiffMax: d.hood ? HOOD_BEND : stiffBendNow(), lieLapel: !!d.lapel && base.front.waistCentre.y - d.lapel.breakPt.y > 10, layExtension: true, ...o, buttons: { y: d.buttons.at, r: d.buttons.sizeCm / 2, waistY: base.front.waistCentre.y, ...(d.buttons.columns.length > 1 ? { x: d.buttons.columns } : {}), ...(d.buttons.show ? { show: { y: d.buttons.show.y, x: d.buttons.show.columns } } : {}) }, ...(o.crisp ? { boxy: false, bendK: d.hood ? HOOD_BEND : stiffBendNow(), thick: Math.min(o.thick ?? STIFF_THICK, STIFF_THICK) } : o.stiffBend ? { bendK: Math.min(d.hood ? HOOD_BEND : stiffBendNow(), o.stiffBend), thick: Math.min(o.thick ?? STIFF_THICK, STIFF_THICK) } : {}), pinFront: knob("__pinAll") ? [{ y: 52, span: 12 }] : knob('__oldPins') || d.hood ? d.buttons.at.map((y) => ({ y, span: 2 })) : frontPins(d.buttons.at, shell) },
  );
  if (cs)
    for (const pnl of out.panels) {
      const Y = seamAt(pnl.pc);
      if (Y === undefined) continue;
      const ids = pnl.mesh.pts.map((q, i) => ({ q, i })).filter(({ q, i }) => Math.abs(q.y - Y) < 0.05 && !pnl.turned[i]).sort((a, b) => a.q.x - b.q.x).map(({ i }) => i + pnl.base);
      if (ids.length > 1) out.lines.push({ kind: 'yoke', ids });
    }
  return out;
}
