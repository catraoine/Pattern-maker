import { download, expect, goPrint, startWithExample, test, showAllTools } from './fixtures';

// Files for other pattern software, under More files on the print screen.
test('pro files: pattern DXF, measurements for Seamly2D and CLO, and the 3D body', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main.getByText('More files').click();

  const dxf = await download(page, main.getByRole('button', { name: 'Pattern (DXF)', exact: true }), info);
  expect(dxf.bytes.toString('latin1')).toContain('AC1009');

  const vit = await download(page, main.getByRole('button', { name: 'Measurements (Seamly2D)' }), info);
  expect(vit.download.suggestedFilename()).toMatch(/-measurements\.vit$/);
  expect(vit.bytes.toString('utf8')).toContain('<m name="waist_circ"');

  const csv = await download(page, main.getByRole('button', { name: 'Measurements (CSV)' }), info);
  expect(csv.bytes.toString('utf8').split('\r\n')[0]).toBe('Measurement,cm,in,Seamly2D name,How it was taken');
  const obj = await download(page, main.getByRole('button', { name: '3D body (OBJ)' }), info);
  expect(obj.download.suggestedFilename()).toMatch(/-body\.obj$/);
  const text = obj.bytes.toString('utf8');
  expect(text).toContain('Units: millimetres');
  expect(text).toMatch(/#\s+Bust: 82\.0 at/);
  expect(text.split('\n').filter((l) => l.startsWith('f ')).length).toBeGreaterThan(20000);
  await main.getByText('More files').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('more-files.png'), fullPage: false });
});

// After a toile, the corrections go to a pattern cutter as alterations to make on their own block.
test('pro files: toile alterations for a pattern cutter', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main.getByRole('button', { name: 'I’ve tried on a toile' }).click();
  await main.getByText('Pulls across the hips').click();
  await main.getByRole('button', { name: /^Save as version 2$/ }).click();
  if (!(await main.getByText('More files').isVisible())) await goPrint(page);
  await main.getByText('More files').click();
  const csv = await download(page, main.getByRole('button', { name: 'Alterations (CSV)' }), info);
  const rows = csv.bytes.toString('utf8').split('\r\n');
  expect(rows[0]).toBe('Area,What the toile showed,Alteration');
  expect(rows[1]).toContain('Let out the hip by 2 cm in all: add 0.5 cm at each side seam');
});
