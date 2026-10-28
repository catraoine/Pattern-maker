import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// The wrap: the fronts cross over in a V and tie at the waist (Cat's styling gaps, 2026-10-23).
test('wrap: a bodice that crosses over and ties', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Bodice');
  await chooseChip(page, 'Opening', 'Wrap');
  await expect(main.getByText(/wrap V-neck bodice/i).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath('bodice-form.png'), fullPage: true });
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('bodice-drawing.png'), fullPage: true });
});

test('wrap: a dress and a skirt that cross over and tie', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Skirt', 'A-line');
  await chooseChip(page, 'Opening', 'Wrap');
  await expect(main.getByText(/wrap dress with/i).first()).toBeAttached();
  // The skirt wraps too, so it takes no circle, pleats or pockets.
  const skirt = await openGroup(page, 'Skirt');
  await expect(skirt.getByRole('button', { name: 'Full circle', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('dress-form.png'), fullPage: true });
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await page.screenshot({ path: info.outputPath('dress-drawing.png'), fullPage: true });

  await switchGarment(page, 'Skirt');
  await chooseChip(page, 'Silhouette', 'A-line');
  await chooseChip(page, 'Waist', 'Wrap, tied');
  await expect(main.getByText(/A-line wrap skirt/i).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath('skirt-form.png'), fullPage: true });
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /Pattern/ }).click();
  await page.screenshot({ path: info.outputPath('skirt-pattern.png'), fullPage: true });
});
