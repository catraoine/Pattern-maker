import type { Page } from '@playwright/test';
import { MEASUREMENTS, expect, fillStepPages, measureMe, openFresh, test } from './fixtures';

// A look with sleeves prints them only from the arms. Measuring left with Finish later at the arms and carried on
// from Welcome back reached Print, and the Ice Peplum printed sleeveless under a title still naming its bishop sleeves
// (pretend tester, Nov 17). Print now asks for the arms first.
const main = (page: Page) => page.getByRole('main');

test('Print asks for the arms before a top with sleeves', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'one screen size is enough');
  test.setTimeout(3 * 60_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('button', { name: 'The collection ›' }).click();
  await main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Ice Peplum Top', exact: true }) }).getByRole('button', { name: /^Make/ }).first().click();
  // The top's own pages, then Finish later at the first of the arms.
  const input = main(page).getByRole('textbox');
  for (let i = 0; i < 10; i++) {
    const label = ((await main(page).locator('label:visible').first().innerText()) ?? '').trim();
    if (/^arm length$/i.test(label)) break;
    const key = Object.keys(MEASUREMENTS).find((k) => k.toLowerCase() === label.toLowerCase());
    expect(key, `a test value for "${label}"`).toBeDefined();
    await input.fill(MEASUREMENTS[key!]);
    await main(page).getByRole('button', { name: /^Next\b/ }).click();
    await expect(main(page).locator('label:visible').first()).not.toHaveText(label, { ignoreCase: true });
  }
  await main(page).getByRole('button', { name: 'Finish later' }).click();
  // A collection look carries on by its own name, onto the look itself.
  await main(page).getByRole('button', { name: /carry on with your ice peplum top/i }).click();
  await expect(main(page).getByRole('button', { name: 'Change a detail' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Print' }).click();
  await expect(page.getByText('Your sleeves are drafted from your arms: add them to print.')).toBeVisible();
  await expect(main(page).getByRole('textbox')).toBeVisible();
  await expect(main(page).locator('label:visible').first()).toHaveText(/arm length/i);
});
