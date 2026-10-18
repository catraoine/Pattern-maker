import { describe, expect, it } from 'vitest';
import { dressChoices, lookFlat, lookValues } from './collection';
import { Drop, NEXT_DROP, clock, dropLook, dropState, editionLabel, editionLine } from './drops';

const at = (iso: string) => new Date(iso);
const live: Drop = {
  number: 1,
  editions: 600,
  name: 'Night Dress',
  designer: 'A designer',
  garment: 'dress',
  choices: dressChoices('fitted', { neckline: 'boat' }, { silhouette: 'a_line', length: 'midi' }),
  opensAt: '2026-10-24T16:00:00Z',
  closesAt: '2026-10-27T16:00:00Z',
};

describe('numbered drops', () => {
  it('announces the next drop without a date until a designer signs', () => {
    expect(dropState(NEXT_DROP, at('2026-10-18T10:00:00Z'))).toEqual({ kind: 'announced' });
    expect(dropLook(NEXT_DROP)).toBeUndefined();
  });

  it('counts down to the window, runs for it, then closes', () => {
    expect(dropState(live, at('2026-10-24T15:00:00Z'))).toEqual({ kind: 'opens', in: 3_600_000 });
    expect(dropState(live, at('2026-10-24T16:00:00Z'))).toEqual({ kind: 'live', left: 72 * 3_600_000 });
    expect(dropState(live, at('2026-10-27T16:00:00Z'))).toEqual({ kind: 'closed' });
  });

  it('reads its clock in hours, minutes and seconds', () => {
    expect(clock((47 * 3600 + 12 * 60 + 8) * 1000)).toBe('47:12:08');
    expect(clock(-5)).toBe('00:00:00');
  });

  it('numbers each copy for the title block', () => {
    expect(editionLabel(live, 127)).toBe('No. 0127/600');
    expect(editionLine(live, 7)).toBe('Drop 01 · No. 0007/600');
  });

  it('draws a live drop like a house look', () => {
    const look = dropLook(live)!;
    expect(lookFlat(look, lookValues(look, {}).values)).toBeDefined();
  });
});

describe('the edition and credit on the printed pattern', () => {
  it('prints the edition in the title block and on every main piece, and the credit under the title', async () => {
    const { layout } = await import('./engine/export');
    const { draftSkirt } = await import('./engine/skirt');
    const { EXAMPLE_VALUES } = await import('./measurements');
    const d = draftSkirt(EXAMPLE_VALUES as never, { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never);
    const sheet = layout(d.pieces, 'Maison Tracé: skirt', ['A note'], { pattern: 'skirt', madeFor: 'Cat', edition: editionLine(live, 127), credit: 'From the collection of a museum.' });
    const texts = sheet.prims.flatMap((pr) => (pr.kind === 'text' ? [pr.text] : []));
    const main = d.pieces.filter((pc) => !pc.kind).length;
    expect(texts.filter((t) => t.includes('DROP 01 · NO. 0127/600')).length).toBe(1 + main);
    expect(texts).toContain('From the collection of a museum.');
    expect(texts.indexOf('From the collection of a museum.')).toBeLessThan(texts.indexOf('A note'));
  });
});
