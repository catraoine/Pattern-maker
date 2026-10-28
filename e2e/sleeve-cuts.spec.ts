import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// Sleeve cuts: a dropped shoulder, a raglan or a kimono sleeve (Cat's styling gaps, 2026-10-24).
test('sleeve cuts: raglan and dropped shoulder on the bodice, kimono on the dress', async ({ page }, info) => {
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
  await chooseChip(page, 'Sleeve cut', 'Raglan');
  await expect(main.getByText(/bodice with long raglan sleeves$/i).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath('raglan.png'), fullPage: true });
  // A kimono sleeve goes to three-quarter length at most.
  const cut = await openGroup(page, 'Sleeve cut');
  await expect(cut.getByRole('button', { name: 'Kimono' })).toBeDisabled();
  await chooseChip(page, 'Sleeve cut', 'Dropped shoulder');
  await expect(main.getByText(/bodice with long dropped-shoulder sleeves$/i).first()).toBeAttached();

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Sleeves', 'Elbow');
  await chooseChip(page, 'Sleeve cut', 'Kimono');
  await expect(main.getByText(/elbow-length kimono sleeves/i).first()).toBeAttached();
  // Cut on with the bodice: no sleeve shape of its own.
  await expect(main.getByRole('button', { name: 'Puff', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('kimono-dress.png'), fullPage: true });
});
