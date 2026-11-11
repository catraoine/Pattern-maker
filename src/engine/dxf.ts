// DXF export laid out the AAMA/ASTM D6673 way, so a pattern maker can open the pieces in Gerber,
// Lectra, Optitex or CLO 3D. Each piece is a block on the standard layers; the file is plain R12
// (AC1009), which every apparel CAD package reads. Units are millimetres, y up.
import { P, add, len, mul, sub } from './geometry';
import { Piece, cutLine } from './piece';
import { allNotches, dartsOf, drillHoles, notchSlit } from './marks';

// AAMA layer numbers.
export const LAYER = {
  boundary: '1', // cut line, and the piece annotation text
  notch: '4',
  mirror: '6', // place-on-fold line: the piece is half and opens out along it
  grain: '7',
  internal: '8', // darts and other internal lines
  drill: '13', // drill holes
  sew: '14', // stitching line
} as const;

interface DxfInfo {
  style: string;
  size: string; // the profile name: each pattern is drafted for one person, so that is its "size"
  date: string;
}

const MM = 10;

/** Pieces from a draft are in cm with y down; DXF wants y up. */
const pt = (q: P): [number, number] => [q.x * MM, -q.y * MM];
const num = (v: number) => (Math.abs(v) < 5e-5 ? '0' : v.toFixed(4).replace(/\.?0+$/, ''));
// R12 text is single-byte; keep annotation plain ASCII.
export const ascii = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '');

export class Writer {
  out: string[] = [];
  g(code: number, value: string | number) {
    this.out.push(String(code), typeof value === 'number' ? num(value) : value);
  }
  polyline(pts: P[], layer: string, closed: boolean) {
    this.g(0, 'POLYLINE');
    this.g(8, layer);
    this.g(66, '1');
    this.g(10, 0);
    this.g(20, 0);
    this.g(30, 0);
    this.g(70, closed ? '1' : '0');
    for (const q of pts) {
      const [x, y] = pt(q);
      this.g(0, 'VERTEX');
      this.g(8, layer);
      this.g(10, x);
      this.g(20, y);
      this.g(30, 0);
    }
    this.g(0, 'SEQEND');
    this.g(8, layer);
  }
  line(a: P, b: P, layer: string) {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    this.g(0, 'LINE');
    this.g(8, layer);
    this.g(10, x1);
    this.g(20, y1);
    this.g(30, 0);
    this.g(11, x2);
    this.g(21, y2);
    this.g(31, 0);
  }
  point(a: P, layer: string) {
    const [x, y] = pt(a);
    this.g(0, 'POINT');
    this.g(8, layer);
    this.g(10, x);
    this.g(20, y);
    this.g(30, 0);
  }
  text(a: P, s: string, layer: string, height = 5) {
    const [x, y] = pt(a);
    this.g(0, 'TEXT');
    this.g(8, layer);
    this.g(10, x);
    this.g(20, y);
    this.g(30, 0);
    this.g(40, height);
    this.g(1, ascii(s));
  }
}

/** Remove a repeated closing point; DXF closes the polyline with its flag instead. */
function open(pts: P[]): P[] {
  return pts.length > 1 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.slice(0, -1) : pts;
}

/** How many to cut, from instructions like "Cut 1 on fold" or "Cut 2 (1 pair)". */
export function quantity(cut: string): number {
  const m = cut.match(/cut\s+(\d+)/i);
  return m ? Number(m[1]) : 1;
}

/** The nearest point to q on a closed polygon. */
function nearestOn(poly: P[], q: P): P {
  let best = poly[0];
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const ab = sub(poly[(i + 1) % poly.length], a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
    const c = add(a, mul(ab, t));
    const d = len(sub(q, c));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Points closer than this (cm) on a written line are one point: half a millimetre. A curve drafted on to a corner
 *  left runs of points a few hundredths of a millimetre apart, and Gerber read each as its own corner, so the seam
 *  allowance came in with extra points a pattern maker had to delete by hand (Rodica's review, Nov 9 2026). */
const MIN_STEP = 0.05;
/** How sharply the line turns at a point (radians, 0 = straight on). */
function turnAt(prev: P, q: P, next: P): number {
  const a = sub(q, prev);
  const b = sub(next, q);
  const la = len(a);
  const lb = len(b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb))));
}
/** How far a written line may stray from the drafted one where points are merged (cm): a twentieth of a millimetre. */
const DRIFT = 0.005;
/** Distance from q to the segment a-b. */
function offSegment(q: P, a: P, b: P): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
  return len(sub(q, add(a, mul(ab, t))));
}
/** A closed line with points closer than MIN_STEP merged: of each close pair the gentler point goes, so long as the line
 *  without it stays within DRIFT of where it was (corners stay exactly where they were drafted). */
