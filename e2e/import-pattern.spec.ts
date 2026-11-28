import { download, expect, goPrint, openAccount, startWithExample, test, showAllTools, openSew } from './fixtures';

// A DXF from pattern software, opened on Check any pattern: seams walked, then printed and sent like a pattern drafted here.
test('import a pattern: check a DXF, then use it to print and send', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  // The app's own DXF stands in for one from CLO or Gerber: it is written the same AAMA way.
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main.getByText('More files').click();
  const dxf = await download(page, main.getByRole('button', { name: 'Pattern (DXF)', exact: true }), info);

  await openAccount(page);
  await main.getByRole('button', { name: 'Check a pattern file' }).click();
  await main.locator('input[type=file]').setInputFiles(dxf.path);
  await expect(main.getByText(/seams? pairs? within 1 mm/)).toBeVisible();
  await main.getByRole('button', { name: 'Use this pattern' }).click();

  await expect(main.getByRole('group', { name: 'Paper' })).toBeVisible();
  await expect(main.getByText(/\.dxf, \d+ pieces from Maison Tracé/)).toBeVisible();
  const pdf = main.getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ });
  await expect(pdf).toBeEnabled({ timeout: 45_000 });
  const { bytes } = await download(page, pdf, info);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  // A file's pattern has no Sew tab of its own, so its cutting layout and written steps follow on the same page.
  await expect(main.getByRole('heading', { name: 'Every step as a list' })).toBeVisible();
  // With no Sew tab for a pattern read from a file, Sewing mode starts here.
  await main.getByRole('button', { name: /^Start sewing/ }).click();
  await expect(page.getByRole('dialog', { name: /^Sewing your / })).toBeVisible();
  await page.getByRole('dialog', { name: /^Sewing your / }).getByRole('button', { name: /^Close/ }).click();
  await openSew(page);
  await expect(main.getByText('Join the seams')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Send to a dressmaker' })).toBeEnabled({ timeout: 45_000 });
  // No toile, fabric check or save: those belong to patterns drafted here.
  await expect(main.getByText('Sew a toile first')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('imported-print.png'), fullPage: true });
});
