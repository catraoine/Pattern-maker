import { expect, measureMe, openFresh, test } from './fixtures';

// Finish later keeps a number Next refused, and Begin then carried on at the next page without a word, past the waist
// of 500 cm (EF walk, Nov 24). Begin now comes back to it, with the reason, and nothing else is filled in for it.
test('Begin after Finish later comes back to a number out of range', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  const box = main.getByRole('textbox', { name: 'Waist', exact: true });
  await box.fill('500');
  await box.press('Enter');
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  await main.getByRole('button', { name: 'Finish later' }).click();
  await main.getByRole('button', { name: /^(Begin|Carry on)/ }).first().click();
  await expect(main.getByRole('textbox', { name: 'Waist', exact: true })).toHaveValue('500');
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('pattern-maker:')).map(([, v]) => v).join(' '));
  expect(saved).not.toMatch(/"full_bust":500/);
});
