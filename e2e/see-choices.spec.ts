import { expect, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// On a phone, "See the choices" pulls the page up to the end of the step's choices, and only there does the bar
// turn into Next (Cat, 2026-11-06, live: it said Next as soon as the page moved, and stayed so back at the top).
// Every question starts folded, so the whole list shows.
test('see the choices goes to the end, then Next; back at the top it asks again', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'The bar asks to see the choices only on a phone.');
  test.setTimeout(120_000);
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Dress');
  await fillStepPages(page);

  const bar = page.locator('.style-bar');
  const see = bar.getByRole('button', { name: /See the choices/ });
  const next = bar.getByRole('button', { name: /^Next/ });
  await expect(see).toBeVisible();
  await expect(main.locator('button.fold-head[aria-expanded="true"]')).toHaveCount(0);
  // A little scroll is not the end of the choices.
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(600);
  await expect(see).toBeVisible();

  await see.click();
  await expect(next).toBeVisible();
  const [y, end] = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight]);
  expect(end - y).toBeLessThan(25);

  // Once the page has come to rest at the end, a scroll back up to the step's name asks to choose again.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY)).toBeLessThan(4);
  // Over the page, not the bar at the bottom where the tap left the pointer.
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, -3000);
  await expect(see).toBeVisible();
});
