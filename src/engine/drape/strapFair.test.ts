import { describe, expect, it } from 'vitest';
import { COLLECTION } from '../../collection';
import { EXAMPLE_BODY } from '../../measurements';
import { roundDress } from '../allRound';
import { draftDress } from '../dress';
import { clothCard } from './clothCard';
import { runDrape } from './run';

// The Ivory Bias Slip's straps (2026-11-11, "the strap tips"): the cloth just below each shoulder seam settled 2 to
// 3 cm further out than the seam's own end and showed from the front as a tip flicking out past the strap.
describe('a slip strap lying straight over the shoulder', () => {
  it('the armhole edge near the shoulder seam stays inside the seam end', () => {
    const m = EXAMPLE_BODY;
    const c = COLLECTION.find((l) => l.id === 'ivory-slip')!.choices as never as { bodice: never; skirt: never };
    const d = draftDress(m as never, c.bodice, c.skirt);
    const out = runDrape({ kind: 'dress', draft: d, m: m as never, armhole: roundDress(d, m as never).armhole, card: clothCard({ fibre: 'silk', special: 'satin' }) });
    expect(out.quality?.problems).toEqual([]);
    const end = Math.max(...out.lines.filter((l) => l.kind === 'shoulder').flatMap((l) => l.ids.map((i) => out.pos[i * 3])));
    for (const l of out.lines.filter((x) => x.kind === 'armhole')) {
      // (The top of the armhole: its five highest points, heights measured downward.)
      const top = l.ids.slice().sort((a, b) => out.pos[a * 3 + 1] - out.pos[b * 3 + 1]).slice(0, 5);
      for (const i of top) expect(out.pos[i * 3]).toBeLessThanOrEqual(end + 0.3);
    }
  }, 120_000);
});
