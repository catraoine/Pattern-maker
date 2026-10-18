import { download, expect, startWithExample, test } from './fixtures';

// Files for other pattern software, under More files on the print screen.
test('pro files: pattern DXF and measurements for Seamly2D and CLO', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Print my pattern' }).click();
  const all = main.getByRole('button', { name: 'Show all tools' });
  if (await all.count()) await all.click();
  await main.getByText('More files').click();

  const dxf = await download(page, main.getByRole('button', { name: 'Pattern (DXF)', exact: true }), info);
  expect(dxf.bytes.toString('latin1')).toContain('AC1009');

  const vit = await download(page, main.getByRole('button', { name: 'Measurements (Seamly2D)' }), info);
  expect(vit.download.suggestedFilename()).toMatch(/-measurements\.vit$/);
  expect(vit.bytes.toString('utf8')).toContain('<m name="waist_circ"');

  const csv = await download(page, main.getByRole('button', { name: 'Measurements (CSV)' }), info);
  expect(csv.bytes.toString('utf8').split('\r\n')[0]).toBe('Measurement,cm,in,Seamly2D name,How it was taken');
  await main.getByText('More files').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('more-files.png'), fullPage: false });
});
