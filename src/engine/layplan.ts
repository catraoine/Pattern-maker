// Cutting layouts: the pieces laid on the fabric the way a cutter would, with the grain along the
// selvedge, pieces on the fold against the fold, and pairs cut through both layers. Each piece is
// nested by its real cutting line (not its bounding box), dropped as low as it will go.
import { P, p } from './geometry';
import { Piece, cutLine } from './piece';
import { LEATHER_LAY, hideSqFt } from './specialFabrics';

export { hideSqFt };

export const FABRIC_WIDTHS = [115, 140, 150] as const;
export type FabricWidth = (typeof FABRIC_WIDTHS)[number];

/** Which fabric a lay is cut from. */
/** Which fabric a lay is cut from: the garment's own, its lining, or a coutil interlining (a boned bodice). */
export type LayFabric = 'self' | 'lining' | 'interlining';

export interface Placement {
  name: string;
  /** The cutting line where it lies on the fabric, in cm: x across from the fold (or left selvedge), y along. */
  pts: P[];
  /** Turned over (the pattern laid face down). */
  flipped: boolean;
  /** Turned end to end, only without a nap. */
  turned: boolean;
  /** Cut through one layer only (a single piece on folded fabric). */
  single: boolean;
  /** Where the name goes. */
  at: P;
}

export interface Lay {
  fabric: LayFabric;
  width: FabricWidth;
  /** Folded in half lengthwise, selvedges together; otherwise opened out to a single layer. */
  folded: boolean;
  /** Cut from a leather hide: always one open layer, bought in square feet. */
  hide?: boolean;
  /** The width the pieces are laid across: half the usable width when folded. */
  across: number;
  /** Length of fabric the pieces take, in cm. */
  length: number;
  /** Fabric to buy, in metres: the length plus 10 cm to straighten the ends, rounded up to 10 cm. */
  metres: number;
  /** How much of the fabric the pieces use, 0 to 1. */
  efficiency: number;
  placements: Placement[];
  /** Some pieces are cut on the bias, lying at 45 degrees across the cloth. */
  bias?: boolean;
  /** Some pieces differ side to side, so they are cut right side up only. */
  rightSideUp?: boolean;
  /** Those pieces are cut from the fabric face down, for their mirror image (a right-shoulder top). */
  faceDown?: boolean;
  /** A knit: the grain runs along the ribs, so the stretch goes across the fabric and round the body. */
  knit?: boolean;
  /** A border print: the hemmed pieces are turned crosswise with their hems on the far selvedge, where
   * the border runs, or 'too-long' when a piece is longer than the fabric is wide and is laid as usual. */
  border?: 'crosswise' | 'too-long';
}

const RES = 0.5; // cm per grid column
const SELVEDGE = 1; // cm not used at each selvedge

type Kind = 'fold' | 'pair' | 'single';

function kindOf(pc: Piece): Kind {
  if (/fold/i.test(pc.cut)) return 'fold';
  if (/2|pair/i.test(pc.cut)) return 'pair';
  return 'single';
}

/** How many times a pair is laid: twice for "Cut 4 (2 pairs)", like pocket bags. */
function sets(pc: Piece): number {
  const n = Number(pc.cut.match(/cut\s+(\d+)/i)?.[1] ?? 2);
  return Math.max(1, Math.floor(n / 2));
}

/** Which lays a piece is cut in. */
function fabricsOf(pc: Piece): LayFabric[] {
  const f = (pc.fabric ?? '').toLowerCase();
  if (f === 'lining') return ['lining'];
  if (f.includes('coutil')) return f.includes('lining') ? ['self', 'lining', 'interlining'] : ['self', 'interlining'];
  if (f.includes('lining')) return ['self', 'lining'];
  return ['self'];
}

function area(pts: P[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    a += pts[i].x * q.y - q.x * pts[i].y;
  }
  return Math.abs(a / 2);
}

