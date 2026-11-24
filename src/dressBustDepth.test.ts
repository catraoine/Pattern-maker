import { describe, expect, it } from 'vitest';
import { COLLECTION } from './collection';
import { unusedFor, type DressChoices } from './garments';
import { fieldsFor } from './measurements';

// A shift tester's guessed bust point put her dart about 8 cm above her own (round 1 fit report, Nov 23). Cat, Nov 24:
// a dress with a bust dart asks for shoulder to bust point and front length in its standard steps, as a top does.
describe('a dress and its bust point', () => {
  const shift = COLLECTION.find((l) => l.name === 'Blush Shift')!.choices as DressChoices;
  const asked = (form?: 'womenswear' | 'menswear') => fieldsFor('dress', form).filter((f) => !f.optional).map((f) => f.id);

  it('asks for both on a darted dress, the Blush Shift among them', () => {
    expect(asked()).toEqual(expect.arrayContaining(['front_hps_to_waist', 'bust_depth']));
    expect(unusedFor(shift)).toEqual([]);
  });
  it('leaves them to the guess on a dress with no bust dart, but not on a shift, which always has one', () => {
    const seamed = { ...shift, skirt: { ...shift.skirt, noSeam: undefined } } as DressChoices;
    expect(unusedFor({ ...seamed, bodice: { ...seamed.bodice, darts: 'none' } })).toEqual(['front_hps_to_waist', 'bust_depth']);
    expect(unusedFor({ ...seamed, fit: 'boxy' })).toEqual([]);
    expect(unusedFor({ ...shift, bodice: { ...shift.bodice, darts: 'none' } })).toEqual([]);
  });
  it('asks neither on the menswear form, which has no bust shaping', () => {
    expect(asked('menswear')).not.toContain('front_hps_to_waist');
    expect(asked('menswear')).not.toContain('bust_depth');
  });
});
