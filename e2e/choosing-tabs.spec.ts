import { expect, test } from './fixtures';

// Pretend tester walks, four times to DO (Nov 20): measured, then the collection, then the header's Measure before
// picking a piece. Nothing was picked, so Measure showed a skirt's list without the bust or weight just given, and
// Style and Print stayed shut until "Make something else". Measure now opens the measurements given, and Style asks
// for the choice.
test('the header tabs, while still choosing what to make', async ({ page }) => {
  test.setTimeout(120_000);
  const main = page.getByRole('main');
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < 8; i++) {
    const h = await main.getByRole('heading').first().innerText();
    if (/look right/i.test(h)) break;
    const v = /waist to floor/i.test(h) ? '106' : /waist/i.test(h) ? '73' : /bust/i.test(h) ? '92' : /hip/i.test(h) ? '99' : /height/i.test(h) ? '168' : '60';
    await main.locator('input').first().fill(v);
    await main.getByRole('button', { name: 'Next' }).click();
    await expect(main.getByRole('heading').first()).not.toHaveText(h);
  }
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await main.getByRole('button', { name: 'The collection ›' }).click();
  await expect(main.getByRole('heading', { name: 'The collection' })).toBeVisible();

  await page.getByRole('button', { name: 'Style', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Choose what to make first');
  await expect(main.getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();

  await main.getByRole('button', { name: 'The collection ›' }).click();
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(main).toContainText('Bust');
  await expect(main).toContainText('Weight');
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await expect(main.getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();
});
