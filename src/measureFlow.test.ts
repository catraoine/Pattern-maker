import { describe, expect, it } from 'vitest';
import { BASE, begun, extrasFor, forHelper, fullSetMissing, missingFor, neededFor, mistakesOf, stepsOf, stringOf, tipOf, titleOf } from './measureFlow';
import { FIELDS } from './measurements';

describe('measuring flow', () => {
  it('suggests a string at the waist, then starts the lengths from it', () => {
    expect(stringOf('waist', false)).toMatch(/Tie it round your waist/);
    expect(stringOf('waist', true)).toMatch(/their waist/);
    for (const id of ['waist_to_floor', 'waist_to_hip', 'nape_to_waist'] as const) expect(stringOf(id, false)).toMatch(/Start from it/);
    expect(stringOf('full_bust', false)).toBeUndefined();
  });

  it('has the arms lowered before shoulder width is read', () => {
    expect(stepsOf('shoulder_width', false).join(' ')).toMatch(/Lower both arms.*Measure straight across/);
    expect(stepsOf('shoulder_width', true).join(' ')).not.toMatch(/\byour?\b/i);
  });

  it('lists the common mistakes for every measurement, worded for a friend holding the tape too', () => {
    for (const f of Object.values(FIELDS).flat()) expect(mistakesOf(f.id, false).length).toBeGreaterThan(1);
    expect(mistakesOf('waist', false).join(' ')).toMatch(/your tummy/);
    expect(mistakesOf('waist', true).join(' ')).toMatch(/their tummy/);
    expect(mistakesOf('waist', true).join(' ')).not.toMatch(/\byour?\b/i);
  });

  it('takes the same base set for every garment', () => {
    expect(BASE).toEqual(['waist', 'full_bust', 'full_hip', 'waist_to_floor', 'height']);
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

  it('measuring again asks only what the garment still needs, a missing base one first, never one already taken', () => {
    // No bust and no waist to floor: a bodice asks the bust (it doesn't use the waist to floor), then its extras.
    const v = { waist: 66, full_hip: 86, height: 165, waist_to_hip: 18 };
    const bodice = neededFor('bodice', v).map((f) => f.id);
    expect(bodice[0]).toBe('full_bust');
    expect(bodice).not.toContain('waist_to_floor');
    expect(bodice).not.toContain('full_hip');
    expect(bodice.slice(1)).toEqual(missingFor('bodice', v).map((f) => f.id));
    expect(neededFor('skirt', { ...v, full_bust: 92, waist_to_floor: 104 }).map((f) => f.id)).toEqual(['waist_to_knee']);
    expect(begun(v)).toBe(true);
    expect(begun({})).toBe(false);
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

  it('takes every measurement for something else, skipping what is already in', () => {
    const v = { full_bust: 92, waist: 76, full_hip: 102, waist_to_floor: 104, waist_to_knee: 58 };
    const ids = fullSetMissing(v).map((f) => f.id);
    expect(ids).toContain('nape_to_waist');
    expect(ids).toContain('crotch_depth');
    expect(ids).not.toContain('waist');
    expect(ids).not.toContain('waist_to_knee');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
