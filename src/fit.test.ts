import { describe, expect, it } from 'vitest';
import { cleanFit, emptyFit, fitAreas, fitSummary } from './fit';
import { NEW_ACCOUNT, savePattern, setPatternFit } from './account';
import { DEFAULT_BODICE } from './garments';
import type { Choices } from './App';

const skirt: Choices = { fit: 'regular', silhouette: 'a_line', length: 'knee' };

describe('fit feedback', () => {
  it('asks about the areas each garment has', () => {
    expect(fitAreas(skirt).map((a) => a.id)).toEqual(['waist', 'hip', 'flare', 'length']);
    expect(fitAreas(DEFAULT_BODICE).map((a) => a.id)).toContain('bust');
  });

  it('summarises only the areas that were off', () => {
    const fit = { ...emptyFit(), verdict: 'tweaks' as const, areas: { waist: -1 as const, hip: 0 as const, length: 1 as const } };
    expect(fitSummary(fit, skirt)).toBe('Needs small changes · waist too tight, length too long');
    expect(fitSummary(emptyFit(), skirt)).toBe('Fits well');
  });

  it('drops areas the garment lacks and trims notes', () => {
    const fit = cleanFit({ ...emptyFit(), areas: { bust: 1, waist: 0 }, notes: '  ok  ' }, skirt);
    expect(fit.areas).toEqual({ waist: 0 });
    expect(fit.notes).toBe('ok');
  });

  it('keeps feedback with the saved pattern and can clear it', () => {
    const a = savePattern(NEW_ACCOUNT, skirt, 'A-line');
    const id = a.patterns[0].id;
    const withFit = setPatternFit(a, id, emptyFit());
    expect(withFit.patterns[0].fit?.verdict).toBe('good');
    expect(setPatternFit(withFit, id, undefined).patterns[0].fit).toBeUndefined();
  });
});

describe('fit areas for newer garments', () => {
  it('asks trousers about the rise and dresses about the bust', async () => {
    const { garmentKind } = await import('./fit');
    const trousers = { garment: 'trousers' } as unknown as Parameters<typeof garmentKind>[0];
    expect(garmentKind(trousers)).toBe('trousers');
    expect(fitAreas(trousers).map((a) => a.id)).toContain('rise');
    const dress = { garment: 'dress' } as unknown as Parameters<typeof garmentKind>[0];
    expect(fitAreas(dress).map((a) => a.id)).toContain('bust');
  });
});
