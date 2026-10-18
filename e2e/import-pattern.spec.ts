import { download, expect, openAccount, startWithExample, test } from './fixtures';

// A DXF from pattern software, opened on Check any pattern: seams walked, then printed and sent like a pattern drafted here.
test('import a pattern: check a DXF, then use it to print and send', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  // The app's own DXF stands in for one from CLO or Gerber: it is written the same AAMA way.
  await main.getByRole('button', { name: 'Print my pattern' }).click();
  const all = main.getByRole('button', { name: 'Show all tools' });
  if (await all.count()) await all.click();
  await main.getByText('More files').click();
  const dxf = await download(page, main.getByRole('button', { name: 'Pattern (DXF)', exact: true }), info);

  await openAccount(page);
  await main.getByRole('button', { name: 'Check a pattern file' }).click();
  await main.locator('input[type=file]').setInputFiles(dxf.path);
  await expect(main.getByText(/seams? pairs? within 1 mm/)).toBeVisible();
  await main.getByRole('button', { name: 'Use this pattern' }).click();

  await expect(main.getByRole('group', { name: 'Paper' })).toBeVisible();
  await expect(main.getByText(/\.dxf · \d+ pieces from Maison Tracé/)).toBeVisible();
  const pdf = main.getByRole('button', { name: /^Download PDF \(\d+ pages?\)$/ });
  await expect(pdf).toBeEnabled({ timeout: 45_000 });
  const { bytes } = await download(page, pdf, info);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(main.getByRole('heading', { name: 'How to sew it' })).toBeVisible();
  await expect(main.getByText('Join the seams')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Send to a dressmaker' })).toBeEnabled({ timeout: 45_000 });
  // No toile, fabric check or save: those belong to patterns drafted here.
  await expect(main.getByText('Fit it in a toile first')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('imported-print.png'), fullPage: true });
});
