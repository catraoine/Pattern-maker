import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TESTER_REPORT_URL } from './testerReport';

// maisontrace.co/fit-form is the address tester emails use for the fit form (Nov 19), so it must keep pointing at the
// same form the app opens, and sit above the catch-all that would otherwise show the app instead.
describe('the fit form short address', () => {
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  it('goes to the same form as the app', () => {
    expect(toml).toMatch(new RegExp(`from = "/fit-form"\\s+to = "${TESTER_REPORT_URL.replace(/[.?/]/g, '\\$&')}"`));
  });
  it('comes before the single-page catch-all', () => {
    expect(toml.indexOf('from = "/fit-form"')).toBeLessThan(toml.indexOf('from = "/*"'));
  });
});
