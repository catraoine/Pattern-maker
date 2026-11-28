import { expect, fillStepPages, measureMe, openFresh, skipLoading, test } from './fixtures';

// A look picked with Make this look was forgotten when the page reloaded, or the app was closed, before any of its
// measurements was typed: the landing page offered only Begin, and the look had to be found in the collection again
// (pretend tester EK walk, Nov 27, on a phone and a laptop).
test('a look picked and left before its first measurement is carried on with', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const main = page.getByRole('main');
  await openFresh(page);
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await main.getByRole('button', { name: /^The collection/ }).click();
  await main.getByRole('listitem').filter({ hasText: 'Ice Peplum Top' }).first().getByRole('button', { name: /^Make/ }).first().click();
  await expect(main.getByText(/^Top · 1 of \d+$/)).toBeVisible();

  // Reloaded before anything is typed: still on the top's first page.
  await page.evaluate(() => location.reload());
  await page.waitForLoadState('load');
  await expect(main.getByText(/^Top · 1 of \d+$/)).toBeVisible();

  // Opened again on a new visit: the landing page carries on with it, by the look's name (EL walk, Nov 27).
  await page.goto('/');
  await skipLoading(page);
  await main.getByRole('button', { name: 'Carry on with your Ice Peplum Top' }).click();
  await expect(main.getByText(/^Top · 1 of \d+$/)).toBeVisible();

  // And the look is still the Ice Peplum once its measurements are in.
  await fillStepPages(page);
  await expect(main.getByRole('heading', { name: /Ice Peplum Top/ }).first()).toBeVisible({ timeout: 30_000 });

  // Measured, it's carried on with as the look itself, as any finished piece is.
  await page.goto('/');
  await skipLoading(page);
  await expect(main.getByRole('button', { name: 'Carry on with your Ice Peplum Top' })).toBeVisible();
});
