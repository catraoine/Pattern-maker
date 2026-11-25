import type { Page } from '@playwright/test';
import { expect, openCollection, skipLoading, skipToExample, expectStyle, test } from './fixtures';

// A peplum tester opened Change a detail on the Ice Peplum Top, changed the neckline and sleeves and took the peplum off,
// still believing she was sewing the Ice Peplum Top (testers, Nov 18). The email says the style is set and only the
// length is hers: a change that makes it another piece is now asked about first, and a length isn't.
const main = (page: Page) => page.getByRole('main');
const dialog = (page: Page) => page.getByRole('dialog', { name: /Change the Ice Peplum Top/ });

async function testerOnPeplum(page: Page) {
  await page.route('**/.netlify/functions/tester', (r) => r.fulfill({ json: { ok: true, tester: true } }));
  await page.goto('/?fresh&tester=EXAMPLE-ONLY');
  await skipLoading(page);
  await skipToExample(page);
  await expectStyle(page, 'Skirt');
  await openCollection(page);
  await main(page).getByRole('listitem').filter({ hasText: 'Ice Peplum Top' }).first().getByRole('button', { name: /^Make (this look|the top)/ }).first().click();
  await expect(main(page).getByRole('heading', { name: /Ice Peplum Top/ })).toBeVisible({ timeout: 30_000 });
}

/** Opens the question (a row on a computer, a step on a phone) and taps a choice in it. */
async function pick(page: Page, group: RegExp, name: RegExp) {
  const chip = main(page).getByRole('button', { name }).filter({ visible: true });
  for (let i = 0; i < 12 && !(await chip.count()); i++) {
    const row = main(page).getByRole('button', { name: group }).filter({ visible: true });
    if (await row.count()) await row.first().click();
    else await page.getByRole('button', { name: /^Next\b/ }).last().click();
    await page.waitForTimeout(300);
  }
  await chip.first().click();
}

test('a tester changing her look\'s style is asked first, and can keep it', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await testerOnPeplum(page);
  await main(page).getByRole('button', { name: 'Change a detail' }).click();
  await pick(page, /^Neckline\b/, /^V-neck/);
  await expect(dialog(page)).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/look-kept-${test.info().project.name}.png` });
  await dialog(page).getByRole('button', { name: 'Keep the Ice Peplum Top' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(main(page).getByRole('heading', { name: /Ice Peplum Top/ })).toBeVisible();
  // Asked again, she can still change it, and the page then says it is her own top.
  await pick(page, /^Neckline\b/, /^V-neck/);
  await dialog(page).getByRole('button', { name: 'Change it anyway' }).click();
  await expect(main(page).getByRole('heading', { name: /Ice Peplum Top/ })).toHaveCount(0);
  await expect(main(page).locator('.tester-look')).toContainText('Sewing the Ice Peplum Top for us?');
});

test('Edit measurements on a tester\'s look comes back to the look, not its questions', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await testerOnPeplum(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Measure' }).click();
  await main(page).getByRole('button', { name: /^Style your/ }).click();
  await expect(main(page).getByRole('button', { name: 'Change a detail' })).toBeVisible();
  await expect(main(page).getByRole('heading', { name: /Ice Peplum Top/ })).toBeVisible();
});
