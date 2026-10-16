// The ease map: how much room the garment has over the body, level by level, drawn as colour on the
// flat pieces, front and back. At each level the pieces' widths are added up as sewn (darts closed,
// every piece counted as many times as it is cut) and the body's own measurement at that level is taken
// away: red where it would strain, through snug and fitted, to blue where it falls loose.
import type { P } from './geometry';
import type { Piece } from './piece';

export interface EaseBand {
  y0: number;
  y1: number;
  /** Room over the body at this level, round the whole garment (or round one leg), in cm. */
  ease: number;
}

export interface EaseView {
  name: string;
  outline: P[];
  bands: EaseBand[];
}

export const EASE_LEVELS: { max: number; label: string; cls: string }[] = [
  { max: 0, label: 'Strains', cls: 'ease-tight' },
  { max: 2, label: 'Snug', cls: 'ease-snug' },
  { max: 6, label: 'Fitted', cls: 'ease-fit' },
  { max: 12, label: 'Easy', cls: 'ease-easy' },
  { max: Infinity, label: 'Loose', cls: 'ease-loose' },
];

export const easeLevel = (ease: number) => EASE_LEVELS.find((l) => ease < l.max) ?? EASE_LEVELS[EASE_LEVELS.length - 1];

/** Where a horizontal line at y crosses a closed polyline, sorted left to right. */
function crossings(pts: P[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  return xs.sort((u, v) => u - v);
}

/** The piece's width at level y as sewn: across the outline, less what the darts take there. */
export function widthAt(pc: Piece, y: number, xMax = Infinity): number {
  const xs = crossings(pc.outline.points(), y);
  let w = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) w += Math.max(0, Math.min(xs[i + 1], xMax) - xs[i]);
  for (const ln of pc.lines) {
    const pts = ln.points();
    if (pts.length < 3) continue;
    // A dart (near, tip, far) or a fish-eye (top, side, bottom, side, top): its open width at y.
    // A dart lying across the piece (a side bust dart) takes up length, not width, so it doesn't count.
    const ring = pts.length === 3 ? pts : pts.slice(0, -1);
    if (pts.length === 3 && Math.abs(pts[2].y - pts[0].y) > Math.abs(pts[2].x - pts[0].x)) continue;
    const cx = crossings(ring, y);
    if (cx.length >= 2) w -= cx[cx.length - 1] - cx[0];
  }
  return Math.max(0, w);
}

/** How many of the piece the garment has, as a share of the whole round: a quarter piece counts twice. */
const copies = (pc: Piece) => (/fold|2|pair/i.test(pc.cut) ? 2 : 1);

export interface EaseGroup {
  /** The pieces sewn round the body together: a skirt's front and back, a bodice's panels. */
  pieces: Piece[];
  /** The body round at level y, in the pieces' own coordinates; undefined where it isn't measured. */
  body: (y: number) => number | undefined;
  /** Trousers: below each piece's crotch level each leg is its own tube, measured against `leg` instead. */
  crotchOf?: (pc: Piece) => number;
  leg?: (y: number, pc: Piece) => number | undefined;
  /** How far a piece's levels sit below the first piece's, so the waists line up. */
  shift?: (pc: Piece) => number;
  /** The level above which a piece is only partly there (a sloped waist seam): read it there instead. */
  top?: (pc: Piece) => number;
  /** The level below which a curved hem or a dipped waist leaves the piece partly cut away. */
  bottom?: (pc: Piece) => number;
  /** The fork extensions above the crotch wrap between the legs, not round the hip: count only up to here. */
  xMax?: (pc: Piece, y: number) => number | undefined;
}

const bottomOf = (pc: Piece) => Math.max(...pc.outline.points().map((q) => q.y));

