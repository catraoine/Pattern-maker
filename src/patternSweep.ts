// The pattern geometry check (Quality: Automated checks, Cat 2026-11-04): every option of every garment, on its own,
// drafted to the example body and built into the printed pattern the print screen makes, then walked the way a pattern
// cutter walks a pattern before it is cut. Seams that sew together are the same length (checkPattern: side seams,
// shoulders, the sleeve crown into the armhole, waist seams, collars, yokes, princess lines), the notches on two edges
// that sew together sit at the same place along them, and no piece's stitching or cutting line crosses itself.
// patternSweep.test.ts runs it on every pull request and nightly, held to src/patternOptions.json.
import { EXAMPLE_BODY, Garment, MeasurementValues } from './measurements';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES, TEE_GROUPS, TROUSER_GROUPS, TrousersChoices, trouserAllowed, validTrousers } from './garments';
import { optionDesigns } from './drapeSweep';
import { printableFor } from './printable';
import { checkPattern } from './engine/qc';
import { P, len, sub } from './engine/geometry';
import { Piece, cutLine } from './engine/piece';

/** One design whose pattern is walked: the garment, its choices as a saved pattern keeps them, and how it's finished. */
interface PatternDesign {
  key: string;
  garment: Garment;
  saved: Partial<Saved>;
  finish?: Partial<Finish>;
}

/** Every option of every garment on its own: All round's list (skirt, top, dress, jacket, coat), the trousers' and the
 *  T-shirt's, and the finishes that add pieces (a lined skirt; faced and lined tops). */
export function patternDesigns(): PatternDesign[] {
  const out: PatternDesign[] = optionDesigns().map(({ key, design }) => ({ key, garment: design.garment, saved: design.saved }));
  for (const g of TROUSER_GROUPS)
    for (const [o] of g.options) {
      if (!trouserAllowed(DEFAULT_TROUSERS_CHOICES, g.id, o)) continue;
      const trousers = validTrousers({ ...DEFAULT_TROUSERS_CHOICES, [g.id]: o } as TrousersChoices);
      out.push({ key: `trousers ${g.id}=${o}`, garment: 'trousers', saved: { trousers } });
    }
  out.push({ key: 'trousers waist=elastic pockets=slant', garment: 'trousers', saved: { trousers: { ...DEFAULT_TROUSERS_CHOICES, waist: 'elastic', pockets: 'slant' } } });
  for (const g of TEE_GROUPS) for (const [o] of g.options) out.push({ key: `tee ${g.id}=${o}`, garment: 'tee', saved: { tee: { ...DEFAULT_TEE_CHOICES, [g.id]: o } as Saved['tee'] } });
  out.push({ key: 'skirt finish lined', garment: 'skirt', saved: {}, finish: { skirtLined: true } });
  for (const edges of ['facings', 'lined'] as const) {
    out.push({ key: `bodice finish ${edges}`, garment: 'bodice', saved: {}, finish: { bodiceEdges: edges } });
    out.push({ key: `bodice finish ${edges} sleeve=long`, garment: 'bodice', saved: { bodice: { ...INITIAL.bodice, sleeve: 'long' } }, finish: { bodiceEdges: edges } });
    out.push({ key: `dress finish ${edges}`, garment: 'dress', saved: {}, finish: { bodiceEdges: edges } });
  }
  out.push({ key: 'skirt finish couture', garment: 'skirt', saved: {}, finish: { allowances: 'couture' } });
  out.push({ key: 'bodice finish couture sleeve=long', garment: 'bodice', saved: { bodice: { ...INITIAL.bodice, sleeve: 'long' } }, finish: { allowances: 'couture' } });
  return out.filter((x, i) => out.findIndex((y) => y.key === x.key) === i);
}

/** The printed pattern's pieces and its finished waist, as the print screen builds them. */
function patternOf(d: PatternDesign, values: MeasurementValues = EXAMPLE_BODY): { pieces: Piece[]; finishedWaist?: number } {
  const saved = { ...INITIAL, ...d.saved } as Saved;
  const finish: Finish = { ...DEFAULT_FINISH, ...d.finish };
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric: undefined };
  const result = GARMENT_DRAFTING[d.garment].draft(values, inputs, undefined);
  const made = printableFor({
    result,
    values,
    finish,
    fabric: undefined,
    garment: d.garment,
    ownFitting: undefined,
    carriedNotes: [],
    saved: { choices: saved.choices, bodice: saved.bodice },
    dress: dressOf(saved),
    skirtStyle: skirtStyleOf(inputs, undefined),
    trousersChoices: trousersChoicesOf(saved),
  });
  if (!made) throw new Error('no printed pattern');
  const waist = (made.spec.find((r) => /^Waist seam, /.test(r.label)) ?? made.spec.find((r) => r.label === 'Waist'))?.finished;
  return { pieces: made.pieces, finishedWaist: typeof waist === 'number' ? waist : undefined };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, s: P) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);
  return o(c, d, a) * o(c, d, b) < -1e-9 && o(a, b, c) * o(a, b, d) < -1e-9;
}

