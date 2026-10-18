import { describe, expect, it } from 'vitest';
import { BODICE_GROUPS, TEE_GROUPS, TROUSER_GROUPS, outerGroups } from './garments';
import { DETAIL_GROUPS, GROUPS } from './screens/StyleScreen';
import { VOLUME_OPTIONS } from './engine/skirtVolume';
import { ExplainSet, explainGroups, explainLine } from './explain';

const sets: [ExplainSet, { id: string; options: readonly (readonly [unknown, string])[] }[]][] = [
  ['skirt', [...GROUPS, ...DETAIL_GROUPS, { id: 'volume', options: VOLUME_OPTIONS }]],
  ['bodice', BODICE_GROUPS],
  ['tee', TEE_GROUPS],
  ['trousers', TROUSER_GROUPS],
  ['outer', [...outerGroups('jacket'), ...outerGroups('coat')]],
];

describe('a line for every Style choice', () => {
  for (const [set, groups] of sets)
    it(`has one for each ${set} choice`, () => {
      for (const g of groups) for (const [id, label] of g.options) expect(explainLine(set, g.id, String(id)), `${set} ${g.id} ${label}`).toBeDefined();
    });

  it('names no choice the screens do not offer', () => {
    for (const [set, groups] of sets)
      for (const [group, lines] of Object.entries(explainGroups(set)))
        for (const id of Object.keys(lines)) expect(groups.some((g) => g.id === group && g.options.some(([o]) => String(o) === id)), `${set} ${group} ${id}`).toBe(true);
  });

  it('keeps each line short, in whole sentences', () => {
    for (const [set] of sets)
      for (const lines of Object.values(explainGroups(set)))
        for (const [text] of Object.values(lines)) {
          expect(text.length).toBeLessThanOrEqual(120);
          expect(text).toMatch(/\.$/);
        }
  });
});
