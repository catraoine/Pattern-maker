import { describe, expect, it } from 'vitest';
import { draftLingerie } from './lingerie';
import { elasticToBuy, lingerieGuide } from './lingerieGuide';

const EX = { full_bust: 92, underbust: 76, apex_separation: 18, bust_depth: 25, waist: 76, full_hip: 102, waist_to_hip: 20.5, crotch_length: 70, nape_to_waist: 41, neck: 35, shoulder_width: 38, torso_loop: 152 };
const text = (g: ReturnType<typeof lingerieGuide>) => [...g.notions, ...g.steps.map((s) => `${s.title}: ${s.text}`)].join('\n');

describe('lingerie sewing steps', () => {
  it('cuts the fold pieces on the fold and the rest in a single layer', () => {
    const g = text(lingerieGuide(draftLingerie(EX, { piece: 'swimsuit' }), 1.6));
    expect(g).toMatch(/cut the front, back and shelf with their centre edge on the fold/);
    expect(g).toMatch(/single layer, right side up, and cut the gusset/);
  });

  it('lists elastic to buy by width, a swim clasp for swim and hook tape otherwise', () => {
    const bikini = draftLingerie(EX, { piece: 'bikini' });
    const buy = elasticToBuy(bikini);
    expect(buy.map((b) => b.width)).toEqual([...new Set(bikini.elastic.map((e) => e.width))].sort((a, b) => b - a));
    const total = bikini.elastic.reduce((a, e) => a + e.length * e.count, 0);
    expect(buy.reduce((a, b) => a + b.metres, 0) * 100).toBeGreaterThan(total);
    expect(text(lingerieGuide(bikini, 1))).toMatch(/swim clasp/);
    expect(text(lingerieGuide(draftLingerie(EX, { piece: 'bralette' }), 0.5))).toMatch(/Hook-and-eye tape/);
  });

  it('stretches the leg elastic firmly at the back only, and explains the snap gusset', () => {
    expect(text(lingerieGuide(draftLingerie(EX, { piece: 'brief' }), 0.5))).toMatch(/front gusset seam, let the elastic lie almost flat/);
    expect(text(lingerieGuide(draftLingerie(EX, { piece: 'bodysuit', closure: 'snaps' }), 1.2))).toMatch(/Sew the snap gusset/);
  });
});
