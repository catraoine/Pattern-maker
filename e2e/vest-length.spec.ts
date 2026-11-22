import { expect, openCollection, startWithExample, test } from './fixtures';

// The Black Vest's Length (Cropped, Hip, Long) changed the vest's name but not the vest: the look's hem, 30 cm below
// the waist, held over every pick (pretend-tester walk, Nov 17). A length picked now sets the hem.
test('a length picked for the Black Vest sets its hem', async ({ page }, info) => {
  test.setTimeout(3 * 60_000);
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  const card = main.getByRole('listitem').filter({ hasText: 'Black Vest' }).first();
  await card.getByRole('button', { name: /^Make the vest|^Make this look/i }).first().click();
  // A look opens on its review, with the table, on a phone; on a computer the table stands beside the questions.
  const change = main.getByRole('button', { name: 'Change a detail' });
  if (info.project.name !== 'phone' && (await change.count())) await change.click();
  const table = main.locator('.finished');
  const back = async () => {
    // On a computer the table is folded in the side panel since the declutter (Cat's E, Nov 21).
    const fold = main.locator('.style-side details.review-fold');
    if (info.project.name !== 'phone' && (await fold.count()) && !(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator('> summary').click();
    if (info.project.name === 'phone') for (let i = 0; i < 12 && !(await table.count()); i++) await page.getByRole('button', { name: /^Next\b|^Review\b/ }).last().click();
    const row = table.getByRole('row').filter({ hasText: 'Centre back length' });
    await expect(row).toBeVisible({ timeout: 30_000 });
    return parseFloat((await row.getByRole('cell').nth(1).innerText()).trim());
  };
  const long = await back();
  if (info.project.name === 'phone') await main.getByRole('button', { name: 'Change a detail' }).click();
  // Step through the questions to the one that asks the length.
  const cropped = main.getByRole('button', { name: /^Cropped/ });
  for (let i = 0; i < 8 && !(await cropped.count()); i++) {
    const length = main.getByRole('button', { name: /^Length\b/ });
    if (await length.count()) await length.first().click();
    else await page.getByRole('button', { name: /^Next\b/ }).last().click();
  }
  await cropped.first().click();
  const short = await back();
  expect(short).toBeLessThan(long - 10);
  // It is still the Black Vest, only shorter: a length is the maker's own (pretend-tester walk, Nov 18, it read "Your vest").
  await expect(page.getByRole('heading', { level: 1, name: /Black Vest/i })).toBeVisible();
});
