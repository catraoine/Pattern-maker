import { expect, openGroup, openReview, startWithExample, switchGarment, test } from './fixtures';
import type { Page } from '@playwright/test';

// Draw on your form: draw a princess seam and a neckline on the dress form, and the pattern follows.

/** Draw a line through points given in cm on the form (the centre front at x = 0, y running down). */
async function draw(page: Page, at: { x: number; y: number }[]) {
  const screen = await page.evaluate((pts) => {
    const svg = document.querySelector<SVGSVGElement>('svg.form-svg')!;
    const cx = svg.viewBox.baseVal.width / 2;
    const ctm = svg.getScreenCTM()!;
    return pts.map((q) => {
      const p = new DOMPoint(q.x + cx, q.y).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    });
  }, at);
  await page.mouse.move(screen[0].x, screen[0].y);
  await page.mouse.down();
  for (const q of screen.slice(1)) await page.mouse.move(q.x, q.y, { steps: 8 });
  await page.mouse.up();
}

test('draws princess seams and a neckline on the form', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();

  await main.getByRole('button', { name: 'Seam', exact: true }).click();
  // From the middle of the shoulder, through the bust point, down to the waist.
  await draw(page, [{ x: 12, y: 0.3 }, { x: 9, y: 24 }, { x: 9, y: 41.5 }]);
  await expect(main.getByRole('status')).toHaveText(/Princess seams from the shoulder/);

  await main.getByRole('button', { name: 'Neckline', exact: true }).click();
  await draw(page, [{ x: 9, y: -1 }, { x: 4, y: 10 }, { x: 0, y: 15 }]);
  await expect(main.getByRole('status')).toHaveText(/Neckline \d+ cm below your neck/);

  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
  await openReview(page);
  await expect(main.getByText(/Bodice side front/).first()).toBeVisible();
});

test('back asks first, then leaves the bodice as it was', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  const back = page.locator('.steady-back');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await main.getByRole('button', { name: 'Seam', exact: true }).click();
  await draw(page, [{ x: 12, y: 0.3 }, { x: 9, y: 24 }, { x: 9, y: 41.5 }]);
  await expect(main.getByRole('status')).toHaveText(/Princess seams/);
  // The header's ← asks before the lines go; "Keep drawing" stays with them.
  await back.click();
  const ask = page.getByRole('dialog', { name: 'Leave your lines?' });
  await expect(ask).toContainText('You drew 1 line.');
  await ask.getByRole('button', { name: 'Keep drawing' }).click();
  await expect(ask).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();
  // Asked again, and this time left without them: back on the style screen, the bodice as it was.
  await back.click();
  await ask.getByRole('button', { name: 'Leave without them' }).click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
  await expect(main.getByText(/Bodice side front/)).toHaveCount(0);
  // With nothing drawn, ← just goes back to the style screen, and the next ← carries on from there.
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await back.click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
  await back.click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toHaveCount(0);
});

test('Done keeps the lines, and the back button then leaves the style screen', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await main.getByRole('button', { name: 'Seam', exact: true }).click();
  await draw(page, [{ x: 12, y: 0.3 }, { x: 9, y: 24 }, { x: 9, y: 41.5 }]);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
  const opened = await openReview(page);
  await expect(main.getByText(/Bodice side front/).first()).toBeVisible();
  // The drawing left nothing behind in the history: ← goes from Review to the style screen, then straight on.
  // On a computer the summary is beside the choices, so there's no Review page to step back from.
  if (opened) {
    await page.locator('.steady-back').click();
    await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
  }
  await page.locator('.steady-back').click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toHaveCount(0);
});