/** Top and bottom of a polygon in each grid column across it, after moving it to start at 0, 0. */
function profile(pts: P[]) {
  const x0 = Math.min(...pts.map((q) => q.x));
  const y0 = Math.min(...pts.map((q) => q.y));
  const s = pts.map((q) => p(q.x - x0, q.y - y0));
  const w = Math.max(...s.map((q) => q.x));
  const cols = Math.max(1, Math.ceil(w / RES));
  const top: number[] = [];
  const bottom: number[] = [];
  for (let c = 0; c < cols; c++) {
    // Sample both edges of the column and its middle, so thin slivers aren't missed.
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [c * RES + 0.001, (c + 0.5) * RES, (c + 1) * RES - 0.001]) {
      for (let i = 0; i < s.length; i++) {
        const a = s[i];
        const b = s[(i + 1) % s.length];
        if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
        const y = a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      // Vertices inside the column count too (a sharp corner between samples).
      for (const q of s) if (q.x >= c * RES && q.x <= (c + 1) * RES) {
        lo = Math.min(lo, q.y);
        hi = Math.max(hi, q.y);
      }
    }
    top.push(lo === Infinity ? 0 : lo);
    bottom.push(hi === -Infinity ? 0 : hi);
  }
  return { pts: s, cols, top, bottom };
}

/**
 * A bias piece turned so its grain line runs along the fabric's length: its grain is drawn at 45
 * degrees to its centre line, so it lies on the cloth at 45 degrees. Other pieces lie as drawn.
 */
function onGrain(pc: Piece, pts: P[]): P[] {
  if (!pc.meta.bias || !pc.grain) return pts;
  const [a, b] = pc.grain;
  const g = { x: b.x - a.x, y: b.y - a.y };
  // The turn that takes the grain onto the y axis, down the length of the fabric.
  const t = Math.atan2(g.x, g.y);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return pts.map((q) => p(q.x * c - q.y * s, q.x * s + q.y * c));
}

const flipX = (pts: P[]) => pts.map((q) => p(-q.x, q.y));
const turn = (pts: P[]) => pts.map((q) => p(-q.x, -q.y));

interface Item {
  name: string;
  pts: P[];
  kind: Kind;
  /** Piece placed against the fold (x = 0). */
  atFold: boolean;
  single: boolean;
  /** Laid right side up only: a piece that differs side to side would come out mirrored face down. */
  rightSideUp?: boolean;
  /** Turned crosswise with its hem on the far selvedge, for a border print: it only slides along. */
  onBorder?: boolean;
}

/** Where a piece's hem lies from its middle, or undefined when it has no hem edge. */
function hemDirection(pc: Piece): P | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const hem = pts.filter((_, i) => tags[i] === 'hem' || tags[i - 1] === 'hem');
  if (!hem.length) return undefined;
  const mid = (qs: P[]) => p(qs.reduce((s, q) => s + q.x, 0) / qs.length, qs.reduce((s, q) => s + q.y, 0) / qs.length);
  const h = mid(hem);
  const c = mid(pts);
  // Down the grain line, towards the hem; straight down the piece without one.
  const g = pc.grain ? p(pc.grain[1].x - pc.grain[0].x, pc.grain[1].y - pc.grain[0].y) : p(0, 1);
  const dot = g.x * (h.x - c.x) + g.y * (h.y - c.y);
  return dot < 0 ? p(-g.x, -g.y) : g;
}

/** The piece turned so `down` points across the fabric, to the far selvedge. */
function crosswise(pts: P[], down: P): P[] {
  const t = -Math.atan2(down.y, down.x);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return pts.map((q) => p(q.x * c - q.y * s, q.x * s + q.y * c));
}

/**
 * Lay the pieces cut from one fabric on fabric `width` cm wide. `nap` keeps every piece the same way
 * up (velvet, corduroy, one-way prints); without it pieces can turn end to end to nest closer.
 * `border` turns the hemmed pieces crosswise so every hem sits on a border along the far selvedge.
 */
