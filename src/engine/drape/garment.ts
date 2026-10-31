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
import { dartsOf } from '../marks';
import { SimInput, simulate } from './sim';
import { Space } from './space';

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

  add(pc: Piece, role: Panel['role'], place: (q: P, turned: boolean) => V3, thick: number, folds: [P, P][] = [], h = 1.6): Panel {
    const wedges = dartsOf(pc).map(({ near, tip, far }) => [near, tip, far] as Wedge);
    // A fish-eye dart (top, side, bottom, side, back to the top) is two darts point to point across the waist.
    for (const ln of pc.lines) {
      const q = ln.points();
      if (q.length === 5 && Math.hypot(q[0].x - q[4].x, q[0].y - q[4].y) < 1e-6) wedges.push([q[1], q[0], q[3]], [q[1], q[2], q[3]]);
    }
    const mesh = meshPiece(pc, h, folds, wedges);
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
  if ((globalThis as any).__dbg) console.log("sew", A.ids.length, (A.s[A.s.length - 1] ?? 0).toFixed(1), B.ids.length, (B.s[B.s.length - 1] ?? 0).toFixed(1));
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
  /** Crisp cloth (organza, taffeta): a peplum this many times stiffer, so it stands out rather than hangs. */
  crisp?: number;
}

interface CollarPart {
  pc: Piece;
  roll?: [P, P];
  /** Sewn to the top of a collar stand, not to the neck. */
  onStand?: boolean;
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
      const sg = out.segs[i] as any;
      if (sg.kind === 'L') m.line(pt(-sg.to.x, sg.to.y), out.tags[i]);
      else m.curve(pt(-sg.c1.x, sg.c1.y), pt(-sg.c2.x, sg.c2.y), pt(-sg.to.x, sg.to.y), out.tags[i]);
    }
    m.closed = true;
    return { ...pc, outline: m, lines: [], meta: { ...pc.meta, whole: false } };
  }
  return { ...pc, outline: out, lines: pc.lines.filter((l) => l.points(2).every((q) => q.x >= -0.01)), meta: { ...pc.meta, whole: false } };
}

