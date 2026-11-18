import type { Page } from '@playwright/test';
import { expect, expectStyle, skipToExample, skipLoading, switchGarment, test, type GarmentName } from './fixtures';

// A peplum tester picked Top from the garment list rather than the Ice Peplum Top from the collection: the plain top had
// no peplum to choose, and asked the plain top's questions (testers, Nov 18). On the plain garment each tester look is
// made from, a tester is now offered the look itself.
const main = (page: Page) => page.getByRole('main');
const offer = (page: Page) => main(page).locator('.tester-look');

/** Opens the app as a tester whose link has just been checked, on the example body's skirt. */
async function openAsTester(page: Page) {
  await page.route('**/.netlify/functions/tester', (r) => r.fulfill({ json: { ok: true, tester: true } }));
  await page.goto('/?fresh&tester=EXAMPLE-ONLY');
  await skipLoading(page);
  await skipToExample(page);
  await expectStyle(page, 'Skirt');
}

test('a tester on a plain garment is offered the look they sew, for every tester piece', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await openAsTester(page);
  const pieces: [GarmentName, string][] = [['Skirt', 'Black Pleated Skirt'], ['Dress', 'Blush Shift'], ['Trousers', 'Chocolate Barrel Trouser'], ['Jacket', 'Black Vest'], ['Bodice', 'Ice Peplum Top']];
  for (const [g, look] of pieces) {
    if (g !== 'Skirt') await switchGarment(page, g);
    await expect(offer(page)).toContainText(`Fit testing the ${look}?`);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tester-look-${test.info().project.name}.png` });
  // The peplum tester's top: one tap makes the Ice Peplum Top on its Review, and the offer steps aside.
  await offer(page).getByRole('button', { name: /Open it/ }).click();
  await expect(main(page).getByRole('heading', { name: /Ice Peplum Top/ })).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByRole('button', { name: 'Change a detail' })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
});

test('someone who is not a tester sees no tester offer', async ({ page }) => {
  await page.goto('/?fresh');
  await skipLoading(page);
  await skipToExample(page);
  await expectStyle(page, 'Skirt');
  await expect(main(page).getByRole('button', { name: /The collection/ })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
});
