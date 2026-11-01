import { expect, startWithExample, stepTabs, switchGarment, test, type GarmentName } from './fixtures';
import type { Page } from '@playwright/test';

// Rows that slide sideways (the Style tabs, swatches, colour dots, shop fabrics) slide only sideways (Cat, 2026-10-20):
// a row that can also scroll up and down, even by a pixel, wobbles under the finger.
async function wobblyRows(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (!/auto|scroll/.test(s.overflowX) || !el.offsetParent) return false;
        return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight;
      })
      .map((el) => `${el.className || el.tagName} (${el.scrollHeight} > ${el.clientHeight})`),
  );
}

test('sideways rows on the Style page never scroll up and down', async ({ page }) => {
  await startWithExample(page);
  const garments: GarmentName[] = ['Skirt', 'Dress', 'Trousers'];
  for (const g of garments) {
    if (g !== 'Skirt') await switchGarment(page, g);
    // On a phone the steps' list opens from "Step 1 of 5" and shuts once one is picked (Cat's P1, 2026-10-31).
    const tabs = page.locator('#style-steps [role="tab"]');
    for (let i = 0, n = await tabs.count(); i < n; i++) {
      const tab = tabs.nth(i);
      const name = await tab.textContent();
      await stepTabs(page);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(await wobblyRows(page), `${g}, ${name} tab`).toEqual([]);
    }
  }
});
