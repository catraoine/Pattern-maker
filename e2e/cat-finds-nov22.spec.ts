import { test, expect, startWithExample } from './fixtures';
import type { Page } from '@playwright/test';

// Three of Cat's finds on Nov 22. A Feel step on All round swapped the sewn skirt for the shape preview for a second
// while the cloth was sewn again ("this weird jump in fabric"), and its four steps in a run read as one choice, so one
// lit in each pair looked stuck ("how come both buttons stay lit"). And the question a line drawn on the pattern asks
// opened out of sight below the pieces, so drawing seemed to do nothing ("what is the point of being able to draw
// these lines"). And with the list of steps open on a phone, the page went on scrolling under a sliver of drawing at
// the top that offered nothing ("this top scroll that offers nothing").

test('a Feel step keeps the sewn skirt on screen while it sews again, and its steps stand as two pairs', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const cv = main.locator('canvas.all-round-canvas');
  await expect(cv).toHaveAttribute('data-sewn', 'ready', { timeout: 90_000 });
  const feel = main.getByRole('group', { name: 'How the cloth feels' });
  await expect(feel.getByRole('group', { name: 'Stiffness' }).getByRole('button')).toHaveText(['Softer', 'Stiffer']);
  await expect(feel.getByRole('group', { name: 'Weight' }).getByRole('button')).toHaveText(['Lighter', 'Heavier']);

  // Watch every state the view passes through from the tap until the new cloth is sewn: never the shape preview.
  await cv.evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    new MutationObserver(() => seen.push(el.getAttribute('data-sewn') ?? 'none')).observe(el, { attributes: true, attributeFilter: ['data-sewn'] });
  });
  await feel.getByRole('button', { name: /^Lighter/ }).click();
  await expect(feel.getByRole('button', { name: /^Lighter/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen.join(' ')), { timeout: 90_000 }).toMatch(/ready$/);
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen).toContain('resewing');
  expect(seen).not.toContain('pending');
});

async function drawCurl(page: Page, piece: string) {
  const b = (await page.locator(`path.pe-piece[data-piece="${piece}"]`).boundingBox())!;
  // A short curl beside a dart near the waist, as Cat drew it.
  const pts = [[0.5, 0.06], [0.52, 0.1], [0.55, 0.14], [0.52, 0.18], [0.45, 0.2]];
  await page.mouse.move(b.x + b.width * pts[0][0], b.y + b.height * pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(b.x + b.width * x, b.y + b.height * y, { steps: 6 });
  await page.mouse.up();
}

test('a line drawn on the pattern brings its question into view, clear of the Next bar', async ({ page }, info) => {
  // A phone shorter than the pieces and their question, where it hid below the Next bar however far the page scrolled.
  if (info.project.name === 'phone') await page.setViewportSize({ width: 390, height: 640 });
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await expect(page.locator('.point-svg')).toBeVisible();
  await page.waitForTimeout(1500);
  await drawCurl(page, 'Skirt front');
  const ask = page.getByRole('group', { name: 'What should this line do?' });
  await expect(ask).toBeVisible();
  // Every answer can be tapped where it is shown: on screen and not under the bar.
  for (const name of [/Spread it open/, /Add fullness/, /Make a new piece/, /Cancel/]) {
    const b = ask.getByRole('button', { name });
    await expect(b).toBeInViewport({ ratio: 1 });
    expect(await b.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el === hit || el.contains(hit); })).toBe(true);
  }
  await ask.getByRole('button', { name: /Spread it open/ }).click();
  await expect(page.getByRole('group', { name: 'Spread it open' }).getByRole('status')).toHaveText(/cm$/);
});

test('the open list of steps holds the page still, and a tap above it closes it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the list of steps opens over the drawing on a phone only');
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.locator('button.q-head').click();
  await expect(main.locator('.style-tabs.open')).toBeVisible();
  const veil = main.getByRole('button', { name: 'Close the list of steps' });
  await expect(veil).toBeVisible();
  await page.mouse.move(195, 200);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.mouse.click(195, 200);
  await expect(main.locator('.style-tabs.open')).toHaveCount(0);
  await expect(veil).toHaveCount(0);
  // The page scrolls again once it is closed.
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
