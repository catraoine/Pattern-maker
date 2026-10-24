import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// Sleeves set to any length on a slider, and the cap and flutter shapes (Cat's styling gaps, 2026-10-23).
test('sleeves: any length on the slider, cap and flutter', async ({ page }, info) => {
  test.setTimeout(180_000);
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Bodice');
  await fillStepPages(page);
  await addCloserFit(page, 'Bodice');

  await chooseChip(page, 'Sleeves', 'Long');
  const group = await openGroup(page, 'Sleeves');
  const slider = group.getByRole('slider', { name: 'Sleeve length, in cm from the shoulder' });
  await expect(slider).toBeVisible();
  await slider.fill('45');
  await expect(group.getByText(/^45 cm from the shoulder\. Between /)).toBeVisible();
  // Set by hand, no named length chip stays picked, as with a dragged hem.
  await expect(group.getByRole('button', { name: 'Long', exact: true })).toHaveAttribute('aria-pressed', 'false');
  // The title says "sleeves" without a length.
  await expect(main.getByText(/^waist-length crew neck bodice with sleeves$/i).filter({ visible: true }).first()).toBeVisible();
  await group.screenshot({ path: info.outputPath('slider.png') });

  await chooseChip(page, 'Sleeves', 'Short');
  await chooseChip(page, 'Sleeve shape', 'Flutter');
  await expect(main.getByText(/^waist-length crew neck bodice with flutter sleeves$/i).filter({ visible: true }).first()).toBeVisible();
  await group.screenshot({ path: info.outputPath('flutter.png') });

  // A cap sleeve has its own length, so the slider goes.
  await chooseChip(page, 'Sleeve shape', 'Cap');
  await expect(slider).toHaveCount(0);
  await expect(main.getByText(/^waist-length crew neck bodice with cap sleeves$/i).filter({ visible: true }).first()).toBeVisible();

  // The dress takes the same sleeves.
  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Sleeves', 'Elbow');
  const dressSlider = (await openGroup(page, 'Sleeves')).getByRole('slider', { name: 'Sleeve length, in cm from the shoulder' });
  await dressSlider.fill('40');
  await expect((await openGroup(page, 'Sleeves')).getByText(/^40 cm from the shoulder\./)).toBeVisible();
});
