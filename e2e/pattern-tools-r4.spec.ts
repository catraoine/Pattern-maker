import { test, expect, startWithExample } from './fixtures';
import type { Page } from '@playwright/test';

// Pattern tools round 4 (Design: Pattern tools, Cat 2026-11-08): a new piece is sewn back on in All round as it is
// now, so a spread made on the piece it came off after the cut shows on the cloth.
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

test('shows a spread made after a yoke was cut in All round', async ({ page }) => {
  // STILL_VIEW=1 holds All round still, facing front, so stills before and after line up.
  if (process.env.STILL_VIEW) await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await page.locator('.point-svg').scrollIntoViewIfNeeded();

  // A yoke across the front's hip and the back's, as in round 3.
  for (const name of ['Skirt front', 'Skirt back']) {
    let f = await boxOf(page, name);
    if (f.y < 0 || f.y + f.height * 0.6 > page.viewportSize()!.height) {
      await page.locator(`path.pe-piece[data-piece="${name}"]`).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      f = await boxOf(page, name);
    }
    await draw(page, { x: f.x - 6, y: f.y + f.height * 0.27 }, { x: f.x + f.width + 6, y: f.y + f.height * 0.29 });
    await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Make a new piece' }).click();
    await expect(page.locator(`path.pe-piece[data-piece="${name} yoke"]`)).toBeVisible();
    await page.getByRole('group', { name: 'New piece' }).getByRole('button', { name: 'Done' }).click();
  }
  await still(page, '1-yokes-cut');

  // Then the lower front and back spread open from the yoke seam down to the hem, for flare.
  for (const name of ['Skirt front', 'Skirt back']) {
    let f = await boxOf(page, name);
    if (f.y < 90 || f.y + f.height > page.viewportSize()!.height) {
      await page.locator(`path.pe-piece[data-piece="${name}"]`).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      f = await boxOf(page, name);
    }
    const w0 = f.width;
    await draw(page, { x: f.x + f.width * 0.35, y: f.y + f.height * 0.15 }, { x: f.x + f.width * 0.38, y: f.y + f.height * 0.97 });
    await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: /Spread it open/ }).click();
    await page.getByRole('group', { name: 'Spread it open' }).getByRole('button', { name: 'Done' }).click();
    expect((await boxOf(page, name)).width).toBeGreaterThan(w0 + 3);
  }
  await still(page, '2-spread-after-yokes');

  // All round sews the yokes back on to the spread pieces: the skirt is sewn (no drawing standing in), with the flare.
  await main.getByRole('button', { name: 'Back to pieces' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ }).click();
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const canvas = main.locator('canvas.all-round-canvas');
  await expect(canvas).toHaveAttribute('data-sewn', /ready|testing/, { timeout: 60_000 });
  await canvas.scrollIntoViewIfNeeded();
  for (let k = 0; k < (process.env.STILLS ? 10 : 1); k++) {
    await page.waitForTimeout(900);
    await still(page, `3-all-round-${k}`);
  }
});
