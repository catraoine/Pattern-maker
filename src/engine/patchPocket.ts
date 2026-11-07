// Pockets sewn on top of a garment: the patch pocket's own piece, and where a piece's outline crosses a level, so
// a pocket can be placed clear of its edges. Shared by jackets and coats (outerwear.ts) and skirts and dresses
// (skirtPockets.ts).
import { P, add, mul, p } from './geometry';
import type { Piece } from './piece';
import { pathOf } from './manipulate';

/** Where a piece's outline crosses the level y: its leftmost and rightmost x. */
export function spanAt(pc: Piece, y: number): [number, number] {
  const pts = pc.outline.points(8);
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a.y - y) * (b.y - y) <= 0 && Math.abs(b.y - a.y) > 1e-9) xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 0];
}

/** A patch pocket, its top turned back for a facing. */
export function patchPocket(w: number, h: number, sa: number): Piece {
  const top = 3.5;
  const R = 2.5;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const pts = [p(0, 0), ...arc(p(R, top + h - R), Math.PI), ...arc(p(w - R, top + h - R), Math.PI / 2), p(w, 0)];
  const tags = [...pts.slice(1).map(() => 'pocket'), 'pocket-top'];
  const cut = 'Cut 2';
  return {
    name: 'Patch pocket',
    kind: 'facing',
    outline: pathOf({ pts, tags }),
    lines: [],
    grain: [p(w * 0.25, top + 2), p(w * 0.25, top + h - 3)],
    notches: [
      [p(0, top), p(-1, 0)],
      [p(w, top), p(1, 0)],
    ],
    balance: [{ pts: [p(0, top), p(w, top)], label: 'FOLD' }],
    labels: [
      { at: p(w / 2, top + h * 0.45), text: 'PATCH POCKET', size: 0.8 },
      { at: p(w / 2, top + h * 0.45 + 1.1), text: cut, size: 0.55 },
    ],
    cut,
    seamAllowance: sa,
    allowances: { pocket: 1, 'pocket-top': 1 },
    meta: {},
  };
}
