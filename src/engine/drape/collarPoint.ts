// A high lapel's collar point laid back where the pattern puts it when worn. The collar's long end is laid on the lapel
// as worn while it settles (collarEnd.ts), then eased back to its cut lengths, and the easing carried the point 2 to 3
// cm further out, to the edge of the front beside the armhole: from the front it stood past the vest's shoulder like
// a wing (the Black Vest, Cat Nov 12: "Fix"). Here the point goes back onto the front where the flat draws it, the fall
// round it following less the further it is from the point, and the move is kept only while the collar stays within
// the lengths it is cut to as the quality check reads them.
import type { P } from '../geometry';
import type { Draped, Panel } from './garment';

/** How far round the fall, in cm of the collar as cut, the point's move reaches, fading out. */
const REACH = 14;
/** How far out from the front the point lies, cm: the collar's two layers over the lapel's. */
const OUT = 0.8;
/** How much longer than it is cut a stretch of collar may be drawn before the quality check reads it as strained. */
const STRAIN = 1.8;
/** A little under the quality check's share of strained edges in a piece (1%). */
const STRAIN_SHARE = 0.008;

/** The settled place of a point on the front's pattern: the nearest few uncut-back points of the front, weighted by
 *  nearness. */
function onFront(front: Panel, pos: ArrayLike<number>, q: P): [number, number, number] | undefined {
  const near: { i: number; d: number }[] = [];
  front.mesh.pts.forEach((m, i) => {
    if (front.turned[i]) return;
    const d = Math.hypot(m.x - q.x, m.y - q.y);
    if (d > 3) return;
    near.push({ i, d });
  });
  if (!near.length) return undefined;
  near.sort((a, b) => a.d - b.d);
  let w = 0;
  const v: [number, number, number] = [0, 0, 0];
  for (const { i, d } of near.slice(0, 4)) {
    const k = 1 / (d + 0.05);
    const I = (front.base + i) * 3;
    v[0] += pos[I] * k;
    v[1] += pos[I + 1] * k;
    v[2] += pos[I + 2] * k;
    w += k;
  }
  return [v[0] / w, v[1] / w, v[2] / w];
}

function strained(p: Panel, pos: ArrayLike<number>): { c: number; e: number } {
  let c = 0;
  let e = 0;
  for (const t of p.mesh.tris)
    for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      const cut = Math.hypot(p.mesh.pts[u].x - p.mesh.pts[v].x, p.mesh.pts[u].y - p.mesh.pts[v].y);
      if (cut <= 0.05) continue;
      e++;
      const [A, B] = [u, v].map((j) => (p.base + j) * 3);
      if (Math.hypot(pos[A] - pos[B], pos[A + 1] - pos[B + 1], pos[A + 2] - pos[B + 2]) / cut > STRAIN) c++;
    }
  return { c, e };
}

export function layCollarPoints(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, lapel: { collarPoint: P; shawl?: true }): void {
  if (lapel.shawl) return;
  const front = d.panels.find((p) => !p.hidden && p.role === 'front' && /front/i.test(p.pc.name) && !/side/i.test(p.pc.name));
  const collar = d.panels.find((p) => !p.hidden && p.role === 'collar');
  if (!front || !collar) return;
  const pts = collar.mesh.pts;
  // The collar's point: the farthest out along it of its outer edge (as collarEnd.ts finds it).
  const run = (collar.mesh.runs.collar ?? []).flat();
  if (run.length < 2) return;
  const c = run.reduce((a, b) => (pts[b].x > pts[a].x ? b : a));
  const held = new Set([...(collar.mesh.runs.neck ?? []), ...(collar.mesh.runs.gorge ?? [])].flat());
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])]) {
    const on = onFront(front, pos, lapel.collarPoint);
    if (!on) continue;
    const r = Math.hypot(on[0], on[2]) || 1;
    const to = [on[0] + (on[0] / r) * OUT, on[1], on[2] + (on[2] / r) * OUT];
    const C = (collar.base + c) * 3;
    const move = [to[0] - pos[C], to[1] - pos[C + 1], to[2] - pos[C + 2]];
    const before = strained(collar, pos).c;
    const was = pos.slice(collar.base * 3, (collar.base + pts.length) * 3);
    pts.forEach((q, k) => {
      if (held.has(k)) return;
      const f = Math.max(0, 1 - Math.hypot(q.x - pts[c].x, q.y - pts[c].y) / REACH);
      if (!f) return;
      const s = f * f * (3 - 2 * f);
      const I = (collar.base + k) * 3;
      pos[I] += move[0] * s;
      pos[I + 1] += move[1] * s;
      pos[I + 2] += move[2] * s;
    });
    const after = strained(collar, pos);
    if (after.c > before && after.c > STRAIN_SHARE * after.e) pos.set(was, collar.base * 3);
  }
}
