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

  const count = main.getByText(/^Trousers · \d+ of \d+$/);
  const total = (await count.textContent())?.match(/· 2 of (\d+)$/)?.[1];
  expect(total).toBeTruthy();

  // A reload carries the count on, rather than starting it again at 1 (EJ walk, Nov 27).
  await page.evaluate(() => location.reload());
  await page.waitForLoadState('load');
  await expect(main.getByText(`Trousers · 2 of ${total}`)).toBeVisible();

  // A new visit, as after closing the app: the landing page carries on with the trousers, where it offered only Begin
  // (EJ walk, Nov 27).
  await page.goto('/');
  await skipLoading(page);
  await main.getByRole('button', { name: 'Carry on with your trousers' }).click();
  await expect(main.getByText(`Trousers · 2 of ${total}`)).toBeVisible();

  await expect(main.getByRole('textbox')).toHaveCount(1);
  if (first) await expect(main.getByRole('textbox')).not.toHaveAccessibleName(first);

  // Style keeps to the trousers' pages, not the garments.
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Style' }).click();
  await expect(main.getByRole('textbox')).toHaveCount(1);
  await expect(main).toContainText('Style and Print open once your measurements are in.');
  await expect(h1('What would you like to make?')).toHaveCount(0);
  await fillStepPages(page);
  await expect(h1('Style your trousers')).toBeVisible();
});