export function easeMap(groups: EaseGroup[], step = 1): EaseView[] {
  const views: EaseView[] = [];
  for (const g of groups) {
    for (const pc of g.pieces) {
      const pts = pc.outline.points();
      const y0 = Math.min(...pts.map((q) => q.y));
      const y1 = Math.max(...pts.map((q) => q.y));
      const bands: EaseBand[] = [];
      for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) {
        const mid = y + step / 2;
        let ease: number | undefined;
        // Every piece is read at the same body level, the waists lined up, inside its own outline.
        const sh = g.shift?.(pc) ?? 0;
        const level = (x: Piece) => Math.min(g.bottom?.(x) ?? bottomOf(x) - 0.3, Math.max(g.top?.(x) ?? -Infinity, mid - sh + (g.shift?.(x) ?? 0)));
        if (g.crotchOf && g.leg && mid > g.crotchOf(pc)) {
          // One leg is a front and a back sewn together.
          const body = g.leg(mid, pc);
          if (body !== undefined) ease = g.pieces.reduce((t, x) => t + widthAt(x, level(x)), 0) - body;
        } else {
          const body = g.body(mid - sh);
          const read = (x: Piece) => {
            const y = level(x);
            // A button front's two extensions overlap, so they add nothing round the body.
            return copies(x) * widthAt(x, y, g.xMax?.(x, y)) - (x.outline.tags.includes('opening') ? 3 : 0);
          };
          if (body !== undefined) ease = g.pieces.reduce((t, x) => t + read(x), 0) - body;
        }
        if (ease !== undefined) bands.push({ y0: mid - step / 2, y1: mid + step / 2, ease: Math.round(ease * 10) / 10 });
      }
      // A single level flickering across a boundary is noise: each level takes the middle of it and its neighbours.
      const smooth = bands.map((b, i) => {
        if (i === 0 || i === bands.length - 1) return b;
        const e = [bands[i - 1].ease, b.ease, bands[i + 1].ease].sort((u, v) => u - v)[1];
        return { ...b, ease: e };
      });
      views.push({ name: pc.name, outline: pts, bands: smooth });
    }
  }
  return views;
}

/** A smooth rise from one round to the next, the way the body curves between landmarks. */
export const between = (y: number, ya: number, a: number, yb: number, b: number) => {
  const t = Math.min(1, Math.max(0, (y - ya) / (yb - ya)));
  return a + (b - a) * Math.sin((t * Math.PI) / 2);
};

/** The body below the waist: waist at waistY, out to the hip at the hip line, the legs together below it. */
export function lowerBody(m: { waist?: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number }, waistY: number, hipY?: number) {
  return (y: number) => {
    if (!m.waist || !m.full_hip || !m.waist_to_hip) return undefined;
    if (y < waistY - 0.5) return undefined;
    // Below the hip the legs together narrow, to about 0.9 of the hip at the knee with room to step (estimated, as it isn't measured).
    const hy = hipY ?? waistY + m.waist_to_hip;
    if (y > hy && m.waist_to_knee && m.waist_to_knee > m.waist_to_hip) {
      const t = Math.min(1, (y - hy) / (waistY + m.waist_to_knee - hy));
      return m.full_hip * (1 - 0.1 * t * t);
    }
    // Half a smooth rise, half a straight one: the body curves out from the waist, but more gently than a full curve.
    const yb = hipY ?? waistY + m.waist_to_hip;
    const t = Math.min(1, Math.max(0, (y - waistY) / (yb - waistY)));
    return between(y, waistY, m.waist, yb, m.full_hip) / 2 + (m.waist + (m.full_hip - m.waist) * t) / 2;
  };
}

/** The body above the waist: high bust at the underarm, full bust at the bust line, curving in to the waist below. */
export function upperBody(m: { waist?: number; full_bust?: number; high_bust?: number; full_hip?: number; waist_to_hip?: number }, lv: { underarm: number; bust: number; waist: number }) {
  const below = lowerBody(m, lv.waist);
  return (y: number) => {
    if (!m.full_bust || !m.waist || y < lv.underarm) return undefined;
    if (y <= lv.bust) return between(y, lv.underarm, m.high_bust ?? m.full_bust, lv.bust, m.full_bust);
    if (y <= lv.waist) return m.full_bust + (m.waist - m.full_bust) * (1 - Math.cos((((y - lv.bust) / (lv.waist - lv.bust)) * Math.PI) / 2));
    return below(y);
  };
}

/**
 * Round one leg below the crotch, estimated from the hip: the thigh about 0.6 of it at the crotch,
 * the knee about 0.37, the calf a little more, the ankle about 0.24. Estimated, as no leg is measured.
 */
export function legBody(m: { full_hip?: number }, lv: { crotch: number; knee: number; ankle: number }) {
  return (y: number) => {
    if (!m.full_hip) return undefined;
    const H = m.full_hip;
    if (y <= lv.knee) return between(y, lv.crotch, 0.6 * H, lv.knee, 0.37 * H);
    const calf = lv.knee + (lv.ankle - lv.knee) * 0.35;
    if (y <= calf) return 0.37 * H + 0.02 * H * Math.sin(((y - lv.knee) / (calf - lv.knee)) * Math.PI);
    return between(y, calf, 0.37 * H, lv.ankle, 0.24 * H);
  };
}

/** The level of a piece's balance line, by its label. */
export const balanceY = (pc: Piece, label: string) => pc.balance?.find((b) => b.label === label)?.pts[0].y;

