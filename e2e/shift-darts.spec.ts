import { expect, openCollection, startWithExample, test } from './fixtures';

// DQ walk, Nov 20: the Blush Shift's Darts said "Bust only", and its back has waist darts. Cat chose "Bust (front)", then
// on Nov 21 a label that names the back too.
test('the Blush Shift names its front bust and back waist darts', async ({ page }, info) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: 'Blush Shift' }).first().getByRole('button', { name: /^Make (this look|the )/ }).first().click();
  await main.getByRole('button', { name: 'Change a detail' }).click();
  await expect(main.getByText('Front bust, back waist').first()).toBeAttached();
  await expect(main.getByText('Bust (front)')).toHaveCount(0);
  await expect(main.getByText('Bust only')).toHaveCount(0);
  // And, opened, the line under it says the back keeps its waist darts, the phone's short line too (DS walk, Nov 21).
  if (info.project.name === 'phone') for (const next of ['Next: Cut', 'Next: Darts']) await main.getByRole('button', { name: next }).click();
  else await main.locator('.fold-head').filter({ hasText: 'Darts' }).first().click();
  await expect(main.locator('.explain-full:visible, .explain-short:visible').filter({ hasText: 'the back keeps its two waist darts' }).first()).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/shift-darts-${info.project.name}.png` });
});
