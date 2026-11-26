import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../measurements';
import { DEFAULT_TROUSERS_CHOICES } from '../garments';
import { SEAM_WIDTHS } from './allowances';
import { draftTrousers } from './trousers';
import { trousersGuide } from './trousersGuide';

// The crotch is sewn at 1 cm while the other seams are 1.5 cm at home: a barrel trouser tester sewed it at 1.5 like the
// rest and only saw at the fly that it differs (fit audit, findings row 161). The step says so, unless every seam is 1 cm.
describe('the crotch seam step', () => {
  const crotch = (closure: 'fly' | 'side_zip' | 'elastic', seams = SEAM_WIDTHS.home) => {
    const d = draftTrousers(EXAMPLE_BODY as never, { ...DEFAULT_TROUSERS_CHOICES, ...(closure === 'elastic' ? { waist: 'elastic' } : { closure }) } as never);
    return trousersGuide(d, 2, { seams }).steps.find((s) => s.title === 'Sew the crotch seam')!.text;
  };
  it('says the 1 cm is narrower than the other seams, with a fly and without', () => {
    for (const c of ['fly', 'elastic'] as const) expect(crotch(c)).toContain('Sew it 1 cm from the edge, narrower than the other seams, twice');
  });
  it('says nothing extra when every seam is 1 cm', () => {
    expect(crotch('fly', SEAM_WIDTHS.industry)).toContain('Sew it 1 cm from the edge twice');
  });
});
