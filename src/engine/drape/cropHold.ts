// A cropped top's seam under the bust, with a peplum sewn to it, is held from sliding down the ribs under the
// peplum's weight: on the body the bust above it holds it, as a bra's band sits. The coarse sim let a big balloon
// peplum drag it down 3 cm and the bust showed through above the seam (Cat's SS27 balloon top, 2026-11-06).
import { knob } from './knob';

/** The hold: each point on the torso pieces' cut edge (tagged waist, as the edge the peplum sews to) kept from
 *  dropping more than a few millimetres below where it starts; ids among all the garment's points, c the height. */
export function cropHold(torso: { base: number; start: [number, number, number][]; mesh: { runs: Record<string, number[][] | undefined> } }[]): { ids: number[]; c: number[] } {
  const ids: number[] = [];
  const c: number[] = [];
  const slack = knob('__cropSlack') ?? 0.3;
  for (const p of torso) for (const i of new Set((p.mesh.runs.waist ?? []).flat())) {
    ids.push(i + p.base);
    c.push(p.start[i][1] + slack);
  }
  return { ids, c };
}
