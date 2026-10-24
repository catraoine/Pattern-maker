import { addCloserFit, chooseChip, expect, fillStepPages, measureMe, openFresh, openGroup, pickToMake, switchGarment, test } from './fixtures';

// A ruffle neckline and a shirred back (Cat's styling gaps, 2026-10-24).
test('ruffle neckline on a bodice and a dress, and a shirred cami top', async ({ page }, info) => {
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

  await chooseChip(page, 'Neckline', 'V-neck');
  await chooseChip(page, 'Collar', 'Ruffle');
  await expect(main.getByText(/ruffled V-neck bodice/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('ruffle.png'), fullPage: true });

  await chooseChip(page, 'Neckline', 'Cami straps');
  await chooseChip(page, 'Structure', 'Shirred back');
  await expect(main.getByText(/cami bodice with spaghetti straps and a shirred back/i).filter({ visible: true }).first()).toBeVisible();
  await expect((await openGroup(page, 'Structure')).getByText(/pulls on with no zip/)).toBeVisible();
  await main.getByRole('button', { name: 'Back', exact: true }).first().click();
  await page.screenshot({ path: info.outputPath('shirred.png'), fullPage: true });

  // A dress keeps its boning or soft back: no shirred back there.
  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Neckline', 'Crew');
  await chooseChip(page, 'Collar', 'Ruffle');
  await expect(main.getByText(/dress with a ruffled neckline/i).filter({ visible: true }).first()).toBeVisible();
});
