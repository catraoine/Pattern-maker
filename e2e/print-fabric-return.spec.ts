import { expect, goCut, startWithExample, test } from './fixtures';

// Choose fabric opens Style's Fabric step; the way back used to land at the top of Print, a long scroll from where you
// were (Cat, Nov 21: "the journey breaks"). Now Style says Back to Sew, and Sew opens on Cut it with the fabric in view
// (the fabric moved from Print to Sew's Cut it, Nov 28).
test('Choose fabric on Cut it comes back to the same place', async ({ page }) => {
  await startWithExample(page);
  await goCut(page);
  const main = page.getByRole('main');
  const fabric = main.locator('.yourfabric');
  await fabric.scrollIntoViewIfNeeded();
  await main.getByRole('button', { name: /^Choose fabric/ }).click();
  await expect(main.getByRole('tab', { name: 'Fabric', exact: true, includeHidden: true })).toHaveAttribute('aria-selected', 'true');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Linen' }).click();
  const back = main.getByRole('button', { name: /^Back to Sew/ }).first();
  await expect(back).toBeVisible();
  await back.click();
  await expect(main.getByRole('heading', { level: 1, name: 'Cut it' })).toBeVisible();
  await expect(fabric.locator('h2')).toContainText('Linen');
  // Cut it opens with the fabric in view, below the top bar.
  const top = await fabric.evaluate((el) => el.getBoundingClientRect().top);
  const bar = await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(bar);
  expect(top).toBeLessThan(page.viewportSize()!.height / 2);
});

// Someone who reached Cut it without going through Style's questions (a look from the collection, a tester link) hasn't
// seen How styling works: Change fabric still opens Fabric straight away, not the intro (DY pretend-tester walk, Nov 21).
test('Choose fabric skips how styling works', async ({ page }) => {
  await startWithExample(page);
  await goCut(page);
  await page.evaluate(() => localStorage.removeItem('maison-trace-style-intro'));
  const main = page.getByRole('main');
  await main.locator('.yourfabric').scrollIntoViewIfNeeded();
  await main.getByRole('button', { name: /^Choose fabric/ }).click();
  await expect(main.getByRole('tab', { name: 'Fabric', exact: true, includeHidden: true })).toHaveAttribute('aria-selected', 'true');
  await expect(main.getByRole('heading', { name: /How styling works/ })).toHaveCount(0);
  await expect(main.getByRole('button', { name: /^Back to Sew/ }).first()).toBeVisible();
});

// The tick box says what it is for in plain words (Cat, Nov 21: "what is the intention of this rounded box?").
test('the pile or one-way print box says what it does', async ({ page }) => {
  await startWithExample(page);
  await goCut(page);
  const box = page.getByRole('main').getByRole('checkbox', { name: /Pile or one-way print/ });
  await expect(box).not.toBeChecked();
  await expect(page.getByRole('main').getByText(/like velvet or corduroy/)).toBeVisible();
  await box.click();
  await expect(box).toBeChecked();
});
