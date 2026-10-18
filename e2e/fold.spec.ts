import { expect, openFresh, test } from './fixtures';
import type { Page } from '@playwright/test';

// The owner's rule (2026-10-18): on the welcome and the measuring pages the main button is always on the screen,
// never a scroll away, on every phone. Sizes are what the page gets with the browser's bars showing.
const PHONES = [
  [320, 454], // iPhone SE (1st), Safari
  [360, 560], // small Android, Chrome
  [375, 553], // iPhone SE (2nd/3rd), Safari
  [390, 664], // iPhone 12 to 15, Safari
  [412, 732], // Pixel, Chrome
  [430, 739], // iPhone Pro Max, Safari
] as const;

test.beforeEach(({}, info) => test.skip(info.project.name !== 'phone', 'phones only'));

async function onScreen(page: Page, name: string | RegExp, where: string) {
  const button = page.getByRole('main').getByRole('button', { name }).first();
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const h = page.viewportSize()!.height;
  expect(box.y + box.height, `${where}: "${name}" ends on the screen (${h}px tall) without scrolling`).toBeLessThanOrEqual(h);
  // And the page has nothing below to scroll to, so it never looks like there's more to reach.
  const extra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(extra, `${where}: the page fits the screen (over by ${extra}px)`).toBeLessThanOrEqual(1);
}

for (const [width, height] of PHONES) {
  test(`the main button needs no scrolling at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openFresh(page);
    const main = page.getByRole('main');
    await onScreen(page, 'Begin', 'welcome');
    await main.getByRole('button', { name: 'Begin' }).click();
    await expect(main.getByRole('heading', { name: /take your measurements/i })).toBeVisible();
    await onScreen(page, 'Someone else', 'first measuring page');
    await main.getByRole('button', { name: 'Me', exact: true }).click();
    await onScreen(page, 'Continue', 'the form to draft on');
    await main.getByRole('button', { name: 'Continue', exact: true }).click();
    await onScreen(page, /^Next/, 'a measurement page');
  });
}
