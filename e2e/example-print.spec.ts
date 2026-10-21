import { expect, goPrint, startWithExample, test } from './fixtures';

// Printing the example body asks first (Cat, 2026-10-21): Measure me, or print the example anyway.
test('printing the example body asks before it prints', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  const pdf = main.getByRole('button', { name: /^Download PDF \(\d+ pages?\)$/ });
  await expect(pdf).toBeEnabled({ timeout: 45_000 });
  await pdf.click();
  const ask = main.getByRole('alertdialog');
  await expect(ask).toContainText('drafted to an example body');
  await ask.getByRole('button', { name: 'Measure me' }).click();
  await expect(main.getByRole('heading', { name: /take some measurements/i })).toBeVisible();
});
