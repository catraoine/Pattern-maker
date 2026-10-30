import { chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// The gathered skirt, on its own and under a dress bodice (Cat's styling gaps, 2026-10-23).
test('gathered skirt: a skirt and a dress skirt, gathered at the waist', async ({ page }, info) => {
  test.setTimeout(180_000);
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);

  await chooseChip(page, 'Silhouette', 'Gathered');
  const group = await openGroup(page, 'Silhouette');
  await expect(group.getByRole('button', { name: 'Gathered', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByText(/gathered into the waistband/)).toBeVisible();
  // Its fullness comes from the gathers, so there is no flare to drag.
  await expect(main.getByRole('slider', { name: /flare/i })).toHaveCount(0);
  await group.screenshot({ path: info.outputPath('skirt.png') });

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Silhouette', 'Gathered');
  await expect((await openGroup(page, 'Silhouette')).getByRole('button', { name: 'Gathered', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('dress.png'), fullPage: true });
});
