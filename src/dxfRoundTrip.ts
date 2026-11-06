// The DXF round trip (Quality: Automated checks, Cat 2026-11-04): every option's printed pattern is written out as the
// DXF a factory or pattern maker downloads, then read back in the way Check a file reads one, and the pieces that come
// back are held against the drafted ones. A cutting room only ever sees the file, so it must carry every piece at its
// drafted size: the same pieces, names and quantities, cutting and stitching lines to a tenth of a millimetre, the seam
// allowances, grain and fold lines, internal lines, and every notch and drill hole within half a millimetre.
// dxfRoundTrip.test.ts runs it on every pull request and nightly, held to src/dxfKnown.json.
import { toDxf, quantity, ascii } from './engine/dxf';
import { ImportedPattern, importDxf } from './engine/importDxf';
import { allNotches, drillHoles, notchSlit } from './engine/marks';
import { P, len, sub } from './engine/geometry';
import { Piece, cutLine } from './engine/piece';
import { EXAMPLE_BODY, MeasurementValues } from './measurements';
import { PatternDesign, PatternResult, printedPattern } from './patternSweep';

const INFO = { style: 'Round trip', size: 'Example', date: '2026-11-04' };
/** How close a line read back must be to the drafted one, in cm: a tenth of a millimetre (the file keeps 0.1 µm). */
const LINE_TOL = 0.01;
/** Notches and drill holes: half a millimetre (a notch at a corner can snap to the other edge's allowance). */
const MARK_TOL = 0.05;

const open = (pts: P[]) => (pts.length > 1 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.slice(0, -1) : pts);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function box(pts: P[]) {
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
/** The nearest point to q on a closed polygon. */
function nearestOn(poly: P[], q: P): P {
  let best = poly[0];
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const ab = sub(poly[(i + 1) % poly.length], a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
    const c = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    const d = len(sub(q, c));
    if (d < bestD) [bestD, best] = [d, c];
  }
  return best;
}
const perimeter = (pts: P[]) => pts.reduce((s, q, i) => s + len(sub(pts[(i + 1) % pts.length], q)), 0);

/** How far apart two lines are once the drafted one is moved to where the import puts it, or why they can't be compared. */
function lineOff(want: P[], got: P[], shift: P): string | number {
  if (want.length !== got.length) return `${want.length} points drawn, ${got.length} read back`;
  return Math.max(0, ...want.map((q, i) => len(sub(sub(q, shift), got[i]))));
}

/** What a cutting room would get wrong from the file: each piece that comes back different from the drafted one. */
export function dxfProblems(pieces: Piece[]): string[] {
  return compareBack(pieces, importDxf(toDxf(pieces, INFO)));
}

/** The drafted pieces held against the ones read back from their file. */
export function compareBack(pieces: Piece[], back: ImportedPattern): string[] {
  const out: string[] = [];
  if (back.style !== INFO.style || back.size !== INFO.size) out.push(`file: the style or size reads back as "${back.style}" / "${back.size}"`);
  // The stitching lines are held piece by piece below; the import's own note on them counts a piece cut mostly with
  // no allowance (a facing) as one without.
  for (const n of back.notes.filter((n) => !/stitching line/.test(n))) out.push(`file: ${n}`);
  if (back.pieces.length !== pieces.length) {
    out.push(`file: ${pieces.length} pieces written, ${back.pieces.length} read back`);
    return out;
  }
  pieces.forEach((want, i) => {
    const got = back.pieces[i];
    const name = want.name;
    const say = (s: string) => out.push(`${name}: ${s}`);
    if (got.name !== ascii(want.name)) say(`named "${got.name}" in the file`);
    if (quantity(got.cut) !== quantity(want.cut)) say(`cut ${quantity(got.cut)} in the file, ${quantity(want.cut)} drafted`);
    if (got.cut !== ascii(want.cut)) say(`cutting note "${got.cut}" in the file, "${want.cut}" drafted`);

    const cutW = open(cutLine(want));
    const cutG = cutLine(got);
    const b = box(cutW);
    const shift = { x: b.x, y: b.y };
    const bg = box(cutG);
    if (Math.abs(bg.w - b.w) > LINE_TOL || Math.abs(bg.h - b.h) > LINE_TOL) say(`reads back ${r2(bg.w)} × ${r2(bg.h)} cm, drafted ${r2(b.w)} × ${r2(b.h)} cm`);
    const cutOff = lineOff(cutW, cutG, shift);
    if (typeof cutOff === 'string') say(`cutting line: ${cutOff} (${r1(perimeter(cutG))} cm round, drafted ${r1(perimeter(cutW))} cm)`);
    else if (cutOff > LINE_TOL) say(`cutting line moves up to ${r2(cutOff * 10)} mm`);
    const sewOff = lineOff(open(want.outline.points()), open(got.outline.points()), shift);
    if (typeof sewOff === 'string') say(`stitching line: ${sewOff}`);
    else if (sewOff > LINE_TOL) say(`stitching line moves up to ${r2(sewOff * 10)} mm`);

    // The seam allowances are the distance between the two lines, so they come back when both lines do.
    if (got.lines.length !== want.lines.length) say(`${want.lines.length} internal lines drawn, ${got.lines.length} read back`);
    else
      want.lines.forEach((ln, k) => {
        const off = lineOff(ln.points(), got.lines[k].points(), shift);
        if (typeof off === 'string' || off > LINE_TOL) say(`an internal line (darts, placement) does not read back where it was drawn`);
      });
    if (!!want.grain !== !!got.grain) say(want.grain ? 'the grain line is lost' : 'a grain line appears that was not drawn');
    else if (want.grain && got.grain && (lineOff(want.grain, got.grain, shift) as number) > LINE_TOL) say('the grain line moves');
    if (!!want.fold !== !!got.fold) say(want.fold ? 'the place-on-fold line is lost' : 'a fold line appears that was not drawn');

    // Notches where they cut into the cutting line: the points the file is written with (the piece's own and one at
    // each dart leg, as the printed pattern places them) against every notch point read from the file, before the
    // import takes any as a dart leg's and places that itself. Drill holes (dart points, fish-eye ends, godet points)
    // the same way.
    const onCut = (pc: Piece, cut: P[]) => allNotches(pc).map(([q, d]) => nearestOn(cut, notchSlit(pc, q, d)[0]));
    const marks: [string, string, P[], P[]][] = [
      ['notch', 'notches', onCut(want, cutW), (got.meta.fileNotches as P[] | undefined) ?? onCut(got, cutG)],
      ['drill hole', 'drill holes', drillHoles(want), drillHoles(got)],
    ];
    for (const [one, many, a, c] of marks) {
      if (a.length !== c.length) say(`${a.length} ${a.length === 1 ? one : many} drafted, ${c.length} read back`);
      const off = a.map((q) => Math.min(Infinity, ...c.map((r) => len(sub(sub(q, shift), r))))).filter((d) => d > MARK_TOL);
      if (off.length) say(`${off.length} ${off.length === 1 ? one : many} read back up to ${r1(Math.max(...off) * 10)} mm from where ${off.length === 1 ? 'it was' : 'they were'} drafted`);
    }
  });
  return out;
}

export function roundTripDesign(d: PatternDesign, values: MeasurementValues = EXAMPLE_BODY): PatternResult {
  try {
    const { made } = printedPattern(d, values);
    return { key: d.key, problems: dxfProblems(made.pieces) };
  } catch (e) {
    return { key: d.key, problems: [], error: String(e) };
  }
}
