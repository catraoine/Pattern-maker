import { expect, openFresh, test } from './fixtures';

// The first measuring page's form fills whatever room the window leaves. With no room at all (a phone on its side, a
// phone keyboard up for the name, a window dragged very short) the picture is redrawn at no size. That used to throw
// while placing the metal end of the tape round the neck (five crash reports, Nov 8 to 13). The fixtures fail the test
// on any uncaught error.
test('the first measuring page survives a window with no room for the form', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await expect(main.getByRole('heading', { name: /take some measurements/i })).toBeVisible();
  const form = main.locator('canvas.form-picture');
  await expect(form).toBeVisible();
  // Let the tape fall and rest round the neck first: the fault was in the resting tape.
  await page.waitForTimeout(2500);
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
