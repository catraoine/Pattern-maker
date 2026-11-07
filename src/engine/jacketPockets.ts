// Jacket and coat pockets beyond the patch and welt (In testing, Cat's styling options round 1, Nov 7 2026):
// J1 flap pockets, jetted openings with a flap tucked into the top jet, as on a tailored jacket; J2 a chest welt
// pocket on the left front, rising a little toward the side as a breast pocket does. Plain ASCII punctuation.
import { P, Path, add, len, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import { pathOf } from './manipulate';
import { spanAt, weltPieces } from './pocketPieces';

export type ChestPocket = 'none' | 'welt';

/** A flap pocket: the opening 1.2 cm tall (two 0.6 cm jets), the flap 5.5 cm deep on a jacket, 6.5 on a coat,
 *  its foot corners rounded 1.5 cm. */
export const FLAP = { jet: 0.6, depth: { jacket: 5.5, coat: 6.5 }, round: 1.5 };

/** The chest pocket, finished: a welt 10 cm wide (11 on a coat) and 2.5 cm deep, rising 1.5 cm from its front end to
 *  its side end, its front end 2 cm below the underarm, the bag 15 cm deep. At least 9 cm wide, or none. */
export const CHEST = { w: { jacket: 10, coat: 11 }, depth: 2.5, rise: 1.5, belowArm: 2, bag: 15, min: 9 };

/** The flap: self on top, lined beneath, rounded at its foot. */
export function flapPieces(w: number, kind: 'jacket' | 'coat', bag: number, sa: number): Piece[] {
  const [jet, facing, bags] = weltPieces(w, FLAP.jet, bag, sa);
  const D = FLAP.depth[kind];
  const R = FLAP.round;
  const arc = (c: P, from: number) => Array.from({ length: 7 }, (_, i) => add(c, mul(p(Math.cos(from - (i / 6) * (Math.PI / 2)), Math.sin(from - (i / 6) * (Math.PI / 2))), R)));
  const pts = [p(0, 0), ...arc(p(R, D - R), Math.PI), ...arc(p(w - R, D - R), Math.PI / 2), p(w, 0)];
  const flap = (name: string, over: Partial<Piece>): Piece => {
    const cut = 'Cut 2 (1 pair)';
    return {
      name,
      kind: 'facing',
      outline: pathOf({ pts, tags: [...pts.slice(1).map(() => 'flap'), 'flap-top'] }),
      lines: [],
      grain: [p(w * 0.2, 1), p(w * 0.2, D - 1)],
      notches: [],
      labels: [
        { at: p(w / 2, D * 0.42), text: name.toUpperCase(), size: 0.7 },
        { at: p(w / 2, D * 0.42 + 1), text: cut, size: 0.5 },
      ],
      cut,
      seamAllowance: sa,
      allowances: { flap: 0.6, 'flap-top': 1 },
      meta: {},
      ...over,
    };
  };
  const jets: Piece = {
    ...jet,
    name: 'Jets',
    cut: 'Cut 4',
    fabric: 'Self + interfacing',
    labels: [
      { ...jet.labels[0], text: 'JETS' },
      { ...jet.labels[1], text: 'Cut 4' },
    ],
  };
  return [flap('Pocket flap', { fabric: 'Self + interfacing' }), flap('Flap lining', { kind: 'lining', fabric: 'Lining' }), jets, facing, bags];
}

/** A polyline with a point at least every half centimetre, for checking how close two lines come. */
function dense(pts: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) {
      out.push(pts[0]);
      continue;
    }
    const n = Math.max(1, Math.ceil(len(sub(pts[i], pts[i - 1])) / 0.5));
    for (let k = 1; k <= n; k++) out.push(add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), k / n)));
  }
  return out;
}

/** Where the chest pocket sits: its welt's top edge from the front end `a` to the side end `b`, in the front's places. */
export interface ChestPlace {
  a: P;
  b: P;
  depth: number;
}

/** How far out the lapel reaches over the front at a level, as worn, or the front edge where there is none. */
function lapelReach(worn: P[] | undefined, y: number): number {
  if (!worn?.length) return -Infinity;
  const xs: number[] = [];
  for (let i = 0; i < worn.length; i++) {
    const u = worn[i];
    const v = worn[(i + 1) % worn.length];
    if ((u.y - y) * (v.y - y) <= 0 && Math.abs(v.y - u.y) > 1e-9) xs.push(u.x + ((v.x - u.x) * (y - u.y)) / (v.y - u.y));
  }
  return xs.length ? Math.max(...xs) : -Infinity;
}

