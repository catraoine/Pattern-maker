// A bias slip dress's skirt, its folds softened. Cut in one from the shoulder with its hem flared, the dress settles
// with the hem's spare width folded into a sharp crease or two down the lower skirt, and at the side seams the cloth
// bunches up and kicks out as a keel: a bias satin falls in soft flutes there instead (Cat's reference for SS27 Look
// 07, 2026-11-11: "build bias"). The drawing's quality check read those creases as faults and All round fell back to
// the flat drawing.
import type { Draped } from './garment';
import { knob } from './knob';

/** Cm below `biasBelow` (set on the dress's pieces, see dress.ts) where the softening starts, and the cm it comes in over. */
const FROM = 30;
const OVER = 15;

/** Each point of the lower skirt moved toward the middle of its neighbours round the body, over and over, the same
 *  height kept: a sharp crease is gone in a few rounds while the hem's sweep, many points wide, barely moves. The
 *  cloth above (round the bust, waist and hip, where the dress clings) is left as it settled. Moves `out.pos`. */
export function fairBiasSkirt(out: Draped): void {
  const rounds = knob('__biasFair') ?? 36;
  const panels = out.panels.filter((p) => !p.hidden && typeof p.pc.meta.biasBelow === 'number');
  if (!panels.length || rounds <= 0) return;
  const n = out.pos.length / 3;
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  const share = new Float64Array(n);
  const centre = new Uint8Array(n);
  for (const p of panels) {
    const from = (p.pc.meta.biasBelow as number) + FROM;
    for (const [u, v, w] of p.mesh.tris) {
      nb[p.base + u].add(p.base + v).add(p.base + w);
      nb[p.base + v].add(p.base + u).add(p.base + w);
      nb[p.base + w].add(p.base + u).add(p.base + v);
    }
    p.mesh.pts.forEach((q, i) => {
      const b = Math.min(1, Math.max(0, (q.y - from) / OVER));
      share[p.base + i] = b * b * (3 - 2 * b);
      // (A point on the centre fold stays on the centre line: its other half is drawn mirrored.)
      if (Math.abs(q.x) < 0.05) centre[p.base + i] = 1;
    });
  }
  // (The front and back are sewn at the side seams: each seam point's neighbours are the other piece's too, so the
  // seam is softened with the cloth either side of it and doesn't come apart.)
  const sewn: NonNullable<Draped['seams']> = [];
  for (const s of out.seams ?? []) {
    const { i, j, k, t } = s;
    const o = t < 0.5 ? j : k;
    if (!share[i] && !share[o]) continue;
    sewn.push(s);
    nb[i].add(o);
    nb[o].add(i);
  }
  const ids = Array.from({ length: n }, (_, i) => i).filter((i) => share[i] > 0 && nb[i].size);
  for (const pos of [out.pos, ...(out.posMirror ? [out.posMirror] : [])]) {
    // (Softening alone draws the skirt in a little, at 60 rounds onto the legs: each level's ring is put back out to
    // the size it settled at, measured as its points' mean distance from the body's middle.)
    const level = (i: number) => Math.round(pos[i * 3 + 1] / 2);
    const ring = (): Map<number, number> => {
      const sum = new Map<number, [number, number]>();
      for (const i of ids) {
        const e = sum.get(level(i)) ?? sum.set(level(i), [0, 0]).get(level(i))!;
        e[0] += Math.hypot(pos[i * 3], pos[i * 3 + 2]);
        e[1]++;
      }
      return new Map([...sum].map(([l, [r, c]]) => [l, r / c]));
    };
    const before = ring();
    for (let it = 0; it < rounds; it++) {
      const next: [number, number, number][] = [];
      for (const i of ids) {
        let x = 0;
        let z = 0;
        for (const j of nb[i]) {
          x += pos[j * 3];
          z += pos[j * 3 + 2];
        }
        const s = share[i] * 0.5;
        next.push([i, centre[i] ? pos[i * 3] : pos[i * 3] + (x / nb[i].size - pos[i * 3]) * s, pos[i * 3 + 2] + (z / nb[i].size - pos[i * 3 + 2]) * s]);
      }
      for (const [i, x, z] of next) {
        pos[i * 3] = x;
        pos[i * 3 + 2] = z;
      }
      // (And the seam drawn shut again: each seam point and the spot it is sewn to on the other piece meet halfway.)
      for (const { i, j, k, t } of sewn) {
        for (const c of [0, 2]) {
          const gap = (pos[j * 3 + c] * (1 - t) + pos[k * 3 + c] * t - pos[i * 3 + c]) / 2;
          pos[i * 3 + c] += gap;
          pos[j * 3 + c] -= gap * (1 - t);
          pos[k * 3 + c] -= gap * t;
        }
      }
    }
    const after = ring();
    for (const i of ids) {
      const k = 1 + ((before.get(level(i)) ?? 1) / (after.get(level(i)) || 1) - 1) * share[i];
      pos[i * 3] *= k;
      pos[i * 3 + 2] *= k;
    }
  }
}
