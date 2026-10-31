// A pattern piece as cloth: its outline sampled every few cm and its inside filled with points, joined into triangles,
// with each tagged edge of the outline kept as a run of points (so seams can be sewn to them). A fold line (a lapel's
// roll line, a collar's) splits the piece in two along points shared by both halves, so the cloth can turn over there.
import { P } from '../geometry';
import { Piece } from '../piece';

export interface Mesh2D {
  pts: P[];
  tris: [number, number, number][];
  /** Each tag's runs of outline points, in outline order. */
  runs: Record<string, number[][]>;
  /** Which side of each fold line every point lies on (1 beyond it, 0 on or before it), per fold. */
  side: number[][];
  /** Each dart's two legs, from its point out to the edge, to sew together. */
  darts: [number[], number[]][];
}

/** A dart as drawn on the piece: leg end, point, leg end. */
export type Wedge = [P, P, P];

function inTri(q: P, [a, b, c]: Wedge): boolean {
  const d1 = cross(a, b, q);
  const d2 = cross(b, c, q);
  const d3 = cross(c, a, q);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function legPoints(tip: P, end: P, h: number): P[] {
  const L = Math.hypot(end.x - tip.x, end.y - tip.y);
  const k = Math.max(1, Math.ceil(L / h - 0.2));
  return Array.from({ length: k - 1 }, (_, i) => ({ x: tip.x + ((end.x - tip.x) * (i + 1)) / k, y: tip.y + ((end.y - tip.y) * (i + 1)) / k }));
}

interface Edge {
  a: P;
  b: P;
  tag: string;
}

const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function outlineEdges(pc: Piece): Edge[] {
  const { pts, tags } = pc.outline.taggedPoints(12);
  const out: Edge[] = [];
  for (let i = 0; i < tags.length; i++) {
    const a = pts[i];
    const b = pts[i + 1] ?? pts[0];
    if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) out.push({ a, b, tag: tags[i] });
  }
  const first = out[0]?.a;
  const last = out[out.length - 1]?.b;
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) > 1e-6) out.push({ a: last, b: first, tag: '' });
  return out;
}

/** The part of a polygon on the left of the line a to b (Sutherland and Hodgman), the cut edge tagged `tag`. */
function clip(edges: Edge[], a: P, b: P, keepLeft: boolean, tag: string): Edge[] {
  const inside = (q: P) => (keepLeft ? cross(a, b, q) >= 0 : cross(a, b, q) <= 0);
  const hit = (p: P, q: P): P => {
    const d1 = cross(a, b, p);
    const d2 = cross(a, b, q);
    const t = d1 / (d1 - d2);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  };
  const out: Edge[] = [];
  let pending: P | undefined;
  for (const e of edges) {
    const ia = inside(e.a);
    const ib = inside(e.b);
    if (ia && ib) out.push(e);
    else if (ia && !ib) {
      const h = hit(e.a, e.b);
      out.push({ a: e.a, b: h, tag: e.tag });
      pending = h;
    } else if (!ia && ib) {
      const h = hit(e.a, e.b);
      if (pending) out.push({ a: pending, b: h, tag });
      pending = undefined;
      out.push({ a: h, b: e.b, tag: e.tag });
    }
  }
  // The cut may wrap round the start of the outline.
  if (pending) {
    const firstIn = out.find((e) => e.tag !== tag);
    if (firstIn) out.push({ a: pending, b: firstIn.a, tag });
  }
  // Put the edges back in a ring, starting anywhere.
  const ring: Edge[] = [];
  const left = [...out];
  if (!left.length) return ring;
  ring.push(left.shift()!);
  while (left.length) {
    const end = ring[ring.length - 1].b;
    let k = left.findIndex((e) => Math.hypot(e.a.x - end.x, e.a.y - end.y) < 1e-6);
    if (k < 0) {
      // Bridge a gap with the nearest start.
      let best = Infinity;
      left.forEach((e, i) => {
        const d = Math.hypot(e.a.x - end.x, e.a.y - end.y);
        if (d < best) {
          best = d;
          k = i;
        }
      });
    }
    ring.push(left.splice(k, 1)[0]);
  }
  return ring;
}

