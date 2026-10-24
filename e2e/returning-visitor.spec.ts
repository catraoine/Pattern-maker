import { chooseChip, expect, expectStyle, lengthDot, openAccount, openFold, openReview, skipLoading, startWithExample, test } from './fixtures';

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
  await main.getByRole('button', { name: 'Keep in my patterns' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Kept in' })).toBeVisible();

  await page.reload();
  await skipLoading(page);

  // Every visit opens on the welcome, which carries straight on with the garment you were styling.
  await expect(main.getByText('Welcome back')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Begin' })).toHaveCount(0);
  // No tape on the way back in: it belongs to Begin, which pulls it out into measuring.
  await expect(page.locator('.tape-tip, .tape-band')).toHaveCount(0);
  // The agreement line is for first visits only: coming back, the welcome stays clear (Cat's L5).
  await expect(main.getByText('By continuing you agree')).toHaveCount(0);
  await main.getByRole('button', { name: 'Carry on with your skirt' }).click();
  await expectStyle(page, 'Skirt');

  // The style chosen and the pattern saved are still there.
  await expect(lengthDot(page)).toHaveAttribute('aria-valuetext', 'Midi');
  await openReview(page);
  await expect(main.getByRole('status').filter({ hasText: 'Kept in' })).toBeVisible();

  await openAccount(page);
  const saved = main.getByRole('region', { name: 'Saved patterns' });
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await expect(saved).toContainText(/midi/i);
  await expect(await openFold(page, /measurements$/)).toContainText('74 cm');
});