/**
 * A chest welt pocket on the front that reaches past the lapel at the chest (the centre front panel on a princess
 * jacket): clear of the lapel and the front edge by 1.5 cm and of the seam or armhole by 2 cm. Marked on the front
 * pattern for the left front only. Undefined when there is no room for 9 cm: on a darted front the bust darts run
 * where it would go, so it comes on princess-seamed and oversized fronts.
 */
export function chestWelt(fronts: Piece[], o: { kind: 'jacket' | 'coat'; ext: number; lapel?: P[]; sa: number }): { fronts: Piece[]; pieces: Piece[]; place: ChestPlace } | undefined {
  // The underarm: the armhole's lowest point on the fronts.
  const under = Math.max(
    ...fronts.flatMap((pc) => {
      const { pts, tags } = pc.outline.taggedPoints(8);
      return pts.filter((_, i) => tags[i] === 'armhole').map((q) => q.y);
    }),
  );
  if (!Number.isFinite(under)) return undefined;
  const d = CHEST.depth;
  /** The pocket's box at a level and across from `x`, along with its top edge's ends. */
  const boxAt = (x: number, top: number, w: number) => {
    const a = p(x, top);
    const b = p(x + w, top - CHEST.rise);
    const along = unit(sub(b, a));
    const down = p(-along.y, along.x).y > 0 ? p(-along.y, along.x) : p(along.y, -along.x);
    return { a, b, along, down, box: new Path(a).line(b).line(add(b, mul(down, d))).line(add(a, mul(down, d))).line(a) };
  };
  /** Clear of the darts and anything else marked on the panel by 1 cm. */
  const clear = (pc: Piece, box: Path) => {
    const marks = pc.lines.flatMap((l) => dense(l.points(4)));
    return dense(box.points(4)).every((q) => marks.every((m) => len(sub(q, m)) >= 1));
  };
  // From 2 cm below the underarm, up to 6 cm above it and then down to 5 cm below, the first level where the pocket
  // fits between the lapel and the seam or armhole, clear of the darts: a side bust dart high on a short armhole
  // would otherwise run into it.
  const levels = [...Array.from({ length: 17 }, (_, k) => under + CHEST.belowArm - k * 0.5), ...Array.from({ length: 6 }, (_, k) => under + CHEST.belowArm + (k + 1) * 0.5)];
  for (const top of levels) {
    const mid = top + d / 2 - CHEST.rise / 2;
    for (let i = 0; i < fronts.length; i++) {
      const pc = fronts[i];
      const [lo, hi] = spanAt(pc, mid);
      const [loT, hiT] = spanAt(pc, top - CHEST.rise);
      const from = Math.max(lo + 1.5, loT + 1.5, o.ext + 1.5, lapelReach(o.lapel, top - CHEST.rise) + 1.5, lapelReach(o.lapel, top + d) + 1.5);
      const to = Math.min(hi, hiT) - 2;
      const w = Math.round(Math.min(CHEST.w[o.kind], to - from) * 10) / 10;
      if (w < CHEST.min) continue;
      // Centred in the room, then slid either way.
      const centre = from + (to - from - w) / 2;
      const xs = [centre, ...Array.from({ length: 20 }, (_, k) => centre + (k % 2 ? 1 : -1) * Math.ceil((k + 1) / 2) * 0.5)].filter((x) => x >= from - 1e-9 && x + w <= to + 1e-9);
      for (const x of xs) {
        const at = boxAt(x, top, w);
        if (clear(pc, at.box)) return placed(i, at, w);
      }
    }
  }
  return undefined;

  function placed(best: number, { a, b, along, down, box }: ReturnType<typeof boxAt>, w: number) {
    const carrier = fronts[best];
    const pieces = weltPieces(Math.round(len(sub(b, a)) * 10) / 10, d, CHEST.bag, o.sa).map((pc): Piece => {
      const cut = pc.name === 'Pocket bag' ? 'Cut 2' : 'Cut 1';
      const name = pc.name === 'Welt' ? 'Chest welt' : `Chest ${pc.name.toLowerCase()}`;
      return { ...pc, name, cut, labels: [{ ...pc.labels[0], text: name.toUpperCase() }, { ...pc.labels[1], text: cut }] };
    });
    const out = [...fronts];
    out[best] = {
      ...carrier,
      lines: [...carrier.lines, box],
      labels: [...carrier.labels, { at: add(add(a, mul(along, w / 2)), mul(down, -1)), text: 'CHEST POCKET, LEFT FRONT ONLY', size: 0.45, rotate: (Math.atan2(along.y, along.x) * 180) / Math.PI }],
    };
    return { fronts: out, pieces, place: { a, b, depth: d } };
  }
}
