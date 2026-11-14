// The Front drawing check (Quality: Automated checks, Cat 2026-11-04): the garment drawn on the form on the Style page,
// which also stands in for All round when a sewn drawing fails its score, measured as All round's quality check measures
// a sewn drawing. e2e/front-drawing.spec.ts opens every option in the real app and reads the drawing out of the page;
// this scores it:
// - broken: a point that is not a number, or no cloth drawn at all;
// - cut off: cloth running past the drawing's frame, so part of the garment is not seen;
// - twisted: a piece of cloth whose outline crosses itself (a bow tie, a hem folded through itself);
// - jagged: an edge running in a sawtooth rather than a line;
// - gap: a hole in the cloth where pieces that sew together are drawn apart, so the form shows through;
// - lopsided: one side drawn differently from the other on a garment cut the same both sides.
// frontCheck.test.ts holds the result to src/frontKnown.json, as the other checks are held.
import { P, len, sub } from './engine/geometry';

export interface FrontDrawing {
  viewBox?: string | null;
  cloth?: string[];
  error?: string;
}

const LIMITS = {
  /** Cloth this far past the frame, in cm. */
  cutCm: 0.5,
  /** An edge point this far off the line through its neighbours (cm), and as a share of their distance apart... */
  jagCm: 0.6,
  jagShare: 0.3,
  /** ...at this many points along one edge (as All round's check). */
  jagCount: 3,
  /** A piece's outline crossing itself in a loop this big, in cm². */
  twistCm2: 0.5,
  /** A hole in the cloth this big, in cm² (a slit 1 cm wide and 2 cm long). */
  gapCm2: 2,
  /** Cloth on one side with nothing mirroring it on the other, as a share of the garment. */
  lopsided: 0.04,
};
/** The raster the holes and the two sides are measured on, in cm. */
const CELL = 0.25;

/** The points of an SVG path drawn with M, L and Z (the Front drawing's cloth), one outline per M. */
export function pathPoints(d: string): P[][] {
  const out: P[][] = [];
  const re = /([MLZ])([^MLZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1].toUpperCase() === 'M') out.push([]);
    for (let i = 0; i + 1 < nums.length; i += 2) out[out.length - 1]?.push({ x: nums[i], y: nums[i + 1] });
  }
  return out.filter((o) => o.length);
}

/** How many points along an outline stand off the line through their neighbours like a sawtooth's teeth: leaning
 *  out past the limit with the next point leaning the other way just as far. A corner (a hem's, a shoulder's) leans
 *  once, on its own, and is not a tooth. */
function teeth(pts: P[]): number {
  const lean = pts.map((q, i) => {
    if (i === 0 || i + 1 === pts.length) return 0;
    const a = pts[i - 1];
    const ab = sub(pts[i + 1], a);
    const l = len(ab);
    if (l < 1e-6) return 0;
    const off = (ab.x * (q.y - a.y) - ab.y * (q.x - a.x)) / l;
    return Math.abs(off) > LIMITS.jagCm && Math.abs(off) > LIMITS.jagShare * l ? Math.sign(off) : 0;
  });
  let n = 0;
  for (let i = 1; i < lean.length; i++) if (lean[i] && lean[i] === -lean[i - 1]) n++;
  return n;
}

const cross = (a: P, b: P, c: P, d: P) => {
  const o = (p: P, q: P, r: P) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const area = (pts: P[]) => Math.abs(pts.reduce((s, q, i) => s + q.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * q.y, 0)) / 2;

/** The biggest loop an outline makes where it crosses itself, in cm² (0 when it doesn't): a tiny curl where two points
 *  of a dense line land a hair apart can't be seen; a hem or a lapel folded through itself can. */
function twist(pts: P[]): number {
  const n = pts.length;
  let worst = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (!cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) continue;
      // Where the two edges meet, and the two loops either side of it.
      const [a, b, c, d] = [pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]];
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / ((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x));
      const x = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      worst = Math.max(worst, Math.min(area([x, ...pts.slice(i + 1, j + 1)]), area([x, ...pts.slice(j + 1), ...pts.slice(0, i + 1)])));
    }
  return worst;
}

/** The cloth as a grid of cells, each on where any piece covers it. */
function raster(shapes: P[][], vb: number[]) {
  const [x0, y0, w, h] = vb;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);
  const on = new Uint8Array(cols * rows);
  for (const s of shapes) {
    for (let r = 0; r < rows; r++) {
      const y = y0 + (r + 0.5) * CELL;
      const xs: number[] = [];
      for (let i = 0; i < s.length; i++) {
        const a = s[i];
        const b = s[(i + 1) % s.length];
        if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - x0) / CELL - 0.5));
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - x0) / CELL - 0.5));
        for (let c = c0; c <= c1; c++) on[r * cols + c] = 1;
      }
    }
  }
  return { on, cols, rows };
}

