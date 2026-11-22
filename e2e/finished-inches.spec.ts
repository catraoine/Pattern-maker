import { expect, openAccount, openCollection, openFold, startWithExample, stepButton, test } from './fixtures';

// An inch tester's Finished measurements table on Style showed centimetres under "All in cm" (pretend-tester walk,
// Nov 17): its numbers carry no unit, so the page's inch rewrite passed them by. They follow the sewist's unit now.
test('the finished measurements follow the unit', async ({ page }, info) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  const table = main.locator('.finished');
  // On a phone the table is on the review page, after the questions; on a computer it is beside them, folded under
  // one line with the pieces since the declutter (Cat's E, Nov 21).
  const review = async () => {
    if (info.project.name !== 'phone') {
      const fold = main.locator('.style-side details.review-fold');
      if (!(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator('> summary').click();
      return;
    }
    for (let i = 0; i < 12 && !(await table.count()); i++) await page.getByRole('button', { name: /^Next\b|^Review\b/ }).last().click();
  };
  await review();
  await expect(table.getByText('All in cm.', { exact: false })).toBeVisible({ timeout: 30_000 });
  const cmText = await table.locator('tbody').innerText();
  await openAccount(page);
  await openFold(page, 'Settings');
  await main.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Inches' }).click();
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await stepButton(page, 'Style').click().catch(() => {});
  // The side fold closes again when Style opens afresh, so on a computer it is opened again.
  if (info.project.name !== 'phone' || !(await table.count())) await review();
  await expect(table.getByText('All in inches.', { exact: false })).toBeVisible({ timeout: 30_000 });
  const inText = await table.locator('tbody').innerText();
  // Inches to the eighth, the tape's way: no decimals, and the bust reads well under its centimetres.
  expect(inText).not.toMatch(/\d+\.\d/);
  const bust = (t: string) => parseFloat(t.split('\n').find((l) => /^Bust|^Waist/.test(l))!.replace(/^\D+/, ''));
  expect(bust(inText)).toBeLessThan(bust(cmText) / 2);
  await page.screenshot({ path: 'test-results/finished-inches.png' });
});

// What a screen reader says is in inches too: the spoken names kept "47 cm below the waist" and "6 cm below the waist"
// on the collection (pretend tester, Nov 18).
test('the spoken names follow the unit', async ({ page }) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openAccount(page);
  await openFold(page, 'Settings');
  await main.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Inches' }).click();
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await stepButton(page, 'Style').click().catch(() => {});
  await openCollection(page);
  await expect(main.getByRole('heading', { name: 'The collection' })).toBeVisible();
  const spoken = await main.locator('[aria-label], [aria-valuetext]').evaluateAll((els) => els.flatMap((e) => [e.getAttribute('aria-label') ?? '', e.getAttribute('aria-valuetext') ?? '']));
  expect(spoken.filter((t) => /\d\s*cm\b/.test(t))).toEqual([]);
});
