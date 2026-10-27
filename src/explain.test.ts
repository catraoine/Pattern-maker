import { describe, expect, it } from 'vitest';
import { BODICE_GROUPS, DRESS_CUTS, TEE_GROUPS, TROUSER_GROUPS, WAIST_SEAM_GROUP, outerGroups } from './garments';
import { DETAIL_GROUPS, FRONT_GROUP, GROUPS } from './skirtChoices';
import { VOLUME_OPTIONS } from './engine/skirtVolume';
import { SLIT_PLACES } from './engine/slit';
import { BELTS } from './engine/belt';
import { ExplainSet, explainGroups, explainLine } from './explain';
import { detailGroups, detailPic } from './ui/detailPics';
import { hasPics } from './ui/ChoicePic';

const sets: [ExplainSet, { id: string; options: readonly (readonly [unknown, string])[] }[]][] = [
  ['skirt', [...GROUPS, ...DETAIL_GROUPS, FRONT_GROUP, { id: 'volume', options: VOLUME_OPTIONS }, { id: 'noSeam', options: DRESS_CUTS }, { id: 'slit', options: SLIT_PLACES }, { id: 'belt', options: BELTS }]],
  ['bodice', [...BODICE_GROUPS, WAIST_SEAM_GROUP]],
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

  it('draws every choice: a picture tile, or a moving drawing beside its line', () => {
    for (const [set, groups] of sets) {
      const picSet = set === 'outer' ? 'jacket' : set;
      for (const g of groups) {
        if (hasPics(picSet, g.id)) {
          expect(detailGroups(set)[g.id], `${set} ${g.id} has tiles, so no second drawing`).toBeUndefined();
          continue;
        }
        for (const [id, label] of g.options) expect(detailPic(set, g.id, String(id)), `${set} ${g.id} ${label}`).toBeDefined();
      }
    }
  });
});
