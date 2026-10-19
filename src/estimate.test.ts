import { describe, expect, it } from 'vitest';
import { estimateOne, withEstimates } from './estimate';
import { ESTIMATED, EXAMPLE_VALUES, FIELDS, isComplete, type MeasurementValues } from './measurements';
import { extrasFor } from './measureFlow';
import { draftBodice, type BodiceMeasurements } from './engine/bodice';
import { draftDress, type DressMeasurements } from './engine/dress';
import { draftOuter, type OuterMeasurements } from './engine/outerwear';
import { randomArms, randomBody, rng } from './engine/randomBodies';

const drop = (v: MeasurementValues) => Object.fromEntries(Object.entries(v).filter(([id]) => !ESTIMATED.includes(id as never))) as MeasurementValues;

describe('estimated upper-body measurements', () => {
  it('asks only the essentials before a first dress', () => {
    expect(extrasFor('dress').map((f) => f.id)).toEqual(['high_bust', 'shoulder_width', 'nape_to_waist', 'waist_to_hip', 'waist_to_knee']);
  });

  it('never changes a measurement that was taken', () => {
    const r = rng(7);
    const b = randomBody(r);
    expect(withEstimates(b as MeasurementValues)).toEqual(b);
    const some = { ...drop(b as MeasurementValues), neck: 41 };
    expect(withEstimates(some).neck).toBe(41);
  });

  it('lands each estimate inside its typical range, near the measured one', () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const b = randomBody(r) as MeasurementValues;
      const est = withEstimates(drop(b));
      for (const id of ESTIMATED) {
        const f = FIELDS.bodice.find((x) => x.id === id)!;
        expect(est[id]!).toBeGreaterThanOrEqual(f.hard[0]);
        expect(est[id]!).toBeLessThanOrEqual(f.hard[1]);
        // Within a few cm of what the same body measures: the spread the body model itself allows.
        expect(Math.abs(est[id]! - b[id]!)).toBeLessThan(id === 'armscye' ? 4 : id === 'shoulder_length' ? 2 : 3.5);
      }
    }
  });

  it('drafts a bodice, dress, jacket and coat from the essentials alone', () => {
    const r = rng(23);
    for (let i = 0; i < 60; i++) {
      const b = { ...randomBody(r) } as MeasurementValues;
      Object.assign(b, randomArms(b as never, r));
      const v = drop(b);
      for (const g of ['bodice', 'dress', 'jacket', 'coat'] as const) expect(isComplete(v, g)).toBe(true);
      const m = withEstimates(v);
      expect(() => draftBodice(m as BodiceMeasurements, {})).not.toThrow();
      expect(() => draftDress(m as DressMeasurements, {}, {})).not.toThrow();
      expect(() => draftOuter(m as OuterMeasurements, { kind: 'jacket' })).not.toThrow();
      expect(() => draftOuter(m as OuterMeasurements, { kind: 'coat' })).not.toThrow();
    }
  });
});

describe('"Not sure? Estimate it for me" on one measuring page', () => {
  const base: MeasurementValues = { full_bust: 92, waist: 76, full_hip: 102, waist_to_floor: 104 };

  it('puts the high bust a little under the full bust', () => {
    const h = estimateOne('high_bust', base)!;
    expect(h).toBeLessThan(92);
    expect(h).toBeGreaterThan(84);
  });

  it('gives the example body back for the example body', () => {
    for (const id of ['shoulder_width', 'nape_to_waist', 'waist_to_hip', 'waist_to_knee'] as const) expect(estimateOne(id, base)).toBeCloseTo(EXAMPLE_VALUES[id]!, 0);
  });

  it('scales with a bigger, taller body, inside the allowed range', () => {
    const big: MeasurementValues = { full_bust: 120, waist: 104, full_hip: 130, waist_to_floor: 115 };
    expect(estimateOne('shoulder_width', big)!).toBeGreaterThan(estimateOne('shoulder_width', base)!);
    expect(estimateOne('waist_to_knee', big)!).toBeGreaterThan(estimateOne('waist_to_knee', base)!);
    for (const id of ['high_bust', 'shoulder_width', 'nape_to_waist', 'waist_to_hip', 'waist_to_knee'] as const) {
      const [lo, hi] = FIELDS.dress.find((f) => f.id === id)!.hard;
      const v = estimateOne(id, big)!;
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  });
});
