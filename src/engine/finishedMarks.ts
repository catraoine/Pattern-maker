// The finished measurements marked on the printed pieces (F5 Marked on the Paper, Cat, 2026-10-28): a
// bullseye at the bust, waist and hip levels of the front piece, with the garment's finished round, the
// body's and the ease between, so the numbers sit where a toile is measured.
import { p } from './geometry';
import type { P } from './geometry';
import { MARK_TEXT, type FinishedMark, type Piece } from './piece';
import type { SpecRow } from './techpack';
import { isWaistRow } from './spec';
import { crossings } from './easeMap';
import { textWidth } from './export';
import { toInches } from '../units';

/** The pieces of the garment's own shell, fronts first: not its facings, linings, sleeves or bands. */
function shells(pieces: Piece[]): Piece[] {
  const own = pieces.filter((pc) => !pc.kind && !pc.fabric && !/back|lining|sleeve|collar|cuff|band|pocket|facing|belt|tie|yoke|strap|godet|tier|flounce/i.test(pc.name));
  return [...own.filter((pc) => /front/i.test(pc.name)), ...own.filter((pc) => !/front/i.test(pc.name))];
}

const balanceY = (pc: Piece, label: string) => pc.balance?.find((b) => b.label === label)?.pts[0].y;

/** The bust point, where the draft names it. */
const apexOf = (pc: Piece): P | undefined => pc.draft?.points.find((d) => /^Bust point/.test(d.note))?.at;

/** The waist seam's middle level, when the piece has one. */
function waistSeam(pc: Piece): number | undefined {
  const { pts, tags } = pc.outline.taggedPoints(8);
  const ys = tags.flatMap((t, i) => (t === 'waist' && pts[i + 1] ? [pts[i].y, pts[i + 1].y] : [])).sort((a, b) => a - b);
  return ys.length ? ys[Math.floor(ys.length / 2)] : undefined;
}

/** How far in from the stitching line a seam's name reaches, in cm. */
const EDGE_WORDS = 1;

/**
 * Where across the piece a mark at level y sits: the middle of the widest stretch that no dart, grain
 * arrow or fold bracket crosses anywhere in the band its words take, so the words keep off the lines.
 */
function across(pc: Piece, y: number, band: [number, number]): { x: number; w: number } | undefined {
  const edge = crossings(pc.outline.points(), y);
  if (edge.length < 2) return undefined;
  // The seam names run just inside each edge: the words keep off them too, or a narrow piece's words ran into its
  // princess seam's name (pretend tester DO walk, Nov 20).
  const [x0, x1] = [edge[0] + EDGE_WORDS, edge[edge.length - 1] - EDGE_WORDS];
  if (x1 <= x0) return undefined;
  const lines = [...pc.lines.map((ln) => ln.points()), ...(pc.grain ? [pc.grain] : [])];
  const cuts: number[] = pc.fold ? [pc.fold[0].x + 3.4] : [];
  for (let k = 0; k <= 6; k++) {
    const yy = y + band[0] + ((band[1] - band[0]) * k) / 6;
    for (const ln of lines) cuts.push(...crossings(ln.length === 2 ? [...ln, ...ln.slice().reverse()] : ln, yy));
    // The outline itself narrows or widens across the band.
    const e = crossings(pc.outline.points(), yy);
    if (e.length >= 2) cuts.push(e[0] + EDGE_WORDS, e[e.length - 1] - EDGE_WORDS);
  }
  const xs = [x0, ...cuts.filter((x) => x > x0 && x < x1).sort((u, v) => u - v), x1];
  let best = { w: 0, x: (x0 + x1) / 2 };
  for (let i = 0; i + 1 < xs.length; i++) if (xs[i + 1] - xs[i] > best.w) best = { w: xs[i + 1] - xs[i], x: (xs[i] + xs[i + 1]) / 2 };
  return best;
}

// The note under each mark says its unit, so an inch pattern rewrites it too: "YOU 99.1 · EASE +2.5" stayed in cm
// beside "FINISHED WAIST 40 IN" (pretend tester, Nov 17).
const fmt = (v: number) => `${Math.round(v * 10) / 10}`;
const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `-${fmt(-v)}` : '0');

