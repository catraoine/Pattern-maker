import { test, expect, startWithExample, switchGarment } from './fixtures';
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
  await main.getByRole('button', { name: 'Done moving points' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const canvas = main.locator('canvas.all-round-canvas');
  await expect(canvas).toHaveAttribute('data-sewn', /ready|testing/, { timeout: 60_000 });
  await canvas.scrollIntoViewIfNeeded();
  for (let k = 0; k < (process.env.STILLS ? 10 : 1); k++) {
    await page.waitForTimeout(900);
    await still(page, `3-all-round-${k}`);
  }
});

test('moves a dart by drawing from its point to an edge, and All round follows', async ({ page }) => {
  if (process.env.STILL_VIEW) await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await page.locator('path.pe-piece[data-piece="Skirt front"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await boxOf(page, 'Skirt front');
  const darts = page.locator('circle.pe-point.dart[data-piece="Skirt front"]');
  await expect(darts).toHaveCount(2);
  await still(page, '4-skirt-darts');

  // A line from the dart point nearest the fold straight down to the hem: the dart closes and the hem flares.
  const tips = await darts.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  const tip = tips.sort((p, q) => p.x - q.x)[0];
  const hemW = b.width;
  await draw(page, tip, { x: tip.x, y: b.y + b.height - 1 });
  await still(page, '5a-line-from-dart-point');
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Move the dart here' }).click();
  const sheet = page.getByRole('group', { name: 'Dart moved' });
  await expect(sheet).toBeVisible();
  await expect(darts).toHaveCount(1);
  expect((await boxOf(page, 'Skirt front')).width).toBeGreaterThan(hemW + 3);
  await still(page, '5-dart-into-hem');

  // Put back: as drafted again.
  await sheet.getByRole('button', { name: 'Put it back' }).click();
  await expect(darts).toHaveCount(2);
  await draw(page, tip, { x: tip.x, y: b.y + b.height - 1 });
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Move the dart here' }).click();
  await page.getByRole('group', { name: 'Dart moved' }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('group', { name: 'Dart moved' })).toHaveCount(0);

  // The moved dart keeps a diamond where it opens (Cat, Nov 8): tapped, it opens again; dragged along the hem, the
  // flare moves with it.
  const mark = page.locator('rect.pe-cut[data-dart]');
  await expect(mark).toHaveCount(1);
  const m0 = await centre(page, 'rect.pe-cut[data-dart]');
  await page.mouse.click(m0.x, m0.y);
  await expect(page.getByRole('group', { name: 'Dart moved' })).toBeVisible();
  await still(page, '5b-dart-mark-tapped');
  await page.mouse.move(m0.x, m0.y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(m0.x + k * 3, m0.y);
  await page.mouse.up();
  await expect.poll(async () => (await centre(page, 'rect.pe-cut[data-dart]')).x).toBeGreaterThan(m0.x + 8);
  await expect(darts).toHaveCount(1);
  await still(page, '5c-dart-mark-moved');
  await page.getByRole('group', { name: 'Dart moved' }).getByRole('button', { name: 'Done' }).click();

  // A dart point dragged a little way (not to an edge) still just makes the dart longer.
  const other = page.locator('circle.pe-point.dart[data-piece="Skirt front"]').first();
  const at = await centre(page, 'circle.pe-point.dart[data-piece="Skirt front"]');
  await draw(page, at, { x: at.x, y: at.y + 15 });
  await expect(page.getByRole('group', { name: 'Dart moved' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'What should this line do?' })).toHaveCount(0);
  await expect(other).toBeVisible();

  await main.getByRole('button', { name: 'Done moving points' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const canvas = main.locator('canvas.all-round-canvas');
  await expect(canvas).toHaveAttribute('data-sewn', /ready|testing/, { timeout: 60_000 });
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await still(page, '6-all-round-dart-into-hem');
});

test('moves a dress bust dart to the shoulder, and All round sews it', async ({ page }) => {
  if (process.env.STILL_VIEW) await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  const names = await page.locator('path.pe-piece').evaluateAll((els) => els.map((el) => el.getAttribute('data-piece')));
  const front = names.find((n) => /front/i.test(n ?? ''))!;
  await page.locator(`path.pe-piece[data-piece="${front}"]`).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const f = await boxOf(page, front);
  const dart = `circle.pe-point.dart[data-piece="${front}"][data-at="dart0"]`;
  const tip = await centre(page, dart);
  await still(page, '7-dress-before');
  // To the middle of the shoulder: the shoulder runs from the neck's top corner out; aim a little in from the armhole.
  const shoulder = await page.locator(`path.pe-piece[data-piece="${front}"]`).evaluate((el: SVGPathElement, box) => {
    // The highest point of the outline right of the neck, read off the path on screen.
    const svg = el.ownerSVGElement!;
    const ctm = el.getScreenCTM()!;
    const n = el.getTotalLength();
    let best = { x: 0, y: Infinity };
    for (let k = 0; k <= 400; k++) {
      const q = el.getPointAtLength((k / 400) * n);
      const s = new DOMPoint(q.x, q.y).matrixTransform(ctm);
      if (s.x > box.x + box.width * 0.45 && s.x < box.x + box.width * 0.6 && s.y < best.y) best = { x: s.x, y: s.y };
    }
    void svg;
    return best;
  }, f);
  await draw(page, tip, { x: shoulder.x, y: shoulder.y + 1 });
  await still(page, '8-dress-line-to-shoulder');
  await page.getByRole('group', { name: 'What should this line do?' }).getByRole('button', { name: 'Move the dart here' }).click();
  await expect(page.getByRole('group', { name: 'Dart moved' })).toBeVisible();
  await still(page, '9-dress-dart-at-shoulder');
  await page.getByRole('group', { name: 'Dart moved' }).getByRole('button', { name: 'Done' }).click();

  await main.getByRole('button', { name: 'Done moving points' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const canvas = main.locator('canvas.all-round-canvas');
  await expect(canvas).toHaveAttribute('data-sewn', /ready|testing/, { timeout: 90_000 });
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await still(page, '10-dress-all-round');
});
