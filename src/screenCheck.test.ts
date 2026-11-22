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

// The menswear form's screens (SCREEN_MENSWEAR_FROM=<folder>, taken with SCREEN_FORM=menswear): report-only, its "new
// findings" the ones the womenswear screens don't have (src/screenKnown.json). The menswear form is In testing (Nov 22);
// kept apart from the check above, so nothing here can turn it red.
const MEN_FROM = process.env.SCREEN_MENSWEAR_FROM;
describe.skipIf(!MEN_FROM)('screens: every screen on the menswear form', () => {
  it('reports every screen on the menswear form', () => {
    const found: Record<string, string[]> = {};
    for (const f of readdirSync(MEN_FROM!).filter((f) => /^screens-.*\.json$/.test(f))) Object.assign(found, JSON.parse(readFileSync(`${MEN_FROM}/${f}`, 'utf8')));
    const results = Object.entries(found)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, problems]) => ({ key, problems }));
    const c = checkPatterns(results, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>) : {});
    writeFileSync(process.env.SCREEN_MENSWEAR_REPORT ?? 'screens-menswear.md', patternReport(results, c, 'Screens, menswear form'));
    expect(results.length, 'screens looked at').toBeGreaterThan(0);
  });
});