export function layPlan(pieces: Piece[], width: FabricWidth, fabric: LayFabric = 'self', nap = false, hide = false, border = false): Lay | undefined {
  const mine = pieces.filter((pc) => fabricsOf(pc).includes(fabric));
  if (!mine.length) return undefined;
  const usable = width - 2 * SELVEDGE;
  if (border && !hide) {
    const lay = borderLay(mine, width, fabric, nap);
    if (lay) return lay;
    const plain = layPlan(pieces, width, fabric, nap, hide);
    return plain && { ...plain, border: 'too-long' };
  }
  const cut = mine.map((pc) => ({ pc, pts: onGrain(pc, cutLine(pc)), kind: kindOf(pc) }));
  const wide = (pts: P[]) => Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
  // Folded unless something won't fit across half the width, or a piece must be cut from a single
  // layer (bias pieces, which shift on a folded layer, and pieces that differ side to side), or it is
  // a hide; then a single layer, with pieces on the fold opened out to their full width and each of a
  // pair cut separately. A piece off the fold also keeps its gap from it.
  const folded = !hide && cut.every(({ pc, pts, kind }) => wide(pts) <= usable / 2 - (kind === 'fold' ? 0 : 2 * RES) && !pc.meta.singleLayer);
  const items: Item[] = cut.flatMap(({ pc, pts, kind }): Item[] => {
    const times = kind === 'pair' ? sets(pc) : 1;
    return Array.from({ length: times }, () => one(pc, pts, kind)).flat();
  });
  function one(pc: Piece, pts: P[], kind: Kind): Item[] {
    if (folded) return [{ name: pc.name, pts, kind, atFold: kind === 'fold', single: kind === 'single' }];
    if (kind === 'fold') {
      // Open out: the cutting line and its mirror, joined at the fold.
      const fx = Math.min(...pts.map((q) => q.x));
      const half = pts.map((q) => p(q.x - fx, q.y));
      const start = half.findIndex((q, i) => q.x < 0.01 && half[(i + 1) % half.length].x > 0.01);
      const run = [...half.slice(start), ...half.slice(0, start)];
      const full = [...run, ...[...run].reverse().map((q) => p(-q.x, q.y))];
      return [{ name: pc.name, pts: full, kind, atFold: false, single: true }];
    }
    const it = { name: pc.name, pts, kind, atFold: false, single: true, rightSideUp: !!pc.meta.rightSideUp };
    return kind === 'pair' ? [it, { ...it, pts: flipX(pts) }] : [it];
  }
  if (!folded && items.some((it) => wide(it.pts) > usable)) return undefined;

  const across = folded ? usable / 2 : usable;
  const cols = Math.floor(across / RES);
  // Try a few orders and keep the shortest lay: biggest first (so small pieces fill in round them),
  // pieces on the fold first (they can only go against it), and tallest first.
  const height = (it: Item) => Math.max(...it.pts.map((q) => q.y)) - Math.min(...it.pts.map((q) => q.y));
  const orders = [
    [...items].sort((a, b) => area(b.pts) - area(a.pts)),
    [...items].sort((a, b) => Number(b.atFold) - Number(a.atFold) || area(b.pts) - area(a.pts)),
    [...items].sort((a, b) => height(b) - height(a)),
  ];
  const lays = orders.map((order) => place(order, cols, nap, folded)).filter((pl): pl is Placement[] => !!pl);
  if (!lays.length) return undefined;
  const longest = (pls: Placement[]) => Math.max(...pls.flatMap((pl) => pl.pts.map((q) => q.y)));
  const placements = lays.reduce((best, pl) => (longest(pl) < longest(best) - 0.01 ? pl : best));
  const length = Math.max(...placements.flatMap((pl) => pl.pts.map((q) => q.y)));
  const layers = (pl: Placement) => (folded && !pl.single ? 2 : 1);
  const used = placements.reduce((s, pl) => s + area(pl.pts) * layers(pl), 0);
  return {
    fabric,
    width,
    folded,
    ...(hide ? { hide } : {}),
    across,
    length: Math.round(length * 10) / 10,
    metres: Math.ceil((length + 10) / 10) / 10,
    efficiency: used / (usable * length),
    placements,
    ...(mine.some((pc) => pc.meta.bias) ? { bias: true } : {}),
    ...(mine.some((pc) => pc.meta.rightSideUp) ? { rightSideUp: true } : {}),
    ...(mine.some((pc) => pc.meta.rightSideUp && pc.meta.faceDown) ? { faceDown: true } : {}),
  };
}

/**
 * A border print laid open in one layer: each hemmed piece turned crosswise, its hem on the far
 * selvedge where the border runs; pieces on the fold opened out, and each of a pair cut separately.
 * Pieces without a hem (waistbands, pockets) lie on the grain as usual. Undefined when a hemmed piece
 * is longer than the fabric is wide.
 */
