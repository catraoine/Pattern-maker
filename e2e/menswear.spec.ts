import { expect, expectStyle, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// The menswear form (Cat's B2 Two Forms, 2026-10-18): picked before the first measurement, it asks for the
// chest, skips the bust measurements, and the bodice is drafted with no bust dart.
test('menswear form: chest, no bust measurements, a bodice with no bust dart', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page, 'Menswear');

  await expect(main.getByRole('heading', { level: 1, name: 'Your chest' })).toBeVisible();
  await expect(main.getByRole('textbox', { name: 'Chest' })).toBeVisible();
  await expect(main).not.toContainText(/bust/i);
  await fillStepPages(page);
  await expect(main.getByRole('list')).toContainText('Chest');
  await main.getByRole('button', { name: 'Choose what to make' }).click();

  await pickToMake(page, 'Bodice');
  // No high bust: straight on to the shoulders.
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText(/bust/i);
  await fillStepPages(page);
  await expectStyle(page, 'Bodice');
  await expect(page.getByText(/Bust dart/)).toHaveCount(0);
});
