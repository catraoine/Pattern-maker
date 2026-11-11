// A cowl's fall, drawn as the soft U it hangs in. The cowl front is cut wider than the body above the bust, and the
// settling has to put that spare width somewhere: on a mesh this coarse it crumpled it, the fold's edge in a zigzag
// with flaps standing off it and a tuft at each shoulder, and the quality check passed it all the same (Cat,
// 2026-11-11: "move forward with collar", after the edge was reported as stepped). A cowl in a soft cloth hangs in
// a smooth curve from one neck point to the other with the cloth under it falling away evenly, so that is what is
// drawn: the fold's edge laid on one smooth curve between where its ends settled, and the cloth between it, the
// armholes and the bust smoothed out to follow.
import type { Draped } from './garment';
import type { Space } from './space';
import { knob } from './knob';

/** Cm above the bust line over which the smoothing comes in: nothing at the bust, in full this far above it. */
const OVER = 6;
/** How many times the cloth is evened out toward its neighbours. More drew the fold up into a straight line with a dip at the centre; fewer left the crumples as dents. */
const ROUNDS = 20;

/** Each cowl front: its fold edge and the cloth above the bust smoothed, the shoulder seam and armhole left where
 *  they settled, and nothing left inside the body. Moves `out.pos`. */
export function fairCowl(out: Draped, sp: Space): void {
  const rounds = knob('__cowlFair') ?? ROUNDS;
  if (rounds <= 0) return;
  for (const p of out.panels) {
    const cw = p.pc.meta.cowl as { L: number; top: number; bustY: number } | undefined;
    if (!cw || p.hidden) continue;
    const pts = p.mesh.pts;
    const n = pts.length;
    const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
    for (const [u, v, w] of p.mesh.tris) {
      nb[u].add(v).add(w);
      nb[v].add(u).add(w);
      nb[w].add(u).add(v);
    }
    const held = new Set<number>([...(p.mesh.runs.shoulder ?? []).flat(), ...(p.mesh.runs.armhole ?? []).flat()]);
    // The fold's edge, from the centre front out to the neck point.
    const edge = [...new Set((p.mesh.runs.neck ?? []).flat())].sort((a, b) => pts[a].x - pts[b].x);
    if (edge.length < 3) continue;
    const share = pts.map((q) => {
      const b = Math.min(1, Math.max(0, (cw.bustY - q.y) / OVER));
      return b * b * (3 - 2 * b);
    });
    for (const pos of [out.pos, ...(out.posMirror ? [out.posMirror] : [])]) {
      const at = (i: number, c: number) => (p.base + i) * 3 + c;
      // (Evened toward its neighbours the cloth cuts the corner through the chest and the shoulder: after every round
      // each point is brought back out to its own thickness off the body, so the cloth slides over the body as it
      // smooths. Brought out once at the end, the fold's edge was pulled 3 to 5 times its cut length.)
      const clear = (i: number) => {
        const [x, c, z] = [pos[at(i, 0)], pos[at(i, 1)], pos[at(i, 2)]];
        const r = Math.hypot(x, z);
        if (c < sp.tip.c || r < 1e-6) return;
        const need = sp.bodyR(Math.atan2(x, z), c) + p.thick[i] - r;
        if (need <= 0) return;
        pos[at(i, 0)] *= (r + need) / r;
        pos[at(i, 2)] *= (r + need) / r;
      };
      // The edge first: evened out along its own length, its ends where they settled, then set to the height of one
      // curve between them (a parabola, as the cowl is laid before it settles), lowest at the centre front.
      for (let it = 0; it < rounds; it++) {
        const next = edge.map((i, k) => (k === 0 || k === edge.length - 1 ? [0, 1, 2].map((c) => pos[at(i, c)]) : [0, 1, 2].map((c) => (pos[at(edge[k - 1], c)] + pos[at(edge[k + 1], c)]) / 2)));
        edge.forEach((i, k) => {
          if (k > 0) pos[at(i, 0)] = next[k][0];
          pos[at(i, 1)] = next[k][1];
          pos[at(i, 2)] = next[k][2];
          if (k > 0 && k < edge.length - 1) clear(i);
        });
      }
      // (Evened so, the edge's points end up equally spaced along it, however the cloth is cut between them: where the
      // settling had gathered the fold in beside the neck point it read as stretched 3 to 5 times its cut. Each
      // point is put back along the smoothed line at its own share of the fold's cut length.)
      {
        const line = edge.map((i) => [0, 1, 2].map((c) => pos[at(i, c)]));
        const run = [0];
        for (let k = 1; k < line.length; k++) run.push(run[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1], line[k][2] - line[k - 1][2]));
        const cut = pts[edge[edge.length - 1]].x - pts[edge[0]].x;
        let seg = 1;
        edge.forEach((i, k) => {
          if (k === 0 || k === edge.length - 1 || cut < 1) return;
          const want = ((pts[i].x - pts[edge[0]].x) / cut) * run[run.length - 1];
          while (seg < run.length - 1 && run[seg] < want) seg++;
          const t = (want - run[seg - 1]) / (run[seg] - run[seg - 1] || 1);
          for (const c of [0, 1, 2]) pos[at(i, c)] = line[seg - 1][c] + (line[seg][c] - line[seg - 1][c]) * t;
        });
      }
      const [c0, n0] = [edge[0], edge[edge.length - 1]];
      // (The centre front point settles as the tip of a V, lower than the cloth beside it: set level with the curve
      // through its two neighbours, flat at the centre, or the smooth edge keeps a notch there.)
      for (const c of [1, 2]) pos[at(c0, c)] = (4 * pos[at(edge[1], c)] - pos[at(edge[2], c)]) / 3;
      const wide = pos[at(n0, 0)] - pos[at(c0, 0)];
      const drop = pos[at(c0, 1)] - pos[at(n0, 1)];
      if (wide > 1 && drop > 0)
        for (const i of edge.slice(1, -1)) {
          const v = Math.min(1, Math.max(0, (pos[at(i, 0)] - pos[at(c0, 0)]) / wide));
          pos[at(i, 1)] = pos[at(n0, 1)] + drop * (1 - v * v);
        }
      // (The armhole's edge too, each run evened along its own length between its ends.)
      for (const run of knob('__cowlArm') === 0 ? [] : p.mesh.runs.armhole ?? [])
        for (let it = 0; it < rounds; it++) {
          const next = run.map((_, k) => (k === 0 || k === run.length - 1 ? null : [0, 1, 2].map((c) => (pos[at(run[k - 1], c)] + pos[at(run[k + 1], c)]) / 2)));
          run.forEach((i, k) => {
            const q = next[k];
            if (q) for (const c of [0, 1, 2]) pos[at(i, c)] += (q[c] - pos[at(i, c)]) * share[i] * 0.5;
          });
        }
      const fixed = new Set<number>([...held, ...edge]);
      const ids = pts.map((_, i) => i).filter((i) => share[i] > 0 && !fixed.has(i) && nb[i].size);
      for (let it = 0; it < rounds; it++) {
        const next = ids.map((i) => {
          const s = [0, 0, 0];
          for (const j of nb[i]) for (const c of [0, 1, 2]) s[c] += pos[at(j, c)];
          return s.map((v, c) => pos[at(i, c)] + (v / nb[i].size - pos[at(i, c)]) * share[i] * 0.5);
        });
        ids.forEach((i, k) => {
          // (A point on the centre fold stays on the centre line: its other half is drawn mirrored.)
          if (Math.abs(pts[i].x) > 0.05) pos[at(i, 0)] = next[k][0];
          pos[at(i, 1)] = next[k][1];
          pos[at(i, 2)] = next[k][2];
          clear(i);
        });
      }
    }
  }
}
