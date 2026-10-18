import { test, expect, startWithExample, switchGarment } from './fixtures';
import type { Page } from '@playwright/test';

// Move points on the flat pattern: drag the underarm and the back walks with it, press and hold a point
// to set its measurement on the tape, and go back to the pattern as drafted.

async function point(page: Page, piece: string, at: string) {
  const box = await page.locator(`circle[data-piece="${piece}"][data-at="${at}"]`).boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test('drags a point on the flat pattern, measures one on the tape, and goes back', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: 'Pieces' }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await expect(page.locator('.pe-ghost')).toHaveCount(0);

  // Drag the front underarm out: a ghost of the original shows (the seams are trued in the engine; see pointEdit.test.ts).
  const ua = await point(page, 'Bodice front', 'armhole|side#0');
  await page.mouse.move(ua.x, ua.y);
  await page.mouse.down();
  await page.mouse.move(ua.x + 12, ua.y + 4, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.pe-ghost').first()).toBeAttached();

  // Press and hold the shoulder point: the tape shows the shoulder length, and 1 mm more sets it.
  const tip = await point(page, 'Bodice front', 'armhole|shoulder#0');
  await page.mouse.move(tip.x, tip.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(main.locator('.pe-label')).toHaveText(/Shoulder length/i);
  const before = parseFloat((await main.locator('.pe-value').textContent())!);
  await main.getByRole('button', { name: '+ 1 mm' }).click();
  await expect(main.locator('.pe-value')).toHaveText(`${(before + 0.1).toFixed(1)} cm`);

  await main.getByRole('button', { name: 'Back to original' }).click();
  await expect(page.locator('.pe-ghost')).toHaveCount(0);
});
