import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftTrousers } from './trousers';
import { toDxf } from './dxf';
import { checkFile, edgesOf, parseDxf, parseSvg, pathPoints, readPatternFile } from './checkFile';
import { withAllowances } from './allowances';
import { p, taggedLength } from './geometry';

const SKIRT = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('check any pattern', () => {
  it('reads its own DXF back: pieces, names, sizes and stitching lines', () => {
    const d = draftSkirt(SKIRT, { silhouette: 'straight' });
    const pieces = d.pieces.map((pc) => withAllowances(pc, 'home'));
    const read = parseDxf(toDxf(pieces, { style: 'Test', size: 'Cat', date: '2026-10-16' }));
    expect(read.map((r) => r.name)).toEqual(['Skirt front', 'Skirt back']);
    expect(read.every((r) => r.stitch)).toBe(true);
    const h = (pts: { y: number }[]) => Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y));
    expect(h(read[0].stitch!)).toBeCloseTo(h(pieces[0].outline.points()), 0);
  });

  it('pairs the side seams of a skirt within a millimetre', () => {
    const d = draftSkirt(SKIRT, { silhouette: 'a_line' });
    const read = parseDxf(toDxf(d.pieces, { style: 'Test', size: 'Cat', date: '2026-10-16' }));
    const res = checkFile(read);
    const side = taggedLength(d.pieces[0].outline, 'side');
    const pair = res.pairs.find((pr) => pr.a.piece !== pr.b.piece && Math.abs(pr.a.length - side) < 0.5);
    expect(pair?.ok).toBe(true);
  });

  it('pairs the inside legs and side seams of trousers', () => {
    const d = draftTrousers({ ...SKIRT, crotch_depth: 27, crotch_length: 70 });
    const res = checkFile(parseDxf(toDxf(d.pieces.slice(0, 2), { style: 'T', size: 'Cat', date: '2026-10-16' })));
    for (const tag of ['side', 'inseam']) {
      const L = taggedLength(d.pieces[0].outline, tag);
      expect(res.pairs.some((pr) => pr.ok && pr.a.piece !== pr.b.piece && Math.abs(pr.a.length - L) < 1)).toBe(true);
    }
  });

  it('reads an SVG at its stated size, and flags a seam 2 mm out', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="300mm" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="white"/>
      <polygon id="Front" points="10,10 110,10 110,210 10,210"/>
      <path id="Back" d="M150 10 h100 v202 h-100 Z"/>
    </svg>`;
    const read = readPatternFile('pattern.svg', svg);
    expect(read.map((r) => r.name)).toEqual(['Front', 'Back']);
    const res = checkFile(read);
    const long = res.pairs.filter((pr) => pr.a.length > 15 && pr.a.piece !== pr.b.piece);
    expect(long.length).toBeGreaterThan(0);
    expect(long.some((pr) => !pr.ok && pr.diffMm === 2)).toBe(true);
    expect(res.pairs.some((pr) => pr.ok && Math.abs(pr.a.length - 10) < 0.01)).toBe(true);
  });

  it('flattens curves in paths and finds only real corners', () => {
    const [ring] = pathPoints('M0 0 L10 0 C14 0 20 6 20 10 L20 20 L0 20 Z');
    expect(ring.length).toBeGreaterThan(16);
    // The curve leaves and meets its lines smoothly, so the corners are the three square ones.
    const e = edgesOf(ring, 0);
    expect(e).toHaveLength(3);
    expect(edgesOf([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 0)).toHaveLength(4);
  });

  it('reads an SVG drawn in pixels as 96 to the inch', () => {
    const read = parseSvg('<svg><polygon points="0,0 96,0 96,96 0,96"/></svg>');
    expect(read[0].pts[1].x).toBeCloseTo(2.54, 2);
  });
});