/** The pieces with their finished measurement marks: bust, waist and hip, each on the first front piece that reaches it. */
export function withFinishedMarks(pieces: Piece[], spec: SpecRow[]): Piece[] {
  const row = (label: string) => spec.find((r) => (label === 'Waist' ? isWaistRow(r.label) : r.label === label) && typeof r.finished === 'number' && r.body !== undefined && r.ease !== undefined);
  const fronts = shells(pieces);
  const marks = new Map<Piece, FinishedMark[]>();
  // The level is tried as given, then a little either side, until the words fit clear of the lines.
  // `roomy`: only where the words fit whole, so a narrower piece can be passed over for one with room.
  const add = (pc: Piece, y: number, name: string, r: SpecRow, above = false, tries = [0, 1.5, -1.5, 3], roomy = false) => {
    const title = `FINISHED ${name} ${fmt(r.finished as number)} CM`;
    const need = textWidth(title, MARK_TEXT, 0.12) * 1.3 + 0.6;
    const spots = tries.map((dy) => ({ y: y + dy, at: across(pc, y + dy, above ? [-2.4, 0.8] : [-0.8, 2.6]) }));
    const spot = spots.find((s) => s.at && s.at.w >= need) ?? (roomy ? undefined : spots.find((s) => s.at && s.at.w >= 4));
    if (!spot?.at) return false;
    // A low rise's waist is read against the body where its top sits: "YOU 89.9 CM" on a 79 cm waist read as a
    // mistake (pretend tester DN walk, Nov 20), so the note says where.
    const low = /^Top edge, ([\d.]+) cm (below|above) your waist$/.exec(r.label);
    const you = low ? `YOU ${fmt(r.body!)} CM, ${low[1]} CM ${low[2].toUpperCase()} YOUR WAIST` : `YOU ${fmt(r.body!)} CM`;
    // In inches the ease is the finished size less the body, each to the eighth, as the booklet's table works it: the
    // ease rounded on its own read +1-5/8 in beside 36 in and 37-1/2 in, where the booklet said +1-1/2 (EK walk, Nov 27).
    const eighth = 2.54 / 8;
    const e8 = Math.round((r.finished as number) / eighth) - Math.round(r.body! / eighth);
    const inch = (cm: number) => toInches(cm).toUpperCase();
    const youIn = low ? `YOU ${inch(r.body!)}, ${inch(Number(low[1]))} ${low[2].toUpperCase()} YOUR WAIST` : `YOU ${inch(r.body!)}`;
    const easeIn = e8 === 0 ? '0' : `${e8 > 0 ? '+' : '-'}${inch(Math.abs(e8) * eighth)}`;
    const mark = { at: p(spot.at.x, spot.y), title, note: `${you} · EASE ${signed(r.ease!)} CM`, inch: { title: `FINISHED ${name} ${inch(r.finished as number)}`, note: `${youIn} · EASE ${easeIn}` } };
    marks.set(pc, [...(marks.get(pc) ?? []), above ? { ...mark, above } : mark]);
    return true;
  };

  const bust = row('Bust');
  let upper: Piece | undefined;
  if (bust) {
    // The front with the bust point first, then any front reaching the underarm. A princess top's centre front is too
    // narrow at the bust for the words, which printed over PLACE ON FOLD and its seam label (pretend tester DO walk,
    // Nov 20): the side front, with room, takes them.
    // A princess side front has no bust point of its own; cut from the same draft, it shares the centre front's level.
    const apex = fronts.map(apexOf).find((q) => q);
    const spans = (pc: Piece, y: number) => pc.outline.points().some((q) => q.y < y) && pc.outline.points().some((q) => q.y > y);
    const levelOf = (pc: Piece) => apexOf(pc)?.y ?? (balanceY(pc, 'UNDERARM LINE') !== undefined ? balanceY(pc, 'UNDERARM LINE')! + 2.5 : apex!.y);
    const reach = [
      ...fronts.filter((pc) => apexOf(pc)),
      ...fronts.filter((pc) => !apexOf(pc) && balanceY(pc, 'UNDERARM LINE') !== undefined),
      ...(apex ? fronts.filter((pc) => !apexOf(pc) && balanceY(pc, 'UNDERARM LINE') === undefined && spans(pc, apex.y)) : []),
    ];
    upper = reach.find((pc) => add(pc, levelOf(pc), 'BUST', bust, false, undefined, true)) ?? reach[0];
    if (upper && !marks.has(upper)) add(upper, levelOf(upper), 'BUST', bust);
  }
  const waist = row('Waist');
  if (waist) {
    // A top's waist is its lower edge, so its words go above the mark; a skirt's or trousers' waist is its
    // upper edge. The mark sits 3 cm inside.
    // Not on a peplum: its waist edge is sewn at the peplum seam, below the waist, so "FINISHED WAIST" there named a
    // round the piece doesn't have (EK walk, Nov 27). A top whose own waist is no seam goes without the mark.
    const pc = (upper && waistSeam(upper) !== undefined ? upper : undefined) ?? fronts.find((x) => waistSeam(x) !== undefined && !/peplum/i.test(x.name));
    const wy = pc && waistSeam(pc);
    if (pc && wy !== undefined) {
      const ys = pc.outline.points().map((q) => q.y);
      const low = wy > (Math.min(...ys) + Math.max(...ys)) / 2;
      add(pc, low ? wy - 3 : wy + 3, 'WAIST', waist, low, low ? [0, -1.5, -3, -4.5] : [0, 1.5, 3, 4.5]);
    }
  }
  const hip = row('Hip');
  if (hip) {
    const pc = fronts.find((x) => balanceY(x, 'HIP LINE') !== undefined);
    if (pc) add(pc, balanceY(pc, 'HIP LINE')!, 'HIP', hip);
  }
  return pieces.map((pc) => (marks.has(pc) ? { ...pc, finished: marks.get(pc) } : pc));
}
