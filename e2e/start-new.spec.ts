import type { Page } from '@playwright/test';
import { expect, expectStyle, openAccount, openGroup, pickToMake, skipLoading, startWithExample, test } from './fixtures';

// Pausing one skirt to start another reopened the same skirt, and changing it lost the first (Cat, Nov 12: "What
// happens if a user is making a skirt but then wants to pause and start working on a new skirt?").
const skirtNow = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt')!).choices);
const savedRows = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Saved patterns' }).getByRole('listitem');

async function startNew(page: Page) {
  await page.goto('/');
  await skipLoading(page);
  await page.getByRole('main').getByRole('button', { name: 'Start something new' }).click();
}

test('Start something new keeps the skirt so far in Saved patterns and opens a fresh one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openGroup(page, 'Silhouette');
  await main.getByRole('button', { name: /^Pencil/ }).first().click();
  await expect.poll(async () => (await skirtNow(page)).silhouette).toBe('pencil');

  await startNew(page);
  await pickToMake(page, 'Skirt');
  await expectStyle(page, 'Skirt');
  // A fresh skirt, as a first visit has it.
  await expect.poll(async () => (await skirtNow(page)).silhouette).toBe('a_line');
  // The pencil skirt is kept, and opens again from Saved patterns.
  await openAccount(page);
  await expect(savedRows(page)).toHaveCount(1);
  await expect(savedRows(page).first()).toContainText(/pencil/i);

  // Starting new again from a skirt nobody has changed keeps nothing more.
  await startNew(page);
  await pickToMake(page, 'Skirt');
  await expectStyle(page, 'Skirt');
  await openAccount(page);
  await expect(savedRows(page)).toHaveCount(1);
});
