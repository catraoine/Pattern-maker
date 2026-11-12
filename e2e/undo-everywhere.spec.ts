import type { Page } from '@playwright/test';
import { chooseChip, expect, goPrint, openReview, showAllTools, startWithExample, switchGarment, test } from './fixtures';

// Undo wherever an edit can't otherwise be taken back (Cat, Nov 12: "we need an undo button here ... check across app
// for similar"): Move points, the enlarged window, Back to the original style and Clear every correction.

const main = (page: Page) => page.getByRole('main');

async function point(page: Page, piece: string, at: string) {
  const box = await page.locator(`circle[data-piece="${piece}"][data-at="${at}"]`).boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function openMovePoints(page: Page) {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  await main(page).getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main(page).getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
}

test('Move points: a moved point, and Back to drafted, can be undone and redone', async ({ page }) => {
  await openMovePoints(page);
  const undo = main(page).getByRole('button', { name: 'Undo the last change to the pieces' });
  const redo = main(page).getByRole('button', { name: 'Redo the change to the pieces you undid' });
  await expect(undo).toBeDisabled();

  const ua = await point(page, 'Bodice front', 'armhole|side#0');
  await page.mouse.move(ua.x, ua.y);
  await page.mouse.down();
  await page.mouse.move(ua.x + 12, ua.y + 4, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.pe-ghost').first()).toBeAttached();

  await undo.click();
  await expect(page.locator('.pe-ghost')).toHaveCount(0);
  await redo.click();
  await expect(page.locator('.pe-ghost').first()).toBeAttached();

  // Back to drafted is one step too: Undo brings the moved point back.
  await main(page).getByRole('button', { name: 'Back to drafted' }).click();
  await expect(page.locator('.pe-ghost')).toHaveCount(0);
  await undo.click();
  await expect(page.locator('.pe-ghost').first()).toBeAttached();
});

test('Move points enlarged: every piece shows whole in the window, with Undo', async ({ page }) => {
  await openMovePoints(page);
  await main(page).getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(main(page).getByRole('region', { name: 'Preview' })).toHaveClass(/live-big/);
  await page.waitForTimeout(500);
  const view = page.viewportSize()!;
  const pts = await page.locator('circle.pe-point').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })));
  expect(pts.length).toBeGreaterThan(10);
  for (const q of pts) {
    expect(q.x).toBeGreaterThan(0);
    expect(q.x).toBeLessThan(view.width);
    expect(q.y).toBeGreaterThan(0);
    expect(q.y).toBeLessThan(view.height);
  }
  await expect(main(page).getByRole('button', { name: 'Undo the last change to the pieces' })).toBeInViewport();
  // The window's own Undo for the style is put away while Move points has its own.
  await expect(page.locator('.big-undo')).toBeHidden();
});

test('the enlarged window has its own Undo for a style change', async ({ page }) => {
  await startWithExample(page);
  await chooseChip(page, 'Fit', 'Fitted');
  await main(page).getByRole('button', { name: /^Enlarge the drawing/ }).click();
  const undo = page.locator('.big-undo').getByRole('button', { name: 'Undo the last change' });
  await expect(undo).toBeInViewport();
  await undo.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').choices?.fit)).toBe('regular');
  await expect(undo).toBeDisabled();
});

test('Back to the original style can be undone', async ({ page }) => {
  await startWithExample(page);
  await chooseChip(page, 'Fit', 'Fitted');
  await openReview(page);
  await main(page).getByRole('button', { name: 'Back to the original style' }).click();
  await main(page).getByRole('button', { name: 'Yes, start over' }).click();
  const fit = () => page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').choices?.fit);
  await expect.poll(fit).toBe('regular');
  await main(page).getByRole('status').filter({ hasText: 'Back to the original style.' }).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(fit).toBe('fitted');
});

test('Clear every correction can be undone', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main(page).getByRole('button', { name: 'I’ve tried on a toile' }).click();
  await main(page).getByText('Pulls across the hips').click();
  await expect(main(page).getByRole('button', { name: /^Save as version 2$/ })).toBeEnabled();
  await main(page).getByRole('button', { name: 'Clear every correction' }).click();
  await expect(main(page).getByRole('button', { name: 'No changes yet' })).toBeVisible();
  await main(page).getByRole('button', { name: 'Undo clear' }).click();
  await expect(main(page).getByRole('button', { name: /^Save as version 2$/ })).toBeEnabled();
});
