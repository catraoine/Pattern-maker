// Ruched sides: the side seams cut longer than the skirt (or top) and gathered back up on elastic, so the
// cloth scrunches into soft folds at the sides. The extra length is spread across the piece the way a
// patternmaker slashes and spreads it: nothing at the centre, all of it at the side seam, opening evenly
// down the ruched part. The hem then dips toward the side seams on the flat pattern, and hangs level once
// the elastic draws the side up.
import { P, Path, add, p } from './geometry';
import type { Piece } from './piece';
import type { SkirtDraft, SkirtStyle } from './skirt';
import type { SewStep } from './instructions';

const cm = (n: number) => `${Math.round(n * 10) / 10} cm`;

/** How much longer the side seam is cut than it finishes, over the ruched part. */
const RUCHE_RATIO = 1.5;

/** What a ruched draft records: where the ruching runs (cm below the waist, or the top's top), how much
 * longer the side is cut, the elastic, and the pieces before they were spread, for the drawings. */
export interface RucheDraft {
  from: number;
  to: number;
  extra: number;
  elastic: number;
  plain: Piece[];
}

/** Every point of a piece moved by `f`: its outline, inner lines, marks, labels and drafting points.
 * `path`, when given, moves the outline and lines in its place. */
function warpPiece(pc: Piece, f: (q: P) => P, path: (src: Path) => Path = (src) => mapPath(src, f)): Piece {
  return {
    ...pc,
    outline: path(pc.outline),
    lines: pc.lines.map(path),
    grain: pc.grain && [f(pc.grain[0]), f(pc.grain[1])],
    fold: pc.fold && [f(pc.fold[0]), f(pc.fold[1])],
    notches: pc.notches.map(([q, d]) => [f(q), d] as [P, P]),
    balance: pc.balance?.map((b) => ({ ...b, pts: b.pts.map(f) })),
    labels: pc.labels.map((l) => ({ ...l, at: f(l.at) })),
    draft: pc.draft && { frame: pc.draft.frame.map((run) => run.map(f)), points: pc.draft.points.map((d) => ({ ...d, at: f(d.at) })) },
    alternate: pc.alternate && { ...pc.alternate, outline: path(pc.alternate.outline) },
    cutOutline: undefined,
  };
}

function mapPath(src: Path, f: (q: P) => P): Path {
  const out = new Path(f(src.start));
  src.segs.forEach((s, i) => (s.kind === 'L' ? out.line(f(s.to), src.tags[i]) : out.curve(f(s.c1), f(s.c2), f(s.to), src.tags[i])));
  out.closed = src.closed;
  return out;
}

const mix = (a: P, b: P, t: number) => p(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/**
 * A path slashed straight across at height `y` and opened by `gap`: everything below drops by the gap,
 * and each edge that crossed the slash runs straight down across it. The edges either side keep their
 * shape and their corners, so the hem stays as drafted.
 */
function slashPath(src: Path, y: number, gap: number): Path {
  const below = (q: P) => q.y > y + 1e-6;
  const drop = (q: P) => (below(q) ? add(q, p(0, gap)) : q);
  const out = new Path(drop(src.start));
  let cur = src.start;
  src.segs.forEach((s, i) => {
    const tag = src.tags[i];
    if (below(cur) === below(s.to)) {
      if (s.kind === 'L') out.line(drop(s.to), tag);
      else {
        const d = below(s.to) ? (q: P) => add(q, p(0, gap)) : (q: P) => q;
        out.curve(d(s.c1), d(s.c2), d(s.to), tag);
      }
    } else if (s.kind === 'L') {
      const t = (y - cur.y) / (s.to.y - cur.y);
      const at = mix(cur, s.to, t);
      const [first, second] = below(cur) ? [add(at, p(0, gap)), at] : [at, add(at, p(0, gap))];
      out.line(first, tag).line(second, tag).line(drop(s.to), tag);
    } else {
      // Split the curve where it crosses, by bisection on its height.
      const bez = (t: number) => {
        const mt = 1 - t;
        return p(
          mt ** 3 * cur.x + 3 * mt ** 2 * t * s.c1.x + 3 * mt * t ** 2 * s.c2.x + t ** 3 * s.to.x,
          mt ** 3 * cur.y + 3 * mt ** 2 * t * s.c1.y + 3 * mt * t ** 2 * s.c2.y + t ** 3 * s.to.y,
        );
      };
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (below(bez(m)) === below(cur)) lo = m;
        else hi = m;
      }
      const t = (lo + hi) / 2;
      const a1 = mix(cur, s.c1, t);
      const a2 = mix(s.c1, s.c2, t);
      const a3 = mix(s.c2, s.to, t);
      const b1 = mix(a1, a2, t);
      const b2 = mix(a2, a3, t);
      const at = mix(b1, b2, t);
      const [d1, d2] = below(cur) ? [(q: P) => add(q, p(0, gap)), (q: P) => q] : [(q: P) => q, (q: P) => add(q, p(0, gap))];
      out.curve(d1(a1), d1(b1), d1(at), tag).line(d2(at), tag).curve(d2(b2), d2(a3), d2(s.to), tag);
    }
    cur = s.to;
  });
  out.closed = src.closed;
  return out;
}

