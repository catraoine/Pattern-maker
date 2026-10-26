// The bias-cut slip skirt, after the slips Madeleine Vionnet cut in the 1930s, and the pieces cut
// whole that it shares with a diagonal hem.
//
// Cloth cut on the bias gives and moulds to the body, so the slip has no darts. It is drafted from
// the skirt block with less hip ease: its side seams take as much of the waist shaping as they can
// (half of it at least, up to 4 cm a side), and what is left goes into one dart a piece, drawn on
// down to the hip line and closed there, pivoting on the hip line. That keeps the hip at its
// measurement and opens the hem into a slight flare. Every piece is cut whole, single layer, with its
// grain at 45 degrees: a fold would lie on the straight grain, not on the bias. The zip goes in the
// left side seam, as there is no centre back seam, and the waist is finished with a narrow facing.
// The hem allowance carries 2 cm spare, so the hem can be levelled after the skirt has hung.
import { P, Path, add, intersect, len, mul, p, sub, taggedLength, unit } from './geometry';
import { Piece, withAlternate } from './piece';
import { planFor, planShape, shapeAsymHems } from './asymHem';
import type { SkirtDraft, SkirtMeasurements, SkirtStyle } from './skirt';
// Used only when drafting, so the two modules can import each other.
import { raisedWaist } from './skirt';

/** A slip takes 3 cm less hip ease than a skirt on the straight grain: the bias gives round the hip. */
export const SLIP_HIP_EASE_LESS = 3;
/** Most of the waist shaping a slip's side seams take, each side, in cm. */
const SLIP_SIDE_MAX = 4;
/** The slip's hem allowance: 1 cm for a narrow rolled hem and 2 cm spare to level it. */
export const SLIP_HEM = 3;
export const SLIP_LEVEL = 2;
/** The faced waist of a slip, in cm deep. */
export const SLIP_FACING = 5;

const cm = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} cm`;
const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI * 10) / 10} degrees`;

/** The waist shaping each side seam takes: at least half the smaller of front and back, up to 4 cm. */
export function slipSideSupp(front: number, back: number): number {
  const least = Math.max(0, Math.min(front, back));
  return Math.min(least, Math.max(least / 2, SLIP_SIDE_MAX));
}

/** The slip's length is knee, midi or maxi: it needs room below the hip to hang and swing. */
const SLIP_LENGTHS = ['knee', 'midi', 'maxi'] as const;

/**
 * Whether a skirt choice goes with the rest: a slip needs at least knee length; a diagonal hem needs
 * its pieces cut whole, so not on a circle (too wide to cut whole), nor where a walking slit needs a
 * centre back seam, nor on a dress, whose zip runs down the centre back.
 */
export function cutAllowed(c: { silhouette: string; length: string }, id: 'silhouette' | 'length' | 'asymHem', opt: string, garment: 'skirt' | 'dress' = 'skirt'): boolean {
  if (id === 'silhouette' && opt === 'slip') return (SLIP_LENGTHS as readonly string[]).includes(c.length);
  if (id === 'length' && c.silhouette === 'slip') return (SLIP_LENGTHS as readonly string[]).includes(opt);
  // A gathered skirt's hem is the straight edge of its panels: level, or drawn by hand.
  if (id === 'asymHem' && opt !== 'none' && c.silhouette === 'gathered') return false;
  if (id === 'silhouette' && opt === 'gathered') return true;
  if (id === 'asymHem' && opt === 'diagonal') {
    if (garment === 'dress') return false;
    const slit = c.silhouette === 'pencil' || (c.silhouette === 'straight' && (c.length === 'midi' || c.length === 'maxi'));
    return c.silhouette !== 'circle' && c.silhouette !== 'half_circle' && !slit;
  }
  return true;
}

/** The choices made valid: a slip at least knee length, a diagonal hem only where it can be cut. */
export function validCut<T extends { silhouette: SkirtStyle['silhouette']; length: SkirtStyle['length']; asymHem?: SkirtStyle['asymHem']; joinTo?: unknown; waist?: SkirtStyle['waist']; pleats?: SkirtStyle['pleats'] }>(c: T): T {
  let out = c;
  if (out.silhouette === 'slip' && !(SLIP_LENGTHS as readonly string[]).includes(out.length)) out = { ...out, length: 'knee' };
  if (out.asymHem && out.asymHem !== 'none' && !cutAllowed(out, 'asymHem', out.asymHem, out.joinTo ? 'dress' : 'skirt')) out = { ...out, asymHem: 'none' };
  if (out.waist === 'elastic' && !elasticCutAllowed(out)) out = { ...out, waist: 'band' };
  return out;
}

