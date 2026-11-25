import { describe, expect, it } from 'vitest';
import { checkMeasurements, fieldsFor, isComplete, type MeasurementValues } from './measurements';
import { neededFor } from './measureFlow';
import { draftBodice } from './engine/bodice';

// A tester with a high bust bigger than her bust (broad, athletic upper body) found the top's upper back and
// armholes tight (fit report, row 158, Nov 24): both were guessed from the bust. Cat chose to ask those makers only.
const broad: MeasurementValues = { height: 160, full_bust: 94, high_bust: 95.3, waist: 75, full_hip: 99, waist_to_hip: 20, waist_to_floor: 100, shoulder_width: 39, nape_to_waist: 40, front_hps_to_waist: 44, bust_depth: 25, arm_length: 56, upper_arm: 29, wrist: 15.5 };
const usual: MeasurementValues = { ...broad, high_bust: 90 };
const upper = (v: MeasurementValues, g: 'bodice' | 'dress' = 'bodice', form?: 'menswear') => fieldsFor(g, form, v).filter((f) => (f.id === 'across_back' || f.id === 'armscye') && !f.optional).map((f) => f.id);

describe('a top on a broad upper body', () => {
  it('asks across back and armhole when the high bust is at or over the bust, and only then', () => {
    expect(upper(broad)).toEqual(['across_back', 'armscye']);
    expect(upper({ ...broad, high_bust: 94 })).toEqual(['across_back', 'armscye']);
    expect(upper(usual)).toEqual([]);
    expect(upper({ full_bust: 94 })).toEqual([]);
    expect(fieldsFor('bodice')).toEqual(fieldsFor('bodice', 'womenswear', usual));
  });
  it('takes them on the measuring pages, but saved work without them still drafts from the guess', () => {
    expect(isComplete(usual, 'bodice')).toBe(true);
    expect(isComplete(broad, 'bodice')).toBe(true);
    expect(checkMeasurements(broad, 'cm', 'bodice').filter((c) => c.level === 'error')).toEqual([]);
    expect(neededFor('bodice', broad).map((f) => f.id)).toEqual(expect.arrayContaining(['across_back', 'armscye']));
    expect(neededFor('bodice', usual).map((f) => f.id)).not.toContain('across_back');
  });
  it('leaves the dress and the menswear form as they were', () => {
    expect(upper(broad, 'dress')).toEqual([]);
    expect(upper(broad, 'bodice', 'menswear')).toEqual([]);
  });
});

describe('the bust ease on a broad upper body', () => {
  const body = { full_bust: 94, high_bust: 94, waist: 75, neck: 36, shoulder_width: 39, shoulder_length: 12.5, across_back: 36, across_front: 33, nape_to_waist: 40, front_hps_to_waist: 44, bust_depth: 25, apex_separation: 18, armscye: 42 };
  it('goes round the high bust where it is the bigger, so the upper chest gets the room the fit means', () => {
    const even = draftBodice(body).finishedBust;
    expect(draftBodice({ ...body, high_bust: 95.3 }).finishedBust).toBeCloseTo(even + 1.3, 0);
    // A usual body is drafted as before: from its bust.
    expect(draftBodice({ ...body, high_bust: 90 }).finishedBust).toBe(even);
  });
});
