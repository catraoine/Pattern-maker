import { expect, openCollection, startWithExample, test } from './fixtures';

// DQ walk, Nov 20: the Blush Shift's Darts said "Bust only", and its back has waist darts. Cat chose "Bust (front)".
test('the Blush Shift names its bust darts as the front', async ({ page }) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: 'Blush Shift' }).first().getByRole('button', { name: /^Make (this look|the )/ }).first().click();
  await main.getByRole('button', { name: 'Change a detail' }).click();
  await expect(main.getByText('Bust (front)').first()).toBeAttached();
  await expect(main.getByText('Bust only')).toHaveCount(0);
});
