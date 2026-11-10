// The lowest level at which a coat or jacket piece is still as wide as its hem: where its width is read for cloth that
// settles below it. A front's hem isn't cut level (it drops toward the side front, more so since the deeper bust dart
// of Nov 10), so just above its lowest point only a corner of the piece is left: read there, the hem's rows were given
// almost no width, left 3 cm inside the rows above them, and a double-breasted coat's hem drew stretched (Nov 10).
type P = { x: number; y: number };

/** `spanAt(y)` is the piece's width across at level y; `pts` its outline. */
export function fullHemLevel(pts: P[], spanAt: (y: number) => number): number {
  const low = Math.max(...pts.map((q) => q.y));
  // (The widest the piece gets over its last hand's span is its hem's width, on a straight cut or a flared one.)
  let widest = 0;
  for (let y = low - 12; y < low; y += 0.25) widest = Math.max(widest, spanAt(y));
  for (let y = low - 0.5; y > low - 12; y -= 0.25) if (spanAt(y) >= widest * 0.97) return y;
  return low - 0.5;
}