export function cleanRing(pts: P[], straight = true): P[] {
  const ring = [...open(pts)];
  let changed = true;
  while (changed && ring.length > 3) {
    changed = false;
    for (let i = 0; i < ring.length && ring.length > 3; i++) {
      const n = ring.length;
      const j = (i + 1) % n;
      if (len(sub(ring[j], ring[i])) >= MIN_STEP) continue;
      const turn = (k: number) => turnAt(ring[(k + n - 1) % n], ring[k], ring[(k + 1) % n]);
      const off = (k: number) => offSegment(ring[k], ring[(k + n - 1) % n], ring[(k + 1) % n]);
      const order = turn(i) <= turn(j) ? [i, j] : [j, i];
      const drop = order.find((k) => off(k) < DRIFT);
      if (drop === undefined) continue;
      ring.splice(drop, 1);
      changed = true;
    }
  }
  // Points along a straight run are dropped too, however far apart: a side seam drafted four points a centimetre came
  // out as hundreds of 2.5 mm steps, which CLO 3D reads as that many separate edges, so a seam could not be picked
  // corner to corner (CLO trial, Nov 10 2026). Only points within STRAIGHT of the line through their neighbours go, so
  // curves keep every point.
  // Each run is held against every drafted point it replaces, so small steps never add up to a drift.
  const n = ring.length;
  if (n <= 3 || !straight) return ring;
  // Start at the sharpest corner, which always stays.
  let start = 0;
  for (let i = 1; i < n; i++) if (turnAt(ring[(i + n - 1) % n], ring[i], ring[(i + 1) % n]) > turnAt(ring[(start + n - 1) % n], ring[start], ring[(start + 1) % n])) start = i;
  const at = (k: number) => ring[(start + k) % n];
  const kept: P[] = [at(0)];
  let a = 0;
  while (a < n) {
    let b = a + 1;
    while (b + 1 <= n) {
      const c = b + 1;
      let onLine = true;
      for (let k = a + 1; k < c && onLine; k++) if (offSegment(at(k), at(a), at(c)) >= STRAIGHT) onLine = false;
      if (!onLine) break;
      b = c;
    }
    if (b >= n) break;
    kept.push(at(b));
    a = b;
  }
  return kept.length > 3 ? kept : ring;
}
/** How near a point must lie to the line through its neighbours to count as on a straight run (cm): a twentieth of a
 *  millimetre. */
const STRAIGHT = 0.005;

/** The cutting line as the file writes it, cleaned, with a point of its own at every notch, and the notches. Gerber
 *  (and most cutting-room software) keeps a notch only where it falls on a point of the cutting line; ours fell between
 *  points, so Rodica's import showed one notch on the bodice and none on the skirt (Nov 9 2026). A notch within
 *  0.4 mm of a point moves onto it; one beside a point that is no corner takes that point's place where the line moves
 *  less than DRIFT; any other is added to the line where it falls. */
