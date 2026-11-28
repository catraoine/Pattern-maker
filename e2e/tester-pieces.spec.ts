import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { chooseDrop, download, expect, fillStepPages, goPrint, measureMe, openFresh, test } from './fixtures';

// The five tester pieces walked as a tester walks them (Nov 16, after the trouser re-measure note turned out to be
// hidden on a look's own page): measured, the look made from the collection, its page read, then printed as the
// pattern and the instructions booklet, each opening with as many pages as the buttons say. On Letter and on A4, since
// testers print on both. SHOTS=<folder> keeps each walk's screens, PDFs and notes for a look by eye.
const PIECES = ['Blush Shift', 'Ice Peplum Top', 'Black Pleated Skirt', 'Chocolate Barrel Trouser', 'Black Vest'];
const main = (page: Page) => page.getByRole('main');

for (const paper of ['Letter', 'A4'])
for (const name of PIECES)
  test(`a tester measures, makes and prints the ${name} on ${paper}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await openFresh(page);
    await main(page).getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main(page).getByRole('button', { name: 'Choose what to make' }).click();
    await main(page).getByRole('button', { name: 'The collection ›' }).click();
    const card = main(page).locator('.set-piece, li').filter({ has: page.getByRole('heading', { name, exact: true }) }).last();
    await card.getByRole('button', { name: /^Make (this look|the \w+)$/ }).click();
    // The pages it still needs, then the look itself, ready to print.
    const made = main(page).getByRole('button', { name: 'Change a detail' });
    for (let n = 0; n < 6 && !(await made.isVisible()); n++) {
      if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
      else await page.waitForTimeout(300);
    }
    await expect(made).toBeVisible();
    await expect(main(page).getByRole('heading', { level: 1, name: new RegExp(name, 'i') })).toBeVisible();
    await expect(main(page).locator('.msg.error')).toHaveCount(0);
    const notes = await main(page).locator('.msg').allTextContents();
    const shots = process.env.SHOTS;
    if (shots) await page.screenshot({ path: `${shots}/${name.replace(/ /g, '-')}-look.png`, fullPage: true });
    await goPrint(page);
    // The shift is cut again from lining: its piece list says so, not just "cut 1 on fold" (DU walk, Nov 21). The list
    // is the rows of Print only some pieces since Nov 28.
    if (name === 'Blush Shift') await expect(main(page).locator('.print-some label').first()).toContainText(', and again in lining');
    await chooseDrop(page, 'Paper', paper);
    const pattern = main(page).getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ });
    await expect(pattern).toBeEnabled({ timeout: 90_000 });
    const pages = Number((await pattern.textContent())!.match(/\((\d+)/)![1]);
    const a = await download(page, pattern, info);
    expect((await PDFDocument.load(a.bytes)).getPageCount()).toBe(pages);
    const booklet = main(page).getByRole('button', { name: /^Download instructions \(\d+ pages?\)$/ });
    const bookPages = Number((await booklet.textContent())!.match(/\((\d+)/)![1]);
    const b = await download(page, booklet, info);
    expect((await PDFDocument.load(b.bytes)).getPageCount()).toBe(bookPages);
    const printText = await main(page).innerText();
    if (shots) {
      await page.screenshot({ path: `${shots}/${name.replace(/ /g, '-')}-print.png`, fullPage: true });
      await writeFile(`${shots}/${name.replace(/ /g, '-')}-${paper}-pattern.pdf`, a.bytes);
      await writeFile(`${shots}/${name.replace(/ /g, '-')}-${paper}-instructions.pdf`, b.bytes);
      await writeFile(`${shots}/${name.replace(/ /g, '-')}-notes.txt`, `LOOK PAGE NOTES:\n${notes.join('\n')}\n\nPRINT PAGE:\n${printText}\n`);
    }
  });
