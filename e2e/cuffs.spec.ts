import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// Cuffs: a shirt cuff, elastic or a tie, on a long or three-quarter sleeve (Cat's styling gaps, 2026-10-24).
test('cuffs: shirt, elastic and tie on the bodice and the dress', async ({ page }, info) => {
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
  await chooseChip(page, 'Sleeve shape', 'Straight');
  await chooseChip(page, 'Cuffs', 'Shirt cuff');
  await expect(main.getByText(/bodice with long sleeves with shirt cuffs$/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('shirt-cuff.png'), fullPage: true });
  // A shirt cuff is for a long sleeve; elastic goes on shorter ones too.
  await chooseChip(page, 'Sleeves', 'Elbow');
  const cuffs = await openGroup(page, 'Cuffs');
  await expect(cuffs.getByRole('button', { name: 'Shirt cuff' })).toBeDisabled();
  await chooseChip(page, 'Cuffs', 'Elastic');
  await expect(main.getByText(/elbow-length sleeves with elastic cuffs$/i).filter({ visible: true }).first()).toBeVisible();
  // A short sleeve has no cuff choice.
  await chooseChip(page, 'Sleeves', 'Short');
  await expect(main.getByRole('button', { name: 'Elastic', exact: true })).toHaveCount(0);

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Sleeves', 'Three-quarter');
  await chooseChip(page, 'Sleeve shape', 'Bishop');
  await chooseChip(page, 'Cuffs', 'Tie');
  await expect(main.getByText(/three-quarter bishop sleeves with tie cuffs/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('dress-tie-cuff.png'), fullPage: true });
});
