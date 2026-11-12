import { chooseChip, goPrint, openReview, showAllTools, startWithExample, switchGarment, test } from './fixtures';

// Stills of the enlarged Move points window for a fuller body, and of each new Undo (Cat, Nov 12). Not a CI test.
// UNDO_STILLS=<folder> npx playwright test -c e2e undo-stills --project=phone
const OUT = process.env.UNDO_STILLS;
test.skip(!OUT, 'Set UNDO_STILLS to a folder to take the stills');

test('undo stills', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/.*/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  await page.evaluate(() => {
    const k = 'pattern-maker:account';
    const a = JSON.parse(localStorage.getItem(k) ?? '{}');
    for (const person of a.people ?? []) Object.assign(person.values, { bust: 112, high_bust: 104, waist: 98, hip: 120, under_bust: 96 });
    localStorage.setItem(k, JSON.stringify(a));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const carryOn = page.getByRole('button', { name: /^Carry on with your/ });
  if (await carryOn.count()) await carryOn.first().click();
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('button', { name: 'Move points' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/1-move-points.png` });
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/2-enlarged.png` });
  const c = (await page.locator('circle[data-piece="Bodice back"]').nth(3).boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y + 14, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/3-point-moved.png` });
  const box = (await page.locator('path[data-piece="Bodice back"]').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.66, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/4-line-drawn.png` });
});

test('undo stills: the other spots', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/.*/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  await chooseChip(page, 'Fit', 'Fitted');
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/5-enlarged-undo.png` });
  await page.keyboard.press('Escape');
  await openReview(page);
  await main.getByRole('button', { name: 'Back to the original style' }).click();
  await main.getByRole('button', { name: 'Yes, start over' }).click();
  await main.getByText('Back to the original style.').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/6-start-over-undo.png` });
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main.getByRole('button', { name: 'I’ve tried on a toile' }).click();
  await main.getByText('Pulls across the hips').click();
  await main.getByRole('button', { name: 'Clear every correction' }).click();
  await main.getByRole('button', { name: 'Undo clear' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/7-clear-undo.png` });
});
