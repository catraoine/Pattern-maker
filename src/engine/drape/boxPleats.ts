// Box pleats as they look worn. Each box's two folds turn under and meet the next box's folds over a line (the
// meeting line); what shows from outside is a row of flat faces with a crisp fold edge either side of each meeting
// line. Below the stitching, on a flared skirt, the pleats open a little toward the hem (the hem is wider than the
// hip; the faces aren't), so at each meeting line a narrow dark V of the underlay shows between two lit fold edges.
// That V and those edges are what make box pleats read as pleats. The drawing before this stood each meeting line
// out as a ridge and sank and shaded the middle of every face: on a wide box pleat (Look 02's skirt, 12 cm faces) the
// pleats read as seam lines on a plain skirt and the dark bands down each face as more lines (Cat Nov 11: "Apply and
// make fixes").
import type { P } from '../geometry';

type BoxFold = { top: P; hip: P; hem: P };

/** Where a meeting line lies across the worn skirt at the level y: straight from the top of the pleat to the hem, as
 *  the mesh is cut (a line bent at the hip, carried across the piece, crossed the others above it). */
function foldX(f: BoxFold, y: number): number {
  return f.top.x + ((f.hem.x - f.top.x) * (y - f.top.y)) / (f.hem.y - f.top.y || 1);
}

/** The widest the V opens at the hem, cm each side. */
const MOST = 1;
/** The lit strip along each fold edge, cm. */
const EDGE = 0.45;

/** How far the V at the meeting lines is open each side at the hem: the room the skirt has gained across each face
 *  between the hip and the hem, shared between the two meeting lines either side of it. */
function hemHalfOpen(folds: BoxFold[]): number {
  const span = (k: 'hip' | 'hem') => (folds.length > 1 ? (folds[folds.length - 1][k].x - folds[0][k].x) / (folds.length - 1) : 2 * folds[0][k].x);
  return Math.min(MOST, Math.max(0, (span('hem') - span('hip')) / 2));
}

/** How far the V is open each side at the level y: nothing at the top of the pleat, opening evenly to the hem. (Even,
 *  so its edges are straight lines the mesh is cut along: each line is carried right across the piece, and lines that
 *  opened from the hip instead crossed each other above it, which drew dark wedges at the waist.) */
function boxHalfOpen(folds: BoxFold[], y: number): number {
  const f = folds[0];
  return Math.max(0, hemHalfOpen(folds) * ((y - f.top.y) / (f.hem.y - f.top.y || 1)));
}

/** A pleat within 5 cm of the side seam at its top or hem. */
function nearSide(f: BoxFold, hHem: number, side?: (y: number) => number): boolean {
  return !!side && (f.hem.x + hHem + EDGE > side(f.hem.y) - 5 || f.top.x + EDGE > side(f.top.y) - 5);
}

/** The lines the mesh is cut along, so the V's edges and the lit fold edges are crisp: each meeting line, the V's two
 *  edges, and the inner edges of the lit strips beside them, all from the top of the pleat to the hem. `side`: where
 *  the side seam is across the piece at a level. */
export function boxCreases(folds: BoxFold[], side?: (y: number) => number): [P, P][] {
  const hHem = hemHalfOpen(folds);
  const out: [P, P][] = [];
  for (const f of folds) {
    out.push([f.top, f.hem]);
    // (Not on a pleat within 5 cm of the side seam, on a small body: cut so close to it, the cloth along the
    // seam drew apart and the seam opened, 1 body in 41.)
    if (hHem < 0.2 || nearSide(f, hHem, side)) continue;
    for (const s of [-1, 1]) {
      out.push([f.top, { x: f.hem.x + s * hHem, y: f.hem.y }]);
      out.push([{ x: f.top.x + s * EDGE, y: f.top.y }, { x: f.hem.x + s * (hHem + EDGE), y: f.hem.y }]);
    }
  }
  return out;
}

/** For a point of the pleated piece (in its pattern, x across, y down) below the stitching: how far it is moved out
 *  from the body (in: below zero) and its shade (dark above zero, lit below). `side`: where the side seam is across the piece at a level. */
export function boxPoint(folds: BoxFold[], q: P, side?: (y: number) => number): { off: number; shade: number } {
  const hipY = folds[0].hip.y;
  // (Nothing moved at the side seam, so the front and back still meet along it; full 3 cm in from it.)
  const toSide = side ? side(q.y) - q.x : Infinity;
  const ramp = Math.min(1, (q.y - hipY + 4) / 8) * Math.min(1, Math.max(0, toSide / 3));
  let au = Infinity;
  let near: BoxFold = folds[0];
  for (const f of folds) {
    const a = Math.abs(q.x - foldX(f, q.y));
    if (a < au) [au, near] = [a, f];
  }
  // (A pleat by the side seam, which the mesh isn't cut along, is drawn as its fold line alone: its V shaded on the
  // mesh as it falls came out as a sawtooth.)
  if (nearSide(near, hemHalfOpen(folds), side)) return { off: 0, shade: 0 };
  const h = boxHalfOpen(folds, q.y);
  if (h > 0.05 && au <= h + 0.05) {
    // In the V: the underlay, set back behind the faces and in their shadow, deepest at the meeting line.
    const depth = Math.min(0.9, 0.25 + h * 0.6);
    return { off: -depth * ramp * (1 - Math.min(1, au / (h || 1)) * 0.6), shade: 0.85 * ramp };
  }
  // On a face: its pressed edge catches the light; the underlay folded in under the face for a pleat's depth or so
  // lifts it a touch at its edges, so the face rounds very slightly into its fold.
  const e = au - h;
  const lift = 0.25 * Math.max(0, 1 - e / 3) * ramp;
  // (Lit evenly fading off over a little more than the strip, not lit inside it and not past it: picked point by
  // point at its edge, the light came and went with the mesh and speckled the fold.)
  return { off: lift, shade: -0.3 * Math.max(0, 1 - e / (EDGE * 2.5)) * ramp };
}