/** A pull-on elastic waist gathers a waist cut to the hip, so it needs a skirt cut in halves with its
 * waist free: not a bias slip (faced and zipped at the side), a diagonal hem (zipped at the side), or
 * pleats (which take the waist in themselves). */
export const elasticCutAllowed = (c: { silhouette: SkirtStyle['silhouette']; asymHem?: SkirtStyle['asymHem']; pleats?: SkirtStyle['pleats'] }) =>
  c.silhouette !== 'slip' && c.asymHem !== 'diagonal' && (c.pleats ?? 'none') === 'none';

/** Cut whole, single layer: a slip on the bias, or a diagonal hem that differs side to side. */
export const cutsWhole = (s: SkirtStyle) => s.silhouette === 'slip' || s.asymHem === 'diagonal';

const rotate = (q: P, about: P, a: number) => {
  const d = sub(q, about);
  return add(about, p(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)));
};

/**
 * Close a half piece's waist dart into the hem. The dart line is drawn on down to the hip line and the
 * piece slashed from there to the hem; the side part pivots on the hip line until the dart closes.
 * The hip keeps its width, the hem opens, and the waist and hem are drawn again as smooth curves,
 * square to the centre and to the side seam.
 */
export function closeToHem(pc: Piece, hipDepth: number): Piece {
  const o = pc.outline;
  const d0 = o.tags.indexOf('dart');
  const isFront = /front/i.test(pc.name);
  const centreTag = o.tags[o.tags.length - 1];
  const lastSide = o.tags.lastIndexOf('side');
  const firstSide = o.tags.indexOf('side');
  const startOf = (i: number) => (i === 0 ? o.start : o.segs[i - 1].to);

  let near: P | undefined;
  let theta = 0;
  let pivot = p(0, hipDepth);
  if (d0 > 0) {
    near = startOf(d0);
    const far = o.segs[d0 + 1].to;
    pivot = p((near.x + far.x) / 2, hipDepth);
    const a = sub(far, pivot);
    const b = sub(near, pivot);
    theta = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
  }
  const rot = (q: P) => rotate(q, pivot, theta);
  const turned = (s: Path['segs'][number]): Path['segs'][number] => (s.kind === 'L' ? { kind: 'L', to: rot(s.to) } : { kind: 'C', c1: rot(s.c1), c2: rot(s.c2), to: rot(s.to) });

  // The waist: centre to the near dart leg as drafted, then the side part turned.
  const cw = o.start;
  const left: P[] = [cw];
  const right: P[] = [];
  if (d0 > 0) {
    for (let i = 0; i < d0; i++) left.push(o.segs[i].to);
    for (let i = d0 + 1; i < firstSide; i++) right.push(rot(o.segs[i].to));
  } else {
    for (let i = 0; i < firstSide; i++) left.push(o.segs[i].to);
  }
  const side = o.segs.slice(firstSide, lastSide + 1).map(turned);
  const sw = right.length ? right[right.length - 1] : left[left.length - 1];
  const first = side[0];
  const downSide = unit(sub(first.kind === 'C' ? first.c1 : first.to, sw));
  const towardCentre = p(-downSide.y, downSide.x);

  const outline = new Path(cw);
  if (near && right.length) {
    // Smooth across the closed dart, the curve's direction there running from the waist before it to after it.
    const before = left[Math.max(0, left.length - 2)];
    const after = right[Math.min(right.length - 1, 1)];
    const tn = unit(sub(after, before));
    const k1 = len(sub(near, cw)) / 3;
    const k2 = len(sub(sw, near)) / 3;
    outline.curve(add(cw, p(k1, 0)), sub(near, mul(tn, k1)), near, 'waist');
    outline.curve(add(near, mul(tn, k2)), add(sw, mul(towardCentre, k2)), sw, 'waist');
  } else {
    left.slice(1).forEach((q) => outline.line(q, 'waist'));
  }
  side.forEach((s) => {
    if (s.kind === 'L') outline.line(s.to, 'side');
    else outline.curve(s.c1, s.c2, s.to, 'side');
  });

  // The hem: an arc centred on the centre line where the side seam, carried on up, crosses it, so it
  // meets the side seam and the centre square.
  const hs = side[side.length - 1].to;
  const prevSide = side.length > 1 ? side[side.length - 2].to : sw;
  const last = side[side.length - 1];
  const t = unit(sub(hs, last.kind === 'C' ? last.c2 : prevSide));
  const o0 = t.x > 1e-4 ? intersect(hs, t, p(0, 0), p(0, 1)) : null;
  let ch: P;
  if (o0 && hs.y - o0.y > 0) {
    const R = len(sub(hs, o0));
    ch = p(0, o0.y + R);
    const u = unit(sub(hs, o0));
    const angle = Math.acos(Math.min(1, u.y));
    const kk = (4 / 3) * Math.tan(angle / 4) * R;
    outline.curve(add(hs, mul(p(-u.y, u.x), kk)), add(ch, p(kk, 0)), ch, 'hem');
  } else {
    ch = p(0, hs.y);
    const k = hs.x * 0.35;
    outline.curve(add(hs, p(-k, 0)), add(ch, p(k, 0)), ch, 'hem');
  }
  outline.line(cw, centreTag);
  outline.closed = true;

  const hipQ = pc.draft!.points.find((q) => q.n === '3')!.at.x;
  const sh = rot(p(hipQ, hipDepth));
  // Notches on the side part turn with it.
  const notches = pc.notches.map(([q, d]): [P, P] => (q.x > pivot.x ? [rot(q), unit(sub(rot(add(q, d)), rot(q)))] : [q, d]));
  const closed = (pc.meta.dartsCm as number[] | undefined)?.[0] ?? 0;
  const length = ch.y;
  const flare = hs.x - hipQ;
  const draft = {
    frame: pc.draft!.frame,
    points: [
      ...pc.draft!.points.filter((q) => q.n === '0' || q.n === '1'),
      ...(near
        ? [
            {
              n: 'P',
              at: pivot,
              note: `Pivot on the hip line, ${cm(pivot.x)} from the centre: the ${cm(closed)} dart left after the side seam's shaping is drawn on down to here, and the piece slashed from here to the hem. Swing the side part on this point until the dart closes (${deg(Math.abs(theta))}): the hip keeps its width and the hem opens.`,
            },
          ]
        : []),
      { n: '2', at: ch, note: `Centre hem, ${cm(length)} below the waist line. The hem is an arc from the centre line, square to it and to the side seam.` },
      { n: '3', at: sh, note: 'Side hip, swung up with the side part. The side seam keeps its length, so front and back still match.' },
      {
        n: '4',
        at: sw,
        note: `Side waist: the side seam takes ${cm((pc.meta.sideSuppressionCm as number | undefined) ?? 0)} of the waist shaping. Draw the waist again as one smooth curve, square to the centre and to the side seam: there is no dart to sew.`,
      },
      { n: '5', at: hs, note: `Hem at the side: ${cm(Math.max(0, flare))} out from the hip, the slight flare that lets the bias swing.` },
    ],
  };
  return {
    ...pc,
    outline,
    lines: [],
    notches,
    balance: [{ pts: near ? [p(0, hipDepth), pivot, sh] : [p(0, hipDepth), sh], label: 'HIP LINE' }],
    draft,
    meta: { ...pc.meta, dartsCm: [], closedDartCm: Math.round(closed * 100) / 100, bias: true, isFront },
  };
}

