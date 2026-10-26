import { describe, expect, it } from 'vitest';
import type { Choices } from '../savedWork';
import { isBodice, isDress, type PatternChoices } from '../garments';
import { ideaChoices, ideaRows, pieceGarment } from './idea';
import type { IdeaReading, PhotoReading } from './types';

const top = { fit: { value: 'regular', confidence: 'high' }, neckline: 'cowl', sleeve: 'none', sleeveShape: 'straight', length: 'waist', seams: 'darts', opening: 'back', collar: 'none', peplum: 'none', boned: false, knit: false, waistSeam: true } as const;
const reading: PhotoReading = {
  garment: 'dress',
  silhouette: { value: 'a_line', confidence: 'medium' },
  length: { value: 'midi', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.7, hemFullness: 1.4, flareAt: null, confidence: 'medium' },
  extras: { volume: 'knife', asymHem: 'none', pockets: true, elasticWaist: false },
  top,
  details: '',
};
const idea = (o: Partial<IdeaReading>): IdeaReading => ({ verdict: 'make', name: 'slip dress', note: '', start: 'dress', bias: false, reading, ...o });

describe('ideaChoices', () => {
  it('starts a described dress from the reading, cut on the bias when asked', () => {
    const plain = ideaChoices(idea({})) as PatternChoices;
    expect(isDress(plain) && plain.skirt.silhouette).toBe('a_line');
    const slip = ideaChoices(idea({ bias: true }));
    expect(isDress(slip!) && slip.skirt).toMatchObject({ silhouette: 'slip' });
    expect(isDress(slip!) && slip.skirt.pockets).toBeUndefined();
    expect(isDress(slip!) && slip.skirt.pleats).toBeUndefined();
    expect(isDress(slip!) && slip.bodice.neckline).toBe('cowl');
  });

  it('cuts a bias skirt as a slip', () => {
    expect((ideaChoices(idea({ start: 'skirt', bias: true })) as Choices).silhouette).toBe('slip');
  });

  it('has nothing to start from when the app can not make it yet', () => {
    expect(ideaChoices(idea({ verdict: 'not_yet', start: null }))).toBeUndefined();
  });

  it('starts a top as the bodice', () => {
    expect(pieceGarment('top')).toBe('bodice');
    expect(isBodice(ideaChoices(idea({ start: 'top' }))!)).toBe(true);
  });
});

describe('ideaRows', () => {
  it('names the picks in the style screen words', () => {
    expect(ideaRows(ideaChoices(idea({ bias: true }))!)).toEqual([
      ['Neckline', 'Cowl'],
      ['Sleeves', 'Sleeveless'],
      ['Skirt', 'Bias slip'],
      ['Length', 'Midi'],
    ]);
    expect(ideaRows(ideaChoices(idea({ start: 'trousers', reading: { ...reading, trousers: { fit: { value: 'regular', confidence: 'high' }, leg: 'wide', length: 'full', elasticWaist: false, opening: 'fly', pockets: 'none' } } }))!)).toEqual([
      ['Leg', 'Wide'],
      ['Length', 'Full length'],
      ['Waist', 'Waistband with zip'],
    ]);
  });
});
