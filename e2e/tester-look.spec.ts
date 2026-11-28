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
    await expect(offer(page).getByRole('button')).toHaveAccessibleName(`Your tester look, the ${look}`);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tester-look-${test.info().project.name}.png` });
  // The peplum tester's top: one tap makes the Ice Peplum Top on its Review, and the offer steps aside.
  await offer(page).getByRole('button', { name: /^Your tester look/ }).click();
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

// Pretend tester, Nov 18: the length she had set on the plain skirt was dropped for the look's own, with no word.
test('a length set on the plain garment comes across to the look', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openAsTester(page);
  const handle = main(page).getByRole('slider', { name: /length/i }).first();
  await handle.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(800);
  const set = await handle.getAttribute('aria-valuetext');
  expect(set).toMatch(/cm/);
  await offer(page).getByRole('button', { name: /^Your tester look/ }).click();
  await expect(main(page).getByRole('heading', { name: /Black Pleated Skirt/ })).toBeVisible({ timeout: 30_000 });
  await main(page).getByRole('button', { name: 'Change a detail' }).click();
  await expect(main(page).getByRole('slider', { name: /length/i }).first()).toHaveAttribute('aria-valuetext', set!);
});

// Pretend tester, Nov 18: a top's length is where its hem sits, but on the Ice Peplum it's where the peplum is sewn on,
// so it stays behind. A typed length went with no word; now the offer says so before the tap.
test('a top\'s own length is said to stay behind before the peplum opens', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openAsTester(page);
  await switchGarment(page, 'Bodice');
  const note = offer(page).locator('.tester-look-note');
  await expect(note).toHaveCount(0);
  // As the walk did: 9 cm below the waist, typed.
  await main(page).getByRole('button', { name: /^Type the .*length$/ }).first().click();
  await page.getByRole('form').getByRole('textbox').fill('9');
  await page.getByRole('form').getByRole('button', { name: 'Set' }).click();
  await expect(note).toContainText('won\'t come across');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/top-length-note-${test.info().project.name}.png` });
});
