// The finished measurements marked on the printed pieces (F5 Marked on the Paper, Cat, 2026-10-28): a
// bullseye at the bust, waist and hip levels of the front piece, with the garment's finished round, the
// body's and the ease between, so the numbers sit where a toile is measured.
import { p } from './geometry';
import type { P } from './geometry';
import { MARK_TEXT, type FinishedMark, type Piece } from './piece';
import type { SpecRow } from './techpack';
import { crossings } from './easeMap';
import { textWidth } from './export';

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

/**
 * Where across the piece a mark at level y sits: the middle of the widest stretch that no dart, grain
 * arrow or fold bracket crosses anywhere in the band its words take, so the words keep off the lines.
 */
function across(pc: Piece, y: number, band: [number, number]): { x: number; w: number } | undefined {
  const edge = crossings(pc.outline.points(), y);
  if (edge.length < 2) return undefined;
  const [x0, x1] = [edge[0], edge[edge.length - 1]];
  const lines = [...pc.lines.map((ln) => ln.points()), ...(pc.grain ? [pc.grain] : [])];
  const cuts: number[] = pc.fold ? [pc.fold[0].x + 3.4] : [];
  for (let k = 0; k <= 6; k++) {
    const yy = y + band[0] + ((band[1] - band[0]) * k) / 6;
    for (const ln of lines) cuts.push(...crossings(ln.length === 2 ? [...ln, ...ln.slice().reverse()] : ln, yy));
    // The outline itself narrows or widens across the band.
    const e = crossings(pc.outline.points(), yy);
    if (e.length >= 2) cuts.push(e[0], e[e.length - 1]);
  }
  const xs = [x0, ...cuts.filter((x) => x > x0 && x < x1).sort((u, v) => u - v), x1];
  let best = { w: 0, x: (x0 + x1) / 2 };
  for (let i = 0; i + 1 < xs.length; i++) if (xs[i + 1] - xs[i] > best.w) best = { w: xs[i + 1] - xs[i], x: (xs[i] + xs[i + 1]) / 2 };
  return best;
}

const fmt = (v: number) => `${Math.round(v * 10) / 10}`;
const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `-${fmt(-v)}` : '0');

/** The pieces with their finished measurement marks: bust, waist and hip, each on the first front piece that reaches it. */
export function withFinishedMarks(pieces: Piece[], spec: SpecRow[]): Piece[] {
  const row = (label: string) => spec.find((r) => r.label === label && typeof r.finished === 'number' && r.body !== undefined && r.ease !== undefined);
  const fronts = shells(pieces);
  const marks = new Map<Piece, FinishedMark[]>();
  // The level is tried as given, then a little either side, until the words fit clear of the lines.
  const add = (pc: Piece, y: number, name: string, r: SpecRow, above = false, tries = [0, 1.5, -1.5, 3]) => {
    const title = `FINISHED ${name} ${fmt(r.finished as number)} CM`;
    const need = textWidth(title, MARK_TEXT, 0.12) * 1.3 + 0.6;
    const spots = tries.map((dy) => ({ y: y + dy, at: across(pc, y + dy, above ? [-2.4, 0.8] : [-0.8, 2.6]) }));
    const spot = spots.find((s) => s.at && s.at.w >= need) ?? spots.find((s) => s.at && s.at.w >= 4);
    if (!spot?.at) return;
    const mark = { at: p(spot.at.x, spot.y), title, note: `YOU ${fmt(r.body!)} · EASE ${signed(r.ease!)}` };
    marks.set(pc, [...(marks.get(pc) ?? []), above ? { ...mark, above } : mark]);
  };

  const bust = row('Bust');
  let upper: Piece | undefined;
  if (bust) {
    upper = fronts.find((pc) => apexOf(pc)) ?? fronts.find((pc) => balanceY(pc, 'UNDERARM LINE') !== undefined);
    if (upper) add(upper, apexOf(upper)?.y ?? balanceY(upper, 'UNDERARM LINE')! + 2.5, 'BUST', bust);
  }
  const waist = row('Waist');
  if (waist) {
    // A top's waist is its lower edge, so its words go above the mark; a skirt's or trousers' waist is its
    // upper edge. The mark sits 3 cm inside.
    const pc = (upper && waistSeam(upper) !== undefined ? upper : undefined) ?? fronts.find((x) => waistSeam(x) !== undefined);
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
