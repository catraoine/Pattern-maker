import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// Skirt waist options: a faced waist with no band, a high waist, and the zip at the side (Cat's styling gaps, 2026-10-23).
test('skirt waist: faced, high and a side zip', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Skirt');
  await chooseChip(page, 'Silhouette', 'A-line');
  await chooseChip(page, 'Waist', 'Faced, no band');
  await expect(main.getByText(/A-line skirt with a faced waist/i).filter({ visible: true }).first()).toBeVisible();
  // The piece list sits beside the drawing on a computer.
  if (info.project.name === 'desktop') await expect(main.getByText(/Waist facings: cut 1 front and 1 back/).first()).toBeVisible();
  await chooseChip(page, 'Waist', 'High waist');
  await expect(main.getByText(/high-waisted A-line skirt/i).filter({ visible: true }).first()).toBeVisible();
  const waist = await openGroup(page, 'Waist');
  await waist.getByRole('button', { name: 'Zip: Left side' }).click();
  await expect(main.getByText(/high-waisted A-line skirt with a side zip/i).filter({ visible: true }).first()).toBeVisible();
  await expect(waist.getByText(/back is cut whole on the fold/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('skirt-high-side.png'), fullPage: true });
  // A gathered skirt keeps its band.
  await chooseChip(page, 'Silhouette', 'Gathered');
  await expect((await openGroup(page, 'Waist')).getByRole('button', { name: 'High waist' })).toBeDisabled();
  await expect((await openGroup(page, 'Waist')).getByRole('button', { name: 'Faced, no band' })).toBeDisabled();
});
