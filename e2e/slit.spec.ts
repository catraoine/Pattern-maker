import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// A slit as a choice: back, side or front, at a height set above the hem (Cat's styling gaps, 2026-10-23).
test('slit: chosen on a skirt and a dress, its height set', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Skirt');
  await chooseChip(page, 'Silhouette', 'Straight');
  await chooseChip(page, 'Length', 'Maxi');
  await chooseChip(page, 'Slit', 'Side');
  await expect(main.getByText(/maxi straight skirt with a side slit/i).first()).toBeAttached();
  const group = await openGroup(page, 'Slit');
  const slider = group.getByRole('slider', { name: /Slit height/ });
  await slider.fill('40');
  await expect(group.getByText(/40 cm up the left side from the hem/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('skirt-slit.png'), fullPage: true });
  // A circle skirt takes none.
  await chooseChip(page, 'Silhouette', 'Full circle');
  await expect((await openGroup(page, 'Slit')).getByRole('button', { name: /Front/ })).toBeDisabled();

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Skirt', 'Straight');
  await chooseChip(page, 'Slit', 'Front');
  await expect(main.getByText(/dress with a front slit/i).first()).toBeAttached();
  await main.getByRole('button', { name: 'Flat', exact: true }).click();
  await page.screenshot({ path: info.outputPath('dress-slit.png'), fullPage: true });
});
