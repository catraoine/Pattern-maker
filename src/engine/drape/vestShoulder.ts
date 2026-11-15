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

export function droopShoulders(d: Pick<Draped, 'panels' | 'pos' | 'posMirror'>, sp: Space): void {
  const k = knob('__vestDroop') ?? 3;
  const fade = knob('__vestDroopFade') ?? 20;
  if (!k) return;
  const { x: tipX, c: tipC } = sp.tip;
  for (const pos of [d.pos, ...(d.posMirror ? [d.posMirror] : [])])
    for (const p of d.panels) {
      if (p.hidden || (p.role !== 'front' && p.role !== 'back')) continue;
      // (Only the cloth near the shoulder seam: a big size's side or underarm can lie past the tip too, and turned
      // down it would part from the other piece at the side seam.)
      const sh = (p.mesh.runs.shoulder ?? []).flat().map((i) => p.mesh.pts[i]);
      if (!sh.length) continue;
      for (let i = 0; i < p.mesh.pts.length; i++) {
        const q = p.mesh.pts[i];
        if (!sh.some((m) => Math.hypot(m.x - q.x, m.y - q.y) < REACH)) continue;
        const I = (p.base + i) * 3;
        const past = Math.abs(pos[I]) - tipX;
        const below = pos[I + 1] - tipC;
        if (past <= 0 || below > fade) continue;
        const w = below <= 0 ? 1 : 1 - below / fade;
        // (Turned about the tip: down by the slope, and in a little so the cloth keeps its length.)
        const a = Math.atan(k) * w;
        const r = past;
        pos[I + 1] += r * Math.sin(a);
        pos[I] = Math.sign(pos[I]) * (tipX + r * Math.cos(a));
      }
    }
}
