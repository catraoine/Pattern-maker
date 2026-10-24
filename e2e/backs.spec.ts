import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// Back details: a scoop or V back, or a keyhole with a button loop (Cat's styling gaps, 2026-10-24).
test('backs: a V back on the bodice, a keyhole on the dress', async ({ page }, info) => {
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

  await chooseChip(page, 'Back', 'V back');
  await expect(main.getByText(/bodice with a V back$/i).filter({ visible: true }).first()).toBeVisible();
  // A collar goes round the back neck, so it waits for a plain back.
  const collar = await openGroup(page, 'Collar');
  await expect(collar.getByRole('button', { name: 'Mandarin' })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('v-back.png'), fullPage: true });

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Back', 'Keyhole');
  await expect(main.getByText(/a keyhole back/i).filter({ visible: true }).first()).toBeVisible();
});