/**
 * The piece lengthened for ruching: slashed straight across at `from` and opened by `extra`, so the
 * side seams are that much longer below the slash, the hem keeps its shape and the darts above are
 * untouched. Gathered up at the side seams, the extra falls into soft folds that run in from the sides.
 */
export function spread(pc: Piece, from: number, extra: number): Piece {
  const out = warpPiece(pc, (q) => (q.y > from ? add(q, p(0, extra)) : q), (src) => slashPath(src, from, extra));
  // A notch on the side seam where the ruching starts, so the elastic is put on from there.
  const pts = out.outline.points(24);
  const xs = Math.max(...pts.map((q) => Math.abs(q.x)));
  const top = pts.reduce<P | undefined>((best, q) => (Math.abs(q.y - from) < 0.5 && Math.abs(q.x) > xs * 0.8 && (!best || Math.abs(q.x) > Math.abs(best.x)) ? q : best), undefined);
  return top ? { ...out, notches: [...out.notches, [top, p(Math.sign(top.x) || 1, 0)]] } : out;
}

/** The elastic for one side seam: the ruched part's finished length, less a little so it draws up firmly. */
const elasticFor = (from: number, to: number) => Math.round((to - from) * 0.95);

/** Ruching goes on a straight or pencil skirt with plain side seams: no pleats, godets or flounce, no
 * shaped or uneven hem, no pocket, slit or zip in the side seam, and not wrapped. */
export function rucheAllowed(s: Partial<SkirtStyle>): boolean {
  if (s.silhouette !== 'straight' && s.silhouette !== 'pencil') return false;
  if (s.pleats && s.pleats !== 'none') return false;
  if (s.godets) return false;
  if (s.flounce && s.flounce !== 'none') return false;
  return !s.asymHem && !s.hem && !s.wrap && s.pockets !== 'inseam' && s.slit !== 'side' && s.zip !== 'side';
}

/**
 * A skirt ruched at the sides, from just below the hip to the hem, front and back spread alike so the
 * side seams still match. Too short a skirt (under 15 cm below the hip) stays plain.
 */
export function withRuche(draft: SkirtDraft, s: SkirtStyle, m: { waist_to_hip: number }): SkirtDraft {
  if (!s.ruched || !rucheAllowed(s) || draft.volume || draft.circleShare || draft.halves) return draft;
  const r = rucheFor(m.waist_to_hip, draft.lengthCm);
  if (!r) return draft;
  const [f, b, ...rest] = draft.pieces;
  return { ...draft, pieces: [spread(f, r.from, r.extra), spread(b, r.from, r.extra), ...rest], ruche: { ...r, plain: [f, b] } };
}

/** Where the ruching runs, below the waist: from just under the hip to the hem, and how much longer the
 * side is cut. None when under 15 cm of skirt is left below the hip. */
export function rucheFor(waistToHip: number, length: number): Omit<RucheDraft, 'plain'> | undefined {
  const from = Math.round(waistToHip + 2);
  if (!(length - from >= 15)) return undefined;
  return { from, to: length, extra: Math.round((RUCHE_RATIO - 1) * (length - from) * 10) / 10, elastic: elasticFor(from, length) };
}

/** The elastic to buy: two lengths, one for each side seam, and a little over. */
export const rucheNotion = (r: Pick<RucheDraft, 'elastic'>) => `${((2 * r.elastic + 10) / 100).toFixed(1)} m of 6 mm clear elastic, for the ruching`;

/** The ruching, sewn once the side seams are sewn and the hem is turned up. */
export function rucheSteps(steps: SewStep[], r: RucheDraft | undefined, garment: 'skirt' | 'dress' = 'skirt'): SewStep[] {
  if (!r) return steps;
  const out = [...steps];
  const i = out.findIndex((s) => s.title === 'Finish');
  out.splice(i >= 0 ? i : out.length, 0, {
    title: 'Ruche the sides',
    text: `Cut two lengths of 6 mm clear elastic, each ${r.elastic} cm. On the inside, press each side seam allowance toward the back. Lay the elastic on the allowance, close to the stitching, from the ruching notch ${cm(r.from)} below the waist down to the hem's fold, and pin both ends. Zigzag it on through the seam allowance only, stretching it as you go so it lies flat: the ${r.extra} cm of extra length in each side seam gathers up as it relaxes. Spread the folds evenly across the ${garment} with your fingers and steam them lightly from a distance, without pressing them flat.`,
  });
  return out;
}