test('draws on the back, and undoes one line at a time', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await main.getByRole('button', { name: 'back', exact: true }).click();
  await main.getByRole('button', { name: 'Neckline', exact: true }).click();
  await draw(page, [{ x: 8, y: -1 }, { x: 4, y: 10 }, { x: 0, y: 16 }]);
  await expect(main.getByRole('status')).toHaveText(/Back neckline \d+ cm below the nape/);
  await main.getByRole('button', { name: 'Undo the last line' }).click();
  await expect(main.getByRole('status')).toHaveText('Last line undone.');
  await expect(main.getByRole('button', { name: 'Undo the last line' })).toBeDisabled();
  await main.getByRole('button', { name: 'Redo the line you undid' }).click();
  await expect(main.getByRole('status')).toHaveText('Line put back.');
  await expect(main.getByRole('button', { name: 'Redo the line you undid' })).toBeDisabled();
  // Drape and side lines go on the front only.
  await main.getByRole('button', { name: 'Drape', exact: true }).click();
  await expect(main.getByRole('button', { name: 'back', exact: true })).toBeDisabled();
});

test('draws a high-low hem on the dress', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await main.getByRole('button', { name: 'Hem', exact: true }).click();
  await main.getByRole('button', { name: 'back', exact: true }).click();
  await draw(page, [{ x: -28, y: 112 }, { x: 0, y: 113 }, { x: 28, y: 112 }]);
  await expect(main.getByRole('status')).toHaveText(/high-low hem/);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your dress' })).toBeVisible();
});

test('draws the hem and side of a skirt on the form', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Skirt');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();
  await draw(page, [{ x: -30, y: 70 }, { x: 0, y: 70 }, { x: 30, y: 70 }]);
  await expect(main.getByRole('status')).toHaveText(/Skirt 70 cm long|Midi skirt/);
  await main.getByRole('button', { name: 'Side', exact: true }).click();
  await draw(page, [{ x: 26, y: 10 }, { x: 26, y: 20 }, { x: 36, y: 66 }]);
  await expect(main.getByRole('status')).toHaveText(/fit at the hip/);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your skirt' })).toBeVisible();
});

test('draws the sleeve length on the T-shirt form', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Tee');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();
  await main.getByRole('button', { name: 'Sleeve', exact: true }).click();
  // Across the right arm, a little below the elbow.
  await draw(page, [{ x: 21, y: 38 }, { x: 28, y: 38 }, { x: 35, y: 38.5 }]);
  await expect(main.getByRole('status')).toHaveText(/Elbow-length sleeves, \d+ cm from the shoulder/);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your T-shirt' })).toBeVisible();
  await expect((await openGroup(page, 'Sleeves')).getByRole('button', { name: 'Elbow', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('draws a double-breasted front on the jacket form', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Jacket');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();
  await main.getByRole('button', { name: 'Front edge', exact: true }).click();
  // Straight down the front, well past the centre.
  await draw(page, [{ x: 7, y: 20 }, { x: 7, y: 40 }, { x: 7, y: 58 }]);
  await expect(main.getByRole('status')).toHaveText(/Double-breasted: the edge 6.5 cm past the centre front/);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your jacket' })).toBeVisible();
  await expect((await openGroup(page, 'Front')).getByRole('button', { name: 'Double-breasted', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('draws a yoke, an uneven neckline and a shaped hem on the bodice', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Draw on your form' }).click();
  await main.getByRole('button', { name: 'Seam', exact: true }).click();
  await draw(page, [{ x: -16, y: 12 }, { x: 0, y: 12.3 }, { x: 16, y: 12 }]);
  await expect(main.getByRole('status')).toHaveText(/yoke/i);
  await main.getByRole('button', { name: 'Neckline', exact: true }).click();
  await draw(page, [{ x: 8, y: -0.5 }, { x: 4, y: 5 }, { x: -2, y: 15 }, { x: -6, y: 8 }, { x: -8, y: -0.5 }]);
  await expect(main.getByRole('status')).toHaveText(/uneven neckline|asymmetric V-neck/i);
  await main.getByRole('button', { name: 'Hem', exact: true }).click();
  await draw(page, [{ x: -22, y: 56 }, { x: 0, y: 62 }, { x: 22, y: 56 }]);
  await expect(main.getByRole('status')).toHaveText(/hem|hip/i);
  await main.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Style your bodice' })).toBeVisible();
});
