// A pattern piece: a stitching-line outline plus markings, ready for export.
import { P, Path, len, offsetPolygon, sub } from './geometry';

export interface Label {
  at: P;
  text: string;
  size: number; // cm
  /** Degrees clockwise, for labels that run along a narrow piece. */
  rotate?: number;
}

/** A numbered point of the draft, with how it was found, for the atelier view. */
export interface DraftPoint {
  n: string;
  at: P;
  note: string;
}

export interface Piece {
  name: string;
  outline: Path; // closed stitching line
  lines: Path[]; // darts and other internal lines
  grain?: [P, P];
  fold?: [P, P]; // place-on-fold edge
  notches: [P, P][]; // point, direction into the seam allowance
  /** Balance lines (hip, underarm) drawn across the piece, so a cutter can check it hangs level. */
  balance?: { pts: P[]; label: string }[];
  labels: Label[];
  cut: string;
  /** What it is cut from, when not just the garment fabric (lining, interfacing). */
  fabric?: string;
  /** Pieces beyond the garment's own block: its lining, facings, waistband and pockets. */
  kind?: 'lining' | 'facing' | 'waistband' | 'band' | 'collar' | 'pocket';
  /** How the piece was drafted: the frame and the numbered points, shown in the atelier view. */
  draft?: { frame: P[][]; points: DraftPoint[] };
  /** A second stitching line for one side of the body where it differs from the other (a lower
   * shoulder, a higher hip), cut by trimming that side. Drawn only where it leaves the main line. */
  alternate?: { outline: Path; label: string };
  seamAllowance: number;
  /** The cutting line exactly as a pattern file gave it, for a piece read from other software: its
   * allowances are whatever that file drew, so they are kept rather than worked out again. */
  cutOutline?: P[];
  allowances: Record<string, number>; // per edge tag, e.g. { hem: 4, fold: 0 }
  meta: Record<string, unknown>;
  /** Finished measurement marks for the printed pattern: a bullseye at the level, and its words under it. */
  finished?: FinishedMark[];
}

/** The size of a finished mark's title, in cm; the body and ease under it are a little smaller. */
export const MARK_TEXT = 0.42;

/** "FINISHED BUST 99 CM" over "YOU 92 · EASE +7", at the bust line, as the pattern houses mark it. */
export interface FinishedMark {
  at: P;
  title: string;
  note: string;
  /** The words over the mark rather than under it: a top's waist, near its lower edge. */
  above?: boolean;
}

export function cutLine(pc: Piece, outline: Path = pc.outline): P[] {
  if (pc.cutOutline && outline === pc.outline) return [...pc.cutOutline];
  let { pts, tags } = outline.taggedPoints();
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  return offsetPolygon(
    pts,
    tags.map((t) => pc.allowances[t] ?? pc.seamAllowance),
  );
}

export function bounds(pc: Piece): [number, number, number, number] {
  const pts = [...cutLine(pc), ...pc.outline.points(), ...(pc.alternate ? cutLine(pc, pc.alternate.outline) : [])];
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** The piece with a second stitching line for one side of the body. */
export function withAlternate(pc: Piece, outline: Path, label: string): Piece {
  return { ...pc, alternate: { outline, label } };
}
