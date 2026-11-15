import type { Draped } from './garment';
import { knob } from './knob';
import type { Space } from './space';

/**
 * A sleeveless jacket's shoulder cut past the wearer's (the Look 02 vest's runs 9.5 cm past hers): with no sleeve and
 * no arm on the form under it, its shoulder seam was held out along the line it is cut to, and its tips stood out level
 * past the form's shoulders like wings, the far one reading as a light hook from three-quarters (the Nov 13 sweep).
 * Crisp wool there falls over the top of the arm, so past the form's shoulder tip the cloth is turned down as it would
 * be over an arm (about 70 degrees at the seam), fading out 20 cm down the armhole (gentler turns, 25 and 35 degrees,
 * still read as wings, Nov 15). Front and back move alike, so the shoulder seam stays closed.
 */
/** How far from the shoulder seam, cm as cut, the cloth is turned. */
const REACH = 12;
/** Folds a piece may have and still pass the drawing's check (quality.ts, finCount). */
const FOLDS_OK = 12;

export function droopShoulders(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, sp: Space): void {
  const k = knob('__vestDroop') ?? 3;
  const fade = knob('__vestDroopFade') ?? 20;
  const ramp = knob('__vestDroopRamp') ?? 4;
  if (!k) return;
  const reach = knob('__vestReach') ?? REACH;
  const from = knob('__vestReachFrom') ?? reach / 2;
  const { x: tipX, c: tipC } = sp.tip;
  // (Undone if it folds a piece back on itself in more places than the drawing's check lets pass (12, quality.ts) and
  // than it was already: on an oversized waistcoat cut 10 cm past the shoulder the turned-down tip swung onto the
  // armhole below it, which stays put, and folded there, Nov 15.)
  const body = d.panels.filter((p) => !p.hidden && (p.role === 'front' || p.role === 'back'));
  const was = [d.pos.slice(), d.posMirror?.slice()];
  const before = body.map((p) => folds([p], d.pos));
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])])
    for (const p of d.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      // (Only the cloth near the shoulder seam: a big size's side or underarm can lie past the tip too, and turned
      // down it would part from the other piece at the side seam.)
      const sh = (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i]);
      if (!sh.length) continue;
      for (let i = 0; i < p.mesh.pts.length; i++) {
        const q = p.mesh.pts[i];
        // (Eased out over the second half of the reach, not cut off at its edge: cut off, the cloth just past it kept
        // its place while the cloth just inside turned down, and the back creased there into a fin, Nov 15.)
        let dS = Infinity;
        for (const m of sh) dS = Math.min(dS, Math.hypot(m.x - q.x, m.y - q.y));
        if (dS >= reach) continue;
        const e = Math.min(1, Math.max(0, (dS - from) / (reach - from)));
        const near = 1 - e * e * (3 - 2 * e);
        const I = (p.base + i) * 3;
        const past = Math.abs(pos[I]) - tipX;
        const below = pos[I + 1] - tipC;
        if (past <= 0 || below > fade) continue;
        const w = below <= 0 ? 1 : 1 - below / fade;
        // (Turned about the tip: down by the slope, and in a little so the cloth keeps its length.)
        // (Turned on a curve over the first few cm past the tip, not hinged at it: hinged, the cloth creased at the tip
        // into a fin down an oversized waistcoat's back, Nov 15.)
        const u = Math.min(1, past / ramp);
        const a = Math.atan(k) * w * near * u * u * (3 - 2 * u);
        const r = past;
        pos[I + 1] += r * Math.sin(a);
        pos[I] = Math.sign(pos[I]) * (tipX + r * Math.cos(a));
      }
    }
  if (body.some((p, n) => { const f = folds([p], d.pos); return f > FOLDS_OK && f > before[n]; }) && !knob('__vestDroopKeep')) {
    d.pos.set(was[0]!);
    if (d.posMirror && was[1]) d.posMirror.set(was[1]);
  }
}

/** How many edges between two triangles of these panels are folded back sharply (their faces more than 120 degrees
 *  apart), as the drawing's check counts fins. */
function folds(panels: Pick<Draped, 'panels'>['panels'], pos: Float64Array): number {
  const cosMax = Math.cos((120 * Math.PI) / 180);
  let n = 0;
  for (const p of panels) {
    const normal = (t: number[]) => {
      const [a, b, c] = t.map((i) => [0, 1, 2].map((k) => pos[(p.base + i) * 3 + k]));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const m = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(m[0], m[1], m[2]) || 1;
      return m.map((q) => q / l);
    };
    const faces = new Map<string, number[][]>();
    for (const t of p.mesh.tris)
      for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        const f = faces.get(key);
        if (f) f.push(t);
        else faces.set(key, [t]);
      }
    for (const fs of faces.values()) {
      if (fs.length !== 2) continue;
      const a = normal(fs[0]);
      const b = normal(fs[1]);
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < cosMax) n++;
    }
  }
  return n;
}
