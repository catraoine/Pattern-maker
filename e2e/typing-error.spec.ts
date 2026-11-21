import { expect, openFresh, test } from './fixtures';

// A number half typed (the 6 of 62) isn't wrong yet: the waist page waits for Next, or for the box to be left, before
// saying it's out of range (the film showed the error flashing up mid-number, Nov 16). Too big is said at once.
test('the range error waits for the whole number', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  const box = main.getByRole('textbox');
  await box.pressSequentially('6');
  await expect(main.getByText(/can be from/)).toHaveCount(0);
  await box.pressSequentially('2');
  await expect(main.getByText(/can be from/)).toHaveCount(0);
  await box.fill('6');
  await box.blur();
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  await box.fill('620');
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  await box.fill('6');
  await expect(main.getByText(/can be from/)).toHaveCount(0);
  // Enter tries Next without leaving the box, so this is Next's own check, not the box being left.
  await box.press('Enter');
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
});
