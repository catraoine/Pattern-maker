import { describe, expect, it } from 'vitest';
import { inTestingNote } from './allRoundWhy';

describe('why a design is not shown turning in cloth', () => {
  it('names the fault and the piece in plain words', () => {
    expect(inTestingNote([{ check: 'seam', part: 'Skirt front to Skirt back', worst: 3 }], true, false)).toBe(
      "The turning view can't show this design well yet: the skirt's seams open up as it turns, so here is its drawing. Your pattern is not affected.",
    );
    expect(inTestingNote([{ check: 'hem', part: 'Hem', worst: 7 }], false, false)).toContain("the hem doesn't hang level yet, so here is its shape");
    expect(inTestingNote([{ check: 'collar', part: 'Collar', worst: 3 }], true, false)).toContain('the collar stands away from the neck');
  });

  it('says so plainly when the sewing never finished', () => {
    expect(inTestingNote(undefined, true, true)).toBe("This design is too new for the turning view: it couldn't be sewn on the form in time, so here is its drawing. Your pattern is not affected.");
  });

  it('never leaves an empty piece name in the line', () => {
    for (const check of ['broken', 'stretched', 'seam', 'jagged', 'fin', 'inside', 'collar', 'hem', 'missing'] as const) {
      const line = inTestingNote([{ check, part: '', worst: 1 }], false, false);
      expect(line).not.toMatch(/undefined|the {2}|\bthe 's/);
    }
  });
});
