// A garment's pieces laid round the body and sewn: each piece as cloth (mesh2d.ts), placed near where it is worn, its
// seams, darts, collar and sleeves joined by the outline's own tags, then settled on the body (sim.ts). What comes back
// is the cloth as the pattern cuts it, so whatever the pattern has (a peplum, a collar, a lapel turned back) is there.
import { P, sub } from '../geometry';
import { Piece } from '../piece';
import type { BodiceDraft } from '../bodice';
import type { OuterDraft } from '../outerwear';
import type { SleeveDraft } from '../sleeve';
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
    const mesh = meshPiece(pc, h, folds, wedges);
    const turned = mesh.pts.map((_, i) => mesh.side.some((s) => s[i] === 1));
    const start = mesh.pts.map((q, i) => place(q, turned[i]));
    const p: Panel = { pc, mesh, start, thick: mesh.pts.map((_, i) => thick + (turned[i] ? 0.8 : 0)), base: this.n, role, turned };
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
  /** Hold the centre front on the centre plane at these heights (the buttoned front of an open jacket). */
  pinFront?: { y: number; span: number }[];
}

function drape(sp: Space, torso: TorsoPiece[], extra: { peplum?: Piece[]; sleeve?: Piece[]; collar?: Piece; collarRoll?: [P, P] }, o: DrapeOptions): Draped {
  const B = new Builder(sp);
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
  const out = (q: P) => q.x;
  sew(seams, B.chain(front, 'shoulder', out), B.chain(back, 'shoulder', out));
  sew(seams, B.chain(front, 'side', down), B.chain(back, 'side', down));
  // Panel seams within the front and within the back (princess lines): each pair of panels sharing the tag.
  for (const group of [front, back]) {
    const withP = group.filter((p) => p.mesh.runs.princess);
    for (let i = 0; i + 1 < withP.length; i += 2) sew(seams, B.chain([withP[i]], 'princess', down), B.chain([withP[i + 1]], 'princess', down));
  }
  for (const p of [...front, ...back]) for (const [a, b] of dartLegs(p)) sew(seams, a, b);

  // A peplum hangs from the waist.
  if (extra.peplum && !(globalThis as any).__noPep) {
    for (const pc of extra.peplum) {
      const isBack = /back/i.test(pc.name);
      const R = (pc.meta.waistRadius as number) ?? 20;
      const level = (q: P) => Math.hypot(q.x, q.y + R) - R;
      const arcOf = (q: P) => Math.atan2(q.x, q.y + R) * R;
      const p = B.add(
        pc,
        isBack ? 'peplum-back' : 'peplum-front',
        (q) => {
          const c = Math.max(0, level(q));
          const at = ringAt(sp, arcOf(q), c, isBack, 2.5 + c * 0.3);
          return at;
        },
        thick,
      );
      const top = isBack ? back : front;
      sew(seams, B.chain(top, 'waist', out), B.chain([p], 'waist', out));
      (isBack ? back : front).push(p);
    }
    const pf = B.panels.filter((p) => p.role === 'peplum-front');
    const pb = B.panels.filter((p) => p.role === 'peplum-back');
    const R = (pf[0]?.pc.meta.waistRadius as number) ?? 20;
    const fromWaist = (q: P) => Math.hypot(q.x, q.y + R);
    sew(seams, B.chain(pf, 'side', fromWaist), B.chain(pb, 'side', fromWaist));
  }

  // The collar stands up from the neck and turns down at its roll line.
  if (extra.collar && !(globalThis as any).__noCol) {
    const pc = extra.collar;
    const roll = extra.collarRoll;
    const neckC = -(sp.cOf(-1.47) * -1);
    const p = B.add(
      pc,
      'collar',
      (q, turned) => {
        const r = turned && roll ? reflect(q, roll[0], roll[1]) : q;
        const c = neckC - 1 + r.y;
        return ringAt(sp, r.x * 0.9, c, true, 1 + (turned ? 1 : 0));
      },
      thick,
      roll ? [roll] : [],
      1.2,
    );
    const neckBody = (q: P) => q.y;
    const bodyNeck = B.chain(back, 'neck', out);
    const frontNeck = B.chain(front, 'neck', neckBody);
    const joined: Chain = { ids: [...bodyNeck.ids, ...frontNeck.ids], s: [...bodyNeck.s, ...frontNeck.s.map((v) => v + (bodyNeck.s[bodyNeck.s.length - 1] ?? 0))] };
    sew(seams, B.chain([p], 'neck', out), joined);
    // Its end sewn to the lapel's gorge, from the neck end.
    const gorgeFront = B.chain(front, 'gorge', (q) => -q.x);
    sew(seams, B.chain([p], 'gorge', (q) => q.y * -1), gorgeFront);
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
    for (const tag of ['fold', 'centre']) for (const r of p.mesh.runs[tag] ?? []) for (const i of r) if (p.role !== 'collar') centre.push(i + p.base);
    if (p.role === 'collar') for (const r of p.mesh.runs.fold ?? []) for (const i of r) centre.push(i + p.base);
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
        bendW.push(p.role === 'collar' || p.turned[opp[0]] ? 4 : 1);
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
    bendW: Float64Array.from(bendW),
    bendK: o.bendK ?? 0.05,
    pad: o.pad,
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
  const lines: Draped['lines'] = [];
  for (const p of B.panels) {
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

export function drapeBodice(sp: Space, d: BodiceDraft, sleeve?: SleeveDraft, o: DrapeOptions = {}): Draped {
  const shell = d.pieces.filter(isShell);
  const torso = shell
    .filter((pc) => !/peplum|sleeve/i.test(pc.name))
    .map((pc) => ({ pc, back: /back/i.test(pc.name), waistY: /back/i.test(pc.name) ? d.back.waistCentre.y : d.front.waistCentre.y }));
  const peplum = shell.filter((pc) => /peplum/i.test(pc.name));
  return drape(sp, torso, { peplum: peplum.length ? peplum : undefined, sleeve: sleeve?.pieces.filter(isShell) }, o);
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
      folds: roll && /centre front/i.test(pc.name) ? [roll] : undefined,
    }));
  const collar = d.pieces.find((pc) => pc.kind === 'collar');
  const cl = collar?.lines[0]?.points();
  return drape(
    sp,
    torso,
    { sleeve: shell.filter((pc) => /sleeve/i.test(pc.name)), collar, collarRoll: cl ? [cl[0], cl[cl.length - 1]] : undefined },
    { pad: d.pads, ...o, buttons: { y: d.buttons.at, r: d.buttons.sizeCm / 2, waistY: base.front.waistCentre.y }, pinFront: (globalThis as any).__pinAll ? [{ y: 52, span: 12 }] : d.buttons.at.map((y) => ({ y, span: 2 })) },
  );
}
