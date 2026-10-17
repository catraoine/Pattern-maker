// Professional pattern markings worked out from a piece: drill holes and notches for darts, notch
// positions trimmed to the seam allowance, and edge labels naming each seam and its allowance.
import { P, add, len, lerp, mul, p, sub, unit } from './geometry';
import { Piece } from './piece';

/** How deep a notch is cut into the seam allowance, the industry 6 mm. */
export const NOTCH_DEPTH = 0.6;
/** Drill holes sit 1 cm short of a dart point, inside the dart, so they never show on the garment. */
export const DRILL_INSET = 1;

export interface DartLine {
  near: P;
  tip: P;
  far: P;
}

/** Dart lines are drawn leg end, point, leg end; anything else (a bust point cross) is not a dart. */
export function dartsOf(pc: Piece): DartLine[] {
  return pc.lines
    .map((ln) => ln.points())
    .filter((pts) => pts.length === 3)
    .map(([near, tip, far]) => ({ near, tip, far }));
}

export function drillHoles(pc: Piece): P[] {
  const darts = dartsOf(pc).map(({ near, tip, far }) => add(tip, mul(unit(sub(lerp(near, far, 0.5), tip)), DRILL_INSET)));
  // Fish-eye darts (top, side, bottom, side, back to the top) get a drill hole inside each point.
  const fishEyes = pc.lines
    .map((ln) => ln.points())
    .filter((pts) => pts.length === 5 && len(sub(pts[0], pts[4])) < 1e-6)
    .flatMap(([top, , bottom]) => {
      const u = unit(sub(bottom, top));
      return [add(top, mul(u, DRILL_INSET)), sub(bottom, mul(u, DRILL_INSET))];
    });
  // Points marked on the piece itself, such as the point of a godet's slash.
  const marked = (pc.meta.drills as P[] | undefined) ?? [];
  return [...darts, ...fishEyes, ...marked];
}

/** Every notch on the piece: its own balance notches plus one at each dart leg, pointing out of the piece. */
export function allNotches(pc: Piece): [P, P][] {
  const legs = dartsOf(pc).flatMap(({ near, tip, far }): [P, P][] => [
    [near, unit(sub(near, tip))],
    [far, unit(sub(far, tip))],
  ]);
  return [...pc.notches, ...legs];
}

/** The seam allowance on the edge nearest a point of the stitching line. */
export function allowanceAt(pc: Piece, at: P): number {
  const { pts, tags } = pc.outline.taggedPoints(12);
  let best = Infinity;
  let tag = '';
  for (let i = 0; i < tags.length; i++) {
    const d = distToSeg(at, pts[i], pts[i + 1]);
    if (d < best) {
      best = d;
      tag = tags[i];
    }
  }
  return pc.allowances[tag] ?? pc.seamAllowance;
}

/** A notch as a slit cut in from the cutting line, 6 mm deep (less on a narrow allowance). */
export function notchSlit(pc: Piece, at: P, dir: P): [P, P] {
  const sa = allowanceAt(pc, at);
  const u = unit(dir);
  return [add(at, mul(u, sa)), add(at, mul(u, Math.max(sa - NOTCH_DEPTH, sa * 0.4)))];
}

function distToSeg(q: P, a: P, b: P): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
  return len(sub(q, add(a, mul(ab, t))));
}

export function insidePolygon(q: P, pts: P[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface EdgeLabel {
  at: P;
  text: string;
  rotate: number; // degrees, clockwise
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** Seam names written along the inside of each edge, with the allowance cut beyond it. */
export function edgeLabels(pc: Piece): EdgeLabel[] {
  const front = /front/i.test(pc.name);
  const names: Record<string, string> = {
    waist: 'WAIST',
    hem: 'HEM',
    side: 'SIDE SEAM',
    shoulder: 'SHOULDER',
    neck: 'NECKLINE',
    armhole: 'ARMHOLE',
    centre: front ? 'CENTRE FRONT SEAM' : 'CENTRE BACK SEAM',
    fold: front ? 'CENTRE FRONT' : 'CENTRE BACK',
    facing: 'NEATEN THIS EDGE',
    flounce: 'FLOUNCE SEAM',
    tier: 'TIER SEAM',
    panel: 'PANEL SEAM',
    godet: 'GODET SEAM',
    'pocket-side': 'SIDE SEAM',
    'pocket-edge': 'POCKET OPENING',
  };
  const { pts, tags } = pc.outline.taggedPoints(24);
  // Longest unbroken run of each tag.
  const runs = new Map<string, [number, number, number]>(); // tag -> [first edge, last edge, length]
  let i = 0;
  while (i < tags.length) {
    let j = i;
    let l = 0;
    while (j < tags.length && tags[j] === tags[i]) {
      l += len(sub(pts[j + 1], pts[j]));
      j++;
    }
    const prev = runs.get(tags[i]);
    if (!prev || prev[2] < l) runs.set(tags[i], [i, j - 1, l]);
    i = j;
  }
  const out: EdgeLabel[] = [];
  for (const [tag, [a, b, l]] of runs) {
    if (!names[tag] || l < 6) continue;
    // Centre lines carry the grain or fold arrow at their middle, so their label sits further along.
    const target = l * (tag === 'fold' || tag === 'centre' ? 0.18 : 0.5);
    let acc = 0;
    for (let k = a; k <= b; k++) {
      const seg = len(sub(pts[k + 1], pts[k]));
      if (acc + seg < target && k < b) {
        acc += seg;
        continue;
      }
      const mid = lerp(pts[k], pts[k + 1], seg ? (target - acc) / seg : 0);
      // Direction along the edge here, smoothed over the neighbouring points without crossing a corner.
      const u = unit(sub(pts[Math.min(k + 2, b + 1)], pts[Math.max(k - 1, a)]));
      let n = p(-u.y, u.x);
      if (!insidePolygon(add(mid, mul(n, 0.6)), pts)) n = mul(n, -1);
      let rotate = (Math.atan2(u.y, u.x) * 180) / Math.PI;
      if (rotate > 90) rotate -= 180;
      if (rotate <= -90) rotate += 180;
      const sa = tag === 'fold' || tag === 'facing' ? 0 : (pc.allowances[tag] ?? pc.seamAllowance);
      out.push({ at: add(mid, mul(n, 1.1)), text: sa ? `${names[tag]} · ${fmt(sa)} CM ALLOWANCE` : names[tag], rotate });
      break;
    }
  }
  return out;
}
