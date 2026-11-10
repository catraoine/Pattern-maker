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

/** A jacket's or coat's back, faired across its centre below the waist. Held to the centre line, the centre back hung
 *  straight down from the shoulder blades while the cloth beside it lay in on the seat, and what the back is cut wider
 *  than the body there gathered into a ridge down the centre back, 3 cm and more proud at the hem, with a vent's
 *  underlap standing straight out behind it: from the side the hem flicked out at the back like a tail (Cat, Nov 10:
 *  "why does the bottom bit stick out at the back?"). The cloth within `band` cm of the centre back is eased to the
 *  depth of the cloth beside it, coming in over the first few cm below the waist, and a vent's underlap laid just
 *  under the other side's cloth. Moves `pos`. */
export function fairBackCentre(panels: Panel[], pos: Float64Array | number[], band = 9): void {
  for (const p of panels) {
    if (p.hidden || p.role !== 'back') continue;
    const pts = p.mesh.pts;
    const I = (i: number) => (p.base + i) * 3;
    // (Only a back with its centre on the centre line: a point of it at the cut centre, drawn at the body's.)
    if (!pts.some((q, i) => Math.abs(q.x) < 0.3 && Math.abs(pos[I(i)]) < 0.5)) continue;
    const nb = pts.map(() => new Set<number>());
    for (const [u, v, w] of p.mesh.tris) {
      nb[u].add(v).add(w);
      nb[v].add(u).add(w);
      nb[w].add(u).add(v);
    }
    const r = pts.map((_, i) => Math.hypot(pos[I(i)], pos[I(i) + 2]));
    const r0 = [...r];
    // (Levels run down from the waist at 0: from 2 cm below it, in full by 8 cm below.)
    const share = (i: number) => {
      const b = Math.min(1, Math.max(0, (pos[I(i) + 1] - 2) / 6));
      return b * b * (3 - 2 * b);
    };
    const ids = pts.map((_, i) => i).filter((i) => pts[i].x > -0.3 && pts[i].x < band && share(i) > 0);
    for (let it = 0; it < 120; it++) {
      const next: [number, number][] = [];
      for (const i of ids) {
        const near = [...nb[i]].filter((j) => pts[j].x > -0.3);
        if (near.length) next.push([i, near.reduce((s, j) => s + r[j], 0) / near.length]);
      }
      for (const [i, v] of next) r[i] = v;
    }
    for (const i of ids) {
      const k = (r0[i] + (r[i] - r0[i]) * share(i)) / (r0[i] || 1);
      pos[I(i)] *= k;
      pos[I(i) + 2] *= k;
    }
    // A vent's underlap, cut past the centre back: each point under the cloth of the other side it lies beneath, the
    // spot of this back as far the other side of the centre as it is cut past it, a layer in. (The spot within the
    // triangle it falls in, not the nearest point: from point to point the vent's edge ran in steps.)
    const body = p.mesh.tris.filter((t) => t.every((j) => pts[j].x > -0.3));
    const spot = (x: number, y: number): [number, number, number] | undefined => {
      let best: { w: [number, number, number]; t: [number, number, number]; out: number } | undefined;
      for (const t of body) {
        const [a, b, c] = t.map((j) => pts[j]);
        const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(den) < 1e-9) continue;
        const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den;
        const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den;
        const out = Math.max(0, -wa, -wb, wa + wb - 1);
        if (!best || out < best.out) best = { w: [wa, wb, 1 - wa - wb], t, out };
        if (out === 0) break;
      }
      if (!best) return undefined;
      // (Just past the cloth's edge, the nearest spot on it.)
      const w = best.w.map((v) => Math.max(0, v));
      const sum = w[0] + w[1] + w[2];
      return [0, 1, 2].map((d) => best.t.reduce((acc, j, k) => acc + (pos[I(j) + d] * w[k]) / sum, 0)) as [number, number, number];
    };
    // (Past the cloth's own centre back at that level, wherever that has settled: on a roomy back it hangs a little
    // off the body's centre line, and laid past the body's instead the underlap folded sharply back on itself. Its
    // run down the back taken smooth, over 5 cm either way: point by point, the vent's edge ran in steps.)
    const cb = pts.map((q, i) => ({ y: q.y, x: pos[I(i)] })).filter((_, i) => Math.abs(pts[i].x) < 0.3);
    const centreX = (y: number) => {
      let sum = 0, n = 0;
      for (const c of cb) {
        const w = Math.max(0, 1 - Math.abs(c.y - y) / 5);
        sum += c.x * w;
        n += w;
      }
      return n ? sum / n : 0;
    };
    pts.forEach((q, i) => {
      if (q.x > -0.3) return;
      const m = spot(-q.x, q.y);
      if (!m) return;
      const to = [2 * centreX(q.y) - m[0], m[1], m[2]];
      const rho = Math.hypot(to[0], to[2]) || 1;
      const k = Math.max(0, rho - p.thick[i]) / rho;
      pos[I(i)] = to[0] * k;
      pos[I(i) + 1] = to[1];
      pos[I(i) + 2] = to[2] * k;
    });
  }
}
