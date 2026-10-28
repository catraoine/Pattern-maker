import { describe, expect, it } from 'vitest';
import { listWords, tornBetween } from './PhotoScreen';
import type { PhotoReading } from '../photo/types';

const skirt: PhotoReading = {
  garment: 'skirt',
  silhouette: { value: 'straight', confidence: 'medium' },
  length: { value: 'knee', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.56, hemFullness: 1, flareAt: null, confidence: 'medium' },
  details: '',
  unsure: { group: 'silhouette', other: 'pencil' },
};

describe('the one question an unsure reading asks', () => {
  it('names the photo pick first and the other option second', () => {
    const t = tornBetween(skirt, 'skirt')!;
    expect(t.options).toEqual([
      ['straight', 'Straight'],
      ['pencil', 'Pencil'],
    ]);
    const r = t.set('pencil');
    expect(r.silhouette.value).toBe('pencil');
    // The proportions were read for a straight skirt, so a pencil one starts from its own.
    expect(r.shape).toBeUndefined();
  });

  it("asks nothing for an option the app doesn't have, the same option, or another garment's group", () => {
    expect(tornBetween({ ...skirt, unsure: { group: 'silhouette', other: 'bubble' } }, 'skirt')).toBeUndefined();
    expect(tornBetween({ ...skirt, unsure: { group: 'silhouette', other: 'straight' } }, 'skirt')).toBeUndefined();
    expect(tornBetween(skirt, 'trousers')).toBeUndefined();
    expect(tornBetween({ ...skirt, unsure: null }, 'skirt')).toBeUndefined();
  });

  it('moves the hem when the question is the length', () => {
    const t = tornBetween({ ...skirt, unsure: { group: 'length', other: 'midi' } }, 'skirt')!;
    expect(t.set('midi').shape.hemAt).toBeGreaterThan(0.6);
  });
});

describe('listWords', () => {
  it('joins with commas and "and"', () => {
    expect(listWords(['shoulder bow'])).toBe('shoulder bow');
    expect(listWords(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
