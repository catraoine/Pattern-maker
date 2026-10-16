import { describe, expect, it } from 'vitest';
import { BASE, extrasFor, forHelper, missingFor, moreFor, stepsOf, tipOf, titleOf } from './measureFlow';

describe('measuring flow', () => {
  it('takes the same base set for every garment', () => {
    expect(BASE).toEqual(['full_bust', 'waist', 'full_hip', 'waist_to_floor']);
  });

  it('asks a skirt for just its two lengths once the base set is in', () => {
    const v = { full_bust: 92, waist: 76, full_hip: 102, waist_to_floor: 104 };
    expect(missingFor('skirt', v).map((f) => f.id)).toEqual(['waist_to_hip', 'waist_to_knee']);
  });

  it('remembers extras from one garment for the next', () => {
    const v = { full_bust: 92, waist: 76, full_hip: 102, waist_to_floor: 104, waist_to_hip: 20, waist_to_knee: 58 };
    expect(missingFor('skirt', v)).toEqual([]);
    const dress = missingFor('dress', v).map((f) => f.id);
    expect(dress).not.toContain('waist_to_knee');
    expect(dress.length).toBe(extrasFor('dress').length - 2);
  });

  it('words pages for a helper', () => {
    expect(titleOf('waist', false)).toBe('Your waist');
    expect(titleOf('waist', true)).toBe('Their waist');
    expect(titleOf('waist_to_floor', true)).toBe('Waist to floor');
    expect(tipOf('neck', true)).not.toMatch(/\byour\b/i);
    expect(forHelper('Down your side, as you would.')).toBe('Down their side, as they would.');
    expect(stepsOf('waist', true).join(' ')).not.toMatch(/\byour\b/i);
  });

  it('builds how-to steps for any measurement', () => {
    for (const f of extrasFor('dress')) expect(stepsOf(f.id, false).length).toBeGreaterThan(1);
  });

  it('counts in words', () => {
    expect(moreFor(2, 'skirt')).toBe('Two more for a skirt.');
    expect(moreFor(4, 'trousers')).toBe('Four more for trousers.');
  });
});
