import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Click-through tests of the whole app in Chromium, at phone size and at desktop size.
// Run with `npm run test:e2e`. See README "End-to-end tests".

const PORT = Number(process.env.E2E_PORT ?? 5199);
const root = fileURLToPath(new URL('..', import.meta.url));

// Some sandboxes ship a Chromium at this path and can't download one. Elsewhere (CI, laptops)
// Playwright's own browser is used: `npx playwright install chromium`.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};

// The walks a tester takes, run again in Safari on an iPhone: welcome to printed pattern, the style questions, the
// waitlist and tester link, the body scan, a fabric photo and a fabric bought from a shop.
const SAFARI_GATE = [
  'fresh-visitor.spec.ts',
  'journey-nov10.spec.ts',
  'tester-journey-nov11.spec.ts',
  'style-intro.spec.ts',
  'straight-to-questions.spec.ts',
  'waitlist.spec.ts',
  'tester-code.spec.ts',
  'body-scan.spec.ts',
  'fabric-photo.spec.ts',
  'shop-catalogue.spec.ts',
  // The five tester pieces, each made from the collection and printed on Letter and A4 (Nov 17).
  'tester-pieces.spec.ts',
];

// Walks left out of the Safari check because the test machine's Safari (WebKit on Linux, not an iPhone) crashes
// whenever a page is reloaded or left after Print or a fabric photo. Cat's iPhone reloads the Print screen fine
// (Nov 14), so it's the test machine, not the app. The same walks still run in Chromium on every PR.
const SAFARI_LEFT_OUT = /a reload keeps your place|a printed pattern is kept in Saved patterns|a photo of your own fabric dresses the sketch|fresh visitor: welcome, measure, style every garment/;

// Walks left out of the nightly Firefox check (Cat's card, Nov 25): they open the app as an iPad or a phone, and Firefox
// has no phone or tablet mode (the test browser refuses to start one), so they failed every night. They are about Safari
// on an iPhone and iPad, and still run in Safari and Chromium on every change.
const FIREFOX_LEFT_OUT = /on an upright iPad|in the home-screen app, work from Safari/;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
    // Safari on an iPhone, for the walks a tester takes, which must pass before every ship. Safari draws some things its
    // own way (it painted the flats black before the fabric arrived), and Chromium never shows that. Only when E2E_SAFARI
    // is set, as the Safari check on GitHub does, since most machines have no WebKit browser.
    ...(process.env.E2E_SAFARI ? [{
      name: 'iphone-safari',
      testMatch: SAFARI_GATE,
      grepInvert: SAFARI_LEFT_OUT,
      use: { ...devices['iPhone 13'], browserName: 'webkit' as const, launchOptions: {} },
    }] : []),
    // And Safari on a Mac laptop: every computer check ran in Chromium, and many sewists use a Mac (desktop check, Nov
    // 21). The same walks, plus the laptop and desktop screen sizes.
    ...(process.env.E2E_SAFARI ? [{
      name: 'mac-safari',
      testMatch: [...SAFARI_GATE, 'computer-screens.spec.ts'],
      grepInvert: SAFARI_LEFT_OUT,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' as const, viewport: { width: 1280, height: 800 }, launchOptions: {} },
    }] : []),
    // Firefox on a computer, run nightly (E2E_FIREFOX): few sewists use it, so not on every change.
    ...(process.env.E2E_FIREFOX ? [{
      name: 'firefox',
      testMatch: [...SAFARI_GATE, 'computer-screens.spec.ts'],
      grepInvert: FIREFOX_LEFT_OUT,
      use: { ...devices['Desktop Firefox'], browserName: 'firefox' as const, viewport: { width: 1280, height: 800 }, launchOptions: {} },
    }] : []),
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
