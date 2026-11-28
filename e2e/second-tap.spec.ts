import { expect, fillStepPages, measureMe, openFresh, openReview, pickToMake, test } from './fixtures';

// Bug hunt journey 14 (Nov 28): a double-tapped Print my pattern opened Print and then, with the second tap, Your
// measurements, through Print's "Drafted to you" link under the finger.
test('a double-tapped Print my pattern stays on Print', async ({ page }) => {
  const main = page.getByRole('main');
  await openFresh(page);
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);
  await openReview(page);
  await main.getByRole('button', { name: 'Print my pattern' }).dblclick();
  await page.waitForTimeout(800);
  await expect(main.getByRole('heading', { level: 1 }).first()).toHaveText(/Print it/i);
});

// The EL walk (Nov 27): the Ice Peplum picked after the basics, left on the top's own measurements, came back to
// "Carry on with your top", where once measured it says the look's name.
test('a look left partway is carried on by its name', async ({ page }) => {
  const main = page.getByRole('main');
  await openFresh(page);
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await main.getByRole('button', { name: /collection/i }).first().click();
  await main.getByRole('listitem').filter({ hasText: 'Ice Peplum' }).first().getByRole('button', { name: /^Make/ }).first().click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your high bust' })).toBeVisible();
  await page.goto('/');
  await expect(main.getByRole('button', { name: 'Carry on with your Ice Peplum Top' })).toBeVisible();
});
