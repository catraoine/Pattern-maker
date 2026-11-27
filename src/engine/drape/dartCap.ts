import type { Mesh2D } from './mesh2d';
import { knob } from './knob';
import type { Draped } from './garment';

type Chain = { ids: number[]; s: number[] };
type Cap = { run: number[]; tip: number };

// (A point in the cloth: inside one of the mesh's triangles.)
const inTri = (x: number, y: number, A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }) => {
  const d1 = (x - B.x) * (A.y - B.y) - (A.x - B.x) * (y - B.y);
  const d2 = (x - C.x) * (B.y - C.y) - (B.x - C.x) * (y - C.y);
  const d3 = (x - A.x) * (C.y - A.y) - (C.x - A.x) * (y - A.y);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

// (A point inside a closed outline, by counting crossings.)
const inside = (x: number, y: number, poly: { x: number; y: number }[]) => {
  let n = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const A = poly[i];
    const B = poly[j];
    if (A.y > y !== B.y > y && x < ((B.x - A.x) * (y - A.y)) / (B.y - A.y) + A.x) n = !n;
  }
  return n;
};

function capsOf(mesh: Mesh2D): Cap[] {
  const { pts, tris } = mesh;
  const out: Cap[] = [];
  for (const run of mesh.runs.dart ?? []) {
    if (run.length < 3) continue;
    const a = pts[run[0]];
    const b = pts[run[run.length - 1]];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 0.5) continue;
    // (Its point: the run's point furthest from the line between its ends.)
    let tip = 1;
    let far = -1;
    run.forEach((i, k) => {
      const q = pts[i];
      const d = Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / L;
      if (d > far) {
        far = d;
        tip = k;
      }
    });
    if (tip <= 0 || tip >= run.length - 1 || far < 0.3) continue;
    const T = pts[run[tip]];
    const cx = (a.x + b.x + T.x) / 3;
    const cy = (a.y + b.y + T.y) / 3;
    if (tris.some(([i, j, k]) => inTri(cx, cy, pts[i], pts[j], pts[k]))) out.push({ run, tip });
  }
  return out;
}

/** A dart's cap: where a dart meets a seam, the pattern's edge is cut out to a point past the seam (a French dart's at
 *  the side, a waist dart's at the hem), so that once the dart is sewn and pressed the edge runs straight. The sim sews
 *  the dart's legs but left the cap as cut, a flap of cloth standing out of the seam: a French dart top showed it as a
 *  tail past the hem corner on both sides (weekly eye check, Nov 25). The cap's two edges, each from the seam in to
 *  its point, are sewn to each other, so it folds flat into the dart as it is pressed.
 *  Only a cap, cut outward: a run whose triangle (its two ends and its point) is cloth. (A dart cut open as a notch in
 *  the edge has that triangle in the gap, and its legs are sewn as a dart already.) */
export function dartCaps(p: { mesh: Mesh2D; base: number }): [Chain, Chain][] {
  if (knob('__noDartCap')) return [];
  const { pts } = p.mesh;
  const half = (idx: number[]): Chain => {
    const s: number[] = [];
    let t = 0;
    idx.forEach((i, n) => {
      if (n) t += Math.hypot(pts[i].x - pts[idx[n - 1]].x, pts[i].y - pts[idx[n - 1]].y);
      s.push(t);
    });
    return { ids: idx.map((i) => i + p.base), s };
  };
  // (Each edge from the seam to the point, the point itself left out: it is one point, already where both meet.)
  return capsOf(p.mesh).map(({ run, tip }) => [half(run.slice(0, tip)), half(run.slice(tip + 1).reverse())]);
}

/** And once sewn, the folded cap pressed flat into its seam for the drawing. Sewn on itself, the cap still hung as a
 *  small tab out of the side seam (the French dart top, weekly eye check, Nov 25); pressed, it lies in the seam
 *  allowance, out of sight. Each of the cap's points is laid on the seam between the cap's two ends, at its place along
 *  them. */
export function pressDartCaps(d: Draped): void {
  if (knob('__noDartCap') || knob('__noCapPress')) return;
  for (const pos of [d.pos, d.posMirror].filter((q): q is Float64Array => !!q))
    for (const p of d.panels) {
      if (p.hidden) continue;
      const { pts } = p.mesh;
      for (const { run } of capsOf(p.mesh)) {
        const a = pts[run[0]];
        const b = pts[run[run.length - 1]];
        const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        const ga = (p.base + run[0]) * 3;
        const gb = (p.base + run[run.length - 1]) * 3;
        // (The cap: its cut edge, which bulges out past the straight line from each end to the point, closed by the seam.)
        const edge = run.map((i) => pts[i]);
        const onRun = new Set(run);
        pts.forEach((q, i) => {
          if (i === run[0] || i === run[run.length - 1] || (!onRun.has(i) && !inside(q.x, q.y, edge))) return;
          const t = Math.min(1, Math.max(0, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / L2));
          const g = (p.base + i) * 3;
          for (let c = 0; c < 3; c++) pos[g + c] = pos[ga + c] + (pos[gb + c] - pos[ga + c]) * t;
        });
      }
    }
}
