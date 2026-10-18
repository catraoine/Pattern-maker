import { chooseChip, expect, expectStyle, openAccount, openFold, openGroup, openReview, pickToMake, skipLoading, startWithExample, test } from './fixtures';

test('returning visitor: a reload keeps the measurements and the saved pattern', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');

  // Make the measurements this visitor's own: change the waist from the example's.
  // Measure is a short list of the skirt's measurements; tapping one opens its own page to redo it.
  await openReview(page);
  await main.getByRole('button', { name: 'Edit measurements' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your measurements' })).toBeVisible();
  await main.getByRole('list', { name: 'Tap one to measure it again' }).getByRole('button', { name: /^Waist [0-9]/ }).click();
  const waist = main.getByRole('textbox', { name: 'Waist', exact: true });
  await expect(waist).not.toHaveAttribute('placeholder');
  await waist.fill('74');
  await main.getByRole('button', { name: 'Save' }).click();
  // Saving comes back to the list, with the new waist on it.
  await expect(main.getByRole('list', { name: 'Tap one to measure it again' }).getByRole('button', { name: /^Waist [0-9]/ })).toContainText('74 cm');
  await main.getByRole('button', { name: 'Style your skirt' }).click();
  await expectStyle(page, 'Skirt');

  await chooseChip(page, 'Length', 'Midi');
  await openReview(page);
  await main.getByRole('button', { name: 'Save pattern' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Saved to' })).toBeVisible();

  await page.reload();
  await skipLoading(page);

  // Every visit opens on the welcome; carrying on finds the measurements already taken.
  await main.getByRole('button', { name: 'Begin' }).click();
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(main.getByText('Welcome back')).toBeVisible();
  await expect(main.getByRole('button', { name: /^Waist [0-9]/ })).toContainText('74 cm');
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  // Nothing is missing for the skirt, so carrying on goes straight to styling it.
  await pickToMake(page, 'Skirt');
  await expectStyle(page, 'Skirt');

  // The style chosen and the pattern saved are still there.
  await expect((await openGroup(page, 'Length')).getByRole('button', { name: 'Midi' })).toHaveAttribute('aria-pressed', 'true');
  await openReview(page);
  await expect(main.getByRole('status').filter({ hasText: 'Saved to' })).toBeVisible();

  await openAccount(page);
  const saved = main.getByRole('region', { name: 'Saved patterns' });
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await expect(saved).toContainText(/midi/i);
  await expect(await openFold(page, /measurements$/)).toContainText('74 cm');
});