export function dxfCut(pc: Piece): { cut: P[]; notches: P[] } {
  // A cutting line read from a file is written back as it came (its notches are points of it already).
  const cut = cleanRing(cutLine(pc), !pc.cutOutline);
  const notches: P[] = [];
  for (const [q, d] of allNotches(pc)) {
    const at = nearestOn(cut, notchSlit(pc, q, d)[0]);
    const n = cut.length;
    let near = -1;
    let nearD = Infinity;
    for (let i = 0; i < n; i++) {
      const dd = len(sub(cut[i], at));
      if (dd < nearD) [nearD, near] = [dd, i];
    }
    const corner = turnAt(cut[(near + n - 1) % n], cut[near], cut[(near + 1) % n]) > 0.35;
    // Within 0.4 mm of a point the notch moves onto it (a cutter's notch is wider than that), so no sliver of a step is
    // left beside it.
    if (nearD < 0.04) {
      notches.push(cut[near]);
      continue;
    }
    const swapped = [...cut];
    swapped[near] = at;
    const moves = Math.max(offSegment(cut[near], swapped[(near + n - 1) % n], at), offSegment(cut[near], at, swapped[(near + 1) % n]));
    if (!corner && nearD < 2 * MIN_STEP && moves < DRIFT && !notches.some((m) => len(sub(m, cut[near])) < 1e-9)) {
      cut[near] = at;
      notches.push(at);
      continue;
    }
    // Added on the segment it falls on.
    let seg = 0;
    let segD = Infinity;
    for (let i = 0; i < n; i++) {
      const a = cut[i];
      const ab = sub(cut[(i + 1) % n], a);
      const l2 = ab.x * ab.x + ab.y * ab.y;
      const t = l2 ? Math.max(0, Math.min(1, ((at.x - a.x) * ab.x + (at.y - a.y) * ab.y) / l2)) : 0;
      const dd = len(sub(at, add(a, mul(ab, t))));
      if (dd < segD) [segD, seg] = [dd, i];
    }
    cut.splice(seg + 1, 0, at);
    notches.push(at);
  }
  return { cut, notches };
}

/** The stitching line as the file writes it: cleaned, and with each dart that opens on an edge sewn into it as a V, in
 *  from one leg's end to the dart point and out to the other's. The drafted line runs across the dart's opening (its
 *  cap); CLO 3D sews only the outline, so it could not close a dart drawn as legs inside the piece (CLO trial, Nov 10
 *  2026). The cutting line keeps the cap, so a cutting room cuts exactly as before. */
export function sewLine(pc: Piece): P[] {
  // The darts first, so their legs are corners the cleaning keeps.
  return cleanRing(withDartVs(pc, open(pc.outline.points())), !pc.cutOutline);
}

/** A closed line with each of the piece's edge darts let into it as a V, in place of the cap between its legs. */
export function withDartVs(pc: Piece, line: P[]): P[] {
  const ring = [...line];
  for (const { near, tip, far } of dartsOf(pc)) {
    // Already a V (a file read back in).
    if (ring.some((q) => len(sub(q, tip)) < 1e-4)) continue;
    const n = ring.length;
    const at = (q: P) => {
      let best = -1;
      let bestD = 0.02;
      ring.forEach((r, i) => {
        const d = len(sub(r, q));
        if (d < bestD) [bestD, best] = [d, i];
      });
      return best;
    };
    const a = at(near);
    const b = at(far);
    if (a < 0 || b < 0 || a === b) continue;
    // The short way round from one leg to the other: the cap, a corner or two.
    const fwd = (b - a + n) % n;
    const back = (a - b + n) % n;
    const [from, steps] = fwd <= back ? [a, fwd] : [b, back];
    if (steps > 4) continue;
    const drop = Array.from({ length: steps - 1 }, (_, k) => (from + 1 + k) % n);
    const keep = ring.filter((_, i) => !drop.includes(i));
    const insertAfter = keep.indexOf(ring[from]);
    keep.splice(insertAfter + 1, 0, tip);
    ring.splice(0, ring.length, ...keep);
  }
  return ring;
}

/** The internal lines the file writes on layer 8, each with whether it is a closed shape. A fish-eye dart is drawn round
 *  and back to its start, so it is written as a closed shape: CLO 3D (and Gerber) read an open line that ends where it
 *  began as a stray line, not a dart (CLO trial, Nov 10 2026). Each pleat's placement line goes in too, beside its fold
 *  line: with the fold line alone CLO had nothing to fold the pleat to (the pleat dress, Nov 10 2026). */
export function internalLines(pc: Piece): { pts: P[]; closed: boolean }[] {
  const out = pc.lines.map((ln) => {
    const pts = ln.points();
    const closed = pts.length > 3 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6;
    return { pts: closed ? pts.slice(0, -1) : pts, closed };
  });
  for (const b of pc.balance ?? []) if (b.label === 'PLACEMENT' && b.pts.length > 1) out.push({ pts: b.pts, closed: false });
  return out;
}

