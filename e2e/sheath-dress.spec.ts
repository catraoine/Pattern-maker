import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// Sheath and shift dresses: cut in one from shoulder to hem, with no waist seam (Cat's styling gaps, 2026-10-23).
test('sheath and shift: a dress with no waist seam', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Dress');

  await chooseChip(page, 'Cut', 'Sheath');
  await expect(main.getByText(/sheath dress with/i).first()).toBeAttached();
  // Cut in one, the dress has no skirt shape to pick, and can't take princess seams or a strapless top.
  await expect(main.getByRole('group', { name: 'Skirt', exact: true })).toHaveCount(0);
  const neck = await openGroup(page, 'Neckline');
  await expect(neck.getByRole('button', { name: 'Strapless', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('sheath-form.png'), fullPage: true });
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('sheath-drawing.png'), fullPage: true });

  await chooseChip(page, 'Cut', 'Shift');
  await expect(main.getByText(/shift dress with/i).first()).toBeAttached();
  await chooseChip(page, 'Cut', 'Waist seam');
  await expect((await openGroup(page, 'Skirt')).getByRole('button', { name: 'Full circle', exact: true })).toBeVisible();
});
