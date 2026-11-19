import type { Page } from '@playwright/test';
import { download, expect, fillStepPages, measureMe, openAccount, openCollection, openFresh, skipLoading, stepButton, test } from './fixtures';

// Saved patterns kept only three on the free plan, testers included, so a tester printing all five tester pieces kept
// the first three and Print said nothing; the kept ones were named by their long description, not the look (Nov 19
// bug hunt). A tester now keeps every piece, under the look's name; anyone else at the limit is told on Print.
const main = (page: Page) => page.getByRole('main');

/** A fresh start with this account kept on the device (?fresh clears it, so it goes in afterwards), measured. */
async function measuredWith(page: Page, account: object) {
  await openFresh(page);
  await page.evaluate((a) => localStorage.setItem('pattern-maker:account', JSON.stringify(a)), account);
  await page.reload();
  await skipLoading(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('group', { name: 'What would you like to make?' }).getByRole('button', { name: /^Skirt\b/ }).click();
  await expect(main(page).getByRole('heading', { name: /^Style your skirt/ }).or(main(page).getByRole('textbox')).first()).toBeVisible();
  if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
}

/** Make a look from the collection, measuring for it if it asks, and print it. */
async function makeAndPrint(page: Page, look: string, info: Parameters<typeof download>[2], make: RegExp = /^Make/) {
  if (!(await main(page).getByRole('heading', { name: /^Style / }).isVisible())) await stepButton(page, 'Style').click();
  await openCollection(page);
  await main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: look, exact: true }) }).getByRole('button', { name: make }).first().click();
  const change = main(page).getByRole('button', { name: 'Change a detail' });
  await expect(change.or(main(page).getByRole('textbox')).first()).toBeVisible();
  if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
  await expect(change).toBeVisible();
  await stepButton(page, 'Print').click();
  const button = main(page).getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ });
  await expect(button).toBeEnabled({ timeout: 45_000 });
  await download(page, button, info);
}

test('a tester keeps every printed piece, each under its look name', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'one screen size is enough');
  test.setTimeout(4 * 60_000);
  await measuredWith(page, { onboarded: false, name: '', patterns: [], testerCode: 'EXAMPLE-CODE' });
  // The trousers are the second piece of a set: its card has a Make button for each.
  const looks: [string, RegExp?][] = [['Blush Shift'], ['Ice Peplum Top'], ['Chocolate Barrel Trouser', /^Make the trouser/i], ['Black Vest']];
  for (const [look, make] of looks) {
    await makeAndPrint(page, look, info, make);
    await expect(main(page).getByText('Saved in Your account, under Saved patterns.')).toBeVisible();
  }
  await openAccount(page);
  const saved = main(page).getByRole('region', { name: 'Saved patterns' });
  await expect(saved.getByRole('listitem')).toHaveCount(4);
  for (const [look] of looks) await expect(saved.getByRole('listitem').filter({ has: page.getByText(look, { exact: true }) })).toHaveCount(1);
  await expect(saved).toContainText('4 saved');
  await expect(saved).not.toContainText('free limit');
});

test('with Saved patterns full, Print says the pattern is not kept', async ({ page }, info) => {
  test.setTimeout(3 * 60_000);
  const skirt = (length: string, i: number) => ({ id: `p${i}`, name: `Skirt ${i}`, choices: { fit: 'regular', silhouette: 'a_line', length }, savedAt: '2026-11-01T10:00:00.000Z' });
  await measuredWith(page, { onboarded: false, name: '', patterns: ['mini', 'midi', 'maxi'].map(skirt) });
  await makeAndPrint(page, 'Blush Shift', info);
  await expect(main(page).getByText('Not kept in Saved patterns, which is full. Delete one in Your account to keep this one.')).toBeVisible();
  await expect(main(page).getByText('Saved in Your account, under Saved patterns.')).toHaveCount(0);
  await openAccount(page);
  await expect(main(page).getByRole('region', { name: 'Saved patterns' }).getByRole('listitem')).toHaveCount(3);
});
