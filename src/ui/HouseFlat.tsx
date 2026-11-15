import type { CSSProperties } from 'react';
import type { Flat, FlatView } from '../engine/flat';
import { TechFlatView } from './TechFlatView';

// The collection's drawings at one scale (Cat, Nov 14: "scale of all garments should match the current largest one").
// Each look was fitted to its own box, so a top with its sleeves out drew at half the size of the shift beside it, and
// the skirt sat small under a gap. Here a centimetre is the same size in every look: the widest single view across the
// collection (the Ice Peplum Top, sleeves out) fills the column, the front over the back, and each drawing is as tall
// as the garment is long.

/** The label under each view, in cm: one size for every look. */
const LABEL_CM = 3.4;
/** The space round each view, in cm, as TechFlatView draws it. */
const PAD = 4;
/** The most a centimetre is drawn, in pixels, on a wide screen. */
const MOST_PX = 3.2;

/** A view's left and right edges. */
function edges(v: FlatView): [number, number] {
  const xs = [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)].map((q) => q.x);
  return [Math.min(...xs), Math.max(...xs)];
}

/** How wide a flat's widest single view is, in cm. */
export const widestView = (flat: Flat | undefined) => (flat ? Math.max(...flat.views.map((v) => edges(v)[1] - edges(v)[0])) : 0);

/** One view of a flat on its own, moved to start at x = 0. */
function alone(flat: Flat, k: number): Flat {
  const v = flat.views[k];
  const [left, right] = edges(v);
  const m = (q: { x: number; y: number }) => ({ x: q.x - left, y: q.y });
  return {
    views: [{ ...v, shapes: v.shapes.map((s) => s.map(m)), lines: v.lines.map((l) => ({ ...l, pts: l.pts.map(m) })), at: m(v.at), origin: m(v.origin), ...(v.armless ? { armless: v.armless.map(m) } : {}) }],
    width: right - left,
    height: flat.height,
  };
}

/** A look's flat, front over back, a centimetre drawn as wide as in every other look: `widest` is the widest view of all. */
export function HouseFlat({ flat, title, widest }: { flat: Flat; title: string; widest: number }) {
  return (
    <div className="house-views" role="img" aria-label={`Technical flat of the ${title}, front and back`}>
      {flat.views.map((v, k) => {
        const one = alone(flat, k);
        const w = one.width + 2 * PAD;
        const style: CSSProperties = { width: `min(${((w / (widest + 2 * PAD)) * 100).toFixed(2)}%, ${(w * MOST_PX).toFixed(0)}px)` };
        return <TechFlatView key={v.label} flat={one} title={title} labelCm={LABEL_CM} style={style} part />;
      })}
    </div>
  );
}
