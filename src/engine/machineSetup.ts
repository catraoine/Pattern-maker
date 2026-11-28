// The tech pack's machine set-up for the chosen cloth: needle, stitch length, thread and a tension check. A seam
// can be the right type and still pucker on a needle too thick or a top tension too tight for the cloth (the first
// finished dress, Nov 28), and the pack said nothing about either.
//
// Stitch lengths are the number on the machine's dial, never "mm": a length written in mm is turned into inches with
// every other measurement.
import type { MyFabric } from './fabrics';
import type { Special } from './specialFabrics';

// The special cloths' needles are already in the pack's fabric lines ("You'll need"), so only the stitch is given here.
const SPECIAL_STITCH: Record<Special, string> = {
  denim: 'Stitch length 3 for seams and 3.5 for topstitching.',
  leather: 'Stitch length 3.5: short stitches perforate the hide and it tears along them.',
  velvet: 'Stitch length 2.5 to 3, sewing in the direction of the pile.',
  corduroy: 'Stitch length 2.5 to 3, sewing in the direction of the pile.',
  sheer: 'Stitch length 1.8 to 2, with fine thread.',
  satin: 'Stitch length 2 to 2.5, with fine thread.',
  lace: 'Stitch length 2 to 2.5, with fine thread.',
  sequins: 'Stitch length 2.5 to 3.',
};

const TENSION =
  'Tension: sew a test seam on two layers of the real cloth before you start. If it puckers, fit a new needle one size finer, loosen the top tension one step at a time, and hold the cloth lightly taut in front of and behind the foot.';

/** Needle, stitch, thread and tension lines for a woven cloth. With nothing recorded, the sizes for each weight.
 *  (A knit garment's steps open with their own "Set up your machine", so the pack leaves this out for them.) */
export function machineSetup(f: MyFabric | undefined): string[] {
  if (f?.special) return [SPECIAL_STITCH[f.special], TENSION];
  const byWeight = {
    light: ['Needle: Microtex or universal 70/10, new for this garment.', 'Stitch length 2 to 2.5, with fine polyester or cotton thread.'],
    medium: ['Needle: universal 80/12, new for this garment.', 'Stitch length 2.5, with all-purpose polyester thread.'],
    heavy: ['Needle: universal 90/14, or 100/16 for a coating.', 'Stitch length 3, with all-purpose polyester thread.'],
  };
  if (f?.weight) return [...byWeight[f.weight], TENSION];
  return ['Needle: 70/10 for a light cloth, 80/12 for a medium one, 90/14 for a heavy one. Fit a new one for this garment.', 'Stitch length 2 to 2.5 on a light cloth, 2.5 on a medium one, 3 on a heavy one.', TENSION];
}
