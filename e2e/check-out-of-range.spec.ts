import { expect, headerBack, openReview, startWithExample, test } from './fixtures';

// A number out of range is kept while you leave its page, so it can be mended later. On the list it shows Check, and
// the button that would go on to Style takes you to it, rather than sitting greyed out with nothing pointing there
// (pretend-tester walk, Nov 24).
test('a number out of range on the measurements list: the button opens it', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: 'Edit measurements' }).click();
  const list = main.getByRole('list', { name: 'Tap one to measure it again' });
  await list.getByRole('button', { name: /^Waist to hip [0-9]/ }).click();
  await main.getByRole('textbox', { name: 'Waist to hip', exact: true }).fill('90');
  await main.getByRole('button', { name: 'Save' }).click();
  await expect(main.getByText(/Waist to hip can be from/).first()).toBeVisible();
  await headerBack(page).click();
  // The number typed still shows beside Check, with its reason on its row (cold read of release EH, Nov 25).
  await expect(list.getByRole('button', { name: /^Waist to hip 90 cm Check$/ })).toBeVisible();
  await expect(list.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Waist to hip/ }) }).locator('.msg.error')).toContainText(/can be from/);
  await expect(main.getByRole('button', { name: 'Style your skirt' })).toHaveCount(0);
  await main.getByRole('button', { name: 'Check waist to hip' }).click();
  await expect(main.getByRole('textbox', { name: 'Waist to hip', exact: true })).toBeVisible();
});
