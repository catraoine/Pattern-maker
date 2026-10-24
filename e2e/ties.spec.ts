import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// Ties and bows: a pussy bow on the bodice, a tie sash and belt loops on the skirt and the dress (Cat's styling gaps, 2026-10-24).
test('ties: a pussy bow, a sash and belt loops', async ({ page }, info) => {
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

  await chooseChip(page, 'Collar', 'Pussy bow');
  await expect(main.getByText(/pussy-bow bodice/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('pussy-bow.png'), fullPage: true });
  // A bow ties at the front, so it can't go with a button front.
  await chooseChip(page, 'Opening', 'Front buttons');
  const collar = await openGroup(page, 'Collar');
  await expect(collar.getByRole('button', { name: 'Pussy bow' })).toBeDisabled();

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Belt', 'Sash in loops');
  await expect(main.getByText(/dress with .*a sash in loops$/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('dress-sash.png'), fullPage: true });

  await switchGarment(page, 'Skirt');
  await chooseChip(page, 'Belt', 'Belt loops');
  await expect(main.getByText(/skirt with .*belt loops/i).filter({ visible: true }).first()).toBeVisible();
  // A wrap ties already.
  await chooseChip(page, 'Waist', 'Wrap, tied');
  const belt = await openGroup(page, 'Belt');
  await expect(belt.getByRole('button', { name: 'Tie sash' })).toBeDisabled();
});
