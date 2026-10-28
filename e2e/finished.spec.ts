import { expect, openReview, startWithExample, switchGarment, test } from './fixtures';

// The finished measurements up front (F1 Table Up Front, Cat, 2026-10-28): on Review, open above Print,
// each garment against you with the ease and a fit word.
test('Review shows the finished measurements and ease, open above Print', async ({ page }, info) => {
  test.setTimeout(120_000);
  await startWithExample(page);
  for (const [garment, noun, rows] of [
    ['Dress', 'Dress', ['Bust', 'Waist', 'Hip', 'Length, nape to hem']],
    ['Skirt', 'Skirt', ['Waist', 'Hip', 'Length, waist to hem']],
  ] as const) {
    await switchGarment(page, garment);
    const onPage = await openReview(page);
    const table = page.getByRole('main').locator('table.finished-table').filter({ visible: true }).first();
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: noun, exact: true })).toBeVisible();
    for (const r of rows) await expect(table.getByRole('rowheader', { name: r, exact: true })).toBeVisible();
    // The ease is signed and the girths carry a fit word.
    await expect(table.getByRole('row', { name: /^Waist / })).toContainText(/[+−]\d/);
    await expect(table.getByRole('row', { name: /^Waist / })).toContainText(/Close|Comfy|Roomy|Held in/);
    await page.screenshot({ path: info.outputPath(`${garment.toLowerCase()}-review.png`), fullPage: true });
    if (onPage) await page.goBack();
  }
});
