import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftTrousers } from './trousers';
import { sewingGuide, bodiceGuide } from './instructions';
import { LAYER, quantity, toDxf } from './dxf';
import { allowanceText, toTechPack } from './techpack';
import { bodiceSpec, skirtSpec } from './spec';
import { cutLine } from './piece';
import { EXAMPLE_VALUES } from '../measurements';
import type { SkirtMeasurements } from './skirt';
import type { BodiceMeasurements } from './bodice';

const sm = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const info = { style: 'Knee A-line skirt', size: 'Cat', date: '2026-10-14' };

/** Group codes and values from a DXF file. */
function pairs(dxf: string): [string, string][] {
  const lines = dxf.split('\r\n');
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([lines[i].trim(), lines[i + 1]]);
  return out;
}

function segDist(q: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * abx + (q.y - a.y) * aby) / l2)) : 0;
  return Math.hypot(q.x - a.x - abx * t, q.y - a.y - aby * t);
}

describe('DXF export', () => {
  const skirt = draftSkirt(sm, { silhouette: 'a_line', length: 'knee' });
  const dxf = toDxf(skirt.pieces, info);
  const g = pairs(dxf);

  it('is a well-formed R12 file with one block per piece', () => {
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
    expect(g.filter(([c, v]) => c === '0' && v === 'BLOCK')).toHaveLength(skirt.pieces.length);
    expect(g.filter(([c, v]) => c === '0' && v === 'INSERT')).toHaveLength(skirt.pieces.length);
    expect(g.filter(([c, v]) => c === '0' && v === 'POLYLINE').length).toBe(g.filter(([c, v]) => c === '0' && v === 'SEQEND').length);
  });

  it('puts cut, stitch, grain, fold and notches on the AAMA layers', () => {
    const layers = new Set(g.filter(([c]) => c === '8').map(([, v]) => v));
    for (const l of [LAYER.boundary, LAYER.sew, LAYER.grain, LAYER.notch, LAYER.internal, LAYER.mirror]) expect(layers.has(l)).toBe(true);
  });

  it('writes the cut line at true size in millimetres', () => {
    const front = skirt.pieces[0];
    const xs = cutLine(front).map((q) => q.x);
    const widthMm = (Math.max(...xs) - Math.min(...xs)) * 10;
    // The first closed polyline in the first block is the front's cut line.
    const start = g.findIndex(([c, v]) => c === '0' && v === 'POLYLINE');
    const end = g.findIndex(([c, v], i) => i > start && c === '0' && v === 'SEQEND');
    const vx = g.slice(start, end).filter(([c]) => c === '10').slice(1).map(([, v]) => Number(v));
    expect(Math.max(...vx) - Math.min(...vx)).toBeCloseTo(widthMm, 1);
  });

  it('puts every notch on the cut line, whatever the edge allowance, and drill holes on layer 13', () => {
    const tr = draftTrousers({ ...sm, crotch_depth: 27, crotch_length: 70 } as never);
    const bd = draftBodice(EXAMPLE_VALUES as unknown as BodiceMeasurements);
    for (const pieces of [skirt.pieces, tr.pieces, bd.pieces]) {
      const gg = pairs(toDxf(pieces, info));
      let block = -1;
      gg.forEach(([c, v], i) => {
        if (c === '0' && v === 'BLOCK') block++;
        if (c !== '0' || v !== 'POINT' || gg[i + 1][1] !== LAYER.notch) return;
        const at = { x: Number(gg[i + 2][1]) / 10, y: -Number(gg[i + 3][1]) / 10 };
        const cut = cutLine(pieces[block]);
        const near = cut.reduce((m, q, k) => Math.min(m, segDist(at, q, cut[(k + 1) % cut.length])), Infinity);
        expect(near).toBeLessThan(0.01);
      });
    }
    const bodiceDxf = pairs(toDxf(bd.pieces, info));
    expect(bodiceDxf.some(([c, v], i) => c === '0' && v === 'POINT' && bodiceDxf[i + 1][1] === LAYER.drill)).toBe(true);
  });

  it('labels each piece with name and quantity', () => {
    expect(dxf).toContain('Piece Name: Skirt front');
    expect(dxf).toContain('Quantity: 2');
    expect(dxf).toContain('Units: METRIC');
    expect(quantity('Cut 1 on fold')).toBe(1);
    expect(quantity('Cut 2 (1 pair)')).toBe(2);
  });
});

describe('tech pack', () => {
  it('builds for a skirt and a bodice', async () => {
    const skirt = draftSkirt(sm, { silhouette: 'a_line', length: 'knee' });
    const bm = EXAMPLE_VALUES as BodiceMeasurements;
    const bodice = draftBodice(bm, {});
    const packs = [
      { pieces: skirt.pieces, measurements: skirtSpec(sm as SkirtMeasurements, skirt), guide: sewingGuide(skirt, { silhouette: 'a_line', length: 'knee' }, 1.4) },
      { pieces: bodice.pieces, measurements: bodiceSpec(bm, bodice, 'waist'), guide: bodiceGuide(bodice, { length: 'waist' }, 1, 2) },
    ];
    for (const p of packs) {
      const bytes = await toTechPack({ title: 'test pattern', profile: 'Cat', fit: 'Regular', date: '2026-10-14', notes: ['A note.'], ...p });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    }
  });

  it('shows ease as finished minus body', () => {
    const skirt = draftSkirt(sm, { fit: 'regular' });
    const waist = skirtSpec(sm, skirt)[0];
    expect(waist).toEqual({ label: 'Waist', body: 70, ease: 2, finished: 72 });
  });

  it('lists seam allowances that differ by edge', () => {
    const skirt = draftSkirt(sm, {});
    expect(allowanceText(skirt.pieces[1])).toBe('1.5 cm, hem 4 cm');
  });
});

describe('note to the dressmaker', () => {
  it('names the garment and who it is for', async () => {
    const { makerNote } = await import('../screens/ExportScreen');
    const note = makerNote('knee a-line skirt', 'Cat');
    expect(note).toContain('make this knee a-line skirt');
    expect(note).toContain('Thank you, Cat');
  });
});