const blockName = (pc: Piece, i: number) => `P${i + 1}_${ascii(pc.name).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

export function toDxf(pieces: Piece[], info: DxfInfo): string {
  const w = new Writer();
  const written = pieces.map(dxfCut);
  const cuts = written.map((w) => w.cut);
  // Lay the pieces side by side, as the SVG and PDF do, so the file opens with everything in view.
  const extents = cuts.map((c) => {
    const xs = c.map((q) => q.x);
    const ys = c.map((q) => q.y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });

  w.g(0, 'SECTION');
  w.g(2, 'HEADER');
  w.g(9, '$ACADVER');
  w.g(1, 'AC1009');
  w.g(9, '$MEASUREMENT');
  w.g(70, '1'); // metric
  w.g(9, '$INSUNITS');
  w.g(70, '4'); // millimetres
  w.g(0, 'ENDSEC');

  w.g(0, 'SECTION');
  w.g(2, 'TABLES');
  w.g(0, 'TABLE');
  w.g(2, 'LAYER');
  w.g(70, String(Object.keys(LAYER).length + 1));
  for (const name of ['0', ...Object.values(LAYER)]) {
    w.g(0, 'LAYER');
    w.g(2, name);
    w.g(70, '0');
    w.g(62, '7');
    w.g(6, 'CONTINUOUS');
  }
  w.g(0, 'ENDTAB');
  w.g(0, 'ENDSEC');

  w.g(0, 'SECTION');
  w.g(2, 'BLOCKS');
  pieces.forEach((pc, i) => {
    w.g(0, 'BLOCK');
    w.g(8, '0');
    w.g(2, blockName(pc, i));
    w.g(70, '0');
    w.g(10, 0);
    w.g(20, 0);
    w.g(30, 0);
    w.g(3, blockName(pc, i));

    w.polyline(cuts[i], LAYER.boundary, true);
    w.polyline(sewLine(pc), LAYER.sew, true);
    internalLines(pc).forEach((ln) => w.polyline(ln.pts, LAYER.internal, ln.closed));
    if (pc.grain) w.line(pc.grain[0], pc.grain[1], LAYER.grain);
    if (pc.fold) w.line(pc.fold[0], pc.fold[1], LAYER.mirror);
    // AAMA notches are points on the cut line: the seam and dart notches the PDF cuts, each pushed out
    // by its own edge's allowance, then snapped onto the cut line where edges with different
    // allowances meet, each on a point of the cut line itself (dxfCut).
    written[i].notches.forEach((q) => w.point(q, LAYER.notch));
    drillHoles(pc).forEach((q) => w.point(q, LAYER.drill));

    const [x0, y0, x1, y1] = extents[i];
    const at = (k: number) => ({ x: x0 + (x1 - x0) * 0.55, y: y0 + (y1 - y0) * 0.35 + k * 1.2 });
    [
      `Piece Name: ${pc.name}`,
      `Quantity: ${quantity(pc.cut)}`,
      `Annotation: ${pc.cut}`,
      `Category: Self`,
      `Size: ${(pc.meta.size as string | undefined) ?? info.size}`,
      `Seam Allowance: ${pc.seamAllowance * MM} mm`,
    ].forEach((t, k) => w.text(at(k), t, LAYER.boundary, 4));
    w.g(0, 'ENDBLK');
    w.g(8, '0');
  });
  w.g(0, 'ENDSEC');

  w.g(0, 'SECTION');
  w.g(2, 'ENTITIES');
  let x = 0;
  pieces.forEach((pc, i) => {
    const [x0, y0, x1] = extents[i];
    w.g(0, 'INSERT');
    w.g(8, '0');
    w.g(2, blockName(pc, i));
    w.g(10, (x - x0) * MM);
    w.g(20, y0 * MM); // top of each piece at y = 0
    w.g(30, 0);
    x += x1 - x0 + 4;
  });
  // File annotation, above the pieces.
  [`Style Name: ${info.style}`, `Creation Date: ${info.date}`, `Sample Size: ${info.size}`, 'Units: METRIC', 'Author: Maison Trace'].forEach(
    (t, k) => w.text({ x: 0, y: -8 + k * 1.2 }, t, LAYER.boundary, 4),
  );
  w.g(0, 'ENDSEC');
  w.g(0, 'EOF');
  return w.out.join('\r\n') + '\r\n';
}
