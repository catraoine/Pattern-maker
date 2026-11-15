import { knob } from './knob';

/**
 * How a puff sleeve stands out at a point across its cut (x, from the crown's middle; half, the sleeve's half width).
 * The crown's gathers lie over the top of the arm, between the notches: underneath, where the sleeve's seam meets the
 * bodice's side, it is cut plain, so it stands out less there (`stand`), and eases out further from the armhole seam
 * (`ramp`, cm: 16 over the top, more underneath). Stood out as far all round, eased out over 12 cm, it pulled the
 * underarm to 2.7 times its cut and puff-sleeved dresses in cotton, wool and linen fell back to the drawing (the How it
 * works film's dress, Nov 15). 19 of 20 puffs pass now, 14 before.
 */
export function puffUnder(x: number, half: number): { ramp: number; stand: number } {
  const under = knob('__puffUnder') ?? 0.3;
  const s = Math.min(1, Math.max(0, (Math.abs(x) / half - 0.55) / 0.45));
  const smooth = s * s * (3 - 2 * s);
  return { ramp: (knob('__puffRamp') ?? 16) * (1 + (knob('__puffRampUnder') ?? 0.5) * s), stand: 1 - (1 - under) * smooth };
}
