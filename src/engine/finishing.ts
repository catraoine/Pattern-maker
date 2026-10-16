// The pieces that finish a garment beyond its block: a printed waistband, lining and facings.
import { P, Path, add, intersect, len, lerp, mul, p, sub, unit } from './geometry';
import { Piece } from './piece';
import { WAISTBAND_CM } from './skirt';
import type { SkirtDraft } from './skirt';

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * The waistband as a printed piece, standing upright: the long edge on the right is sewn to the skirt,
 * the one on the left turns under inside, and it folds along the middle. It runs from centre back to
 * centre back, ending flush with the invisible zip, and is cut on the lengthwise grain so it won't stretch.
 */
export function waistbandPiece(draft: SkirtDraft, sa: number): Piece {
  const W = 2 * WAISTBAND_CM;
  const L = draft.finishedWaist;
  const backQ = draft.waistband.sideMark - sa;
  const outline = new Path(p(0, 0)).line(p(W, 0), 'end').line(p(W, L), 'waist').line(p(0, L), 'end').line(p(0, 0), 'band');
  outline.closed = true;
  const marks = [backQ, L / 2, L - backQ];
  const notches: [P, P][] = marks.flatMap((y): [P, P][] => [
    [p(W, y), p(1, 0)],
    [p(0, y), p(-1, 0)],
  ]);
  // Hook and eye positions, on the outer half at each end, just clear of the zip.
  const cross = (at: P) => [new Path(add(at, p(-0.4, 0))).line(add(at, p(0.4, 0))), new Path(add(at, p(0, -0.4))).line(add(at, p(0, 0.4)))];
  const hook = p(W * 0.75, 1.2);
  const eye = p(W * 0.75, L - 1.2);
  const tag = (at: P, text: string) => ({ at, text, size: 0.55, rotate: 90 });
  const cut = 'Cut 1';
  return {
    name: 'Waistband',
    kind: 'waistband',
    outline,
    lines: [...cross(hook), ...cross(eye)],
    grain: [p(W * 0.25, 5.5), p(W * 0.25, Math.max(10, backQ - 4))],
    notches,
    balance: [{ pts: [p(W / 2, 0), p(W / 2, L)], label: 'FOLD LINE' }],
    labels: [
      // Name between the centre front and the second side seam; seam marks along the inner edge.
      { at: p(W * 0.62, (L / 2 + L - backQ) / 2), text: 'WAISTBAND', size: 1.0, rotate: 90 },
      { at: p(W * 0.5, (L / 2 + L - backQ) / 2), text: cut, size: 0.6, rotate: 90 },
      tag(p(W * 0.2, L / 2 - 3), 'CENTRE FRONT'),
      tag(p(W * 0.2, backQ + 2.6), 'SIDE SEAM'),
      tag(p(W * 0.2, L - backQ - 2.6), 'SIDE SEAM'),
      tag(add(hook, p(-0.9, 1.8)), 'HOOK'),
      tag(add(eye, p(-0.9, -1.4)), 'EYE'),
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: sa,
    allowances: {},
    meta: { finishedWidth: WAISTBAND_CM, lengthCm: r1(L) },
  };
}

/** Lining for a skirt, drafted 2.5 cm shorter so it never shows below the hem, with a narrow hem.
 * The darts are sewn as tucks, which gives the lining the ease to move over the skirt. */
export function liningPieces(lining: SkirtDraft): Piece[] {
  return lining.pieces.map((pc) => {
    const name = pc.name.replace(/^Skirt/, 'Lining');
    return {
      ...pc,
      name,
      kind: 'lining' as const,
      fabric: 'Lining',
      allowances: { ...pc.allowances, hem: Math.min(pc.allowances.hem ?? 2, 2) },
      labels: [
        ...pc.labels.map((l) => (l.text === pc.name.toUpperCase() ? { ...l, text: name.toUpperCase() } : l)),
        ...(pc.lines.length ? [{ at: add(pc.labels[0].at, p(0, -2.6)), text: 'SEW DARTS AS TUCKS', size: 0.6 }] : []),
      ],
      draft: undefined,
    };
  });
}

/** The longest unbroken run of edges carrying `tag`, as indices into a closed polyline's edges. */
function longestRun(tags: string[], tag: string): [number, number] | undefined {
  const n = tags.length;
  let best: [number, number] | undefined;
  for (let i = 0; i < n; i++) {
    if (tags[i] !== tag || tags[(i - 1 + n) % n] === tag) continue;
    let j = i;
    while (tags[(j + 1) % n] === tag && j - i < n) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
  }
  return best;
}

/**
 * A facing: a band following one edge of a piece (a neckline or armhole) inward by `width`, ending on
 * the seams either side, so it sews to the neighbouring facing the way the garment's seams sew. The
 * inner edge is neatened rather than seamed.
 */
export function facing(pc: Piece, tag: string, width: number, name: string): Piece | undefined {
  let { pts, tags } = pc.outline.taggedPoints(24);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  // Drop zero-length edges, so every direction is defined.
  const P2: P[] = [];
  const T2: string[] = [];
  pts.forEach((q, i) => {
    if (len(sub(pts[(i + 1) % pts.length], q)) > 1e-6) {
      P2.push(q);
      T2.push(tags[i] ?? tags[tags.length - 1]);
    }
  });
  const n = P2.length;
  const run = longestRun(T2, tag);
  if (!run) return undefined;
  const [a, b] = run;
  const at = (i: number) => P2[((i % n) + n) % n];
  const edge: P[] = [];
  for (let i = a; i <= b + 1; i++) edge.push(at(i));
  const before = T2[(a - 1 + n) % n];
  const after = T2[(b + 1) % n];

  // Offset each point square to the edge, into the piece: to the left of the outline's direction when
  // it runs anticlockwise (positive area), to the right otherwise.
  let area = 0;
  for (let i = 0; i < n; i++) area += P2[i].x * at(i + 1).y - at(i + 1).x * P2[i].y;
  const side = area > 0 ? 1 : -1;
  const inner = edge.map((q, i) => {
    const t = unit(sub(edge[Math.min(i + 1, edge.length - 1)], edge[Math.max(i - 1, 0)]));
    return add(q, mul(p(-t.y * side, t.x * side), width));
  });
  // End the inner edge on the seams either side (the shoulder, the fold, the side seam).
  const snap = (end: P, next: P, from: P, along: P) => {
    const hit = intersect(end, unit(sub(end, next)), from, along);
    return hit && len(sub(hit, end)) < width ? hit : end;
  };
  const m = inner.length - 1;
  inner[0] = snap(inner[0], inner[1], edge[0], unit(sub(at(a - 1), at(a))));
  inner[m] = snap(inner[m], inner[m - 1], edge[m], unit(sub(at(b + 2), at(b + 1))));

  // Follow the garment's own seam (it may curve, like a side seam swinging out to the bust) for as far
  // as the band reaches, so the facings sew together exactly as the garment does.
  const walk = (from: number, dir: 1 | -1, dist: number): P[] => {
    const out: P[] = [];
    let acc = 0;
    for (let i = from, k = 0; k < n; i += dir, k++) {
      const q0 = at(i);
      const q1 = at(i + dir);
      const l = len(sub(q1, q0));
      if (acc + l >= dist) {
        out.push(lerp(q0, q1, l ? (dist - acc) / l : 0));
        break;
      }
      out.push(q1);
      acc += l;
    }
    return out;
  };
  const tail = walk(b + 1, 1, len(sub(inner[m], edge[m])));
  const head = walk(a, -1, len(sub(inner[0], edge[0])));
  inner[m] = tail[tail.length - 1];
  inner[0] = head[head.length - 1];

  const outline = new Path(edge[0]);
  edge.slice(1).forEach((q) => outline.line(q, tag));
  tail.forEach((q) => outline.line(q, after));
  [...inner].reverse().slice(1).forEach((q) => outline.line(q, 'facing'));
  [...head].reverse().slice(1).forEach((q) => outline.line(q, before));
  outline.line(edge[0], before);
  outline.closed = true;

  // Name in the middle of the band, the grain arrow a quarter of the way along, clear of it.
  const along: number[] = [0];
  for (let i = 1; i < edge.length; i++) along.push(along[i - 1] + len(sub(edge[i], edge[i - 1])));
  const atShare = (f: number) => Math.max(1, Math.min(m - 1, along.findIndex((d) => d >= f * along[m])));
  // Keep the grain arrow away from a fold or centre seam end, where the fold marking goes.
  const fromCentre = before === 'fold' || before === 'centre';
  const mid = atShare(fromCentre ? 0.45 : 0.55);
  const centre = mul(add(edge[mid], inner[mid]), 0.5);
  const qi = atShare(fromCentre ? 0.88 : 0.15);
  const grainAt = mul(add(edge[qi], inner[qi]), 0.5);
  const t = unit(sub(edge[Math.min(mid + 1, m)], edge[Math.max(mid - 1, 0)]));
  let rotate = (Math.atan2(t.y, t.x) * 180) / Math.PI;
  if (rotate > 90) rotate -= 180;
  if (rotate <= -90) rotate += 180;
  const onFold = before === 'fold' || after === 'fold';
  const cut = onFold ? 'Cut 1 on fold' : 'Cut 2 (1 pair)';
  const foldAt = before === 'fold' ? [edge[0], inner[0]] : [edge[m], inner[m]];
  const near = (q: P) => edge.some((e, i) => i < m && distToSeg(q, e, edge[i + 1]) < 0.05);
  // Grain runs the same way as the garment piece's.
  const g = pc.grain ? unit(sub(pc.grain[1], pc.grain[0])) : p(0, 1);
  const gl = Math.min(4, width * 0.7);
  return {
    name,
    kind: 'facing',
    outline,
    lines: [],
    grain: [sub(grainAt, mul(g, gl / 2)), add(grainAt, mul(g, gl / 2))],
    fold: onFold ? ([foldAt[0], foldAt[1]].sort((u, v) => u.y - v.y) as [P, P]) : undefined,
    notches: pc.notches.filter(([q]) => near(q)),
    labels: [
      // Name above the middle of the band, the information line below it (see layout).
      { at: add(centre, mul(p(Math.sin((rotate * Math.PI) / 180), -Math.cos((rotate * Math.PI) / 180)), 0.4)), text: name.toUpperCase(), size: 0.65, rotate },
      { at: centre, text: cut, size: 0.5, rotate },
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: pc.seamAllowance,
    allowances: { ...pc.allowances, facing: 0 },
    meta: {},
  };
}

function distToSeg(q: P, a: P, b: P): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
  return len(sub(q, add(a, mul(ab, t))));
}

/** Neck and armhole facings: 5 cm at the neck, 4 cm at the armholes. With sleeves, the neck facings only. */
export function bodiceFacings(front: Piece, back: Piece, armholes = true): Piece[] {
  return [
    facing(front, 'neck', 5, 'Front neck facing'),
    facing(back, 'neck', 5, 'Back neck facing'),
    ...(armholes ? [facing(front, 'armhole', 4, 'Front armhole facing'), facing(back, 'armhole', 4, 'Back armhole facing')] : []),
  ].filter((pc): pc is Piece => !!pc);
}
