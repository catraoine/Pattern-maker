// A trumpet skirt in six panels. Drafted in two pieces on the fold, a trumpet can only flare at its side seams: in
// CLO the flare kicked out at the sides and the front and back hung flat (dress 36, Nov 12; Cat: "Trumpet now", Nov 14).
// As a pattern cutter cuts it (Aldrich's gored skirts), each quarter is split into a centre and a side panel along
// the dart nearest its middle, the dart's intake becoming the panel seam's shaping above the hip, and the flare is
// shared between the panel seam (each side of it) and the side seam, so every seam flutes alike.
// Keep to plain ASCII punctuation in the words: they go into the PDF.
import { P, Path, add, len, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';

/** The share of a quarter's flare left at the side seam; the rest goes half to each side of the panel seam. */
export const SIDE_SHARE = 1 / 3;
/** The steepest a panel seam swings out at the hem, as a trumpet's side seam does (skirt.ts). */
const MAX_ANGLE = (22 * Math.PI) / 180;

/** Whether the trumpet is cut in panels: a plain one, with nothing else that reshapes its quarters. */
export function trumpetPanelled(s: {
  silhouette: string;
  yoke?: unknown;
  buttons?: unknown;
  asymHem?: string;
  hem?: unknown;
  pockets?: string;
  slit?: string;
  wrap?: unknown;
  ruched?: unknown;
  waist?: string;
  zip?: string;
}): boolean {
  return (
    s.silhouette === 'trumpet' &&
    !s.yoke &&
    !s.buttons &&
    (s.asymHem ?? 'none') === 'none' &&
    !s.hem &&
    s.pockets !== 'patch' &&
    s.pockets !== 'slant' &&
    (s.slit ?? 'none') === 'none' &&
    !s.wrap &&
    !s.ruched &&
    // (A faced or high waist cuts its facings from the front and back alone, and a side zip goes into one side seam:
    // neither is drafted for panels yet, so those keep the two-piece trumpet.)
    (s.waist ?? 'band') !== 'faced' &&
    s.waist !== 'high' &&
    s.zip !== 'side'
  );
}

const near = (a: P, b: P) => len(sub(a, b)) < 1e-6;

/**
 * Split one trumpet quarter (centre at x=0) into its centre and side panel. `flare` is how far each side of the
 * panel seam swings out at the hem; `flareFrom` is where the flare starts below the waist.
 */
export function splitTrumpet(pc: Piece, o: { flare: number; flareFrom: number; hipDepth: number; isFront: boolean }): Piece[] {
  const segs = pc.outline.segs;
  const tags = pc.outline.tags;
  const darts = pc.lines.map((l) => ({ near: l.start, tip: l.segs[0].to, far: l.segs[1].to, line: l }));
  const sideStart = tags.indexOf('side');
  const hemAt = tags.indexOf('hem');
  if (!darts.length || sideStart < 0 || hemAt < 0) return [pc];
  const sw = sideStart > 0 ? segs[sideStart - 1].to : pc.outline.start;
  const hipQ = Math.max(...segs.slice(sideStart, hemAt).map((s) => s.to.x).filter((x) => x <= sw.x + 6), sw.x);
  // The dart nearest the middle of the quarter at the hip becomes the panel seam.
  const d = darts.reduce((a, b) => (Math.abs(b.tip.x - hipQ * 0.5) < Math.abs(a.tip.x - hipQ * 0.5) ? b : a));
  const iNear = segs.findIndex((s) => near(s.to, d.near));
  const iFar = segs.findIndex((s) => near(s.to, d.far));
  if (iNear < 0 || iFar < 0 || iFar <= iNear) return [pc];
  const sx = d.tip.x;
  const hemSeg = segs[hemAt];
  const hemSide = segs[hemAt - 1].to;
  const ch = hemSeg.to;
  // The hem's height where the seam meets it, from the drafted hem (a flat cubic from the side to the centre).
  const hemPts = pc.outline.taggedPoints(48);
  const hemY = (x: number) => {
    let best = ch.y;
    let bd = Infinity;
    hemPts.pts.forEach((q, i) => {
      if ((hemPts.tags[i] === 'hem' || hemPts.tags[i - 1] === 'hem') && Math.abs(q.x - x) < bd) {
        bd = Math.abs(q.x - x);
        best = q.y;
      }
    });
    return best;
  };
  const k = Math.max(4, hemY(sx) - o.flareFrom);
  const angle = Math.min(MAX_ANGLE, Math.atan(o.flare / (0.5 * k)));
  const f = Math.min(o.flare, 0.5 * k);
  // Each panel's hem meets its seam square: the corner rises by the run of the hem times tan(angle/2), as the side's does.
  const lift = Math.min(k * 0.25, f * Math.tan(angle / 2));
  const yb = hemY(sx) - lift;
  const top = p(sx, o.flareFrom);
  const tC = p(Math.sin(angle), Math.cos(angle)); // the centre panel's seam, heading down and out toward the side
  const tS = p(-Math.sin(angle), Math.cos(angle)); // the side panel's, heading down and out toward the centre
  const bottomC = p(sx + f, yb);
  const bottomS = p(sx - f, yb);

  // Centre panel: centre waist to the seam's waist point, down the seam, across the hem to the centre, up the centre.
  const centre = new Path(pc.outline.start);
  for (let i = 0; i <= iNear; i++) {
    centre.segs.push(segs[i]);
    centre.tags.push(tags[i]);
  }
  centre.line(d.tip, 'gore').line(top, 'gore');
  centre.curve(p(sx, top.y + k * 0.45), sub(bottomC, mul(tC, k * 0.4)), bottomC, 'gore');
  const hc = Math.max(2, (sx + f) * 0.35);
  centre.curve(add(bottomC, mul(p(-tC.y, tC.x), hc)), add(ch, p(hc, 0)), ch, 'hem');
  centre.line(pc.outline.start, tags[tags.length - 1]);
  centre.closed = true;

  // Side panel: the seam's other waist point along the waist to the side, down the side seam, across the hem to the
  // panel seam, and up it.
  const side = new Path(d.far);
  for (let i = iFar + 1; i < hemAt; i++) {
    side.segs.push(segs[i]);
    side.tags.push(tags[i]);
  }
  const run = Math.max(2, (hemSide.x - (sx - f)) * 0.35);
  const out0 = hemSeg.kind === 'C' ? unit(sub(hemSeg.c1, hemSide)) : unit(sub(ch, hemSide));
  side.curve(add(hemSide, mul(out0, run)), add(bottomS, mul(p(tS.y, -tS.x), run)), bottomS, 'hem');
  side.curve(sub(bottomS, mul(tS, k * 0.4)), p(sx, top.y + k * 0.45), top, 'gore');
  side.line(d.tip, 'gore').line(d.far, 'gore');
  side.closed = true;

  const left = (q: P) => q.x < sx;
  const centreName = pc.name;
  const sideName = pc.name.replace(/^Skirt /, 'Skirt side ');
  const kept = darts.filter((x) => x !== d);
  const dartsCm = (pc.meta.dartsCm as number[] | undefined) ?? [];
  const keptCm = dartsCm.filter((_, i) => darts[i] !== d);
  // Balance notches on the panel seam at the hip, single at the front and double at the back, so the panels can't be
  // swapped; and one where the flare starts, to ease the seams together from there.
  const seamNotches = (dir: number): [P, P][] => [
    ...(o.isFront ? [[p(sx, o.hipDepth), p(dir, 0)] as [P, P]] : [[p(sx, o.hipDepth - 0.5), p(dir, 0)] as [P, P], [p(sx, o.hipDepth + 0.5), p(dir, 0)] as [P, P]]),
    [top, p(dir, 0)],
  ];
  const hipLine = (pc.balance ?? []).find((b) => b.label === 'HIP LINE');
  const nameLabel = pc.labels.find((l) => l.text === pc.name.toUpperCase());
  const sideCut = 'Cut 2 (1 pair)';
  const C: Piece = {
    ...pc,
    outline: centre,
    lines: kept.filter((x) => left(x.tip)).map((x) => x.line),
    grain: [p(sx * 0.5, o.hipDepth + 4), p(sx * 0.5, yb - 8)],
    notches: [...pc.notches.filter((n) => left(n[0])), ...seamNotches(1)],
    balance: [...(pc.balance ?? []).filter((b) => b !== hipLine), ...(hipLine ? [{ pts: [p(0, o.hipDepth), p(sx, o.hipDepth)], label: 'HIP LINE' }] : [])],
    labels: pc.labels.filter((l) => left(l.at)).map((l) => (l === nameLabel ? { ...l, at: p(sx * 0.5, l.at.y) } : l)),
    draft: pc.draft ? { ...pc.draft, points: pc.draft.points.filter((q) => left(q.at)) } : undefined,
    meta: {
      ...pc.meta,
      dartsCm: keptCm.filter((_, i) => left(kept[i].tip)),
      goreSeam: sideName,
      goreFlareCm: Math.round(f * 10) / 10,
      // For the drawing: the quarter as drafted before it was split, and where its panel seam opens out, so it can be
      // hung whole with the seam's flare drawn out into it, as godets are (drape/garment.ts).
      trumpetQuarter: {
        outline: pc.outline,
        lines: pc.lines,
        slash: [top, p(sx, yb)] as [P, P],
        spread: 2 * f,
        // The panel seam as sewn, for the flat drawing: from the middle of the dart it replaces, through its point,
        // straight down to where the flare starts, and out to the middle of the opened hem.
        seam: [mul(add(d.near, d.far), 0.5), d.tip, top, p(sx + f, yb)],
      },
    },
  };
  const S: Piece = {
    ...pc,
    name: sideName,
    outline: side,
    lines: kept.filter((x) => !left(x.tip)).map((x) => x.line),
    grain: [p((sx + hipQ) / 2, o.hipDepth + 4), p((sx + hipQ) / 2, yb - 8)],
    fold: undefined,
    cut: sideCut,
    notches: [...pc.notches.filter((n) => !left(n[0])), ...seamNotches(-1)],
    balance: hipLine ? [{ pts: [p(sx, o.hipDepth), hipLine.pts[hipLine.pts.length - 1]], label: 'HIP LINE' }] : [],
    labels: [
      { at: p((sx + hipQ) / 2, o.hipDepth - 4), text: sideName.toUpperCase(), size: nameLabel?.size ?? 1.6 },
      { at: p((sx + hipQ) / 2, o.hipDepth + 1), text: sideCut, size: 1.0 },
      ...pc.labels.filter((l) => !left(l.at) && l !== nameLabel && !/^Cut /.test(l.text)),
    ],
    draft: pc.draft ? { ...pc.draft, points: pc.draft.points.filter((q) => !left(q.at)) } : undefined,
    meta: { ...pc.meta, dartsCm: keptCm.filter((_, i) => !left(kept[i].tip)), goreSeam: centreName, goreFlareCm: Math.round(f * 10) / 10 },
  };
  return [C, S];
}

/**
 * The quarter as worn, with its panel seam's flare drawn out into it: for the sketch, the flat drawing, the figure and
 * the ease map, which read a skirt's front and back as whole quarters. (Cut in panels, the first two pieces are only
 * the centre panels: the flat drawing showed a skirt a third too narrow.) The cloth beyond the seam swings out from
 * where the flare starts.
 */
export function wholeQuarter(pc: Piece): Piece {
  const q = pc.meta.trumpetQuarter as { outline: Path; lines: Path[]; slash: [P, P]; spread: number; seam: P[] } | undefined;
  if (!q) return pc;
  const [top, foot] = q.slash;
  const shear = (v: P): P => {
    const cross = (foot.x - top.x) * (v.y - top.y) - (foot.y - top.y) * (v.x - top.x);
    if (cross > 1e-6) return v;
    const t = Math.max(0, Math.min(1, (v.y - top.y) / (foot.y - top.y || 1)));
    if (!t) return v;
    // (Drawn straight out sideways, so the hem stays the smooth, level curve the sewn panels make: swung about the
    // seam's top to keep its length, as All round does, the drawn hem rose to a corner at the seam and at the side.)
    return p(v.x + q.spread * t, v.y);
  };
  const { pts, tags } = q.outline.taggedPoints(12);
  const outline = new Path(shear(pts[0]));
  for (let i = 0; i < pts.length; i++) outline.line(shear(pts[(i + 1) % pts.length]), tags[i]);
  outline.closed = true;
  const lines = q.lines.map((l) => {
    const ps = l.points(12).map(shear);
    const out = new Path(ps[0]);
    for (let i = 1; i < ps.length; i++) out.line(ps[i]);
    return out;
  });
  const { trumpetQuarter: _q, goreSeam: _g, goreFlareCm: _f, ...meta } = pc.meta;
  return { ...pc, outline, lines, meta: { ...meta, panelSeam: q.seam } };
}
