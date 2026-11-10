// A buttoned jacket's front, as it is made: closed down its whole edge, and its lapels pressed flat along a taped roll
// line. The sim alone held the fronts only 2 cm round each button, so they gaped open between and below the buttons,
// and left the roll line free, so it bowed out into a round U and the lapels stood off the chest (Cat's black vest set
// and the Lavender Jacket, 2026-11-06).
import type { P } from '../geometry';
import type { Piece } from '../piece';
import type { Panel } from './garment';
import { knob } from './knob';
import type { Space } from './space';

type V3 = [number, number, number];

/** Where the front edges are held together: round each button, every few cm between them, and on below the last
 *  button every few cm to just above the hem, as the closed front of a single-breasted jacket lies. (Not on a hooded
 *  coat yet: held closed down its front, its hood's cloth stretched past the check's limit, so it keeps the old hold
 *  round each button.) */
export function frontPins(buttons: number[], shell: Piece[]): { y: number; span: number }[] {
  const pins = buttons.map((y) => ({ y, span: 2 }));
  if (!buttons.length) return pins;
  // (Between the buttons, every few cm: never above the top one, where a hood or a collar's neck must stay open.)
  for (let k = 0; k + 1 < buttons.length; k++) for (let y = buttons[k] + 3; y < buttons[k + 1] - 1.5; y += 3) pins.push({ y, span: 1.6 });
  const front = shell.find((pc) => /front/i.test(pc.name) && !/side/i.test(pc.name));
  const near = front?.outline.points().filter((q) => Math.abs(q.x) < 4) ?? [];
  const last = buttons[buttons.length - 1];
  const hem = near.length ? Math.max(...near.map((q) => q.y)) : last;
  for (let y = last + 2; y < hem - (knob('__pinHemGap') ?? 2); y += 3) pins.push({ y, span: 1.6 });
  return pins;
}

function reflect(q: P, a: P, b: P): P {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1);
  return { x: 2 * (a.x + dx * t) - q.x, y: 2 * (a.y + dy * t) - q.y };
}

/** The roll line taped: on each lapelled front, the crease is laid straight from the break to the neck, as far round
 *  the body from the centre front as it is cut, the front within a lapel's width of it coming with it; then the lapel
 *  is pressed onto the front it covers, thinning to nothing at the crease, and the turn eased smooth. Moves `res`. */
