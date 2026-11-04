import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPatterns, patternReport } from './patternSweep';

// The screen check (Quality: Automated checks, Cat 2026-11-04). SCREEN_FROM=<folder> reads what e2e/screen-check.spec.ts
// found on every screen of the app, on a phone and on a computer (words cut off, things past the screen's edge, the
// page scrolling sideways), held to src/screenKnown.json: it fails on a new finding, or a screen not in the file yet.
// A finding in the file is a real one to fix, never one to hide: when it is fixed, SCREEN_KNOWN=write takes it out.
const file = new URL('./screenKnown.json', import.meta.url);
const FROM = process.env.SCREEN_FROM;

describe.skipIf(!FROM)('screens: every screen on a phone and a computer', () => {
  it('shows every screen whole, or no worse than src/screenKnown.json', () => {
    const found: Record<string, string[]> = {};
    for (const f of readdirSync(FROM!).filter((f) => /^screens-.*\.json$/.test(f))) Object.assign(found, JSON.parse(readFileSync(`${FROM}/${f}`, 'utf8')));
    const results = Object.entries(found)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, problems]) => ({ key, problems }));
    expect(results.length, 'screens looked at').toBeGreaterThan(100);
    const known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>) : {};
    const c = checkPatterns(results, known);
    if (process.env.SCREEN_REPORT) writeFileSync(process.env.SCREEN_REPORT, patternReport(results, c, 'Screens'));
    if (process.env.SCREEN_KNOWN === 'write') writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(c.now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    else {
      expect(c.worse, 'new screen faults (see e2e/screenAudit.ts; the photos are in the run)').toEqual([]);
      expect(c.unseen, 'new screens: look at their photos, then add them to src/screenKnown.json (SCREEN_KNOWN=write)').toEqual([]);
    }
  });
});
