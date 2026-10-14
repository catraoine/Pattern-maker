// Rough fabric estimates on 140 cm wide fabric.
import { Piece, bounds } from './piece';

/** Length of fabric the pieces take, laid out in rows across the width. A piece on the fold opens
 * to twice its width; a pair is two pieces. */
export function piecesLengthCm(pieces: Piece[]): number {
  const items = pieces.flatMap((pc) => {
    const [x0, y0, x1, y1] = bounds(pc);
    const w = x1 - x0;
    const h = y1 - y0;
    return pc.fold ? [{ w: 2 * w, h }] : [{ w, h }, { w, h }];
  });
  items.sort((a, b) => b.h - a.h);
  let total = 0;
  let rowW = Infinity;
  for (const it of items) {
    if (rowW + it.w > 136) {
      total += it.h; // tallest first, so the first piece in a row sets its height
      rowW = 0;
    }
    rowW += it.w;
  }
  return total;
}

/** Centimetres to metres, rounded up to the next 10 cm. */
export const toMetres = (cm: number) => Math.ceil((cm / 100) * 10) / 10;
