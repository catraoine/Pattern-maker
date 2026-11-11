import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../../measurements';
import { roundDress } from '../allRound';
import { draftDress } from '../dress';
import { randomBody, rng } from '../randomBodies';
import { clothCard } from './clothCard';
import { runDrape } from './run';

// A cowl neck dress in silk satin: before its fall was smoothed (cowlFair.ts) the fold's edge settled in a zigzag,
// dipping and rising again on its way out to the shoulder, and on about half of bodies the crumpled cloth under it
// failed the quality check, so All round fell back to the flat drawing (2026-11-11).
describe('a cowl neck turning in cloth', () => {
  it.each([
    ['the example body', undefined],
    ['body 1', 1],
    ['body 3', 3],
  ] as const)('%s: the fold rises in one curve from the centre front to the shoulder', (_, seed) => {
    const m = seed ? randomBody(rng(seed)) : EXAMPLE_BODY;
    const d = draftDress(m as never, { fit: 'regular', neckline: 'cowl', sleeve: 'none', darts: 'bust' } as never, { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never);
    const out = runDrape({ kind: 'dress', draft: d, m: m as never, armhole: roundDress(d, m as never).armhole, card: clothCard({ fibre: 'silk', special: 'satin' }) });
    expect(out.quality?.problems).toEqual([]);
    const front = out.panels.find((p) => p.role === 'front')!;
    const own = (i: number) => i >= front.base && i < front.base + front.uv.length / 2;
    const edge = [...new Set(out.lines.filter((l) => l.kind === 'neck' && l.ids.every(own)).flatMap((l) => l.ids))].sort((a, b) => front.uv[(a - front.base) * 2] - front.uv[(b - front.base) * 2]);
    expect(edge.length).toBeGreaterThan(5);
    // (Heights are measured downward: each point out from the centre is no lower than the one before it.)
    for (let k = 1; k < edge.length; k++) expect(out.pos[edge[k] * 3 + 1]).toBeLessThanOrEqual(out.pos[edge[k - 1] * 3 + 1] + 0.01);
  }, 120_000);
});
