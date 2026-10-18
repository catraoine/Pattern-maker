import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftTrousers } from './trousers';
import { draftOuter } from './outerwear';
import { withAllowances } from './allowances';
import { quantity, toDxf } from './dxf';
import { importDxf, importedGuide } from './importDxf';
import { Piece, cutLine } from './piece';
import { P, len, sub } from './geometry';
import { layout } from './export';
import { toTiledPdf } from './pdf';
import { toTechPack } from './techpack';
import { EXAMPLE_VALUES } from '../measurements';
import type { BodiceMeasurements } from './bodice';

const SKIRT = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const info = { style: 'Round trip', size: 'Cat', date: '2026-10-18' };

const open = (pts: P[]) => (pts.length > 1 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.slice(0, -1) : pts);
const origin = (pc: Piece) => {
  const c = cutLine(pc);
  return { x: Math.min(...c.map((q) => q.x)), y: Math.min(...c.map((q) => q.y)) };
};
/** Every point within 0.01 mm of its partner, after moving the original to where the import puts it. */
function same(a: P[], b: P[], shift: P = { x: 0, y: 0 }) {
  expect(b).toHaveLength(a.length);
  a.forEach((q, i) => expect(len(sub(sub(q, shift), b[i]))).toBeLessThan(0.001));
}

/** The POINT entities on one layer of each block, in mm. */
function blockPoints(dxf: string, layer: string): P[][] {
  const l = dxf.split('\r\n');
  const out: P[][] = [];
  for (let i = 0; i + 1 < l.length; i += 2) {
    if (l[i] === '0' && l[i + 1] === 'BLOCK') out.push([]);
    if (l[i] === '0' && l[i + 1] === 'POINT' && l[i + 3] === layer) out[out.length - 1].push({ x: Number(l[i + 5]), y: Number(l[i + 7]) });
  }
  return out;
}

/** Read our own export back and check every mark lands where it was drawn. */
function roundTrip(pieces: Piece[]) {
  const dxf = toDxf(pieces, info);
  const back = importDxf(dxf);
  // Writing the imported pieces out again puts every notch and drill hole where the first file had
  // it, to half a millimetre (a notch at a corner can snap to the other edge's allowance).
  const again = toDxf(back.pieces, info);
  for (const layer of ['4', '13']) {
    const a = blockPoints(dxf, layer);
    const b = blockPoints(again, layer);
    pieces.forEach((pc, i) => {
      const o = origin(pc);
      expect(b[i]).toHaveLength(a[i].length);
      for (const q of a[i]) {
        const want = { x: q.x - o.x * 10, y: q.y + o.y * 10 };
        expect(Math.min(...b[i].map((r) => len(sub(r, want))))).toBeLessThan(0.5);
      }
    });
  }
  back.pieces.forEach((got, i) => {
    const want = pieces[i];
    const o = origin(want);
    expect(got.cut).toBe(want.cut);
    expect(quantity(got.cut)).toBe(quantity(want.cut));
    same(open(cutLine(want)), cutLine(got), o);
    same(open(want.outline.points()), open(got.outline.points()), o);
    expect(got.lines).toHaveLength(want.lines.length);
    got.lines.forEach((ln, k) => same(want.lines[k].points(), ln.points(), o));
    if (want.grain) same(want.grain, got.grain!, o);
    else expect(got.grain).toBeUndefined();
    if (want.fold) same(want.fold, got.fold!, o);
  });
  return back;
}

