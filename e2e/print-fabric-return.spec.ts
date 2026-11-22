import { expect, goPrint, startWithExample, test } from './fixtures';

// Print's Choose fabric opens Style's Fabric step; the way back used to land at the top of Print, a long scroll from
// where you were (Cat, Nov 21: "the journey breaks"). Now Style says Back to Print, and Print opens on the fabric.
test('Choose fabric on Print comes back to the same place', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  const fabric = main.locator('.yourfabric');
  await fabric.scrollIntoViewIfNeeded();
  await main.getByRole('button', { name: /^Choose fabric/ }).click();
  await expect(main.getByRole('tab', { name: 'Fabric', exact: true, includeHidden: true })).toHaveAttribute('aria-selected', 'true');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Linen' }).click();
  const back = main.getByRole('button', { name: /^Back to Print/ }).first();
  await expect(back).toBeVisible();
  await back.click();
  await expect(fabric.locator('h2')).toContainText('Linen');
  // Print opens with the fabric in view, below the top bar, not at the top of the page.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const top = await fabric.evaluate((el) => el.getBoundingClientRect().top);
  const bar = await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(bar);
  expect(top).toBeLessThan(page.viewportSize()!.height / 2);
});

// The tick box says what it is for in plain words (Cat, Nov 21: "what is the intention of this rounded box?").
test('the pile or one-way print box says what it does', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const box = page.getByRole('main').getByRole('checkbox', { name: /Pile or one-way print/ });
  await expect(box).not.toBeChecked();
  await expect(page.getByRole('main').getByText(/like velvet or corduroy/)).toBeVisible();
  await box.click();
  await expect(box).toBeChecked();
});
