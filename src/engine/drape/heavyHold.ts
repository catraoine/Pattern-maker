import { BUST_Y } from './fitMap';
import { knob } from './knob';
import type { Space } from './space';

/** The body's round at the bust, in cm, as the form is drawn for this wearer. */
function bustRound(sp: Space): number {
  const c = sp.cOf(BUST_Y);
  const n = 72;
  let round = 0;
  let prev: [number, number] | undefined;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * 2 * Math.PI;
    const r = sp.bodyR(a, c);
    const q: [number, number] = [Math.sin(a) * r, Math.cos(a) * r];
    if (prev) round += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return round;
}

/**
 * How hard a dress's bodice is held to its cut length down its lines, under the skirt's weight (sim.ts `chain`): fully,
 * so the skirt doesn't draw the bodice down. But over a fuller bust the lines curve further round it, and each hold
 * drew the lower end straight up toward the upper one, through the bust, where the form pushed it out again a little
 * higher: from about a 100 cm bust the bodice ratcheted up the body, stretched and sank inside it, and every dress
 * failed (the engineering review's large bodies, Nov 10). Held fully up to a 96 cm bust, then more gently, 0.7 by
 * 102 cm, it settles where it is cut to; the example body (82 cm) and everything near it is held as before.
 */
export function heavyChainK(sp: Space): number {
  const over = bustRound(sp) - 96;
  return knob('__heavyK') ?? (over <= 0 ? 1 : Math.max(0.6, 1 - over * 0.05));
}
