import { expect, fillStepPages, measureMe, openFresh, test } from './fixtures';

// A garment's own measurement kept out of range (waist to hip 40 in) wasn't on the Welcome back summary, which said
// nothing of it (EF walk, Nov 24). It now gives the reason, and the button opens that measurement.
test('"Do these look right?" speaks of a garment measurement out of range', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  // A number saved out of range, as Finish later leaves it.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k)!;
      if (k.startsWith('pattern-maker:') && v.includes('"full_hip"')) localStorage.setItem(k, v.replace('"full_hip"', '"waist_to_hip":100,"full_hip"'));
    }
  });
  await page.reload();
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(main.locator('.msg.error')).toContainText(/Waist to hip can be from/);
  await main.getByRole('button', { name: 'Check waist to hip' }).click();
  await expect(main.getByRole('textbox').first()).toBeVisible();
  await expect(main.locator('label:visible').first()).toHaveText(/waist to hip/i);
});