function borderLay(mine: Piece[], width: FabricWidth, fabric: LayFabric, nap: boolean): Lay | undefined {
  const usable = width - 2 * SELVEDGE;
  const items: Item[] = mine.flatMap((pc) => {
    const kind = kindOf(pc);
    let pts = onGrain(pc, cutLine(pc));
    if (kind === 'fold') {
      const fx = Math.min(...pts.map((q) => q.x));
      const half = pts.map((q) => p(q.x - fx, q.y));
      const start = half.findIndex((q, i) => q.x < 0.01 && half[(i + 1) % half.length].x > 0.01);
      const run = [...half.slice(start), ...half.slice(0, start)];
      pts = [...run, ...[...run].reverse().map((q) => p(-q.x, q.y))];
    }
    const down = pc.meta.bias ? undefined : hemDirection(pc);
    const lay = (q: P[], mirrored: boolean): Item => {
      const d = down && (mirrored ? p(-down.x, down.y) : down);
      return { name: pc.name, pts: d ? crosswise(q, d) : q, kind, atFold: false, single: true, rightSideUp: !!pc.meta.rightSideUp, onBorder: !!d };
    };
    const times = kind === 'pair' ? sets(pc) : 1;
    return Array.from({ length: times }, () => (kind === 'pair' ? [lay(pts, false), lay(flipX(pts), true)] : [lay(pts, false)])).flat();
  });
  if (!items.some((it) => it.onBorder)) return undefined;
  const wide = (pts: P[]) => Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
  if (items.some((it) => wide(it.pts) > usable)) return undefined;
  const cols = Math.floor(usable / RES);
  const placements = place([...items].sort((a, b) => Number(b.onBorder) - Number(a.onBorder) || area(b.pts) - area(a.pts)), cols, nap, false);
  if (!placements) return undefined;
  const length = Math.max(...placements.flatMap((pl) => pl.pts.map((q) => q.y)));
  const used = placements.reduce((s, pl) => s + area(pl.pts), 0);
  return {
    fabric,
    width,
    folded: false,
    across: usable,
    length: Math.round(length * 10) / 10,
    metres: Math.ceil((length + 10) / 10) / 10,
    efficiency: used / (usable * length),
    placements,
    border: 'crosswise',
    ...(mine.some((pc) => pc.meta.bias) ? { bias: true } : {}),
    ...(mine.some((pc) => pc.meta.rightSideUp) ? { rightSideUp: true } : {}),
    ...(mine.some((pc) => pc.meta.rightSideUp && pc.meta.faceDown) ? { faceDown: true } : {}),
  };
}

type Profile = ReturnType<typeof profile>;
interface Orientation {
  prof: Profile;
  flipped: boolean;
  turned: boolean;
}

const cache = new WeakMap<Item, Orientation[]>();

/** The ways a piece can lie: turned over, and end to end without a nap. Worked out once per piece. */
function orientations(it: Item, nap: boolean): Orientation[] {
  const hit = cache.get(it);
  if (hit) return hit;
  const o: { pts: P[]; flipped: boolean; turned: boolean }[] = [{ pts: it.pts, flipped: false, turned: false }];
  // A piece on the border keeps its hem on the far selvedge: it can only be turned over end to end.
  if (it.onBorder) {
    if (!nap && !it.rightSideUp) o.push({ pts: it.pts.map((q) => p(q.x, -q.y)), flipped: true, turned: true });
    const out = o.map(({ pts, flipped, turned }) => ({ prof: profile(pts), flipped, turned }));
    cache.set(it, out);
    return out;
  }
  const canFlip = !it.atFold && !it.rightSideUp;
  if (canFlip) o.push({ pts: flipX(it.pts), flipped: true, turned: false });
  if (!nap) {
    // Turned end to end; a fold piece is then also turned over, to keep its fold edge on the fold.
    o.push({ pts: it.atFold ? flipX(turn(it.pts)) : turn(it.pts), flipped: it.atFold, turned: true });
    if (canFlip) o.push({ pts: flipX(turn(it.pts)), flipped: true, turned: true });
  }
  const out = o.map(({ pts, flipped, turned }) => ({ prof: profile(pts), flipped, turned }));
  cache.set(it, out);
  return out;
}

