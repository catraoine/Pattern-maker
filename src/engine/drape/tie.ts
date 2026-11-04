// A side tie drawn on the settled cloth: two narrow ties knotted at the left side seam at the waist, their ends
// hanging down the side of the garment, following its side seam as it settled (belt.ts, 'side_tie'). The knot is a
// small rounded bundle at the seam; each tail is a ribbon of the tie's width, one hanging a little forward of the
// seam and one a little behind, both swinging out gently toward their ends. Built in the drape's cm (x to the
// wearer's left, c down from the waist, z forward), as more points on the same arrays, so it is drawn as cloth.
import type { Draped } from './garment';

export interface SideTieSpec {
  widthCm: number;
  lengthCm: number;
}

export interface TieMesh {
  /** The tie's points, x c z. */
  pos: number[];
  tris: number[][];
  /** Flat-pattern cm per point, for the print. */
  uv: number[];
  /** For each point, the index of the settled seam point it hangs by (for its drawn scale). */
  ref: number[];
}

/** Points of the cloth's left side seam, by level. */
function leftSide(d: Pick<Draped, 'lines' | 'pos'>): { i: number; x: number; c: number; z: number }[] {
  const out: { i: number; x: number; c: number; z: number }[] = [];
  const seen = new Set<number>();
  for (const l of d.lines) {
    if (l.kind !== 'side') continue;
    for (const i of l.ids) {
      if (seen.has(i)) continue;
      seen.add(i);
      const x = d.pos[i * 3];
      if (x <= 0) continue;
      out.push({ i, x, c: d.pos[i * 3 + 1], z: d.pos[i * 3 + 2] });
    }
  }
  return out.sort((a, b) => a.c - b.c);
}

export function sideTie(d: Pick<Draped, 'lines' | 'pos'>, spec: SideTieSpec): TieMesh | undefined {
  const side = leftSide(d);
  if (side.length < 4) return undefined;
  // The seam at a level: the nearest seam points above and below it, read between.
  const at = (c: number) => {
    let k = 0;
    while (k < side.length - 2 && side[k + 1].c < c) k++;
    const a = side[k];
    const b = side[k + 1];
    const t = b.c > a.c ? Math.max(0, Math.min(1, (c - a.c) / (b.c - a.c))) : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, i: t < 0.5 ? a.i : b.i };
  };
  const top = Math.max(side[0].c, Math.min(0, side[side.length - 1].c - 4));
  const K = at(top);
  const pos: number[] = [];
  const tris: number[][] = [];
  const uv: number[] = [];
  const ref: number[] = [];
  const add = (x: number, c: number, z: number, u: number, v: number, i: number) => {
    pos.push(x, c, z);
    uv.push(u, v);
    ref.push(i);
    return pos.length / 3 - 1;
  };
  // Out from the centre: the seam's own direction, so the tie stands off the cloth, not into it.
  const outDir = (x: number, z: number) => {
    const r = Math.hypot(x, z) || 1;
    return [x / r, z / r];
  };
  // The knot: the two ties crossed and pulled tight, one rounded bundle lying along the seam, wider than it is
  // tall, pressed to the cloth and standing a little off it.
  {
    const [ox, oz] = outDir(K.x, K.z);
    const R = spec.widthCm * 0.5;
    const NA = 12;
    const NB = 6;
    const cx = K.x + ox * (R * 0.45);
    const cz = K.z + oz * (R * 0.45);
    const ring: number[][] = [];
    for (let a = 0; a <= NB; a++) {
      const ph = (Math.PI * a) / NB;
      const row: number[] = [];
      for (let b = 0; b < NA; b++) {
        const th = (2 * Math.PI * b) / NA;
        // sx out from the body, sz along the seam's tangent (forward), sy down: a bundle pulled in a little at its
        // middle, where the ties cross.
        const pinch = 1 - 0.12 * Math.cos(2 * th);
        const sx = Math.sin(ph) * Math.cos(th) * R * 0.7 * pinch;
        const sy = Math.cos(ph) * R * 0.9;
        const sz = Math.sin(ph) * Math.sin(th) * R * 1.45;
        const px = cx + ox * sx - oz * sz;
        const pz = cz + oz * sx + ox * sz;
        row.push(add(px, top + sy, pz, 2 + sz * 0.3, 1 + sy * 0.3, K.i));
      }
      ring.push(row);
    }
    for (let a = 0; a < NB; a++)
      for (let b = 0; b < NA; b++) {
        const b1 = (b + 1) % NA;
        tris.push([ring[a][b], ring[a + 1][b], ring[a][b1]], [ring[a][b1], ring[a + 1][b], ring[a + 1][b1]]);
      }
  }
  // The two tails: each a ribbon down the seam, its face toward the side, standing a cloth's thickness off.
  const N = 16;
  const W = spec.widthCm;
  for (const [sign, swing] of [
    [1, 1.2],
    [-1, 1.8],
  ]) {
    const rows: [number, number][] = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const c = top + spec.widthCm * 0.4 + spec.lengthCm * 0.9 * t;
      const s = at(c);
      const [ox, oz] = outDir(s.x, s.z);
      // Along the seam's tangent (forward for +z): the tail hangs a little off the seam, swinging further as it falls.
      const off = sign * (W * 0.52 + swing * t * t);
      const lift = 0.8 + 0.4 * Math.sin(t * Math.PI);
      const cx = s.x + ox * lift - oz * off;
      const cz = s.z + oz * lift + ox * off;
      // The slanted end: the tie narrows over its last few cm.
      const w = W * (t > 0.9 ? Math.max(0.15, 1 - (t - 0.9) * 8) : 1);
      // The tail turns a little on its length as it hangs, so its face shows from the front and the back too.
      const ph = sign * 0.55 * Math.sin(t * Math.PI);
      const wx = -oz * Math.cos(ph) + ox * Math.sin(ph);
      const wz = ox * Math.cos(ph) + oz * Math.sin(ph);
      const a = add(cx + wx * (w / 2), c, cz + wz * (w / 2), spec.lengthCm * t, w / 2 + 4 * (sign + 1), s.i);
      const b = add(cx - wx * (w / 2), c, cz - wz * (w / 2), spec.lengthCm * t, -w / 2 + 4 * (sign + 1), s.i);
      rows.push([a, b]);
    }
    for (let k = 0; k < N; k++) {
      const [a0, b0] = rows[k];
      const [a1, b1] = rows[k + 1];
      tris.push([a0, b0, a1], [a1, b0, b1]);
    }
  }
  return { pos, tris, uv, ref };
}
