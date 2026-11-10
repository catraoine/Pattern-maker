import { describe, expect, it } from 'vitest';
import { patternCode } from './patternCode';
import { draftSkirt } from './engine/skirt';

const BODY = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('the pattern code', () => {
  it('reads the build and the body, and changes with the draft', () => {
    const a = draftSkirt(BODY, { silhouette: 'a_line' }).pieces;
    const code = patternCode(a, BODY, '0.1.0+61af03abc');
    expect(code).toMatch(/^61AF-96-0-0-[2-9A-HJ-NP-Z]{4}$/);
    expect(patternCode(draftSkirt(BODY, { silhouette: 'a_line' }).pieces, BODY, '0.1.0+61af03abc')).toBe(code);
    expect(patternCode(draftSkirt(BODY, { silhouette: 'straight' }).pieces, BODY, '0.1.0+61af03abc')).not.toBe(code);
    expect(patternCode(a, BODY, '0.1.0+dev')).toMatch(/^DEV-/);
  });
});
