import { expect, goPrint, startWithExample, test } from './fixtures';

// Reprinting one lost piece shouldn't mean the whole pattern again (Reddit research, 2026-10-28).
test('print only some pieces lays out fewer pages', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  const pdf = main.getByRole('button', { name: /^Download PDF \(\d+ pages?\)$/ });
  await expect(pdf).toBeEnabled({ timeout: 45_000 });
  const pagesOf = async () => Number((await pdf.textContent())!.match(/\((\d+) pages?\)/)![1]);
  const all = await pagesOf();

  await main.getByText('Print only some pieces').click();
  const boxes = main.locator('.print-some input[type=checkbox]');
  const n = await boxes.count();
  expect(n).toBeGreaterThan(1);
  // Leave everything out but the first piece: the last box left on can't be unticked.
  for (let i = 1; i < n; i++) await boxes.nth(i).uncheck();
  await expect(boxes.nth(0)).toBeDisabled();
  await expect(main.getByText(`Printing 1 of ${n} pieces`)).toBeVisible();
  await expect.poll(pagesOf).toBeLessThan(all);
});
