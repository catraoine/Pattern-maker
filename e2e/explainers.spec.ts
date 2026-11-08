import { chooseChip, expect, startWithExample, test } from './fixtures';

// Each Style section says what its pick does, and a picked tile's drawing opens full size (Cat's E2 + E3; the
// little drawing beside the line went in Cat's D, 2026-10-24).
test('a picked choice is explained, and its picture is a crop of the form', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const details = main.getByRole('group', { name: 'Fullness', exact: true });
  await chooseChip(page, 'Fullness', 'Box pleats');
  // A phone shows the short line (Cat's P1, 2026-10-31), a computer the full one.
  await expect(details.getByText(/Folds that face away from each other|Pleats facing apart/).filter({ visible: true })).toBeVisible();
  // A picked picture tile: tapping its drawing opens it full size, and Close closes it.
  const silhouette = main.getByRole('group', { name: 'Silhouette', exact: true });
  await chooseChip(page, 'Silhouette', 'Trumpet');
  await expect(silhouette.getByText(/like the bell of a trumpet|flared low down/).filter({ visible: true })).toBeVisible();
  // The tile shows a crop of our own form drawing (Cat's A2, Nov 8); the drawing above shows the pick full size,
  // so a tap on the picked tile opens nothing more.
  const tilePic = silhouette.getByRole('button', { name: 'Trumpet', exact: true }).locator('img.pic-photo');
  await expect(tilePic).toHaveAttribute('src', '/pics/skirt-silhouette-trumpet.webp');
  await expect(page.getByRole('dialog', { name: 'Trumpet' })).toHaveCount(0);
  await expect(silhouette.getByRole('button', { name: 'Trumpet', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
