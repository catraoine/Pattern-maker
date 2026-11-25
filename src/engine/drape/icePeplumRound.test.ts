import { describe, expect, it } from 'vitest';
import { COLLECTION, lookChoices, lookFabric, lookValues } from '../../collection';
import { drapeDesign } from '../../drapeSweep';

// The Ice Peplum Top's silk organza was read as a soft cloth, so in All round its big flared peplum hung short and
// straight, where CLO and the Front drawing show it standing out (EG cold read, Nov 24).
const look = COLLECTION.find((l) => l.id === 'ice-peplum')!;
const values = lookValues(look, {}).values;
const fabric = lookFabric(look.fabric);
const sew = (crisp: boolean) => drapeDesign({ garment: 'bodice', saved: { bodice: lookChoices(look, values) as never }, fibre: fabric.fibre!, crisp, fabric: { special: fabric.special, ...(crisp ? { drape: 'crisp' as const } : {}) } }, values);
// How far out round the body the peplum's lowest points stand, on average.
const hemOut = (d: ReturnType<typeof drapeDesign>) => {
  const pts = d.panels.filter((p) => /peplum/.test(p.role) && !p.hidden).flatMap((p) => [...new Set(p.tris.flat())].map((i) => i + p.base));
  const y = (i: number) => d.pos[i * 3 + 1];
  const low = Math.max(...pts.map(y));
  const hem = pts.filter((i) => y(i) > low - 1.5);
  return hem.reduce((s, i) => s + Math.hypot(d.pos[i * 3], d.pos[i * 3 + 2]), 0) / hem.length;
};

describe('the Ice Peplum Top in All round', () => {
  it('is cut in a crisp cloth', () => {
    expect(fabric.drape).toBe('crisp');
  });

  it('sews clean, its peplum standing out further than in a soft cloth', () => {
    const d = sew(true);
    expect(d.quality?.problems ?? []).toEqual([]);
    expect(hemOut(d)).toBeGreaterThan(hemOut(sew(false)) * 1.04);
  }, 240_000);
});
