import { expect, openFresh, test } from './fixtures';

// The first measuring page has to survive a window with no room (a phone on its side, a phone keyboard up for the
// name, a window dragged very short): its old pictures threw there (five crash reports, Nov 8 to 13, the neck tape).
// The fixtures fail the test on any uncaught error. Since Cat's "straight to the waist" (Nov 15) Begin opens the waist
// page, its form and tape drawn on a canvas: with no room it must not throw, and it comes back, with Next on screen,
// when the room does.
test('the waist page gives way to a window with no room and comes back', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await expect(main.getByRole('heading', { name: /Your waist/i })).toBeVisible();
  const wide = page.viewportSize()!.width;
  for (const height of [200, 120, 60]) {
    await page.setViewportSize({ width: wide, height });
    await page.waitForTimeout(300);
  }
  // With no room the picture gives way to its least, never pushing the page out past it.
  const hero = await main.locator('.welcome-hero').boundingBox();
  expect(hero === null || hero.height <= 64, `the window left the picture no room (it kept ${hero?.height}px)`).toBe(true);
  await page.setViewportSize({ width: wide, height: 844 });
  await expect(main.locator('.who-line')).toBeVisible();
  await expect(main.getByRole('button', { name: /^Next/ })).toBeInViewport();
});
