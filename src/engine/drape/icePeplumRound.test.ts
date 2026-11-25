import { describe, expect, it } from 'vitest';
import { COLLECTION, lookChoices, lookFabric, lookValues } from '../../collection';
import { drapeDesign } from '../../drapeSweep';
import { DEFAULT_BODICE } from '../../garments';
import { setKnob } from './knob';

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

// How far the sleeves reach out sideways past the peplum's own hem, at their widest (cm; below 0 they stay inside it).
const sleevePast = (d: ReturnType<typeof drapeDesign>) => {
  const xs = (role: RegExp) => d.panels.filter((p) => role.test(p.role) && !p.hidden).flatMap((p) => [...new Set(p.tris.flat())].map((i) => Math.abs(d.pos[(i + p.base) * 3])));
  return Math.max(...xs(/sleeve/)) - Math.max(...xs(/peplum/));
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

  // Its bishop sleeves stood off the arm as two balloons reaching past the peplum, where CLO hangs them close above the
  // elbow and full just over the wrist (EG cold read, Nov 24; bishopRound.ts).
  it('hangs its bishop sleeves closer than a tube of their whole round', () => {
    const d = sew(true);
    setKnob('__bishopR', 1);
    setKnob('__bishopK', 1);
    let held: ReturnType<typeof drapeDesign>;
    try {
      held = sew(true);
    } finally {
      setKnob('__bishopR', undefined);
      setKnob('__bishopK', undefined);
    }
    expect(d.quality?.problems ?? []).toEqual([]);
    expect(sleevePast(d)).toBeLessThan(sleevePast(held) - 1);
  }, 240_000);
});

// The closer hold is every plain bishop's, not the Ice Peplum's alone: each still sews clean in a soft cloth, in wool
// and in a shirt cuff (code review, Nov 25).
describe('a bishop sleeve in All round', () => {
  it.each([
    ['silk, on its band', 'silk', 'none'],
    ['wool, on its band', 'wool', 'none'],
    ['cotton, in a shirt cuff', 'cotton', 'shirt'],
    ['silk, in a shirt cuff', 'silk', 'shirt'],
  ] as const)('sews clean in %s', (_, fibre, sleeveCuff) => {
    const d = drapeDesign({ garment: 'bodice', saved: { bodice: { ...DEFAULT_BODICE, sleeve: 'long', sleeveShape: 'bishop', sleeveCuff } as never }, fibre });
    expect(d.quality?.problems ?? []).toEqual([]);
  }, 240_000);
});
