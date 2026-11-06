import { afterEach, describe, expect, it } from 'vitest';
import { bodiceChoices } from '../../collection';
import { sleeveOf, validDetails } from '../../garments';
import { EXAMPLE_BODY } from '../../measurements';
import { placeOnForm } from '../../ui/allRoundShape';
import { roundBodice } from '../allRound';
import { draftBodice } from '../bodice';
import { draftSleeve } from '../sleeve';
import { setKnob } from './knob';
import { runDrape } from './run';
import { makeSpace } from './space';

/** How far the sleeve's hem lies out from the middle of the arm, point by point, and whether the drawing passed. */
function hemOut(fibre: 'cotton' | 'silk') {
  const m = EXAMPLE_BODY as never;
  const b = validDetails(bodiceChoices({ neckline: 'crew', sleeve: 'short', sleeveShape: 'flutter' } as never));
  const d = draftBodice(m, b);
  const { length, shape } = sleeveOf(b);
  const sv = draftSleeve(d, m, { length, shape, fit: b.fit, seamAllowance: d.pieces[0].seamAllowance, armholeAllowance: 1, hemAllowance: 2.5 } as never);
  const round = roundBodice(d, m, sv);
  const out = runDrape({ kind: 'bodice', draft: d, sleeve: sv, m, armhole: round.armhole, fibre });
  const { a, b: e } = makeSpace(placeOnForm(round, m), m).arm;
  const v = [e[0] - a[0], e[1] - a[1], e[2] - a[2]];
  const L = Math.hypot(...v);
  const dn = v.map((x) => x / L);
  const sleeve = (i: number) => out.panels.some((p) => p.role === 'sleeve' && i >= p.base && i < p.base + p.uv.length / 2);
  const rs = out.lines
    .filter((l) => l.kind === 'hem')
    .flatMap((l) => l.ids)
    .filter(sleeve)
    .map((i) => {
      const w = [0, 1, 2].map((k) => out.pos[i * 3 + k] - a[k]);
      const t = w[0] * dn[0] + w[1] * dn[1] + w[2] * dn[2];
      return Math.hypot(w[0] - t * dn[0], w[1] - t * dn[1], w[2] - t * dn[2]);
    })
    .sort((x, y) => x - y);
  return { ok: out.quality?.ok, med: rs[rs.length >> 1], spread: rs[rs.length - 1] - rs[0] };
}

// A flutter is a short sleeve slashed and fanned to twice the arm round at its hem. Wrapped round the arm by its flat
// width and held to a tube as wide as the fan, it drew as a stiff cone standing off the arm, read as a plain short
// sleeve (SS27 renders, 2026-11-04). Laid in flutes and left to fall, its hem swings out further, in waves.
describe('a flutter sleeve falls in flutes', () => {
  afterEach(() => setKnob('__noFlutter', undefined));
  it.each(['cotton', 'silk'] as const)('in %s its hem stands out further and more unevenly than the old tube', (fibre) => {
    setKnob('__noFlutter', 1);
    const old = hemOut(fibre);
    setKnob('__noFlutter', undefined);
    const now = hemOut(fibre);
    expect(now.ok).toBe(true);
    expect(now.med).toBeGreaterThan(old.med + 0.5);
    expect(now.spread).toBeGreaterThan(old.spread);
  }, 120_000);
});
