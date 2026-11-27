// A top's hem edge faired after the sim, for the drape (run.ts): kept in its own file, as new garment logic is.
import type { Draped } from './garment';

/** A bodice's free hem, smoothed along its length. Where the hem runs on a slant or a curve across the cloth's mesh
 *  (a shirttail's sides, scooped up 7.5 cm), its edge points are many times closer together than the mesh's points
 *  inside, and each settled a little toward its nearest one: the edge came out as small saw-teeth, front, side and back
 *  (the Leopard Shirt Dress, bug hunt Nov 14). Each point is drawn toward its neighbours along the edge a few times over,
 *  which takes out ripples a few cm long and leaves the hem's own shape, tens of cm long, as it hung. A corner in the cut
 *  (the hem meeting the front edge or a split) stays where it is. */
export function fairTorsoHem(d: Draped, passes = 8, roles: readonly string[] = ['front', 'back']): void {
  for (const pos of [d.pos, d.posMirror].filter((p): p is Float64Array => !!p))
    for (const p of d.panels) {
      if (p.hidden || !roles.includes(p.role)) continue;
      for (const run of p.mesh.runs.hem ?? []) {
        if (run.length < 5) continue;
        const flat = run.map((i) => p.mesh.pts[i]);
        // (Held: the run's two ends, and any point where the cut hem turns by more than about 30 degrees.)
        const held = flat.map((q, k) => {
          if (k === 0 || k === flat.length - 1) return true;
          const a = flat[k - 1];
          const b = flat[k + 1];
          const u = [q.x - a.x, q.y - a.y];
          const v = [b.x - q.x, b.y - q.y];
          const cos = (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) || 1);
          return cos < 0.87;
        });
        const ids = run.map((i) => p.base + i);
        for (let it = 0; it < passes; it++) {
          const was = ids.map((g) => [pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2]]);
          ids.forEach((g, k) => {
            if (held[k]) return;
            for (let c = 0; c < 3; c++) pos[g * 3 + c] = (was[k - 1][c] + 2 * was[k][c] + was[k + 1][c]) / 4;
          });
        }
      }
    }
}

/** A skirt's diagonal or high-low hem, faired the same way. Cut on a slant right across the skirt, its edge crossed the mesh the
 *  whole way round and settled as small saw-teeth, plainest in a crisp wool trumpet, whose flare holds every tooth out
 *  (weekly eye check 2026-11-25). A level hem runs along the mesh and is left as it hung. */
export function fairSkirtHem(d: Draped): void {
  fairTorsoHem(d, 8, ['peplum-front', 'peplum-back']);
}
