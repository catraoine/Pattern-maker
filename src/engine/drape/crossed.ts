// Cloth drawn passing through itself: a full skirt's flutes swung round at the side seams went through each other, and
// the drawing showed slits and the cloth's inside there while every other check passed (All round quality 2026-11-07,
// Cat's V-neck circle-skirt dress). Counts the pairs of a skirt's triangles that cut through each other.
import type { Draped } from './garment';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Whether the segment p..q passes through the triangle a, b, c (strictly between its ends). */
function segThroughTri(p: V, q: V, a: V, b: V, c: V): boolean {
  const d = sub(q, p);
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const h = cross(d, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const s = sub(p, a);
  const u = dot(s, h) / det;
  if (u < 0 || u > 1) return false;
  const r = cross(s, e1);
  const v = dot(d, r) / det;
  if (v < 0 || u + v > 1) return false;
  const t = dot(e2, r) / det;
  return t > 1e-6 && t < 1 - 1e-6;
}

/** The pairs of triangles, over the shown panels `which` picks, that pass through each other. Triangles sharing a
 *  point, or sewn to each other's points, touch rather than cross and are not counted. */
export function crossings(d: Draped, which: (p: Draped['panels'][number]) => boolean, seams: { i: number; j: number; k: number }[] = []): Map<string, number> {
  const pos = d.pos;
  const P = (g: number): V => [pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2]];
  const sewn = new Map<number, Set<number>>();
  const join = (a: number, b: number) => (sewn.get(a) ?? sewn.set(a, new Set()).get(a)!).add(b);
  for (const { i, j, k } of seams) {
    join(i, j);
    join(i, k);
    join(j, i);
    join(k, i);
  }
  const tris: { g: number[]; name: string }[] = [];
  for (const p of d.panels) if (!p.hidden && which(p)) for (const t of p.mesh.tris) tris.push({ g: t.map((i) => p.base + i), name: p.pc.name });
  const C = 3;
  const grid = new Map<string, number[]>();
  tris.forEach((tr, n) => {
    const vs = tr.g.map(P);
    const lo = [0, 1, 2].map((k) => Math.floor(Math.min(...vs.map((v) => v[k])) / C));
    const hi = [0, 1, 2].map((k) => Math.floor(Math.max(...vs.map((v) => v[k])) / C));
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const key = `${x},${y},${z}`;
          (grid.get(key) ?? grid.set(key, []).get(key)!).push(n);
        }
  });
  const seen = new Set<number>();
  const count = new Map<string, number>();
  for (const cell of grid.values())
    for (let a = 0; a < cell.length; a++)
      for (let b = a + 1; b < cell.length; b++) {
        const [m, n] = cell[a] < cell[b] ? [cell[a], cell[b]] : [cell[b], cell[a]];
        const key = m * tris.length + n;
        if (seen.has(key)) continue;
        seen.add(key);
        const A = tris[m];
        const B = tris[n];
        if (A.g.some((g) => B.g.includes(g) || B.g.some((h) => sewn.get(g)?.has(h)))) continue;
        const av = A.g.map(P);
        const bv = B.g.map(P);
        let hit = false;
        for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) if (segThroughTri(av[u], av[v], bv[0], bv[1], bv[2]) || segThroughTri(bv[u], bv[v], av[0], av[1], av[2])) hit = true;
        if (hit) count.set(A.name, (count.get(A.name) ?? 0) + 1);
      }
  return count;
}
