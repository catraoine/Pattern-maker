import { expect, fillStepPages, measureMe, openFresh, pickToMake, skipLoading, test } from './fixtures';

// Closing the app partway through a piece's own measurements and opening it again lost the piece: Welcome back offered
// only "Choose what to make", and Style said to choose first (pretend-tester walk EH, Nov 25, three times on phones).
test('opened again partway through a piece, measuring carries on with that piece', async ({ page }) => {
  test.setTimeout(120_000);
  const main = page.getByRole('main');
  const h1 = (name: string | RegExp) => main.getByRole('heading', { level: 1, name });
  await openFresh(page);
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Trousers');
  // One of the trousers' own measurements, then away.
  const box = main.getByRole('textbox');
  await expect(box).toHaveCount(1);
  const first = await box.getAttribute('aria-label') ?? await main.locator('label').first().textContent();
  await box.fill('27');
  await main.getByRole('button', { name: 'Next' }).click();
  await expect(main.getByRole('textbox')).toHaveCount(1);

  // A new visit, as after closing the app.
  await page.goto('/');
  await skipLoading(page);
  const carry = main.getByRole('button', { name: /^(Carry on with your|Begin)/ });
  if (await carry.isVisible().catch(() => false)) await carry.click();
  await expect(h1('Do these look right?')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Choose what to make' })).toHaveCount(0);

  // Style opens the trousers' next page, not the garments.
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Style' }).click();
  await expect(main.getByRole('textbox')).toHaveCount(1);
  await expect(main).toContainText('Style and Print open once your measurements are in.');
  await expect(h1('What would you like to make?')).toHaveCount(0);

  // And from the list, Continue measuring does the same: on to the trousers' pages, the one given kept.
  await page.goBack();
  await expect(h1('Do these look right?')).toBeVisible();
  await main.getByRole('button', { name: 'Continue measuring' }).click();
  await expect(main.getByRole('textbox')).toHaveCount(1);
  if (first) await expect(main.getByRole('textbox')).not.toHaveAccessibleName(first);
  await fillStepPages(page);
  await expect(h1('Style your trousers')).toBeVisible();
});
