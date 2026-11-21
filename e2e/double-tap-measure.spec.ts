import type { Page } from '@playwright/test';
import { MEASUREMENTS, expect, measureMe, openFresh, test } from './fixtures';

// Nightly bug hunt, Nov 21: a double tap on Next on the last measuring page (Weight) put its second tap on the check
// page's Waist row, right under Next, so the waist opened again in place of "Do these look right?".
const main = (page: Page) => page.getByRole('main');
const heading = (page: Page, name: string) => main(page).getByRole('heading', { name });

/** Fills the measuring pages up to the Weight page, and types the weight there. */
async function toWeight(page: Page) {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  for (let n = 0; n < 12; n++) {
    const box = main(page).getByRole('textbox');
    await expect(box).toHaveCount(1);
    const label = (await box.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).replace(/\(optional\)/i, '').trim();
    await box.fill(MEASUREMENTS[label]);
    if (label === 'Weight') return;
    const before = label;
    await main(page).getByRole('button', { name: /^Next\b/ }).click();
    await expect.poll(async () => (await box.count()) === 1 && (await box.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).includes(before)).toBe(false);
  }
  throw new Error('No Weight page');
}

test('a double tap on the last Next opens the check, not the waist again', async ({ page }, info) => {
  await toWeight(page);
  const next = main(page).getByRole('button', { name: /^Next\b/ });
  if (info.project.use.hasTouch) {
    // Two finger taps, as close together as a person's double tap.
    const box = (await next.boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(200);
    await page.touchscreen.tap(x, y);
  } else await next.dblclick();
  await expect(heading(page, 'Do these look right?')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(heading(page, 'Do these look right?')).toBeVisible();
  // A tap after reading the page still opens the row.
  await main(page).getByRole('list', { name: 'Tap one to change it' }).getByRole('button', { name: /^Waist/ }).first().click();
  await expect(heading(page, 'Your waist')).toBeVisible();
});
