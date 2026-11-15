import { PDFDocument } from 'pdf-lib';
import { chooseDrop, download, expect, goPrint, startWithExample, test } from './fixtures';

// What they download is what they print (Cat, Nov 15): the pattern is the page map and the pages that tape together, and the
// cover, cutting layout and sewing steps are an instructions booklet of their own.
test('Print gives the pattern and the instructions as two files', async ({ page }, info) => {
  await startWithExample(page);
  await goPrint(page);
  await chooseDrop(page, 'Paper', 'A4');
  const main = page.getByRole('main');
  const pattern = main.getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ });
  await expect(pattern).toBeEnabled({ timeout: 45_000 });
  const pages = Number((await pattern.textContent())!.match(/\((\d+)/)![1]);
  const a = await download(page, pattern, info);
  expect(a.download.suggestedFilename()).toMatch(/-a4\.pdf$/);
  expect((await PDFDocument.load(a.bytes)).getPageCount()).toBe(pages);
  const booklet = main.getByRole('button', { name: /^Download instructions \(\d+ pages?\)$/ });
  const bookPages = Number((await booklet.textContent())!.match(/\((\d+)/)![1]);
  const b = await download(page, booklet, info);
  expect(b.download.suggestedFilename()).toMatch(/-instructions\.pdf$/);
  const doc = await PDFDocument.load(b.bytes);
  expect(doc.getPageCount()).toBe(bookPages);
  expect(doc.getTitle()).toMatch(/\(instructions\)$/);
});
