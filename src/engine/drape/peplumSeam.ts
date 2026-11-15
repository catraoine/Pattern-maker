import type { Panel } from './garment';

/**
 * The points of a top sewn to its own peplum: held where they are sewn while the top's centre back is smoothed. Drawn
 * out with the cloth beside them, a bust-dart-only top's waist stood 1.6 to 1.9 cm off its balloon peplum in wool,
 * cotton and linen, and fell back to the drawing (Nov 14). A dress's bodice sewn to its skirt keeps its smoothing as it
 * was: only a peplum's pieces are named for it.
 */
export function topPeplumSeam(panels: Panel[], seams: { i: number; j: number; k: number }[]): Set<number> {
  const owner = (g: number) => panels.find((p) => g >= p.base && g < p.base + p.mesh.pts.length);
  const top = (p?: Panel) => !!p && (p.role === 'front' || p.role === 'back');
  const peplum = (p?: Panel) => !!p && /peplum/.test(p.role) && /^peplum/i.test(p.pc.name);
  const out = new Set<number>();
  for (const { i, j, k } of seams) {
    const [a, b] = [owner(i), owner(j)];
    if (top(a) && peplum(b)) out.add(i);
    else if (peplum(a) && top(b)) out.add(j).add(k);
  }
  return out;
}
