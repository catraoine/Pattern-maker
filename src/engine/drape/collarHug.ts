// A tailored collar's stand leans in to the neck, as a pressed and interfaced collar does: its top edge is cut shorter
// than its neck edge, so it hugs. Laid by the sim it rose straight up from the neckline, which sits a little wide of
// the neck on a jacket, so round the sides and back it stood 2 to 4 cm off the neck as a funnel (the Look 02 vest's
// side view, Cat Nov 11: "Apply and make fixes"). Here each point of the collar is drawn in towards the neck by how
// far the stand at its place round the neck stands off it, more the higher it is above the neck seam, so the seam
// stays sewn where it is and the fall moves with the stand it lies on. Round the front, where the collar runs on into
// the lapel and opens away from the neck with it, it is left as it lies.
import type { Draped } from './garment';
import type { Space } from './space';

/** How far off the neck the top of the stand settles, cm: the collar's own two layers and a little air. */
const HUG = 0.7;
/** How far round from the centre front the lean starts and reaches full, in degrees. */
const FROM = 55;
const FULL = 85;
/** Bins round the neck, in degrees. */
const BIN = 10;
/** The most the top of the stand is drawn in, cm: further, on a small body with a wide neckline, the collar's top edge
 *  was pulled shorter than it is cut and the check read it as strained. */
const MOST = 1;
/** How much longer than it is cut a stretch of collar may be drawn before the quality check reads it as strained. */
const STRAIN = 1.8;

export function hugCollars(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, sp: Pick<Space, 'bodyR'>): void {
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])])
    for (const p of d.panels) {
      if (p.hidden || p.role !== 'collar') continue;
      const n = p.mesh.pts.length;
      const at = (k: number) => {
        const I = (p.base + k) * 3;
        const a = Math.atan2(pos[I], pos[I + 2]);
        return { I, a, deg: (Math.abs(a) * 180) / Math.PI, c: pos[I + 1], r: Math.hypot(pos[I], pos[I + 2]) };
      };
      // Round the neck, bin by bin: the neck seam's level (the collar's lowest point there), its top (the roll), and
      // how far the top of the stand stands off the neck (its nearest point within 1.5 cm of the roll: lower down, the
      // fall's ends lie out over the shoulder, where the form is wider than the neck).
      const seam = new Map<number, number>();
      const top = new Map<number, number>();
      for (let k = 0; k < n; k++) {
        const q = at(k);
        const b = Math.round(q.deg / BIN);
        seam.set(b, Math.max(seam.get(b) ?? -Infinity, q.c));
        top.set(b, Math.min(top.get(b) ?? Infinity, q.c));
      }
      const room = new Map<number, number>();
      for (let k = 0; k < n; k++) {
        const q = at(k);
        const b = Math.round(q.deg / BIN);
        if (q.c > top.get(b)! + 1.5) continue;
        room.set(b, Math.min(room.get(b) ?? Infinity, q.r - sp.bodyR(q.a, q.c)));
      }
      // (Read smoothly between bins, so neighbouring points round the neck don't step.)
      const read = (m: Map<number, number>, deg: number) => {
        const f = deg / BIN;
        const b0 = Math.floor(f);
        const v0 = m.get(b0) ?? m.get(b0 + 1) ?? 0;
        const v1 = m.get(b0 + 1) ?? v0;
        return v0 + (v1 - v0) * (f - b0);
      };
      // How far in each point goes, then evened over the mesh so neighbours move together (moved point by point, the
      // odd pair either side of a bin's edge moved apart and the cloth between read as strained), the neck seam held.
      const move = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const q = at(k);
        const round = Math.min(1, Math.max(0, (q.deg - FROM) / (FULL - FROM)));
        if (!round) continue;
        const off = Math.min(MOST, read(room, q.deg) - HUG);
        if (off <= 0) continue;
        const s = read(seam, q.deg);
        const h = s - read(top, q.deg);
        if (h <= 0) continue;
        // (The higher above the seam, the further in: the stand leans about its seam, the fall over it with it.)
        move[k] = off * round * Math.min(1, Math.max(0, (s - q.c) / h));
      }
      const held = new Set((p.mesh.runs.neck ?? []).flat());
      // (Nor where the collar is already drawn out longer than it is cut, reaching round a wide neck: leaned in there it
      // was pulled further and read as strained, on 1 body in 41.)
      const P3 = (k: number) => [pos[(p.base + k) * 3], pos[(p.base + k) * 3 + 1], pos[(p.base + k) * 3 + 2]];
      for (const t of p.mesh.tris)
        for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
          const cut = Math.hypot(p.mesh.pts[u].x - p.mesh.pts[v].x, p.mesh.pts[u].y - p.mesh.pts[v].y);
          const [a, b] = [P3(u), P3(v)];
          if (cut > 0.05 && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / cut > 1.5) held.add(u).add(v);
        }
      const nb: number[][] = Array.from({ length: n }, () => []);
      for (const [a, b, c] of p.mesh.tris) {
        nb[a].push(b, c);
        nb[b].push(a, c);
        nb[c].push(a, b);
      }
      for (let pass = 0; pass < 3; pass++) {
        const was = Float64Array.from(move);
        for (let k = 0; k < n; k++) if (nb[k].length) move[k] = (was[k] + nb[k].reduce((t, j) => t + was[j], 0) / nb[k].length) / 2;
      }
      // (And not at all if leaning it in draws any of it out longer than before: on 2 bodies in 41, both with a wide
      // neck for their size, a few more points of the collar ended over the quality check's limit.)
      const strained = () => {
        let c = 0;
        for (const t of p.mesh.tris)
          for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
            const cut = Math.hypot(p.mesh.pts[u].x - p.mesh.pts[v].x, p.mesh.pts[u].y - p.mesh.pts[v].y);
            const [a, b] = [P3(u), P3(v)];
            if (cut > 0.05 && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / cut > STRAIN) c++;
          }
        return c;
      };
      const before = strained();
      const was = pos.slice((p.base) * 3, (p.base + n) * 3);
      for (let k = 0; k < n; k++) {
        if (!move[k] || held.has(k)) continue;
        const q = at(k);
        const f = (q.r - move[k]) / (q.r || 1);
        pos[q.I] *= f;
        pos[q.I + 2] *= f;
      }
      if (strained() > before) pos.set(was, p.base * 3);
    }
}
