// A buttoned jacket's front, faired across its centre line. The sim holds each front to the centre line where it is
// buttoned and closed, closer in to the body than the cloth either side of it hangs, so the centre front lay in a
// groove a cm and more deep with a ridge each side, and in profile the closed front read as a ragged flap standing
// off the jacket (Cat, Nov 10: "it still seems like it should be cleaner").
import type { Panel } from './garment';

/** Each lapelled front's cloth within `band` cm of its centre line eased to the depth round the body of the cloth
 *  beside it, level by level: its own points' middle, over and over, the cloth further round left as it settled.
 *  (The extension past the centre line is laid over the other front afterwards, see garment.ts.) Moves `res`. */
export function fairFrontCentre(panels: Panel[], res: Float64Array | number[], band = 3.5): void {
  for (const p of panels) {
    if (p.hidden || p.role !== 'front' || !p.turned.some(Boolean)) continue;
    const pts = p.mesh.pts;
    // (Below the lapel's roll only: above the break the front turns back there.)
    const breakY = pts.reduce((m, q, i) => (p.turned[i] ? Math.max(m, q.y) : m), -Infinity);
    const inBand = (i: number) => !p.turned[i] && pts[i].x > -0.3 && pts[i].x < band && pts[i].y > breakY - 1;
    const nb = pts.map(() => new Set<number>());
    for (const [u, v, w] of p.mesh.tris) {
      nb[u].add(v).add(w);
      nb[v].add(u).add(w);
      nb[w].add(u).add(v);
    }
    const r = pts.map((_, i) => Math.hypot(res[(p.base + i) * 3], res[(p.base + i) * 3 + 2]));
    const r0 = [...r];
    const ids = pts.map((_, i) => i).filter(inBand);
    for (let it = 0; it < 40; it++) {
      const next: [number, number][] = [];
      for (const i of ids) {
        // (Its neighbours on the front itself, not on the extension past the centre line, which lies on the other front.)
        const near = [...nb[i]].filter((j) => !p.turned[j] && pts[j].x > -0.3);
        if (near.length) next.push([i, near.reduce((s, j) => s + r[j], 0) / near.length]);
      }
      for (const [i, v] of next) r[i] = v;
    }
    for (const i of ids) {
      // (Coming in over the 2 cm below the break, where the lapel begins to roll.)
      const b = Math.min(1, Math.max(0, (pts[i].y - breakY + 1) / 2));
      const k = (r0[i] + (r[i] - r0[i]) * b * b * (3 - 2 * b)) / (r0[i] || 1);
      res[(p.base + i) * 3] *= k;
      res[(p.base + i) * 3 + 2] *= k;
    }
  }
}
