// A jacket's or vest's welt pockets drawn on its sewn cloth in All round. The pocket is not in the front's cut (its
// welt and bags are separate pieces sewn behind a slit), so the drawing showed a plain front where the flat and the
// pattern have two welts (the Black Vest, Cat Nov 12: "Does our vest have the pockets"). Each welt is drawn as the
// pattern marks it: its top and bottom edges and its two ends, through the settled cloth.
import type { P } from '../geometry';
import type { OuterDraft } from '../outerwear';
import type { Draped, Panel } from './garment';

/** The panel's mesh points nearest a line drawn on its pattern, one every `step` cm along it, in order. */
function along(p: Panel, a: P, b: P, near: number, step: number): number[] {
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  const best = new Map<number, { i: number; d: number }>();
  p.mesh.pts.forEach((m, i) => {
    if (p.turned[i]) return;
    const t = ((m.x - a.x) * (b.x - a.x) + (m.y - a.y) * (b.y - a.y)) / (L * L);
    if (t < -0.02 || t > 1.02) return;
    const d = Math.abs((m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x)) / L;
    if (d > near) return;
    const bin = Math.round((t * L) / step);
    const was = best.get(bin);
    if (!was || d < was.d) best.set(bin, { i, d });
  });
  return [...best.keys()].sort((x, y) => x - y).map((k) => best.get(k)!.i + p.base);
}

export function weltPockets(out: Draped, d: Pick<OuterDraft, 'pocket'>): void {
  const w = d.pocket;
  if (!w || w.kind !== 'welt') return;
  // (The front the pocket is placed on: a princess coat's side front carries its own, which is left as it was.)
  const front = out.panels.find((p) => !p.hidden && p.role === 'front' && /front/i.test(p.pc.name) && !/side/i.test(p.pc.name));
  if (!front) return;
  const { x, y, h } = w;
  const r = x + w.w;
  for (const [a, b] of [[{ x, y }, { x: r, y }], [{ x, y: y + h }, { x: r, y: y + h }]] as [P, P][]) {
    const ids = along(front, a, b, 1.2, 1.5);
    if (ids.length > 2) out.lines.push({ kind: 'pocket', ids });
  }
  for (const ex of [x, r]) {
    const ids = along(front, { x: ex, y }, { x: ex, y: y + h }, 1.2, 0.8);
    if (ids.length > 1) out.lines.push({ kind: 'pocket', ids });
  }
}
