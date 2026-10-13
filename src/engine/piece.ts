// A pattern piece: a stitching-line outline plus markings, ready for export.
import { P, Path, len, offsetPolygon, sub } from './geometry';

export interface Label {
  at: P;
  text: string;
  size: number; // cm
}

export interface Piece {
  name: string;
  outline: Path; // closed stitching line
  lines: Path[]; // darts and other internal lines
  grain?: [P, P];
  fold?: [P, P]; // place-on-fold edge
  notches: [P, P][]; // point, direction into the seam allowance
  labels: Label[];
  cut: string;
  seamAllowance: number;
  allowances: Record<string, number>; // per edge tag, e.g. { hem: 4, fold: 0 }
  meta: Record<string, unknown>;
}

export function cutLine(pc: Piece): P[] {
  let { pts, tags } = pc.outline.taggedPoints();
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  return offsetPolygon(
    pts,
    tags.map((t) => pc.allowances[t] ?? pc.seamAllowance),
  );
}

export function bounds(pc: Piece): [number, number, number, number] {
  const pts = [...cutLine(pc), ...pc.outline.points()];
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
