import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// The shirt dress: front buttons on the dress, running on down the skirt, with a shirt collar (Cat's styling gaps, 2026-10-23).
test('shirt dress: buttons down the front and a shirt collar', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Dress');

  await chooseChip(page, 'Opening', 'Front buttons');
  await chooseChip(page, 'Collar', 'Shirt collar');
  await expect(main.getByText(/shirt dress with a shirt collar/i).filter({ visible: true }).first()).toBeVisible();
  // The skirt shapes the buttons can't run down are closed off, and so are pleats.
  const skirt = await openGroup(page, 'Skirt');
  await expect(skirt.getByRole('button', { name: 'Full circle', exact: true })).toBeDisabled();
  await expect(skirt.getByRole('button', { name: 'Gathered', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('form.png'), fullPage: true });
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('drawing.png'), fullPage: true });
});
