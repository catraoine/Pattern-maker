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
import { SimInput, simulate } from './sim';
import { Space, boxed } from './space';
import { knob, setKnob } from './knob';

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
}

export interface Draped {
  panels: Panel[];
  pos: Float64Array;
  /** Seams to draw: runs of points, by kind. */
  lines: { kind: string; ids: number[] }[];
  buttons: { at: V3; r: number }[];
  /** How much each point lies in shadow its mesh is too coarse to cast (inside a pressed pleat), 0 to 1. */
  shade?: Float32Array;
}

interface Chain {
  ids: number[];
  s: number[];
}

/** The ring of the body at level c, out by `off` cm: the point `arc` cm round from the centre front (or back), toward the wearer's left. */
function ringAt(sp: Space, arc: number, c: number, back: boolean, off: number): V3 {
  const sign = arc < 0 ? -1 : 1;
  let left = Math.abs(arc);
  const da = 0.01;
  let a = back ? Math.PI : 0;
  const dir = back ? -1 : 1;
  const pt = (aa: number): [number, number] => {
    const r = sp.bodyR(aa, c) + off;
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
  chain(panels: Panel[], tag: string, key: (q: P) => number): Chain {
    const runs: { ids: number[]; pts: P[]; k: number }[] = [];
    for (const p of panels) {
      for (const r of p.mesh.runs[tag] ?? []) {
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

const isShell = (pc: Piece) => !pc.kind;

interface TorsoPiece {
  pc: Piece;
  back: boolean;
  waistY: number;
  folds?: [P, P][];
}

export interface DrapeOptions {
  thick?: number;
  bendK?: number;
  /** Buttons at these levels (cm in the front's own frame), at the centre front. */
  buttons?: { y: number[]; r: number; waistY: number };
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
  /** Crisp cloth (organza, taffeta): a peplum this many times stiffer, so it stands out rather than hangs. */
  crisp?: number;
  /** An unshaped top: hangs from the bust and shoulder blades as a curtain, in a few long folds. */
  curtain?: boolean;
  /** A dress: its bodice carries the skirt's weight. */
  heavySkirt?: boolean;
  /** Cut boxy: the cloth falls straight from the bust to the hip rather than in under the bust. */
  boxy?: boolean;
  /** Lapels and collar falls held pressed onto the cloth they turn over (a lapel breaking well above the waist). */
  lieLapel?: boolean;
}

interface CollarPart {
  pc: Piece;
  roll?: [P, P];
  /** Sewn to the top of a collar stand, not to the neck. */
  onStand?: boolean;
}

/** How much stiffer a coat's faced front edge bends than its cloth: about 1.4 times plain wool's stiffness, which
 *  the sim holds steady (much past that it blows up). */
const FACED = (o: { bendK?: number }) => Math.min(12, 1.4 / (o.bendK ?? 0.05));

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
  o.segs.forEach((sg: any, i: number) => (sg.kind === 'L' ? m.line(f(sg.to), o.tags[i]) : m.curve(f(sg.c1), f(sg.c2), f(sg.to), o.tags[i])));
  m.closed = true;
  return { ...pc, outline: m, lines: [], meta: { ...pc.meta, pleatFolds: folds, pleatKind: kind } };
}

/** The skirt pieces to hang: pleated ones closed as worn. */
function hungSkirt(pieces: Piece[], vol?: { kind?: string; folds?: PleatFold[][] }): Piece[] {
  if (!vol?.folds?.length || (vol.kind !== 'knife' && vol.kind !== 'box') || knob('__openPleats')) return pieces;
  return pieces.map((pc) => (pc.meta.pleats ? pleatClosed(pc, vol.folds![/back/i.test(pc.name) ? 1 : 0] ?? vol.folds![0], vol.kind!) : pc));
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

function drape(sp: Space, torso: TorsoPiece[], extra: { skirt?: Piece[]; drop?: number; sleeve?: Piece[]; collars?: CollarPart[]; trousers?: TrousersDraft; tiers?: TierBand[]; under?: Piece[]; puff?: number; cuff?: number; cuffBand?: Piece }, o: DrapeOptions): Draped {
  if (o.boxy) sp = boxed(sp);
  if (extra.skirt) extra = { ...extra, skirt: extra.skirt.map(halfPiece).map(narrowed) };
  const B = new Builder(sp);
  const poppedPanels: Panel[] = [];
  const stiffPanels: { p: Panel; by: string; roll?: [P, P]; key: (q: P) => number }[] = [];
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
    widthAt = (c: number) => 2 * outlines.reduce((t, o) => t + spanAt(o.pts, c + o.waistY), 0);
    const cache = new Map<number, number>();
    return (c: number) => {
      if (c <= 0) return 1;
      const k = Math.round(c);
      if (!cache.has(k)) {
        const W = 2 * outlines.reduce((t, o) => t + spanAt(o.pts, k + o.waistY), 0);
        let G = 0;
        for (let i = 0; i < 72; i++) G += ((sp.bodyR((i / 72) * TAU - Math.PI, k) + thick + 1.5) * TAU) / 72;
        cache.set(k, Math.max(1, (W * ((globalThis as any).__cone ?? 0.9)) / G));
      }
      return cache.get(k)!;
    };
  })();
  for (const t of torso) {
    const fold = t.folds?.[0];
    const p = B.add(
      t.pc,
      t.back ? 'back' : 'front',
      (q, turned) => {
        const r = turned && fold ? reflect(q, fold[0], fold[1]) : q;
        const c = r.y - t.waistY;
        const s = (globalThis as any).__noCone ? 1 : coneOf?.(c) ?? 1;
        const at = ringAt(sp, r.x / s, Math.max(c, tipC + 2), t.back, 1.5 + (turned ? 1 : 0));
        return [at[0] * s, c, at[2] * s];
      },
      thick,
      t.folds ?? [],
    );
    (t.back ? back : front).push(p);
  }
  const seams: SimInput['seams'] = [];
  const down = (q: P) => q.y;
  if (extra.trousers) legs = trouserPanels(sp, B, seams, extra.trousers, o.thick ?? 0.35);
  const out = (q: P) => q.x;
  sew(seams, B.chain(front, 'shoulder', out), B.chain(back, 'shoulder', out));
  sew(seams, B.chain(front, 'side', down), B.chain(back, 'side', down));
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
    for (const pc of extra.skirt) {
      const isBack = /back/i.test(pc.name);
      const toHem = pc.meta.sewnTo === 'hem';
      const drop = toHem ? hemDrop : extra.drop ?? 0;
      const R = pc.meta.waistRadius as number | undefined;
      const gather = (pc.meta.gathered as number | undefined) ?? 1;
      let level: (q: P) => number;
      let arcOf: (q: P) => number;
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
            const rr = Math.max(sp.bodyR(phi, c) + 1.5, ((R + lv) * span) / Math.PI);
            const a = isBack ? Math.PI - phi : phi;
            return [Math.sin(a) * rr, c, Math.cos(a) * rr];
          }
          // Gathered cloth starts in even folds round the waist (as the gathering thread draws it up), so it settles
          // into soft gathers down the skirt rather than one crushed bulge.
          if (!R && gather > 1.05 && !knob("__noFolds")) {
            const lam = knob("__lam") ?? 12;
            const k = TAU / lam;
            const A = Math.min(knob("__acap") ?? 5, (knob("__af") ?? 3) * Math.sqrt(gather - 1) / k);
            const ph = (k * q.x) / gather;
            return ringAt(sp, arcOf(q), c, isBack, 1 + A * (1 + Math.sin(ph)) + lv * 0.12);
          }
          return ringAt(sp, arcOf(q), c, isBack, 2 + lv * 0.15);
        },
        thick,
        [],
        // (Pressed pleats on a finer mesh cut along each fold, so the fold's step and the shadow under it are crisp.)
        // (A heavily gathered skirt on a finer one too: its many folds need more than a point or two across each.)
        pc.meta.pleatFolds ? 1.2 : ((pc.meta.gatherShown as number | undefined) ?? 1) > 2 ? (knob('__gh') ?? 0.8) : 1.6,
        creasesOf(pc),
      );
      levelOf.set(p, level);
      const top = (isBack ? back : front).filter((t) => t.role === 'front' || t.role === 'back');
      if (top.length) sew(seams, B.chain(top, toHem ? 'hem' : 'waist', out), B.chain([p], 'waist', out));
      (isBack ? back : front).push(p);
    }
    const pf = B.panels.filter((p) => p.role === 'peplum-front');
    const pb = B.panels.filter((p) => p.role === 'peplum-back');
    if (pf.length && pb.length) sew(seams, B.chain(pf, 'side', levelOf.get(pf[0])!), B.chain(pb, 'side', levelOf.get(pb[0])!));
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
        const p = B.add(pc, isBack ? 'peplum-back' : 'peplum-front', (q) => ringAt(sp, q.x, q.y - wy + (extra.drop ?? 0), isBack, 1 + (q.y - wy) * 0.08), thick * 0.6);
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
      const key = fromFold(pc);
      const lift = c.onStand ? 3 : 0;
      // A popped collar (a tailored collar with no roll) stands up round the neck: from its neck edge up to its fall.
      const popped = !roll && pc.outline.tags.includes('gorge');
      const tp = pc.outline.taggedPoints(2);
      const nk = tp.pts.filter((_, i) => tp.tags[i] === 'neck');
      const neckY = nk.length ? nk.reduce((t, q) => t + q.y, 0) / nk.length : 0;
      const neckLen = nk.length ? Math.max(...nk.map((q) => key(q))) : 1;
      const p = B.add(
        pc,
        'collar',
        (q, turned) => {
          const r = turned && roll ? reflect(q, roll[0], roll[1]) : q;
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
          const cc = neckC - 1 - lift + r.y;
          // The fall lies out over the stand and spreads as it goes down onto the shoulders: its longer outer edge
          // takes a wider ring, so it starts smooth rather than ruffled.
          const beyond = turned && roll ? Math.max(0, cc - (neckC - 1 - lift + Math.max(roll[0].y, roll[1].y))) : 0;
          // (A shirt's fall, turned down over its stand, flares out from the roll as its longer outer edge lets it: the
          // further from the fold, the further out from the neck.)
          const flare = turned && roll && !pc.outline.tags.includes('gorge') ? Math.hypot(q.x - r.x, q.y - r.y) / 2 : 0;
          return ringAt(sp, key(q) * (knob("__ck") ?? 1), cc, true, 1 + (turned ? 1.2 + beyond * 0.25 + flare * (knob('__fallOut') ?? 0.7) : 0));
        },
        thick,
        roll ? [roll] : [],
        1.2,
      );
      if (popped) poppedPanels.push(p);
      // A shirt's collar and stand (no lapel: no gorge) are interfaced: they keep the shape they were set in round the
      // neck, moved only as the seam each is sewn by moves.
      else if (!p.mesh.runs.gorge && !knob('__softCollar')) stiffPanels.push({ p, by: c.onStand ? 'stand' : 'neck', roll: roll ?? undefined, key });
      if (c.onStand && standTop) sew(seams, B.chain([p], 'stand', key), B.chain([standTop.panel], 'stand', standTop.key));
      else {
        const target = pc.meta.collarTo === 'extension' ? joinChains(bodyNeck, frontNeck, ext) : joinChains(bodyNeck, frontNeck);
        // A tailored collar's neck edge runs on along the lapel's gorge: sewn as one seam, so the short gorge end of the
        // collar isn't made to gather the whole gorge line up into a point.
        if (p.mesh.runs.gorge && !knob("__oldGorge")) sew(seams, joinChains(B.chain([p], 'neck', key), B.chain([p], 'gorge', key)), joinChains(target, B.chain(front, 'gorge', (q) => -q.x)));
        else sew(seams, B.chain([p], 'neck', key), target);
        if (p.mesh.runs.stand) standTop = { panel: p, key };
      }
      if (p.mesh.runs.gorge && knob("__oldGorge")) sew(seams, B.chain([p], 'gorge', (q) => q.y * -1), B.chain(front, 'gorge', (q) => -q.x));
    }
  }

  let capRatio = 1;
  let cuffPanel: Panel | undefined;
  // Sleeves round the arm, sewn into the armhole.
  if (extra.sleeve?.length && !knob("__noSl")) {
    const top = extra.sleeve.find((pc) => pc.meta.tailored !== 'under')!;
    const under = extra.sleeve.find((pc) => pc.meta.tailored === 'under');
    const runTop = (pc: Piece, tag: string) => {
      const { pts, tags } = pc.outline.taggedPoints(12);
      const on = pts.filter((_, i) => tags[i] === tag || tags[i - 1] === tag);
      return on.reduce((a, b) => (b.y < a.y ? b : a), on[0]);
    };
    let period: number;
    if (under) period = runTop(top, 'front-seam').x - runTop(under, 'front-seam').x;
    else {
      const xs = top.outline.points().map((q) => q.x);
      period = Math.max(...xs) - Math.min(...xs);
    }
    const capTop = top.outline.points().reduce((a, b) => (b.y < a.y ? b : a));
    const uOf = (pc: Piece, q: P) => (pc === under ? q.x + period : q.x);
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
    for (const pc of [top, ...(under ? [under] : [])]) {
      panels.push(
        B.add(
          pc,
          'sleeve',
          (q) => {
            const th = (TAU * (uOf(pc, q) - capTop.x)) / period;
            const along = q.y - capH * 0.6;
            const rr = r0 + 1.5;
            return [0, 1, 2].map((k) => a[k] + dn[k] * along + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k])) as V3;
          },
          thick,
        ),
      );
    }
    if (under) {
      sew(seams, B.chain([panels[0]], 'front-seam', down), B.chain([panels[1]], 'front-seam', down));
      sew(seams, B.chain([panels[0]], 'back-seam', down), B.chain([panels[1]], 'back-seam', down));
    } else sew(seams, B.chain(panels, 'sleeve-front', down), B.chain(panels, 'sleeve-back', down));
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
    cap.sort((x, y) => x.th - y.th);
    const capS: number[] = [0];
    for (let i = 1; i < cap.length; i++) capS.push(capS[i - 1] + Math.hypot(cap[i].q.x - cap[i - 1].q.x, cap[i].q.y - cap[i - 1].q.y));
    const fArm = B.chain(front.filter((p) => p.role === 'front'), 'armhole', down);
    const bArm = B.chain(back.filter((p) => p.role === 'back'), 'armhole', down);
    const Lf = fArm.s[fArm.s.length - 1];
    const Lb = bArm.s[bArm.s.length - 1];
    const total = capS[capS.length - 1];
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
    // A shirt cuff: its band, folded in half along its length, round the wrist below the sleeve's hem, the hem
    // gathered onto both its edges.
    if (extra.cuffBand) {
      const band = extra.cuffBand;
      const bp = band.outline.points();
      const W = Math.max(...bp.map((q) => q.x)) - Math.min(...bp.map((q) => q.x));
      const Lb2 = Math.max(...bp.map((q) => q.y)) - Math.min(...bp.map((q) => q.y));
      const hemAlong = Math.max(...top.outline.points().map((q) => q.y)) - capH * 0.6;
      const rc = (Lb2 - 2.5) / TAU + 0.3;
      const bandP = B.add(
        band,
        'sleeve',
        (q) => {
          const v = Math.min(q.x, W - q.x);
          const th = (TAU * q.y) / Lb2;
          const rr = rc + (q.x > W / 2 ? 0.25 : 0);
          // (Kept clear of the sleeve while it settles: the cuff is laid on after.)
          return [0, 1, 2].map((k) => a[k] + dn[k] * (hemAlong + v + 60) + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k])) as V3;
        },
        thick,
      );
      cuffPanel = bandP;
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
  // (The cut-on-fold and centre-seam lines alone: not a buttoned front's overlap, which only rests near the centre.)
  const foldLine: number[] = [];
  const edges: number[] = [];
  const rest: number[] = [];
  const bends: number[] = [];
  const chain: [number, number, number, number][] = [];
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
      sideA[p.base + i] = p.role === 'sleeve' || pts[i].x < (knob('__sideX') ?? 0.5) ? 0 : 1;
      armA[p.base + i] = p.role === 'sleeve' ? 1 : 0;
    });
    for (const tag of ['fold', 'centre', 'crotch']) for (const r of p.mesh.runs[tag] ?? []) for (const i of r) if (p.role !== 'collar') {
      centre.push(i + p.base);
      foldLine.push(i + p.base);
    }
    // A vent: its underlap is cut past the centre back and laps under the other side, so the centre line itself is
    // what stays on the centre plane down the vent, not the underlap's edge.
    if (p.mesh.runs.vent && !(globalThis as any).__oldVent) {
      const top = Math.min(...p.mesh.runs.vent.flat().map((i) => pts[i].y));
      pts.forEach((q, i) => {
        if (q.y >= top && Math.abs(q.x) < 0.6) centre.push(i + p.base);
      });
    } else for (const r of p.mesh.runs.vent ?? []) for (const i of r) centre.push(i + p.base);
    if (p.role === 'collar') {
      // (A band's fold and its zipped centre edge both meet their mirror: one at the front, one at the back.)
      for (const r of [...(p.mesh.runs.fold ?? []), ...(p.mesh.runs.centre ?? [])]) for (const i of r) centre.push(i + p.base);
      // The collar's centre back edge (x = 0 as drafted) lies on the centre plane, closed against its mirror.
      const x0 = Math.min(...pts.map((q) => q.x));
      pts.forEach((q, i) => {
        if (q.x - x0 < 0.05) centre.push(i + p.base);
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
    for (const [k, opp] of edgeSet) {
      const [u, v] = k.split(',').map(Number);
      edges.push(u + p.base, v + p.base);
      rest.push(Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y));
      // (Running down the cloth, on a bodice: held to near its cut length in the sim, top first.)
      if ((p.role === 'front' || p.role === 'back') && !p.turned[u] && !p.turned[v] && Math.abs(pts[u].y - pts[v].y) > 0.5 * rest[rest.length - 1] && !nearApex(p, (pts[u].x + pts[v].x) / 2, (pts[u].y + pts[v].y) / 2))
        chain.push(pts[u].y < pts[v].y ? [u + p.base, v + p.base, rest[rest.length - 1], pts[u].y] : [v + p.base, u + p.base, rest[rest.length - 1], pts[v].y]);
      if (opp.length === 2 && p.turned[opp[0]] === p.turned[opp[1]]) {
        bends.push(opp[0] + p.base, opp[1] + p.base);
        bendRest.push(Math.hypot(pts[opp[0]].x - pts[opp[1]].x, pts[opp[0]].y - pts[opp[1]].y));
        // Below its last button a coat front is faced: the facing stiffens its edge, so the corners hang flat, not curl.
        const faced = p.role === 'front' && !!o.pinFront?.length && [opp[0], opp[1]].every((j) => pts[j].x < 7 && pts[j].y > Math.max(...o.pinFront!.map((f) => f.y)) + 4);
        bendW.push(p.role === 'collar' || p.turned[opp[0]] ? 4 : faced ? FACED(o) : o.crisp && /peplum/i.test(p.pc.name) ? o.crisp : 1);
      }
    }
  }
  // A sleeve cap is longer than its armhole by its ease, which a tailor shrinks away with steam before setting it in:
  // the cloth along the cap is drawn in by that much, fading out a few cm into the sleeve, so it sets smooth.
  // (Half of it: shrunk away entirely, the cap's edge draws in tighter than the armhole it is sewn to and a slit of the
  // seam opens; a little left, the head still rounds over the shoulder rather than standing up in a peak.)
  const capEase = knob('__capEase') ?? 0.5;
  if (capRatio < 1 && capEase !== 0) {
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
    if (tp.some((p) => p.mesh.runs.shoulder)) return undefined;
    const held = tp.length ? tp : B.panels.filter((p) => p.role === 'peplum-front' || p.role === 'peplum-back');
    const tag = tp.length ? 'neck' : 'waist';
    // (A high-waisted skirt hangs from its top edge, above the waist.)
    const ids = held.flatMap((p) => (p.mesh.runs[tag] ?? (tag === 'waist' ? p.mesh.runs.top : undefined) ?? []).flat().map((i) => i + p.base));
    return { ids: Int32Array.from(ids), c: Float64Array.from(ids.map((i) => pos[i * 3 + 1])) };
  };
  // A sleeve keeps its tube round the arm: the radius at each height is its own girth there (top and under sleeve
  // together), less the cloth's give, so a wide coat sleeve stands round as wool does rather than folding flat.
  const roundOf = () => {
    const sl = B.panels.filter((p) => p.role === 'sleeve' && p !== cuffPanel);
    if (!sl.length || knob("__noRound")) return undefined;
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
    const cuffR = cuffPanel ? (Math.max(...cuffPanel.mesh.pts.map((q) => q.y)) - Math.min(...cuffPanel.mesh.pts.map((q) => q.y))) / TAU : 0;
    const zone = knob('__cuffZone') ?? 18;
    for (const p of sl) {
      const yHem = Math.max(...p.mesh.pts.map((q) => q.y));
      p.mesh.pts.forEach((q, i) => {
        if (q.y < capH + 2) return;
        ids.push(p.base + i);
        // (Soft cloth, a silk, doesn't stand round: its fullness falls in folds close round the arm.)
        let r = (widthAt(q.y) / TAU) * 0.92 * ((o.bendK ?? 0.05) < 0.04 ? knob('__silkR') ?? 0.72 : 1);
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
    const tp = B.panels.filter((p) => p.role === 'front' || p.role === 'back');
    const fr = tp.filter((p) => p.role === 'front').flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i].x));
    const f0 = Math.min(...fr);
    const f1 = Math.max(...fr);
    return Float64Array.from(
      tp.flatMap((p) => {
        const xs = (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i].x);
        const a = Math.min(...xs);
        const b = Math.max(...xs);
        return xs.map((x) => (fr.length ? f0 + ((x - a) / (b - a || 1)) * (f1 - f0) : x) + (knob('__strapSlack') ?? 0.5));
      }),
    );
  };
  const input: SimInput = {
    pos,
    edges: Int32Array.from(edges),
    rest: Float64Array.from(rest),
    bends: Int32Array.from(bends),
    bendRest: Float64Array.from(bendRest),
    seams,
    centre: Int32Array.from(centre),
    thick: thickA,
    side: sideA,
    onArm: armA,
    pressed: Uint8Array.from(B.panels.flatMap((p) => p.turned.map((t) => (t ? 1 : 0)))),
    chain: (() => {
      const c = [...chain].sort((m, n) => m[3] - n[3]);
      // (Hard under a long skirt's weight, which would otherwise draw the bodice down; a top that carries only
      // itself is held gently, or the hold ratchets it up over the bust.)
      const heavy = !!o.heavySkirt;
      return { up: Int32Array.from(c.map((q) => q[0])), lo: Int32Array.from(c.map((q) => q[1])), rest: Float64Array.from(c.map((q) => q[2])), k: heavy ? 1 : (knob('__lightK') ?? 0.3) };
    })(),
    lieOn: lieOnOf(),
    bendW: Float64Array.from(bendW),
    bendK: o.bendK ?? 0.05,
    pad: o.pad,
    hang: hangOf(),
    round: roundOf(),
    legs,
    shoulder: Int32Array.from(B.panels.filter((p) => p.role === 'front' || p.role === 'back').flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => i + p.base))),
    // Sleeveless, each shoulder point is held no further out than it is cut (a set-in strap stays over the shoulder).
    // The shoulder seam is sewn along the top of the shoulder, as cut: the cloth hangs from it there and can't slide out
    // along the shoulder or round to the front or back under a heavy skirt's weight.
    ...(!knob('__noStrapHold') ? { shoulderX: strapHold() } : {}),
    ...(!knob('__noHoldZ') ? { shoulderZ: knob('__holdZ') ?? 0.5 } : {}),
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
  const res = simulate(sp, input);
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
  for (const { p, by, roll, key } of stiffPanels) {
    const anchor = (p.mesh.runs[by] ?? []).flat();
    if (!anchor.length) continue;
    if (roll && !knob('__oldFall')) {
      // A collar with a fall: built on the line it is sewn by, as settled. Up from it to the fold (the collar's inner
      // layer standing round the neck), then the fall turned down from the fold, out and down over the stand onto the
      // shoulders: a stiff, interfaced piece, each point at its cut distance from the fold.
      const ring = [...new Set(anchor)].map((j) => ({ s: key(p.mesh.pts[j]), d: distLine(p.mesh.pts[j], roll), X: [0, 1, 2].map((k) => res[(p.base + j) * 3 + k]) as V3 })).sort((a, b) => a.s - b.s);
      // (Its height round the neck eased smooth, so the fold runs as one clean line: mirrored at the centre back.)
      for (let it = 0; it < (knob('__ringIt') ?? 8); it++) {
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
      p.mesh.pts.forEach((q, i) => {
        const r = p.turned[i] ? reflect(q, roll[0], roll[1]) : q;
        const nq = curved ? near(q) : undefined;
        const foot = nq ? nq.foot : { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
        const s0 = key(p.turned[i] || nq ? foot : q);
        const base0 = at(s0);
        const base = nq ? { X: base0.X, d: gap } : base0;
        const rho = Math.hypot(base.X[0], base.X[2]) || 1e-9;
        const out = [base.X[0] / rho, 0, base.X[2] / rho];
        const I = (p.base + i) * 3;
        if (!p.turned[i]) {
          // (Inner layer: up from the seam by as far as it is cut from it, toward the fold.)
          const up = nq ? Math.min(gap, nq.dist) : Math.max(0, base.d - distLine(q, roll));
          res[I] = base.X[0] + out[0] * 0.1;
          res[I + 1] = base.X[1] - up;
          res[I + 2] = base.X[2] + out[2] * 0.1;
        } else {
          const h = nq ? Math.max(0, nq.dist - gap) : Math.hypot(q.x - r.x, q.y - r.y) / 2;
          const top = base.X[1] - base.d;
          const T = p.thick[i] * 2 + 0.15;
          res[I] = base.X[0] + out[0] * (T + h * Math.sin(phi));
          res[I + 1] = top + h * Math.cos(phi);
          res[I + 2] = base.X[2] + out[2] * (T + h * Math.sin(phi));
        }
      });
      continue;
    }
    const moved = new Map<number, V3>();
    for (const j of anchor) {
      const J = (p.base + j) * 3;
      moved.set(j, [res[J] - p.start[j][0], res[J + 1] - p.start[j][1], res[J + 2] - p.start[j][2]]);
    }
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
      const D = moved.get(j)!;
      const I = (p.base + i) * 3;
      for (let k = 0; k < 3; k++) res[I + k] = p.start[i][k] + D[k];
    });
  }
  // Close what is left of each seam for drawing, so no slit of light shows along it.
  for (let pass = 0; pass < 12; pass++) {
    for (const { i, j, k, t } of seams) {
      for (let d = 0; d < 3; d++) {
        const target = res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t;
        res[i * 3 + d] += (target - res[i * 3 + d]) * 0.5;
      }
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
  // A roll line (the fold of a lapel) drawn as one clean crease: the points along it eased toward their neighbours.
  for (const p of B.panels) {
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
  // (A coat long enough to fall past the hip has the weight to hang its flare out in the sim itself.)
  const hemC = Math.max(0, ...B.panels.filter((p) => p.role === 'front' || p.role === 'back').flatMap((p) => p.mesh.pts.map((_, i) => res[(p.base + i) * 3 + 1])));
  if (widthAt && !o.boxy && !(globalThis as any).__noKick && hemC < 40) {
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
    const kStep = (globalThis as any).__kick ?? 0.45;
    const kFlute = (globalThis as any).__flute ?? 0.25;
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
    for (const [a] of creasesOf(p.pc)) {
      const col = p.mesh.pts
        .map((q, i) => [q, i] as const)
        .filter(([q]) => Math.abs(q.x - a.x) < 0.05 && q.y > hipY - 4)
        .sort((u, v) => u[0].y - v[0].y)
        .map(([, i]) => (p.base + i) * 3);
      for (let pass = 0; pass < 6; pass++) {
        const was = col.map((I) => [res[I], res[I + 1], res[I + 2]]);
        for (let j = 1; j < col.length - 1; j++) for (let e = 0; e < 3; e += 2) res[col[j] + e] = (was[j - 1][e] + 2 * was[j][e] + was[j + 1][e]) / 4;
      }
    }
    p.mesh.pts.forEach((q, i) => {
      if (q.y < hipY - 4) return;
      const xs = folds.map((f) => foldAt(f, q.y));
      const s = xs[1] - xs[0];
      // (A point on a fold, to within the mesh's rounding, is on its edge, not under it.)
      let k = xs.findIndex((x) => x > q.x + 0.03) - 1;
      if (k === -2) k = xs.length - 1;
      const from = k < 0 ? xs[0] - s : xs[k];
      const t = Math.min(1, Math.max(0, (q.x - from) / s));
      const A = (1.3 + 0.7 * Math.min(1, (q.y - hipY) / 40)) * Math.min(1, (q.y - hipY + 4) / 8);
      const off = A * (box ? Math.abs(1 - 2 * t) : 1 - t);
      // In under the next fold's edge (a box pleat's: in its middle, where its two folds meet) the cloth is in shadow.
      const deep = box ? 1 - Math.abs(1 - 2 * t) : t;
      const ramp = Math.min(1, (q.y - hipY + 4) / 8);
      // (A knife pleat's shadow is a dark strip right under the fold edge; the face before it turns away a little.)
      shade![p.base + i] = box
        ? 0.8 * ramp * Math.pow(Math.max(0, (deep - 0.35) / 0.65), 1.2)
        : ramp * (s * (1 - t) < SHADOW_CORE + 0.02 ? 0.85 : s * t < 0.02 ? -0.7 : 0.25 * t * t);
      const I = (p.base + i) * 3;
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
      const at = [...new Set(tags.flatMap((t) => (p.mesh.runs[t] ?? []).flat()))]
        .filter((i) => tags[0] !== 'waist' || p.mesh.pts[i].y < 3)
        .sort((u, v) => p.mesh.pts[u].x - p.mesh.pts[v].x);
      const ids = at.map((i) => (p.base + i) * 3 + 1);
      for (let pass = 0; pass < 8; pass++) {
        const was = ids.map((I) => res[I]);
        for (let j = 1; j < ids.length - 1; j++) res[ids[j]] = (was[j - 1] + 2 * was[j] + was[j + 1]) / 4;
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
    const lamCloth = (knob("__lamC") ?? (p.pc.meta.gatherShown && gather > 2 ? 3 : 6)) * gather;
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
      if (p.hidden || !/peplum/.test(p.role) || gather > 1.05 || p.pc.meta.bias || p.pc.meta.tier || /ruffle|flounce/i.test(p.pc.name)) continue;
      const pts = p.mesh.pts;
      const ys = pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const nb = Math.ceil(Math.max(...ys) - y0) + 1;
      const bins: number[][] = Array.from({ length: nb }, () => []);
      pts.forEach((q, i) => bins[Math.min(nb - 1, Math.round(q.y - y0))].push(i));
      const ratio = bins.map((b) => {
        if (b.length < 3) return 1;
        const o2 = [...b].sort((u, v) => pts[u].x - pts[v].x);
        const pw = pts[o2[o2.length - 1]].x - pts[o2[0]].x;
        let dw = 0;
        for (let k = 1; k < o2.length; k++) {
          const I = (p.base + o2[k]) * 3;
          const J = (p.base + o2[k - 1]) * 3;
          dw += Math.hypot(res[I] - res[J], res[I + 2] - res[J + 2]);
        }
        return dw > 1 ? Math.max(1, pw / dw) : 1;
      });
      // (Eased over its neighbours, so one level doesn't stand out from the next.)
      const sm = ratio.map((_, k) => {
        let a = 0;
        let n = 0;
        for (let j = Math.max(0, k - 4); j <= Math.min(nb - 1, k + 4); j++) (a += ratio[j]), n++;
        return a / n;
      });
      const xs = pts.map((q) => q.x);
      const x0 = Math.min(...xs);
      const W = Math.max(...xs) - x0;
      const lam = knob('__flareLam') ?? 16;
      const n = 2 * Math.max(1, Math.round(W / (2 * lam)));
      const OUT = knob('__flareOut') ?? 0.65;
      pts.forEach((q, i) => {
        const I = (p.base + i) * 3;
        const r = sm[Math.min(nb - 1, Math.round(q.y - y0))];
        const below = Math.min(1, Math.max(0, (res[I + 1] - hipC) / 15));
        if (r <= 1.02 || !below) return;
        const sOut = 1 + (r - 1) * OUT * below;
        const rest = Math.max(0, r / sOut - 1);
        const A = (lam / Math.PI) * Math.sqrt(rest) * below * (knob('__flareFold') ?? 1);
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        const k = (rho * sOut + A * Math.cos((Math.PI * n * (q.x - x0)) / W)) / rho;
        res[I] *= k;
        res[I + 2] *= k;
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
      if (p.hidden || !/peplum/.test(p.role) || /underskirt/i.test(p.pc.name)) continue;
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
  if (o.pinFront?.length && !knob('__noNeckPull')) {
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
  if (o.pinFront?.length && !knob('__noNeckChain')) {
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
      const ids = p.mesh.pts.map((_, i) => p.base + i).filter((g, i) => !p.turned[i] && !held.has(g) && res[g * 3 + 1] < yBot);
      const inP = (g: number) => g >= p.base && g < p.base + p.mesh.pts.length && !p.turned[g - p.base];
      for (let it = 0; it < fsIt; it++)
        for (const g of ids) {
          const ns = (nb.get(g) ?? []).filter(inP);
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
    const body = (g: number) => roleOf.get(g) === 'front' || roleOf.get(g) === 'back';
    for (let it = 0; it < 4; it++)
      for (const { i, j, k, t } of seams) {
        if (!body(i) || !body(j) || !body(k)) continue;
        for (let d = 0; d < 3; d++) {
          const target = res[j * 3 + d] * (1 - t) + res[k * 3 + d] * t;
          res[i * 3 + d] += (target - res[i * 3 + d]) * 0.5;
        }
      }
  }
  // A jacket's or coat's collar fall is pressed down onto the back it turns over (its stand alone can't hold it
  // there in the sim), so no gap opens between the collar and the back neck.
  const collarOnly = !knob("__lay") && !!o.pinFront?.length;
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
          } else {
            // Turned: laid over whatever its mirror at the roll line would be, the stand or (cut wider than the stand)
            // the piece below the seam, a cloth's thickness out.
            const r = reflect(q, fold[0], fold[1]);
            const at0 = onSeam(r);
            const body = at0.h < 0 ? onBody(at0.seg, -at0.h) : undefined;
            const U0 = body ?? standAt(r).X;
            const w = flatW(at0.seg);
            const flatV = w > 0 ? (knob('__oldEnds') ? onBody(at0.seg, -at0.h) : flatOn(at0)) : undefined;
            X = mix(out(U0, thick + gap), flatV && out(flatV, 0.15 + thick + gap), w);
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
        const shorter = knob('__sfShort') ?? 1;
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
          const inX = -Math.sign(F[0]) * h * front * front * (knob('__sfIn') ?? 0.3);
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
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      const pts = p.mesh.pts;
      const sh = (p.mesh.runs.shoulder ?? []).flat();
      const waist = (p.mesh.runs.waist ?? []).flat();
      if (!sh.length || !waist.length) continue;
      const shY = Math.max(...sh.map((i) => pts[i].y));
      const wY = Math.min(...waist.map((i) => pts[i].y));
      pts.forEach((q, i) => {
        if (q.y >= wY) return;
        const w = Math.min(1, Math.max(0, (q.y - shY) / 8));
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
  // A sleeveless top cut to the wearer's shoulder runs on past the form's narrower shoulder tip: there, with no
  // shoulder under it, the cloth lies down onto the top of the arm rather than standing out level as a shelf. Each
  // point past the tip is lowered by as much as the shoulder seam above it stands off the arm's top (a smooth drop
  // along the shoulder, not point by point, so the armhole edge stays one clean line), less with depth below it.
  if (!B.panels.some((p) => p.role === 'sleeve' && !p.hidden) && !extra.trousers && !o.pinFront?.length && !knob('__noArmLie')) {
    const { a, r0 } = sp.arm;
    const tx = sp.tip.x;
    const armTop = (x: number) => a[1] - Math.sqrt(Math.max(0, r0 * r0 - Math.min(r0 * 0.95, Math.abs(x - a[0])) ** 2));
    for (const p of B.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      const sh = (p.mesh.runs.shoulder ?? []).flat().map((i) => [Math.abs(res[(p.base + i) * 3]), res[(p.base + i) * 3 + 1]] as [number, number]).sort((u, v) => u[0] - v[0]);
      if (sh.length < 2) continue;
      const seamC = (x: number) => {
        if (x <= sh[0][0]) return sh[0][1];
        for (let k = 1; k < sh.length; k++) if (x <= sh[k][0]) return sh[k - 1][1] + ((sh[k][1] - sh[k - 1][1]) * (x - sh[k - 1][0])) / (sh[k][0] - sh[k - 1][0] || 1);
        return sh[sh.length - 1][1];
      };
      const drop = (x: number) => {
        const w = Math.min(1, Math.max(0, (x - tx) / 1.5));
        return w * w * (3 - 2 * w) * Math.max(0, armTop(x) - thick - seamC(x)) * (knob('__armLie') ?? 1);
      };
      p.mesh.pts.forEach((_, i) => {
        const I = (p.base + i) * 3;
        const x = Math.abs(res[I]);
        if (x <= tx) return;
        const dD = drop(x);
        if (!dD) return;
        const below = Math.max(0, res[I + 1] - seamC(x));
        res[I + 1] += dD * Math.max(0, 1 - below / 10);
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
      const ids = p.mesh.pts.map((_, i) => p.base + i).filter((g) => inP(g) && !held.has(g));
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
        disp.set(i, [(cur[0] - res[I]) * f, (cur[1] - res[I + 1]) * f, (cur[2] - res[I + 2]) * f]);
      });
      const W = knob('__stayW') ?? 5;
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
  // (The centre line stays on the centre plane, whatever the passes above moved: a hair off it and the two halves part
  // in a slit down the front.)
  for (const i of foldLine) res[i * 3] = 0;
  // A skirt cut on the fold runs on smooth across its centre: each point on the fold sits as far out as the cloth either
  // side of it, not in a crease the mesh draws as a row of beads.
  if (!knob('__noFoldSmooth')) {
    const onC = new Set(centre);
    for (const p of B.panels) {
      // (A skirt cut on the fold, or a top's centre back seam: the same smoothing either way.)
      const skirtFold = (p.role === 'peplum-front' || p.role === 'peplum-back') && !!p.mesh.runs.fold?.length;
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
      const band = (i: number) => Math.abs(pts[i].x) < (knob('__foldBand') ?? 2.5) && !onC.has(p.base + i) && pts[i].y > yTop;
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
    const hOf = (ps: Panel[]) => Math.max(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y))) - Math.min(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y)));
    const puffCm = Math.max(3, hOf(outerB) - hOf(underB)) * (knob("__bal") ?? 1);
    for (const p of outerB) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const H = Math.max(...ys) - y0;
      p.mesh.pts.forEach((q, i) => {
        const t = Math.max(0, Math.min(1, ((q.y - y0) / H - 0.3) / 0.7));
        const off = puffCm * Math.sin(Math.PI * Math.pow(t, 0.8) * 0.88);
        const I = (p.base + i) * 3;
        const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
        res[I] *= (rho + off) / rho;
        res[I + 2] *= (rho + off) / rho;
      });
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
      const xs = p.mesh.pts.map((q) => q.x);
      const Rb = (Math.max(...xs) - Math.min(...xs)) / TAU + 0.4;
      p.mesh.pts.forEach((q, i) => {
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
      p.mesh.pts.forEach((q, i) => {
        const t = (q.y - y0) / H;
        const off = P * Math.sin(Math.PI * Math.min(1, t * 1.05));
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
    const rc = (Lb2 - 2.5) / TAU + 0.3;
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
      const th = (TAU * (q.y - y0b)) / Lb2;
      const off = side > 0 ? 0.2 : -0.1;
      const rr = rc + off;
      const I = (cuffPanel!.base + i) * 3;
      for (let k = 0; k < 3; k++) res[I + k] = arm.a[k] + dn[k] * (hemU - 0.5 + v) + rr * (Math.cos(th) * ov[k] + Math.sin(th) * fv[k]);
    });
  }
  if (extra.cuff && !extra.cuffBand) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const rc = extra.cuff / TAU + 0.4;
    for (const p of B.panels.filter((q) => q.role === 'sleeve')) {
      const ys = p.mesh.pts.map((q) => q.y);
      const y0 = Math.min(...ys);
      const H = Math.max(...ys) - y0;
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
        const swell = 1.6 * Math.sin((Math.PI * (t - 0.55)) / 0.4) * (t < 0.95 ? 1 : 0);
        const w = Math.min(1, Math.max(0, (t - 0.93) / 0.07));
        const want = (dl + Math.max(0, swell)) * (1 - w) + rc * w;
        const k = want / dl - 1;
        res[I] += d[0] * k * e;
        res[I + 1] += d[1] * k;
        res[I + 2] += d[2] * k;
      });
    }
  }
  const lines: Draped['lines'] = [];
  for (const p of B.panels) {
    if (p.hidden) continue;
    for (const tag of Object.keys(p.mesh.runs)) for (const r of p.mesh.runs[tag]) lines.push({ kind: tag, ids: r.map((i) => i + p.base) });
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
  // Buttons on the centre front, where the cloth lies there.
  const buttons: Draped['buttons'] = [];
  const f0 = front.find((p) => p.role === 'front');
  if (o.buttons && f0) {
    for (const y of o.buttons.y) {
      let best = -1;
      let bd = Infinity;
      f0.mesh.pts.forEach((q, i) => {
        if (f0.turned[i]) return;
        const dd = Math.hypot(q.x, q.y - y);
        if (dd < bd) {
          bd = dd;
          best = i + f0.base;
        }
      });
      if (best >= 0) buttons.push({ at: [0, res[best * 3 + 1], res[best * 3 + 2] + 0.4], r: o.buttons.r });
    }
  }
  setKnob("__seams", seams);
  return { panels: B.panels, pos: res, lines, buttons, ...(shade ? { shade } : {}) };
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

function collarsOf(pieces: Piece[], jacketRoll?: [P, P]): CollarPart[] {
  return pieces
    .filter((pc) => pc.kind === 'collar')
    .map((pc) => {
      const cl = pc.lines[0]?.points();
      const hasStand = pc.outline.tags.includes('stand');
      const onStand = hasStand && !pc.outline.tags.includes('neck');
      // A neck ruffle is a strip folded along its middle, both edges sewn into the neck: it stands as the doubled
      // half, so the half past the fold turns back over the other.
      const ruffleFold = (): [P, P] | undefined => {
        if (!pc.meta.ruffle || knob('__noRuffleFold')) return undefined;
        const ys = pc.outline.points(2).map((q) => q.y);
        const y = (Math.min(...ys) + Math.max(...ys)) / 2;
        const xs = pc.outline.points(2).map((q) => q.x);
        return [pt(Math.min(...xs) - 1, y), pt(Math.max(...xs) + 1, y)];
      };
      const roll: [P, P] | undefined = pc.outline.tags.includes('gorge') && cl ? [cl[0], cl[cl.length - 1]] : onStand ? shirtCollar(pc) : ruffleFold();
      void jacketRoll;
      return { pc, roll, onStand };
    })
    .sort((x, y) => Number(!!x.onStand) - Number(!!y.onStand));
}

/** Trousers: the hips round the body from the centre front and back, each leg round its own leg from the crease. */
function trouserPanels(sp: Space, B: Builder, seams: SimInput['seams'], d: TrousersDraft, thick: number): SimInput['legs'] {
  const legsM = d as unknown as { crotch?: unknown; kneeCm: number; hemCm: number; lengthCm: number };
  // A low (or high) rise is drafted from the line its waistband sits on, that far below (above) the waist: the
  // trousers are hung from there, so the crotch still comes to the body's own.
  const drop = -((d as { riseCm?: number }).riseCm ?? 0);
  const crotchC = drop + Math.max(...d.pieces.filter(isShell).map((pc) => (pc.meta.fork as P | undefined)?.y ?? 26));
  const hipSide = sp.bodyR(Math.PI / 2, crotchC - 4);
  const legX = hipSide * 0.5;
  const thighR = hipSide * 0.5;
  const legs = { x: legX, c0: crotchC - 2, c1: legsM.lengthCm + drop, r0: thighR, r1: 3.6 };
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
  return legs;
}

const isTorso = (pc: Piece) => !pc.kind && !/skirt|peplum|yoke|sleeve/i.test(pc.name);
const isUnder = (pc: Piece) => !pc.kind && /underskirt/i.test(pc.name);
const isSkirt = (pc: Piece) => !pc.kind && /skirt|peplum|yoke/i.test(pc.name) && !/underskirt/i.test(pc.name);

export function drapeBodice(sp: Space, d: BodiceDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}, extra: { skirt?: Piece[]; drop?: number; pieces?: Piece[]; tiers?: TierBand[]; under?: Piece[] } = {}): Draped {
  const pieces = extra.pieces ?? d.pieces;
  const torso = pieces.filter(isTorso).map((pc) => ({ pc, back: /back/i.test(pc.name), waistY: /back/i.test(pc.name) ? d.back.waistCentre.y : d.front.waistCentre.y }));
  const skirt = extra.skirt ?? pieces.filter(isSkirt);
  const buttons = d.closure === 'front_buttons' && d.buttons ? { y: d.buttons.at.filter((y) => (o.openBelowY === undefined || y < o.openBelowY) && (o.openAboveY === undefined || y > o.openAboveY)), r: d.buttons.sizeCm / 2, waistY: d.front.waistCentre.y } : undefined;
  return drape(sp, torso, { skirt: skirt.length ? skirt : undefined, drop: extra.drop, tiers: extra.tiers, under: extra.under, puff: sleeve?.gathers?.crown, cuff: sleeve?.gathers?.hem ? (sleeve.pieces.find((pc) => /band|cuff/i.test(pc.name))?.meta.lengthCm as number | undefined) : undefined, cuffBand: sleeve?.pieces.find((pc) => pc.name === 'Cuff'), sleeve: sleeve?.pieces.filter(isShell), collars: collarsOf(pieces) }, { buttons, closedFront: true, curtain: d.finishedWaist >= d.finishedBust - 2 && !extra.skirt?.length, ...o });
}

export function drapeDress(sp: Space, d: DressDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}): Draped {
  return drapeBodice(sp, d.bodice, sleeve, { heavySkirt: true, ...o }, { pieces: d.pieces, skirt: hungSkirt(d.pieces.filter(isSkirt), d.skirt?.volume as never), drop: d.seamDrop ?? 0, tiers: d.skirt?.volume?.tiers?.bands, under: d.pieces.filter(isUnder) });
}

export function drapeTrousers(sp: Space, d: TrousersDraft, o: DrapeOptions = {}): Draped {
  return drape(sp, [], { trousers: d }, o);
}

export function drapeSkirt(sp: Space, d: SkirtDraft, o: DrapeOptions = {}): Draped {
  // (A low-rise skirt hangs from its own waistband, that far below the waist.)
  const drop = (d as { lowRise?: number }).lowRise;
  return drape(sp, [], { skirt: hungSkirt(d.pieces.filter(isSkirt), d.volume as never), tiers: d.volume?.tiers?.bands, under: d.pieces.filter(isUnder), ...(drop ? { drop } : {}) }, { closedFront: true, ...o });
}

export function drapeOuter(sp: Space, d: OuterDraft, o: DrapeOptions = {}): Draped {
  const base = d.base as unknown as { front: { waistCentre: P }; back: { waistCentre: P } };
  const shell = d.pieces.filter(isShell);
  const roll = d.lapel?.roll as [P, P] | undefined;
  const torso = shell
    .filter((pc) => !/sleeve/i.test(pc.name))
    .map((pc) => ({
      pc,
      back: /back/i.test(pc.name),
      waistY: /back/i.test(pc.name) ? base.back.waistCentre.y : base.front.waistCentre.y,
      folds: roll && /front/i.test(pc.name) && !/side/i.test(pc.name) ? [roll] : undefined,
    }));
  return drape(
    sp,
    torso,
    // A popped collar is not rolled down: it stands up round the neck from its stand.
    { sleeve: shell.filter((pc) => /sleeve/i.test(pc.name)), collars: collarsOf(d.pieces).map((c) => ((d as { popped?: boolean }).popped ? { ...c, roll: undefined } : c)) },
    // A lapel that breaks high (a coat or jacket buttoned over the chest) is pressed onto the front; a plunging one,
    // breaking near the waist, is left to hang (pressing drags its long front down).
    { pad: d.pads, lieLapel: !!d.lapel && base.front.waistCentre.y - d.lapel.breakPt.y > 10, ...o, buttons: { y: d.buttons.at, r: d.buttons.sizeCm / 2, waistY: base.front.waistCentre.y }, pinFront: knob("__pinAll") ? [{ y: 52, span: 12 }] : d.buttons.at.map((y) => ({ y, span: 2 })) },
  );
}
