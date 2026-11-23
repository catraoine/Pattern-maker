import { useId } from 'react';
import { EXAMPLE_BODY, type Garment } from '../measurements';
import { choicesFlat, dressChoices } from '../collection';
import { DEFAULT_BODICE, DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DEFAULT_LINGERIE_CHOICES, DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES, type PatternChoices } from '../garments';
import { DEFAULT_HOODIE_CHOICES, DEFAULT_JUMPSUIT_CHOICES, DEFAULT_KNIT_DRESS_CHOICES } from '../garmentRange';
import { INITIAL } from '../savedWork';
import type { Flat } from '../engine/flat';

// The drawing on each tile of "What would you like to make?" is the garment's own technical flat, drafted by the
// pattern engine on the example body (Cat's B House Flats, Nov 22). The hand-drawn icons before it looked like AI art
// (Cat, Nov 21); these are the real seams, darts and stitching of the pattern the tile starts, the same kind of drawing
// as the collection's. Each tile keeps its name as its words, so a screen reader and every test still find it by name.

/** What each tile starts as: the garment's plain first choices, as a new garment opens on Style. */
const START: Record<Garment, PatternChoices> = {
  skirt: { garment: 'skirt', ...INITIAL.choices } as PatternChoices,
  dress: dressChoices('regular', {}, {}),
  bodice: DEFAULT_BODICE,
  trousers: DEFAULT_TROUSERS_CHOICES,
  tee: DEFAULT_TEE_CHOICES,
  knit_dress: DEFAULT_KNIT_DRESS_CHOICES,
  hoodie: DEFAULT_HOODIE_CHOICES,
  jumpsuit: DEFAULT_JUMPSUIT_CHOICES,
  jacket: DEFAULT_JACKET_CHOICES,
  coat: DEFAULT_COAT_CHOICES,
  lingerie: DEFAULT_LINGERIE_CHOICES,
};

interface Pic {
  box: string;
  edges: string[];
  lines: { d: string; kind: string }[];
}

const path = (pts: { x: number; y: number }[], close = false) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('') + (close ? 'Z' : '');

/** The front view of a flat, with a box fitted round it. */
function picOf(flat: Flat): Pic {
  const v = flat.views[0];
  const pts = v.shapes.flat();
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
  // The body first and the sleeves over it, as the flats are drawn everywhere else.
  const sleeves = new Set(v.sleeves ?? []);
  const order = v.shapes.map((_, i) => i).sort((a, b) => Number(sleeves.has(a)) - Number(sleeves.has(b)));
  return {
    box: [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map((n) => n.toFixed(1)).join(' '),
    edges: order.map((i) => path(v.shapes[i], true)),
    lines: v.lines.map((l) => ({ d: path(l.pts), kind: l.kind })),
  };
}

// Drafted once, the first time the list is shown, and kept: the example body never changes.
const made = new Map<Garment, Pic | null>();
function pic(g: Garment): Pic | null {
  if (!made.has(g)) {
    const flat = choicesFlat(START[g], EXAMPLE_BODY);
    made.set(g, flat ? picOf(flat) : null);
  }
  return made.get(g)!;
}

export function MakePic({ garment }: { garment: Garment | 'other' }) {
  // Something else: the plain dress's outline, still to be drawn, with a plus.
  const p = pic(garment === 'other' ? 'dress' : garment);
  const clip = `makepic${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // A garment the engine draws no flat for (lingerie, behind its flag) keeps an empty space the same size, so its
  // name sits level with the others.
  if (!p) return <svg className="make-pic" viewBox="0 0 40 48" aria-hidden="true" focusable="false" />;
  const [x, y, w, h] = p.box.split(' ').map(Number);
  return (
    <svg className={garment === 'other' ? 'make-pic other' : 'make-pic'} viewBox={p.box} aria-hidden="true" focusable="false">
      {/* The seams and darts kept inside the outline: a side dart starts on the side seam, and at this size its end
          showed past the edge. */}
      <defs>
        <clipPath id={clip}>
          {p.edges.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      {p.edges.map((d, i) => (
        <path key={i} className="pic-edge" d={d} />
      ))}
      {garment === 'other' ? (
        <path className="pic-plus" d={`M${x + w / 2},${y + h * 0.42}v${h * 0.2}M${x + w / 2 - h * 0.1},${y + h * 0.52}h${h * 0.2}`} />
      ) : (
        <g clipPath={`url(#${clip})`}>
          {p.lines.map((l, i) => (
            <path key={i} className={`pic-${l.kind}`} d={l.d} />
          ))}
        </g>
      )}
    </svg>
  );
}
