// Which garments are launched, and which are still in testing (Cat, 2026-10-20: lead with the dress, skirt and bodice
// until the stage 1 fit gate passes). Every garment stays usable; the others carry a quiet "In testing" tag, so one
// unproven garment can't hurt the launch garments' name. Move a garment here once sewists score it 4 of 5 or better.
import type { Garment } from './measurements';

export const LAUNCH_GARMENTS: Garment[] = ['skirt', 'bodice', 'dress'];

export const IN_TESTING = 'In testing';

/** True for a garment that hasn't passed its fit test yet. */
export const inTesting = (g: Garment | undefined) => !!g && !LAUNCH_GARMENTS.includes(g);