/** Drop each piece in turn as low as it will go across `cols` grid columns. */
function place(order: Item[], cols: number, nap: boolean, folded: boolean): Placement[] | undefined {
  const sky = new Array<number>(cols).fill(0);
  const placements: Placement[] = [];
  for (const it of order) {
    const options = orientations(it, nap);
    let best: { y: number; x: number; prof: Profile; o: Orientation } | undefined;
    for (const o of options) {
      const { prof } = o;
      const last = it.atFold ? 0 : cols - prof.cols;
      // Anything not cut on the fold stays a little off it, or the two layers would stay joined there;
      // a piece on the border lies against the far selvedge.
      const first = it.onBorder ? last : folded && !it.atFold ? 1 : 0;
      for (let x = first; x <= last; x++) {
        let y = 0;
        for (let c = 0; c < prof.cols; c++) y = Math.max(y, sky[x + c] - prof.top[c]);
        if (!best || y < best.y - 1e-6 || (Math.abs(y - best.y) < 1e-6 && x < best.x)) best = { y, x, prof, o };
      }
    }
    if (!best) return undefined;
    const { x, y, prof, o } = best;
    for (let c = 0; c < prof.cols; c++) sky[x + c] = Math.max(sky[x + c], y + prof.bottom[c] + 0.3);
    const pts = prof.pts.map((q) => p(q.x + x * RES, q.y + y));
    const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length;
    const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length;
    placements.push({ name: it.name, pts, flipped: o.flipped, turned: o.turned, single: folded && it.single, at: p(cx, cy) });
  }
  return placements;
}

/** The lays for every fabric the pieces are cut from, at one width. */
export function layPlans(pieces: Piece[], width: FabricWidth, nap = false, hide = false, knit = false, border = false): Lay[] {
  // Only the leather itself comes from a hide; the lining and the coutil are ordinary cloth. Only the
  // garment fabric carries the border, and never a knit, whose stretch must go round the body.
  return (['self', 'lining', 'interlining'] as const)
    .map((f) => layPlan(pieces, width, f, nap, hide && f === 'self', border && !knit && f === 'self'))
    .filter((l): l is Lay => !!l)
    .map((l) => (knit ? { ...l, knit } : l));
}

/** What to buy for a lay: "1.4 m" of cloth, or "about 14 sq ft of hide" for leather. */
export const layAmount = (lay: Lay): string => (lay.hide ? `about ${hideSqFt(lay)} sq ft of hide` : `${lay.metres.toFixed(1)} m`);

/** How to lay the fabric out and cut, in a sentence or two. */
export function layWords(lay: Lay): string {
  if (lay.hide) return LEATHER_LAY;
  const way = lay.folded
    ? 'Fold the fabric in half lengthwise, right sides together, selvedges matching. Place the pieces marked on the fold against the fold.'
    : 'Open the fabric out to a single layer, right side up. Pieces on the fold are drawn opened out; cut a pair as one piece face up and one face down.';
  const single = lay.placements.some((pl) => pl.single && lay.folded) ? ' Cut the pieces marked 1 LAYER through the top layer only.' : '';
  const grain = lay.knit
    ? ' Keep every grain line along the ribs, parallel to the fold, so the most stretch runs across the fabric and round the body. Keep the knit flat on the table so it does not stretch as you cut.'
    : lay.border === 'crosswise'
      ? ' Keep the grain lines of the pieces without a hem parallel to the selvedge.'
      : ' Keep every grain line parallel to the selvedge.';
  const bias = lay.bias ? ' The bias pieces lie at 45 degrees across the cloth, so their grain lines run along it: that puts them on the true bias. Cut them through one layer, without stretching the edges.' : '';
  const up = lay.faceDown
    ? ' The pieces marked right side down differ side to side and are cut as the mirror of their pattern: lay them printed side up on the wrong side of the fabric, never turned over.'
    : lay.rightSideUp ? ' The pieces marked right side up differ side to side: lay them printed side up on the right side of the fabric, never turned over.' : '';
  const edge =
    lay.border === 'crosswise'
      ? ' Border print: the hemmed pieces are turned crosswise, their grain lines across the fabric, with every hem on the border along the far selvedge. Line the border up at the side seams.'
      : lay.border === 'too-long'
        ? ` Border print: a piece is longer than the fabric is wide, so it can't be turned to put its hem on the border. It is laid on the straight grain; let the border fall where it lands, or choose a shorter length or a wider fabric.`
        : '';
  return `${way}${single}${grain}${bias}${up}${edge} The pieces use ${Math.round(lay.efficiency * 100)}% of the fabric.`;
}
