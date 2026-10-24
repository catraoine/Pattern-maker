// A shirred back on a top cut below the shoulders (strapless, sweetheart or cami): the back is cut on
// the fold, wider than it sits by SHIRR.ratio, and shirred with rows of elastic thread that draw it in
// to hug the body. It pulls on, so there is no zip, and on a strapless top it holds the top edge up in
// place of boning. The side seam is the drafted one moved out, so it still matches the front's; the
// top and lower edges are spread to meet it. Plain ASCII punctuation (see instructions.ts).
import { P, Path, add, len, lerp, p, sub } from './geometry';
import { pathOf, ringOf } from './manipulate';
import { isTop } from './corset';
import type { BodiceDraft } from './bodice';
import type { Piece } from './piece';
import type { SewingGuide, SewStep } from './instructions';

/** Cut this many times as wide as it sits, rows of elastic thread this far apart, the first this far below
 * the top edge and the last this far above the lower edge. */
export const SHIRR = { ratio: 1.6, gap: 1.5, top: 1.5, foot: 2 };

export interface Shirring {
  ratio: number;
  rows: number;
  /** The back's top and lower edges as cut, centre back to side seam, in cm. */
  topCut: number;
  footCut: number;
}

/** Whether a top's back is shirred: on a strapless, sweetheart or cami top chosen with a shirred back. */
export const isShirred = (s: { neckline?: string; structure?: string }) => isTop(s.neckline) && s.neckline !== 'halter' && s.structure === 'shirred';

const polyLen = (pts: P[]) => pts.slice(1).reduce((s, q, i) => s + len(sub(q, pts[i])), 0);

/** The point on a polyline at height y (its first crossing), or its nearest end. */
function xAtY(poly: P[], y: number): number {
  for (let i = 1; i < poly.length; i++) {
    const [a, b] = [poly[i - 1], poly[i]];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return lerp(a, b, (y - a.y) / (b.y - a.y)).x;
  }
  return Math.abs(poly[0].y - y) < Math.abs(poly[poly.length - 1].y - y) ? poly[0].x : poly[poly.length - 1].x;
}

/** The back spread for shirring, on the fold with no zip and no darts. */
export function shirredBack(d: BodiceDraft): BodiceDraft {
  const k = d.pieces.findIndex((pc) => /^Bodice back$/.test(pc.name));
  if (k < 0) return d;
  const pc = d.pieces[k];
  const r = ringOf(pc.outline);
  // The darts let out: each one's peak dropped, its legs joined straight across.
  const pts: P[] = [];
  const tags: string[] = [];
  r.pts.forEach((q, i) => {
    if (r.tags[i - 1] === 'dart' && r.tags[i] === 'dart') return;
    pts.push(q);
    tags.push(r.tags[i] === 'dart' ? 'waist' : r.tags[i]);
  });
  const s0 = tags.indexOf('side');
  let s1 = s0;
  while (tags[s1] === 'side') s1++;
  if (s0 < 1) return d;
  const side = pts.slice(s0, s1 + 1);
  const out = (k0: number) => Math.max(...side.map((q) => q.x)) * (k0 - 1);
  const dx = out(SHIRR.ratio);
  const top = side[0];
  // Everything moved out from the centre back, the top and lower edges carried on square from it, so
  // every edge keeps its shape and meets the side seam at the same angle as before.
  const n = pts.length;
  const moved = [pts[0], ...pts.map((q) => add(q, p(dx, 0))), p(0, pts[n - 1].y)];
  const ring = { pts: moved, tags: ['neck', ...tags.slice(0, -1), 'waist', 'fold'] };
  const topRun = moved.slice(0, s0 + 2);
  const footRun = moved.slice(s1 + 1);
  const s0m = s0 + 1;
  const s1m = s1 + 1;
  const cbTop = moved[0].y;
  const cbFoot = moved[moved.length - 1].y;
  // Rows across, each spaced evenly between the top edge and the lower edge.
  const first = SHIRR.top;
  const span = cbFoot - cbTop - SHIRR.top - SHIRR.foot;
  const rows = Math.max(2, Math.floor(span / SHIRR.gap) + 1);
  const lines: Path[] = [];
  for (let i = 0; i < rows; i++) {
    const y = cbTop + first + (span * i) / (rows - 1);
    const sideX = xAtY(moved.slice(s0m, s1m + 1), y);
    lines.push(new Path(p(0.3, y)).line(p(sideX - 0.3, y)));
  }
  const width = top.x + dx;
  const shift = (q: P) => add(q, p(dx, 0));
  const cut = 'Cut 1 on fold';
  const back: Piece = {
    ...pc,
    outline: pathOf(ring),
    lines,
    notches: pc.notches.filter(([q, dir]) => !(Math.abs(q.x) < 1e-6 && dir.x < 0)).map(([q, dir]) => [shift(q), dir]),
    labels: [
      { at: p(width * 0.5, cbTop + (cbFoot - cbTop) * 0.42), text: 'BODICE BACK', size: 1.2 },
      { at: p(width * 0.5, cbTop + (cbFoot - cbTop) * 0.42 + 1.6), text: cut, size: 0.8 },
      { at: p(width * 0.5, cbTop + (cbFoot - cbTop) * 0.42 + 3), text: `SHIRR ${rows} ROWS`, size: 0.6 },
      ...pc.labels.filter((l) => l.text === 'STRAP').map((l) => ({ ...l, at: shift(l.at) })),
    ],
    grain: [p(width * 0.25, cbTop + 2), p(width * 0.25, cbFoot - 2)],
    fold: [p(0, cbTop + 1.5), p(0, cbFoot - 1.5)],
    cut,
    allowances: { ...pc.allowances, fold: 0 },
    draft: undefined,
    alternate: undefined,
    meta: { ...pc.meta, shirred: SHIRR.ratio },
  };
  const pieces = d.pieces.map((x, i) => (i === k ? back : x));
  // The bodice as worn keeps the back's drafted width, on the fold, its darts let out into the shirring.
  const block = (d.block ?? d.pieces.slice(0, 2)).map((x) => (/back/i.test(x.name) ? { ...x, outline: pathOf({ pts, tags: tags.map((t) => (t === 'centre' ? 'fold' : t)) }), lines: [], fold: back.fold } : x));
  return {
    ...d,
    pieces,
    block,
    zipCm: 0,
    top: d.top && { ...d.top, boned: false },
    shirred: { ratio: SHIRR.ratio, rows, topCut: Math.round(polyLen(topRun) * 10) / 10, footCut: Math.round(polyLen(footRun) * 10) / 10 },
  };
}

