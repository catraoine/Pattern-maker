import type { Page } from '@playwright/test';
import { expect, expectStyle, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// A top measured on its own has no waist to hip, so its hip lengths are greyed. "Add them" opened the top's own
// measurement list, which has no waist to hip in it (pretend tester, Nov 18). It now asks for the two it needs.
const main = (page: Page) => page.getByRole('main');

test('Add them under a top\'s length asks for the hip measurements and opens the hip lengths', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Bodice');
  if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
  await expectStyle(page, 'Bodice');
  const why = main(page).getByText(/For hip lengths, add your full hip and waist to hip/);
  // On a phone the steps go one at a time; on a computer each is a tab.
  const tab = main(page).getByRole('tab', { name: /^Length/ });
  if (await tab.count()) await tab.first().click();
  const add = why.getByRole('button', { name: 'Add them' }).filter({ visible: true });
  for (let i = 0; i < 10 && !(await add.count()); i++) {
    const row = main(page).getByRole('button', { name: /^Length\b/ }).filter({ visible: true });
    if (await row.count()) await row.first().click();
    else await page.getByRole('button', { name: /^Next\b/ }).last().click();
    await page.waitForTimeout(300);
  }
  await add.first().click();
  await expect(main(page).getByRole('textbox')).toBeVisible();
  // Asked one at a time, the waist to hip among them.
  await expect(main(page).getByRole('heading', { name: /waist to hip/i })).toBeVisible();
  await fillStepPages(page);
  await expectStyle(page, 'Bodice');
  await expect(main(page).getByText(/For hip lengths, add your full hip/)).toHaveCount(0);
});
