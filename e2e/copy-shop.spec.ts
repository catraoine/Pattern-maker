import { expect, goPrint, startWithExample, test } from './fixtures';

// Print at a copy shop (Cat, Nov 14): one tap switches to A0, says what to ask for and links to shops nearby.
test('Print at a copy shop switches to A0 and says what to ask for', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ })).toBeEnabled({ timeout: 45_000 });
  await main.getByRole('button', { name: 'Print at a copy shop' }).click();
  await expect(main.getByRole('group', { name: 'Paper' })).toContainText('A0 copy shop');
  await expect(main.getByRole('button', { name: /^Download pattern \(\d+ A0 sheets?\)$/ })).toBeEnabled({ timeout: 45_000 });
  const shop = main.getByRole('group', { name: 'Print at a copy shop' });
  // The pattern file is only the big sheets (Cat, Nov 15), so there is no page range to ask for.
  await expect(shop).toContainText(/A0 paper .*printed at 100% \(actual size\)\.Find a copy shop/, { timeout: 45_000 });
  await expect(shop).not.toContainText('of the PDF');
  await expect(shop.getByRole('link', { name: 'Find a copy shop near me' })).toHaveAttribute('href', /google\.com\/maps\/search/);
  // It says the paper changed, and goes back to the home paper in one tap: a tester opened the row only to read it and
  // downloaded A0 sheets (EM walk, Nov 28).
  await expect(shop).toContainText('The paper is now A0');
  const home = (await shop.getByRole('button', { name: /^Back to (US Letter|A4) paper$/ }).textContent())!.replace(/^Back to | paper$/g, '');
  await shop.getByRole('button', { name: /^Back to / }).click();
  await expect(main.getByRole('group', { name: 'Paper' })).toContainText(home);
  await expect(main.getByRole('button', { name: /^Download pattern \(\d+ pages?\)$/ })).toBeEnabled({ timeout: 45_000 });
  await main.getByRole('button', { name: 'Print at a copy shop' }).click();
  // Back on home paper, the row folds shut again.
  await main.getByRole('button', { name: 'A0 copy shop' }).click();
  await page.getByRole('menuitem', { name: 'US Letter' }).or(page.getByRole('menuitemradio', { name: 'US Letter' })).first().click();
  await expect(main.getByRole('button', { name: 'Print at a copy shop' })).toBeVisible();
});
