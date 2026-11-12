import { test, expect, startWithExample } from './fixtures';
import type { Page } from '@playwright/test';

// Draw a line on the pattern (Design: Pattern tools, Cat's pick P2, 2026-11-07): a line drawn across a skirt piece
// spreads it open from where it was started, and dragging the handle at its far end opens it more; a line across the
// hip makes a yoke, a new piece; the pattern then says Edited by you, and Back to drafted undoes it all.
// With STILLS=<folder> in the environment, a phone still of each step is saved there for Cat.

const still = async (page: Page, name: string) => {
  if (process.env.STILLS) await page.screenshot({ path: `${process.env.STILLS}/${name}.png` });
};

/** A piece's place on screen, once it holds still: the pinned drawing eases smaller or larger as the page scrolls. */
async function boxOf(page: Page, piece: string) {
  const box = () => page.locator(`path.pe-piece[data-piece="${piece}"]`).boundingBox();
  let last = await box();
  for (let k = 0; k < 20; k++) {
    await page.waitForTimeout(150);
    const now = await box();
    if (now && last && Math.abs(now.x - last.x) + Math.abs(now.y - last.y) + Math.abs(now.width - last.width) < 0.5) return now;
    last = now;
  }
  return last!;
}

async function draw(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, bend = 0) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) {
    const t = k / 12;
    await page.mouse.move(from.x + (to.x - from.x) * t + Math.sin(t * Math.PI) * bend, from.y + (to.y - from.y) * t);
  }
  await page.mouse.up();
}

test('draws a line on the skirt to spread it, opens it more, cuts a yoke, and goes back', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await page.locator('.point-svg').scrollIntoViewIfNeeded();
  await still(page, '1-move-points');

  // A line from the waist down to the hem, started inside the piece.
  let b = await boxOf(page, 'Skirt front');
  await draw(page, { x: b.x + b.width * 0.62, y: b.y + b.height * 0.3 }, { x: b.x + b.width * 0.6, y: b.y + b.height * 0.9 }, 3);
  const ask = page.getByRole('group', { name: 'What should this line do?' });
  await expect(ask).toBeVisible();
  await still(page, '2-what-should-this-line-do');
  await ask.getByRole('button', { name: /Spread it open/ }).click();
  const sheet = page.getByRole('group', { name: 'Spread it open' });
  await expect(sheet.getByRole('status')).toHaveText('6.0 cm');
  await expect(page.locator('.pe-ghost').first()).toBeAttached();
  const wide0 = (await boxOf(page, 'Skirt front')).width;

  // Drag the handle at the hem outward: it opens more.
  const h = (await page.locator('circle.pe-open').boundingBox())!;
  const hx = h.x + h.width / 2;
  const hy = h.y + h.height / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(hx + k * 4, hy);
  await page.mouse.up();
  await expect.poll(async () => parseFloat((await sheet.getByRole('status').textContent()) ?? '0')).toBeGreaterThan(7);
  await expect.poll(async () => (await boxOf(page, 'Skirt front')).width).toBeGreaterThan(wide0);
  await still(page, '3-spread-open');
  await sheet.getByRole('button', { name: 'Done' }).click();

  // A line across the back's hip: a new piece, the back yoke.
  b = await boxOf(page, 'Skirt back');
  // On a computer the pieces stand taller than the window: the top of the back is brought into view first.
  if (b.y < 0 || b.y + b.height * 0.4 > page.viewportSize()!.height) {
    await page.locator('path.pe-piece[data-piece="Skirt back"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    b = await boxOf(page, 'Skirt back');
  }
  await draw(page, { x: b.x + b.width * 0.12, y: b.y + b.height * 0.33 }, { x: b.x + b.width * 0.75, y: b.y + b.height * 0.36 }, -4);
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Make a new piece' }).click();
  await expect(page.locator('path.pe-piece[data-piece="Skirt back yoke"]')).toBeVisible();
  await expect(page.getByRole('group', { name: 'New piece' })).toBeVisible();
  await still(page, '4-new-piece-yoke');
  await page.getByRole('group', { name: 'New piece' }).getByRole('button', { name: 'Done' }).click();

  // Back on the pieces, the pattern says it was edited, In testing.
  await main.getByRole('button', { name: 'Done moving points' }).click();
  await expect(main.locator('.pe-edited')).toContainText('Edited by you');
  await expect(main.locator('.pe-edited .testing-tag')).toBeVisible();
  await still(page, '5-edited-by-you');

  // Back to drafted takes every cut out. (From the top of the page: scrolled near its end, the pinned drawing eases
  // smaller and larger as the page settles, and the button under it won't hold still to be clicked.)
  await page.evaluate(() => window.scrollTo(0, 0));
  await main.getByRole('button', { name: 'Move points' }).click();
  await page.getByRole('button', { name: 'Back to drafted' }).click();
  await expect(page.locator('path.pe-piece[data-piece="Skirt back yoke"]')).toHaveCount(0);
  await expect(page.locator('.pe-ghost')).toHaveCount(0);
});