function inPoly(poly: P[], q: P): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function segDist(q: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
}

/** Delaunay triangles of the points (Bowyer and Watson). */
function delaunay(pts: P[]): [number, number, number][] {
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const d = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) * 20 + 10;
  const all = [...pts, { x: minX - d, y: minY - d }, { x: minX + 2 * d, y: minY - d }, { x: minX - d, y: minY + 2 * d }];
  const n = pts.length;
  type T = { a: number; b: number; c: number; cx: number; cy: number; r2: number };
  const make = (a: number, b: number, c: number): T => {
    const A = all[a];
    const B = all[b];
    const C = all[c];
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) || 1e-12;
    const a2 = A.x * A.x + A.y * A.y;
    const b2 = B.x * B.x + B.y * B.y;
    const c2 = C.x * C.x + C.y * C.y;
    const cx = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D;
    const cy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
    return { a, b, c, cx, cy, r2: (A.x - cx) ** 2 + (A.y - cy) ** 2 };
  };
  let tris: T[] = [make(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const q = all[i];
    const bad: T[] = [];
    const keep: T[] = [];
    for (const t of tris) ((q.x - t.cx) ** 2 + (q.y - t.cy) ** 2 < t.r2 ? bad : keep).push(t);
    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      for (const [u, v] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ]) {
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        if (edges.has(k)) edges.delete(k);
        else edges.set(k, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) keep.push(make(u, v, i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

/** One flat region of the piece as points and triangles. */
function meshRegion(edges: Edge[], h: number, wedges: Wedge[]) {
  const bpts: P[] = [];
  const btag: string[] = [];
  for (const e of edges) {
    const L = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
    const k = Math.max(1, Math.ceil(L / h - 0.2));
    for (let i = 0; i < k; i++) {
      bpts.push({ x: e.a.x + ((e.b.x - e.a.x) * i) / k, y: e.a.y + ((e.b.y - e.a.y) * i) / k });
      btag.push(e.tag);
    }
  }
  // Drop boundary points that land on top of the one before (very short edges).
  const keepB: number[] = [];
  bpts.forEach((q, i) => {
    const prev = keepB.length ? bpts[keepB[keepB.length - 1]] : undefined;
    if (!prev || Math.hypot(q.x - prev.x, q.y - prev.y) > h * 0.3) keepB.push(i);
  });
  const B = keepB.map((i) => bpts[i]);
  const T = keepB.map((i) => btag[i]);
  const poly = B;
  const xs = poly.map((q) => q.x);
  const ys = poly.map((q) => q.y);
  const inner: P[] = [];
  const dy = (h * Math.sqrt(3)) / 2;
  let row = 0;
  for (let y = Math.min(...ys) + dy / 2; y < Math.max(...ys); y += dy, row++) {
    for (let x = Math.min(...xs) + (row % 2 ? h / 2 : 0); x < Math.max(...xs); x += h) {
      const q = { x, y };
      if (!inPoly(poly, q)) continue;
      let near = Infinity;
      for (let i = 0; i < poly.length; i++) near = Math.min(near, segDist(q, poly[i], poly[(i + 1) % poly.length]));
      for (const w of wedges) near = Math.min(near, inTri(q, w) ? 0 : segDist(q, w[0], w[1]), segDist(q, w[1], w[2]));
      if (near > h * 0.55) inner.push(q);
    }
  }
  // A dart's legs are cut lines: points along them (and its point), and nothing inside it.
  for (const w of wedges) if (inPoly(poly, w[1])) inner.push(w[1], ...legPoints(w[1], w[0], h), ...legPoints(w[1], w[2], h));
  const pts = [...B, ...inner];
  const nb = B.length;
  const tris = delaunay(pts).filter(([a, b, c]) => {
    const g = { x: (pts[a].x + pts[b].x + pts[c].x) / 3, y: (pts[a].y + pts[b].y + pts[c].y) / 3 };
    if (!inPoly(poly, g)) return false;
    if (wedges.some((w) => inTri(g, w))) return false;
    // An edge between two outline points that are not neighbours must run inside (not across a dart's notch).
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      if (u < nb && v < nb && Math.abs(u - v) !== 1 && Math.abs(u - v) !== nb - 1) {
        const mid = { x: (pts[u].x + pts[v].x) / 2, y: (pts[u].y + pts[v].y) / 2 };
        if (!inPoly(poly, mid)) return false;
      }
    }
    return true;
  });
  return { pts, tris, nb, tags: T };
}

/** The piece as cloth, about `h` cm between points, split along each fold line (from a to b, extended across the piece). */
export function meshPiece(pc: Piece, h = 1.6, folds: [P, P][] = [], wedges: Wedge[] = []): Mesh2D {
  let regions: Edge[][] = [outlineEdges(pc)];
  for (const [a, b] of folds) {
    const next: Edge[][] = [];
    for (const r of regions) {
      for (const keepLeft of [true, false]) {
        const part = clip(r, a, b, keepLeft, '_fold');
        if (part.length > 2) next.push(part);
      }
    }
    regions = next;
  }
  const pts: P[] = [];
  const tris: [number, number, number][] = [];
  const runs: Record<string, number[][]> = {};
  const key = (q: P) => `${Math.round(q.x * 100)},${Math.round(q.y * 100)}`;
  const index = new Map<string, number>();
  const at = (q: P) => {
    const k = key(q);
    let i = index.get(k);
    if (i === undefined) {
      i = pts.length;
      pts.push(q);
      index.set(k, i);
    }
    return i;
  };
  for (const r of regions) {
    const m = meshRegion(r, h, wedges);
    const ids = m.pts.map(at);
    for (const [a, b, c] of m.tris) tris.push([ids[a], ids[b], ids[c]]);
    // Runs of each tag round this region's outline (the fold's own edge is not a seam).
    let cur: number[] = [];
    let curTag = '';
    const flush = () => {
      if (curTag && curTag !== '_fold' && cur.length > 1) (runs[curTag] ??= []).push(cur);
      cur = [];
    };
    for (let i = 0; i < m.nb; i++) {
      const t = m.tags[i];
      if (t !== curTag) {
        if (cur.length) cur.push(ids[i]);
        flush();
        curTag = t;
      }
      cur.push(ids[i]);
    }
    cur.push(ids[0]);
    flush();
  }
  // Runs split where the outline was cut by a fold, or that start part way round, are joined end to start.
  for (const t of Object.keys(runs)) {
    const rs = runs[t];
    let joined = true;
    while (joined) {
      joined = false;
      for (let i = 0; i < rs.length && !joined; i++) {
        for (let j = 0; j < rs.length && !joined; j++) {
          if (i !== j && rs[i][rs[i].length - 1] === rs[j][0]) {
            rs[i] = [...rs[i], ...rs[j].slice(1)];
            rs.splice(j, 1);
            joined = true;
          }
        }
      }
    }
  }
  // Points no triangle uses (left over inside a dart, or by the triangles' trimming) are dropped.
  const used = new Int32Array(pts.length).fill(-1);
  const kept: P[] = [];
  for (const t of tris) for (const i of t) if (used[i] < 0) {
    used[i] = kept.length;
    kept.push(pts[i]);
  }
  tris.forEach((t, k) => (tris[k] = [used[t[0]], used[t[1]], used[t[2]]]));
  for (const t of Object.keys(runs)) runs[t] = runs[t].map((r) => r.map((i) => used[i]).filter((i) => i >= 0)).filter((r) => r.length > 1);
  for (const [k, v] of index) index.set(k, used[v]);
  pts.length = 0;
  pts.push(...kept);
  const side = folds.map(([a, b]) => pts.map((q) => (cross(a, b, q) < -1e-6 ? 1 : 0)));
  const find = (q: P) => {
    const i = index.get(key(q));
    return i !== undefined && i >= 0 ? i : undefined;
  };
  const darts: [number[], number[]][] = [];
  for (const [n, tip, f] of wedges) {
    const leg = (end: P) => [tip, ...legPoints(tip, end, h), end].map(find).filter((i): i is number => i !== undefined);
    const a = leg(n);
    const b = leg(f);
    if (a.length > 1 && b.length > 1) darts.push([a, b]);
  }
  return { pts, tris, runs, side, darts };
}