/** Where a closed line crosses itself, or undefined when it doesn't. */
export function selfCrossing(pts: P[]): P | undefined {
  const q = len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.slice(0, -1) : pts;
  const n = q.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(q[i], q[(i + 1) % n], q[j], q[(j + 1) % n])) return q[i];
    }
  return undefined;
}

/** A tagged edge of a piece as one line: its points in order from its top end, the distance along it of each (a dart
 *  that breaks the edge closed, so it adds nothing), and its length. */
interface Edge {
  pts: P[];
  along: number[];
  length: number;
}

/** Edges that a seam runs down from, and edges it runs down to. */
const TOP = ['waist', 'armhole', 'crotch', 'neck', 'shoulder', 'yoke', 'empire', 'princess'];
const BOTTOM = ['hem', 'sleeve-hem', 'flounce', 'tier', 'cuff'];

/** The runs of a piece's stitching line carrying `tag`, each from its end at the top of the seam (the waist or armhole
 *  end, else the higher end). A dart in the run is part of it, closed. */
function edgesOf(pc: Piece, tag: string): Edge[] {
  let { pts, tags } = pc.outline.taggedPoints(48);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  const n = pts.length;
  const tagAt = (i: number) => tags[((i % n) + n) % n] ?? tags[tags.length - 1];
  const on = (i: number) => tagAt(i) === tag;
  // Start just after a segment that isn't on the seam, so a run that wraps round the outline's start is one run.
  const first = [...Array(n).keys()].find((i) => !on(i) && tagAt(i) !== 'dart');
  if (first === undefined) return [];
  const runs: { segs: number[]; before: string; after: string }[] = [];
  let cur: number[] | undefined;
  for (let k = 1; k <= n; k++) {
    const i = (first + k) % n;
    const t = tagAt(i);
    if (on(i) || (cur && t === 'dart')) {
      if (!cur) runs.push({ segs: (cur = []), before: tagAt(i - 1), after: '' });
      cur.push(i);
    } else if (cur) {
      // A dart at the end of a run isn't part of the seam.
      while (cur.length && tagAt(cur[cur.length - 1]) === 'dart') cur.pop();
      runs[runs.length - 1].after = tagAt(cur[cur.length - 1] + 1);
      cur = undefined;
    }
  }
  return runs.map(({ segs, before, after }) => {
    const down = TOP.includes(before) || BOTTOM.includes(after) ? true : TOP.includes(after) || BOTTOM.includes(before) ? false : pts[segs[0]].y <= pts[(segs[segs.length - 1] + 1) % n].y;
    const order = down ? segs : [...segs].reverse();
    const P0 = pts[down ? segs[0] : (segs[segs.length - 1] + 1) % n];
    const out: Edge = { pts: [P0], along: [0], length: 0 };
    for (const i of order) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const next = down ? b : a;
      const d = tagAt(i) === 'dart' ? 0 : len(sub(b, a));
      out.length += d;
      out.pts.push(next);
      out.along.push(out.length);
    }
    return out;
  });
}

/** How far along an edge a point sits, when it is on it (within 2 mm). */
function nearest(e: Edge, q: P): { d: number; at: number } | undefined {
  let best: { d: number; at: number } | undefined;
  for (let i = 0; i < e.pts.length - 1; i++) {
    const a = e.pts[i];
    const b = e.pts[i + 1];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2));
    const d = len(sub(q, { x: a.x + ab.x * t, y: a.y + ab.y * t }));
    if (!best || d < best.d) best = { d, at: e.along[i] + Math.sqrt(l2) * t };
  }
  return best;
}

function alongEdge(e: Edge, q: P): number | undefined {
  const best = nearest(e, q);
  return best && best.d <= 0.2 ? best.at : undefined;
}

/** The notches on a piece's edges carrying `tag`, as balance marks: a single notch, or the middle of a double one (two
 *  notches within 1.5 cm), each at its distance along the edge from the top. */