function clonePath(src: Path): Path {
  const out = new Path(src.start);
  out.segs = src.segs.map((s) => ({ ...s }));
  out.tags = [...src.tags];
  out.closed = src.closed;
  return out;
}

const mirror = (q: P) => p(-q.x, q.y);

/** A half piece and its mirror, as one closed outline from the centre waist round. */
function mirrorOutline(o: Path): Path {
  const out = new Path(o.start);
  const n = o.segs.length - 1; // the last edge is the centre line, which disappears
  const startOf = (i: number) => (i === 0 ? o.start : o.segs[i - 1].to);
  for (let i = 0; i < n; i++) {
    out.segs.push({ ...o.segs[i] });
    out.tags.push(o.tags[i]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const s = o.segs[i];
    const to = mirror(startOf(i));
    if (s.kind === 'L') out.line(to, o.tags[i]);
    else out.curve(mirror(s.c2), mirror(s.c1), to, o.tags[i]);
  }
  out.closed = true;
  return out;
}

/** A half piece traced off and turned over along its centre line, for cutting whole, single layer. */
function wholePiece(pc: Piece): Piece {
  const outline = mirrorOutline(pc.outline);
  const lines = [...pc.lines, ...pc.lines.map((l) => {
    const pts = l.points(2);
    const out = new Path(mirror(pts[pts.length - 1]));
    for (let i = pts.length - 2; i >= 0; i--) out.line(mirror(pts[i]));
    return out;
  })];
  const notches: [P, P][] = pc.notches.filter(([q]) => q.x > 0.01).flatMap(([q, d]): [P, P][] => [[q, d], [mirror(q), mirror(d)]]);
  const balance = (pc.balance ?? []).map((b) => ({ ...b, pts: [...[...b.pts].reverse().map(mirror), ...b.pts.slice(1)] }));
  const labels = pc.labels.filter((l) => l.text !== 'ZIP ENDS').map((l) => ({ ...l, at: p(0, l.at.y) }));
  return {
    ...pc,
    outline,
    lines,
    notches,
    balance,
    labels,
    fold: undefined,
    draft: pc.draft && {
      frame: pc.draft.frame,
      points: [
        ...pc.draft.points,
        {
          n: 'W',
          at: p(0, pc.draft.points.find((q) => q.n === '1')?.at.y ?? 0),
          note: 'Whole piece: trace the half, turn the tracing over along the centre line from 0 to 2 and trace the other half, so the piece is cut whole, single layer.',
        },
      ],
    },
    meta: { ...pc.meta, whole: true },
  };
}

/** The waist raised `rise` cm at one side seam of a whole piece, easing in from nothing at the centre. */
function raisedHalf(pc: Piece, rise: number, plusX: boolean): Path {
  const { pts, tags } = pc.outline.taggedPoints();
  const n = pts.length - 1;
  const s0 = tags.indexOf('side');
  const e0 = tags.lastIndexOf('side') + 1;
  const run = plusX ? Array.from({ length: s0 + 1 }, (_, i) => i) : Array.from({ length: n - e0 + 1 }, (_, i) => n - i);
  const along = [0];
  for (let k = 1; k < run.length; k++) along.push(along[k - 1] + len(sub(pts[run[k]], pts[run[k - 1]])));
  const total = along[along.length - 1] || 1;
  const raised = pts.map((q) => q);
  run.forEach((i, k) => (raised[i] = add(pts[i], p(0, -rise * (along[k] / total) ** 2))));
  if (!plusX) raised[0] = raised[n];
  const out = new Path(raised[0]);
  for (let i = 1; i < raised.length; i++) out.line(raised[i], tags[i - 1]);
  out.closed = true;
  return out;
}

/** A point `dist` cm down a side seam from the waist, on the +x side or the -x side of a whole piece. */
function downSide(pc: Piece, dist: number, plusX: boolean): P {
  const { pts, tags } = pc.outline.taggedPoints(48);
  const idx = tags.map((t, i) => (t === 'side' ? i : -1)).filter((i) => i >= 0);
  const run = plusX ? idx.filter((i) => i <= tags.indexOf('hem')) : idx.filter((i) => i > tags.lastIndexOf('hem')).reverse();
  let acc = 0;
  for (const i of run) {
    const [a, b] = plusX ? [pts[i], pts[i + 1]] : [pts[i + 1], pts[i]];
    const l = len(sub(b, a));
    if (acc + l >= dist) return add(a, mul(sub(b, a), (dist - acc) / l));
    acc += l;
  }
  return plusX ? pts[run[run.length - 1] + 1] : pts[run[run.length - 1]];
}

const BIAS_GRAIN = 6; // half the grain arrow's run across, in cm

/**
 * The skirt cut whole. The front is mirrored into one whole piece; the back too, unless the skirt is a
 * dress's, when it stays a pair with the zip in the centre back seam. Then the asymmetric hem (if any)
 * is shaped round the whole skirt, the grain set (45 degrees on the bias), the zip moved to the left
 * side seam, and a higher hip raised on its own side only.
 */
export function cutWhole(draft: SkirtDraft, m: SkirtMeasurements, s: SkirtStyle): SkirtDraft {
  const dress = !!s.joinTo;
  const bias = s.silhouette === 'slip';
  const [fq, bq] = draft.pieces;
  const plan = planFor(s, m, draft.lengthCm);
  const front = wholePiece(fq);
  const back: Piece = dress ? { ...bq, outline: clonePath(bq.outline) } : wholePiece(bq);
  if (plan) shapeAsymHems(front, back, plan);
  const sides = plan?.kind === 'diagonal';
  const hipDepth = m.waist_to_hip;

  const finish = (pc: Piece): Piece => {
    const whole = !!pc.meta.whole;
    const cut = whole
      ? `Cut 1, single layer, ${bias ? 'on the bias' : 'right side up'}`
      : bias
        ? 'Cut 2 (1 pair), single layer, on the bias'
        : pc.cut;
    // The shortest point of the hem: grain lines stop well short of it.
    const { pts, tags } = pc.outline.taggedPoints(12);
    const bottom = Math.min(...pts.filter((_, i) => tags[i] === 'hem').map((q) => q.y));
    const mid = Math.max(hipDepth + 2 + BIAS_GRAIN, Math.min((hipDepth + bottom) / 2, bottom - 4 - BIAS_GRAIN));
    const gx = whole ? 0 : (pc.draft?.points.find((q) => q.n === '3')?.at.x ?? 20) * 0.45;
    // On the bias the grain runs at 45 degrees to the centre line, down toward the +x side.
    const grain: [P, P] | undefined = bias
      ? [p(gx - BIAS_GRAIN, mid - BIAS_GRAIN), p(gx + BIAS_GRAIN, mid + BIAS_GRAIN)]
      : whole && pc.grain
        ? [p(0, pc.grain[0].y), p(0, Math.max(pc.grain[0].y + 4, Math.min(pc.grain[1].y, bottom - 8)))]
        : pc.grain;
    const labels = pc.labels.map((l) => (l.text === pc.cut ? { ...l, text: cut } : l));
    return {
      ...pc,
      cut,
      grain,
      labels,
      // Cut single layer: through one layer only, the right side up when the two sides differ.
      meta: { ...pc.meta, bias, singleLayer: bias || whole, rightSideUp: sides && whole },
    };
  };
  let pieces = [finish(front), finish(back)];

  // The zip goes in the left side seam: on a front laid right side up that is the +x side; on a back, -x.
  const opening = dress ? 'centre_back' : 'left_side';
  if (!dress) {
    pieces = pieces.map((pc, i) => {
      const plusX = i === 0;
      const at = downSide(pc, draft.zipCm, plusX);
      const out = p(plusX ? 1 : -1, 0);
      return {
        ...pc,
        notches: [...pc.notches, [at, out] as [P, P]],
        labels: [...pc.labels, { at: add(at, p(plusX ? -3.6 : 3.6, 0.3)), text: 'ZIP ENDS', size: 0.7 }],
      };
    });
  }

  // A higher hip: on whole pieces only its own side is raised; on a pair, the one marked is trimmed.
  const high = s.fitting?.highHip;
  if (high && high.cm > 0) {
    const label = `${high.side.toUpperCase()} HIP`;
    pieces = pieces.map((pc, i) => {
      if (!pc.meta.whole) return withAlternate(pc, raisedWaist(pc, high.cm), label);
      const plusX = (i === 0) === (high.side === 'left');
      return withAlternate(pc, raisedHalf(pc, high.cm, plusX), label);
    });
  }

  const copies = (pc: Piece) => (pc.meta.whole ? 1 : 2);
  const hemCm = Math.round(pieces.reduce((t, pc) => t + copies(pc) * taggedLength(pc.outline, 'hem'), 0));
  // The half pieces as they hang, for the sketches: a high-low is the same both sides.
  const halves: [Piece, Piece] = [{ ...fq, outline: clonePath(fq.outline) }, { ...bq, outline: clonePath(bq.outline) }];
  if (plan?.kind === 'high_low') shapeAsymHems(halves[0], halves[1], plan);
  return {
    ...draft,
    pieces,
    halves,
    hemCm,
    bias: bias || undefined,
    opening,
    faced: bias && !dress ? true : undefined,
    asym: plan,
    hem: plan ? (plan.kind === 'high_low' ? planShape(plan) : undefined) : draft.hem,
  };
}