/** The holes in the cloth: uncovered cells the frame's edge can't reach without crossing cloth, biggest first, in cm². */
function holes({ on, cols, rows }: ReturnType<typeof raster>): { cm2: number; y: number; w: number; h: number; x: number }[] {
  const seen = new Uint8Array(on.length);
  const flood = (start: number) => {
    const stack = [start];
    seen[start] = 1;
    const cells: number[] = [];
    while (stack.length) {
      const i = stack.pop()!;
      cells.push(i);
      const r = Math.floor(i / cols);
      const c = i % cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (!seen[j] && !on[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    return cells;
  };
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) if (!on[r * cols + c] && !seen[r * cols + c]) flood(r * cols + c);
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) if (!on[r * cols + c] && !seen[r * cols + c]) flood(r * cols + c);
  const out: { cm2: number; y: number; w: number; h: number; x: number }[] = [];
  for (let i = 0; i < on.length; i++)
    if (!on[i] && !seen[i]) {
      const cells = flood(i);
      const rs = cells.map((k) => Math.floor(k / cols));
      const cs = cells.map((k) => k % cols);
      const [r0, c0] = [Math.min(...rs), Math.min(...cs)];
      out.push({ cm2: cells.length * CELL * CELL, y: r0, x: c0, w: (Math.max(...cs) - c0 + 1) * CELL, h: (Math.max(...rs) - r0 + 1) * CELL });
    }
  return out.sort((a, b) => b.cm2 - a.cm2);
}

/** Cloth on one side that the other side doesn't mirror, as a share of all the cloth: the drawing's centre is its frame's. */
function lopsidedShare({ on, cols, rows }: ReturnType<typeof raster>): number {
  let odd = 0;
  let all = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = on[r * cols + c];
      const b = on[r * cols + (cols - 1 - c)];
      if (a) all++;
      if (a && !b) odd++;
    }
  return all ? odd / all : 0;
}

/** Choices that draw the two sides differently on purpose. */
const ASYMMETRIC = /asymHem=(high_low|diagonal)|one_shoulder|closure=wrap|waist=wrap|front=double|wrap|asym|uneven/;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** What is wrong with a Front drawing, each in words with how bad it is. */
export function frontProblems(key: string, d: FrontDrawing): string[] {
  if (d.error) return [`not drawn: ${d.error.replace(/\d+ms/g, '').trim()}`];
  const vb = (d.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const shapes = (d.cloth ?? []).flatMap(pathPoints);
  if (vb.length !== 4 || !vb.every(Number.isFinite)) return ['broken: the drawing has no frame'];
  if (!shapes.length) return ['broken: no cloth drawn'];
  if (shapes.some((s) => s.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y)))) return ['broken: a point that is not a number'];
  const out: string[] = [];
  const [x0, y0, w, h] = vb;
  const pts = shapes.flat();
  // The drawing is scaled to fit its box and centred, and the box clips at its own edges, not the frame's: a drawing
  // taller than it is wide fills the box's height and has room either side, so only cloth past its top or bottom is
  // lost (a wide one, the other way about).
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const past = h >= w ? Math.max(y0 - Math.min(...ys), Math.max(...ys) - (y0 + h)) : Math.max(x0 - Math.min(...xs), Math.max(...xs) - (x0 + w));
  if (past > LIMITS.cutCm) out.push(`cut off: cloth runs ${r1(past)} cm past the drawing's edge`);
  const loop = Math.max(...shapes.map(twist));
  if (loop >= LIMITS.twistCm2) out.push(`twisted: a piece of cloth folds through itself in a loop of ${r1(loop)} cm²`);
  const jag = Math.max(...shapes.map(teeth));
  if (jag >= LIMITS.jagCount) out.push(`jagged: an edge with ${jag} teeth`);
  const grid = raster(shapes, vb);
  // Two openings that are meant, not gaps: the space between a sleeve hanging by the side and the body (tall and
  // narrow), and an open front reaching up to the neckline at the centre (a jacket's lapels, a cardigan). The
  // double-breasted collar's neck V starts about 3.3 cm below the top, so the opening may start up to 4 cm down
  // (Cat OK'd this on Nov 14).
  const top = Math.min(...pts.map((q) => q.y));
  const gap = holes(grid).filter((g) => {
    if (g.cm2 < LIMITS.gapCm2 || g.h > 4 * g.w) return false;
    const [gx, gy] = [g.x * CELL + x0 - (x0 + w / 2), g.y * CELL + y0];
    return !(gy < top + 4 && Math.abs(gx + g.w / 2) < 1);
  });
  if (gap.length) out.push(`gap: the form shows through a hole of ${r1(gap[0].cm2)} cm² in the cloth, ${r1(gap[0].y * CELL + y0)} cm down`);
  const side = lopsidedShare(grid);
  if (!ASYMMETRIC.test(key) && side > LIMITS.lopsided) out.push(`lopsided: ${Math.round(side * 100)}% of the cloth on one side has nothing matching it on the other`);
  return out;
}
