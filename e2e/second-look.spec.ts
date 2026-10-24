import { expect, openReview, startWithExample, test } from './fixtures';

test('end of measuring: a number near the edge gets a gentle second look, one tap from its page', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: 'Edit measurements' }).click();
  const list = main.getByRole('list', { name: 'Tap one to measure it again' });
  // The example hangs together, so nothing is said.
  await expect(main.getByText('Worth a second look')).toHaveCount(0);

  // A short waist to hip for the height: still in range, so no warning, but worth one more look.
  await list.getByRole('button', { name: /^Waist to hip [0-9]/ }).click();
  await main.getByRole('textbox', { name: 'Waist to hip', exact: true }).fill('16');
  await main.getByRole('button', { name: 'Save' }).click();
  const looks = main.getByRole('status').filter({ hasText: 'Worth a second look' });
  await expect(looks).toContainText('Waist to hip is on the short side next to your height');
  // Never in the way: the row isn't marked and the style button still goes on.
  await expect(list.getByRole('button', { name: /^Waist to hip [0-9]/ }).locator('.doubtful')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Style your skirt' })).toBeEnabled();

  await looks.getByRole('button', { name: 'Measure again' }).click();
  await expect(main.getByRole('textbox', { name: 'Waist to hip', exact: true })).toBeVisible();
});
