import { describe, expect, it } from 'vitest';
import { MAX_POINTS, Truth, scoreReading } from './score';
import { fitOf } from './shape';
import type { PhotoReading } from './types';

const truth: Truth = { garment: 'skirt', silhouette: 'a_line', length: 'midi', fit: 'regular', hemAt: 0.75, hemFullness: 1.6, hasDetails: false };

const reading = (over: Partial<PhotoReading> = {}): PhotoReading => ({
  garment: 'skirt',
  silhouette: { value: 'a_line', confidence: 'high' },
  length: { value: 'midi', confidence: 'medium' },
  fit: { value: 'regular', confidence: 'low' },
  shape: { hemAt: 0.74, hemFullness: 1.5, flareAt: null, confidence: 'medium' },
  details: '',
  ...over,
});

describe('scoreReading', () => {
  it('gives full marks to a reading that matches the label, and the pattern drafts', () => {
    const s = scoreReading(reading(), truth);
    expect(s.points).toBe(MAX_POINTS);
    expect(s.drafts).toBe(true);
  });

  it('gives half marks one step off, none further', () => {
    const s = scoreReading(reading({ silhouette: { value: 'half_circle', confidence: 'medium' }, length: { value: 'mini', confidence: 'low' } }), truth);
    expect(s.parts.silhouette).toBe(1.5);
    expect(s.parts.length).toBe(0);
    expect(scoreReading(reading({ silhouette: { value: 'trumpet', confidence: 'low' } }), truth).parts.silhouette).toBe(1.5);
    expect(scoreReading(reading({ silhouette: { value: 'circle', confidence: 'low' } }), truth).parts.silhouette).toBe(0);
  });

  it('scores the exact proportions with tolerance bands', () => {
    const s = scoreReading(reading({ shape: { hemAt: 0.85, hemFullness: 2.3, flareAt: null, confidence: 'low' } }), truth);
    expect(s.parts.hemAt).toBe(0.5);
    expect(s.parts.hemFullness).toBe(0.5);
  });

  it('flags confident mistakes and missed details', () => {
    const s = scoreReading(reading({ silhouette: { value: 'straight', confidence: 'high' } }), { ...truth, hasDetails: true });
    expect(s.confidentlyWrong).toEqual(['silhouette']);
    expect(s.parts.details).toBe(0);
  });
});

describe('fitOf', () => {
  it('only starts from fitted when the photo clearly shows it', () => {
    expect(fitOf(reading({ fit: { value: 'fitted', confidence: 'high' } }))).toBe('fitted');
    expect(fitOf(reading({ fit: { value: 'fitted', confidence: 'medium' } }))).toBe('regular');
    expect(fitOf(reading({ fit: { value: 'relaxed', confidence: 'low' } }))).toBe('relaxed');
  });
});
