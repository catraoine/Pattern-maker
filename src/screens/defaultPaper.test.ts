import { describe, expect, it } from 'vitest';
import { defaultPaper } from './ExportScreen';

describe('the paper Print starts on', () => {
  it('is US Letter for inches and for Canadian or US browsers, A4 elsewhere', () => {
    expect(defaultPaper('in', 'en-GB')).toBe('letter');
    expect(defaultPaper('cm', 'en-CA')).toBe('letter');
    expect(defaultPaper('cm', 'en-us')).toBe('letter');
    expect(defaultPaper('cm', 'en-GB')).toBe('a4');
    expect(defaultPaper('cm', 'de-DE')).toBe('a4');
    expect(defaultPaper('cm', '')).toBe('a4');
  });
});
