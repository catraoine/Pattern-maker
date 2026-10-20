import { describe, expect, it } from 'vitest';
import { LAUNCH_GARMENTS, inTesting } from './launch';
import { GARMENTS } from './measureFlow';

describe('launch garments', () => {
  it('launches the dress, skirt and bodice and marks every other garment as in testing', () => {
    expect(LAUNCH_GARMENTS.sort()).toEqual(['bodice', 'dress', 'skirt']);
    for (const g of GARMENTS) expect(inTesting(g)).toBe(!LAUNCH_GARMENTS.includes(g));
    expect(inTesting(undefined)).toBe(false);
  });
});