describe('import a pattern from pro software', () => {
  it('reads a skirt back exactly: cut and stitching lines, darts, grain, fold, notches, names', () => {
    const d = draftSkirt(SKIRT, { silhouette: 'a_line', length: 'knee' });
    const back = roundTrip(d.pieces);
    expect(back.style).toBe('Round trip');
    expect(back.size).toBe('Cat');
    expect(back.units).toBe('mm');
    expect(back.source).toBe('Maison Tracé');
    expect(back.pieces[0].seamAllowance).toBe(d.pieces[0].seamAllowance);
    expect(back.pieces[0].meta.imported).toBe(true);
    // The hem's deeper allowance comes back as its own edge, as the tech pack lists it.
    expect(back.pieces[1].allowances.hem).toBe(4);
  });

  it('reads home allowances, a bodice, trousers and a lined jacket', () => {
    roundTrip(draftSkirt(SKIRT, { silhouette: 'straight' }).pieces.map((pc) => withAllowances(pc, 'home')));
    roundTrip(draftBodice(EXAMPLE_VALUES as BodiceMeasurements, {}).pieces);
    roundTrip(draftTrousers({ ...SKIRT, crotch_depth: 27, crotch_length: 70 }).pieces);
    roundTrip(draftOuter(EXAMPLE_VALUES as Parameters<typeof draftOuter>[0], { kind: 'jacket' }).pieces);
  });

  it('writes an imported pattern out again unchanged', () => {
    const first = importDxf(toDxf(draftSkirt(SKIRT, {}).pieces, info));
    const second = importDxf(toDxf(first.pieces, info));
    first.pieces.forEach((pc, i) => {
      same(cutLine(pc), cutLine(second.pieces[i]));
      same(open(pc.outline.points()), open(second.pieces[i].outline.points()));
      expect(second.pieces[i].notches).toHaveLength(pc.notches.length);
    });
  });

  it('gives the pieces to the print, PDF and tech pack tools', async () => {
    const { pieces } = importDxf(toDxf(draftSkirt(SKIRT, {}).pieces, info));
    const sheet = layout(pieces, 'Imported skirt', []);
    const pdf = await PDFDocument.load(await toTiledPdf(sheet, 'a4'));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const tp = await toTechPack({ title: 'imported skirt', profile: 'Cat', fit: 'As drafted', date: '2026-10-18', notes: [], pieces, measurements: [], guide: importedGuide(pieces) });
    expect((await PDFDocument.load(tp)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

/** A small R2000-style file as CLO or Optitex might write it: inches, LWPOLYLINE with a curved
 * edge, layers named "L1", a notch drawn as a short line, a drill circle, and no stitching line. */
const CLO = [
  '999', 'CLO Standard DXF-AAMA export',
  '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '1', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'BLOCKS',
  '0', 'BLOCK', '8', '0', '2', 'FRONT', '70', '0', '10', '0', '20', '0',
  '0', 'LWPOLYLINE', '8', 'L1', '90', '4', '70', '1',
  '10', '0', '20', '0', '10', '10', '20', '0', '42', '0.4142', '10', '10', '20', '10', '10', '0', '20', '10',
  '0', 'LINE', '8', 'L7', '10', '3', '20', '2', '11', '3', '21', '8',
  '0', 'LINE', '8', 'L4', '10', '0', '20', '5', '11', '0.25', '21', '5',
  '0', 'CIRCLE', '8', 'L13', '10', '5', '20', '5', '40', '0.06',
  '0', 'TEXT', '8', 'L1', '10', '2', '20', '6', '40', '0.2', '1', 'Piece Name: Front',
  '0', 'TEXT', '8', 'L1', '10', '2', '20', '5', '40', '0.2', '1', 'Quantity: 2',
  '0', 'TEXT', '8', 'L1', '10', '2', '20', '4', '40', '0.2', '1', 'Category: Lining',
  '0', 'ENDBLK',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'INSERT', '8', '0', '2', 'FRONT', '10', '0', '20', '0',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n');

describe('sewing steps for an imported pattern', () => {
  it('lists the cut, the darts, and the seams found by length', () => {
    const { pieces } = importDxf(toDxf(draftSkirt(SKIRT, { silhouette: 'straight' }).pieces, info));
    const g = importedGuide(pieces);
    const text = g.steps.map((s) => `${s.title}: ${s.text}`).join('\n');
    expect(text).toMatch(/Skirt front: Cut 1 on fold/);
    expect(text).toMatch(/Mark the darts/);
    expect(text).toMatch(/skirt front to skirt back/);
  });
});

describe('files from other programs', () => {
  it('reads a CLO-style file in inches with a curved edge, a line notch and a drill hole', () => {
    const r = importDxf(CLO);
    expect(r.source).toBe('CLO 3D');
    expect(r.units).toBe('in');
    expect(r.pieces).toHaveLength(1);
    const pc = r.pieces[0];
    expect(pc.name).toBe('Front');
    expect(pc.cut).toBe('Cut 2 in lining');
    expect(pc.fabric).toBe('Lining');
    expect(pc.seamAllowance).toBe(0);
    // 10 in square with a quarter circle bulged out of the right edge: 25.4 cm tall, wider than 25.4.
    const c = cutLine(pc);
    const w = Math.max(...c.map((q) => q.x)) - Math.min(...c.map((q) => q.x));
    const h = Math.max(...c.map((q) => q.y)) - Math.min(...c.map((q) => q.y));
    expect(h).toBeCloseTo(25.4, 1);
    expect(w).toBeGreaterThan(25.4 + 4);
    expect(c.length).toBeGreaterThan(8);
    expect(pc.grain).toBeDefined();
    expect(len(sub(pc.grain![1], pc.grain![0]))).toBeCloseTo(6 * 2.54, 3);
    expect(pc.notches).toHaveLength(1);
    // The notch sits on the left edge, halfway down, and points out of the piece.
    expect(pc.notches[0][0].x).toBeCloseTo(0, 3);
    expect(pc.notches[0][0].y).toBeCloseTo(5 * 2.54, 3);
    expect(pc.notches[0][1].x).toBeLessThan(-0.9);
    expect(pc.meta.drills).toHaveLength(1);
    expect(r.notes.join(' ')).toMatch(/cutting lines only/);
  });

  it('reads loose pieces drawn without blocks, assigning marks to the piece they sit in', () => {
    const square = (x: number, layer: string) => ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1', ...[[x, 0], [x + 100, 0], [x + 100, 200], [x, 200]].flatMap(([a, b]) => ['0', 'VERTEX', '8', layer, '10', String(a), '20', String(b)]), '0', 'SEQEND'];
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      ...square(0, '1'),
      ...square(300, '1'),
      '0', 'LINE', '8', '7', '10', '350', '20', '20', '11', '350', '21', '180',
      '0', 'TEXT', '8', '1', '10', '20', '20', '100', '1', 'Piece Name: Back',
      '0', 'TEXT', '8', '1', '10', '320', '20', '100', '1', 'Piece Name: Front',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\r\n');
    const r = importDxf(dxf);
    expect(r.pieces.map((pc) => pc.name)).toEqual(['Back', 'Front']);
    expect(r.pieces[0].grain).toBeUndefined();
    expect(r.pieces[1].grain).toBeDefined();
    expect(r.notes.join(' ')).toMatch(/millimetres were assumed/);
  });

  it('says so when nothing in the file is a piece', () => {
    const r = importDxf(['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '5', '21', '5', '0', 'ENDSEC', '0', 'EOF'].join('\n'));
    expect(r.pieces).toHaveLength(0);
    expect(r.notes[0]).toMatch(/No closed pattern pieces/);
  });
});
