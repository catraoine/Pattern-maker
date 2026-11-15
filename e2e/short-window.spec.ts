import { expect, openFresh, test } from './fixtures';

// The first measuring page's form fills whatever room the window leaves. With no room at all (a phone on its side, a
// phone keyboard up for the name, a window dragged very short) the picture is redrawn at no size; that once threw
// while placing the end of the tape round the neck (five crash reports, Nov 8 to 13). The fixtures fail the test on
// any uncaught error. The neck tape is gone since Cat's W1 (Nov 14); the page shows the welcome's line form, which
// must give way to a window with no room and come back.
test('the form on the first measuring page gives way to a window with no room and comes back', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  const form = main.locator('.first-form');
  await expect(form).toBeVisible();
  const wide = page.viewportSize()!.width;
  for (const height of [200, 120, 60]) {
    await page.setViewportSize({ width: wide, height });
    await page.waitForTimeout(300);
  }
  const box = await form.boundingBox();
  expect(box === null || box.height < 1 || box.width < 1, 'the window left the form no room').toBe(true);
  await page.setViewportSize({ width: wide, height: 844 });
  await expect(form).toBeVisible();
});
