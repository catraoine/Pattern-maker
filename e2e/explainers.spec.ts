import { chooseChip, expect, startWithExample, test } from './fixtures';

// Each Style section says what its pick does, and its drawing opens full size (Cat's E2 + E3 and extras).
test('a picked choice is explained, and its drawing opens full size', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const details = main.getByRole('group', { name: 'Details', exact: true });
  await chooseChip(page, 'Details', 'Box pleats');
  await expect(details.getByText(/Folds that face away from each other/)).toBeVisible();
  // A section without picture tiles: its little drawing opens full size, and Escape closes it.
  await details.getByRole('button', { name: 'See the drawing full size' }).click();
  const big = page.getByRole('dialog', { name: 'Box pleats' });
  await expect(big).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(big).toHaveCount(0);
  // A picked picture tile: tapping its drawing opens it full size, and Close closes it.
  const silhouette = main.getByRole('group', { name: 'Silhouette', exact: true });
  await chooseChip(page, 'Silhouette', 'Trumpet');
  await expect(silhouette.getByText(/like the bell of a trumpet/)).toBeVisible();
  await silhouette.getByRole('button', { name: 'Trumpet', exact: true }).locator('svg').click();
  const tile = page.getByRole('dialog', { name: 'Trumpet' });
  await expect(tile).toBeVisible();
  await tile.getByRole('button', { name: 'Close' }).click();
  await expect(tile).toHaveCount(0);
  await expect(silhouette.getByRole('button', { name: 'Trumpet', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
