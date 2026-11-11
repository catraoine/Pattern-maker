import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../../measurements';
import { roundDress } from '../allRound';
import { draftDress } from '../dress';
import { randomBody, rng } from '../randomBodies';
import { clothCard } from './clothCard';
import { runDrape } from './run';

// The bias slip dress (SS27 Look 07, 2026-11-11) in silk satin: before its lower skirt was softened (biasFair.ts) the
// hem's spare width folded into a sharp crease on most bodies and All round fell back to the flat drawing.
describe('a bias slip dress turning in cloth', () => {
  it.each([
    ['the example body, maxi', undefined, 'maxi'],
    ['body 1, maxi', 1, 'maxi'],
    ['body 3, maxi', 3, 'maxi'],
    ['body 5, midi', 5, 'midi'],
  ] as const)('%s draws clean', (_, seed, length) => {
    const m = seed ? randomBody(rng(seed)) : EXAMPLE_BODY;
    const d = draftDress(m as never, { fit: 'regular', neckline: 'scoop', sleeve: 'none', darts: 'bust', bustEase: 4, neck: { frontDepth: 14.5, width: 3.5, backDepth: 18, fullness: 0.6, strap: 4 } } as never, { silhouette: 'straight', length, noSeam: 'bias', flareCm: 24, slit: 'none' } as never);
    const out = runDrape({ kind: 'dress', draft: d, m: m as never, armhole: roundDress(d, m as never).armhole, card: clothCard({ fibre: 'silk', special: 'satin' }) });
    expect(out.quality?.problems).toEqual([]);
  }, 120_000);
});
