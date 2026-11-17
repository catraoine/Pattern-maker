import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { withEstimates } from './estimate';
import { walkDesign } from './patternSweep';
import type { MeasurementValues } from './measurements';

// On 6 of 300 hand-measured bodies the Chocolate Barrel Trouser's hip double notch sat across the foot of the slant
// pocket: its top half went to the pocket facing with the cut-away corner and its bottom half stayed on the front, so the
// front's side seam had half a double notch where the back has a whole one (tester sweep, Nov 16). The opening now ends
// just above such a notch, and the front carries the whole double notch.
const BODIES = [
  'height=157 full_bust=128 high_bust=112 waist=81 full_hip=134 waist_to_hip=21 front_waist_to_hip=21 back_waist_to_hip=21 waist_to_knee=56 waist_to_floor=98 nape_to_waist=37 front_hps_to_waist=45 bust_depth=33 crotch_depth=29 crotch_length=86',
  'height=150 full_bust=108 high_bust=100 waist=72 full_hip=105 waist_to_hip=25 front_waist_to_hip=25 back_waist_to_hip=25 waist_to_knee=53 waist_to_floor=94 nape_to_waist=43 front_hps_to_waist=53 bust_depth=33 crotch_depth=25 crotch_length=74',
  'height=171 full_bust=98 high_bust=96 waist=69 full_hip=123 waist_to_hip=21 front_waist_to_hip=21 back_waist_to_hip=21 waist_to_knee=61 waist_to_floor=107 nape_to_waist=45 front_hps_to_waist=55 bust_depth=30 crotch_depth=31 crotch_length=90',
  'height=157 full_bust=110 high_bust=100 waist=72 full_hip=112 waist_to_hip=25 front_waist_to_hip=25 back_waist_to_hip=25 waist_to_knee=56 waist_to_floor=98 nape_to_waist=39 front_hps_to_waist=45 bust_depth=33 crotch_depth=25 crotch_length=68',
  'height=157 full_bust=90 high_bust=80 waist=64 full_hip=96 waist_to_hip=23 front_waist_to_hip=23 back_waist_to_hip=23 waist_to_knee=56 waist_to_floor=98 nape_to_waist=39 front_hps_to_waist=43 bust_depth=27 crotch_depth=25 crotch_length=70',
  'height=150 full_bust=122 high_bust=120 waist=86 full_hip=126 waist_to_hip=25 front_waist_to_hip=25 back_waist_to_hip=25 waist_to_knee=53 waist_to_floor=94 nape_to_waist=39 front_hps_to_waist=43 bust_depth=27 crotch_depth=25 crotch_length=74',
];

describe('the Chocolate Barrel Trouser hip notches by the slant pocket', () => {
  const look = COLLECTION.find((l) => l.name === 'Chocolate Barrel Trouser')!;
  for (const body of BODIES) {
    it(`${body.split(' ').slice(3, 6).join(' ')}: the front and back side notches match`, () => {
      const values = withEstimates(Object.fromEntries(body.split(' ').map((kv) => { const [k, x] = kv.split('='); return [k, Number(x)]; })) as unknown as MeasurementValues);
      const { garment, ...saved } = lookPatch(look, values);
      const { problems } = walkDesign({ key: look.name, garment, saved: saved as never, finish: look.finish }, values);
      // A crotch length out of step with the depth is flagged on screen with a re-measure note; that is not this.
      expect(problems.filter((p) => !/^Crotch seam to your crotch length/.test(p))).toEqual([]);
    });
  }
});
