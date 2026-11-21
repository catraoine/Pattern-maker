import type { Page } from '@playwright/test';
import { expect, fillStepPages, measureMe, openFresh, test } from './fixtures';

// Pretend tester DV walk, Nov 21: from a look's page, Your account, then Back, opened How styling works (or the look's
// questions) in place of the look.
const main = (page: Page) => page.getByRole('main');

test('back from Your account returns to the look', async ({ page }) => {
  test.setTimeout(120_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('button', { name: 'The collection ›' }).click();
  const card = main(page).locator('.set-piece, li').filter({ has: page.getByRole('heading', { name: 'Chocolate Barrel Trouser', exact: true }) }).last();
  await card.getByRole('button', { name: /^Make (this look|the \w+)$/ }).click();
  const made = main(page).getByRole('button', { name: 'Change a detail' });
  for (let n = 0; n < 6 && !(await made.isVisible()); n++) {
    if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
    else await page.waitForTimeout(300);
  }
  await expect(made).toBeVisible();
  await page.getByRole('button', { name: /account/i }).first().click();
  await expect(main(page).getByText('Saved patterns', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /How styling works/ })).toHaveCount(0);
  await expect(made).toBeVisible();
});
