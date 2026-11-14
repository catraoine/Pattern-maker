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
];

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
      use: { ...devices['iPhone 13'], browserName: 'webkit' as const, launchOptions: {} },
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
