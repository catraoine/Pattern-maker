import { expect, startWithExample, switchGarment, test } from './fixtures';

// The sketch on the style page opens full screen, one side at a time, to look at the work up close.
test('enlarge the garment drawing', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  let big = page.getByRole('dialog', { name: /enlarged$/ });
  await expect(big.locator('svg').first()).toBeVisible();
  await big.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(big).toHaveCount(0);

  // The dress opens on the form; its flat drawing has a front and a back: one at a time, and a double tap zooms in.
  await switchGarment(page, 'Dress');
  await main.getByRole('button', { name: 'Drawing', exact: true }).click();
  await expect(main.getByRole('img', { name: /^Technical flat/ })).toBeVisible();
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  big = page.getByRole('dialog', { name: /enlarged$/ });
  const views = big.getByRole('group', { name: 'View' });
  await expect(views.getByRole('button', { name: /front/i })).toHaveAttribute('aria-pressed', 'true');
  await views.getByRole('button', { name: /back/i }).click();
  await expect(views.getByRole('button', { name: /back/i })).toHaveAttribute('aria-pressed', 'true');
  const draw = big.locator('.big-sketch-draw');
  const box = (await big.locator('.big-sketch-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  await expect(draw).toHaveAttribute('style', /scale\(2\.5\)/);
  await page.keyboard.press('Escape');
  await expect(big).toHaveCount(0);

  // The turning form has nothing to enlarge.
  await main.getByRole('button', { name: 'All round' }).click();
  await expect(main.getByRole('button', { name: /^Enlarge the drawing/ })).toHaveCount(0);
});
