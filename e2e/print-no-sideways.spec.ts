import { expect, goPrint, startWithExample, test } from './fixtures';

// The gold Download bar on a phone's Print page was 2px wider than the screen, so the whole page scrolled sideways
// (EH walk, Nov 25).
for (const width of [360, 390, 700]) {
  test.describe(`${width} wide`, () => {
    test.use({ viewport: { width, height: 740 } });
    test('the Print page never scrolls sideways', async ({ page }) => {
      await startWithExample(page);
      await goPrint(page);
      await expect(page.locator('.print-go')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}
