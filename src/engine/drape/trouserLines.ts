// The trousers' details drawn on their sewn cloth in All round (Cat, 2026-11-07: trousers turning in All round): the
// front pleats' pressed edges, the belt loops and a slant pocket's opening. The cloth is sewn from the plain block, so
// none of them is in its cut; each is drawn as a line through the settled cloth where the pattern puts it.
import type { P } from '../geometry';
import type { TrousersDraft } from '../trousers';
import { loopPlaces } from '../trouserPleats';
import type { Draped, Panel } from './garment';

/** The points of the panel's mesh lying on a line drawn on its pattern, in order along it: of the points within
 *  `near` cm of it, the nearest in each `step` cm along it (every mesh point near it zigzagged across the line). */
function along(p: Panel, pts: P[], near = 1.6, step = 2.5): number[] {
  const best = new Map<number, { i: number; d: number }>();
  let s0 = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
    p.mesh.pts.forEach((m, i) => {
      const t = ((m.x - a.x) * (b.x - a.x) + (m.y - a.y) * (b.y - a.y)) / (L * L);
      if (t < -0.02 || t > 1.02) return;
      const d = Math.abs((m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x)) / L;
      if (d > near) return;
      const bin = Math.round((s0 + t * L) / step);
      const was = best.get(bin);
      if (!was || d < was.d) best.set(bin, { i, d });
    });
    s0 += L;
  }
  return [...best.keys()].sort((x, y) => x - y).map((k) => best.get(k)!.i + p.base).filter((v, n, a) => a[n - 1] !== v);
}

/** The waist edge's ends on a piece: its side (least x) and its centre (most x), at their own heights. */
function waistEnds(p: Panel): { side: P; centre: P } {
  const { pts, tags } = p.pc.outline.taggedPoints(12);
  const w = pts.filter((_, i) => ['waist', 'pleat', 'dart'].includes(tags[i]) || ['waist', 'pleat', 'dart'].includes(tags[i - 1]));
  const side = w.reduce((u, v) => (v.x < u.x ? v : u));
  const centre = w.reduce((u, v) => (v.x > u.x ? v : u));
  return { side, centre };
}

export function trouserDetails(out: Draped, d: TrousersDraft): void {
  const front = out.panels.find((p) => !p.hidden && p.role === 'peplum-front');
  const back = out.panels.find((p) => !p.hidden && p.role === 'peplum-back');
  if (!front || !back) return;
  const fork = (front.pc.meta.fork as P | undefined)?.y ?? 26;
  // Each front pleat's pressed edge: from its fold at the waist straight down the front to where it falls open, about
  // two thirds of the way to the crotch.
  for (const l of d.pleats?.lines ?? []) {
    const ids = along(front, [{ x: l.fold, y: 0.5 }, { x: l.fold, y: fork * 0.65 }]);
    if (ids.length > 2) out.lines.push({ kind: 'pleat', ids });
  }
  // Belt loops: a short upright down from the waist where each sits (halfway across the front, at the side seams and at
  // the centre back).
  if (d.loops) {
    const LOOP = 4;
    for (const [p, places] of [[front, loopPlaces(d.loops).front], [back, loopPlaces(d.loops).back]] as const) {
      const { side, centre } = waistEnds(p);
      for (const f of places) {
        // (A share of the quarter waist from the centre: 1 is the side seam, drawn a little in from it so it shows.)
        const x = centre.x - (centre.x - side.x) * Math.min(f, 0.97);
        const y = centre.y + (side.y - centre.y) * Math.min(f, 0.97) + 0.4;
        // (Its two long edges, a loop's width apart, so it reads as a strip.)
        for (const dx of [-0.6, 0.6]) {
          const ids = along(p, [{ x: x + dx, y }, { x: x + dx, y: y + LOOP }], 0.9, 1);
          if (ids.length > 1) out.lines.push({ kind: 'loop', ids });
        }
      }
    }
  }
  // A slant pocket's opening, as the cut front draws it, laid on the plain front it is sewn over.
  const cut = d.pieces.find((pc) => pc.name === front.pc.name && pc !== front.pc);
  if (cut) {
    const { pts, tags } = cut.outline.taggedPoints(12);
    const edge = pts.filter((_, i) => tags[i] === 'pocket-edge' || tags[i - 1] === 'pocket-edge');
    if (edge.length > 1) {
      const ids = along(front, edge);
      if (ids.length > 2) out.lines.push({ kind: 'pocket', ids });
    }
  }
}
