import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// A skirt yoke and a button-front skirt (Cat's styling gaps, 2026-10-24).
test('skirt front: a yoke, then buttons down the front', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Skirt');
  await chooseChip(page, 'Silhouette', 'A-line');
  await chooseChip(page, 'Length', 'Knee');
  await chooseChip(page, 'Front', 'Yoke');
  await expect(main.getByText(/knee a-line skirt with a yoke/i).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('yoke.png'), fullPage: true });
  // In-seam pockets would open where the yoke meets the side seam.
  await expect((await openGroup(page, 'Pockets')).getByRole('button', { name: 'In-seam' })).toBeDisabled();

  await chooseChip(page, 'Front', 'Buttoned');
  await expect(main.getByText(/knee a-line skirt with a button front/i).filter({ visible: true }).first()).toBeVisible();
  await expect((await openGroup(page, 'Front')).getByText(/buttons from the waistband to 15 cm above the hem/i)).toBeVisible();
  // A button front is the opening, so no zip choice.
  await expect(main.getByRole('button', { name: /Zip: Left side/ })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('buttons.png'), fullPage: true });
  // A pencil skirt keeps its darts and its zip.
  await chooseChip(page, 'Silhouette', 'Pencil');
  await expect((await openGroup(page, 'Front')).getByRole('button', { name: 'Buttoned' })).toBeDisabled();
});