/** The middle level of a piece's waist seam. */
export function waistY(pc: Piece): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const ys = tags.flatMap((t, i) => (t === 'waist' ? [pts[i].y, pts[i + 1].y] : [])).sort((a, b) => a - b);
  return ys.length ? ys[Math.floor(ys.length / 2)] : undefined;
}


/** The lowest point of a piece's waist seam: above it a sloped waist leaves the piece partly cut away. */
function waistLow(pc: Piece): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const ys = tags.flatMap((t, i) => (t === 'waist' ? [pts[i].y, pts[i + 1].y] : []));
  return ys.length ? Math.max(...ys) : undefined;
}

/** The highest point of a seam: below it a curved edge leaves the piece partly cut away. */
function seamHigh(pc: Piece, tag: string): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const ys = tags.flatMap((t, i) => (t === tag ? [pts[i].y, pts[i + 1].y] : []));
  return ys.length ? Math.min(...ys) : undefined;
}
const hemOf = (pc: Piece) => seamHigh(pc, 'hem') ?? Infinity;

/** Each piece's waist level less the first piece's. */
const byWaist = (pcs: Piece[]) => {
  const ref = waistY(pcs[0]) ?? 0;
  return (pc: Piece) => (waistY(pc) ?? ref) - ref;
};

const own = (pcs: Piece[], word: string) => pcs.filter((pc) => !pc.kind && pc.name.startsWith(word));

/** A skirt (or a dress's skirt): waist to hip, then the hip. */
export function skirtGroup(pieces: Piece[], m: Parameters<typeof lowerBody>[0]): EaseGroup | undefined {
  const pcs = own(pieces, 'Skirt');
  if (!pcs.length) return undefined;
  const wy = waistY(pcs[0]) ?? 0;
  return { pieces: pcs, body: lowerBody(m, wy, balanceY(pcs[0], 'HIP LINE')), shift: byWaist(pcs), top: (pc) => waistLow(pc) ?? -Infinity, bottom: hemOf };
}

/** A bodice (or a dress's bodice), by its underarm line, bust point and waist. */
export function bodiceGroup(pieces: Piece[], m: Parameters<typeof upperBody>[0], lv: { bust: number; waist: number }): EaseGroup | undefined {
  const pcs = own(pieces, 'Bodice');
  if (!pcs.length) return undefined;
  const underarm = balanceY(pcs[0], 'UNDERARM LINE') ?? lv.bust - 6;
  return { pieces: pcs, body: upperBody(m, { underarm, bust: lv.bust, waist: lv.waist }),
    shift: byWaist(pcs),
    bottom: (pc) => Math.min(hemOf(pc), (pc.outline.tags.includes('hem') ? undefined : seamHigh(pc, 'waist')) ?? Infinity),
  };
}

/** Trousers: waist to hip round the body, then each leg below its crotch level. */
export function trousersGroup(pieces: Piece[], m: Parameters<typeof lowerBody>[0] & { full_hip?: number }): EaseGroup | undefined {
  const pcs = own(pieces, 'Trousers');
  if (!pcs.length) return undefined;
  const front = pcs[0];
  const shift = byWaist(pcs);
  // Front and back legs part at the same body level, the front's crotch: the back's lower fork is part of its leg.
  const fork = (front.meta.fork as P | undefined)?.y ?? Infinity;
  const crotchOf = (pc: Piece) => fork + shift(pc);
  return {
    pieces: pcs,
    body: lowerBody(m, waistY(front) ?? 0, balanceY(front, 'HIP LINE')),
    crotchOf,
    leg: (y, pc) => {
      const knee = balanceY(pc, 'KNEE LINE');
      if (knee === undefined) return undefined;
      return legBody(m, { crotch: crotchOf(pc), knee, ankle: Math.max(...pc.outline.points().map((q) => q.y)) })(y);
    },
    shift,
    top: (pc) => waistLow(pc) ?? -Infinity,
    bottom: hemOf,
    xMax: (pc, y) => {
      const hip = balanceY(pc, 'HIP LINE');
      if (hip === undefined || y < hip - 0.5) return undefined;
      const xs = crossings(pc.outline.points(), hip);
      return xs[xs.length - 1];
    },
  };
}

/** Every garment's ease map from its drafted pieces: a bodice by its bust and waist levels, a skirt, trousers. */
export function garmentEase(pieces: Piece[], m: Parameters<typeof upperBody>[0], bodice?: { bust: number; waist: number }): EaseView[] {
  const groups = [bodice && bodiceGroup(pieces, m, bodice), skirtGroup(pieces, m), trousersGroup(pieces, m)].filter((g): g is EaseGroup => !!g);
  return easeMap(groups).filter((v) => v.bands.length);
}