function marksOn(pc: Piece, tag: string): { at: number; count: number }[] {
  const out: { at: number; count: number }[] = [];
  // A notch with a tick drawn in from it marks where the stitching stops (a vent's top), not a balance mark.
  const balance = pc.notches.filter(([q]) => !pc.lines.some((l) => len(sub(l.start, q)) < 0.05));
  let base = 0;
  for (const e of edgesOf(pc, tag)) {
    const at = balance
      .map(([q]) => alongEdge(e, q))
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => a - b);
    for (const v of at) {
      const last = out[out.length - 1];
      if (last && Math.abs(base + v - last.at - 1) < 0.25 && last.count === 1) out[out.length - 1] = { at: (last.at + base + v) / 2, count: 2 };
      else out.push({ at: base + v, count: 1 });
    }
    base += e.length;
  }
  return out;
}

/** How far a notch can sit from the stitching line and still be cut into it: a notch is a 5 mm to 1 cm snip, and a
 *  double notch set either side of a point on a tight curve sits a few mm inside the curve. */
const NOTCH_OFF = 0.5;

/** Seams sewn front to back, edge to edge, with their balance notches matched. */
const NOTCHED = ['side', 'inseam', 'underarm', 'overarm'];
/** How far apart two notches that are meant to meet can be: 3 mm. */
const NOTCH_TOLERANCE = 0.3;

const isFront = (pc: Piece) => /front/i.test(pc.name);
const isBack = (pc: Piece) => /back/i.test(pc.name);

/** The balance marks on one edge with none at the same place on the edge it sews to. When one edge is shorter (part of
 *  the seam is on another piece, as a slant pocket's side front), the two are lined up at their lower ends. */
function unmatched(what: string, sides: [string, string], pcs: [Piece, Piece], tag: string | [string, string]): string[] {
  const [ta, tb] = typeof tag === 'string' ? [tag, tag] : tag;
  const total = (pc: Piece, t: string) => edgesOf(pc, t).reduce((s, e) => s + e.length, 0);
  const la = total(pcs[0], ta);
  const lb = total(pcs[1], tb);
  const fromBottom = Math.abs(la - lb) > NOTCH_TOLERANCE;
  const a = marksOn(pcs[0], ta).map((m) => ({ ...m, at: fromBottom ? la - m.at : m.at }));
  const b = marksOn(pcs[1], tb).map((m) => ({ ...m, at: fromBottom ? lb - m.at : m.at }));
  const word = fromBottom ? 'up from the bottom of' : 'down';
  const out: string[] = [];
  const near = (m: { at: number; count: number }, xs: { at: number; count: number }[]) => xs.some((x) => Math.abs(x.at - m.at) <= NOTCH_TOLERANCE);
  // Lined up at the lower ends, the longer edge's marks above the top of the shorter one are on the other piece.
  const reach = Math.min(la, lb) + NOTCH_TOLERANCE;
  for (const [mine, other, side, otherSide] of [[a, b, sides[0], sides[1]], [b, a, sides[1], sides[0]]] as const)
    for (const m of mine)
      if (!near(m, other) && (!fromBottom || m.at <= reach)) out.push(`${what}: ${m.count === 2 ? 'a double notch' : 'a notch'} ${r1(m.at)} cm ${word} the ${side} with none at that place on the ${otherSide}${other.length ? ` (it has ${other.map((x) => r1(x.at)).join(', ')})` : ''}`);
  return out;
}

/** Balance notches on the front's side of a seam with none at that place on the back's, or the other way round. */
function notchProblems(pieces: Piece[]): string[] {
  const out: string[] = [];
  const own = pieces.filter((pc) => !pc.kind);
  const groupOf = (pc: Piece) => pc.name.replace(/\s*(front|back)\b.*$/i, '');
  for (const front of own.filter(isFront)) {
    const back = own.find((pc) => isBack(pc) && groupOf(pc) === groupOf(front) && !pc.meta.yoke === !front.meta.yoke);
    // Pieces cut whole carry both sides of the body, so their notches pair side by side.
    if (!back || front.meta.whole || back.meta.whole) continue;
    for (const tag of NOTCHED) {
      if (!edgesOf(front, tag).length || !edgesOf(back, tag).length) continue;
      out.push(...unmatched(`${front.name} / ${back.name} ${tag}`, ['front', 'back'], [front, back], tag));
    }
  }
  // A sleeve's two seam edges sew to each other.
  for (const sl of pieces.filter((pc) => /sleeve/i.test(pc.name) && !pc.kind)) {
    if (edgesOf(sl, 'sleeve-front').length && edgesOf(sl, 'sleeve-back').length) out.push(...unmatched(`${sl.name} seam`, ['front edge', 'back edge'], [sl, sl], ['sleeve-front', 'sleeve-back']));
  }
  return out;
}

