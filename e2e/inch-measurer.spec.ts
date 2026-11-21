import { expect, openFresh, test } from './fixtures';

// Measuring starts in cm. A fit tester measured in inches without tapping IN and had every number turned away with "Is
// the unit right?" (Nov 17): a number that fits as inches now gets a one-tap switch. And her 150 lb came back as
// 149.9 lb on the check page, the weight having been kept to a tenth of a kilo.
test('a number taken in inches gets a one-tap switch, and a weight in pounds reads back as typed', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  const box = main.locator('#step-value');
  await box.fill('28');
  await box.blur();
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  await main.getByRole('button', { name: /Switch to inches/ }).click();
  await expect(main.getByRole('button', { name: 'Inches' })).toHaveAttribute('aria-pressed', 'true');
  await expect(box).toHaveValue('28');
  await expect(main.getByText(/can be from/)).toHaveCount(0);
  // Far too small in either unit: no switch is offered.
  await box.fill('3');
  await box.blur();
  await expect(main.getByText(/Waist can be from/)).toBeVisible();
  await expect(main.getByRole('button', { name: /Switch to inches/ })).toHaveCount(0);
  await box.fill('28');
  for (const n of ['36', '38', '58']) {
    await main.getByRole('button', { name: /^Next\b/ }).click();
    await main.locator('#step-value').fill(n);
  }
  await main.getByRole('button', { name: /^Next\b/ }).click();
  await main.locator('#step-value').fill('5');
  await main.locator('#step-inches').fill('5');
  await main.getByRole('button', { name: /^Next\b/ }).click();
  await page.locator('#step-weight').fill('150');
  await expect(page.getByRole('button', { name: 'Pounds' })).toHaveAttribute('aria-pressed', 'true');
  await main.getByRole('button', { name: /^Next\b/ }).click();
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(main.getByText('150 lb', { exact: true })).toBeVisible();
  await expect(main.getByText('28 in', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/inch-measurer-check.png' });
});
