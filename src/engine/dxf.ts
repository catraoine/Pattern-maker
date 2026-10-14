// DXF export laid out the AAMA/ASTM D6673 way, so a pattern maker can open the pieces in Gerber,
// Lectra, Optitex or CLO 3D. Each piece is a block on the standard layers; the file is plain R12
// (AC1009), which every apparel CAD package reads. Units are millimetres, y up.
import { P, add, len, mul, sub, unit } from './geometry';
import { Piece, cutLine } from './piece';

// AAMA layer numbers.
export const LAYER = {
  boundary: '1', // cut line, and the piece annotation text
  notch: '4',
  mirror: '6', // place-on-fold line: the piece is half and opens out along it
  grain: '7',
  internal: '8', // darts and other internal lines
  sew: '14', // stitching line
} as const;

export interface DxfInfo {
  style: string;
  size: string; // the profile name: each pattern is drafted for one person, so that is its "size"
  date: string;
}

const MM = 10;

/** Pieces from a draft are in cm with y down; DXF wants y up. */
const pt = (q: P): [number, number] => [q.x * MM, -q.y * MM];
const num = (v: number) => (Math.abs(v) < 5e-5 ? '0' : v.toFixed(4).replace(/\.?0+$/, ''));
// R12 text is single-byte; keep annotation plain ASCII.
const ascii = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '');

class Writer {
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

const blockName = (pc: Piece, i: number) => `P${i + 1}_${ascii(pc.name).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

export function toDxf(pieces: Piece[], info: DxfInfo): string {
  const w = new Writer();
  const cuts = pieces.map((pc) => open(cutLine(pc)));
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
    w.polyline(open(pc.outline.points()), LAYER.sew, true);
    pc.lines.forEach((ln) => w.polyline(ln.points(), LAYER.internal, false));
    if (pc.grain) w.line(pc.grain[0], pc.grain[1], LAYER.grain);
    if (pc.fold) w.line(pc.fold[0], pc.fold[1], LAYER.mirror);
    // AAMA notches are points on the cut line.
    pc.notches.forEach(([q, d]) => {
      const edge = add(q, mul(unit(d), pc.seamAllowance));
      w.point(edge, LAYER.notch);
    });

    const [x0, y0, x1, y1] = extents[i];
    const at = (k: number) => ({ x: x0 + (x1 - x0) * 0.55, y: y0 + (y1 - y0) * 0.35 + k * 1.2 });
    [
      `Piece Name: ${pc.name}`,
      `Quantity: ${quantity(pc.cut)}`,
      `Annotation: ${pc.cut}`,
      `Category: Self`,
      `Size: ${info.size}`,
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
  [`Style Name: ${info.style}`, `Creation Date: ${info.date}`, `Sample Size: ${info.size}`, 'Units: METRIC', 'Author: Pattern Maker'].forEach(
    (t, k) => w.text({ x: 0, y: -8 + k * 1.2 }, t, LAYER.boundary, 4),
  );
  w.g(0, 'ENDSEC');
  w.g(0, 'EOF');
  return w.out.join('\r\n') + '\r\n';
}