/** Everything wrong with a printed pattern's geometry, in words; empty when it is sound. */
export function patternProblems(pieces: Piece[], finishedWaist?: number): string[] {
  const out: string[] = [];
  for (const pc of pieces) {
    const outline = pc.outline.points();
    const cut = cutLine(pc);
    if (![...outline, ...cut].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) {
      out.push(`${pc.name}: a point that isn't a number`);
      continue;
    }
    const s = selfCrossing(outline);
    if (s) out.push(`${pc.name}: the stitching line crosses itself near (${r1(s.x)}, ${r1(s.y)})`);
    const c = selfCrossing(cut);
    if (c && !s) out.push(`${pc.name}: the cutting line crosses itself near (${r1(c.x)}, ${r1(c.y)})`);
    // Every notch is cut into the edge of the piece, so it sits on the stitching line.
    const whole: Edge = { pts: outline, along: outline.map(() => 0), length: 0 };
    for (const [q] of pc.notches) {
      const d = nearest(whole, q)?.d ?? Infinity;
      if (d > NOTCH_OFF) out.push(`${pc.name}: a notch at (${r1(q.x)}, ${r1(q.y)}) is ${r1(d)} cm off the edge of the piece`);
    }
  }
  // The seam walk the print screen shows: the garment's own pieces, its collar and its pockets.
  for (const c of checkPattern(
    pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'),
    { finishedWaist },
  ))
    if (!c.ok) out.push(`${c.label}: ${c.detail}`);
  out.push(...notchProblems(pieces));
  return out;
}

/** One design's result: its problems, or why it didn't draft. */
interface PatternResult {
  key: string;
  problems: string[];
  error?: string;
}

/** A problem with its numbers taken out, so the same fault matches the file when it moves a millimetre. */
const problemKind = (p: string) => p.replace(/-?\d+(\.\d+)?/g, '#');

/** Held to the file of known faults: the problems that are new (not in the file for that design), the designs that are
 *  new (not in the file at all), and the faults in the file that are now fixed. */
export function checkPatterns(results: PatternResult[], known: Record<string, string[]>) {
  const now: Record<string, string[]> = {};
  const worse: string[] = [];
  const unseen: string[] = [];
  const fixed: string[] = [];
  for (const r of results) {
    const kinds = [...new Set(r.error ? [`does not draft: ${r.error}`] : r.problems.map(problemKind))];
    now[r.key] = kinds;
    if (!(r.key in known)) {
      unseen.push(r.key);
      continue;
    }
    for (const k of kinds) if (!known[r.key].includes(k)) worse.push(`${r.key}: ${r.problems.find((p) => problemKind(p) === k) ?? k}`);
    for (const k of known[r.key]) if (!kinds.includes(k)) fixed.push(`${r.key}: ${k}`);
  }
  return { now, worse, unseen, fixed };
}

/** The report: the faults by design, and what changed against the file. */
export function patternReport(results: PatternResult[], c: ReturnType<typeof checkPatterns>, title = 'Pattern geometry'): string {
  const bad = results.filter((r) => r.error || r.problems.length);
  const lines = [`## ${title}`, '', `${results.length - bad.length} of ${results.length} patterns sound. ${c.worse.length} new faults, ${c.fixed.length} fixed, ${c.unseen.length} new designs.`, ''];
  if (c.worse.length) lines.push('### New faults', '', ...c.worse.map((w) => `- ${w}`), '');
  if (c.fixed.length) lines.push('### Fixed', '', ...c.fixed.map((w) => `- ${w}`), '');
  if (c.unseen.length) lines.push('### New designs', '', ...c.unseen.map((w) => `- ${w}`), '');
  if (bad.length) lines.push('### Faults', '', ...bad.flatMap((r) => [`- ${r.key}`, ...(r.error ? [`  - does not draft: ${r.error}`] : r.problems.map((p) => `  - ${p}`))]), '');
  return lines.join('\n');
}

export function walkDesign(d: PatternDesign, values: MeasurementValues = EXAMPLE_BODY): PatternResult {
  try {
    const { pieces, finishedWaist } = patternOf(d, values);
    return { key: d.key, problems: patternProblems(pieces, finishedWaist) };
  } catch (e) {
    return { key: d.key, problems: [], error: String(e) };
  }
}