export function tapeRollLines(panels: Panel[], res: Float64Array | number[], sp: Pick<Space, 'bodyR'>): void {
  const before = Float64Array.from(res);
  const fronts: Panel[] = [];
  for (const p of panels) {
    if (p.hidden || p.role !== 'front' || !p.folds?.length || !p.turned.some(Boolean)) continue;
    fronts.push(p);
    const [a, b] = p.folds[0];
    const pts = p.mesh.pts;
    const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const along = (q: P) => Math.min(1, Math.max(0, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / L2));
    const off = (q: P) => {
      const t = along(q);
      return Math.hypot(q.x - (a.x + t * (b.x - a.x)), q.y - (a.y + t * (b.y - a.y)));
    };
    const crease = pts.map((q, i) => ({ q, i })).filter(({ q, i }) => !p.turned[i] && off(q) < 0.8);
    if (crease.length < 3) continue;
    const end = (t: number) => crease.reduce((m, c) => (Math.abs(along(c.q) - t) < Math.abs(along(m.q) - t) ? c : m));
    const ya = res[(p.base + end(0).i) * 3 + 1];
    const yb = res[(p.base + end(1).i) * 3 + 1];
    // (The angle round the body from the centre front that a cut distance reaches, at a height: past the centre front,
    // on a double-breasted front's overlap, the other way round.)
    const arcTo = (y: number, s0: number) => {
      const dir = Math.sign(s0);
      let ang = 0;
      let acc = 0;
      while (acc < Math.abs(s0) && Math.abs(ang) < Math.PI) {
        acc += sp.bodyR(ang + dir * 0.002, y) * 0.004;
        ang += dir * 0.004;
      }
      return ang;
    };
    const W = knob('__bridleW') ?? 11;
    const lift = knob('__bridleOff') ?? 1.2;
    // (How far the crease point nearest a place on the roll line has to move, round the body, to lie where it is cut.)
    const disp = (q: P): V3 => {
      const t = along(q);
      const F = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      const c = ya + t * (yb - ya);
      const ang = arcTo(c, F.x);
      const r = sp.bodyR(ang, c) + p.thick[0] + lift;
      const near = crease.reduce((m, k) => (Math.hypot(k.q.x - F.x, k.q.y - F.y) < Math.hypot(m.q.x - F.x, m.q.y - F.y) ? k : m));
      const I = (p.base + near.i) * 3;
      return [Math.sin(ang) * r - res[I], 0, Math.cos(ang) * r - res[I + 2]];
    };
    // (Not where the front is sewn to the back: the shoulder seam stays where the sim sewed it, the move fading in over
    // a few cm away from it, or the seam would be pulled apart. The collar follows the neck instead, below.)
    const sewn = [...(p.mesh.runs.shoulder ?? []), ...(knob('__bridleNeck') ? (p.mesh.runs.neck ?? []) : [])].flat().map((i) => pts[i]);
    const fade = knob('__bridleFade') ?? 7;
    const free = (q: P) => {
      if (!sewn.length) return 1;
      const s = Math.min(1, Math.min(...sewn.map((n) => Math.hypot(n.x - q.x, n.y - q.y))) / fade);
      return s * s * (3 - 2 * s);
    };
    const moves: [number, V3][] = [];
    pts.forEach((q, i) => {
      const r = p.turned[i] ? reflect(q, a, b) : q;
      const d = off(r);
      if (d >= W) return;
      const s = 1 - d / W;
      // (Fading out toward the break, where the front is buttoned: moved with the crease there, a double-breasted
      // front's centre line was drawn 2 to 3 cm across at the top button, and its extension, laid over the other
      // front, folded back on itself in a kink (Cat, Nov 10). From nothing at the break to full over 3 cm above it; on a
      // double-breasted front only, its break well past the centre: a single-breasted lapel's tip flicked out without it.)
      const bf = a.x < -4 ? (knob('__bridleBreak') ?? 3) : 0;
      const u = bf > 0 ? Math.min(1, Math.max(0, (a.y - r.y) / bf)) : 1;
      const w = s * s * (3 - 2 * s) * free(q) * u * u * (3 - 2 * u);
      const D = disp(r);
      moves.push([(p.base + i) * 3, [D[0] * w, 0, D[2] * w]]);
    });
    for (const [I, D] of moves) {
      res[I] += D[0];
      res[I + 2] += D[2];
    }
    // Pressed: each point of the lapel lies on the front it covers (by the nearest few points there, weighted by
    // nearness, so it lies smooth and not stepped), a cloth's thickness out, thinning to nothing at the crease.
    const body = pts.map((q, i) => ({ q, i })).filter(({ i }) => !p.turned[i]);
    const lay = knob('__bridleLay') ?? 0.3;
    const laid: [number, V3][] = [];
    pts.forEach((q, i) => {
      if (!p.turned[i]) return;
      const r = reflect(q, a, b);
      const near = body.map((f) => ({ i: f.i, d: Math.hypot(f.q.x - r.x, f.q.y - r.y) })).sort((u, v) => u.d - v.d).slice(0, 4);
      if (!near.length || near[0].d > 2.5) return;
      let wsum = 0;
      const at: V3 = [0, 0, 0];
      for (const n of near) {
        const w = 1 / (n.d + 0.05) ** 2;
        const J = (p.base + n.i) * 3;
        for (let d = 0; d < 3; d++) at[d] += res[J + d] * w;
        wsum += w;
      }
      for (let d = 0; d < 3; d++) at[d] /= wsum;
      const h = Math.hypot(at[0], at[2]) || 1;
      const out = (h + lay * Math.min(1, off(r) / 1.5)) / h;
      laid.push([(p.base + i) * 3, [at[0] * out, at[1], at[2] * out]]);
    });
    for (const [I, v] of laid) for (let d = 0; d < 3; d++) res[I + d] = v[d];
    // (The turn eased: a few passes of each point within 2 cm of the crease toward its neighbours' middle, so it reads
    // as one soft edge rather than slivers of the cloth's back showing through.)
    const nb = pts.map(() => new Set<number>());
    for (const [u, v, w] of p.mesh.tris) {
      nb[u].add(v).add(w);
      nb[v].add(u).add(w);
      nb[w].add(u).add(v);
    }
    const inBand = pts.map((q, i) => off(p.turned[i] ? reflect(q, a, b) : q) < 2);
    for (let it = 0; it < 4; it++) {
      const next: [number, V3][] = [];
      pts.forEach((_, i) => {
        if (!inBand[i] || !nb[i].size) return;
        const m: V3 = [0, 0, 0];
        for (const j of nb[i]) for (let d = 0; d < 3; d++) m[d] += res[(p.base + j) * 3 + d] / nb[i].size;
        const I = (p.base + i) * 3;
        // (Not at the shoulder seam, which stays sewn to the back.)
        const k = 0.5 * free(pts[i]);
        next.push([I, [res[I] + (m[0] - res[I]) * k, res[I + 1] + (m[1] - res[I + 1]) * k, res[I + 2] + (m[2] - res[I + 2]) * k]]);
      });
      for (const [I, v] of next) for (let d = 0; d < 3; d++) res[I + d] = v[d];
    }
  }
  // The collar's ends go with the neck and the lapels they are sewn to: each collar point moves as the nearest point of a
  // front moved, by less the further it is from it, so its fall isn't stretched where its ends were pulled.
  if (!fronts.length) return;
  const moved: { at: V3; d: V3 }[] = [];
  for (const p of fronts)
    for (let i = 0; i < p.mesh.pts.length; i++) {
      const I = (p.base + i) * 3;
      const d: V3 = [res[I] - before[I], res[I + 1] - before[I + 1], res[I + 2] - before[I + 2]];
      if (Math.hypot(d[0], d[1], d[2]) > 0.05) moved.push({ at: [before[I], before[I + 1], before[I + 2]], d });
    }
  if (!moved.length) return;
  const reach = knob('__collarReach') ?? 4;
  for (const c of panels) {
    if (c.hidden || c.role !== 'collar') continue;
    for (let i = 0; i < c.mesh.pts.length; i++) {
      const I = (c.base + i) * 3;
      let best = moved[0];
      let bd = Infinity;
      for (const m of moved) {
        const dd = Math.hypot(m.at[0] - before[I], m.at[1] - before[I + 1], m.at[2] - before[I + 2]);
        if (dd < bd) {
          bd = dd;
          best = m;
        }
      }
      const w = Math.exp(-bd / reach);
      for (let d = 0; d < 3; d++) res[I + d] += best.d[d] * w;
    }
  }
}
