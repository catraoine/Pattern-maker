import { expect, openFresh, test } from './fixtures';

// The first measuring page has to survive a window with no room (a phone on its side, a phone keyboard up for the
// name, a window dragged very short): its old pictures threw there (five crash reports, Nov 8 to 13, the neck tape).
// The fixtures fail the test on any uncaught error. Since Cat's T1 (Nov 15) the page's picture is a tape along the
// top; it must stay put through the squeeze and the page must still reach Begin measuring when the room comes back.
test('the first measuring page gives way to a window with no room and comes back', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  const tape = main.locator('.first-tape');
  await expect(tape).toBeVisible();
  const wide = page.viewportSize()!.width;
  for (const height of [200, 120, 60]) {
    await page.setViewportSize({ width: wide, height });
    await page.waitForTimeout(300);
  }
  await page.setViewportSize({ width: wide, height: 844 });
  await expect(tape).toBeVisible();
  await expect(main.getByRole('button', { name: 'Begin measuring', exact: true })).toBeInViewport();
});
