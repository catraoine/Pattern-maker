import { chooseDrop, expect, goPrint, startWithExample, test } from './fixtures';

// Projector mode (Cat applied, 2026-10-28): the projector file shows in the simple view, and projector mode lines the
// projector up on a cutting mat, checks a 10 cm square, then shows one piece at a time to move and turn.
test('projector: line up on the mat, check the square, then project a piece', async ({ page }, info) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  await chooseDrop(page, 'Paper', 'Projector');
  await expect(main.getByRole('button', { name: /^Download PDF \(1 page\)$/ })).toBeEnabled({ timeout: 45_000 });
  await main.getByRole('button', { name: 'Open projector mode' }).click();

  const pj = page.getByRole('dialog', { name: 'Projector mode' });
  await expect(pj.getByRole('heading', { name: /Drag each corner/ })).toBeVisible();
  // Drag corner 1 a little, as onto a mat's corner.
  const ring = pj.locator('.pj-corner').first().locator('.pj-ring');
  const box = (await ring.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath('1-line-up.png') });
  await pj.getByRole('button', { name: /^Next: check the 10 cm square$/ }).click();

  await expect(pj.getByRole('heading', { name: /Is each side 10 cm\?/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('2-check.png') });
  await pj.getByRole('button', { name: 'Yes: start projecting' }).click();

  const tools = pj.getByRole('toolbar', { name: 'Projector tools' });
  await expect(tools).toContainText('Skirt front');
  await page.screenshot({ path: info.outputPath('3-projecting.png') });
  await tools.getByRole('button', { name: 'Next piece' }).click();
  await expect(tools).toContainText('Skirt back');
  await tools.getByRole('button', { name: 'Turn 90°' }).click();
  await expect(pj).toContainText('Turned 90°');
  await tools.getByRole('button', { name: 'Flip' }).click();
  await expect(tools.getByRole('button', { name: 'Flip' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('4-turned.png') });
  await tools.getByRole('button', { name: 'Close' }).click();
  await expect(pj).toHaveCount(0);

  // The line-up is kept: opening again goes straight to projecting.
  await main.getByRole('button', { name: 'Open projector mode' }).click();
  await expect(page.getByRole('toolbar', { name: 'Projector tools' })).toBeVisible();
});

// A phone turned sideways and mirrored to the projector (Cat, 2026-10-29): the line-up panel used to cover the
// corners on a short screen, so a finger could not grab them. They now sit above it, with arrows to nudge.
test('projector: on a phone turned sideways, a finger drags a corner and the arrows nudge it', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'touch on a short screen');
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  await chooseDrop(page, 'Paper', 'Projector');
  await expect(main.getByRole('button', { name: /^Download PDF \(1 page\)$/ })).toBeEnabled({ timeout: 45_000 });
  await page.setViewportSize({ width: 844, height: 390 });
  await main.getByRole('button', { name: 'Open projector mode' }).click();

  const pj = page.getByRole('dialog', { name: 'Projector mode' });
  const ring = pj.locator('.pj-corner').first().locator('.pj-ring');
  const a = (await ring.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = a.x + a.width / 2, y = a.y + a.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 5, y: y + i * 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Math.round((await ring.boundingBox())!.x - a.x)).toBe(30);

  await pj.getByRole('button', { name: 'Nudge right' }).click();
  await expect.poll(async () => Math.round((await ring.boundingBox())!.x - a.x)).toBe(31);

  await pj.getByRole('button', { name: /^Next: check the 10 cm square$/ }).click();
  await pj.getByRole('button', { name: 'Yes: start projecting' }).click();
  // The tools keep to one row, and Close is still on the screen.
  const tools = pj.getByRole('toolbar', { name: 'Projector tools' });
  expect((await tools.boundingBox())!.height).toBeLessThan(70);
  expect((await tools.getByRole('button', { name: 'Close' }).boundingBox())!.x + 40).toBeLessThan(844);
});
