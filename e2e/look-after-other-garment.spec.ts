import type { Page } from '@playwright/test';
import { expect, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// Measured for trousers, then Measure, Make something else, The collection and the Blush Shift's Make this look: the
// app came back to "What would you like to make?" with nothing picked, and the shift was never made (testers' route,
// Nov 18). The guided pages opened on the page their history entry remembered instead of the shift's measurements.
const main = (page: Page) => page.getByRole('main');

test('a look made after measuring for another garment goes on to its own measurements', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Trousers');
  if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Measure' }).click();
  await main(page).getByRole('button', { name: 'Make something else' }).click();
  await main(page).getByRole('button', { name: /The collection/ }).click();
  await main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Blush Shift', exact: true }) }).getByRole('button', { name: 'Make this look' }).click();
  // The dress's own measurements, one page each, and then the look itself.
  await expect(main(page).getByRole('heading', { name: 'What would you like to make?' })).toHaveCount(0);
  await expect(main(page).getByRole('textbox')).toBeVisible();
  await fillStepPages(page);
  await expect(main(page).getByRole('heading', { name: /Blush Shift/i })).toBeVisible();
});
