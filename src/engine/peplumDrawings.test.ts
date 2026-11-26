import { describe, expect, it } from 'vitest';
import { COLLECTION, choicesFlat, lookChoices, lookValues } from '../collection';
import type { PatternChoices } from '../garments';
import type { P } from './geometry';

// The Ice Peplum Top's drawings didn't match its description or each other (EG cold read, Nov 24): its ruffle read as a
// scalloped collar lying flat, and its bishop sleeves as plain slim ones, while All round sews the ruffle standing round
// the neck and the sleeves full at the wrist.
const look = COLLECTION.find((l) => l.id === 'ice-peplum')!;
const m = lookValues(look, {}).values;
const ice = lookChoices(look, m) as PatternChoices & Record<string, unknown>;
const front = (c: Record<string, unknown>) => choicesFlat(c as unknown as PatternChoices, m)!.views[0];
// The views are set out from their tops, so the top is read against the garment's own origin.
const top = (c: Record<string, unknown>) => {
  const v = front(c);
  return Math.min(...v.shapes.flat().map((q) => q.y)) - v.origin.y;
};
const area = (s: P[]) => Math.abs(s.reduce((a, q, i) => a + q.x * s[(i + 1) % s.length].y - s[(i + 1) % s.length].x * q.y, 0)) / 2;
const sleeveArea = (c: Record<string, unknown>) => {
  const v = front(c);
  return area(v.shapes[v.sleeves![0]]);
};

describe('the Ice Peplum Top drawn as it is sewn', () => {
  it('has its ruffle standing up round the crew neck, its folds drawn', () => {
    expect(top({ ...ice, collar: 'none' }) - top(ice)).toBeGreaterThan(3);
    expect(front(ice).lines.length).toBeGreaterThan(front({ ...ice, collar: 'none' }).lines.length + 8);
  });

  it.each(['scoop', 'v', 'square', 'boat'])('lets a ruffle round a %s neckline fall on to the body, not stand', (neckline) => {
    const low = { ...ice, neckline };
    expect(Math.abs(top(low) - top({ ...low, collar: 'none' }))).toBeLessThan(0.5);
  });

  it('draws its bishop sleeves fuller than a straight sleeve', () => {
    expect(sleeveArea(ice)).toBeGreaterThan(1.15 * sleeveArea({ ...ice, sleeveShape: 'straight' }));
  });
});
