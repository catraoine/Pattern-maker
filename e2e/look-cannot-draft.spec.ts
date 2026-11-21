import type { Page } from '@playwright/test';
import { MEASUREMENTS, expect, fillStepPages, measureMe, openFresh, test } from './fixtures';

// Pretend tester DV walk, Nov 21: back and front length typed as 12 in each, the Ice Peplum Top can't be drafted. Its
// look page showed only the title and a greyed Print, the reason was on the Print tab alone, and that tab had no way
// back to Measure.
const main = (page: Page) => page.getByRole('main');

test('a look that cannot be drafted says why, with the way back to the measurements', async ({ page }) => {
  test.setTimeout(120_000);
  const kept = { ...MEASUREMENTS };
  // The top's lengths are asked when the look is made, so they stay short until it is.
  Object.assign(MEASUREMENTS, { 'Back length': '30.5', 'Front length': '30.5', 'Bust depth': '30' });
  try {
    await openFresh(page);
    await main(page).getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main(page).getByRole('button', { name: 'Choose what to make' }).click();
    await main(page).getByRole('button', { name: 'The collection ›' }).click();
    const card = main(page).locator('.set-piece, li').filter({ has: page.getByRole('heading', { name: 'Ice Peplum Top', exact: true }) }).last();
    await card.getByRole('button', { name: /^Make (this look|the \w+)$/ }).click();
    for (let n = 0; n < 6 && !(await main(page).locator('.review-error').isVisible()); n++) {
      if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
      else await page.waitForTimeout(300);
    }
  } finally {
    Object.assign(MEASUREMENTS, kept);
  }
  await expect(main(page).locator('.review-error')).toContainText("so this top can't be drafted");
  await main(page).locator('.review-error').getByRole('button', { name: 'Check my measurements' }).click();
  await expect(main(page).getByRole('heading', { name: 'Your measurements' })).toBeVisible();
  await expect(main(page).getByRole('button', { name: /^Front length/ })).toBeVisible();
});