const step = (title: string, text: string): SewStep => ({ title, text });

/**
 * A shirred-back top's steps: the front lined to itself, the back hemmed top and bottom and shirred
 * flat, then the side seams sewn through the rows. No zip.
 */
export function shirredSteps(g: SewingGuide, d: BodiceDraft, o: { seam: string }): SewingGuide {
  const sh = d.shirred;
  if (!sh) return g;
  const find = (re: RegExp) => g.steps.find((s) => re.test(s.title));
  const darts = find(/darts$/);
  const straps = find(/^Make the straps$/);
  const st = d.top?.straps;
  const strapEnds = st ? ' with each strap end between the layers at its STRAP mark, the strap hanging down inside,' : '';
  const steps: SewStep[] = [
    g.steps[0],
    step(
      'Cut out',
      `Fold the fabric in half with the selvedges together. Place the bodice front and the bodice back on the fold. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line and snip the small notches. Cut the front again for its lining. Chalk the dart lines on both fronts, and the ${sh.rows} shirring rows across the right side of the back.${st ? ` Cut two bias strips for the straps, ${st.cutWidthCm} cm wide and ${st.cutLengthCm} cm long.` : ''}`,
    ),
    ...(darts ? [{ ...darts, text: `${darts.text} Sew the same darts in the front lining, and press them the opposite way.` }] : []),
    ...(straps ? [straps] : []),
    step(
      'Line the front',
      `Pin the lining to the front along the top edge, right sides together,${strapEnds} and sew 1 cm from the edge. Trim the seam to 0.5 cm, clip any curves, and understitch the lining close to the seam. Turn the lining to the inside and press, then baste the two layers together along the side and lower edges, so they work as one.`,
    ),
    step(
      'Hem the back',
      `Press the back's top edge under 0.5 cm, then 1 cm more, and stitch close to the inner fold.${st ? ' Tuck the back strap ends under the hem at their STRAP marks first, so the stitching catches them.' : ''} Hem the lower edge the same way. Hem them now, while the back is flat: once it is shirred it will not lie still under the foot.`,
    ),
    step(
      'Shirr the back',
      `Wind shirring elastic onto an empty bobbin by hand, firmly but without stretching it, and use ordinary thread on top. Set a long straight stitch, 3 to 4 mm. Test on a scrap first: it should pucker as you sew. With the right side up, stitch along the first chalked row from one side edge to the other, leaving 10 cm tails, then each row after it, ${n1(SHIRR.gap)} apart, holding the rows already sewn flat as you go. Knot each pair of tails on the wrong side. Hold a steam iron just above the back, without pressing: the steam shrinks the elastic and draws the rows up tight. Shirred, the back is about ${Math.round(100 / sh.ratio)}% of its cut width.`,
    ),
    step(
      'Sew the side seams',
      `Pin the front to the shirred back at the sides, right sides together, top edges level, stretching the back out flat to fit. Sew ${o.seam} from the edge, backstitching over the ends of the elastic rows so they cannot pull out. Zigzag or overlock the seam allowances together and press them toward the back. Try the top on now: it should pull on and hold you snugly without slipping.`,
    ),
    step(
      'Finish the front lower edge',
      "Turn the front's and the lining's lower allowances in toward each other, 1.5 cm, so their folds meet, and edgestitch them together, running on round onto the back's hem at the side seams.",
    ),
    step('Finish', 'Give the top a light steam, holding the iron above the shirring rather than pressing it flat.'),
  ];
  const notions = [g.notions[0], '1 spool of shirring elastic (elastic thread)', ...(st ? ['A loop turner, for the straps'] : []), 'Matching thread'];
  return { notions, steps };
}

const n1 = (v: number) => `${Math.round(v * 10) / 10} cm`;
