import { expect, openCollection, startWithExample, test } from './fixtures';

// A collection look made on the example body said "Drafted to you" under its drawing, over the example's numbers, while
// Print said "Drafted to an example body" (bug hunt journey, Nov 27).
test('a look made on the example body says so under its drawing', async ({ page }) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: 'Black Vest' }).first().getByRole('button', { name: /^Make / }).first().click();
  await expect(main.getByRole('button', { name: 'Change a detail' })).toBeVisible({ timeout: 30_000 });
  await expect(main.locator('.env-foot')).toHaveText('Drafted to an example body');
});
