import { describe, expect, it } from 'vitest';
import { SEAMLY_NAMES, toMeasurementsCsv, toVit } from './measureExport';
import { EXAMPLE_VALUES } from './measurements';

describe('measurement files for other pattern software', () => {
  const values = { ...EXAMPLE_VALUES, front_shoulder_slope: 44.5 };

  it('writes a Seamly2D / Valentina individual measurements file in cm', () => {
    const vit = toVit(values, 'Cat & co');
    expect(vit).toContain('<version>0.3.3</version>');
    expect(vit).toContain('<unit>cm</unit>');
    expect(vit).toContain('<given-name>Cat &amp; co</given-name>');
    expect(vit).toContain('<m name="waist_circ" value="76"/>');
    expect(vit).toContain('<m name="bust_circ" value="92"/>');
    // No known name for it: written as a custom measurement, with its label.
    expect(vit).toMatch(/<m name="@front_shoulder_slope" value="44.5" full_name="Front shoulder slope"/);
    // One row per measurement taken, each name once.
    const names = [...vit.matchAll(/<m name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBe(Object.keys(values).length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves out measurements not taken', () => {
    const vit = toVit({ waist: 70 }, 'A');
    expect([...vit.matchAll(/<m /g)]).toHaveLength(1);
  });

  it('gives every known name once', () => {
    const known = Object.values(SEAMLY_NAMES);
    expect(new Set(known).size).toBe(known.length);
  });

  it('writes a table in cm and inches', () => {
    const csv = toMeasurementsCsv({ waist: 76, full_hip: 102 }).split('\r\n');
    expect(csv[0]).toBe('Measurement,cm,in,Seamly2D name,How it was taken');
    expect(csv[1].startsWith('Waist,76,29.9,waist_circ,')).toBe(true);
    expect(csv[2].startsWith('Full hip,102,40.2,hip_circ,')).toBe(true);
  });
});
