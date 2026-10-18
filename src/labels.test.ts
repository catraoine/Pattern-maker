import { describe, expect, it } from 'vitest';
import { NEW_ACCOUNT, savePattern } from './account';
import { findByCode, labelCode, labelName, readCode, savedCopy } from './labels';

const choices = { garment: 'skirt', silhouette: 'aline', length: 'knee' } as never;

describe('label codes', () => {
  it('are MT- and four easy-to-read letters, the same every time', () => {
    const code = labelCode('abc123');
    expect(code).toMatch(/^MT-[2-9A-HJKMNP-TV-Z]{4}$/);
    expect(labelCode('abc123')).toBe(code);
    expect(labelCode('abc124')).not.toBe(code);
  });

  it('reads a typed code however it was written', () => {
    expect(readCode('mt-7k3q')).toBe('MT-7K3Q');
    expect(readCode(' 7K3Q ')).toBe('MT-7K3Q');
    expect(readCode('MT 7K 3Q')).toBe('MT-7K3Q');
    expect(readCode('MT-7K3')).toBeUndefined();
    expect(readCode('MT-0OIL')).toBeUndefined();
  });

  it('open the saved pattern they were printed for', () => {
    const account = savePattern(NEW_ACCOUNT, choices, 'A-line skirt');
    const saved = savedCopy(account, choices)!;
    expect(saved).toBeDefined();
    expect(findByCode(account, labelCode(saved.id).toLowerCase())).toBe(saved);
    expect(findByCode(account, 'MT-2222')).toBeUndefined();
  });

  it('weave the name in capitals, kept short', () => {
    expect(labelName('  Cat   Buckley ')).toBe('CAT BUCKLEY');
    expect(labelName('Maximiliana Theodora').length).toBeLessThanOrEqual(18);
  });
});
