// Laying one version of a pattern over another, the way a cutter overlays two card patterns: every
// edge that changed is found and measured, in millimetres, so the change can be written on it.
import { P, Path, len, sub } from './geometry';
import type { Piece } from './piece';

/** An edge's name in a cutter's words, from its tag. */
const EDGE_WORDS: Record<string, string> = {
  side: 'side seam',
  waist: 'waist',
  hem: 'hem',
  centre: 'centre seam',
  fold: 'fold',
  dart: 'dart',
  neck: 'neckline',
  shoulder: 'shoulder',
  armhole: 'armhole',
  'sleeve-front': 'front sleeve head',
  'sleeve-back': 'back sleeve head',
  seam: 'underarm seam',
  princess: 'princess seam',
  opening: 'front edge',
  'opening-neck': 'neckline',
  'opening-hem': 'hem',
  collar: 'collar edge',
  stand: 'stand edge',
  crotch: 'crotch seam',
  inseam: 'inside leg',
  fly: 'fly edge',
};

export const edgeWords = (tag: string) => EDGE_WORDS[tag] ?? (tag || 'edge');

/** One run of an outline: consecutive points along edges with the same tag. */
export interface Run {
  tag: string;
  /** Which run of this tag, in order round the outline (a side seam broken by a dart is two). */
  nth: number;
  pts: P[];
  length: number;
}

const polyLength = (pts: P[]) => pts.slice(1).reduce((t, q, i) => t + len(sub(q, pts[i])), 0);

/** The outline split into runs, one per stretch of edge with the same tag. */
export function runsOf(path: Path, steps = 24): Run[] {
  const { pts, tags } = path.taggedPoints(steps);
  const runs: Run[] = [];
  const seen: Record<string, number> = {};
  let i = 0;
  while (i < tags.length) {
    const tag = tags[i];
    let j = i;
    while (j + 1 < tags.length && tags[j + 1] === tag) j++;
    const run = pts.slice(i, j + 2);
    // A closed outline that starts part way along an edge: the last run joins the first.
    if (j === tags.length - 1 && runs.length && runs[0].tag === tag && runs[0].nth === 0 && i > 0) {
      runs[0].pts = [...run, ...runs[0].pts.slice(1)];
      runs[0].length = polyLength(runs[0].pts);
    } else {
      seen[tag] = (seen[tag] ?? -1) + 1;
      runs.push({ tag, nth: seen[tag], pts: run, length: polyLength(run) });
    }
    i = j + 1;
  }
  return runs;
}

/** The shortest distance from q to the polyline. */
export function distanceTo(q: P, pts: P[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const ab = sub(pts[i], a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
    best = Math.min(best, Math.hypot(q.x - (a.x + ab.x * t), q.y - (a.y + ab.y * t)));
  }
  return best;
}

/** A change to one edge, in millimetres. */
export interface EdgeChange {
  tag: string;
  nth: number;
  words: string;
  /** How much longer (positive) or shorter (negative) the edge is now. */
  lengthMm: number;
  /** How far the edge has moved at most, and where on the new edge that is. */
  movedMm: number;
  at: P;
}

export interface PieceChange {
  name: string;
  /** 'added' or 'removed' when the piece is only in one version. */
  status: 'changed' | 'same' | 'added' | 'removed';
  edges: EdgeChange[];
}

const mm = (cm: number) => Math.round(cm * 10);

/**
 * Lay version b over version a, piece by piece (matched by name) and edge by edge (matched by tag and
 * order round the outline). An edge counts as changed when it is a millimetre longer or shorter, or has
 * moved a millimetre anywhere along it.
 */
export function compareEdges(a: Piece[], b: Piece[]): PieceChange[] {
  const out: PieceChange[] = [];
  for (const pb of b) {
    const pa = a.find((x) => x.name === pb.name);
    if (!pa) {
      out.push({ name: pb.name, status: 'added', edges: [] });
      continue;
    }
    const ra = runsOf(pa.outline);
    const whole = pa.outline.points();
    const edges: EdgeChange[] = [];
    for (const run of runsOf(pb.outline)) {
      const was = ra.find((r) => r.tag === run.tag && r.nth === run.nth);
      let movedMm = 0;
      let at = run.pts[Math.floor(run.pts.length / 2)];
      for (const q of run.pts) {
        // Compare with the same edge where it still exists, so a moved edge isn't measured to its neighbour.
        const d = mm(distanceTo(q, was ? was.pts : whole));
        if (d > movedMm) {
          movedMm = d;
          at = q;
        }
      }
      const lengthMm = was ? mm(run.length - was.length) : mm(run.length);
      if (Math.abs(lengthMm) >= 1 || movedMm >= 1) edges.push({ tag: run.tag, nth: run.nth, words: edgeWords(run.tag), lengthMm, movedMm, at });
    }
    out.push({ name: pb.name, status: edges.length ? 'changed' : 'same', edges });
  }
  for (const pa of a) if (!b.some((x) => x.name === pa.name)) out.push({ name: pa.name, status: 'removed', edges: [] });
  return out;
}

/** An edge's change in a few words, such as "side seam 6 mm longer, moved 4 mm". */
export function changeWords(e: EdgeChange): string {
  const l = e.lengthMm === 0 ? 'same length' : `${Math.abs(e.lengthMm)} mm ${e.lengthMm > 0 ? 'longer' : 'shorter'}`;
  return `${e.words} ${l}${e.movedMm >= 1 ? `, moved ${e.movedMm} mm` : ''}`;
}

/** The short label written on the edge: the length change, or the movement where the length held. */
export function changeLabel(e: EdgeChange): string {
  if (Math.abs(e.lengthMm) >= 1) return `${e.lengthMm > 0 ? '+' : '−'}${Math.abs(e.lengthMm)} mm`;
  return `↔ ${e.movedMm} mm`;
}
