import type { Page } from '@playwright/test';
import { expect, fillStepPages, measureMe, openAccount, openFold, openFresh, test } from './fixtures';

// Pretend tester DV walk, Nov 21 (Cat: yes to both): a fit tester sews in calico, but Print headlined only the look's own
// cloth and its care ("Do not wash it"), and invited a redraw ("Sew a test version first… your pattern is redrawn")
// before the tester form. Print now says what to do in calico, and leaves the redraw out for a tester.
const main = (page: Page) => page.getByRole('main');

test("a fit tester's Print says how to sew it in calico, and offers no redraw", async ({ page }) => {
  test.setTimeout(150_000);
  await page.route('**/.netlify/functions/tester', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tester: true }) }));
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('button', { name: 'The collection ›' }).click();
  const card = main(page).locator('.set-piece, li').filter({ has: page.getByRole('heading', { name: 'Black Pleated Skirt', exact: true }) }).last();
  await card.getByRole('button', { name: /^Make (this look|the \w+)$/ }).click();
  const print = main(page).getByRole('button', { name: 'Print my pattern' });
  for (let n = 0; n < 6 && !(await print.isVisible()); n++) {
    if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
    else await page.waitForTimeout(300);
  }
  await print.click();
  // Cut it, the fabric and the toile, is the Sew tab's first page since Nov 28.
  await main(page).getByRole('button', { name: /^Next: Cut and sew/ }).click();
  await expect(main(page).getByRole('heading', { name: 'Sew a toile first' })).toBeVisible();
  await expect(main(page).locator('.tester-calico')).toHaveCount(0);
  await openAccount(page);
  const fold = await openFold(page, 'Tester');
  await fold.getByLabel('Tester code').fill('SAMPLE-CODE');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold.getByRole('link', { name: 'Open the tester form ›' })).toBeVisible();
  await page.getByRole('button', { name: 'Print', exact: true }).first().click();
  await main(page).getByRole('button', { name: /^Next: Cut and sew/ }).click();
  await expect(main(page).locator('.tester-calico')).toContainText('For your fit test Sewing in muslin (calico)');
  await expect(main(page).getByRole('heading', { name: 'Sew a toile first' })).toHaveCount(0);
});
