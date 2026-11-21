import type { Page } from '@playwright/test';
import { MEASUREMENTS, expect, measureMe, openFresh, test } from './fixtures';

// Nightly bug hunt, Nov 21: a double tap on Next on the last measuring page (Weight) put its second tap on the check
// page's Waist row, right under Next, so the waist opened again in place of "Do these look right?".
const main = (page: Page) => page.getByRole('main');
const heading = (page: Page, name: string) => main(page).getByRole('heading', { name });
const labelOf = (box: ReturnType<Page['getByRole']>) => box.evaluate((el) => ((el as HTMLInputElement).labels?.[0]?.textContent ?? '').replace(/\(optional\)/i, '').trim());

/** A double tap on a button: two finger taps 0.2 s apart on a phone, a double click on a computer. */
async function doubleTap(page: Page, button: ReturnType<Page['getByRole']>, touch: boolean) {
  if (!touch) return button.dblclick();
  const box = (await button.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(200);
  await page.touchscreen.tap(x, y);
}

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
    // A person reads the page and types before tapping, longer than the moment a new page ignores a finger for.
    if (label === 'Weight') return page.waitForTimeout(500);
    const before = label;
    await main(page).getByRole('button', { name: /^Next\b/ }).click();
    await expect.poll(async () => (await box.count()) === 1 && (await box.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).includes(before)).toBe(false);
  }
  throw new Error('No Weight page');
}

test('a double tap on the last Next opens the check, not the waist again', async ({ page }, info) => {
  await toWeight(page);
  const next = main(page).getByRole('button', { name: /^Next\b/ });
  await doubleTap(page, next, !!info.project.use.hasTouch);
  await expect(heading(page, 'Do these look right?')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(heading(page, 'Do these look right?')).toBeVisible();
  // A tap after reading the page still opens the row.
  await main(page).getByRole('list', { name: 'Tap one to change it' }).getByRole('button', { name: /^Waist/ }).first().click();
  await expect(heading(page, 'Your waist')).toBeVisible();
});

// DT tester walk, Nov 21: a double click on Next on the waist put the second click on Finish later (home, as if all was
// lost); on a phone a double tap said "Enter your full bust to carry on" at once, and went past Weight.
test('a double tap on each measuring Next goes on one page, with no error and nothing skipped', async ({ page }, info) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  const seen: string[] = [];
  for (let n = 0; n < 12; n++) {
    const box = main(page).getByRole('textbox');
    if (await heading(page, 'Do these look right?').isVisible()) break;
    await expect(box).toHaveCount(1);
    const label = await labelOf(box);
    seen.push(label);
    // Each page opens clean: no "Enter your ... to carry on" before anything is typed.
    await expect(main(page).getByText(/to carry on\.$/)).toHaveCount(0);
    await box.fill(MEASUREMENTS[label]);
    await doubleTap(page, main(page).getByRole('button', { name: /^Next\b/ }), !!info.project.use.hasTouch);
    await expect.poll(async () => (await heading(page, 'Do these look right?').isVisible()) || ((await box.count()) === 1 && (await labelOf(box)) !== label)).toBe(true);
    await page.waitForTimeout(500);
    // Still measuring: Finish later wasn't tapped.
    await expect(main(page).getByRole('textbox').or(heading(page, 'Do these look right?')).first()).toBeVisible();
  }
  expect(seen).toContain('Weight');
  expect(seen).toEqual([...new Set(seen)]);
});
