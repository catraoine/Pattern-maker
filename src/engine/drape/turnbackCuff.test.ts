import { describe, expect, it } from 'vitest';
import { optionDesigns, sewDesign } from '../../drapeSweep';

// The turned-back cuff (bug hunt, Nov 14): All round sewed the sleeve without it, so it read as a plain sleeve, and the
// option check sewed it on a long sleeve, which the draft drops it from, so nothing caught that.
describe('All round: the turned-back cuff', () => {
  it.each(['bodice', 'dress'])('is checked on a %s sleeve that takes it', (garment) => {
    const o = optionDesigns().find((x) => x.key === `${garment} sleeveCuff=turnback`)!;
    const saved = o.design.saved as Record<string, { sleeve?: string; bodice?: { sleeve?: string } }>;
    expect(garment === 'dress' ? saved.dress.bodice?.sleeve : saved.bodice.sleeve).toBe('elbow');
  });

  // (A turned-back cuff the drawing leaves out is scored as missing, so passing means it is drawn.)
  it.each(['bodice', 'dress'])('is drawn on the %s, with nothing wrong', (garment) => {
    const o = optionDesigns().find((x) => x.key === `${garment} sleeveCuff=turnback`)!;
    expect(sewDesign(o.design).quality?.problems ?? []).toEqual([]);
  });
});
