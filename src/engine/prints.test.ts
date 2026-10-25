import { describe, expect, it } from 'vitest';
import { fabricLines, withFabric } from './fabrics';
import { PRINT_IDS, STRIPES_REPEAT, motifExtra, printExtra, printImage, printLines, printNap, printOf, printTileCm } from './prints';

describe('prints', () => {
  it('draws stripes from their own swatch, three repeats to a tile', () => {
    expect(printImage('checks', '/', true)).toBe('/prints/stripes.jpg');
    expect(printImage('checks')).toBe('/prints/checks.jpg');
    expect(printImage('checks', '/', false, true)).toBe('/prints/gingham.jpg');
    expect(printImage('checks', '/', true, true)).toBe('/prints/stripes.jpg');
    expect(printTileCm('checks', undefined, true)).toBe(STRIPES_REPEAT * 3);
    expect(printTileCm('checks', 4, true)).toBe(12);
    expect(printTileCm('checks', undefined)).toBe(30);
  });

  it('reads checks saved before the picker as a checks print', () => {
    expect(printOf({ checks: {} })).toBe('checks');
    expect(printOf({ print: 'motif' })).toBe('motif');
    expect(printOf({})).toBeUndefined();
  });

  it('lays one-way prints and placed motifs the same way up', () => {
    expect(printNap('oneway')).toBe(true);
    expect(printNap('motif')).toBe(true);
    expect(printNap('ditsy')).toBe(false);
    expect(printNap(undefined)).toBe(false);
  });

  it('asks for about one motif repeat more per main piece', () => {
    expect(motifExtra(32, 'skirt')).toBe(0.7);
    expect(motifExtra(undefined, 'dress')).toBe(1.3);
    expect(printExtra('plain', undefined, 'skirt')).toBe(0);
    expect(printExtra('checks', 10, 'skirt')).toBe(0.2);
  });

  it('warns that a circle hem cannot keep a border level', () => {
    expect(printLines('border', undefined, 'skirt', { silhouette: 'circle' }).join(' ')).toMatch(/curves away/);
    expect(printLines('border', undefined, 'skirt', { silhouette: 'a_line' }).join(' ')).not.toMatch(/curves away/);
  });

  it('has nothing to add for plain and small all-over prints', () => {
    expect(printLines('plain', undefined, 'skirt')).toEqual([]);
    expect(printLines('ditsy', undefined, 'skirt')).toEqual([]);
  });

  it('carries the print into the fabric lines and a cutting step', () => {
    expect(fabricLines({ print: 'motif', motif: { repeat: 40 } }, 'skirt').join(' ')).toMatch(/40 cm repeat/);
    const guide = withFabric({ steps: [], notions: [] } as never, { print: 'border' }, 'skirt');
    expect(guide.steps.map((s) => s.title)).toContain('Lay the border');
  });

  it('has a picture for every print', () => {
    expect(PRINT_IDS).toEqual(['plain', 'ditsy', 'oneway', 'motif', 'border', 'checks']);
  });
});
