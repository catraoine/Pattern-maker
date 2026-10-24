import { chooseChip, expect, startWithExample, switchGarment, test } from './fixtures';

// The halter neck on the bodice and the dress: up to the neck, tied behind it (Cat's styling gaps, 2026-10-23).
test('halter: a bodice and a dress tied at the neck', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Bodice');
  await chooseChip(page, 'Neckline', 'Halter');
  await expect(main.getByText(/halter bodice tied at the neck/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('bodice-form.png'), fullPage: true });
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('bodice-drawing.png'), fullPage: true });

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Neckline', 'Halter');
  await expect(main.getByText(/halter/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('dress-form.png'), fullPage: true });
});
