import { expect, goCut, openCollection, startWithExample, test } from './fixtures';

// EM walk, Nov 28: Cut it said "Wool setting (about 150 C)" for the Black Pleated Skirt, where the PDF said 150°C.
test('Cut it writes the iron heat with its degree sign', async ({ page }) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: 'Black Pleated Skirt' }).first().getByRole('button', { name: /^Make (this look|the )/ }).first().click();
  await goCut(page);
  const notes = main.locator('.notions');
  await expect(notes).toContainText(/about \d+°C/);
  await expect(notes).not.toContainText(/about \d+ C\b/);
});
