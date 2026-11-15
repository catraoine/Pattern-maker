import { expect, goTab, openGroup, startWithExample, test } from './fixtures';

// A fabric that fights the style says so where it is picked, with a link to the detail that would fix it (Cat,
// Nov 14: before, the heads up showed only on Print).
test('a heavy, crisp fabric on a full circle skirt says so on Fabric, and the link opens the silhouette', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const silhouette = await openGroup(page, 'Silhouette');
  await silhouette.getByRole('button', { name: 'Full circle' }).click();
  await goTab(page, 'Fabric');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Wool' }).click();
  const headsUp = main.locator('.fabric-heads-up');
  // A good match says nothing.
  await expect(headsUp).toHaveCount(0);
  await main.locator('summary', { hasText: /About your fabric/i }).click();
  for (const t of ['Heavy', 'Crisp']) await main.getByRole('button', { name: t, exact: true }).click();
  await expect(headsUp).toContainText('A heavy, crisp fabric makes the flare stand out stiffly.');
  await headsUp.getByRole('button', { name: /Change the silhouette/ }).click();
  await expect(main.getByRole('group', { name: 'Silhouette', exact: true })).toBeVisible();
  await expect(main.getByRole('group', { name: 'Silhouette', exact: true }).getByRole('button', { name: 'Full circle' })).toHaveAttribute('aria-pressed', 'true');
});
