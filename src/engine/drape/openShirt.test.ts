import { describe, expect, it } from 'vitest';
import { bodiceChoices } from '../../collection';
import { sleeveOf, validDetails } from '../../garments';
import { EXAMPLE_BODY } from '../../measurements';
import { placeOnForm } from '../../ui/allRoundShape';
import { roundBodice } from '../allRound';
import { draftBodice } from '../bodice';
import { draftSleeve } from '../sleeve';
import { drapeBodice } from './garment';
import { drapeQuality } from './quality';
import { makeSpace } from './space';
import { widensForm } from './widen';

// SS27 look 9C (2026-11-02): the shirt worn out, one button done up mid-chest, the neck turned open above it and the
// fronts parted a little below. Its collar and stand are laid open on the turned neckline, as one smooth band each.
describe('a shirt worn open, one button done up', () => {
  it.each([
    ['relaxed, cotton', { fit: 'relaxed' }, { thick: 0.35, bendK: 0.06 }],
    ['relaxed, bust darts only, viscose', { fit: 'relaxed', darts: 'bust' }, { thick: 0.25, bendK: 0.02 }],
  ] as const)('%s draws clean', (_, extra, cloth) => {
    const m = EXAMPLE_BODY as never;
    const b = validDetails(
      bodiceChoices({ neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', sleeveCuff: 'shirt', length: 'hip', ...extra } as never),
    );
    const d = draftBodice(m, b);
    const { length, shape, cuff } = sleeveOf(b);
    const sv = draftSleeve(d, m, { length, shape, ...(cuff ? { cuff } : {}), fit: b.fit, seamAllowance: d.pieces[0].seamAllowance, armholeAllowance: d.pieces[0].allowances.armhole ?? 1, hemAllowance: 2.5 } as never);
    const sp = makeSpace(placeOnForm(roundBodice(d, m, sv), m), m, { widen: widensForm({ kind: 'bodice', sleeve: sv, draft: d } as never) });
    const by = d.front.waistCentre.y - 19.5;
    const dr = drapeBodice(sp, d, sv, {
      ...cloth,
      openAboveY: by - 0.5,
      openBelowY: by + 0.5,
      pinFront: [{ y: by, span: 1.5 }],
      partBelow: { y: by + 2, cm: 3, to: d.front.waistCentre.y + 20 },
      rollFront: [{ x: -1.5, y: by }, { x: 6.6, y: -2.4 }],
    } as never);
    expect(drapeQuality(dr, sp, { seams: dr.seams }).problems).toEqual([]);
  }, 180_000);
});
