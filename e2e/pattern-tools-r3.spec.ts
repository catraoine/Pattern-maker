import { test, expect, startWithExample } from './fixtures';
import type { Page } from '@playwright/test';

// Pattern tools round 3 (Design: Pattern tools, Cat 2026-11-07): a line started right on a point draws a line rather
// than moving the point; a kept cut has a mark to tap, to change what it does, move its line by an end, or take it out;
// a yoke cut across the skirt's darts closes them into the yoke.
// With STILLS=<folder> in the environment, a still of each step is saved there for Cat.

const still = async (page: Page, name: string) => {
  if (process.env.STILLS) await page.screenshot({ path: `${process.env.STILLS}/${test.info().project.name}-${name}.png` });
};

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
  for (let k = 1; k <= 16; k++) {
    const t = k / 16;
    await page.mouse.move(from.x + (to.x - from.x) * t + Math.sin(t * Math.PI) * bend, from.y + (to.y - from.y) * t);
  }
  await page.mouse.up();
}

const centre = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('starts a line on a point, changes a cut by tapping it, and closes darts into a yoke', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await page.locator('.point-svg').scrollIntoViewIfNeeded();

  // A line started right on the dart point of the skirt front, drawn down to the hem: a line, and nothing moves.
  await boxOf(page, 'Skirt front');
  const dart = page.locator('circle.pe-point.dart[data-piece="Skirt front"]').first();
  const at = await centre(page, 'circle.pe-point.dart[data-piece="Skirt front"]');
  const b = await boxOf(page, 'Skirt front');
  await draw(page, at, { x: at.x, y: b.y + b.height * 0.97 });
  const ask = page.getByRole('group', { name: 'What should this line do?' });
  await expect(ask).toBeVisible();
  await expect(page.locator('.pe-ghost')).toHaveCount(0);
  const after = await centre(page, 'circle.pe-point.dart[data-piece="Skirt front"]');
  expect(Math.hypot(after.x - at.x, after.y - at.y)).toBeLessThan(1.5);
  await expect(dart).toBeVisible();
  await still(page, '1-line-from-a-point');
  await ask.getByRole('button', { name: /Spread it open/ }).click();
  await page.getByRole('group', { name: 'Spread it open' }).getByRole('button', { name: 'Done' }).click();

  // The cut keeps a mark on its line: tapping it opens the cut again, to change what it does.
  await expect(page.locator('rect.pe-cut')).toHaveCount(1);
  await still(page, '2-cut-mark');
  await page.mouse.click(...Object.values(await centre(page, 'rect.pe-cut')) as [number, number]);
  const spread = page.getByRole('group', { name: 'Spread it open' });
  await expect(spread).toBeVisible();
  await expect(page.locator('circle.pe-end')).toHaveCount(2);
  await still(page, '3-cut-tapped');
  await spread.getByRole('group', { name: 'What this cut does' }).getByRole('button', { name: 'Fullness' }).click();
  const fuller = page.getByRole('group', { name: 'Add fullness' });
  await expect(fuller).toBeVisible();

  // Its far end dragged along the hem: the line moves with it.
  const w0 = (await boxOf(page, 'Skirt front')).width;
  const end = await centre(page, 'circle.pe-end[data-end="1"]');
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(end.x - k * 3, end.y);
  await page.mouse.up();
  await expect.poll(async () => (await centre(page, 'circle.pe-end[data-end="1"]')).x).toBeLessThan(end.x - 8);
  expect((await boxOf(page, 'Skirt front')).width).toBeGreaterThan(w0 - 2);
  await still(page, '4-fullness-line-moved');

  // Taken out: the piece is as drafted again.
  await fuller.getByRole('button', { name: 'Take this cut out' }).click();
  await expect(page.locator('rect.pe-cut')).toHaveCount(0);
  await expect(page.locator('.pe-ghost')).toHaveCount(0);

  // A yoke across the front's hip, below its darts: the darts close into the yoke.
  let f = await boxOf(page, 'Skirt front');
  if (f.y < 0 || f.y + f.height * 0.4 > page.viewportSize()!.height) {
    await page.locator('path.pe-piece[data-piece="Skirt front"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    f = await boxOf(page, 'Skirt front');
  }
  await draw(page, { x: f.x - 6, y: f.y + f.height * 0.27 }, { x: f.x + f.width + 6, y: f.y + f.height * 0.31 }, -3);
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Make a new piece' }).click();
  await expect(page.locator('path.pe-piece[data-piece="Skirt front yoke"]')).toBeVisible();
  const sheet = page.getByRole('group', { name: 'New piece' });
  await expect(sheet).toContainText('its darts are closed into it');
  await expect(page.locator('circle.pe-point.dart[data-piece="Skirt front yoke"]')).toHaveCount(0);
  await still(page, '5-yoke-darts-closed');
  await sheet.getByRole('button', { name: 'Done' }).click();
  // And across the back at the same depth: a yoke all round.
  const bk = await boxOf(page, 'Skirt back');
  await draw(page, { x: bk.x - 6, y: bk.y + bk.height * 0.27 }, { x: bk.x + bk.width + 6, y: bk.y + bk.height * 0.29 });
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Make a new piece' }).click();
  await expect(page.locator('path.pe-piece[data-piece="Skirt back yoke"]')).toBeVisible();
  await page.getByRole('group', { name: 'New piece' }).getByRole('button', { name: 'Done' }).click();
  await still(page, '5b-front-and-back-yokes');

  // All round sews the yoke back on and turns, its seam drawn across the hip (no drawing standing in).
  await main.getByRole('button', { name: 'Done moving points' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  // The view bar stays on the pattern (Nov 8): All round is one tap from there.
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const canvas = main.locator('canvas.all-round-canvas');
  await expect(canvas).toHaveAttribute('data-sewn', /ready|testing/, { timeout: 60_000 });
  await canvas.scrollIntoViewIfNeeded();
  for (let k = 0; k < (process.env.STILLS ? 10 : 1); k++) {
    await page.waitForTimeout(900);
    await still(page, `6-all-round-yoke-${k}`);
  }
});
