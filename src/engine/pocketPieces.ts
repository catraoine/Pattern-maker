// The pieces of pockets made on a garment's face: a patch pocket sewn on top, and a welt pocket's welt, facing and
// bags; and where a piece's outline crosses a level, so a pocket can be placed clear of its edges. Shared by jackets
// and coats (outerwear.ts), skirts and dresses (skirtPockets.ts) and trousers' back pockets (trouserBack.ts).
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

/** A single welt pocket: the welt, folded in half, the pocket facing and the two pocket bags. */
export function weltPieces(w: number, depth: number, bag: number, sa: number): Piece[] {
  const rect = (W: number, H: number, name: string, tag: string, over: Partial<Piece>): Piece => {
    const outline = pathOf({ pts: [p(0, 0), p(W, 0), p(W, H), p(0, H)], tags: [tag, `${tag}-end`, tag, `${tag}-end`] });
    const cut = over.cut ?? 'Cut 2';
    return {
      name,
      kind: 'facing',
      outline,
      lines: [],
      grain: [p(W * 0.2, H * 0.2), p(W * 0.2, Math.max(H * 0.8, H * 0.2 + 2))],
      notches: [],
      labels: [
        { at: p(W / 2, H / 2 - 0.2), text: name.toUpperCase(), size: H < 6 ? 0.55 : 0.8 },
        { at: p(W / 2, H / 2 + (H < 6 ? 0.8 : 1.2)), text: cut, size: H < 6 ? 0.45 : 0.55 },
      ],
      cut,
      seamAllowance: sa,
      allowances: { [tag]: 1, [`${tag}-end`]: 1 },
      meta: {},
      ...over,
    };
  };
  const welt = rect(w, 2 * depth, 'Welt', 'welt', { fabric: 'Self + interfacing', balance: [{ pts: [p(0, depth), p(w, depth)], label: 'FOLD' }] });
  const facing = rect(w + 3, 7, 'Pocket facing', 'pocket', { grain: [p(2, 1.5), p(2, 5.5)] });
  // The bag: rounded at the bottom so lint does not collect in its corners.
  const W = w + 3;
  const R = 3;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const bagPts = [p(0, 0), ...arc(p(R, bag - R), Math.PI), ...arc(p(W - R, bag - R), Math.PI / 2), p(W, 0)];
  const bagCut = 'Cut 4 (2 pairs)';
  const bagPiece: Piece = {
    name: 'Pocket bag',
    kind: 'lining',
    fabric: 'Lining or pocketing',
    outline: pathOf({ pts: bagPts, tags: [...bagPts.slice(1).map(() => 'bag'), 'bag-top'] }),
    lines: [],
    grain: [p(W * 0.2, 3), p(W * 0.2, bag - 4)],
    notches: [],
    labels: [
      { at: p(W / 2, bag * 0.45), text: 'POCKET BAG', size: 0.8 },
      { at: p(W / 2, bag * 0.45 + 1.2), text: bagCut, size: 0.55 },
    ],
    cut: bagCut,
    seamAllowance: sa,
    allowances: { bag: 1, 'bag-top': 1 },
    meta: {},
  };
  return [welt, facing, bagPiece];
}