function drape(sp: Space, torso: TorsoPiece[], extra: { skirt?: Piece[]; drop?: number; sleeve?: Piece[]; collars?: CollarPart[]; trousers?: TrousersDraft; tiers?: TierBand[]; under?: Piece[]; puff?: number }, o: DrapeOptions): Draped {
  if (extra.skirt) extra = { ...extra, skirt: extra.skirt.map(halfPiece) };
  const B = new Builder(sp);
  let legs: SimInput['legs'];
  const thick = o.thick ?? 0.35;
  const front: Panel[] = [];
  const back: Panel[] = [];
  const tipC = sp.tip.c;
  for (const t of torso) {
    const fold = t.folds?.[0];
    const p = B.add(
      t.pc,
      t.back ? 'back' : 'front',
      (q, turned) => {
        const r = turned && fold ? reflect(q, fold[0], fold[1]) : q;
        const c = r.y - t.waistY;
        const at = ringAt(sp, r.x, Math.max(c, tipC + 2), t.back, 1.5 + (turned ? 1 : 0));
        return [at[0], c, at[2]];
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
  if (extra.skirt?.length && !(globalThis as any).__noPep) {
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
          const lv = Math.max(0, level(q));
          const c = lv + drop;
          if (R && span > 0) {
            const phi = (Math.atan2(q.x, q.y + R) * Math.PI) / span;
            const rr = Math.max(sp.bodyR(phi, c) + 1.5, ((R + lv) * span) / Math.PI);
            const a = isBack ? Math.PI - phi : phi;
            return [Math.sin(a) * rr, c, Math.cos(a) * rr];
          }
          // Gathered cloth starts in even folds round the waist (as the gathering thread draws it up), so it settles
          // into soft gathers down the skirt rather than one crushed bulge.
          if (!R && gather > 1.05 && !(globalThis as any).__noFolds) {
            const lam = (globalThis as any).__lam ?? 12;
            const k = TAU / lam;
            const A = Math.min((globalThis as any).__acap ?? 5, ((globalThis as any).__af ?? 3) * Math.sqrt(gather - 1) / k);
            const ph = (k * q.x) / gather;
            return ringAt(sp, arcOf(q), c, isBack, 1 + A * (1 + Math.sin(ph)) + lv * 0.12);
          }
          return ringAt(sp, arcOf(q), c, isBack, 2 + lv * 0.15);
        },
        thick,
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
          const pc = { name: `${band.name} ${isBack ? 'back' : 'front'}`, outline, lines: [], grain: [pt(w / 2, 1), pt(w / 2, h - 1)], notches: [], labels: [], cut: '', seamAllowance: 1, allowances: {}, meta: { gathered: band.ratio } } as unknown as Piece;
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
  for (const p of B.panels) if (p.role !== 'front' && p.role !== 'back') for (const [a, b] of dartLegs(p)) sew(seams, a, b);

  // Collars: each stands up from the neck (or from its stand), and turns down at its roll line if it has one.
  if (extra.collars?.length && !(globalThis as any).__noCol) {
    const neckC = sp.cOf(-1.47);
    const fromFold = (pc: Piece) => {
      const f = pc.outline.taggedPoints(4);
      const fx = f.pts.filter((_, i) => f.tags[i] === 'fold');
      const at = fx.length ? fx.reduce((t, q) => t + q.x, 0) / fx.length : 0;
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
      const p = B.add(
        pc,
        'collar',
        (q, turned) => {
          const r = turned && roll ? reflect(q, roll[0], roll[1]) : q;
          const cc = neckC - 1 - lift + r.y;
          // The fall lies out over the stand and spreads as it goes down onto the shoulders: its longer outer edge
          // takes a wider ring, so it starts smooth rather than ruffled.
          const beyond = turned && roll ? Math.max(0, cc - (neckC - 1 - lift + Math.max(roll[0].y, roll[1].y))) : 0;
          return ringAt(sp, key(q) * ((globalThis as any).__ck ?? 1), cc, true, 1 + (turned ? 1.2 + beyond * 0.25 : 0));
        },
        thick,
        roll ? [roll] : [],
        1.2,
      );
      if (c.onStand && standTop) sew(seams, B.chain([p], 'stand', key), B.chain([standTop.panel], 'stand', standTop.key));
      else {
        const target = pc.meta.collarTo === 'extension' ? joinChains(bodyNeck, frontNeck, ext) : joinChains(bodyNeck, frontNeck);
        sew(seams, B.chain([p], 'neck', key), target);
        if (p.mesh.runs.stand) standTop = { panel: p, key };
      }
      if (p.mesh.runs.gorge) sew(seams, B.chain([p], 'gorge', (q) => q.y * -1), B.chain(front, 'gorge', (q) => -q.x));
    }
  }

  let capRatio = 1;
  // Sleeves round the arm, sewn into the armhole.
  if (extra.sleeve?.length && !(globalThis as any).__noSl) {
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
  }

  // All the points, edges and bends.
  const n = B.n;
  const pos = new Float64Array(n * 3);
  const thickA = new Float64Array(n);
  const sideA = new Uint8Array(n);
  const armA = new Uint8Array(n);
  const bendW: number[] = [];
  const centre: number[] = [];
  const edges: number[] = [];
  const rest: number[] = [];
  const bends: number[] = [];
  const bendRest: number[] = [];
  for (const p of B.panels) {
    const { pts, tris } = p.mesh;
    p.start.forEach((v, i) => {
      pos.set(v, (p.base + i) * 3);
      thickA[p.base + i] = p.thick[i];
      sideA[p.base + i] = p.role === 'sleeve' || pts[i].x < 0.5 ? 0 : 1;
      armA[p.base + i] = p.role === 'sleeve' ? 1 : 0;
    });
    for (const tag of ['fold', 'centre', 'crotch']) for (const r of p.mesh.runs[tag] ?? []) for (const i of r) if (p.role !== 'collar') centre.push(i + p.base);
    if (p.role === 'collar') for (const r of p.mesh.runs.fold ?? []) for (const i of r) centre.push(i + p.base);
    if ((p.role === 'front' || p.role === 'peplum-front') && o.closedFront && p.mesh.runs.opening) {
      pts.forEach((q, i) => {
        if (Math.abs(q.x) < 0.6 && !p.turned[i]) centre.push(i + p.base);
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
      if (opp.length === 2 && p.turned[opp[0]] === p.turned[opp[1]]) {
        bends.push(opp[0] + p.base, opp[1] + p.base);
        bendRest.push(Math.hypot(pts[opp[0]].x - pts[opp[1]].x, pts[opp[0]].y - pts[opp[1]].y));
        bendW.push(p.role === 'collar' || p.turned[opp[0]] ? 4 : o.crisp && /peplum/i.test(p.pc.name) ? o.crisp : 1);
      }
    }
  }
  // A sleeve cap is longer than its armhole by its ease, which a tailor shrinks away with steam before setting it in:
  // the cloth along the cap is drawn in by that much, fading out a few cm into the sleeve, so it sets smooth.
  const capEase = (globalThis as { __capEase?: number }).__capEase;
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
        const w = Math.max(0, 1 - d / 5);
        rest[e] *= 1 - (1 - capRatio) * w;
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
    const ids = held.flatMap((p) => (p.mesh.runs[tag] ?? []).flat().map((i) => i + p.base));
    return { ids: Int32Array.from(ids), c: Float64Array.from(ids.map((i) => pos[i * 3 + 1])) };
  };
  // A sleeve keeps its tube round the arm: the radius at each height is its own girth there (top and under sleeve
  // together), less the cloth's give, so a wide coat sleeve stands round as wool does rather than folding flat.
  const roundOf = () => {
    const sl = B.panels.filter((p) => p.role === 'sleeve');
    if (!sl.length || (globalThis as any).__noRound) return undefined;
    const capH = (sl[0].pc.meta.capHeight as number) ?? 15;
    const widthAt = (y: number) =>
      sl.reduce((sum, p) => {
        const xs = p.mesh.pts.filter((q) => Math.abs(q.y - y) < 1.2).map((q) => q.x);
        return sum + (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
      }, 0);
    const ids: number[] = [];
    const R: number[] = [];
    for (const p of sl) {
      p.mesh.pts.forEach((q, i) => {
        if (q.y < capH + 2) return;
        ids.push(p.base + i);
        R.push((widthAt(q.y) / TAU) * 0.92);
      });
    }
    return { ids: Int32Array.from(ids), R: Float64Array.from(R), k: (globalThis as any).__rk ?? 0.15 };
  };
  // Turned cloth (a lapel, a collar's fall) lies on the cloth it was turned over: each point rests on the point of
  // the same piece that it covers when folded at the roll line, one cloth's thickness out, as pressing sets it.
  const lieOnOf = () => {
    if (!(globalThis as any).__lie) return undefined;
    const I: number[] = [];
    const J: number[] = [];
    const G: number[] = [];
    for (const p of B.panels) {
      // Only a collar's fall for now: a lapel resting this way drags a long plunge front down (not yet understood).
      if (!p.folds?.length || (p.role !== 'collar' && !(globalThis as any).__lieLapel)) continue;
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
    lieOn: lieOnOf(),
    bendW: Float64Array.from(bendW),
    bendK: o.bendK ?? 0.05,
    pad: o.pad,
    hang: hangOf(),
    round: roundOf(),
    legs,
    shoulder: Int32Array.from(B.panels.filter((p) => p.role === 'front' || p.role === 'back').flatMap((p) => (p.mesh.runs.shoulder ?? []).flat().map((i) => i + p.base))),
  };
  const res = simulate(sp, input);
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
  const passes = (globalThis as any).__smooth ?? 16;
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
  // Gathered cloth: its fullness lies in soft folds round the skirt. The sim settles where the cloth hangs; the folds
  // its mesh is too coarse to form are laid on for drawing, as many as the cloth's width holds, each seam on a fold's
  // turn so the pieces still meet.
  const foldA = (globalThis as any).__foldA ?? 1;
  for (const p of B.panels) {
    const gather = (p.pc.meta.gathered as number | undefined) ?? 1;
    if (!/peplum/.test(p.role) || gather < 1.05 || !foldA) continue;
    const xs = p.mesh.pts.map((q) => q.x);
    const ys = p.mesh.pts.map((q) => q.y);
    const x0 = Math.min(...xs);
    const W = Math.max(...xs) - x0;
    const y0 = Math.min(...ys);
    const lamCloth = ((globalThis as any).__lamC ?? 6) * gather;
    const n = Math.max(2, Math.round(W / (lamCloth / 2)));
    const A = Math.min(3.5, 1.4 * Math.sqrt(gather - 1)) * foldA;
    // The fullness holds the skirt out from the body a little more the further down it falls.
    const flare = (gather - 1) * ((globalThis as any).__flare ?? 0.12);
    p.mesh.pts.forEach((q, i) => {
      const I = (p.base + i) * 3;
      const lv = q.y - y0;
      const amp = A * (0.35 + 0.65 * Math.min(1, lv / 18));
      const off = amp * Math.sin((Math.PI * n * (q.x - x0)) / W) + flare * Math.min(lv, 45);
      const rho = Math.hypot(res[I], res[I + 2]) || 1e-9;
      const R = sp.bodyR(Math.atan2(res[I], res[I + 2]), res[I + 1]) + p.thick[i];
      const k = Math.max(rho + off, R) / rho;
      res[I] *= k;
      res[I + 2] *= k;
    });
  }
  // A balloon hem: the outer skirt swells out below the hip and turns in to the underskirt's hem.
  const outerB = B.panels.filter((p) => /peplum/.test(p.role) && p.mesh.runs.balloon && !/underskirt/i.test(p.pc.name));
  const underB = B.panels.filter((p) => /underskirt/i.test(p.pc.name));
  if (outerB.length && underB.length) {
    const hOf = (ps: Panel[]) => Math.max(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y))) - Math.min(...ps.flatMap((p) => p.mesh.pts.map((q) => q.y)));
    const puffCm = Math.max(3, hOf(outerB) - hOf(underB)) * ((globalThis as any).__bal ?? 1);
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
  // A puff sleeve: the gathered crown stands out round the arm, fullest midway, drawn in to its band.
  if (extra.puff) {
    const arm = sp.arm;
    const ab = [arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const P = Math.min(3.2, extra.puff * 0.22) * ((globalThis as any).__puff ?? 1);
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
  const lines: Draped['lines'] = [];
  for (const p of B.panels) {
    if (p.hidden) continue;
    for (const tag of Object.keys(p.mesh.runs)) for (const r of p.mesh.runs[tag]) lines.push({ kind: tag, ids: r.map((i) => i + p.base) });
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
  (globalThis as any).__seams = seams;
  return { panels: B.panels, pos: res, lines, buttons };
}

/** A shirt collar, which rises from its stand and turns down a little above it. */
function shirtCollar(pc: Piece): [P, P] | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const st = pts.filter((_, i) => tags[i] === 'stand');
  if (st.length < 2) return undefined;
  const a = st.reduce((u, v) => (v.x < u.x ? v : u));
  const b = st.reduce((u, v) => (v.x > u.x ? v : u));
  return [
    { x: a.x, y: a.y - 1.6 },
    { x: b.x, y: b.y - 1.6 },
  ];
}

function collarsOf(pieces: Piece[], jacketRoll?: [P, P]): CollarPart[] {
  return pieces
    .filter((pc) => pc.kind === 'collar')
    .map((pc) => {
      const cl = pc.lines[0]?.points();
      const hasStand = pc.outline.tags.includes('stand');
      const onStand = hasStand && !pc.outline.tags.includes('neck');
      const roll: [P, P] | undefined = pc.outline.tags.includes('gorge') && cl ? [cl[0], cl[cl.length - 1]] : onStand ? shirtCollar(pc) : undefined;
      void jacketRoll;
      return { pc, roll, onStand };
    })
    .sort((x, y) => Number(!!x.onStand) - Number(!!y.onStand));
}

/** Trousers: the hips round the body from the centre front and back, each leg round its own leg from the crease. */
function trouserPanels(sp: Space, B: Builder, seams: SimInput['seams'], d: TrousersDraft, thick: number): SimInput['legs'] {
  const legsM = d as unknown as { crotch?: unknown; kneeCm: number; hemCm: number; lengthCm: number };
  const crotchC = Math.max(...d.pieces.filter(isShell).map((pc) => (pc.meta.fork as P | undefined)?.y ?? 26));
  const hipSide = sp.bodyR(Math.PI / 2, crotchC - 4);
  const legX = hipSide * 0.5;
  const thighR = hipSide * 0.5;
  const legs = { x: legX, c0: crotchC - 2, c1: legsM.lengthCm, r0: thighR, r1: 3.6 };
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
        const c = q.y;
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
  const buttons = d.closure === 'front_buttons' && d.buttons ? { y: d.buttons.at, r: d.buttons.sizeCm / 2, waistY: d.front.waistCentre.y } : undefined;
  return drape(sp, torso, { skirt: skirt.length ? skirt : undefined, drop: extra.drop, tiers: extra.tiers, under: extra.under, puff: sleeve?.gathers?.crown, sleeve: sleeve?.pieces.filter(isShell), collars: collarsOf(pieces) }, { buttons, closedFront: true, ...o });
}

export function drapeDress(sp: Space, d: DressDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}): Draped {
  return drapeBodice(sp, d.bodice, sleeve, o, { pieces: d.pieces, skirt: d.pieces.filter(isSkirt), drop: d.seamDrop ?? 0, tiers: d.skirt?.volume?.tiers?.bands, under: d.pieces.filter(isUnder) });
}

export function drapeTrousers(sp: Space, d: TrousersDraft, o: DrapeOptions = {}): Draped {
  return drape(sp, [], { trousers: d }, o);
}

export function drapeSkirt(sp: Space, d: SkirtDraft, o: DrapeOptions = {}): Draped {
  return drape(sp, [], { skirt: d.pieces.filter(isSkirt), tiers: d.volume?.tiers?.bands, under: d.pieces.filter(isUnder) }, { closedFront: true, ...o });
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
    { sleeve: shell.filter((pc) => /sleeve/i.test(pc.name)), collars: collarsOf(d.pieces) },
    { pad: d.pads, ...o, buttons: { y: d.buttons.at, r: d.buttons.sizeCm / 2, waistY: base.front.waistCentre.y }, pinFront: (globalThis as any).__pinAll ? [{ y: 52, span: 12 }] : d.buttons.at.map((y) => ({ y, span: 2 })) },
  );
}
