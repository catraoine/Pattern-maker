import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A home-screen app on a phone is rarely closed, so a new release has to take over the open app as soon as it has
// downloaded: without these two settings it waited behind the old one, and Cat's phone kept a two-release-old page
// (Nov 15). Checked on built copies by hand (old to new and new to newer, both reload within seconds).
describe('the saved app takes each new release', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  it('skips waiting and claims the open page', () => {
    expect(config).toMatch(/skipWaiting: true/);
    expect(config).toMatch(/clientsClaim: true/);
  });
});
