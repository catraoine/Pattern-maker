import { drawTool, expect, goTab, startWithExample, switchGarment, test } from './fixtures';

// Draw on it all round (Cat's A Draw on it, 2026-10-28): inside Draw your lines, the all round switch shows the garment
// turning, and a line drawn on it with one finger is read as the flat tool reads it. DRAW_ROUND_STILLS=<folder> keeps
// the screens.
const OUT = process.env.DRAW_ROUND_STILLS;

test('a hem drawn on the turning dress sets its length', async ({ page, consoleErrors }, info) => {
  consoleErrors.allow(/WebGL|three/i);
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  if (OUT) {
    // For the stills, in a fabric, as a maker would see it.
    await goTab(page, 'Fabric');
    const more = main.locator('.fabric-more');
    if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open))) await main.locator('.fabric-more > summary').click();
    await main.getByRole('radiogroup', { name: "What's printed on your fabric" }).getByRole('radio', { name: 'One-way' }).click();
    await goTab(page, 'Shape');
  }
  await (await drawTool(page)).click();
  await expect(main.getByRole('heading', { name: 'Draw your lines' })).toBeVisible();
  await main.getByRole('button', { name: 'all round', exact: true }).click();
  const cv = main.locator('canvas.all-round-canvas');
  await expect(cv).toBeVisible();
  await page.waitForTimeout(1200);
  if (OUT) await page.screenshot({ path: `${OUT}/${info.project.name}/1-open.png` });

  await main.getByRole('button', { name: 'Hem', exact: true }).click();
  const box = (await cv.boundingBox())!;
  // A level line across the skirt, a little above the dress's knee.
  const y = box.y + box.height * 0.7;
  const x0 = box.x + box.width * 0.3;
  const x1 = box.x + box.width * 0.7;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 10, y);
    if (OUT && i === 6) await page.screenshot({ path: `${OUT}/${info.project.name}/2-drawing.png` });
  }
  await page.mouse.up();
  await expect(main.getByRole('status')).toHaveText(/Hem \d+ cm below the waist/);
  await page.waitForTimeout(600);
  if (OUT) await page.screenshot({ path: `${OUT}/${info.project.name}/3-drawn.png` });

  // Two fingers turn it: the far side comes round and the status keeps the reading.
  await cv.evaluate((el) => el.dispatchEvent(new CustomEvent('allround-turn', { detail: { at: 2.2, probe: false } })));
  await page.waitForTimeout(300);
  if (OUT) await page.screenshot({ path: `${OUT}/${info.project.name}/4-turned.png` });
  // Back to flat, the hem is where it was drawn.
  await main.getByRole('button', { name: 'front', exact: true }).click();
  await expect(main.locator('svg.form-svg')).toBeVisible();
  if (OUT) await page.screenshot({ path: `${OUT}/${info.project.name}/5-flat.png` });
});
